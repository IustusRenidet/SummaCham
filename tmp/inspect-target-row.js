const { chromium } = require('playwright');
(async()=>{
const base='http://127.0.0.1:3005';
const browser=await chromium.launch({headless:true});
const page=await (await browser.newContext({viewport:{width:1500,height:1100}})).newPage();
await page.goto(base+'/login.html');
await page.fill('#usuario','ICONET');
await page.fill('#contrasena','4zxb63NyI43?');
await Promise.all([page.waitForURL('**/app.html'),page.click('#botonIngresar')]);
await page.goto(base+'/Comit%C3%A9s.html',{waitUntil:'domcontentloaded'});
await page.waitForSelector('#tablaComparacion');
await page.evaluate(()=>window.Sesion?.establecerEmpresaActiva?.('empresa1'));
await page.reload({waitUntil:'domcontentloaded'});
await page.waitForSelector('#tablaComparacion');
await page.waitForTimeout(2600);
const info=await page.evaluate(()=>{
 const row=Array.from(document.querySelectorAll('#tablaComparacion tbody tr')).find(tr=>{const tds=tr.querySelectorAll('td');return /POR\s*PROGRAMA/i.test((tds[0]?.textContent||'').trim()) && /COMIT/i.test((tds[1]?.textContent||'').trim());});
 if(!row) return null;
 return {
  classes:[...row.classList],
  dataset:{...row.dataset},
  cell0:(row.cells?.[0]?.textContent||'').trim(),
  cell1:(row.cells?.[1]?.textContent||'').trim(),
  sectionHeaderBefore: (()=>{let p=row.previousElementSibling;while(p){if(p.classList.contains('section-header-row')){return (p.textContent||'').trim();}p=p.previousElementSibling;}return '';})()
 };
});
console.log(JSON.stringify(info,null,2));
await browser.close();
})();
