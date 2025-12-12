#!/usr/bin/env node
const path = require("path");
const {
  saveVariant,
  useVariant,
  ensureActiveBinary,
  variantExists,
  paths,
} = require("../src/utils/betterSqlite3Manager");

const action = process.argv[2];

const commands = {
  "save-node": () => saveVariant("node"),
  "save-electron": () => saveVariant("electron"),
  "use-node": () => useVariant("node"),
  "use-electron": () => useVariant("electron"),
  status: () => {
    const nodeExists = variantExists("node");
    const electronExists = variantExists("electron");
    console.log("[native-modules] Estado actual:");
    console.log(
      `  • almacen node: ${nodeExists ? "OK" : "faltante"} (${path.relative(
        paths.projectRoot,
        path.join(paths.storageRoot, "node")
      )})`
    );
    console.log(
      `  • almacen electron: ${
        electronExists ? "OK" : "faltante"
      } (${path.relative(
        paths.projectRoot,
        path.join(paths.storageRoot, "electron")
      )})`
    );
    console.log(`  • activo: ${paths.binaryPath}`);
  },
  ensure: () => ensureActiveBinary(),
};

const usage = `
Uso: node scripts/manage-native.js <accion>

Acciones soportadas:
  save-node       Copia el build actual hacia native_modules/node
  save-electron   Copia el build actual hacia native_modules/electron
  use-node        Activa el binario Node en node_modules/better-sqlite3
  use-electron    Activa el binario Electron en node_modules/better-sqlite3
  ensure          Selecciona automáticamente según el runtime
  status          Muestra qué binarios están disponibles
`;

if (!action || !commands[action]) {
  console.error(usage.trim());
  process.exit(1);
}

try {
  commands[action]();
} catch (err) {
  console.error(`[native-modules] ${err.message}`);
  process.exit(1);
}
