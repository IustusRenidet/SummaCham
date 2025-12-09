#!/usr/bin/env python3
"""
Script para actualizar seed_users.json basándose en Configuración ICONET.json
"""

import json
import os

# Cargar la configuración de ICONET
config_path = r"C:\Users\Frida Sophia\Downloads\Configuración ICONET.json"
with open(config_path, 'r', encoding='utf-8') as f:
    iconet_config = json.load(f)

# Mapeo de módulos del Excel a los nombres en la BD
MODULO_MAP = {
    "Membresía": "Membresía",
    "Eventos": "Eventos",
    "Comunicación": "Comunicación",
    "Serv Membresía": "Serv_Membresía",
    "Comités": "Comités",
    "T&IC": "T&IC",
    "RH": "RH",
    "VPE": "VPE",
    "Dirección": "Dirección",
    "Finanzas": "Finanzas",
    "Gtos Corporativos": "Gtos_Corporativos"
}

# Mapeo de empresas
EMPRESA_MAP = {
    "Mex": "empresa1",
    "Gdl": "empresa2",
    "NE": "empresa3",
    "NO": "empresa4"
}

def parse_iconet_config(config_data):
    """Parsea la configuración de ICONET y extrae permisos por usuario"""
    
    usuarios = {}
    
    # Procesar hoja LT (permisos normales)
    lt_data = config_data.get("LT", [])
    
    current_empresa = None
    
    for row in lt_data[1:]:  # Skip header
        archivo = row.get("Empresa 1", "")
        
        # Detectar cambio de empresa
        if archivo == "Empresa 2":
            current_empresa = "empresa2"
            continue
        elif archivo == "Empresa 3":
            current_empresa = "empresa3"
            continue
        elif archivo == "Empresa 4":
            current_empresa = "empresa4"
            continue
        elif not archivo or not archivo.endswith("2026"):
            continue
        
        # Determinar empresa si aún no se detectó
        if current_empresa is None:
            if archivo.startswith("Mex"):
                current_empresa = "empresa1"
            elif archivo.startswith("Gdl"):
                current_empresa = "empresa2"
            elif archivo.startswith("NE"):
                current_empresa = "empresa3"
            elif archivo.startswith("NO"):
                current_empresa = "empresa4"
        
        # Extraer módulo
        partes = archivo.split()
        if len(partes) < 2:
            continue
        
        modulo_raw = " ".join(partes[1:-1])  # Quitar prefijo (Mex/Gdl/etc) y año
        modulo = MODULO_MAP.get(modulo_raw)
        
        if not modulo or not current_empresa:
            continue
        
        # Extraer usuarios con roles
        carga_guarda = row.get("Column2")  # CARGA Y GUARDA
        finanzas = row.get("Column3")      # Siempre FINANZAS
        revisor = row.get("Column4")       # REVISA
        aprobador1 = row.get("Column5")    # APRUEBA 1
        aprobador2 = row.get("Column6")    # APRUEBA 2
        aprobador3 = row.get("Column7")    # APRUEBA 3
        
        # Agregar permiso de CARGA Y GUARDA
        if carga_guarda and carga_guarda not in ["FINANZAS", "ARCHIVO"]:
            if carga_guarda not in usuarios:
                usuarios[carga_guarda] = {}
            if current_empresa not in usuarios[carga_guarda]:
                usuarios[carga_guarda][current_empresa] = {}
            usuarios[carga_guarda][current_empresa][modulo] = {
                "puede_leer": 1,
                "puede_cargar_guardar": 1,
                "puede_revisar": 0,
                "puede_aprobar": 0
            }
        
        # Agregar permiso de REVISAR
        if revisor and revisor not in ["FINANZAS", "ARCHIVO"] and revisor != carga_guarda:
            if revisor not in usuarios:
                usuarios[revisor] = {}
            if current_empresa not in usuarios[revisor]:
                usuarios[revisor][current_empresa] = {}
            usuarios[revisor][current_empresa][modulo] = {
                "puede_leer": 1,
                "puede_cargar_guardar": 0,
                "puede_revisar": 1,
                "puede_aprobar": 0
            }
        
        # Agregar permisos de APROBAR
        for aprobador in [aprobador1, aprobador2, aprobador3]:
            if aprobador and aprobador not in ["FINANZAS", "ARCHIVO"]:
                if aprobador not in usuarios:
                    usuarios[aprobador] = {}
                if current_empresa not in usuarios[aprobador]:
                    usuarios[aprobador][current_empresa] = {}
                
                # Si ya tiene permiso de revisar, mantenerlo
                if modulo in usuarios[aprobador][current_empresa]:
                    usuarios[aprobador][current_empresa][modulo]["puede_aprobar"] = 1
                else:
                    usuarios[aprobador][current_empresa][modulo] = {
                        "puede_leer": 1,
                        "puede_cargar_guardar": 0,
                        "puede_revisar": 0,
                        "puede_aprobar": 1
                    }
    
    return usuarios

def generate_seed_users(usuarios_permisos, directorio_info):
    """Genera el array de usuarios con sus permisos"""
    
    seed_users = []
    
    for username, empresas in usuarios_permisos.items():
        if username == "XX":  # Skip placeholder users
            continue
            
        # Buscar info del directorio
        user_info = directorio_info.get(username, {})
        
        permissions = []
        for empresa_id, modulos in empresas.items():
            for modulo, permisos in modulos.items():
                permissions.append({
                    "empresaId": empresa_id,
                    "modulo": modulo,
                    **permisos
                })
        
        # Ordenar permisos por empresa y módulo
        permissions.sort(key=lambda p: (p["empresaId"], p["modulo"]))
        
        seed_users.append({
            "username": username,
            "nombres": user_info.get("nombres", username),
            "apellidoPrimero": user_info.get("apellido", username),
            "correo": user_info.get("correo", ""),
            "permissions": permissions
        })
    
    return sorted(seed_users, key=lambda u: u["username"])

# Extraer información del directorio
directorio = {}
lt_data = iconet_config.get("LT", [])
for row in lt_data:
    siglas = row.get("Column11")
    if siglas and siglas != "SIGLAS":
        directorio[siglas] = {
            "nombres": row.get("Directorio", "").split()[0] if row.get("Directorio") else siglas,
            "apellido": " ".join(row.get("Directorio", "").split()[1:]) if row.get("Directorio") and len(row.get("Directorio", "").split()) > 1 else siglas,
            "correo": row.get("Column12", "")
        }

# Parsear permisos
print("Parseando configuración de ICONET...")
usuarios_permisos = parse_iconet_config(iconet_config)

print(f"Usuarios encontrados: {len(usuarios_permisos)}")
for user in sorted(usuarios_permisos.keys()):
    empresas_count = len(usuarios_permisos[user])
    print(f"  {user}: {empresas_count} empresas")

# Generar seed_users
print("\nGenerando seed_users.json...")
seed_users = generate_seed_users(usuarios_permisos, directorio)

# Guardar
output_path = r"C:\Users\Frida Sophia\Desktop\DESARROLLOS\SummaCham\src\config\seed_users.json"
with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(seed_users, f, indent=2, ensure_ascii=False)

print(f"\n✅ Archivo actualizado: {output_path}")
print(f"Total de usuarios: {len(seed_users)}")

# Mostrar resumen por empresa
print("\nResumen por empresa:")
for empresa_id in ["empresa1", "empresa2", "empresa3", "empresa4"]:
    count = sum(1 for user in seed_users if any(p["empresaId"] == empresa_id for p in user["permissions"]))
    print(f"  {empresa_id}: {count} usuarios")
