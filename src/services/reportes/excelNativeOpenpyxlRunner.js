const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const NATIVE_ENGINE = String(process.env.EXCEL_NATIVE_ENGINE || "auto")
  .trim()
  .toLowerCase();

const EXCEL_NATIVE_TIMEOUT_MS = Math.max(
  10000,
  Number(process.env.EXCEL_NATIVE_TIMEOUT_MS || 300000)
);

const EXCEL_NATIVE_PYTHON_TIMEOUT_MS = Math.max(
  10000,
  Number(process.env.EXCEL_NATIVE_PYTHON_TIMEOUT_MS || EXCEL_NATIVE_TIMEOUT_MS)
);

const normalizarTimeoutMs = (
  value,
  fallbackMs = EXCEL_NATIVE_PYTHON_TIMEOUT_MS
) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallbackMs;
  return Math.max(10000, Math.round(parsed));
};

const resolverScript = () => {
  const basePath = path.join(__dirname, "..", "..", "..");
  return path.join(basePath, "scripts", "export-native-charts-openpyxl.py");
};

const candidatePythonBins = () => {
  const envBin = String(process.env.EXCEL_NATIVE_PYTHON_BIN || "").trim();
  const bins = [];
  if (envBin) bins.push(envBin);
  if (process.platform === "win32") {
    bins.push("py", "python", "python3");
  } else {
    bins.push("python3", "python");
  }
  return Array.from(new Set(bins.filter(Boolean)));
};

const killProcessTree = (proc, timeoutMs) =>
  new Promise((resolve) => {
    const timeout = Math.max(1000, Number(timeoutMs) || 7000);
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      clearTimeout(forceTimer);
      resolve();
    };
    const forceTimer = setTimeout(() => {
      try {
        if (proc && !proc.killed) {
          proc.kill("SIGKILL");
        }
      } catch (_) {
        // ignore
      }
      done();
    }, timeout);
    try {
      if (!proc || proc.killed || !proc.pid) {
        done();
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
          done();
        });
        killer.on("close", () => done());
        return;
      }
      try {
        proc.kill("SIGKILL");
      } catch (_) {
        // ignore
      }
      done();
    } catch (_) {
      done();
    }
  });

const recortarLog = (text, maxLen = 2200) => {
  const raw = String(text || "").trim();
  if (!raw) return "";
  if (raw.length <= maxLen) return raw;
  return `...${raw.slice(-maxLen)}`;
};

const esErrorBinNoEncontrado = (error) => {
  const code = String(error?.code || "").toUpperCase();
  if (code === "ENOENT") return true;
  const msg = String(error?.message || "").toLowerCase();
  return msg.includes("not found") || msg.includes("no se reconoce");
};

const ejecutarPython = (bin, args, timeoutMs) =>
  new Promise((resolve, reject) => {
    const proc = spawn(bin, args, {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timeout = normalizarTimeoutMs(timeoutMs, EXCEL_NATIVE_PYTHON_TIMEOUT_MS);
    const finalize = (cb, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cb(value);
    };
    const timer = setTimeout(() => {
      killProcessTree(proc, 8000).finally(() => {
        finalize(
          reject,
          new Error(
            `Python timeout (${Math.round(timeout / 1000)}s). Stdout: ${recortarLog(
              stdout
            )} Stderr: ${recortarLog(stderr)}`
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
        finalize(resolve, { stdout: stdout.trim(), stderr: stderr.trim() });
      } else {
        const detail = recortarLog(stderr || stdout || `Python failed (${code}).`);
        finalize(reject, new Error(detail));
      }
    });
  });

const isOpenpyxlMissingError = (error) => {
  const text = String(error?.message || error || "").toLowerCase();
  return text.includes("no module named") && text.includes("openpyxl");
};

const ejecutarOpenpyxlNativeCharts = async ({
  tipo = "operativo",
  inputPath,
  outputPath,
  dataSheetName = "",
  chartsSheetName = "",
  tableSheetName = "",
  chartMode = "",
  seriesMeta = "",
  timeoutMs,
}) => {
  const scriptPath = resolverScript();
  if (!fs.existsSync(scriptPath)) {
    throw new Error(`Script OpenPyXL no encontrado: ${scriptPath}`);
  }
  const argsBase = [
    scriptPath,
    "--kind",
    String(tipo || "operativo"),
    "--input-path",
    String(inputPath || ""),
    "--output-path",
    String(outputPath || ""),
    "--data-sheet-name",
    String(dataSheetName || ""),
    "--charts-sheet-name",
    String(chartsSheetName || ""),
    "--table-sheet-name",
    String(tableSheetName || ""),
    "--chart-mode",
    String(chartMode || ""),
  ];
  if (typeof seriesMeta === "string" && seriesMeta.trim()) {
    argsBase.push("--series-meta", seriesMeta.trim());
  }

  const timeout = normalizarTimeoutMs(timeoutMs, EXCEL_NATIVE_PYTHON_TIMEOUT_MS);
  const bins = candidatePythonBins();
  let lastError = null;
  for (const bin of bins) {
    try {
      await ejecutarPython(bin, argsBase, timeout);
      return true;
    } catch (error) {
      lastError = error;
      if (isOpenpyxlMissingError(error)) {
        throw new Error(
          "Python openpyxl no está instalado en el servidor. Instala: python -m pip install openpyxl"
        );
      }
      if (esErrorBinNoEncontrado(error)) {
        continue;
      }
    }
  }
  if (lastError) throw lastError;
  throw new Error("No se encontró un intérprete Python disponible.");
};

const shouldTryOpenpyxl = () => NATIVE_ENGINE === "auto" || NATIVE_ENGINE === "openpyxl";
const shouldUseComOnly = () => NATIVE_ENGINE === "com";
const shouldFallbackToCom = () => NATIVE_ENGINE === "auto";

module.exports = {
  normalizarTimeoutMs,
  shouldTryOpenpyxl,
  shouldUseComOnly,
  shouldFallbackToCom,
  ejecutarOpenpyxlNativeCharts,
};

