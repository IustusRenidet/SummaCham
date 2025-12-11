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
        
        // Buscar todas las celdas numéricas (excluyendo las de texto)
        const celdas = tabla.querySelectorAll('td:not(.text-start):not(.cuenta-col):not(.nombre-col):not([data-no-redondear])');
        
        celdas.forEach(celda => {
          const texto = celda.textContent.trim();
          // Ignorar celdas vacías, guiones o texto no numérico
          if (!texto || texto === '-' || texto === '' || texto === '0') return;
          
          // Intentar extraer el número (remover separadores y símbolos)
          const valorOriginal = parseFloat(celda.dataset.originalValue || texto.replace(/[^0-9.-]/g, ''));
          if (isNaN(valorOriginal)) return;
          
          // Guardar valor original si no existe
          if (!celda.dataset.originalValue) {
            celda.dataset.originalValue = valorOriginal;
          }
          
          let valorMostrar;
          if (redondear) {
            valorMostrar = Math.round(valorOriginal);
          } else {
            valorMostrar = valorOriginal;
          }
          
          // Formatear con separador de miles
          celda.textContent = new Intl.NumberFormat('en-US', {
            minimumFractionDigits: redondear ? 0 : 2,
            maximumFractionDigits: redondear ? 0 : 2
          }).format(valorMostrar);
        });
      };

      // Restaurar estado del toggle
      const savedRoundState = localStorage.getItem(storageKey);
      if (savedRoundState === 'true') {
        roundToggle.checked = true;
        // Aplicar redondeo cuando la tabla esté cargada
        setTimeout(() => aplicarRedondeo(true), 500);
      }
      
      // Event listener para el toggle
      roundToggle.addEventListener('change', function() {
        const redondear = this.checked;
        localStorage.setItem(storageKey, redondear);
        aplicarRedondeo(redondear);
      });

      console.log('✅ Toggle de redondeo inicializado para:', storageKey);
    }
  };

  // Exponer globalmente
  window.ToggleRedondeo = ToggleRedondeo;
})();
