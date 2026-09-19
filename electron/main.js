// Desktop shell (Windows + macOS) around the offline web app in ../app.
const { app, BrowserWindow, Menu, shell, dialog } = require('electron');
const path = require('path');

const INDEX = path.join(__dirname, '..', 'app', 'index.html');
const isMac = process.platform === 'darwin';

// One window/profile only, so localStorage (all console data) is never opened twice at once.
if (!app.requestSingleInstanceLock()) app.quit();

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#f5ead8',
    title: 'Internal Medicine Training Suite',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false
    }
  });

  win.once('ready-to-show', () => { win.maximize(); win.show(); });
  win.loadFile(INDEX);

  // External http(s) links open in the user's default browser, never inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file:')) { e.preventDefault(); if (/^https?:/i.test(url)) shell.openExternal(url); }
  });

  // Downloads (JSON backups, CSV/XLSX/Word exports): always ask where to save.
  win.webContents.session.on('will-download', (_e, item) => {
    item.setSaveDialogOptions({ defaultPath: path.join(app.getPath('documents'), item.getFilename()) });
  });

  win.on('closed', () => { win = null; });
}

function buildMenu() {
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'Print…', accelerator: 'CmdOrCtrl+P', click: () => win && win.webContents.print() },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { type: 'separator' },
        { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { role: 'toggleDevTools' }
      ]
    },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [{
        label: 'About',
        click: () => dialog.showMessageBox(win, {
          type: 'info',
          title: 'About',
          message: 'Internal Medicine Training Suite',
          detail: `Version ${app.getVersion()}\nAll data is stored locally on this computer.\nUse the console's JSON backup to move data between computers.`
        })
      }]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.on('second-instance', () => {
  if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
});

app.whenReady().then(() => {
  buildMenu();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (!isMac) app.quit(); });
