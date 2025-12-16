const svc=require('./src/services/reportes/planeacionReportesEngine');
(async()=>{
  const res=await svc.generarReporte('RESUMEN','empresa2',2025,12,'GUADALAJARA');
  const net=res.resumen[0].layout.find(r=>r.label==='NET RESULTS');
  console.dir(net,{depth:5});
})();
