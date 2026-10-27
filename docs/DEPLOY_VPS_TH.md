# การนำ Nestly ขึ้น VPS (Hostinger) ด้วย Docker + CI/CD

ทำตามแนวทาง `DEPLOY_GUIDE.md` ของวิชา: push เข้า `main` → CI ผ่าน → workflow `Deploy`
build image ขึ้น GHCR → SSH เข้า VPS สั่ง `docker compose pull && up -d` → เช็ก `/api/health`

```text
git push (main) → CI → Deploy: build image → GHCR (tag latest + sha-xxxxxxx)
                                 → VPS /home/deploy/nestly: docker compose pull + up -d → health check
VPS: nginx + HTTPS (certbot) → 127.0.0.1:3000 → container app → postgres (volume)
                                                 container maintenance → เรียกงานบำรุงรักษาทุก 5 นาที
```

ขึ้นระบบจริงครั้งแรกเมื่อ 2026-10-17 ตามขั้นตอนในเอกสารนี้

| ค่า | ของโปรเจกต์นี้ |
| --- | --- |
| โดเมน | `nestlyspace.tech`, `www.nestlyspace.tech` |
| VPS | Hostinger KVM 1 (1 vCPU, RAM 4 GB), Ubuntu, Kuala Lumpur, เวลาเครื่องเป็น UTC |
| user ที่ใช้ deploy | `deploy` (อยู่ในกลุ่ม `docker`, login GHCR ไว้แล้ว) |
| โฟลเดอร์บน VPS | `/home/deploy/nestly` |
| port ของแอปบน VPS | `127.0.0.1:3000` (เข้าจากข้างนอกได้ผ่าน nginx เท่านั้น) |
| image | `ghcr.io/catboyz-45/it-project` และ `ghcr.io/catboyz-45/it-project-migrator` |
| ฐานข้อมูล | PostgreSQL 17 ใน container, volume `nestly_postgres_data` |
| ไฟล์อัปโหลด | volume `nestly_app_storage` (`STORAGE_TYPE=local`) |
| config nginx | `/etc/nginx/sites-available/nestly` |
| สำรองข้อมูล | `/home/deploy/nestly/backup.sh` ทุกวัน 03:00 เวลาไทย เก็บ 14 วัน |

ไฟล์ที่เกี่ยวข้อง: `docker-compose.yml`, `docker-compose.override.yml` (ใช้เฉพาะในเครื่อง),
`.github/workflows/deploy.yml`, `deploy/make-env.sh`, `deploy/nginx.conf`, `deploy/backup.sh`

คำสั่งบน VPS รันใน Web console ของ hPanel (VPS → จัดการ → Web console) ซึ่งเข้าเป็น `root`
ถ้าใช้ SSH ก็ได้ผลเหมือนกัน คำสั่งที่เขียนว่า "บนเครื่องตัวเอง" ให้รันใน Terminal ของเครื่องตัวเอง

## 1. เคลียร์งาน Lab เดิมออกจาก VPS

Lab ของวิชาอยู่ที่ `/home/deploy/app` ใช้ port `127.0.0.1:3300` และ config nginx ชื่อ `equipment`
ที่ล็อกด้วย Basic Auth ดูก่อนว่ามีอะไรรันอยู่

```bash
docker ps -a --format '{{.Names}} | {{.Status}} | {{.Ports}}'
```

```bash
grep -l nestlyspace /etc/nginx/sites-enabled/*
```

ลบ container, volume, โฟลเดอร์และ image ของ Lab (ข้อมูลของ Lab จะหายถาวร)

```bash
cd /home/deploy/app && docker compose down -v
```

```bash
cd ~ && rm -rf /home/deploy/app
```

```bash
docker rmi ghcr.io/catboyz-45/equipment-demo-3:latest ghcr.io/catboyz-45/equipment-demo-3-migrator:latest postgres:16-alpine
```

เอา config nginx ของ Lab และไฟล์รหัส Basic Auth ออก

```bash
rm /etc/nginx/sites-enabled/equipment /etc/nginx/.htpasswd
```

```bash
nginx -t && systemctl reload nginx
```

ใบรับรองใน `/etc/letsencrypt` เก็บไว้ certbot จะใช้ใบเดิมในข้อ 5

## 2. เตรียม SSH key และ GitHub Secrets

สร้าง key สำหรับ GitHub Actions โดยเฉพาะ (บนเครื่องตัวเอง ไม่ต้องตั้ง passphrase)

```bash
ssh-keygen -t ed25519 -f ~/.ssh/nestly_deploy -N "" -C "github-actions-nestly"
```

ดู public key (บนเครื่องตัวเอง) แล้วคัดลอกบรรทัดที่ขึ้นต้นด้วย `ssh-ed25519`

```bash
cat ~/.ssh/nestly_deploy.pub
```

เพิ่มให้ user `deploy` บน VPS (ใน Web console แทน `<public key>` ด้วยบรรทัดที่คัดลอกมา)

```bash
echo '<public key>' >> /home/deploy/.ssh/authorized_keys
```

ทดสอบจากเครื่องตัวเอง ต้องขึ้น `ok` (ครั้งแรกจะถามยืนยัน host ให้พิมพ์ `yes`)

```bash
ssh -i ~/.ssh/nestly_deploy deploy@179.197.241.86 'echo ok'
```

ตั้ง Secrets ที่ GitHub → repo → Settings → Secrets and variables → Actions → New repository secret

| Name | Secret |
| --- | --- |
| `VPS_HOST` | `179.197.241.86` |
| `VPS_USER` | `deploy` |
| `VPS_SSH_KEY` | เนื้อหาทั้งไฟล์ `~/.ssh/nestly_deploy` รวมบรรทัด BEGIN/END |

คัดลอก private key ลงคลิปบอร์ดโดยไม่แสดงบนจอ (บนเครื่องตัวเอง macOS)

```bash
pbcopy < ~/.ssh/nestly_deploy
```

ยังไม่ต้องตั้ง Variable `APP_URL` จนกว่าจะถึงข้อ 7 ระหว่างนั้น workflow `Deploy` จะ build และ push image
แต่ข้ามขั้น deploy ไป

จากนั้น merge เข้า `main` แล้วรอให้ `CI` และ `Deploy` (ขั้น build-push) ผ่าน image จะขึ้น GHCR

## 3. เตรียมโฟลเดอร์แอปบน VPS

ทุกอย่างของแอปเป็นของ user `deploy` ดาวน์โหลดไฟล์จาก repo และสร้าง `.env`
(สุ่มรหัสผ่านฐานข้อมูลและ `JOB_SECRET` ให้เอง ถ้ามี `.env` อยู่แล้วจะไม่เขียนทับ)

```bash
su - deploy -c 'mkdir -p ~/nestly && cd ~/nestly && curl -fsSLO https://raw.githubusercontent.com/Catboyz-45/it-project/main/docker-compose.yml && curl -fsSL -o make-env.sh https://raw.githubusercontent.com/Catboyz-45/it-project/main/deploy/make-env.sh && sh make-env.sh ghcr.io/catboyz-45/it-project https://nestlyspace.tech'
```

ใส่ Resend API key (ได้จากข้อ 6) ต่อท้ายบรรทัด `RESEND_API_KEY=` แล้ว `Ctrl+O`, Enter, `Ctrl+X`

```bash
su - deploy -c 'nano ~/nestly/.env'
```

ทดลอง pull image user `deploy` login GHCR ไว้แล้วตั้งแต่ Lab ถ้าขึ้น `unauthorized` ให้
`su - deploy` แล้ว `docker login ghcr.io -u Catboyz-45` ด้วย Personal Access Token ที่มีสิทธิ์ `read:packages`

```bash
su - deploy -c 'cd ~/nestly && docker compose pull'
```

## 4. ย้ายข้อมูลจาก Neon

ทำตอนที่ไม่มีคนใช้ระบบ และ suspend service `nestly` บน Render ก่อน (Settings → Suspend Web Service)
เพื่อไม่ให้มีข้อมูลเขียนเพิ่มหลัง dump

Neon ของโปรเจกต์นี้เป็น **PostgreSQL 18** ต้องใช้ `pg_dump` 18 ขึ้นไป ถ้าใช้ 17 จะขึ้น
`aborting because of server version mismatch`

เปิดเฉพาะฐานข้อมูล (ยังไม่เปิดแอป จึงยังไม่มี migration มาสร้างตาราง)

```bash
su - deploy -c 'cd ~/nestly && docker compose up -d --wait postgres'
```

connection string ใช้ค่า `DATABASE_URL` จาก Render → `nestly` → Environment
ถ้าชื่อ host มี `-pooler` ให้ลบ `-pooler` ออก เพราะ `pg_dump` ต้องต่อตรงไม่ผ่าน pooler

สลับเป็น user `deploy` แล้วรับ connection string แบบไม่แสดงบนจอและไม่ค้างใน shell history
ต้อง `export` ด้วย ไม่งั้น `docker run -e NEON_URL` จะส่งค่าว่างเข้าไปและ `pg_dump` จะไปหาฐานข้อมูลในเครื่องแทน

```bash
su - deploy
```

```bash
cd ~/nestly && read -rs NEON_URL && export NEON_URL && echo "length=${#NEON_URL}"
```

วาง connection string แล้ว Enter ต้องขึ้น `length=` เป็นตัวเลขมากกว่า 0

```bash
docker run --rm -e NEON_URL postgres:18-alpine sh -c 'pg_dump "$NEON_URL" -Fc --no-owner --no-privileges' > neon.dump && ls -lh neon.dump
```

restore เข้า Postgres บน VPS (รวมตาราง `_prisma_migrations` ด้วย migrate จะรู้ว่าทำถึงไหนแล้ว)
dump จาก `pg_dump` 18 restore เข้า PostgreSQL 17 ใน container ได้ปกติ

```bash
docker compose exec -T postgres pg_restore -U dorm_app -d dorm --no-owner --no-privileges < neon.dump
```

```bash
unset NEON_URL && exit
```

ตรวจว่าข้อมูลเข้ามาครบ จำนวน migration ต้องเท่ากับจำนวนโฟลเดอร์ใน `prisma/migrations`
(ตอนย้ายจริงได้ 47 ตาราง และ 23 migration)

```bash
cd /home/deploy/nestly && docker compose exec -T postgres psql -U dorm_app -d dorm -c "select count(*) from _prisma_migrations" -c "select relname, n_live_tup from pg_stat_user_tables where n_live_tup > 0 order by n_live_tup desc"
```

เปิดทั้งระบบ migrate จะใส่เฉพาะ migration ที่ยังไม่มี

```bash
su - deploy -c 'cd ~/nestly && docker compose up -d --wait && docker compose ps -a'
```

```bash
curl -fsS http://127.0.0.1:3000/api/health
```

เก็บ `neon.dump` ไว้ที่อื่นแล้วลบออกจาก VPS เมื่อมั่นใจว่าข้อมูลครบ ไฟล์ใน R2 ของเดิมว่างอยู่ จึงไม่มีไฟล์ต้องย้าย

## 5. nginx + HTTPS

ติดตั้ง config จาก repo แล้ว reload

```bash
curl -fsSL -o /etc/nginx/sites-available/nestly https://raw.githubusercontent.com/Catboyz-45/it-project/main/deploy/nginx.conf && ln -sf /etc/nginx/sites-available/nestly /etc/nginx/sites-enabled/nestly
```

```bash
nginx -t && systemctl reload nginx
```

ใบรับรองของโดเมนนี้มีอยู่แล้วจาก Lab `--reinstall` ให้ใช้ใบเดิมและเพิ่มส่วน HTTPS กับ redirect ให้ config ใหม่

```bash
certbot --nginx -d nestlyspace.tech -d www.nestlyspace.tech --redirect --reinstall --non-interactive
```

ตรวจจากเครื่องตัวเอง ต้องได้ `{"status":"ok"}` และ `http://` ต้อง redirect ไป `https://`

```bash
curl -s https://nestlyspace.tech/api/health
```

## 6. อีเมลรีเซ็ตรหัสผ่าน (Resend)

1. resend.com → Domains → Add domain → `nestlyspace.tech` region Tokyo (ap-northeast-1)
2. เพิ่ม DNS record ใน hPanel → Domains → nestlyspace.tech → DNS

   | ประเภท | ชื่อ | ค่า |
   | --- | --- | --- |
   | TXT | `resend._domainkey` | ค่า DKIM ที่ Resend ให้มา (`p=MIGf...`) |
   | CNAME | `rsend` | `rsend-apne1.forge.rmta.net` |
   | CNAME | `send` | `send.forge.rmta.net` |
   | TXT | `_dmarc` | `v=DMARC1; p=none;` |

   ไม่ต้องเพิ่ม MX ของ Resend เพราะใช้ส่งอย่างเดียว ไม่ได้รับอีเมล TTL ใช้ค่าเริ่มต้นได้
3. รอสถานะเป็น Verified แล้วสร้าง API key: API Keys → Create API key → Permission **Sending access**,
   Domain `nestlyspace.tech`
4. ใส่ key ใน `.env` ตามข้อ 3 แล้วสั่ง `su - deploy -c 'cd ~/nestly && docker compose up -d'`

## 7. เปิด deploy อัตโนมัติ

ตั้ง Variable `APP_URL` = `https://nestlyspace.tech` ที่ GitHub → Settings → Secrets and variables →
Actions → Variables แล้วไปที่แท็บ Actions → `Deploy` → Run workflow ทดสอบ 1 รอบ

ตรวจบน VPS ว่ารัน image tag `sha-xxxxxxx` ตาม commit ล่าสุดของ `main`

```bash
docker ps --format '{{.Names}} | {{.Image}} | {{.Status}}'
```

หลังจากนี้ merge เข้า `main` อย่างเดียว workflow จะ deploy และเช็ก health ให้เอง

## สำรองข้อมูล

`deploy/backup.sh` dump ฐานข้อมูลและบีบอัด volume ไฟล์อัปโหลดไว้ที่ `/home/deploy/nestly/backups`
แล้วลบไฟล์ที่เก่ากว่า 14 วัน ติดตั้งบน VPS

```bash
curl -fsSL -o /home/deploy/nestly/backup.sh https://raw.githubusercontent.com/Catboyz-45/it-project/main/deploy/backup.sh && chown deploy:deploy /home/deploy/nestly/backup.sh && chmod 700 /home/deploy/nestly/backup.sh
```

ทดลองรัน 1 รอบ ต้องขึ้น `backup ok` และมีไฟล์ `db-YYYY-MM-DD.dump` กับ `storage-YYYY-MM-DD.tgz`

```bash
su - deploy -c '/home/deploy/nestly/backup.sh && ls -lh /home/deploy/nestly/backups'
```

ตั้ง crontab ของ user `deploy` ให้รันทุกวัน 20:00 UTC (03:00 เวลาไทย)

```bash
(crontab -u deploy -l 2>/dev/null | grep -v nestly/backup.sh; echo '0 20 * * * /home/deploy/nestly/backup.sh >> /home/deploy/nestly/backups/backup.log 2>&1') | crontab -u deploy -
```

ไฟล์สำรองอยู่บน VPS เครื่องเดียว ควรดาวน์โหลดออกมาเก็บนอก VPS เป็นระยะ (บนเครื่องตัวเอง)

```bash
scp -i ~/.ssh/nestly_deploy 'deploy@179.197.241.86:~/nestly/backups/db-*.dump' .
```

กู้ฐานข้อมูลจากไฟล์สำรอง (ข้อมูลปัจจุบันจะถูกแทนที่)

```bash
cd /home/deploy/nestly && docker compose stop app maintenance && docker compose exec -T postgres pg_restore -U dorm_app -d dorm --clean --if-exists --no-owner < backups/db-YYYY-MM-DD.dump && docker compose up -d
```

## ย้อนเวอร์ชัน (rollback)

ทุก image มี tag `sha-xxxxxxx` ตาม commit ดูได้จากหน้า Actions หรือ GitHub Packages

```bash
su - deploy -c 'cd ~/nestly && APP_IMAGE=ghcr.io/catboyz-45/it-project:sha-xxxxxxx MIGRATOR_IMAGE=ghcr.io/catboyz-45/it-project-migrator:sha-xxxxxxx docker compose up -d'
```

migration ที่รันไปแล้วจะไม่ถูกย้อนกลับ ถ้าเวอร์ชันใหม่เปลี่ยนโครงสร้างตาราง ให้กู้จากไฟล์สำรองก่อน deploy นั้น

## สิ่งที่ห้ามทำ

- ห้าม `docker compose down -v` ใน `/home/deploy/nestly` คำสั่งนี้ลบฐานข้อมูลและไฟล์อัปโหลดทั้งหมด
- ห้าม commit `.env` หรือ copy `docker-compose.override.yml` ขึ้น VPS (จะเปิด port ฐานข้อมูล)
- ห้ามแก้ migration เก่าที่รันบน VPS ไปแล้ว
- ห้ามแสดง `.env` บนจอระหว่างแชร์หน้าจอหรือแคปภาพ ใช้ `cut -d= -f1 .env` ถ้าต้องการดูแค่ชื่อตัวแปร
