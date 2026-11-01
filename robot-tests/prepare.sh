#!/usr/bin/env bash
# เตรียมฐานข้อมูลทดสอบให้ Robot Framework: ย้าย schema สร้างบัญชีทดสอบ และใส่ข้อมูลเดโม
#
#   DATABASE_URL="postgresql://user:pass@127.0.0.1:55432/nestly_robot_test" robot-tests/prepare.sh
#
# สคริปต์ seed เขียนทับบัญชีทดสอบและข้อมูลเดโม จึงยอมรันเฉพาะฐานที่ชื่อมีคำว่า test
# อยากเริ่มจากศูนย์ทุกรอบให้ลบแล้วสร้างฐานข้อมูลทดสอบใหม่เองก่อนรัน
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ต้องส่ง DATABASE_URL ของฐานข้อมูลทดสอบมาด้วย" >&2
  exit 1
fi
database_name="${DATABASE_URL##*/}"
database_name="${database_name%%\?*}"
if [[ "$database_name" != *test* ]]; then
  echo "ฐานข้อมูล '$database_name' ไม่มีคำว่า test ในชื่อ ไม่ยอมเขียนข้อมูลทดสอบลงไป" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
. robot-tests/robot.env
set +a

npx prisma migrate deploy >/dev/null
npm run --silent admin:bootstrap
npm run --silent seed:demo >/dev/null
echo "ฐานข้อมูลทดสอบ $database_name พร้อมแล้ว"
