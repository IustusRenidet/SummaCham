/* =================================================================
   VALIDADOR Y EXPORTADOR DE GRAFICAS MEJORADO
   Garantiza que los datos sean correctos antes de exportar
   ================================================================= */

(() => {
  'use strict';

  const ChartValidator = {
    /**
     * Valida una gráfica individual
     */
    validateChart(canvas) {
      if (!canvas || typeof canvas.getContext !== 'function') {
        return {
          valid: false,
          reason: 'Canvas inválido',
          canvas: null
        };
      }

      const chart = Chart.getChart(canvas);
      
      if (!chart) {
        return {
          valid: false,
          reason: 'No se encontró instancia de Chart.js',
          canvas: canvas
        };
      }

      if (!chart.data || !chart.data.datasets || chart.data.datasets.length === 0) {
        return {
          valid: false,
          reason: 'Sin datasets configurados',
          canvas: canvas,
          chart: chart
        };
      }

      // Verificar que al menos un dataset tenga datos
      const hasValidData = chart.data.datasets.some(dataset => {
        if (!Array.isArray(dataset.data)) return false;
        return dataset.data.some(val => {
          return val !== null && val !== undefined && !isNaN(val) && val !== 0;
        });
      });

      if (!hasValidData) {
        return {
          valid: false,
          reason: 'Todos los datasets están vacíos o en cero',
          canvas: canvas,
          chart: chart
        };
      }

      // Verificar labels
      if (!chart.data.labels || chart.data.labels.length === 0) {
        return {
          valid: false,
          reason: 'Sin etiquetas (labels) configuradas',
          canvas: canvas,
          chart: chart
        };
      }

      // Verificar dimensiones del canvas
      const width = canvas.width || canvas.clientWidth || 0;
      const height = canvas.height || canvas.clientHeight || 0;

      if (width < 10 || height < 10) {
        return {
          valid: false,
          reason: 'Dimensiones del canvas muy pequeñas',
          canvas: canvas,
          chart: chart
        };
      }

      return {
        valid: true,
        reason: 'Gráfica válida',
        canvas: canvas,
        chart: chart,
        dataPoints: chart.data.datasets.reduce((sum, ds) => sum + (ds.data?.filter(v => v).length || 0), 0),
        datasetsCount: chart.data.datasets.length,
        labelsCount: chart.data.labels.length
      };
    },

    /**
     * Valida todas las gráficas en la página
     */
    validateAll() {
      const canvases = document.querySelectorAll('canvas');
      const results = {
        total: canvases.length,
        valid: [],
        invalid: [],
        warnings: []
      };

      canvases.forEach(canvas => {
        const validation = this.validateChart(canvas);
        
        if (validation.valid) {
          results.valid.push(validation);
          
          // Warnings adicionales para gráficas válidas
          if (validation.dataPoints < 3) {
            results.warnings.push({
              canvas: canvas,
              message: 'Muy pocos puntos de datos (menos de 3)'
            });
          }
        } else {
          results.invalid.push(validation);
        }
      });

      return results;
    },

    /**
     * Muestra reporte de validación en consola
     */
    reportValidation(results) {
      console.group('📊 Reporte de Validación de Gráficas');
      console.log(`Total de gráficas: ${results.total}`);
      console.log(`✅ Válidas: ${results.valid.length}`);
      console.log(`❌ Inválidas: ${results.invalid.length}`);
      console.log(`⚠️ Advertencias: ${results.warnings.length}`);

      if (results.valid.length > 0) {
        console.group('✅ Gráficas Válidas');
        results.valid.forEach((v, i) => {
          console.log(`  ${i + 1}. ${v.canvas.id || 'Sin ID'}: ${v.dataPoints} puntos, ${v.datasetsCount} series`);
        });
        console.groupEnd();
      }

      if (results.invalid.length > 0) {
        console.group('❌ Gráficas Inválidas');
        results.invalid.forEach((v, i) => {
          console.warn(`  ${i + 1}. ${v.canvas?.id || 'Sin ID'}: ${v.reason}`);
        });
        console.groupEnd();
      }

      if (results.warnings.length > 0) {
        console.group('⚠️ Advertencias');
        results.warnings.forEach((w, i) => {
          console.warn(`  ${i + 1}. ${w.canvas?.id || 'Sin ID'}: ${w.message}`);
        });
        console.groupEnd();
      }

      console.groupEnd();

      return results;
    },

    /**
     * Obtiene un reporte visual para el usuario
     */
    getUserReport(results) {
      const total = results.total;
      const valid = results.valid.length;
      const invalid = results.invalid.length;

      if (total === 0) {
        return {
          type: 'error',
          title: 'Sin Gráficas',
          message: 'No se encontraron gráficas en la página.',
          canExport: false
        };
      }

      if (valid === 0) {
        return {
          type: 'error',
          title: 'Gráficas Inválidas',
          message: `Todas las gráficas (${total}) tienen problemas y no se pueden exportar.`,
          details: results.invalid.map(v => `• ${v.canvas?.id || 'Sin ID'}: ${v.reason}`).join('\n'),
          canExport: false
        };
      }

      if (invalid > 0) {
        return {
          type: 'warning',
          title: 'Exportación Parcial',
          message: `Se exportarán ${valid} de ${total} gráficas. ${invalid} tienen problemas.`,
          details: results.invalid.map(v => `• ${v.canvas?.id || 'Sin ID'}: ${v.reason}`).join('\n'),
          canExport: true
        };
      }

      return {
        type: 'success',
        title: 'Listo para Exportar',
        message: `Todas las gráficas (${total}) están correctas y listas.`,
        canExport: true
      };
    }
  };

  const ChartExporter = {
    /**
     * Prepara las gráficas para exportación optimizada
     */
    async prepareForExport(canvases) {
      const prepared = [];

      for (const canvas of canvases) {
        try {
          const chart = Chart.getChart(canvas);
          
          if (!chart) continue;

          // Asegurar que la gráfica esté renderizada
          if (typeof chart.update === 'function') {
            chart.update('none'); // Update sin animación
          }

          if (typeof chart.resize === 'function') {
            chart.resize();
          }

          // Esperar un frame para asegurar render
          await new Promise(resolve => requestAnimationFrame(resolve));

          // Obtener datos
          const dataUrl = typeof chart.toBase64Image === 'function' 
            ? chart.toBase64Image()
            : canvas.toDataURL('image/png');

          // Validar que la imagen tenga contenido
          if (!dataUrl || dataUrl === 'data:,') {
            console.warn('Canvas vacío:', canvas.id);
            continue;
          }

          const title = this.resolveChartTitle(canvas);

          prepared.push({
            canvas: canvas,
            chart: chart,
            dataUrl: dataUrl,
            title: title,
            width: canvas.width,
            height: canvas.height
          });

        } catch (error) {
          console.error('Error preparando canvas:', canvas.id, error);
        }
      }

      return prepared;
    },

    /**
     * Resuelve el título de una gráfica
     */
    resolveChartTitle(canvas) {
      if (!canvas) return 'Gráfica';

      // Buscar en contenedores cercanos
      const titleSelectors = [
        '.chart-title-group h5',
        '.chart-header h5',
        'h5',
        'h6',
        '[data-chart-title]'
      ];

      const container = canvas.closest('.chart-card-modern') || 
                       canvas.closest('.chart-card') ||
                       canvas.closest('.charts-card') ||
                       canvas.parentElement;

      if (container) {
        for (const selector of titleSelectors) {
          const titleEl = container.querySelector(selector);
          if (titleEl) {
            const text = titleEl.textContent.trim();
            // Remover emojis/iconos al inicio
            return text.replace(/^[\p{Emoji}\s]+/u, '').trim() || 'Gráfica';
          }
        }
      }

      // Fallback al ID del canvas
      return canvas.id ? canvas.id.replace(/([A-Z])/g, ' $1').trim() : 'Gráfica';
    },

    /**
     * Exporta a Excel con validación
     */
    async exportToExcel(options = {}) {
      const validation = ChartValidator.validateAll();
      ChartValidator.reportValidation(validation);

      const report = ChartValidator.getUserReport(validation);

      if (!report.canExport) {
        this.showAlert(report);
        return false;
      }

      if (report.type === 'warning') {
        const proceed = await this.confirmExport(report);
        if (!proceed) return false;
      }

      // Preparar solo gráficas válidas
      const validCanvases = validation.valid.map(v => v.canvas);
      const prepared = await this.prepareForExport(validCanvases);

      console.log(`📤 Exportando ${prepared.length} gráficas a Excel...`);

      // Llamar a la función original de exportación si existe
      if (window.exportarGraficasExcel && typeof window.exportarGraficasExcel === 'function') {
        // Pasar las gráficas preparadas
        return window.exportarGraficasExcel({
          ...options,
          charts: prepared
        });
      }

      console.warn('Función exportarGraficasExcel no disponible');
      return false;
    },

    /**
     * Exporta a PDF con validación
     */
    async exportToPDF(options = {}) {
      const validation = ChartValidator.validateAll();
      ChartValidator.reportValidation(validation);

      const report = ChartValidator.getUserReport(validation);

      if (!report.canExport) {
        this.showAlert(report);
        return false;
      }

      if (report.type === 'warning') {
        const proceed = await this.confirmExport(report);
        if (!proceed) return false;
      }

      const validCanvases = validation.valid.map(v => v.canvas);
      const prepared = await this.prepareForExport(validCanvases);

      console.log(`📤 Exportando ${prepared.length} gráficas a PDF...`);

      if (window.exportarGraficasPDF && typeof window.exportarGraficasPDF === 'function') {
        return window.exportarGraficasPDF({
          ...options,
          charts: prepared
        });
      }

      console.warn('Función exportarGraficasPDF no disponible');
      return false;
    },

    /**
     * Muestra alerta al usuario
     */
    showAlert(report) {
      const icons = {
        success: '✅',
        warning: '⚠️',
        error: '❌'
      };

      const message = `${icons[report.type]} ${report.title}\n\n${report.message}${report.details ? '\n\nDetalles:\n' + report.details : ''}`;
      alert(message);
    },

    /**
     * Pide confirmación para exportar con advertencias
     */
    async confirmExport(report) {
      const message = `${report.message}\n\n${report.details || ''}\n\n¿Deseas continuar con la exportación?`;
      return confirm(message);
    }
  };

  // Exponer globalmente
  window.ChartValidator = ChartValidator;
  window.ChartExporter = ChartExporter;

  // Sobrescribir funciones de exportación existentes
  const enhanceExportFunctions = () => {
    // Guardar referencias originales
    const originalExportExcel = window.exportarGraficasExcel;
    const originalExportPDF = window.exportarGraficasPDF;

    // Mejorar exportación a Excel
    if (originalExportExcel) {
      window.exportarGraficasExcel = function(...args) {
        return ChartExporter.exportToExcel.apply(ChartExporter, args);
      };
      // Mantener referencia a la función original
      window.exportarGraficasExcel._original = originalExportExcel;
    }

    // Mejorar exportación a PDF
    if (originalExportPDF) {
      window.exportarGraficasPDF = function(...args) {
        return ChartExporter.exportToPDF.apply(ChartExporter, args);
      };
      window.exportarGraficasPDF._original = originalExportPDF;
    }
  };

  // Esperar a que las funciones originales estén disponibles
  const waitForExportFunctions = (attempts = 0, maxAttempts = 50) => {
    if (attempts >= maxAttempts) {
      console.warn('No se encontraron funciones de exportación para mejorar');
      return;
    }

    if (window.exportarGraficasExcel || window.exportarGraficasPDF) {
      enhanceExportFunctions();
      console.log('✨ Funciones de exportación mejoradas con validación');
    } else {
      setTimeout(() => waitForExportFunctions(attempts + 1, maxAttempts), 100);
    }
  };

  // Iniciar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      waitForExportFunctions();
    });
  } else {
    waitForExportFunctions();
  }

  // Añadir comando de consola para validación manual
  window.validarGraficas = () => {
    const results = ChartValidator.validateAll();
    ChartValidator.reportValidation(results);
    const report = ChartValidator.getUserReport(results);
    console.log('\n' + report.message);
    return report;
  };

  console.log('📊 ChartValidator y ChartExporter cargados. Usa validarGraficas() en consola para validar manualmente.');

})();
