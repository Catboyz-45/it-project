# คู่มือ API ภาษาไทย

## สรุปจำนวน

โปรเจกต์มี **31 URL patterns** และ **39 HTTP operations** ใน `src/app/api` นับจากไฟล์ `route.ts` จริง ณ วันที่จัดทำเอกสาร

- Public/health: 4 URL, 4 operations
- Authentication: 7 URL, 7 operations
- CMS/Admin: 20 URL, 28 operations

`[id]`, `[slug]` และ `[kind]` หมายถึงค่าที่เปลี่ยนไปตามรายการ เช่น `/api/media/abc123` หรือ `/api/admin/content/products/abc123`

## วิธีอ่าน HTTP method

- `GET` อ่านข้อมูล
- `POST` สร้างข้อมูลหรือสั่ง action
- `PATCH` แก้บางช่อง
- `DELETE` ลบ ยกเลิก หรือย้ายข้อมูลตามบริบท

## API สาธารณะและตรวจสุขภาพระบบ

| Method | URL | ทำอะไร | สิทธิ์ |
|---|---|---|---|
| GET | `/api/health/live` | ยืนยันว่า process ของเว็บยังตอบสนอง | สาธารณะ ใช้โดยระบบ monitoring |
| GET | `/api/health/ready` | ตรวจว่าเว็บพร้อมรับงานและติดต่อฐานข้อมูลได้ | สาธารณะ แต่ไม่คืนข้อมูลลับ |
| GET | `/api/media/[id]` | ตรวจว่า media ถูกอ้างอิงโดยเนื้อหาสาธารณะหรือผู้ดูแลมีสิทธิ์ แล้ว redirect ไป signed URL | สาธารณะเฉพาะไฟล์ที่เผยแพร่; ผู้ดูแลดู private media ได้ |
| GET | `/api/catalogs/[slug]` | ดาวน์โหลด PDF catalog ของสินค้าที่เผยแพร่ | สาธารณะเฉพาะ catalog ที่พร้อมใช้งาน |

`/api/media/[id]` รับ query `width` 1–3000, `format` เป็น `webp` หรือ `avif`, และ `download` เป็น `0` หรือ `1` โดยค่าที่ไม่ถูกต้องจะถูกปฏิเสธ

## API ล็อกอินและ 2FA

| Method | URL | ข้อมูลหลักที่รับ | ทำอะไร |
|---|---|---|---|
| POST | `/api/auth/login` | `username`, `password` | ตรวจรหัสผ่าน สร้าง session ขั้นต้น และบอกหน้าถัดไป |
| POST | `/api/auth/password` | `password`, `confirm` | บังคับเปลี่ยน temporary password แล้วหมุน session |
| GET | `/api/auth/2fa/setup` | ไม่มี body | สร้างข้อมูล enrollment และ QR สำหรับบัญชีที่ยังไม่มี 2FA |
| POST | `/api/auth/2fa/setup/verify` | `code` 6 หลัก | ยืนยัน enrollment สร้าง recovery codes และเปิด 2FA |
| POST | `/api/auth/2fa/verify` | `code` 6 หลัก | ยืนยันรหัส TOTP และยกระดับ session เป็น fully authenticated |
| POST | `/api/auth/recovery` | `code` | ใช้ recovery code ครั้งเดียวแทน TOTP |
| POST | `/api/auth/logout` | ไม่มี body | revoke session และลบ cookie |

ทุก POST ในกลุ่มนี้ตรวจ same-origin, จำกัดจำนวนครั้งที่ลอง, ใช้ข้อความผิดพลาดแบบไม่ช่วยเดาชื่อบัญชี และไม่ส่ง password/TOTP secret กลับไปใน response

## API บัญชีตนเองและข้อมูลบริษัท

| Method | URL | ทำอะไร | สิทธิ์ |
|---|---|---|---|
| GET | `/api/admin/account` | อ่านชื่อแสดงผล username role และสถานะ 2FA ของตนเอง | ผู้ดูแลที่ผ่าน 2FA |
| PATCH | `/api/admin/account` | แก้ `displayName` หรือเปลี่ยนรหัสผ่านด้วยรหัสเดิม | ผู้ดูแลที่ผ่าน 2FA |
| GET | `/api/admin/company` | อ่านข้อมูลบริษัทสำหรับหน้าแก้ไข | Editor / Super Admin |
| PATCH | `/api/admin/company` | แก้ชื่อบริษัท ประวัติ วิสัยทัศน์ ที่อยู่ ช่องทางติดต่อ SEO และ logo | Editor / Super Admin |
| GET | `/api/admin/audit` | ค้นและแบ่งหน้า audit history | Super Admin เท่านั้น |
| GET | `/api/admin/trash` | รวมรายการที่อยู่ในถังขยะทุกชนิด | Editor เห็น content; Super Admin เห็น admin เพิ่มด้วย |

## API เนื้อหา CMS

`[kind]` รับได้เฉพาะ `banners`, `services`, `products`, `projects`, `news`

| Method | URL | ทำอะไร |
|---|---|---|
| GET | `/api/admin/content/[kind]` | แสดงรายการแบบแบ่งหน้า ค้นหา กรองสถานะ และเรียงลำดับ |
| POST | `/api/admin/content/[kind]` | สร้างรายการใหม่หลัง Zod ตรวจทุกช่อง |
| GET | `/api/admin/content/[kind]/[id]` | อ่านรายการเดียวสำหรับหน้าแก้ไข |
| PATCH | `/api/admin/content/[kind]/[id]` | แก้รายการเดิมและความสัมพันธ์ เช่น gallery/service/category |
| POST | `/api/admin/content/[kind]/[id]/transition` | สั่ง `publish`, `unpublish`, `archive`, `trash`, `restore` หรือ `delete` |

Query ของรายการรองรับ `page`, `pageSize` ไม่เกิน 100, `query`, `status` และ `sort` เฉพาะค่าที่ allowlist ไว้ การสร้างและแก้ไขรับคนละ schema ตามชนิดข้อมูล; รายการช่องทั้งหมดอยู่ที่ `src/server/cms/schemas.ts`

## API หมวดหมู่ (Taxonomy)

`[kind]` รับได้เฉพาะ `brands`, `product-types`, `news-categories`

| Method | URL | ทำอะไร |
|---|---|---|
| GET | `/api/admin/taxonomies/[kind]` | อ่านรายการหมวด |
| POST | `/api/admin/taxonomies/[kind]` | สร้างหมวดจาก `name`, `slug`, `sortOrder`, `isActive` |
| PATCH | `/api/admin/taxonomies/[kind]/[id]` | แก้หมวด |
| DELETE | `/api/admin/taxonomies/[kind]/[id]` | ลบตามกฎอ้างอิง; จะไม่ลบถ้ายังทำให้ข้อมูลเสียความสัมพันธ์ |
| POST | `/api/admin/taxonomies/[kind]/[id]/transition` | trash, restore หรือ delete ตาม action ที่อนุญาต |

## API รูปภาพและ PDF

| Method | URL | ทำอะไร |
|---|---|---|
| GET | `/api/admin/media` | ค้นและแบ่งหน้ารายการ media |
| POST | `/api/admin/media/uploads` | ตรวจชื่อ/MIME/ขนาด สร้างแถว `UPLOADING` และคืน signed upload URL |
| POST | `/api/admin/media/uploads/[id]/complete` | ตรวจไฟล์จริง checksum/signature/malware hook สร้างรูปย่อ และเปลี่ยนเป็น `READY` |
| DELETE | `/api/admin/media/uploads/[id]` | ยกเลิก upload ที่ยังไม่เสร็จและเข้าคิว cleanup |
| PATCH | `/api/admin/media/[id]` | แก้ alt text ของ media |
| DELETE | `/api/admin/media/[id]` | ลบ media เมื่อผู้ใช้มีสิทธิ์และไม่มีข้อมูลอื่นอ้างอิง |

รูป JPEG/PNG/WebP จำกัด 10 MB ต่อไฟล์, PDF จำกัด 20 MB และระบบตรวจทั้งนามสกุล MIME ที่แจ้ง และ signature ของไฟล์จริง

## API จัดการผู้ดูแล

ทุกเส้นทางในกลุ่มนี้ต้องเป็น Super Admin ที่ active และผ่าน 2FA

| Method | URL | ทำอะไร |
|---|---|---|
| GET | `/api/admin/users` | อ่านรายชื่อผู้ดูแลที่ไม่อยู่ในถังขยะ |
| POST | `/api/admin/users` | สร้าง Editor/Super Admin และคืน temporary password ครั้งเดียว |
| PATCH | `/api/admin/users/[id]` | แก้ชื่อ role หรือ active status โดยใช้กฎป้องกัน Super Admin คนสุดท้าย |
| POST | `/api/admin/users/[id]/transition` | disable, enable, trash, restore หรือ delete บัญชีตามกฎ |
| POST | `/api/admin/users/[id]/reset-password` | ออก temporary password ใหม่ บังคับเปลี่ยน และ revoke session เดิม |
| POST | `/api/admin/users/[id]/reset-2fa` | ล้าง secret/recovery codes เดิมและบังคับ enrollment ใหม่ |

## รูปแบบความสำเร็จและข้อผิดพลาด

- สำเร็จทั่วไปคืน JSON เช่น `{ "success": true }`, `{ "item": ... }` หรือ `{ "items": [...] }`
- สร้างสำเร็จใช้ HTTP 201, ลบสำเร็จแบบไม่มี body ใช้ 204
- ข้อมูลผิดใช้ 400, ยังไม่ล็อกอินใช้ 401, ไม่มีสิทธิ์หรือ origin ผิดใช้ 403, ไม่พบใช้ 404, ชนกฎข้อมูลใช้ 409, ถูก rate limit ใช้ 429 และ dependency ไม่พร้อมใช้ 503
- API ที่เป็นข้อมูลส่วนตัวกำหนด `Cache-Control: no-store`
- ข้อความต่อผู้ใช้เป็นข้อความทั่วไป รายละเอียดจริงใช้ request ID และ structured log สำหรับตรวจสอบภายใน

## หมายเหตุสำหรับการเปลี่ยน API

เมื่อเพิ่ม route ใหม่ ต้องเพิ่ม validation, authentication, authorization, origin/CSRF protection สำหรับคำสั่งเปลี่ยนข้อมูล, audit event ที่เหมาะสม, tests และอัปเดตเอกสารนี้ ห้ามรับ object แล้วส่งเข้า Prisma ทั้งก้อน เพราะเสี่ยง mass assignment
