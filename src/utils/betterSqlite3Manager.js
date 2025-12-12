const fs = require("fs");
const path = require("path");

const MODULE_NAME = "better-sqlite3";
const BINARY_NAME = "better_sqlite3.node";

const projectRoot = path.resolve(__dirname, "../..");
const binaryPath = path.join(
  projectRoot,
  "node_modules",
  MODULE_NAME,
  "build",
  "Release",
  BINARY_NAME
);
const storageRoot = path.join(projectRoot, "native_modules");

const variantPath = (variant) =>
  path.join(storageRoot, variant, BINARY_NAME);

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const filesMatch = (a, b) => {
  if (!fs.existsSync(a) || !fs.existsSync(b)) {
    return false;
  }
  const statA = fs.statSync(a);
  const statB = fs.statSync(b);
  return statA.size === statB.size && statA.mtimeMs === statB.mtimeMs;
};

const copyBinary = (src, dest) => {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
};

const assertVariant = (variant) => {
  if (!["node", "electron"].includes(variant)) {
    throw new Error(`Variante no soportada: ${variant}`);
  }
};

const saveVariant = (variant) => {
  assertVariant(variant);
  if (!fs.existsSync(binaryPath)) {
    throw new Error(
      `[native-modules] Binario principal no encontrado en ${binaryPath}. Ejecuta "npm rebuild better-sqlite3".`
    );
  }
  const dest = variantPath(variant);
  copyBinary(binaryPath, dest);
  console.log(
    `[native-modules] Respaldo ${variant} guardado en ${path.relative(
      projectRoot,
      dest
    )}.`
  );
  return dest;
};

const useVariant = (variant, { silent = false } = {}) => {
  assertVariant(variant);
  const src = variantPath(variant);
  if (!fs.existsSync(src)) {
    throw new Error(
      `[native-modules] Binario ${variant} no encontrado en ${src}. Ejecuta "npm run rebuild-native".`
    );
  }
  if (!filesMatch(src, binaryPath)) {
    copyBinary(src, binaryPath);
    if (!silent) {
      console.log(
        `[native-modules] Binario ${MODULE_NAME} (${variant}) activado.`
      );
    }
  }
  return binaryPath;
};

const ensureActiveBinary = () => {
  const variant = process.versions?.electron ? "electron" : "node";
  try {
    useVariant(variant, { silent: true });
  } catch (err) {
    console.warn(`[native-modules] ${err.message}`);
  }
};

const variantExists = (variant) => {
  assertVariant(variant);
  return fs.existsSync(variantPath(variant));
};

module.exports = {
  saveVariant,
  useVariant,
  ensureActiveBinary,
  variantExists,
  paths: {
    binaryPath,
    storageRoot,
    projectRoot,
  },
};
