const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const outPath = path.join(process.cwd(), 'tmp', 'ops-reorder-comites.json');
  const baseUrl = 'http://127.0.0.1:3005';
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1500, height: 1200 } });
  const page = await context.newPage();
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const rowKey = (row) => {
    if (!row || typeof row !== 'object') return '';
    if (row.type === 'operation') return `op:${String(row.rowId || row.operationId || row.label || '').trim()}`;
    if (row.type === 'account') return `acc:${String(row.accountCode || row.label || '').trim()}`;
    if (row.type === 'subsection') return `sub:${String(row.rowId || row.label || '').trim()}`;
    if (row.type === 'principal') return `pri:${String(row.rowId || row.label || '').trim()}`;
    return `${row.type || 'row'}:${String(row.rowId || row.label || '').trim()}`;
  };

  const ensureContext = async () => {
    await page.goto(baseUrl + '/plantillas.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#moduloSelect', { timeout: 30000 });
    await page.evaluate(() => window.Sesion?.establecerEmpresaActiva?.('empresa2'));
    await page.selectOption('#moduloSelect', 'Comités');
    await page.waitForFunction(() => Array.from(document.querySelector('#anioSelect')?.options || []).some(o => String(o.value) === '2026'));
    await page.selectOption('#anioSelect', '2026');
    await page.waitForFunction(() => Array.from(document.querySelector('#capituloSelect')?.options || []).some(o => String(o.value || '').toUpperCase().includes('GUADALAJARA')));
    await page.evaluate(() => {
      const s = document.querySelector('#capituloSelect');
      const o = [...(s?.options || [])].find(x => String(x.value || '').toUpperCase().includes('GUADALAJARA'));
      if (o) {
        s.value = o.value;
        s.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await page.click('#btnCargar');
    await page.waitForFunction(() => window.state && String(window.state.modulo) === 'Comités' && String(window.state.anio) === '2026');
    await sleep(2000);
  };

  const getRows = async () =>
    page.evaluate(() => {
      const rows = window.getTemplateRowsForReorder ? window.getTemplateRowsForReorder() : [];
      return rows.map((r, i) => ({
        i,
        type: r.type,
        label: String(r.label || '').trim(),
        rowId: String(r.rowId || '').trim(),
        operationId: String(r.operationId || '').trim(),
        principalName: String(r.principalName || '').trim(),
        subsectionName: String(r.subsectionName || '').trim(),
      }));
    });

  const pickOperationPair = (rows) => {
    for (let i = 1; i < rows.length; i += 1) {
      const curr = rows[i];
      const prev = rows[i - 1];
      if (curr?.type !== 'operation' || prev?.type !== 'operation') continue;
      const sameParent =
        String(curr?.principalName || '') === String(prev?.principalName || '') &&
        String(curr?.subsectionName || '') === String(prev?.subsectionName || '');
      if (!sameParent) continue;
      return {
        from: i,
        to: i - 1,
        movingKey: rowKey(curr),
        targetKey: rowKey(prev),
        movingLabel: curr.label,
        targetLabel: prev.label,
      };
    }
    return null;
  };

  const fetchOps = async () =>
    page.evaluate(async () => {
      const modulo = String(window.state?.modulo || '');
      const anio = String(window.state?.anio || '');
      const capitulo = String(window.state?.capitulo || '');
      const headers = typeof window.getAuthHeaders === 'function' ? window.getAuthHeaders() : {};
      const empresa = 'EMPRESA02';
      const res = await fetch(`/api/layouts/${encodeURIComponent(modulo)}/${encodeURIComponent(anio)}/${encodeURIComponent(capitulo)}?empresaId=${encodeURIComponent(empresa)}`, { headers });
      const data = await res.json();
      const ops = Array.isArray(data?.layout?.operaciones) ? data.layout.operaciones : [];
      return ops
        .map((op) => ({
          id: String(op?.OperacionId || op?.operacion_id || '').trim(),
          label: String(op?.Clase || op?.clase || '').trim(),
          order: Number(op?.orden_presentacion),
        }))
        .filter((op) => op.id);
    });

  const moduleOperationOrder = async () => {
    await page.goto(baseUrl + '/Comit%C3%A9s.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#tablaComparacion', { timeout: 30000 });
    await page.evaluate(() => window.Sesion?.establecerEmpresaActiva?.('empresa2'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#tablaComparacion', { timeout: 30000 });
    await sleep(2600);
    return page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('#tablaComparacion tbody tr'));
      return rows
        .filter((tr) =>
          tr.classList.contains('sum-row') ||
          tr.classList.contains('sum-row-sumavarios') ||
          tr.classList.contains('sum-row-operativo') ||
          tr.classList.contains('result-row') ||
          tr.classList.contains('operation-row') ||
          tr.classList.contains('net-row') ||
          tr.classList.contains('result-net-row'),
        )
        .map((tr) => (tr.cells?.[1]?.textContent || tr.cells?.[0]?.textContent || '').trim().replace(/\s+/g, ' '))
        .filter(Boolean);
    });
  };

  const saveNow = async () => {
    await page.click('#btnGuardar');
    await page.waitForSelector('#btnConfirmSave', { timeout: 10000 });
    await page.click('#btnConfirmSave');
    await page.waitForFunction(() => window.state && window.state.unsavedChanges === false, { timeout: 30000 }).catch(() => null);
    await sleep(1200);
  };

  const restoreByKeys = async ({ movingKey, targetKey }) =>
    page.evaluate(({ movingKeyArg, targetKeyArg }) => {
      const rows = window.getTemplateRowsForReorder ? window.getTemplateRowsForReorder() : [];
      const key = (row) => {
        if (!row || typeof row !== 'object') return '';
        if (row.type === 'operation') return `op:${String(row.rowId || row.operationId || row.label || '').trim()}`;
        if (row.type === 'account') return `acc:${String(row.accountCode || row.label || '').trim()}`;
        if (row.type === 'subsection') return `sub:${String(row.rowId || row.label || '').trim()}`;
        if (row.type === 'principal') return `pri:${String(row.rowId || row.label || '').trim()}`;
        return `${row.type || 'row'}:${String(row.rowId || row.label || '').trim()}`;
      };
      const iM = rows.findIndex((r) => key(r) === movingKeyArg);
      const iT = rows.findIndex((r) => key(r) === targetKeyArg);
      if (iM < 0 || iT < 0) return { restored: false, iM, iT };
      if (iM > iT) {
        window.moveTemplateRowOrderToIndex(iM, iT);
      }
      return { restored: true };
    }, { movingKeyArg: movingKey, targetKeyArg: targetKey });

  try {
    await page.goto(baseUrl + '/login.html');
    await page.fill('#usuario', 'ICONET');
    await page.fill('#contrasena', '4zxb63NyI43?');
    await Promise.all([page.waitForURL('**/app.html', { timeout: 15000 }), page.click('#botonIngresar')]);

    await ensureContext();
    const beforeRows = await getRows();
    const pair = pickOperationPair(beforeRows);
    const beforeOps = await fetchOps();

    if (!pair) {
      fs.writeFileSync(outPath, JSON.stringify({ error: 'no-operation-pair', beforeRows: beforeRows.length }, null, 2), 'utf8');
      await browser.close();
      return;
    }

    await page.evaluate(({ from, to }) => {
      window.moveTemplateRowOrderToIndex(from, to);
    }, { from: pair.from, to: pair.to });

    await sleep(700);
    await saveNow();

    const afterOps = await fetchOps();
    const moduleOrder = await moduleOperationOrder();

    await ensureContext();
    const restore = await restoreByKeys({ movingKey: pair.movingKey, targetKey: pair.targetKey });
    await saveNow();

    const idx = (arr, label) => arr.findIndex((x) => String(x || '').toUpperCase().includes(String(label || '').toUpperCase()));
    const findOpIdx = (ops, label) => ops.findIndex((op) => String(op.label || '').toUpperCase().includes(String(label || '').toUpperCase()));

    fs.writeFileSync(
      outPath,
      JSON.stringify(
        {
          pair,
          beforeOpsTop: beforeOps.slice(0, 20),
          afterOpsTop: afterOps.slice(0, 20),
          moduleOrderTop: moduleOrder.slice(0, 25),
          restore,
          checks: {
            persistedSwapByLabel:
              findOpIdx(afterOps, pair.movingLabel) >= 0 && findOpIdx(afterOps, pair.targetLabel) >= 0
                ? findOpIdx(afterOps, pair.movingLabel) < findOpIdx(afterOps, pair.targetLabel)
                : null,
            moduleSwapByLabel:
              idx(moduleOrder, pair.movingLabel) >= 0 && idx(moduleOrder, pair.targetLabel) >= 0
                ? idx(moduleOrder, pair.movingLabel) < idx(moduleOrder, pair.targetLabel)
                : null,
          },
        },
        null,
        2,
      ),
      'utf8',
    );
  } finally {
    await browser.close();
  }
})();
