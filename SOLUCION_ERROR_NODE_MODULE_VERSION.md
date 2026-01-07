# Solución: Error NODE_MODULE_VERSION en better-sqlite3

## Problema

Al instalar la aplicación empaquetada, aparece el error:
```
The module 'better_sqlite3.node' was compiled against a different Node.js version using
NODE_MODULE_VERSION 127. This version of Node.js requires NODE_MODULE_VERSION 140.
```

## Causa

El módulo nativo `better-sqlite3` no fue recompilado correctamente para la versión de Electron (39.2.7) antes de publicar. El módulo quedó compilado para una versión anterior.

## Solución Implementada

### 1. Script de Pre-publicación

Se creó `scripts/prepublish.js` que automáticamente:
- Limpia compilaciones anteriores
- Recompila better-sqlite3 para Electron 39.2.7
- Guarda y activa el binario correcto

### 2. Comando Actualizado

Ahora `npm run publish` ejecuta automáticamente el script de preparación antes de publicar.

## Cómo Publicar Correctamente

### Opción 1: Automática (Recomendada)
```bash
npm run publish
```

Esto automáticamente:
1. Ejecuta `prepublish` para recompilar
2. Publica la aplicación con el binario correcto

### Opción 2: Manual
Si necesitas más control:

```bash
# 1. Recompilar para Electron
npm run rebuild-native-electron

# 2. Verificar estado
npm run native:status

# 3. Publicar
npm run publish
```

## Verificación

Después de ejecutar la recompilación, verifica:

```bash
npm run native:status
```

Debes ver:
```
[native-modules] Estado actual:
  • almacen node: OK (native_modules/node)
  • almacen electron: OK (native_modules/electron)
  • activo: node_modules/better-sqlite3/build/Release/better_sqlite3.node
```

## Scripts Disponibles

| Comando | Descripción |
|---------|-------------|
| `npm run rebuild-native-node` | Recompila para Node.js |
| `npm run rebuild-native-electron` | Recompila para Electron |
| `npm run rebuild-native` | Recompila para ambos |
| `npm run native:use-electron` | Activa binario Electron |
| `npm run native:use-node` | Activa binario Node |
| `npm run native:status` | Muestra estado actual |

## Solución para Usuario Final

Si un usuario ya instaló la versión con el error, debe:

1. **Desinstalar la versión actual**
2. **Descargar e instalar la nueva versión** desde GitHub releases

No es necesario ninguna acción manual del usuario, solo reinstalar.

## Prevención

Para evitar este error en futuras publicaciones:

1. ✅ **Siempre usar** `npm run publish` (no publicar manualmente)
2. ✅ Verificar que no hay cambios pendientes en `native_modules/`
3. ✅ Probar la aplicación empaquetada localmente antes de publicar:
   ```bash
   npm run dist
   # Instalar y probar el instalador generado en dist/
   ```

## Notas Técnicas

- **NODE_MODULE_VERSION 127** = Electron 28.x / Node.js 20.x
- **NODE_MODULE_VERSION 140** = Electron 33.x / Node.js 22.x
- **Electron 39.2.7** (nuestra versión) requiere NODE_MODULE_VERSION 140

## Checklist Pre-Publicación

Antes de cada publicación, verifica:

- [ ] Todos los cambios están commiteados
- [ ] `npm run rebuild-native-electron` ejecutado sin errores
- [ ] `npm run native:status` muestra "almacen electron: OK"
- [ ] La aplicación funciona con `npm start:prod`
- [ ] Los tests pasan (si aplica)
- [ ] Version actualizada en package.json

## Contacto

Si el problema persiste después de seguir estos pasos, contactar al equipo de desarrollo.
