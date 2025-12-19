/**
 * insertion-validator.js
 * Sistema inteligente de validación jerárquica
 * Previene información suelta y garantiza integridad de datos
 */

(() => {
  'use strict';

  const InsertionValidator = {
    /**
     * Valida si una inserción es permitida
     * @param {Object} data - Datos de la inserción
     * @returns {Object} { valid: boolean, errors: [], warnings: [] }
     */
    validarInsercion(data) {
      const { tipo, context, formData, moduleType } = data;
      const errors = [];
      const warnings = [];

      // 1. Validar jerarquía obligatoria
      const hierarchyErrors = this.validarJerarquia(tipo, context, moduleType);
      errors.push(...hierarchyErrors);

      // 2. Validar duplicados
      const duplicateErrors = this.verificarDuplicados(tipo, formData, context, moduleType);
      errors.push(...duplicateErrors);

      // 3. Validar formato
      const formatErrors = this.validarFormato(tipo, formData, moduleType);
      errors.push(...formatErrors);

      // 4. Validar consistencia de capítulo
      const chapterErrors = this.validarCapitulo(context, moduleType);
      errors.push(...chapterErrors);

      // 5. Advertencias (no bloquean pero informan)
      const sectionWarnings = this.verificarAdvertencias(tipo, context, moduleType);
      warnings.push(...sectionWarnings);

      return {
        valid: errors.length === 0,
        errors,
        warnings
      };
    },

    /**
     * Valida que la jerarquía sea completa y correcta
     */
    validarJerarquia(tipo, context, moduleType) {
      const errors = [];
      const rules = this.getHierarchyRules(moduleType);
      const required = rules[tipo]?.hierarchy || [];

      required.forEach(level => {
        if (!context[level] || context[level].trim() === '') {
          errors.push({
            field: level,
            message: `Se requiere seleccionar ${this.getLevelLabel(level)}`,
            severity: 'error'
          });
        }
      });

      // Validar dependencias jerárquicas
      if (moduleType === 'SUMMARY') {
        if (tipo === 'secundaria' && !context.principal) {
          errors.push({
            field: 'principal',
            message: 'Una Sección Secundaria debe pertenecer a una Sección Principal',
            severity: 'error'
          });
        }
        if (tipo === 'cuenta' && (!context.secundaria || !context.principal)) {
          errors.push({
            field: 'jerarquia',
            message: 'Una Cuenta debe estar dentro de una Secundaria (que está en una Principal)',
            severity: 'error'
          });
        }
      }

      if (moduleType === 'RESUMEN') {
        if (tipo === 'operacion' && (!context.secundaria || !context.principal)) {
          errors.push({
            field: 'jerarquia',
            message: 'Una Operación debe estar en una Secundaria (que está en una Principal)',
            severity: 'error'
          });
        }
        if (tipo === 'cuenta' && (!context.operacion || !context.secundaria || !context.principal)) {
          errors.push({
            field: 'jerarquia',
            message: 'Una Cuenta debe estar en una Operación (dentro de Secundaria, dentro de Principal)',
            severity: 'error'
          });
        }
      }

      if (moduleType === 'MODULOS') {
        if (tipo === 'cuenta' && !context.seccion) {
          errors.push({
            field: 'seccion',
            message: 'Una Cuenta debe pertenecer a una Sección',
            severity: 'error'
          });
        }
        if (tipo === 'operacion' && !context.seccion) {
          errors.push({
            field: 'seccion',
            message: 'Una Operación debe estar dentro de una Sección',
            severity: 'error'
          });
        }
      }

      return errors;
    },

    /**
     * Verifica duplicados en la estructura
     */
    verificarDuplicados(tipo, formData, context, moduleType) {
      const errors = [];

      if (tipo === 'cuenta') {
        const numeroCuenta = formData.numero;
        
        // Buscar cuenta duplicada en el DOM
        const existingAccount = this.findAccountInDOM(numeroCuenta, moduleType);
        if (existingAccount) {
          errors.push({
            field: 'numero',
            message: `La cuenta ${numeroCuenta} ya existe en ${existingAccount.location}`,
            severity: 'error'
          });
        }

        // Verificar formato único por módulo
        if (moduleType === 'SUMMARY' && numeroCuenta.length !== 21) {
          errors.push({
            field: 'numero',
            message: 'En SUMMARY, las cuentas deben tener exactamente 21 dígitos',
            severity: 'error'
          });
        }
      }

      if (tipo === 'secundaria' || tipo === 'principal' || tipo === 'seccion') {
        const nombreSeccion = formData.nombre;
        
        // Buscar sección duplicada en el mismo nivel
        const existingSection = this.findSectionInDOM(nombreSeccion, tipo, context, moduleType);
        if (existingSection) {
          errors.push({
            field: 'nombre',
            message: `Ya existe una ${this.getLevelLabel(tipo)} con el nombre "${nombreSeccion}" en este contexto`,
            severity: 'error'
          });
        }
      }

      if (tipo === 'operacion') {
        const nombreOperacion = formData.nombre;
        
        // Verificar operación duplicada en la misma secundaria
        const existingOperation = this.findOperationInDOM(nombreOperacion, context, moduleType);
        if (existingOperation) {
          errors.push({
            field: 'nombre',
            message: `Ya existe una Operación "${nombreOperacion}" en esta Sección Secundaria`,
            severity: 'error'
          });
        }
      }

      return errors;
    },

    /**
     * Valida formato de datos
     */
    validarFormato(tipo, formData, moduleType) {
      const errors = [];

      if (tipo === 'cuenta') {
        const numero = formData.numero;

        if (moduleType === 'SUMMARY') {
          // SUMMARY usa 21 dígitos consecutivos
          if (!/^\d{21}$/.test(numero)) {
            errors.push({
              field: 'numero',
              message: 'Formato incorrecto. Debe ser 21 dígitos consecutivos (ej: 401000000000000000001)',
              severity: 'error'
            });
          }
        } else {
          // RESUMEN y MÓDULOS usan formato XXX-XXX-XXX-XX
          if (!/^\d{3}-\d{3}-\d{3}-\d{2}$/.test(numero)) {
            errors.push({
              field: 'numero',
              message: 'Formato incorrecto. Debe ser XXX-XXX-XXX-XX (ej: 401-001-000-00)',
              severity: 'error'
            });
          }
        }

        // Validar que el nombre no esté vacío
        if (!formData.nombre || formData.nombre.trim() === '') {
          errors.push({
            field: 'nombre',
            message: 'El nombre/descripción de la cuenta es obligatorio',
            severity: 'error'
          });
        }
      }

      if (tipo !== 'cuenta') {
        // Validar nombre de sección/operación
        if (!formData.nombre || formData.nombre.trim() === '') {
          errors.push({
            field: 'nombre',
            message: `El nombre de ${this.getLevelLabel(tipo)} es obligatorio`,
            severity: 'error'
          });
        }

        // Validar etiqueta de suma
        if (!formData.etiquetaSum || formData.etiquetaSum.trim() === '') {
          errors.push({
            field: 'etiquetaSum',
            message: 'La etiqueta del SUM ROW es obligatoria',
            severity: 'error'
          });
        }
      }

      const factorValor = formData.factor ?? formData.operacionFactor;
      if (!Number.isFinite(Number(factorValor))) {
        errors.push({
          field: 'factor',
          message: 'Selecciona si la fila suma, resta o usa un factor numérico.',
          severity: 'error'
        });
      }

      return errors;
    },

    /**
     * Valida consistencia del capítulo
     */
    validarCapitulo(context, moduleType) {
      const errors = [];

      if (!context.capitulo || context.capitulo.trim() === '') {
        errors.push({
          field: 'capitulo',
          message: 'Debe estar en un capítulo/empresa válido',
          severity: 'error'
        });
      }

      return errors;
    },

    /**
     * Genera advertencias (no bloqueantes)
     */
    verificarAdvertencias(tipo, context, moduleType) {
      const warnings = [];

      // Advertir si hay pocas cuentas en una sección
      if (tipo === 'secundaria' || tipo === 'principal' || tipo === 'seccion') {
        warnings.push({
          message: 'Recuerda agregar cuentas a esta sección después de crearla',
          severity: 'info'
        });
      }

      // Advertir sobre auto-creación de SUM ROW
      if (tipo !== 'cuenta') {
        warnings.push({
          message: `Se creará automáticamente un SUM ROW con la etiqueta especificada`,
          severity: 'info'
        });
      }

      return warnings;
    },

    /**
     * Busca una cuenta en el DOM
     */
    findAccountInDOM(numeroCuenta, moduleType) {
      const rows = document.querySelectorAll('.account-row');
      
      for (const row of rows) {
        const accountNum = row.dataset.cuenta || row.querySelector('[data-cuenta]')?.dataset.cuenta;
        
        if (accountNum === numeroCuenta) {
          // Extraer ubicación
          const seccion = row.dataset.seccionSecundaria || row.dataset.seccion || 'Desconocida';
          return {
            location: seccion,
            row
          };
        }
      }

      return null;
    },

    /**
     * Busca una sección en el DOM
     */
    findSectionInDOM(nombreSeccion, tipo, context, moduleType) {
      let selector = '';
      
      if (tipo === 'principal') {
        selector = '.section-header-row';
      } else if (tipo === 'secundaria') {
        selector = '.subsection-row';
      } else if (tipo === 'seccion') {
        selector = '.section-header-row, .subsection-row';
      }

      const rows = document.querySelectorAll(selector);
      
      for (const row of rows) {
        const sectionName = row.dataset.sectionName || 
                           row.dataset.seccionSecundaria || 
                           row.querySelector('[data-section-name]')?.textContent?.trim();
        
        if (sectionName === nombreSeccion) {
          // Si es secundaria, verificar que esté en la misma principal
          if (tipo === 'secundaria' && context.principal) {
            const parentPrincipal = row.dataset.principalName || row.dataset.seccionPrincipal;
            if (parentPrincipal !== context.principal) {
              continue; // Es otra secundaria con mismo nombre pero en diferente principal
            }
          }
          
          return { row };
        }
      }

      return null;
    },

    /**
     * Busca una operación en el DOM
     */
    findOperationInDOM(nombreOperacion, context, moduleType) {
      const rows = document.querySelectorAll('[data-operacion]');
      
      for (const row of rows) {
        const operationName = row.dataset.operacion;
        
        if (operationName === nombreOperacion) {
          // Verificar que esté en la misma secundaria
          const parentSecundaria = row.dataset.seccionSecundaria;
          if (context.secundaria && parentSecundaria !== context.secundaria) {
            continue;
          }
          
          return { row };
        }
      }

      return null;
    },

    /**
     * Obtiene reglas de jerarquía por módulo
     */
    getHierarchyRules(moduleType) {
      return {
        SUMMARY: {
          cuenta: { hierarchy: ['capitulo', 'principal', 'secundaria'] },
          secundaria: { hierarchy: ['capitulo', 'principal'] },
          principal: { hierarchy: ['capitulo'] }
        },
        RESUMEN: {
          cuenta: { hierarchy: ['capitulo', 'principal', 'secundaria', 'operacion'] },
          operacion: { hierarchy: ['capitulo', 'principal', 'secundaria'] },
          secundaria: { hierarchy: ['capitulo', 'principal'] },
          principal: { hierarchy: ['capitulo'] }
        },
        MODULOS: {
          cuenta: { hierarchy: ['capitulo', 'seccion'] },
          operacion: { hierarchy: ['capitulo', 'seccion'] },
          seccion: { hierarchy: ['capitulo'] }
        }
      }[moduleType] || {};
    },

    /**
     * Obtiene etiqueta legible para nivel
     */
    getLevelLabel(level) {
      const labels = {
        capitulo: 'Capítulo/Empresa',
        principal: 'Sección Principal',
        secundaria: 'Sección Secundaria',
        operacion: 'Operación',
        seccion: 'Sección',
        cuenta: 'Cuenta'
      };
      return labels[level] || level;
    },

    /**
     * Valida antes de enviar (validación final)
     */
    validarAntesDeProcesar(data) {
      const validation = this.validarInsercion(data);
      
      if (!validation.valid) {
        console.error('❌ Validación fallida:', validation.errors);
        return {
          success: false,
          message: this.formatErrorMessage(validation.errors),
          errors: validation.errors
        };
      }

      if (validation.warnings.length > 0) {
        console.warn('⚠️ Advertencias:', validation.warnings);
      }

      return {
        success: true,
        message: '✅ Validación exitosa',
        warnings: validation.warnings
      };
    },

    /**
     * Formatea errores para mostrar al usuario
     */
    formatErrorMessage(errors) {
      if (errors.length === 0) return '';
      
      const errorList = errors.map(err => `• ${err.message}`).join('\n');
      return `No se puede proceder con la inserción:\n\n${errorList}`;
    },

    /**
     * Verifica si puede crear SUM ROW automáticamente
     */
    puedeCrearSumRow(tipo) {
      return ['secundaria', 'principal', 'seccion', 'operacion'].includes(tipo);
    },

    /**
     * Calcula la posición de inserción óptima
     */
    calcularPosicionInsercion(tipo, context, orden = 'bottom') {
      // Esta función determina dónde insertar el nuevo elemento en el DOM
      
      if (orden === 'top') {
        return this.encontrarPrimeraPosicion(tipo, context);
      } else if (orden === 'bottom') {
        return this.encontrarUltimaPosicion(tipo, context);
      } else {
        return this.encontrarPosicionDespuesDe(tipo, context, orden);
      }
    },

    /**
     * Encuentra la primera posición en un grupo
     */
    encontrarPrimeraPosicion(tipo, context) {
      // Lógica para encontrar la primera fila del grupo correspondiente
      return { rowIndex: 0, insertBefore: true };
    },

    /**
     * Encuentra la última posición en un grupo
     */
    encontrarUltimaPosicion(tipo, context) {
      // Lógica para encontrar la última fila del grupo correspondiente
      return { rowIndex: -1, insertBefore: false };
    },

    /**
     * Encuentra posición después de un elemento específico
     */
    encontrarPosicionDespuesDe(tipo, context, referenceName) {
      // Lógica para encontrar posición después de un elemento nombrado
      return { rowIndex: 0, insertBefore: false };
    }
  };

  // Exponer globalmente
  window.InsertionValidator = InsertionValidator;
})();