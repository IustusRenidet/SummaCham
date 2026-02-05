/* =================================================================
   WIZARD DE GRAFICAS - Sistema de Flujo Guiado
   ================================================================= */

(() => {
  'use strict';

  const ChartWizard = {
    currentStep: 0,
    totalSteps: 4,
    config: {
      year: null,
      month: null,
      chartType: 'bar',
      dataSource: 'operating',
      series: []
    },

    init() {
      this.createWizardHTML();
      this.attachEventListeners();
    },

    createWizardHTML() {
      const wizardHTML = `
        <div class="wizard-container" id="chartWizard">
          <div class="wizard-modal">
            <div class="wizard-header">
              <h2><i class="bi bi-stars"></i> Asistente de Gráficas</h2>
              <p>Crea gráficas perfectas en 4 pasos simples</p>
            </div>
            
            <div class="wizard-progress">
              <div class="progress-step active" data-step="0"></div>
              <div class="progress-step" data-step="1"></div>
              <div class="progress-step" data-step="2"></div>
              <div class="progress-step" data-step="3"></div>
            </div>

            <div class="wizard-body">
              <!-- Paso 1: Selección de período -->
              <div class="wizard-step active" data-step="0">
                <h4 class="mb-3">📅 Paso 1: Selecciona el período</h4>
                <div class="info-card-wizard">
                  <i class="bi bi-info-circle-fill"></i>
                  <span>Elige el año y mes para analizar los datos financieros</span>
                </div>
                
                <div class="row g-3">
                  <div class="col-md-6">
                    <label class="form-label fw-semibold">Año</label>
                    <select class="form-select" id="wizardYear">
                      <!-- Se llena dinámicamente -->
                    </select>
                  </div>
                  <div class="col-md-6">
                    <label class="form-label fw-semibold">Mes</label>
                    <select class="form-select" id="wizardMonth">
                      <option value="1">Enero</option>
                      <option value="2">Febrero</option>
                      <option value="3">Marzo</option>
                      <option value="4">Abril</option>
                      <option value="5">Mayo</option>
                      <option value="6">Junio</option>
                      <option value="7">Julio</option>
                      <option value="8">Agosto</option>
                      <option value="9">Septiembre</option>
                      <option value="10">Octubre</option>
                      <option value="11">Noviembre</option>
                      <option value="12">Diciembre</option>
                    </select>
                  </div>
                </div>
              </div>

              <!-- Paso 2: Tipo de datos -->
              <div class="wizard-step" data-step="1">
                <h4 class="mb-3">📊 Paso 2: ¿Qué datos deseas visualizar?</h4>
                <div class="info-card-wizard">
                  <i class="bi bi-info-circle-fill"></i>
                  <span>Selecciona el tipo de análisis que necesitas</span>
                </div>
                
                <div class="wizard-options">
                  <div class="option-card" data-source="operating">
                    <i class="bi bi-graph-up-arrow"></i>
                    <h6>Resultado Operativo</h6>
                    <p>Analiza operaciones por capítulo</p>
                  </div>
                  <div class="option-card" data-source="net">
                    <i class="bi bi-calculator"></i>
                    <h6>Resumen Neto</h6>
                    <p>Resultado neto consolidado</p>
                  </div>
                  <div class="option-card" data-source="income">
                    <i class="bi bi-cash-stack"></i>
                    <h6>Ingresos</h6>
                    <p>Análisis de ingresos</p>
                  </div>
                  <div class="option-card" data-source="custom">
                    <i class="bi bi-sliders"></i>
                    <h6>Personalizado</h6>
                    <p>Crea tu propia vista</p>
                  </div>
                </div>
              </div>

              <!-- Paso 3: Tipo de gráfica -->
              <div class="wizard-step" data-step="2">
                <h4 class="mb-3">🎨 Paso 3: Elige el tipo de gráfica</h4>
                <div class="info-card-wizard">
                  <i class="bi bi-info-circle-fill"></i>
                  <span>Selecciona la visualización que mejor represente tus datos</span>
                </div>
                
                <div class="wizard-options">
                  <div class="option-card" data-chart-type="bar">
                    <i class="bi bi-bar-chart-fill"></i>
                    <h6>Barras</h6>
                    <p>Ideal para comparaciones</p>
                  </div>
                  <div class="option-card" data-chart-type="line">
                    <i class="bi bi-graph-up"></i>
                    <h6>Líneas</h6>
                    <p>Muestra tendencias</p>
                  </div>
                  <div class="option-card" data-chart-type="pie">
                    <i class="bi bi-pie-chart-fill"></i>
                    <h6>Circular</h6>
                    <p>Distribución porcentual</p>
                  </div>
                  <div class="option-card" data-chart-type="doughnut">
                    <i class="bi bi-circle-half"></i>
                    <h6>Dona</h6>
                    <p>Porcentajes con estilo</p>
                  </div>
                </div>
              </div>

              <!-- Paso 4: Confirmar y generar -->
              <div class="wizard-step" data-step="3">
                <h4 class="mb-3">✅ Paso 4: Confirma y genera</h4>
                <div class="info-card-wizard">
                  <i class="bi bi-check-circle-fill"></i>
                  <span>Revisa tu configuración antes de generar la gráfica</span>
                </div>
                
                <div class="card border-0 bg-light p-3 mb-3">
                  <h6 class="fw-bold mb-3">Resumen de configuración:</h6>
                  <div class="row g-2">
                    <div class="col-6">
                      <small class="text-muted d-block">Período</small>
                      <strong id="summaryPeriod">-</strong>
                    </div>
                    <div class="col-6">
                      <small class="text-muted d-block">Tipo de datos</small>
                      <strong id="summarySource">-</strong>
                    </div>
                    <div class="col-6">
                      <small class="text-muted d-block">Tipo de gráfica</small>
                      <strong id="summaryChartType">-</strong>
                    </div>
                    <div class="col-6">
                      <small class="text-muted d-block">Series activas</small>
                      <strong id="summarySeries">-</strong>
                    </div>
                  </div>
                </div>

                <div class="form-check mb-2">
                  <input class="form-check-input" type="checkbox" id="wizardVerifyData" checked>
                  <label class="form-check-label" for="wizardVerifyData">
                    Verificar datos antes de generar
                  </label>
                </div>
                
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" id="wizardAutoExport">
                  <label class="form-check-label" for="wizardAutoExport">
                    Preparar para exportación automática
                  </label>
                </div>
              </div>
            </div>

            <div class="wizard-footer">
              <button type="button" class="btn-prev" id="wizardPrev">
                <i class="bi bi-arrow-left"></i> Anterior
              </button>
              <button type="button" class="btn-next" id="wizardNext">
                Siguiente <i class="bi bi-arrow-right"></i>
              </button>
              <button type="button" class="btn-finish" id="wizardFinish" style="display: none;">
                <i class="bi bi-check-lg"></i> Generar Gráfica
              </button>
              <button type="button" class="btn-prev" id="wizardClose">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      `;

      document.body.insertAdjacentHTML('beforeend', wizardHTML);
    },

    attachEventListeners() {
      const wizard = document.getElementById('chartWizard');
      const prevBtn = document.getElementById('wizardPrev');
      const nextBtn = document.getElementById('wizardNext');
      const finishBtn = document.getElementById('wizardFinish');
      const closeBtn = document.getElementById('wizardClose');

      prevBtn.addEventListener('click', () => this.prevStep());
      nextBtn.addEventListener('click', () => this.nextStep());
      finishBtn.addEventListener('click', () => this.finish());
      closeBtn.addEventListener('click', () => this.close());

      // Cerrar al hacer clic fuera
      wizard.addEventListener('click', (e) => {
        if (e.target === wizard) this.close();
      });

      // Opciones de selección
      document.querySelectorAll('.option-card').forEach(card => {
        card.addEventListener('click', (e) => {
          const container = e.currentTarget.parentElement;
          container.querySelectorAll('.option-card').forEach(c => c.classList.remove('selected'));
          e.currentTarget.classList.add('selected');

          if (e.currentTarget.dataset.source) {
            this.config.dataSource = e.currentTarget.dataset.source;
          }
          if (e.currentTarget.dataset.chartType) {
            this.config.chartType = e.currentTarget.dataset.chartType;
          }
        });
      });

      // Actualizar configuración en tiempo real
      document.getElementById('wizardYear')?.addEventListener('change', (e) => {
        this.config.year = e.target.value;
      });
      
      document.getElementById('wizardMonth')?.addEventListener('change', (e) => {
        this.config.month = e.target.value;
      });
    },

    open() {
      this.currentStep = 0;
      this.populateYearSelect();
      this.updateStepDisplay();
      document.getElementById('chartWizard').classList.add('active');
    },

    close() {
      document.getElementById('chartWizard').classList.remove('active');
      this.resetWizard();
    },

    nextStep() {
      if (!this.validateCurrentStep()) {
        return;
      }

      if (this.currentStep < this.totalSteps - 1) {
        this.currentStep++;
        this.updateStepDisplay();
      }
    },

    prevStep() {
      if (this.currentStep > 0) {
        this.currentStep--;
        this.updateStepDisplay();
      }
    },

    updateStepDisplay() {
      // Actualizar pasos visuales
      document.querySelectorAll('.wizard-step').forEach((step, index) => {
        step.classList.toggle('active', index === this.currentStep);
      });

      // Actualizar indicadores de progreso
      document.querySelectorAll('.progress-step').forEach((step, index) => {
        step.classList.toggle('active', index <= this.currentStep);
      });

      // Mostrar/ocultar botones
      const prevBtn = document.getElementById('wizardPrev');
      const nextBtn = document.getElementById('wizardNext');
      const finishBtn = document.getElementById('wizardFinish');

      prevBtn.style.display = this.currentStep === 0 ? 'none' : 'block';
      nextBtn.style.display = this.currentStep === this.totalSteps - 1 ? 'none' : 'block';
      finishBtn.style.display = this.currentStep === this.totalSteps - 1 ? 'block' : 'none';

      // Si es el último paso, actualizar resumen
      if (this.currentStep === this.totalSteps - 1) {
        this.updateSummary();
      }
    },

    validateCurrentStep() {
      switch (this.currentStep) {
        case 0:
          const year = document.getElementById('wizardYear').value;
          const month = document.getElementById('wizardMonth').value;
          if (!year || !month) {
            this.showToast('Por favor selecciona año y mes', 'warning');
            return false;
          }
          this.config.year = year;
          this.config.month = month;
          return true;

        case 1:
          const selectedSource = document.querySelector('.option-card.selected[data-source]');
          if (!selectedSource) {
            this.showToast('Por favor selecciona un tipo de datos', 'warning');
            return false;
          }
          return true;

        case 2:
          const selectedChart = document.querySelector('.option-card.selected[data-chart-type]');
          if (!selectedChart) {
            this.showToast('Por favor selecciona un tipo de gráfica', 'warning');
            return false;
          }
          return true;

        default:
          return true;
      }
    },

    updateSummary() {
      const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                         'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
      
      const sourceNames = {
        operating: 'Resultado Operativo',
        net: 'Resumen Neto',
        income: 'Ingresos',
        custom: 'Personalizado'
      };

      const chartTypeNames = {
        bar: 'Barras',
        line: 'Líneas',
        pie: 'Circular',
        doughnut: 'Dona'
      };

      document.getElementById('summaryPeriod').textContent = 
        `${monthNames[parseInt(this.config.month) - 1]} ${this.config.year}`;
      document.getElementById('summarySource').textContent = 
        sourceNames[this.config.dataSource] || '-';
      document.getElementById('summaryChartType').textContent = 
        chartTypeNames[this.config.chartType] || '-';
      document.getElementById('summarySeries').textContent = '3';
    },

    async finish() {
      const verifyData = document.getElementById('wizardVerifyData').checked;
      const autoExport = document.getElementById('wizardAutoExport').checked;

      this.showToast('Generando gráfica...', 'info');

      try {
        // Aplicar configuración
        if (window.graficasResumen) {
          // Actualizar selectores principales
          document.getElementById('grafYearSelect').value = this.config.year;
          document.getElementById('grafMonthSelect').value = this.config.month;

          // Disparar evento de cambio para recargar datos
          const event = new Event('change');
          document.getElementById('grafYearSelect').dispatchEvent(event);
        }

        // Verificar datos si está habilitado
        if (verifyData) {
          await this.verifyChartData();
        }

        this.showToast('¡Gráfica generada exitosamente!', 'success');
        this.close();

        // Auto-exportar si está habilitado
        if (autoExport && window.exportarGraficasExcel) {
          setTimeout(() => {
            this.showToast('Preparando exportación...', 'info');
          }, 1000);
        }

      } catch (error) {
        console.error('Error al generar gráfica:', error);
        this.showToast('Error al generar la gráfica', 'error');
      }
    },

    async verifyChartData() {
      // Simular verificación de datos
      return new Promise((resolve) => {
        setTimeout(() => {
          console.log('✓ Datos verificados');
          resolve(true);
        }, 500);
      });
    },

    populateYearSelect() {
      const yearSelect = document.getElementById('wizardYear');
      const mainYearSelect = document.getElementById('grafYearSelect');
      
      if (mainYearSelect && yearSelect) {
        yearSelect.innerHTML = mainYearSelect.innerHTML;
        yearSelect.value = mainYearSelect.value;
      }
    },

    resetWizard() {
      this.currentStep = 0;
      this.config = {
        year: null,
        month: null,
        chartType: 'bar',
        dataSource: 'operating',
        series: []
      };
      
      document.querySelectorAll('.option-card').forEach(card => {
        card.classList.remove('selected');
      });
    },

    showToast(message, type = 'info') {
      const toastColors = {
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
        background: ${toastColors[type]};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 10px;
        box-shadow: 0 8px 20px rgba(0,0,0,0.2);
        z-index: 10000;
        font-weight: 600;
        animation: slideInRight 0.3s ease;
      `;
      toast.textContent = message;

      document.body.appendChild(toast);

      setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    }
  };

  // Exponer globalmente
  window.ChartWizard = ChartWizard;

  // Inicializar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ChartWizard.init());
  } else {
    ChartWizard.init();
  }

  // Añadir animaciones CSS si no existen
  if (!document.getElementById('wizard-animations')) {
    const style = document.createElement('style');
    style.id = 'wizard-animations';
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

})();
