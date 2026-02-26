const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const baseUrl = 'http://127.0.0.1:3005';
  const outPath = path.join(process.cwd(), 'tmp', 'repro-delete-comites.json');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1500, height: 1200 } });
  const page = await context.newPage();

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const snapshotRows = async () =>
    page.evaluate(() =>
      Array.from(document.querySelectorAll('#tablaComparacion tbody tr')).map((tr, idx) => {
        const td = tr.querySelectorAll('td');
        return {
          idx,
          cls: tr.className,
          c0: (td[0]?.textContent || '').trim(),
          c1: (td[1]?.textContent || '').trim(),
          sec: tr.dataset?.seccion || tr.dataset?.sectionName || '',
          cuenta21: tr.dataset?.cuenta21 || tr.dataset?.cuenta || '',
          text: (tr.textContent || '').replace(/\s+/g, ' ').trim(),
        };
      })
    );

  try {
    await page.goto(`${baseUrl}/login.html`);
    await page.fill('#usuario', 'ICONET');
    await page.fill('#contrasena', '4zxb63NyI43?');
    await Promise.all([
      page.waitForURL('**/app.html', { timeout: 15000 }),
      page.click('#botonIngresar'),
    ]);

    await page.goto(`${baseUrl}/Comit%C3%A9s.html`);
    await page.waitForSelector('#tablaComparacion', { timeout: 20000 });
    await page.evaluate(() => window.Sesion?.establecerEmpresaActiva?.('empresa1'));
    await page.reload();
    await page.waitForSelector('#tablaComparacion', { timeout: 20000 });
    await sleep(2600);

    await page.evaluate(() => {
      window.CuentasModulo?.setEditMode?.(true);
      // Forzar que maneje cuentas-modulo y no wizards
      window.InsertionWizard = undefined;
      window.ContextMenuWizard = undefined;
    });

    await sleep(600);

    const before = await snapshotRows();

    const targetIndex = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('#tablaComparacion tbody tr.fila-cuenta'));
      const idx = rows.findIndex((tr) => {
        const tds = tr.querySelectorAll('td');
        const c0 = (tds[0]?.textContent || '').trim();
        const c1 = (tds[1]?.textContent || '').trim();
        return /POR\s*PROGRAMA/i.test(c0) && /COMIT/i.test(c1);
      });
      if (idx < 0) return -1;
      const tr = rows[idx];
      return Array.from(document.querySelectorAll('#tablaComparacion tbody tr')).indexOf(tr);
    });

    if (targetIndex < 0) {
      const result = {
        error: 'target-row-not-found',
        empresa: await page.evaluate(() => document.querySelector('#empresaLabel')?.textContent?.trim()),
        year: await page.evaluate(() => document.querySelector('#yearLabel')?.textContent?.trim()),
        hits: before.filter((r) => /POR\s*PROGRAMA|RESULTADO\s*OPERATIVO|RESULTADOS\s*OPERATIVOS/i.test(`${r.c0} ${r.c1} ${r.sec}`)),
      };
      fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf8');
      await browser.close();
      return;
    }

    const target = page.locator('#tablaComparacion tbody tr').nth(targetIndex);
    await target.click({ button: 'right' });
    await sleep(400);

    const menuItems = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.planeacion-context-menu button')).map((b) => (b.textContent || '').trim())
    );

    const menuState = await page.evaluate(() => {
      const menu = document.querySelector('.planeacion-context-menu');
      if (!menu) return null;
      const rect = menu.getBoundingClientRect();
      return {
        hiddenAttr: menu.hidden,
        display: menu.style.display,
        left: menu.style.left,
        top: menu.style.top,
        rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
      };
    });

    const deleted = await page.evaluate(() => {
      const btn = Array.from(
        document.querySelectorAll('.planeacion-context-menu button')
      ).find((b) => /Eliminar fila/i.test(b.textContent || ''));
      if (!btn) return false;
      btn.click();
      return true;
    });

    await sleep(1400);

    const after = await snapshotRows();

    const result = {
      deleted,
      menuItems,
      menuState,
      beforeCount: before.length,
      afterCount: after.length,
      targetIndex,
      empresa: await page.evaluate(() => document.querySelector('#empresaLabel')?.textContent?.trim()),
      year: await page.evaluate(() => document.querySelector('#yearLabel')?.textContent?.trim()),
      targetBefore: before[targetIndex] || null,
      targetAfterFound: after.some((r) => /POR\s*PROGRAMA/i.test(r.c0) && /COMIT/i.test(r.c1)),
      sectionOrderBefore: before
        .filter((r) => r.cls.includes('section-header-row'))
        .map((r) => r.c1 || r.c0),
      sectionOrderAfter: after
        .filter((r) => r.cls.includes('section-header-row'))
        .map((r) => r.c1 || r.c0),
      aroundBefore: before.filter((r) => r.idx >= 42 && r.idx <= 72),
      aroundAfter: after.filter((r) => r.idx >= 42 && r.idx <= 72),
      resOpsBefore: before.filter((r) => /RESULTADOS\s*OPERATIVOS/i.test(r.sec) || /RESULTADO\s*OPERATIVO/i.test(r.c1)),
      resOpsAfter: after.filter((r) => /RESULTADOS\s*OPERATIVOS/i.test(r.sec) || /RESULTADO\s*OPERATIVO/i.test(r.c1)),
    };

    fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf8');
  } finally {
    await browser.close();
  }
})();
