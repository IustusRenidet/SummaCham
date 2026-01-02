/**
 * migrate-layouts-to-json.js
 * Migra todos los layouts de SQLite a archivos JSON organizados por empresa/año
 */

const path = require("path");
const fs = require("fs");

// Cargar la conexión a la base de datos
const { getDb } = require("../src/db/sqlite");

// Mapeo de empresas canónicas
const EMPRESA_CANONICA = {
  EMPRESA01: "CDMX",
  EMPRESA02: "NOROESTE",
  EMPRESA03: "GDL",
};

function obtenerEmpresaCanonica(empresaId) {
  return EMPRESA_CANONICA[empresaId] || empresaId;
}

function migrarLayouts() {
  const db = getDb();

  console.log("🚀 Iniciando migración de layouts a JSON...\n");

  // 1. Obtener todas las combinaciones únicas de empresa/módulo/año
  const combinaciones = db
    .prepare(
      `
    SELECT DISTINCT empresa_id, modulo, anio
    FROM layout_cuentas
    ORDER BY empresa_id, anio DESC, modulo
  `
    )
    .all();

  console.log(
    `📊 Encontradas ${combinaciones.length} combinaciones para migrar:\n`
  );

  combinaciones.forEach((c) => {
    console.log(`   - ${c.empresa_id} / ${c.modulo} / ${c.anio}`);
  });
  console.log("");

  let exitosos = 0;
  let fallidos = 0;

  // 2. Para cada combinación, exportar los datos
  combinaciones.forEach(({ empresa_id, modulo, anio }) => {
    try {
      exportarLayout(db, empresa_id, modulo, anio);
      exitosos++;
    } catch (err) {
      console.error(
        `❌ Error exportando ${empresa_id}/${modulo}/${anio}:`,
        err.message
      );
      fallidos++;
    }
  });

  console.log("\n✅ Migración completada:");
  console.log(`   Exitosos: ${exitosos}`);
  console.log(`   Fallidos: ${fallidos}`);
}

function exportarLayout(db, empresaId, modulo, anio) {
  const empresaCanonica = obtenerEmpresaCanonica(empresaId);
  const anioNumero = parseInt(anio);

  // Crear directorio
  const baseDir = path.join(
    process.cwd(),
    "info IMPORTANTE",
    "layouts",
    empresaCanonica,
    String(anioNumero)
  );

  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }

  // Obtener cuentas del layout
  const cuentas = db
    .prepare(
      `
    SELECT capitulo as CAPITULO, seccion_principal as "SECCIÓN Principal", 
           seccion_secundaria as "SECCION Secundaria", cuenta as CUENTA, 
           nombre as NOMBRE, orden
    FROM layout_cuentas
    WHERE empresa_id = ? AND modulo = ? AND anio = ?
    ORDER BY orden, capitulo, seccion_principal, seccion_secundaria
  `
    )
    .all(empresaCanonica, modulo, anioNumero);

  // Obtener operaciones del layout
  const operaciones = db
    .prepare(
      `
    SELECT capitulo as CAPITULO, clase as Clase, seccion as SECCION,
           operacion_tipo, operacion_label, signo, orden
    FROM layout_operaciones
    WHERE empresa_id = ? AND modulo = ? AND anio = ?
    ORDER BY orden
  `
    )
    .all(empresaCanonica, modulo, anioNumero);

  // Desglosar operaciones con toda la metadata
  const operacionesDetalladas = operaciones.map((op) => ({
    CAPITULO: op.CAPITULO,
    Clase: op.Clase,
    SECCION: op.SECCION,
    tipo: op.operacion_tipo,
    etiqueta: op.operacion_label,
    signo: op.signo,
    orden: op.orden,
  }));

  // Organizar operaciones por capítulo
  const operacionesPorCapitulo = {};
  operacionesDetalladas.forEach((op) => {
    if (!operacionesPorCapitulo[op.CAPITULO]) {
      operacionesPorCapitulo[op.CAPITULO] = [];
    }
    operacionesPorCapitulo[op.CAPITULO].push(op);
  });

  // Agrupar operaciones por clase
  const operacionesAgrupadas = [];
  const operacionesPorClase = {};
  operaciones.forEach((op) => {
    if (!operacionesPorClase[op.Clase]) {
      operacionesPorClase[op.Clase] = {
        CAPITULO: op.CAPITULO,
        Clase: op.Clase,
        SECCION: op.SECCION,
        orden: op.orden,
        signos: {},
      };
      operacionesAgrupadas.push(operacionesPorClase[op.Clase]);
    }
    operacionesPorClase[op.Clase][op.operacion_tipo] = op.operacion_label;
    operacionesPorClase[op.Clase].signos[op.operacion_tipo] = op.signo;
  });

  // Organizar cuentas por capítulo
  const cuentasPorCapitulo = cuentas.reduce((acc, cuenta) => {
    if (!acc[cuenta.CAPITULO]) acc[cuenta.CAPITULO] = [];
    acc[cuenta.CAPITULO].push(cuenta);
    return acc;
  }, {});

  // Crear objeto de resultado completo
  const resultado = {
    empresaId: empresaCanonica,
    modulo,
    anio: anioNumero,
    cuentasPorCapitulo,
    operacionesAgrupadas,
    operacionesDetalladas,
    operacionesPorCapitulo,
    generadoEn: new Date().toISOString(),
  };

  // Guardar archivos JSON
  const layoutFileName = `${modulo}_layout.json`;
  const layoutFilePath = path.join(baseDir, layoutFileName);
  fs.writeFileSync(layoutFilePath, JSON.stringify(resultado, null, 2), "utf8");

  const operacionesFileName = `${modulo}_operaciones_detalle.json`;
  const operacionesFilePath = path.join(baseDir, operacionesFileName);
  fs.writeFileSync(
    operacionesFilePath,
    JSON.stringify({ operaciones: operacionesDetalladas }, null, 2),
    "utf8"
  );

  const cuentasFileName = `${modulo}_cuentas.json`;
  const cuentasFilePath = path.join(baseDir, cuentasFileName);
  fs.writeFileSync(
    cuentasFilePath,
    JSON.stringify({ cuentas, cuentasPorCapitulo }, null, 2),
    "utf8"
  );

  console.log(`✅ ${empresaCanonica}/${modulo}/${anio} → ${baseDir}`);
  console.log(
    `   Cuentas: ${cuentas.length}, Operaciones: ${operacionesDetalladas.length}`
  );
}

// Ejecutar migración
try {
  migrarLayouts();
  console.log("\n🎉 Migración exitosa!");
  process.exit(0);
} catch (err) {
  console.error("\n💥 Error en la migración:", err);
  process.exit(1);
}
