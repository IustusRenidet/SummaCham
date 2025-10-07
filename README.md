# SummaCham

Aplicación de escritorio basada en Electron para visualizar paneles financieros de AmCham México.

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

   Esto crea el paquete en la carpeta `dist/` con un archivo `SummaCham-portable-<version>-x64.exe` listo para distribuirse sin instalación.

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

