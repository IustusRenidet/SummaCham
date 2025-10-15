const { app, BrowserWindow } = require('electron');
const path = require('path');

const resolveAssetPath = (...segments) => {
  return path.join(app.getAppPath(), ...segments);
};

const createWindow = () => {
  const iconName = process.platform === 'win32' ? 'icono.ico' : 'icono.png';

  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 720,
    backgroundColor: '#f3f6f1',
    autoHideMenuBar: true,
    icon: resolveAssetPath('icono', iconName)
  });

  mainWindow.loadFile(resolveAssetPath('vistas', 'Vista1.html'));
};

app.whenReady().then(() => {
  app.setAppUserModelId('com.summa.cham');
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
