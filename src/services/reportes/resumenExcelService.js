const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const XLSX = require("xlsx");
const { withExcelNativeLock } = require("./excelNativeMutex");

const limpiarTexto = (valor) => (valor == null ? "" : String(valor).trim());

const quitarAcentos = (texto) =>
  texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "_");

const normalizarNombreHoja = (valor, fallback) => {
  const texto = limpiarTexto(valor || "");
  if (!texto) return fallback;
  const limpio = texto.replace(/[\\/*?:\[\]]/g, "").slice(0, 31);
  return limpio || fallback;
};

const resolverScript = () => {
  const basePath = path.join(__dirname, "..", "..", "..");
  return path.join(basePath, "scripts", "export-resumen-charts.ps1");
};

const escribirTempScript = (destino) => {
  const scriptPath = resolverScript();
  const contenido = fs.readFileSync(scriptPath, "utf8");
  fs.writeFileSync(destino, contenido, "utf8");
};

const resolverPowerShell = () => {
  const root = process.env.SystemRoot || "C:\\Windows";
  const system32 = path.join(
    root,
    "System32",
    "WindowsPowerShell",
    "v1.0",
    "powershell.exe"
  );
  if (fs.existsSync(system32)) return system32;
  return "powershell";
};

const EXCEL_NATIVE_TIMEOUT_MS = Math.max(
  10000,
  Number(process.env.EXCEL_NATIVE_TIMEOUT_MS || 300000)
);

const normalizarTimeoutMs = (value, fallbackMs = EXCEL_NATIVE_TIMEOUT_MS) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallbackMs;
  return Math.max(10000, Math.round(parsed));
};

const killProcessTree = (proc) =>
  new Promise((resolve) => {
    try {
      if (!proc || proc.killed || !proc.pid) {
        resolve();
        return;
      }
      if (process.platform === "win32") {
        const killer = spawn("taskkill", ["/PID", String(proc.pid), "/T", "/F"], {
          windowsHide: true,
          stdio: "ignore",
        });
        killer.on("error", () => {
          try {
            proc.kill("SIGKILL");
          } catch (_) {
            // ignore
          }
          resolve();
        });
        killer.on("close", () => resolve());
        return;
      }
      try {
        proc.kill("SIGKILL");
      } catch (_) {
        // ignore
      }
      resolve();
    } catch (_) {
      resolve();
    }
  });

const esErrorFormatoWorkbook = (error) => {
  const texto = String(error?.message || error || "").toLowerCase();
  if (!texto) return false;
  return (
    texto.includes("formato o la extensión") ||
    texto.includes("formato o la extension") ||
    texto.includes("format or extension") ||
    texto.includes("cannot open the file") ||
    texto.includes("no puede abrir el archivo")
  );
};

const normalizarWorkbookParaExcel = (inputPath) => {
  const wb = XLSX.readFile(inputPath, {
    type: "file",
    cellDates: true,
    cellNF: true,
    cellStyles: true,
  });
  XLSX.writeFile(wb, inputPath, {
    bookType: "xlsx",
    compression: true,
  });
};

const ejecutarPowerShell = (args, timeoutMs = EXCEL_NATIVE_TIMEOUT_MS) =>
  new Promise((resolve, reject) => {
    const timeout = normalizarTimeoutMs(timeoutMs, EXCEL_NATIVE_TIMEOUT_MS);
    const bin = resolverPowerShell();
    const proc = spawn(bin, ["-NoProfile", "-ExecutionPolicy", "Bypass", "-STA", ...args], {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let settled = false;
    const finalize = (cb, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cb(value);
    };
    let stderr = "";
    let stdout = "";
    const timer = setTimeout(() => {
      killProcessTree(proc).finally(() => {
        finalize(
          reject,
          new Error(
            `PowerShell timeout (${Math.round(timeout / 1000)}s). Stderr: ${stderr}`
          )
        );
      });
    }, timeout);
    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    proc.on("error", (error) => finalize(reject, error));
    proc.on("close", (code) => {
      if (settled) return;
      if (code === 0) {
        finalize(resolve, stdout.trim());
      } else {
        const msg = stderr || stdout || `PowerShell failed (${code}).`;
        finalize(reject, new Error(msg.trim()));
      }
    });
  });

const generarResumenExcel = async ({
  libroBuffer,
  nombreArchivo,
  empresa,
  mes,
  anio,
  dataSheetName,
  chartsSheetName,
  tableSheetName,
  timeoutMs,
}) => {
  const nativeTimeoutMs = normalizarTimeoutMs(timeoutMs, EXCEL_NATIVE_TIMEOUT_MS);
  if (!libroBuffer || !libroBuffer.length) {
    throw new Error("No se recibio el archivo base.");
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "resumen-"));
  const inputPath = path.join(tempDir, "resumen.xlsx");
  const outputPath = path.join(tempDir, "resumen_graficas.xlsx");
  const scriptTemp = path.join(tempDir, "export-resumen-charts.ps1");

  const hojaDatos = normalizarNombreHoja(dataSheetName, "GraficasData");
  const hojaGraficas = normalizarNombreHoja(chartsSheetName, "Graficas");
  const hojaTabla = normalizarNombreHoja(tableSheetName, "");

  try {
    const buffer = Buffer.isBuffer(libroBuffer)
      ? libroBuffer
      : Buffer.from(libroBuffer);
    fs.writeFileSync(inputPath, buffer);

    escribirTempScript(scriptTemp);

    const psArgs = [
      "-File",
      scriptTemp,
      "-InputPath",
      inputPath,
      "-OutputPath",
      outputPath,
      "-DataSheetName",
      hojaDatos,
      "-ChartsSheetName",
      hojaGraficas,
      "-TableSheetName",
      hojaTabla,
    ];

    try {
      await withExcelNativeLock(() =>
        ejecutarPowerShell(psArgs, nativeTimeoutMs)
      );
    } catch (errorNative) {
      if (!esErrorFormatoWorkbook(errorNative)) {
        throw errorNative;
      }
      try {
        normalizarWorkbookParaExcel(inputPath);
      } catch (_) {
        throw errorNative;
      }
      await withExcelNativeLock(() =>
        ejecutarPowerShell(psArgs, nativeTimeoutMs)
      );
    }

    const baseName = `${limpiarTexto(nombreArchivo || "RESUMEN")}_${limpiarTexto(
      empresa || "Reporte"
    )}_${limpiarTexto(mes)}_${limpiarTexto(anio)}`;
    const safeBase = quitarAcentos(baseName || "RESUMEN");
    const filename = `${safeBase}_Graficas.xlsx`.replace(/_+/g, "_");

    const outputBuffer = fs.readFileSync(outputPath);
    return { buffer: outputBuffer, filename };
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn("No se pudo limpiar temporal resumen:", error.message);
    }
  }
};

module.exports = { generarResumenExcel };
