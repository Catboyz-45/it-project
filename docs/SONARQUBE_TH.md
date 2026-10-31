# การวิเคราะห์โค้ดด้วย SonarQube

เอกสารนี้อธิบายวิธีสแกนโค้ด Nestly ด้วย SonarQube Community Edition และออกรายงาน PDF
ปรับมาจากคู่มือของรายวิชา (ต้นฉบับใช้ OWASP Juice Shop เป็นตัวอย่าง)

SonarQube เป็นเครื่องมือวิเคราะห์โค้ดแบบ static (ไม่ต้องรันโปรแกรมจริง) ใช้หา bug,
ช่องโหว่ความปลอดภัย, code smell และวัดความครอบคลุมของเทสต์

## ขั้นตอนทั้งหมด

### 1. เปิด SonarQube

```bash
npm run sonar:up
```

เปิด http://localhost:9000 ล็อกอินครั้งแรกด้วย `admin` / `admin` แล้วระบบจะบังคับให้ตั้งรหัสผ่านใหม่
(รอบแรกใช้เวลาบูตประมาณ 1-2 นาที)

ปิดเมื่อใช้เสร็จด้วย `npm run sonar:down` (ข้อมูลยังอยู่ใน docker volume)

### 2. สร้าง Token

บนเว็บ SonarQube: คลิกไอคอนโปรไฟล์มุมขวาบน → **My Account** → แท็บ **Security** →
ตั้งชื่อ token → เลือกประเภท **Global Analysis Token** → **Generate** แล้วคัดลอกเก็บไว้ทันที
(ระบบแสดงให้เห็นครั้งเดียว)

> **อย่า commit token ลง git** ให้ใส่ผ่าน environment variable เท่านั้น

### 3. สร้างข้อมูล coverage

```bash
npm run test:coverage
# ชุด integration ต้องมีฐานข้อมูลทดสอบแยก ชื่อฐานต้องมีคำว่า test (เช่น dorm_test)
# สร้างครั้งแรกด้วย createdb แล้วลงไมเกรชันด้วย DATABASE_URL=<ฐาน test> npx prisma migrate deploy
DATABASE_URL=<URL ของฐาน test> STORAGE_TYPE=local LOCAL_STORAGE_PATH=./storage/test-documents npm run test:coverage:integration
```

สร้างไฟล์ `coverage/lcov.info` (unit) กับ `coverage-integration/lcov.info` (integration ที่เรียก route ใน `app/api` จริง)
SonarQube รวมสองไฟล์ให้เอง ถ้าข้ามชุดไหนไป coverage ของส่วนนั้นจะขึ้น 0%

ไฟล์ที่ไม่นับ coverage (แต่ยังตรวจ bug/ช่องโหว่ตามปกติ) ระบุไว้ใน `sonar.coverage.exclusions` ของ
`sonar-project.properties` พร้อมเหตุผล คือหน้าจอ (`app/**/*.tsx`, `components/**`) ที่ทดสอบด้วย Playwright,
React hook ฝั่งเบราว์เซอร์, สคริปต์ CLI และไฟล์ตั้งค่าเครื่องมือ

### 4. สแกนโค้ด

```bash
export SONAR_TOKEN=<token ที่คัดลอกไว้>
npm run sonar:scan
```

สแกนสำเร็จจะขึ้น `ANALYSIS SUCCESSFUL` แล้วดูผลได้ที่ http://localhost:9000/dashboard?id=nestly

### 5. ออกรายงาน PDF

SonarQube รุ่น Community ไม่มีปุ่ม export PDF (เป็นฟีเจอร์ของรุ่น Developer ขึ้นไป)
จึงใช้สคริปต์ดึงข้อมูลผ่าน Web API มาสร้างเอง

```bash
pip install requests reportlab   # ติดตั้งครั้งแรกครั้งเดียว
export SONAR_TOKEN=<token>
npm run sonar:report
```

ได้ไฟล์ `nestly_report.pdf` (ตั้งชื่อเองได้ด้วย `--output`, ปรับจำนวนตัวอย่าง issue ด้วย `--top`)

### 6. เก็บรายการ issue แยกหน้า

ใส่ `--issues-dir` เพื่อเก็บ issue ที่ยังเปิดอยู่ทั้งหมดเป็น `issues_page1.json`, `issues_page2.json`, ...
หน้าละ 200 รายการ รูปแบบเดียวกับ `GET /api/issues/search` และไฟล์ใน `docs/sonarqube-history/`
(issue ไม่ถึง 200 รายการจะได้ไฟล์เดียวคือ `issues_page1.json`)

```bash
python3 scripts/sonar_report.py --host http://localhost:9000 --project nestly --token $SONAR_TOKEN \
  --output docs/sonarqube-history/run-62/nestly_report_run62.pdf --issues-dir docs/sonarqube-history/run-62
```

ตั้งชื่อ PDF ให้ไม่ลงท้ายด้วย `_report.pdf` ถ้าต้องการ commit ไฟล์นั้น เพราะ `.gitignore` กันชื่อแบบนั้นไว้

## การอ่านผล

| หมวด | ความหมาย |
| --- | --- |
| Reliability (Bugs) | โค้ดที่ทำงานผิดจากที่ตั้งใจ |
| Security (Vulnerabilities) | ช่องโหว่ที่โจมตีได้ |
| Security Review (Hotspots) | จุดที่ต้องให้คนตรวจว่าเป็นปัญหาจริงไหม |
| Maintainability (Code Smells) | โค้ดที่ใช้ได้แต่จะแก้ยากในอนาคต |

Rating ไล่จาก A (ดีสุด) ถึง E (แย่สุด) — ดู severity ของ issue จาก Blocker → Critical → Major → Minor → Info

**ข้อควรระวัง: ตัวเลขที่ได้ต้องตีความก่อนเสมอ** SonarQube จับรูปแบบ ไม่ได้เข้าใจบริบทของระบบ
เช่น ค่าคงที่ชื่อ `PASSWORD_RESET_REQUEST` ที่เก็บข้อความภาษาไทยไว้แสดงบนหน้าจอ
จะถูกแจ้งว่าเป็น "hard-coded password" ทั้งที่ไม่ใช่รหัสผ่าน ควรเปิดดูโค้ดจริงทุกครั้งก่อนสรุปว่าเป็นช่องโหว่

## ปัญหาที่เจอจริงกับโปรเจกต์นี้

### scanner ล้มด้วย "bridge server is unresponsive" (เครื่อง Mac ชิป Apple Silicon)

image `sonarsource/sonar-scanner-cli` มีเฉพาะสถาปัตยกรรม amd64 บนเครื่อง arm64 จึงต้องรันผ่าน
emulation ทำให้ Node ที่ใช้วิเคราะห์ JS/TS ข้างในพังกลางทาง (ข้อความ error ชี้ไปที่ memory
แต่สาเหตุจริงคือ emulation)

โปรเจกต์นี้จึงใช้ `sonarqube-scanner` จาก npm ซึ่งรัน scanner แบบ native บนเครื่องแทน Docker
— คำสั่ง `npm run sonar:scan` จัดการให้แล้ว ไม่ต้องตั้งค่าอะไรเพิ่ม

### scanner ล้มด้วย "MissingObjectException"

SonarQube ใช้ JGit อ่านประวัติ git เพื่อระบุผู้เขียนโค้ดรายบรรทัด แต่ JGit อ่าน pack format
ของ git รุ่นใหม่ในเครื่องนี้ไม่ได้ (ทั้งที่ `git` เองอ่านได้ปกติ) จึงปิดไว้ด้วย
`sonar.scm.disabled=true` ใน `sonar-project.properties` — กระทบแค่ข้อมูลผู้เขียน ไม่กระทบการหา bug

## ไฟล์ที่เกี่ยวข้อง

| ไฟล์ | หน้าที่ |
| --- | --- |
| `sonar-project.properties` | บอก scanner ว่าวิเคราะห์ไฟล์ไหน ยกเว้นไฟล์ไหน |
| `docker-compose.sonarqube.yml` | SonarQube server + ฐานข้อมูลของตัวเอง (แยกจาก stack ของแอป) |
| `scripts/sonar_report.py` | ดึงผลผ่าน Web API มาสร้างรายงาน PDF |
