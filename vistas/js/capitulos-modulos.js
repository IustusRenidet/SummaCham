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
        'summary',
        'presupuestos',
        'comites',
        'comunicacion',
        'eventos',
        'finanzas',
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
        'summary',
        'presupuestos',
        'comites',
        'comunicacion',
        'direccion',
        'eventos',
        'finanzas',
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
        'summary',
        'presupuestos',
        'comites',
        'comunicacion',
        'direccion',
        'eventos',
        'finanzas',
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
        'summary',
        'presupuestos',
        'comites',
        'comunicacion',
        'direccion',
        'eventos',
        'finanzas',
        'gtos-corporativos',
        'membresia',
        'rh',
        'serv-membresia',
        'tic'
      ]
    }
  };

  const MODULO_SHEETS = {
    comites: 'Comités',
    comunicacion: 'Comunicación',
    direccion: 'Dirección',
    eventos: 'Eventos',
    finanzas: 'Finanzas',
    'gtos-corporativos': 'Gtos Corporativos',
    membresia: 'Membresía',
    rh: 'RH',
    'serv-membresia': 'Serv Membresía',
    tic: 'T&IC',
    vpe: 'VPE'
  };

  const MODULOS_CONTROLADOS = new Set([
    'resumen',
    'summary',
    'presupuestos',
    'comites',
    'comunicacion',
    'direccion',
    'eventos',
    'finanzas',
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
    moduloDisponible,
    obtenerSheetPorModulo
  };
})();
