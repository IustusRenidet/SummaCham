"use strict";

const path = require("path");
const {
  bootstrapExcelNativeRuntime,
} = require("../src/services/reportes/excelNativeBootstrap");

if (!process.env.PANELAMCHAM_DATA_DIR) {
  process.env.PANELAMCHAM_DATA_DIR = path.resolve(process.cwd(), "datos");
}

const result = bootstrapExcelNativeRuntime();

if (result?.ok || result?.skipped) {
  process.exit(0);
}

console.error("No se pudo preparar automáticamente el runtime de Excel nativo.");
if (result?.reason) {
  console.error(`Reason: ${result.reason}`);
}
if (result?.error) {
  console.error(`Detail: ${result.error}`);
}
process.exit(1);

