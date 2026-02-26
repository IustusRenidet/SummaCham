const { chromium } = require('playwright');
(async()=>{
 const base='http://127.0.0.1:3005';
 const browser=await chromium.launch({headless:true});
 const page=await (await browser.newContext({viewport:{width:1500,height:1200}})).newPage();
 const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
 await page.goto(base+'/login.html');
 await page.fill('#usuario','ICONET');
 await page.fill('#contrasena','4zxb63NyI43?');
 await Promise.all([page.waitForURL('**/app.html'),page.click('#botonIngresar')]);
 await page.goto(base+'/plantillas.html');
 await page.waitForSelector('#moduloSelect');
 await page.evaluate(()=>window.Sesion?.establecerEmpresaActiva?.('empresa2'));
 await page.selectOption('#moduloSelect','Comités');
 await page.waitForFunction(()=>Array.from(document.querySelector('#anioSelect')?.options||[]).some(o=>String(o.value)==='2026'));
 await page.selectOption('#anioSelect','2026');
 await page.waitForFunction(()=>Array.from(document.querySelector('#capituloSelect')?.options||[]).some(o=>String(o.value||'').toUpperCase().includes('GUADALAJARA')));
 await page.evaluate(()=>{const s=document.querySelector('#capituloSelect');const o=[...(s?.options||[])].find(x=>String(x.value||'').toUpperCase().includes('GUADALAJARA'));if(o){s.value=o.value;s.dispatchEvent(new Event('change',{bubbles:true}));}});
 await page.click('#btnCargar');
 await page.waitForFunction(()=>window.state&&String(window.state.modulo)==='Comités'&&String(window.state.anio)==='2026');
 await sleep(1500);
 const before=await page.evaluate(()=>{
   const get=(label)=>{
     const op=(window.state?.operaciones||[]).find(o=>String(o?.Clase||'').trim()===label);
     return op?{label,id:op.OperacionId,orden:op.orden_presentacion}:null;
   };
   return {agro:get('Resultado Operativo: Agroindustria'),asuntos:get('Resultado Operativo: Asuntos Fiscales')};
 });
 const move=await page.evaluate(()=>{
   const rows=window.getTemplateRowsForReorder?window.getTemplateRowsForReorder():[];
   for(let i=1;i<rows.length;i++){
    const c=rows[i],p=rows[i-1];
    if(c?.type!=='operation'||p?.type!=='operation') continue;
    if(String(c?.label||'').includes('Asuntos Fiscales') && String(p?.label||'').includes('Agroindustria')){
      const res=window.moveTemplateRowOrderToIndex(i,i-1);
      const after=window.getTemplateRowsForReorder?window.getTemplateRowsForReorder():[];
      const iC=after.findIndex(r=>String(r?.label||'').includes('Asuntos Fiscales'));
      const iP=after.findIndex(r=>String(r?.label||'').includes('Agroindustria'));
      return {found:true,res,i,iTarget:i-1,afterIdx:{asuntos:iC,agro:iP}};
    }
   }
   return {found:false};
 });
 await sleep(500);
 const after=await page.evaluate(()=>{
   const get=(label)=>{
     const op=(window.state?.operaciones||[]).find(o=>String(o?.Clase||'').trim()===label);
     return op?{label,id:op.OperacionId,orden:op.orden_presentacion}:null;
   };
   return {agro:get('Resultado Operativo: Agroindustria'),asuntos:get('Resultado Operativo: Asuntos Fiscales'),unsaved:window.state?.unsavedChanges};
 });
 console.log(JSON.stringify({before,move,after},null,2));
 await browser.close();
})();
