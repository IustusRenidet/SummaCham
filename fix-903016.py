import sqlite3

db = sqlite3.connect('datos/panel.sqlite')

# 1. Eliminar 903-016 de GUADALAJARA RESUMEN (causa EXPENSE 2025 incorrecto)
deleted_gdl = db.execute(
    "DELETE FROM layout_cuentas WHERE empresa_id='EMPRESA02' AND modulo='RESUMEN' AND capitulo='GUADALAJARA' AND cuenta='903016000000000000000'"
).rowcount
print(f"GUADALAJARA 903016 deleted: {deleted_gdl} rows")

# 2. Ver y deduplicar NORESTE Cargos Administrativos
noreste_rows = db.execute(
    "SELECT rowid, empresa_id, modulo, anio, capitulo, cuenta, seccion_principal, seccion_secundaria FROM layout_cuentas WHERE empresa_id='EMPRESA02' AND modulo='RESUMEN' AND capitulo='NORESTE' AND seccion_secundaria='Cargos Administrativos'"
).fetchall()
print(f"\nNORESTECargos Administrativos rows ({len(noreste_rows)}):")
for r in noreste_rows:
    print(r)

# 3. Ver y deduplicar NOROESTE Cargos Administrativos
noroeste_rows = db.execute(
    "SELECT rowid, empresa_id, modulo, anio, capitulo, cuenta, seccion_principal, seccion_secundaria FROM layout_cuentas WHERE empresa_id='EMPRESA02' AND modulo='RESUMEN' AND capitulo='NOROESTE' AND seccion_secundaria='Cargos Administrativos'"
).fetchall()
print(f"\nNOROESTECargos Administrativos rows ({len(noroeste_rows)}):")
for r in noroeste_rows:
    print(r)

# Deduplicar NORESTE (mantener rowid mas alto)
if len(noreste_rows) > 1:
    keep_rowid = max(r[0] for r in noreste_rows)
    del_rowids = [r[0] for r in noreste_rows if r[0] != keep_rowid]
    for rid in del_rowids:
        db.execute(f"DELETE FROM layout_cuentas WHERE rowid={rid}")
    print(f"NORESTE deduplicados: eliminados {len(del_rowids)} filas, mantenido rowid={keep_rowid}")

# Deduplicar NOROESTE (mantener rowid mas alto)
if len(noroeste_rows) > 1:
    keep_rowid = max(r[0] for r in noroeste_rows)
    del_rowids = [r[0] for r in noroeste_rows if r[0] != keep_rowid]
    for rid in del_rowids:
        db.execute(f"DELETE FROM layout_cuentas WHERE rowid={rid}")
    print(f"NOROESTE deduplicados: eliminados {len(del_rowids)} filas, mantenido rowid={keep_rowid}")

db.commit()
print("\nDB fix completado y guardado.")
db.close()
