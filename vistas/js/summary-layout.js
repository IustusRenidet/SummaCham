(function (global) {
  const ingresosDetalle = [
    { id: 'ING_401000000000000000001', tipo: 'cuenta', codigo: '401000000000000000001', titulo: 'Cuotas Netas', padre: 'ING' },
    { id: 'ING_402000000000000000001', tipo: 'cuenta', codigo: '402000000000000000001', titulo: 'Ingresos Socios Nuevos', padre: 'ING' },
    { id: 'ING_412000000000000000001', tipo: 'cuenta', codigo: '412000000000000000001', titulo: 'Reingresos', padre: 'ING' },
    { id: 'ING_407000000000000000001', tipo: 'cuenta', codigo: '407000000000000000001', titulo: 'Eventos', padre: 'ING' },
    { id: 'ING_408000000000000000001', tipo: 'cuenta', codigo: '408000000000000000001', titulo: 'Patrocinios', padre: 'ING' },
    { id: 'ING_417000000000000000001', tipo: 'cuenta', codigo: '417000000000000000001', titulo: 'Otros Ingresos Operativos', padre: 'ING' },
    { id: 'ING_403000000000000000001', tipo: 'cuenta', codigo: '403000000000000000001', titulo: 'Servicios', padre: 'ING' },
    { id: 'ING_409000000000000000001', tipo: 'cuenta', codigo: '409000000000000000001', titulo: 'Productos Comerciales', padre: 'ING' },
    { id: 'ING_406000000000000000001', tipo: 'cuenta', codigo: '406000000000000000001', titulo: 'Ingresos Diversos', padre: 'ING' },
    { id: 'ING_705000000000000000001', tipo: 'cuenta', codigo: '705000000000000000001', titulo: 'Recuperaciones', padre: 'ING' },
    { id: 'ING_701000000000000000001', tipo: 'cuenta', codigo: '701000000000000000001', titulo: 'Ingresos Financieros', padre: 'ING' },
    { id: 'ING_702000000000000000001', tipo: 'cuenta', codigo: '702000000000000000001', titulo: 'Ingresos Por Cambios', padre: 'ING' },
    { id: 'ING_704000000000000000001', tipo: 'cuenta', codigo: '704000000000000000001', titulo: 'Otros Productos', padre: 'ING' },
    { id: 'ING_901000000000000000001', tipo: 'cuenta', codigo: '901000000000000000001', titulo: 'Otros Ingresos No Operativos', padre: 'ING' },
    { id: 'ING_413000000000000000001', tipo: 'cuenta', codigo: '413000000000000000001', titulo: 'Reembolsos', padre: 'ING' },
    { id: 'ING_414000000000000000001', tipo: 'cuenta', codigo: '414000000000000000001', titulo: 'Recuperación de Costos', padre: 'ING' },
    { id: 'ING_416000000000000000001', tipo: 'cuenta', codigo: '416000000000000000001', titulo: 'Ingresos Especiales', padre: 'ING' },
    { id: 'ING_418000000000000000001', tipo: 'cuenta', codigo: '418000000000000000001', titulo: 'Otros Ingresos', padre: 'ING' }
  ];

  const gastosDetalle = [
    { id: 'GAS_450001000000000000002', tipo: 'cuenta', codigo: '450001000000000000002', titulo: 'Costos Directos 1', padre: 'GAS' },
    { id: 'GAS_450002000000000000002', tipo: 'cuenta', codigo: '450002000000000000002', titulo: 'Costos Directos 2', padre: 'GAS' },
    { id: 'GAS_601000000000000000001', tipo: 'cuenta', codigo: '601000000000000000001', titulo: 'Costos Administrativos', padre: 'GAS' },
    { id: 'GAS_801001000000000000002', tipo: 'cuenta', codigo: '801001000000000000002', titulo: 'Gasto Operativo 1', padre: 'GAS' },
    { id: 'GAS_801002000000000000002', tipo: 'cuenta', codigo: '801002000000000000002', titulo: 'Gasto Operativo 2', padre: 'GAS' },
    { id: 'GAS_801003000000000000002', tipo: 'cuenta', codigo: '801003000000000000002', titulo: 'Gasto Operativo 3', padre: 'GAS' },
    { id: 'GAS_801004000000000000002', tipo: 'cuenta', codigo: '801004000000000000002', titulo: 'Gasto Operativo 4', padre: 'GAS' },
    { id: 'GAS_801005000000000000002', tipo: 'cuenta', codigo: '801005000000000000002', titulo: 'Gasto Operativo 5', padre: 'GAS' },
    { id: 'GAS_801006000000000000002', tipo: 'cuenta', codigo: '801006000000000000002', titulo: 'Gasto Operativo 6', padre: 'GAS' },
    { id: 'GAS_801007000000000000002', tipo: 'cuenta', codigo: '801007000000000000002', titulo: 'Gasto Operativo 7', padre: 'GAS' },
    { id: 'GAS_801008000000000000002', tipo: 'cuenta', codigo: '801008000000000000002', titulo: 'Gasto Operativo 8', padre: 'GAS' },
    { id: 'GAS_801009000000000000002', tipo: 'cuenta', codigo: '801009000000000000002', titulo: 'Gasto Operativo 9', padre: 'GAS' },
    { id: 'GAS_801010000000000000002', tipo: 'cuenta', codigo: '801010000000000000002', titulo: 'Gasto Operativo 10', padre: 'GAS' },
    { id: 'GAS_801011000000000000002', tipo: 'cuenta', codigo: '801011000000000000002', titulo: 'Gasto Operativo 11', padre: 'GAS' },
    { id: 'GAS_801012000000000000002', tipo: 'cuenta', codigo: '801012000000000000002', titulo: 'Gasto Operativo 12', padre: 'GAS' },
    { id: 'GAS_801013000000000000002', tipo: 'cuenta', codigo: '801013000000000000002', titulo: 'Gasto Operativo 13', padre: 'GAS' },
    { id: 'GAS_513000000000000000001', tipo: 'cuenta', codigo: '513000000000000000001', titulo: 'Gastos Financieros 1', padre: 'GAS' },
    { id: 'GAS_517000000000000000001', tipo: 'cuenta', codigo: '517000000000000000001', titulo: 'Gastos Financieros 2', padre: 'GAS' },
    { id: 'GAS_516000000000000000001', tipo: 'cuenta', codigo: '516000000000000000001', titulo: 'Gastos Financieros 3', padre: 'GAS' },
    { id: 'GAS_519000000000000000001', tipo: 'cuenta', codigo: '519000000000000000001', titulo: 'Gastos Financieros 4', padre: 'GAS' },
    { id: 'GAS_515000000000000000001', tipo: 'cuenta', codigo: '515000000000000000001', titulo: 'Gastos Financieros 5', padre: 'GAS' },
    { id: 'GAS_518000000000000000001', tipo: 'cuenta', codigo: '518000000000000000001', titulo: 'Gastos Financieros 6', padre: 'GAS' },
    { id: 'GAS_514000000000000000001', tipo: 'cuenta', codigo: '514000000000000000001', titulo: 'Gastos Financieros 7', padre: 'GAS' },
    { id: 'GAS_950001002000000000003', tipo: 'cuenta', codigo: '950001002000000000003', titulo: 'Otros Gastos 1', padre: 'GAS' },
    { id: 'GAS_950002002000000000003', tipo: 'cuenta', codigo: '950002002000000000003', titulo: 'Otros Gastos 2', padre: 'GAS' }
  ];

  const layout = [
    { id: 'ING', tipo: 'categoria', titulo: 'INGRESOS', componentes: ingresosDetalle.map((item) => item.id) },
    ...ingresosDetalle,
    { id: 'ING_SUB', tipo: 'subtotal', titulo: 'TOTAL INGRESOS', padre: 'ING', componentes: ingresosDetalle.map((item) => item.id) },

    { id: 'GAS', tipo: 'categoria', titulo: 'COSTOS Y GASTOS', componentes: gastosDetalle.map((item) => item.id) },
    ...gastosDetalle,
    { id: 'GAS_SUB', tipo: 'subtotal', titulo: 'TOTAL COSTOS Y GASTOS', padre: 'GAS', componentes: gastosDetalle.map((item) => item.id) },

    { id: 'RESULTADOS', tipo: 'categoria', titulo: 'RESULTADO OPERATIVO', componentes: ['UTI'] },
    { id: 'UTI', tipo: 'total', titulo: 'UTILIDAD NETA', padre: 'RESULTADOS', componentes: ['ING_SUB', 'GAS_SUB'] },

    { id: 'KPIS', tipo: 'categoria', titulo: 'INDICADORES CLAVE', componentes: [] },
    {
      id: 'KPI_YTD_vs_PLAN',
      tipo: 'kpi',
      titulo: '% YTD vs Plan',
      padre: 'KPIS',
      formula: 'UTI.acumuladoActual / UTI.acumuladoPlan',
      columnaYtd: 'acumuladoVariacionPlan',
      factor: 100
    },
    {
      id: 'KPI_YTD_vs_ANT',
      tipo: 'kpi',
      titulo: '% YTD vs Año Anterior',
      padre: 'KPIS',
      formula: 'UTI.acumuladoActual / UTI.acumuladoAnterior',
      columnaYtd: 'acumuladoVariacionAnterior',
      factor: 100
    },
    {
      id: 'KPI_MES_vs_PLAN',
      tipo: 'kpi',
      titulo: '% Mes vs Plan',
      padre: 'KPIS',
      formulaMes: 'UTI.mesActual / UTI.mesPlan',
      columnaMes: 'mesVariacionPlan',
      factor: 100
    },
    {
      id: 'KPI_MES_vs_ANT',
      tipo: 'kpi',
      titulo: '% Mes vs Año Anterior',
      padre: 'KPIS',
      formulaMes: 'UTI.mesActual / UTI.mesAnterior',
      columnaMes: 'mesVariacionAnterior',
      factor: 100
    }
  ];

  global.SUMMARY_E01_LAYOUT = layout;
})(typeof window !== 'undefined' ? window : globalThis);
