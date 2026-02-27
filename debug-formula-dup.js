/**
 * debug-formula-dup.js
 * Investiga el problema de fórmulas que duplican (cuentas + sección completa)
 * en el Gestor de Plantillas.
 * 
 * Uso: node debug-formula-dup.js
 */
const { chromium } = require('playwright');

const URL = 'https://panelamcham.amcham.com.mx/app.html';
const USER = 'ICONET';
const PASS = '4zxb63NyI43?';

async function main() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    // ── 1. Login ────────────────────────────────────────────────────────────────
    console.log('→ Navegando a', URL);
    await page.goto(URL, { waitUntil: 'networkidle' });

    // Esperar form de login
    await page.waitForSelector('#username, #user, input[name="username"], input[name="user"]', { timeout: 15000 }).catch(() => { });

    // Fill login form
    const userInput = page.locator('input[name="username"], input[id="username"], input[type="text"]').first();
    const passInput = page.locator('input[name="password"], input[id="password"], input[type="password"]').first();
    const submitBtn = page.locator('button[type="submit"], input[type="submit"]').first();

    await userInput.fill(USER);
    await passInput.fill(PASS);
    await submitBtn.click();

    await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }).catch(() => { });
    console.log('✓ Logged in. URL:', page.url());

    // ── 2. Navegar a plantillas.html ─────────────────────────────────────────────
    const plantillasUrl = URL.replace('app.html', 'plantillas.html');
    await page.goto(plantillasUrl, { waitUntil: 'networkidle' });
    console.log('→ En plantillas.html');

    // ── 3. Consultar la API para obtener módulos disponibles ────────────────────
    // Obtener una lista de módulos/años/capítulos disponibles
    const apiBase = URL.replace('app.html', 'api/layouts');

    // Consultar la API directamente usando fetch en el contexto del browser (ya autenticado)
    const layoutsInfo = await page.evaluate(async (apiBase) => {
        const results = [];
        // Intentar obtener layouts para módulos comunes
        const modulos = ['RESUMEN', 'RH', 'FINANZAS', 'COMITES'];
        const anios = [2025, 2026];
        const capitulos = ['CDMX', 'GDL', 'DEFAULT'];

        for (const modulo of modulos) {
            for (const anio of anios) {
                for (const capitulo of capitulos) {
                    try {
                        const url = `${apiBase}/${modulo}/${anio}/${capitulo}?empresaId=EMPRESA01`;
                        const res = await fetch(url, { credentials: 'include' });
                        if (res.ok) {
                            const data = await res.json();
                            if (data.layout && data.layout.operaciones && data.layout.operaciones.length > 0) {
                                results.push({ modulo, anio, capitulo, opCount: data.layout.operaciones.length });
                            }
                        }
                    } catch (e) { }
                }
            }
        }
        return results;
    }, apiBase);

    console.log('\n=== LAYOUTS DISPONIBLES ===');
    layoutsInfo.forEach(l => console.log(`  ${l.modulo} ${l.anio} ${l.capitulo}: ${l.opCount} operaciones`));

    if (layoutsInfo.length === 0) {
        console.log('No se encontraron layouts.');
        await browser.close();
        return;
    }

    // ── 4. Analizar fórmulas en cada layout ──────────────────────────────────────
    console.log('\n=== ANÁLISIS DE FÓRMULAS ===');

    for (const layoutRef of layoutsInfo.slice(0, 5)) {
        const { modulo, anio, capitulo } = layoutRef;

        const analysis = await page.evaluate(async (apiBase, modulo, anio, capitulo) => {
            const url = `${apiBase}/${modulo}/${anio}/${capitulo}?empresaId=EMPRESA01`;
            const res = await fetch(url, { credentials: 'include' });
            if (!res.ok) return null;
            const data = await res.json();
            const ops = data.layout?.operaciones || [];
            const cuentas = data.layout?.cuentas || [];

            // Construir set de secciones para comparar
            const secciones = new Set();
            const cuentasCodes = new Set();
            cuentas.forEach(c => {
                const sec = c['SECCION Principal'] || c.seccion_principal || c.SECCION || '';
                if (sec) secciones.add(sec.toLowerCase().trim());
                const codigo = c.CUENTA || c.cuenta || '';
                if (codigo) cuentasCodes.add(codigo.toLowerCase().trim());
            });

            const problemOps = [];

            ops.forEach(op => {
                const terms = op.formula_terms || [];
                if (!terms.length) return;

                // Analizar qué tipos hay en los terms
                const accountTerms = terms.filter(t => t.type === 'account' || t.type === 'cuenta');
                const sectionTerms = terms.filter(t => t.type === 'section' || t.type === 'seccion');
                const opTerms = terms.filter(t => t.type === 'operation' || t.type === 'operacion');

                if (accountTerms.length === 0 && sectionTerms.length === 0) return;

                // Detectar si hay tanto cuentas como secciones que contienen esas cuentas
                const sectionValuesLower = sectionTerms.map(t => (t.value || '').toLowerCase().trim());
                const accountsInSections = accountTerms.filter(t => {
                    const acct = (t.value || '').toLowerCase().trim();
                    // ver si alguna de las secciones contiene esta cuenta
                    return cuentas.some(c => {
                        const cCode = (c.CUENTA || c.cuenta || '').toLowerCase().trim();
                        if (cCode !== acct) return false;
                        const cSec = (c['SECCION Principal'] || c.seccion_principal || '').toLowerCase().trim();
                        return sectionValuesLower.some(sv => sv === cSec || cSec.includes(sv) || sv.includes(cSec));
                    });
                });

                if (accountsInSections.length > 0 && sectionTerms.length > 0) {
                    problemOps.push({
                        id: op.OperacionId || op.Clase || 'unknown',
                        label: op.Clase || op.operacion_etiqueta || '',
                        termsTotal: terms.length,
                        accountTermsCount: accountTerms.length,
                        sectionTermsCount: sectionTerms.length,
                        opTermsCount: opTerms.length,
                        accountsAlsoInSections: accountsInSections.length,
                        allTerms: terms.map(t => `[${t.operator || '+'}][${t.type}] ${t.value}`),
                        formula_json: op.formula_json ? op.formula_json.substring(0, 200) : null,
                    });
                }

                // También detectar si hay duplicados en la fórmula (misma sección dos veces)
                const termValues = terms.map(t => (t.value || '').toLowerCase().trim());
                const dupValues = termValues.filter((v, i) => termValues.indexOf(v) !== i);
                if (dupValues.length > 0) {
                    problemOps.push({
                        id: op.OperacionId || op.Clase || 'unknown',
                        label: op.Clase || op.operacion_etiqueta || '',
                        ISSUE: 'DUPLICATE_TERMS',
                        dupValues,
                        allTerms: terms.map(t => `[${t.operator || '+'}][${t.type}] ${t.value}`),
                        formula_json: op.formula_json ? op.formula_json.substring(0, 200) : null,
                    });
                }
            });

            return {
                totalOps: ops.length,
                totalCuentas: cuentas.length,
                problemCount: problemOps.length,
                problems: problemOps,
                allOpsFormulas: ops.map(op => ({
                    id: op.OperacionId || op.Clase,
                    termsCount: (op.formula_terms || []).length,
                    termsSummary: (op.formula_terms || []).map(t => `${t.operator || '+'}${t.type}:${t.value}`).join(' | '),
                }))
            };
        }, apiBase, modulo, anio, capitulo);

        if (!analysis) continue;

        console.log(`\n--- ${modulo} ${anio} ${capitulo} (${analysis.totalOps} ops, ${analysis.totalCuentas} cuentas) ---`);

        if (analysis.problemCount > 0) {
            console.log(`⚠️  ${analysis.problemCount} OPERACIONES CON POSIBLE DUPLICACIÓN:`);
            analysis.problems.forEach(p => {
                console.log(`  OP: ${p.id} (${p.label})`);
                if (p.ISSUE) console.log(`     ISSUE: ${p.ISSUE} - valores dup: ${p.dupValues?.join(', ')}`);
                else console.log(`     Tiene ${p.accountTermsCount} cuentas + ${p.sectionTermsCount} secciones (${p.accountsAlsoInSections} cuentas duplicadas en sección)`);
                console.log(`     Terms: ${p.allTerms.join(' | ')}`);
            });
        } else {
            console.log('✓ No se detectaron duplicaciones evidentes');
        }

        // Mostrar todas las fórmulas para diagnóstico
        console.log('\n  Fórmulas de todas las operaciones:');
        analysis.allOpsFormulas.forEach(op => {
            if (op.termsCount > 0) {
                console.log(`  • ${op.id}: ${op.termsSummary}`);
            } else {
                console.log(`  • ${op.id}: (sin formula_terms)`);
            }
        });
    }

    // ── 5. Verificar la lógica en frontend: buildPreviewRowsForEditor ───────────
    // Navegar a plantillas y verificar el estado actual
    console.log('\n=== ESTADO DEL GESTOR DE PLANTILLAS ===');

    if (layoutsInfo.length > 0) {
        const first = layoutsInfo[0];
        // Navegar al gestor con el primer layout y observar las operaciones en el estado del frontend
        const stateCheck = await page.evaluate(async (layoutRef) => {
            // Intentar leer el estado interno del gestor
            // Estas variables pueden estar en el scope de window
            return {
                hasState: typeof window.state !== 'undefined',
                stateModulo: window.state?.modulo,
                stateAnio: window.state?.anio,
                stateCapitulo: window.state?.capitulo,
                opCount: window.state?.operaciones?.length || 0,
            };
        }, first);
        console.log('Estado frontend:', JSON.stringify(stateCheck, null, 2));
    }

    await browser.close();
    console.log('\n✓ Diagnóstico completado');
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
