/**
 * copiar-presupuesto.js
 * Modal para copiar el presupuesto (PRESUP de Firebird) de un año a otro,
 * completo (solo a cuentas que coinciden con el catálogo del año destino),
 * dentro de la misma empresa/capítulo. Solo administradores globales ven el
 * botón. Flujo de dos pasos, con doble confirmación:
 *
 *   1) "Revisar cambios" -> trae el detalle real (GET /copiar/detalle, no
 *      escribe nada) y lo muestra: cuántas cuentas nuevas, cuántas se
 *      sobrescriben (con valor real, no cero) y cuántas se omiten por no
 *      existir en el año destino, más la lista cuenta por cuenta y un botón
 *      para descargar ese mismo detalle como reporte.
 *   2) "Copiar presupuesto" -> segunda confirmación explícita (confirm())
 *      antes de ejecutar la escritura real.
 *
 * Cada copia queda registrada en el historial de COI (presupuestos_guardados)
 * del lado del servidor -- ver historial-coi.js para verla.
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

  let detalleVigente = null;

  const obtenerEmpresaActivaId = () => {
    try {
      return Sesion?.obtenerEmpresaActiva?.()?.id || null;
    } catch (_) {
      return null;
    }
  };

  const esAdminGlobal = () => {
    try {
      return Boolean(Sesion?.esAdminGlobal?.());
    } catch (_) {
      return false;
    }
  };

  const poblarSelectAnios = (select, anioSeleccionadoPreferido) => {
    const origenSelect = $("presupuestosYearSelect");
    if (!select || !origenSelect) return;
    const opciones = Array.from(origenSelect.options)
      .map((op) => op.value)
      .filter((v) => v && !Number.isNaN(Number(v)));
    select.innerHTML = "";
    opciones.forEach((valor) => {
      const opt = document.createElement("option");
      opt.value = valor;
      opt.textContent = valor;
      select.appendChild(opt);
    });
    if (anioSeleccionadoPreferido && opciones.includes(String(anioSeleccionadoPreferido))) {
      select.value = String(anioSeleccionadoPreferido);
    }
  };

  const mostrarError = (mensaje) => {
    const el = $("copiarPresupuestoError");
    if (!el) return;
    if (!mensaje) {
      el.classList.add("d-none");
      el.textContent = "";
      return;
    }
    el.textContent = mensaje;
    el.classList.remove("d-none");
  };

  const resetPaso = () => {
    detalleVigente = null;
    $("copiarPresupuestoResumen")?.classList.add("d-none");
    $("btnRevisarCopiaPresupuesto")?.classList.remove("d-none");
    $("btnConfirmarCopiaPresupuesto")?.classList.add("d-none");
    const tbody = $("tablaDetalleCopia")?.querySelector("tbody");
    if (tbody) tbody.innerHTML = "";
    mostrarError("");
  };

  const abrirModal = () => {
    if (!esAdminGlobal()) {
      alert("Solo un administrador global puede copiar presupuestos entre años.");
      return;
    }
    const empresaId = obtenerEmpresaActivaId();
    if (!empresaId) {
      alert("Selecciona una empresa antes de copiar presupuesto.");
      return;
    }
    const anioActual = $("presupuestosYearSelect")?.value || "";
    poblarSelectAnios($("copiarAnioOrigen"), anioActual);
    poblarSelectAnios($("copiarAnioDestino"), "");
    resetPaso();
    const modalEl = $("copiarPresupuestoModal");
    if (modalEl && window.bootstrap?.Modal) {
      window.bootstrap.Modal.getOrCreateInstance(modalEl).show();
    }
  };

  const estadoCuenta = (item) => (item.sobrescribe ? "Se sobrescribe (tenía valor)" : "Nueva (destino en $0)");

  const pintarTablaDetalle = (detalle) => {
    const tbody = $("tablaDetalleCopia")?.querySelector("tbody");
    if (!tbody) return;
    const frag = document.createDocumentFragment();
    detalle.cuentas.forEach((item) => {
      const tr = document.createElement("tr");
      if (item.sobrescribe) tr.classList.add("table-warning");
      const tdCuenta = document.createElement("td");
      tdCuenta.className = "font-monospace small";
      tdCuenta.textContent = item.cuenta;
      const tdNombre = document.createElement("td");
      tdNombre.className = "small";
      tdNombre.textContent = item.nombre || "";
      const tdEstado = document.createElement("td");
      tdEstado.className = "small";
      tdEstado.textContent = estadoCuenta(item);
      tr.append(tdCuenta, tdNombre, tdEstado);
      frag.appendChild(tr);
    });
    detalle.omitidasDetalle.forEach((item) => {
      const tr = document.createElement("tr");
      tr.classList.add("table-secondary", "text-muted");
      const tdCuenta = document.createElement("td");
      tdCuenta.className = "font-monospace small";
      tdCuenta.textContent = item.cuenta;
      const tdNombre = document.createElement("td");
      tdNombre.className = "small";
      tdNombre.textContent = item.nombre || "";
      const tdEstado = document.createElement("td");
      tdEstado.className = "small";
      tdEstado.textContent = "Omitida (no existe en el año destino)";
      tr.append(tdCuenta, tdNombre, tdEstado);
      frag.appendChild(tr);
    });
    tbody.innerHTML = "";
    tbody.appendChild(frag);
  };

  const revisarCambios = async () => {
    mostrarError("");
    const empresaId = obtenerEmpresaActivaId();
    const anioOrigen = $("copiarAnioOrigen")?.value;
    const anioDestino = $("copiarAnioDestino")?.value;
    if (!empresaId || !anioOrigen || !anioDestino) {
      mostrarError("Selecciona el año de origen y el año destino.");
      return;
    }
    if (anioOrigen === anioDestino) {
      mostrarError("El año de origen y el de destino deben ser distintos.");
      return;
    }

    const boton = $("btnRevisarCopiaPresupuesto");
    if (boton) {
      boton.disabled = true;
      boton.textContent = "Consultando...";
    }
    try {
      const params = new URLSearchParams({ empresaId, anioOrigen, anioDestino });
      const resp = await fetch(`${API_BASE}/presupuestos/copiar/detalle?${params.toString()}`, {
        headers: headers(),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(data.mensaje || "No fue posible calcular el detalle.");
      }
      detalleVigente = data;

      $("resumenTotal").textContent = data.totalACopiar;
      $("resumenNuevas").textContent = data.nuevas;
      $("resumenSobrescriben").textContent = data.sobrescribiran;
      $("resumenOmitidas").textContent = data.omitidas;
      pintarTablaDetalle(data);
      $("copiarPresupuestoResumen")?.classList.remove("d-none");

      if (!data.totalACopiar) {
        mostrarError("No hay ninguna cuenta que se pueda copiar entre estos dos años.");
        return;
      }
      $("btnRevisarCopiaPresupuesto")?.classList.add("d-none");
      $("btnConfirmarCopiaPresupuesto")?.classList.remove("d-none");
    } catch (err) {
      mostrarError(err.message || "No fue posible calcular el detalle.");
    } finally {
      if (boton) {
        boton.disabled = false;
        boton.textContent = "Revisar cambios";
      }
    }
  };

  const csvEscapar = (valor) => {
    const texto = String(valor ?? "");
    if (/[",;\n]/.test(texto)) {
      return `"${texto.replace(/"/g, '""')}"`;
    }
    return texto;
  };

  const descargarReporte = () => {
    if (!detalleVigente) return;
    const filas = [["Cuenta", "Nombre", "Estado"]];
    detalleVigente.cuentas.forEach((item) => {
      filas.push([item.cuenta, item.nombre || "", estadoCuenta(item)]);
    });
    detalleVigente.omitidasDetalle.forEach((item) => {
      filas.push([item.cuenta, item.nombre || "", "Omitida (no existe en el año destino)"]);
    });
    const csv = filas.map((fila) => fila.map(csvEscapar).join(",")).join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `copia_presupuesto_${detalleVigente.anioOrigen}_a_${detalleVigente.anioDestino}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const ejecutarCopia = async ({ empresaId, anioOrigen, anioDestino, permitirSobrescritura }) => {
    const resp = await fetch(`${API_BASE}/presupuestos/copiar`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers() },
      body: JSON.stringify({ empresaId, anioOrigen, anioDestino, permitirSobrescritura }),
    });
    const data = await resp.json().catch(() => ({}));
    return { status: resp.status, data };
  };

  const confirmarCopia = async () => {
    if (!detalleVigente) return;
    mostrarError("");

    // Segunda confirmación explícita -- la primera fue revisar el detalle y
    // decidir continuar.
    const avisoSobrescritura = detalleVigente.sobrescribiran
      ? `\n\n${detalleVigente.sobrescribiran} cuenta(s) YA tienen presupuesto capturado en ${detalleVigente.anioDestino} y se perderá ese valor.`
      : "";
    const confirmado = confirm(
      `¿Confirmas copiar el presupuesto de ${detalleVigente.anioOrigen} a ${detalleVigente.anioDestino}?\n\n` +
        `Se escribirán ${detalleVigente.totalACopiar} cuenta(s) directo en COI.${avisoSobrescritura}\n\n` +
        `Esta acción no se puede deshacer desde el programa.`
    );
    if (!confirmado) return;

    const boton = $("btnConfirmarCopiaPresupuesto");
    if (boton) {
      boton.disabled = true;
      boton.textContent = "Copiando...";
    }
    try {
      const { status, data } = await ejecutarCopia({
        empresaId: detalleVigente.empresaId,
        anioOrigen: detalleVigente.anioOrigen,
        anioDestino: detalleVigente.anioDestino,
        permitirSobrescritura: detalleVigente.sobrescribiran > 0,
      });

      if (status < 200 || status >= 300) {
        throw new Error(data.mensaje || "No fue posible copiar el presupuesto.");
      }

      const modalEl = $("copiarPresupuestoModal");
      if (modalEl && window.bootstrap?.Modal) {
        window.bootstrap.Modal.getInstance(modalEl)?.hide();
      }
      alert(
        `Presupuesto copiado: ${data.copiadas} cuenta(s) de ${data.anioOrigen} a ${data.anioDestino}` +
          (data.omitidas ? ` (${data.omitidas} omitida(s)).` : ".") +
          `\n\nQuedó registrado en el historial de COI.`
      );
      if (String($("presupuestosYearSelect")?.value) === String(data.anioDestino)) {
        window.location.reload();
      }
    } catch (err) {
      mostrarError(err.message || "No fue posible copiar el presupuesto.");
    } finally {
      if (boton) {
        boton.disabled = false;
        boton.textContent = "Copiar presupuesto";
      }
    }
  };

  document.addEventListener("DOMContentLoaded", () => {
    // El botón solo se muestra a administradores globales.
    if (esAdminGlobal()) {
      $("btnCopiarPresupuesto")?.classList.remove("d-none");
    }
    $("btnCopiarPresupuesto")?.addEventListener("click", abrirModal);
    $("btnRevisarCopiaPresupuesto")?.addEventListener("click", revisarCambios);
    $("btnConfirmarCopiaPresupuesto")?.addEventListener("click", confirmarCopia);
    $("btnDescargarReporteCopia")?.addEventListener("click", descargarReporte);
    $("copiarAnioOrigen")?.addEventListener("change", resetPaso);
    $("copiarAnioDestino")?.addEventListener("change", resetPaso);
  });
})();
