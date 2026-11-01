#!/usr/bin/env bash
# เปิดเว็บสำหรับทดสอบที่พอร์ต 3400 ด้วยค่าใน robot.env (ใช้ฐานข้อมูลเดียวกับที่ prepare.sh เตรียมไว้)
#
#   DATABASE_URL="postgresql://.../nestly_robot_test" robot-tests/start-app.sh
set -euo pipefail
cd "$(dirname "$0")/.."
: "${DATABASE_URL:?ต้องส่ง DATABASE_URL ของฐานข้อมูลทดสอบมาด้วย}"
set -a
# shellcheck disable=SC1091
. robot-tests/robot.env
set +a
exec npx next dev --hostname 127.0.0.1 --port "${ROBOT_APP_PORT:-3400}"
