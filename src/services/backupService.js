/**
 * backupService.js
 * Servicio para realizar backups automáticos de la base de datos SQLite
 */

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

class BackupService {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
    this.config = {
      enabled: true,
      intervalMinutes: 60, // Backup cada hora por defecto
      maxBackups: 24, // Mantener últimos 24 backups (1 día si es cada hora)
      backupPath: null, // Se define en initialize()
      compression: false, // Futuro: comprimir backups
    };
  }

  /**
   * Inicializa el servicio de backups
   * @param {Object} options - Configuración personalizada
   */
  initialize(options = {}) {
    this.config = { ...this.config, ...options };

    // Determinar ruta de backups
    if (!this.config.backupPath) {
      const dataDir = this._getDataDirectory();
      this.config.backupPath = path.join(dataDir, "backups");
    }

    // Crear directorio de backups si no existe
    if (!fs.existsSync(this.config.backupPath)) {
      fs.mkdirSync(this.config.backupPath, { recursive: true });
      console.log(`✓ Directorio de backups creado: ${this.config.backupPath}`);
    }

    console.log("✓ Servicio de backups inicializado:", {
      enabled: this.config.enabled,
      interval: `${this.config.intervalMinutes} minutos`,
      maxBackups: this.config.maxBackups,
      path: this.config.backupPath,
    });
  }

  /**
   * Inicia el servicio de backups automáticos
   */
  start() {
    if (!this.config.enabled) {
      console.log("⚠ Backups automáticos deshabilitados en configuración");
      return;
    }

    if (this.isRunning) {
      console.log("⚠ Servicio de backups ya está ejecutándose");
      return;
    }

    // Realizar backup inicial
    this.createBackup()
      .then(() => console.log("✓ Backup inicial completado"))
      .catch((err) => console.error("❌ Error en backup inicial:", err));

    // Programar backups periódicos
    const intervalMs = this.config.intervalMinutes * 60 * 1000;
    this.intervalId = setInterval(() => {
      this.createBackup().catch((err) =>
        console.error("❌ Error en backup automático:", err)
      );
    }, intervalMs);

    this.isRunning = true;
    console.log(
      `✓ Backups automáticos iniciados (cada ${this.config.intervalMinutes} minutos)`
    );
  }

  /**
   * Detiene el servicio de backups automáticos
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log("✓ Servicio de backups detenido");
  }

  /**
   * Crea un backup de la base de datos
   * @returns {Promise<Object>} Información del backup creado
   */
  async createBackup() {
    try {
      const dbPath = this._getDatabasePath();

      if (!fs.existsSync(dbPath)) {
        throw new Error(`Base de datos no encontrada: ${dbPath}`);
      }

      // Generar nombre de archivo con timestamp
      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .replace("T", "_")
        .split(".")[0];
      const backupFileName = `panel_${timestamp}.sqlite`;
      const backupFilePath = path.join(this.config.backupPath, backupFileName);

      // Copiar archivo de base de datos
      fs.copyFileSync(dbPath, backupFilePath);

      // Verificar integridad del backup
      const originalStats = fs.statSync(dbPath);
      const backupStats = fs.statSync(backupFilePath);

      if (originalStats.size !== backupStats.size) {
        throw new Error(
          "El tamaño del backup no coincide con el original"
        );
      }

      // Calcular checksum para verificación adicional
      const checksum = await this._calculateChecksum(backupFilePath);

      const backupInfo = {
        fileName: backupFileName,
        path: backupFilePath,
        size: backupStats.size,
        timestamp: new Date().toISOString(),
        checksum,
      };

      // Limpiar backups antiguos
      await this._cleanOldBackups();

      console.log(`✓ Backup creado: ${backupFileName} (${this._formatBytes(backupStats.size)})`);

      return backupInfo;
    } catch (error) {
      console.error("❌ Error creando backup:", error);
      throw error;
    }
  }

  /**
   * Restaura la base de datos desde un backup
   * @param {string} backupFileName - Nombre del archivo de backup
   * @returns {Promise<boolean>}
   */
  async restoreBackup(backupFileName) {
    try {
      const backupFilePath = path.join(this.config.backupPath, backupFileName);

      if (!fs.existsSync(backupFilePath)) {
        throw new Error(`Backup no encontrado: ${backupFileName}`);
      }

      const dbPath = this._getDatabasePath();

      // Crear backup de seguridad antes de restaurar
      const safetyBackup = `${dbPath}.before-restore-${Date.now()}.bak`;
      fs.copyFileSync(dbPath, safetyBackup);
      console.log(`✓ Backup de seguridad creado: ${safetyBackup}`);

      // Restaurar desde backup
      fs.copyFileSync(backupFilePath, dbPath);

      console.log(`✓ Base de datos restaurada desde: ${backupFileName}`);

      return true;
    } catch (error) {
      console.error("❌ Error restaurando backup:", error);
      throw error;
    }
  }

  /**
   * Lista todos los backups disponibles
   * @returns {Promise<Array>} Lista de backups
   */
  async listBackups() {
    try {
      const files = fs.readdirSync(this.config.backupPath);
      const backups = [];

      for (const file of files) {
        if (file.endsWith(".sqlite")) {
          const filePath = path.join(this.config.backupPath, file);
          const stats = fs.statSync(filePath);

          backups.push({
            fileName: file,
            path: filePath,
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime,
          });
        }
      }

      // Ordenar por fecha de creación (más reciente primero)
      backups.sort((a, b) => b.created - a.created);

      return backups;
    } catch (error) {
      console.error("❌ Error listando backups:", error);
      return [];
    }
  }

  /**
   * Elimina backups antiguos según configuración
   * @private
   */
  async _cleanOldBackups() {
    try {
      const backups = await this.listBackups();

      if (backups.length <= this.config.maxBackups) {
        return;
      }

      // Eliminar los más antiguos
      const toDelete = backups.slice(this.config.maxBackups);

      for (const backup of toDelete) {
        fs.unlinkSync(backup.path);
        console.log(`✓ Backup antiguo eliminado: ${backup.fileName}`);
      }
    } catch (error) {
      console.error("❌ Error limpiando backups antiguos:", error);
    }
  }

  /**
   * Calcula el checksum SHA256 de un archivo
   * @private
   */
  async _calculateChecksum(filePath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash("sha256");
      const stream = fs.createReadStream(filePath);

      stream.on("data", (data) => hash.update(data));
      stream.on("end", () => resolve(hash.digest("hex")));
      stream.on("error", reject);
    });
  }

  /**
   * Obtiene el directorio de datos
   * @private
   */
  _getDataDirectory() {
    if (process.env.PANELAMCHAM_DATA_DIR) {
      return path.resolve(process.env.PANELAMCHAM_DATA_DIR);
    }

    const localPath = path.resolve(__dirname, "../../datos");
    if (fs.existsSync(localPath)) {
      return localPath;
    }

    try {
      const electron = require("electron");
      if (electron?.app?.getPath) {
        return path.join(electron.app.getPath("userData"), "datos");
      }
    } catch (_) {
      // Electron no disponible
    }

    return path.join(process.cwd(), "datos");
  }

  /**
   * Obtiene la ruta de la base de datos
   * @private
   */
  _getDatabasePath() {
    const dataDir = this._getDataDirectory();
    return path.join(dataDir, "panel.sqlite");
  }

  /**
   * Formatea bytes en formato legible
   * @private
   */
  _formatBytes(bytes) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  }

  /**
   * Obtiene el estado actual del servicio
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      config: { ...this.config },
      nextBackup: this.intervalId
        ? new Date(
            Date.now() + this.config.intervalMinutes * 60 * 1000
          ).toISOString()
        : null,
    };
  }
}

// Exportar instancia singleton
const backupService = new BackupService();
module.exports = backupService;
