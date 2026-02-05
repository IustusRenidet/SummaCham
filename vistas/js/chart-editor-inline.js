/* =================================================================
   EDITOR INLINE DE GRAFICAS - Super Simple
   ================================================================= */

(() => {
  'use strict';

  const ChartEditor = {
    currentChart: null,
    currentCanvas: null,
    
    open(canvasId) {
      const canvas = document.getElementById(canvasId);
      if (!canvas) return;
      
      const chart = Chart.getChart(canvas);
      if (!chart) return;
      
      this.currentCanvas = canvas;
      this.currentChart = chart;
      
      // Crear panel de edición inline
      const container = canvas.closest('.chart-card-modern') || 
                       canvas.closest('.chart-card') ||
                       canvas.parentElement;
      
      if (!container) return;
      
      // Remover editor anterior si existe
      const oldEditor = container.querySelector('.chart-editor-inline');
      if (oldEditor) oldEditor.remove();
      
      // Crear panel
      const panel = this.createEditorPanel(chart, canvasId);
      canvas.parentElement.insertBefore(panel, canvas);
      
      // Animar entrada
      requestAnimationFrame(() => {
        panel.style.opacity = '1';
        panel.style.transform = 'translateY(0)';
      });
    },
    
    createEditorPanel(chart, canvasId) {
      const panel = document.createElement('div');
      panel.className = 'chart-editor-inline';
      panel.style.cssText = `
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 12px;
        padding: 1.5rem;
        margin-bottom: 1rem;
        opacity: 0;
        transform: translateY(-10px);
        transition: all 0.3s ease;
        color: white;
      `;
      
      // Obtener datos actuales
      const title = this.getCurrentTitle(canvasId);
      const datasets = chart.data.datasets || [];
      const labels = chart.data.labels || [];
      
      panel.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h6 style="margin: 0; font-weight: 700; color: white;">
            ✏️ Editor Rápido
          </h6>
          <div style="display: flex; gap: 0.5rem;">
            <button class="btn-editor-apply" style="background: white; color: #667eea; border: none; padding: 0.5rem 1rem; border-radius: 8px; font-weight: 600; cursor: pointer;">
              ✓ Aplicar
            </button>
            <button class="btn-editor-close" style="background: rgba(255,255,255,0.2); color: white; border: none; padding: 0.5rem 1rem; border-radius: 8px; font-weight: 600; cursor: pointer;">
              × Cerrar
            </button>
          </div>
        </div>
        
        <!-- Título -->
        <div style="margin-bottom: 1rem;">
          <label style="display: block; font-size: 0.75rem; font-weight: 600; margin-bottom: 0.5rem; opacity: 0.9;">
            TÍTULO DE LA GRÁFICA
          </label>
          <input 
            type="text" 
            class="editor-title-input"
            value="${title}"
            style="width: 100%; padding: 0.75rem; border: 2px solid rgba(255,255,255,0.3); border-radius: 8px; background: rgba(255,255,255,0.95); font-size: 1rem; font-weight: 600;"
            placeholder="Título de la gráfica"
          />
        </div>
        
        <!-- Series/Datasets -->
        <div style="margin-bottom: 1rem;">
          <label style="display: block; font-size: 0.75rem; font-weight: 600; margin-bottom: 0.75rem; opacity: 0.9;">
            SERIES DE DATOS
          </label>
          <div class="editor-series-container">
            ${datasets.map((ds, idx) => `
              <div style="background: rgba(255,255,255,0.15); padding: 1rem; border-radius: 8px; margin-bottom: 0.75rem;">
                <div style="display: grid; grid-template-columns: 1fr auto; gap: 1rem; align-items: center;">
                  <div>
                    <input 
                      type="text" 
                      class="editor-series-label"
                      data-index="${idx}"
                      value="${ds.label || ''}"
                      style="width: 100%; padding: 0.5rem; border: 1px solid rgba(255,255,255,0.3); border-radius: 6px; background: rgba(255,255,255,0.95); font-weight: 500; margin-bottom: 0.5rem;"
                      placeholder="Nombre de la serie"
                    />
                    <div style="font-size: 0.75rem; opacity: 0.8;">
                      ${Array.isArray(ds.data) ? ds.data.length : 0} puntos de datos
                    </div>
                  </div>
                  <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <input 
                      type="color" 
                      class="editor-series-color"
                      data-index="${idx}"
                      value="${this.normalizeColor(ds.backgroundColor)}"
                      style="width: 50px; height: 50px; border: 3px solid rgba(255,255,255,0.5); border-radius: 8px; cursor: pointer;"
                    />
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
        
        <!-- Labels/Columnas -->
        <div>
          <label style="display: block; font-size: 0.75rem; font-weight: 600; margin-bottom: 0.75rem; opacity: 0.9;">
            ETIQUETAS (${labels.length})
          </label>
          <div style="background: rgba(255,255,255,0.15); padding: 1rem; border-radius: 8px;">
            <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
              ${labels.map((label, idx) => `
                <input 
                  type="text" 
                  class="editor-label-input"
                  data-index="${idx}"
                  value="${label}"
                  style="flex: 1 1 120px; padding: 0.5rem; border: 1px solid rgba(255,255,255,0.3); border-radius: 6px; background: rgba(255,255,255,0.95); font-size: 0.875rem;"
                />
              `).join('')}
            </div>
          </div>
        </div>
      `;
      
      // Eventos
      panel.querySelector('.btn-editor-apply').addEventListener('click', () => this.apply());
      panel.querySelector('.btn-editor-close').addEventListener('click', () => this.close());
      
      return panel;
    },
    
    getCurrentTitle(canvasId) {
      const canvas = document.getElementById(canvasId);
      if (!canvas) return '';
      
      const container = canvas.closest('.chart-card-modern') || 
                       canvas.closest('.chart-card');
      const titleEl = container?.querySelector('h5');
      
      if (titleEl) {
        // Remover emoji/icono si existe
        return titleEl.textContent.replace(/^[\p{Emoji}\s]+/u, '').trim();
      }
      
      return '';
    },
    
    normalizeColor(color) {
      if (!color) return '#667eea';
      if (typeof color === 'string' && color.startsWith('#')) return color;
      if (typeof color === 'string' && color.startsWith('rgb')) {
        // Convertir rgb a hex
        const match = color.match(/\d+/g);
        if (match && match.length >= 3) {
          const r = parseInt(match[0]).toString(16).padStart(2, '0');
          const g = parseInt(match[1]).toString(16).padStart(2, '0');
          const b = parseInt(match[2]).toString(16).padStart(2, '0');
          return `#${r}${g}${b}`;
        }
      }
      return '#667eea';
    },
    
    apply() {
      if (!this.currentChart) return;
      
      const panel = document.querySelector('.chart-editor-inline');
      if (!panel) return;
      
      // Actualizar título
      const titleInput = panel.querySelector('.editor-title-input');
      if (titleInput) {
        const container = this.currentCanvas.closest('.chart-card-modern') || 
                         this.currentCanvas.closest('.chart-card');
        const titleEl = container?.querySelector('h5');
        if (titleEl) {
          // Preservar icono si existe
          const icon = titleEl.querySelector('i');
          if (icon) {
            titleEl.innerHTML = '';
            titleEl.appendChild(icon.cloneNode(true));
            titleEl.appendChild(document.createTextNode(' ' + titleInput.value));
          } else {
            titleEl.textContent = titleInput.value;
          }
        }
      }
      
      // Actualizar series
      const labelInputs = panel.querySelectorAll('.editor-series-label');
      const colorInputs = panel.querySelectorAll('.editor-series-color');
      
      labelInputs.forEach(input => {
        const idx = parseInt(input.dataset.index);
        if (this.currentChart.data.datasets[idx]) {
          this.currentChart.data.datasets[idx].label = input.value;
        }
      });
      
      colorInputs.forEach(input => {
        const idx = parseInt(input.dataset.index);
        if (this.currentChart.data.datasets[idx]) {
          const color = input.value;
          this.currentChart.data.datasets[idx].backgroundColor = color;
          this.currentChart.data.datasets[idx].borderColor = color;
          if (this.currentChart.data.datasets[idx].pointBackgroundColor) {
            this.currentChart.data.datasets[idx].pointBackgroundColor = color;
          }
        }
      });
      
      // Actualizar labels
      const labelEditInputs = panel.querySelectorAll('.editor-label-input');
      labelEditInputs.forEach(input => {
        const idx = parseInt(input.dataset.index);
        if (this.currentChart.data.labels[idx] !== undefined) {
          this.currentChart.data.labels[idx] = input.value;
        }
      });
      
      // Actualizar gráfica
      this.currentChart.update('active');
      
      // Guardar en localStorage
      this.saveToStorage();
      
      // Mostrar confirmación
      this.showToast('✓ Cambios aplicados', 'success');
      
      // Cerrar editor
      setTimeout(() => this.close(), 500);
    },
    
    close() {
      const panel = document.querySelector('.chart-editor-inline');
      if (panel) {
        panel.style.opacity = '0';
        panel.style.transform = 'translateY(-10px)';
        setTimeout(() => panel.remove(), 300);
      }
      this.currentChart = null;
      this.currentCanvas = null;
    },
    
    saveToStorage() {
      if (!this.currentCanvas || !this.currentChart) return;
      
      try {
        const canvasId = this.currentCanvas.id;
        const config = {
          title: this.getCurrentTitle(canvasId),
          datasets: this.currentChart.data.datasets.map(ds => ({
            label: ds.label,
            backgroundColor: ds.backgroundColor,
            borderColor: ds.borderColor
          })),
          labels: this.currentChart.data.labels
        };
        
        localStorage.setItem(`chart_config_${canvasId}`, JSON.stringify(config));
      } catch (error) {
        console.warn('No se pudo guardar configuración:', error);
      }
    },
    
    loadFromStorage(canvasId) {
      try {
        const stored = localStorage.getItem(`chart_config_${canvasId}`);
        return stored ? JSON.parse(stored) : null;
      } catch (error) {
        return null;
      }
    },
    
    showToast(message, type = 'info') {
      const colors = {
        success: '#10b981',
        error: '#ef4444',
        warning: '#f59e0b',
        info: '#667eea'
      };
      
      const toast = document.createElement('div');
      toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${colors[type]};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 10px;
        box-shadow: 0 8px 20px rgba(0,0,0,0.2);
        z-index: 10001;
        font-weight: 600;
        animation: slideInRight 0.3s ease;
      `;
      toast.textContent = message;
      
      document.body.appendChild(toast);
      
      setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => toast.remove(), 300);
      }, 2500);
    }
  };
  
  // Agregar botones de edición a las gráficas
  const addEditButtons = () => {
    const charts = document.querySelectorAll('[id^="chart"]');
    
    charts.forEach(canvas => {
      if (canvas.dataset.editButtonAdded) return;
      
      const container = canvas.closest('.chart-card-modern') || 
                       canvas.closest('.chart-card');
      if (!container) return;
      
      const header = container.querySelector('.chart-header') ||
                    container.querySelector('.d-flex');
      if (!header) return;
      
      const editBtn = document.createElement('button');
      editBtn.innerHTML = '✏️';
      editBtn.title = 'Editar gráfica';
      editBtn.style.cssText = `
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        padding: 0.5rem 0.75rem;
        border-radius: 8px;
        cursor: pointer;
        font-size: 1rem;
        transition: all 0.2s ease;
        box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
      `;
      
      editBtn.addEventListener('mouseenter', () => {
        editBtn.style.transform = 'translateY(-2px)';
        editBtn.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
      });
      
      editBtn.addEventListener('mouseleave', () => {
        editBtn.style.transform = 'translateY(0)';
        editBtn.style.boxShadow = '0 2px 8px rgba(102, 126, 234, 0.3)';
      });
      
      editBtn.addEventListener('click', () => {
        ChartEditor.open(canvas.id);
      });
      
      // Agregar al header
      const metaDiv = header.querySelector('.chart-meta') ||
                     header.querySelector('.badge-modern')?.parentElement;
      
      if (metaDiv) {
        metaDiv.appendChild(editBtn);
      } else {
        header.appendChild(editBtn);
      }
      
      canvas.dataset.editButtonAdded = 'true';
    });
  };
  
  // Esperar a que se carguen las gráficas
  const waitForCharts = () => {
    const checkInterval = setInterval(() => {
      const charts = document.querySelectorAll('canvas[id^="chart"]');
      if (charts.length > 0) {
        clearInterval(checkInterval);
        setTimeout(() => addEditButtons(), 1000);
      }
    }, 500);
    
    // Timeout después de 10 segundos
    setTimeout(() => clearInterval(checkInterval), 10000);
  };
  
  // Inicializar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForCharts);
  } else {
    waitForCharts();
  }
  
  // Agregar CSS animations si no existen
  if (!document.getElementById('chart-editor-animations')) {
    const style = document.createElement('style');
    style.id = 'chart-editor-animations';
    style.textContent = `
      @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }
  
  // Exponer globalmente
  window.ChartEditor = ChartEditor;
  
  console.log('✏️ ChartEditor cargado - Click en ✏️ para editar cualquier gráfica');
  
})();
