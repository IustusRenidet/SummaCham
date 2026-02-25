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

const OPENPYXL_SCRIPT_NAME = "export-native-charts-openpyxl.py";
const OPENPYXL_SCRIPT_RELATIVE = path.join("scripts", OPENPYXL_SCRIPT_NAME);

const normalizarTimeoutMs = (
  value,
  fallbackMs = EXCEL_NATIVE_PYTHON_TIMEOUT_MS
) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallbackMs;
  return Math.max(10000, Math.round(parsed));
};

const isInsideAsarPath = (targetPath) => {
  const normalized = String(targetPath || "").toLowerCase().replace(/\//g, "\\");
  return normalized.includes(".asar\\");
};

const parseCommandTokens = (rawCommand) => {
  const raw = String(rawCommand || "").trim();
  if (!raw) return [];
  const tokens = [];
  const regex = /"([^"]*)"|'([^']*)'|[^\s]+/g;
  let match;
  while ((match = regex.exec(raw))) {
    const token = match[1] ?? match[2] ?? match[0];
    if (token) tokens.push(token);
  }
  return tokens;
};

const toPythonCandidate = (bin, prefixArgs = []) => ({
  bin: String(bin || "").trim(),
  prefixArgs: Array.isArray(prefixArgs)
    ? prefixArgs.map((arg) => String(arg || "").trim()).filter(Boolean)
    : [],
});

const parsePythonCandidateFromEnv = (rawCommand) => {
  const tokens = parseCommandTokens(rawCommand);
  if (!tokens.length) return null;
  return toPythonCandidate(tokens[0], tokens.slice(1));
};

const dedupePythonCandidates = (candidates) => {
  const seen = new Set();
  const unique = [];
  for (const candidate of candidates || []) {
    if (!candidate || !candidate.bin) continue;
    const key = `${candidate.bin}::${(candidate.prefixArgs || []).join(" ")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(candidate);
  }
  return unique;
};

const resolveRuntimeRoot = () => {
  const fromEnv = String(process.env.EXCEL_NATIVE_RUNTIME_DIR || "").trim();
  if (fromEnv) return path.resolve(fromEnv);
  const dataDir = String(process.env.PANELAMCHAM_DATA_DIR || "").trim();
  if (dataDir) return path.join(path.resolve(dataDir), "excel-native");
  return path.resolve(process.cwd(), "datos", "excel-native");
};

const resolveScriptCandidates = () => {
  const candidates = [];
  const addCandidate = (candidatePath) => {
    if (!candidatePath) return;
    candidates.push(path.resolve(candidatePath));
  };

  const repoLikeRoot = path.resolve(__dirname, "..", "..", "..");
  addCandidate(path.join(repoLikeRoot, OPENPYXL_SCRIPT_RELATIVE));

  if (process.resourcesPath) {
    addCandidate(path.join(process.resourcesPath, OPENPYXL_SCRIPT_RELATIVE));
    addCandidate(
      path.join(process.resourcesPath, "app.asar.unpacked", OPENPYXL_SCRIPT_RELATIVE)
    );
  }

  return Array.from(new Set(candidates));
};

const materializeScriptOutsideAsar = (sourcePath) => {
  if (!sourcePath || !fs.existsSync(sourcePath)) return "";
  const runtimeScriptDir = path.join(resolveRuntimeRoot(), "scripts");
  const runtimeScriptPath = path.join(runtimeScriptDir, OPENPYXL_SCRIPT_NAME);
  try {
    fs.mkdirSync(runtimeScriptDir, { recursive: true });
    const sourceBuffer = fs.readFileSync(sourcePath);
    let shouldWrite = true;
    if (fs.existsSync(runtimeScriptPath)) {
      try {
        const targetBuffer = fs.readFileSync(runtimeScriptPath);
        shouldWrite = !targetBuffer.equals(sourceBuffer);
      } catch (_) {
        shouldWrite = true;
      }
    }
    if (shouldWrite) {
      fs.writeFileSync(runtimeScriptPath, sourceBuffer);
    }
    return runtimeScriptPath;
  } catch (_) {
    return "";
  }
};

const resolverScript = () => {
  const candidates = resolveScriptCandidates();

  for (const candidatePath of candidates) {
    if (!fs.existsSync(candidatePath)) continue;
    if (!isInsideAsarPath(candidatePath)) {
      return candidatePath;
    }
  }

  for (const candidatePath of candidates) {
    if (!fs.existsSync(candidatePath)) continue;
    if (!isInsideAsarPath(candidatePath)) continue;
    const materialized = materializeScriptOutsideAsar(candidatePath);
    if (materialized && fs.existsSync(materialized)) {
      return materialized;
    }
  }

  const listed = candidates.length ? candidates.join(" | ") : "sin candidatos";
  throw new Error(
    `No se encontró script OpenPyXL fuera de asar. Candidatos: ${listed}`
  );
};

const resolveVenvPython = (runtimeRoot) => {
  if (!runtimeRoot) return "";
  if (process.platform === "win32") {
    return path.join(runtimeRoot, "venv", "Scripts", "python.exe");
  }
  return path.join(runtimeRoot, "venv", "bin", "python");
};

const resolveRuntimeRoots = () => {
  const roots = [];
  roots.push(resolveRuntimeRoot());
  const projectRoot = path.resolve(__dirname, "..", "..", "..");
  roots.push(path.join(projectRoot, "datos", "excel-native"));
  return Array.from(new Set(roots.map((root) => path.resolve(root))));
};

const getWindowsAbsolutePythonCandidates = () => {
  if (process.platform !== "win32") return [];
  const results = [];
  const addIfExists = (pythonPath) => {
    if (!pythonPath) return;
    try {
      if (fs.existsSync(pythonPath)) {
        results.push(path.resolve(pythonPath));
      }
    } catch (_) {
      // ignore
    }
  };
  const scanPythonHome = (baseDir) => {
    if (!baseDir) return;
    try {
      if (!fs.existsSync(baseDir)) return;
      addIfExists(path.join(baseDir, "python.exe"));
      const children = fs.readdirSync(baseDir, { withFileTypes: true });
      for (const child of children) {
        if (!child?.isDirectory?.()) continue;
        if (!/^python/i.test(child.name || "")) continue;
        addIfExists(path.join(baseDir, child.name, "python.exe"));
      }
    } catch (_) {
      // ignore
    }
  };

  const localAppData = process.env.LOCALAPPDATA || "";
  const userProfile = process.env.USERPROFILE || "";
  const programFiles = process.env.ProgramFiles || "C:\\Program Files";
  const programFilesX86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
  const commonRoots = [
    path.join(localAppData, "Programs", "Python"),
    path.join(userProfile, "AppData", "Local", "Programs", "Python"),
    "C:\\Users\\Administrador\\AppData\\Local\\Programs\\Python",
    path.join(programFiles, "Python"),
    path.join(programFilesX86, "Python"),
    "C:\\Python",
    "C:\\Python311",
    "C:\\Python312",
    "C:\\Python313",
    "C:\\Python314",
  ];
  for (const root of commonRoots) {
    scanPythonHome(root);
  }
  return Array.from(new Set(results));
};

const candidatePythonCommands = () => {
  const envCandidate = parsePythonCandidateFromEnv(process.env.EXCEL_NATIVE_PYTHON_BIN);
  const candidates = [];
  if (envCandidate) candidates.push(envCandidate);

  for (const runtimeRoot of resolveRuntimeRoots()) {
    const venvPython = resolveVenvPython(runtimeRoot);
    if (venvPython) candidates.push(toPythonCandidate(venvPython));
  }

  if (process.platform === "win32") {
    candidates.push(
      toPythonCandidate("py", ["-3"]),
      toPythonCandidate("py"),
      toPythonCandidate("python"),
      toPythonCandidate("python3")
    );
    for (const absolutePython of getWindowsAbsolutePythonCandidates()) {
      candidates.push(toPythonCandidate(absolutePython));
    }
  } else {
    candidates.push(toPythonCandidate("python3"), toPythonCandidate("python"));
  }
  return dedupePythonCandidates(candidates);
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
  return msg.includes("not found") || msg.includes("no se reconoce") || msg.includes("no such file");
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
  const candidates = candidatePythonCommands();
  const attempted = [];
  let lastError = null;
  for (const candidate of candidates) {
    const bin = candidate.bin;
    const prefixArgs = Array.isArray(candidate.prefixArgs) ? candidate.prefixArgs : [];
    attempted.push(`${bin}${prefixArgs.length ? ` ${prefixArgs.join(" ")}` : ""}`);
    try {
      await ejecutarPython(bin, [...prefixArgs, ...argsBase], timeout);
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
  if (lastError) {
    const attempts = attempted.length ? ` Candidatos: ${attempted.join(" | ")}` : "";
    throw new Error(`${lastError.message || lastError}.${attempts}`);
  }
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

