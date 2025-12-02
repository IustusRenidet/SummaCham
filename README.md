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

## Generador de reporte Summary

`src/services/reporteSummaryService.js` expone la función `generarReporteSummary(empresaId, anio, opciones)` que:

- Lee los CSV (`SUMMARY Ciudad de México.csv`, `SUMMARY GUADALAJARA.csv`, `SUMMARY NOROESTE.csv`) para mapear cada cuenta a su sección / sección mayor.
- Obtiene los saldos año contra año desde Firebird utilizando la misma lógica de `summaryService`.
- Aplica las reglas definidas en `SUMAS CIUDAD DE MEXICO.csv` (operaciones `sumar`/`resta`, referencias a otras empresas) para construir el árbol de nodos consolidado.
- Devuelve un JSON como `{ empresa, anio, resultado, reglasAplicadas }` donde cada clave corresponde a un nodo padre con `total` y `children`.

Opciones disponibles:

- `basePath`: ruta base donde residen los CSV (por defecto `info IMPORTANTE`).
- `rulesPath`: ruta al archivo de reglas (predeterminado `SUMAS CIUDAD DE MEXICO.csv`).
- `mappingFiles`: reemplazos por empresa para los nombres de archivos de mapeo.
- `companyAliases`: alias extras para transformar etiquetas de empresa (ej. `"GUADALAJARA"` → `"GDL"`).

