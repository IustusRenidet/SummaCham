const { db } = require('../db/sqlite');
const layoutService = require('./layoutService');

const DEFAULT_CAPITULO = 'DEFAULT';

const normalizarTexto = (valor) => (valor == null ? '' : String(valor).trim());

const seleccionarValor = (obj = {}, posibles = []) => {
  for (const clave of posibles) {
    if (obj[clave] != null && obj[clave] !== '') {
      return obj[clave];
    }
  }
  return null;
};

const normalizarCapitulo = (valor) => {
  const texto = normalizarTexto(valor);
  return texto || DEFAULT_CAPITULO;
};

const construirFila = (cuenta, indiceGlobal) => {
  const cuentaCodigo = normalizarTexto(cuenta?.CUENTA || cuenta?.cuenta);
  const descripcion = normalizarTexto(
    cuenta?.NOMBRE || cuenta?.nombre || cuenta?.descripcion
  );
  if (!cuentaCodigo) {
    return null;
  }

  const seccionPrincipal = seleccionarValor(cuenta, [
    'SECCIÓN Principal',
    'SECCI…N Principal',
    'SECCION Principal',
    'seccion_principal',
    'seccionPrincipal',
  ]);

  const seccionSecundaria = seleccionarValor(cuenta, [
    'SECCION Secundaria',
    'SECCIÓN Secundaria',
    'SECCI…N Secundaria',
    'seccion_secundaria',
    'seccionSecundaria',
  ]);

  const capitulo = normalizarCapitulo(
    cuenta?.CAPITULO || cuenta?.capitulo || cuenta?.HOJA
  );

  const orden = Number.isFinite(Number(cuenta?.orden))
    ? Number(cuenta.orden)
    : indiceGlobal;

  return {
    indice: indiceGlobal,
    cuenta: cuentaCodigo,
    descripcion,
    capitulo,
    seccionPrincipal: seccionPrincipal ? String(seccionPrincipal) : null,
    seccionSecundaria: seccionSecundaria ? String(seccionSecundaria) : null,
    orden,
    origen: 'sqlite',
  };
};

const construirLayout = ({
  empresaId,
  modulo,
  anio,
  filas = [],
  timestamp = new Date().toISOString(),
}) => ({
  empresaId,
  modulo,
  anio,
  filas,
  total: filas.length,
  timestamp,
});

const consultarFilasPorCapitulo = ({
  empresaCanonica,
  modulo,
  anio,
  capitulo,
}) => {
  const stmt = db.prepare(
    `
    SELECT 
      cuenta,
      nombre,
      capitulo,
      seccion_principal,
      seccion_secundaria,
      orden
    FROM layout_cuentas
    WHERE empresa_id = ? AND modulo = ? AND anio = ? AND capitulo = ?
    ORDER BY orden ASC, cuenta ASC
  `
  );
  return stmt.all(empresaCanonica, modulo, anio, capitulo);
};

const listarCapitulos = ({ empresaId, modulo, anio }) => {
  const capitulosSqlite =
    layoutService
      .obtenerCapitulos({ empresaId, modulo, anio })
      ?.map((c) => normalizarCapitulo(c?.capitulo)) || [];
  if (capitulosSqlite.length === 0) {
    return [DEFAULT_CAPITULO];
  }
  return Array.from(new Set(capitulosSqlite));
};

const obtenerLayout = ({ empresaId, modulo, anio }) => {
  const anioNumero = Number(anio);
  if (!empresaId || !modulo || !Number.isInteger(anioNumero)) {
    return null;
  }

  const empresaCanonica = layoutService.obtenerEmpresaCanonica(empresaId);
  const capitulos = listarCapitulos({
    empresaId: empresaCanonica,
    modulo,
    anio: anioNumero,
  });

  let indiceGlobal = 0;
  const filas = [];

  capitulos.forEach((capitulo) => {
    const cuentas = consultarFilasPorCapitulo({
      empresaCanonica,
      modulo,
      anio: anioNumero,
      capitulo,
    });
    cuentas.forEach((cuenta) => {
      const fila = construirFila(cuenta, indiceGlobal);
      if (fila) {
        filas.push(fila);
        indiceGlobal += 1;
      }
    });
  });

  return construirLayout({
    empresaId: empresaCanonica,
    modulo,
    anio: anioNumero,
    filas,
  });
};

const guardarLayout = ({ empresaId, modulo, anio, layout }) => {
  const anioNumero = Number(anio);
  if (!empresaId || !modulo || !Number.isInteger(anioNumero) || !layout) {
    return false;
  }

  const filas = Array.isArray(layout?.filas) ? layout.filas : [];
  if (!filas.length) {
    return false;
  }

  const empresaCanonica = layoutService.obtenerEmpresaCanonica(empresaId);
  const updatePorCapitulo = db.prepare(
    `
    UPDATE layout_cuentas
    SET nombre = ?, orden = ?, actualizado_en = CURRENT_TIMESTAMP
    WHERE empresa_id = ? AND modulo = ? AND anio = ? AND cuenta = ? AND capitulo = ?
  `
  );
  const updateTodasLasHojas = db.prepare(
    `
    UPDATE layout_cuentas
    SET nombre = ?, orden = ?, actualizado_en = CURRENT_TIMESTAMP
    WHERE empresa_id = ? AND modulo = ? AND anio = ? AND cuenta = ?
  `
  );

  let actualizadas = 0;
  let omitidas = 0;
  const tx = db.transaction((filasLayout) => {
    filasLayout.forEach((fila, idx) => {
      const cuenta = normalizarTexto(fila?.cuenta || fila?.CUENTA);
      if (!cuenta) {
        omitidas += 1;
        return;
      }
      const descripcion = normalizarTexto(
        fila?.descripcion || fila?.nombre || fila?.texto
      );
      const capituloRaw =
        fila?.capitulo || fila?.CAPITULO || layout?.capitulo || null;
      const capituloNormalizado = capituloRaw
        ? normalizarCapitulo(capituloRaw)
        : null;
      const orden = Number.isFinite(Number(fila?.orden))
        ? Number(fila.orden)
        : Number.isFinite(Number(fila?.indice))
        ? Number(fila.indice)
        : idx;

      const tieneCapitulo = Boolean(capituloNormalizado);
      const resultado = (tieneCapitulo ? updatePorCapitulo : updateTodasLasHojas).run(
        descripcion || cuenta,
        orden,
        empresaCanonica,
        modulo,
        anioNumero,
        cuenta,
        ...(tieneCapitulo ? [capituloNormalizado] : [])
      );
      if (resultado.changes > 0) {
        actualizadas += resultado.changes;
      } else {
        omitidas += 1;
      }
    });
  });

  tx(filas);

  if (omitidas) {
    console.warn(
      `[layoutsService] ${omitidas} cuentas no existen en layout_cuentas (${empresaCanonica}/${modulo}/${anioNumero}).`
    );
  }

  return { actualizadas, omitidas };
};

const eliminarLayout = ({ empresaId, modulo, anio }) => {
  if (!empresaId || !modulo || !Number.isInteger(Number(anio))) {
    return false;
  }
  return layoutService.eliminarLayout({ empresaId, modulo, anio });
};

module.exports = { obtenerLayout, guardarLayout, eliminarLayout };
