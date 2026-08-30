# คู่มือฐานข้อมูลฉบับอ่านง่าย

## ภาพรวม

ระบบใช้ PostgreSQL และ Prisma โดยมี **21 models/tables** ใน `prisma/schema.prisma` แบ่งเป็น 5 กลุ่ม ข้อมูลจริงอยู่ใน PostgreSQL; ไฟล์ schema เป็นแผนผังและ Prisma migrations เป็นประวัติการเปลี่ยนแผนผัง

คำศัพท์สำคัญ:

- **แถว (row)** คือข้อมูลหนึ่งรายการ เช่น สินค้าหนึ่งชิ้น
- **คอลัมน์ (column)** คือช่องข้อมูล เช่น ชื่อหรือวันที่
- **Primary key / `id`** คือรหัสไม่ซ้ำของแต่ละแถว
- **Foreign key** คือรหัสที่เชื่อมไปยังอีกตาราง เช่น `Product.brandId` เชื่อม `Brand.id`
- **Index** คือสารบัญช่วยค้นหาเร็วขึ้น
- **Unique** คือกฎห้ามข้อมูลซ้ำ
- **Transaction** คือหลายคำสั่งที่ต้องสำเร็จทั้งหมดหรือยกเลิกทั้งหมด

## กลุ่มข้อมูลเว็บไซต์ (9 ตาราง)

| ตาราง | เก็บอะไร | ความสัมพันธ์สำคัญ |
|---|---|---|
| `Company` | ข้อมูลบริษัทหนึ่งชุด ชื่อ ประวัติ วิสัยทัศน์ ที่อยู่ ติดต่อ SEO และ logo | logo เชื่อม `Media`; `singletonKey` บังคับให้มีชุดหลักเดียว |
| `Banner` | banner หน้าแรก ปุ่ม รูป ลำดับ และสถานะ | image เชื่อม `Media` |
| `Service` | บริการ slug ชื่อ เนื้อหา SEO รูป และ featured | เชื่อม Project ผ่าน `ProjectService` |
| `Brand` | ยี่ห้อสินค้า | หนึ่ง Brand มีหลาย Product |
| `ProductType` | ประเภทสินค้า | หนึ่ง ProductType มีหลาย Product |
| `Product` | สินค้า รุ่น BTU สเปก ประกัน SEER สารทำความเย็น ราคา รูป/PDF และสถานะ | ต้องมี Brand และ ProductType; gallery ผ่าน `ProductMedia` |
| `Project` | ผลงาน ประเภท พื้นที่ ลูกค้า รายละเอียด วันที่ รูป และสถานะ | gallery ผ่าน `ProjectMedia`; บริการผ่าน `ProjectService` |
| `NewsCategory` | หมวดข่าว | หนึ่งหมวดมีหลาย News |
| `News` | ข่าว/บทความ slug เนื้อหา SEO หมวด รูป และเวลาเผยแพร่ | ต้องมี NewsCategory |

## ตารางเชื่อมความสัมพันธ์หลายต่อหลาย (3 ตาราง)

| ตาราง | เหตุผลที่ต้องมี |
|---|---|
| `ProductMedia` | สินค้าหนึ่งชิ้นมีหลายรูป และ media เดียวจัดการเป็นรายการแยก พร้อม `sortOrder` |
| `ProjectMedia` | ผลงานหนึ่งชิ้นมีหลายรูป พร้อมลำดับแสดงผล |
| `ProjectService` | ผลงานหนึ่งงานเกี่ยวข้องได้หลายบริการ และบริการหนึ่งอยู่ในหลายผลงาน |

ตารางเชื่อมใช้รหัสของสองฝั่งร่วมกันเป็น primary key จึงเพิ่มความสัมพันธ์เดิมซ้ำไม่ได้

## กลุ่มไฟล์ (3 ตาราง)

| ตาราง | เก็บอะไร |
|---|---|
| `Media` | metadata ของไฟล์ เช่น object key, MIME, ขนาด, checksum, กว้าง/สูง, alt text, privacy และสถานะ upload |
| `MediaVariant` | รูปแปลงขนาด/format เช่น WebP และ AVIF โดยอ้างกลับไป Media ต้นฉบับ |
| `StorageCleanupJob` | คิวลบ object ใน S3 แบบ retry ได้ ป้องกันกรณีฐานข้อมูลสำเร็จแต่ storage ชั่วคราวล้มเหลว |

ตัวไฟล์ไม่ได้เก็บใน PostgreSQL แต่เก็บใน S3 ส่วนฐานข้อมูลเก็บ “ที่อยู่ภายใน bucket” และรายละเอียดที่จำเป็น ระบบไม่ส่ง object key ตรงให้ผู้ใช้ แต่สร้าง URL อายุสั้นเมื่อผ่านสิทธิ์

สถานะ Media:

- `UPLOADING` กำลังอัปโหลด
- `PROCESSING` อัปโหลดแล้ว กำลังตรวจ/แปลงไฟล์
- `READY` ใช้งานได้
- `FAILED` ไม่ผ่านหรือประมวลผลไม่สำเร็จ

## กลุ่มผู้ดูแลและความปลอดภัย (5 ตาราง)

| ตาราง | เก็บอะไร | สิ่งที่ไม่เก็บ |
|---|---|---|
| `Admin` | username แบบ normalize, display name, role, password hash, encrypted TOTP, สถานะบัญชี | ไม่เก็บรหัสผ่านจริงหรือ TOTP แบบอ่านตรง ๆ |
| `Session` | hash ของ session token, เจ้าของ, วันหมดอายุ, เวลา 2FA, เวลาถูก revoke | ไม่เก็บ token ที่อยู่ใน cookie แบบ plaintext |
| `RecoveryCode` | hash ของ recovery code และเวลาที่ใช้ | ไม่เก็บ code ที่นำกลับมาแสดงได้ |
| `AuditLog` | actor, action, target, result, request ID, IP, user agent, metadata ปลอดภัย | ห้ามเก็บ password, cookie, token, secret หรือ recovery code |
| `AuthThrottle` | จำนวนครั้งที่ยืนยันตัวตนผิดและเวลาปลดล็อก | ไม่เก็บ password หรือ OTP ที่กรอกผิด |

## ตารางสนับสนุน SEO (1 ตาราง)

| ตาราง | เก็บอะไร |
|---|---|
| `Redirect` | URL เก่าและ URL ใหม่ เมื่อ slug ที่เผยแพร่เปลี่ยน พร้อมสถานะ 301 และจำนวนครั้งที่ถูกเรียก |

## กฎสำคัญของข้อมูล

- `usernameNormalized` และ slug มี unique constraint/index เพื่อป้องกันชื่อซ้ำแบบต่างตัวพิมพ์
- Product หนึ่ง Brand ห้ามมี model ซ้ำกัน
- `btuMin` และ `btuMax` ต้องเป็นค่าบวก และค่าต่ำสุดต้องไม่มากกว่าค่าสูงสุด
- `seer`, ขนาดไฟล์, กว้าง และสูงต้องเป็นค่าบวกเมื่อมีค่า
- `purgeAt` ต้องไม่ก่อน `deletedAt`
- Redirect ต้องเริ่มด้วย `/`, ห้ามชี้กลับ path เดิม และ status ใช้ค่าที่กำหนด
- Foreign key แบบ `Restrict` ป้องกันลบ Brand/Service/Media ที่ยังถูกอ้างอิง
- Foreign key แบบ `Cascade` ใช้กับข้อมูลลูกที่ไม่มีความหมายเมื่อแม่ถูกลบ เช่น gallery links และ sessions
- Foreign key แบบ `SetNull` ใช้เมื่อเก็บ record หลักต่อได้โดยเอาความสัมพันธ์ออก เช่น cover image

กฎระดับ application ยังจำเป็นแม้มี constraint เช่น “ห้ามลบ Super Admin คนสุดท้าย” ต้องตรวจใน transaction เพื่อกันคำขอสองรายการชนกัน

## วันที่ที่พบบ่อย

| ช่อง | ความหมาย |
|---|---|
| `createdAt` | สร้างเมื่อใด |
| `updatedAt` | แก้ล่าสุดเมื่อใด |
| `publishedAt` | เริ่มเผยแพร่เมื่อใด |
| `deletedAt` | ย้ายลงถังขยะเมื่อใด |
| `purgeAt` | เริ่มมีสิทธิ์ลบถาวรเมื่อใด |
| `expiresAt` | session/upload หมดอายุเมื่อใด |
| `revokedAt` | session ถูกยกเลิกเมื่อใด |

เวลาในฐานข้อมูลใช้ timezone-aware timestamp ส่วนหน้าเว็บแปลงเป็นเขตเวลาไทยเมื่อแสดง

## การเปลี่ยน schema อย่างปลอดภัย

1. แก้ `prisma/schema.prisma`
2. สร้าง migration ใหม่ด้วย `npm run db:migrate:dev`
3. อ่าน SQL ที่สร้างขึ้น โดยเฉพาะคำสั่ง drop, unique และ not-null
4. รัน `npx prisma format`, `npm run db:validate`, tests และ build
5. สำรองข้อมูลและทดลองกับ staging ก่อน `npm run db:migrate:deploy` ใน production

ห้ามแก้ migration ที่ถูกใช้แล้ว ห้ามใช้ `prisma db push` แทน reviewed migration ใน production และห้ามรัน destructive test กับฐานข้อมูลจริง

รายละเอียดคำสั่ง backup, restore และ rollback อยู่ใน [DATABASE.md](./DATABASE.md)
