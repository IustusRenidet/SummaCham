async (page) => {
  const baseUrl = "http://127.0.0.1:3005";
  const targetYear = "2026";
  const targetChapter = "GUADALAJARA";

  const modules = [
    { html: "Membresía.html", modulo: "Membresía" },
    { html: "Eventos.html", modulo: "Eventos" },
    { html: "Comunicación.html", modulo: "Comunicación" },
    { html: "Dirección.html", modulo: "Dirección" },
    { html: "Serv_Membresía.html", modulo: "Serv Membresía" },
    { html: "Comités.html", modulo: "Comités" },
    { html: "T&IC.html", modulo: "T&IC" },
    { html: "RH.html", modulo: "RH" },
    { html: "VPE.html", modulo: "VPE" },
    { html: "Finanzas.html", modulo: "Finanzas" },
    { html: "GastosGenerales.html", modulo: "Gastos Generales" },
    { html: "Nomina.html", modulo: "Nomina" },
    { html: "Gtos_Corporativos.html", modulo: "Gtos Corporativos" },
  ];

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const codeRegex = /^[0-9]{3}-[0-9]{3}-[0-9]{3}-[0-9]{2}$/;

  const rowKey = (row) => {
    if (!row || typeof row !== "object") return "";
    if (row.type === "account") {
      return `acc:${String(row.accountCode || row.label || row.rowId || "").trim()}`;
    }
    if (row.type === "operation") {
      return `op:${String(row.rowId || row.operationId || row.label || "").trim()}`;
    }
    if (row.type === "subsection") {
      return `sub:${String(row.rowId || row.subsectionName || row.label || "").trim()}`;
    }
    if (row.type === "principal") {
      return `pri:${String(row.rowId || row.principalName || row.label || "").trim()}`;
    }
    return `${row.type || "row"}:${String(row.rowId || row.label || "").trim()}`;
  };

  const accountCode = (row) => String(row?.accountCode || row?.label || "").trim();

  const ensurePlantillas = async () => {
    if (!page.url().includes("plantillas.html")) {
      await page.goto(`${baseUrl}/plantillas.html`);
    }
    await page.waitForSelector("#moduloSelect", { timeout: 15000 });
  };

  const ensureEmpresa2 = async () => {
    await page.evaluate(() => {
      try {
        window.Sesion?.establecerEmpresaActiva?.("empresa2");
      } catch (_) {
        // ignore
      }
    });
  };

  const chooseChapterOption = async () => {
    try {
      await page.selectOption("#capituloSelect", { label: targetChapter });
      return;
    } catch (_) {
      // ignore
    }
    try {
      await page.selectOption("#capituloSelect", targetChapter);
      return;
    } catch (_) {
      // ignore
    }
    await page.evaluate((target) => {
      const select = document.querySelector("#capituloSelect");
      if (!select) return;
      const options = Array.from(select.options || []);
      const match = options.find((o) => String(o.value || "").toUpperCase().includes(target));
      if (!match) return;
      select.value = match.value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }, targetChapter);
  };

  const loadContext = async (modulo) => {
    await ensurePlantillas();
    await ensureEmpresa2();

    await page.selectOption("#moduloSelect", modulo);

    await page.waitForFunction(
      (year) => {
        const sel = document.querySelector("#anioSelect");
        if (!sel) return false;
        return Array.from(sel.options || []).some((o) => String(o.value) === year);
      },
      targetYear,
      { timeout: 15000 },
    );

    await page.selectOption("#anioSelect", targetYear);

    await page.waitForFunction(
      (chapter) => {
        const sel = document.querySelector("#capituloSelect");
        if (!sel) return false;
        return Array.from(sel.options || []).some((o) => String(o.value || "").toUpperCase().includes(chapter));
      },
      targetChapter,
      { timeout: 15000 },
    );

    await chooseChapterOption();
    await page.click("#btnCargar");

    await page.waitForFunction(
      ({ modulo, chapter }) => {
        if (!window.state) return false;
        const sameModulo = String(window.state.modulo || "") === modulo;
        const sameYear = String(window.state.anio || "") === "2026";
        const sameChapter = String(window.state.capitulo || "").toUpperCase().includes(chapter);
        return sameModulo && sameYear && sameChapter;
      },
      { modulo, chapter: targetChapter },
      { timeout: 20000 },
    );

    await sleep(1600);
  };

  const getRows = async () =>
    page.evaluate(() => {
      const rows = window.getTemplateRowsForReorder ? window.getTemplateRowsForReorder() : [];
      const mapped = rows.map((r, i) => ({
        i,
        type: r.type,
        label: String(r.label || "").trim(),
        accountCode: String(r.accountCode || "").trim(),
        principalName: String(r.principalName || "").trim(),
        subsectionName: String(r.subsectionName || "").trim(),
        rowId: String(r.rowId || r.id || "").trim(),
        operationId: String(r.operationId || "").trim(),
      }));
      const counts = mapped.reduce((acc, r) => {
        acc[r.type] = (acc[r.type] || 0) + 1;
        return acc;
      }, {});
      return { rows: mapped, counts };
    });

  const waitAutoSave = async () => {
    await sleep(2200);
    await page
      .waitForFunction(() => window.state && window.state.unsavedChanges === false, {
        timeout: 6000,
      })
      .catch(() => null);
    await sleep(600);
  };

  const moveByType = async (type) =>
    page.evaluate((rowType) => {
      const rows = window.getTemplateRowsForReorder ? window.getTemplateRowsForReorder() : [];
      const key = (row) => {
        if (!row || typeof row !== "object") return "";
        if (row.type === "account") {
          return `acc:${String(row.accountCode || row.label || row.rowId || "").trim()}`;
        }
        if (row.type === "operation") {
          return `op:${String(row.rowId || row.operationId || row.label || "").trim()}`;
        }
        if (row.type === "subsection") {
          return `sub:${String(row.rowId || row.subsectionName || row.label || "").trim()}`;
        }
        if (row.type === "principal") {
          return `pri:${String(row.rowId || row.principalName || row.label || "").trim()}`;
        }
        return `${row.type || "row"}:${String(row.rowId || row.label || "").trim()}`;
      };

      const findIndex = (arr, targetKey) => arr.findIndex((r) => key(r) === targetKey);

      let from = -1;
      let to = -1;

      if (rowType === "account") {
        for (let i = 1; i < rows.length; i += 1) {
          const curr = rows[i];
          const prev = rows[i - 1];
          if (curr?.type !== "account" || prev?.type !== "account") continue;
          const sameParent =
            String(curr?.principalName || "") === String(prev?.principalName || "") &&
            String(curr?.subsectionName || "") === String(prev?.subsectionName || "");
          if (!sameParent) continue;
          from = i;
          to = i - 1;
          break;
        }
      } else {
        const idxs = [];
        rows.forEach((r, i) => {
          if (r?.type === rowType) idxs.push(i);
        });
        if (idxs.length >= 2) {
          from = idxs[1];
          to = idxs[0];
        }
      }

      if (from < 0 || to < 0 || !rows[from] || !rows[to]) {
        return {
          attempted: false,
          reason: "no-candidate",
          type: rowType,
        };
      }

      const moving = rows[from];
      const target = rows[to];
      const movingKey = key(moving);
      const targetKey = key(target);

      window.moveTemplateRowOrderToIndex(from, to);

      const after = window.getTemplateRowsForReorder ? window.getTemplateRowsForReorder() : [];
      const movingAfter = findIndex(after, movingKey);
      const targetAfter = findIndex(after, targetKey);

      return {
        attempted: true,
        type: rowType,
        from,
        to,
        movingKey,
        targetKey,
        movingLabel: String(moving?.label || moving?.accountCode || "").trim(),
        targetLabel: String(target?.label || target?.accountCode || "").trim(),
        movingAfter,
        targetAfter,
        movedBeforeTarget: movingAfter >= 0 && targetAfter >= 0 ? movingAfter < targetAfter : null,
      };
    }, type);

  const restoreByKeys = async ({ movingKey, targetKey }) =>
    page.evaluate(({ movingKey: moveK, targetKey: targetK }) => {
      const rows = window.getTemplateRowsForReorder ? window.getTemplateRowsForReorder() : [];
      const key = (row) => {
        if (!row || typeof row !== "object") return "";
        if (row.type === "account") {
          return `acc:${String(row.accountCode || row.label || row.rowId || "").trim()}`;
        }
        if (row.type === "operation") {
          return `op:${String(row.rowId || row.operationId || row.label || "").trim()}`;
        }
        if (row.type === "subsection") {
          return `sub:${String(row.rowId || row.subsectionName || row.label || "").trim()}`;
        }
        if (row.type === "principal") {
          return `pri:${String(row.rowId || row.principalName || row.label || "").trim()}`;
        }
        return `${row.type || "row"}:${String(row.rowId || row.label || "").trim()}`;
      };
      const idxMoving = rows.findIndex((r) => key(r) === moveK);
      const idxTarget = rows.findIndex((r) => key(r) === targetK);
      if (idxMoving < 0 || idxTarget < 0) {
        return { restored: false, reason: "keys-not-found", idxMoving, idxTarget };
      }
      if (idxMoving > idxTarget) {
        window.moveTemplateRowOrderToIndex(idxMoving, idxTarget);
      }
      const after = window.getTemplateRowsForReorder ? window.getTemplateRowsForReorder() : [];
      const afterMoving = after.findIndex((r) => key(r) === moveK);
      const afterTarget = after.findIndex((r) => key(r) === targetK);
      return {
        restored: true,
        afterMoving,
        afterTarget,
        targetBeforeMoving: afterTarget >= 0 && afterMoving >= 0 ? afterTarget < afterMoving : null,
      };
    }, { movingKey, targetKey });

  const fetchLayoutOrder = async ({ codeA, codeB, principalA, principalB, opA, opB }) =>
    page.evaluate(async ({ codeA: cA, codeB: cB, principalA: pA, principalB: pB, opA: oA, opB: oB }) => {
      const modulo = String(window.state?.modulo || "");
      const anio = String(window.state?.anio || "");
      const capitulo = String(window.state?.capitulo || "");
      const rawEmpresa = String(window.state?.empresaId || "empresa2");
      const m = rawEmpresa.match(/(\d+)/);
      const empresa = rawEmpresa.toUpperCase().startsWith("EMPRESA")
        ? rawEmpresa.toUpperCase()
        : m
          ? `EMPRESA${String(m[1]).padStart(2, "0")}`
          : rawEmpresa;
      const url = `/api/layouts/${encodeURIComponent(modulo)}/${encodeURIComponent(anio)}/${encodeURIComponent(capitulo)}?empresaId=${encodeURIComponent(empresa)}`;
      const headers = typeof window.getAuthHeaders === "function" ? window.getAuthHeaders() : {};
      const res = await fetch(url, { headers });
      const json = await res.json();
      const layout = json?.layout || {};
      const cuentas = Array.isArray(layout?.cuentas)
        ? layout.cuentas
        : Array.isArray(layout?.[modulo])
          ? layout[modulo]
          : [];
      const operaciones = Array.isArray(layout?.operaciones) ? layout.operaciones : [];

      const accountCodes = cuentas
        .map((c) => String(c?.CUENTA || c?.cuenta || "").trim())
        .filter(Boolean);

      const sectionOrder = [];
      const seenSections = new Set();
      cuentas.forEach((c) => {
        const section = String(c?.seccion_principal || c?.SECCION_PRINCIPAL || "").trim();
        if (!section || seenSections.has(section)) return;
        seenSections.add(section);
        sectionOrder.push(section);
      });

      const operationKeys = operaciones
        .map((op) => String(op?.operacion_id || op?.operacion_label || op?.operacion_etiqueta || op?.clase || "").trim())
        .filter(Boolean);

      return {
        ok: res.ok,
        status: res.status,
        account: {
          idxA: cA ? accountCodes.indexOf(cA) : -1,
          idxB: cB ? accountCodes.indexOf(cB) : -1,
          top: accountCodes.slice(0, 15),
          total: accountCodes.length,
        },
        section: {
          idxA: pA ? sectionOrder.indexOf(pA) : -1,
          idxB: pB ? sectionOrder.indexOf(pB) : -1,
          order: sectionOrder.slice(0, 15),
          total: sectionOrder.length,
        },
        operation: {
          idxA: oA ? operationKeys.indexOf(oA) : -1,
          idxB: oB ? operationKeys.indexOf(oB) : -1,
          top: operationKeys.slice(0, 15),
          total: operationKeys.length,
        },
      };
    }, { codeA, codeB, principalA, principalB, opA, opB });

  const captureModuleTable = async ({ html, codeA, codeB, sectionA, sectionB }) => {
    await page.goto(`${baseUrl}/${encodeURI(html)}`);
    await page.waitForSelector("#tablaComparacion", { timeout: 20000 });
    await ensureEmpresa2();
    await sleep(3500);

    const data = await page.evaluate(({ cA, cB, sA, sB }) => {
      const rows = Array.from(document.querySelectorAll("#tablaComparacion tbody tr"));
      const accountCodes = [];
      const sectionHeaders = [];
      rows.forEach((tr) => {
        if (tr.classList.contains("section-header-row")) {
          const txt = (tr.textContent || "").trim().replace(/\s+/g, " ");
          if (txt) sectionHeaders.push(txt);
          return;
        }
        const td = tr.querySelector("td");
        if (!td) return;
        const raw = (td.textContent || "").trim();
        if (raw) accountCodes.push(raw);
      });

      const normalizedCodes = accountCodes.filter((c) => /^[0-9]{3}-[0-9]{3}-[0-9]{3}-[0-9]{2}$/.test(c));

      return {
        yearLabel: (document.querySelector("#yearLabel")?.textContent || "").trim(),
        empresaLabel: (document.querySelector("#empresaLabel")?.textContent || "").trim(),
        account: {
          idxA: cA ? normalizedCodes.indexOf(cA) : -1,
          idxB: cB ? normalizedCodes.indexOf(cB) : -1,
          top: normalizedCodes.slice(0, 15),
          total: normalizedCodes.length,
        },
        section: {
          idxA: sA ? sectionHeaders.findIndex((h) => h.toUpperCase().includes(String(sA).toUpperCase())) : -1,
          idxB: sB ? sectionHeaders.findIndex((h) => h.toUpperCase().includes(String(sB).toUpperCase())) : -1,
          order: sectionHeaders.slice(0, 15),
          total: sectionHeaders.length,
        },
      };
    }, { cA: codeA, cB: codeB, sA: sectionA, sB: sectionB });

    return data;
  };

  const results = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    targetYear,
    targetChapter,
    modules: [],
  };

  await ensurePlantillas();
  await ensureEmpresa2();

  for (const mod of modules) {
    const entry = {
      modulo: mod.modulo,
      html: mod.html,
      contextOk: false,
      rowCounts: {},
      accountTest: null,
      sectionTest: null,
      operationTest: null,
      errors: [],
    };

    try {
      await loadContext(mod.modulo);
      entry.contextOk = true;

      const baseRows = await getRows();
      const rows = baseRows.rows;
      entry.rowCounts = baseRows.counts;

      // ACCOUNT TEST
      const accountMove = await moveByType("account");
      if (!accountMove.attempted) {
        entry.accountTest = {
          attempted: false,
          reason: accountMove.reason,
        };
      } else {
        await waitAutoSave();
        const afterRows = await getRows();
        const codeA = accountMove.targetLabel;
        const codeB = accountMove.movingLabel;
        const persisted = await fetchLayoutOrder({ codeA, codeB });
        const moduleTable = await captureModuleTable({
          html: mod.html,
          codeA,
          codeB,
          sectionA: "",
          sectionB: "",
        });
        await loadContext(mod.modulo);
        const restore = await restoreByKeys({
          movingKey: accountMove.movingKey,
          targetKey: accountMove.targetKey,
        });
        await waitAutoSave();

        entry.accountTest = {
          attempted: true,
          move: accountMove,
          localMoved: Boolean(accountMove.movedBeforeTarget),
          persistedMoved:
            persisted?.account?.idxA >= 0 && persisted?.account?.idxB >= 0
              ? persisted.account.idxB < persisted.account.idxA
              : null,
          tableMoved:
            moduleTable?.account?.idxA >= 0 && moduleTable?.account?.idxB >= 0
              ? moduleTable.account.idxB < moduleTable.account.idxA
              : null,
          persisted,
          moduleTable,
          restore,
          afterRestoreCounts: afterRows.counts,
        };
      }

      // SECTION TEST
      const sectionMove = await moveByType("principal");
      if (!sectionMove.attempted) {
        entry.sectionTest = {
          attempted: false,
          reason: sectionMove.reason,
        };
      } else {
        await waitAutoSave();
        const principalA = sectionMove.targetLabel;
        const principalB = sectionMove.movingLabel;
        const persisted = await fetchLayoutOrder({ principalA, principalB });
        const moduleTable = await captureModuleTable({
          html: mod.html,
          codeA: "",
          codeB: "",
          sectionA: principalA,
          sectionB: principalB,
        });
        await loadContext(mod.modulo);
        const restore = await restoreByKeys({
          movingKey: sectionMove.movingKey,
          targetKey: sectionMove.targetKey,
        });
        await waitAutoSave();

        entry.sectionTest = {
          attempted: true,
          move: sectionMove,
          localMoved: Boolean(sectionMove.movedBeforeTarget),
          persistedMoved:
            persisted?.section?.idxA >= 0 && persisted?.section?.idxB >= 0
              ? persisted.section.idxB < persisted.section.idxA
              : null,
          tableMoved:
            moduleTable?.section?.idxA >= 0 && moduleTable?.section?.idxB >= 0
              ? moduleTable.section.idxB < moduleTable.section.idxA
              : null,
          persisted,
          moduleTable,
          restore,
        };
      }

      // OPERATION TEST
      const operationMove = await moveByType("operation");
      if (!operationMove.attempted) {
        entry.operationTest = {
          attempted: false,
          reason: operationMove.reason,
          operationRows: Number(baseRows.counts.operation || 0),
        };
      } else {
        await waitAutoSave();
        const opA = sectionMove.targetLabel;
        const opB = sectionMove.movingLabel;
        const persisted = await fetchLayoutOrder({ opA, opB });
        await loadContext(mod.modulo);
        const restore = await restoreByKeys({
          movingKey: operationMove.movingKey,
          targetKey: operationMove.targetKey,
        });
        await waitAutoSave();

        entry.operationTest = {
          attempted: true,
          move: operationMove,
          localMoved: Boolean(operationMove.movedBeforeTarget),
          persistedMoved:
            persisted?.operation?.idxA >= 0 && persisted?.operation?.idxB >= 0
              ? persisted.operation.idxB < persisted.operation.idxA
              : null,
          persisted,
          restore,
        };
      }
    } catch (error) {
      entry.errors.push(String(error?.message || error));
    }

    results.modules.push(entry);
  }

  return results;
}
