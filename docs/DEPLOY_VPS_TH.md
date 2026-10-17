# การนำ Nestly ขึ้น VPS (Hostinger) ด้วย Docker + CI/CD

ทำตามแนวทาง `DEPLOY_GUIDE.md` ของวิชา: push เข้า `main` → CI ผ่าน → workflow `Deploy`
build image ขึ้น GHCR → SSH เข้า VPS สั่ง `docker compose pull && up -d` → เช็ก `/api/health`

```text
git push (main) → CI → Deploy: build image → GHCR (tag latest + sha-xxxxxxx)
                                 → VPS ~/nestly: docker compose pull + up -d → health check
VPS: nginx + HTTPS (certbot) → 127.0.0.1:3000 → container app → postgres (volume)
                                                 container maintenance → เรียกงานบำรุงรักษาทุก 5 นาที
```

| ค่า | ของโปรเจกต์นี้ |
| --- | --- |
| โดเมน | `nestlyspace.tech`, `www.nestlyspace.tech` |
| VPS | Hostinger KVM 1, Ubuntu |
| โฟลเดอร์บน VPS | `~/nestly` |
| port ของแอปบน VPS | `127.0.0.1:3000` (เข้าจากข้างนอกได้ผ่าน nginx เท่านั้น) |
| image | `ghcr.io/catboyz-45/it-project` และ `ghcr.io/catboyz-45/it-project-migrator` |
| ฐานข้อมูล | PostgreSQL 17 ใน container, volume `nestly_postgres_data` |
| ไฟล์อัปโหลด | volume `nestly_app_storage` (`STORAGE_TYPE=local`) |

ไฟล์ที่เกี่ยวข้อง: `docker-compose.yml`, `docker-compose.override.yml` (ใช้เฉพาะในเครื่อง),
`.github/workflows/deploy.yml`, `deploy/make-env.sh`, `deploy/nginx.conf`

คำสั่งทั้งหมดด้านล่างรันบน VPS ผ่าน SSH ยกเว้นที่เขียนว่า "บนเครื่องตัวเอง"

## 1. เคลียร์งาน Lab เดิมออกจาก VPS

ดูก่อนว่ามีอะไรรันอยู่ แล้วค่อยลบ

```bash
docker ps --format '{{.Names}}  {{.Ports}}  {{.Image}}'
cd ~/app && docker compose ps
```

ลบ container, volume และโฟลเดอร์ของ Lab (ข้อมูลของ Lab จะหายถาวร)

```bash
cd ~/app && docker compose down -v && cd ~ && rm -rf ~/app
```

หา config nginx เดิมของโดเมนนี้ (ตัวที่ล็อกด้วย Basic Auth) แล้วเอาออกจาก `sites-enabled`

```bash
grep -l nestlyspace /etc/nginx/sites-enabled/*
```

```bash
sudo rm /etc/nginx/sites-enabled/<ชื่อไฟล์ที่เจอ>
```

ใบรับรองใน `/etc/letsencrypt` เก็บไว้ได้ certbot จะใช้ใบเดิมในข้อ 5

## 2. เตรียม GitHub (บนเครื่องตัวเอง)

สร้าง SSH key สำหรับให้ GitHub Actions เข้า VPS (ไม่ต้องตั้ง passphrase)

```bash
ssh-keygen -t ed25519 -f ~/.ssh/nestly_deploy -N "" -C "github-actions-nestly"
```

นำ public key ไปใส่ใน VPS ของ user ที่จะใช้ deploy (user นี้ต้องอยู่ในกลุ่ม `docker`)

```bash
ssh-copy-id -i ~/.ssh/nestly_deploy.pub <user>@179.197.241.86
```

ตั้ง Secrets และ Variable ของ repo

```bash
gh secret set VPS_HOST -R Catboyz-45/it-project --body "179.197.241.86"
```

```bash
gh secret set VPS_USER -R Catboyz-45/it-project --body "<user>"
```

```bash
gh secret set VPS_SSH_KEY -R Catboyz-45/it-project < ~/.ssh/nestly_deploy
```

```bash
gh variable set APP_URL -R Catboyz-45/it-project --body "https://nestlyspace.tech"
```

จากนั้น merge branch เข้า `main` แล้วดูแท็บ Actions ให้ `CI` และ `Deploy` (ขั้น build-push) ผ่าน
ขั้น deploy รอบแรกจะล้มเพราะยังไม่ได้เตรียม VPS ในข้อ 3 เป็นเรื่องปกติ

## 3. เตรียมโฟลเดอร์แอปบน VPS

```bash
mkdir -p ~/nestly && cd ~/nestly
```

copy `deploy/make-env.sh` ขึ้นไป (บนเครื่องตัวเอง ในโฟลเดอร์โปรเจกต์)

```bash
scp deploy/make-env.sh docker-compose.yml <user>@179.197.241.86:~/nestly/
```

สร้าง `.env` (สุ่มรหัสผ่านฐานข้อมูลและ `JOB_SECRET` ให้เอง)

```bash
cd ~/nestly && sh make-env.sh ghcr.io/catboyz-45/it-project https://nestlyspace.tech
```

login GHCR ด้วย Personal Access Token (classic) ที่มีสิทธิ์ `read:packages` อย่างเดียว

```bash
docker login ghcr.io -u Catboyz-45
```

## 4. ย้ายข้อมูลจาก Neon

ทำตอนที่ไม่มีคนใช้ระบบ และ suspend service บน Render ก่อน เพื่อไม่ให้มีข้อมูลเขียนเพิ่มหลัง dump

ดูเวอร์ชัน PostgreSQL ของ Neon ที่หน้า project settings ถ้าไม่ใช่ 17 ให้เปลี่ยนเลข image
`postgres:17-alpine` ในคำสั่ง dump ให้ตรงหรือสูงกว่า

เปิดเฉพาะฐานข้อมูล (ยังไม่เปิดแอป จึงยังไม่มี migration มาสร้างตาราง)

```bash
cd ~/nestly && docker compose pull && docker compose up -d postgres
```

ใส่ connection string ของ Neon แบบไม่ค้างใน shell history แล้ว dump

```bash
read -rs NEON_URL
```

```bash
docker run --rm -e NEON_URL postgres:17-alpine sh -c 'pg_dump "$NEON_URL" -Fc --no-owner --no-privileges' > neon.dump
```

restore เข้า Postgres บน VPS (รวมตาราง `_prisma_migrations` ด้วย migrate จะรู้ว่าทำถึงไหนแล้ว)

```bash
docker compose exec -T postgres pg_restore -U dorm_app -d dorm --no-owner --no-privileges < neon.dump
```

เปิดทั้งระบบ migrate จะใส่เฉพาะ migration ที่ยังไม่มี

```bash
docker compose up -d && docker compose ps
```

```bash
curl -fsS http://127.0.0.1:3000/api/health
```

เก็บ `neon.dump` ไว้ที่อื่นแล้วลบออกจาก VPS เมื่อมั่นใจว่าข้อมูลครบ ไฟล์ R2 ของเดิมว่างอยู่ จึงไม่มีไฟล์ต้องย้าย

## 5. nginx + HTTPS

copy `deploy/nginx.conf` ขึ้นไป (บนเครื่องตัวเอง)

```bash
scp deploy/nginx.conf <user>@179.197.241.86:~/nestly/
```

ติดตั้งบน VPS

```bash
sudo cp ~/nestly/nginx.conf /etc/nginx/sites-available/nestly && sudo ln -sf /etc/nginx/sites-available/nestly /etc/nginx/sites-enabled/nestly
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

```bash
sudo certbot --nginx -d nestlyspace.tech -d www.nestlyspace.tech --redirect
```

เปิด `https://nestlyspace.tech` ต้องเข้าหน้าเว็บได้โดยไม่ถามรหัส Basic Auth แล้ว

## 6. อีเมลรีเซ็ตรหัสผ่าน (Resend)

1. resend.com → Domains → Add domain → `nestlyspace.tech`
2. นำ DNS record ที่ Resend ให้มาไปเพิ่มใน hPanel → Domains → nestlyspace.tech → DNS
3. รอสถานะเป็น Verified แล้วสร้าง API key แบบ Sending access
4. ใส่ค่าใน `~/nestly/.env` ที่บรรทัด `RESEND_API_KEY=` แล้วสั่ง `docker compose up -d`

## 7. Deploy ครั้งต่อไป

push หรือ merge เข้า `main` เท่านั้น workflow จะ deploy ให้เอง หรือกด Run workflow ที่ `Deploy`
ในแท็บ Actions

## สำรองข้อมูล

ตั้ง crontab (`crontab -e`) ให้ dump ฐานข้อมูลทุกตีสามและเก็บ 14 วัน

```text
0 3 * * * cd ~/nestly && mkdir -p backups && docker compose exec -T postgres pg_dump -U dorm_app -Fc dorm > backups/db-$(date +\%F).dump && find backups -name 'db-*.dump' -mtime +14 -delete
```

ไฟล์อัปโหลดอยู่ใน volume ให้สำรองเป็นครั้งคราว

```bash
docker run --rm -v nestly_app_storage:/data:ro -v ~/nestly/backups:/backup alpine tar czf /backup/storage-$(date +%F).tgz -C /data .
```

ควรดาวน์โหลดไฟล์ใน `~/nestly/backups` ออกมาเก็บนอก VPS ด้วย

กู้ฐานข้อมูลจากไฟล์สำรอง (ข้อมูลปัจจุบันจะถูกแทนที่)

```bash
docker compose stop app maintenance && docker compose exec -T postgres pg_restore -U dorm_app -d dorm --clean --if-exists --no-owner < backups/db-YYYY-MM-DD.dump && docker compose up -d
```

## ย้อนเวอร์ชัน (rollback)

ทุก image มี tag `sha-xxxxxxx` ตาม commit ดูได้จากหน้า Actions หรือ GitHub Packages

```bash
cd ~/nestly && APP_IMAGE=ghcr.io/catboyz-45/it-project:sha-xxxxxxx MIGRATOR_IMAGE=ghcr.io/catboyz-45/it-project-migrator:sha-xxxxxxx docker compose up -d
```

migration ที่รันไปแล้วจะไม่ถูกย้อนกลับ ถ้าเวอร์ชันใหม่เปลี่ยนโครงสร้างตาราง ให้กู้จากไฟล์สำรองก่อน deploy นั้น

## สิ่งที่ห้ามทำ

- ห้าม `docker compose down -v` ใน `~/nestly` คำสั่งนี้ลบฐานข้อมูลและไฟล์อัปโหลดทั้งหมด
- ห้าม commit `.env` หรือ copy `docker-compose.override.yml` ขึ้น VPS (จะเปิด port ฐานข้อมูล)
- ห้ามแก้ migration เก่าที่รันบน VPS ไปแล้ว
