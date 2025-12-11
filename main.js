const { app, BrowserWindow, Tray, Menu, nativeImage, dialog, Notification } = require("electron");
const path = require("path");
const { autoUpdater } = require("electron-updater");
const AutoLaunch = require("auto-launch");

// Configurar autoUpdater
autoUpdater.autoDownload = false; // No descargar automáticamente, preguntar primero
autoUpdater.autoInstallOnAppQuit = true; // Instalar al cerrar la app

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

  // Sistema de actualizaciones automáticas
  const setupAutoUpdater = () => {
    if (!app.isPackaged) {
      console.log("⚠️ Actualizaciones deshabilitadas en modo desarrollo");
      return;
    }

    // Configurar logger
    autoUpdater.logger = console;
    autoUpdater.logger.transports.file.level = "info";

    // Evento: Verificando actualizaciones
    autoUpdater.on("checking-for-update", () => {
      console.log("🔍 Verificando actualizaciones...");
    });

    // Evento: Actualización disponible
    autoUpdater.on("update-available", (info) => {
      console.log("✨ Nueva actualización disponible:", info.version);
      
      const response = dialog.showMessageBoxSync(mainWindow, {
        type: "info",
        title: "Actualización disponible",
        message: `Nueva versión ${info.version} disponible`,
        detail: `Versión actual: ${app.getVersion()}\nNueva versión: ${info.version}\n\n¿Deseas descargar e instalar la actualización?`,
        buttons: ["Descargar ahora", "Más tarde"],
        defaultId: 0,
        cancelId: 1,
      });

      if (response === 0) {
        autoUpdater.downloadUpdate();
        
        // Mostrar notificación
        if (Notification.isSupported()) {
          new Notification({
            title: "Descargando actualización",
            body: `Descargando versión ${info.version}...`,
            icon: resolveAssetPath("icono", "icono.png"),
          }).show();
        }
      }
    });

    // Evento: No hay actualizaciones
    autoUpdater.on("update-not-available", (info) => {
      console.log("✓ Aplicación actualizada (versión " + info.version + ")");
    });

    // Evento: Error al buscar actualizaciones
    autoUpdater.on("error", (err) => {
      console.error("❌ Error en auto-updater:", err);
      
      if (mainWindow && mainWindow.isVisible()) {
        dialog.showErrorBox(
          "Error de actualización",
          `No se pudo verificar actualizaciones:\n${err.message}`
        );
      }
    });

    // Evento: Progreso de descarga
    autoUpdater.on("download-progress", (progressObj) => {
      const message = `Descargando: ${Math.round(progressObj.percent)}%`;
      console.log(message);
      
      // Actualizar título de la ventana con el progreso
      if (mainWindow) {
        mainWindow.setTitle(`Panel AMCHAM - ${message}`);
      }
    });

    // Evento: Actualización descargada
    autoUpdater.on("update-downloaded", (info) => {
      console.log("✓ Actualización descargada:", info.version);
      
      // Restaurar título
      if (mainWindow) {
        mainWindow.setTitle("Panel AMCHAM");
      }

      const response = dialog.showMessageBoxSync(mainWindow, {
        type: "info",
        title: "Actualización lista",
        message: "La actualización se ha descargado correctamente",
        detail: `Versión ${info.version} lista para instalar.\n\n¿Deseas reiniciar ahora para aplicar la actualización?`,
        buttons: ["Reiniciar ahora", "Reiniciar más tarde"],
        defaultId: 0,
        cancelId: 1,
      });

      if (response === 0) {
        isQuitting = true;
        autoUpdater.quitAndInstall(false, true);
      } else {
        // Notificar que se instalará al cerrar
        if (Notification.isSupported()) {
          new Notification({
            title: "Actualización pendiente",
            body: "La actualización se instalará cuando cierres la aplicación",
            icon: resolveAssetPath("icono", "icono.png"),
          }).show();
        }
      }
    });

    // Verificar actualizaciones al iniciar
    setTimeout(() => {
      console.log("🔄 Verificando actualizaciones automáticamente...");
      autoUpdater.checkForUpdates().catch((err) => {
        console.warn("⚠️ No se pudo verificar actualizaciones:", err.message);
      });
    }, 5000); // Esperar 5 segundos después del inicio
  };

  const createTray = () => {
    const iconName = process.platform === "win32" ? "icono.ico" : "icono.png";
    const iconPath = resolveAssetPath("icono", iconName);

    // Crear nativeImage para asegurar que el ícono se cargue correctamente
    const trayIcon = nativeImage.createFromPath(iconPath);
    
    tray = new Tray(trayIcon);
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
      {
        label: "Buscar actualizaciones",
        click: () => {
          if (!app.isPackaged) {
            dialog.showMessageBox(mainWindow, {
              type: "info",
              title: "Modo desarrollo",
              message: "Las actualizaciones solo están disponibles en la versión empaquetada",
            });
            return;
          }
          
          console.log("🔍 Verificación manual de actualizaciones...");
          autoUpdater.checkForUpdates().catch((err) => {
            dialog.showErrorBox(
              "Error",
              `No se pudo verificar actualizaciones:\n${err.message}`
            );
          });
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
    const iconPath = resolveAssetPath("icono", iconName);

    // Crear nativeImage para asegurar que el ícono se cargue correctamente
    const appIcon = nativeImage.createFromPath(iconPath);

    mainWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 1024,
      minHeight: 720,
      backgroundColor: "#f3f6f1",
      autoHideMenuBar: true,
      icon: appIcon,
      title: "Panel AMCHAM",
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    });

    // Establecer el ícono de la ventana explícitamente (Windows)
    if (process.platform === 'win32' && mainWindow) {
      mainWindow.setIcon(appIcon);
    }

    // Establecer el ícono también en el overlay (taskbar)
    if (process.platform === 'win32') {
      mainWindow.setOverlayIcon(appIcon, 'Panel AMCHAM');
    }

    // Cargar desde el servidor Node.js externo en puerto 3005
    mainWindow.loadURL('http://localhost:3005');

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

    // Configurar AppUserModelId ANTES de crear ventanas/tray
    if (process.platform === "win32") {
      app.setAppUserModelId("com.summa.cham.panelamcham");
    }

    // Configurar variables de entorno según modo (development/production)
    const { setupEnvironment } = require("./src/config/env-config");
    const envConfig = setupEnvironment();

    // Iniciar servidor Node.js como servicio
    let servidor = null;
    try {
      console.log("🚀 Iniciando servidor backend...");
      console.log(`   Modo: ${envConfig.isDevelopment ? 'DESARROLLO' : 'PRODUCCIÓN'}`);
      console.log(`   Firebird: ${envConfig.firebird.host}:${envConfig.firebird.port}`);
      console.log(`   Servidor: http://localhost:${envConfig.server.port}`);
      
      const iniciarServidor = require("./src/server");
      servidor = iniciarServidor(envConfig.server.port);
      
      if (!servidor) {
        throw new Error("El servidor no se pudo iniciar");
      }
      
      console.log("✓ Servidor backend iniciado en puerto 3005");
      console.log("✓ Accesible localmente en http://localhost:3005");
      console.log("✓ Accesible públicamente vía túnel HTTPS");
      
      // Esperar a que el servidor esté listo antes de crear la ventana
      setTimeout(() => {
        console.log("Creando ventana Electron y tray...");
        createTray();
        createWindow();
        console.log("✓ Aplicación lista - Servicio activo");
      }, 1500);
    } catch (e) {
      console.error("❌ Error fatal iniciando el servidor:");
      console.error("  Mensaje:", e.message);
      console.error("  Stack:", e.stack);
      
      const { dialog } = require("electron");
      dialog.showErrorBox(
        "Error al iniciar servicio",
        `No se pudo iniciar el servidor:\n\n${e.message}\n\nLa aplicación se cerrará.`
      );
      app.quit();
      return;
    }

    if (process.platform === "win32" || process.platform === "linux") {
      configureAutoLaunch();
    }

    // Configurar sistema de actualizaciones
    setupAutoUpdater();

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
