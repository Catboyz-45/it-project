# คู่มือติดตั้งและปฏิบัติการ Production

## ข้อกำหนดก่อนติดตั้ง

- เครื่อง Linux ที่มี Docker Engine และ Docker Compose v2
- PostgreSQL และ S3-compatible storage ที่มี backup แยกจาก application
- HTTPS reverse proxy/load balancer และโดเมนที่บริษัทควบคุม
- Secret manager สำหรับค่าจาก `.env.example` ห้ามเก็บ `.env` ใน Git

## ขั้นตอนปล่อยระบบ

1. สำรองฐานข้อมูลและทดสอบ restore ล่าสุด
2. สร้าง image จาก commit/tag ที่ผ่าน GitHub Actions โดย public URL และ S3 origin เป็น build-time configuration:

```bash
docker build \
  --build-arg NEXT_PUBLIC_SITE_URL=https://www.example.co.th \
  --build-arg S3_ENDPOINT=https://storage.example.co.th \
  -t yuyen:<tag> .
```

3. ตรวจ migration: `docker compose run --rm ops db:migrate:status`
4. Apply migration หนึ่งครั้งจาก release job: `docker compose run --rm ops db:migrate:deploy`
5. เริ่ม application: `docker compose up -d app`
6. ตรวจ `/api/health/live` และ `/api/health/ready` ต้องตอบ HTTP 200
7. Smoke test หน้าแรก, login, CMS, รูปภาพ และ audit log ก่อนสลับ traffic

ห้ามใช้ `prisma migrate dev`, `prisma db push` หรือ development seed ใน production

## Reverse proxy และ IP สำหรับ Rate Limit

ค่าเริ่มต้น `AUTH_TRUSTED_PROXY_HOPS=0` จะไม่เชื่อ `X-Forwarded-For` ที่ผู้ใช้ส่งมา
และรวมคำขอที่ระบุ IP ไม่ได้ไว้ใน bucket แบบ fail-closed เดียวกัน ก่อนเปิดใช้ต้องยืนยัน
เส้นทางเครือข่ายจริงและให้ reverse proxy/load balancer เขียนทับหรือ append header อย่าง
ถูกต้อง แล้วตั้งเป็นจำนวน proxy ที่บริษัทควบคุมระหว่างผู้ใช้กับแอป เช่น:

```dotenv
# ผู้ใช้ -> reverse proxy ที่ควบคุม -> application
AUTH_TRUSTED_PROXY_HOPS="1"
```

หากมี CDN และ reverse proxy ที่ควบคุมสองชั้นให้ใช้ `2` ระบบเลือก address จากด้านขวา
ของ chain ตามจำนวนดังกล่าว จึงไม่ใช้ค่าปลอมที่ผู้ใช้เติมทางซ้าย ห้ามคัดลอกค่า `1`
ไป Production โดยไม่ตรวจ topology และควรทดสอบ login rate limit จากภายนอกหลัง deploy
ทุกครั้ง หาก proxy ส่งรูปแบบอื่นให้คงค่า `0` จนกว่าจะเพิ่ม adapter สำหรับ provider นั้น
โดยเฉพาะ

## Bootstrap Super Admin

กำหนด `BOOTSTRAP_ADMIN_USERNAME`, `BOOTSTRAP_ADMIN_PASSWORD` อย่างน้อย 12 ตัวอักษร และ `BOOTSTRAP_ADMIN_DISPLAY_NAME` ผ่าน secret ชั่วคราว แล้วรัน:

```bash
docker compose run --rm ops auth:bootstrap
```

คำสั่งเป็น idempotent และจะไม่แก้บัญชีที่มีอยู่ ลบ secret ชั่วคราวทันทีหลังสร้างบัญชี จากนั้นเจ้าของต้อง login เพื่อเปลี่ยนรหัสผ่านและตั้ง TOTP

## หมุนคีย์เข้ารหัส TOTP

`TOTP_ENCRYPTION_KEY` คือคีย์เดิมเวอร์ชัน 1 และต้องเก็บไว้ระหว่างการย้าย กำหนด keyring ผ่าน secret manager แล้วเลือกเวอร์ชันปัจจุบัน เช่น:

```dotenv
TOTP_ENCRYPTION_KEY="<base64-key-version-1>"
TOTP_ENCRYPTION_KEYS='{"1":"<base64-key-version-1>","2":"<base64-key-version-2>"}'
TOTP_ENCRYPTION_CURRENT_VERSION="2"
```

คีย์แต่ละตัวต้องเป็นข้อมูลสุ่ม 32 ไบต์ในรูป Base64 เมื่อผู้ดูแลยืนยัน TOTP หรือเข้าหน้าตั้งค่า 2FA ระบบจะถอดรหัสด้วย `totpKeyVersion` เดิมและเข้ารหัสใหม่ด้วยคีย์ปัจจุบันโดยอัตโนมัติ Google Authenticator และ Recovery Codes จึงไม่เปลี่ยน

1. สำรองฐานข้อมูลและทดสอบ restore
2. เพิ่มคีย์ใหม่ใน keyring โดยห้ามลบคีย์เก่า
3. เปลี่ยน `TOTP_ENCRYPTION_CURRENT_VERSION` แล้ว deploy
4. ตรวจการย้ายด้วยคำสั่งอ่านอย่างเดียว:

```sql
SELECT "totpKeyVersion", COUNT(*)
FROM "Admin"
WHERE "totpSecretEncrypted" IS NOT NULL
GROUP BY "totpKeyVersion";
```

5. เก็บคีย์เก่าไว้จนบัญชีเวอร์ชันนั้นเป็นศูนย์ และ backup ที่อาจต้องใช้คีย์เก่าหมดอายุตาม retention แล้ว จึงนำคีย์เก่าออก

หากไม่มีคีย์ตรงกับ `totpKeyVersion` ระบบจะปฏิเสธการถอดรหัส ห้ามแก้หมายเลขเวอร์ชันในฐานข้อมูลหรือทิ้งคีย์เก่าก่อนย้ายเสร็จ

## Backup และ restore

สำรองฐานข้อมูลแบบ encrypted อย่างน้อยรายวัน และเก็บหลายตำแหน่งตามนโยบายบริษัท:

```bash
pg_dump --format=custom --no-owner --no-acl "$DATABASE_URL" > yuyen-$(date +%F).dump
createdb yuyen_restore_test
pg_restore --exit-on-error --no-owner --no-acl --dbname="$RESTORE_DATABASE_URL" yuyen-YYYY-MM-DD.dump
```

ทดสอบ restore ในฐานข้อมูลแยกทุกเดือน ตรวจจำนวนรายการ, foreign keys, บัญชีผู้ดูแล, media metadata และสุ่มเปิดไฟล์ใน object storage ต้องสำรอง bucket/versioning แยกต่างหากด้วย

## Rollback

1. หยุดการรับ write หรือเปิด maintenance mode
2. เก็บ log และ snapshot ก่อนเปลี่ยนแปลง
3. ถ้า schema ยังรองรับ ให้เปลี่ยน application กลับไป image tag ก่อนหน้า
4. Prisma migration เป็น forward-only: แก้ schema ด้วย corrective migration ที่ review แล้ว
5. ถ้าข้อมูลเสียหาย ให้ restore backup ไปฐานข้อมูลใหม่และตรวจสอบก่อนสลับ connection
6. reconcile ข้อมูลที่เกิดหลัง backup จาก audit log แล้วทำ post-incident review

ห้ามลบ/แก้ migration ที่ apply แล้ว และห้าม rollback ด้วยคำสั่ง destructive โดยไม่มี backup ที่ทดสอบ restore

## Scheduled cleanup

ตั้ง scheduler ภายนอก container เพื่อป้องกันงานซ้ำเมื่อ scale หลาย instance:

```cron
15 2 * * * cd /opt/yuyen && docker compose run --rm ops cms:purge-expired
45 2 * * * cd /opt/yuyen && docker compose run --rm ops media:cleanup
10 3 * * * cd /opt/yuyen && docker compose run --rm ops auth:cleanup
```

`auth:cleanup` ลบ session ที่หมดอายุ ถูกเพิกถอน หรือหมดอายุจากการไม่ใช้งานแล้วเกิน
`AUTH_SESSION_RETENTION_DAYS` (ค่าเริ่มต้น 30 วัน) และลบ throttle ที่หมดผลแล้วเกิน
`AUTH_THROTTLE_RETENTION_DAYS` (ค่าเริ่มต้น 7 วัน) โดยไม่ลบ session ที่ยัง active หรือ
throttle ที่ยังล็อกอยู่ งานบันทึก audit `AUTH_RETENTION_CLEANUP_COMPLETED` พร้อมจำนวนที่ลบ

งานทั้งหมดควรรันวันละครั้งด้วย distributed/scheduler lock, timeout 30 นาที และ alert เมื่อ exit code ไม่เป็นศูนย์ ตรวจ audit `RETENTION_PURGE_COMPLETED`, `AUTH_RETENTION_CLEANUP_COMPLETED` และ storage cleanup backlog ทุกสัปดาห์ เก็บ audit อย่างน้อย 180 วัน

## Monitoring

- Liveness ใช้ `/api/health/live`; readiness ใช้ `/api/health/ready`
- Alert เมื่อ readiness ล้มเหลวต่อเนื่อง, HTTP 5xx สูง, login failure ผิดปกติ, disk/database ใกล้เต็ม หรือ cleanup ล้มเหลว
- Health endpoint ไม่ทดแทน synthetic login และไม่ตรวจ object storage เพื่อไม่ให้ storage outage นำ app ออกจาก load balancer ทั้งหมด
