const DEFAULT_GRAFICAS_CONFIG = {
  version: 2,
  series: [
    {
      key: "actualYTD",
      label: "Real acumulado",
      color: "#0d47a1",
      columnKey: "actualYTD",
      enabled: true,
    },
    {
      key: "planYTD",
      label: "Ppto. acumulado",
      color: "#60a5fa",
      columnKey: "planYTD",
      enabled: true,
    },
    {
      key: "prevYTD",
      label: "Real acumulado AA",
      color: "#94a3b8",
      columnKey: "prevYTD",
      enabled: true,
    },
  ],
  charts: {
    operating: {
      enabled: true,
      title: "Resultado Operativo por Capitulo",
      subtitle: "Real Acum / Ppto. Acum / Real Acum AA",
      chartType: "inherit",
    },
    net: {
      enabled: true,
      title: "Resumen Neto por Capitulo",
      subtitle: "Real Acum / Ppto. Acum / Real Acum AA",
      chartType: "inherit",
    },
    consolidated: {
      enabled: true,
      title: "Consolidados Operativos vs Netos",
      subtitle: "Real Acum / Ppto. Acum / Real Acum AA",
      chartType: "inherit",
    },
  },
  consolidatedSeries: {
    operating: {
      label: "CONSOLIDATED OPERATING RESULTS",
      color: "#0d47a1",
    },
    net: {
      label: "CONSOLIDATED NET RESULTS",
      color: "#94a3b8",
    },
  },
  legend: {
    show: true,
    position: "bottom",
  },
  chart: {
    type: "bar",
    stacked: false,
  },
  ingreso: {
    enabled: true,
    title: "Ingreso por capitulo",
    subtitle: "Real acumulado por mes",
    chartType: "inherit",
    series: {
      mex: { label: "CDMX INCOME", color: "#0d47a1", enabled: true },
      gdl: { label: "GUADALAJARA INCOME", color: "#60a5fa", enabled: true },
      mty: { label: "MONTERREY INCOME", color: "#22c55e", enabled: true },
      nw: { label: "NORTHWEST INCOME", color: "#f59e0b", enabled: true },
    },
  },
  ingresoNacional: {
    enabled: true,
    title: "Ingreso nacional",
    subtitle: "Real acumulado por mes",
    chartType: "inherit",
    series: {
      committees: { label: "Committees", color: "#0d47a1", enabled: true },
      membership: { label: "Membership", color: "#60a5fa", enabled: true },
      events: { label: "Events", color: "#22c55e", enabled: true },
      services: { label: "Services to Members", color: "#f59e0b", enabled: true },
      tic: { label: "T&IC", color: "#a855f7", enabled: true },
    },
  },
  sources: {
    summary: {
      cdmx: {
        operating: [
          {
            label: "Ciudad de Mexico",
            variants: ["OPERATING RESULTS MEXICO"],
          },
          {
            label: "Guadalajara",
            variants: ["OPERATING RESULTS GUADALAJARA", "GDL OPERATING RESULTS"],
          },
          {
            label: "Noreste",
            variants: ["OPERATING RESULTS MONTERREY", "MTY OPERATING RESULTS"],
          },
          {
            label: "Noroeste",
            variants: [
              "OPERATING RESULTS NORTHWEST",
              "OPERATING RESULTS NO",
              "NO OPERATING RESULTS",
            ],
          },
        ],
        net: [
          { label: "Ciudad de Mexico", variants: ["NET RESULTS MEXICO"] },
          {
            label: "Guadalajara",
            variants: ["NET RESULTS GUADALAJARA", "GDL NET RESULTS"],
          },
          {
            label: "Noreste",
            variants: ["NET RESULTS MONTERREY", "MTY NET RESULTS"],
          },
          {
            label: "Noroeste",
            variants: ["NET RESULTS NORTHWEST", "NET RESULTS NO", "NO NET RESULTS"],
          },
        ],
      },
      gdl: {
        operating: [
          {
            label: "{capitulo}",
            variants: [
              "GDL OPERATING RESULTS",
              "OPERATING RESULTS GUADALAJARA",
              "OPERATING RESULTS",
            ],
          },
        ],
        net: [
          {
            label: "{capitulo}",
            variants: ["NET RESULTS", "GDL NET RESULTS", "NET RESULTS GUADALAJARA"],
          },
        ],
      },
      ne: {
        operating: [
          {
            label: "{capitulo}",
            variants: [
              "NE OPERATING RESULTS",
              "OPERATING RESULTS MONTERREY",
              "OPERATING RESULTS",
            ],
          },
        ],
        net: [
          {
            label: "{capitulo}",
            variants: ["NET RESULTS", "NE NET RESULTS", "NET RESULTS MONTERREY"],
          },
        ],
      },
      no: {
        operating: [
          {
            label: "{capitulo}",
            variants: [
              "NO OPERATING RESULTS",
              "OPERATING RESULTS NORTHWEST",
              "OPERATING RESULTS",
            ],
          },
        ],
        net: [
          {
            label: "{capitulo}",
            variants: ["NET RESULTS", "NO NET RESULTS", "NET RESULTS NORTHWEST"],
          },
        ],
      },
      generic: {
        operating: [
          {
            label: "{capitulo}",
            variants: ["OPERATING RESULTS", "RESULTADO OPERATIVO"],
          },
        ],
        net: [
          { label: "{capitulo}", variants: ["NET RESULTS", "RESULTADO NETO"] },
        ],
      },
    },
    consolidated: {
      operating: {
        label: "CONSOLIDATED OPERATING RESULTS",
        variants: [
          "CONSOLIDATED OPERATING RESULTS",
          "CONSOLIDATED OPERATING RESULT",
        ],
      },
      net: {
        label: "CONSOLIDATED NET RESULTS",
        variants: ["CONSOLIDATED NET RESULTS", "CONSOLIDATED NET RESULT"],
      },
    },
    ingreso: {
      mex: ["CDMX INCOME", "MEXICO INCOME", "CIUDAD DE MEXICO INCOME"],
      gdl: ["GUADALAJARA INCOME", "GDL INCOME", "GUADALAJARA INCOMEA"],
      mty: ["MONTERREY INCOME", "MTY INCOME"],
      nw: ["NORTHWEST INCOME", "NW INCOME", "NOROESTE INCOME", "NO INCOME"],
    },
    ingresoNacional: {
      committees: ["COMMITTEES", "COMITES", "COMITÉS", "COMMITTEES (INCOME)"],
      membership: ["MEMBERSHIP", "MEMBERSHIP (INCOME)"],
      events: ["EVENTS", "EVENTS (INCOME)"],
      services: [
        "SERVICES TO MEMBERS",
        "SERVICES MEMBERS",
        "SERVICES TO MEMBERS (INCOME)",
      ],
      tic: ["T&IC", "T&IC (INCOME)", "T&IC INCOME"],
    },
  },
  operativo: {
    enabled: true,
    title: "Ppto. Acumulado vs Real + {annual}",
    chartType: "bar",
    datasets: {
      budget: { label: "Ppto. Acumulado", color: "#4472c4", enabled: true },
      real: { label: "Real Acumulado", color: "#ffc000", enabled: true },
      annual: { label: "Presupuesto {year}", color: "#22c55e", enabled: true },
    },
  },
  gastosGenerales: {
    enabled: true,
    subtitleTemplate: "Real {year} vs {prev}",
    charts: {
      rendimientos: {
        enabled: true,
        title: "Rendimientos de Inversion",
        chartType: "line",
        series: {
          actual: { label: "Real {year}", color: "#ffc000", enabled: true },
          prev: { label: "Real {prev}", color: "#2f5496", enabled: true },
        },
      },
      plusvalia: {
        enabled: true,
        title: "Plusvalia/Minusvalia",
        chartType: "line",
        series: {
          actual: { label: "Real {year}", color: "#ffc000", enabled: true },
          prev: { label: "Real {prev}", color: "#2f5496", enabled: true },
        },
      },
    },
  },
  customCharts: [],
};

const clone = (value) => JSON.parse(JSON.stringify(value));

const getDefaultGraficasConfig = () => clone(DEFAULT_GRAFICAS_CONFIG);

module.exports = {
  DEFAULT_GRAFICAS_CONFIG,
  getDefaultGraficasConfig,
};
