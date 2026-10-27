#!/bin/sh
# คำอธิบายสำหรับผู้เริ่มต้น
# ภาพรวมไฟล์: สร้างไฟล์ .env บน VPS ครั้งแรก โดยสุ่มรหัสผ่านฐานข้อมูลและ JOB_SECRET ให้ ไม่ต้องพิมพ์ความลับเอง
# การทำงาน: รันในโฟลเดอร์ ~/nestly บน VPS ถ้ามี .env อยู่แล้วจะหยุดทันที เพื่อไม่ให้รหัสผ่านฐานข้อมูลเดิมถูกเขียนทับ
# วิธีใช้: sh make-env.sh ghcr.io/<username>/<repo> [https://โดเมนของแอป]

set -e

if [ -z "$1" ]; then
  echo "วิธีใช้: sh make-env.sh ghcr.io/<username>/<repo> [https://โดเมนของแอป]"
  exit 1
fi

if [ -f .env ]; then
  echo "มีไฟล์ .env อยู่แล้ว — ไม่เขียนทับ (ถ้าต้องการสร้างใหม่ ให้ลบ .env ก่อน)"
  exit 1
fi

# ชื่อ image บน GHCR ต้องเป็นตัวพิมพ์เล็กทั้งหมด
IMAGE=$(echo "$1" | tr '[:upper:]' '[:lower:]')
APP_URL=${2:-https://nestlyspace.tech}
APP_HOST=$(echo "$APP_URL" | sed -E 's#^https?://##; s#/.*$##; s#^www\.##')

# umask ทำให้ไฟล์ถูกสร้างมาแบบอ่านได้เฉพาะเจ้าของตั้งแต่แรก ไม่มีช่วงที่คนอื่นอ่านได้
umask 077
cat > .env <<ENV
POSTGRES_PASSWORD=$(openssl rand -hex 24)
JOB_SECRET=$(openssl rand -hex 32)
APP_PORT=127.0.0.1:3000
APP_IMAGE=$IMAGE:latest
MIGRATOR_IMAGE=$IMAGE-migrator:latest
APP_URL=$APP_URL
# ใส่ API key จาก resend.com เองหลังยืนยันโดเมนแล้ว (แก้ด้วย nano .env)
RESEND_API_KEY=
PASSWORD_RESET_EMAIL_FROM=no-reply@$APP_HOST
ENV

echo "สร้าง .env แล้ว (image: $IMAGE, url: $APP_URL)"
echo "อย่าลืมใส่ RESEND_API_KEY ใน .env ก่อนใช้ฟีเจอร์รีเซ็ตรหัสผ่าน"
