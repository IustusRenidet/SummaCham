const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const outPath = path.join(process.cwd(), 'tmp', 'repro-delete-plantillas-comites.json');
  const baseUrl = 'http://127.0.0.1:3005';
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1500, height: 1200 } });
  const page = await context.newPage();
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  page.on('dialog', async (dialog) => {
    await dialog.accept();
  });

  try {
    await page.goto(baseUrl + '/login.html');
    await page.fill('#usuario', 'ICONET');
    await page.fill('#contrasena', '4zxb63NyI43?');
    await Promise.all([page.waitForURL('**/app.html', { timeout: 15000 }), page.click('#botonIngresar')]);

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
    await sleep(1800);

    const before = await page.evaluate(() => {
      const rows = window.getTemplateRowsForReorder ? window.getTemplateRowsForReorder() : [];
      return {
        cuentas: (window.state?.cuentas || []).length,
        operaciones: (window.state?.operaciones || []).length,
        totalRows: rows.length,
        unsavedChanges: Boolean(window.state?.unsavedChanges),
      };
    });

    const exec = await page.evaluate(() => {
      const tableRows = Array.from(document.querySelectorAll('#tablaComparacion tbody tr'));
      const target = tableRows.find((tr) => tr.classList.contains('account-row') || tr.classList.contains('fila-cuenta'));
      if (!target) return { found: false, invoked: false };
      if (!window.ContextMenuWizard || typeof window.ContextMenuWizard.deleteRow !== 'function') {
        return { found: true, invoked: false, reason: 'wizard-unavailable' };
      }
      window.ContextMenuWizard.currentRow = target;
      window.ContextMenuWizard.deleteRow();
      return {
        found: true,
        invoked: true,
        target: {
          cuenta: target.dataset?.cuenta || '',
          accountId: target.dataset?.accountId || '',
          text: (target.textContent || '').replace(/\s+/g, ' ').trim(),
        },
      };
    });

    await sleep(1400);

    const after = await page.evaluate(() => {
      const rows = window.getTemplateRowsForReorder ? window.getTemplateRowsForReorder() : [];
      return {
        cuentas: (window.state?.cuentas || []).length,
        operaciones: (window.state?.operaciones || []).length,
        totalRows: rows.length,
        unsavedChanges: Boolean(window.state?.unsavedChanges),
      };
    });

    fs.writeFileSync(
      outPath,
      JSON.stringify(
        {
          exec,
          before,
          after,
          assertions: {
            accountRemoved: before.cuentas - after.cuentas === 1,
            rowCountReduced: before.totalRows - after.totalRows === 1,
            dirtyFlagSet: after.unsavedChanges === true,
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
