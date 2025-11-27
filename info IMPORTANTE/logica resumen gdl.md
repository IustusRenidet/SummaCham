# Lógica para Crear la Tabla Resumen GDL

## Análisis de la Estructura Actual

Basándome en el análisis de los archivos Excel de presupuesto 2026, he identificado la siguiente estructura:

### 1. Estructura de las Hojas Individuales (RH, Eventos, Comités, etc.)

Cada hoja individual tiene:

* **Columna B** : Código de cuenta (ej: 901-017-001-00)
* **Columna C** : Descripción del concepto
* **Columnas D-AB** : Valores mensuales alternados (Real/Presupuesto por mes)
* Columna D: Enero Real
* Columna E: Enero Presupuesto
* Columna F: Febrero Real
* Columna G: Febrero Presupuesto
* ... y así sucesivamente hasta Diciembre
* **Columna AB** : Total Anual (suma de los 12 meses de columnas pares)

### 2. Estructura de la Hoja Resumen

La hoja Resumen consolida todas las hojas individuales y tiene:

* **Columna A** : Descripción del concepto
* **Columna B** : Código de agrupación (códigos maestros como 400000000000000000000, 701000000000000000000, etc.)
* **Columna C** : Real 2026 (suma de valores reales)
* **Columna D** : Presupuesto 2026 (suma de valores presupuestados)
* **Columna E** : Real 2025 (comparativo año anterior)
* **Columna F** : Variación % (Real 2026 vs Presupuesto 2026)
* **Columna G** : Variación % (Real 2026 vs Real 2025)

---

## Lógica de Implementación Propuesta

### PASO 1: Mapeo de Códigos de Cuenta a Categorías

Crear un **diccionario de mapeo** que asocie cada código de cuenta de las hojas individuales con su categoría en el Resumen:

```python
MAPEO_CATEGORIAS = {
    # INGRESOS
    '4-00': {  # Cuotas de Ingreso-Reingresos
        'categoria_resumen': 'Cuotas de Ingreso-Reingresos',
        'codigo_resumen': '400000000000000000000',
        'tipo': 'ingreso',
        'nivel': 'detalle'
    },
    '4-01': {  # Cuotas de Ingreso
        'categoria_resumen': 'Cuotas de Ingreso',
        'codigo_resumen': '401000000000000000000',
        'tipo': 'ingreso',
        'nivel': 'detalle'
    },
    '4-03': {  # Ingresos Membresía
        'categoria_resumen': 'Ingresos Membresía',
        'codigo_resumen': '403000000000000000000',
        'tipo': 'ingreso',
        'nivel': 'detalle'
    },
    '4-04': {  # Ingresos por Eventos
        'categoria_resumen': 'Ingresos por Eventos',
        'codigo_resumen': '404000000000000000000',
        'tipo': 'ingreso',
        'nivel': 'detalle'
    },
    '4-05': {  # Ingresos por Servicios
        'categoria_resumen': 'Ingresos por Servicios',
        'codigo_resumen': '405000000000000000000',
        'tipo': 'ingreso',
        'nivel': 'detalle'
    },
    '4-06': {  # Otros Ingresos
        'categoria_resumen': 'Otros Ingresos',
        'codigo_resumen': '406000000000000000000',
        'tipo': 'ingreso',
        'nivel': 'detalle'
    },
    '4-07': {  # Ingresos Extraordinarios
        'categoria_resumen': 'Ingresos Extraordinarios',
        'codigo_resumen': '407000000000000000000',
        'tipo': 'ingreso',
        'nivel': 'detalle'
    },
    '4-08': {  # Rentas
        'categoria_resumen': 'Rentas',
        'codigo_resumen': '408000000000000000000',
        'tipo': 'ingreso',
        'nivel': 'detalle'
    },
  
    # GASTOS - RH
    '7-02': {  # Sueldos y Salarios
        'categoria_resumen': 'Sueldos y Salarios',
        'codigo_resumen': '702000000000000000000',
        'tipo': 'gasto',
        'departamento': 'RH',
        'nivel': 'detalle'
    },
    '5-03': {  # Prestaciones
        'categoria_resumen': 'Prestaciones',
        'codigo_resumen': '503000000000000000000',
        'tipo': 'gasto',
        'departamento': 'RH',
        'nivel': 'detalle'
    },
  
    # GASTOS - Eventos
    '7-01': {  # Eventos
        'categoria_resumen': 'Eventos',
        'codigo_resumen': '701000000000000000000',
        'tipo': 'gasto',
        'departamento': 'Eventos',
        'nivel': 'detalle'
    },
  
    # GASTOS - Servicios a la Membresía
    '5-02': {  # Servicios a la Membresía
        'categoria_resumen': 'Servicios a la Membresía',
        'codigo_resumen': '502000000000000000000',
        'tipo': 'gasto',
        'departamento': 'Serv_Membresia',
        'nivel': 'detalle'
    },
  
    # GASTOS - Comunicación
    '5-04': {  # Comunicación
        'categoria_resumen': 'Comunicación',
        'codigo_resumen': '504000000000000000000',
        'tipo': 'gasto',
        'departamento': 'Comunicacion',
        'nivel': 'detalle'
    },
  
    # GASTOS - Comités
    '7-03': {  # Comités
        'categoria_resumen': 'Comités',
        'codigo_resumen': '703000000000000000000',
        'tipo': 'gasto',
        'departamento': 'Comites',
        'nivel': 'detalle'
    },
  
    # GASTOS - TI
    '6-01': {  # Tecnologías de la Información
        'categoria_resumen': 'Tecnologías de la Información',
        'codigo_resumen': '601000000000000000000',
        'tipo': 'gasto',
        'departamento': 'TIC',
        'nivel': 'detalle'
    },
  
    # GASTOS - Finanzas y Administrativos
    '8-01': {  # Finanzas
        'categoria_resumen': 'Finanzas',
        'codigo_resumen': '801000000000000000000',
        'tipo': 'gasto',
        'departamento': 'Finanzas',
        'nivel': 'detalle'
    },
    '9-01': {  # Gastos Administrativos
        'categoria_resumen': 'Gastos Administrativos',
        'codigo_resumen': '901000000000000000000',
        'tipo': 'gasto',
        'departamento': 'Gtos_Corporativas',
        'nivel': 'detalle'
    },
  
    # GASTOS - Dirección
    '5-01': {  # Dirección
        'categoria_resumen': 'Dirección',
        'codigo_resumen': '501000000000000000000',
        'tipo': 'gasto',
        'departamento': 'Direccion',
        'nivel': 'detalle'
    },
  
    # OTROS
    '9-03': {  # Otros Gastos
        'categoria_resumen': 'Otros Gastos',
        'codigo_resumen': '903000000000000000000',
        'tipo': 'gasto',
        'nivel': 'detalle'
    },
    '9-03-016': {  # Depreciación
        'categoria_resumen': 'Depreciación',
        'codigo_resumen': '903016000000000000000',
        'tipo': 'gasto',
        'nivel': 'detalle'
    },
    '9-04': {  # Gastos Fiscales
        'categoria_resumen': 'Gastos Fiscales',
        'codigo_resumen': '904000000000000000000',
        'tipo': 'gasto',
        'nivel': 'detalle'
    },
  
    # INGRESOS EXTRAORDINARIOS
    '4-02': {  # Otros Ingresos (Extraordinarios)
        'categoria_resumen': 'Otros Ingresos',
        'codigo_resumen': '402000000000000000000',
        'tipo': 'ingreso_extraordinario',
        'nivel': 'detalle'
    },
    '4-10': {  # Productos Financieros
        'categoria_resumen': 'Productos Financieros',
        'codigo_resumen': '410000000000000000000',
        'tipo': 'ingreso_extraordinario',
        'nivel': 'detalle'
    }
}
```

### PASO 2: Función para Extraer Código Base

Crear una función que extraiga el prefijo del código de cuenta:

```python
def extraer_codigo_base(codigo_completo):
    """
    Extrae el código base de un código de cuenta completo
    Ejemplos:
    - '901-017-001-00' -> '9-01'
    - '702-001-001-00' -> '7-02'
    - '403-001-001-00' -> '4-03'
    """
    if not codigo_completo:
        return None
  
    partes = codigo_completo.split('-')
    if len(partes) >= 2:
        # Tomar primer dígito y segundo grupo
        return f"{partes[0][0]}-{partes[1]}"
    return None
```

### PASO 3: Leer y Consolidar Datos de Todas las Hojas

```python
def consolidar_hojas_gdl(archivos_hojas):
    """
    Lee todas las hojas individuales y consolida los datos por categoría
  
    Parámetros:
    - archivos_hojas: Lista de archivos Excel a procesar
  
    Retorna:
    - diccionario con datos consolidados por código de categoría
    """
  
    datos_consolidados = {}
  
    for archivo in archivos_hojas:
        wb = openpyxl.load_workbook(archivo)
        sheet = wb.active
      
        # Iterar por todas las filas con datos
        for row in sheet.iter_rows(min_row=10, max_row=sheet.max_row):
            # Columna B: Código de cuenta
            codigo_cuenta = row[1].value  # Columna B
            if not codigo_cuenta:
                continue
          
            # Extraer código base
            codigo_base = extraer_codigo_base(codigo_cuenta)
            if not codigo_base or codigo_base not in MAPEO_CATEGORIAS:
                continue
          
            # Obtener la categoría correspondiente
            categoria_info = MAPEO_CATEGORIAS[codigo_base]
            codigo_resumen = categoria_info['codigo_resumen']
          
            # Inicializar si no existe
            if codigo_resumen not in datos_consolidados:
                datos_consolidados[codigo_resumen] = {
                    'categoria': categoria_info['categoria_resumen'],
                    'tipo': categoria_info['tipo'],
                    'real_2026': 0,
                    'ppto_2026': 0,
                    'real_2025': 0  # Esto vendría del año anterior
                }
          
            # Sumar los valores mensuales
            # Las columnas D, F, H, J, L, N, P, R, T, V, X, Z son REALES (meses pares)
            # Las columnas E, G, I, K, M, O, Q, S, U, W, Y, AA son PRESUPUESTO (meses impares)
          
            for mes in range(12):
                col_real = 3 + (mes * 2)      # D=3, F=5, H=7, etc.
                col_ppto = 3 + (mes * 2) + 1   # E=4, G=6, I=8, etc.
              
                valor_real = row[col_real].value or 0
                valor_ppto = row[col_ppto].value or 0
              
                datos_consolidados[codigo_resumen]['real_2026'] += valor_real
                datos_consolidados[codigo_resumen]['ppto_2026'] += valor_ppto
      
        wb.close()
  
    return datos_consolidados
```

### PASO 4: Calcular Totales y Subtotales

```python
def calcular_estructura_jerarquica(datos_consolidados):
    """
    Calcula los totales y subtotales según la jerarquía del Resumen
    """
  
    # Crear estructura jerárquica
    estructura = {
        # NIVEL 1: INGRESOS TOTALES
        'total_ingresos': {
            'componentes': [
                'cuotas_ingreso',      # Suma de 400 + 401
                'ingresos_servicios',  # 405
                'ingresos_eventos',    # 404
                'membresias',          # 403 + 408
            ]
        },
      
        # Subtotales de ingresos
        'cuotas_ingreso': {
            'componentes': [
                '400000000000000000000',  # Cuotas Ingreso-Reingresos
                '401000000000000000000'   # Cuotas de Ingreso
            ]
        },
        'ingresos_servicios': {
            'componentes': ['405000000000000000000']
        },
        'ingresos_eventos': {
            'componentes': ['404000000000000000000']
        },
        'membresias': {
            'componentes': [
                '403000000000000000000',  # Ingresos Membresía
                '408000000000000000000'   # Rentas
            ]
        },
      
        # NIVEL 2: GASTOS TOTALES
        'total_gastos': {
            'componentes': [
                'gastos_rh',
                'gastos_eventos',
                'gastos_membresia',
                'gastos_comunicacion',
                'gastos_comites',
                'gastos_ti',
                'gastos_finanzas_admin',
                'gastos_direccion'
            ]
        },
      
        # Subtotales de gastos
        'gastos_rh': {
            'componentes': [
                '702000000000000000000',  # Sueldos
                '503000000000000000000'   # Prestaciones
            ]
        },
        'gastos_eventos': {
            'componentes': ['701000000000000000000']
        },
        'gastos_membresia': {
            'componentes': ['502000000000000000000']
        },
        'gastos_comunicacion': {
            'componentes': ['504000000000000000000']
        },
        'gastos_comites': {
            'componentes': ['703000000000000000000']
        },
        'gastos_ti': {
            'componentes': ['601000000000000000000']
        },
        'gastos_finanzas_admin': {
            'componentes': [
                '801000000000000000000',  # Finanzas
                '901000000000000000000'   # Gastos Administrativos
            ]
        },
        'gastos_direccion': {
            'componentes': ['501000000000000000000']
        },
      
        # OTROS CONCEPTOS
        'otros_gastos': {
            'componentes': [
                '903000000000000000000',     # Otros Gastos
                '903016000000000000000'      # Depreciación
            ]
        },
        'gastos_fiscales': {
            'componentes': ['904000000000000000000']
        },
        'ingresos_extraordinarios': {
            'componentes': [
                '402000000000000000000',  # Otros Ingresos
                '410000000000000000000'   # Productos Financieros
            ]
        }
    }
  
    # Calcular cada nivel
    for clave, config in estructura.items():
        if clave not in datos_consolidados:
            datos_consolidados[clave] = {
                'real_2026': 0,
                'ppto_2026': 0,
                'real_2025': 0
            }
      
        for componente in config['componentes']:
            if componente in datos_consolidados:
                datos_consolidados[clave]['real_2026'] += datos_consolidados[componente]['real_2026']
                datos_consolidados[clave]['ppto_2026'] += datos_consolidados[componente]['ppto_2026']
                datos_consolidados[clave]['real_2025'] += datos_consolidados[componente]['real_2025']
  
    # Calcular resultado operativo
    datos_consolidados['resultado_operativo'] = {
        'real_2026': datos_consolidados['total_ingresos']['real_2026'] - datos_consolidados['total_gastos']['real_2026'],
        'ppto_2026': datos_consolidados['total_ingresos']['ppto_2026'] - datos_consolidados['total_gastos']['ppto_2026'],
        'real_2025': datos_consolidados['total_ingresos']['real_2025'] - datos_consolidados['total_gastos']['real_2025']
    }
  
    # Calcular resultado final
    datos_consolidados['resultado_final'] = {
        'real_2026': (datos_consolidados['resultado_operativo']['real_2026'] 
                      - datos_consolidados['gastos_fiscales']['real_2026']
                      + datos_consolidados['ingresos_extraordinarios']['real_2026']),
        'ppto_2026': (datos_consolidados['resultado_operativo']['ppto_2026'] 
                      - datos_consolidados['gastos_fiscales']['ppto_2026']
                      + datos_consolidados['ingresos_extraordinarios']['ppto_2026']),
        'real_2025': (datos_consolidados['resultado_operativo']['real_2025'] 
                      - datos_consolidados['gastos_fiscales']['real_2025']
                      + datos_consolidados['ingresos_extraordinarios']['real_2025'])
    }
  
    return datos_consolidados
```

### PASO 5: Calcular Variaciones Porcentuales

```python
def calcular_variaciones(datos):
    """
    Calcula las variaciones porcentuales para cada línea
    """
    for clave, valores in datos.items():
        # Variación Real 2026 vs Presupuesto 2026
        if valores['ppto_2026'] != 0:
            valores['var_ppto'] = (valores['real_2026'] / valores['ppto_2026']) - 1
        else:
            valores['var_ppto'] = 0
      
        # Variación Real 2026 vs Real 2025
        if valores['real_2025'] != 0:
            valores['var_2025'] = (valores['real_2026'] / valores['real_2025']) - 1
        else:
            valores['var_2025'] = 0
  
    return datos
```

### PASO 6: Escribir la Hoja Resumen

```python
def escribir_hoja_resumen(datos_consolidados, archivo_salida):
    """
    Escribe la hoja Resumen con la estructura completa
    """
    wb = openpyxl.Workbook()
    sheet = wb.active
    sheet.title = "RESUMEN"
  
    # Escribir encabezados
    sheet['A3'] = 'Descripción'
    sheet['B3'] = 'Código'
    sheet['C3'] = 'Real 2026'
    sheet['D3'] = 'Ppto. 2026'
    sheet['E3'] = 'Real 2025'
    sheet['F3'] = 'Variación Ppto. 2026 vs Real 2026'
    sheet['G3'] = 'Variación Real 2025 vs Real 2026'
  
    # Orden de escritura según la estructura del Resumen
    fila = 5
  
    # INGRESOS
    escribir_seccion_ingresos(sheet, datos_consolidados, fila)
  
    # GASTOS
    fila = 19  # Ajustar según estructura
    escribir_seccion_gastos(sheet, datos_consolidados, fila)
  
    # RESULTADO OPERATIVO
    fila = 38
    escribir_resultado_operativo(sheet, datos_consolidados, fila)
  
    # OTROS CONCEPTOS
    escribir_otros_conceptos(sheet, datos_consolidados, fila + 1)
  
    # RESULTADO FINAL
    escribir_resultado_final(sheet, datos_consolidados, fila + 5)
  
    wb.save(archivo_salida)
```

---

## Resumen de la Lógica

### Flujo Principal:

1. **Leer todas las hojas individuales** (RH, Eventos, Comités, etc.)
2. **Extraer códigos de cuenta** de la columna B de cada hoja
3. **Mapear cada código** a su categoría correspondiente en el Resumen usando el código base
4. **Consolidar valores mensuales** sumando columnas Real (D, F, H...) y Presupuesto (E, G, I...)
5. **Calcular subtotales** según la jerarquía definida
6. **Calcular variaciones porcentuales**
7. **Escribir la hoja Resumen** con la estructura completa

### Consideraciones Importantes:

* **Columnas pares (D, F, H, J, L, N, P, R, T, V, X, Z)** = Valores REALES por mes
* **Columnas impares (E, G, I, K, M, O, Q, S, U, W, Y, AA)** = Valores PRESUPUESTO por mes
* **Columna AB** = Total anual (suma de las 12 columnas pares)
* Los **códigos de cuenta** tienen estructura jerárquica: `XXX-XXX-XXX-XX`
  * Primer grupo (3 dígitos): Tipo de cuenta principal
  * Segundo grupo (3 dígitos): Subcategoría
  * Los dos primeros grupos definen la categoría en el Resumen

### Ventajas de esta Lógica:

1. **Escalable** : Fácil agregar nuevas categorías o departamentos
2. **Mantenible** : El mapeo está centralizado en un diccionario
3. **Flexible** : Permite cambiar la estructura jerárquica sin reescribir código
4. **Auditable** : Cada valor puede rastrearse hasta su origen en las hojas individuales
5. **Reutilizable** : La misma lógica aplica para otras sedes (Mex, NE, NO)
