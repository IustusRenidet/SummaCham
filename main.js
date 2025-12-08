const { app, BrowserWindow, Tray, Menu } = require("electron");
const path = require("path");
const AutoLaunch = require("auto-launch");

// Garantizar una única instancia de la aplicación
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  let mainWindow = null;
  let tray = null;
  let isQuitting = false;

  const resolveAssetPath = (...segments) => {
    return path.join(app.getAppPath(), ...segments);
  };

  // Configuración de Auto-Inicio
  const configureAutoLaunch = () => {
    const autoLauncher = new AutoLaunch({
      name: "PanelAMCHAM",
      path: app.getPath("exe"),
    });

    autoLauncher
      .isEnabled()
      .then((isEnabled) => {
        if (!isEnabled) autoLauncher.enable();
      })
      .catch((err) => {
        console.warn("Error configurando auto-launch:", err);
      });
  };

  const createTray = () => {
    const iconName = process.platform === "win32" ? "icono.ico" : "icono.png";
    const iconPath = resolveAssetPath("icono", iconName);

    tray = new Tray(iconPath);
    tray.setToolTip("Panel Financiero AMCHAM");

    const contextMenu = Menu.buildFromTemplate([
      {
        label: "Abrir Panel",
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
          } else {
            createWindow();
          }
        },
      },
      { type: "separator" },
      {
        label: "Reiniciar Servidor",
        click: () => {
          app.relaunch();
          app.exit(0);
        },
      },
      {
        label: "Salir (Detener Servicio)",
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]);

    tray.setContextMenu(contextMenu);

    tray.on("double-click", () => {
      if (mainWindow) {
        mainWindow.show();
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      }
    });
  };

  const createWindow = () => {
    const iconName = process.platform === "win32" ? "icono.ico" : "icono.png";

    mainWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 1024,
      minHeight: 720,
      backgroundColor: "#f3f6f1",
      autoHideMenuBar: true,
      icon: resolveAssetPath("icono", iconName),
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    });

    mainWindow.loadFile(resolveAssetPath("vistas", "app.html"));

    // Interceptar cierre para minimizar en lugar de salir
    mainWindow.on("close", (event) => {
      if (!isQuitting) {
        event.preventDefault();
        mainWindow.hide();
        // Opcional: Notificar al usuario que la app sigue corriendo
        if (tray) {
          tray.displayBalloon({
            title: "Panel AMCHAM",
            content: "La aplicación sigue ejecutándose en segundo plano.",
          });
        }
      }
      return false;
    });

    if (!app.isPackaged) {
      try {
        mainWindow.webContents.openDevTools({ mode: "detach" });
      } catch (_) {}
    }

    mainWindow.webContents.on(
      "did-fail-load",
      (_e, code, desc, _url, isMainFrame) => {
        console.error("Fallo al cargar vista:", { code, desc, isMainFrame });
      }
    );
  };

  app.whenReady().then(() => {
    process.env.PANELAMCHAM_DATA_DIR = path.join(
      app.getPath("userData"),
      "datos"
    );

    // Iniciar Backend
    try {
      const iniciarServidor = require("./src/server");
      iniciarServidor();
    } catch (e) {
      console.error("Error fatal iniciando el servidor:", e);
    }

    app.setAppUserModelId("com.summa.cham");

    // Configurar persistencia
    createTray();
    createWindow();

    if (process.platform === "win32" || process.platform === "linux") {
      configureAutoLaunch();
    }

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on("second-instance", () => {
    // Si el usuario intenta abrir otra instancia, enfocamos la existente
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });

  // Solo salir explícitamente si isQuitting es true (manejado arriba)
  app.on("window-all-closed", () => {
    // No hacer nada, mantener el proceso vivo
  });
}
