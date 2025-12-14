/**
 * insertion-wizard.js
 * Sistema inteligente de inserción con validación jerárquica
 * Soporta SUMMARY, RESUMEN y MÓDULOS con estructura jerárquica correcta
 */

(() => {
  'use strict';

  const InsertionWizard = {
    currentStep: 1,
    totalSteps: 3,
    moduleType: null, // 'SUMMARY', 'RESUMEN', 'MODULOS'
    selectedType: null, // 'cuenta', 'operacion', 'secundaria', 'principal'
    contextData: {},
    formData: {},

    /**
     * Detecta el tipo de módulo actual
     */
    detectModuleType() {
      const url = window.location.pathname;
      if (url.includes('SUMMARY')) return 'SUMMARY';
      if (url.includes('RESUMEN')) return 'RESUMEN';
      return 'MODULOS';
    },

    /**
     * Obtiene la configuración de validación según módulo
     */
    getValidationRules() {
      const rules = {
        SUMMARY: {
          cuenta: {
            required: ['numero', 'nombre'],
            hierarchy: ['operacion', 'secundaria', 'principal', 'capitulo'],
            format: /^\d{21}$/,
            formatLabel: '21 dígitos (ej: 401000000000000000001)'
          },
          operacion: {
            required: ['nombre', 'etiquetaSum'],
            hierarchy: ['secundaria', 'principal', 'capitulo'],
            autoCreate: ['sumRow']
          },
          secundaria: {
            required: ['nombre', 'etiquetaSum'],
            hierarchy: ['principal', 'capitulo'],
            autoCreate: ['sumRow']
          },
          principal: {
            required: ['nombre', 'etiquetaSum'],
            hierarchy: ['capitulo'],
            autoCreate: ['sumRow']
          }
        },
        RESUMEN: {
          cuenta: {
            required: ['numero', 'nombre'],
            hierarchy: ['operacion', 'secundaria', 'principal', 'capitulo'],
            format: /^\d{3}-\d{3}-\d{3}-\d{2}$/,
            formatLabel: 'XXX-XXX-XXX-XX (ej: 401-001-000-00)'
          },
          operacion: {
            required: ['nombre', 'etiquetaSum'],
            hierarchy: ['secundaria', 'principal', 'capitulo'],
            autoCreate: ['sumRow']
          },
          secundaria: {
            required: ['nombre', 'etiquetaSum'],
            hierarchy: ['principal', 'capitulo'],
            autoCreate: ['sumRow']
          },
          principal: {
            required: ['nombre', 'etiquetaSum'],
            hierarchy: ['capitulo'],
            autoCreate: ['sumRow']
          }
        },
        MODULOS: {
          cuenta: {
            required: ['numero', 'nombre'],
            // Cuenta puede ir directo a SECCIÓN o dentro de OPERACIÓN (opcional)
            hierarchy: ['seccion', 'capitulo'],
            hierarchyOptional: ['operacion'], // Si hay operación, va cuenta→operación→sección
            format: /^\d{3}-\d{3}-\d{3}-\d{2}$/,
            formatLabel: 'XXX-XXX-XXX-XX (ej: 401-001-000-00)'
          },
          operacion: {
            required: ['nombre', 'etiquetaSum'],
            hierarchy: ['seccion', 'capitulo'], // Operación SIEMPRE va dentro de SECCIÓN
            autoCreate: ['sumRow']
          },
          seccion: {
            required: ['nombre', 'etiquetaSum'],
            hierarchy: ['capitulo'], // Sección va directo al CAPÍTULO
            autoCreate: ['sumRow']
          }
        }
      };

      return rules[this.moduleType] || {};
    },

    /**
     * Abre el wizard
     */
    open(referenceRow = null) {
      this.moduleType = this.detectModuleType();
      this.contextData = this.extractContextFromRow(referenceRow);
      this.formData = {};

      // Forzar tipo cuenta por defecto y saltar directamente al paso de contexto.
      this.selectedType = 'cuenta';
      this.currentStep = 2;

      this.renderWizard();
      this.showModal();
    },

    /**
     * Extrae contexto de la fila donde se hizo click
     */
    extractContextFromRow(row) {
      if (!row) return {};

      const context = {
        capitulo: this.getCurrentCapitulo(),
        anio: this.getCurrentAnio(),
        rowElement: row
      };

      // Extraer jerarquía según tipo de fila
      if (row.classList.contains('account-row')) {
        context.cuenta = row.dataset.cuenta;
        context.secundaria = row.dataset.seccionSecundaria;
        context.principal = row.dataset.seccionPrincipal;
        context.operacion = row.dataset.operacion;
      } else if (row.classList.contains('subsection-row')) {
        context.secundaria = row.dataset.sectionName;
        context.principal = row.dataset.principalName;
      } else if (row.classList.contains('section-header-row')) {
        context.principal = row.dataset.sectionName;
      }

      return context;
    },

    /**
     * Obtiene el capítulo actual desde el selector global de empresa
     */
    getCurrentCapitulo() {
      // Usar SOLO el companyFilter global - ya no hay selectores locales de capítulo
      const companySelect = document.getElementById('companyFilter');
      
      if (!companySelect || !companySelect.value) {
        console.warn('⚠️ No se encontró selector global de empresa (companyFilter)');
        return '';
      }

      const empresaId = companySelect.value;
      
      // Usar CapitulosModulos para mapear empresaId -> capítulo
      if (window.CapitulosModulos && typeof window.CapitulosModulos.empresaACapitulo === 'function') {
        const capitulo = window.CapitulosModulos.empresaACapitulo(empresaId);
        console.log('✅ Capítulo desde companyFilter:', empresaId, '→', capitulo);
        return capitulo || '';
      }

      // Fallback: usar el texto del select
      const selectedText = companySelect.selectedOptions?.[0]?.text || empresaId;
      console.log('⚠️ Usando texto del select como capítulo:', selectedText);
      return selectedText;
    },

    /**
     * Obtiene el año actualmente seleccionado
     */
    getCurrentAnio() {
      // Buscar selector de año en diferentes IDs posibles
      const anioSelect = document.getElementById('yearFilter') ||
                        document.getElementById('anioSelect') ||
                        document.getElementById('selectAnio') ||
                        document.getElementById('resumenYearSelect');
      
      if (!anioSelect) {
        // Fallback: año actual
        const anioActual = new Date().getFullYear();
        console.warn('⚠️ No se encontró selector de año, usando:', anioActual);
        return anioActual;
      }

      const anio = parseInt(anioSelect.value);
      console.log('✅ Año detectado:', anio);
      return anio;
    },

    /**
     * Renderiza el wizard completo
     */
    renderWizard() {
      const html = `
        <div class="modal fade" id="insertionWizardModal" tabindex="-1" aria-hidden="true">
          <div class="modal-dialog modal-lg">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title">
                  <i class="bi bi-plus-square me-2"></i>
                  Agregar Elemento - Paso ${this.currentStep} de ${this.totalSteps}
                </h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
              </div>
              
              <div class="modal-body">
                <!-- Progress Bar -->
                <div class="progress mb-4" style="height: 4px;">
                  <div class="progress-bar" role="progressbar" 
                       style="width: ${(this.currentStep / this.totalSteps) * 100}%">
                  </div>
                </div>

                <!-- Steps Container -->
                <div id="wizardSteps">
                  ${this.renderCurrentStep()}
                </div>

                <!-- Contextual Help -->
                <div class="alert alert-info mt-3" id="contextualHelp">
                  <i class="bi bi-info-circle me-2"></i>
                  <span id="helpText">${this.getHelpText()}</span>
                </div>

                <!-- Insertion Preview -->
                <div class="insertion-preview d-none" id="insertionPreview">
                  <strong><i class="bi bi-arrow-right-circle me-2"></i>Se insertará:</strong>
                  <div id="previewContent" class="ms-4 mt-2"></div>
                </div>
              </div>

              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                  <i class="bi bi-x-circle me-1"></i>Cancelar
                </button>
                ${this.currentStep > 1 ? `
                  <button type="button" class="btn btn-outline-primary" onclick="InsertionWizard.previousStep()">
                    <i class="bi bi-arrow-left me-1"></i>Atrás
                  </button>
                ` : ''}
                ${this.currentStep < this.totalSteps ? `
                  <button type="button" class="btn btn-primary" onclick="InsertionWizard.nextStep()">
                    Siguiente <i class="bi bi-arrow-right ms-1"></i>
                  </button>
                ` : `
                  <button type="button" class="btn btn-success" onclick="InsertionWizard.submit()">
                    <i class="bi bi-check-circle me-1"></i>Crear Elemento
                  </button>
                `}
              </div>
            </div>
          </div>
        </div>
      `;

      // Remove existing modal if any
      const existing = document.getElementById('insertionWizardModal');
      if (existing) existing.remove();

      // Insert new modal
      document.body.insertAdjacentHTML('beforeend', html);
    },

    /**
     * Renderiza el paso actual
     */
    renderCurrentStep() {
      switch (this.currentStep) {
        case 1:
          return this.renderStep1_SelectType();
        case 2:
          return this.renderStep2_SelectContext();
        case 3:
          return this.renderStep3_EnterData();
        default:
          return '';
      }
    },

    /**
     * PASO 1: Seleccionar tipo de elemento
     */
    renderStep1_SelectType() {
      const options = this.getAvailableTypes();
      
      return `
        <div class="wizard-step active" data-step="1">
          <h6 class="mb-3">¿Qué deseas agregar?</h6>
          
          <div class="list-group">
            ${options.map(opt => `
              <label class="list-group-item list-group-item-action d-flex align-items-center">
                <input class="form-check-input me-3" type="radio" name="elementType" 
                       value="${opt.value}" ${this.selectedType === opt.value ? 'checked' : ''}
                       onchange="InsertionWizard.selectType('${opt.value}')">
                <div class="flex-grow-1">
                  <div class="fw-bold">${opt.icon} ${opt.label}</div>
                  <small class="text-muted">${opt.description}</small>
                </div>
              </label>
            `).join('')}
          </div>
        </div>
      `;
    },

    /**
     * PASO 2: Seleccionar contexto jerárquico
     */
    renderStep2_SelectContext() {
      const rules = this.getValidationRules()[this.selectedType];
      if (!rules) return '<p>Error: Tipo no válido</p>';

      const hierarchy = rules.hierarchy || [];
      const fixedCapitulo = this.contextData.capitulo || this.getCurrentCapitulo();
      this.contextData.capitulo = fixedCapitulo;
      const filteredHierarchy = hierarchy.filter(level => level !== 'capitulo');
      
      // Renderizar con placeholders, cargaremos opciones después
      const html = `
        <div class="wizard-step active" data-step="2">
          <h6 class="mb-3">Selecciona la ubicación</h6>

          <div class="mb-3">
            <label class="form-label">Capítulo activo</label>
            <div class="form-control bg-light" readonly>
              ${fixedCapitulo || 'Sin capítulo seleccionado'}
            </div>
            <small class="text-muted">El capítulo se toma del selector principal de empresa.</small>
          </div>
          
          ${filteredHierarchy.map((level, index) => `
            <div class="mb-3">
              <label for="context_${level}" class="form-label">
                ${this.getLevelLabel(level)}
                ${index === 0 ? '<span class="text-danger">*</span>' : ''}
              </label>
              <select class="form-select" id="context_${level}" 
                      ${index === 0 ? 'required' : ''}
                      onchange="InsertionWizard.updateContext('${level}', this.value); InsertionWizard.loadDependentOptions('${level}')">
                <option value="">Cargando...</option>
              </select>
            </div>
          `).join('')}

          ${rules.hierarchyOptional ? rules.hierarchyOptional.map(level => `
            <div class="mb-3">
              <label for="context_${level}" class="form-label">
                ${this.getLevelLabel(level)} <small class="text-muted">(opcional)</small>
              </label>
              <select class="form-select" id="context_${level}"
                      onchange="InsertionWizard.updateContext('${level}', this.value)">
                <option value="">Cargando...</option>
              </select>
            </div>
          `).join('') : ''}
        </div>
      `;

      // Cargar opciones inmediatamente después de renderizar
      setTimeout(() => this.loadAllOptions(), 100);

      return html;
    },

    /**
     * Carga todas las opciones de los dropdowns
     */
    async loadAllOptions() {
      const rules = this.getValidationRules()[this.selectedType];
      if (!rules) return;

      const hierarchy = rules.hierarchy ? rules.hierarchy.filter(level => level !== 'capitulo') : [];
      const optional = rules.hierarchyOptional || [];
      const allLevels = [...hierarchy, ...optional];

      for (const level of allLevels) {
        await this.loadOptionsForSelect(level);
      }
    },

    /**
     * Carga opciones para un select específico
     */
    async loadOptionsForSelect(level) {
      if (level === 'capitulo') {
        return;
      }
      const select = document.getElementById(`context_${level}`);
      if (!select) return;

      try {
        const options = await this.getOptionsForLevel(level);
        
        // Limpiar y repoblar
        select.innerHTML = '<option value="">Seleccione...</option>';
        
        options.forEach(opt => {
          const option = document.createElement('option');
          option.value = opt.value;
          option.textContent = opt.label;
          if (opt.selected) option.selected = true;
          select.appendChild(option);
        });

      } catch (error) {
        console.error(`Error al cargar opciones para ${level}:`, error);
        select.innerHTML = '<option value="">Error al cargar</option>';
      }
    },

    /**
     * Carga opciones dependientes cuando cambia un nivel superior
     */
    async loadDependentOptions(changedLevel) {
      const rules = this.getValidationRules()[this.selectedType];
      if (!rules) return;

      const hierarchy = (rules.hierarchy || []).filter(level => level !== 'capitulo');
      const currentIndex = hierarchy.indexOf(changedLevel);
      
      // Recargar niveles dependientes
      for (let i = currentIndex + 1; i < hierarchy.length; i++) {
        await this.loadOptionsForSelect(hierarchy[i]);
      }
    },

    /**
     * PASO 3: Ingresar datos del elemento
     */
    renderStep3_EnterData() {
      const rules = this.getValidationRules()[this.selectedType];
      if (!rules) return '<p>Error: Tipo no válido</p>';

      return `
        <div class="wizard-step active" data-step="3">
          <h6 class="mb-3">Datos del ${this.getTypeLabel(this.selectedType)}</h6>
          
          ${this.selectedType === 'cuenta' ? `
            <div class="mb-3">
              <label for="data_numero" class="form-label">
                Número de Cuenta <span class="text-danger">*</span>
              </label>
              <input type="text" class="form-control" id="data_numero" required
                     placeholder="${rules.formatLabel}"
                     pattern="${rules.format ? rules.format.source : ''}"
                     oninput="InsertionWizard.validateField('numero', this.value)">
              <div class="form-text">Formato: ${rules.formatLabel}</div>
              <div class="invalid-feedback">Formato incorrecto</div>
            </div>

            <div class="mb-3">
              <label for="data_nombre" class="form-label">
                Descripción/Nombre <span class="text-danger">*</span>
              </label>
              <input type="text" class="form-control" id="data_nombre" required
                     placeholder="Ej: Cuotas Membership"
                     oninput="InsertionWizard.validateField('nombre', this.value)">
            </div>

            <div class="mb-3">
              <label for="data_tipo" class="form-label">Tipo de Cuenta</label>
              <select class="form-select" id="data_tipo">
                <option value="ingreso">Ingreso</option>
                <option value="gasto">Gasto</option>
                <option value="otro">Otro</option>
              </select>
            </div>
          ` : ''}

          ${this.selectedType !== 'cuenta' ? `
            <div class="mb-3">
              <label for="data_nombre" class="form-label">
                Nombre de ${this.getTypeLabel(this.selectedType)} <span class="text-danger">*</span>
              </label>
              <input type="text" class="form-control" id="data_nombre" required
                     placeholder="Ej: Marketing Digital"
                     oninput="InsertionWizard.validateField('nombre', this.value)">
            </div>

            <div class="mb-3">
              <label for="data_etiquetaSum" class="form-label">
                Etiqueta de Total <span class="text-danger">*</span>
              </label>
              <input type="text" class="form-control" id="data_etiquetaSum" required
                     placeholder="Ej: Total Marketing Digital"
                     oninput="InsertionWizard.validateField('etiquetaSum', this.value)">
              <div class="form-text">
                <i class="bi bi-info-circle me-1"></i>
                Se creará automáticamente un SUM ROW con esta etiqueta
              </div>
            </div>

            <div class="mb-3">
              <label for="data_orden" class="form-label">Posición</label>
              <select class="form-select" id="data_orden">
                <option value="top">Al inicio</option>
                <option value="bottom" selected>Al final</option>
                <option value="after">Después de...</option>
              </select>
            </div>
          ` : ''}
        </div>
      `;
    },

    /**
     * Obtiene tipos disponibles según módulo
     */
    getAvailableTypes() {
      const types = {
        SUMMARY: [
          {
            value: 'cuenta',
            label: 'Nueva Cuenta',
            icon: '📊',
            description: 'Agregar una cuenta contable a una operación existente'
          },
          {
            value: 'operacion',
            label: 'Nueva Operación',
            icon: '⚙️',
            description: 'Crear una operación dentro de una sección secundaria'
          },
          {
            value: 'secundaria',
            label: 'Nueva Sección Secundaria',
            icon: '📁',
            description: 'Crear una subsección dentro de una sección principal'
          },
          {
            value: 'principal',
            label: 'Nueva Sección Principal',
            icon: '📂',
            description: 'Crear una nueva sección principal en el capítulo'
          }
        ],
        RESUMEN: [
          {
            value: 'cuenta',
            label: 'Nueva Cuenta',
            icon: '📊',
            description: 'Agregar una cuenta contable a una operación existente'
          },
          {
            value: 'operacion',
            label: 'Nueva Operación',
            icon: '⚙️',
            description: 'Crear una operación dentro de una sección secundaria'
          },
          {
            value: 'secundaria',
            label: 'Nueva Sección Secundaria',
            icon: '📁',
            description: 'Crear una subsección dentro de una sección principal'
          },
          {
            value: 'principal',
            label: 'Nueva Sección Principal',
            icon: '📂',
            description: 'Crear una nueva sección principal en el capítulo'
          }
        ],
        MODULOS: [
          {
            value: 'cuenta',
            label: 'Nueva Cuenta',
            icon: '📊',
            description: 'Agregar una cuenta contable a una sección'
          },
          {
            value: 'operacion',
            label: 'Nueva Operación (Opcional)',
            icon: '⚙️',
            description: 'Agrupar cuentas en una operación dentro de una sección'
          },
          {
            value: 'seccion',
            label: 'Nueva Sección',
            icon: '📁',
            description: 'Crear una nueva sección en el módulo'
          }
        ]
      };

      return types[this.moduleType] || [];
    },

    /**
     * Obtiene etiqueta legible para nivel jerárquico
     */
    getLevelLabel(level) {
      const labels = {
        capitulo: 'Capítulo/Empresa',
        principal: 'Sección Principal',
        secundaria: 'Sección Secundaria',
        operacion: 'Operación',
        seccion: 'Sección'
      };
      return labels[level] || level;
    },

    /**
     * Obtiene etiqueta para tipo de elemento
     */
    getTypeLabel(type) {
      const labels = {
        cuenta: 'Cuenta',
        operacion: 'Operación',
        secundaria: 'Sección Secundaria',
        principal: 'Sección Principal',
        seccion: 'Sección'
      };
      return labels[type] || type;
    },

    /**
     * Obtiene opciones para un nivel jerárquico
     */
    async getOptionsForLevel(level) {
      if (level === 'capitulo') {
        return [];
      }
      try {
        // Construir query params
        const params = new URLSearchParams({
          moduleType: this.moduleType
        });

        // Agregar capítulo y año
        if (this.contextData.capitulo) params.append('capitulo', this.contextData.capitulo);
        if (this.contextData.anio) params.append('anio', this.contextData.anio);
        
        // Agregar jerarquía para filtrado
        if (this.contextData.principal) params.append('principal', this.contextData.principal);
        if (this.contextData.secundaria) params.append('secundaria', this.contextData.secundaria);

        const response = await fetch(`/api/insercion/opciones/${level}?${params}`, {
          headers: this.getAuthHeaders()
        });

        if (!response.ok) {
          console.error('Error al cargar opciones:', await response.text());
          return [];
        }

        const result = await response.json();
        
        if (result.exito && result.opciones) {
          return result.opciones.map(opt => ({
            value: opt,
            label: opt,
            selected: this.contextData[level] === opt
          }));
        }

        return [];

      } catch (error) {
        console.error('Error al cargar opciones:', error);
        return [];
      }
    },

    /**
     * Obtiene texto de ayuda contextual
     */
    getHelpText() {
      const helps = {
        SUMMARY: {
          1: 'En SUMMARY, las cuentas se organizan en Operaciones, que pertenecen a Secciones Secundarias, que están dentro de Principales.',
          2: 'Selecciona la jerarquía completa: Principal > Secundaria > Operación.',
          3: 'Se creará automáticamente un SUM ROW en cada nivel de agrupación.'
        },
        RESUMEN: {
          1: 'En RESUMEN, las cuentas se organizan en Operaciones, que pertenecen a Secciones Secundarias, que están en Principales.',
          2: 'Selecciona la jerarquía completa: Principal > Secundaria > Operación.',
          3: 'Se creará automáticamente un SUM ROW en cada nivel de agrupación.'
        },
        MODULOS: {
          1: 'En Módulos, las cuentas se organizan en Secciones. Las Operaciones son opcionales para agrupar.',
          2: 'Selecciona la Sección donde se insertará. Opcionalmente puedes usar Operaciones para sub-agrupar.',
          3: 'Se creará un SUM ROW automáticamente para cada Sección.'
        }
      };

      return helps[this.moduleType]?.[this.currentStep] || '';
    },

    /**
     * Selecciona un tipo de elemento
     */
    selectType(type) {
      this.selectedType = type;
      console.log('✓ Tipo seleccionado:', type);
    },

    /**
     * Actualiza el contexto jerárquico
     */
    updateContext(level, value) {
      this.contextData[level] = value;
      console.log('✓ Contexto actualizado:', level, '=', value);
      this.updatePreview();
    },

    /**
     * Valida un campo
     */
    validateField(field, value) {
      this.formData[field] = value;
      
      const input = document.getElementById(`data_${field}`);
      if (!input) return;

      // Validación básica
      const isValid = value.trim() !== '';
      
      // Validación de formato para número de cuenta
      if (field === 'numero') {
        const rules = this.getValidationRules()[this.selectedType];
        const formatValid = rules.format ? rules.format.test(value) : true;
        
        if (formatValid && isValid) {
          input.classList.add('is-valid');
          input.classList.remove('is-invalid');
        } else {
          input.classList.add('is-invalid');
          input.classList.remove('is-valid');
        }
      } else {
        if (isValid) {
          input.classList.add('is-valid');
          input.classList.remove('is-invalid');
        } else {
          input.classList.remove('is-valid');
          input.classList.add('is-invalid');
        }
      }

      this.updatePreview();
    },

    /**
     * Actualiza el preview de inserción
     */
    updatePreview() {
      const preview = document.getElementById('insertionPreview');
      const content = document.getElementById('previewContent');
      
      if (!preview || !content) return;

      if (this.currentStep === 3 && this.formData.nombre) {
        preview.classList.remove('d-none');
        
        const hierarchy = [];
        if (this.contextData.capitulo) hierarchy.push(this.contextData.capitulo);
        if (this.contextData.principal) hierarchy.push(this.contextData.principal);
        if (this.contextData.secundaria) hierarchy.push(this.contextData.secundaria);
        if (this.contextData.operacion) hierarchy.push(this.contextData.operacion);
        
        content.innerHTML = `
          <div><strong>${this.getTypeLabel(this.selectedType)}:</strong> ${this.formData.nombre || this.formData.numero || ''}</div>
          ${hierarchy.length > 0 ? `<div class="text-muted">📍 ${hierarchy.join(' > ')}</div>` : ''}
          ${this.formData.etiquetaSum ? `<div class="text-success">✓ Se creará SUM ROW: "${this.formData.etiquetaSum}"</div>` : ''}
        `;
      } else {
        preview.classList.add('d-none');
      }
    },

    /**
     * Navega al siguiente paso
     */
    nextStep() {
      // Validar paso actual antes de avanzar
      if (!this.validateCurrentStep()) {
        alert('❌ Por favor completa todos los campos requeridos');
        return;
      }

      this.currentStep++;
      this.renderWizard();
      this.showModal();
    },

    /**
     * Navega al paso anterior
     */
    previousStep() {
      this.currentStep--;
      this.renderWizard();
      this.showModal();
    },

    /**
     * Valida el paso actual
     */
    validateCurrentStep() {
      switch (this.currentStep) {
        case 1:
          return this.selectedType !== null;
        case 2:
          const rules = this.getValidationRules()[this.selectedType];
          const required = rules?.hierarchy || [];
          return required.every(level => this.contextData[level]);
        case 3:
          const dataRules = this.getValidationRules()[this.selectedType];
          const requiredFields = dataRules?.required || [];
          return requiredFields.every(field => this.formData[field]);
        default:
          return true;
      }
    },

    /**
     * Envía el formulario
     */
    async submit() {
      console.log('📝 Datos finales:', {
        type: this.selectedType,
        context: this.contextData,
        data: this.formData
      });

      // VALIDACIÓN INTELIGENTE
      if (window.InsertionValidator) {
        const validationData = {
          tipo: this.selectedType,
          context: this.contextData,
          formData: this.formData,
          moduleType: this.moduleType
        };

        const validationResult = window.InsertionValidator.validarAntesDeProcesar(validationData);

        if (!validationResult.success) {
          alert('❌ ' + validationResult.message);
          return;
        }

        // Mostrar advertencias si las hay
        if (validationResult.warnings.length > 0) {
          const warningsText = validationResult.warnings.map(w => `• ${w.message}`).join('\n');
          const confirmProceed = confirm(`⚠️ Advertencias:\n\n${warningsText}\n\n¿Deseas continuar?`);
          if (!confirmProceed) return;
        }
      }

      // Proceder con la inserción
      try {
        await this.realizarInsercion();
        alert(`✅ Elemento creado exitosamente!\n\nTipo: ${this.selectedType}\nNombre: ${this.formData.nombre || this.formData.numero}`);
        this.closeModal();
        
        // Recargar tabla
        if (window.cargarDatos) {
          window.cargarDatos();
        }
      } catch (error) {
        console.error('❌ Error al insertar:', error);
        alert(`❌ Error al crear elemento:\n${error.message}`);
      }
    },

    /**
     * Realiza la inserción en el backend y DOM
     */
    async realizarInsercion() {
      // Construir objeto de inserción según tipo
      const insertionData = this.buildInsertionData();

      // Llamar a la API correspondiente
      if (this.selectedType === 'cuenta') {
        return await this.insertarCuenta(insertionData);
      } else if (['secundaria', 'principal', 'seccion'].includes(this.selectedType)) {
        return await this.insertarSeccion(insertionData);
      } else if (this.selectedType === 'operacion') {
        return await this.insertarOperacion(insertionData);
      }
    },

    /**
     * Construye el objeto de datos para inserción
     */
    buildInsertionData() {
      const base = {
        moduleType: this.moduleType,
        context: {
          capitulo: this.contextData.capitulo || '',
          principal: this.contextData.principal || '',
          secundaria: this.contextData.secundaria || '',
          operacion: this.contextData.operacion || '',
          seccion: this.contextData.seccion || ''
        },
        formData: {
          numero: this.formData.numero || '',
          nombre: this.formData.nombre || '',
          etiquetaSum: this.formData.etiquetaSum || '',
          tipo: this.formData.tipo || 'otro'
        }
      };

      return base;
    },

    /**
     * Obtiene headers de autenticación
     */
    getAuthHeaders() {
      const headers = {
        'Content-Type': 'application/json'
      };

      // Agregar headers de sesión si están disponibles
      if (window.Sesion && window.Sesion.headersAutenticacion) {
        const authHeaders = window.Sesion.headersAutenticacion();
        Object.assign(headers, authHeaders);
      }

      return headers;
    },

    /**
     * Inserta una cuenta
     */
    async insertarCuenta(data) {
      const response = await fetch('/api/insercion/cuenta', {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.mensaje || 'Error al insertar cuenta');
      }

      const result = await response.json();
      console.log('✅ Cuenta insertada:', result);
      return result;
    },

    /**
     * Inserta una sección
     */
    async insertarSeccion(data) {
      const payload = {
        ...data,
        tipo: this.selectedType // principal, secundaria, o seccion
      };

      const response = await fetch('/api/insercion/seccion', {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.mensaje || 'Error al insertar sección');
      }

      const result = await response.json();
      console.log('✅ Sección insertada:', result);
      return result;
    },

    /**
     * Inserta una operación
     */
    async insertarOperacion(data) {
      const response = await fetch('/api/insercion/operacion', {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.mensaje || 'Error al insertar operación');
      }

      const result = await response.json();
      console.log('✅ Operación insertada:', result);
      return result;
    },

    /**
     * Muestra el modal
     */
    showModal() {
      const modal = document.getElementById('insertionWizardModal');
      if (modal) {
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
      }
    },

    /**
     * Cierra el modal
     */
    closeModal() {
      const modal = document.getElementById('insertionWizardModal');
      if (modal) {
        const bsModal = bootstrap.Modal.getInstance(modal);
        if (bsModal) bsModal.hide();
      }
    }
  };

  // Exponer globalmente
  window.InsertionWizard = InsertionWizard;
})();
