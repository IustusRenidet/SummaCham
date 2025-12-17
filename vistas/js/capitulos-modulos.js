// Configuracion basada en info IMPORTANTE/VistasPemp.md
(function () {
  const normalizarModuloId = (valor) => (valor || '').toString().trim().toLowerCase();

  const EMPRESA_CONFIG = {
    empresa1: {
      id: 'empresa1',
      etiqueta: 'Ciudad de México',
      capitulo: 'CIUDAD DE M\u00c9XICO',
      modulos: [
        'resumen',
        'presupuestos',
        'comites',
        'comunicacion',
        'eventos',
        'finanzas',
        'gastosgenerales',
        'nomina',
        'gtos-corporativos',
        'membresia',
        'rh',
        'serv-membresia',
        'tic',
        'vpe'
      ]
    },
    empresa2: {
      id: 'empresa2',
      etiqueta: 'Guadalajara',
      capitulo: 'GUADALAJARA',
      modulos: [
        'resumen',
        'presupuestos',
        'comites',
        'comunicacion',
        'direccion',
        'eventos',
        'gastosgenerales',
        'gtos-corporativos',
        'membresia',
        'rh',
        'serv-membresia',
        'tic'
      ]
    },
    empresa3: {
      id: 'empresa3',
      etiqueta: 'Noreste',
      capitulo: 'NORESTE',
      modulos: [
        'resumen',
        'presupuestos',
        'comites',
        'comunicacion',
        'direccion',
        'eventos',
        'gastosgenerales',
        'gtos-corporativos',
        'membresia',
        'rh',
        'serv-membresia',
        'tic'
      ]
    },
    empresa4: {
      id: 'empresa4',
      etiqueta: 'Noroeste',
      capitulo: 'NOROESTE',
      modulos: [
        'resumen',
        'presupuestos',
        'comites',
        'comunicacion',
        'direccion',
        'eventos',
        'gastosgenerales',
        'gtos-corporativos',
        'membresia',
        'rh',
        'serv-membresia',
        'tic'
      ]
    }
  };

  const HOJAS_POR_MODULO_CRUDO = {
    comites: 'Comités',
    comunicacion: 'Comunicación',
    direccion: 'Dirección',
    eventos: 'Eventos',
    finanzas: 'Finanzas',
    gastosgenerales: 'Finanzas',
    nomina: 'Finanzas',
    'gtos-corporativos': 'Gtos Corporativos',
    membresia: 'Membresía',
    presupuestos: 'Presupuestos',
    rh: 'RH',
    'serv-membresia': 'Serv Membresía',
    tic: 'T&IC',
    vpe: 'VPE'
  };

  const MODULO_SHEETS = Object.keys(HOJAS_POR_MODULO_CRUDO).reduce((map, moduloClave) => {
    map[normalizarModuloId(moduloClave)] = HOJAS_POR_MODULO_CRUDO[moduloClave];
    return map;
  }, {});

  const MODULOS_CONTROLADOS = new Set([
    'resumen',
    'presupuestos',
    'comites',
    'comunicacion',
    'direccion',
    'eventos',
    'finanzas',
    'gastosgenerales',
    'nomina',
    'gtos-corporativos',
    'membresia',
    'rh',
    'serv-membresia',
    'tic',
    'vpe'
  ]);

  const obtenerConfigEmpresa = (empresaId) => {
    const clave = (empresaId || '').toString();
    return EMPRESA_CONFIG[clave] || null;
  };

  const moduloDisponible = (empresaId, moduloId) => {
    const modId = normalizarModuloId(moduloId);
    if (!MODULOS_CONTROLADOS.has(modId)) {
      return true;
    }
    const config = obtenerConfigEmpresa(empresaId);
    if (!config) {
      return false;
    }
    return config.modulos.includes(modId);
  };

  const obtenerCapituloPorEmpresa = (empresaId) => {
    const config = obtenerConfigEmpresa(empresaId);
    return config ? config.capitulo : null;
  };

  const obtenerSheetPorModulo = (moduloId) => {
    return MODULO_SHEETS[normalizarModuloId(moduloId)] || null;
  };

  window.CapitulosModulos = {
    EMPRESA_CONFIG,
    MODULO_SHEETS,
    obtenerConfigEmpresa,
    obtenerCapituloPorEmpresa,
    empresaACapitulo: obtenerCapituloPorEmpresa, // Alias para compatibilidad
    moduloDisponible,
    obtenerSheetPorModulo
  };
})();
