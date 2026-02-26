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
 if(!row) return {row:false};
 const estado=window.__cuentasModuloDebugEstado || null;
 const sumas=estado?.sumas || window.CuentasModulo?._estado?.sumas || null;
 const metas=(sumas?.secciones)||[];
 let inMeta=false;
 let metaSection='';
 let metaCount=0;
 let sameCuenta=[];
 metas.forEach((m)=>{
  const filas=m?.filasCuenta||[];
  if(filas.includes(row)){inMeta=true;metaSection=m?.seccion;metaCount=filas.length;}
  filas.forEach((f)=>{
   if(f?.dataset?.cuenta21===row.dataset.cuenta21){sameCuenta.push({seccion:m?.seccion,text:(f.cells?.[1]?.textContent||'').trim(),sameNode:f===row});}
  });
 });
 return {row:true, metas:metas.length, inMeta, metaSection, metaCount, sameCuenta};
});
console.log(JSON.stringify(info,null,2));
await browser.close();
})();
