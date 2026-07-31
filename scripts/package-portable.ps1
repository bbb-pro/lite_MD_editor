<#
.SYNOPSIS
    Packages the electron-builder unpacked output into a no-install ZIP archive.

.DESCRIPTION
    Reads the version from package.json, stages release/win-unpacked into a
    versioned top-level folder ("Lite MD Editor <version> Portable"), and
    compresses that folder into release/Lite-MD-Editor-Portable-<version>.zip.

    The archive always contains exactly one top-level folder, so users get a
    clean "extract and run" experience instead of loose files in their
    Downloads directory.

    Zero extra npm dependencies: only built-in PowerShell cmdlets and the
    System.IO.Compression types shipped with .NET Framework are used.

    Compression is done through System.IO.Compression.ZipArchive rather than
    Compress-Archive because the built-in cmdlet opens source files without
    FileShare.Write, which makes it fail with "file is being used by another
    process" whenever an antivirus / search indexer momentarily holds a freshly
    copied file. Here every file is opened with FileShare.ReadWrite and briefly
    retried, which makes the build step reliable on developer machines.

.NOTES
    Invoked automatically by `npm run dist` after electron-builder finishes.
    Can also be run standalone:  powershell -File scripts/package-portable.ps1
#>

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.IO.Compression | Out-Null
Add-Type -AssemblyName System.IO.Compression.FileSystem | Out-Null

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

<#
    Opens a file for reading, tolerating other processes that hold the file
    open (antivirus scanners, search indexers). Retries a few times before
    giving up.
#>
function Open-SourceFile {
    param(
        [Parameter(Mandatory = $true)][string] $Path,
        [int] $MaxAttempts = 10,
        [int] $DelayMs = 300
    )

    for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
        try {
            return [System.IO.File]::Open(
                $Path,
                [System.IO.FileMode]::Open,
                [System.IO.FileAccess]::Read,
                [System.IO.FileShare]::ReadWrite -bor [System.IO.FileShare]::Delete
            )
        }
        catch [System.IO.IOException] {
            if ($attempt -eq $MaxAttempts) { throw }
            Start-Sleep -Milliseconds $DelayMs
        }
        catch [System.UnauthorizedAccessException] {
            if ($attempt -eq $MaxAttempts) { throw }
            Start-Sleep -Milliseconds $DelayMs
        }
    }
}

<#
    Compresses $SourceDir into $ZipPath, storing every entry underneath a
    single top-level folder named after the source directory.
#>
function New-PortableArchive {
    param(
        [Parameter(Mandatory = $true)][string] $SourceDir,
        [Parameter(Mandatory = $true)][string] $ZipPath
    )

    $rootName = Split-Path -Leaf $SourceDir
    $prefixLength = $SourceDir.TrimEnd('\').Length + 1
    $level = [System.IO.Compression.CompressionLevel]::Optimal

    $zipStream = [System.IO.File]::Open(
        $ZipPath,
        [System.IO.FileMode]::Create,
        [System.IO.FileAccess]::Write,
        [System.IO.FileShare]::None
    )
    $archive = $null
    $fileCount = 0

    try {
        $archive = New-Object System.IO.Compression.ZipArchive(
            $zipStream, [System.IO.Compression.ZipArchiveMode]::Create, $false)

        # Preserve empty directories so the extracted tree matches the build.
        foreach ($dir in Get-ChildItem -LiteralPath $SourceDir -Recurse -Directory -Force) {
            if ((Get-ChildItem -LiteralPath $dir.FullName -Force | Measure-Object).Count -eq 0) {
                $relative = $dir.FullName.Substring($prefixLength).Replace('\', '/')
                $archive.CreateEntry("$rootName/$relative/", $level) | Out-Null
            }
        }

        foreach ($file in Get-ChildItem -LiteralPath $SourceDir -Recurse -File -Force) {
            $relative = $file.FullName.Substring($prefixLength).Replace('\', '/')
            $entry = $archive.CreateEntry("$rootName/$relative", $level)
            $entry.LastWriteTime = [System.DateTimeOffset]::new($file.LastWriteTime)

            $source = Open-SourceFile -Path $file.FullName
            try {
                $target = $entry.Open()
                try { $source.CopyTo($target) }
                finally { $target.Dispose() }
            }
            finally { $source.Dispose() }

            $fileCount++
        }
    }
    finally {
        if ($null -ne $archive) { $archive.Dispose() }
        $zipStream.Dispose()
    }

    return $fileCount
}

# ---------------------------------------------------------------------------
# Resolve paths
# ---------------------------------------------------------------------------

# $PSScriptRoot -> <project>/scripts ; go up one level to reach the project root.
$root = Split-Path -Parent $PSScriptRoot

$packageJsonPath = Join-Path $root "package.json"
if (-not (Test-Path -LiteralPath $packageJsonPath)) {
    Write-Error "package.json not found at: $packageJsonPath"
    exit 1
}

$version = (Get-Content -LiteralPath $packageJsonPath -Raw | ConvertFrom-Json).version
if ([string]::IsNullOrWhiteSpace($version)) {
    Write-Error "Unable to read the 'version' field from package.json."
    exit 1
}

$releaseDir = Join-Path $root "release"
$unpackedDir = Join-Path $releaseDir "win-unpacked"
$stageRoot = Join-Path $releaseDir "stage"
$folderName = "Lite MD Editor $version Portable"
$stageDir = Join-Path $stageRoot $folderName
$zipPath = Join-Path $releaseDir "Lite-MD-Editor-Portable-$version.zip"

# ---------------------------------------------------------------------------
# Defensive checks
# ---------------------------------------------------------------------------

if (-not (Test-Path -LiteralPath $unpackedDir)) {
    Write-Error "Unpacked build not found at: $unpackedDir`nRun 'electron-builder --win' first (npm run dist does this automatically)."
    exit 1
}

Write-Host "[package-portable] Version      : $version"
Write-Host "[package-portable] Source       : $unpackedDir"
Write-Host "[package-portable] Archive root : $folderName"

# ---------------------------------------------------------------------------
# Stage -> compress -> clean up (idempotent across repeated runs)
# ---------------------------------------------------------------------------

try {
    # 1. Remove any leftover staging directory from a previous/interrupted run.
    if (Test-Path -LiteralPath $stageRoot) {
        Remove-Item -LiteralPath $stageRoot -Recurse -Force
    }

    # 2. Create the versioned top-level folder inside the staging area.
    New-Item -ItemType Directory -Path $stageDir -Force | Out-Null

    # 3. Copy the whole unpacked build into the staging folder.
    Write-Host "[package-portable] Copying files..."
    Copy-Item -Path (Join-Path $unpackedDir "*") -Destination $stageDir -Recurse -Force

    # 4. Remove a stale zip so we never append to an outdated archive.
    if (Test-Path -LiteralPath $zipPath) {
        Remove-Item -LiteralPath $zipPath -Force
    }

    # 5. Compress the staging folder, keeping it as the archive's top level.
    Write-Host "[package-portable] Compressing (this may take a minute)..."
    $fileCount = New-PortableArchive -SourceDir $stageDir -ZipPath $zipPath
}
finally {
    # 6. Always drop the temporary staging directory, even on failure.
    if (Test-Path -LiteralPath $stageRoot) {
        Remove-Item -LiteralPath $stageRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}

# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------

$sizeMB = [Math]::Round((Get-Item -LiteralPath $zipPath).Length / 1MB, 2)
Write-Host ""
Write-Host "[package-portable] OK  ->  $zipPath" -ForegroundColor Green
Write-Host "[package-portable] $fileCount files, $sizeMB MB, top-level folder: $folderName" -ForegroundColor Green
