const { db } = require('../db/sqlite');
const { obtenerEmpresaPorId } = require('../config/empresas');

const obtenerLayout = ({ empresaId, modulo, anio }) => {
  if (!empresaId || !modulo || !Number.isInteger(Number(anio))) return null;
  const row = db.prepare(
    `SELECT id, empresa_id, modulo, anio, datos, creado_por, creado_en, actualizado_por, actualizado_en FROM layout_templates WHERE empresa_id = ? AND modulo = ? AND anio = ? LIMIT 1`
  ).get(empresaId, modulo, Number(anio));
  if (!row) return null;
  try { row.datos = JSON.parse(row.datos); } catch (err) { /* leave as string */ }
  return row;
};

const guardarLayout = ({ empresaId, modulo, anio, layout, usuarioId }) => {
  if (!empresaId || !modulo || !Number.isInteger(Number(anio))) return false;
  const existe = db.prepare(`SELECT id FROM layout_templates WHERE empresa_id = ? AND modulo = ? AND anio = ?`).get(empresaId, modulo, Number(anio));
  const datosCrudos = JSON.stringify(layout || {});
  if (existe) {
    db.prepare(`UPDATE layout_templates SET datos = ?, actualizado_por = ?, actualizado_en = CURRENT_TIMESTAMP WHERE id = ?`).run(datosCrudos, usuarioId || null, existe.id);
    return true;
  }
  db.prepare(`INSERT INTO layout_templates (empresa_id, modulo, anio, datos, creado_por) VALUES (?, ?, ?, ?, ?)`).run(empresaId, modulo, Number(anio), datosCrudos, usuarioId || null);
  return true;
};

const eliminarLayout = ({ empresaId, modulo, anio }) => {
  if (!empresaId || !modulo || !Number.isInteger(Number(anio))) return false;
  db.prepare(`DELETE FROM layout_templates WHERE empresa_id = ? AND modulo = ? AND anio = ?`).run(empresaId, modulo, Number(anio));
  return true;
};

module.exports = { obtenerLayout, guardarLayout, eliminarLayout };
