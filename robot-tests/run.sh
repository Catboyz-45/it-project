#!/usr/bin/env bash
# รัน Robot Framework ทุกชุด แล้วสร้างไฟล์สรุปผล Excel
#
#   robot-tests/run.sh                       # รันทุกชุด
#   robot-tests/run.sh suites/03_tenant.robot  # รันเฉพาะชุดที่ระบุ
#
# ต้องเปิดเว็บทดสอบไว้ก่อน (start-app.sh) และตั้ง ROBOT_PYTHON ถ้า venv ไม่ได้อยู่ที่ ~/.venvs/nestly-robot
set -uo pipefail
cd "$(dirname "$0")"
venv_bin="${ROBOT_VENV:-$HOME/.venvs/nestly-robot}/bin"

if ! curl -sf "http://localhost:${ROBOT_APP_PORT:-3400}/api/health" >/dev/null; then
  echo "เว็บทดสอบยังไม่เปิดที่พอร์ต ${ROBOT_APP_PORT:-3400} ให้รัน start-app.sh ก่อน" >&2
  exit 1
fi

rm -rf results
if [[ $# -gt 0 ]]; then suites=("$@"); else suites=(suites); fi
"$venv_bin/robot" --outputdir results --name "Nestly" --consolewidth 110 "${suites[@]}"
status=$?
"$venv_bin/python" build_report.py
exit $status
