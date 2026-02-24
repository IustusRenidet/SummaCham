/**
 * export-utils.js
 * Módulo reutilizable para exportar tablas a Excel y PDF
 * Compatible con todos los módulos (RESUMEN, SUMMARY, PRESUPUESTOS, Departamentales)
 */

(() => {
  "use strict";

  const API_BASE = (() => {
    if (window.location.protocol === "file:") return "http://localhost:3005/api";
    return `${window.location.origin.replace(/\/$/, "")}/api`;
  })();

  // Extrae la parte base64 de un Data URL (ExcelJS requiere solo base64)
  const extraerBase64DeDataUrl = (dataUrl) => {
    if (!dataUrl || typeof dataUrl !== "string") return dataUrl;
    const match = dataUrl.match(/^data:image\/[a-z]+;base64,(.+)$/i);
    return match ? match[1] : dataUrl;
  };

  const createExcelProgressUI = () => {
    const STYLE_ID = "export-utils-excel-progress-style";
    const OVERLAY_ID = "export-utils-excel-progress-overlay";
    let overlay = null;
    let titleEl = null;
    let labelEl = null;
    let percentEl = null;
    let barEl = null;
    let visible = false;

    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

    const ensure = () => {
      if (overlay && titleEl && labelEl && percentEl && barEl) return;
      if (!document.getElementById(STYLE_ID)) {
        const style = document.createElement("style");
        style.id = STYLE_ID;
        style.textContent = `
          #${OVERLAY_ID} {
            position: fixed;
            inset: 0;
            background: rgba(15, 23, 42, 0.52);
            z-index: 6000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 16px;
          }
          #${OVERLAY_ID}[hidden] { display: none !important; }
          #${OVERLAY_ID} .excel-progress-card {
            width: min(520px, 100%);
            background: #ffffff;
            border: 1px solid rgba(30, 58, 138, 0.2);
            border-radius: 14px;
            box-shadow: 0 16px 46px rgba(2, 6, 23, 0.28);
            padding: 16px 18px;
          }
          #${OVERLAY_ID} .excel-progress-title {
            margin: 0;
            font-weight: 800;
            color: #1f3b6b;
          }
          #${OVERLAY_ID} .excel-progress-label {
            margin-top: 4px;
            font-size: 0.92rem;
            color: rgba(37, 99, 235, 0.88);
          }
          #${OVERLAY_ID} .excel-progress-track {
            margin-top: 12px;
            width: 100%;
            height: 10px;
            border-radius: 999px;
            background: #dbeafe;
            overflow: hidden;
          }
          #${OVERLAY_ID} .excel-progress-bar {
            width: 0%;
            height: 100%;
            background: linear-gradient(90deg, #2563eb 0%, #1d4ed8 100%);
            transition: width 160ms ease;
          }
          #${OVERLAY_ID} .excel-progress-percent {
            margin-top: 8px;
            font-size: 0.85rem;
            text-align: right;
            color: #334155;
            font-weight: 600;
          }
        `;
        document.head.appendChild(style);
      }

      overlay = document.getElementById(OVERLAY_ID);
      if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = OVERLAY_ID;
        overlay.hidden = true;
        overlay.innerHTML = `
          <div class="excel-progress-card" role="status" aria-live="polite" aria-atomic="true">
            <p class="excel-progress-title">Exportando Excel...</p>
            <div class="excel-progress-label">Preparando...</div>
            <div class="excel-progress-track"><div class="excel-progress-bar"></div></div>
            <div class="excel-progress-percent">0%</div>
          </div>
        `;
        document.body.appendChild(overlay);
      }
      titleEl = overlay.querySelector(".excel-progress-title");
      labelEl = overlay.querySelector(".excel-progress-label");
      percentEl = overlay.querySelector(".excel-progress-percent");
      barEl = overlay.querySelector(".excel-progress-bar");
    };

    const update = ({ title, label, progress }) => {
      ensure();
      if (!visible) {
        overlay.hidden = false;
        visible = true;
      }
      if (typeof title === "string" && titleEl) titleEl.textContent = title;
      if (typeof label === "string" && labelEl) labelEl.textContent = label;
      if (progress != null && Number.isFinite(Number(progress))) {
        const pct = clamp(Number(progress), 0, 100);
        if (barEl) barEl.style.width = `${pct.toFixed(1)}%`;
        if (percentEl) {
          percentEl.textContent = `${Math.round(pct)}%`;
        }
      }
    };

    const show = (options = {}) => {
      update({
        title: options.title || "Exportando Excel...",
        label: options.label || "Preparando...",
        progress: options.progress ?? 2,
      });
    };

    const hide = () => {
      if (!overlay) return;
      overlay.hidden = true;
      visible = false;
    };

    return { show, update, hide };
  };

  const excelProgressUI = createExcelProgressUI();
  const EXPORT_JOBS_STORAGE_KEY = "export_utils_pending_jobs_v1";
  const EXPORT_JOBS_ENDPOINT_STATE_KEY = "export_utils_jobs_endpoint_state_v1";
  const EXPORT_JOBS_ENDPOINT_UNAVAILABLE_TTL_MS = 45 * 1000;
  const LOCAL_EXPORT_TIMEOUT_MS = 120000;
  const EXPORT_PAGE_SESSION_ID = `page-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const ExportUtils = {
    _pendingJobsWatcherStarted: false,
    _pendingJobsTimer: null,
    _pendingJobsInProgress: new Set(),
    _downloadsUiInitialized: false,
    _downloadsPanelOpen: false,
    _jobsStatusCache: new Map(),
    _exportJobsEndpointState: null,

    _crearIdTrabajoLocal() {
      return `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    },

    _esTrabajoLocal(jobOrId) {
      const id =
        typeof jobOrId === "string"
          ? jobOrId
          : (jobOrId?.id || "").toString();
      return String(id).startsWith("local-");
    },

    _formatearDuracion(ms) {
      const total = Math.max(0, Math.floor(Number(ms) || 0));
      const sec = Math.floor(total / 1000);
      const min = Math.floor(sec / 60);
      const remSec = sec % 60;
      const hr = Math.floor(min / 60);
      const remMin = min % 60;
      if (hr > 0) return `${hr}h ${remMin}m`;
      return `${remMin}m ${String(remSec).padStart(2, "0")}s`;
    },

    _normalizarTrabajosPendientes(list = []) {
      const now = Date.now();
      const normalized = (Array.isArray(list) ? list : [])
        .map((job) => {
          const createdAt = Number(job?.createdAt) || now;
          const updatedAt = Number(job?.updatedAt) || createdAt;
          const status = String(job?.status || "queued");
          const normalizedJob = {
            ...job,
            createdAt,
            updatedAt,
            status,
          };

          if (
            this._esTrabajoLocal(normalizedJob) &&
            (status === "queued" || status === "running") &&
            normalizedJob.ownerSessionId &&
            String(normalizedJob.ownerSessionId) !== EXPORT_PAGE_SESSION_ID
          ) {
            normalizedJob.status = "failed";
            normalizedJob.progress = 100;
            normalizedJob.message = "Interrumpido (otra pantalla)";
            normalizedJob.error =
              normalizedJob.error ||
              "La exportación local pertenecía a otra vista/pestaña.";
            normalizedJob.updatedAt = now;
          } else if (
            this._esTrabajoLocal(normalizedJob) &&
            status === "failed" &&
            String(normalizedJob.ownerSessionId || "") === EXPORT_PAGE_SESSION_ID &&
            /Interrumpido \(modo local\)/i.test(
              String(normalizedJob.message || "")
            )
          ) {
            // Recupera estados marcados por la regla de timeout visual anterior.
            normalizedJob.status = "running";
            normalizedJob.progress = Math.max(
              46,
              Math.min(96, Number(normalizedJob.progress) || 46)
            );
            normalizedJob.message = "Generando (modo local)";
            normalizedJob.updatedAt = now;
          }
          return normalizedJob;
        })
        .filter((job) => String(job?.id || "").trim())
        .filter((job) => {
          // Limpiar automáticamente residuos locales interrumpidos para no confundir
          // cuando el servidor no soporta cola nativa.
          if (!this._esTrabajoLocal(job)) return true;
          const status = String(job?.status || "");
          const msg = String(job?.message || "");
          if (
            status === "failed" &&
            (/Interrumpido \(/i.test(msg) || /interrump/i.test(msg))
          ) {
            return false;
          }
          return true;
        });

      // Evitar duplicados por ID conservando el estado más reciente.
      const byId = new Map();
      normalized.forEach((job) => {
        const key = String(job?.id || "").trim();
        if (!key) return;
        const prev = byId.get(key);
        if (!prev) {
          byId.set(key, job);
          return;
        }
        const prevTs = Math.max(
          Number(prev.updatedAt) || 0,
          Number(prev.createdAt) || 0
        );
        const currTs = Math.max(
          Number(job.updatedAt) || 0,
          Number(job.createdAt) || 0
        );
        if (currTs >= prevTs) byId.set(key, job);
      });
      return Array.from(byId.values());
    },

    _getExportJobsStateStorageKey() {
      return `${EXPORT_JOBS_ENDPOINT_STATE_KEY}:${API_BASE}`;
    },

    _getExportJobsEndpointState() {
      if (this._exportJobsEndpointState) return this._exportJobsEndpointState;
      try {
        const raw = localStorage.getItem(this._getExportJobsStateStorageKey());
        if (!raw) return null;
        if (raw === "available") {
          this._exportJobsEndpointState = "available";
          return "available";
        }
        if (raw === "unavailable") {
          // Compatibilidad con formato legado sin timestamp:
          // no lo consideramos definitivo para evitar bloquear la cola para siempre.
          this._setExportJobsEndpointState(null);
          return null;
        }
        const parsed = JSON.parse(raw);
        const state = parsed?.state;
        const timestamp = Number(parsed?.timestamp) || 0;
        if (state === "available") {
          this._exportJobsEndpointState = "available";
          return "available";
        }
        if (state === "unavailable") {
          const age = Date.now() - timestamp;
          if (timestamp > 0 && age > EXPORT_JOBS_ENDPOINT_UNAVAILABLE_TTL_MS) {
            this._setExportJobsEndpointState(null);
            return null;
          }
          this._exportJobsEndpointState = "unavailable";
          return "unavailable";
        }
      } catch (_) {
        // ignore storage errors
      }
      return null;
    },

    _setExportJobsEndpointState(nextState) {
      const value =
        nextState === "available" || nextState === "unavailable"
          ? nextState
          : null;
      this._exportJobsEndpointState = value;
      try {
        const key = this._getExportJobsStateStorageKey();
        if (!value) {
          localStorage.removeItem(key);
        } else {
          localStorage.setItem(
            key,
            JSON.stringify({
              state: value,
              timestamp: Date.now(),
            })
          );
        }
      } catch (_) {
        // ignore storage errors
      }
    },

    _debugEnabled() {
      try {
        return localStorage.getItem("export_utils_debug") === "1";
      } catch (_) {
        return false;
      }
    },

    _debugLog(...args) {
      if (!this._debugEnabled()) return;
      console.log(...args);
    },

    /**
     * Exportar tabla a Excel (XLSX)
     * @param {Object} options - Opciones de exportación
     * @param {string|HTMLElement} options.tabla - Selector o elemento de la tabla
     * @param {string} options.nombreArchivo - Nombre del archivo (sin extensión)
     * @param {string} options.nombreHoja - Nombre de la hoja de Excel
     * @param {Function} options.onSuccess - Callback al exportar exitosamente
     * @param {Function} options.onError - Callback al fallar
     */
    exportarExcel(options = {}) {
      const {
        tabla,
        nombreArchivo = "Exportacion",
        nombreHoja = "Datos",
        onSuccess,
        onError,
        _skipAutoGraficas = false,
      } = options;
      let delegatedToChartsExport = false;

      try {
        excelProgressUI.show({
          title: "Exportando Excel...",
          label: "Preparando tabla...",
          progress: 4,
        });
        const tablaElement =
          typeof tabla === "string"
            ? document.querySelector(tabla)
            : tabla || document.querySelector("table");

        if (!tablaElement) {
          throw new Error("No se encontró la tabla para exportar");
        }

        if (typeof XLSX === "undefined") {
          throw new Error(
            "La librería XLSX no está disponible. Incluye xlsx-js-style para soporte de colores."
          );
        }

        if (!_skipAutoGraficas) {
          const report = this.verificarGraficasExportables({
            charts: options.charts,
            mostrar: false,
          });
          if ((report?.exportables?.length || 0) > 0) {
            excelProgressUI.update({
              label: "Generando Excel con gráficas...",
              progress: 10,
            });
            delegatedToChartsExport = true;
            this.exportarExcelConGraficas({
              tabla: tablaElement,
              nombreArchivo,
              nombreHojaTabla: nombreHoja,
              onSuccess,
              onError,
            });
            return;
          }
        }

        const metadata = this._obtenerMetadata();
        const baseName = `${nombreArchivo}_${metadata.empresaTexto || "Reporte"
          }_${metadata.mesNombre || ""}_${metadata.anio || ""}`.replace(
            /\s+/g,
            "_"
          );

        // Usar método mejorado para construir la hoja con estilos
        excelProgressUI.update({
          label: "Aplicando estilos y colores...",
          progress: 30,
        });
        const hoja = this._tableToSheetWithStyles(tablaElement);

        const libro = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(libro, hoja, nombreHoja);

        excelProgressUI.update({
          label: "Serializando archivo...",
          progress: 78,
        });
        XLSX.writeFile(libro, `${baseName}.xlsx`);
        excelProgressUI.update({
          label: "Listo",
          progress: 100,
        });

        if (onSuccess) onSuccess();
        this._showToast("Exportado a Excel correctamente");
      } catch (error) {
        console.error("Error al exportar Excel:", error);
        if (onError) onError(error);
        this._showToast("Error al exportar: " + error.message, "error");
      } finally {
        if (!delegatedToChartsExport) {
          setTimeout(() => excelProgressUI.hide(), 220);
        }
      }
    },

    /**
     * Exportar tabla + graficas (en un solo archivo)
     * @param {Object} options - Opciones de exportacion
     * @param {string|HTMLElement} options.tabla - Selector o elemento de la tabla
     * @param {string} options.nombreArchivo - Nombre del archivo (sin extension)
     * @param {string} options.nombreHojaTabla - Nombre de la hoja con la tabla
     * @param {string} options.nombreHojaOperativo - Nombre de la hoja con datos y graficas
     * @param {Function} options.onSuccess - Callback al exportar exitosamente
     * @param {Function} options.onError - Callback al fallar
     */
    async exportarExcelConGraficas(options = {}) {
      const {
        tabla,
        nombreArchivo = "Exportacion",
        nombreHojaTabla = "Tabla",
        nombreHojaOperativo = "OperativoData",
        nombreHojaGraficas = "Gráficas",
        charts,
        onSuccess,
        onError,
      } = options;
      let baseBuffer = null;
      let baseName = nombreArchivo;
      let localFallbackJobId = "";

      try {
        excelProgressUI.show({
          title: "Exportando Excel con gráficas...",
          label: "Preparando datos...",
          progress: 5,
        });
        const tablaElement =
          typeof tabla === "string"
            ? document.querySelector(tabla)
            : tabla || document.querySelector("table");

        if (!tablaElement) {
          throw new Error("No se encontro la tabla para exportar");
        }

        if (typeof XLSX === "undefined") {
          this._showToast(
            "XLSX no disponible. No es posible exportar a Excel.",
            "error"
          );
          return;
        }

        const chartReport =
          charts === false
            ? { exportables: [] }
            : this.verificarGraficasExportables({ charts, mostrar: true });
        const hasExportableCharts =
          (chartReport?.exportables?.length || 0) > 0;
        if (!hasExportableCharts) {
          this.exportarExcel({
            tabla,
            nombreArchivo,
            nombreHoja: nombreHojaTabla,
            onSuccess,
            onError,
            _skipAutoGraficas: true,
          });
          return;
        }
        excelProgressUI.update({
          label: "Leyendo tabla y gráficas...",
          progress: 15,
        });

        const metadata = this._obtenerMetadata();
        baseName = `${nombreArchivo}_${metadata.empresaTexto || "Reporte"
          }_${metadata.mesNombre || ""}_${metadata.anio || ""}`.replace(
            /\s+/g,
            "_"
          );

        const chartBlocks = this._resolverBloquesGraficas(charts);
        const chartMeta = this._resolverMetaGraficaOperativa(charts, chartBlocks);
        const chartMode =
          this._resolverModoGraficasExcel() ||
          (chartBlocks.some((block) => block?.isCombined) ? "combined" : "");
        const chartBlocksForSheet = chartMode === "combined" ? [] : chartBlocks;

        const datos = this._obtenerDatosOperativo(tablaElement);
        const chartRows = chartBlocks.reduce((maxRows, block) => {
          const len = Array.isArray(block?.labels) ? block.labels.length : 0;
          return Math.max(maxRows, len);
        }, 0);
        if (!datos.length && !chartRows) {
          this._showToast(
            "Sin datos de resultado operativo. Exportando solo tabla.",
            "warning"
          );
          this.exportarExcel({
            tabla,
            nombreArchivo,
            nombreHoja: nombreHojaTabla,
            _skipAutoGraficas: true,
          });
          return;
        }

        // Construir base con XLSX para preservar estilos
        excelProgressUI.update({
          label: "Construyendo Excel base...",
          progress: 28,
        });
        const libro = XLSX.utils.book_new();
        const sheetTabla = this._tableToSheetWithStyles(tablaElement);
        XLSX.utils.book_append_sheet(libro, sheetTabla, nombreHojaTabla);

        const sheetOperativo = this._operativoToSheet(
          tablaElement,
          metadata,
          chartMeta,
          chartBlocksForSheet
        );
        XLSX.utils.book_append_sheet(libro, sheetOperativo, nombreHojaOperativo);
        const sheetGraficas = XLSX.utils.aoa_to_sheet([["Gráficas"]]);
        XLSX.utils.book_append_sheet(libro, sheetGraficas, nombreHojaGraficas);

        baseBuffer = XLSX.write(libro, { bookType: "xlsx", type: "array" });
        excelProgressUI.update({
          label: "Enviando al generador nativo...",
          progress: 45,
        });
        const binaryBody =
          baseBuffer instanceof ArrayBuffer
            ? baseBuffer
            : baseBuffer.buffer.slice(
              baseBuffer.byteOffset,
              baseBuffer.byteOffset + baseBuffer.byteLength
            );

        const params = new URLSearchParams({
          nombreArchivo,
          empresa: metadata.empresaTexto || "",
          mes: metadata.mesNombre || "",
          anio: metadata.anio || "",
          dataSheetName: nombreHojaOperativo,
          chartsSheetName: nombreHojaGraficas,
          tableSheetName: nombreHojaTabla,
        });
        if (chartMode) {
          params.set("chartMode", chartMode);
        }
        const seriesMetaList = [];
        const seriesMetaSeen = new Set();
        chartBlocks.forEach((block) => {
          (block?.series || []).forEach((serie) => {
            const label = (serie?.label || "").toString().trim();
            if (!label) return;
            const key = label.toLowerCase();
            if (seriesMetaSeen.has(key)) return;
            seriesMetaSeen.add(key);
            seriesMetaList.push({
              label,
              color: this._normalizarColorHex(serie?.color || "", "#4472C4"),
              type: (serie?.type || "bar").toString().toLowerCase(),
            });
          });
        });
        if (seriesMetaList.length) {
          params.set(
            "seriesMeta",
            JSON.stringify(seriesMetaList)
          );
        }

        this._showToast("Encolando exportación en segundo plano...");
        try {
          const job = await this._crearTrabajoExportNativo({
            tipo: "operativo",
            params,
            binaryBody,
          });
          this._registrarTrabajoPendiente({
            id: job.id,
            tipo: "operativo",
            nombre: `${baseName}_Graficas.xlsx`,
          });
          this._iniciarVigilanciaTrabajosPendientes();
          excelProgressUI.update({
            label: "Exportación en segundo plano iniciada",
            progress: 100,
          });

          if (onSuccess) onSuccess();
          this._showToast(
            "Exportación iniciada. Puedes navegar; se descargará al terminar.",
            "success"
          );
        } catch (jobError) {
          if (jobError?.code !== "EXPORT_JOBS_UNAVAILABLE") {
            throw jobError;
          }
          localFallbackJobId = this._crearTrabajoLocalDescarga({
            nombre: `${baseName}_Graficas.xlsx`,
            tipo: "operativo",
            message: "Generando (modo local)",
          });
          this._showToast(
            "Servidor sin cola en segundo plano; usando descarga directa (no navegues hasta terminar).",
            "warning"
          );
          const response = await this._fetchWithTimeout(
            `${API_BASE}/reportes/operativo-excel-native?${params.toString()}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/octet-stream",
                ...(window.Sesion?.headersAutenticacion?.() || {}),
              },
              credentials: "include",
              body: binaryBody,
            },
            LOCAL_EXPORT_TIMEOUT_MS
          );

          if (!response.ok) {
            const text = await response.text();
            throw new Error(text || "No fue posible generar el Excel con gráficas.");
          }

          excelProgressUI.update({
            label: "Descargando archivo...",
            progress: 72,
          });
          const blob = await this._leerResponseComoBlobConProgreso(response, {
            start: 72,
            end: 96,
            onProgress: (pct, label) => {
              this._actualizarTrabajoLocalDescarga(localFallbackJobId, {
                status: "running",
                progress: Math.max(10, Math.min(99, Number(pct) || 10)),
                message: label || "Descargando (modo local)",
              });
              excelProgressUI.update({
                label: label || "Descargando archivo...",
                progress: pct,
              });
            },
          });
          const filename =
            this._obtenerNombreDescarga(response) ||
            `${baseName}_Graficas.xlsx`;
          this._descargarBlob(blob, filename);
          this._finalizarTrabajoLocalDescarga(localFallbackJobId, {
            ok: true,
            message: "Completado (modo local)",
          });
          excelProgressUI.update({
            label: "Listo",
            progress: 100,
          });

          if (onSuccess) onSuccess();
          this._showToast("Excel con tabla y graficas generado.");
        }
      } catch (error) {
        if (localFallbackJobId) {
          this._finalizarTrabajoLocalDescarga(localFallbackJobId, {
            ok: false,
            error: error?.message || "Error desconocido",
            message: "Interrumpido (modo local)",
          });
        }
        console.error("Error al exportar Excel con graficas:", error);
        if (onError) onError(error);
        this._showToast(
          "No se pudo generar el Excel con graficas. Exportando solo tabla.",
          "warning"
        );
        try {
          if (baseBuffer) {
            const blob = new Blob([baseBuffer], {
              type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            });
            this._descargarBlob(blob, `${baseName}.xlsx`);
            this._showToast("Excel exportado sin graficas.");
            return;
          }
          this.exportarExcel({
            tabla,
            nombreArchivo,
            nombreHoja: nombreHojaTabla,
            _skipAutoGraficas: true,
          });
        } catch (fallbackError) {
          console.error("Error al exportar Excel (fallback):", fallbackError);
          this._showToast(
            "Error al exportar: " + fallbackError.message,
            "error"
          );
        }
      }
      finally {
        setTimeout(() => excelProgressUI.hide(), 220);
      }
    },

    /**
     * Exportar tabla + datos operativos (para graficas en Excel)
     * @param {Object} options - Opciones de exportacion
     * @param {string|HTMLElement} options.tabla - Selector o elemento de la tabla
     * @param {string} options.nombreArchivo - Nombre del archivo (sin extension)
     * @param {string} options.nombreHojaTabla - Nombre de la hoja con la tabla
     * @param {string} options.nombreHojaOperativo - Nombre de la hoja con datos operativos
     * @param {boolean} options.incluirTabla - Si true agrega la hoja de tabla
     * @param {Function} options.onSuccess - Callback al exportar exitosamente
     * @param {Function} options.onError - Callback al fallar
     */
    async exportarExcelOperativo(options = {}) {
      const {
        tabla,
        nombreArchivo = "Exportacion",
        nombreHojaTabla = "Tabla",
        nombreHojaOperativo = "OperativoData",
        incluirTabla = true,
        onSuccess,
        onError,
      } = options;

      try {
        const tablaElement =
          typeof tabla === "string"
            ? document.querySelector(tabla)
            : tabla || document.querySelector("table");

        if (!tablaElement) {
          throw new Error("No se encontro la tabla para exportar");
        }

        const metadata = this._obtenerMetadata();
        const baseName = `${nombreArchivo}_${metadata.empresaTexto || "Reporte"
          }_${metadata.mesNombre || ""}_${metadata.anio || ""}`.replace(
            /\s+/g,
            "_"
          );

        const datosOperativo = this._obtenerDatosOperativo(tablaElement);
        if (!datosOperativo.length) {
          this._showToast(
            "Sin datos de resultado operativo para exportar.",
            "warning"
          );
          return;
        }

        const label = this._obtenerEtiquetaOperativo();
        const payload = {
          label,
          empresa: metadata.empresaTexto || "",
          anio: metadata.anio || "",
          mes: metadata.mesNombre || "",
          nombreArchivo,
          filas: datosOperativo,
        };

        this._showToast("Generando Excel con graficas...");
        const response = await fetch(`${API_BASE}/reportes/operativo-excel`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(window.Sesion?.headersAutenticacion?.() || {}),
          },
          credentials: "include",
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || "No fue posible generar el Excel con graficas.");
        }

        const blob = await response.blob();
        const filename =
          this._obtenerNombreDescarga(response) ||
          `${baseName}_Operativo_Graficas.xlsx`;
        this._descargarBlob(blob, filename);

        if (onSuccess) onSuccess();
        this._showToast("Excel con graficas generado.");
      } catch (error) {
        console.error("Error al exportar Excel operativo:", error);
        if (onError) onError(error);
        const detalle = (error?.message || "").toString().trim();
        const textoDetalle =
          detalle.length > 140 ? `${detalle.slice(0, 140)}...` : detalle;
        this._showToast(
          `No se pudo generar grafica nativa${textoDetalle ? ": " + textoDetalle : ""}.`,
          "warning"
        );
        this._exportarExcelOperativoLocal({
          tabla,
          nombreArchivo,
          nombreHojaTabla,
          nombreHojaOperativo,
          incluirTabla,
        });
      }
    },

    async _exportarExcelOperativoImagenes(options = {}) {
      if (typeof ExcelJS === "undefined") {
        return false;
      }

      const {
        tabla,
        nombreArchivo = "Exportacion",
        nombreHojaTabla = "Tabla",
        nombreHojaOperativo = "OperativoData",
        nombreHojaGraficas = "Graficas",
        chartTargets = null,
        incluirTabla = true,
      } = options;
      const tablaElement =
        typeof tabla === "string"
          ? document.querySelector(tabla)
          : tabla || document.querySelector("table");
      if (!tablaElement) return false;

      const metadata = this._obtenerMetadata();
      const baseName = `${nombreArchivo}_${metadata.empresaTexto || "Reporte"
        }_${metadata.mesNombre || ""}_${metadata.anio || ""}`.replace(/\s+/g, "_");

      const datos = this._obtenerDatosOperativo(tablaElement);
      const labels = datos.map((item) => item.etiqueta);
      const presupuestos = datos.map((item) => item.presupuesto);
      const reales = datos.map((item) => item.real);

      const workbook = new ExcelJS.Workbook();
      if (incluirTabla) {
        const wsTabla = workbook.addWorksheet(nombreHojaTabla || "Tabla");
        const tableRows = Array.from(tablaElement.querySelectorAll("tr") || []).map(
          (row) =>
            Array.from(row.cells || []).map((cell) =>
              (cell?.textContent || "").replace(/\s+/g, " ").trim()
            )
        );
        tableRows.forEach((row) => {
          wsTabla.addRow(row);
        });
        if (tableRows.length) {
          const maxCols = Math.max(...tableRows.map((row) => row.length), 0);
          if (maxCols > 0) {
            wsTabla.columns = Array.from({ length: maxCols }, (_, colIdx) => {
              const maxLen = tableRows.reduce((acc, row) => {
                const len = String(row[colIdx] || "").length;
                return Math.max(acc, len);
              }, 10);
              return { width: Math.min(Math.max(maxLen + 2, 12), 45) };
            });
          }
        }
      }
      const ws = workbook.addWorksheet(nombreHojaOperativo);
      const wsGraficas = workbook.addWorksheet(nombreHojaGraficas || "Graficas");

      const etiqueta = this._capitalizar(this._obtenerEtiquetaOperativo() || "Elemento");
      const periodo = [metadata.mesNombre, metadata.anio].filter(Boolean).join(" ").trim();

      ws.addRow(["RESULTADOS OPERATIVOS"]);
      ws.addRow(["Categoria", etiqueta]);
      ws.addRow(["Empresa", metadata.empresaTexto || ""]);
      ws.addRow(["Periodo", periodo]);
      ws.addRow(["Fecha exportacion", new Date().toISOString().slice(0, 10)]);
      ws.addRow([]);
      if (datos.length) {
        ws.addRow([etiqueta, "Ppto Acumulado", "Real Acumulado"]);
        datos.forEach((row) => {
          ws.addRow([row.etiqueta, row.presupuesto, row.real]);
        });
      } else {
        ws.addRow([
          "Sin datos operativos estructurados; se exportan las graficas capturadas.",
        ]);
      }

      ws.columns = [{ width: 42 }, { width: 18 }, { width: 18 }];
      wsGraficas.columns = [{ width: 4 }, { width: 48 }, { width: 48 }, { width: 8 }];
      wsGraficas.addRow(["GRAFICAS OPERATIVAS"]);
      wsGraficas.mergeCells("A1:C1");
      wsGraficas.getCell("A1").font = { bold: true, size: 14 };
      wsGraficas.getCell("A1").alignment = { horizontal: "left" };
      wsGraficas.addRow([`Empresa: ${metadata.empresaTexto || ""}`]);
      wsGraficas.mergeCells("A2:C2");
      wsGraficas.addRow([`Periodo: ${periodo || ""}`]);
      wsGraficas.mergeCells("A3:C3");
      wsGraficas.addRow([]);

      const resolvedTargets =
        Array.isArray(chartTargets) && chartTargets.length
          ? chartTargets
          : this._resolverGraficas();
      const chartImages = await this._capturarGraficas(resolvedTargets);
      let chartStart = wsGraficas.rowCount + 1;
      let insertedCharts = 0;

      const insertarGraficaExcel = (img, titleFallback = "Grafica") => {
        if (!img?.dataUrl || !this._esDataUrlImagenValida(img.dataUrl)) {
          return false;
        }
        const ratioRaw =
          img.width && img.height && Number(img.width) > 0
            ? Number(img.height) / Number(img.width)
            : 0.55;
        const ratio = Math.max(0.35, Math.min(1.4, ratioRaw || 0.55));
        const width = 1120;
        const height = Math.max(380, Math.min(780, Math.round(width * ratio)));
        const imgId = this._agregarImagenExcel(workbook, img.dataUrl);
        if (!imgId) return false;

        const title = (img.title || titleFallback || "Grafica").toString().trim();
        const titleRow = Math.max(1, Math.floor(chartStart) + 1);
        wsGraficas.getCell(`A${titleRow}`).value = title;
        wsGraficas.mergeCells(`A${titleRow}:C${titleRow}`);
        wsGraficas.getRow(titleRow).font = { bold: true, size: 11 };
        wsGraficas.getRow(titleRow).height = 20;
        const imageTop = titleRow + 0.2;

        wsGraficas.addImage(imgId, {
          tl: { col: 0.2, row: imageTop },
          ext: { width, height },
        });
        chartStart = imageTop + Math.ceil(height / 20) + 3;
        insertedCharts += 1;
        return true;
      };

      if (chartImages.length) {
        chartImages.forEach((img) => {
          insertarGraficaExcel(img);
        });
      }

      if (!insertedCharts && datos.length) {
        const colorBudget = "#4472c4";
        const colorReal = "#ffc000";
        const imagenBudget = this._crearImagenGrafica({
          labels,
          data: presupuestos,
          color: colorBudget,
          titulo: "Ppto Acumulado",
        });
        const imagenReal = this._crearImagenGrafica({
          labels,
          data: reales,
          color: colorReal,
          titulo: "Real Acumulado",
        });
        if (imagenBudget && this._esDataUrlImagenValida(imagenBudget)) {
          insertarGraficaExcel(
            { dataUrl: imagenBudget, title: "Ppto Acumulado", width: 1400, height: 620 },
            "Ppto Acumulado"
          );
        }
        if (imagenReal && this._esDataUrlImagenValida(imagenReal)) {
          insertarGraficaExcel(
            { dataUrl: imagenReal, title: "Real Acumulado", width: 1400, height: 620 },
            "Real Acumulado"
          );
        }
      }

      if (!insertedCharts) {
        return false;
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      this._descargarBlob(blob, `${baseName}_Operativo_Graficas.xlsx`);
      this._showToast("Excel con graficas generado (imagen).");
      return true;
    },

    _construirGraficasFallbackOperativo(tablaElement) {
      const datos = this._obtenerDatosOperativo(tablaElement);
      this._debugLog("📊 _construirGraficasFallbackOperativo: datos obtenidos:", datos.length);
      if (!datos.length) {
        this._debugLog("📊 _construirGraficasFallbackOperativo: No hay datos para construir gráficas");
        return [];
      }
      const hasUsefulData = datos.some((item) => {
        const presupuesto = this._toNumberSafe(item?.presupuesto);
        const real = this._toNumberSafe(item?.real);
        const anual = this._toNumberSafe(item?.anual);
        return (
          Math.abs(presupuesto) > 0.000001 ||
          Math.abs(real) > 0.000001 ||
          Math.abs(anual) > 0.000001
        );
      });
      if (!hasUsefulData) {
        this._debugLog("📊 _construirGraficasFallbackOperativo: Todos los valores están en cero, se omiten gráficas.");
        return [];
      }
      const labels = datos.map((item) => item.etiqueta);
      const presupuestos = datos.map((item) => item.presupuesto);
      const reales = datos.map((item) => item.real);
      this._debugLog("📊 _construirGraficasFallbackOperativo: labels:", labels);
      this._debugLog("📊 _construirGraficasFallbackOperativo: presupuestos:", presupuestos);
      this._debugLog("📊 _construirGraficasFallbackOperativo: reales:", reales);
      const height = Math.min(1200, Math.max(520, labels.length * 34 + 220));
      const images = [];

      const budgetDataUrl = this._crearImagenGrafica({
        labels,
        data: presupuestos,
        color: "#4472c4",
        titulo: "Ppto Acumulado",
      });
      this._debugLog("📊 _construirGraficasFallbackOperativo: budgetDataUrl length:", budgetDataUrl?.length || 0);
      if (budgetDataUrl && this._esDataUrlImagenValida(budgetDataUrl)) {
        images.push({
          title: "Ppto Acumulado",
          dataUrl: budgetDataUrl,
          width: 1400,
          height,
        });
      }

      const realDataUrl = this._crearImagenGrafica({
        labels,
        data: reales,
        color: "#ffc000",
        titulo: "Real Acumulado",
      });
      this._debugLog("📊 _construirGraficasFallbackOperativo: realDataUrl length:", realDataUrl?.length || 0);
      if (realDataUrl && this._esDataUrlImagenValida(realDataUrl)) {
        images.push({
          title: "Real Acumulado",
          dataUrl: realDataUrl,
          width: 1400,
          height,
        });
      }

      this._debugLog("📊 _construirGraficasFallbackOperativo: imágenes generadas:", images.length);
      return images;
    },

    _crearImagenGrafica({ labels, data, color, titulo }) {
      try {
        const canvas = document.createElement("canvas");
        const altura = Math.min(1200, Math.max(520, labels.length * 34 + 220));
        canvas.width = 1400;
        canvas.height = altura;
        const ctx = canvas.getContext("2d");
        const labelsPlugin = this._crearPluginEtiquetasGrafica();
        const chart = new Chart(ctx, {
          type: "bar",
          plugins: labelsPlugin ? [labelsPlugin] : [],
          data: {
            labels,
            datasets: [
              {
                label: titulo,
                data,
                backgroundColor: color,
                borderColor: "rgba(47, 84, 150, 0.2)",
                borderWidth: 1,
                borderRadius: 8,
                maxBarThickness: 20,
              },
            ],
          },
          options: {
            responsive: false,
            maintainAspectRatio: false,
            indexAxis: "y",
            layout: {
              padding: { top: 24, right: 220, bottom: 20, left: 28 },
            },
            plugins: { legend: { display: false } },
            scales: {
              x: {
                beginAtZero: true,
                grace: "40%",
                ticks: {
                  font: { size: 12 },
                  callback: (value) => this._formatearNumeroGrafica(value),
                },
              },
              y: {
                ticks: { font: { size: 12 } },
              },
            },
          },
        });
        chart.update();
        const dataUrl = chart.toBase64Image();
        chart.destroy();
        return dataUrl;
      } catch (error) {
        console.warn("No se pudo generar imagen de grafica:", error);
        return "";
      }
    },

    _exportarExcelOperativoLocal(options = {}) {
      const {
        tabla,
        nombreArchivo = "Exportacion",
        nombreHojaTabla = "Tabla",
        nombreHojaOperativo = "OperativoData",
        incluirTabla = true,
      } = options;

      try {
        const tablaElement =
          typeof tabla === "string"
            ? document.querySelector(tabla)
            : tabla || document.querySelector("table");

        if (!tablaElement) {
          throw new Error("No se encontro la tabla para exportar");
        }

        if (typeof XLSX === "undefined") {
          throw new Error(
            "La libreria XLSX no esta disponible. Incluye xlsx-js-style."
          );
        }

        const metadata = this._obtenerMetadata();
        const baseName = `${nombreArchivo}_${metadata.empresaTexto || "Reporte"
          }_${metadata.mesNombre || ""}_${metadata.anio || ""}`.replace(
            /\s+/g,
            "_"
          );

        const libro = XLSX.utils.book_new();
        if (incluirTabla) {
          const hojaTabla = this._tableToSheetWithStyles(tablaElement);
          XLSX.utils.book_append_sheet(libro, hojaTabla, nombreHojaTabla);
        }
        const hojaOperativo = this._operativoToSheet(tablaElement, metadata);
        XLSX.utils.book_append_sheet(libro, hojaOperativo, nombreHojaOperativo);

        XLSX.writeFile(libro, `${baseName}_Operativo.xlsx`);
        this._showToast("Datos operativos exportados.");
      } catch (error) {
        console.error("Error en export local operativo:", error);
        this._showToast("Error al exportar: " + error.message, "error");
      }
    },

    _obtenerNombreDescarga(response) {
      const header = response.headers.get("content-disposition") || "";
      const match = header.match(/filename=\"?([^\";]+)\"?/i);
      return match ? match[1] : "";
    },

    _descargarBlob(blob, filename) {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename || "Exportacion.xlsx";
      a.click();
      window.URL.revokeObjectURL(url);
    },

    _leerTrabajosPendientes() {
      try {
        const raw = localStorage.getItem(EXPORT_JOBS_STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        const normalized = this._normalizarTrabajosPendientes(
          Array.isArray(parsed) ? parsed : []
        );
        const changed =
          JSON.stringify(Array.isArray(parsed) ? parsed : []) !==
          JSON.stringify(normalized);
        if (changed) {
          this._guardarTrabajosPendientes(normalized);
        }
        return normalized;
      } catch (_) {
        return [];
      }
    },

    _guardarTrabajosPendientes(list = []) {
      try {
        localStorage.setItem(EXPORT_JOBS_STORAGE_KEY, JSON.stringify(list));
      } catch (_) {
        // ignore storage errors
      }
    },

    async _fetchWithTimeout(url, options = {}, timeoutMs = LOCAL_EXPORT_TIMEOUT_MS) {
      const timeout = Number(timeoutMs);
      if (!Number.isFinite(timeout) || timeout <= 0) {
        return fetch(url, options);
      }
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), timeout);
      try {
        return await fetch(url, {
          ...options,
          signal: controller.signal,
        });
      } catch (error) {
        if (error?.name === "AbortError") {
          throw new Error(
            `Tiempo de espera agotado (${Math.round(timeout / 1000)}s).`
          );
        }
        throw error;
      } finally {
        window.clearTimeout(timer);
      }
    },

    _registrarTrabajoPendiente(job = {}) {
      const id = (job?.id || "").toString().trim();
      if (!id) return;
      const list = this._leerTrabajosPendientes();
      if (list.some((item) => String(item?.id || "") === id)) return;
      const tipo = (job?.tipo || "operativo").toString();
      const isLocal =
        this._esTrabajoLocal(id) ||
        tipo.includes("local") ||
        String(job?.modo || "").toLowerCase() === "local";
      list.push({
        id,
        tipo,
        nombre: (job?.nombre || "").toString(),
        status: "queued",
        progress: 0,
        message: "En cola",
        createdAt: Date.now(),
        ownerSessionId: isLocal
          ? String(job?.ownerSessionId || EXPORT_PAGE_SESSION_ID)
          : "",
      });
      this._guardarTrabajosPendientes(list);
      this._renderDescargasPanel();
    },

    _crearTrabajoLocalDescarga(options = {}) {
      const {
        nombre = "Exportacion.xlsx",
        tipo = "operativo",
        message = "Generando (modo local)",
      } = options || {};
      const id = this._crearIdTrabajoLocal();
      this._registrarTrabajoPendiente({
        id,
        tipo: `${tipo}-local`,
        nombre,
        modo: "local",
        ownerSessionId: EXPORT_PAGE_SESSION_ID,
      });
      this._actualizarTrabajoPendiente(id, {
        status: "running",
        progress: 8,
        message,
      });
      return id;
    },

    _actualizarTrabajoLocalDescarga(jobId = "", patch = {}) {
      const id = String(jobId || "").trim();
      if (!id || !this._esTrabajoLocal(id)) return;
      this._actualizarTrabajoPendiente(id, patch || {});
    },

    _finalizarTrabajoLocalDescarga(jobId = "", options = {}) {
      const id = String(jobId || "").trim();
      if (!id || !this._esTrabajoLocal(id)) return;
      const ok = options?.ok !== false;
      const status = ok ? "completed" : "failed";
      const message = ok
        ? options?.message || "Completado"
        : options?.message || "Error en descarga local";
      this._actualizarTrabajoPendiente(id, {
        status,
        progress: 100,
        downloadedAt: ok ? Date.now() : undefined,
        message,
        error: ok ? "" : String(options?.error || ""),
      });
    },

    _actualizarTrabajoPendiente(jobId = "", patch = {}) {
      const id = String(jobId || "").trim();
      if (!id) return;
      const list = this._leerTrabajosPendientes();
      const idx = list.findIndex((item) => String(item?.id || "") === id);
      if (idx < 0) return;
      list[idx] = { ...list[idx], ...patch, updatedAt: Date.now() };
      this._guardarTrabajosPendientes(list);
      this._renderDescargasPanel();
    },

    _quitarTrabajoPendiente(jobId = "") {
      const id = String(jobId || "").trim();
      if (!id) return;
      const list = this._leerTrabajosPendientes().filter(
        (item) => String(item?.id || "") !== id
      );
      this._guardarTrabajosPendientes(list);
      this._jobsStatusCache.delete(id);
      this._renderDescargasPanel();
    },

    async _crearTrabajoExportNativo({ tipo = "operativo", params, binaryBody }) {
      if (this._getExportJobsEndpointState() === "unavailable") {
        const err = new Error(
          "Export jobs endpoint no disponible en este servidor."
        );
        err.code = "EXPORT_JOBS_UNAVAILABLE";
        throw err;
      }
      const query = new URLSearchParams(params || {});
      query.set("tipo", tipo);
      const response = await fetch(
        `${API_BASE}/reportes/export-jobs/native?${query.toString()}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/octet-stream",
            ...(window.Sesion?.headersAutenticacion?.() || {}),
          },
          credentials: "include",
          body: binaryBody,
        }
      );
      if (!response.ok) {
        if (response.status === 404) {
          this._setExportJobsEndpointState("unavailable");
          const err = new Error(
            "Export jobs endpoint no disponible en este servidor."
          );
          err.code = "EXPORT_JOBS_UNAVAILABLE";
          throw err;
        }
        let detail = "";
        try {
          detail = await response.text();
        } catch (_) {
          detail = "";
        }
        throw new Error(detail || "No fue posible crear el trabajo de exportación.");
      }
      const payload = await response.json();
      const job = payload?.job || null;
      if (!job?.id) {
        throw new Error("Respuesta inválida al crear trabajo de exportación.");
      }
      this._setExportJobsEndpointState("available");
      return job;
    },

    async _consultarTrabajoExport(jobId = "") {
      const id = String(jobId || "").trim();
      if (!id) return null;
      const response = await fetch(`${API_BASE}/reportes/export-jobs/${id}`, {
        method: "GET",
        headers: {
          ...(window.Sesion?.headersAutenticacion?.() || {}),
        },
        credentials: "include",
      });
      if (!response.ok) return null;
      const payload = await response.json();
      return payload?.job || null;
    },

    async _descargarTrabajoExport(jobId = "", fallbackName = "Exportacion.xlsx") {
      const id = String(jobId || "").trim();
      if (!id) return false;
      const response = await fetch(
        `${API_BASE}/reportes/export-jobs/${id}/download`,
        {
          method: "GET",
          headers: {
            ...(window.Sesion?.headersAutenticacion?.() || {}),
          },
          credentials: "include",
        }
      );
      if (!response.ok) return false;
      const blob = await response.blob();
      const filename = this._obtenerNombreDescarga(response) || fallbackName;
      this._descargarBlob(blob, filename);
      return true;
    },

    async _procesarTrabajoPendiente(job = {}) {
      const id = String(job?.id || "").trim();
      if (id.startsWith("local-")) return;
      if (!id || this._pendingJobsInProgress.has(id)) return;
      this._pendingJobsInProgress.add(id);
      try {
        const status = await this._consultarTrabajoExport(id);
        if (!status) return;
        this._jobsStatusCache.set(id, status);
        this._actualizarTrabajoPendiente(id, {
          status: status.status || "queued",
          progress: Number.isFinite(Number(status.progress))
            ? Number(status.progress)
            : 0,
          message: status.message || "",
          error: status.error || "",
          filename: status.filename || "",
        });
        if (status.status === "failed") {
          this._showToast(
            `Exportación falló: ${status.error || status.message || id}`,
            "error"
          );
          return;
        }
        if (status.status !== "completed") return;
        if (!job?.downloadedAt) {
          const downloaded = await this._descargarTrabajoExport(
            id,
            job?.nombre || "Exportacion.xlsx"
          );
          if (downloaded) {
            this._actualizarTrabajoPendiente(id, {
              downloadedAt: Date.now(),
              status: "completed",
              message: "Completado",
            });
            this._showToast("Exportación completada y descargada.");
          }
        }
      } finally {
        this._pendingJobsInProgress.delete(id);
      }
    },

    _iniciarVigilanciaTrabajosPendientes() {
      if (this._pendingJobsWatcherStarted) return;
      this._pendingJobsWatcherStarted = true;
      const run = async () => {
        const list = this._leerTrabajosPendientes();
        if (!list.length) return;
        for (const job of list.filter((item) => item?.status !== "completed")) {
          await this._procesarTrabajoPendiente(job);
          await sleep(120);
        }
        this._renderDescargasPanel();
      };
      run().catch(() => {});
      this._pendingJobsTimer = window.setInterval(() => {
        run().catch(() => {});
      }, 4000);
    },

    _ensureDescargasUI() {
      if (this._downloadsUiInitialized) return;
      this._downloadsUiInitialized = true;
      const styleId = "export-utils-downloads-style";
      if (!document.getElementById(styleId)) {
        const style = document.createElement("style");
        style.id = styleId;
        style.textContent = `
          #exportJobsFab {
            position: fixed;
            right: 16px;
            bottom: 20px;
            z-index: 5500;
            border-radius: 999px;
            box-shadow: 0 10px 28px rgba(15,23,42,.25);
          }
          #exportJobsPanel {
            position: fixed;
            right: 16px;
            bottom: 70px;
            width: min(460px, calc(100vw - 24px));
            max-height: min(68vh, 620px);
            z-index: 5500;
            display: none;
          }
          #exportJobsPanel.open { display: block; }
          #exportJobsPanel .card {
            border-radius: 12px;
            box-shadow: 0 16px 42px rgba(2,6,23,.28);
            border: 1px solid rgba(148,163,184,.38);
          }
          #exportJobsList { max-height: min(52vh, 450px); overflow: auto; }
          #exportJobsList .job-row { border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px; }
          #exportJobsList .job-meta { font-size: .78rem; color: #64748b; }
        `;
        document.head.appendChild(style);
      }

      let fab = document.getElementById("exportJobsFab");
      if (!fab) {
        fab = document.createElement("button");
        fab.id = "exportJobsFab";
        fab.type = "button";
        fab.className = "btn btn-primary btn-sm";
        fab.innerHTML = '<i class="bi bi-download"></i> Descargas';
        document.body.appendChild(fab);
      }

      let panel = document.getElementById("exportJobsPanel");
      if (!panel) {
        panel = document.createElement("div");
        panel.id = "exportJobsPanel";
        panel.innerHTML = `
          <div class="card">
            <div class="card-header d-flex justify-content-between align-items-center">
              <strong>Descargas</strong>
              <button type="button" class="btn btn-sm btn-outline-secondary" id="exportJobsClose">Cerrar</button>
            </div>
            <div class="card-body">
              <div id="exportJobsList" class="d-flex flex-column gap-2"></div>
            </div>
          </div>
        `;
        document.body.appendChild(panel);
      }

      fab.addEventListener("click", () => {
        this._downloadsPanelOpen = !this._downloadsPanelOpen;
        panel.classList.toggle("open", this._downloadsPanelOpen);
        this._renderDescargasPanel();
      });
      panel.querySelector("#exportJobsClose")?.addEventListener("click", () => {
        this._downloadsPanelOpen = false;
        panel.classList.remove("open");
      });
      panel.addEventListener("click", (event) => {
        const btn = event.target.closest("[data-job-action]");
        if (!btn) return;
        const action = btn.getAttribute("data-job-action") || "";
        const jobId = btn.getAttribute("data-job-id") || "";
        if (!jobId) return;
        const list = this._leerTrabajosPendientes();
        const job = list.find((item) => String(item?.id || "") === String(jobId));
        if (action === "remove") {
          this._quitarTrabajoPendiente(jobId);
          return;
        }
        if (action === "retry" && job) {
          if (this._esTrabajoLocal(job)) {
            this._showToast(
              "Reintenta exportando de nuevo (modo local).",
              "warning"
            );
            return;
          }
          this._procesarTrabajoPendiente(job).catch(() => {});
          return;
        }
        if (action === "download" && job) {
          if (this._esTrabajoLocal(job)) {
            this._showToast(
              "Este archivo se descarga automáticamente en modo local.",
              "warning"
            );
            return;
          }
          this._descargarTrabajoExport(jobId, job?.nombre || "Exportacion.xlsx")
            .then((ok) => {
              if (ok) {
                this._actualizarTrabajoPendiente(jobId, { downloadedAt: Date.now() });
                this._showToast("Archivo descargado.");
              } else {
                this._showToast("Aún no está listo para descargar.", "warning");
              }
            })
            .catch(() => this._showToast("No fue posible descargar el archivo.", "error"));
        }
      });
      this._reposicionarDescargasUI();
      window.addEventListener("resize", () => this._reposicionarDescargasUI());
      window.addEventListener("scroll", () => this._reposicionarDescargasUI(), {
        passive: true,
      });
    },

    _reposicionarDescargasUI() {
      const fab = document.getElementById("exportJobsFab");
      const panel = document.getElementById("exportJobsPanel");
      if (!fab || !panel) return;
      const vw = window.innerWidth || document.documentElement.clientWidth || 1366;
      const vh = window.innerHeight || document.documentElement.clientHeight || 768;
      const blockers = Array.from(
        document.querySelectorAll(
          ".tour-trigger-btn, [data-tour-trigger], #tourTriggerBtn, .comentarios-fab-container, #btnComentarios, #comentariosFloatingBtn, #comentariosToggleBtn"
        )
      )
        .filter((el) => el && el.getClientRects?.().length)
        .map((el) => el.getBoundingClientRect());

      const fabW = Math.max(110, fab.offsetWidth || 120);
      const fabH = Math.max(34, fab.offsetHeight || 36);
      const panelW = Math.min(460, Math.max(300, vw - 24));
      const panelH = Math.min(560, Math.max(220, Math.round(vh * 0.62)));
      const margin = 16;

      const candidates = [
        { fab: { right: 16, bottom: 20 }, panel: { right: 16, bottom: 70 } },
        { fab: { right: 16, bottom: 96 }, panel: { right: 16, bottom: 146 } },
        { fab: { left: 16, bottom: 20 }, panel: { left: 16, bottom: 70 } },
        { fab: { left: 16, bottom: 96 }, panel: { left: 16, bottom: 146 } },
        { fab: { right: 16, top: 84 }, panel: { right: 16, top: 134 } },
      ];

      const toRect = (anchor, w, h) => {
        const left =
          anchor.left != null
            ? anchor.left
            : anchor.right != null
              ? vw - anchor.right - w
              : margin;
        const top =
          anchor.top != null
            ? anchor.top
            : anchor.bottom != null
              ? vh - anchor.bottom - h
              : margin;
        return { left, top, right: left + w, bottom: top + h, width: w, height: h };
      };

      const intersects = (a, b) =>
        a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

      const scoreCandidate = (candidate) => {
        const fabRect = toRect(candidate.fab, fabW, fabH);
        const panelRect = toRect(candidate.panel, panelW, panelH);
        let score = 0;
        blockers.forEach((b) => {
          if (intersects(fabRect, b)) score += 10;
          if (intersects(panelRect, b)) score += 4;
        });
        if (fabRect.left < 0 || fabRect.top < 0 || fabRect.right > vw || fabRect.bottom > vh) score += 20;
        return score;
      };

      let best = candidates[0];
      let bestScore = scoreCandidate(best);
      for (let i = 1; i < candidates.length; i += 1) {
        const sc = scoreCandidate(candidates[i]);
        if (sc < bestScore) {
          best = candidates[i];
          bestScore = sc;
        }
      }

      const applyAnchor = (el, anchor) => {
        el.style.left = anchor.left != null ? `${anchor.left}px` : "";
        el.style.right = anchor.right != null ? `${anchor.right}px` : "";
        el.style.top = anchor.top != null ? `${anchor.top}px` : "";
        el.style.bottom = anchor.bottom != null ? `${anchor.bottom}px` : "";
      };
      applyAnchor(fab, best.fab);
      applyAnchor(panel, best.panel);
    },

    _renderDescargasPanel() {
      this._ensureDescargasUI();
      this._reposicionarDescargasUI();
      const panel = document.getElementById("exportJobsPanel");
      const listEl = document.getElementById("exportJobsList");
      const fab = document.getElementById("exportJobsFab");
      if (!listEl || !fab || !panel) return;

      const jobs = this._leerTrabajosPendientes()
        .slice()
        .sort((a, b) => Number(b?.createdAt || 0) - Number(a?.createdAt || 0));
      const activeCount = jobs.filter(
        (j) => j?.status === "queued" || j?.status === "running"
      ).length;
      fab.innerHTML = `<i class="bi bi-download"></i> Descargas${activeCount ? ` (${activeCount})` : ""}`;
      if (!jobs.length) {
        listEl.innerHTML =
          '<div class="text-muted small">No hay exportaciones en cola.</div>';
        return;
      }

      const badgeFor = (status = "") => {
        if (status === "completed") return '<span class="badge text-bg-success">Listo</span>';
        if (status === "failed") return '<span class="badge text-bg-danger">Error</span>';
        if (status === "running") return '<span class="badge text-bg-primary">Procesando</span>';
        return '<span class="badge text-bg-secondary">En cola</span>';
      };

      listEl.innerHTML = jobs
        .map((job) => {
          const id = String(job?.id || "");
          const name = String(job?.nombre || "Exportacion.xlsx");
          const status = String(job?.status || "queued");
          const msg = String(job?.message || "");
          const isLocal = this._esTrabajoLocal(job);
          const progress = Number.isFinite(Number(job?.progress))
            ? Math.max(0, Math.min(100, Number(job.progress)))
            : 0;
          const now = Date.now();
          const startedAt = Number(job?.createdAt) || now;
          const finishedAt =
            Number(job?.downloadedAt) || Number(job?.updatedAt) || now;
          const durationMs =
            status === "completed" || status === "failed"
              ? Math.max(0, finishedAt - startedAt)
              : Math.max(0, now - startedAt);
          const durationText = this._formatearDuracion(durationMs);
          const progressBar =
            status === "completed" || status === "failed"
              ? ""
              : `<div class="progress mt-2" style="height:8px;"><div class="progress-bar" role="progressbar" style="width:${progress}%"></div></div>`;
          const actions =
            status === "completed"
              ? `${isLocal ? "" : `<button class="btn btn-sm btn-outline-primary" data-job-action="download" data-job-id="${id}">Descargar</button>`}
                 <button class="btn btn-sm btn-outline-secondary" data-job-action="remove" data-job-id="${id}">Quitar</button>`
              : status === "failed"
                ? `${isLocal ? "" : `<button class="btn btn-sm btn-outline-warning" data-job-action="retry" data-job-id="${id}">Reintentar</button>`}
                   <button class="btn btn-sm btn-outline-secondary" data-job-action="remove" data-job-id="${id}">Quitar</button>`
                : `<button class="btn btn-sm btn-outline-secondary" data-job-action="remove" data-job-id="${id}">Quitar</button>`;
          return `
            <div class="job-row">
              <div class="d-flex justify-content-between align-items-start gap-2">
                <div>
                  <div class="fw-semibold">${name}</div>
                  <div class="job-meta">${msg || status}${isLocal ? " · local" : ""} · ${durationText}</div>
                </div>
                ${badgeFor(status)}
              </div>
              ${progressBar}
              <div class="d-flex gap-2 mt-2">${actions}</div>
            </div>
          `;
        })
        .join("");
    },

    _initBackgroundExports() {
      this._ensureDescargasUI();
      this._renderDescargasPanel();
      this._iniciarVigilanciaTrabajosPendientes();
    },

    /**
     * Construye una hoja de Excel desde la tabla DOM
     * Primero simplifica la estructura, luego aplica estilos
     * @param {HTMLElement} tabla - Elemento tabla
     */
    _tableToSheetWithStyles(tabla) {
      // PASO 1: Clonar la tabla y normalizar spans para conservar todas las columnas
      const tablaClone = tabla.cloneNode(true);
      const cleanupStyleHost = this._montarTablaTemporalParaEstilos(tabla, tablaClone);

      // PASO 1.5: Eliminar filas/celdas del clon que estén ocultas en la tabla real
      // (aplica cuando hay modo sin-cuentas, columnas ocultas por JS, etc.)
      this._eliminarElementosOcultos(tabla, tablaClone);

      const { matriz, aoa, merges } = this._extraerTablaComoMatriz(tablaClone);

      // PASO 2: Construir la hoja desde la matriz (sin perder encabezados)
      const sheet = XLSX.utils.aoa_to_sheet(aoa);

      // PASO 2.5: Aplicar merges (rowspan/colspan)
      if (merges && merges.length > 0) {
        sheet["!merges"] = merges;
      }

      // PASO 2: Definir estilos
      const borderStyle = {
        top: { style: "thin", color: { rgb: "CCCCCC" } },
        bottom: { style: "thin", color: { rgb: "CCCCCC" } },
        left: { style: "thin", color: { rgb: "CCCCCC" } },
        right: { style: "thin", color: { rgb: "CCCCCC" } },
      };

      const classStyleMap = {
        "section-header-row": {
          fill: { patternType: "solid", fgColor: { rgb: "1E3A8A" } },
          font: { bold: true, color: { rgb: "FFFFFF" } },
          border: borderStyle,
        },
        "subsection-row": {
          fill: { patternType: "solid", fgColor: { rgb: "DBEAFE" } },
          font: { bold: true, color: { rgb: "1E3A8A" }, italic: true },
          border: borderStyle,
        },
        "account-row": {
          fill: { patternType: "solid", fgColor: { rgb: "FFFFFF" } },
          border: borderStyle,
        },
        "sum-row": {
          fill: { patternType: "solid", fgColor: { rgb: "FEF3C7" } },
          font: { bold: true, color: { rgb: "78350F" } },
          border: borderStyle,
        },
        "sum-row-principal": {
          fill: { patternType: "solid", fgColor: { rgb: "DDD6FE" } },
          font: { bold: true, color: { rgb: "5B21B6" } },
          border: borderStyle,
        },
        "highlight-primary": {
          fill: { patternType: "solid", fgColor: { rgb: "A7F3D0" } },
          font: { bold: true, color: { rgb: "065F46" } },
          border: borderStyle,
        },
        "highlight-secondary": {
          fill: { patternType: "solid", fgColor: { rgb: "A5F3FC" } },
          font: { bold: true, color: { rgb: "0E7490" } },
          border: borderStyle,
        },
        "highlight-bright": {
          fill: { patternType: "solid", fgColor: { rgb: "FECACA" } },
          font: { bold: true, color: { rgb: "991B1B" } },
          border: {
            top: { style: "medium", color: { rgb: "DC2626" } },
            bottom: { style: "medium", color: { rgb: "DC2626" } },
            left: { style: "thin", color: { rgb: "CCCCCC" } },
            right: { style: "thin", color: { rgb: "CCCCCC" } },
          },
        },
        "result-row": {
          fill: { patternType: "solid", fgColor: { rgb: "C0C0C0" } },
          font: { bold: true, color: { rgb: "000000" } },
          border: borderStyle,
        },
        "sum-row-sumavarios": {
          fill: { patternType: "solid", fgColor: { rgb: "E2EFDA" } },
          font: { bold: true, color: { rgb: "375623" } },
          border: borderStyle,
        },
        "category-cell": {
          fill: { patternType: "solid", fgColor: { rgb: "E5E7EB" } },
          font: { bold: true },
          border: borderStyle,
        },
      };

      const defaultHeaderStyle = {
        fill: { patternType: "solid", fgColor: { rgb: "CBD5E1" } },
        font: { bold: true, color: { rgb: "0F172A" } },
        alignment: { horizontal: "center", vertical: "center", wrapText: true },
        border: {
          top: { style: "medium", color: { rgb: "64748B" } },
          bottom: { style: "medium", color: { rgb: "64748B" } },
          left: { style: "thin", color: { rgb: "94A3B8" } },
          right: { style: "thin", color: { rgb: "94A3B8" } },
        },
      };

      // PASO 3: Obtener las filas DOM para mapear estilos (del clon limpio sin ocultos)
      const rows = Array.from(tablaClone.querySelectorAll("tr"));

      // Crear mapa de fila DOM -> índice Excel (considerando thead/tbody)
      const rowStyleInfo = rows.map((tr, idx) => {
        const classes = Array.from(tr.classList);
        const isHeader = tr.parentElement?.tagName === "THEAD";
        return { classes, isHeader, domRow: tr };
      });

      // PASO 4: Aplicar estilos a cada celda existente en la hoja
      const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");

      for (let r = range.s.r; r <= range.e.r; r++) {
        for (let c = range.s.c; c <= range.e.c; c++) {
          const addr = XLSX.utils.encode_cell({ r, c });
          let cell = sheet[addr];

          if (!cell) {
            // Celda vacía o parte de merge - crear celda vacía con estilo
            cell = { v: "", t: "s" };
            sheet[addr] = cell;
          }

          // Estilo base
          let finalStyle = { border: borderStyle, font: { sz: 10 } };

          const metaCell = matriz[r]?.[c] || {};
          const rowInfo = rowStyleInfo[r];

          if (rowInfo?.isHeader || metaCell.isHeader) {
            finalStyle = { ...finalStyle, ...defaultHeaderStyle };
          }

          const clasesCelda = [
            ...(rowInfo?.classes || []),
            ...(metaCell.classes || []),
          ];

          clasesCelda.forEach((cls) => {
            if (classStyleMap[cls]) {
              finalStyle = { ...finalStyle, ...classStyleMap[cls] };
            }
          });

          // Alineación según clase o tipo de dato
          const domCell = metaCell.domCell;
          const esTextoIzquierda = clasesCelda.some((cls) =>
            ["text-start", "account-column", "account-column-header"].includes(cls)
          );
          const horizontal = esTextoIzquierda
            ? "left"
            : cell.t === "n"
              ? "right"
              : "center";
          finalStyle.alignment = {
            ...(finalStyle.alignment || {}),
            horizontal,
            vertical: "center",
            wrapText: metaCell.isHeader || (domCell?.textContent || "").length > 18,
          };

          const rawText = (domCell?.textContent || "").trim();
          if (cell.t === "n" && rawText.includes("%")) {
            finalStyle.numFmt = "0.00%";
            cell.z = "0.00%";
          }

          // Intentar respetar color de fondo y color de texto reales (computed style)
          const computedStyle = domCell ? window.getComputedStyle(domCell) : null;
          if (computedStyle) {
            const bgHex = this._cssColorToHex(computedStyle.backgroundColor);
            if (bgHex) {
              finalStyle.fill = {
                patternType: "solid",
                fgColor: { rgb: bgHex },
              };
            }
            const fontHex = this._cssColorToHex(computedStyle.color);
            if (fontHex) {
              finalStyle.font = {
                ...(finalStyle.font || {}),
                color: { rgb: fontHex },
              };
            }
            const weight = parseInt(computedStyle.fontWeight, 10);
            if (Number.isFinite(weight) && weight >= 600) {
              finalStyle.font = {
                ...(finalStyle.font || {}),
                bold: true,
              };
            }
            if (computedStyle.fontStyle === "italic") {
              finalStyle.font = {
                ...(finalStyle.font || {}),
                italic: true,
              };
            }
            const computedAlign = (computedStyle.textAlign || "").toLowerCase();
            if (computedAlign === "left" || computedAlign === "right" || computedAlign === "center") {
              finalStyle.alignment = {
                ...(finalStyle.alignment || {}),
                horizontal: computedAlign,
              };
            }
          }

          cell.s = finalStyle;
        }
      }

      // PASO 5: Ajustar anchos de columna
      const colWidths = [];
      for (let c = range.s.c; c <= range.e.c; c++) {
        let maxWidth = 0;
        for (let r = range.s.r; r <= range.e.r; r++) {
          const metaCell = matriz[r]?.[c];
          const texto = metaCell?.value ?? sheet[XLSX.utils.encode_cell({ r, c })]?.v;
          if (texto === undefined || texto === null) continue;

          const anchoEstimado = this._estimarAnchoColumna(String(texto));
          if (anchoEstimado > maxWidth) maxWidth = anchoEstimado;
        }

        const esCuenta = matriz[0]?.[c]?.classes?.includes("account-column-header");
        const esDescripcion = matriz[0]?.[c]?.classes?.includes("col-descripcion");
        const minWidth = esDescripcion ? 20 : esCuenta ? 14 : 10;
        const maxPermitido = esDescripcion ? 42 : 32;
        const ajuste = Math.min(maxPermitido, Math.max(minWidth, maxWidth + 2));

        colWidths.push({ wch: ajuste });
      }
      sheet["!cols"] = colWidths;
      cleanupStyleHost();

      return sheet;
    },

    _montarTablaTemporalParaEstilos(tablaOriginal, tablaClone) {
      if (typeof document === "undefined" || !tablaClone) return () => { };
      const host = document.createElement("div");
      const rect = tablaOriginal?.getBoundingClientRect?.();
      host.style.position = "absolute";
      host.style.left = "-100000px";
      host.style.top = "0";
      host.style.visibility = "hidden";
      host.style.pointerEvents = "none";
      host.style.overflow = "hidden";
      host.style.zIndex = "-1";
      if (rect?.width) {
        host.style.width = `${Math.max(320, Math.round(rect.width))}px`;
      }
      host.appendChild(tablaClone);
      document.body.appendChild(host);
      return () => {
        try {
          host.remove();
        } catch (_) {
          /* ignore */
        }
      };
    },

    _cssColorToHex(value = "") {
      const text = (value || "").toString().trim().toLowerCase();
      if (!text || text === "transparent") return "";
      const rgbMatch = text.match(
        /^rgba?\(\s*([0-9]{1,3})\s*[,\s]\s*([0-9]{1,3})\s*[,\s]\s*([0-9]{1,3})(?:\s*[,/]\s*([0-9.]+))?\s*\)$/
      );
      if (rgbMatch) {
        const alpha = rgbMatch[4] == null ? 1 : Number(rgbMatch[4]);
        if (!Number.isFinite(alpha) || alpha <= 0) return "";
        const toHex = (num) => {
          const n = Math.max(0, Math.min(255, Number(num) || 0));
          return n.toString(16).padStart(2, "0").toUpperCase();
        };
        return `${toHex(rgbMatch[1])}${toHex(rgbMatch[2])}${toHex(rgbMatch[3])}`;
      }
      const hexMatch = text.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
      if (hexMatch) {
        const raw = hexMatch[1];
        if (raw.length === 3) {
          return raw
            .split("")
            .map((c) => `${c}${c}`)
            .join("")
            .toUpperCase();
        }
        return raw.toUpperCase();
      }
      return "";
    },

    async _leerResponseComoBlobConProgreso(response, options = {}) {
      const { onProgress, start = 0, end = 100 } = options;
      const total = Number(response.headers.get("Content-Length")) || 0;
      if (!response.body || !response.body.getReader) {
        const blob = await response.blob();
        if (typeof onProgress === "function") {
          onProgress(end, "Descarga completada");
        }
        return blob;
      }

      const reader = response.body.getReader();
      const chunks = [];
      let loaded = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          loaded += value.byteLength;
        }
        if (typeof onProgress === "function") {
          let pct = start;
          if (total > 0) {
            pct = start + ((loaded / total) * (end - start));
          } else {
            pct = Math.min(end, start + 1);
          }
          const mb = (bytes) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
          const label =
            total > 0
              ? `Descargando archivo... ${mb(loaded)} / ${mb(total)}`
              : `Descargando archivo... ${mb(loaded)}`;
          onProgress(pct, label);
        }
      }
      if (typeof onProgress === "function") {
        onProgress(end, "Descarga completada");
      }
      return new Blob(chunks, {
        type:
          response.headers.get("Content-Type") ||
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
    },

    _xlsxSheetToExcelJSWorksheet(sheet, workbook, nombreHoja) {
      const ws = workbook.addWorksheet(nombreHoja);
      if (!sheet || !sheet["!ref"]) return ws;

      const toArgb = (rgb) => {
        if (!rgb) return "";
        const limpio = rgb.replace(/[^0-9A-Fa-f]/g, "").toUpperCase();
        if (limpio.length === 8) return limpio;
        if (limpio.length === 6) return `FF${limpio}`;
        return "";
      };

      const mapColor = (color) => {
        const argb = toArgb(color?.rgb);
        return argb ? { argb } : undefined;
      };

      const mapBorder = (border) => {
        if (!border) return undefined;
        const sides = ["top", "bottom", "left", "right"];
        const result = {};
        sides.forEach((side) => {
          if (!border[side]) return;
          const color = mapColor(border[side].color);
          result[side] = {
            style: border[side].style || "thin",
            ...(color ? { color } : {}),
          };
        });
        return Object.keys(result).length ? result : undefined;
      };

      const mapFill = (fill) => {
        if (!fill) return undefined;
        const fgColor = mapColor(fill.fgColor);
        const bgColor = mapColor(fill.bgColor);
        if (!fgColor && !bgColor) return undefined;
        return {
          type: "pattern",
          pattern: fill.patternType || "solid",
          ...(fgColor ? { fgColor } : {}),
          ...(bgColor ? { bgColor } : {}),
        };
      };

      const mapFont = (font) => {
        if (!font) return undefined;
        const color = mapColor(font.color);
        const result = {
          ...(font.bold ? { bold: true } : {}),
          ...(font.italic ? { italic: true } : {}),
          ...(font.sz ? { size: font.sz } : {}),
          ...(color ? { color } : {}),
        };
        return Object.keys(result).length ? result : undefined;
      };

      const mapAlignment = (alignment) => {
        if (!alignment) return undefined;
        const result = {
          ...(alignment.horizontal ? { horizontal: alignment.horizontal } : {}),
          ...(alignment.vertical ? { vertical: alignment.vertical } : {}),
          ...(alignment.wrapText ? { wrapText: true } : {}),
        };
        return Object.keys(result).length ? result : undefined;
      };

      Object.keys(sheet).forEach((addr) => {
        if (addr.startsWith("!")) return;
        const cell = sheet[addr];
        const { r, c } = XLSX.utils.decode_cell(addr);
        const excelCell = ws.getCell(r + 1, c + 1);
        excelCell.value = cell?.v ?? "";

        if (cell?.s) {
          const font = mapFont(cell.s.font);
          const fill = mapFill(cell.s.fill);
          const border = mapBorder(cell.s.border);
          const alignment = mapAlignment(cell.s.alignment);
          const style = {
            ...(font ? { font } : {}),
            ...(fill ? { fill } : {}),
            ...(border ? { border } : {}),
            ...(alignment ? { alignment } : {}),
          };
          if (Object.keys(style).length) {
            excelCell.style = style;
          }
        }
      });

      if (Array.isArray(sheet["!merges"])) {
        sheet["!merges"].forEach((merge) => {
          ws.mergeCells(
            merge.s.r + 1,
            merge.s.c + 1,
            merge.e.r + 1,
            merge.e.c + 1
          );
        });
      }

      if (Array.isArray(sheet["!cols"])) {
        sheet["!cols"].forEach((col, idx) => {
          if (!col) return;
          if (col.wch) ws.getColumn(idx + 1).width = col.wch;
        });
      }

      return ws;
    },

    _ajustarAnchosWorksheetExcelJS(worksheet, options = {}) {
      if (!worksheet) return;
      const { min = 8, max = 60, padding = 2 } = options;

      const columnCount = worksheet.columnCount || 0;
      for (let colNumber = 1; colNumber <= columnCount; colNumber += 1) {
        const column = worksheet.getColumn(colNumber);
        let maxLen = min;
        column.eachCell({ includeEmpty: true }, (cell) => {
          let value = cell.value;
          if (value == null) return;
          if (typeof value === "object") {
            if (value.text) value = value.text;
            else if (Array.isArray(value.richText)) {
              value = value.richText.map((part) => part.text).join("");
            } else if (value.result != null) value = value.result;
          }
          const text = String(value);
          if (text.length > maxLen) maxLen = text.length;
        });
        column.width = Math.min(max, Math.max(min, maxLen + padding));
      }
    },

    _operativoToSheet(tabla, metadata = {}, chartMeta = null, chartBlocks = []) {
      const labelRaw = this._obtenerEtiquetaOperativo();
      const label = this._capitalizar(labelRaw || "Elemento");
      const datos = this._obtenerDatosOperativo(tabla);
      const fecha = new Date();
      const fechaTexto = fecha.toISOString().slice(0, 10);
      const periodo = [metadata.mesNombre, metadata.anio]
        .filter(Boolean)
        .join(" ")
        .trim();

      const chartSeries = Array.isArray(chartMeta?.series)
        ? chartMeta.series.filter((serie) => Array.isArray(serie?.data))
        : [];
      const chartLabels = Array.isArray(chartMeta?.labels) ? chartMeta.labels : [];
      const validChartBlocks = Array.isArray(chartBlocks)
        ? chartBlocks.filter(
          (block) =>
            Array.isArray(block?.labels) &&
            block.labels.length > 0 &&
            Array.isArray(block?.series) &&
            block.series.length > 0
        )
        : [];
      let header = [label || "Elemento", "Ppto Acumulado", "Real Acumulado"];
      let filas = datos.map((item) => [item.etiqueta, item.presupuesto, item.real]);

      if (chartSeries.length && chartLabels.length) {
        header = [
          label || "Elemento",
          ...chartSeries.map((serie, idx) => {
            const txt = (serie?.label || `Serie ${idx + 1}`).toString().trim();
            return txt || `Serie ${idx + 1}`;
          }),
        ];
        filas = chartLabels.map((rawLabel, rowIdx) => {
          const etiqueta = this._limpiarEtiquetaOperativo(
            (rawLabel || "").toString().trim()
          );
          const row = [etiqueta];
          chartSeries.forEach((serie) => {
            const valor = Array.isArray(serie.data) ? serie.data[rowIdx] : 0;
            row.push(this._toNumberSafe(valor));
          });
          return row;
        });
      } else {
        const annualLabel = metadata?.anio
          ? `Presupuesto ${metadata.anio}`
          : "Presupuesto";
        const includeAnnual = datos.some((item) => item?.anual != null);
        if (includeAnnual) {
          header = [label || "Elemento", "Ppto Acumulado", "Real Acumulado", annualLabel];
          filas = datos.map((item) => [
            item.etiqueta,
            item.presupuesto,
            item.real,
            this._toNumberSafe(item.anual != null ? item.anual : item.presupuesto),
          ]);
        }
      }

      const aoa = [
        ["RESULTADOS OPERATIVOS"],
        ["Categoria", label || "Elemento"],
        ["Empresa", metadata.empresaTexto || ""],
        ["Periodo", periodo],
        ["Fecha exportacion", fechaTexto],
        [],
        header,
        ...filas,
      ];

      if (validChartBlocks.length) {
        aoa.push([]);
        validChartBlocks.forEach((block, idx) => {
          const title = (block?.title || `Grafica ${idx + 1}`).toString().trim();
          const labels = Array.isArray(block?.labels) ? block.labels : [];
          const series = Array.isArray(block?.series) ? block.series : [];
          if (!labels.length || !series.length) return;
          aoa.push(["CHART", title || `Grafica ${idx + 1}`]);
          aoa.push([
            label || "Categoria",
            ...series.map((serie, sIdx) => {
              const txt = (serie?.label || `Serie ${sIdx + 1}`).toString().trim();
              return txt || `Serie ${sIdx + 1}`;
            }),
          ]);
          labels.forEach((rawLabel, rowIdx) => {
            const itemLabel = this._limpiarEtiquetaOperativo(
              (rawLabel || "").toString().trim()
            );
            const row = [itemLabel || `Item ${rowIdx + 1}`];
            series.forEach((serie) => {
              const value = Array.isArray(serie?.data) ? serie.data[rowIdx] : 0;
              row.push(this._toNumberSafe(value));
            });
            aoa.push(row);
          });
          aoa.push([]);
        });
      }

      const sheet = XLSX.utils.aoa_to_sheet(aoa);
      const cols = [{ wch: 42 }];
      for (let idx = 1; idx < header.length; idx += 1) {
        cols.push({ wch: 18 });
      }
      sheet["!cols"] = cols;
      return sheet;
    },

    _obtenerEtiquetaOperativo() {
      const panel = document.querySelector(".operativo-panel, .operativo-sidebar");
      const label = panel?.dataset?.operativoLabel;
      return label ? label.trim() : "";
    },

    _capitalizar(texto) {
      if (!texto) return texto;
      return texto.charAt(0).toUpperCase() + texto.slice(1);
    },

    _normalizarColorHex(valor, fallback = "#4472C4") {
      const source = (valor || "").toString().trim();
      if (!source) return fallback;
      const hexMatch = source.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
      if (hexMatch) {
        let hex = hexMatch[1];
        if (hex.length === 3) {
          hex = hex
            .split("")
            .map((char) => `${char}${char}`)
            .join("");
        }
        return `#${hex.toUpperCase()}`;
      }
      const rgbMatch = source.match(
        /^rgba?\s*\(\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})/i
      );
      if (rgbMatch) {
        const toHex = (n) =>
          Math.max(0, Math.min(255, Number(n) || 0))
            .toString(16)
            .padStart(2, "0")
            .toUpperCase();
        return `#${toHex(rgbMatch[1])}${toHex(rgbMatch[2])}${toHex(rgbMatch[3])}`;
      }
      return fallback;
    },

    _resolverColorDataset(dataset, idx = 0) {
      const palette = ["#4472C4", "#7F7F7F", "#2F5597", "#70AD47", "#ED7D31"];
      const fallback = palette[idx % palette.length];
      const pick = (value) => {
        if (Array.isArray(value)) return value[0];
        return value;
      };
      const color =
        pick(dataset?.backgroundColor) ||
        pick(dataset?.borderColor) ||
        pick(dataset?.pointBackgroundColor) ||
        pick(dataset?.pointBorderColor) ||
        "";
      return this._normalizarColorHex(color, fallback);
    },

    _resolverBloquesGraficas(charts = null) {
      const targets = this._resolverGraficas(charts);
      if (!targets.length || typeof window.Chart?.getChart !== "function") return [];
      const blocks = [];
      targets.forEach((target, targetIndex) => {
        const canvas = target?.canvas;
        const chart = window.Chart.getChart(canvas);
        if (!chart?.data) return;
        const labels = Array.isArray(chart.data.labels)
          ? chart.data.labels.map((label, idx) => {
            const clean = this._limpiarEtiquetaOperativo(
              (label || "").toString().trim()
            );
            return clean || `Item ${idx + 1}`;
          })
          : [];
        if (!labels.length) return;

        const datasets = Array.isArray(chart.data.datasets) ? chart.data.datasets : [];
        const series = datasets
          .map((dataset, idx) => {
            const rawData = Array.isArray(dataset?.data) ? dataset.data : [];
            const normalizedValues = labels.map((_, labelIdx) =>
              this._normalizarValorGrafica(rawData[labelIdx])
            );
            const hasNumeric = normalizedValues.some((value) =>
              Number.isFinite(value)
            );
            const hasUsefulValue = normalizedValues.some(
              (value) => Number.isFinite(value) && Math.abs(value) > 0.000001
            );
            if (!hasNumeric || !hasUsefulValue) return null;
            const values = normalizedValues.map((value) =>
              Number.isFinite(value) ? value : 0
            );
            return {
              label:
                (dataset?.label || `Serie ${idx + 1}`).toString().trim() ||
                `Serie ${idx + 1}`,
              color: this._resolverColorDataset(dataset, idx),
              type: (dataset?.type || chart?.config?.type || "bar")
                .toString()
                .trim()
                .toLowerCase(),
              data: values,
            };
          })
          .filter(Boolean);
        if (!series.length) return;
        blocks.push({
          title:
            (target?.title || this._resolverTituloGrafica(canvas, `Grafica ${targetIndex + 1}`))
              .toString()
              .trim() || `Grafica ${targetIndex + 1}`,
          labels,
          series,
          isCombined: this._esGraficaCombinada(canvas),
        });
      });
      return blocks;
    },

    _resolverMetaGraficaOperativa(charts = null, precomputedBlocks = null) {
      const blocks = Array.isArray(precomputedBlocks)
        ? precomputedBlocks
        : this._resolverBloquesGraficas(charts);
      if (!blocks.length) return null;
      const preferred =
        blocks.find((block) => block?.isCombined) ||
        blocks.find((block) => block?.labels?.length && block?.series?.length) ||
        null;
      if (!preferred) return null;
      return {
        labels: Array.isArray(preferred.labels) ? preferred.labels : [],
        series: Array.isArray(preferred.series) ? preferred.series : [],
      };
    },

    _resolverEtiquetaFilaOperativa(fila) {
      const cells = Array.from(fila?.cells || []);
      if (!cells.length) return "";
      for (let idx = 1; idx < cells.length; idx += 1) {
        const text = this._leerTextoCelda(cells[idx]);
        if (/[A-Za-z\u00c0-\u024f]/.test(text)) {
          return this._limpiarEtiquetaOperativo(text);
        }
      }
      return this._limpiarEtiquetaOperativo(
        this._leerTextoCelda(cells[1] || cells[0])
      );
    },

    _obtenerFilasOperativas(tabla) {
      const rows = Array.from(tabla?.querySelectorAll("tbody tr") || []);
      if (!rows.length) return [];
      const direct = rows.filter(
        (row) =>
          row.classList.contains("sum-row-operativo") ||
          row.classList.contains("sum-row-operativo-consolidado")
      );
      if (direct.length) return direct;
      return rows.filter((row) => {
        const etiqueta = this._resolverEtiquetaFilaOperativa(row).toLowerCase();
        return (
          etiqueta.includes("resultado operativo") ||
          etiqueta.includes("operating result")
        );
      });
    },

    _toNumberSafe(value) {
      const number = Number(value);
      return Number.isFinite(number) ? number : 0;
    },

    _normalizarValorGrafica(value) {
      if (value == null) return null;
      if (typeof value === "number") {
        return Number.isFinite(value) ? value : null;
      }
      if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) return null;
        const parsed = Number(trimmed.replace(/,/g, ""));
        return Number.isFinite(parsed) ? parsed : null;
      }
      if (typeof value === "object") {
        const candidate =
          value?.y ?? value?.value ?? value?.v ?? value?.x ?? null;
        if (candidate == null) return null;
        const parsed = Number(candidate);
        return Number.isFinite(parsed) ? parsed : null;
      }
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    },

    _chartTieneDatosExportables(chart) {
      if (!chart?.data) return false;
      const labels = Array.isArray(chart.data.labels) ? chart.data.labels : [];
      const datasets = Array.isArray(chart.data.datasets) ? chart.data.datasets : [];
      if (!labels.length || !datasets.length) return false;

      let hasNumeric = false;
      let hasUsefulValue = false;
      datasets.forEach((dataset) => {
        const values = Array.isArray(dataset?.data) ? dataset.data : [];
        values.forEach((raw) => {
          const value = this._normalizarValorGrafica(raw);
          if (!Number.isFinite(value)) return;
          hasNumeric = true;
          if (Math.abs(value) > 0.000001) {
            hasUsefulValue = true;
          }
        });
      });

      return hasNumeric && hasUsefulValue;
    },

    _matchDatasetByLabel(datasets = [], matcher) {
      for (const dataset of datasets) {
        const label = (dataset?.label || "").toString().toLowerCase();
        if (!label) continue;
        if (matcher(label)) return dataset;
      }
      return null;
    },

    _obtenerDatosOperativoDesdeGraficas(chartTargets = []) {
      if (!Array.isArray(chartTargets) || !chartTargets.length) return [];
      for (const target of chartTargets) {
        const canvas = target?.canvas;
        const chart = window.Chart?.getChart?.(canvas);
        if (!chart?.data) continue;
        const labels = Array.isArray(chart.data.labels)
          ? chart.data.labels
          : [];
        const datasets = Array.isArray(chart.data.datasets)
          ? chart.data.datasets
          : [];
        if (!labels.length || !datasets.length) continue;

        const realDataset =
          this._matchDatasetByLabel(
            datasets,
            (label) => label.includes("real")
          ) || datasets[1] || datasets[0];

        const annualDataset = this._matchDatasetByLabel(
          datasets,
          (label) => label.includes("presupuesto") && !label.includes("acum")
        );

        let budgetDataset =
          this._matchDatasetByLabel(
            datasets,
            (label) => label.includes("ppto") || label.includes("presup")
          ) || datasets[0];

        if (annualDataset && budgetDataset === annualDataset) {
          budgetDataset =
            datasets.find((dataset) => dataset !== annualDataset) || budgetDataset;
        }

        const rows = labels
          .map((rawLabel, idx) => {
            const etiqueta = this._limpiarEtiquetaOperativo(
              (rawLabel || "").toString().trim()
            );
            if (!etiqueta) return null;
            const presupuesto = this._toNumberSafe(
              Array.isArray(budgetDataset?.data) ? budgetDataset.data[idx] : 0
            );
            const real = this._toNumberSafe(
              Array.isArray(realDataset?.data) ? realDataset.data[idx] : 0
            );
            const anual = this._toNumberSafe(
              Array.isArray(annualDataset?.data)
                ? annualDataset.data[idx]
                : presupuesto
            );
            return { etiqueta, presupuesto, real, anual };
          })
          .filter(Boolean);

        if (rows.length) return rows;
      }
      return [];
    },

    _obtenerDatosOperativo(tabla) {
      const indices = this._obtenerIndicesOperativo(tabla);
      if (indices.budget == null || indices.real == null) {
        return this._obtenerDatosOperativoDesdeGraficas(this._resolverGraficas());
      }
      const filas = this._obtenerFilasOperativas(tabla);
      const annualIdx =
        indices.annual != null && indices.annual >= 0
          ? indices.annual
          : indices.budget;
      const rows = filas
        .map((fila) => {
          const etiqueta = this._resolverEtiquetaFilaOperativa(fila);
          if (!etiqueta) return null;
          const identifier = this._resolverIdentificadorFilaOperativa(fila);
          const etiquetaDisplay = this._formatearEtiquetaConId(etiqueta, identifier);
          const presupuesto = this._parseNumeroTexto(
            this._leerTextoCelda(fila.cells?.[indices.budget])
          );
          const real = this._parseNumeroTexto(
            this._leerTextoCelda(fila.cells?.[indices.real])
          );
          const anual = this._parseNumeroTexto(
            this._leerTextoCelda(fila.cells?.[annualIdx])
          );
          return { etiqueta: etiquetaDisplay, presupuesto, real, anual };
        })
        .filter(Boolean);

      if (rows.length) return rows;
      return this._obtenerDatosOperativoDesdeGraficas(this._resolverGraficas());
    },

    _obtenerIndicesOperativo(tabla) {
      const headerRows = Array.from(tabla?.querySelectorAll("thead tr") || []);
      if (!headerRows.length) {
        return { budget: null, real: null, annual: null };
      }
      let idxTotalBudget = -1;
      let idxTotalReal = -1;
      let idxBudgetFallback = -1;

      const buscarPorTexto = (matcher) => {
        for (let pass = 0; pass < 2; pass += 1) {
          const allowColspan = pass === 1;
          for (const row of headerRows) {
            const headers = Array.from(row.children || []);
            for (const headerCell of headers) {
              const span = Number(headerCell?.colSpan) || 1;
              if (!allowColspan && span > 1) continue;
              const text = this._normalizeWhitespace(
                headerCell?.textContent || ""
              ).toLowerCase();
              if (!text) continue;
              if (matcher(text)) {
                return this._getHeaderCellStartIndex(headerCell);
              }
            }
          }
        }
        return -1;
      };

      headerRows.forEach((row) => {
        const headers = Array.from(row.children || []);
        headers.forEach((th) => {
          const idx = this._getHeaderCellStartIndex(th);
          if (idxTotalBudget < 0 && th.classList.contains("total-budget-column")) {
            idxTotalBudget = idx;
          }
          if (idxTotalReal < 0 && th.classList.contains("total-real-column")) {
            idxTotalReal = idx;
          }
          if (idxBudgetFallback < 0 && th.classList.contains("budget-annual-column")) {
            idxBudgetFallback = idx;
          }
        });
      });

      if (idxTotalBudget < 0) {
        idxTotalBudget = buscarPorTexto(
          (text) =>
            (text.includes("ppto") || text.includes("presupuesto")) &&
            text.includes("acum")
        );
      }
      if (idxTotalReal < 0) {
        idxTotalReal = buscarPorTexto(
          (text) => text.includes("real") && text.includes("acum")
        );
      }
      if (idxBudgetFallback < 0) {
        idxBudgetFallback = buscarPorTexto(
          (text) =>
            (text.includes("ppto") || text.includes("presupuesto")) &&
            !text.includes("acum")
        );
      }

      return {
        budget: idxTotalBudget >= 0 ? idxTotalBudget : idxBudgetFallback,
        real: idxTotalReal >= 0 ? idxTotalReal : null,
        annual: idxBudgetFallback >= 0 ? idxBudgetFallback : null,
      };
    },

    _normalizeWhitespace(value) {
      return (value || "").toString().replace(/\s+/g, " ").trim();
    },

    _getHeaderCellStartIndex(cell) {
      if (!cell) return -1;
      let idx = 0;
      let cursor = cell;
      while ((cursor = cursor.previousElementSibling)) {
        idx += Number(cursor.colSpan) || 1;
      }
      return idx;
    },

    _leerTextoCelda(cell) {
      if (!cell) return "";
      try {
        const input = cell.querySelector?.("input, textarea, select");
        if (input) {
          if (input.tagName === "SELECT") {
            const option = input.options?.[input.selectedIndex];
            return this._normalizeWhitespace(option?.textContent || input.value || "");
          }
          return this._normalizeWhitespace(input.value || "");
        }
        const dataset =
          cell.dataset?.rawValue ??
          cell.dataset?.value ??
          cell.dataset?.valor ??
          cell.getAttribute?.("data-raw-value") ??
          cell.getAttribute?.("data-value") ??
          cell.getAttribute?.("data-valor");
        if (dataset != null && String(dataset).trim() !== "") {
          return this._normalizeWhitespace(dataset);
        }
        const dataEl = cell.querySelector?.(
          "[data-raw-value],[data-value],[data-valor]"
        );
        if (dataEl) {
          const inner =
            dataEl.getAttribute("data-raw-value") ||
            dataEl.getAttribute("data-value") ||
            dataEl.getAttribute("data-valor") ||
            "";
          if (inner && inner.trim()) return this._normalizeWhitespace(inner);
        }
      } catch (_) {
        // ignore
      }
      return this._normalizeWhitespace(cell.textContent || "");
    },

    _resolverIdentificadorFilaOperativa(fila) {
      if (!fila) return "";
      const cells = fila.cells || [];
      const fromCell = this._normalizeWhitespace(this._leerTextoCelda(cells?.[0]));
      if (fromCell) return fromCell;
      const data = fila.dataset || {};
      const fromDataset =
        this._normalizeWhitespace(data.cuentaVisible) ||
        this._normalizeWhitespace(data.cuenta21) ||
        this._normalizeWhitespace(data.cuenta) ||
        this._normalizeWhitespace(data.operationId) ||
        this._normalizeWhitespace(data.operacionClave) ||
        this._normalizeWhitespace(data.layoutOrder);
      return fromDataset || "";
    },

    _formatearEtiquetaConId(etiqueta, identifier) {
      const cleanLabel = this._normalizeWhitespace(etiqueta);
      const cleanId = this._normalizeWhitespace(identifier);
      if (!cleanLabel) return "";
      if (!cleanId) return cleanLabel;
      if (cleanLabel.includes(cleanId)) return cleanLabel;
      return `${cleanLabel} (${cleanId})`;
    },

    _limpiarEtiquetaOperativo(texto) {
      return this._normalizeWhitespace(texto);
    },

    _parseNumeroTexto(texto) {
      const raw = (texto ?? "").toString();
      const trimmed = raw.trim();
      if (!trimmed) return 0;
      const parenNegative =
        trimmed.includes("(") && trimmed.includes(")") && !trimmed.includes("-");
      let limpio = raw
        .replace(/[−–—]/g, "-")
        .replace(/[()]/g, "")
        .replace(/[^0-9+.,-]/g, "");
      if (!limpio) return 0;
      const tieneComma = limpio.indexOf(",") >= 0;
      const tieneDot = limpio.indexOf(".") >= 0;
      if (tieneComma && tieneDot) {
        const lastDot = limpio.lastIndexOf(".");
        const lastComma = limpio.lastIndexOf(",");
        if (lastDot > lastComma) {
          limpio = limpio.replace(/,/g, "");
        } else {
          limpio = limpio.replace(/\./g, "");
          limpio = limpio.replace(/,/g, ".");
        }
      } else if (tieneComma && !tieneDot) {
        const partes = limpio.split(",");
        if (partes.length > 1 && partes[1].length === 3) {
          limpio = limpio.replace(/,/g, "");
        } else {
          limpio = limpio.replace(/,/g, ".");
        }
      }
      if ((limpio.match(/\./g) || []).length > 1) {
        const partes = limpio.split(".");
        const decimal = partes.pop();
        limpio = `${partes.join("")}.${decimal}`;
      }
      const numero = Number(limpio);
      if (!Number.isFinite(numero)) return 0;
      return parenNegative ? -Math.abs(numero) : numero;
    },

    /**
     * Elimina del clon las filas y celdas que estén computadas como display:none
     * en la tabla original. Así el export Excel sólo exporta lo visible.
     */
    _eliminarElementosOcultos(originalTable, cloneTable) {
      if (typeof window === "undefined") return;

      const origRows = Array.from(originalTable.querySelectorAll("tr"));
      const cloneRows = Array.from(cloneTable.querySelectorAll("tr"));

      // Recorrer en orden inverso para que los remove() no desplacen índices
      for (let i = origRows.length - 1; i >= 0; i--) {
        const origRow = origRows[i];
        const cloneRow = cloneRows[i];
        if (!cloneRow) continue;

        let rowHidden = false;
        try {
          rowHidden = window.getComputedStyle(origRow).display === "none";
        } catch (e) { /* no aplica fuera del DOM */ }

        if (rowHidden) {
          cloneRow.parentElement?.removeChild(cloneRow);
          continue;
        }

        // Revisar cada celda de la fila
        const origCells = Array.from(origRow.querySelectorAll("td, th"));
        const cloneCells = Array.from(cloneRow.querySelectorAll("td, th"));

        for (let j = origCells.length - 1; j >= 0; j--) {
          const cloneCell = cloneCells[j];
          if (!cloneCell) continue;
          let cellHidden = false;
          try {
            cellHidden = window.getComputedStyle(origCells[j]).display === "none";
          } catch (e) { /* no aplica fuera del DOM */ }
          if (cellHidden) {
            cloneRow.removeChild(cloneCell);
          }
        }
      }
    },

    _extraerTablaComoMatriz(tabla) {
      const filas = Array.from(tabla.querySelectorAll("tr"));
      const matriz = [];
      const pendientes = {};
      const merges = []; // Array para almacenar los merges
      const rowMeta = new Map();
      const secciones = Array.from(
        tabla.querySelectorAll("thead, tbody, tfoot")
      );

      secciones.forEach((seccion) => {
        const rows = Array.from(seccion.querySelectorAll("tr"));
        rows.forEach((tr, idx) => {
          rowMeta.set(tr, { index: idx, total: rows.length });
        });
      });

      filas.forEach((tr, filaIdx) => {
        const esHeader = tr.parentElement?.tagName === "THEAD";
        const filaMatriz = [];
        let colIdx = 0;
        const rowInfo = rowMeta.get(tr);
        const maxRowspan = rowInfo ? rowInfo.total - rowInfo.index : null;

        const consumirPendientes = () => {
          while (pendientes[colIdx]?.restante > 0) {
            const spanInfo = pendientes[colIdx];
            filaMatriz[colIdx] = {
              value: "",
              isHeader: spanInfo.isHeader,
              classes: spanInfo.classes,
              domCell: spanInfo.domCell,
            };
            spanInfo.restante -= 1;
            if (spanInfo.restante <= 0) delete pendientes[colIdx];
            colIdx += 1;
          }
        };

        consumirPendientes();

        Array.from(tr.cells).forEach((celda) => {
          consumirPendientes();

          const colspan = parseInt(celda.getAttribute("colspan") || "1", 10);
          const rowspanRaw = parseInt(
            celda.getAttribute("rowspan") || "1",
            10
          );
          const rowspan =
            maxRowspan == null
              ? rowspanRaw
              : Math.min(rowspanRaw, maxRowspan);
          const classes = Array.from(celda.classList);

          filaMatriz[colIdx] = {
            value: this._obtenerValorCeldaExcel(celda),
            isHeader: esHeader,
            classes,
            domCell: celda,
          };

          // Registrar merge si hay colspan o rowspan > 1
          if (colspan > 1 || rowspan > 1) {
            merges.push({
              s: { r: filaIdx, c: colIdx }, // start: row, col
              e: { r: filaIdx + rowspan - 1, c: colIdx + colspan - 1 } // end: row, col
            });
          }

          // Rellenar columnas adicionales si tiene colspan
          for (let extra = 1; extra < colspan; extra++) {
            filaMatriz[colIdx + extra] = {
              value: "",
              isHeader: esHeader,
              classes,
              domCell: celda,
            };
          }

          if (rowspan > 1) {
            for (let spanCol = 0; spanCol < colspan; spanCol++) {
              pendientes[colIdx + spanCol] = {
                restante: rowspan - 1,
                isHeader: esHeader,
                classes,
                domCell: celda,
              };
            }
          }

          colIdx += colspan;
        });

        consumirPendientes();
        matriz[filaIdx] = filaMatriz;
      });

      const aoa = matriz.map((fila) => fila.map((celda) => celda?.value ?? ""));
      return { matriz, aoa, merges };
    },

    _obtenerValorCeldaExcel(celda) {
      const texto = (celda.textContent || "").trim();
      if (!texto) return "";
      const isPercent = texto.includes("%");
      const tieneLetras = texto.toLowerCase() !== texto.toUpperCase();
      if (tieneLetras) return texto;
      const numeroNormalizado = texto
        .replace(/[^0-9,.-]/g, "")
        .replace(/,(?=\d{3}(\D|$))/g, "")
        .replace(/,/g, ".");

      if (!numeroNormalizado || !/[0-9]/.test(numeroNormalizado)) {
        return texto;
      }

      const numero = Number(numeroNormalizado);
      if (!Number.isNaN(numero) && texto !== "") {
        return isPercent ? numero / 100 : numero;
      }
      return texto;
    },

    _estimarAnchoColumna(texto) {
      if (!texto) return 10;
      const lineas = String(texto).split(/\r?\n/);
      const maxLinea = lineas.reduce((max, linea) => Math.max(max, linea.length), 0);
      const anchoBase = maxLinea * 0.9;
      return Math.max(8, Math.min(60, anchoBase));
    },

    /**
     * Imprimir tabla como PDF (ventana de impresión)
     * @param {Object} options - Opciones de impresión
     * @param {string|HTMLElement} options.tabla - Selector o elemento de la tabla
     * @param {string} options.titulo - Título del documento
     * @param {string} options.subtitulo - Subtítulo adicional
     */
    async imprimirPDF(options = {}) {
      const { tabla, titulo = "Reporte", subtitulo = "", charts } = options;

      try {
        const tablaElement =
          typeof tabla === "string"
            ? document.querySelector(tabla)
            : tabla || document.querySelector("table");

        if (!tablaElement) {
          this._showToast("No hay tabla para imprimir", "warning");
          return;
        }

        const metadata = this._obtenerMetadata();
        const pdfDisponible = await this._ensurePdfLibs();
        if (pdfDisponible) {
          await this._imprimirPdfConGraficas({
            tablaElement,
            titulo,
            subtitulo,
            metadata,
            charts,
          });
          return;
        }

        const tablaClon = tablaElement.cloneNode(true);
        const ventana = window.open("", "_blank", "width=1200,height=900");
        if (!ventana) {
          alert("Activa las ventanas emergentes para imprimir.");
          return;
        }

        const estilosImpresion = this._getEstilosImpresion();
        const chartTargets = charts === false ? [] : this._resolverGraficas(charts);
        const chartImages = await this._capturarGraficas(chartTargets);
        const chartsHtml = this._construirHtmlGraficas(chartImages);

        ventana.document.write(`<!DOCTYPE html>
        <html>
          <head>
            <title>${titulo}</title>
            <style>${estilosImpresion}</style>
          </head>
          <body>
            <h1>${titulo}</h1>
            <p class="meta">
              Empresa: ${metadata.empresaTexto || "-"}<br>
              Periodo: ${metadata.mesNombre || ""} ${metadata.anio || ""}
              ${subtitulo ? "<br>" + subtitulo : ""}
            </p>
            ${tablaClon.outerHTML}
            ${chartsHtml}
            <script>
              window.onload = function() {
                window.focus();
                window.print();
                setTimeout(function() { window.close(); }, 300);
              };
            <\/script>
          </body>
        </html>`);
        ventana.document.close();
      } catch (error) {
        console.error("Error al imprimir PDF:", error);
        this._showToast("Error al imprimir: " + error.message, "error");
      }
    },

    async _ensurePdfLibs() {
      const hasPdf =
        window.jspdf?.jsPDF &&
        (window.jspdf.jsPDF.API?.autoTable ||
          window.jspdf.jsPDF.prototype?.autoTable);
      if (hasPdf) return true;

      if (typeof document === "undefined") return false;

      const loadScript = (src, key) =>
        new Promise((resolve, reject) => {
          const existing = document.querySelector(
            `script[data-export-utils="${key}"]`
          );
          if (existing) {
            if (existing.dataset.loaded === "1") {
              resolve();
              return;
            }
            existing.addEventListener("load", () => resolve(), { once: true });
            existing.addEventListener(
              "error",
              () => reject(new Error(`No se pudo cargar ${src}`)),
              { once: true }
            );
            return;
          }
          const script = document.createElement("script");
          script.src = src;
          script.async = true;
          script.dataset.exportUtils = key;
          script.onload = () => {
            script.dataset.loaded = "1";
            resolve();
          };
          script.onerror = () =>
            reject(new Error(`No se pudo cargar ${src}`));
          document.head.appendChild(script);
        });

      try {
        await loadScript(
          "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
          "jspdf"
        );
        await loadScript(
          "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js",
          "autotable"
        );
      } catch (error) {
        console.warn("No se pudieron cargar librerias PDF:", error);
        return false;
      }

      return Boolean(
        window.jspdf?.jsPDF &&
        (window.jspdf.jsPDF.API?.autoTable ||
          window.jspdf.jsPDF.prototype?.autoTable)
      );
    },

    async _imprimirPdfConGraficas({
      tablaElement,
      titulo,
      subtitulo,
      metadata,
      charts,
    }) {
      if (!window.jspdf?.jsPDF) {
        throw new Error("jsPDF no disponible");
      }
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
        compress: false,
        precision: 16,
      });
      const headerX = 15;
      const chartMargin = 15;
      const tableMargins = { left: 30, right: 30, top: 25, bottom: 25 };
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text(titulo || "Reporte", headerX, 15);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const empresaTexto = metadata?.empresaTexto || "-";
      const periodo = `${metadata?.mesNombre || ""} ${metadata?.anio || ""}`.trim();
      let metaY = 22;
      doc.text(`Empresa: ${empresaTexto}`, headerX, metaY);
      metaY += 5;
      if (periodo) {
        doc.text(`Periodo: ${periodo}`, headerX, metaY);
        metaY += 5;
      }
      let startY = 30;
      if (subtitulo) {
        doc.text(subtitulo, headerX, metaY);
        startY = Math.max(startY, metaY + 5);
      }

      const { head, body, columnStyles, columnWidths } =
        this._construirTablaPdf(tablaElement);
      const resolvedColumnStyles = { ...(columnStyles || {}) };
      if (Array.isArray(columnWidths) && columnWidths.length) {
        const totalWidth = columnWidths.reduce(
          (acc, width) => acc + (Number(width) || 0),
          0
        );
        if (totalWidth > 0) {
          const printableWidth =
            pageWidth - tableMargins.left - tableMargins.right;
          columnWidths.forEach((width, idx) => {
            const value = Number(width) || 0;
            if (!value) return;
            const cellWidth = (value / totalWidth) * printableWidth;
            resolvedColumnStyles[idx] = {
              ...(resolvedColumnStyles[idx] || {}),
              cellWidth,
            };
          });
        }
      }
      if (typeof doc.autoTable === "function") {
        doc.autoTable({
          head: head.length ? head : undefined,
          body: body.length ? body : undefined,
          startY,
          styles: {
            fontSize: 7,
            cellPadding: 2,
            lineColor: [200, 200, 200],
            lineWidth: 0.1,
            overflow: "linebreak",
            halign: "center",
            minCellHeight: 8,
            valign: "middle",
          },
          headStyles: {
            fillColor: [13, 71, 161],
            textColor: 255,
            fontStyle: "bold",
            halign: "center",
            valign: "middle",
            fontSize: 8,
            cellPadding: 2.5,
            minCellHeight: 10,
            overflow: "linebreak",
          },
          columnStyles: resolvedColumnStyles,
          theme: "grid",
          margin: tableMargins,
          tableWidth: "auto",
        });
      }

      const chartTargets = charts === false ? [] : this._resolverGraficas(charts);
      if (charts !== false) {
        this.verificarGraficasExportables({ charts, mostrar: true });
      }
      this._debugLog("📊 PDF: chartTargets encontrados:", chartTargets.length);
      let chartImages = await this._capturarGraficas(chartTargets);
      this._debugLog("📊 PDF: chartImages capturadas:", chartImages.length);
      if (!chartImages.length) {
        this._debugLog("📊 PDF: Usando fallback operativo...");
        chartImages = this._construirGraficasFallbackOperativo(tablaElement);
        this._debugLog("📊 PDF: chartImages de fallback:", chartImages.length);
      }
      if (chartImages.length) {
        chartImages.forEach((img) => {
          if (!img?.dataUrl) {
            console.warn("📊 PDF: Imagen sin dataUrl:", img?.title);
            return;
          }
          if (!this._esDataUrlImagenValida(img.dataUrl)) {
            console.warn("📊 PDF: dataUrl inválido para:", img?.title, "longitud:", img.dataUrl?.length);
            return;
          }
          try {
            doc.addPage();
            let y = chartMargin;
            doc.setFont("helvetica", "bold");
            doc.setFontSize(14);
            doc.text(img.title || "Grafica", chartMargin, y);
            y += 10;

            const imgWidth = pageWidth - chartMargin * 2;
            const ratioRaw = img.width && img.height ? img.height / img.width : 0.6;
            const ratio = Math.max(0.35, Math.min(1.45, ratioRaw || 0.6));
            let imgHeight = imgWidth * ratio;
            const maxHeight = pageHeight - y - chartMargin;
            const minHeight = Math.min(maxHeight, 120);
            if (imgHeight < minHeight) {
              imgHeight = minHeight;
            }
            if (imgHeight > maxHeight) {
              imgHeight = maxHeight;
            }
            doc.addImage(img.dataUrl, "PNG", chartMargin, y, imgWidth, imgHeight);
          } catch (error) {
            console.warn("No se pudo insertar grafica en PDF:", error);
          }
        });
      }

      const baseName = [
        titulo || "Reporte",
        metadata?.empresaTexto,
        metadata?.mesNombre,
        metadata?.anio,
      ]
        .filter(Boolean)
        .join("_")
        .replace(/[\/:*?"<>|]/g, "_")
        .replace(/\s+/g, "_");
      const fileName = `${baseName || "Reporte"}.pdf`;
      doc.save(fileName);
    },

    _construirTablaPdf(tablaElement) {
      const thead = tablaElement.querySelector("thead");
      const tbody = tablaElement.querySelector("tbody");
      const head = [];
      const body = [];

      const isHidden = (element) => {
        if (!element) return true;
        if (element.hidden) return true;
        if (typeof window === "undefined" || !window.getComputedStyle) {
          return false;
        }
        const style = window.getComputedStyle(element);
        return style.display === "none" || style.visibility === "hidden";
      };

      const parseSpan = (cell, attr) => {
        const raw = parseInt(cell.getAttribute(attr), 10);
        if (Number.isInteger(raw) && raw > 0) return raw;
        const direct = attr === "colspan" ? cell.colSpan : cell.rowSpan;
        return Number.isInteger(direct) && direct > 0 ? direct : 1;
      };

      const parseRgb = (value) => {
        if (!value) return null;
        const rgbMatch = value.match(/rgba?\(([^)]+)\)/i);
        if (rgbMatch) {
          const parts = rgbMatch[1].split(",").map((part) => part.trim());
          const r = Number(parts[0]);
          const g = Number(parts[1]);
          const b = Number(parts[2]);
          const a = parts.length > 3 ? Number(parts[3]) : 1;
          if ([r, g, b].some((num) => Number.isNaN(num))) return null;
          return { r, g, b, a: Number.isNaN(a) ? 1 : a };
        }
        if (value[0] === "#") {
          const hex = value.slice(1);
          const expanded =
            hex.length === 3
              ? hex
                .split("")
                .map((c) => c + c)
                .join("")
              : hex;
          if (expanded.length !== 6) return null;
          const r = parseInt(expanded.slice(0, 2), 16);
          const g = parseInt(expanded.slice(2, 4), 16);
          const b = parseInt(expanded.slice(4, 6), 16);
          if ([r, g, b].some((num) => Number.isNaN(num))) return null;
          return { r, g, b, a: 1 };
        }
        return null;
      };

      const aplicarEstilosCalculados = (cell, styles) => {
        if (!cell || !window.getComputedStyle) return;
        const computed = window.getComputedStyle(cell);
        const bg = parseRgb(computed.backgroundColor);
        if (bg && bg.a > 0) {
          styles.fillColor = [bg.r, bg.g, bg.b];
        }
        const fg = parseRgb(computed.color);
        if (fg) {
          styles.textColor = [fg.r, fg.g, fg.b];
        }
        const weight = computed.fontWeight || "";
        const isBold = Number(weight) >= 600 || /bold/i.test(weight);
        const isItalic = /italic/i.test(computed.fontStyle || "");
        if (isBold && isItalic) {
          styles.fontStyle = "bolditalic";
        } else if (isBold) {
          styles.fontStyle = "bold";
        } else if (isItalic) {
          styles.fontStyle = "italic";
        }
        const align = (computed.textAlign || "").toLowerCase();
        const alignMap = {
          left: "left",
          right: "right",
          center: "center",
          start: "left",
          end: "right",
        };
        if (alignMap[align]) {
          styles.halign = alignMap[align];
        }
      };

      const headerRows = thead ? Array.from(thead.querySelectorAll("tr")) : [];
      const headerInfo = (() => {
        let best = null;
        headerRows.forEach((row) => {
          let colIndex = 0;
          const cols = [];
          Array.from(row.children).forEach((cell) => {
            const colSpan = parseSpan(cell, "colspan");
            const hidden = isHidden(cell);
            for (let i = 0; i < colSpan; i += 1) {
              cols[colIndex + i] = !hidden;
            }
            colIndex += colSpan;
          });
          if (!best || colIndex > best.count) {
            best = { cols, count: colIndex, row };
          }
        });
        return best;
      })();

      const visibleColumns =
        headerInfo?.cols && headerInfo.cols.length ? headerInfo.cols : null;
      const countVisibleSpan = (start, span) => {
        if (!visibleColumns) return span;
        let count = 0;
        for (let i = 0; i < span; i += 1) {
          if (visibleColumns[start + i] !== false) count += 1;
        }
        return count;
      };

      const columnWidths = [];
      if (headerInfo?.row) {
        let colIndex = 0;
        Array.from(headerInfo.row.children).forEach((cell) => {
          const colSpan = parseSpan(cell, "colspan");
          const hidden = isHidden(cell);
          const rect = cell.getBoundingClientRect();
          const baseWidth = rect?.width || cell.offsetWidth || 0;
          const perCol = colSpan ? baseWidth / colSpan : baseWidth;
          for (let i = 0; i < colSpan; i += 1) {
            if (!hidden) {
              columnWidths[colIndex + i] = perCol;
            }
          }
          colIndex += colSpan;
        });
      }
      const visibleColumnWidths = [];
      if (columnWidths.length) {
        columnWidths.forEach((width, idx) => {
          if (!visibleColumns || visibleColumns[idx] !== false) {
            visibleColumnWidths.push(width);
          }
        });
      }

      if (thead) {
        headerRows.forEach((row, rowIndex) => {
          if (isHidden(row)) return;
          const headerRow = [];
          const cells = Array.from(row.querySelectorAll("th"));
          let colIndex = 0;
          cells.forEach((cell) => {
            const colSpan = parseSpan(cell, "colspan");
            const rowSpan = parseSpan(cell, "rowspan");
            const visibleSpan = countVisibleSpan(colIndex, colSpan);
            colIndex += colSpan;
            if (isHidden(cell) || visibleSpan <= 0) {
              return;
            }
            const maxRowSpan = Math.max(
              1,
              Math.min(rowSpan, headerRows.length - rowIndex)
            );
            const texto = cell.textContent.replace(/\s+/g, " ").trim();
            const styles = {
              halign: "center",
              valign: "middle",
              fontStyle: "bold",
              fontSize: 7,
              cellPadding: 2,
            };
            aplicarEstilosCalculados(cell, styles);
            headerRow.push({
              content: texto,
              colSpan: visibleSpan,
              rowSpan: maxRowSpan,
              styles,
            });
          });
          if (headerRow.length) head.push(headerRow);
        });
      }

      if (tbody) {
        const rows = Array.from(tbody.querySelectorAll("tr"));
        rows.forEach((row) => {
          if (isHidden(row)) return;
          const rowData = [];
          const cells = Array.from(row.querySelectorAll("td"));
          let colIndex = 0;
          cells.forEach((cell, idx) => {
            const colSpan = parseSpan(cell, "colspan");
            const rowSpan = parseSpan(cell, "rowspan");
            const visibleSpan = countVisibleSpan(colIndex, colSpan);
            colIndex += colSpan;
            if (isHidden(cell) || visibleSpan <= 0) {
              return;
            }
            const texto = cell.textContent.replace(/\s+/g, " ").trim();
            const styles = { fontSize: 6, cellPadding: 1.5 };

            if (row.classList.contains("section-header-row")) {
              styles.fillColor = [30, 58, 138];
              styles.textColor = 255;
              styles.fontStyle = "bold";
              styles.fontSize = 7;
            } else if (row.classList.contains("subsection-row")) {
              styles.fillColor = [219, 234, 254];
              styles.textColor = [30, 58, 138];
              styles.fontStyle = "bold";
            } else if (row.classList.contains("sum-row")) {
              styles.fillColor = [254, 243, 199];
              styles.textColor = [120, 53, 15];
              styles.fontStyle = "bold";
            } else if (row.classList.contains("highlight-bright")) {
              styles.fillColor = [254, 202, 202];
              styles.textColor = [153, 27, 27];
              styles.fontStyle = "bold";
              styles.fontSize = 7;
            } else if (row.classList.contains("highlight-primary")) {
              styles.fillColor = [167, 243, 208];
              styles.textColor = [6, 95, 70];
              styles.fontStyle = "bold";
            } else if (row.classList.contains("highlight-secondary")) {
              styles.fillColor = [165, 243, 252];
              styles.textColor = [14, 116, 144];
              styles.fontStyle = "bold";
            }

            const leftAligned =
              idx <= 1 ||
              cell.classList.contains("text-start") ||
              cell.classList.contains("account-column") ||
              cell.classList.contains("account-column-header") ||
              cell.classList.contains("label-cell");
            styles.halign = leftAligned ? "left" : "right";
            styles.valign = "middle";
            aplicarEstilosCalculados(cell, styles);

            const cellConfig = { content: texto, styles };
            if (visibleSpan > 1) {
              cellConfig.colSpan = visibleSpan;
            }
            if (rowSpan > 1) {
              cellConfig.rowSpan = rowSpan;
            }
            rowData.push(cellConfig);
          });
          if (rowData.length) body.push(rowData);
        });
      }

      const columnStyles = {};
      if (visibleColumns && visibleColumns.length) {
        let visibleIdx = 0;
        visibleColumns.forEach((isVisible, originalIdx) => {
          if (isVisible === false) return;
          if (originalIdx <= 1) {
            columnStyles[visibleIdx] = { halign: "left" };
          }
          visibleIdx += 1;
        });
      } else {
        columnStyles[0] = { halign: "left" };
        columnStyles[1] = { halign: "left" };
      }

      return {
        head,
        body,
        columnStyles,
        columnWidths: visibleColumnWidths,
      };
    },

    _resolverModoGraficasExcel() {
      const combined = document.querySelector(
        '[data-operativo-chart="combined"] canvas'
      );
      return combined ? "combined" : "";
    },

    _agregarImagenExcel(workbook, dataUrl) {
      if (!workbook || typeof workbook.addImage !== "function") return null;
      if (!this._esDataUrlImagenValida(dataUrl)) return null;
      const match = dataUrl.match(/^data:image\/(png|jpe?g|webp);base64,/i);
      const rawExtension = (match?.[1] || "png").toLowerCase();
      const extension =
        rawExtension === "jpg"
          ? "jpeg"
          : rawExtension;
      try {
        return workbook.addImage({
          base64: dataUrl,
          extension,
        });
      } catch (firstError) {
        try {
          return workbook.addImage({
            base64: extraerBase64DeDataUrl(dataUrl),
            extension,
          });
        } catch (secondError) {
          console.warn("No se pudo registrar imagen para Excel.", secondError || firstError);
          return null;
        }
      }
    },

    _esDataUrlImagenValida(dataUrl) {
      if (typeof dataUrl !== "string") return false;
      const value = dataUrl.trim();
      if (!value) return false;
      if (!/^data:image\/(png|jpe?g|webp);base64,/i.test(value)) return false;
      return value.length > 128;
    },

    _canvasTieneContenido(canvas) {
      if (!canvas || typeof canvas.getContext !== "function") return false;
      const width = Number(canvas.width) || 0;
      const height = Number(canvas.height) || 0;
      if (width < 2 || height < 2) return false;
      const ctx = canvas.getContext("2d");
      if (!ctx || typeof ctx.getImageData !== "function") return false;
      try {
        const imageData = ctx.getImageData(0, 0, width, height).data;
        const stepX = Math.max(1, Math.floor(width / 120));
        const stepY = Math.max(1, Math.floor(height / 80));
        let nonTransparent = 0;
        let nonNearWhite = 0;
        for (let y = 0; y < height; y += stepY) {
          for (let x = 0; x < width; x += stepX) {
            const idx = (y * width + x) * 4;
            const a = imageData[idx + 3] || 0;
            if (a <= 8) continue;
            nonTransparent += 1;
            const r = imageData[idx] || 0;
            const g = imageData[idx + 1] || 0;
            const b = imageData[idx + 2] || 0;
            if (r < 245 || g < 245 || b < 245) {
              nonNearWhite += 1;
            }
          }
        }
        return nonTransparent > 20 && (nonNearWhite > 8 || nonTransparent > 150);
      } catch (error) {
        // Si el navegador bloquea lectura de pixeles, no invalidamos la captura.
        return true;
      }
    },

    _resolverGraficas(charts) {
      const targets = [];
      const seen = new Set();
      const isHidden = (node) => {
        if (!node || !node.isConnected) return true;
        if (node.hidden || node.getAttribute?.("aria-hidden") === "true") {
          return true;
        }
        let current = node;
        while (current && current.nodeType === 1) {
          const style = window.getComputedStyle(current);
          if (style.display === "none" || style.visibility === "hidden") {
            const isCollapsedContainer =
              current.classList?.contains("collapse") &&
              !current.classList?.contains("show");
            if (isCollapsedContainer) {
              current = current.parentElement;
              continue;
            }
            return true;
          }
          current = current.parentElement;
        }
        const rects = node.getClientRects?.();
        const hasCollapsedAncestor = Boolean(node.closest?.(".collapse:not(.show)"));
        if (rects && rects.length === 0 && !hasCollapsedAncestor) return true;
        return false;
      };
      const isCanvas = (node) => {
        if (!node) return false;
        if (typeof HTMLCanvasElement !== "undefined") {
          return node instanceof HTMLCanvasElement;
        }
        return node.tagName === "CANVAS";
      };
      const resolveCanvas = (node) => {
        if (!node) return null;
        if (isCanvas(node)) return node;
        if (typeof node.querySelector === "function") {
          return node.querySelector("canvas");
        }
        return null;
      };
      const pushCanvas = (canvas, title, options = {}) => {
        if (!isCanvas(canvas) || seen.has(canvas)) return;
        if (!options.allowHidden && isHidden(canvas)) return;
        seen.add(canvas);
        targets.push({ canvas, title });
      };
      const resolveTitle = (canvas, fallback) =>
        this._resolverTituloGrafica(canvas, fallback);
      const pushFromSelector = (selector, options = {}) => {
        if (!selector) return;
        document.querySelectorAll(selector).forEach((node) => {
          const canvas = resolveCanvas(node);
          if (!canvas) return;
          pushCanvas(canvas, resolveTitle(canvas, ""), options);
        });
      };

      if (Array.isArray(charts) && charts.length) {
        charts.forEach((item) => {
          if (!item) return;
          if (typeof item === "string") {
            const canvas = resolveCanvas(document.querySelector(item));
            if (canvas) pushCanvas(canvas, resolveTitle(canvas, ""));
            return;
          }
          if (
            typeof HTMLCanvasElement !== "undefined" &&
            item instanceof HTMLCanvasElement
          ) {
            pushCanvas(item, resolveTitle(item, ""));
            return;
          }
          if (typeof item === "object") {
            const selector =
              typeof item.selector === "string" ? item.selector : "";
            const canvas = resolveCanvas(
              item.canvas || (selector ? document.querySelector(selector) : null)
            );
            if (canvas) {
              const title =
                typeof item.title === "string" && item.title.trim()
                  ? item.title.trim()
                  : resolveTitle(canvas, "");
              pushCanvas(canvas, title);
            }
          }
        });
        return targets;
      }

      pushFromSelector("[data-operativo-chart], [data-operativo-chart] canvas", {
        allowHidden: true,
      });
      pushFromSelector("[data-gg-chart], [data-gg-chart] canvas", {
        allowHidden: true,
      });
      pushFromSelector("[data-custom-chart], [data-custom-chart] canvas", {
        allowHidden: true,
      });
      pushFromSelector("#resumenChartsPanel canvas, .charts-panel canvas", {
        allowHidden: true,
      });
      return targets;
    },

    verificarGraficasExportables(options = {}) {
      const { charts, mostrar = true, maxList = 3 } = options;
      const targets = charts === false ? [] : this._resolverGraficas(charts);
      const report = this._auditarGraficasExportacion(targets);
      if (!mostrar) return report;
      if (!report.total) {
        this._showToast("No se detectaron gráficas para exportar.", "warning");
        return report;
      }
      if (!report.omitidas.length) {
        this._showToast(
          `Exportación: ${report.exportables.length} gráficas listas.`,
          "success"
        );
        return report;
      }
      const preview = report.omitidas
        .slice(0, Math.max(1, maxList))
        .map((item) => item.title)
        .filter(Boolean)
        .join(", ");
      const extra =
        report.omitidas.length > maxList
          ? ` y ${report.omitidas.length - maxList} más`
          : "";
      this._showToast(
        `Exportación: ${report.exportables.length} listas, ${report.omitidas.length} sin datos: ${preview}${extra}.`,
        "warning"
      );
      if (console?.table) {
        console.table(report.omitidas);
      }
      return report;
    },

    _auditarGraficasExportacion(targets = []) {
      const report = { total: targets.length, exportables: [], omitidas: [] };
      targets.forEach((target) => {
        const canvas = target?.canvas;
        const title =
          (target?.title || this._resolverTituloGrafica(canvas, "Grafica"))
            ?.toString()
            .trim() || "Grafica";
        if (!canvas || typeof canvas.getContext !== "function") {
          report.omitidas.push({ title, reason: "Sin canvas" });
          return;
        }
        const width =
          Number(canvas.width) || Number(canvas.clientWidth) || 0;
        const height =
          Number(canvas.height) || Number(canvas.clientHeight) || 0;
        if (width <= 2 && height <= 2) {
          report.omitidas.push({ title, reason: "Sin tamaño" });
          return;
        }
        const chart =
          typeof window.Chart?.getChart === "function"
            ? window.Chart.getChart(canvas)
            : null;
        if (chart) {
          // Si existe instancia Chart.js y tiene datasets útiles,
          // es exportable aunque el panel esté colapsado/no renderizado.
          if (!this._chartTieneDatosExportables(chart)) {
            report.omitidas.push({ title, reason: "Sin datos" });
            return;
          }
          report.exportables.push({ title });
          return;
        }
        const hasContent = this._canvasTieneContenido(canvas);
        if (!hasContent) {
          report.omitidas.push({ title, reason: "Sin render o sin datos" });
          return;
        }
        report.exportables.push({ title });
      });
      return report;
    },

    _resolverTituloGrafica(canvas, fallback = "") {
      if (!canvas) return fallback;
      const titleEl =
        canvas.closest(".chart-block")?.querySelector(".chart-title") ||
        canvas.closest(".charts-card")?.querySelector("h6") ||
        canvas.closest(".charts-card")?.querySelector("h5") ||
        canvas.closest(".chart-card")?.querySelector("h6") ||
        canvas.closest(".chart-card")?.querySelector("h5");
      const titleText = titleEl?.textContent?.trim();
      return titleText || fallback || "Grafica";
    },

    _esGraficaCombinada(canvas) {
      return Boolean(canvas?.closest?.('[data-operativo-chart="combined"]'));
    },

    _resolverConfigCapturaGrafica(canvas) {
      const baseRatio = window.devicePixelRatio || 1;
      const chart =
        typeof window.Chart?.getChart === "function"
          ? window.Chart.getChart(canvas)
          : null;
      const labelsCount = Array.isArray(chart?.data?.labels)
        ? chart.data.labels.length
        : 0;
      const baseWidth = Math.max(
        Number(canvas?.clientWidth) || 0,
        Number(canvas?.width) || 0,
        1400
      );
      const baseHeight = Math.max(
        Number(canvas?.clientHeight) || 0,
        Number(canvas?.height) || 0,
        420
      );
      const byLabels = labelsCount > 0 ? labelsCount * 42 + 260 : 720;
      const targetWidth = Math.min(2800, Math.max(1700, Math.round(baseWidth * 1.35)));
      const targetHeight = Math.min(1900, Math.max(baseHeight, byLabels, 720));
      const pixelRatio = Math.max(3, baseRatio * 2);
      return {
        withLabels: true,
        pixelRatio,
        targetWidth,
        targetHeight,
        labelPaddingLeft: 28,
        labelPaddingRight: 220,
        xGrace: "40%",
      };
    },

    _formatearNumeroGrafica(valor) {
      const numero = Number(valor);
      if (!Number.isFinite(numero)) return "";
      const fijo = numero.toFixed(2);
      const partes = fijo.split(".");
      const entero = partes[0] || "0";
      const decimales = partes[1] || "00";
      const enteroConComas = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      return `${enteroConComas}.${decimales}`;
    },

    _crearPluginEtiquetasGrafica() {
      if (this._pluginEtiquetasGrafica) return this._pluginEtiquetasGrafica;
      const formatter = (valor) => this._formatearNumeroGrafica(valor);
      const plugin = {
        id: "export-value-labels",
        afterDatasetsDraw: (chart) => {
          if (!chart?.ctx) return;
          const ctx = chart.ctx;
          const ratio =
            chart.currentDevicePixelRatio ||
            chart._devicePixelRatio ||
            window.devicePixelRatio ||
            1;
          const fontSize = Math.max(13, Math.round(11 * ratio));
          ctx.save();
          ctx.font = `600 ${fontSize}px Segoe UI, Arial, sans-serif`;
          ctx.fillStyle = "#0f172a";
          ctx.strokeStyle = "rgba(255,255,255,0.96)";
          ctx.lineWidth = Math.max(2, Math.round(1.6 * ratio));
          ctx.lineJoin = "round";
          const drawLabel = (label, x, y) => {
            ctx.strokeText(label, x, y);
            ctx.fillText(label, x, y);
          };
          const indexAxis = chart.options?.indexAxis || "x";
          const isHorizontal = indexAxis === "y";
          const datasets = chart.data?.datasets || [];
          datasets.forEach((dataset, datasetIndex) => {
            const meta = chart.getDatasetMeta(datasetIndex);
            if (!meta || meta.hidden) return;
            const type = meta.type || dataset.type;
            if (type !== "bar" && type !== "line") return;
            const data = Array.isArray(dataset.data) ? dataset.data : [];
            meta.data.forEach((element, index) => {
              const raw = data[index];
              const value = Number(raw);
              if (!Number.isFinite(value)) return;
              if (Math.abs(value) < 0.0001) return;
              const label = formatter(value);
              if (!label) return;
              const props = element.getProps
                ? element.getProps(["x", "y"], true)
                : { x: element.x, y: element.y };
              if (!props) return;
              if (type === "line") {
                const offset = 8 * ratio;
                ctx.textAlign = "center";
                ctx.textBaseline = value >= 0 ? "bottom" : "top";
                const y = value >= 0 ? props.y - offset : props.y + offset;
                drawLabel(label, props.x, y);
                return;
              }
              if (isHorizontal) {
                const offset = 8 * ratio;
                ctx.textAlign = value >= 0 ? "left" : "right";
                ctx.textBaseline = "middle";
                const x = value >= 0 ? props.x + offset : props.x - offset;
                drawLabel(label, x, props.y);
              } else {
                const offset = 8 * ratio;
                ctx.textAlign = "center";
                ctx.textBaseline = value >= 0 ? "bottom" : "top";
                const y = value >= 0 ? props.y - offset : props.y + offset;
                drawLabel(label, props.x, y);
              }
            });
          });
          ctx.restore();
        },
      };
      this._pluginEtiquetasGrafica = plugin;
      return plugin;
    },

    _prepararChartCaptura(chart, config = {}) {
      if (!chart) return null;
      if (typeof chart.resize === "function") {
        try {
          if (config.targetWidth || config.targetHeight) {
            chart.resize(
              Number(config.targetWidth) || undefined,
              Number(config.targetHeight) || undefined
            );
          } else {
            chart.resize();
          }
        } catch (error) {
          console.warn("📊 _prepararChartCaptura: resize falló.", error);
        }
      }
      try {
        chart.update("none");
      } catch (error) {
        console.warn("📊 _prepararChartCaptura: update falló.", error);
      }
      return () => {
        if (typeof chart.resize === "function") {
          try {
            chart.resize();
          } catch (error) {
            console.warn("📊 _prepararChartCaptura: resize restore falló.", error);
          }
        }
        try {
          chart.update("none");
        } catch (error) {
          console.warn("📊 _prepararChartCaptura: update restore falló.", error);
        }
      };
    },

    _cargarImagenDesdeDataUrl(dataUrl) {
      return new Promise((resolve, reject) => {
        if (!dataUrl) {
          reject(new Error("DataURL vacío"));
          return;
        }
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("No se pudo cargar la imagen de la gráfica"));
        img.src = dataUrl;
      });
    },

    async _agregarEtiquetasEnCaptura(chart, dataUrl) {
      if (!chart || !dataUrl) return dataUrl;
      try {
        const imagen = await this._cargarImagenDesdeDataUrl(dataUrl);
        const renderCanvas = document.createElement("canvas");
        const width = Number(imagen.naturalWidth) || Number(imagen.width) || Number(chart.canvas?.width) || 0;
        const height = Number(imagen.naturalHeight) || Number(imagen.height) || Number(chart.canvas?.height) || 0;
        if (!width || !height) return dataUrl;
        renderCanvas.width = width;
        renderCanvas.height = height;
        const ctx = renderCanvas.getContext("2d");
        if (!ctx) return dataUrl;

        ctx.drawImage(imagen, 0, 0, width, height);
        const sourceWidth = Number(chart.canvas?.width) || Number(chart.width) || width;
        const sourceHeight = Number(chart.canvas?.height) || Number(chart.height) || height;
        const scaleX = sourceWidth > 0 ? width / sourceWidth : 1;
        const scaleY = sourceHeight > 0 ? height / sourceHeight : 1;
        const ratio = Math.max(1, Math.min(2.2, Math.max(scaleX, scaleY)));
        const fontSize = Math.max(14, Math.round(11 * ratio));

        ctx.save();
        ctx.font = `600 ${fontSize}px Segoe UI, Arial, sans-serif`;
        ctx.fillStyle = "#0f172a";
        ctx.strokeStyle = "rgba(255,255,255,0.96)";
        ctx.lineWidth = Math.max(2, Math.round(1.5 * ratio));
        ctx.lineJoin = "round";

        const indexAxis = chart.options?.indexAxis || "x";
        const isHorizontal = indexAxis === "y";
        const datasets = chart.data?.datasets || [];
        const margin = 6 * ratio;
        const offset = 8 * ratio;

        datasets.forEach((dataset, datasetIndex) => {
          const meta = chart.getDatasetMeta?.(datasetIndex);
          if (!meta || meta.hidden) return;
          const type = meta.type || dataset?.type;
          if (type !== "bar" && type !== "line") return;
          const values = Array.isArray(dataset?.data) ? dataset.data : [];

          meta.data.forEach((element, index) => {
            const value = Number(values[index]);
            if (!Number.isFinite(value) || Math.abs(value) < 0.0001) return;
            const label = this._formatearNumeroGrafica(value);
            if (!label) return;
            const props = element?.getProps
              ? element.getProps(["x", "y"], true)
              : { x: element?.x, y: element?.y };
            if (!props) return;
            let x = (Number(props.x) || 0) * scaleX;
            let y = (Number(props.y) || 0) * scaleY;

            if (type === "line") {
              ctx.textAlign = "center";
              ctx.textBaseline = value >= 0 ? "bottom" : "top";
              y += value >= 0 ? -offset : offset;
            } else if (isHorizontal) {
              ctx.textBaseline = "middle";
              ctx.textAlign = value >= 0 ? "left" : "right";
              x += value >= 0 ? offset : -offset;
            } else {
              ctx.textAlign = "center";
              ctx.textBaseline = value >= 0 ? "bottom" : "top";
              y += value >= 0 ? -offset : offset;
            }

            const textWidth = ctx.measureText(label).width;
            if (ctx.textAlign === "left" && x + textWidth > width - margin) {
              x = Math.max(margin, width - margin - textWidth);
            } else if (ctx.textAlign === "right" && x - textWidth < margin) {
              x = Math.min(width - margin, margin + textWidth);
            } else {
              x = Math.max(margin, Math.min(width - margin, x));
            }
            y = Math.max(margin, Math.min(height - margin, y));

            ctx.strokeText(label, x, y);
            ctx.fillText(label, x, y);
          });
        });

        ctx.restore();
        return renderCanvas.toDataURL("image/png");
      } catch (error) {
        console.warn("📊 _agregarEtiquetasEnCaptura: no se pudo dibujar etiquetas.", error);
        return dataUrl;
      }
    },

    async _capturarGraficas(targets = []) {
      const images = [];
      if (!targets.length) {
        this._debugLog("📊 _capturarGraficas: No hay targets para capturar");
        return images;
      }
      this._debugLog("📊 _capturarGraficas: Procesando", targets.length, "targets");
      for (const target of targets) {
        const canvas = target?.canvas;
        if (!canvas || typeof canvas.toDataURL !== "function") {
          this._debugLog("📊 _capturarGraficas: Canvas inválido para:", target?.title);
          continue;
        }
        let restore = null;
        let restoreChart = null;
        try {
          // Revelar canvas ANTES de verificar dimensiones o chart
          restore = this._prepararCanvasCaptura(canvas);
          // Esperar a que el DOM se actualice después de revelar
          await new Promise((resolve) => setTimeout(resolve, 50));

          const chart =
            typeof window.Chart?.getChart === "function"
              ? window.Chart.getChart(canvas)
              : null;
          if (chart && !this._chartTieneDatosExportables(chart)) {
            this._debugLog(
              "📊 _capturarGraficas: Saltando gráfica sin datos:",
              canvas.id || target?.title || "?"
            );
            if (typeof restore === "function") {
              restore();
              restore = null;
            }
            continue;
          }

          this._debugLog("📊 _capturarGraficas: Canvas", canvas.id || "?",
            "- chart:", !!chart,
            "- dims:", canvas.width, "x", canvas.height,
            "- client:", canvas.clientWidth, "x", canvas.clientHeight);

          // Verificar dimensiones DESPUÉS de revelar el canvas
          if (
            !chart &&
            (canvas.width || 0) <= 2 &&
            (canvas.height || 0) <= 2 &&
            (canvas.clientWidth || 0) <= 2 &&
            (canvas.clientHeight || 0) <= 2
          ) {
            this._debugLog("📊 _capturarGraficas: Saltando canvas sin chart ni dimensiones:", canvas.id);
            if (typeof restore === "function") restore();
            continue;
          }
          if (chart && typeof chart.resize === "function") {
            chart.resize();
          }
          const captureConfig = this._resolverConfigCapturaGrafica(canvas);
          restoreChart = this._prepararChartCaptura(chart, captureConfig);
          await new Promise((resolve) => setTimeout(resolve, 120));
          let hasCanvasContent = this._canvasTieneContenido(canvas);
          if (!chart && !hasCanvasContent) {
            this._debugLog(
              "📊 _capturarGraficas: Saltando canvas sin chart y sin contenido:",
              canvas.id || target?.title || "?"
            );
            continue;
          }
          let dataUrl =
            chart && typeof chart.toBase64Image === "function"
              ? chart.toBase64Image()
              : canvas.toDataURL("image/png");

          if ((!this._esDataUrlImagenValida(dataUrl) || !hasCanvasContent) && chart) {
            const baseWidth =
              Math.max(
                Number(canvas.clientWidth) || 0,
                Number(canvas.width) || 0,
                1200
              ) || 1200;
            const ratio =
              Number(canvas.width) > 0 && Number(canvas.height) > 0
                ? Number(canvas.height) / Number(canvas.width)
                : 0.55;
            const baseHeight = Math.max(360, Math.round(baseWidth * ratio));
            if (typeof chart.resize === "function") {
              chart.resize(baseWidth, baseHeight);
            }
            chart.update("none");
            await new Promise((resolve) => setTimeout(resolve, 120));
            hasCanvasContent = this._canvasTieneContenido(canvas);
            dataUrl =
              typeof chart.toBase64Image === "function"
                ? chart.toBase64Image()
                : canvas.toDataURL("image/png");
          }

          if (chart && captureConfig.withLabels && this._esDataUrlImagenValida(dataUrl)) {
            dataUrl = await this._agregarEtiquetasEnCaptura(chart, dataUrl);
          }

          const dataUrlValida = this._esDataUrlImagenValida(dataUrl);
          if (!dataUrlValida || !hasCanvasContent) {
            this._debugLog("📊 _capturarGraficas: dataUrl inválido o canvas vacío para:", canvas.id,
              "- válido:", dataUrlValida,
              "- contenido:", hasCanvasContent,
              "- longitud:", dataUrl?.length);
            continue;
          }
          if (dataUrl) {
            const titulo = target?.title || this._resolverTituloGrafica(canvas, "Grafica");
            this._debugLog("📊 _capturarGraficas: ✅ Capturada:", titulo, "dataUrl length:", dataUrl.length);
            images.push({
              title: titulo,
              dataUrl,
              width:
                Number(canvas.width) ||
                Number(canvas.clientWidth) ||
                1200,
              height:
                Number(canvas.height) ||
                Number(canvas.clientHeight) ||
                600,
            });
          }
        } catch (error) {
          console.warn("📊 _capturarGraficas: Error capturando grafica:", error);
        } finally {
          if (typeof restoreChart === "function") {
            restoreChart();
          }
          if (typeof restore === "function") {
            restore();
          }
        }
      }
      return images;
    },

    _prepararCanvasCaptura(canvas) {
      if (!canvas || !canvas.isConnected || !window.getComputedStyle) {
        return () => { };
      }
      const mutados = [];
      const revelar = (node) => {
        if (!node || node.nodeType !== 1) return;
        const estilo = window.getComputedStyle(node);
        const ocultoPorDisplay = estilo.display === "none";
        const ocultoPorVisibilidad = estilo.visibility === "hidden";
        const esCollapseOculto =
          node.classList?.contains("collapse") && !node.classList?.contains("show");
        const esPanelChartsOculto =
          node.classList?.contains("charts-panel") &&
          !node.classList?.contains("open");
        // Detectar panel operativo oculto (usado en módulos departamentales)
        const esPanelOperativoOculto =
          (node.classList?.contains("operativo-panel") ||
            node.classList?.contains("operativo-sidebar")) &&
          !node.classList?.contains("open") &&
          !node.classList?.contains("show");
        // Detectar contenedor de chart-block oculto
        const esChartBlockOculto =
          node.classList?.contains("chart-block") &&
          (ocultoPorDisplay || ocultoPorVisibilidad);

        if (
          !ocultoPorDisplay &&
          !ocultoPorVisibilidad &&
          !esCollapseOculto &&
          !esPanelChartsOculto &&
          !esPanelOperativoOculto &&
          !esChartBlockOculto
        ) {
          return;
        }

        mutados.push({
          node,
          className: node.className,
          style: node.getAttribute("style"),
        });

        if (esCollapseOculto) {
          node.classList.add("show");
        }
        if (esPanelChartsOculto || esPanelOperativoOculto) {
          node.classList.add("open");
          node.classList.add("show");
        }

        node.style.display = "block";
        node.style.visibility = "hidden";
        node.style.position = "absolute";
        node.style.left = "-10000px";
        node.style.top = "0";
        node.style.height = "auto";
        node.style.maxHeight = "none";
        node.style.overflow = "visible";
        if (!node.style.width || node.style.width === "auto") {
          node.style.width = "1200px";
        }
      };

      let current = canvas;
      while (current && current.nodeType === 1 && current !== document.body) {
        revelar(current);
        current = current.parentElement;
      }

      return () => {
        for (let i = mutados.length - 1; i >= 0; i -= 1) {
          const { node, className, style } = mutados[i];
          if (!node) continue;
          node.className = className;
          if (style != null) {
            node.setAttribute("style", style);
          } else {
            node.removeAttribute("style");
          }
        }
      };
    },

    _construirHtmlGraficas(images = []) {
      if (!Array.isArray(images) || !images.length) return "";
      const items = images
        .map((img) => {
          const safeTitle = (img.title || "Grafica").trim();
          return `
            <div class="chart-print">
              <div class="chart-title">${safeTitle}</div>
              <img class="chart-image" src="${img.dataUrl}" alt="${safeTitle}">
            </div>
          `;
        })
        .join("");
      return `
        <div class="charts-print">
          <h2>Graficas</h2>
          ${items}
        </div>
      `;
    },
    /**
     * Obtener metadata del contexto actual
     */
    _obtenerMetadata() {
      // Buscar selectores de empresa, año, mes en el DOM
      const empresaSelect =
        document.getElementById("companyFilter") ||
        document.getElementById("empresaSelect") ||
        document.querySelector('[data-role="empresa-select"]');

      const anioSelect =
        document.getElementById("yearFilter") ||
        document.getElementById("selectAnio") ||
        document.getElementById("yearSelect");

      const mesSelect =
        document.getElementById("monthFilter") ||
        document.getElementById("selectMes") ||
        document.getElementById("monthSelect");

      const empresaTexto =
        empresaSelect?.selectedOptions?.[0]?.text ||
        window.Sesion?.obtenerEmpresaActiva?.()?.nombre ||
        "";

      const anio = anioSelect?.value || new Date().getFullYear();

      const meses = [
        "Enero",
        "Febrero",
        "Marzo",
        "Abril",
        "Mayo",
        "Junio",
        "Julio",
        "Agosto",
        "Septiembre",
        "Octubre",
        "Noviembre",
        "Diciembre",
      ];
      const mesIndex = parseInt(mesSelect?.value) - 1;
      const mesNombre =
        mesIndex >= 0 ? meses[mesIndex] : meses[new Date().getMonth()];

      return { empresaTexto, anio, mesNombre };
    },

    /**
     * Estilos de impresión para PDF
     */
    _getEstilosImpresion() {
      return `
        @page { size: A4 landscape; margin: 8mm; }
        * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
        body { font-family: 'Manrope','Segoe UI',sans-serif; padding: 12px; color: #0f172a; font-size: 9px; line-height: 1.25; }

        /* Page break rules to prevent sections from being cut */
        tr { page-break-inside: avoid; }
        .section-header-row, .subsection-row, .sum-row, .highlight-primary, .highlight-secondary, .highlight-bright {
          page-break-before: auto;
          page-break-after: auto;
          page-break-inside: avoid;
        }
        h1 { margin: 0 0 6px 0; font-size: 18px; color: #1e3a8a; }
        h2 { margin: 0 0 8px 0; font-size: 14px; color: #1e3a8a; }
        .meta { margin: 0 0 12px 0; color: #334155; font-size: 10px; }
        table { width: 100%; border-collapse: collapse; font-size: 9px; table-layout: fixed; }
        th, td { border: 1px solid #cbd5e1; padding: 4px 5px; text-align: right; white-space: normal; word-break: break-word; overflow-wrap: anywhere; min-width: 0 !important; max-width: none !important; }
        th { background: #cbd5e1; color: #0f172a; font-weight: 700; }
        td.text-start, th.account-column-header, td.account-column { text-align: left; }

        /* Seccion principal */
        .section-header-row td { background: #1e3a8a !important; color: white !important; font-weight: 700; }

        /* Subseccion */
        .subsection-row td { background: #dbeafe !important; color: #1e3a8a !important; font-weight: 600; }

        /* Filas de cuenta */
        .account-row td { background: #ffffff; }

        /* Suma */
        .sum-row td { background: #fef3c7 !important; font-weight: 700; color: #78350f !important; }

        /* Consolidado */
        .highlight-primary td { background: #a7f3d0 !important; font-weight: 700; color: #065f46 !important; }

        /* Operating Results */
        .highlight-secondary td { background: #a5f3fc !important; font-weight: 700; color: #0e7490 !important; }

        /* Net Results */
        .highlight-bright td { background: #fecaca !important; font-weight: 800; color: #991b1b !important; }

        .charts-print { margin-top: 16px; page-break-before: always; }
        .chart-print { margin: 0 0 16px 0; page-break-inside: avoid; }
        .chart-title { font-size: 12px; font-weight: 700; margin: 0 0 6px 0; color: #1e3a8a; }
        .chart-image { width: 100%; height: auto; border: 1px solid #e2e8f0; border-radius: 6px; }

        @media print {
          body { padding: 8px; }
        }
      `;
    },

    /**
     * Mostrar toast de notificación
     */
    _showToast(message, type = "success") {
      const bgClass =
        type === "error"
          ? "text-bg-danger"
          : type === "warning"
            ? "text-bg-warning"
            : "text-bg-success";
      if (window.ToastManager?.show) {
        window.ToastManager.show(message, bgClass);
        return;
      }
      if (typeof showToast === "function") {
        showToast(message, bgClass);
        return;
      }
      // Fallback a console
      console.log(`[ExportUtils] ${message}`);
    },

    /**
     * Agregar botones de exportación a un contenedor
     * @param {string|HTMLElement} contenedor - Selector o elemento del contenedor
     * @param {Object} options - Opciones de configuración
     */
    agregarBotones(contenedor, options = {}) {
      const {
        tablaSelector = "table",
        nombreArchivo = "Reporte",
        titulo = "Reporte",
      } = options;

      const contenedorElement =
        typeof contenedor === "string"
          ? document.querySelector(contenedor)
          : contenedor;

      if (!contenedorElement) {
        console.warn("[ExportUtils] No se encontró el contenedor para botones");
        return;
      }

      // Crear botones
      const html = `
        <div class="export-buttons d-flex gap-2">
          <button type="button" class="btn btn-outline-success btn-sm" id="btnExportExcel">
            <i class="bi bi-file-earmark-excel"></i> Excel
          </button>
          <button type="button" class="btn btn-outline-danger btn-sm" id="btnExportPDF">
            <i class="bi bi-file-earmark-pdf"></i> PDF
          </button>
        </div>
      `;

      contenedorElement.insertAdjacentHTML("beforeend", html);

      // Agregar listeners
      const btnExcel = contenedorElement.querySelector("#btnExportExcel");
      const btnPDF = contenedorElement.querySelector("#btnExportPDF");

      if (btnExcel) {
        btnExcel.addEventListener("click", () => {
          this.exportarExcel({ tabla: tablaSelector, nombreArchivo });
        });
      }

      if (btnPDF) {
        btnPDF.addEventListener("click", () => {
          this.imprimirPDF({ tabla: tablaSelector, titulo });
        });
      }
    },
  };

  // Exponer globalmente
  window.ExportUtils = ExportUtils;
  ExportUtils._initBackgroundExports();
})();
