#!/bin/sh
# คำอธิบายสำหรับผู้เริ่มต้น
# ภาพรวมไฟล์: สำรองฐานข้อมูลและไฟล์อัปโหลดของ Nestly บน VPS เก็บไว้ 14 วัน
# การทำงาน: dump ฐานข้อมูลจาก container postgres เป็นไฟล์ .dump และบีบอัด volume ไฟล์อัปโหลดเป็น .tgz
#           ไว้ที่ /home/deploy/nestly/backups แล้วลบไฟล์ที่เก่ากว่า 14 วัน
# ติดตั้ง: copy ไปไว้ที่ /home/deploy/nestly/backup.sh, chmod 700 แล้วตั้ง crontab ของ user deploy
#          0 20 * * * /home/deploy/nestly/backup.sh >> /home/deploy/nestly/backups/backup.log 2>&1
#          (VPS ใช้เวลา UTC, 20:00 UTC = 03:00 ตามเวลาไทย)

set -e
cd /home/deploy/nestly
mkdir -p backups
docker compose exec -T postgres pg_dump -U dorm_app -Fc dorm > backups/db-$(date +%F).dump
docker run --rm -v nestly_app_storage:/data:ro -v /home/deploy/nestly/backups:/backup alpine:3.22 tar czf /backup/storage-$(date +%F).tgz -C /data .
find backups -name "db-*.dump" -mtime +14 -delete
find backups -name "storage-*.tgz" -mtime +14 -delete
echo "$(date -Is) backup ok"
