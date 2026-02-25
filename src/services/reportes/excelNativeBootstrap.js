const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const toText = (value) => String(value || "").trim();

const isTruthy = (value, fallback = true) => {
  const raw = toText(value).toLowerCase();
  if (!raw) return fallback;
  return !["0", "false", "off", "no"].includes(raw);
};

const runCommandSync = (bin, args = [], options = {}) => {
  const result = spawnSync(bin, args, {
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
  const stdout = String(result.stdout || "").trim();
  const stderr = String(result.stderr || "").trim();
  return {
    ok: !result.error && result.status === 0,
    status: result.status,
    stdout,
    stderr,
    error: result.error || null,
  };
};

const parseCommandTokens = (rawCommand) => {
  const raw = toText(rawCommand);
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
  bin: toText(bin),
  prefixArgs: Array.isArray(prefixArgs)
    ? prefixArgs.map((arg) => toText(arg)).filter(Boolean)
    : [],
});

const parsePythonCandidate = (rawCommand) => {
  const tokens = parseCommandTokens(rawCommand);
  if (!tokens.length) return null;
  return toPythonCandidate(tokens[0], tokens.slice(1));
};

const dedupePythonCandidates = (candidates = []) => {
  const seen = new Set();
  const unique = [];
  for (const candidate of candidates) {
    if (!candidate || !candidate.bin) continue;
    const key = `${candidate.bin}::${(candidate.prefixArgs || []).join(" ")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(candidate);
  }
  return unique;
};

const getProjectRoot = () => path.resolve(__dirname, "..", "..", "..");

const resolveRuntimeRoot = () => {
  const fromEnv = toText(process.env.EXCEL_NATIVE_RUNTIME_DIR);
  if (fromEnv) return path.resolve(fromEnv);
  const dataDir = toText(process.env.PANELAMCHAM_DATA_DIR);
  if (dataDir) return path.join(path.resolve(dataDir), "excel-native");
  return path.resolve(process.cwd(), "datos", "excel-native");
};

const resolveRuntimeRoots = () => {
  const roots = [];
  roots.push(resolveRuntimeRoot());
  roots.push(path.join(getProjectRoot(), "datos", "excel-native"));
  return Array.from(new Set(roots.map((root) => path.resolve(root))));
};

const resolveVenvPython = (venvDir) => {
  if (process.platform === "win32") {
    return path.join(venvDir, "Scripts", "python.exe");
  }
  return path.join(venvDir, "bin", "python");
};

const getWindowsAbsolutePythonBins = () => {
  if (process.platform !== "win32") return [];
  const bins = [];
  const addIfExists = (pythonPath) => {
    if (!pythonPath) return;
    try {
      if (fs.existsSync(pythonPath)) bins.push(path.resolve(pythonPath));
    } catch (_) {
      // ignore
    }
  };
  const scanRoot = (rootDir) => {
    if (!rootDir) return;
    try {
      if (!fs.existsSync(rootDir)) return;
      addIfExists(path.join(rootDir, "python.exe"));
      const children = fs.readdirSync(rootDir, { withFileTypes: true });
      for (const child of children) {
        if (!child?.isDirectory?.()) continue;
        if (!/^python/i.test(child.name || "")) continue;
        addIfExists(path.join(rootDir, child.name, "python.exe"));
      }
    } catch (_) {
      // ignore
    }
  };

  const localAppData = process.env.LOCALAPPDATA || "";
  const userProfile = process.env.USERPROFILE || "";
  const programFiles = process.env.ProgramFiles || "C:\\Program Files";
  const programFilesX86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
  const roots = [
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
  for (const root of roots) scanRoot(root);
  return Array.from(new Set(bins));
};

const getBootstrapPythonCandidates = () => {
  const candidates = [];
  const fromEnvCandidate = parsePythonCandidate(process.env.EXCEL_NATIVE_BOOTSTRAP_PYTHON_BIN);
  if (fromEnvCandidate) {
    candidates.push(fromEnvCandidate);
  }
  if (process.platform === "win32") {
    candidates.push(
      toPythonCandidate("py", ["-3"]),
      toPythonCandidate("py"),
      toPythonCandidate("python"),
      toPythonCandidate("python3")
    );
    for (const absoluteBin of getWindowsAbsolutePythonBins()) {
      candidates.push(toPythonCandidate(absoluteBin));
    }
  } else {
    candidates.push(toPythonCandidate("python3"), toPythonCandidate("python"));
  }
  return dedupePythonCandidates(candidates);
};

const validateOpenpyxl = (pythonBin, prefixArgs = []) =>
  runCommandSync(pythonBin, [...prefixArgs, "-c", "import openpyxl; print('ok')"]);

const createVenv = (pythonBin, prefixArgs, venvDir) =>
  runCommandSync(pythonBin, [...prefixArgs, "-m", "venv", venvDir]);

const installOpenpyxl = (venvPython) => {
  const upgradePip = runCommandSync(venvPython, [
    "-m",
    "pip",
    "install",
    "--upgrade",
    "pip",
  ]);
  if (!upgradePip.ok) return upgradePip;
  return runCommandSync(venvPython, [
    "-m",
    "pip",
    "install",
    "--upgrade",
    "openpyxl",
  ]);
};

const ensureOpenpyxlRuntime = () => {
  const engine = toText(process.env.EXCEL_NATIVE_ENGINE).toLowerCase() || "openpyxl";
  if (!process.env.EXCEL_NATIVE_ENGINE) {
    process.env.EXCEL_NATIVE_ENGINE = "openpyxl";
  }
  if (engine === "com") {
    return { skipped: true, reason: "engine=com" };
  }

  const autoBootstrap = isTruthy(process.env.EXCEL_NATIVE_AUTO_BOOTSTRAP, true);
  const runtimeRoot = resolveRuntimeRoot();
  const runtimeRoots = resolveRuntimeRoots();
  const venvDir = path.join(runtimeRoot, "venv");
  const venvPython = resolveVenvPython(venvDir);

  // 1) Use configured python if valid.
  const envPythonCandidate = parsePythonCandidate(process.env.EXCEL_NATIVE_PYTHON_BIN);
  if (envPythonCandidate?.bin) {
    const check = validateOpenpyxl(envPythonCandidate.bin, envPythonCandidate.prefixArgs);
    if (check.ok) {
      return { ok: true, pythonBin: envPythonCandidate.bin, source: "env" };
    }
  }

  // 2) Use existing managed venv (cualquier runtime root válido) if valid.
  for (const root of runtimeRoots) {
    const venvDir = path.join(root, "venv");
    const venvPython = resolveVenvPython(venvDir);
    if (!fs.existsSync(venvPython)) continue;
    const check = validateOpenpyxl(venvPython);
    if (check.ok) {
      process.env.EXCEL_NATIVE_RUNTIME_DIR = root;
      process.env.EXCEL_NATIVE_PYTHON_BIN = venvPython;
      return { ok: true, pythonBin: venvPython, source: "managed-venv", runtimeRoot: root };
    }
  }

  if (!autoBootstrap) {
    return {
      ok: false,
      reason: "auto-bootstrap-disabled",
      runtimeRoot,
    };
  }

  try {
    fs.mkdirSync(runtimeRoot, { recursive: true });
  } catch (_) {
    // ignore
  }

  // 3) Bootstrap managed venv with first available base python.
  const candidates = getBootstrapPythonCandidates();
  let lastError = null;
  for (const candidate of candidates) {
    const { bin, prefixArgs } = candidate;
    const checkBase = runCommandSync(bin, [...prefixArgs, "--version"]);
    if (!checkBase.ok) {
      lastError = checkBase.error || new Error(checkBase.stderr || "python not found");
      continue;
    }

    const mkVenv = createVenv(bin, prefixArgs, venvDir);
    if (!mkVenv.ok) {
      lastError = new Error(mkVenv.stderr || mkVenv.stdout || "No se pudo crear venv");
      continue;
    }

    const pipInstall = installOpenpyxl(venvPython);
    if (!pipInstall.ok) {
      lastError = new Error(
        pipInstall.stderr || pipInstall.stdout || "No se pudo instalar openpyxl"
      );
      continue;
    }

    const checkManaged = validateOpenpyxl(venvPython);
    if (!checkManaged.ok) {
      lastError = new Error(
        checkManaged.stderr || checkManaged.stdout || "openpyxl no disponible"
      );
      continue;
    }

    process.env.EXCEL_NATIVE_PYTHON_BIN = venvPython;
    process.env.EXCEL_NATIVE_RUNTIME_DIR = runtimeRoot;
    return {
      ok: true,
      pythonBin: venvPython,
      source: "bootstrapped-venv",
      runtimeRoot,
    };
  }

  return {
    ok: false,
    reason: "bootstrap-failed",
    runtimeRoot,
    error: lastError ? String(lastError.message || lastError) : "unknown",
  };
};

const ensureExcelNativeDefaults = () => {
  if (!process.env.EXCEL_NATIVE_ENGINE) {
    process.env.EXCEL_NATIVE_ENGINE = "openpyxl";
  }
  if (!process.env.EXCEL_NATIVE_TIMEOUT_MS) {
    process.env.EXCEL_NATIVE_TIMEOUT_MS = "300000";
  }
  if (!process.env.EXCEL_NATIVE_PYTHON_TIMEOUT_MS) {
    process.env.EXCEL_NATIVE_PYTHON_TIMEOUT_MS =
      process.env.EXCEL_NATIVE_TIMEOUT_MS || "300000";
  }
  if (!process.env.EXCEL_NATIVE_JOB_TIMEOUT_MS) {
    process.env.EXCEL_NATIVE_JOB_TIMEOUT_MS =
      process.env.EXCEL_NATIVE_TIMEOUT_MS || "300000";
  }
  if (!process.env.EXCEL_NATIVE_JOB_RETRY_TIMEOUT_MS) {
    process.env.EXCEL_NATIVE_JOB_RETRY_TIMEOUT_MS =
      process.env.EXCEL_NATIVE_TIMEOUT_MS || "300000";
  }
  if (!process.env.EXCEL_NATIVE_JOB_HARD_TIMEOUT_MS) {
    const base =
      Number(process.env.EXCEL_NATIVE_JOB_TIMEOUT_MS || 300000) +
      Number(process.env.EXCEL_NATIVE_JOB_RETRY_TIMEOUT_MS || 300000) +
      120000;
    process.env.EXCEL_NATIVE_JOB_HARD_TIMEOUT_MS = String(Math.max(base, 600000));
  }
  if (!process.env.EXCEL_NATIVE_AUTO_BOOTSTRAP) {
    process.env.EXCEL_NATIVE_AUTO_BOOTSTRAP = "1";
  }
};

const bootstrapExcelNativeRuntime = () => {
  ensureExcelNativeDefaults();
  const result = ensureOpenpyxlRuntime();
  if (result?.ok) {
    console.log(
      `✓ Excel nativo listo (${process.env.EXCEL_NATIVE_ENGINE}) - Python: ${result.pythonBin}`
    );
  } else if (result?.skipped) {
    console.log(`ℹ Excel nativo: ${result.reason}`);
  } else {
    console.warn(
      `⚠ Excel nativo no quedó preparado automáticamente: ${result?.reason || "unknown"}`
    );
    if (result?.error) {
      console.warn(`  Detalle: ${result.error}`);
    }
  }
  return result;
};

module.exports = {
  bootstrapExcelNativeRuntime,
  ensureExcelNativeDefaults,
  ensureOpenpyxlRuntime,
};
