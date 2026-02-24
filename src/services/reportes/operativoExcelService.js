const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const XLSX = require("xlsx");
const { withExcelNativeLock } = require("./excelNativeMutex");

const limpiarTexto = (valor) => (valor == null ? "" : String(valor).trim());

const normalizarNumero = (valor) => {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
};

const quitarAcentos = (texto) =>
  texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "_");

const capitalizar = (texto) => {
  if (!texto) return texto;
  return texto.charAt(0).toUpperCase() + texto.slice(1);
};

const crearHojaOperativo = ({ label, filas, metadata }) => {
  const etiqueta = capitalizar(limpiarTexto(label || "Elemento"));
  const empresa = limpiarTexto(metadata.empresa || "");
  const mes = limpiarTexto(metadata.mes || "");
  const anio = limpiarTexto(metadata.anio || "");
  const periodo = [mes, anio].filter(Boolean).join(" ").trim();
  const fecha = new Date().toISOString().slice(0, 10);
  const annualLabel = anio ? `Presupuesto ${anio}` : "Presupuesto";

  const header = [
    etiqueta || "Elemento",
    "Ppto Acumulado",
    "Real Acumulado",
    annualLabel,
  ];
  const rows = (Array.isArray(filas) ? filas : []).map((fila) => [
    limpiarTexto(fila.etiqueta || ""),
    normalizarNumero(fila.presupuesto),
    normalizarNumero(fila.real),
    normalizarNumero(fila.anual != null ? fila.anual : fila.presupuesto),
  ]);

  const aoa = [
    ["RESULTADOS OPERATIVOS"],
    ["Categoria", etiqueta || "Elemento"],
    ["Empresa", empresa],
    ["Periodo", periodo],
    ["Fecha exportacion", fecha],
    [],
    header,
    ...rows,
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [{ wch: 42 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];
  return ws;
};

const normalizarNombreHoja = (valor, fallback) => {
  const texto = limpiarTexto(valor || "");
  if (!texto) return fallback;
  const limpio = texto.replace(/[\\/*?:\[\]]/g, "").slice(0, 31);
  return limpio || fallback;
};

const normalizarModoGrafica = (valor) => {
  const modo = (valor || "").toString().trim().toLowerCase();
  return modo === "combined" ? "combined" : "split";
};

const resolverScript = () => {
  const basePath = path.join(__dirname, "..", "..", "..");
  return path.join(basePath, "scripts", "export-operativo-charts.ps1");
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

const generarOperativoExcel = async ({
  label,
  filas,
  empresa,
  mes,
  anio,
  nombreArchivo,
  libroBuffer,
  dataSheetName,
  chartsSheetName,
  tableSheetName,
  chartMode,
  seriesMeta,
  timeoutMs,
}) => {
  const nativeTimeoutMs = normalizarTimeoutMs(timeoutMs, EXCEL_NATIVE_TIMEOUT_MS);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "operativo-"));
  const inputPath = path.join(tempDir, "operativo.xlsx");
  const outputPath = path.join(tempDir, "operativo_graficas.xlsx");
  const scriptTemp = path.join(tempDir, "export-operativo-charts.ps1");
  const hojaDatos = normalizarNombreHoja(dataSheetName, "OperativoData");
  const hojaGraficas = normalizarNombreHoja(chartsSheetName, "Gráficas");
  const hojaTabla = normalizarNombreHoja(tableSheetName, "");
  const modoGrafica = normalizarModoGrafica(chartMode);

  try {
    if (libroBuffer && libroBuffer.length) {
      const buffer = Buffer.isBuffer(libroBuffer)
        ? libroBuffer
        : Buffer.from(libroBuffer);
      fs.writeFileSync(inputPath, buffer);
    } else {
      const wb = XLSX.utils.book_new();
      const hoja = crearHojaOperativo({
        label,
        filas,
        metadata: { empresa, mes, anio },
      });
      XLSX.utils.book_append_sheet(wb, hoja, hojaDatos);
      XLSX.writeFile(wb, inputPath);
    }

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
      "-ChartMode",
      modoGrafica,
    ];
    if (typeof seriesMeta === "string" && seriesMeta.trim()) {
      psArgs.push("-SeriesMeta", seriesMeta.trim());
    }

    try {
      await withExcelNativeLock(() =>
        ejecutarPowerShell(psArgs, nativeTimeoutMs)
      );
    } catch (errorNative) {
      // Algunos libros generados en cliente pueden disparar "formato/extensión no válidos"
      // en Excel COM aunque sigan siendo reparables. Reintentar tras normalizar.
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

    const baseName = `${limpiarTexto(nombreArchivo || "Operativo")}_${limpiarTexto(
      empresa || "Reporte"
    )}_${limpiarTexto(mes)}_${limpiarTexto(anio)}`;
    const safeBase = quitarAcentos(baseName || "Operativo");
    const filename = `${safeBase}_Graficas.xlsx`.replace(/_+/g, "_");

    const buffer = fs.readFileSync(outputPath);
    return { buffer, filename };
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn("No se pudo limpiar temporal operativo:", error.message);
    }
  }
};

module.exports = { generarOperativoExcel };
