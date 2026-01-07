/**
 * routes/backups.js
 * Rutas API para gestionar backups de la base de datos
 */

const express = require("express");
const router = express.Router();
const backupService = require("../services/backupService");
const { requireAuth } = require("../middleware/auth");

const esAdminGlobal = (req) =>
  Boolean(req.esAdmin || req.usuarioActual?.esAdminGlobal || req.usuarioActual?.es_admin_global);

/**
 * GET /api/backups/status
 * Obtiene el estado del servicio de backups
 */
router.get("/status", requireAuth, (req, res) => {
  try {
    const status = backupService.getStatus();
    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error("Error obteniendo estado de backups:", error);
    res.status(500).json({
      success: false,
      error: "Error obteniendo estado de backups",
    });
  }
});

/**
 * GET /api/backups/list
 * Lista todos los backups disponibles
 */
router.get("/list", requireAuth, async (req, res) => {
  try {
    const backups = await backupService.listBackups();
    res.json({
      success: true,
      data: backups,
      count: backups.length,
    });
  } catch (error) {
    console.error("Error listando backups:", error);
    res.status(500).json({
      success: false,
      error: "Error listando backups",
    });
  }
});

/**
 * POST /api/backups/create
 * Crea un backup manual de la base de datos
 */
router.post("/create", requireAuth, async (req, res) => {
  try {
    // Verificar que el usuario sea administrador
    if (!esAdminGlobal(req)) {
      return res.status(403).json({
        success: false,
        error: "Acceso denegado. Solo administradores pueden crear backups.",
      });
    }

    const backupInfo = await backupService.createBackup();
    res.json({
      success: true,
      message: "Backup creado exitosamente",
      data: backupInfo,
    });
  } catch (error) {
    console.error("Error creando backup:", error);
    res.status(500).json({
      success: false,
      error: "Error creando backup: " + error.message,
    });
  }
});

/**
 * POST /api/backups/restore
 * Restaura la base de datos desde un backup
 */
router.post("/restore", requireAuth, async (req, res) => {
  try {
    // Verificar que el usuario sea administrador
    if (!esAdminGlobal(req)) {
      return res.status(403).json({
        success: false,
        error: "Acceso denegado. Solo administradores pueden restaurar backups.",
      });
    }

    const { backupFileName } = req.body;

    if (!backupFileName) {
      return res.status(400).json({
        success: false,
        error: "Se requiere el nombre del archivo de backup",
      });
    }

    await backupService.restoreBackup(backupFileName);

    res.json({
      success: true,
      message: "Base de datos restaurada exitosamente. Reinicia la aplicación.",
    });
  } catch (error) {
    console.error("Error restaurando backup:", error);
    res.status(500).json({
      success: false,
      error: "Error restaurando backup: " + error.message,
    });
  }
});

/**
 * GET /api/backups/download/:fileName
 * Descarga un archivo de backup
 */
router.get("/download/:fileName", requireAuth, (req, res) => {
  try {
    // Verificar que el usuario sea administrador
    if (!esAdminGlobal(req)) {
      return res.status(403).json({
        success: false,
        error: "Acceso denegado",
      });
    }

    const { fileName } = req.params;
    const backupPath = backupService.config.backupPath;
    const filePath = require("path").join(backupPath, fileName);

    // Verificar que el archivo existe
    const fs = require("fs");
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: "Backup no encontrado",
      });
    }

    // Enviar archivo
    res.download(filePath, fileName, (err) => {
      if (err) {
        console.error("Error descargando backup:", err);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            error: "Error descargando backup",
          });
        }
      }
    });
  } catch (error) {
    console.error("Error en descarga de backup:", error);
    res.status(500).json({
      success: false,
      error: "Error descargando backup",
    });
  }
});

/**
 * PUT /api/backups/config
 * Actualiza la configuración del servicio de backups
 */
router.put("/config", requireAuth, (req, res) => {
  try {
    // Verificar que el usuario sea administrador
    if (!esAdminGlobal(req)) {
      return res.status(403).json({
        success: false,
        error: "Acceso denegado",
      });
    }

    const { enabled, intervalMinutes, maxBackups } = req.body;

    // Validar parámetros
    if (intervalMinutes !== undefined && (intervalMinutes < 5 || intervalMinutes > 1440)) {
      return res.status(400).json({
        success: false,
        error: "El intervalo debe estar entre 5 y 1440 minutos",
      });
    }

    if (maxBackups !== undefined && (maxBackups < 1 || maxBackups > 100)) {
      return res.status(400).json({
        success: false,
        error: "El máximo de backups debe estar entre 1 y 100",
      });
    }

    // Actualizar configuración
    if (enabled !== undefined) backupService.config.enabled = enabled;
    if (intervalMinutes !== undefined)
      backupService.config.intervalMinutes = intervalMinutes;
    if (maxBackups !== undefined) backupService.config.maxBackups = maxBackups;

    // Reiniciar servicio si está activo
    if (backupService.isRunning) {
      backupService.stop();
      backupService.start();
    }

    res.json({
      success: true,
      message: "Configuración actualizada",
      data: backupService.config,
    });
  } catch (error) {
    console.error("Error actualizando configuración:", error);
    res.status(500).json({
      success: false,
      error: "Error actualizando configuración",
    });
  }
});

module.exports = router;
