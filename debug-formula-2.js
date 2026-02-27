/**
 * debug-formula-2.js - Segundo intento con mejor diagnóstico
 */
const { chromium } = require('playwright');

const URL = 'https://panelamcham.amcham.com.mx/app.html';
const USER = 'ICONET';
const PASS = '4zxb63NyI43?';

async function main() {
    const browser = await chromium.launch({ headless: false, slowMo: 300 });
    const context = await browser.newContext();
    const page = await context.newPage();

    // Interceptar y loguear requests relevantes
    const apiCalls = [];
    page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('/api/layouts') || url.includes('/layouts-config')) {
            try {
                const body = await response.json().catch(() => null);
                apiCalls.push({ url, status: response.status(), bodyKeys: body ? Object.keys(body) : [] });
            } catch (e) { }
        }
    });

    // ── 1. Login ────────────────────────────────────────────────────────────────
    console.log('→ Navegando a', URL);
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });

    // Tomar screenshot del login
    await page.screenshot({ path: 'debug-login.png' });

    const title = await page.title();
    console.log('Título página:', title);
    console.log('URL actual:', page.url());

    // Buscar elementos de login
    const loginForm = await page.$('form');
    if (loginForm) {
        console.log('✓ Formulario de login encontrado');

        // Intentar distintos selectores
        const inputs = await page.$$('input');
        console.log(`Inputs encontrados: ${inputs.length}`);
        for (const input of inputs) {
            const type = await input.getAttribute('type');
            const name = await input.getAttribute('name');
            const id = await input.getAttribute('id');
            console.log(`  input[type=${type}, name=${name}, id=${id}]`);
        }

        const textInput = page.locator('input[type="text"], input[name="username"], input[id="username"]').first();
        const passInput = page.locator('input[type="password"]').first();

        await textInput.fill(USER);
        await passInput.fill(PASS);

        await page.screenshot({ path: 'debug-before-login.png' });

        // Click en el botón de submit
        await page.locator('button[type="submit"], input[type="submit"], button:has-text("Entrar"), button:has-text("Login"), button:has-text("Iniciar")').first().click();

        await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => { });

        console.log('URL después de login:', page.url());
        await page.screenshot({ path: 'debug-after-login.png' });
    } else {
        console.log('No se encontró formulario de login');
        await page.screenshot({ path: 'debug-no-form.png' });
    }

    // ── 2. Explorar el app ───────────────────────────────────────────────────────
    const currentUrl = page.url();
    const baseUrl = currentUrl.replace(/\/[^/]+$/, '/');
    console.log('\nBase URL:', baseUrl);

    // Navegar a plantillas
    const plantillasUrl = baseUrl + 'plantillas.html';
    await page.goto(plantillasUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await page.screenshot({ path: 'debug-plantillas.png' });
    console.log('URL plantillas:', page.url());

    // Ver si hay selectores de módulo/año/capítulo
    const selectores = await page.evaluate(() => {
        const result = {};
        const moduleSelect = document.getElementById('moduloSelect') || document.querySelector('select[name="modulo"]');
        const anioSelect = document.getElementById('anioSelect') || document.querySelector('select[name="anio"]');
        const capituloSelect = document.getElementById('capituloSelect') || document.querySelector('select[name="capitulo"]');
        const empresaSelect = document.getElementById('empresaIdSelect') || document.querySelector('select[name="empresaId"]');

        result.moduleOptions = moduleSelect ? Array.from(moduleSelect.options).map(o => o.value) : 'not found';
        result.anioOptions = anioSelect ? Array.from(anioSelect.options).map(o => o.value) : 'not found';
        result.capituloOptions = capituloSelect ? Array.from(capituloSelect.options).map(o => o.value) : 'not found';
        result.empresaOptions = empresaSelect ? Array.from(empresaSelect.options).map(o => o.value) : 'not found';

        // Ver el estado global del app
        result.stateModulo = window.state?.modulo || null;
        result.stateAnio = window.state?.anio || null;
        result.stateCapitulo = window.state?.capitulo || null;
        result.stateEmpresa = window.state?.empresaId || null;

        // Ver otros objetos globales
        result.hasAPI_BASE = typeof window.API_BASE !== 'undefined' ? window.API_BASE : null;

        return result;
    });

    console.log('\n=== SELECTORES Y ESTADO ===');
    console.log(JSON.stringify(selectores, null, 2));

    // ── 3. Buscar qué API BASE se usa ────────────────────────────────────────────
    const apiBaseCheck = await page.evaluate(async () => {
        // Detectar la URL base de la API
        const apiBase = window.API_BASE || '/api/layouts';

        // Obtener el empresaId real
        const empresaId = window.state?.empresaId ||
            document.getElementById('empresaIdSelect')?.value ||
            'EMPRESA01';

        // Intentar obtener capítulos disponibles para un módulo
        const results = [];
        const modulos = ['RESUMEN', 'RH', 'FINANZAS', 'COMITES', 'CDMX'];

        for (const m of modulos) {
            try {
                const res = await fetch(`${apiBase}/${m}/2026/capitulos?empresaId=${empresaId}`);
                if (res.ok) {
                    const data = await res.json();
                    results.push({ modulo: m, capitulos: data.capitulos || data, status: 'ok' });
                } else {
                    results.push({ modulo: m, status: res.status });
                }
            } catch (e) {
                results.push({ modulo: m, error: e.message });
            }
        }

        return { apiBase, empresaId, results };
    });

    console.log('\n=== API BASE CHECK ===');
    console.log(JSON.stringify(apiBaseCheck, null, 2));

    // ── 4. Intentar cargar layout desde el UI ────────────────────────────────────
    // Seleccionar el primer módulo, año, capítulo disponible y cargar
    await page.evaluate(async () => {
        const moduleSelect = document.getElementById('moduloSelect');
        const anioSelect = document.getElementById('anioSelect');

        if (moduleSelect && moduleSelect.options.length > 0) {
            // Seleccionar el primer módulo
            const firstGoodOption = Array.from(moduleSelect.options).find(o => o.value && o.value !== '');
            if (firstGoodOption) {
                moduleSelect.value = firstGoodOption.value;
                moduleSelect.dispatchEvent(new Event('change', { bubbles: true }));
                await new Promise(r => setTimeout(r, 1000));
            }
        }
    });

    await page.waitForTimeout(2000);

    // ── 5. Verificar el state DESPUÉS de interactuar ─────────────────────────────
    const finalState = await page.evaluate(() => {
        return {
            modulo: window.state?.modulo,
            anio: window.state?.anio,
            capitulo: window.state?.capitulo,
            empresaId: window.state?.empresaId,
            opCount: window.state?.operaciones?.length,
            cuentasCount: window.state?.cuentas?.length,
            // Primera operación para ver su estructura
            firstOp: window.state?.operaciones?.[0] ? {
                id: window.state.operaciones[0].OperacionId || window.state.operaciones[0].Clase,
                termsCount: (window.state.operaciones[0].formula_terms || []).length,
                terms: (window.state.operaciones[0].formula_terms || []).slice(0, 5).map(t => ({
                    op: t.operator, type: t.type, value: t.value
                })),
            } : null,
        };
    });

    console.log('\n=== ESTADO FINAL ===');
    console.log(JSON.stringify(finalState, null, 2));

    // Mostrar API calls capturadas
    console.log('\n=== API CALLS CAPTURADAS ===');
    apiCalls.forEach(c => console.log(`  ${c.status} ${c.url}`));

    await page.screenshot({ path: 'debug-final.png' });

    await browser.close();
    console.log('\n✓ Diagnóstico completado. Revisa los screenshots: debug-*.png');
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
