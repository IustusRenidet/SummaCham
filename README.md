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

## Estructura de carpetas

- `main.js`: proceso principal de Electron.
- `vistas/`: interfaces HTML utilizadas por la aplicación.
- `icono/`: recursos gráficos utilizados durante el empaquetado.

## Scripts disponibles

- `npm start`: inicia la app en modo desarrollo.
- `npm run pack`: genera un paquete sin instalador (modo directorio).
- `npm run dist`: genera el ejecutable portable listo para distribución.

## Notas adicionales

- El archivo `.gitignore` incluye directorios generados y artefactos temporales comunes.
- Para personalizar el icono actualiza los recursos en `icono/icono.ico` y `icono/icono.png`.

## Reportes Summary y Resumen

Se habilitaron motores independientes que consumen saldos (`saldosService`) y reglas definidas en los archivos CSV:

- `summaryEngine` (`src/services/engines/summaryEngine.js`): lee los mapeos (`SUMMARY Ciudad de México.csv`, `SUMMARY GUADALAJARA.csv`, etc.) y las reglas de `SUMAS CIUDAD DE MEXICO.csv`, consulta los saldos de las cuentas mapeadas y arma el árbol jerárquico aplicando sumas y restas.
- `resumenEngine` (`src/services/engines/resumenEngine.js`): lee el archivo de mapeo del Resumen, trae los saldos de cada cuenta y devuelve una lista agrupada por rubros.

Ambos motores exponen rutas REST distintas:

- `GET /api/reportes/summary?empresaId=<empresa>&anio=<ejercicio>` → `{ empresa, anio, detalle, resumen, reglasAplicadas }`
- `GET /api/reportes/resumen?empresaId=<empresa>&anio=<ejercicio>` → `{ empresa, anio, filas, grupos }`

Los motores aceptan opciones para ajustar la carpeta base (`info IMPORTANTE` por defecto), rutas de los CSV y alias de empresa.

