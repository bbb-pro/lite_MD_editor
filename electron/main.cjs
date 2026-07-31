const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const isDev = process.env.NODE_ENV === 'development';

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Lite MD Editor',
    icon: path.join(__dirname, '..', 'public', 'favicon.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  // Build application menu
  const template = buildMenuTemplate();
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function buildMenuTemplate() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: '文件',
      submenu: [
        {
          label: '新建',
          accelerator: 'CmdOrCtrl+N',
          click: () => mainWindow?.webContents.send('menu:new'),
        },
        {
          label: '打开...',
          accelerator: 'CmdOrCtrl+O',
          click: () => mainWindow?.webContents.send('menu:open'),
        },
        { type: 'separator' },
        {
          label: '保存',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow?.webContents.send('menu:save'),
        },
        {
          label: '另存为...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => mainWindow?.webContents.send('menu:saveAs'),
        },
        { type: 'separator' },
        {
          label: '导出 PDF...',
          accelerator: 'CmdOrCtrl+E',
          click: () => mainWindow?.webContents.send('menu:exportPDF'),
        },
        {
          label: '导出 HTML...',
          accelerator: 'CmdOrCtrl+Shift+H',
          click: () => mainWindow?.webContents.send('menu:exportHtml'),
        },
        {
          label: '导出 Word...',
          accelerator: 'CmdOrCtrl+Shift+E',
          click: () => mainWindow?.webContents.send('menu:exportWord'),
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' },
      ],
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '重新加载' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '重置缩放' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' },
      ],
    },
  ];
  return template;
}

/* ---------- IPC: Open File ---------- */
ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '打开 Markdown 文件',
    filters: [
      { name: 'Markdown 文件', extensions: ['md', 'markdown', 'txt'] },
      { name: '所有文件', extensions: ['*'] },
    ],
    properties: ['openFile'],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const filePath = result.filePaths[0];
  const content = fs.readFileSync(filePath, 'utf-8');
  const name = path.basename(filePath);

  return { name, content, path: filePath };
});

/* ---------- IPC: Save File (save-as dialog) ---------- */
ipcMain.handle('dialog:saveFile', async (event, { content, defaultName }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '保存 Markdown 文件',
    defaultPath: defaultName || 'untitled.md',
    filters: [
      { name: 'Markdown 文件', extensions: ['md', 'markdown', 'txt'] },
      { name: '所有文件', extensions: ['*'] },
    ],
  });

  if (result.canceled || !result.filePath) {
    return null;
  }

  fs.writeFileSync(result.filePath, content, 'utf-8');
  return { path: result.filePath, name: path.basename(result.filePath) };
});

/* ---------- IPC: Save File to specific path ---------- */
ipcMain.handle('dialog:saveFileToPath', async (event, { content, filePath }) => {
  try {
    fs.writeFileSync(filePath, content, 'utf-8');
    return { success: true, path: filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

/* ---------- IPC: Export PDF ---------- */
ipcMain.handle('export:pdf', async (event, { defaultName }) => {
  if (!mainWindow) return { success: false, error: 'No window' };

  try {
    const pdfBuffer = await mainWindow.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      printSelectionOnly: false,
    });

    const result = await dialog.showSaveDialog(mainWindow, {
      title: '导出 PDF',
      defaultPath: (defaultName || 'export').replace(/\.(md|markdown|txt)$/i, '') + '.pdf',
      filters: [{ name: 'PDF 文件', extensions: ['pdf'] }],
    });

    if (result.canceled || !result.filePath) {
      return { success: false, cancelled: true };
    }

    fs.writeFileSync(result.filePath, pdfBuffer);
    return { success: true, path: result.filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

/* ---------- IPC: Export generic document (HTML / Word) ---------- */
ipcMain.handle('export:document', async (event, { content, defaultName, filters }) => {
  if (!mainWindow) return { success: false, error: 'No window' };

  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: '导出文件',
      defaultPath: defaultName || 'export.html',
      filters:
        Array.isArray(filters) && filters.length > 0
          ? filters
          : [{ name: '所有文件', extensions: ['*'] }],
    });

    if (result.canceled || !result.filePath) {
      return { success: false, cancelled: true };
    }

    fs.writeFileSync(result.filePath, content, 'utf-8');
    return {
      success: true,
      path: result.filePath,
      name: path.basename(result.filePath),
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

/* ---------- App lifecycle ---------- */
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
