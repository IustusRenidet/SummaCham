from __future__ import annotations

import json
from pathlib import Path

import openpyxl


ROOT = Path(__file__).resolve().parents[1]
EXCEL_PATH = ROOT / 'info IMPORTANTE' / 'CUENTAS RESUMEN.xlsx'
DESTINO = ROOT / 'vistas' / 'js' / 'resumen-data.js'
AGG_INDICES = [4, 6, 8, 10, 12, 14, 16, 18]


def to_text(value):
    if value is None:
        return ''
    return str(value).strip()


def tipo_desde_clase(clase):
    texto = to_text(clase)
    if not texto:
        return ''
    if '-' not in texto:
        return texto.upper()
    return texto.split('-', 1)[0].strip().upper()


def formatear_seccion(base, tipo):
    nombre = to_text(base)
    etiqueta = to_text(tipo).upper()
    if not nombre:
        return etiqueta or ''
    if etiqueta:
        return f'{nombre} ({etiqueta})'
    return nombre


def extraer_cuentas(libro):
    registros = []
    for nombre_hoja in libro.sheetnames:
        if nombre_hoja == 'Filas SUMAS':
            continue
        capitulo = nombre_hoja.replace('Resumen ', '').strip()
        if not capitulo:
            continue
        hoja = libro[nombre_hoja]
        cabecera = True
        for fila in hoja.iter_rows(values_only=True):
            if not fila or not fila[0]:
                cabecera = False
                continue
            cuenta = to_text(fila[0])
            if not cuenta:
                continue
            if cabecera and cuenta.lower().startswith('cuenta'):
                cabecera = False
                continue
            cabecera = False
            descripcion = to_text(fila[1])
            seccion_detallada = to_text(fila[2] if len(fila) > 2 else '')
            seccion_mayor = to_text(fila[3] if len(fila) > 3 else '')
            seccion = formatear_seccion(seccion_detallada or seccion_mayor, seccion_mayor)
            if not seccion:
                continue
            registros.append({
                'capitulo': capitulo,
                'seccion': seccion,
                'cuenta': cuenta,
                'nombre': descripcion
            })
    return registros


def extraer_sumas(libro):
    if 'Filas SUMAS' not in libro.sheetnames:
        return {}
    hoja = libro['Filas SUMAS']
    sumas = {}
    primera = True
    for fila in hoja.iter_rows(values_only=True):
        if primera:
            primera = False
            continue
        if not fila:
            continue
        capitulo = to_text(fila[0])
        seccion = to_text(fila[2])
        if not capitulo or not seccion:
            continue
        etiquetas = []
        for idx in AGG_INDICES:
            if idx >= len(fila):
                continue
            valor = fila[idx]
            if valor is None:
                continue
            texto = to_text(valor)
            if texto:
                etiquetas.append(texto)
        sumRowSumavarios = etiquetas[0] if etiquetas else ''
        sumRowSumavarios2 = etiquetas[1] if len(etiquetas) > 1 else ''
        resultRows = etiquetas[2:]
        clase = to_text(fila[1])
        tipo = tipo_desde_clase(clase)
        seccion_label = formatear_seccion(seccion, tipo)
        if not seccion_label:
            continue
        sumas.setdefault(capitulo, {})[seccion_label] = {
            'sumRow': '',
            'sumRowSumavarios': sumRowSumavarios,
            'sumRowSumavarios2': sumRowSumavarios2,
            'resultRows': [texto for texto in resultRows if texto]
        }
    return sumas


def main():
    libro = openpyxl.load_workbook(EXCEL_PATH, data_only=True)
    cuentas = extraer_cuentas(libro)
    sumas = extraer_sumas(libro)
    resumen_data = {'cuentas': cuentas, 'sumas': sumas}
    contenido = (
        '// Generado automaticamente desde info IMPORTANTE/CUENTAS RESUMEN.xlsx\n'
        '(function () {\n'
        f'  const resumenData = {json.dumps(resumen_data, ensure_ascii=False, indent=2)};\n'
        '  window.CUENTAS_POR_MODULO = window.CUENTAS_POR_MODULO || {};\n'
        "  window.CUENTAS_POR_MODULO['resumen'] = resumenData.cuentas;\n"
        '  window.CUENTAS_SUMAS = window.CUENTAS_SUMAS || {};\n'
        "  window.CUENTAS_SUMAS['RESUMEN'] = resumenData.sumas;\n"
        '})();\n'
    )
    DESTINO.write_text(contenido, encoding='utf-8')
    print(f'Archivo actualizado: {DESTINO}')


if __name__ == '__main__':
    main()
