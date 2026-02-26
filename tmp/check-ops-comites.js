const { chromium } = require('playwright');
(async()=>{
 const base='http://127.0.0.1:3005';
 const browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1100}});
 const page=await context.newPage();
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
 await page.waitForTimeout(1800);
 const info=await page.evaluate(async()=>{
  const modulo=String(window.state?.modulo||'');
  const anio=String(window.state?.anio||'');
  const capitulo=String(window.state?.capitulo||'');
  const headers=typeof window.getAuthHeaders==='function'?window.getAuthHeaders():{};
  const empresa='EMPRESA02';
  const res=await fetch(`/api/layouts/${encodeURIComponent(modulo)}/${encodeURIComponent(anio)}/${encodeURIComponent(capitulo)}?empresaId=${encodeURIComponent(empresa)}`,{headers});
  const data=await res.json();
  const ops=Array.isArray(data?.layout?.operaciones)?data.layout.operaciones:[];
  const sample=ops.slice(0,5).map(op=>({
    keys:Object.keys(op||{}).slice(0,20),
    Clase:op?.Clase,
    clase:op?.clase,
    OperacionId:op?.OperacionId,
    operacion_id:op?.operacion_id,
    orden_presentacion:op?.orden_presentacion,
    sumrow:op?.['sum-row'],
    seccion:op?.SECCION||op?.seccion
  }));
  return {status:res.status,opsCount:ops.length,sample};
 });
 console.log(JSON.stringify(info,null,2));
 await browser.close();
})();
