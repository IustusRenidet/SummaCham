const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const Datastore = require("@seald-io/nedb");
const bcrypt = require("bcryptjs");

const { MODULOS } = require("../config/modulos");
const { EMPRESAS } = require("../config/empresas");
const {
  normalizarUsuario,
  limpiarPermisosLista,
  esUsuarioPermitidoResumen,
  esAdministradorHistorico,
  esModuloRestringido,
  MODULOS_RESTRINGIDOS,
} = require("../services/usuariosPolicy");
const {
  seedLayoutsFromJson,
  seedLayoutsDesdeExcelCdMx,
  resolverDirectorioInfoImportante,
} = require("../services/layoutSeeder");

const VISTAS_POR_CAPITULO = {
  empresa1: [
    { vista: "Finanzas", archivo: "Finanzas.html" },
    { vista: "GastosGenerales", archivo: "GastosGenerales.html" },
    { vista: "Nomina", archivo: "Nomina.html" },
  ],
  empresa2: [{ vista: "GastosGenerales", archivo: "GastosGenerales.html" }],
  empresa3: [{ vista: "GastosGenerales", archivo: "GastosGenerales.html" }],
  empresa4: [{ vista: "GastosGenerales", archivo: "GastosGenerales.html" }],
};

const COLECCIONES = {
  usuarios: "usuarios",
  permisos_modulo: "permisos_modulo",
  presupuestos_estado: "presupuestos_estado",
  presupuestos_estado_historial: "presupuestos_estado_historial",
  notificaciones: "notificaciones",
  comentarios_celdas: "comentarios_celdas",
  presupuestos_guardados: "presupuestos_guardados",
  plan_borradores: "plan_borradores",
  plan_borradores_historial: "plan_borradores_historial",
  empresa_vistas: "empresa_vistas",
  layout_cuentas: "layout_cuentas",
  layout_operaciones: "layout_operaciones",
  layout_secciones: "layout_secciones",
  permisos_edicion_capitulo: "permisos_edicion_capitulo",
  layout_bitacora: "layout_bitacora",
  counters: "_counters",
  meta: "_meta",
};

const TABLAS_SQLITE = {
  usuarios: "usuarios",
  permisos_modulo: "permisos_modulo",
  presupuestos_estado: "presupuestos_estado",
  presupuestos_estado_historial: "presupuestos_estado_historial",
  notificaciones: "notificaciones",
  comentarios_celdas: "comentarios_celdas",
  presupuestos_guardados: "presupuestos_guardados",
  plan_borradores: "PLAN_BORRADORES",
  plan_borradores_historial: "PLAN_BORRADORES_HISTORIAL",
  empresa_vistas: "empresa_vistas",
  layout_cuentas: "layout_cuentas",
  layout_operaciones: "layout_operaciones",
  layout_secciones: "layout_secciones",
  permisos_edicion_capitulo: "permisos_edicion_capitulo",
  layout_bitacora: "layout_bitacora",
};

const UNIQUE_KEYS = {
  usuarios: (doc) => doc.usuario,
  permisos_modulo: (doc) =>
    `${doc.usuario_id}|${doc.empresa_id}|${doc.modulo}`,
  presupuestos_estado: (doc) =>
    `${doc.empresa_id}|${doc.modulo}|${doc.anio}|${doc.capitulo}`,
  empresa_vistas: (doc) => `${doc.empresa_id}|${doc.vista}`,
  layout_cuentas: (doc) =>
    `${doc.empresa_id}|${doc.modulo}|${doc.anio}|${doc.capitulo}|${doc.cuenta}`,
  layout_operaciones: (doc) =>
    `${doc.empresa_id}|${doc.modulo}|${doc.anio}|${doc.capitulo}|${doc.clase}|${doc.operacion_tipo}`,
  layout_secciones: (doc) =>
    `${doc.empresa_id}|${doc.modulo}|${doc.anio}|${doc.capitulo}|${doc.seccion_principal}|${
      doc.seccion_secundaria || ""
    }`,
  permisos_edicion_capitulo: (doc) => `${doc.usuario_id}|${doc.capitulo}`,
  plan_borradores: (doc) =>
    `${doc.empresaId}|${doc.modulo}|${doc.anio}|${doc.capitulo}`,
};

const ahoraSql = () => {
  const iso = new Date().toISOString();
  return iso.replace("T", " ").replace("Z", "").slice(0, 19);
};

const obtenerRutaBaseDatos = (() => {
  let rutaCache = null;
  return () => {
    if (rutaCache) {
      return rutaCache;
    }

    if (process.env.PANELAMCHAM_DATA_DIR) {
      rutaCache = path.resolve(process.env.PANELAMCHAM_DATA_DIR);
      return rutaCache;
    }

    const rutaLocal = path.resolve(__dirname, "../../datos");
    if (fs.existsSync(rutaLocal)) {
      rutaCache = rutaLocal;
      return rutaCache;
    }

    try {
      const electronModule = require("electron");
      if (electronModule?.app?.getPath) {
        rutaCache = path.join(electronModule.app.getPath("userData"), "datos");
        return rutaCache;
      }
    } catch (_) {
      // Sin electron disponible
    }

    rutaCache = path.join(process.cwd(), "datos");
    return rutaCache;
  };
})();

const asegurarDirectorio = (rutaBase) => {
  if (!fs.existsSync(rutaBase)) {
    fs.mkdirSync(rutaBase, { recursive: true });
  }
};

const obtenerDirectorioNeDB = () => {
  const base = obtenerRutaBaseDatos();
  const ruta = path.join(base, "nedb");
  asegurarDirectorio(ruta);
  return ruta;
};

const obtenerRutasSQLite = () => {
  const rutas = [];

  if (process.env.PANELAMCHAM_SEED_DB) {
    rutas.push(path.resolve(process.env.PANELAMCHAM_SEED_DB));
  }

  const base = obtenerRutaBaseDatos();
  rutas.push(path.join(base, "panel.sqlite"));
  rutas.push(path.resolve(process.cwd(), "datos", "panel.sqlite"));

  if (process.resourcesPath) {
    rutas.push(path.join(process.resourcesPath, "datos", "panel.sqlite"));
  }

  try {
    const electronModule = require("electron");
    if (electronModule?.app?.getAppPath) {
      rutas.push(
        path.join(electronModule.app.getAppPath(), "datos", "panel.sqlite")
      );
    }
  } catch (_) {
    // Ignorar: electron no disponible fuera de app empaquetada
  }

  return [...new Set(rutas.filter(Boolean))];
};

const resolverSQLiteDisponible = () => {
  const candidatos = obtenerRutasSQLite();
  for (const candidato of candidatos) {
    try {
      if (
        candidato &&
        fs.existsSync(candidato) &&
        fs.statSync(candidato).size > 0
      ) {
        return candidato;
      }
    } catch (_) {
      // Ignorar errores al verificar la ruta
    }
  }
  return null;
};

const cursorToPromise = (cursor) =>
  new Promise((resolve, reject) => {
    cursor.exec((err, docs) => {
      if (err) return reject(err);
      resolve(docs || []);
    });
  });

const loadDatabaseAsync = (store) =>
  new Promise((resolve, reject) => {
    store.loadDatabase((err) => {
      if (err) return reject(err);
      resolve();
    });
  });

const ensureIndexAsync = (store, options) =>
  new Promise((resolve, reject) => {
    store.ensureIndex(options, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });

const insertAsync = (store, doc) =>
  new Promise((resolve, reject) => {
    store.insert(doc, (err, newDoc) => {
      if (err) return reject(err);
      resolve(newDoc);
    });
  });

const updateAsync = (store, query, update, options = {}) =>
  new Promise((resolve, reject) => {
    store.update(query, update, options, (err, numAffected, affectedDocs, upsert) => {
      if (err) return reject(err);
      resolve({ numAffected, affectedDocs, upsert });
    });
  });

const removeAsync = (store, query, options = {}) =>
  new Promise((resolve, reject) => {
    store.remove(query, options, (err, numRemoved) => {
      if (err) return reject(err);
      resolve(numRemoved);
    });
  });

const findOneAsync = (store, query, projection) =>
  new Promise((resolve, reject) => {
    store.findOne(query, projection, (err, doc) => {
      if (err) return reject(err);
      resolve(doc || null);
    });
  });

const countAsync = (store, query) =>
  new Promise((resolve, reject) => {
    store.count(query, (err, count) => {
      if (err) return reject(err);
      resolve(count || 0);
    });
  });

const findAsync = (store, query, options = {}) => {
  const projection = options.projection || undefined;
  let cursor = store.find(query, projection);
  if (options.sort) {
    cursor = cursor.sort(options.sort);
  }
  if (options.skip != null) {
    cursor = cursor.skip(options.skip);
  }
  if (options.limit != null) {
    cursor = cursor.limit(options.limit);
  }
  return cursorToPromise(cursor);
};

const stores = {};
let initialized = false;

const prepararDocumento = async (nombre, doc) => {
  const docFinal = { ...doc };
  const idExistente = Number.isInteger(docFinal.id) ? docFinal.id : null;
  const idAsignado = idExistente ?? (await siguienteId(nombre));
  docFinal.id = idAsignado;
  docFinal._id = docFinal._id || String(idAsignado);

  const uniqueFn = UNIQUE_KEYS[nombre];
  if (uniqueFn) {
    docFinal.__key = uniqueFn(docFinal);
  }

  if (idExistente != null) {
    await asegurarSecuenciaMinima(nombre, idExistente);
  }

  return docFinal;
};

const siguienteId = async (nombre) => {
  const counters = stores.counters;
  if (!counters) {
    throw new Error("Counters datastore no inicializado");
  }
  const actual = await findOneAsync(counters._store, { _id: nombre });
  if (!actual) {
    await insertAsync(counters._store, { _id: nombre, seq: 1 });
    return 1;
  }
  const nuevo = Number(actual.seq || 0) + 1;
  await updateAsync(
    counters._store,
    { _id: nombre },
    { $set: { seq: nuevo } }
  );
  return nuevo;
};

const asegurarSecuenciaMinima = async (nombre, idExistente) => {
  const counters = stores.counters;
  if (!counters || idExistente == null) return;
  const actual = await findOneAsync(counters._store, { _id: nombre });
  if (!actual) {
    await insertAsync(counters._store, { _id: nombre, seq: idExistente });
    return;
  }
  if (Number(actual.seq || 0) < idExistente) {
    await updateAsync(
      counters._store,
      { _id: nombre },
      { $set: { seq: idExistente } }
    );
  }
};

const crearColeccion = (nombre, filename) => {
  const store = new Datastore({ filename, autoload: false });
  stores[nombre] = {
    _store: store,
    async ensureIndex(options) {
      return ensureIndexAsync(store, options);
    },
    async find(query = {}, options = {}) {
      return findAsync(store, query, options);
    },
    async findOne(query = {}, projection) {
      return findOneAsync(store, query, projection);
    },
    async count(query = {}) {
      return countAsync(store, query);
    },
    async insert(doc, options = {}) {
      const prepared = await prepararDocumento(nombre, doc);
      if (options.ignoreDuplicates && prepared.__key) {
        const existente = await findOneAsync(store, { __key: prepared.__key });
        if (existente) {
          return existente;
        }
      }
      return insertAsync(store, prepared);
    },
    async insertMany(docs = []) {
      if (!docs.length) return [];
      const preparados = [];
      for (const doc of docs) {
        preparados.push(await prepararDocumento(nombre, doc));
      }
      return insertAsync(store, preparados);
    },
    async update(query, update, options = {}) {
      return updateAsync(store, query, update, options);
    },
    async remove(query, options = {}) {
      return removeAsync(store, query, options);
    },
    async upsertByKey(doc, options = {}) {
      const uniqueFn = UNIQUE_KEYS[nombre];
      if (uniqueFn) {
        const key = uniqueFn(doc);
        const existente = await findOneAsync(store, { __key: key });
        if (existente) {
          const updateDoc = { ...doc, __key: key };
          delete updateDoc._id;
          delete updateDoc.id;
          await updateAsync(
            store,
            { _id: existente._id },
            { $set: updateDoc },
            { multi: false }
          );
          return { ...existente, ...updateDoc };
        }
      }
      const prepared = await prepararDocumento(nombre, doc);
      return insertAsync(store, prepared);
    },
    async insertOrIgnore(doc) {
      return this.insert(doc, { ignoreDuplicates: true });
    },
  };
  return stores[nombre];
};

const inicializarColecciones = async () => {
  const dir = obtenerDirectorioNeDB();
  Object.entries(COLECCIONES).forEach(([clave, nombre]) => {
    const filename = path.join(dir, `${nombre}.db`);
    crearColeccion(clave, filename);
  });

  await Promise.all(
    Object.values(stores).map((store) => loadDatabaseAsync(store._store))
  );
};

const asegurarIndices = async () => {
  const tareas = [];
  tareas.push(
    stores.usuarios.ensureIndex({ fieldName: "usuario", unique: true })
  );
  tareas.push(
    stores.usuarios.ensureIndex({ fieldName: "es_admin_global" })
  );
  tareas.push(
    stores.permisos_modulo.ensureIndex({
      fieldName: "__key",
      unique: true,
    })
  );
  tareas.push(
    stores.permisos_modulo.ensureIndex({ fieldName: "usuario_id" })
  );
  tareas.push(
    stores.permisos_modulo.ensureIndex({ fieldName: "empresa_id" })
  );
  tareas.push(stores.permisos_modulo.ensureIndex({ fieldName: "modulo" }));
  tareas.push(
    stores.presupuestos_estado.ensureIndex({
      fieldName: "__key",
      unique: true,
    })
  );
  tareas.push(
    stores.presupuestos_estado.ensureIndex({ fieldName: "empresa_id" })
  );
  tareas.push(stores.presupuestos_estado.ensureIndex({ fieldName: "modulo" }));
  tareas.push(stores.presupuestos_estado.ensureIndex({ fieldName: "anio" }));
  tareas.push(
    stores.notificaciones.ensureIndex({ fieldName: "usuario_id" })
  );
  tareas.push(stores.notificaciones.ensureIndex({ fieldName: "creada_en" }));
  tareas.push(
    stores.comentarios_celdas.ensureIndex({ fieldName: "celda_id" })
  );
  tareas.push(
    stores.comentarios_celdas.ensureIndex({ fieldName: "creado_en" })
  );
  tareas.push(
    stores.plan_borradores.ensureIndex({ fieldName: "__key", unique: true })
  );
  tareas.push(stores.plan_borradores.ensureIndex({ fieldName: "empresaId" }));
  tareas.push(stores.plan_borradores.ensureIndex({ fieldName: "modulo" }));
  tareas.push(stores.plan_borradores.ensureIndex({ fieldName: "anio" }));
  tareas.push(
    stores.plan_borradores_historial.ensureIndex({ fieldName: "empresaId" })
  );
  tareas.push(
    stores.plan_borradores_historial.ensureIndex({ fieldName: "modulo" })
  );
  tareas.push(stores.plan_borradores_historial.ensureIndex({ fieldName: "anio" }));
  tareas.push(
    stores.empresa_vistas.ensureIndex({ fieldName: "__key", unique: true })
  );
  tareas.push(
    stores.layout_cuentas.ensureIndex({ fieldName: "__key", unique: true })
  );
  tareas.push(stores.layout_cuentas.ensureIndex({ fieldName: "empresa_id" }));
  tareas.push(stores.layout_cuentas.ensureIndex({ fieldName: "modulo" }));
  tareas.push(stores.layout_cuentas.ensureIndex({ fieldName: "anio" }));
  tareas.push(stores.layout_cuentas.ensureIndex({ fieldName: "capitulo" }));
  tareas.push(
    stores.layout_operaciones.ensureIndex({ fieldName: "__key", unique: true })
  );
  tareas.push(stores.layout_operaciones.ensureIndex({ fieldName: "empresa_id" }));
  tareas.push(stores.layout_operaciones.ensureIndex({ fieldName: "modulo" }));
  tareas.push(stores.layout_operaciones.ensureIndex({ fieldName: "anio" }));
  tareas.push(stores.layout_operaciones.ensureIndex({ fieldName: "capitulo" }));
  tareas.push(
    stores.layout_secciones.ensureIndex({ fieldName: "__key", unique: true })
  );
  tareas.push(stores.layout_secciones.ensureIndex({ fieldName: "empresa_id" }));
  tareas.push(stores.layout_secciones.ensureIndex({ fieldName: "modulo" }));
  tareas.push(stores.layout_secciones.ensureIndex({ fieldName: "anio" }));
  tareas.push(stores.layout_secciones.ensureIndex({ fieldName: "capitulo" }));
  tareas.push(
    stores.permisos_edicion_capitulo.ensureIndex({
      fieldName: "__key",
      unique: true,
    })
  );
  tareas.push(
    stores.layout_bitacora.ensureIndex({ fieldName: "empresa_id" })
  );
  tareas.push(stores.layout_bitacora.ensureIndex({ fieldName: "modulo" }));
  tareas.push(stores.layout_bitacora.ensureIndex({ fieldName: "anio" }));
  tareas.push(stores.layout_bitacora.ensureIndex({ fieldName: "capitulo" }));
  tareas.push(stores.counters.ensureIndex({ fieldName: "_id", unique: true }));
  tareas.push(stores.meta.ensureIndex({ fieldName: "key", unique: true }));
  await Promise.all(tareas);
};

const baseDatosVacia = async () => {
  const counts = await Promise.all([
    stores.usuarios.count({}),
    stores.layout_cuentas.count({}),
    stores.plan_borradores.count({}),
  ]);
  return counts.every((n) => n === 0);
};

const cargarSqlJs = async () => {
  const initSqlJs = require("sql.js");
  const wasmPath = require.resolve("sql.js/dist/sql-wasm.wasm");
  const wasmDir = path.dirname(wasmPath);
  return initSqlJs({
    locateFile: (file) => path.join(wasmDir, file),
  });
};

const seleccionarTodo = (sqliteDb, tabla) => {
  const result = sqliteDb.exec(`SELECT * FROM ${tabla}`);
  if (!result || !result.length) return [];
  const { columns, values } = result[0];
  return values.map((row) => {
    const obj = {};
    columns.forEach((col, idx) => {
      obj[col] = row[idx];
    });
    return obj;
  });
};

const migrarDesdeSQLite = async () => {
  const rutaSqlite = resolverSQLiteDisponible();
  if (!rutaSqlite) {
    return { migrado: false, motivo: "sin_sqlite" };
  }

  const yaMigrado = await stores.meta.findOne({ key: "sqlite_migrado" });
  if (yaMigrado) {
    return { migrado: false, motivo: "ya_migrado" };
  }

  const SQL = await cargarSqlJs();
  const contenido = fs.readFileSync(rutaSqlite);
  const sqliteDb = new SQL.Database(contenido);

  try {
    for (const [coleccion, tabla] of Object.entries(TABLAS_SQLITE)) {
      const rows = seleccionarTodo(sqliteDb, tabla);
      if (!rows.length) continue;
      for (const row of rows) {
        await stores[coleccion].insert(row, { ignoreDuplicates: true });
      }
    }
  } catch (error) {
    console.error("[NeDB] Error migrando desde SQLite:", error);
    throw error;
  } finally {
    sqliteDb.close();
  }

  await stores.meta.insert({
    key: "sqlite_migrado",
    ruta: rutaSqlite,
    fecha: ahoraSql(),
  });

  return { migrado: true, ruta: rutaSqlite };
};

const permisosCompletos = (permiso = {}) => ({
  ...permiso,
  puede_leer: 1,
  puede_cargar_guardar: 1,
  puede_revisar: 1,
  puede_aprobar: 1,
});

const sembrarUsuariosDesdeJson = async () => {
  try {
    const rutaSeed = path.join(__dirname, "../config/seed_users.json");
    if (!fs.existsSync(rutaSeed)) {
      console.warn("Seed file not found:", rutaSeed);
      return;
    }
    const seedUsers = require(rutaSeed);
    if (!Array.isArray(seedUsers)) return;

    const hashPassword = (valorPlano) => bcrypt.hashSync(valorPlano, 12);
    const defaultHash = hashPassword("Amcham2026");

    for (const u of seedUsers) {
      const usuarioNormalizado = normalizarUsuario(u.username);
      const permisosFiltrados = limpiarPermisosLista({
        lista: Array.isArray(u.permissions) ? u.permissions : [],
        usuario: usuarioNormalizado,
      });
      const apellido1 = u.apellidoPrimero || u.username;
      const apellido2 = u.apellidoSegundo || "";
      const apellidosCompletos = [apellido1, apellido2].filter(Boolean).join(" ");
      const esAdminHistorico = esAdministradorHistorico(usuarioNormalizado);
      const permisosNormalizados = esAdminHistorico
        ? permisosFiltrados.map((permiso) => permisosCompletos(permiso))
        : permisosFiltrados;
      const esAdminGlobal = u.esAdminGlobal || esAdminHistorico ? 1 : 0;
      const puedeAgregar = esAdminGlobal ? 1 : u.puedeAgregar ? 1 : 0;
      const puedeModificar = esAdminGlobal ? 1 : u.puedeModificar ? 1 : 0;
      const puedeEliminar = esAdminGlobal ? 1 : u.puedeEliminar ? 1 : 0;

      let usuarioDoc = await stores.usuarios.findOne({ usuario: usuarioNormalizado });
      if (!usuarioDoc) {
        usuarioDoc = await stores.usuarios.insert({
          usuario: usuarioNormalizado,
          nombres: u.nombres || u.username,
          apellido_primero: apellido1,
          apellido_segundo: apellido2,
          apellidos: apellidosCompletos,
          correo: u.correo || "",
          contrasena: defaultHash,
          es_admin_global: esAdminGlobal,
          puede_agregar: puedeAgregar,
          puede_modificar: puedeModificar,
          puede_eliminar: puedeEliminar,
          creado_en: ahoraSql(),
        });
      } else {
        await stores.usuarios.update(
          { _id: usuarioDoc._id },
          {
            $set: {
              nombres: u.nombres || u.username,
              apellido_primero: apellido1,
              apellido_segundo: apellido2,
              apellidos: apellidosCompletos,
              correo: u.correo || "",
              es_admin_global:
                esAdminGlobal === 1 ? 1 : usuarioDoc.es_admin_global,
              puede_agregar: puedeAgregar,
              puede_modificar: puedeModificar,
              puede_eliminar: puedeEliminar,
            },
          }
        );
      }

      const usuarioId = usuarioDoc.id;
      for (const p of permisosNormalizados) {
        await stores.permisos_modulo.insertOrIgnore({
          usuario_id: usuarioId,
          empresa_id: p.empresaId,
          modulo: p.modulo,
          puede_leer: p.puede_leer ? 1 : 0,
          puede_cargar_guardar: p.puede_cargar_guardar ? 1 : 0,
          puede_revisar: p.puede_revisar ? 1 : 0,
          puede_aprobar: p.puede_aprobar ? 1 : 0,
        });
      }

      if (esAdminGlobal) {
        const puedeVerResumen = esUsuarioPermitidoResumen(usuarioNormalizado);
        for (const empresa of EMPRESAS) {
          for (const modulo of MODULOS) {
            if (!puedeVerResumen && esModuloRestringido(modulo)) {
              continue;
            }
            await stores.permisos_modulo.insertOrIgnore({
              usuario_id: usuarioId,
              empresa_id: empresa.id,
              modulo,
              puede_leer: 1,
              puede_cargar_guardar: 1,
              puede_revisar: 1,
              puede_aprobar: 1,
            });
          }
        }
      }
    }

    const admins = await stores.usuarios.find({ es_admin_global: 1 });
    for (const a of admins) {
      const usuarioNormalizado = normalizarUsuario(a.usuario);
      const puedeVerResumen = esUsuarioPermitidoResumen(usuarioNormalizado);
      for (const empresa of EMPRESAS) {
        for (const modulo of MODULOS) {
          if (!puedeVerResumen && esModuloRestringido(modulo)) {
            continue;
          }
          await stores.permisos_modulo.insertOrIgnore({
            usuario_id: a.id,
            empresa_id: empresa.id,
            modulo,
            puede_leer: 1,
            puede_cargar_guardar: 1,
            puede_revisar: 1,
            puede_aprobar: 1,
          });
        }
      }
    }
  } catch (error) {
    console.error("Error seeding users:", error);
  }
};

const limpiarPermisosResumenNoAutorizados = async () => {
  try {
    const usuarios = await stores.usuarios.find({});
    if (!usuarios.length) return;
    for (const registro of usuarios) {
      const usuarioNormalizado = normalizarUsuario(registro.usuario);
      if (esUsuarioPermitidoResumen(usuarioNormalizado)) {
        continue;
      }
      for (const modulo of MODULOS_RESTRINGIDOS) {
        await stores.permisos_modulo.remove(
          { usuario_id: registro.id, modulo },
          { multi: true }
        );
      }
    }
  } catch (err) {
    console.warn(
      "No fue posible limpiar permisos restringidos:",
      err?.message || err
    );
  }
};

const sembrarVistasPorCapitulo = async () => {
  try {
    await stores.empresa_vistas.remove({}, { multi: true });
    const inserciones = [];
    Object.entries(VISTAS_POR_CAPITULO).forEach(([empresaId, vistas]) => {
      (vistas || []).forEach((vista) => {
        inserciones.push({
          empresa_id: empresaId,
          vista: vista.vista,
          archivo: vista.archivo,
        });
      });
    });
    for (const fila of inserciones) {
      await stores.empresa_vistas.insertOrIgnore(fila);
    }
  } catch (error) {
    console.warn(
      "No fue posible sembrar la tabla empresa_vistas:",
      error?.message || error
    );
  }
};

const crearAdministradorGlobal = async () => {
  const FALLBACK_ICONET_PASSWORD = "4zxb63NyI43?";
  const envPassword =
    process.env.PANELAMCHAM_ADMIN_PASSWORD ||
    process.env.ICONET_PASSWORD ||
    FALLBACK_ICONET_PASSWORD;

  const existente = await stores.usuarios.findOne({ usuario: "ICONET" });
  const hashPassword = (valorPlano) => bcrypt.hashSync(valorPlano, 12);

  if (existente) {
    if (envPassword) {
      await stores.usuarios.update(
        { _id: existente._id },
        { $set: { contrasena: hashPassword(envPassword) } }
      );
      console.info("ICONET: contraseña actualizada desde variable de entorno.");
    }
    return;
  }

  const passwordPlano =
    envPassword || crypto.randomBytes(16).toString("base64url");
  if (!envPassword) {
    console.warn(
      "ICONET: se creó con contraseña aleatoria segura. Define PANELAMCHAM_ADMIN_PASSWORD/ICONET_PASSWORD para controlar la credencial."
    );
    console.warn(
      `ICONET: contraseña generada (guárdala y rótala pronto): ${passwordPlano}`
    );
  }
  const hash = hashPassword(passwordPlano);

  const usuario = await stores.usuarios.insert({
    usuario: "ICONET",
    nombres: "Administrador",
    apellido_primero: "Global",
    apellido_segundo: "",
    apellidos: "Global",
    correo: "admin@panel.amcham.org.mx",
    contrasena: hash,
    es_admin_global: 1,
    puede_agregar: 1,
    puede_modificar: 1,
    puede_eliminar: 1,
    creado_en: ahoraSql(),
  });

  for (const empresa of EMPRESAS) {
    for (const modulo of MODULOS) {
      await stores.permisos_modulo.insertOrIgnore({
        usuario_id: usuario.id,
        empresa_id: empresa.id,
        modulo,
        puede_leer: 1,
        puede_cargar_guardar: 1,
        puede_revisar: 1,
        puede_aprobar: 1,
      });
    }
  }

  const CAPITULOS = [
    "CIUDAD DE MÉXICO",
    "GUADALAJARA",
    "NORESTE",
    "NOROESTE",
    "DEFAULT",
  ];
  for (const cap of CAPITULOS) {
    await stores.permisos_edicion_capitulo.insertOrIgnore({
      usuario_id: usuario.id,
      capitulo: cap,
      puede_editar: 1,
    });
  }

  if (envPassword === FALLBACK_ICONET_PASSWORD) {
    console.warn(
      `ICONET: se está usando la contraseña por default: ${FALLBACK_ICONET_PASSWORD} (si crees que la escribiste correctamente y falla, revisa I vs l).`
    );
  }
};

const asegurarAdministradoresHistoricos = async () => {
  try {
    const nombres = ["AA", "AMB"];
    for (const n of nombres) {
      const usuarioUpper = n.toUpperCase();
      const actualizado = await stores.usuarios.update(
        { usuario: usuarioUpper },
        {
          $set: {
            es_admin_global: 1,
            puede_agregar: 1,
            puede_modificar: 1,
            puede_eliminar: 1,
          },
        }
      );
      if (!actualizado?.numAffected) {
        continue;
      }
      const usuarioDoc = await stores.usuarios.findOne({ usuario: usuarioUpper });
      if (!usuarioDoc) continue;

      const puedeVerResumen = esUsuarioPermitidoResumen(usuarioUpper);
      for (const empresa of EMPRESAS) {
        for (const modulo of MODULOS) {
          if (!puedeVerResumen && esModuloRestringido(modulo)) {
            continue;
          }
          await stores.permisos_modulo.insertOrIgnore({
            usuario_id: usuarioDoc.id,
            empresa_id: empresa.id,
            modulo,
            puede_leer: 1,
            puede_cargar_guardar: 1,
            puede_revisar: 1,
            puede_aprobar: 1,
          });
        }
      }
    }
  } catch (err) {
    console.warn(
      "No fue posible aplicar administradores históricos:",
      err?.message || err
    );
  }
};

const asegurarPermisosParaAdminsGlobales = async () => {
  try {
    const admins = await stores.usuarios.find({ es_admin_global: 1 });
    if (!admins || !admins.length) return;
    const CAPITULOS = [
      "CIUDAD DE MÉXICO",
      "GUADALAJARA",
      "NORESTE",
      "NOROESTE",
      "DEFAULT",
    ];
    for (const a of admins) {
      for (const empresa of EMPRESAS) {
        for (const modulo of MODULOS) {
          await stores.permisos_modulo.insertOrIgnore({
            usuario_id: a.id,
            empresa_id: empresa.id,
            modulo,
            puede_leer: 1,
            puede_cargar_guardar: 1,
            puede_revisar: 1,
            puede_aprobar: 1,
          });
        }
      }
      for (const cap of CAPITULOS) {
        await stores.permisos_edicion_capitulo.insertOrIgnore({
          usuario_id: a.id,
          capitulo: cap,
          puede_editar: 1,
        });
      }
    }
  } catch (err) {
    console.warn(
      "Error al asegurar permisos para admins globales:",
      err?.message || err
    );
  }
};

const intentarSembrarLayoutsIniciales = async () => {
  const baseDir = resolverDirectorioInfoImportante();
  try {
    const resultado = await seedLayoutsFromJson({
      db: stores,
      baseDir,
      force: false,
    });
    if (resultado?.ejecutado) {
      console.log(
        `✔ Layouts seed: ${resultado.cuentas} cuentas, ${resultado.operaciones} operaciones`
      );
    }
  } catch (error) {
    console.warn(
      "[NeDB] No fue posible sembrar layouts iniciales:",
      error?.message || error
    );
  }

  const aniosCdMx = [];
  for (let anio = 2005; anio <= 2026; anio += 1) {
    aniosCdMx.push(anio);
  }

  try {
    const resultadoExcel = await seedLayoutsDesdeExcelCdMx({
      db: stores,
      baseDir,
      empresaId: "EMPRESA01",
      capitulo: "CIUDAD DE MEXICO",
      anios: aniosCdMx,
    });
    if (resultadoExcel?.ejecutado) {
      console.log(
        `✔ Layouts CDMX: ${resultadoExcel.cuentas} cuentas, ${resultadoExcel.operaciones} operaciones (Excel)`
      );
    }
  } catch (error) {
    console.warn(
      "[NeDB] No fue posible sembrar layouts CDMX desde Excel:",
      error?.message || error
    );
  }
};

const registrarPresupuestoGuardado = async ({
  empresaId,
  modulo,
  anio,
  datos,
  guardadoPor,
}) => {
  const datosJson =
    typeof datos === "string" ? datos : JSON.stringify(datos || {});
  return stores.presupuestos_guardados.insert({
    empresa_id: empresaId,
    modulo,
    anio,
    datos: datosJson,
    guardado_por: guardadoPor || null,
    guardado_en: ahoraSql(),
  });
};

const inicializarBaseDatos = async () => {
  if (initialized) {
    return stores;
  }

  await inicializarColecciones();
  await asegurarIndices();

  if (await baseDatosVacia()) {
    try {
      const resultado = await migrarDesdeSQLite();
      if (resultado?.migrado) {
        console.log(
          `✔ Migración SQLite → NeDB completada (${resultado.ruta || "sin ruta"})`
        );
      }
    } catch (error) {
      console.warn(
        "[NeDB] No fue posible migrar desde SQLite:",
        error?.message || error
      );
    }
  }

  await crearAdministradorGlobal();
  await asegurarAdministradoresHistoricos();
  await asegurarPermisosParaAdminsGlobales();
  await limpiarPermisosResumenNoAutorizados();
  await sembrarUsuariosDesdeJson();
  await sembrarVistasPorCapitulo();
  await intentarSembrarLayoutsIniciales();

  console.log("✔ Base de datos NeDB inicializada");
  initialized = true;
  return stores;
};

const getDb = () => {
  if (!initialized) {
    throw new Error(
      "NeDB no inicializada; inicializa la base antes de usarla."
    );
  }
  return stores;
};

module.exports = {
  get db() {
    return getDb();
  },
  getDb,
  inicializarBaseDatos,
  registrarPresupuestoGuardado,
  ahoraSql,
  stores,
};
