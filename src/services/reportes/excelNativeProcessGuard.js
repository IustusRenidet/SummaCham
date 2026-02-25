const { spawn } = require("child_process");

const EXCEL_NATIVE_KILL_TIMEOUT_MS = Math.max(
  1000,
  Number(process.env.EXCEL_NATIVE_KILL_TIMEOUT_MS || 7000)
);

const EXCEL_NATIVE_FORCE_KILL_EXCEL =
  process.platform === "win32" &&
  String(process.env.EXCEL_NATIVE_FORCE_KILL_EXCEL || "1").trim() !== "0";

const EXCEL_NATIVE_FORCE_KILL_BEFORE_RUN =
  EXCEL_NATIVE_FORCE_KILL_EXCEL &&
  String(process.env.EXCEL_NATIVE_FORCE_KILL_BEFORE_RUN || "1").trim() !== "0";

const EXCEL_NATIVE_FORCE_KILL_ON_TIMEOUT =
  EXCEL_NATIVE_FORCE_KILL_EXCEL &&
  String(process.env.EXCEL_NATIVE_FORCE_KILL_ON_TIMEOUT || "1").trim() !== "0";

const cleanupExcelProcesses = (
  reason = "unknown",
  timeoutMs = EXCEL_NATIVE_KILL_TIMEOUT_MS
) =>
  new Promise((resolve) => {
    if (!EXCEL_NATIVE_FORCE_KILL_EXCEL) {
      resolve({
        attempted: false,
        killed: false,
        notFound: false,
        code: null,
        reason,
      });
      return;
    }

    const timeout = Math.max(
      1000,
      Number(timeoutMs) || EXCEL_NATIVE_KILL_TIMEOUT_MS
    );
    let settled = false;
    let stderr = "";
    const done = (result = {}) => {
      if (settled) return;
      settled = true;
      clearTimeout(failSafe);
      resolve({
        attempted: true,
        killed: false,
        notFound: false,
        code: null,
        reason,
        ...result,
      });
    };

    const proc = spawn("taskkill", ["/IM", "EXCEL.EXE", "/T", "/F"], {
      windowsHide: true,
      stdio: ["ignore", "ignore", "pipe"],
    });

    const failSafe = setTimeout(() => {
      try {
        if (!proc.killed) {
          proc.kill("SIGKILL");
        }
      } catch (_) {
        // ignore
      }
      done({ code: -1 });
    }, timeout);

    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    proc.on("error", () => done({ code: -2 }));
    proc.on("close", (code) => {
      const stderrLower = String(stderr || "").toLowerCase();
      const notFound =
        code === 128 ||
        stderrLower.includes("not found") ||
        stderrLower.includes("no hay ninguna instancia") ||
        stderrLower.includes("no se encontro ningun proceso");
      done({
        code,
        killed: code === 0,
        notFound,
      });
    });
  });

module.exports = {
  EXCEL_NATIVE_KILL_TIMEOUT_MS,
  EXCEL_NATIVE_FORCE_KILL_BEFORE_RUN,
  EXCEL_NATIVE_FORCE_KILL_ON_TIMEOUT,
  cleanupExcelProcesses,
};

