@echo off
setlocal
python -m pip install --upgrade pyinstaller
pyinstaller --clean --noconfirm tools\telemetry_generator.spec
echo.
echo Built dist\EVA-Telemetry-Simulator.exe
pause
