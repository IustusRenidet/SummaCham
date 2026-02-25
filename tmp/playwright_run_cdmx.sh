PW="/c/Users/Frida Sophia/.codex/skills/playwright/scripts/playwright_cli.sh"
STATE="/c/Users/Frida Sophia/Desktop/DESARROLLOS/SummaCham/tmp/playwright_state_cdmx.json"
"$PW" --session cdmxres close >/dev/null 2>&1 || true
"$PW" --session cdmxres open http://localhost:3005/RESUMEN.html
"$PW" --session cdmxres state-load "$STATE"
"$PW" --session cdmxres reload
"$PW" --session cdmxres run-code "await page.waitForTimeout(3000)"
"$PW" --session cdmxres run-code "const ys=document.querySelector('#resumenYearSelect'); if(ys){ ys.value='2026'; ys.dispatchEvent(new Event('change',{bubbles:true})); } const ms=document.querySelector('#resumenMonthSelect'); if(ms){ ms.value='12'; ms.dispatchEvent(new Event('change',{bubbles:true})); } await page.waitForTimeout(4500);"
"$PW" --session cdmxres snapshot
