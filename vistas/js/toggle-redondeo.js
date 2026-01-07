/**
 * Toggle de Redondeo para Tablas Numéricas
 * 
 * Este módulo proporciona funcionalidad para agregar un toggle
 * que permite redondear/no redondear los números en las tablas.
 * 
 * Uso:
 * 1. Incluir este script en el HTML: <script src="js/toggle-redondeo.js"></script>
 * 2. Llamar: ToggleRedondeo.inicializar({ containerSelector, tableSelector, storageKey })
 */

(() => {
  'use strict';

  const ToggleRedondeo = {
    /**
     * Inicializa el toggle de redondeo
     * @param {Object} config - Configuración
     * @param {string} config.containerSelector - Selector del contenedor donde agregar el toggle
     * @param {string} config.tableSelector - Selector de la tabla a redondear
     * @param {string} config.storageKey - Clave para localStorage (ej: 'finanzas_redondear')
     */
    inicializar(config = {}) {
      const {
        containerSelector = '.controls-container',
        tableSelector = 'table tbody',
        storageKey = 'modulo_redondear_numeros'
      } = config;

      const container = document.querySelector(containerSelector);
      if (!container) {
        console.warn('⚠️ No se encontró el contenedor para el toggle de redondeo:', containerSelector);
        return;
      }
      
      // Si ya se inicializó, no hacerlo de nuevo
      if (container.querySelector('.round-toggle-container')) {
        console.log('✓ Toggle de redondeo ya existe');
        return;
      }

      // Crear el HTML del toggle
      const toggleHTML = `
        <div class="round-toggle-container" style="margin-bottom: 0.75rem;">
          <label for="roundToggle" style="font-size: 0.875rem; font-weight: 600; margin: 0; cursor: pointer; user-select: none;">
            Redondear
          </label>
          <label class="toggle-switch" style="position: relative; display: inline-block; width: 44px; height: 24px; margin-left: 0.75rem;">
            <input type="checkbox" id="roundToggle" style="opacity: 0; width: 0; height: 0;">
            <span class="toggle-slider" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #d9d9d9; transition: 0.3s; border-radius: 24px;"></span>
          </label>
        </div>
      `;

      // Insertar el toggle al principio del contenedor
      container.insertAdjacentHTML('afterbegin', toggleHTML);

      // Agregar estilos dinámicamente si no existen
      if (!document.getElementById('toggle-redondeo-styles')) {
        const styles = document.createElement('style');
        styles.id = 'toggle-redondeo-styles';
        styles.textContent = `
          .toggle-slider:before {
            position: absolute;
            content: "";
            height: 18px;
            width: 18px;
            left: 3px;
            bottom: 3px;
            background-color: white;
            transition: 0.3s;
            border-radius: 50%;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          }
          .toggle-switch input:checked + .toggle-slider {
            background-color: #2f5496;
          }
          .toggle-switch input:checked + .toggle-slider:before {
            transform: translateX(20px);
          }
          .toggle-switch input:focus + .toggle-slider {
            box-shadow: 0 0 0 3px rgba(47, 84, 150, 0.25);
          }
          .round-toggle-container {
            background: white;
            border-radius: 12px;
            padding: 0.875rem 1rem;
            box-shadow: 0 4px 12px rgba(47, 84, 150, 0.15);
            display: flex;
            align-items: center;
            border: 1px solid rgba(47, 84, 150, 0.1);
          }
          /* Evitar wrap en celdas con porcentaje */
          table td {
            white-space: nowrap;
          }
        `;
        document.head.appendChild(styles);
      }

      // Obtener referencias
      const roundToggle = document.getElementById('roundToggle');
      
      // Función para aplicar redondeo
      const aplicarRedondeo = (redondear) => {
        const tabla = document.querySelector(tableSelector);
        if (!tabla) {
          console.warn('⚠️ No se encontró la tabla:', tableSelector);
          return;
        }
        
        // Buscar todas las celdas numéricas (excluyendo las de texto y las primeras 2 columnas)
        const celdas = tabla.querySelectorAll('td:not(.text-start):not(.cuenta-col):not(.nombre-col):not([data-no-redondear]):not(:nth-child(1)):not(:nth-child(2))');
        
        celdas.forEach(celda => {
          const texto = celda.textContent.trim();
          // Ignorar celdas vacías, guiones o texto no numérico
          if (!texto || texto === '-' || texto === '') return;
          
          // Detectar si tiene símbolo de porcentaje (siempre buscar en el texto actual)
          const tienePorc = texto.includes('%');
          
          // Intentar extraer el número preservando el signo negativo
          let textoLimpio = texto.replace(/[^0-9.\-]/g, '').replace(/(?!^)-/g, '');
          const valorOriginal = parseFloat(celda.dataset.originalValue || textoLimpio);
          
          if (isNaN(valorOriginal)) return;
          
          // Guardar valor original en el primer renderizado
          if (!celda.dataset.originalValue) {
            celda.dataset.originalValue = valorOriginal;
          }
          
          // Siempre detectar el porcentaje del texto actual
          if (tienePorc) {
            celda.dataset.tienePorc = 'true';
          }
          
          let valorMostrar;
          if (redondear) {
            valorMostrar = Math.round(valorOriginal);
          } else {
            valorMostrar = valorOriginal;
          }
          
          // Formatear con separador de miles
          let textoFormateado = new Intl.NumberFormat('en-US', {
            minimumFractionDigits: redondear ? 0 : 2,
            maximumFractionDigits: redondear ? 0 : 2
          }).format(valorMostrar);
          
          // Restaurar el símbolo de porcentaje si lo tenía
          if (celda.dataset.tienePorc === 'true') {
            textoFormateado += ' %';
          }
          
          celda.textContent = textoFormateado;
        });
      };

      // Estado inicial: siempre desactivado (false) por defecto
      // Solo activar si el usuario lo cambió manualmente y está guardado como 'true'
      const savedRoundState = localStorage.getItem(storageKey);
      // NOTA: Por defecto el toggle está desactivado, no se aplica redondeo automáticamente
      roundToggle.checked = savedRoundState === 'true' ? true : false;
      
      // Event listener para el toggle
      roundToggle.addEventListener('change', function() {
        const redondear = this.checked;
        localStorage.setItem(storageKey, redondear);
        aplicarRedondeo(redondear);
      });
      
      // DESACTIVADO: No aplicar redondeo automáticamente al cargar
      // El usuario debe activarlo manualmente si lo desea
      // if (savedRoundState === 'true') {
      //   setTimeout(() => aplicarRedondeo(true), 0);
      // }

      console.log('✅ Toggle de redondeo inicializado para:', storageKey);
    }
  };

  // Exponer globalmente
  window.ToggleRedondeo = ToggleRedondeo;
})();
