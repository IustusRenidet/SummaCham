/**
 * historial-coi.js
 * Vive en el Gestor de Plantillas (plantillas.html), en la sección aparte
 * "Presupuesto en COI" -- distinta de "Historial" del layout de esa misma
 * pantalla, que es el historial de versiones de la ESTRUCTURA, no de las
 * cifras.
 * Control de versiones del presupuesto: lista cada cambio guardado en COI
 * desde este programa (Guardar en COI por módulo, o Copiar a otro año),
 * leyendo la tabla presupuestos_guardados (ya existía, se llenaba en cada
 * guardado, pero nada la mostraba). Cada fila tiene un botón "Ver detalle"
 * que trae, cuenta por cuenta, los 12 valores mensuales que se escribieron
 * en COI en ese guardado. Solo lectura.
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
      if (window.state?.empresaId) return window.state.empresaId;
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

        const tdAccion = document.createElement("td");
        const btnVerDetalle = document.createElement("button");
        btnVerDetalle.type = "button";
        btnVerDetalle.className = "btn btn-outline-secondary btn-sm";
        btnVerDetalle.textContent = "Ver detalle";
        btnVerDetalle.addEventListener("click", () => abrirDetalle(fila.id));
        tdAccion.appendChild(btnVerDetalle);

        tr.append(tdFecha, tdUsuario, tdTipo, tdAnio, tdDetalle, tdAccion);
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

  const formatoMonto = (valor) =>
    Number(valor || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const construirResumenDetalle = (detalle) => {
    if (detalle.tipo === "Copia entre años") {
      return `Copia de presupuesto de ${detalle.anioOrigen} a ${detalle.anioDestino}, ` +
        `guardada por ${detalle.guardadoPor} el ${formatoFecha(detalle.guardadoEn)}. ` +
        `${(detalle.cuentas || []).length} cuenta(s).`;
    }
    return `Guardado en COI en el módulo ${detalle.modulo || "?"} (${detalle.anio}), ` +
      `por ${detalle.guardadoPor} el ${formatoFecha(detalle.guardadoEn)}. ` +
      `${(detalle.cuentas || []).length} cuenta(s) con los valores mensuales que se escribieron.`;
  };

  const pintarTablaDetalle = (detalle) => {
    const tbody = $("tablaHistorialCoiDetalle")?.querySelector("tbody");
    if (!tbody) return;
    const frag = document.createDocumentFragment();
    (detalle.cuentas || []).forEach((item) => {
      const tr = document.createElement("tr");
      if (item.sobrescribe) tr.classList.add("table-warning");
      const tdCuenta = document.createElement("td");
      tdCuenta.className = "font-monospace small";
      tdCuenta.textContent = item.cuenta;
      const tdNombre = document.createElement("td");
      tdNombre.className = "small";
      tdNombre.textContent = item.nombre || "";
      tr.append(tdCuenta, tdNombre);
      (item.valores || []).forEach((valor) => {
        const td = document.createElement("td");
        td.className = "small text-end font-monospace";
        td.textContent = formatoMonto(valor);
        tr.appendChild(td);
      });
      frag.appendChild(tr);
    });
    tbody.innerHTML = "";
    tbody.appendChild(frag);
  };

  const abrirDetalle = async (id) => {
    const modalEl = $("historialCoiDetalleModal");
    const estado = $("historialCoiDetalleEstado");
    const resumen = $("historialCoiDetalleResumen");
    const tbody = $("tablaHistorialCoiDetalle")?.querySelector("tbody");
    if (tbody) tbody.innerHTML = "";
    if (resumen) resumen.textContent = "";
    if (estado) {
      estado.className = "alert alert-secondary small";
      estado.textContent = "Cargando detalle...";
    }
    if (modalEl && window.bootstrap?.Modal) {
      window.bootstrap.Modal.getOrCreateInstance(modalEl).show();
    }
    try {
      const resp = await fetch(`${API_BASE}/presupuestos/historial-coi/${encodeURIComponent(id)}/detalle`, {
        headers: headers(),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(data.mensaje || "No fue posible obtener el detalle.");
      }
      if (resumen) resumen.textContent = construirResumenDetalle(data);
      pintarTablaDetalle(data);
      if (estado) {
        if (!(data.cuentas || []).length) {
          estado.className = "alert alert-secondary small";
          estado.textContent = "Este registro no tiene cuentas con detalle disponible.";
        } else {
          estado.className = "d-none";
        }
      }
    } catch (err) {
      if (estado) {
        estado.className = "alert alert-danger small";
        estado.textContent = err.message || "No fue posible obtener el detalle.";
      }
    }
  };

  document.addEventListener("DOMContentLoaded", () => {
    if (esAdminGlobal()) {
      $("btnHistorialCoi")?.classList.remove("d-none");
    }
    $("btnHistorialCoi")?.addEventListener("click", abrirModal);
  });
})();
