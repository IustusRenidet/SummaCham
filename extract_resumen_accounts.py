import pandas as pd
import sys

# Leer Excel
excel_path = r'info IMPORTANTE\CUENTAS RESUMEN.xlsx'
output_csv = r'info IMPORTANTE\Resumen Guadalajara.csv'

try:
    # Leer hoja "Resumen GUADALAJARA"
    df = pd.read_excel(excel_path, sheet_name='Resumen GUADALAJARA', header=0)
    
    # Limpiar nombres de columnas
    df.columns = df.columns.str.strip()
    
    # Mostrar columnas disponibles
    print("Columnas encontradas:")
    print(df.columns.tolist())
    print("\nPrimeras filas:")
    print(df.head(10))
    
    # Intentar identificar las columnas correctas
    # Buscar columnas que contengan "cuenta", "descripcion", "grupo", "headrow", etc.
    cuenta_col = None
    desc_col = None
    grupo_col = None
    
    for col in df.columns:
        col_lower = str(col).lower()
        if 'cuenta' in col_lower or 'codigo' in col_lower:
            cuenta_col = col
        elif 'descripcion' in col_lower or 'nombre' in col_lower or 'desc' in col_lower:
            desc_col = col
        elif 'grupo' in col_lower or 'headrow' in col_lower or 'categoria' in col_lower:
            grupo_col = col
    
    print(f"\nColumna cuenta: {cuenta_col}")
    print(f"Columna descripción: {desc_col}")
    print(f"Columna grupo: {grupo_col}")
    
    if cuenta_col and desc_col:
        # Crear DataFrame con estructura correcta
        output_df = pd.DataFrame()
        output_df['CUENTA'] = df[cuenta_col].astype(str).str.strip()
        output_df['DESCRIPCION'] = df[desc_col].astype(str).str.strip()
        if grupo_col:
            output_df['GRUPO'] = df[grupo_col].astype(str).str.strip()
        else:
            output_df['GRUPO'] = 'GENERAL'
        
        # Filtrar filas vacías
        output_df = output_df[output_df['CUENTA'].notna() & (output_df['CUENTA'] != '') & (output_df['CUENTA'] != 'nan')]
        
        # Guardar CSV
        output_df.to_csv(output_csv, index=False, encoding='utf-8')
        print(f"\n✅ CSV generado exitosamente: {output_csv}")
        print(f"Total de cuentas: {len(output_df)}")
        print("\nPrimeras 10 cuentas:")
        print(output_df.head(10).to_string())
    else:
        print("❌ No se pudieron identificar las columnas necesarias")
        sys.exit(1)
        
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
