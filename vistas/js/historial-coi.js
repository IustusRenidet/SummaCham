/**
 * historial-coi.js
 * Control de versiones del presupuesto: lista cada cambio guardado en COI
 * desde este programa (Guardar en COI por módulo, o Copiar a otro año),
 * leyendo la tabla presupuestos_guardados (ya existía, se llenaba en cada
 * guardado, pero nada la mostraba). Solo lectura.
 */
(() => {
  const origin =
    window.location.protocol === "file:"
      ? "http://localhost:3005"
      : window.location.origin;
  const API_BASE = `${origin}/api`;

  const headers = () =>
    typeof Sesion?.headersAutenticacion === "function"
      ? Sesion.headersAutenticacion()
      : {};

  const $ = (id) => document.getElementById(id);

  const esAdminGlobal = () => {
    try {
      return Boolean(Sesion?.esAdminGlobal?.());
    } catch (_) {
      return false;
    }
  };

  const obtenerEmpresaActivaId = () => {
    try {
      return Sesion?.obtenerEmpresaActiva?.()?.id || null;
    } catch (_) {
      return null;
    }
  };

  const formatoFecha = (iso) => {
    if (!iso) return "";
    try {
      const fecha = new Date(iso.replace(" ", "T") + "Z");
      return fecha.toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });
    } catch (_) {
      return iso;
    }
  };

  const construirDetalleTexto = (fila) => {
    if (fila.tipo === "Copia entre años") {
      return fila.resumen;
    }
    const modulo = fila.modulo || "?";
    return `${fila.resumen} en el módulo ${modulo}`;
  };

  const cargarHistorial = async () => {
    const estado = $("historialCoiEstado");
    const tbody = $("tablaHistorialCoi")?.querySelector("tbody");
    if (!tbody) return;
    if (estado) {
      estado.className = "alert alert-secondary small";
      estado.textContent = "Cargando historial...";
    }
    tbody.innerHTML = "";
    try {
      const empresaId = obtenerEmpresaActivaId();
      const params = new URLSearchParams();
      if (empresaId) params.set("empresaId", empresaId);
      const resp = await fetch(`${API_BASE}/presupuestos/historial-coi?${params.toString()}`, {
        headers: headers(),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(data.mensaje || "No fue posible obtener el historial.");
      }
      const filas = data.historial || [];
      if (!filas.length) {
        if (estado) {
          estado.className = "alert alert-secondary small";
          estado.textContent = "Todavía no hay ningún cambio registrado para esta empresa.";
        }
        return;
      }
      if (estado) {
        estado.className = "alert alert-success small";
        estado.textContent = `${filas.length} registro(s) encontrados.`;
      }
      const frag = document.createDocumentFragment();
      filas.forEach((fila) => {
        const tr = document.createElement("tr");
        if (fila.tipo === "Copia entre años") tr.classList.add("table-info");

        const tdFecha = document.createElement("td");
        tdFecha.className = "small text-nowrap";
        tdFecha.textContent = formatoFecha(fila.guardadoEn);

        const tdUsuario = document.createElement("td");
        tdUsuario.className = "small";
        tdUsuario.textContent = fila.guardadoPor;

        const tdTipo = document.createElement("td");
        tdTipo.className = "small";
        tdTipo.textContent = fila.tipo;

        const tdAnio = document.createElement("td");
        tdAnio.className = "small";
        tdAnio.textContent = fila.anio;

        const tdDetalle = document.createElement("td");
        tdDetalle.className = "small";
        tdDetalle.textContent = construirDetalleTexto(fila);

        tr.append(tdFecha, tdUsuario, tdTipo, tdAnio, tdDetalle);
        frag.appendChild(tr);
      });
      tbody.appendChild(frag);
    } catch (err) {
      if (estado) {
        estado.className = "alert alert-danger small";
        estado.textContent = err.message || "No fue posible obtener el historial.";
      }
    }
  };

  const abrirModal = () => {
    const modalEl = $("historialCoiModal");
    if (modalEl && window.bootstrap?.Modal) {
      window.bootstrap.Modal.getOrCreateInstance(modalEl).show();
    }
    cargarHistorial();
  };

  document.addEventListener("DOMContentLoaded", () => {
    if (esAdminGlobal()) {
      $("btnHistorialCoi")?.classList.remove("d-none");
    }
    $("btnHistorialCoi")?.addEventListener("click", abrirModal);
  });
})();
