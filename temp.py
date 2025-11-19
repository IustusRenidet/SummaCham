from pathlib import Path
text = Path('vistas/Comités.html').read_text(encoding='utf-8', errors='ignore')
start = text.index('data-modulo') - 20
print(repr(text[start:start+60]))
