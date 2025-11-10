export const LAYOUT = [
  // ===== INGRESOS =====
  { id: 'ING', tipo: 'categoria', titulo: 'INGRESOS' },

  // Detalle (pon aquí tus códigos reales)
  { id: 'ING_MEM', tipo: 'cuenta', codigo: '400-000-000-00', titulo: 'Membresías', padre: 'ING' },
  { id: 'ING_OTR', tipo: 'cuenta', codigo: '402-000-000-00', titulo: 'Otros ingresos', padre: 'ING' },

  // Subtotal ingresos
  { id: 'ING_SUB', tipo: 'subtotal', hijos: ['ING_MEM','ING_OTR'], titulo: 'Total ingresos', padre: 'ING' },

  // ===== GASTOS =====
  { id: 'GAS', tipo: 'categoria', titulo: 'GASTOS' },

  // Detalle (ejemplos; ajusta a tus códigos)
  { id: 'GAS_GEN',  tipo: 'cuenta', codigo: '500-000-000-00', titulo: 'Gastos generales', padre: 'GAS' },
  { id: 'GAS_NOM',  tipo: 'cuenta', codigo: '510-000-000-00', titulo: 'Nómina', padre: 'GAS' },
  { id: 'GAS_EV',   tipo: 'cuenta', codigo: '520-000-000-00', titulo: 'Eventos', padre: 'GAS' },

  // Subtotal gastos
  { id: 'GAS_SUB', tipo: 'subtotal', hijos: ['GAS_GEN','GAS_NOM','GAS_EV'], titulo: 'Total gastos', padre: 'GAS' },

  // ===== RESULTADOS =====
  { id: 'UTI', tipo: 'total', hijos: ['ING_SUB','GAS_SUB'], titulo: 'UTILIDAD (Ingresos - Gastos)' },

  // ===== KPIs =====
  // % vs Plan (YTD y MES)
  { id: 'KPI_YTD_vs_PLAN', tipo: 'kpi', titulo: '% YTD vs Plan',  formula: 'UTI.ytdActual / UTI.ytdPlan' },
  { id: 'KPI_MES_vs_PLAN', tipo: 'kpi', titulo: '% MES vs Plan',  formula: 'UTI.mesActual / UTI.mesPlan' },

  // % vs Año anterior (YTD y MES)
  { id: 'KPI_YTD_vs_ANT',  tipo: 'kpi', titulo: '% YTD vs Año Ant', formula: 'UTI.ytdActual / UTI.ytdAnterior' },
  { id: 'KPI_MES_vs_ANT',  tipo: 'kpi', titulo: '% MES vs Año Ant', formula: 'UTI.mesActual / UTI.mesAnterior' },
];
