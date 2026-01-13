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

        const datos = this._obtenerDatosOperativo(tablaElement);
        if (!datos.length) {
          this._showToast(
            "Sin datos de resultado operativo. Exportando solo tabla.",
            "warning"
          );
          this.exportarExcel({ tabla, nombreArchivo, nombreHoja: nombreHojaTabla });
          return;
        }

        // Construir base con XLSX para preservar estilos
        const libro = XLSX.utils.book_new();
        const sheetTabla = this._tableToSheetWithStyles(tablaElement);
        XLSX.utils.book_append_sheet(libro, sheetTabla, nombreHojaTabla);

        const sheetOperativo = this._operativoToSheet(tablaElement, metadata);
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
          `No se pudo generar graficas${textoDetalle ? ": " + textoDetalle : ""}.`,
          "warning"
        );
        const generado = await this._exportarExcelOperativoImagenes({
          tabla,
          nombreArchivo,
          nombreHojaOperativo,
        });
        if (!generado) {
          this._exportarExcelOperativoLocal({
            tabla,
            nombreArchivo,
            nombreHojaTabla,
            nombreHojaOperativo,
            incluirTabla,
          });
        }
      }
    },

    async _exportarExcelOperativoImagenes(options = {}) {
      if (typeof ExcelJS === "undefined" || typeof Chart === "undefined") {
        return false;
      }

      const { tabla, nombreArchivo = "Exportacion", nombreHojaOperativo = "OperativoData" } = options;
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
      if (!datos.length) return false;

      const labels = datos.map((item) => item.etiqueta);
      const presupuestos = datos.map((item) => item.presupuesto);
      const reales = datos.map((item) => item.real);
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

      if (!imagenBudget || !imagenReal) return false;

      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet(nombreHojaOperativo);

      const etiqueta = this._capitalizar(this._obtenerEtiquetaOperativo() || "Elemento");
      const periodo = [metadata.mesNombre, metadata.anio].filter(Boolean).join(" ").trim();

      ws.addRow(["RESULTADOS OPERATIVOS"]);
      ws.addRow(["Categoria", etiqueta]);
      ws.addRow(["Empresa", metadata.empresaTexto || ""]);
      ws.addRow(["Periodo", periodo]);
      ws.addRow(["Fecha exportacion", new Date().toISOString().slice(0, 10)]);
      ws.addRow([]);
      ws.addRow([etiqueta, "Ppto Acumulado", "Real Acumulado"]);
      datos.forEach((row) => {
        ws.addRow([row.etiqueta, row.presupuesto, row.real]);
      });

      ws.columns = [{ width: 42 }, { width: 18 }, { width: 18 }];

      const chartStart = ws.rowCount + 2;
      const imgBudgetId = workbook.addImage({
        base64: imagenBudget,
        extension: "png",
      });
      ws.addImage(imgBudgetId, {
        tl: { col: 0, row: chartStart },
        ext: { width: 820, height: 360 },
      });

      const imgRealId = workbook.addImage({
        base64: imagenReal,
        extension: "png",
      });
      ws.addImage(imgRealId, {
        tl: { col: 0, row: chartStart + 20 },
        ext: { width: 820, height: 360 },
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      this._descargarBlob(blob, `${baseName}_Operativo_Graficas.xlsx`);
      this._showToast("Excel con graficas generado (imagen).");
      return true;
    },

    _crearImagenGrafica({ labels, data, color, titulo }) {
      try {
        const canvas = document.createElement("canvas");
        const altura = Math.min(820, Math.max(360, labels.length * 28 + 180));
        canvas.width = 1400;
        canvas.height = altura;
        const ctx = canvas.getContext("2d");
        const chart = new Chart(ctx, {
          type: "bar",
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
            plugins: { legend: { display: false } },
            scales: {
              x: { ticks: { font: { size: 11 } } },
              y: { ticks: { font: { size: 12 } } },
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

    _operativoToSheet(tabla, metadata = {}) {
      const labelRaw = this._obtenerEtiquetaOperativo();
      const label = this._capitalizar(labelRaw || "Elemento");
      const datos = this._obtenerDatosOperativo(tabla);
      const fecha = new Date();
      const fechaTexto = fecha.toISOString().slice(0, 10);
      const periodo = [metadata.mesNombre, metadata.anio]
        .filter(Boolean)
        .join(" ")
        .trim();

      const header = [label || "Elemento", "Ppto Acumulado", "Real Acumulado"];
      const filas = datos.map((item) => [
        item.etiqueta,
        item.presupuesto,
        item.real,
      ]);

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

      const sheet = XLSX.utils.aoa_to_sheet(aoa);
      sheet["!cols"] = [{ wch: 42 }, { wch: 18 }, { wch: 18 }];
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

    _obtenerDatosOperativo(tabla) {
      const indices = this._obtenerIndicesOperativo(tabla);
      if (indices.budget == null || indices.real == null) return [];
      const filas = Array.from(
        tabla.querySelectorAll("tbody tr.sum-row-operativo")
      );
      return filas
        .map((fila) => {
          const etiqueta = this._limpiarEtiquetaOperativo(
            fila.cells?.[1]?.textContent || ""
          );
          const presupuesto = this._parseNumeroTexto(
            fila.cells?.[indices.budget]?.textContent || ""
          );
          const real = this._parseNumeroTexto(
            fila.cells?.[indices.real]?.textContent || ""
          );
          return { etiqueta, presupuesto, real };
        })
        .filter((item) => item.etiqueta);
    },

    _obtenerIndicesOperativo(tabla) {
      const headerRow = tabla?.querySelector("thead tr");
      const headers = headerRow ? Array.from(headerRow.children) : [];
      const buscar = (clase) =>
        headers.findIndex((th) => th.classList.contains(clase));
      const idxTotalBudget = buscar("total-budget-column");
      const idxTotalReal = buscar("total-real-column");
      const idxBudgetFallback = buscar("budget-annual-column");
      return {
        budget: idxTotalBudget >= 0 ? idxTotalBudget : idxBudgetFallback,
        real: idxTotalReal >= 0 ? idxTotalReal : null,
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
    imprimirPDF(options = {}) {
      const { tabla, titulo = "Reporte", subtitulo = "" } = options;

      try {
        // Obtener elemento tabla
        const tablaElement =
          typeof tabla === "string"
            ? document.querySelector(tabla)
            : tabla || document.querySelector("table");

        if (!tablaElement) {
          this._showToast("No hay tabla para imprimir", "warning");
          return;
        }

        const metadata = this._obtenerMetadata();
        const tablaClon = tablaElement.cloneNode(true);

        // Abrir ventana de impresión
        const ventana = window.open("", "_blank", "width=1200,height=900");
        if (!ventana) {
          alert("Activa las ventanas emergentes para imprimir.");
          return;
        }

        const estilosImpresion = this._getEstilosImpresion();

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
        * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
        body { font-family: 'Manrope','Segoe UI',sans-serif; padding: 15px; color: #0f172a; font-size: 10px; line-height: 1.3; }
        
        /* Page break rules to prevent sections from being cut */
        tr { page-break-inside: avoid; }
        .section-header-row, .subsection-row, .sum-row, .highlight-primary, .highlight-secondary, .highlight-bright {
          page-break-before: auto;
          page-break-after: auto;
          page-break-inside: avoid;
        }
        h1 { margin: 0 0 6px 0; font-size: 20px; color: #1e3a8a; }
        .meta { margin: 0 0 14px 0; color: #334155; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; table-layout: auto; }
        th, td { border: 1px solid #cbd5e1; padding: 6px 7px; text-align: right; white-space: normal; word-break: break-word; }
        th { background: #cbd5e1; color: #0f172a; font-weight: 700; }
        td.text-start, th.account-column-header, td.account-column { text-align: left; }
        
        /* Sección principal */
        .section-header-row td { background: #1e3a8a !important; color: white !important; font-weight: 700; }
        
        /* Subsección */
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
        
        @media print {
          body { padding: 10px; }
          table { font-size: 10px; }
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
