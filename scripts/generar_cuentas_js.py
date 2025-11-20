from __future__ import annotations

import json
from pathlib import Path
import unicodedata

import openpyxl


ROOT = Path(__file__).resolve().parents[1]
EXCEL_PATH = ROOT / 'info IMPORTANTE' / 'CUENTAS.xlsx'
DESTINO = ROOT / 'vistas' / 'js' / 'cuentas-data.js'
HOJA_SUMAS = 'SUMA DE VARIAS SECCIONES'


def normalizar(texto):
  valor = (texto or '').strip()
  if not valor:
    return ''
  nfkd = unicodedata.normalize('NFD', valor)
  limpio = ''.join(ch for ch in nfkd if unicodedata.category(ch) != 'Mn')
  return limpio.upper()


def normalizar_hoja(texto):
  limpio = normalizar(texto)
  return ''.join(ch for ch in limpio if ch not in {'.', ' ', '_'})


def extraer_registros(libro):
  datos = {}
  for hoja in libro.worksheets:
    if hoja.title == HOJA_SUMAS:
      continue
    registros = []
    for fila in hoja.iter_rows(values_only=True):
      if not fila:
        continue
      capitulo, seccion, cuenta, nombre = (fila + (None, None, None, None))[:4]
      if capitulo == 'CAPITULO' or not (capitulo and cuenta):
        continue
      registros.append({
        'capitulo': str(capitulo).strip(),
        'seccion': str(seccion or '').strip(),
        'cuenta': str(cuenta or '').strip(),
        'nombre': str(nombre or '').strip()
      })
    datos[hoja.title] = registros
  return datos


def extraer_sumas(libro):
  hoja = libro[HOJA_SUMAS]
  sumas = {}
  encabezado = True
  for fila in hoja.iter_rows(values_only=True):
    if encabezado:
      encabezado = False
      continue
    if not fila:
      continue
    hoja_id, capitulo, seccion, sum_row, sum_row_suma, sum_row_suma2, result_row = (fila + (None,) * 7)[:7]
    if not hoja_id or not capitulo or not seccion:
      continue
    hoja_key = normalizar_hoja(str(hoja_id))
    cap_key = normalizar(capitulo)
    sec_key = normalizar(seccion)
    sumas.setdefault(hoja_key, {}).setdefault(cap_key, {})[sec_key] = {
      'sumRow': (sum_row or '').strip(),
      'sumRowSumavarios': (sum_row_suma or '').strip(),
      'sumRowSumavarios2': (sum_row_suma2 or '').strip(),
      'resultRow': (result_row or '').strip()
    }
  return sumas


def main():
  libro = openpyxl.load_workbook(EXCEL_PATH, data_only=True)
  registros = extraer_registros(libro)
  sumas = extraer_sumas(libro)
  contenido = (
    '// Generado automaticamente desde info IMPORTANTE/CUENTAS.xlsx\n'
    f'window.CUENTAS_POR_MODULO = {json.dumps(registros, ensure_ascii=True, separators=(",", ":"))};\n'
    f'window.CUENTAS_SUMAS = {json.dumps(sumas, ensure_ascii=True, separators=(",", ":"))};\n'
  )
  DESTINO.write_text(contenido, encoding='utf-8')
  print(f'Archivo actualizado: {DESTINO}')


if __name__ == '__main__':
  main()
