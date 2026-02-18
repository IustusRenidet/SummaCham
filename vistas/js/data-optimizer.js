/* =================================================================
   OPTIMIZADOR DE VISUALIZACION DE DATOS
   Mejora la precisión y presentación de datos en gráficas
   ================================================================= */

(() => {
  'use strict';

  const DataOptimizer = {
    /**
     * Obtiene el valor numérico real que se está graficando (soporta barras horizontales).
     */
    getParsedValue(context) {
      if (!context) return 0;

      const parsed = context.parsed;
      if (typeof parsed === 'number' && Number.isFinite(parsed)) {
        return parsed;
      }

      if (parsed && typeof parsed === 'object') {
        const indexAxis = context?.chart?.options?.indexAxis || 'x';
        if (indexAxis === 'y') {
          const x = Number(parsed.x);
          if (Number.isFinite(x)) return x;
        }
        const y = Number(parsed.y);
        if (Number.isFinite(y)) return y;
        const x = Number(parsed.x);
        if (Number.isFinite(x)) return x;
      }

      const raw = context.raw;
      if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
      const coerced = Number(raw);
      return Number.isFinite(coerced) ? coerced : 0;
    },

    /**
     * Formatea números para mejor legibilidad
     */
    formatNumber(value, options = {}) {
      const {
        decimals = 0,
        compact = false,
        currency = false,
        prefix = '',
        suffix = ''
      } = options;

      if (value === null || value === undefined || isNaN(value)) {
        return '0';
      }

      const num = parseFloat(value);

      if (compact && Math.abs(num) >= 1000000) {
        return prefix + (num / 1000000).toFixed(1) + 'M' + suffix;
      }

      if (compact && Math.abs(num) >= 1000) {
        return prefix + (num / 1000).toFixed(1) + 'K' + suffix;
      }

      if (currency) {
        return prefix + new Intl.NumberFormat('es-MX', {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals
        }).format(num) + suffix;
      }

      return prefix + num.toLocaleString('es-MX', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      }) + suffix;
    },

    /**
     * Limpia y valida datos de gráfica
     */
    cleanChartData(data) {
      if (!data || !data.datasets) return data;

      const cleaned = { ...data };
      cleaned.datasets = data.datasets.map(dataset => {
        const cleanedDataset = { ...dataset };
        
        // Limpiar valores nulos/undefined
        if (Array.isArray(dataset.data)) {
          cleanedDataset.data = dataset.data.map(val => {
            if (val === null || val === undefined || isNaN(val)) {
              return 0;
            }
            return parseFloat(val);
          });
        }

        return cleanedDataset;
      });

      return cleaned;
    },

    /**
     * Genera colores optimizados para gráficas
     */
    generateColors(count, options = {}) {
      const { opacity = 1, palette = 'default' } = options;

      const palettes = {
        default: [
          '#667eea', '#764ba2', '#f093fb', '#4facfe',
          '#43e97b', '#fa709a', '#fee140', '#30cfd0'
        ],
        business: [
          '#0d47a1', '#1976d2', '#42a5f5', '#64b5f6',
          '#90caf9', '#bbdefb', '#e3f2fd', '#0277bd'
        ],
        vibrant: [
          '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A',
          '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'
        ],
        pastel: [
          '#FFB6C1', '#B0E0E6', '#DDA0DD', '#F0E68C',
          '#E0BBE4', '#FFDAB9', '#C7CEEA', '#B4F8C8'
        ]
      };

      const selectedPalette = palettes[palette] || palettes.default;
      const colors = [];

      for (let i = 0; i < count; i++) {
        const color = selectedPalette[i % selectedPalette.length];
        colors.push(this.hexToRgba(color, opacity));
      }

      return colors;
    },

    /**
     * Convierte HEX a RGBA
     */
    hexToRgba(hex, alpha = 1) {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);

      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    },

    /**
     * Optimiza opciones de gráfica para mejor legibilidad
     */
    getOptimizedChartOptions(chartType = 'bar', customOptions = {}) {
      const isHorizontalBar =
        chartType === 'bar' && (customOptions?.indexAxis || 'x') === 'y';
      const beginAtZero = chartType === 'bar';
      const numericTickFormatter = (value) =>
        DataOptimizer.formatNumber(value, {
          compact: true,
          decimals: 0,
        });

      const baseOptions = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: {
              padding: 15,
              usePointStyle: true,
              font: {
                size: 12,
                family: "'Inter', sans-serif",
                weight: '500'
              }
            }
          },
          tooltip: {
            enabled: true,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            titleColor: '#fff',
            bodyColor: '#fff',
            borderColor: '#667eea',
            borderWidth: 1,
            padding: 12,
            displayColors: true,
            callbacks: {
              label: function(context) {
                let label = context.dataset.label || '';
                if (label) {
                  label += ': ';
                }
                label += DataOptimizer.formatNumber(DataOptimizer.getParsedValue(context), {
                  decimals: 0,
                  compact: true,
                  currency: true
                });
                return label;
              }
            }
          }
        }
      };

      // Opciones específicas por tipo de gráfica
      if (chartType === 'bar' || chartType === 'line') {
        const buildLabelScale = () => ({
          grid: {
            display: false,
            drawBorder: false
          },
          ticks: {
            font: {
              size: 11,
              family: "'Inter', sans-serif"
            },
            maxRotation: 45,
            minRotation: 0
          }
        });

        const buildValueScale = () => ({
          beginAtZero,
          grace: '10%',
          grid: {
            color: 'rgba(0, 0, 0, 0.05)',
            drawBorder: false
          },
          ticks: {
            font: {
              size: 11,
              family: "'Inter', sans-serif"
            },
            callback: numericTickFormatter
          }
        });

        baseOptions.scales = {
          x: isHorizontalBar ? buildValueScale() : buildLabelScale(),
          y: isHorizontalBar ? buildLabelScale() : buildValueScale(),
        };
      }

      // Merge con opciones personalizadas
      return this.deepMerge(baseOptions, customOptions);
    },

    /**
     * Merge profundo de objetos
     */
    deepMerge(target, source) {
      const output = { ...target };
      
      if (this.isObject(target) && this.isObject(source)) {
        Object.keys(source).forEach(key => {
          if (this.isObject(source[key])) {
            if (!(key in target)) {
              output[key] = source[key];
            } else {
              output[key] = this.deepMerge(target[key], source[key]);
            }
          } else {
            output[key] = source[key];
          }
        });
      }
      
      return output;
    },

    /**
     * Verifica si es objeto
     */
    isObject(item) {
      return item && typeof item === 'object' && !Array.isArray(item);
    },

    /**
     * Calcula estadísticas de datos
     */
    calculateStats(data) {
      if (!Array.isArray(data) || data.length === 0) {
        return null;
      }

      const validData = data.filter(v => v !== null && v !== undefined && !isNaN(v));
      
      if (validData.length === 0) return null;

      const sum = validData.reduce((a, b) => a + b, 0);
      const avg = sum / validData.length;
      const max = Math.max(...validData);
      const min = Math.min(...validData);

      return {
        sum,
        avg,
        max,
        min,
        count: validData.length,
        hasNegatives: validData.some(v => v < 0),
        hasZeros: validData.some(v => v === 0)
      };
    },

    /**
     * Detecta y sugiere mejor tipo de gráfica
     */
    suggestChartType(data, currentType = 'bar') {
      if (!data || !data.datasets || data.datasets.length === 0) {
        return currentType;
      }

      const firstDataset = data.datasets[0];
      const stats = this.calculateStats(firstDataset.data);

      if (!stats) return currentType;

      // Si hay muchos puntos de datos, línea es mejor
      if (stats.count > 12) {
        return 'line';
      }

      // Si los datos son porcentajes y pocos, pie/doughnut
      if (stats.count <= 6 && stats.max <= 100 && stats.min >= 0) {
        return 'doughnut';
      }

      // Si hay múltiples series, barras agrupadas
      if (data.datasets.length > 2) {
        return 'bar';
      }

      return currentType;
    },

    /**
     * Redimensiona canvas para mejor calidad de exportación
     */
    prepareCanvasForExport(canvas, scale = 2) {
      if (!canvas) return null;

      const originalWidth = canvas.width;
      const originalHeight = canvas.height;

      // Crear canvas temporal con mayor resolución
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = originalWidth * scale;
      tempCanvas.height = originalHeight * scale;

      const ctx = tempCanvas.getContext('2d');
      ctx.scale(scale, scale);
      ctx.drawImage(canvas, 0, 0);

      return {
        canvas: tempCanvas,
        restore: () => {
          tempCanvas.remove();
        }
      };
    },

    /**
     * Valida coherencia de datos entre datasets
     */
    validateDataCoherence(data) {
      if (!data || !data.datasets || data.datasets.length < 2) {
        return { coherent: true, warnings: [] };
      }

      const warnings = [];
      const labelCount = data.labels?.length || 0;

      // Verificar que todos los datasets tengan la misma cantidad de datos
      data.datasets.forEach((dataset, index) => {
        const dataLength = dataset.data?.length || 0;
        
        if (dataLength !== labelCount) {
          warnings.push(`Dataset ${index} (${dataset.label}) tiene ${dataLength} datos pero hay ${labelCount} etiquetas`);
        }
      });

      // Verificar valores extremos entre datasets
      const allValues = data.datasets.flatMap(ds => ds.data || []).filter(v => v !== null && !isNaN(v));
      const stats = this.calculateStats(allValues);

      if (stats && stats.max > 0 && stats.min > 0) {
        const ratio = stats.max / stats.min;
        if (ratio > 1000) {
          warnings.push(`Diferencia extrema entre valores (ratio ${ratio.toFixed(0)}:1). Considera usar escala logarítmica.`);
        }
      }

      return {
        coherent: warnings.length === 0,
        warnings
      };
    }
  };

  // Exponer globalmente
  window.DataOptimizer = DataOptimizer;

  // Extender Chart.js con helpers
  if (typeof Chart !== 'undefined') {
    // Plugin para auto-optimizar opciones
    const autoOptimizePlugin = {
      id: 'autoOptimize',
      afterInit: (chart) => {
        if (chart.config.options._optimized) return;

        const optimized = DataOptimizer.getOptimizedChartOptions(
          chart.config.type,
          chart.config.options
        );

        Object.assign(chart.config.options, optimized);
        chart.config.options._optimized = true;
      }
    };

    // Registrar plugin si no está registrado
    if (!Chart.registry.plugins.get('autoOptimize')) {
      Chart.register(autoOptimizePlugin);
    }
  }

  console.log('📈 DataOptimizer cargado. Mejora automática de gráficas activada.');

})();
