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

  const ExportUtils = {
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

      try {
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
          const chartTargets = this._resolverGraficas(options.charts);
          const hasChartContainers = Boolean(
            document.querySelector(
              "[data-operativo-chart], [data-gg-chart], [data-custom-chart], #resumenChartsPanel canvas"
            )
          );
          if (chartTargets.length > 0 || hasChartContainers) {
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
        const baseName = `${nombreArchivo}_${
          metadata.empresaTexto || "Reporte"
        }_${metadata.mesNombre || ""}_${metadata.anio || ""}`.replace(
          /\s+/g,
          "_"
        );

        // Usar método mejorado para construir la hoja con estilos
        const hoja = this._tableToSheetWithStyles(tablaElement);

        const libro = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(libro, hoja, nombreHoja);

        XLSX.writeFile(libro, `${baseName}.xlsx`);

        if (onSuccess) onSuccess();
        this._showToast("Exportado a Excel correctamente");
      } catch (error) {
        console.error("Error al exportar Excel:", error);
        if (onError) onError(error);
        this._showToast("Error al exportar: " + error.message, "error");
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

      try {
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

        const metadata = this._obtenerMetadata();
        baseName = `${nombreArchivo}_${
          metadata.empresaTexto || "Reporte"
        }_${metadata.mesNombre || ""}_${metadata.anio || ""}`.replace(
          /\s+/g,
          "_"
        );

        const chartBlocks = this._resolverBloquesGraficas(charts);
        const chartMeta = this._resolverMetaGraficaOperativa(charts, chartBlocks);
        const chartMode = this._resolverModoGraficasExcel();

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
        const libro = XLSX.utils.book_new();
        const sheetTabla = this._tableToSheetWithStyles(tablaElement);
        XLSX.utils.book_append_sheet(libro, sheetTabla, nombreHojaTabla);

        const sheetOperativo = this._operativoToSheet(
          tablaElement,
          metadata,
          chartMeta,
          chartBlocks
        );
        XLSX.utils.book_append_sheet(libro, sheetOperativo, nombreHojaOperativo);
        const sheetGraficas = XLSX.utils.aoa_to_sheet([["Gráficas"]]);
        XLSX.utils.book_append_sheet(libro, sheetGraficas, nombreHojaGraficas);

        baseBuffer = XLSX.write(libro, { bookType: "xlsx", type: "array" });
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

        this._showToast("Generando Excel con gráficas...");
        const response = await fetch(
          `${API_BASE}/reportes/operativo-excel-native?${params.toString()}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/octet-stream" },
            credentials: "include",
            body: binaryBody,
          }
        );

        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || "No fue posible generar el Excel con gráficas.");
        }

        const blob = await response.blob();
        const filename =
          this._obtenerNombreDescarga(response) ||
          `${baseName}_Graficas.xlsx`;
        this._descargarBlob(blob, filename);

        if (onSuccess) onSuccess();
        this._showToast("Excel con tabla y graficas generado.");
      } catch (error) {
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
        const baseName = `${nombreArchivo}_${
          metadata.empresaTexto || "Reporte"
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
          headers: { "Content-Type": "application/json" },
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
      const baseName = `${nombreArchivo}_${
        metadata.empresaTexto || "Reporte"
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
      console.log("📊 _construirGraficasFallbackOperativo: datos obtenidos:", datos.length);
      if (!datos.length) {
        console.log("📊 _construirGraficasFallbackOperativo: No hay datos para construir gráficas");
        return [];
      }
      const labels = datos.map((item) => item.etiqueta);
      const presupuestos = datos.map((item) => item.presupuesto);
      const reales = datos.map((item) => item.real);
      console.log("📊 _construirGraficasFallbackOperativo: labels:", labels);
      console.log("📊 _construirGraficasFallbackOperativo: presupuestos:", presupuestos);
      console.log("📊 _construirGraficasFallbackOperativo: reales:", reales);
      const height = Math.min(1200, Math.max(520, labels.length * 34 + 220));
      const images = [];

      const budgetDataUrl = this._crearImagenGrafica({
        labels,
        data: presupuestos,
        color: "#4472c4",
        titulo: "Ppto Acumulado",
      });
      console.log("📊 _construirGraficasFallbackOperativo: budgetDataUrl length:", budgetDataUrl?.length || 0);
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
      console.log("📊 _construirGraficasFallbackOperativo: realDataUrl length:", realDataUrl?.length || 0);
      if (realDataUrl && this._esDataUrlImagenValida(realDataUrl)) {
        images.push({
          title: "Real Acumulado",
          dataUrl: realDataUrl,
          width: 1400,
          height,
        });
      }

      console.log("📊 _construirGraficasFallbackOperativo: imágenes generadas:", images.length);
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
        const baseName = `${nombreArchivo}_${
          metadata.empresaTexto || "Reporte"
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

    /**
     * Construye una hoja de Excel desde la tabla DOM
     * Primero simplifica la estructura, luego aplica estilos
     * @param {HTMLElement} tabla - Elemento tabla
     */
    _tableToSheetWithStyles(tabla) {
      // PASO 1: Clonar la tabla y normalizar spans para conservar todas las columnas
      const tablaClone = tabla.cloneNode(true);
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

      // PASO 3: Obtener las filas DOM para mapear estilos
      const rows = Array.from(tabla.querySelectorAll("tr"));

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

      return sheet;
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
            const values = labels.map((_, labelIdx) =>
              this._toNumberSafe(rawData[labelIdx] ?? 0)
            );
            const hasNumeric = values.some((value) => Number.isFinite(value));
            if (!hasNumeric) return null;
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
        const text = (cells[idx]?.textContent || "").replace(/\s+/g, " ").trim();
        if (/[A-Za-z\u00c0-\u024f]/.test(text)) {
          return this._limpiarEtiquetaOperativo(text);
        }
      }
      return this._limpiarEtiquetaOperativo(
        (cells[1]?.textContent || cells[0]?.textContent || "")
          .replace(/\s+/g, " ")
          .trim()
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
          const presupuesto = this._parseNumeroTexto(
            fila.cells?.[indices.budget]?.textContent || ""
          );
          const real = this._parseNumeroTexto(
            fila.cells?.[indices.real]?.textContent || ""
          );
          const anual = this._parseNumeroTexto(
            fila.cells?.[annualIdx]?.textContent || ""
          );
          return { etiqueta, presupuesto, real, anual };
        })
        .filter((item) => item.etiqueta);

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
        for (const row of headerRows) {
          const headers = Array.from(row.children || []);
          for (let idx = 0; idx < headers.length; idx += 1) {
            const text = (headers[idx]?.textContent || "")
              .replace(/\s+/g, " ")
              .trim()
              .toLowerCase();
            if (!text) continue;
            if (matcher(text)) return idx;
          }
        }
        return -1;
      };

      headerRows.forEach((row) => {
        const headers = Array.from(row.children || []);
        headers.forEach((th, idx) => {
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

    _limpiarEtiquetaOperativo(texto) {
      const base = (texto || "").toString().trim();
      if (!base) return "";
      const lower = base.toLowerCase();
      const prefijo = "resultado operativo";
      if (lower.startsWith(prefijo)) {
        const recorte = base.slice(prefijo.length).trim();
        return recorte || base;
      }
      return base;
    },

    _parseNumeroTexto(texto) {
      let limpio = (texto || "").replace(/[^0-9+.,-]/g, "");
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
      return Number.isFinite(numero) ? numero : 0;
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
      if (!Number.isNaN(numero) && texto !== "") return numero;
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
      console.log("📊 PDF: chartTargets encontrados:", chartTargets.length);
      let chartImages = await this._capturarGraficas(chartTargets);
      console.log("📊 PDF: chartImages capturadas:", chartImages.length);
      if (!chartImages.length) {
        console.log("📊 PDF: Usando fallback operativo...");
        chartImages = this._construirGraficasFallbackOperativo(tablaElement);
        console.log("📊 PDF: chartImages de fallback:", chartImages.length);
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
      // Debug: Buscar todos los canvas para diagnóstico
      const allCanvas = document.querySelectorAll("canvas");
      const operativoCharts = document.querySelectorAll("[data-operativo-chart]");
      console.log("📊 _resolverGraficas: Total canvas en DOM:", allCanvas.length);
      console.log("📊 _resolverGraficas: Contenedores [data-operativo-chart]:", operativoCharts.length);
      operativoCharts.forEach((el, i) => {
        const canvas = el.querySelector("canvas") || (el.tagName === "CANVAS" ? el : null);
        console.log(`📊 _resolverGraficas: [${i}] tag=${el.tagName}, canvas=${!!canvas}, id=${canvas?.id || el.id || "?"}`);
      });
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
      document.querySelectorAll("canvas").forEach((canvas) => {
        const chart =
          typeof window.Chart?.getChart === "function"
            ? window.Chart.getChart(canvas)
            : null;
        if (!chart) return;
        pushCanvas(canvas, resolveTitle(canvas, ""), { allowHidden: true });
      });

      if (!targets.length && window.Chart?.instances) {
        Object.values(window.Chart.instances).forEach((chart) => {
          const canvas = chart?.canvas;
          if (!canvas) return;
          pushCanvas(canvas, resolveTitle(canvas, ""), { allowHidden: true });
        });
      }
      return targets;
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
        console.log("📊 _capturarGraficas: No hay targets para capturar");
        return images;
      }
      console.log("📊 _capturarGraficas: Procesando", targets.length, "targets");
      for (const target of targets) {
        const canvas = target?.canvas;
        if (!canvas || typeof canvas.toDataURL !== "function") {
          console.log("📊 _capturarGraficas: Canvas inválido para:", target?.title);
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

          console.log("📊 _capturarGraficas: Canvas", canvas.id || "?",
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
            console.log("📊 _capturarGraficas: Saltando canvas sin chart ni dimensiones:", canvas.id);
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
          const requiereContenido = Boolean(chart);
          if (!dataUrlValida || (requiereContenido && !hasCanvasContent)) {
            console.log("📊 _capturarGraficas: dataUrl inválido o canvas vacío para:", canvas.id,
              "- válido:", dataUrlValida,
              "- contenido:", hasCanvasContent,
              "- longitud:", dataUrl?.length);
            continue;
          }
          if (dataUrl) {
            const titulo = target?.title || this._resolverTituloGrafica(canvas, "Grafica");
            console.log("📊 _capturarGraficas: ✅ Capturada:", titulo, "dataUrl length:", dataUrl.length);
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
        return () => {};
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

  console.log("📦 Módulo ExportUtils cargado");
})();
