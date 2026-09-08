# ข้อมูลส่งต่อสำหรับพัฒนาระบบร่วมกัน

## 1. ภาพรวมระบบ

โปรเจกต์นี้เป็นแพลตฟอร์ม SaaS สำหรับบริหารหอพักหลายแห่งในระบบเดียว โดยแบ่งผู้ใช้งานเป็น 3 บทบาท

- `SUPER_ADMIN` — ดูแลแพลตฟอร์ม อนุมัติบัญชีเจ้าของหอ จัดการแพ็กเกจ และตรวจสอบการชำระค่าแพ็กเกจ
- `PROPERTY_ADMIN` — เจ้าของหอ/ผู้ดูแลหอ เป็น role เดียวกัน และหนึ่งบัญชีดูแลได้หลายหอ
- `TENANT` — ผู้เช่า ดูข้อมูลเฉพาะห้องและหอที่ตนมีสิทธิ์อยู่

“บ้านอยู่สบาย” เป็นเพียงข้อมูลหอทดลอง ไม่ใช่ชื่อถาวรของแพลตฟอร์ม

## 2. เทคโนโลยีที่ใช้

### Frontend และ Backend

- Next.js 16 (App Router)
- React 19
- TypeScript แบบ strict
- Tailwind CSS 4
- Next.js Route Handlers สำหรับ REST API
- Zod สำหรับตรวจสอบข้อมูลที่รับเข้าฝั่งเซิร์ฟเวอร์

### ฐานข้อมูลและไฟล์

- PostgreSQL
- Prisma ORM 7
- Prisma migrations สำหรับการเปลี่ยนโครงสร้างฐานข้อมูล
- รองรับการเก็บไฟล์แบบ local สำหรับ development และ S3-compatible storage สำหรับ production

### Authentication และ Security

- Session-based authentication
- Session อยู่ใน `HttpOnly` cookie ชื่อ `dorm_session`
- ไม่เก็บ token ใน `localStorage`
- มี account approval, temporary password, forgot/reset password และ session revocation
- ตรวจ role, property membership, tenant occupancy และ record ownership ที่ backend
- Mutation ตรวจ same-origin/Content-Type เพื่อช่วยป้องกัน CSRF
- มี login/upload rate limiting, request ID และ audit log

### Testing และ Deployment

- Vitest สำหรับ unit และ PostgreSQL integration tests
- Playwright + Chromium สำหรับ E2E
- Docker/Docker Compose
- GitHub Actions CI
- OpenAPI ที่ `docs/openapi.json`

## 3. หลักการทำงานร่วมกัน

ฝั่งเจ้าของหอ, Super Admin และผู้เช่าต้องอยู่ในโปรเจกต์และฐานข้อมูลเดียวกัน ไม่ทำฐานข้อมูล, user table, auth หรือ business model แยกอีกชุด

ถ้าเพื่อนทำ UI ผู้เช่า:

1. ใช้ API ภายใต้ `/api/v1/tenant/*`
2. ใช้ login/logout กลางภายใต้ `/api/auth/*`
3. ส่ง cookie session เดิมไปกับ request
4. ห้ามเชื่อข้อมูล role, propertyId, tenantProfileId หรือ roomId จาก client เพื่ออนุญาตสิทธิ์
5. ยึด `docs/openapi.json` เป็น API contract
6. ถ้าต้องเปลี่ยน request/response ให้แก้ backend, OpenAPI และ tests ในงานเดียวกัน
7. ห้ามใช้ mock/fallback ในหน้าที่เชื่อม API แล้ว

เมื่อ frontend และ API อยู่ origin เดียวกัน ใช้ path เช่น `/api/v1/tenant/invoices` ได้โดยตรง ไม่ต้องกำหนด host ซ้ำ และ browser จะส่ง HttpOnly cookie ให้เอง หากแยก origin ในอนาคตต้องออกแบบ CORS/CSRF/cookie ใหม่ก่อน ไม่ควรแก้เฉพาะฝั่ง client

## 4. รูปแบบ API กลาง

### Success response

ข้อมูลหลักมักอยู่ใน `data` และทุก JSON response จาก helper กลางมี `requestId`

```json
{
  "data": {},
  "requestId": "uuid"
}
```

รายการแบบแบ่งหน้าจะมี `pageInfo`

```json
{
  "data": [],
  "pageInfo": {
    "page": 1,
    "pageSize": 20,
    "hasNextPage": false
  },
  "requestId": "uuid"
}
```

UI ต้องอ่าน `pageInfo` และรองรับการเปลี่ยนหน้า/โหลดเพิ่ม ห้ามสมมติว่าข้อมูลหน้าแรกคือข้อมูลทั้งหมด

### Error response

```json
{
  "error": "ข้อความที่ปลอดภัยสำหรับผู้ใช้",
  "requestId": "uuid"
}
```

Validation error อาจมี `issues`

```json
{
  "error": "ข้อมูลไม่ถูกต้อง",
  "requestId": "uuid",
  "issues": [
    {
      "path": "fieldName",
      "message": "รายละเอียด"
    }
  ]
}
```

เก็บ `requestId` ไว้แสดงหรือแจ้งผู้ดูแลเมื่อต้องตามปัญหา และอย่าแสดง stack trace หรือข้อมูลภายในระบบ

### การเรียก mutation

- ใช้ HTTP method และ body ตาม OpenAPI
- ส่ง `Content-Type: application/json` สำหรับ JSON
- การอัปโหลดใช้ `multipart/form-data` ตาม endpoint
- ห้ามกำหนด header `Cookie` เองจาก JavaScript
- ป้องกันการกดซ้ำด้วย loading/disabled state
- รองรับ `400`, `401`, `403`, `404`, `409`, `415`, `429` และ `500`

ตัวอย่าง:

```ts
const response = await fetch("/api/v1/tenant/invoices?page=1&pageSize=20", {
  method: "GET",
  credentials: "same-origin",
});

const payload: unknown = await response.json();

if (!response.ok) {
  // แสดงข้อความ error ที่ API ส่งกลับ และเก็บ requestId สำหรับตรวจสอบ
}
```

## 5. ฟีเจอร์ที่มีในระบบ

### บัญชีและสิทธิ์

- Login/logout ด้วย session
- Super Admin สร้าง/อนุมัติ/ปฏิเสธบัญชีเจ้าของหอ
- Temporary password และบังคับเปลี่ยนรหัสผ่าน
- Forgot/reset password
- ผู้เช่าสมัครด้วยรหัสหอ/คำเชิญ
- บัญชีผู้เช่าเดิมรับคำเชิญเพิ่มได้
- ผู้เช่าเลือก occupancy เมื่อมีสิทธิ์มากกว่าหนึ่งรายการ
- เจ้าของหอหนึ่งคนดูแลหลายหอผ่าน property membership

### หอ อาคาร ชั้น ห้อง และผู้เช่า

- จัดการหอ การตั้งค่าหอ อาคาร ชั้น ห้อง และสถานะห้อง
- Room type, service charge และ furniture เป็นข้อมูล normalized ในฐานข้อมูล
- จัดการผู้เช่า occupancy และคำเชิญ
- ตรวจ ownership ทุกครั้งจาก backend

### สัญญา

- สร้างและแก้ไขสัญญา
- เก็บเวอร์ชันสัญญาเพิ่มขึ้นเรื่อย ๆ
- Lifecycle: draft, รอลงนาม, active, ใกล้หมดอายุ, หมดอายุ และยกเลิก
- รองรับผู้เช่าหลัก/ผู้พักร่วม
- อัปโหลดเอกสารสัญญาที่พิมพ์และเซ็นแล้ว

### มิเตอร์และบิล

- มิเตอร์น้ำและไฟ
- กรอกเลขครั้งก่อน/ครั้งปัจจุบันและคำนวณหน่วยใช้จริง
- คำนวณค่าเช่า ค่าน้ำ ค่าไฟ ค่าบริการ ค่าปรับล่าช้า และรายการอื่น
- สร้างบิลเดี่ยวหรือทั้งหอ
- สถานะ draft, pending, paid, overdue และ cancelled
- Background job ปรับบิลค้างชำระและค่าปรับตามกำหนด

### การชำระเงิน

- สร้าง PromptPay QR
- ผู้เช่าอัปโหลดสลิป
- เจ้าของหอตรวจสอบ อนุมัติ หรือปฏิเสธสลิป
- เก็บประวัติและสถานะการตรวจสอบ
- ระบบนี้ยังไม่ออกใบเสร็จ

### การสื่อสารและงานประจำหอ

- ประกาศแบบ draft/scheduled/published/archived และกำหนดกลุ่มผู้รับ
- พัสดุ พร้อมการจำกัดข้อมูลผู้รับตามสิทธิ์
- งานซ่อมและข้อร้องเรียน
- Priority, status, attachment และ ticket event history
- Chat ระหว่างผู้เช่ากับเจ้าของหอ
- Chat ระหว่างเจ้าของหอกับ Super Admin
- Chat รองรับ pagination/load older messages

### Dashboard และ SaaS

- Dashboard aggregation จากข้อมูลจริง
- แพ็กเกจ SaaS รายเดือน/รายปี
- Subscription order สำหรับซื้อใหม่และต่ออายุ
- Owner ส่งหลักฐานชำระค่าแพ็กเกจเอง
- Super Admin ตรวจสอบและอนุมัติ
- Background job สำหรับ subscription expiry

### เอกสารและการดูแลข้อมูล

- Document template และ generated document
- Retention policy สำหรับสลิป เอกสาร และไฟล์แนบแชต
- Audit log สำหรับ mutation สำเร็จ/ล้มเหลว
- Request ID สำหรับตามปัญหา

## 6. API ที่ฝั่งผู้เช่าจะใช้หลัก ๆ

- `POST /api/v1/tenant/register`
- `POST /api/v1/tenant/invitations/accept`
- `GET /api/v1/tenant/me`
- `GET|PUT /api/v1/tenant/occupancy-selection`
- `GET /api/v1/tenant/room`
- `GET /api/v1/tenant/lease`
- `GET /api/v1/tenant/lease/signed-document`
- `GET /api/v1/tenant/invoices`
- `GET /api/v1/tenant/invoices/{invoiceId}`
- `GET /api/v1/tenant/invoices/{invoiceId}/promptpay-qr`
- `POST /api/v1/tenant/invoices/{invoiceId}/payment-submissions`
- `GET /api/v1/tenant/announcements`
- `GET /api/v1/tenant/parcels`
- `GET /api/v1/tenant/parcels/{parcelId}/image`
- `GET|POST /api/v1/tenant/tickets`
- `GET|PATCH /api/v1/tenant/tickets/{ticketId}`
- API attachment ภายใต้ ticket
- `GET|POST /api/v1/tenant/chat`
- API chat attachment และ stream ภายใต้ `/api/v1/chat/*`

รายละเอียด query, request body, response และ error code ให้ตรวจจาก `docs/openapi.json` เสมอ เพราะรายการด้านบนเป็นเพียงแผนที่ภาพรวม

## 7. Workflow สำคัญที่ต้องเข้าใจตรงกัน

### ผู้เช่าเข้าระบบ

1. เจ้าของหอสร้าง invitation หรือให้รหัสหอ/รหัสเชิญ
2. ผู้เช่าสมัครใหม่ หรือบัญชีเดิมกดรับ invitation
3. occupancy อยู่ในสถานะรออนุมัติ
4. เจ้าของหออนุมัติ
5. ผู้เช่าเลือก occupancy ปัจจุบัน หากมีหลายรายการ
6. จากนั้นจึงเห็นห้อง สัญญา บิล ประกาศ พัสดุ ticket และ chat ตามสิทธิ์

### มิเตอร์ถึงการชำระบิล

1. เจ้าของหอบันทึกมิเตอร์
2. ระบบคำนวณหน่วยและค่าใช้จ่าย
3. เจ้าของหอสร้างบิลรายห้องหรือทั้งหอ
4. ผู้เช่าเปิดบิลและ PromptPay QR
5. ผู้เช่าอัปโหลดสลิป
6. เจ้าของหอตรวจสอบ
7. เมื่ออนุมัติ ระบบอัปเดตสถานะการชำระตามกฎธุรกิจ

### ซื้อหรือต่ออายุแพ็กเกจ

1. เจ้าของหอเลือกแพ็กเกจและสร้าง order
2. ส่งหลักฐานการชำระ
3. Super Admin ตรวจสอบ
4. เมื่ออนุมัติ subscription ถูกเปิดใช้หรือต่ออายุ

## 8. กติกาการพัฒนา

- ใช้ TypeScript และหลีกเลี่ยง `any`
- validation ฝั่ง client มีไว้ช่วย UX แต่ backend ต้องตรวจซ้ำเสมอ
- ทุกหน้าต้องมี loading, empty, error, success และ disabled state ตามความเหมาะสม
- ห้าม hardcode property, room, tenant, จำนวนเงิน, วันที่ หรือ summary
- ห้ามใช้ fallback จำลองเมื่อ API ล้มเหลว ให้แสดง error state
- ไม่เรียก Prisma จาก Client Component
- ไม่สร้าง business logic ซ้ำใน UI ให้ใช้ service/API กลาง
- ทุก list ที่อาจโตต้องรองรับ pagination
- ไฟล์ส่วนตัวต้องเปิดผ่าน authorized endpoint ห้ามใช้ storage path โดยตรง
- การเพิ่ม API ต้องมี Zod schema, authorization/ownership, OpenAPI และ tests
- อย่า commit `.env`, รหัสผ่านจริง, token, สลิป หรือข้อมูลส่วนบุคคล

## 9. การรันและตรวจงาน

คำสั่งหลัก:

```bash
npm install
npm run db:generate
npm run db:migrate
npm run dev
```

คำสั่งตรวจคุณภาพ:

```bash
npm run typecheck
npm run lint
npm test
npm run openapi:check
npm run test:integration
npm run test:e2e
npm run build
```

Integration/E2E ต้องใช้ PostgreSQL แยกที่ชื่อฐานข้อมูลมีคำว่า `test` ห้ามใช้ฐานข้อมูลหลัก เพราะ tests มีการสร้างและล้างข้อมูลทดสอบ

## 10. Environment ที่ต้องรู้

ดูรายการเต็มจาก `.env.example` ตัวสำคัญได้แก่:

- `DATABASE_URL`
- `APP_URL`
- `JOB_SECRET`
- `STORAGE_TYPE`
- `LOCAL_STORAGE_PATH`
- `AWS_REGION`, `AWS_S3_BUCKET`, `AWS_S3_PREFIX` เมื่อใช้ S3
- `RESEND_API_KEY`, `PASSWORD_RESET_EMAIL_FROM` สำหรับ reset password ใน production
- ค่า retention ของ slip/document/chat attachment

ทุกคนควรมี `.env` ของตนเองและไม่ส่งค่าความลับผ่าน Git

## 11. ก่อน merge งาน

ตรวจอย่างน้อย:

1. ใช้ API/enum/schema กลาง ไม่สร้างข้อมูลซ้ำ
2. ไม่มี mock หรือค่าคงที่หลงเหลือ
3. สิทธิ์ tenant เห็นเฉพาะ occupancy/property ของตัวเอง
4. รายการอ่าน `pageInfo`
5. error แสดงผลได้และมี `requestId`
6. typecheck, lint, unit tests และ OpenAPI check ผ่าน
7. ถ้าแก้ workflow สำคัญ ให้เพิ่ม integration/E2E test

