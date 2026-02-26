const fs = require('fs');
const path = require('path');

(async () => {
  const { chromium } = require('playwright');
  const baseUrl = 'http://127.0.0.1:3005';
  const modules = [
    { html: 'Membresía.html', modulo: 'Membresía' },
    { html: 'Eventos.html', modulo: 'Eventos' },
    { html: 'Comunicación.html', modulo: 'Comunicación' },
  ];

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
  const page = await context.newPage();
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const keyFn = (row) => {
    if (!row || typeof row !== 'object') return '';
    if (row.type === 'account') return 'acc:' + String(row.accountCode || row.label || row.rowId || '').trim();
    if (row.type === 'principal') return 'pri:' + String(row.rowId || row.principalName || row.label || '').trim();
    if (row.type === 'operation') return 'op:' + String(row.rowId || row.operationId || row.label || '').trim();
    return String(row.type || 'row') + ':' + String(row.rowId || row.label || '').trim();
  };

  const ensureLogin = async () => {
    await page.goto(baseUrl + '/login.html');
    await page.fill('#usuario', 'ICONET');
    await page.fill('#contrasena', '4zxb63NyI43?');
    await Promise.all([page.waitForURL('**/app.html'), page.click('#botonIngresar')]);
  };

  const ensurePlantillas = async () => {
    await page.goto(baseUrl + '/plantillas.html');
    await page.waitForSelector('#moduloSelect');
    await page.evaluate(() => window.Sesion?.establecerEmpresaActiva?.('empresa2'));
  };

  const setContext = async (modulo) => {
    await page.selectOption('#moduloSelect', modulo);
    await sleep(300);
    await page.selectOption('#anioSelect', '2026');
    await sleep(300);
    await page.evaluate(() => {
      const sel = document.querySelector('#capituloSelect');
      const opt = [...(sel?.options || [])].find((o) => String(o.value || '').toUpperCase().includes('GUADALAJARA'));
      if (opt) {
        sel.value = opt.value;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await page.click('#btnCargar');
    await sleep(2400);
  };

  const getRows = async () =>
    page.evaluate(() => {
      const rows = window.getTemplateRowsForReorder ? window.getTemplateRowsForReorder() : [];
      const mapped = rows.map((r, i) => ({
        i,
        type: r.type,
        label: String(r.label || '').trim(),
        accountCode: String(r.accountCode || '').trim(),
        principalName: String(r.principalName || '').trim(),
        subsectionName: String(r.subsectionName || '').trim(),
        rowId: String(r.rowId || r.id || '').trim(),
      }));
      const counts = mapped.reduce((acc, r) => {
        acc[r.type] = (acc[r.type] || 0) + 1;
        return acc;
      }, {});
      return {
        counts,
        rows: mapped,
        state: {
          modulo: window.state?.modulo,
          anio: window.state?.anio,
          capitulo: window.state?.capitulo,
          empresa: window.state?.empresaId,
        },
      };
    });

  const moveByType = async (type) =>
    page.evaluate((rowType) => {
      const key = (row) => {
        if (!row || typeof row !== 'object') return '';
        if (row.type === 'account') return 'acc:' + String(row.accountCode || row.label || row.rowId || '').trim();
        if (row.type === 'principal') return 'pri:' + String(row.rowId || row.principalName || row.label || '').trim();
        if (row.type === 'operation') return 'op:' + String(row.rowId || row.operationId || row.label || '').trim();
        return String(row.type || 'row') + ':' + String(row.rowId || row.label || '').trim();
      };
      const rows = window.getTemplateRowsForReorder ? window.getTemplateRowsForReorder() : [];
      let from = -1;
      let to = -1;
      if (rowType === 'account') {
        for (let i = 1; i < rows.length; i += 1) {
          const c = rows[i];
          const p = rows[i - 1];
          if (c?.type !== 'account' || p?.type !== 'account') continue;
          const sameParent = String(c?.principalName || '') === String(p?.principalName || '') && String(c?.subsectionName || '') === String(p?.subsectionName || '');
          if (!sameParent) continue;
          from = i;
          to = i - 1;
          break;
        }
      } else if (rowType === 'principal') {
        const idxs = [];
        rows.forEach((r, i) => {
          if (r?.type === 'principal') idxs.push(i);
        });
        if (idxs.length >= 2) {
          from = idxs[1];
          to = idxs[0];
        }
      }

      if (from < 0 || to < 0 || !rows[from] || !rows[to]) {
        return { attempted: false, reason: 'no-candidate' };
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
        movingKey,
        targetKey,
        movingLabel: String(moving?.label || '').trim(),
        targetLabel: String(target?.label || '').trim(),
        movedBeforeTarget: movingAfter >= 0 && targetAfter >= 0 ? movingAfter < targetAfter : null,
      };
    }, type);

  const restore = async (movingKey, targetKey) =>
    page.evaluate(({ movingKeyArg, targetKeyArg }) => {
      const key = (row) => {
        if (!row || typeof row !== 'object') return '';
        if (row.type === 'account') return 'acc:' + String(row.accountCode || row.label || row.rowId || '').trim();
        if (row.type === 'principal') return 'pri:' + String(row.rowId || row.principalName || row.label || '').trim();
        if (row.type === 'operation') return 'op:' + String(row.rowId || row.operationId || row.label || '').trim();
        return String(row.type || 'row') + ':' + String(row.rowId || row.label || '').trim();
      };
      const rows = window.getTemplateRowsForReorder ? window.getTemplateRowsForReorder() : [];
      const iM = rows.findIndex((r) => key(r) === movingKeyArg);
      const iT = rows.findIndex((r) => key(r) === targetKeyArg);
      if (iM < 0 || iT < 0) return { restored: false, iM, iT };
      if (iM > iT) {
        window.moveTemplateRowOrderToIndex(iM, iT);
      }
      return { restored: true };
    }, { movingKeyArg: movingKey, targetKeyArg: targetKey });

  const fetchOrder = async ({ codeA, codeB, secA, secB }) =>
    page.evaluate(async ({ cA, cB, sA, sB }) => {
      const modulo = String(window.state?.modulo || '');
      const anio = String(window.state?.anio || '');
      const capitulo = String(window.state?.capitulo || '');
      const url = `/api/layouts/${encodeURIComponent(modulo)}/${encodeURIComponent(anio)}/${encodeURIComponent(capitulo)}?empresaId=EMPRESA02`;
      const headers = typeof window.getAuthHeaders === 'function' ? window.getAuthHeaders() : {};
      const res = await fetch(url, { headers });
      const data = await res.json();
      const layout = data?.layout || {};
      const cuentas = Array.isArray(layout?.cuentas) ? layout.cuentas : Array.isArray(layout?.[modulo]) ? layout[modulo] : [];
      const codes = cuentas.map((c) => String(c?.CUENTA || c?.cuenta || '').trim()).filter(Boolean);
      const sections = [];
      const seen = new Set();
      cuentas.forEach((c) => {
        const s = String(c?.seccion_principal || '').trim();
        if (!s || seen.has(s)) return;
        seen.add(s);
        sections.push(s);
      });
      return {
        account: { idxA: cA ? codes.indexOf(cA) : -1, idxB: cB ? codes.indexOf(cB) : -1, top: codes.slice(0, 12) },
        section: { idxA: sA ? sections.indexOf(sA) : -1, idxB: sB ? sections.indexOf(sB) : -1, top: sections.slice(0, 12) },
      };
    }, { cA: codeA, cB: codeB, sA: secA, sB: secB });

  const tableOrder = async ({ html, codeA, codeB, secA, secB }) => {
    await page.goto(`${baseUrl}/${encodeURI(html)}`);
    await page.waitForSelector('#tablaComparacion');
    await sleep(3600);
    return page.evaluate(({ cA, cB, sA, sB }) => {
      const rows = [...document.querySelectorAll('#tablaComparacion tbody tr')];
      const codes = [];
      const sections = [];
      rows.forEach((tr) => {
        if (tr.classList.contains('section-header-row')) {
          const t = (tr.textContent || '').trim().replace(/\s+/g, ' ');
          if (t) sections.push(t);
          return;
        }
        const td = tr.querySelector('td');
        const raw = (td?.textContent || '').trim();
        if (/^[0-9]{3}-[0-9]{3}-[0-9]{3}-[0-9]{2}$/.test(raw)) codes.push(raw);
      });
      return {
        year: (document.querySelector('#yearLabel')?.textContent || '').trim(),
        empresa: (document.querySelector('#empresaLabel')?.textContent || '').trim(),
        account: { idxA: cA ? codes.indexOf(cA) : -1, idxB: cB ? codes.indexOf(cB) : -1, top: codes.slice(0, 12) },
        section: {
          idxA: sA ? sections.findIndex((x) => x.toUpperCase().includes(String(sA).toUpperCase())) : -1,
          idxB: sB ? sections.findIndex((x) => x.toUpperCase().includes(String(sB).toUpperCase())) : -1,
          top: sections.slice(0, 12),
        },
      };
    }, { cA: codeA, cB: codeB, sA: secA, sB: secB });
  };

  const out = [];

  try {
    await ensureLogin();
    await ensurePlantillas();

    for (const mod of modules) {
      const e = { modulo: mod.modulo, html: mod.html, errors: [], rowCounts: {}, accountTest: null, sectionTest: null };
      try {
        await setContext(mod.modulo);
        const initial = await getRows();
        e.rowCounts = initial.counts;
        e.state = initial.state;

        const account = await moveByType('account');
        if (account.attempted) {
          await sleep(2600);
          const persisted = await fetchOrder({ codeA: account.targetLabel, codeB: account.movingLabel });
          const table = await tableOrder({ html: mod.html, codeA: account.targetLabel, codeB: account.movingLabel, secA: '', secB: '' });
          await ensurePlantillas();
          await setContext(mod.modulo);
          const restoreRes = await restore(account.movingKey, account.targetKey);
          await sleep(2200);
          e.accountTest = {
            attempted: true,
            move: account,
            persistedMoved: persisted.account.idxB >= 0 && persisted.account.idxA >= 0 ? persisted.account.idxB < persisted.account.idxA : null,
            tableMoved: table.account.idxB >= 0 && table.account.idxA >= 0 ? table.account.idxB < table.account.idxA : null,
            persisted,
            table,
            restoreRes,
          };
        } else {
          e.accountTest = account;
        }

        const section = await moveByType('principal');
        if (section.attempted) {
          await sleep(2600);
          const persisted = await fetchOrder({ secA: section.targetLabel, secB: section.movingLabel });
          const table = await tableOrder({ html: mod.html, codeA: '', codeB: '', secA: section.targetLabel, secB: section.movingLabel });
          await ensurePlantillas();
          await setContext(mod.modulo);
          const restoreRes = await restore(section.movingKey, section.targetKey);
          await sleep(2200);
          e.sectionTest = {
            attempted: true,
            move: section,
            persistedMoved: persisted.section.idxB >= 0 && persisted.section.idxA >= 0 ? persisted.section.idxB < persisted.section.idxA : null,
            tableMoved: table.section.idxB >= 0 && table.section.idxA >= 0 ? table.section.idxB < table.section.idxA : null,
            persisted,
            table,
            restoreRes,
          };
        } else {
          e.sectionTest = section;
        }
      } catch (err) {
        e.errors.push(String(err?.message || err));
      }
      out.push(e);
    }
  } finally {
    const outPath = path.join(process.cwd(), 'tmp', 'layout-audit-failed-fixed.json');
    fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
    await browser.close();
  }
})();
