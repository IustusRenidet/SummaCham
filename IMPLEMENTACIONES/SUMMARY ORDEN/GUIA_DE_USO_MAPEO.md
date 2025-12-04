# GUÍA DE USO - MAPEO DETALLADO SUMMARY Y RESUMEN

## 📋 DESCRIPCIÓN GENERAL

Este documento proporciona un mapeo completo y estandarizado de las estructuras de agregación para las vistas **SUMMARY** y **RESUMEN**, documentando todas las operaciones por fila y columna.

---

## 📊 CONTENIDO DEL ARCHIVO EXCEL

El archivo `Mapeo_Detallado_SUMMARY_RESUMEN.xlsx` contiene 5 hojas:

### 1. **Diagrama Visual**
- Vista gráfica de la jerarquía de niveles
- Código de colores por nivel de agregación
- Tabla de operaciones clave
- Referencia rápida visual

### 2. **SUMMARY - Estructura**
Mapeo completo de la vista SUMMARY con:
- **Columna A**: Nivel jerárquico (0-3)
- **Columna B**: Número de fila en archivo original
- **Columna C**: Código de cuenta contable
- **Columna D**: Nombre descriptivo
- **Columna E**: Tipo de operación
- **Columna F**: Fórmula completa o ejemplo
- **Columna G**: Descripción detallada
- **Columna H**: Fuente de datos

### 3. **RESUMEN - Estructura**
Mapeo completo de la vista RESUMEN con el mismo formato que SUMMARY

### 4. **Diferencias SUMMARY vs RESUMEN**
Análisis comparativo detallado que incluye:
- Diferencias en fuentes de datos
- Diferencias en formato de cuentas
- Diferencias en nivel de detalle
- Diferencias en categorías
- Recomendaciones de estandarización

### 5. **Resumen Ejecutivo**
- Objetivos del documento
- Estructura de niveles explicada
- 10 recomendaciones clave para implementación

---

## 🎯 JERARQUÍA DE NIVELES

### **NIVEL 0: Consolidado Total**
- CONSOLIDATED INCOME
- CONSOLIDATED EXPENSES
- **Operación**: Suma de todos los capítulos regionales

### **NIVEL 1: Consolidado Regional**
- CDMX Income / Expense
- Guadalajara Income / Expense
- Monterrey Income / Expense
- Northwest Income (solo en RESUMEN)
- **Operación**: Suma de categorías principales

### **NIVEL 2: Categorías Principales**

**INCOME:**
- Membership
- Events
- Committees
- T&IC (Trade & Investment Center) - solo en RESUMEN
- Services to Members

**EXPENSE:**
- Membership
- Events
- Committees
- T&IC - solo en RESUMEN
- Services to Members
- Gastos Administrativos
- Other
- Gastos de Nómina

**Operación**: Suma de cuentas individuales

### **NIVEL 3: Cuentas Individuales**
- Cuentas contables específicas (401-xxx, 702-xxx, 801-xxx, etc.)
- **Operación**: 
  - SUMMARY: VLOOKUP en hojas SALDOSxx
  - RESUMEN: SUMIF desde PPvsREal Summary

---

## 🔧 OPERACIONES POR TIPO

### **SUMA (SUM)**
```excel
=SUM(B10:B12)
```
- Agrega filas hijas del mismo nivel
- Usado en todos los niveles superiores

### **VLOOKUP**
```excel
=ABS(VLOOKUP(A10,INDIRECT($M$1),$P$1,FALSE)-VLOOKUP(A10,INDIRECT($M$1),$Q$1,FALSE))
```
- Busca cuenta en hoja SALDOS
- Resta acumulado anterior para obtener período
- Usado en SUMMARY para cuentas individuales

### **SUMIF**
```excel
=SUMIF('PPvsREal Summary'!$C:$C, cuenta, 'PPvsREal Summary'!D:AC)
```
- Suma todos los meses de una cuenta específica
- Usado en RESUMEN para cuentas individuales

### **Consolidado Regional**
```excel
=B8+B25+B27
```
- Suma directa de regionales
- Sin usar SUM para mayor claridad

---

## 📝 DIFERENCIAS CLAVE

### 1. **Formato de Cuentas**
- **SUMMARY**: `401000000000000000001` (numérico largo)
- **RESUMEN**: `401-000-000-00` (con guiones)
- **Acción**: Crear tabla de mapeo entre formatos

### 2. **Fuente de Datos**
- **SUMMARY**: Hojas SALDOSxx y ACUMxx con VLOOKUP
- **RESUMEN**: Hoja PPvsREal Summary con SUMIF
- **Acción**: Unificar o documentar diferencia

### 3. **Período de Análisis**
- **SUMMARY**: Comparación mes vs mes anterior
- **RESUMEN**: Comparación acumulado anual vs presupuesto
- **Acción**: Mantener ambas para diferentes propósitos

### 4. **Nivel de Detalle**
- **SUMMARY**: Más consolidado en categorías
- **RESUMEN**: Más granular (ej: 13 deptos administrativos)
- **Acción**: Adoptar estructura de RESUMEN

### 5. **Capítulos Regionales**
- **SUMMARY**: 2 capítulos (Guadalajara, Monterrey)
- **RESUMEN**: 3 capítulos (+ Northwest)
- **Acción**: Verificar aplicabilidad de Northwest

---

## 🚀 RECOMENDACIONES DE IMPLEMENTACIÓN

### **Corto Plazo (1-2 semanas)**
1. ✅ Crear tabla de mapeo de cuentas (numérico ↔ guiones)
2. ✅ Documentar diferencias de fuente de datos
3. ✅ Estandarizar nomenclatura (Presupuesto vs Plan)

### **Mediano Plazo (1-2 meses)**
4. 📊 Unificar estructura de categorías
5. 📊 Implementar validaciones cruzadas
6. 📊 Adoptar desglose departamental de RESUMEN

### **Largo Plazo (3-6 meses)**
7. 🔄 Proceso de actualización sincronizada
8. 🔄 Sistema de validación automática
9. 🔄 Decisión sobre categoría Nómina independiente
10. 🔄 Evaluar inclusión de Northwest en SUMMARY

---

## 🎨 CÓDIGO DE COLORES EN ARCHIVO EXCEL

- 🔴 **Rojo Oscuro**: Nivel 0 (Consolidado Total)
- 🔴 **Rojo Claro**: Nivel 1 (Regional)
- 🔵 **Turquesa**: Nivel 2 (Categorías)
- 🟢 **Verde Claro**: Nivel 3 (Cuentas)
- 🟡 **Amarillo**: Celdas con fórmulas

---

## 📞 NOTAS IMPORTANTES

### **Sobre las Fórmulas**
Las fórmulas mostradas en el documento son **ejemplos ilustrativos** basados en el análisis de los archivos. Algunas mostrarán errores (#REF!, #VALUE!) porque:
- Son referencias a hojas no incluidas en el documento de mapeo
- Son ejemplos simplificados para mostrar la lógica
- El propósito es documentar la estructura, no ejecutar cálculos

### **Uso del Documento**
Este mapeo debe usarse como:
1. 📖 **Guía de referencia** para entender la estructura
2. 🏗️ **Base para estandarización** entre vistas
3. 📋 **Documentación** para nuevos miembros del equipo
4. ✅ **Checklist** para validaciones de integridad

### **Actualización**
Este documento refleja la estructura encontrada en:
- `SUMMARY_EMPRESA01_2022.xlsx`
- `CUENTAS_SUMMARY_y_RESUMEN.xlsx`
- `Ppto__GDL_vs_Real_Ene-Dic_2025.xlsx`

Debe actualizarse si la estructura cambia significativamente.

---

## 📧 PRÓXIMOS PASOS SUGERIDOS

1. **Revisar** el mapeo con equipo de finanzas
2. **Validar** que todas las cuentas están documentadas
3. **Identificar** cuentas faltantes o inconsistencias
4. **Crear** tabla de mapeo oficial de cuentas
5. **Implementar** validaciones cruzadas
6. **Estandarizar** nomenclatura entre vistas
7. **Documentar** proceso de actualización mensual

---

**Fecha de Creación**: Diciembre 2025  
**Versión**: 1.0  
**Creado por**: Claude (Anthropic)  
**Propósito**: Estandarización y documentación de vistas financieras
