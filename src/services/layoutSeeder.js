const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const EMPRESA_DEFAULT = "EMPRESA01";

const OPERACION_TIPOS = [
  "sum-row",
  "sum-row-sumavarios",
  "sum-row-sumavarios-consolidado",
  "sum-row-operativo",
  "sum-row-operativo-consolidado",
  "result-row",
  "net-row",
  "net-row-adicional",
  "result-net-row",
];

const preferirValor = (obj = {}, claves = [], fallback = "") => {
  for (const clave of claves) {
    if (obj[clave] != null && obj[clave] !== "") {
      return obj[clave];
    }
  }
  return fallback;
};

const normalizarTexto = (valor, defecto = "") =>
  valor == null ? defecto : String(valor).trim();

const limpiarTextoPlano = (valor) =>
  valor == null ? "" : String(valor).trim();

const normalizarClaveExcel = (valor) =>
  limpiarTextoPlano(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

const normalizarCapitulo = (valor) => {
  const texto = normalizarTexto(valor);
  return texto || "DEFAULT";
};

const generarRangoAnios = (inicio, fin) => {
  const lista = [];
  for (let anio = inicio; anio <= fin; anio += 1) {
    lista.push(anio);
  }
  return lista;
};

const ANIOS_RESUMEN_ANTIGUOS = generarRangoAnios(2005, 2024);
const ANIOS_RESUMEN_NUEVOS = generarRangoAnios(2025, 2030);
const ANIOS_MODULOS_OPERATIVOS = generarRangoAnios(2005, 2025);
const ANIOS_CDMX_LAYOUT = generarRangoAnios(2005, 2025);

const leerJsonSiExiste = (ruta) => {
  try {
    if (fs.existsSync(ruta)) {
      const contenido = fs.readFileSync(ruta, "utf-8");
      return JSON.parse(contenido);
    }
  } catch (error) {
    console.warn(`[layoutSeeder] No se pudo leer ${ruta}:`, error.message);
  }
  return null;
};

const resolverDirectorioInfoImportante = () => {
  const candidatos = [];
  const posiblesBases = [
    path.resolve(__dirname, "../../info IMPORTANTE"),
    path.resolve(__dirname, "../../info_importante"),
    path.resolve(process.cwd(), "info IMPORTANTE"),
    path.resolve(process.cwd(), "info_importante"),
  ];

  posiblesBases.forEach((ruta) => candidatos.push(ruta));

  if (process.resourcesPath) {
    candidatos.push(path.join(process.resourcesPath, "info IMPORTANTE"));
    candidatos.push(path.join(process.resourcesPath, "info_importante"));
  }

  for (const candidato of candidatos) {
    try {
      if (candidato && fs.existsSync(candidato)) {
        return candidato;
      }
    } catch (_) {
      // Ignorar errores de acceso
    }
  }

  return null;
};

const agruparPorCapitulo = (cuentas = []) => {
  const mapa = new Map();
  cuentas.forEach((cuenta, indice) => {
    const capitulo = normalizarCapitulo(cuenta.CAPITULO || cuenta.HOJA);
    if (!mapa.has(capitulo)) {
      mapa.set(capitulo, []);
    }
    mapa.get(capitulo).push({ ...cuenta, __ordenFallback: indice });
  });
  return mapa;
};

const inferirSigno = (clase = "") => {
  const texto = clase.toLowerCase();
  if (texto.includes("expense") || texto.includes("gasto")) {
    return -1;
  }
  return 1;
};

const limpiarLayout = (db, { empresaId, modulo, anio }) => {
  const params = [empresaId, modulo, anio];
  db.prepare(
    `DELETE FROM layout_cuentas WHERE empresa_id = ? AND modulo = ? AND anio = ?`
  ).run(...params);
  db.prepare(
    `DELETE FROM layout_operaciones WHERE empresa_id = ? AND modulo = ? AND anio = ?`
  ).run(...params);
  db.prepare(
    `DELETE FROM layout_secciones WHERE empresa_id = ? AND modulo = ? AND anio = ?`
  ).run(...params);
};

const limpiarLayoutPorCapitulo = (db, { empresaId, modulo, anio, capitulo }) => {
  const params = [empresaId, modulo, anio, capitulo];
  db.prepare(
    `DELETE FROM layout_cuentas WHERE empresa_id = ? AND modulo = ? AND anio = ? AND capitulo = ?`
  ).run(...params);
  db.prepare(
    `DELETE FROM layout_operaciones WHERE empresa_id = ? AND modulo = ? AND anio = ? AND capitulo = ?`
  ).run(...params);
  db.prepare(
    `DELETE FROM layout_secciones WHERE empresa_id = ? AND modulo = ? AND anio = ? AND capitulo = ?`
  ).run(...params);
};

const prepararInsertarCuenta = (db) =>
  db.prepare(
    `
    INSERT OR REPLACE INTO layout_cuentas (
      empresa_id, modulo, anio, cuenta, nombre, capitulo,
      seccion_principal, seccion_secundaria, orden, creado_en, actualizado_en
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `
  );

const prepararInsertarOperacion = (db) =>
  db.prepare(
    `
    INSERT OR IGNORE INTO layout_operaciones (
      empresa_id, modulo, anio, capitulo, clase, seccion,
      operacion_tipo, operacion_label, signo, orden, creado_en, actualizado_en
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `
  );

const prepararInsertarSeccion = (db) =>
  db.prepare(
    `
    INSERT OR REPLACE INTO layout_secciones (
      empresa_id, modulo, anio, capitulo,
      seccion_principal, seccion_secundaria, tipo, orden,
      creado_en, actualizado_en
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `
  );

const sembrarCuentas = ({
  db,
  empresaId,
  modulo,
  anio,
  cuentasAgrupadas,
  insertCuenta,
  insertSeccion,
}) => {
  let insertadas = 0;
  let indiceGlobal = 0;
  const tx = db.transaction(() => {
    cuentasAgrupadas.forEach(({ capitulo, cuentas }) => {
      const seccionesRegistradas = new Set();

      cuentas
        .sort(
          (a, b) =>
            (a.orden ?? a.__ordenFallback) - (b.orden ?? b.__ordenFallback)
        )
        .forEach((cuenta) => {
          const cuentaCodigo = normalizarTexto(cuenta.CUENTA);
          if (!cuentaCodigo) {
            return;
          }

          const nombre =
            normalizarTexto(cuenta.NOMBRE) || normalizarTexto(cuentaCodigo);
          const seccionPrincipal = normalizarTexto(
            preferirValor(cuenta, [
              "SECCIÓN Principal",
              "SECCIàN Principal",
              "SECCION Principal",
              "SECCION",
              "SECCION Principal ",
              "SECCION_Principal",
            ])
          );
          const seccionSecundaria = normalizarTexto(
            preferirValor(cuenta, [
              "SECCION Secundaria",
              "SECCIÓN Secundaria",
              "SECCION_SECUNDARIA",
            ])
          );

          const orden = Number.isFinite(Number(cuenta.orden))
            ? Number(cuenta.orden)
            : indiceGlobal;

          insertCuenta.run(
            empresaId,
            modulo,
            anio,
            cuentaCodigo,
            nombre,
            capitulo,
            seccionPrincipal,
            seccionSecundaria || null,
            orden
          );
          insertadas += 1;
          indiceGlobal += 1;

          const clavePrincipal = `${capitulo}::${seccionPrincipal || "DEFAULT"}`;
          if (seccionPrincipal && !seccionesRegistradas.has(clavePrincipal)) {
            insertSeccion.run(
              empresaId,
              modulo,
              anio,
              capitulo,
              seccionPrincipal,
              null,
              "principal",
              orden
            );
            seccionesRegistradas.add(clavePrincipal);
          }

          if (seccionSecundaria) {
            const claveSecundaria = `${capitulo}::${seccionPrincipal}::${seccionSecundaria}`;
            if (!seccionesRegistradas.has(claveSecundaria)) {
              insertSeccion.run(
                empresaId,
                modulo,
                anio,
                capitulo,
                seccionPrincipal,
                seccionSecundaria,
                "secundaria",
                orden
              );
              seccionesRegistradas.add(claveSecundaria);
            }
          }
        });
    });
  });

  tx();
  return insertadas;
};

const filtrarOperacionesPorModulo = (operaciones = [], modulo) =>
  operaciones.filter((op) => {
    const hoja = normalizarTexto(op.HOJA || op.modulo || modulo).toUpperCase();
    return hoja === modulo.toUpperCase();
  });

const sembrarOperaciones = ({
  db,
  empresaId,
  modulo,
  anio,
  operaciones,
  insertOperacion,
}) => {
  if (!operaciones.length) {
    return 0;
  }
  let insertadas = 0;
  const tx = db.transaction(() => {
    operaciones.forEach((operacion, indice) => {
      const capitulo = normalizarCapitulo(operacion.CAPITULO);
      const clase = normalizarTexto(operacion.Clase || operacion.clase || "");
      const seccion = normalizarTexto(
        operacion.SECCION || operacion.seccion || ""
      );
      const signo =
        Number.isInteger(operacion.signo) && operacion.signo !== 0
          ? operacion.signo
          : inferirSigno(clase);

      OPERACION_TIPOS.forEach((tipo, tipoIndex) => {
        const etiqueta = operacion[tipo];
        if (!etiqueta) {
          return;
        }
        const res = insertOperacion.run(
          empresaId,
          modulo,
          anio,
          capitulo,
          clase || `operacion-${indice}`,
          seccion,
          tipo,
          etiqueta,
          signo,
          indice * 100 + tipoIndex
        );
        if (res && res.changes && res.changes > 0) {
          insertadas += 1;
        } else {
          // Insert was ignored (already exists) - do not overwrite existing label from another source
        }
      });
    });
  });

  tx();
  return insertadas;
};

const procesarArchivoSummaryResumen = ({
  db,
  empresaId,
  baseDir,
  archivo,
  modulos,
  operacionesCompartidas = true,
  force = false,
  resumen,
}) => {
  const ruta = path.join(baseDir, archivo);
  const contenido = leerJsonSiExiste(ruta);
  if (!contenido) {
    return;
  }

  const insertCuenta = prepararInsertarCuenta(db);
  const insertOperacion = prepararInsertarOperacion(db);
  const insertSeccion = prepararInsertarSeccion(db);

  modulos.forEach(({ nombre, anios }) => {
    const datosModulo = contenido[nombre];
    if (!Array.isArray(datosModulo) || !datosModulo.length) {
      console.warn(
        `[layoutSeeder] ${archivo} no contiene datos para ${nombre}`
      );
      return;
    }

    const operacionesOrigen = Array.isArray(
      contenido["SUMA DE VARIAS SECCIONES"]
    )
      ? filtrarOperacionesPorModulo(
          contenido["SUMA DE VARIAS SECCIONES"],
          operacionesCompartidas ? nombre : nombre
        )
      : [];

    anios.forEach((anio) => {
      // Verificar si ya existen cuentas
      const existenCuentas = db
        .prepare(
          `SELECT COUNT(*) as total FROM layout_cuentas WHERE empresa_id = ? AND modulo = ? AND anio = ?`
        )
        .get(empresaId, nombre, anio);
      
      // Verificar si existen operaciones
      const existenOperaciones = db
        .prepare(
          `SELECT COUNT(*) as total FROM layout_operaciones WHERE empresa_id = ? AND modulo = ? AND anio = ?`
        )
        .get(empresaId, nombre, anio);
      
      // Si no forzamos y ya existen cuentas Y operaciones, saltamos
      if (!force && existenCuentas?.total > 0 && existenOperaciones?.total > 0) {
        return;
      }

      // Si hay operaciones en el origen pero no en destino, solo insertar operaciones
      if (!force && existenCuentas?.total > 0 && existenOperaciones?.total === 0 && operacionesOrigen.length > 0) {
        const insertOperacionPrep = prepararInsertarOperacion(db);
        const opsInsertadas = sembrarOperaciones({
          db,
          empresaId,
          modulo: nombre,
          anio,
          operaciones: operacionesOrigen,
          insertOperacion: insertOperacionPrep,
        });
        resumen.operaciones += opsInsertadas;
        resumen.detalles.push(
          `${nombre}-${anio}: ${opsInsertadas} operaciones (cuentas ya existían)`
        );
        return;
      }

      // Siembra completa (cuentas + operaciones)
      if (force || existenCuentas?.total === 0) {
        limpiarLayout(db, { empresaId, modulo: nombre, anio });

        const cuentasAgrupadas = Array.from(agruparPorCapitulo(datosModulo)).map(
          ([capitulo, cuentas]) => ({ capitulo, cuentas })
        );
        const insertadas = sembrarCuentas({
          db,
          empresaId,
          modulo: nombre,
          anio,
          insertCuenta,
          insertSeccion,
          cuentasAgrupadas,
        });
        const opsInsertadas = sembrarOperaciones({
          db,
          empresaId,
          modulo: nombre,
          anio,
          operaciones: operacionesOrigen,
          insertOperacion,
        });

        resumen.cuentas += insertadas;
        resumen.operaciones += opsInsertadas;
        resumen.detalles.push(
          `${nombre}-${anio}: ${insertadas} cuentas, ${opsInsertadas} operaciones`
        );
      }
    });
  });
};

const procesarModulosOperativos = ({ db, empresaId, baseDir, archivo, force, resumen }) => {
  const ruta = path.join(baseDir, archivo);
  const contenido = leerJsonSiExiste(ruta);
  if (!contenido) {
    return;
  }

  const insertCuenta = prepararInsertarCuenta(db);
  const insertSeccion = prepararInsertarSeccion(db);

  const modulosDisponibles = Object.keys(contenido || {});
  const insertOperacion = prepararInsertarOperacion(db);

  modulosDisponibles.forEach((clave) => {
    const cuentas = contenido[clave];
    if (!Array.isArray(cuentas) || !cuentas.length) {
      return;
    }

    const modulo = clave.trim();
    const anios = ANIOS_MODULOS_OPERATIVOS;

    anios.forEach((anio) => {
      if (!force) {
        const existentes = db
          .prepare(
            `SELECT COUNT(*) as total FROM layout_cuentas WHERE empresa_id = ? AND modulo = ? AND anio = ?`
          )
          .get(empresaId, modulo, anio);
        if (existentes?.total > 0) {
          return;
        }
      }

      limpiarLayout(db, { empresaId, modulo, anio });
      const cuentasAgrupadas = Array.from(agruparPorCapitulo(cuentas)).map(
        ([capitulo, cuentasCapitulo]) => ({
          capitulo,
          cuentas: cuentasCapitulo,
        })
      );
      const insertadas = sembrarCuentas({
        db,
        empresaId,
        modulo,
        anio,
        cuentasAgrupadas,
        insertCuenta,
        insertSeccion,
      });
      // Módulos operativos no tienen operaciones declaradas en JSON
      sembrarOperaciones({
        db,
        empresaId,
        modulo,
        anio,
        operaciones: [],
        insertOperacion,
      });

      resumen.cuentas += insertadas;
      resumen.detalles.push(`${modulo}-${anio}: ${insertadas} cuentas`);
    });
  });
};

const seedLayoutsFromJson = ({
  db,
  baseDir = null,
  empresaId = EMPRESA_DEFAULT,
  force = false,
} = {}) => {
  if (!db) {
    throw new Error("seedLayoutsFromJson requiere una conexión SQLite activa");
  }

  if (!force) {
    const total = db
      .prepare(`SELECT COUNT(*) as total FROM layout_cuentas`)
      .get();
    if (total?.total > 0) {
      return {
        ejecutado: false,
        motivo: "ya_existen_layouts",
        cuentas: 0,
        operaciones: 0,
        detalles: [],
      };
    }
  }

  const base = baseDir || resolverDirectorioInfoImportante();
  if (!base) {
    console.warn(
      "[layoutSeeder] No se encontró el directorio 'info IMPORTANTE' o 'info_importante'."
    );
    return {
      ejecutado: false,
      motivo: "sin_fuente_json",
      cuentas: 0,
      operaciones: 0,
      detalles: [],
    };
  }

  const resumen = { cuentas: 0, operaciones: 0, detalles: [] };

  procesarArchivoSummaryResumen({
    db,
    empresaId,
    baseDir: base,
    archivo: "CUENTAS SUMMARY y RESUMEN 2022-2024.json",
    modulos: [
      { nombre: "SUMMARY", anios: ANIOS_RESUMEN_ANTIGUOS },
      { nombre: "RESUMEN", anios: ANIOS_RESUMEN_ANTIGUOS },
    ],
    force,
    resumen,
  });

  procesarArchivoSummaryResumen({
    db,
    empresaId,
    baseDir: base,
    archivo: "CUENTAS SUMMARY y RESUMEN 2025.json",
    modulos: [
      { nombre: "SUMMARY", anios: ANIOS_RESUMEN_NUEVOS },
      { nombre: "RESUMEN", anios: ANIOS_RESUMEN_NUEVOS },
    ],
    force,
    resumen,
  });

  procesarArchivoSummaryResumen({
    db,
    empresaId,
    baseDir: base,
    archivo: "CUENTAS SUMMARY.json",
    modulos: [{ nombre: "SUMMARY", anios: ANIOS_RESUMEN_NUEVOS }],
    force,
    resumen,
  });

  procesarArchivoSummaryResumen({
    db,
    empresaId,
    baseDir: base,
    archivo: "CUENTAS SUMMARY y RESUMEN.json",
    modulos: [
      { nombre: "SUMMARY", anios: ANIOS_RESUMEN_NUEVOS },
      { nombre: "RESUMEN", anios: ANIOS_RESUMEN_NUEVOS },
    ],
    force,
    resumen,
  });

  procesarModulosOperativos({
    db,
    empresaId,
    baseDir: base,
    archivo: "CUENTAS.json",
    force,
    resumen,
  });

  return {
    ejecutado: true,
    cuentas: resumen.cuentas,
    operaciones: resumen.operaciones,
    detalles: resumen.detalles,
  };
};

const seedLayoutsDesdeExcelCdMx = ({
  db,
  baseDir = null,
  empresaId = EMPRESA_DEFAULT,
  capitulo = 'CIUDAD DE MEXICO',
  anios = ANIOS_CDMX_LAYOUT,
} = {}) => {
  if (!db) {
    throw new Error("seedLayoutsDesdeExcelCdMx requiere una conexión SQLite activa");
  }

  const base = baseDir || resolverDirectorioInfoImportante();
  if (!base) {
    console.warn("[layoutSeeder] No se encontró el directorio 'info IMPORTANTE'.");
    return { ejecutado: false, motivo: "sin_directorio" };
  }

  const archivoExcel = path.join(base, "CUENTAS GASTOS GENERALES Y FINANZAS CDMX.xlsx");
  if (!fs.existsSync(archivoExcel)) {
    console.warn(`[layoutSeeder] No se encontró el archivo de Excel CDMX: ${archivoExcel}`);
    return { ejecutado: false, motivo: "sin_excel" };
  }

  const libro = XLSX.readFile(archivoExcel, { cellDates: false });
  const hojaOperaciones = libro.Sheets["SUMA DE VARIAS SECCIONES"];
  const operacionesGlobales = hojaOperaciones
    ? XLSX.utils.sheet_to_json(hojaOperaciones, { defval: "" })
    : [];

  const resumen = { ejecutado: true, cuentas: 0, operaciones: 0, detalles: [] };
  const insertCuenta = prepararInsertarCuenta(db);
  const insertSeccion = prepararInsertarSeccion(db);
  const insertOperacion = prepararInsertarOperacion(db);
  const capituloNormalizado = normalizarClaveExcel(capitulo);

  const modulosExcel = [
    { hoja: "Gastos Generales", modulo: "Gastos Generales" },
    { hoja: "Finanzas", modulo: "Finanzas" }
  ];

  modulosExcel.forEach((def) => {
    const hoja = libro.Sheets[def.hoja];
    if (!hoja) {
      resumen.detalles.push(`Hoja '${def.hoja}' no encontrada en Excel.`);
      return;
    }

    const filasHoja = XLSX.utils.sheet_to_json(hoja, { defval: "" }) || [];
    const cuentas = filasHoja
      .map((row, idx) => {
        const cuenta = limpiarTextoPlano(row.CUENTA);
        const seccion = limpiarTextoPlano(row.SECCION);
        const capituloFila = normalizarClaveExcel(row.CAPITULO);
        if (!cuenta || capituloFila !== capituloNormalizado) {
          return null;
        }
        return {
          cuenta,
          nombre: limpiarTextoPlano(row.NOMBRE) || cuenta,
          seccion,
          orden: idx
        };
      })
      .filter(Boolean);

    if (!cuentas.length) {
      resumen.detalles.push(`Hoja '${def.hoja}' sin cuentas para ${capitulo}.`);
      return;
    }

    const operacionesFiltradas = operacionesGlobales
      .filter((fila) => {
        return (
          normalizarClaveExcel(fila.HOJA) === normalizarClaveExcel(def.hoja) &&
          normalizarClaveExcel(fila.CAPITULO) === capituloNormalizado
        );
      })
      .map((fila, idx) => ({
        CAPITULO: capitulo,
        Clase: `${def.modulo}-${fila.SECCION || `Operacion${idx + 1}`}`.trim(),
        SECCION: limpiarTextoPlano(fila.SECCION),
        ...fila
      }));

    anios.forEach((anio) => {
      limpiarLayoutPorCapitulo(db, {
        empresaId,
        modulo: def.modulo,
        anio,
        capitulo
      });

      let insertadasOperaciones = 0;
      const tx = db.transaction(() => {
        const seccionesRegistradas = new Set();
        cuentas.forEach((fila, idx) => {
          const orden = Number.isFinite(Number(fila.orden)) ? Number(fila.orden) : idx;
          insertCuenta.run(
            empresaId,
            def.modulo,
            anio,
            fila.cuenta,
            fila.nombre,
            capitulo,
            fila.seccion || '',
            null,
            orden
          );
          if (fila.seccion) {
            const clave = `${capitulo}::${fila.seccion}`;
            if (!seccionesRegistradas.has(clave)) {
              insertSeccion.run(
                empresaId,
                def.modulo,
                anio,
                capitulo,
                fila.seccion,
                null,
                "principal",
                orden
              );
              seccionesRegistradas.add(clave);
            }
          }
        });

        const opsInsertadas = sembrarOperaciones({
          db,
          empresaId,
          modulo: def.modulo,
          anio,
          operaciones: operacionesFiltradas,
          insertOperacion
        });
        insertadasOperaciones = opsInsertadas;
        resumen.operaciones += opsInsertadas;
      });

      tx();
      resumen.cuentas += cuentas.length;
      resumen.detalles.push(
        `${def.modulo} ${anio}: ${cuentas.length} cuentas, ${insertadasOperaciones} operaciones`
      );
    });
  });

  return resumen;
};

module.exports = {
  seedLayoutsFromJson,
  seedLayoutsDesdeExcelCdMx,
  resolverDirectorioInfoImportante,
};
