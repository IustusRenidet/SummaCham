# SummaCham

Dashboard financiero construido con Electron para visualizar métricas clave de AmCham México.

## Requisitos previos

- [Node.js](https://nodejs.org/) 18 o superior
- npm (incluido con Node.js)

## Ejecución en modo desarrollo

```bash
npm install
npm start
```

La aplicación abrirá una ventana de Electron con la última vista utilizada (Resumen E).

## Generar versión portable para Windows

El proyecto está configurado con `electron-builder` para crear un ejecutable portable (`.exe`) que no requiere instalación.

1. Instala las dependencias si aún no lo has hecho:

   ```bash
   npm install
   ```

2. Ejecuta el script de empaquetado portable:

   ```bash
   npm run dist
   ```

   Este comando genera la aplicación en la carpeta `dist/` con un archivo `SummaCham Portable.exe` listo para distribuir.

3. Opcional: si deseas inspeccionar la carpeta preparada sin generar el ejecutable portable, utiliza:

   ```bash
   npm run pack
   ```

   El resultado quedará en `dist/` con el contenido sin comprimir.

## Recursos incluidos

- `main.js`: proceso principal de Electron.
- `vistas/`: vistas HTML renderizadas en la aplicación.
- `icono/`: iconos utilizados durante la distribución.

## Notas adicionales

- El empaquetado utiliza ASAR para compactar los archivos de la aplicación.
- Puedes personalizar el `appId` y el `productName` desde `package.json` antes de construir la versión portable.
