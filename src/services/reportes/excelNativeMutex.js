const normalizarTimeoutMs = (value, fallbackMs, minMs = 10000) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallbackMs;
  return Math.max(minMs, Math.round(parsed));
};

const DEFAULT_WAIT_TIMEOUT_MS = normalizarTimeoutMs(
  process.env.EXCEL_NATIVE_LOCK_WAIT_TIMEOUT_MS,
  1000 * 60 * 8,
  15000
);
const DEFAULT_HOLD_TIMEOUT_MS = normalizarTimeoutMs(
  process.env.EXCEL_NATIVE_LOCK_HOLD_TIMEOUT_MS,
  1000 * 60 * 8,
  15000
);

let lockSeq = 0;
let activeLock = null;
const queue = [];

const crearTimeoutError = (phase, timeoutMs, label = "") => {
  const suffix = label ? ` (${label})` : "";
  const error = new Error(
    `Excel native lock timeout [${phase}] (${Math.round(timeoutMs / 1000)}s)${suffix}`
  );
  error.code = "EXCEL_NATIVE_LOCK_TIMEOUT";
  error.phase = phase;
  error.timeoutMs = timeoutMs;
  if (label) error.label = label;
  return error;
};

const procesarCola = () => {
  if (activeLock || queue.length === 0) return;
  const entry = queue.shift();
  if (!entry) return;

  if (entry.waitTimer) {
    clearTimeout(entry.waitTimer);
    entry.waitTimer = null;
  }

  activeLock = {
    id: entry.id,
    label: entry.label || "",
    startedAt: Date.now(),
  };

  let settled = false;
  const finalize = (cb, value) => {
    if (settled) return;
    settled = true;
    if (entry.holdTimer) {
      clearTimeout(entry.holdTimer);
      entry.holdTimer = null;
    }
    if (activeLock && activeLock.id === entry.id) {
      activeLock = null;
    }
    cb(value);
    setImmediate(procesarCola);
  };

  entry.holdTimer = setTimeout(() => {
    finalize(
      entry.reject,
      crearTimeoutError("hold", entry.holdTimeoutMs, entry.label)
    );
  }, entry.holdTimeoutMs);

  Promise.resolve()
    .then(() => entry.task())
    .then((result) => finalize(entry.resolve, result))
    .catch((error) => finalize(entry.reject, error));
};

const withExcelNativeLock = (task, options = {}) => {
  if (typeof task !== "function") {
    return Promise.reject(
      new Error("withExcelNativeLock requiere una función task().")
    );
  }

  const waitTimeoutMs = normalizarTimeoutMs(
    options.waitTimeoutMs,
    DEFAULT_WAIT_TIMEOUT_MS,
    15000
  );
  const holdTimeoutMs = normalizarTimeoutMs(
    options.holdTimeoutMs,
    DEFAULT_HOLD_TIMEOUT_MS,
    15000
  );
  const label =
    typeof options.label === "string" && options.label.trim()
      ? options.label.trim()
      : "";
  const id = ++lockSeq;

  return new Promise((resolve, reject) => {
    const entry = {
      id,
      label,
      task,
      waitTimeoutMs,
      holdTimeoutMs,
      waitTimer: null,
      holdTimer: null,
      resolve,
      reject,
    };

    entry.waitTimer = setTimeout(() => {
      const idx = queue.findIndex((item) => item.id === id);
      if (idx < 0) return;
      queue.splice(idx, 1);
      reject(crearTimeoutError("wait", waitTimeoutMs, label));
    }, waitTimeoutMs);

    queue.push(entry);
    procesarCola();
  });
};

const getExcelNativeLockState = () => ({
  queueLength: queue.length,
  active: activeLock
    ? {
        id: activeLock.id,
        label: activeLock.label || "",
        startedAt: activeLock.startedAt,
      }
    : null,
});

module.exports = { withExcelNativeLock, getExcelNativeLockState };
