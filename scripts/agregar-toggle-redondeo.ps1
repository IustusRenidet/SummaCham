# Script para agregar toggle de redondeo a todos los módulos
$modulos = @(
    @{Archivo='Finanzas.html'; Modulo='finanzas'},
    @{Archivo='Comités.html'; Modulo='comites'},
    @{Archivo='Comunicación.html'; Modulo='comunicacion'},
    @{Archivo='Eventos.html'; Modulo='eventos'},
    @{Archivo='Gtos_Corporativos.html'; Modulo='gtos-corporativos'},
    @{Archivo='Membresía.html'; Modulo='membresia'},
    @{Archivo='RH.html'; Modulo='rh'},
    @{Archivo='Serv_Membresía.html'; Modulo='serv-membresia'},
    @{Archivo='T&IC.html'; Modulo='tic'},
    @{Archivo='VPE.html'; Modulo='vpe'},
    @{Archivo='Dirección.html'; Modulo='direccion'}
)

foreach ($mod in $modulos) {
    $archivo = "vistas\$($mod.Archivo)"
    $moduloId = $mod.Modulo
    
    Write-Host "Procesando: $archivo" -ForegroundColor Yellow
    
    if (!(Test-Path $archivo)) {
        Write-Host "  ✗ Archivo no encontrado" -ForegroundColor Red
        continue
    }
    
    $contenido = Get-Content $archivo -Raw -Encoding UTF8
    
    # 1. Agregar el script de toggle-redondeo.js si no existe
    if ($contenido -notmatch 'toggle-redondeo\.js') {
        $contenido = $contenido -replace '(<script src="js/cuentas-modulo\.js"></script>)', "`$1`n  <script src=""js/toggle-redondeo.js""></script>"
        Write-Host "  ✓ Script agregado" -ForegroundColor Green
    }
    
    # 2. Agregar clase controls-container al workflow-toolbar
    if ($contenido -match '<div class="workflow-toolbar">' -and $contenido -notmatch 'controls-container') {
        $contenido = $contenido -replace '<div class="workflow-toolbar">', '<div class="workflow-toolbar controls-container">'
        Write-Host "  ✓ Clase agregada" -ForegroundColor Green
    }
    
    # 3. Agregar inicialización del toggle si no existe
    if ($contenido -notmatch 'ToggleRedondeo\.inicializar') {
        # Buscar el script de inicialización del módulo
        $pattern = "(initModuloPlaneacion\(\{ moduloId: '$moduloId'[^}]+\}\);)"
        if ($contenido -match $pattern) {
            $init = @"
`n    // Inicializar toggle de redondeo
    if (window.ToggleRedondeo) {
      ToggleRedondeo.inicializar({
        containerSelector: '.controls-container',
        tableSelector: '#mainTable tbody',
        storageKey: '$($moduloId)_redondear_numeros'
      });
    }
"@
            $contenido = $contenido -replace $pattern, "`$1$init"
            Write-Host "  ✓ Inicialización agregada" -ForegroundColor Green
        }
    }
    
    # Guardar archivo
    $contenido | Set-Content $archivo -Encoding UTF8 -NoNewline
    Write-Host "  ✓ Guardado exitosamente`n" -ForegroundColor Cyan
}

Write-Host "`n✅ Proceso completado" -ForegroundColor Green
