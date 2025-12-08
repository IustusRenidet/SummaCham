# SummaCham

Aplicación de escritorio basada en Electron para visualizar paneles financieros de AmCham.

## Requisitos

- [Node.js](https://nodejs.org/) 18 o superior (incluye npm)
- Sistemas Windows 10/11 para generar el ejecutable portable

## Instalación

```bash
npm install
```

## Desarrollo

Ejecuta la aplicación en modo desarrollo:

```bash
npm start
```

## Empaquetado portable

El proyecto está configurado con **electron-builder** para generar un ejecutable portable de Windows.

1. Asegúrate de haber instalado las dependencias (`npm install`).
2. Ejecuta el script de empaquetado:

   ```bash
   npm run dist
   ```

   Esto crea el paquete en la carpeta `dist/` con un archivo `PanelAMCHAM-portable-<version>-x64.exe` listo para distribuirse sin instalación.

   > 💡 En Linux y macOS se necesita tener instalados `wine`, `mono` y `icnsutils` para generar el ejecutable portable de Windows.

3. Comparte el archivo portable generado. Los usuarios solo necesitan descargarlo y abrirlo.

Los recursos adicionales (`datos`, `info IMPORTANTE`, `mds`, `excels`, `image` y `IMPLEMENTACIONES`) se copian en `resources/*` dentro del instalador/portable. Si tu app actualiza archivos en tiempo de ejecución, configura esos path con `app.getPath('userData')`/carpeta de datos para persistencia fuera de `resources`.

## Estructura de carpetas

- `main.js`: proceso principal de Electron.
- `vistas/`: interfaces HTML utilizadas por la aplicación.
- `icono/`: recursos gráficos utilizados durante el empaquetado.
 - `datos/`, `info IMPORTANTE/`, `mds/`, `excels/` y `IMPLEMENTACIONES/`: datos y recursos adicionales que se empaquetan con la aplicación (resúmenes, archivos CSV/EXCEL y metadatos usados por los motores de reportes).

## Scripts disponibles

- `npm start`: inicia la app en modo desarrollo.
- `npm run pack`: genera un paquete sin instalador (modo directorio).
- `npm run dist`: genera el ejecutable portable listo para distribución.
 - `npm run build:portable`: genera el artifact portable (`portable`) para Windows (x64 + ia32).
 - `npm run build:all`: genera installer + portable (NSIS + portable) para Windows (x64 + ia32).

## Hardening de la cuenta ICONET (admin global)

- La cuenta `ICONET` se crea al inicializar la base de datos. Define antes de arrancar la app la variable `PANELAMCHAM_ADMIN_PASSWORD` (o `ICONET_PASSWORD`) para establecer/rotar la contrasena y evitar la clave por defecto.
- Si la cuenta ya existe y defines la variable, al siguiente arranque se actualiza el hash de `ICONET` automaticamente; no se registran ni exponen contrasenas en logs.
- Tras la rotacion, distribuye la nueva credencial de forma segura y elimina la variable del entorno de ejecucion si no deseas que se siga aplicando en reinicios posteriores.

## Notas adicionales

- El archivo `.gitignore` incluye directorios generados y artefactos temporales comunes.
- Para personalizar el icono actualiza los recursos en `icono/icono.ico` y `icono/icono.png`.

## Reportes Summary y Resumen

Los reportes ahora usan la misma arquitectura de secciones que los módulos de planeación:

- `planeacionReportesEngine` (`src/services/reportes/planeacionReportesEngine.js`) carga `info IMPORTANTE/CUENTAS SUMMARY y RESUMEN.xlsx` para definir capítulos/secciones, normaliza las cuentas y aplica `info IMPORTANTE/SUMAS CIUDAD DE MEXICO.csv` para sumar ingresos y restar gastos hacia los resultados operativos y los totales consolidados. Crea nodos con `children` como en planeación para poder pintar el overlay de secciones.
- `summaryEngine` y `resumenEngine` (`src/services/engines/`) exponen funciones ligeras que ejecutan `generarReporte('SUMMARY', …)` y `generarReporte('RESUMEN', …)` respectivamente.

Los nuevos endpoints consumen esos nodos y devuelven JSON listos para la vista:

- `GET /api/reportes/summary?empresaId=<empresa>&anio=<ejercicio>` → `{ empresaId, reportKey: 'SUMMARY', anio, detalle, resumen }`
- `GET /api/reportes/resumen?empresaId=<empresa>&anio=<ejercicio>` → `{ empresaId, reportKey: 'RESUMEN', anio, detalle, resumen }`

Las vistas `SUMMARY.html` y `RESUMEN.html` usan `js/summary-view.js` y `js/resumen-view.js` para renderizar esas secciones jerárquicas; de esta forma el usuario solo necesita diseñar capítulos/secciones en los archivos Excel/CSV (`CUENTAS SUMMARY y RESUMEN.xlsx` y `SUMAS CIUDAD DE MEXICO.csv`) para que el sistema agregue automáticamente los operativos como ingresos menos gastos y muestre el árbol completo.

