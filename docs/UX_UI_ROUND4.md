# UX/UI Round 4 — Design and usability

เอกสารนี้เป็น source of truth ของ User Flow, Information Architecture, Screen Inventory,
wireframe, design system, responsive acceptance criteria และ usability test ของ Nestly
(ชื่อหอทดลอง: บ้านอยู่สบาย)

## 1. เป้าหมายและตัวชี้วัด

ระบบช่วยเจ้าของหอรวมข้อมูลห้อง ผู้เช่า สัญญา มิเตอร์ บิล การชำระ และการติดต่อไว้ในที่เดียว
พร้อม portal ที่ผู้เช่าใช้ดูและดำเนินการกับข้อมูลของตนเอง และพื้นที่ Super Admin สำหรับกำกับแพลตฟอร์ม SaaS

งานหลักที่ต้องสำเร็จ:

1. Owner รับผู้เช่าเข้าระบบ สร้างสัญญา บันทึกมิเตอร์ สร้างบิล และตรวจสลิปได้โดยไม่หลงขั้นตอน
2. Tenant เห็นยอดและวันครบกำหนด ชำระเงิน/ติดตามผล และติดต่อหอได้สะดวกบนมือถือ
3. Super Admin อนุมัติบัญชี จัดการหอ แพ็กเกจ Subscription และตรวจ Audit Log ได้

เกณฑ์ UX รอบนี้: task completion >= 90%, critical error = 0, ความมั่นใจเฉลี่ย >= 4/5,
ไม่มี horizontal page overflow ที่ 390, 768, 1024 และ 1440 px และทุก action สำคัญเข้าถึงด้วย keyboard ได้

## 2. User Flow

### Owner critical flow

```text
Super Admin สร้าง/อนุมัติ Owner
  -> Owner เข้าสู่ระบบ/เปลี่ยนรหัสผ่านชั่วคราว
  -> เลือกหรือสลับหอ
  -> สร้างอาคาร ชั้น และห้อง
  -> สร้างคำเชิญ
  -> Tenant สมัครหรือบัญชีเดิมรับคำเชิญ
  -> Owner อนุมัติ occupancy (PRIMARY/CO_OCCUPANT)
  -> สร้างสัญญา -> พิมพ์/เซ็น -> อัปโหลด -> เปิดใช้งาน
  -> บันทึกมิเตอร์เป็น draft -> ตรวจหน่วย -> บันทึก
  -> สร้างบิลเดี่ยวหรือทั้งหอ -> ตรวจ preview -> เผยแพร่
  -> Tenant ส่งสลิป -> Owner ตรวจยอด/วันเวลา/ภาพ
  -> อนุมัติ = บิลชำระแล้ว | ปฏิเสธพร้อมเหตุผล = Tenant ส่งใหม่
```

ทางออกกรณีผิดพลาด: ทุก mutation ต้องคงข้อมูลในฟอร์ม, แสดงข้อความภาษาไทยพร้อม request ID,
ป้องกันการกดซ้ำ และให้ลองใหม่ได้ หาก Subscription เป็น READ_ONLY ต้องยังดู/ค้นหา/ดาวน์โหลดข้อมูลเดิมได้

### Tenant mobile flow

```text
สมัครด้วยรหัสเชิญ หรือเข้าสู่บัญชีเดิม
  -> รอ Owner อนุมัติ
  -> เลือก occupancy เมื่อมีมากกว่าหนึ่งรายการ
  -> หน้าหลักแสดงงานเร่งด่วน
  -> บิล -> รายละเอียด -> QR PromptPay -> อัปโหลดสลิป
  -> ดูสถานะตรวจสอบ/เหตุผลปฏิเสธ -> ส่งใหม่ในบิลเดิม
  -> ดูสัญญา ประกาศ พัสดุ
  -> แจ้งซ่อมหรือร้องเรียน -> ตอบกลับและติดตาม event history
  -> Chat กับ Owner และจัดการบัญชี
```

### Super Admin flow

```text
เข้าสู่ระบบ -> Dashboard
  -> Accounts: สร้าง/อนุมัติ/ปฏิเสธ/ออกรหัสชั่วคราว
  -> Properties: ค้นหาและดูรายละเอียดหอ
  -> Plans: สร้าง/แก้ไข/ปิดขายแพ็กเกจ
  -> Subscriptions: ตรวจสลิปและต่ออายุ
  -> Audit logs: กรอง actor/property/action/result/request ID
```

## 3. Information Architecture

```text
Public
├─ Login / Forgot password / Reset password / Change temporary password
└─ Tenant registration

Owner workspace (มี property switcher ตลอดเวลา)
├─ Dashboard: summary, work queue, notifications, global search
├─ Rooms: อาคาร > ชั้น > ห้อง
├─ Tenants: รายการ, approval, occupancy, invitation
├─ Contracts: versions, signed document, lifecycle
├─ Meters: water, electricity, bulk entry
├─ Billing: invoices, bulk generation, payment review
├─ Operations: tickets, history, parcels, announcements, chat
├─ SaaS subscription: plans, orders, payment, renewal
└─ Account / Property settings / Documents / Help

Tenant portal (occupancy selector)
├─ Home
├─ Invoices and payment
├─ Tickets
├─ Parcels
└─ More: lease, announcements, chat, account

Super Admin
├─ Dashboard
├─ Accounts
├─ Properties
├─ Plans
├─ Subscriptions
└─ Audit logs
```

ข้อมูลรถเป็นของ Tenant/occupancy ไม่ใช่ Room และผู้พักร่วมต้องอ้างอิง occupancy จริง ไม่เก็บข้อความซ้ำในห้อง

## 4. Screen Inventory

| Role | Screen | จุดประสงค์ | สถานะสำคัญ |
|---|---|---|---|
| Public | Login/password flows | เข้าใช้และกู้บัญชี | loading, invalid, locked, temporary password |
| Public | Tenant registration | สมัคร/รับ invitation | invalid, expired, pending approval |
| Owner | Dashboard | เห็น KPI และงานที่ต้องทำ | loading, empty, API error, FULL/GRACE/READ_ONLY |
| Owner | Rooms | ดูแบบอาคาร-ชั้นและแก้ห้อง | vacant, occupied, maintenance, inactive |
| Owner | Tenants/approvals/invitations | จัดการตัวตนและ occupancy | pending, active, rejected, ended, expired |
| Owner | Contracts | สร้าง version และ lifecycle | draft, pending signature, active, ended/cancelled |
| Owner | Meters | กรอกน้ำ/ไฟต่อเนื่อง | draft, saved, duplicate, abnormal usage |
| Owner | Invoices/payment review | สร้างบิลและตรวจสลิป | draft, issued, overdue, review, paid, rejected |
| Owner | Tickets/history | จัดการแจ้งซ่อม/ร้องเรียน | open, in progress, resolved, closed |
| Owner | Parcels | รับและส่งมอบพัสดุ | waiting, picked up |
| Owner | Announcements | draft/schedule/publish | draft, scheduled, published, cancelled |
| Owner | Subscription | ซื้อ ส่งสลิป ต่ออายุ | pending payment/review, paid, rejected, expired |
| Owner | Settings/documents/account | ตั้งค่าหอและความปลอดภัย | saved, unsaved, validation/error |
| Tenant | Home | สรุปสิ่งที่ต้องทำ | unpaid, parcel waiting, open ticket, unread |
| Tenant | Invoice/payment | ดู QR และส่งสลิป | unpaid, under review, rejected, paid, overdue |
| Tenant | Lease | ดูสัญญาปัจจุบัน | no lease, active, ended |
| Tenant | Announcement/parcel | อ่านข่าวและรับพัสดุ | unread/read, waiting/picked up |
| Tenant | Ticket/chat | ติดต่อและติดตาม | unread/read, upload error, read-only |
| Tenant | Account | profile/password/occupancy | saving, invalid invite, switching |
| Super Admin | 6 resource screens | กำกับ SaaS | loading, empty, filtered, paginated, review dialog |

ทุกหน้ารายการต้องมี loading, empty, error, search/filter (เมื่อข้อมูลมาก), pagination และ total จาก server
ไม่ควรใช้จำนวนที่คำนวณจากเฉพาะหน้าที่โหลดมาแทน total

## 5. Low-fidelity wireframes

### Owner dashboard (desktop)

```text
┌──────── Sidebar ────────┬──────────────────────────────────────────────┐
│ [หอ ▼]                  │ Dashboard        [Search] [Bell] [หอ ▼]     │
│ Dashboard               ├──────────────────────────────────────────────┤
│ Rooms / Tenants         │ [ค้างชำระ] [สลิปรอตรวจ] [ห้องว่าง] [รายได้]│
│ Contracts / Meters      ├──────────────────────────────────────────────┤
│ Billing / Tickets       │ งานที่ต้องทำ                                 │
│ Parcels / Announcement │ [อนุมัติ tenant] [ตรวจ slip] [สัญญาใกล้หมด]│
│ Invitation / SaaS       ├──────────────────────────┬───────────────────┤
│                         │ แนวโน้มรายได้            │ กิจกรรมล่าสุด     │
│ [Account / Settings]    │                          │                   │
└─────────────────────────┴──────────────────────────┴───────────────────┘
```

### Meter to bulk invoice

```text
[อาคาร ▼] [ชั้น ▼] [รอบบิล ▼]     Saved draft 12/20
┌──────┬─────────┬─────────┬────────┬────────┐
│ ห้อง │ ครั้งก่อน│ ปัจจุบัน │ หน่วยใช้│ สถานะ │
└──────┴─────────┴─────────┴────────┴────────┘
[บันทึก draft] -> [ตรวจความผิดปกติ] -> [สร้างบิลทั้งหอ]
                                           |
                           Preview: สำเร็จ / ขาดมิเตอร์ / error
                                           |
                                  [ยืนยันเผยแพร่บิล]
```

### Owner payment review

```text
┌─ Queue รอตรวจ ────────┬─ รายละเอียด ────────────────────────────────┐
│ ห้อง / ผู้เช่า / ยอด   │ เลขบิล ผู้เช่า ห้อง ยอด วันเวลา             │
│ เลือกรายการ            │ [ภาพสลิป]                                   │
│ โหลดเพิ่มเติม          │ คำเตือนยอด/เวลาผิดปกติ                     │
│                        │ [ปฏิเสธ + เหตุผล] [ยืนยันรับชำระ]           │
└────────────────────────┴─────────────────────────────────────────────┘
```

### Tenant mobile prototype

```text
┌──────────────────────────┐
│ บ้านอยู่สบาย   [ห้อง ▼] 🔔│
│ ต้องชำระ ฿... ภายใน ...  │
│ [ดูบิลและชำระ]           │
│ พัสดุรอรับ | เรื่องติดตาม │
│ สิ่งที่ต้องทำ             │
│ - ส่งสลิป / อ่านประกาศ    │
│ - ตอบ ticket              │
├──────────────────────────┤
│ Home | บิล | พัสดุ | แจ้งเรื่อง | เพิ่มเติม │
└──────────────────────────┘
```

ตัว prototype ที่คลิกได้คือ route จริง `/admin/properties/:propertyId/*` และ `/tenant/*` ซึ่งเรียก API จริง
ไม่ใช่ภาพ mock แยกจากระบบ

## 6. Design System

| Token | ค่า | การใช้ |
|---|---|---|
| Primary | `#5865F2` | primary action, active navigation, focus |
| Success | `#35ED7E` | paid/success |
| Info | `#00B0F4` | link/info |
| Accent | `#EC48BD` | badge/accent เท่านั้น |
| Canvas | `#FFFFFF` | page background |
| Text | `#0B0D45` | primary text |
| Radius | 12 / 16 / 24 px | control / card / major panel |
| Minimum target | 44×44 px | touch and keyboard target |
| Focus | 2 px primary ring | ทุก interactive element |

หลักการ component: ใช้ `primary-button`, `secondary-button`, panel, badge, dialog, toast,
notification center, dropdown, pagination และ form states ร่วมกัน ห้ามแสดง enum ดิบแก่ Owner/Tenant
วันที่แสดงด้วย locale `th-TH`; API ใช้ ISO 8601; เงินแสดงสัญลักษณ์บาทและ comma

Accessibility: semantic heading ตามลำดับ, label ผูก input, `aria-current` สำหรับ navigation,
`role=alert/status` ตามความเร่งด่วน, dialog ปิดด้วย Escape/คืน focus และห้ามสื่อสถานะด้วยสีอย่างเดียว

## 7. Responsive acceptance matrix

| Width | Owner | Tenant | Super Admin |
|---|---|---|---|
| 390 | stacked content, modal bottom sheet, table scroll เฉพาะตัว table | bottom nav 5 จุด, More menu, safe area | navigation และ table ใช้งานได้ |
| 768 | 1–2 columns, filter wrap | content กว้างอ่านง่าย | form/table ไม่ล้น page |
| 1024 | sidebar + compact grids | desktop navigation ได้ | full navigation |
| 1440 | max content density โดยไม่ยืดข้อความเกินไป | centered content | multi-column summaries |

ตรวจทุก viewport: ไม่มี page-level horizontal overflow, CTA ไม่ถูก bottom nav บัง, keyboard focus มองเห็น,
modal เลื่อนได้, table header/row ยังสัมพันธ์กัน และข้อความไทยที่ยาวไม่ทับ badge/action

## 8. Usability test plan (ต้องใช้คนจริง)

ผู้ร่วมทดสอบขั้นต่ำ: Owner/ผู้ดูแลหอ 3 คน และ Tenant 3 คน โดยอย่างน้อยบทบาทละ 1 คนไม่ถนัดเทคโนโลยี
และมี Owner อย่างน้อย 1 คนทดลองบนมือถือ ผู้ดำเนินการไม่ควรเป็นผู้สร้างหน้าจอ

Owner tasks:

1. สลับหอ แล้วหาผู้เช่าที่รออนุมัติและอนุมัติ
2. บันทึกมิเตอร์ 3 ห้อง ตรวจค่าผิดปกติ และสร้างบิลทั้งหอ
3. ตรวจสลิปหนึ่งรายการ; ปฏิเสธพร้อมเหตุผล แล้วตรวจสลิปที่ส่งใหม่
4. หาสัญญาห้องที่กำหนด ดาวน์โหลด และอธิบาย version/status
5. ต่ออายุแพ็กเกจและอธิบายผลของ GRACE/READ_ONLY

Tenant tasks:

1. เลือก occupancy และบอกยอด/วันครบกำหนดโดยไม่รับคำแนะนำ
2. เปิด QR อัปโหลดสลิป และหาสถานะหรือเหตุผลปฏิเสธ
3. เปิดประกาศล่าสุดและพัสดุรอรับ
4. สร้าง ticket ตอบกลับ และกลับมาติดตามสถานะ
5. เปิดสัญญา ติดต่อหอ และเปลี่ยนรหัสผ่าน

ห้ามช่วยระหว่าง task ยกเว้นผู้ใช้ติดเกิน 60 วินาที ให้บันทึกเป็น “สำเร็จเมื่อช่วย”
บันทึก screen, device, เวลา, จำนวน misclick/backtrack, คำพูดจริง และ severity ของปัญหา

Severity: `S0 blocker/data loss`, `S1 ทำ task ไม่สำเร็จ`, `S2 สำเร็จแต่สับสน/ช้า`, `S3 cosmetic`
แก้ S0/S1 ทั้งหมดก่อน release; S2 ที่พบตั้งแต่ 2 คนขึ้นไปต้องแก้หรือมีเหตุผลยอมรับ

## 9. Definition of done และเปอร์เซ็นต์

| งาน | น้ำหนัก | สถานะปัจจุบัน | คะแนนที่นับได้ |
|---|---:|---|---:|
| User Flow + IA | 1.5% | จัดทำและผูกกับ route จริงแล้ว | 1.5% |
| Screen Inventory | 1.0% | ครบ 3 role และ system state | 1.0% |
| Owner critical wireframes | 1.5% | dashboard, meter/bulk bill, payment review | 1.5% |
| Tenant mobile prototype | 1.5% | coded prototype + bottom navigation | 1.5% |
| Design System | 1.0% | tokens/components/accessibility documented | 1.0% |
| Usability test 3+3 | 1.5% | protocol และแบบบันทึก `USABILITY_TEST_RESULTS.csv` พร้อม แต่ยังไม่มีผลคนจริง | 0% |
| แก้ผลทดสอบ + responsive จริง | 1.0% | Chromium 390 px สำหรับ Owner/Tenant และ critical UI journeys ผ่านแล้ว; ยังรออุปกรณ์จริงและ retest หลัง session 3+3 | 0.5% |

หากฐานก่อนรอบนี้คือ 91%: งานที่ยืนยันได้เพิ่ม 7.0% ทำให้สถานะปัจจุบันประมาณ **98.0% — พร้อมทดสอบผู้ใช้**
ไม่ควรรายงาน 100% จนมีผู้เข้าร่วมจริง 3+3, แนบผล, แก้ S0/S1 และ retest ผ่าน
