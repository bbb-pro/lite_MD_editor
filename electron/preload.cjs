const { contextBridge, ipcRenderer } = require('electron');

// Detect Electron environment
const isElectron = typeof process !== 'undefined' && process.versions?.electron !== undefined;

if (isElectron) {
  contextBridge.exposeInMainWorld('electronAPI', {
    platform: process.platform,
    isElectron: true,

    // Native file dialogs
    openFile: () => ipcRenderer.invoke('dialog:openFile'),
    saveFile: (data) => ipcRenderer.invoke('dialog:saveFile', data),
    saveFileToPath: (data) => ipcRenderer.invoke('dialog:saveFileToPath', data),

    // PDF export
    exportPDF: (data) => ipcRenderer.invoke('export:pdf', data),

    // Menu events
    onMenuNew: (callback) => ipcRenderer.on('menu:new', callback),
    onMenuOpen: (callback) => ipcRenderer.on('menu:open', callback),
    onMenuSave: (callback) => ipcRenderer.on('menu:save', callback),
    onMenuSaveAs: (callback) => ipcRenderer.on('menu:saveAs', callback),
    onMenuExportPDF: (callback) => ipcRenderer.on('menu:exportPDF', callback),
  });
} else {
  // Non-Electron fallback (web browser)
  contextBridge.exposeInMainWorld('electronAPI', {
    isElectron: false,
    platform: 'web',
  });
}
