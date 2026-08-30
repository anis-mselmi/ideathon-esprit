#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_dir"

if ! python3 -c 'import tkinter' >/dev/null 2>&1; then
  echo "Tkinter is missing. Install it with: sudo apt install python3-tk"
  exit 1
fi

venv_dir="$project_dir/.telemetry-venv"
if [ ! -x "$venv_dir/bin/python" ]; then
  python3 -m venv "$venv_dir"
fi
"$venv_dir/bin/python" -m pip install --upgrade pip pyinstaller
"$venv_dir/bin/python" -m PyInstaller --clean --noconfirm --onefile --windowed \
  --name EVA-Telemetry-Simulator tools/telemetry_generator.py

launcher="$HOME/.local/share/applications/eva-telemetry-simulator.desktop"
mkdir -p "$(dirname "$launcher")"
cat > "$launcher" <<EOF
[Desktop Entry]
Type=Application
Name=EVA Telemetry Simulator
Comment=Send synthetic telemetry to the EVA platform
Exec=$project_dir/dist/EVA-Telemetry-Simulator
Icon=utilities-system-monitor
Terminal=false
Categories=Development;Utility;
EOF
chmod +x "$launcher" "$project_dir/dist/EVA-Telemetry-Simulator"
echo "Built: $project_dir/dist/EVA-Telemetry-Simulator"
echo "Launcher: $launcher"
