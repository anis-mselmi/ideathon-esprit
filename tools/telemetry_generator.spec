# Build on Windows with: pyinstaller tools/telemetry_generator.spec
from PyInstaller.utils.hooks import collect_submodules

a = Analysis(
    ['telemetry_generator.py'],
    pathex=['.'],
    binaries=[],
    datas=[],
    hiddenimports=collect_submodules('tkinter'),
    noarchive=False,
)
pyz = PYZ(a.pure)
exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='EVA-Telemetry-Simulator',
    debug=False,
    strip=False,
    upx=True,
    console=False,
)
