# 📊 Sistema de Gráficas Mejorado - PanelAMCHAM

## 🎯 Características Principales

### ✨ Interfaz Simplificada
- **Menos texto, más visual**: Iconos intuitivos y etiquetas claras
- **Diseño moderno**: Gradientes, sombras y animaciones suaves
- **Responsive**: Se adapta a cualquier tamaño de pantalla

### 🧭 Flujo Guiado (Wizard)
Crea gráficas en **4 pasos simples**:

1. **📅 Selecciona el período**
   - Elige año y mes de análisis
   - Vista clara de opciones disponibles

2. **📊 Elige tipo de datos**
   - Resultado Operativo
   - Resumen Neto
   - Ingresos
   - Personalizado

3. **🎨 Selecciona tipo de gráfica**
   - Barras (comparaciones)
   - Líneas (tendencias)
   - Circular (distribución)
   - Dona (porcentajes)

4. **✅ Confirma y genera**
   - Revisa configuración
   - Verifica datos automáticamente
   - Opción de auto-exportación

### 🔍 Validación Inteligente
- **Verifica datos antes de exportar**
- **Detecta gráficas vacías o inválidas**
- **Reporta problemas claramente**
- **No exporta datos incorrectos**

### 📤 Exportación Mejorada
- **Excel**: Con imágenes de gráficas en alta calidad
- **PDF**: Formato profesional listo para imprimir
- **Validación previa**: Solo exporta datos correctos
- **Feedback visual**: Indicadores de progreso

## 🚀 Cómo Usar

### Acceso Rápido
1. Abre `Graficas-Mejoradas.html` en el navegador
2. Inicia sesión si es necesario
3. ¡Listo para visualizar!

### Usando el Asistente Guiado
```
1. Haz clic en el botón "⭐ Asistente Guiado"
2. Sigue los 4 pasos del wizard
3. Confirma y genera tu gráfica
4. ¡Automáticamente se muestra!
```

### Exportación Manual
```javascript
// Método tradicional (con validación automática)
exportarGraficasExcel();
exportarGraficasPDF();

// Validar manualmente en consola
validarGraficas();
```

## 📁 Archivos del Sistema

### Vistas HTML
- `Graficas-Mejoradas.html` - **Nueva interfaz mejorada** ⭐
- `Graficas.html` - Versión clásica (mantenida)
- `graficas-config.html` - Configuración avanzada

### Estilos CSS
- `css/graficas-mejoradas.css` - Diseño moderno y responsive

### Scripts JavaScript
- `js/chart-wizard.js` - Asistente guiado paso a paso
- `js/chart-validator.js` - Validación de datos
- `js/data-optimizer.js` - Optimización de visualización
- `js/graficas-config.js` - Configuración (existente)
- `js/graficas-resumen.js` - Lógica de gráficas (existente)

## 🔧 Componentes Técnicos

### ChartWizard
```javascript
// Abrir wizard programáticamente
ChartWizard.open();

// Cerrar wizard
ChartWizard.close();

// Acceder a configuración
console.log(ChartWizard.config);
```

### ChartValidator
```javascript
// Validar todas las gráficas
const results = ChartValidator.validateAll();

// Validar una gráfica específica
const canvas = document.getElementById('myChart');
const validation = ChartValidator.validateChart(canvas);

// Obtener reporte para usuario
const report = ChartValidator.getUserReport(results);
```

### ChartExporter
```javascript
// Exportar con validación
ChartExporter.exportToExcel();
ChartExporter.exportToPDF();

// Preparar gráficas para exportación
const canvases = document.querySelectorAll('canvas');
const prepared = await ChartExporter.prepareForExport(canvases);
```

### DataOptimizer
```javascript
// Formatear números
DataOptimizer.formatNumber(1234567, { compact: true });
// "1.2M"

// Generar colores
const colors = DataOptimizer.generateColors(5, { palette: 'vibrant' });

// Obtener opciones optimizadas
const options = DataOptimizer.getOptimizedChartOptions('bar');

// Calcular estadísticas
const stats = DataOptimizer.calculateStats([10, 20, 30, 40]);
```

## 📊 Validación de Datos

### ¿Qué se valida?
- ✅ Canvas existe y es válido
- ✅ Instancia de Chart.js está activa
- ✅ Datasets configurados correctamente
- ✅ Datos no están vacíos
- ✅ Labels están presentes
- ✅ Dimensiones del canvas adecuadas

### Estados Posibles
- **✅ Válida**: Gráfica lista para exportar
- **❌ Inválida**: Tiene problemas que impiden exportación
- **⚠️ Advertencia**: Se puede exportar pero con limitaciones

### Ejemplo de Reporte
```
📊 Reporte de Validación de Gráficas
Total de gráficas: 5
✅ Válidas: 4
❌ Inválidas: 1
⚠️ Advertencias: 1

✅ Gráficas Válidas:
  1. chartOperatingSummaryByChapter: 12 puntos, 3 series
  2. chartNetSummaryByChapter: 12 puntos, 3 series
  3. chartIngresoPorCapitulo: 4 puntos, 12 series
  4. chartIngresoNacional: 5 puntos, 12 series

❌ Gráficas Inválidas:
  1. chartCustom1: Todos los datasets están vacíos o en cero

⚠️ Advertencias:
  1. chartCustom2: Muy pocos puntos de datos (menos de 3)
```

## 🎨 Personalización

### Paletas de Colores
```javascript
const colors = DataOptimizer.generateColors(5, { 
  palette: 'vibrant' 
});
// Opciones: 'default', 'business', 'vibrant', 'pastel'
```

### Opciones de Gráfica
```javascript
const customOptions = {
  plugins: {
    legend: { position: 'top' }
  }
};

const optimized = DataOptimizer.getOptimizedChartOptions('bar', customOptions);
```

### CSS Variables
```css
:root {
  --primary-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  --card-shadow: 0 10px 40px rgba(0, 0, 0, 0.08);
}
```

## 🐛 Debugging

### Comandos de Consola
```javascript
// Validar todas las gráficas
validarGraficas();

// Inspeccionar una gráfica
const canvas = document.getElementById('chartOperatingSummaryByChapter');
const chart = Chart.getChart(canvas);
console.log(chart.data);

// Ver todas las instancias de Chart.js
Chart.instances;
```

### Logs Detallados
El sistema incluye logs automáticos en consola:
- 📊 Detección de canvas
- ✅ Validaciones exitosas
- ❌ Errores encontrados
- 📤 Proceso de exportación

## ⚡ Mejoras de Rendimiento

1. **Carga diferida**: Scripts se cargan en orden óptimo
2. **Actualización sin animación**: `chart.update('none')`
3. **Cacheo de validaciones**: No re-valida innecesariamente
4. **Canvas optimizado**: Dimensiones adecuadas para exportación

## 📱 Responsive Design

### Breakpoints
- **Mobile**: < 768px
  - Controles apilados verticalmente
  - Gráficas con altura reducida
  - Botones de ancho completo

- **Tablet**: 768px - 1024px
  - Layout híbrido
  - Gráficas a 2 columnas

- **Desktop**: > 1024px
  - Layout completo
  - Gráficas a 1 columna (ancho completo)

## 🖨️ Impresión Optimizada

El sistema incluye estilos específicos para impresión:
- Fondo blanco
- Sin controles de interfaz
- Gráficas optimizadas
- Saltos de página apropiados

```css
@media print {
  .controls-compact,
  .action-buttons {
    display: none !important;
  }
  
  .chart-card-modern {
    page-break-inside: avoid;
  }
}
```

## ✨ Mejores Prácticas

### 1. Siempre Valida Antes de Exportar
```javascript
const report = validarGraficas();
if (report.canExport) {
  exportarGraficasExcel();
}
```

### 2. Usa el Wizard para Usuarios Nuevos
```javascript
// Abrir automáticamente la primera vez
if (localStorage.getItem('wizardShown') !== 'true') {
  ChartWizard.open();
  localStorage.setItem('wizardShown', 'true');
}
```

### 3. Maneja Errores Gracefully
```javascript
try {
  await ChartExporter.exportToExcel();
} catch (error) {
  console.error('Error en exportación:', error);
  alert('Hubo un problema al exportar. Por favor intenta nuevamente.');
}
```

### 4. Limpia Instancias de Chart.js
```javascript
// Antes de recrear una gráfica
const existingChart = Chart.getChart(canvas);
if (existingChart) {
  existingChart.destroy();
}
```

## 🔄 Migración desde Versión Antigua

Si estás usando `Graficas.html`:

1. **Copia tus datos**: Los mismos datos funcionarán
2. **Usa `Graficas-Mejoradas.html`**: Nueva interfaz
3. **Prueba el wizard**: Crea gráficas más rápido
4. **Verifica exportación**: Ahora con validación

Las funciones existentes siguen funcionando:
- `exportarGraficasExcel()`
- `exportarGraficasPDF()`
- `imprimirGraficas()`

**Pero ahora con validación automática incluida!**

## 🆘 Solución de Problemas

### "No se detectaron gráficas"
- Verifica que Chart.js esté cargado
- Confirma que los datos existen
- Revisa la consola para errores

### "Gráficas vacías en exportación"
- Usa `validarGraficas()` para diagnóstico
- Verifica que los datasets tengan datos
- Asegúrate de que las gráficas estén renderizadas

### "Wizard no se abre"
- Verifica que `chart-wizard.js` esté cargado
- Revisa errores de JavaScript en consola
- Confirma que Bootstrap está disponible

## 📞 Soporte

Para problemas o sugerencias:
1. Revisa la consola del navegador (F12)
2. Usa `validarGraficas()` para diagnóstico
3. Contacta al equipo de desarrollo

---

**Última actualización**: Febrero 2026  
**Versión**: 2.0.0  
**Creado para**: PanelAMCHAM
