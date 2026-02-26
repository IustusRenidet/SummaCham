const fs = require('fs');
const path = require('path');

(async () => {
  const { chromium } = require('playwright');

  const baseUrl = 'http://127.0.0.1:3005';
  const targetYear = '2026';
  const targetChapter = 'GUADALAJARA';
  const credentials = { usuario: 'ICONET', contrasena: '4zxb63NyI43?' };

  const modules = [
    { html: 'Membresía.html', modulo: 'Membresía' },
    { html: 'Eventos.html', modulo: 'Eventos' },
    { html: 'Comunicación.html', modulo: 'Comunicación' },
    { html: 'Dirección.html', modulo: 'Dirección' },
    { html: 'Serv_Membresía.html', modulo: 'Serv Membresía' },
    { html: 'Comités.html', modulo: 'Comités' },
    { html: 'T&IC.html', modulo: 'T&IC' },
    { html: 'RH.html', modulo: 'RH' },
    { html: 'VPE.html', modulo: 'VPE' },
    { html: 'Finanzas.html', modulo: 'Finanzas' },
    { html: 'GastosGenerales.html', modulo: 'Gastos Generales' },
    { html: 'Nomina.html', modulo: 'Nomina' },
    { html: 'Gtos_Corporativos.html', modulo: 'Gtos Corporativos' },
  ];

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
  const page = await context.newPage();

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const ensureLoggedIn = async () => {
    await page.goto(`${baseUrl}/login.html`, { waitUntil: 'domcontentloaded' });
    if (page.url().includes('login.html')) {
      await page.fill('#usuario', credentials.usuario);
      await page.fill('#contrasena', credentials.contrasena);
      await Promise.all([
        page.waitForURL('**/app.html', { timeout: 15000 }),
        page.click('#botonIngresar'),
      ]);
    }
  };

  const ensurePlantillas = async () => {
    if (!page.url().includes('plantillas.html')) {
      await page.goto(`${baseUrl}/plantillas.html`, { waitUntil: 'domcontentloaded' });
    }
    await page.waitForSelector('#moduloSelect', { timeout: 20000 });
  };

  const ensureEmpresa2 = async () => {
    await page.evaluate(() => {
      try {
        window.Sesion?.establecerEmpresaActiva?.('empresa2');
      } catch (_) {
        // ignore
      }
    });
  };

  const setChapterGuadalajara = async () => {
    const selected = await page.evaluate((target) => {
      const select = document.querySelector('#capituloSelect');
      if (!select) return false;
      const options = Array.from(select.options || []);
      const exact = options.find((o) => String(o.value || '').toUpperCase() === target);
      const fuzzy = options.find((o) => String(o.value || '').toUpperCase().includes(target));
      const match = exact || fuzzy;
      if (!match) return false;
      select.value = match.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }, targetChapter);

    if (!selected) {
      throw new Error('No se encontró opción de capítulo GUADALAJARA en plantillas');
    }
  };

  const loadContext = async (modulo) => {
    await ensurePlantillas();
    await ensureEmpresa2();

    await page.selectOption('#moduloSelect', modulo);

    await page.waitForFunction(
      (yearValue) => {
        const sel = document.querySelector('#anioSelect');
        if (!sel) return false;
        return Array.from(sel.options || []).some((o) => String(o.value) === yearValue);
      },
      targetYear,
      { timeout: 20000 },
    );

    await page.selectOption('#anioSelect', targetYear);

    await page.waitForFunction(
      (chapterValue) => {
        const sel = document.querySelector('#capituloSelect');
        if (!sel) return false;
        return Array.from(sel.options || []).some((o) => String(o.value || '').toUpperCase().includes(chapterValue));
      },
      targetChapter,
      { timeout: 20000 },
    );

    await setChapterGuadalajara();
    await page.click('#btnCargar');

    await page.waitForFunction(
      ({ moduloValue, chapterValue }) => {
        if (!window.state) return false;
        const sameModulo = String(window.state.modulo || '') === moduloValue;
        const sameYear = String(window.state.anio || '') === '2026';
        const sameChapter = String(window.state.capitulo || '').toUpperCase().includes(chapterValue);
        return sameModulo && sameYear && sameChapter;
      },
      { moduloValue: modulo, chapterValue: targetChapter },
      { timeout: 30000 },
    );

    await sleep(1800);
  };

  const waitAutoSave = async () => {
    await sleep(2300);
    try {
      await page.waitForFunction(() => window.state && window.state.unsavedChanges === false, { timeout: 7000 });
    } catch (_) {
      // ignore
    }
    await sleep(700);
  };

  const getRows = async () =>
    page.evaluate(() => {
      const rows = window.getTemplateRowsForReorder ? window.getTemplateRowsForReorder() : [];
      const list = rows.map((r, i) => ({
        i,
        type: String(r.type || ''),
        label: String(r.label || '').trim(),
        accountCode: String(r.accountCode || '').trim(),
        principalName: String(r.principalName || '').trim(),
        subsectionName: String(r.subsectionName || '').trim(),
        rowId: String(r.rowId || r.id || '').trim(),
        operationId: String(r.operationId || '').trim(),
      }));
      const counts = list.reduce((acc, r) => {
        acc[r.type] = (acc[r.type] || 0) + 1;
        return acc;
      }, {});
      return { rows: list, counts };
    });

  const moveByType = async (type) =>
    page.evaluate(
      (rowType) => {
        const key = (row) => {
          if (!row || typeof row !== 'object') return '';
          if (row.type === 'account') {
            return 'acc:' + String(row.accountCode || row.label || row.rowId || '').trim();
          }
          if (row.type === 'operation') {
            return 'op:' + String(row.rowId || row.operationId || row.label || '').trim();
          }
          if (row.type === 'subsection') {
            return 'sub:' + String(row.rowId || row.subsectionName || row.label || '').trim();
          }
          if (row.type === 'principal') {
            return 'pri:' + String(row.rowId || row.principalName || row.label || '').trim();
          }
          return String(row.type || 'row') + ':' + String(row.rowId || row.label || '').trim();
        };
        const rows = window.getTemplateRowsForReorder ? window.getTemplateRowsForReorder() : [];

        let from = -1;
        let to = -1;

        if (rowType === 'account') {
          for (let i = 1; i < rows.length; i += 1) {
            const curr = rows[i];
            const prev = rows[i - 1];
            if (curr?.type !== 'account' || prev?.type !== 'account') continue;
            const sameParent =
              String(curr?.principalName || '') === String(prev?.principalName || '') &&
              String(curr?.subsectionName || '') === String(prev?.subsectionName || '');
            if (!sameParent) continue;
            from = i;
            to = i - 1;
            break;
          }
        } else if (rowType === 'operation') {
          for (let i = 1; i < rows.length; i += 1) {
            const curr = rows[i];
            const prev = rows[i - 1];
            if (curr?.type !== 'operation' || prev?.type !== 'operation') continue;
            const sameParent =
              String(curr?.principalName || '') === String(prev?.principalName || '') &&
              String(curr?.subsectionName || '') === String(prev?.subsectionName || '');
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
          return { attempted: false, reason: 'no-candidate', type: rowType };
        }

        const moving = rows[from];
        const target = rows[to];
        const movingKey = key(moving);
        const targetKey = key(target);

        window.moveTemplateRowOrderToIndex(from, to);

        const after = window.getTemplateRowsForReorder ? window.getTemplateRowsForReorder() : [];
        const movingAfter = after.findIndex((r) => key(r) === movingKey);
        const targetAfter = after.findIndex((r) => key(r) === targetKey);

        return {
          attempted: true,
          type: rowType,
          from,
          to,
          movingKey,
          targetKey,
          movingLabel: String(moving?.label || moving?.accountCode || '').trim(),
          targetLabel: String(target?.label || target?.accountCode || '').trim(),
          movingOpId: String(moving?.operationId || moving?.rowId || moving?.label || '').trim(),
          targetOpId: String(target?.operationId || target?.rowId || target?.label || '').trim(),
          movingAfter,
          targetAfter,
          movedBeforeTarget: movingAfter >= 0 && targetAfter >= 0 ? movingAfter < targetAfter : null,
        };
      },
      type,
    );

  const restoreByKeys = async ({ movingKey, targetKey }) =>
    page.evaluate(
      ({ movingKeyArg, targetKeyArg }) => {
        const key = (row) => {
          if (!row || typeof row !== 'object') return '';
          if (row.type === 'account') {
            return 'acc:' + String(row.accountCode || row.label || row.rowId || '').trim();
          }
          if (row.type === 'operation') {
            return 'op:' + String(row.rowId || row.operationId || row.label || '').trim();
          }
          if (row.type === 'subsection') {
            return 'sub:' + String(row.rowId || row.subsectionName || row.label || '').trim();
          }
          if (row.type === 'principal') {
            return 'pri:' + String(row.rowId || row.principalName || row.label || '').trim();
          }
          return String(row.type || 'row') + ':' + String(row.rowId || row.label || '').trim();
        };
        const rows = window.getTemplateRowsForReorder ? window.getTemplateRowsForReorder() : [];
        const idxMoving = rows.findIndex((r) => key(r) === movingKeyArg);
        const idxTarget = rows.findIndex((r) => key(r) === targetKeyArg);
        if (idxMoving < 0 || idxTarget < 0) {
          return { restored: false, reason: 'keys-not-found', idxMoving, idxTarget };
        }
        if (idxMoving > idxTarget) {
          window.moveTemplateRowOrderToIndex(idxMoving, idxTarget);
        }
        const after = window.getTemplateRowsForReorder ? window.getTemplateRowsForReorder() : [];
        const afterMoving = after.findIndex((r) => key(r) === movingKeyArg);
        const afterTarget = after.findIndex((r) => key(r) === targetKeyArg);
        return {
          restored: true,
          afterMoving,
          afterTarget,
          targetBeforeMoving:
            afterTarget >= 0 && afterMoving >= 0 ? afterTarget < afterMoving : null,
        };
      },
      { movingKeyArg: movingKey, targetKeyArg: targetKey },
    );

  const fetchLayoutOrder = async ({ codeA, codeB, principalA, principalB, opA, opB }) =>
    page.evaluate(async ({ codeAArg, codeBArg, principalAArg, principalBArg, opAArg, opBArg }) => {
      const modulo = String(window.state?.modulo || '');
      const anio = String(window.state?.anio || '');
      const capitulo = String(window.state?.capitulo || '');
      const rawEmpresa = String(window.state?.empresaId || 'empresa2');
      const match = rawEmpresa.match(/(\d+)/);
      const empresa = rawEmpresa.toUpperCase().startsWith('EMPRESA')
        ? rawEmpresa.toUpperCase()
        : match
          ? `EMPRESA${String(match[1]).padStart(2, '0')}`
          : rawEmpresa;

      const url = `/api/layouts/${encodeURIComponent(modulo)}/${encodeURIComponent(anio)}/${encodeURIComponent(capitulo)}?empresaId=${encodeURIComponent(empresa)}`;
      const headers = typeof window.getAuthHeaders === 'function' ? window.getAuthHeaders() : {};
      const response = await fetch(url, { headers });
      const data = await response.json();
      const layout = data?.layout || {};
      const cuentas = Array.isArray(layout?.cuentas)
        ? layout.cuentas
        : Array.isArray(layout?.[modulo])
          ? layout[modulo]
          : [];
      const operaciones = Array.isArray(layout?.operaciones) ? layout.operaciones : [];

      const codes = cuentas
        .map((c) => String(c?.CUENTA || c?.cuenta || '').trim())
        .filter(Boolean);

      const sections = [];
      const seen = new Set();
      cuentas.forEach((c) => {
        const section = String(c?.seccion_principal || c?.SECCION_PRINCIPAL || '').trim();
        if (!section || seen.has(section)) return;
        seen.add(section);
        sections.push(section);
      });

      const opKeys = operaciones
        .map((op) =>
          String(
            op?.OperacionId ||
              op?.operacion_id ||
              op?.operacion_label ||
              op?.operacion_etiqueta ||
              op?.Clase ||
              op?.clase ||
              '',
          ).trim(),
        )
        .filter(Boolean);

      return {
        ok: response.ok,
        status: response.status,
        account: {
          idxA: codeAArg ? codes.indexOf(codeAArg) : -1,
          idxB: codeBArg ? codes.indexOf(codeBArg) : -1,
          top: codes.slice(0, 15),
          total: codes.length,
        },
        section: {
          idxA: principalAArg ? sections.indexOf(principalAArg) : -1,
          idxB: principalBArg ? sections.indexOf(principalBArg) : -1,
          order: sections.slice(0, 15),
          total: sections.length,
        },
        operation: {
          idxA: opAArg ? opKeys.indexOf(opAArg) : -1,
          idxB: opBArg ? opKeys.indexOf(opBArg) : -1,
          top: opKeys.slice(0, 15),
          total: opKeys.length,
        },
      };
    }, {
      codeAArg: codeA,
      codeBArg: codeB,
      principalAArg: principalA,
      principalBArg: principalB,
      opAArg: opA,
      opBArg: opB,
    });

  const captureModuleTable = async ({ html, codeA, codeB, sectionA, sectionB }) => {
    await page.goto(`${baseUrl}/${encodeURI(html)}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#tablaComparacion', { timeout: 30000 });
    await ensureEmpresa2();
    await sleep(4500);

    return page.evaluate(
      ({ codeAArg, codeBArg, sectionAArg, sectionBArg }) => {
        const rows = Array.from(document.querySelectorAll('#tablaComparacion tbody tr'));
        const codes = [];
        const sections = [];
        const operations = [];

        rows.forEach((tr) => {
          if (tr.classList.contains('section-header-row')) {
            const txt = (tr.textContent || '').trim().replace(/\s+/g, ' ');
            if (txt) sections.push(txt);
            return;
          }
          const isOperation =
            tr.classList.contains('sum-row') ||
            tr.classList.contains('sum-row-sumavarios') ||
            tr.classList.contains('sum-row-operativo') ||
            tr.classList.contains('result-row') ||
            tr.classList.contains('operation-row') ||
            tr.classList.contains('net-row') ||
            tr.classList.contains('result-net-row');
          if (isOperation) {
            const label = (
              tr.cells?.[1]?.textContent ||
              tr.cells?.[0]?.textContent ||
              tr.textContent ||
              ''
            )
              .trim()
              .replace(/\s+/g, ' ');
            if (label) operations.push(label);
            return;
          }
          const td = tr.querySelector('td');
          if (!td) return;
          const raw = (td.textContent || '').trim();
          if (/^[0-9]{3}-[0-9]{3}-[0-9]{3}-[0-9]{2}$/.test(raw)) {
            codes.push(raw);
          }
        });

        return {
          yearLabel: (document.querySelector('#yearLabel')?.textContent || '').trim(),
          empresaLabel: (document.querySelector('#empresaLabel')?.textContent || '').trim(),
          account: {
            idxA: codeAArg ? codes.indexOf(codeAArg) : -1,
            idxB: codeBArg ? codes.indexOf(codeBArg) : -1,
            top: codes.slice(0, 15),
            total: codes.length,
          },
          section: {
            idxA: sectionAArg
              ? sections.findIndex((s) => s.toUpperCase().includes(String(sectionAArg).toUpperCase()))
              : -1,
            idxB: sectionBArg
              ? sections.findIndex((s) => s.toUpperCase().includes(String(sectionBArg).toUpperCase()))
              : -1,
            order: sections.slice(0, 15),
            total: sections.length,
          },
          operation: {
            order: operations.slice(0, 30),
            total: operations.length,
          },
        };
      },
      { codeAArg: codeA, codeBArg: codeB, sectionAArg: sectionA, sectionBArg: sectionB },
    );
  };

  const results = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    targetYear,
    targetChapter,
    modules: [],
  };

  try {
    await ensureLoggedIn();
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
        entry.rowCounts = baseRows.counts;

        const accountMove = await moveByType('account');
        if (!accountMove.attempted) {
          entry.accountTest = { attempted: false, reason: accountMove.reason };
        } else {
          await waitAutoSave();

          const codeA = accountMove.targetLabel;
          const codeB = accountMove.movingLabel;

          const persisted = await fetchLayoutOrder({ codeA, codeB });
          const moduleTable = await captureModuleTable({
            html: mod.html,
            codeA,
            codeB,
            sectionA: '',
            sectionB: '',
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
          };
        }

        const sectionMove = await moveByType('principal');
        if (!sectionMove.attempted) {
          entry.sectionTest = { attempted: false, reason: sectionMove.reason };
        } else {
          await waitAutoSave();

          const principalA = sectionMove.targetLabel;
          const principalB = sectionMove.movingLabel;

          const persisted = await fetchLayoutOrder({ principalA, principalB });
          const moduleTable = await captureModuleTable({
            html: mod.html,
            codeA: '',
            codeB: '',
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

        const operationMove = await moveByType('operation');
        if (!operationMove.attempted) {
          entry.operationTest = {
            attempted: false,
            reason: operationMove.reason,
            operationRows: Number(baseRows.counts.operation || 0),
          };
        } else {
          await waitAutoSave();

          const opA = operationMove.targetOpId || operationMove.targetLabel;
          const opB = operationMove.movingOpId || operationMove.movingLabel;

          const persisted = await fetchLayoutOrder({ opA, opB });
          const moduleTable = await captureModuleTable({
            html: mod.html,
            codeA: '',
            codeB: '',
            sectionA: '',
            sectionB: '',
          });

          await loadContext(mod.modulo);
          const restore = await restoreByKeys({
            movingKey: operationMove.movingKey,
            targetKey: operationMove.targetKey,
          });
          await waitAutoSave();

          const opTableOrder = moduleTable?.operation?.order || [];
          const opIdxTarget = opTableOrder.findIndex(
            (label) =>
              String(label || '').toUpperCase().includes(String(operationMove.targetLabel || '').toUpperCase()),
          );
          const opIdxMoving = opTableOrder.findIndex(
            (label) =>
              String(label || '').toUpperCase().includes(String(operationMove.movingLabel || '').toUpperCase()),
          );

          entry.operationTest = {
            attempted: true,
            move: operationMove,
            localMoved: Boolean(operationMove.movedBeforeTarget),
            persistedMoved:
              persisted?.operation?.idxA >= 0 && persisted?.operation?.idxB >= 0
                ? persisted.operation.idxB < persisted.operation.idxA
                : null,
            tableMoved:
              opIdxTarget >= 0 && opIdxMoving >= 0 ? opIdxMoving < opIdxTarget : null,
            tableOrder: moduleTable?.operation?.order || [],
            persisted,
            moduleTable,
            restore,
          };
        }
      } catch (error) {
        entry.errors.push(String(error?.message || error));
      }

      results.modules.push(entry);
    }
  } finally {
    const outputPath = path.join(process.cwd(), 'tmp', 'layout-audit-results.json');
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf8');
    await browser.close();
  }
})();
