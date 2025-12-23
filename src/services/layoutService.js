/**
 * layoutService.js
 * Servicio para gestionar layouts de módulos por año y capítulo en SQLite
 */

const { EMPRESAS } = require('../config/empresas');
const db = require('../db/sqlite').db;

const CANONICAL_EMPRESA_DEFAULT = 'EMPRESA01';

const generarVariantesEmpresa = (empresaId = CANONICAL_EMPRESA_DEFAULT) => {
  const variantes = new Set();
  const base = (empresaId || '').toString().trim();
  if (base) {
    variantes.add(base);
    const upper = base.toUpperCase();
    variantes.add(upper);
    const match = upper.match(/EMPRESA\s*0*(\d+)/);
    if (match) {
      variantes.add(`EMPRESA${match[1].padStart(2, '0')}`);
    }
    const meta = EMPRESAS?.find(
      (empresa) => empresa.id?.toLowerCase() === base.toLowerCase()
    );
    if (meta && meta.numero != null) {
      variantes.add(`EMPRESA${String(meta.numero).padStart(2, '0')}`);
    }
  }
  return Array.from(variantes).filter(Boolean);
};

const obtenerEmpresaCanonica = (empresaId = CANONICAL_EMPRESA_DEFAULT) => {
  const variantes = generarVariantesEmpresa(empresaId);
  const canonica = variantes.find((valor) => /^EMPRESA\d{2}$/i.test(valor));
  return canonica || variantes[variantes.length - 1] || CANONICAL_EMPRESA_DEFAULT;
};

const existeLayoutAnio = ({ empresaId, modulo, anio }) => {
  const row = db.prepare(`
    SELECT COUNT(*) as total
    FROM layout_cuentas
    WHERE empresa_id = ? AND modulo = ? AND anio = ?
    LIMIT 1
  `).get(empresaId, modulo, anio);
  return Boolean(row && row.total);
};

const existeLayoutCapitulo = ({ empresaId, modulo, anio, capitulo }) => {
  const row = db.prepare(`
    SELECT COUNT(*) as total
    FROM layout_cuentas
    WHERE empresa_id = ? AND modulo = ? AND anio = ? AND capitulo = ?
    LIMIT 1
  `).get(empresaId, modulo, anio, capitulo);
  return Boolean(row && row.total);
};

const buscarAnioReferencia = ({ empresaId, modulo, anio }) => {
  const menorIgual = db.prepare(`
    SELECT MAX(anio) as anio
    FROM layout_cuentas
    WHERE empresa_id = ? AND modulo = ? AND anio <= ?
  `).get(empresaId, modulo, anio);
  if (menorIgual && Number.isInteger(menorIgual.anio)) {
    return menorIgual.anio;
  }
  const mayor = db.prepare(`
    SELECT MIN(anio) as anio
    FROM layout_cuentas
    WHERE empresa_id = ? AND modulo = ? AND anio > ?
  `).get(empresaId, modulo, anio);
  if (mayor && Number.isInteger(mayor.anio)) {
    return mayor.anio;
  }
  const cualquiera = db.prepare(`
    SELECT MIN(anio) as anio
    FROM layout_cuentas
    WHERE empresa_id = ? AND modulo = ?
  `).get(empresaId, modulo);
  if (cualquiera && Number.isInteger(cualquiera.anio)) {
    return cualquiera.anio;
  }
  return null;
};

const asegurarLayoutAnio = ({ empresaId, modulo, anio }) => {
  const empresaCanonica = obtenerEmpresaCanonica(empresaId);
  const anioNumero = Number(anio);
  if (!Number.isInteger(anioNumero)) {
    return false;
  }
  if (existeLayoutAnio({ empresaId: empresaCanonica, modulo, anio: anioNumero })) {
    return true;
  }
  const anioReferencia = buscarAnioReferencia({
    empresaId: empresaCanonica,
    modulo,
    anio: anioNumero
  });
  if (!anioReferencia || anioReferencia === anioNumero) {
    return false;
  }
  try {
    copiarLayout({
      empresaId: empresaCanonica,
      modulo,
      anioOrigen: anioReferencia,
      anioDestino: anioNumero
    });
    console.log(
      `[layoutService] Layout ${modulo} ${anioNumero} generado desde ${anioReferencia}`
    );
    return true;
  } catch (err) {
    console.warn(
      `[layoutService] No se pudo clonar layout ${modulo}/${anioNumero}:`,
      err?.message || err
    );
    return false;
  }
};

const resolverEmpresaConsulta = ({ empresaId, modulo, anio }) => {
  const variantes = generarVariantesEmpresa(empresaId);
  if (!modulo || !anio) {
    return obtenerEmpresaCanonica(empresaId);
  }
  for (const candidata of variantes) {
    const row = db.prepare(`
      SELECT COUNT(*) as total
      FROM layout_cuentas
      WHERE empresa_id = ? AND modulo = ? AND anio = ?
      LIMIT 1
    `).get(candidata, modulo, anio);
    if (row && row.total > 0) {
      return candidata;
    }
  }
  const canonSolicitada = obtenerEmpresaCanonica(empresaId);
  const canonBase = obtenerEmpresaCanonica('EMPRESA01');
  if (canonBase && canonBase !== canonSolicitada) {
    const rowFallback = db.prepare(`
      SELECT COUNT(*) as total
      FROM layout_cuentas
      WHERE empresa_id = ? AND modulo = ? AND anio = ?
      LIMIT 1
    `).get(canonBase, modulo, anio);
    if (rowFallback && rowFallback.total > 0) {
      return canonBase;
    }
  }
  return canonSolicitada;
};

const construirRespuestaLayout = ({
  empresaId,
  modulo,
  anio,
  capitulo,
  cuentas,
  operaciones
}) => {
  const respuesta = {
    empresaId,
    modulo,
    anio,
    capitulo,
    cuentas,
    operaciones
  };
  respuesta[modulo] = cuentas;
  respuesta['SUMA DE VARIAS SECCIONES'] = operaciones;
  return respuesta;
};

const eliminarLayoutCapitulo = ({
  empresaId = 'EMPRESA01',
  modulo,
  anio,
  capitulo
}) => {
  const empresaCanonica = obtenerEmpresaCanonica(empresaId);
  const anioNumero = Number(anio);
  if (!modulo || !Number.isInteger(anioNumero) || !capitulo) {
    return { success: false };
  }
  const deleteCuentas = db.prepare(`
    DELETE FROM layout_cuentas
    WHERE empresa_id = ? AND modulo = ? AND anio = ? AND capitulo = ?
  `);
  const deleteOperaciones = db.prepare(`
    DELETE FROM layout_operaciones
    WHERE empresa_id = ? AND modulo = ? AND anio = ? AND capitulo = ?
  `);
  const deleteSecciones = db.prepare(`
    DELETE FROM layout_secciones
    WHERE empresa_id = ? AND modulo = ? AND anio = ? AND capitulo = ?
  `);

  const transaction = db.transaction(() => {
    deleteCuentas.run(empresaCanonica, modulo, anioNumero, capitulo);
    deleteOperaciones.run(empresaCanonica, modulo, anioNumero, capitulo);
    deleteSecciones.run(empresaCanonica, modulo, anioNumero, capitulo);
  });

  transaction();
  return { success: true };
};

const construirPlantillaDemo = ({ modulo, capitulo }) => {
  const moduloNormalizado = (modulo || '').toString().trim().toUpperCase();
  const esSummary = moduloNormalizado === 'SUMMARY';
  const esResumen = moduloNormalizado === 'RESUMEN';
  const formato = esSummary ? 'summary' : 'resumen';
  const cuentas = [];
  let orden = 0;

  const crearCodigo = (prefijo, index) => {
    if (formato === 'summary') {
      return `${prefijo}${String(index + 1).padStart(3, '0')}`;
    }
    return `${prefijo}${String(index + 1).padStart(2, '0')}`;
  };

  const seccionesResumen = [
    {
      principal: 'INGRESOS',
      secundaria: 'Membresías',
      prefijoSummary: '401000000000000000',
      prefijoResumen: '401-001-000-',
      cuentas: ['Cuotas netas', 'Ingresos socios nuevos']
    },
    {
      principal: 'GASTOS',
      secundaria: 'Operativos',
      prefijoSummary: '601000000000000000',
      prefijoResumen: '601-001-000-',
      cuentas: ['Servicios', 'Administración']
    },
    {
      principal: 'GASTOS',
      secundaria: 'Financieros',
      prefijoSummary: '701000000000000000',
      prefijoResumen: '701-001-000-',
      cuentas: ['Intereses', 'Comisiones bancarias']
    }
  ];

  const seccionesModulos = [
    {
      principal: 'Operaciones',
      prefijoResumen: '401-002-000-',
      cuentas: ['Servicios recurrentes', 'Eventos especiales']
    },
    {
      principal: 'Administración',
      prefijoResumen: '501-001-000-',
      cuentas: ['Nómina', 'Sistemas']
    },
    {
      principal: 'Soporte',
      prefijoResumen: '601-005-000-',
      cuentas: ['Capacitación', 'Viajes']
    }
  ];

  const secciones = esSummary || esResumen ? seccionesResumen : seccionesModulos;

  secciones.forEach((seccion) => {
    seccion.cuentas.forEach((nombre, index) => {
      const prefijo = esSummary
        ? seccion.prefijoSummary
        : seccion.prefijoResumen;
      const codigo = crearCodigo(prefijo, index);
      const cuenta = {
        CAPITULO: capitulo,
        CUENTA: codigo,
        NOMBRE: nombre,
        orden
      };
      if (esSummary || esResumen) {
        cuenta['SECCIàN Principal'] = seccion.principal;
        cuenta['SECCION Secundaria'] = seccion.secundaria;
      } else {
        cuenta.SECCION = seccion.principal;
      }
      cuentas.push(cuenta);
      orden += 1;
    });
  });

  const operaciones = [];
  if (esSummary || esResumen) {
    operaciones.push({
      HOJA: modulo,
      CAPITULO: capitulo,
      Clase: 'Resultado Operativo',
      SECCION: 'RESULTADOS',
      'sum-row': 'INGRESOS / Membresías',
      'sum-row-operativo': 'GASTOS / Operativos',
      'result-row': 'UTILIDAD NETA',
      signo: 1,
      signos: {
        'sum-row': 1,
        'sum-row-operativo': -1,
        'result-row': 1
      }
    });
  }

  return { cuentas, operaciones };
};

const crearLayoutDemo = ({
  empresaId = 'EMPRESA01',
  modulo,
  anio,
  capitulo,
  overwrite = false
}) => {
  const empresaCanonica = obtenerEmpresaCanonica(empresaId);
  const anioNumero = Number(anio);
  const capituloObjetivo = capitulo || 'DEFAULT';
  if (!modulo || !Number.isInteger(anioNumero)) {
    return { success: false, mensaje: 'Datos inválidos para generar plantilla.' };
  }

  if (
    existeLayoutCapitulo({
      empresaId: empresaCanonica,
      modulo,
      anio: anioNumero,
      capitulo: capituloObjetivo
    })
  ) {
    if (!overwrite) {
      return {
        success: false,
        conflict: true,
        mensaje: 'El capítulo ya tiene layout en ese año.'
      };
    }
    eliminarLayoutCapitulo({
      empresaId: empresaCanonica,
      modulo,
      anio: anioNumero,
      capitulo: capituloObjetivo
    });
  }

  const { cuentas, operaciones } = construirPlantillaDemo({
    modulo,
    capitulo: capituloObjetivo
  });
  guardarCuentas({
    empresaId: empresaCanonica,
    modulo,
    anio: anioNumero,
    capitulo: capituloObjetivo,
    cuentas
  });
  if (operaciones.length) {
    guardarOperaciones({
      empresaId: empresaCanonica,
      modulo,
      anio: anioNumero,
      operaciones
    });
  }

  return {
    success: true,
    cuentas: cuentas.length,
    operaciones: operaciones.length,
    capitulo: capituloObjetivo
  };
};


/**
 * Obtener layout completo para un módulo, año y capítulo
 */

const obtenerLayout = ({ empresaId = 'EMPRESA01', modulo, anio, capitulo }) => {
  const anioNumero = Number(anio);
  const moduloNorm = (modulo || '').toString().trim().toUpperCase();
  const empresaCanonica = obtenerEmpresaCanonica(empresaId);
  asegurarLayoutAnio({ empresaId: empresaCanonica, modulo, anio: anioNumero });
  const empresaConsulta = resolverEmpresaConsulta({ empresaId: empresaCanonica, modulo, anio: anioNumero });
  const capituloObjetivo = capitulo || 'DEFAULT';

  const consultarCuentas = (anioObjetivo) => db.prepare(`
    SELECT 
      cuenta AS CUENTA,
      nombre AS NOMBRE,
      capitulo AS CAPITULO,
      seccion_principal AS "SECCIàN Principal",
      seccion_secundaria AS "SECCION Secundaria",
      orden
    FROM layout_cuentas
    WHERE empresa_id = ? AND modulo = ? AND anio = ? AND capitulo = ?
    ORDER BY orden ASC, cuenta ASC
  `).all(empresaConsulta, modulo, anioObjetivo, capituloObjetivo);

  let cuentas = consultarCuentas(anioNumero);
  let anioUsado = anioNumero;

  const requiereFallback =
    (!cuentas || !cuentas.length) &&
    (moduloNorm === 'SUMMARY' || moduloNorm === 'RESUMEN') &&
    Number.isInteger(anioNumero) &&
    anioNumero < 2025;

  if (requiereFallback) {
    const row = db.prepare(`
      SELECT MAX(anio) as anio
      FROM layout_cuentas
      WHERE empresa_id = ? AND modulo = ? AND anio <= ?
    `).get(empresaConsulta, modulo, 2025);
    const fallbackYear = row && row.anio ? Number(row.anio) : 2025;
    if (fallbackYear) {
      const cuentasFallback = consultarCuentas(fallbackYear);
      if (cuentasFallback && cuentasFallback.length) {
        cuentas = cuentasFallback;
        anioUsado = fallbackYear;
      }
    }
  }

  if (!cuentas || !cuentas.length) {
    return construirRespuestaLayout({
      empresaId: empresaConsulta,
      modulo,
      anio: anioUsado,
      capitulo: capituloObjetivo,
      cuentas: [],
      operaciones: []
    });
  }

  const operaciones = db.prepare(`
    SELECT 
      capitulo AS CAPITULO,
      clase AS Clase,
      seccion AS SECCION,
      operacion_tipo,
      operacion_label,
      signo,
      orden
    FROM layout_operaciones
    WHERE empresa_id = ? AND modulo = ? AND anio = ? AND capitulo = ?
    ORDER BY orden ASC
  `).all(empresaConsulta, modulo, anioUsado, capituloObjetivo);

  const operacionesMap = {};
  operaciones.forEach(op => {
    if (!operacionesMap[op.Clase]) {
      operacionesMap[op.Clase] = {
        HOJA: modulo, // Agregar HOJA para que el filtro en planeacionReportesEngine funcione
        CAPITULO: op.CAPITULO,
        Clase: op.Clase,
        SECCION: op.SECCION,
        signo: op.signo ?? 1,
        signos: {}
      };
    }
    operacionesMap[op.Clase][op.operacion_tipo] = op.operacion_label;
    operacionesMap[op.Clase].signos[op.operacion_tipo] = op.signo ?? 1;
  });

  return construirRespuestaLayout({
    empresaId: empresaConsulta,
    modulo,
    anio: anioUsado,
    capitulo: capituloObjetivo,
    cuentas,
    operaciones: Object.values(operacionesMap)
  });
};


/**
 * Obtener todos los capítulos disponibles para un módulo y año
 */

const obtenerCapitulos = ({ empresaId = 'EMPRESA01', modulo, anio }) => {
  const anioNumero = Number(anio);
  const moduloNorm = (modulo || '').toString().trim().toUpperCase();
  const empresaCanonica = obtenerEmpresaCanonica(empresaId);
  asegurarLayoutAnio({ empresaId: empresaCanonica, modulo, anio: anioNumero });
  const empresaConsulta = resolverEmpresaConsulta({ empresaId: empresaCanonica, modulo, anio: anioNumero });

  let capitulos = db.prepare(`
    SELECT DISTINCT capitulo
    FROM layout_cuentas
    WHERE empresa_id = ? AND modulo = ? AND anio = ?
    ORDER BY capitulo ASC
  `).all(empresaConsulta, modulo, anioNumero);

  const requiereFallback =
    (!capitulos || !capitulos.length) &&
    (moduloNorm === 'SUMMARY' || moduloNorm === 'RESUMEN') &&
    Number.isInteger(anioNumero) &&
    anioNumero < 2025;

  if (requiereFallback) {
    capitulos = db.prepare(`
      SELECT DISTINCT capitulo
      FROM layout_cuentas
      WHERE empresa_id = ? AND modulo = ? AND anio = ?
      ORDER BY capitulo ASC
    `).all(empresaConsulta, modulo, 2025);
  }

  return (capitulos || []).map((c) => ({ capitulo: c.capitulo }));
};


/**
 * Obtener años disponibles para un módulo
 */

const obtenerAniosDisponibles = ({ empresaId = 'EMPRESA01', modulo }) => {
  const empresaCanonica = obtenerEmpresaCanonica(empresaId);
  const anios = db.prepare(`
    SELECT DISTINCT anio
    FROM layout_cuentas
    WHERE empresa_id = ? AND modulo = ?
    ORDER BY anio DESC
  `).all(empresaCanonica, modulo);

  return anios.map(a => a.anio);
};


/**
 * Guardar cuentas de un layout
 */

const guardarCuentas = ({ empresaId = 'EMPRESA01', modulo, anio, capitulo, cuentas }) => {
  const empresaCanonica = obtenerEmpresaCanonica(empresaId);
  const insertCuenta = db.prepare(`
    INSERT OR REPLACE INTO layout_cuentas (
      empresa_id, modulo, anio, cuenta, nombre, capitulo, 
      seccion_principal, seccion_secundaria, orden, actualizado_en
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);

  const transaction = db.transaction((cuentasArray) => {
    cuentasArray.forEach((cuenta, index) => {
      if (!cuenta.CUENTA) {
 
        console.warn(`[layoutService] Cuenta sin codigo en ${modulo}/${capitulo}, ignorando`);
 
        return;
 
      }
 
      const seccionPrincipal = cuenta['SECCIàN Principal'] || cuenta.SECCION || cuenta.seccion || '';
      const seccionSecundaria = cuenta['SECCION Secundaria'] || cuenta.seccion_secundaria || null;
      const nombre = cuenta.NOMBRE || cuenta.nombre || cuenta.CUENTA || 'Sin nombre';

      insertCuenta.run(
        empresaCanonica,
        modulo,
        anio,
        cuenta.CUENTA,
        nombre,
        capitulo,
        seccionPrincipal,
        seccionSecundaria,
        cuenta.orden || index
      );
    });
  });

  transaction(cuentas);
  return { success: true, insertadas: cuentas.length };
};


/**
 * Guardar operaciones de un layout
 */

const guardarOperaciones = ({ empresaId = 'EMPRESA01', modulo, anio, operaciones }) => {
  const empresaCanonica = obtenerEmpresaCanonica(empresaId);
  const insertOperacion = db.prepare(`
    INSERT OR REPLACE INTO layout_operaciones (
      empresa_id, modulo, anio, capitulo, clase, seccion,
      operacion_tipo, operacion_label, signo, orden, actualizado_en
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);

  const transaction = db.transaction((operacionesArray) => {
    operacionesArray.forEach((op, index) => {
      const tiposOperacionBase = [
        'sum-row', 'sum-row-sumavarios', 'sum-row-sumavarios-consolidado',
        'sum-row-operativo', 'sum-row-operativo-consolidado',
        'result-row', 'net-row', 'net-row-adicional', 'result-net-row'
      ];
      const clavesReservadas = new Set([
        'HOJA', 'CAPITULO', 'Clase', 'SECCION', 'signo', 'orden'
      ]);
      const tiposOperacionExtra = Object.keys(op || {})
        .filter((key) => key && !clavesReservadas.has(key))
        .filter((key) => !tiposOperacionBase.includes(key));
      const tiposOperacion = [...tiposOperacionBase, ...tiposOperacionExtra];

      tiposOperacion.forEach((tipo, tipoIndex) => {
        if (op[tipo]) {
          const signoDesdeMapa = op.signos?.[tipo];
          const signoConfigurado = Number.isFinite(Number(signoDesdeMapa))
            ? Number(signoDesdeMapa)
            : Number(op.signo);
          let signo = Number.isFinite(signoConfigurado) && signoConfigurado !== 0 ? signoConfigurado : 1;
          if (!Number.isFinite(signoConfigurado) && op.Clase && op.Clase.toLowerCase().includes('expense')) {
            signo = -1;
          }

          insertOperacion.run(
            empresaCanonica,
            modulo,
            anio,
            op.CAPITULO || op.HOJA,
            op.Clase,
            op.SECCION,
            tipo,
            op[tipo],
            signo,
            index * 100 + tipoIndex
          );
        }
      });
    });
  });

  transaction(operaciones);
  return { success: true, insertadas: operaciones.length };
};


/**
 * Copiar layout de un año a otro (útil para crear nuevo año)
 */

const copiarLayout = ({ empresaId = 'EMPRESA01', modulo, anioOrigen, anioDestino }) => {
  const empresaCanonica = obtenerEmpresaCanonica(empresaId);
  const limpiarCuentas = db.prepare(`
    DELETE FROM layout_cuentas
    WHERE empresa_id = ? AND modulo = ? AND anio = ?
  `);
  const limpiarOperaciones = db.prepare(`
    DELETE FROM layout_operaciones
    WHERE empresa_id = ? AND modulo = ? AND anio = ?
  `);
  const limpiarSecciones = db.prepare(`
    DELETE FROM layout_secciones
    WHERE empresa_id = ? AND modulo = ? AND anio = ?
  `);
  const copiarCuentas = db.prepare(`
    INSERT INTO layout_cuentas (
      empresa_id, modulo, anio, cuenta, nombre, capitulo,
      seccion_principal, seccion_secundaria, orden
    )
    SELECT 
      empresa_id, modulo, ?, cuenta, nombre, capitulo,
      seccion_principal, seccion_secundaria, orden
    FROM layout_cuentas
    WHERE empresa_id = ? AND modulo = ? AND anio = ?
  `);

  const copiarOperaciones = db.prepare(`
    INSERT INTO layout_operaciones (
      empresa_id, modulo, anio, capitulo, clase, seccion,
      operacion_tipo, operacion_label, signo, orden
    )
    SELECT 
      empresa_id, modulo, ?, capitulo, clase, seccion,
      operacion_tipo, operacion_label, signo, orden
    FROM layout_operaciones
    WHERE empresa_id = ? AND modulo = ? AND anio = ?
  `);

  const copiarSecciones = db.prepare(`
    INSERT INTO layout_secciones (
      empresa_id, modulo, anio, capitulo, seccion_principal,
      seccion_secundaria, tipo, orden
    )
    SELECT 
      empresa_id, modulo, ?, capitulo, seccion_principal,
      seccion_secundaria, tipo, orden
    FROM layout_secciones
    WHERE empresa_id = ? AND modulo = ? AND anio = ?
  `);

  const transaction = db.transaction(() => {
    limpiarCuentas.run(empresaCanonica, modulo, anioDestino);
    limpiarOperaciones.run(empresaCanonica, modulo, anioDestino);
    limpiarSecciones.run(empresaCanonica, modulo, anioDestino);
    copiarCuentas.run(anioDestino, empresaCanonica, modulo, anioOrigen);
    copiarOperaciones.run(anioDestino, empresaCanonica, modulo, anioOrigen);
    copiarSecciones.run(anioDestino, empresaCanonica, modulo, anioOrigen);
  });

  transaction();
  return { success: true, mensaje: `Layout copiado de ${anioOrigen} a ${anioDestino}` };
};


/**
 * Eliminar layout completo de un año
 */

const eliminarLayout = ({ empresaId = 'EMPRESA01', modulo, anio }) => {
  const empresaCanonica = obtenerEmpresaCanonica(empresaId);
  const deleteCuentas = db.prepare(`
    DELETE FROM layout_cuentas
    WHERE empresa_id = ? AND modulo = ? AND anio = ?
  `);

  const deleteOperaciones = db.prepare(`
    DELETE FROM layout_operaciones
    WHERE empresa_id = ? AND modulo = ? AND anio = ?
  `);

  const deleteSecciones = db.prepare(`
    DELETE FROM layout_secciones
    WHERE empresa_id = ? AND modulo = ? AND anio = ?
  `);

  const transaction = db.transaction(() => {
    deleteCuentas.run(empresaCanonica, modulo, anio);
    deleteOperaciones.run(empresaCanonica, modulo, anio);
    deleteSecciones.run(empresaCanonica, modulo, anio);
  });

  transaction();
  return { success: true, mensaje: `Layout eliminado para año ${anio}` };
};


/**
 * Verificar si existe un layout para un año específico
 */

const existeLayout = ({ empresaId = 'EMPRESA01', modulo, anio }) => {
  const empresaCanonica = obtenerEmpresaCanonica(empresaId);
  const resultado = db.prepare(`
    SELECT COUNT(*) as count
    FROM layout_cuentas
    WHERE empresa_id = ? AND modulo = ? AND anio = ?
    LIMIT 1
  `).get(empresaCanonica, modulo, anio);

  return resultado.count > 0;
};


/**
 * Obtener estadísticas de un layout
 */

const obtenerEstadisticasLayout = ({ empresaId = 'EMPRESA01', modulo, anio }) => {
  const empresaCanonica = obtenerEmpresaCanonica(empresaId);
  const stats = db.prepare(`
    SELECT 
      COUNT(DISTINCT capitulo) as capitulos,
      COUNT(DISTINCT seccion_principal) as secciones,
      COUNT(*) as cuentas
    FROM layout_cuentas
    WHERE empresa_id = ? AND modulo = ? AND anio = ?
  `).get(empresaCanonica, modulo, anio);

  const operaciones = db.prepare(`
    SELECT COUNT(*) as operaciones
    FROM layout_operaciones
    WHERE empresa_id = ? AND modulo = ? AND anio = ?
  `).get(empresaCanonica, modulo, anio);

  return {
    ...stats,
    operaciones: operaciones.operaciones
  };
};



module.exports = {
  obtenerLayout,
  obtenerCapitulos,
  obtenerAniosDisponibles,
  guardarCuentas,
  guardarOperaciones,
  copiarLayout,
  eliminarLayout,
  eliminarLayoutCapitulo,
  existeLayout,
  obtenerEstadisticasLayout,
  obtenerEmpresaCanonica,
  crearLayoutDemo
};
