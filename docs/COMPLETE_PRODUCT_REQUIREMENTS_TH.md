# ข้อกำหนดผลิตภัณฑ์และการออกแบบระบบบริหารหอพักฉบับสมบูรณ์

> เอกสารนี้เป็น Product Requirement Document (PRD), UX/UI Specification และบริบทส่งต่องานสำหรับ AI หรือนักพัฒนาคนถัดไปในไฟล์เดียว

## 0. วิธีใช้เอกสารนี้

- ใช้เอกสารนี้เป็น source of truth ด้านเป้าหมายผลิตภัณฑ์ ขอบเขต บทบาท workflow และข้อมูลที่แต่ละหน้าต้องแสดง
- ใช้ `prisma/schema.prisma` เป็น source of truth ด้านโครงสร้างฐานข้อมูลจริง
- ใช้ `docs/openapi.json` เป็น source of truth ด้าน API contract จริง
- ใช้ enum จาก `lib/domain/enums.ts` และ Prisma generated types ห้ามสร้าง enum ซ้ำใน UI
- หากเอกสารนี้ไม่ตรงกับโค้ด ให้ตรวจ requirement ก่อน แล้วแก้โค้ด OpenAPI tests และเอกสารในงานเดียวกัน
- ห้ามเติม mock, fallback summary หรือค่าจำลองเพื่อทำให้หน้า “ดูเหมือนมีข้อมูล” เมื่อ API ล้มเหลว
- ชื่อ “บ้านอยู่สบาย” และ “หอ E2E อยู่สบาย” เป็นข้อมูลทดลอง ไม่ใช่ชื่อแพลตฟอร์ม
- ชื่อแพลตฟอร์มคือ Nestly ส่วนชื่อหอพักเป็นข้อมูลของแต่ละ Property และไม่ใช่ชื่อแพลตฟอร์ม

---

## 1. วิสัยทัศน์ ปัญหาที่แก้ และเป้าหมาย

ระบบนี้เป็นแพลตฟอร์ม SaaS สำหรับให้เจ้าของหอหลายรายสมัครและบริหารหอพักของตนบนระบบเดียวกัน โดยข้อมูลของแต่ละหอต้องแยกจากกันอย่างปลอดภัย

### 1.1 ปัญหาที่ระบบแก้

กระบวนการเดิมของหอพักมักกระจายอยู่ในสมุด กระดาษ Excel LINE และไฟล์หลายแห่ง ทำให้:

- ข้อมูลห้อง ผู้เช่า สัญญา มิเตอร์ บิล และสลิปไม่สัมพันธ์กัน
- คำนวณยอดผิดหรือตกหล่นได้ง่าย
- ติดตามผู้เช่ารออนุมัติ สลิปรอตรวจ บิลค้าง งานซ่อม และพัสดุได้ยาก
- ผู้เช่าไม่เห็นข้อมูลล่าสุดของตัวเองและต้องถามเจ้าของหอซ้ำ
- ไม่มีประวัติว่าใครแก้อะไร เมื่อใด และสำเร็จหรือไม่
- เจ้าของหลายหอไม่สามารถดูภาพรวมและสลับหอในระบบเดียวได้สะดวก
- ผู้ดูแลแพลตฟอร์มไม่มีเครื่องมืออนุมัติบัญชี ควบคุมแพ็กเกจ และตรวจการชำระ SaaS

### 1.2 เป้าหมายหลัก

1. รวมข้อมูลและงานบริหารหอไว้ในระบบเดียว
2. ทำ workflow ตั้งแต่รับผู้เช่า สัญญา มิเตอร์ บิล ชำระเงิน และติดตามงานให้ต่อเนื่อง
3. ให้ผู้เช่าดูและดำเนินการกับข้อมูลของตัวเองได้ผ่านเว็บ โดยเฉพาะบนมือถือ
4. ให้ Super Admin กำกับแพลตฟอร์ม SaaS หลายเจ้าของ/หลายหอได้
5. ให้ระบบใช้งานได้จริงในระดับโปรเจกต์จบ โดยยึดความปลอดภัย ความถูกต้อง และการตรวจสอบย้อนหลัง

### 1.3 งานสำคัญที่สุดสามกลุ่ม

- Owner: รับผู้เช่า → สัญญา → มิเตอร์ → บิล → ตรวจสลิป
- Tenant: เห็นยอด/ครบกำหนด → จ่ายและติดตามผล → ติดต่อหอ
- Super Admin: อนุมัติ Owner → กำกับหอ/แพ็กเกจ → ตรวจ Subscription/Audit

### 1.4 ตัวชี้วัด UX

- Task completion ของ critical journey อย่างน้อย 90%
- Critical error หรือข้อมูลสูญหายต้องเป็น 0
- ความมั่นใจเฉลี่ยหลังทำงานอย่างน้อย 4/5
- ไม่มี page-level horizontal overflow ที่ 390, 768, 1024 และ 1440 px
- ทุก action สำคัญใช้งานด้วย keyboard ได้
- S0/S1 จาก usability test ต้องแก้และ retest ก่อน release

---

## 2. ขอบเขตผลิตภัณฑ์

### 2.1 อยู่ในขอบเขต

- Multi-tenant SaaS สำหรับหลายเจ้าของและหลายหอ
- บัญชี การอนุมัติ รหัสผ่านชั่วคราว และกู้รหัสผ่าน
- หอ อาคาร ชั้น ห้อง สิ่งอำนวยความสะดวก และสถานะห้อง
- Tenant profile, invitation, occupancy, ผู้เช่าหลัก และผู้พักร่วม
- สัญญา version lifecycle และเอกสารเซ็นแล้ว
- มิเตอร์น้ำ/ไฟและการคำนวณแบบต่อหน่วยในรุ่นแรก
- บิลรายห้องและทั้งหอ ค่าปรับ และยอดค้าง
- PromptPay QR, upload slip และ Owner review
- ประกาศ พัสดุ งานซ่อม ข้อร้องเรียน และ chat
- Dashboard aggregation, search, filter, pagination และ CSV export ในข้อมูลที่เหมาะสม
- SaaS plan, subscription order/payment/review/renewal และ expiry enforcement
- Audit log, request ID, retention policy และ background jobs
- Web responsive สำหรับคอมพิวเตอร์ แท็บเล็ต และมือถือ

### 2.2 ไม่อยู่ในขอบเขตรุ่นแรก

- ระบบจองห้องก่อนเข้าพัก
- แอป native iOS/Android
- ระบบบัญชี ภาษี VAT ใบกำกับภาษี หรือใบเสร็จเต็มรูปแบบ
- การชำระบางส่วน เครดิตคงเหลือ หรือชำระเกินแบบบัญชีลูกหนี้เต็มรูปแบบ
- ระบบลายเซ็นอิเล็กทรอนิกส์ตามกฎหมาย; รุ่นแรกใช้พิมพ์ เซ็น และอัปโหลด
- AI feature หรือ recommendation
- Permission ย่อย เช่น การเงิน พัสดุ ช่าง; รุ่นแรก PROPERTY_ADMIN ของหอเดียวกันมีสิทธิ์เท่ากัน
- Anonymous complaint ในรุ่นแรก
- ผังห้องแบบตำแหน่งจริง; รุ่นแรกใช้การ์ด/ตารางแยกอาคารและชั้น

### 2.3 เรื่องที่รองรับเชิงสถาปัตยกรรมแต่ไม่ใช่ primary flow รุ่นแรก

- Payment Gateway: requirement ระยะยาวรองรับได้ แต่ critical flow ปัจจุบันเน้น PromptPay QR + slip review
- Utility pricing ที่ซับซ้อน เช่น ขั้นต่ำ เหมาจ่าย หรือหลายขั้น: ออกแบบเพิ่มได้ภายหลัง รุ่นแรกใช้เลขมิเตอร์และอัตราคงที่รายหอ
- หลายสัญญาต่อบุคคล: เก็บประวัติได้ แต่หนึ่ง occupancy ปัจจุบันควรมีสัญญาที่ active อย่างชัดเจน

---

## 3. ผู้ใช้งานและสิทธิ์

### 3.1 `SUPER_ADMIN`

ผู้ดูแลแพลตฟอร์ม ไม่ใช่ผู้ดูแลกิจการประจำวันของแต่ละหอ

ทำได้:

- สร้างบัญชี Owner/Property Admin
- อนุมัติหรือปฏิเสธบัญชี Owner
- ออกรหัสผ่านชั่วคราวและบังคับเปลี่ยนรหัสผ่าน
- เปิด/ปิดการใช้งานบัญชีตามกฎ
- สร้าง ดู แก้ไข และปิดขายแพ็กเกจ SaaS
- ดูหอทั้งหมดและรายละเอียดระดับกำกับดูแล
- ตรวจหลักฐานชำระค่า Subscription
- เปิดใช้หรือต่ออายุ Subscription ตาม payment review
- ดู Dashboard แพลตฟอร์มและ Audit Log
- สนทนากับ Owner ผ่าน support chat

ไม่ควรทำโดยตรง:

- แก้ข้อมูลผู้เช่า บิล มิเตอร์ หรือสัญญาแทน Owner ใน workflow ปกติ
- เห็นไฟล์ส่วนตัวโดยไม่มีเหตุผล/endpoint ที่อนุญาต

### 3.2 `PROPERTY_ADMIN` หรือ Owner

คำว่า Owner, เจ้าของหอ และ Property Admin หมายถึง role เดียวกันในระบบ

- หนึ่งบัญชีดูแลได้หลายหอผ่าน `PropertyMembership`
- หนึ่งหอมีผู้ดูแลหลายบัญชีได้
- รุ่นแรกผู้ดูแลทุกคนในหอเดียวกันมีสิทธิ์เท่ากัน ไม่มีสิทธิ์ย่อย
- ทุก query/mutation ต้องตรวจ membership ของ property นั้นจาก backend

ทำได้ภายในหอที่เป็นสมาชิก:

- จัดการโครงสร้างหอ ห้อง และตั้งค่า
- สร้าง invitation และอนุมัติ occupancy
- ดู/แก้ข้อมูลผู้เช่าในขอบเขตที่อนุญาต
- สร้าง version และเปลี่ยนสถานะสัญญา
- บันทึกมิเตอร์และสร้างบิล
- ตรวจสลิปและอัปเดตสถานะการชำระ
- จัดการประกาศ พัสดุ ticket และ chat
- ส่งออกข้อมูล
- ซื้อ/ต่ออายุแพ็กเกจ ส่งสลิป และติดต่อ Super Admin

### 3.3 `TENANT`

- สมัครด้วย invitation code หรือบัญชีเดิมรับ invitation เพิ่ม
- Account approval และ occupancy approval เป็นคนละเรื่อง
- Tenant account อาจใช้งานได้ แต่ยังเข้า occupancy ใหม่ไม่ได้จน Owner อนุมัติ
- Tenant เลือก occupancy ปัจจุบันได้เมื่อมีหลายรายการ
- เห็นเฉพาะ property, room, occupancy, lease, invoice, parcel, ticket และ chat ที่ตนมีสิทธิ์
- `PRIMARY` คือผู้เช่าหลัก และ `CO_OCCUPANT` คือผู้พักร่วม
- Owner เป็นผู้กำหนด/อนุมัติบทบาท occupancy ตาม invitation และ workflow

ทำได้:

- ดูข้อมูลหอและห้องของการเข้าพักที่เลือก
- ดูสัญญาและดาวน์โหลดเอกสารที่อนุญาต
- ดูบิล รายการค่าใช้จ่าย วันครบกำหนด และสถานะ
- เปิด PromptPay QR และส่งสลิป
- ส่งสลิปใหม่ในบิลเดิมเมื่อถูกปฏิเสธ พร้อมเห็นเหตุผล/ประวัติ
- ดูประกาศและพัสดุของตน
- สร้าง/ตอบ ticket งานซ่อมหรือข้อร้องเรียน
- Chat กับ Owner
- แก้ profile บางส่วน เปลี่ยนรหัสผ่าน รับ invitation เพิ่ม และสลับ occupancy

---

## 4. กฎสิทธิ์และความเป็นเจ้าของข้อมูล

1. Authorization ทำที่ server ทุกครั้ง ห้ามเชื่อ role/propertyId/tenantProfileId/roomId จาก client
2. Owner เข้าถึง property ได้เมื่อมี `PropertyMembership` เท่านั้น
3. ไม่ใช้ `ownerUserId` เป็นกฎสิทธิ์อีกชุด; membership เป็นกฎกลางเดียว
4. Tenant access ต้องไล่จาก session user → tenant profile → occupancy → record ownership
5. Super Admin route ต้องตรวจ `SUPER_ADMIN`
6. ไฟล์ส่วนตัวต้องดาวน์โหลดผ่าน authorized endpoint ห้ามเปิด storage path โดยตรง
7. Parcel ต้องเปิดเผยชื่อ/ข้อมูลผู้รับเท่าที่จำเป็นต่อผู้มีสิทธิ์
8. Audit failure ต้องผูก actor/property เมื่อหาได้อย่างปลอดภัย
9. Subscription `READ_ONLY` ยังอ่าน ค้นหา และดาวน์โหลดข้อมูลเดิมได้ แต่ห้าม mutation ทางธุรกิจ ยกเว้น flow ต่ออายุ/ติดต่อ support ที่กำหนด
10. UI ซ่อนหรือ disabled action เพื่ออธิบาย UX แต่ backend ต้อง deny ซ้ำเสมอ

---

## 5. โมเดลข้อมูลเชิงธุรกิจ

### 5.1 บัญชีและขอบเขต

- User
- Session
- Password reset token
- Account approval decision
- Property
- Property membership
- Tenant profile
- Room occupancy
- Tenant invitation

### 5.2 โครงสร้างหอ

- Property
- Property settings
- Building
- Floor
- Room
- Room type/catalog
- Furniture/catalog และความสัมพันธ์กับห้อง
- Service charge/catalog

กฎสำคัญ:

- ข้อมูลรถเป็นของ Tenant/occupancy ไม่ใช่ Room
- ผู้พักร่วมต้องเป็น occupancy จริง ห้ามเก็บ textarea ซ้ำใน Room
- Furniture ต้องเป็นข้อมูล normalized ไม่ใช่ string JSON กระจัดกระจาย

### 5.3 สัญญาและการเข้าพัก

- Lease
- Lease version
- Lease tenant
- Signed document
- Occupancy transition สำหรับย้ายห้อง/ย้ายออก
- Deposit ใช้ในสัญญาและ settlement ตอนย้ายออก

### 5.4 การเงิน

- Meter reading แยกน้ำ/ไฟและรอบเดือน
- Invoice
- Invoice item เช่น RENT, WATER, ELECTRICITY, SERVICE, LATE_FEE, OTHER
- Payment submission
- Subscription order/payment

### 5.5 งานและการสื่อสาร

- Announcement และ audience/target
- Announcement read state
- Parcel และ recipient/occupancy
- Service ticket, ticket reply, attachment และ event history
- Chat conversation/message/attachment/read state
- Notification/read state

### 5.6 Platform operations

- SaaS plan
- Property subscription
- Audit log
- API rate limit
- Document template/generated document
- Retention policy metadata

---

## 6. สถานะและ lifecycle

ชื่อ enum จริงให้ยึด schema/enum กลาง ข้อความต่อไปนี้อธิบายความหมายที่ UI ต้องสื่อเป็นภาษาไทย

### 6.1 Account approval

```text
PENDING → APPROVED
       ↘ REJECTED
```

- PENDING: มีบัญชีแล้ว แต่ Owner ยัง login ไม่ได้
- APPROVED: login ได้เมื่อ `isActive=true`
- REJECTED: login ไม่ได้ และ session เดิมต้องถูกเพิกถอน
- `isActive` เป็นการระงับเชิงปฏิบัติการ แยกจาก approval
- Temporary password ต้องบังคับเปลี่ยนก่อนเข้า workspace

### 6.2 Invitation

- ACTIVE/available: ใช้รับคำเชิญได้
- ACCEPTED: ถูกใช้แล้ว
- EXPIRED: หมดอายุ
- REVOKED/CANCELLED: Owner ยกเลิก

UI ต้องแสดง code, ห้อง, role ที่เชิญ, วันหมดอายุ, ผู้สร้าง และสถานะ ห้ามแสดง enum ดิบ

### 6.3 Occupancy

- PENDING: รอ Owner อนุมัติ
- ACTIVE: พักอาศัยปัจจุบัน
- REJECTED: ไม่อนุมัติ
- ENDED: สิ้นสุดการเข้าพัก

Role occupancy:

- PRIMARY: ผู้เช่าหลัก
- CO_OCCUPANT: ผู้พักร่วม

### 6.4 Room

- AVAILABLE: ว่าง
- OCCUPIED: มีผู้พัก
- MAINTENANCE: ซ่อมบำรุง
- INACTIVE: ไม่เปิดใช้งาน

Room status ต้องสัมพันธ์กับ occupancy transition ห้ามให้ client เปลี่ยนสถานะขัดกับข้อมูลจริงโดยไม่มี business operation

### 6.5 Lease

```text
DRAFT → PENDING_SIGNATURE → ACTIVE → EXPIRING → EXPIRED
   ↘ CANCELLED            ↘ CANCELLED
```

- การแก้เนื้อหาสัญญาต้องสร้าง version ใหม่ ไม่เขียนทับประวัติ
- การเปิด ACTIVE ต้องมีเอกสารเซ็นแล้วตามกฎรุ่นแรก
- รุ่นแรก: พิมพ์/ดาวน์โหลด → เซ็นนอกระบบ → Owner อัปโหลด → เปลี่ยนสถานะ
- ไม่ใช้ e-signature เป็น requirement บังคับ

### 6.6 Meter reading

- Draft/ยังไม่ครบ
- Saved/บันทึกแล้ว
- Duplicate/conflict สำหรับห้องและรอบเดิม
- Abnormal usage เมื่อค่าผิดปกติหรือน้อยกว่าครั้งก่อน

กฎคำนวณรุ่นแรก:

```text
unitsUsed = currentReading - previousReading
waterAmount = waterUnits × propertyWaterUnitRate
electricityAmount = electricityUnits × propertyElectricityUnitRate
invoiceSubtotal = rent + water + electricity + services + otherItems
invoiceTotal = subtotal + lateFee
```

เลขปัจจุบันต้องไม่น้อยกว่าเลขครั้งก่อน และต้องมีรอบเดือน/ปีชัดเจน

### 6.7 Invoice

- DRAFT: Owner ยังตรวจ/แก้ก่อนออกบิลได้
- PENDING/ISSUED: เผยแพร่และรอชำระ
- OVERDUE: เลยกำหนดและ background job คำนวณค่าปรับ
- PAID: Owner อนุมัติหลักฐานแล้ว
- CANCELLED: ยกเลิก แต่เก็บประวัติ

รุ่นแรกหนึ่งบิลต่อยอดเต็มจำนวน ไม่รองรับ partial/overpayment อัตโนมัติ หากยอดไม่ตรง Owner ปฏิเสธพร้อมเหตุผล

หลังเผยแพร่ไม่ควรแก้ยอดเดิมเงียบ ๆ ต้องยกเลิก/สร้าง version หรือใช้ operation ที่เก็บ audit ตามกฎ backend

### 6.8 Payment submission

- PENDING_REVIEW: รอ Owner ตรวจ
- APPROVED: ยืนยันรับชำระและทำให้บิล paid ตามกฎ
- REJECTED: แสดงเหตุผล และ Tenant ส่งใหม่ใน invoice เดิมได้

Owner ต้องเห็น:

- ภาพ/ไฟล์สลิป
- ผู้เช่า ห้อง เลขบิล
- ยอดบิลและยอดที่ผู้เช่าระบุ
- วันเวลาส่ง/วันเวลาที่เกี่ยวข้อง
- คำเตือนยอดหรือเวลาผิดปกติ
- ประวัติการส่งและการปฏิเสธ

### 6.9 Ticket

- OPEN
- IN_PROGRESS
- RESOLVED
- CLOSED

ประเภทหลัก:

- REPAIR งานซ่อม
- COMPLAINT ข้อร้องเรียน

แสดงอยู่ใน Operations เดียวกันได้ แต่ต้องมี tab/filter แยกประเภทและข้อความเฉพาะบริบท

### 6.10 Parcel

- WAITING รอรับ
- RECEIVED/PICKED_UP รับแล้ว

พัสดุควรผูก recipient tenant/occupancy เมื่อระบุได้ และใช้ room เป็นบริบท ไม่ผูกเพียงข้อความชื่อ

### 6.11 Announcement

- DRAFT
- SCHEDULED
- PUBLISHED
- CANCELLED/ARCHIVED

Background job ต้องเผยแพร่ประกาศที่ถึงเวลา Audience รองรับทุกคนในหอและ target ที่ระบบมีจริง เช่น อาคาร ชั้น ห้อง หรือราย occupancy ตาม endpoint/schema

### 6.12 Subscription

- Order: PENDING_PAYMENT → PENDING_REVIEW → PAID/APPROVED หรือ REJECTED/EXPIRED
- Subscription access: FULL → GRACE → READ_ONLY และต่ออายุกลับ FULL

พฤติกรรม:

- FULL: ใช้งานทุก feature ที่ plan อนุญาต
- GRACE: ยังทำงานได้ พร้อมเตือนชัดเจนให้ต่ออายุ
- READ_ONLY: ดู ค้นหา ดาวน์โหลดข้อมูลเดิมได้ ห้ามสร้าง/แก้ธุรกิจ ยกเว้น renewal/support

---

## 7. User flow แบบ end-to-end

### 7.1 Owner onboarding

```text
Super Admin สร้างบัญชี Owner
→ สถานะ PENDING
→ Super Admin อนุมัติ
→ Owner login ด้วยรหัสชั่วคราว
→ บังคับเปลี่ยนรหัสผ่าน
→ เลือกหอหรือเข้าหน้าสร้าง/ตั้งค่าหอ
→ สร้างอาคาร ชั้น ห้อง และค่าบิล
```

### 7.2 Tenant onboarding

```text
Owner สร้าง invitation ระบุห้องและ PRIMARY/CO_OCCUPANT
→ ผู้เช่าใหม่สมัครด้วย code หรือบัญชีเดิมรับ code
→ occupancy เป็น PENDING
→ Owner เปิด work queue และตรวจข้อมูล
→ อนุมัติหรือปฏิเสธพร้อมเหตุผล
→ เมื่อ ACTIVE ผู้เช่าเลือก occupancy หากมีหลายรายการ
→ เข้าถึง portal ของหอ/ห้องนั้น
```

### 7.3 Lease lifecycle

```text
Owner เลือกห้อง/occupancy
→ สร้าง DRAFT version 1
→ ตรวจข้อมูลและสร้าง PDF
→ เปลี่ยนเป็น PENDING_SIGNATURE
→ พิมพ์และเซ็นนอกระบบ
→ อัปโหลด PDF เซ็นแล้ว
→ เปิด ACTIVE
→ แก้ไขภายหลัง = สร้าง version ใหม่
→ ใกล้หมดอายุ/หมดอายุ/ยกเลิกตาม lifecycle
```

### 7.4 Meter to billing

```text
Owner เลือกหอ → อาคาร → ชั้น → รอบเดือน
→ ระบบแสดงห้องและเลขครั้งก่อนจาก API
→ กรอกเลขปัจจุบันแบบต่อเนื่อง
→ แสดงหน่วยใช้และความผิดปกติทันที
→ บันทึก draft/bulk
→ เปิด invoice preflight
→ แสดงห้องที่พร้อม/ขาดมิเตอร์/ไม่มีสัญญา/ผิดพลาด
→ สร้าง draft รายห้องหรือทั้งหอ
→ Owner ตรวจ preview
→ เผยแพร่บิล
```

### 7.5 Payment

```text
Tenant เปิดบิล
→ เห็นรายการ ยอด และวันครบกำหนด
→ เปิด PromptPay QR ที่ผูกยอดบิล
→ อัปโหลดสลิป
→ สถานะ PENDING_REVIEW
→ Owner ตรวจ queue
→ APPROVE = บิล PAID
→ REJECT = แสดงเหตุผลให้ Tenant และส่งใหม่ในบิลเดิม
```

### 7.6 Move room

```text
Owner เปิด Tenant/occupancy
→ เลือกย้ายห้องและวันที่มีผล
→ ตรวจห้องปลายทาง ความจุ สัญญา บิลค้าง และเงินประกัน
→ สิ้นสุด occupancy เดิม
→ สร้าง occupancy ใหม่
→ เก็บ transition event และ audit
```

ประวัติห้อง สัญญา มิเตอร์ และบิลเดิมต้องไม่ถูกย้ายไปปะปนกับรายการใหม่

### 7.7 Move out

```text
แจ้งย้ายออก
→ บันทึกมิเตอร์สุดท้าย
→ สร้าง/ตรวจบิลสุดท้าย
→ สรุปยอดค้างและเงินประกัน
→ ระบุคืนเงินหรือเรียกเพิ่ม
→ สิ้นสุดสัญญาและ occupancy
→ ห้องกลับ AVAILABLE เมื่อไม่มีผู้พัก active
```

### 7.8 SaaS purchase/renewal

```text
Owner เปิดหน้าแพ็กเกจ
→ เปรียบเทียบราคา/ข้อจำกัด
→ สร้าง order ซื้อใหม่หรือต่ออายุ
→ ส่งสลิป
→ Super Admin ตรวจ
→ อนุมัติ = เปิด/ต่อ subscription
→ ปฏิเสธ = แสดงเหตุผลและส่งใหม่ตามกฎ
```

---

## 8. Information Architecture และ Navigation

### 8.1 Public/Auth

```text
/login
/register
/forgot-password
/reset-password
/change-password
```

### 8.2 Owner workspace

ต้องมี property switcher มองเห็นได้ตลอดเวลาเมื่อ Owner มีหลายหอ

```text
Dashboard
Rooms
Tenants
  ├─ Current tenants
  ├─ Pending approvals
  ├─ Transition history
  └─ Invitations
Contracts
Meters
Billing
  ├─ Invoices
  └─ Payment review
Operations
  ├─ Repair/complaint tickets
  ├─ Repair history
  ├─ Parcels
  ├─ Announcements
  └─ Tenant chat
Subscription
Settings
  ├─ Property
  ├─ Billing/PromptPay
  ├─ Buildings/floors/catalogs
  ├─ Document templates
  └─ Account/password
Support chat with Super Admin
```

### 8.3 Tenant portal

Mobile bottom navigation แนะนำ 5 จุด:

```text
หน้าหลัก | บิล | พัสดุ | แจ้งเรื่อง | เพิ่มเติม
```

เมนูเพิ่มเติมประกอบด้วย ห้อง สัญญา ประกาศ ติดต่อหอ และบัญชี

### 8.4 Super Admin

แยกเป็นหลายหน้า ไม่รวมทุก resource ใน dashboard เดียว:

```text
Dashboard
Accounts
Properties
Plans
Subscriptions
Audit logs
Support chat
```

---

## 9. ข้อกำหนด UI ทุกหน้า

### 9.1 กฎร่วมของทุกหน้า

ทุกหน้าที่โหลดข้อมูลต้องมี:

- Loading state ที่บอกว่ากำลังโหลดอะไร
- Empty state ที่อธิบายว่าทำไมว่างและ CTA เมื่อเหมาะสม
- Error state ภาษาไทย พร้อม `requestId` ถ้า API ส่งมา และปุ่มลองใหม่
- Success feedback แบบ toast/status
- Disabled/submitting state ป้องกันกดซ้ำ
- Permission/read-only state ที่อธิบายเหตุผล
- Responsive layout และ keyboard focus ที่เห็นชัด
- ไม่แสดง enum ภาษาอังกฤษดิบแก่ Owner/Tenant
- วันที่ UI ใช้ `th-TH`; API ใช้ ISO 8601
- เงินใช้รูปแบบ `฿1,250.00` หรือรูปแบบไทยที่สม่ำเสมอ
- Search/filter ต้องส่งไป server เมื่อข้อมูลอาจมาก ไม่กรองเฉพาะหน้าแล้วอ้างว่าเป็นทั้งหมด
- Table ใช้ server pagination แบบก่อนหน้า/ถัดไปหรือเลขหน้า; feed/chat ใช้ load older/load more
- Summary ต้องมาจาก aggregation/total query ไม่คำนวณจากรายการเฉพาะหน้าที่โหลด
- Modal/dialog มี label, Escape, focus trap/คืน focus และ confirmation สำหรับงานเสี่ยง
- ฟอร์มยาวต้องเตือน unsaved changes และคงข้อมูลเมื่อ mutation ล้มเหลว

### 9.2 หน้า Login

แสดง:

- โลโก้/ชื่อแพลตฟอร์มและข้อความสั้นว่าระบบทำอะไร
- Email และ password
- ลิงก์ลืมรหัสผ่าน
- ลิงก์สมัครผู้เช่าด้วย invitation
- Generic authentication error เพื่อลด account enumeration
- Loading และ disabled submit
- หากเป็น development ที่ตั้งใจ อาจแสดง demo credentials; ห้ามแสดงใน production/test-view ที่แชร์ให้ผู้อื่น

ไม่ควรแสดง:

- รายละเอียดว่า email หรือ password ส่วนไหนผิด
- stack trace, database error หรือ credential production

### 9.3 Forgot/Reset/Temporary Password

- Forgot: email, ข้อความตอบกลางไม่ยืนยันว่ามีบัญชีหรือไม่
- Reset: password ใหม่ + confirm, ความยาว/เงื่อนไข, token expired/used state
- Change temporary password: อธิบายว่าต้องเปลี่ยนก่อนใช้งาน, password ใหม่ + confirm
- เมื่อสำเร็จ rotate/revoke session ตามกฎและนำไปหน้าที่เหมาะกับ role

### 9.4 Tenant Registration / Accept Invitation

แสดง:

- Invitation code
- ชื่อผู้เช่า Email เบอร์โทร Password สำหรับบัญชีใหม่
- ข้อมูลหอ ห้อง และบทบาท PRIMARY/CO_OCCUPANT หลังตรวจ code สำเร็จ
- สถานะ invalid, expired, revoked, already used
- ข้อความว่าสมัครแล้วต้องรอ Owner อนุมัติ occupancy
- สำหรับบัญชีเดิม ช่องรับ code อยู่หน้า Account ไม่ฝังถาวรใน sidebar

### 9.5 Owner Dashboard

ลำดับความสำคัญคือ “สิ่งที่ต้องทำ” ไม่ใช่กราฟตกแต่ง

ส่วนบน:

- Property switcher
- Global search: ชื่อผู้เช่า ห้อง เบอร์โทร เลขบิล เลขสัญญา
- Notification bell และ unread count
- Subscription banner FULL/GRACE/READ_ONLY

KPI จาก aggregation:

- ยอดค้างชำระและจำนวนบิล
- สลิปรอตรวจ
- ห้องว่าง/มีผู้พัก/ซ่อมบำรุง
- รายได้/ยอดบิลตามช่วงที่กำหนด

Work queue แบบกดไปทำงานได้:

- ผู้เช่ารออนุมัติ
- สลิปรอตรวจ
- บิลเลยกำหนด
- สัญญาใกล้หมด
- พัสดุรอรับ
- Ticket ใหม่/กำลังทำ
- ข้อความยังไม่อ่าน
- Subscription ใกล้หมด

ส่วนรอง:

- แนวโน้มรายได้
- กิจกรรมล่าสุดจากข้อมูลจริง
- Quick actions ที่เชื่อม workflow จริง

ห้าม fallback เป็นตัวเลขจำลองเมื่อ API ล้มเหลว

### 9.6 Owner Rooms

รูปแบบหลัก:

- แบ่งตามอาคารและชั้น แล้วแสดง card/table ห้อง
- Filter อาคาร ชั้น สถานะ room type
- Search เลขห้อง/ผู้เช่า
- Badge AVAILABLE/OCCUPIED/MAINTENANCE/INACTIVE เป็นภาษาไทย

ข้อมูลต่อห้อง:

- เลขห้อง อาคาร ชั้น ประเภท
- สถานะและจำนวนผู้พัก/ความจุ
- ผู้เช่าหลักปัจจุบันถ้ามี
- ค่าเช่ารายเดือน เงินประกัน และค่าบริการที่เกี่ยวข้อง
- Furniture/สิ่งอำนวยความสะดวก normalized
- Action ดูรายละเอียด/แก้ไขตามสิทธิ์

Room edit ห้ามมี:

- ข้อมูลรถ
- textarea ผู้พักร่วม
- ตัวเลือกชั้น hardcode; ต้องโหลดจาก building/floor API

### 9.7 Owner Tenants

Tabs:

- ผู้เช่าปัจจุบัน
- คำขอเข้าพัก
- ประวัติย้ายห้อง/ย้ายออก

รายการผู้เช่า:

- ชื่อ ห้อง role PRIMARY/CO_OCCUPANT
- เบอร์โทรและข้อมูลติดต่อที่จำเป็น
- สัญญาปัจจุบันและวันสิ้นสุด
- สถานะ occupancy
- ยอดค้างหรือ warning ที่จำเป็น ไม่เปิดเผยเกินบริบท
- Search/filter/server pagination/export

รายละเอียดผู้เช่า:

- Profile และข้อมูล optional เช่น วันเกิด อาชีพ ที่อยู่ รถ ผู้ติดต่อฉุกเฉิน
- Occupancy history
- Lease history
- Invoice/payment overview
- Ticket/parcel ที่เกี่ยวข้องตามสิทธิ์
- Action ย้ายห้อง ย้ายออก ส่งข้อความ

ข้อมูลส่วนบุคคลที่ไม่จำเป็นต้อง optional และไม่ควรบังคับเพื่อทำ critical flow

### 9.8 Pending Tenant Approval

แสดง:

- ชื่อ Email เบอร์โทร
- หอ อาคาร ห้อง
- PRIMARY/CO_OCCUPANT
- Invitation ที่ใช้และวันที่สมัคร
- ความจุห้อง/ผู้พักปัจจุบัน
- ปุ่มอนุมัติและปฏิเสธพร้อม dialog เหตุผล
- หลังอนุมัติแสดง next actions: สร้างสัญญา, ดูห้อง, ส่งข้อความ

### 9.9 Invitations

ฟอร์มสร้าง:

- ห้องจาก API
- บทบาท PRIMARY/CO_OCCUPANT
- วันหมดอายุ
- จำนวนครั้ง/ข้อจำกัดตาม schema จริง

รายการ:

- Code พร้อม copy
- ห้อง บทบาท สถานะ วันหมดอายุ ผู้สร้าง ผู้รับเมื่อใช้แล้ว
- Search/filter/pagination
- Revoke action พร้อม confirmation

### 9.10 Contracts

Summary:

- Draft/รอลงนาม
- Active
- ใกล้หมดอายุ/หมดอายุ

ตาราง:

- เลขสัญญา ห้อง ผู้เช่าหลัก
- ค่าเช่า เงินประกัน
- วันที่เริ่ม/สิ้นสุด
- Current version
- สถานะภาษาไทย
- Signed document indicator
- Action ดู ดาวน์โหลด สร้าง version อัปโหลดเอกสาร เปลี่ยนสถานะ

ฟอร์ม:

- ห้องและ occupancy จริง
- Lease number
- วันที่เริ่ม/สิ้นสุด
- ค่าเช่า เงินประกัน และข้อกำหนด
- Template ที่ใช้
- Preview จากข้อมูลจริง; ถ้ายังไม่มีสัญญาหรือบิลให้แสดง empty prerequisite ไม่ใช้ sample person/room/date

### 9.11 Meters

ควร mobile-friendly เพราะ Owner อาจเดินจดมิเตอร์

Controls:

- รอบเดือน/ปีจากค่าเลือกจริง ไม่ hardcode
- อาคาร ชั้น และค้นหาห้อง
- ประเภท WATER/ELECTRICITY

แต่ละแถว:

- ห้องและผู้เช่าหลัก
- เลขครั้งก่อน
- ช่องเลขปัจจุบัน
- หน่วยใช้คำนวณทันที
- อัตราจาก Property Settings
- จำนวนเงิน
- สถานะ draft/saved/error/abnormal

Bulk workflow:

- กรอกต่อเนื่องและใช้ keyboard ไปห้องถัดไปได้
- ป้องกันเลขต่ำกว่าครั้งก่อน/duplicate
- บันทึกเฉพาะแถวที่เปลี่ยน
- Confirmation บอกจำนวนสำเร็จและผิดพลาด
- ปุ่มสร้างบิลทั้งหอไป invoice preflight

รูปถ่ายมิเตอร์เป็น enhancement ได้ หากทำต้องมี upload validation และไม่บังคับในรุ่นแรก

### 9.12 Invoices

Tabs:

- บิลห้องพัก
- ตรวจสอบการชำระ

Summary ต้องมาจาก server aggregation:

- Draft
- รอชำระ
- ค้างชำระ
- ชำระแล้ว
- ยอดรวมตาม filter/ช่วง

ตาราง:

- เลขบิล ห้อง ผู้เช่า รอบบิล
- ค่าเช่า น้ำ ไฟ บริการ/อื่น
- ค่าปรับและยอดรวม
- วันออก/ครบกำหนด
- Version และสถานะ
- Action ดูรายละเอียด ออกบิล ยกเลิก/สร้าง version ตามกฎ

สร้างรายห้อง/ทั้งหอ:

- ใช้ Wizard หรือ dialog ที่มี preflight
- Step 1 เลือกรอบ/ขอบเขต
- Step 2 ตรวจมิเตอร์ สัญญา อัตรา และรายการขาด
- Step 3 Preview ห้องสำเร็จ/ข้าม/ผิดพลาดและยอด
- Step 4 ยืนยันสร้างเป็น draft
- Step 5 ตรวจและเผยแพร่
- Bulk operation ต้อง transaction/rollback ตามกฎ ไม่ทิ้งข้อมูลครึ่งชุดโดยไม่รายงาน

### 9.13 Owner Payment Review

Layout desktop แนะนำ queue ซ้าย รายละเอียดขวา; mobile เป็น list → detail

Queue:

- ห้อง ผู้เช่า เลขบิล ยอด วันที่ส่ง และ warning
- Search/filter/pagination/unread count

Detail:

- ภาพสลิปที่เปิดผ่าน authorized endpoint
- รายการบิล ยอดบิล ยอดส่ง วันครบกำหนด
- ผู้ส่ง ห้อง หอ เวลาส่ง
- ประวัติ submission ก่อนหน้า
- ปุ่ม Approve
- ปุ่ม Reject เปิด accessible dialog บังคับเหตุผล ห้ามใช้ `window.prompt()`

### 9.14 Tickets / Repair / Complaints

อยู่ใน Operations เดียวกันโดยมี tab/type filter

รายการ:

- Ticket number/title
- ประเภท งานซ่อมหรือร้องเรียน
- ห้อง/ผู้แจ้งตาม privacy
- Priority
- Status
- วันที่สร้าง/อัปเดต
- ผู้ตอบล่าสุด/unread
- Search/filter/server pagination

รายละเอียด:

- เนื้อหาและ attachment
- Reply thread
- Event history: สร้าง เปลี่ยนสถานะ reply/attachment และผู้กระทำ
- Owner เปลี่ยน status
- Tenant ตอบรายละเอียดเพิ่มหรือเวลานัดหมายใน ticket เดิม
- ไม่มี anonymous complaint ในรุ่นแรก

### 9.15 Parcels

Summary:

- รับเข้าวันนี้
- รอรับ
- รับแล้ว
- ค้างเกินจำนวนวันที่กำหนด

รายการ:

- ห้อง ผู้รับ/occupancy
- หมายเหตุหรือผู้ส่ง
- วันที่รับเข้า
- สถานะและวันที่รับแล้ว
- รูปพัสดุถ้ามีผ่าน authorized endpoint
- Action ลงทะเบียนและยืนยันรับ

ข้อมูลผู้รับต้องไม่รั่วไป tenant อื่น เพื่อนร่วมห้องรับแทนต้องเป็น business decision ที่บันทึกผู้ดำเนินการได้

ปุ่ม Scan QR/Barcode ต้องซ่อนหรือ disabled พร้อม “กำลังพัฒนา” จนมี workflow จริง

### 9.16 Announcements

Summary ใช้ total จาก server ไม่คำนวณจาก page ปัจจุบัน

รายการ:

- หัวข้อ excerpt
- Audience
- สถานะ
- วันที่เผยแพร่/กำหนดเผยแพร่
- ผู้สร้าง
- Read metrics หากระบบรองรับ
- Search/filter/pagination

ฟอร์ม:

- หัวข้อ เนื้อหา audience/target
- Publish now หรือ schedule
- Preview
- Cancel/archive ตาม lifecycle

Tenant ต้องมี read/unread และ “อ่านแล้ว” จริงเมื่อเปิดรายละเอียด

### 9.17 Chat

Owner–Tenant:

- Owner เลือก conversation ตาม tenant/room ตาม model จริง
- Message history แบ่งหน้าและโหลดข้อความเก่าได้ ไม่จำกัดให้เห็นเพียง 100 ข้อความตลอดไป
- Sender, เวลา, read state และ attachment
- Realtime/stream reconnect state
- Input disabled ใน READ_ONLY ตาม policy พร้อมคำอธิบาย

Owner–Super Admin:

- ใช้ support conversation แยกจาก tenant chat
- แสดง property context
- Super Admin เห็นรายการ owner/property ที่ติดต่อและ unread count

### 9.18 Owner Subscription

แสดง:

- แพ็กเกจปัจจุบัน ราคา รอบบิล และวันหมดอายุ
- Status FULL/GRACE/READ_ONLY พร้อมคำอธิบายสิ่งที่ทำได้
- Usage เช่นจำนวนห้องเทียบ limit
- Plan cards ที่ active และสิทธิ์สำคัญ
- Order history แบบ pagination
- Order number ประเภทซื้อใหม่/ต่ออายุ ยอด วันหมดอายุ order และสถานะ
- Upload slip และเหตุผลปฏิเสธ
- CTA ต่ออายุที่ยังใช้ได้ใน READ_ONLY
- Support contact

### 9.19 Owner Settings

Sections:

- ข้อมูลหอ: ชื่อ ที่อยู่ เบอร์ติดต่อ Email กฎหอ และข้อมูลฉุกเฉิน
- Billing: PromptPay ID, อัตราน้ำ/ไฟ, วันตัดรอบ, วันครบกำหนด, ค่าปรับ/เพดาน, invoice prefix
- Structure: อาคาร ชั้น และ catalogs
- Documents: contract/invoice templates
- Account: profile และเปลี่ยนรหัสผ่าน

กฎ:

- PromptPay แสดงแบบปิดบังเมื่อไม่จำเป็นต้องเห็นเต็ม
- Validate billing day/due day และอัตรา
- เตือน unsaved changes
- ใน READ_ONLY ดูได้แต่บันทึก property settings ไม่ได้; account/password ยังเป็น security operation ตาม policy

### 9.20 Tenant Home

ออกแบบ mobile-first และแสดงสิ่งที่ต้องทำก่อนรายละเอียดทั่วไป

Header:

- ชื่อหอ
- Occupancy selector เมื่อมีหลายรายการ
- ห้องและ role
- Notification/unread

Priority cards:

- ยอดที่ต้องชำระและวันครบกำหนด พร้อม CTA
- สถานะสลิปล่าสุด/เหตุผลปฏิเสธ
- พัสดุรอรับ
- Ticket กำลังติดตาม/ต้องตอบ
- ประกาศล่าสุดที่ยังไม่อ่าน
- ข้อความใหม่

ส่วนรอง:

- ข้อมูลห้องและช่องทางติดต่อ
- สัญญาปัจจุบัน
- Quick actions

ห้ามใช้ยอดค้าง จำนวนพัสดุ วันที่ประกาศ หรือจำนวนห้องแบบ hardcode

### 9.21 Tenant Invoices and Payment

รายการบิล:

- เลขบิล รอบบิล ยอด วันครบกำหนด สถานะ
- Search/filter หากประวัติมากและ load more/pagination

รายละเอียดบิล:

- ค่าเช่า น้ำ ไฟ บริการ อื่น ค่าปรับ
- ยอดสุทธิ
- วันที่ออก/ครบกำหนด
- QR PromptPay ที่ผูกยอด
- PromptPay ID แบบปิดบัง
- Payment submission history
- สถานะรอตรวจ/อนุมัติ/ปฏิเสธและเหตุผล
- Upload ใหม่ใน invoice เดิมเมื่อถูกปฏิเสธ
- จำกัด MIME/extension/actual content/size ตาม backend และแสดงข้อผิดพลาดพร้อม request ID

### 9.22 Tenant Room and Lease

Room:

- หอ อาคาร ชั้น เลขห้อง ประเภท
- ผู้เช่าหลัก/ผู้พักร่วมเท่าที่ privacy อนุญาต
- สิ่งอำนวยความสะดวกและกฎหอ
- ช่องทางติดต่อ/ฉุกเฉิน

Lease:

- เลขสัญญา version สถานะ
- วันที่เริ่ม/สิ้นสุด
- ค่าเช่า เงินประกัน
- ผู้เช่าในสัญญา
- ดาวน์โหลดเอกสารเซ็นแล้ว
- Empty state เมื่อยังไม่มีสัญญา ห้ามใส่ข้อมูลตัวอย่าง

### 9.23 Tenant Announcements and Parcels

Announcements:

- ล่าสุดก่อน, audience ที่เกี่ยวข้อง, วันที่จริง
- Read/unread และอ่านทั้งหมดเมื่อมี notification center
- Detail ที่อ่านง่ายและรองรับข้อความยาว

Parcels:

- แยกรอรับ/รับแล้ว
- วันที่รับเข้า หมายเหตุ จุดรับ และรูปถ้ามี
- Tenant เห็นเฉพาะรายการที่ authorized สำหรับ occupancy ของตน

### 9.24 Tenant Tickets

- สร้างเรื่องโดยเลือก Repair/Complaint, หัวข้อ, รายละเอียด, priority และ attachment
- รายการแสดง status/update/unread reply
- Detail แสดง reply และ event history
- Tenant ตอบกลับใน ticket เดิมได้
- Empty/error/upload retry state ต้องชัดเจน

### 9.25 Tenant Chat

- Chat กับ Owner ของ property/occupancy ปัจจุบัน
- Load older messages
- Read state และเวลาส่ง
- Attachment ผ่าน authorized endpoint
- Empty, reconnect, send failure และ retry
- ใน READ_ONLY อ่านประวัติได้ แต่การส่งขึ้นกับ subscription policy ที่ backend บังคับ

### 9.26 Tenant Account

- ชื่อ เบอร์โทร และข้อมูล optional ที่ Tenant แก้ได้
- Email เป็น read-only หรือเปลี่ยนผ่าน flow ที่ปลอดภัย
- เปลี่ยนรหัสผ่าน
- รายการ occupancy ทั้งหมดและสลับรายการ
- รับ invitation เพิ่มสำหรับบัญชีเดิม
- Logout และ logout all devices หากรองรับ endpoint
- ไม่วาง invitation input ใน sidebar ถาวร

### 9.27 Super Admin Dashboard

- จำนวนบัญชี Owner แยก PENDING/APPROVED/REJECTED
- จำนวนหอ active/inactive
- Subscription แยก active/grace/read-only/expired
- Payment รอตรวจ
- MRR/ARR หรือยอด subscription ที่นิยามชัด
- Platform activity/recent failures จาก aggregation
- CTA ไป Accounts, Subscriptions และ Audit logs

### 9.28 Super Admin Accounts

- Search email/name/property
- Filter approval status และ active state
- Server pagination และ total
- สร้างบัญชี Owner โดยเลือก property/membership
- Approve/Reject dialog พร้อมเหตุผล
- Issue temporary password พร้อมคำเตือนเรื่องการส่งต่ออย่างปลอดภัย
- ดู membership และสถานะล่าสุด

### 9.29 Super Admin Properties

- Search/filter/server pagination/total/export
- ชื่อ short name active state จำนวนห้อง จำนวน Owner และ subscription
- เปิดหน้า detail

Property detail:

- ข้อมูลพื้นฐานและ memberships
- จำนวนอาคาร/ห้อง/occupancy สรุป
- Subscription current/history
- การดำเนินการระดับกำกับ เช่น active/inactive ตามกฎ
- Link Audit/support context

### 9.30 Super Admin Plans

- สร้างและแก้ plan
- Code, name, monthly/yearly price
- max properties, max rooms และ feature flags
- active/inactive หรือปิดขาย
- จำนวน subscription ที่ใช้อยู่
- ป้องกันการแก้ที่ทำให้ลูกค้าปัจจุบันเสียสิทธิ์โดยไม่มี confirmation/business rule

### 9.31 Super Admin Subscriptions

- Queue payment รอตรวจพร้อม badge ใน navigation
- Property, Owner, order number, plan, interval, amount, submitted date
- Authorized slip preview
- Approve/Reject accessible dialog บังคับเหตุผล
- Subscription history และผลวันหมดอายุใหม่
- Search/filter/server pagination

### 9.32 Super Admin Audit Logs

- Filter วันที่ actor email/user, property, action, result และ request ID
- เวลา action result actor property target request ID IP/user agent เท่าที่ policy อนุญาต
- แปลง action/result เป็นภาษาไทยใน list
- Raw enum/context แสดงได้ใน detail สำหรับผู้ดูแล
- Server pagination, total และ CSV export
- Audit log ห้ามแก้หรือลบจาก UI ปกติ

---

## 10. Design System

### 10.1 บุคลิก

- เป็นมิตร เข้าถึงง่าย แต่ยังน่าเชื่อถือสำหรับข้อมูลการเงินและสัญญา
- Owner UI เห็นข้อมูลได้พอเหมาะบน desktop ไม่ทำ card โปร่งจนต้องเลื่อนมากเกินไป
- Tenant UI เรียบง่าย ตัวอักษรอ่านง่าย ปุ่มใหญ่ เหมาะกับผู้ไม่ถนัดเทคโนโลยี

### 10.2 Tokens ปัจจุบัน

| Token | ค่า | การใช้ |
|---|---|---|
| Primary | `#5865F2` | CTA, active navigation, focus |
| Success | `#35ED7E` | paid/success |
| Info | `#00B0F4` | link/info |
| Accent | `#EC48BD` | accent/badge แบบจำกัด |
| Canvas | `#FFFFFF` | พื้นหลังหลัก |
| Text | `#0B0D45` | ข้อความหลัก |
| Radius | 12/16/24 px | control/card/panel |
| Target | อย่างน้อย 44×44 px | touch target |
| Focus | primary ring 2 px | interactive element |

### 10.3 Component rules

- ใช้ component กลางสำหรับ button, panel, badge, dropdown, pagination, dialog, toast, notification และ confirmation
- Primary button หนึ่ง action เด่นต่อกลุ่ม
- Destructive action ต้องมีข้อความเป้าหมายชัดและ confirmation
- Status ต้องมี label/icon ไม่ใช้สีอย่างเดียว
- Table header และ cell ต้องสัมพันธ์ แม้ scroll แนวนอนภายใน table
- Skeleton/spinner ใช้เมื่อรอ; ห้ามแสดงศูนย์เป็น fallback ระหว่างโหลด

### 10.4 Accessibility

- Semantic heading ตามลำดับ
- Label ผูกกับ input
- Navigation ใช้ `aria-current`
- Error ใช้ `role=alert`; loading/success ใช้ `role=status`/`aria-live`
- Dialog ปิด Escape, focus trap และคืน focus
- Keyboard ใช้ทุก critical action ได้
- Contrast ผ่านระดับพื้นฐาน WCAG AA
- รองรับ zoom และข้อความไทยยาวโดยไม่ทับ action

### 10.5 Responsive

| Width | Owner | Tenant | Super Admin |
|---|---|---|---|
| 390 | stacked, sidebar compact/drawer, modal bottom sheet, table scroll เฉพาะตัว | bottom nav 5 จุด, CTA ไม่ถูกบัง | navigation/table ใช้งานได้ |
| 768 | 1–2 columns, filters wrap | centered readable content | form/table ไม่ล้น |
| 1024 | sidebar + compact grids | desktop navigation ได้ | full navigation |
| 1440 | dense dashboard มี max width | centered content | multi-column summary |

---

## 11. API และ Frontend Contract

### 11.1 รูปแบบ JSON สำเร็จ

```json
{
  "data": {},
  "requestId": "uuid"
}
```

Paginated:

```json
{
  "data": [],
  "pageInfo": {
    "page": 1,
    "pageSize": 20,
    "hasNextPage": true,
    "total": 125,
    "totalPages": 7
  },
  "requestId": "uuid"
}
```

`total`/`totalPages` อาจ optional ใน cursor/feed แต่ table summary ที่ต้องบอกทั้งหมดควรมี total จริง

### 11.2 Error

```json
{
  "error": "ข้อความปลอดภัยสำหรับผู้ใช้",
  "requestId": "uuid",
  "issues": []
}
```

UI ต้องรองรับ 400, 401, 403, 404, 409, 415, 429 และ 500

### 11.3 กฎ mutation

- JSON ใช้ `Content-Type: application/json`
- Upload ใช้ multipart ตาม OpenAPI
- Same-origin cookie session; ห้ามเก็บ token ใน localStorage
- ป้องกัน double submit
- เมื่อ failure ต้องคงค่าในฟอร์มและแสดง request ID
- ทุก endpoint ใหม่ต้องมี Zod validation, authorization, ownership, specific OpenAPI schema และ tests

### 11.4 การแยกโปรเจกต์ frontend

ทำคนละโปรเจกต์แล้วเชื่อม API ได้ แต่ต้องตกลง:

- Base URL ต่อ environment
- Cookie/CORS/CSRF เมื่อแยก origin
- OpenAPI version และ response schemas
- Error/request ID behavior
- Authentication/session flow
- ห้ามสร้าง user/auth/database ธุรกิจอีกชุดโดยไม่จำเป็น

แนวทางที่ง่ายและปลอดภัยที่สุดในปัจจุบันคืออยู่ origin/project เดียวกันและเรียก relative `/api/...`

---

## 12. Security, Privacy และ Retention

- Session cookie เป็น HttpOnly, Secure ใน production และ SameSite ที่เหมาะสม
- Rotate session หลัง login/password/privilege change
- Generic login/forgot response
- Login และ upload มี rate limiting
- Upload ตรวจ actual MIME, extension, size, count และ random filename
- Private file อยู่นอก public directoryหรือ S3 private bucket
- ป้องกัน SQL injection ผ่าน Prisma/parameterized query
- ป้องกัน IDOR ด้วย ownership ทุก record
- Security headers, HTTPS และ CSP ใน production
- Log ห้ามมี password/token/cookie/reset link หรือ PII เกินจำเป็น
- Audit มี timestamp, actor, property, action, result, request ID และ context ที่ปลอดภัย
- Retention job ครอบคลุม slip, generated document และ chat/ticket attachment ตาม environment configuration
- วันเกิด อาชีพ ที่อยู่ละเอียด รถ เอกสาร และ emergency contact เป็น optional และจำกัดการแสดง

---

## 13. Background Jobs

Maintenance worker ต้องทำอย่าง idempotent และมี authentication secret:

- เปลี่ยน invoice ที่เลยกำหนดเป็น OVERDUE
- คำนวณ/ปรับ late fee ตาม policy และ cap โดยไม่สร้างซ้ำ
- Publish scheduled announcement ที่ถึงเวลา
- เปลี่ยน subscription ตาม expiry/grace/read-only lifecycle
- ลบ/จัดการไฟล์ที่เกิน retention โดยไม่ลบ record ที่ยังต้องใช้งานผิดตัว
- บันทึกผลและ request ID/audit ที่เหมาะสม

ห้ามพึ่ง browser เปิดหน้าเพื่อให้สถานะ overdue หรือ scheduled เปลี่ยน

---

## 14. Testing และ Definition of Done

### 14.1 Automated tests

- Unit: calculation, lifecycle, enum, validation
- Integration บน PostgreSQL test database: auth, session, ownership, pagination ownership, upload restriction, retention, bulk rollback, subscription expiry
- E2E: owner/tenant/super-admin critical UI journeys
- Responsive: 390/768/1024/1440 ที่สำคัญ
- OpenAPI route/request/response contract check
- Production build และ Docker smoke test

ห้ามรัน destructive tests กับฐานหลัก ชื่อฐาน integration/E2E ต้องมีคำว่า `test`

### 14.2 Critical E2E journey

```text
Super Admin สร้างและอนุมัติ Owner
→ Owner เปลี่ยน temporary password
→ สร้าง/ตั้งค่าหอและห้อง
→ สร้าง invitation
→ Tenant สมัครผ่าน UI
→ Owner อนุมัติ
→ สร้าง/เปิดสัญญา
→ บันทึกมิเตอร์
→ สร้างและเผยแพร่บิล
→ Tenant เปิด QR และส่งสลิป
→ Owner ปฏิเสธพร้อมเหตุผล
→ Tenant ส่งใหม่
→ Owner อนุมัติ
→ Tenant เห็น PAID
```

Fixture/API setup ใช้เตรียม prerequisite ได้ แต่ขั้นที่อ้างว่าเป็น UX journey ต้องคลิกผ่าน UI จริง

### 14.3 Usability test คนจริง

ผู้เข้าร่วมขั้นต่ำ:

- Owner 3 คน อย่างน้อย 1 คนใช้มือถือและ 1 คนไม่ถนัดเทคโนโลยี
- Tenant 3 คน อย่างน้อย 1 คนไม่ถนัดเทคโนโลยี
- ผู้ดำเนินการไม่ใช่ผู้สร้างหน้าจอ

Owner tasks:

1. สลับหอและอนุมัติผู้เช่า
2. บันทึกมิเตอร์ 3 ห้องและสร้างบิลทั้งหอ
3. ปฏิเสธสลิปพร้อมเหตุผลและตรวจสลิปใหม่
4. หา/ดาวน์โหลดสัญญาและอธิบาย version/status
5. ต่ออายุแพ็กเกจและอธิบาย GRACE/READ_ONLY

Tenant tasks:

1. เลือก occupancy และหายอด/วันครบกำหนด
2. เปิด QR ส่งสลิป และหาเหตุผลปฏิเสธ
3. อ่านประกาศและดูพัสดุ
4. สร้าง/ตอบ ticket และติดตามสถานะ
5. เปิดสัญญา chat และเปลี่ยนรหัสผ่าน

บันทึกลง `docs/USABILITY_TEST_RESULTS.csv`

Severity:

- S0: blocker/data loss/security
- S1: ทำ task ไม่สำเร็จ
- S2: สำเร็จแต่สับสนหรือช้า
- S3: cosmetic

แก้ S0/S1 ทั้งหมดและ retest; S2 ที่พบอย่างน้อย 2 คนต้องแก้หรือบันทึกเหตุผลยอมรับ

### 14.4 Definition of Done ต่อหน้า

- ใช้ API จริง ไม่มี mock/fallback/hardcode business data
- Authorization/ownership ผ่าน backend
- Loading, empty, error, success, disabled และ read-only ครบ
- Error แสดง request ID
- Search/filter/pagination ถูกต้องกับ server data
- Responsive และ keyboard ใช้งานได้
- ไม่มี enum ดิบใน user-facing UI
- Unit/integration/E2E ที่เกี่ยวข้องผ่าน
- OpenAPI ตรง request/response จริง

---

## 15. Production Readiness

ก่อน production ต้องยืนยัน:

- Environment/secrets แยก dev/test/staging/prod
- PostgreSQL backup และ restore test
- Migration deploy/rollback runbook
- S3-compatible private storage เมื่อ deploy หลาย instance
- HTTPS, domain, secure cookies และ security headers
- Email provider สำหรับ reset password
- Background worker/cron ทำงานจริงและมี monitoring
- Structured log และ alert โดยใช้ request ID
- Dependency audit ไม่มี high/critical ที่ยังไม่ได้ประเมิน
- CI ผ่าน typecheck, lint, unit, OpenAPI, build, integration, E2E และ Docker
- Docker runtime non-root และ healthcheck ผ่าน
- Demo credentials ถูกปิดใน production
- Seed/demo data ไม่ปะปน production

---

## 16. สิ่งที่ห้ามทำเมื่อ AI/นักพัฒนารับช่วงต่อ

1. ห้ามนำ `PropertyDataset` หรือ JSON compatibility layer กลับมา
2. ห้ามสร้าง role OWNER แยกจาก PROPERTY_ADMIN โดยไม่มี migration/requirement ใหม่
3. ห้ามใช้ ownerUserId แทน membership authorization
4. ห้ามเก็บผู้พักร่วมเป็นข้อความใน Room
5. ห้ามเก็บรถเป็นข้อมูลของ Room
6. ห้าม hardcode เดือน ปี อัตราค่าน้ำไฟ ตัวเลือกชั้น ยอดสรุป หรือข้อมูลผู้เช่า
7. ห้าม fallback เป็นข้อมูลจำลองเมื่อ API ล้มเหลว
8. ห้ามโหลดข้อมูลทั้งหมดเพื่อทำ dashboard/summary หากมี aggregation query
9. ห้ามจำกัด chat history แบบถาวรโดยไม่มี load older
10. ห้ามใช้ `window.prompt()` สำหรับการปฏิเสธ/เหตุผลสำคัญ
11. ห้ามปล่อยปุ่มที่กดแล้วไม่ทำงาน; ซ่อนหรือ disabled พร้อมคำอธิบาย
12. ห้ามเปิดไฟล์ private ด้วย path ตรง
13. ห้ามเชื่อ client state เพื่ออนุญาตสิทธิ์
14. ห้ามรายงานระบบ 100% หากยังไม่ผ่าน test gate และ usability test ที่ตกลง
15. ห้ามขยายไป booking/accounting/mobile app/AI ก่อน critical workflow ปัจจุบันสมบูรณ์

---

## 17. Checklist สำหรับ AI ก่อนเริ่มแก้โค้ด

1. อ่าน `AGENTS.md`
2. อ่านเอกสารนี้ทั้งหมด
3. ตรวจ route/component/service/schema ที่เกี่ยวข้องก่อนแก้
4. ตรวจ dirty worktree และรักษางานเดิม
5. ระบุ role, property/occupancy ownership และ subscription mode ของ flow
6. ใช้ enum/service/repository กลาง
7. ถ้าแก้ API ให้อัปเดต OpenAPI และ tests
8. ถ้าแก้ list ให้ตรวจ pagination/total/search/filter
9. ถ้าแก้ mutation ให้ตรวจ validation, double submit, audit และ request ID
10. รัน typecheck, lint, tests ที่เกี่ยวข้อง และ build ตามความเสี่ยง
11. รายงานสิ่งที่ทดสอบจริงและสิ่งที่ยังไม่ได้ทดสอบอย่างตรงไปตรงมา

---

## 18. เอกสารและไฟล์อ้างอิง

- `AGENTS.md` — ข้อกำหนดวิศวกรรมและความปลอดภัย
- `docs/openapi.json` — API contract
- `prisma/schema.prisma` — data model และ enum จริง
- `docs/TEAM_HANDOFF_TH.md` — คู่มือส่งต่อการพัฒนา
- `docs/UX_UI_ROUND4.md` — UX flow, wireframe และ usability criteria
- `docs/ACCOUNT_APPROVAL_LIFECYCLE.md` — account approval
- `docs/BACKGROUND_JOBS.md` — maintenance jobs
- `docs/SUBSCRIPTION_USABILITY_REVIEW.md` — subscription access usability
- `docs/DOCUMENT_SYSTEM.md` — document template/generation
- `docs/USABILITY_TEST_RESULTS.csv` — แบบบันทึกผู้ใช้จริง
- `tests/integration/` — critical backend behavior
- `tests/e2e/` — critical UI journeys

เอกสารนี้ตั้งใจให้ AI ตัวอื่นเข้าใจทั้ง “ระบบคืออะไร”, “ใครทำอะไรได้”, “ข้อมูลสัมพันธ์กันอย่างไร”, “แต่ละหน้าต้องแสดงอะไร”, “ต้องรับมือสถานะใด” และ “อะไรถือว่าเสร็จ” โดยไม่ต้องเดาจากหน้าจอหรือสร้าง requirement ใหม่เอง
