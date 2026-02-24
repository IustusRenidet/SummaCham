const crypto = require("crypto");
const { generarOperativoExcel } = require("./operativoExcelService");
const { generarResumenExcel } = require("./resumenExcelService");

const JOB_TTL_MS = 1000 * 60 * 90; // 90 minutos
const JOB_STALE_PENDING_MS = 1000 * 60 * 60 * 6; // 6 horas
const jobs = new Map();

const now = () => Date.now();
const DEFAULT_JOB_NATIVE_TIMEOUT_MS = 60000;
const DEFAULT_JOB_NATIVE_RETRY_TIMEOUT_MS = 120000;
const normalizarTimeoutMs = (value, fallbackMs, minMs = 10000) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallbackMs;
  return Math.max(minMs, Math.round(parsed));
};
const EXCEL_NATIVE_JOB_TIMEOUT_MS = normalizarTimeoutMs(
  process.env.EXCEL_NATIVE_JOB_TIMEOUT_MS,
  DEFAULT_JOB_NATIVE_TIMEOUT_MS,
  20000
);
const EXCEL_NATIVE_JOB_RETRY_TIMEOUT_MS = normalizarTimeoutMs(
  process.env.EXCEL_NATIVE_JOB_RETRY_TIMEOUT_MS,
  Math.max(DEFAULT_JOB_NATIVE_RETRY_TIMEOUT_MS, EXCEL_NATIVE_JOB_TIMEOUT_MS),
  EXCEL_NATIVE_JOB_TIMEOUT_MS
);

const leerString = (value) => {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0] || "";
  return "";
};

const sanitizeParams = (raw = {}) => ({
  nombreArchivo: leerString(raw.nombreArchivo),
  empresa: leerString(raw.empresa),
  mes: leerString(raw.mes),
  anio: leerString(raw.anio),
  dataSheetName: leerString(raw.dataSheetName),
  chartsSheetName: leerString(raw.chartsSheetName),
  tableSheetName: leerString(raw.tableSheetName),
  chartMode: leerString(raw.chartMode),
  seriesMeta: leerString(raw.seriesMeta),
});

const cleanupJobs = () => {
  const ts = now();
  jobs.forEach((job, id) => {
    if (!job) {
      jobs.delete(id);
      return;
    }
    const age = ts - (job.updatedAt || job.createdAt || ts);
    const isFinal = job.status === "completed" || job.status === "failed";
    if (isFinal && age > JOB_TTL_MS) {
      jobs.delete(id);
      return;
    }
    if (!isFinal && age > JOB_STALE_PENDING_MS) {
      jobs.delete(id);
    }
  });
};

const safeError = (error) => {
  const raw = (error && (error.message || error.toString())) || "Error desconocido";
  return String(raw).slice(0, 800);
};

const esTimeoutNativo = (error) => {
  const texto = String(error?.message || error || "").toLowerCase();
  return texto.includes("timeout");
};

const serializeJob = (job) => ({
  id: job.id,
  tipo: job.tipo,
  status: job.status,
  progress: Number.isFinite(Number(job.progress)) ? Number(job.progress) : 0,
  message: job.message || "",
  filename: job.filename || "",
  createdAt: job.createdAt,
  updatedAt: job.updatedAt,
  error: job.error || "",
});

const createNativeExcelJob = ({ userId, tipo, libroBuffer, params = {} }) => {
  cleanupJobs();
  const id = crypto.randomUUID();
  const createdAt = now();
  const job = {
    id,
    userId,
    tipo,
    status: "queued",
    progress: 5,
    message: "En cola",
    createdAt,
    updatedAt: createdAt,
    params: sanitizeParams(params),
    filename: "",
    buffer: null,
    error: "",
  };
  jobs.set(id, job);

  const run = async () => {
    const current = jobs.get(id);
    if (!current) return;
    current.status = "running";
    current.progress = 28;
    current.message = "Generando gráficas nativas";
    current.updatedAt = now();
    try {
      const payloadBase = {
        libroBuffer,
        ...current.params,
      };
      const generarConTimeout = (timeoutMs) => {
        const payload = {
          ...payloadBase,
          timeoutMs,
        };
        return tipo === "resumen"
          ? generarResumenExcel(payload)
          : generarOperativoExcel(payload);
      };

      let result;
      try {
        result = await generarConTimeout(EXCEL_NATIVE_JOB_TIMEOUT_MS);
      } catch (fastError) {
        if (!esTimeoutNativo(fastError)) {
          throw fastError;
        }
        current.progress = 62;
        current.message = "Reintentando exportación nativa";
        current.updatedAt = now();
        result = await generarConTimeout(EXCEL_NATIVE_JOB_RETRY_TIMEOUT_MS);
      }

      current.buffer = result.buffer;
      current.filename = result.filename;
      current.status = "completed";
      current.progress = 100;
      current.message = "Completado";
      current.error = "";
      current.updatedAt = now();
    } catch (error) {
      current.status = "failed";
      current.progress = 100;
      current.message = "Falló la exportación nativa";
      current.error = safeError(error);
      current.updatedAt = now();
      console.error("Export job failed:", { id, tipo, error });
    }
  };

  setImmediate(run);
  return serializeJob(job);
};

const getJobForUser = ({ userId, jobId }) => {
  cleanupJobs();
  const job = jobs.get(jobId);
  if (!job) return null;
  if (String(job.userId) !== String(userId)) return null;
  return serializeJob(job);
};

const getJobDownloadForUser = ({ userId, jobId }) => {
  cleanupJobs();
  const job = jobs.get(jobId);
  if (!job) return null;
  if (String(job.userId) !== String(userId)) return null;
  return job;
};

module.exports = {
  createNativeExcelJob,
  getJobForUser,
  getJobDownloadForUser,
};
