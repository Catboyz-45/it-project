# สารบัญ API ของ Nestly

> ไฟล์นี้สร้างอัตโนมัติจากโค้ดด้วย `npm run docs:api` จึงไม่ควรแก้รายการ endpoint ด้วยมือ

อัปเดตล่าสุด: 27 สิงหาคม 2569 เวลา 17:15

## สรุปแบบสั้น

- มี URL API ทั้งหมด **114 เส้นทาง**
- เมื่อนับ HTTP method แยกกัน มีการทำงานที่เรียกได้ทั้งหมด **144 รายการ**
- `[propertyId]`, `[invoiceId]` หรือข้อความในวงเล็บเหลี่ยมหมายถึงค่าที่เปลี่ยนไปตามรายการ เช่น ID ของหอหรือบิล
- `GET` = อ่าน, `POST` = สร้าง/สั่งทำงาน, `PUT` = แทนค่าทั้งชุด, `PATCH` = แก้บางส่วน, `DELETE` = ลบหรือยกเลิก

ทุก endpoint ที่มีข้อมูลส่วนตัวหรือเปลี่ยนข้อมูลต้องตรวจ session, role, สิทธิ์ในหอพัก และข้อมูลขาเข้าบนเซิร์ฟเวอร์ การซ่อนปุ่มในหน้าเว็บเพียงอย่างเดียวไม่ถือว่าเป็นการป้องกัน

## บัญชีผู้ใช้ส่วนกลาง

| Method | URL | ใช้ทำอะไร |
|---|---|---|
| `POST` | `/api/account/password` | อ่านหรือจัดการรหัสผ่านตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `PATCH` | `/api/account/profile` | อ่านหรือจัดการข้อมูลส่วนตัวตาม HTTP method และสิทธิ์ของผู้ใช้ |

## เข้าสู่ระบบและบัญชี

| Method | URL | ใช้ทำอะไร |
|---|---|---|
| `POST` | `/api/auth/change-password` | เปลี่ยนรหัสผ่านของบัญชีที่เข้าสู่ระบบ |
| `POST` | `/api/auth/forgot-password` | เริ่มขั้นตอนลืมรหัสผ่าน |
| `POST` | `/api/auth/login` | ตรวจอีเมล/รหัสผ่านและสร้าง session |
| `POST` | `/api/auth/logout` | ยกเลิก session และออกจากระบบ |
| `POST` | `/api/auth/reset-password` | ตั้งรหัสผ่านใหม่ด้วย token แบบใช้ครั้งเดียว |

## แชทเดิม/เส้นทางรองรับย้อนหลัง

| Method | URL | ใช้ทำอะไร |
|---|---|---|
| `GET` | `/api/chat/attachments/[messageId]` | อ่านหรือจัดการไฟล์แนบตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `POST` | `/api/chat/attachments` | อ่านหรือจัดการไฟล์แนบตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `GET` `POST` | `/api/chat/messages` | อ่านหรือจัดการข้อความแชทตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `GET` | `/api/chat/stream` | รับข้อความหรือสถานะแชทใหม่แบบต่อเนื่อง (stream) |

## เอกสาร

| Method | URL | ใช้ทำอะไร |
|---|---|---|
| `GET` `POST` `PUT` | `/api/document-templates/[kind]` | อ่านหรือจัดการแม่แบบเอกสารตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `GET` | `/api/documents/[id]/download` | ดาวน์โหลดเอกสาร |
| `POST` | `/api/documents/preview` | สร้างตัวอย่างเอกสารก่อนบันทึกจริง |
| `POST` | `/api/documents` | อ่านหรือจัดการเอกสารตาม HTTP method และสิทธิ์ของผู้ใช้ |

## ตรวจสุขภาพระบบ

| Method | URL | ใช้ทำอะไร |
|---|---|---|
| `GET` | `/api/health` | อ่านหรือจัดการความพร้อมของเซิร์ฟเวอร์และฐานข้อมูลตาม HTTP method และสิทธิ์ของผู้ใช้ |

## งานภายในระบบ

| Method | URL | ใช้ทำอะไร |
|---|---|---|
| `POST` | `/api/internal/jobs/maintenance` | เรียกงานบำรุงรักษาภายในด้วย secret ของระบบ |

## API ส่วนกลางและเส้นทางรองรับย้อนหลัง

| Method | URL | ใช้ทำอะไร |
|---|---|---|
| `POST` | `/api/super-admin/properties` | อ่านหรือจัดการหอพักตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `POST` | `/api/super-admin/users` | อ่านหรือจัดการบัญชีผู้ใช้ตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `GET` | `/api/v1/plans` | อ่านหรือจัดการแพ็กเกจ SaaSตาม HTTP method และสิทธิ์ของผู้ใช้ |

## Owner/Admin — ดูแลหอพัก

| Method | URL | ใช้ทำอะไร |
|---|---|---|
| `PATCH` | `/api/v1/admin/properties/[propertyId]/announcements/[announcementId]` | อ่านหรือจัดการประกาศตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `GET` `POST` | `/api/v1/admin/properties/[propertyId]/announcements` | อ่านหรือจัดการประกาศตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `PATCH` | `/api/v1/admin/properties/[propertyId]/buildings/[buildingId]/floors/[floorId]` | อ่านหรือจัดการอาคารและชั้นตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `POST` | `/api/v1/admin/properties/[propertyId]/buildings/[buildingId]/floors` | อ่านหรือจัดการอาคารและชั้นตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `PATCH` | `/api/v1/admin/properties/[propertyId]/buildings/[buildingId]` | อ่านหรือจัดการอาคารและชั้นตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `GET` `POST` | `/api/v1/admin/properties/[propertyId]/buildings` | อ่านหรือจัดการอาคารและชั้นตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `PUT` | `/api/v1/admin/properties/[propertyId]/catalogs` | อ่านหรือจัดการหอพักตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `GET` | `/api/v1/admin/properties/[propertyId]/dashboard` | อ่านหรือจัดการข้อมูลสรุปแดชบอร์ดตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `GET` | `/api/v1/admin/properties/[propertyId]/dashboard/summary` | อ่านข้อมูลสรุปข้อมูลสรุปแดชบอร์ด |
| `GET` | `/api/v1/admin/properties/[propertyId]/exports/[resource]` | อ่านหรือจัดการหอพักตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `DELETE` | `/api/v1/admin/properties/[propertyId]/invitations/[invitationId]` | อ่านหรือจัดการคำเชิญผู้เช่าตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `GET` `POST` | `/api/v1/admin/properties/[propertyId]/invitations` | อ่านหรือจัดการคำเชิญผู้เช่าตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `PATCH` | `/api/v1/admin/properties/[propertyId]/invoices/[invoiceId]` | อ่านหรือจัดการบิลตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `POST` | `/api/v1/admin/properties/[propertyId]/invoices/bulk` | อ่านหรือจัดการบิลตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `GET` | `/api/v1/admin/properties/[propertyId]/invoices/preflight` | อ่านหรือจัดการบิลตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `POST` | `/api/v1/admin/properties/[propertyId]/invoices/recalculate-overdue` | อ่านหรือจัดการบิลตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `GET` `POST` | `/api/v1/admin/properties/[propertyId]/invoices` | อ่านหรือจัดการบิลตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `POST` | `/api/v1/admin/properties/[propertyId]/leases/[leaseId]/renew` | อ่านหรือจัดการสัญญาเช่าตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `GET` `PATCH` | `/api/v1/admin/properties/[propertyId]/leases/[leaseId]` | อ่านหรือจัดการสัญญาเช่าตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `GET` `POST` | `/api/v1/admin/properties/[propertyId]/leases/[leaseId]/signed-document` | อ่านหรือจัดการสัญญาเช่าตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `GET` `POST` | `/api/v1/admin/properties/[propertyId]/leases` | อ่านหรือจัดการสัญญาเช่าตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `POST` | `/api/v1/admin/properties/[propertyId]/meter-readings/bulk` | อ่านหรือจัดการเลขมิเตอร์ตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `GET` `POST` | `/api/v1/admin/properties/[propertyId]/meter-readings` | อ่านหรือจัดการเลขมิเตอร์ตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `GET` | `/api/v1/admin/properties/[propertyId]/meter-readings/worksheet` | อ่านหรือจัดการเลขมิเตอร์ตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `GET` | `/api/v1/admin/properties/[propertyId]/notifications/unread` | อ่านหรือจัดการการแจ้งเตือนตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `PATCH` `DELETE` | `/api/v1/admin/properties/[propertyId]/occupancies/[occupancyId]` | อ่านหรือจัดการหอพักตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `GET` | `/api/v1/admin/properties/[propertyId]/occupancies` | อ่านหรือจัดการหอพักตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `GET` | `/api/v1/admin/properties/[propertyId]/occupancy-transitions` | อ่านหรือจัดการหอพักตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `GET` | `/api/v1/admin/properties/[propertyId]/parcels/[parcelId]/image` | อ่านหรือจัดการพัสดุตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `PATCH` | `/api/v1/admin/properties/[propertyId]/parcels/[parcelId]` | อ่านหรือจัดการพัสดุตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `GET` `POST` | `/api/v1/admin/properties/[propertyId]/parcels` | อ่านหรือจัดการพัสดุตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `PATCH` | `/api/v1/admin/properties/[propertyId]/payment-submissions/[paymentId]` | อ่านหรือจัดการหอพักตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `GET` | `/api/v1/admin/properties/[propertyId]/payment-submissions/[paymentId]/slip` | เปิดดูไฟล์สลิปที่มีสิทธิ์เข้าถึง |
| `GET` | `/api/v1/admin/properties/[propertyId]/payment-submissions` | อ่านหรือจัดการหอพักตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `PATCH` | `/api/v1/admin/properties/[propertyId]/rooms/[roomId]` | อ่านหรือจัดการห้องพักตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `GET` `POST` | `/api/v1/admin/properties/[propertyId]/rooms` | อ่านหรือจัดการห้องพักตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `GET` `PATCH` | `/api/v1/admin/properties/[propertyId]` | อ่านหรือจัดการหอพักตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `GET` | `/api/v1/admin/properties/[propertyId]/search` | อ่านหรือจัดการหอพักตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `GET` `PUT` | `/api/v1/admin/properties/[propertyId]/settings` | อ่านหรือจัดการการตั้งค่าหอพักตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `POST` | `/api/v1/admin/properties/[propertyId]/subscription-orders/[orderId]/payments` | อ่านหรือจัดการการชำระเงินตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `GET` `POST` | `/api/v1/admin/properties/[propertyId]/subscription-orders` | อ่านหรือจัดการคำสั่งซื้อสมาชิกตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `GET` `POST` | `/api/v1/admin/properties/[propertyId]/support-chat` | อ่านหรือจัดการหอพักตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `GET` `POST` | `/api/v1/admin/properties/[propertyId]/tenant-chat/[tenantProfileId]` | อ่านหรือจัดการหอพักตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `GET` | `/api/v1/admin/properties/[propertyId]/tenant-chat` | อ่านหรือจัดการหอพักตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `GET` `PATCH` | `/api/v1/admin/properties/[propertyId]/tenants/[tenantProfileId]` | อ่านหรือจัดการผู้เช่าตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `GET` `POST` | `/api/v1/admin/properties/[propertyId]/tenants/[tenantProfileId]/transitions` | อ่านหรือจัดการผู้เช่าตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `GET` | `/api/v1/admin/properties/[propertyId]/tenants` | อ่านหรือจัดการผู้เช่าตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `GET` | `/api/v1/admin/properties/[propertyId]/tickets/[ticketId]/attachments/[attachmentId]` | อ่านหรือจัดการไฟล์แนบตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `GET` `POST` | `/api/v1/admin/properties/[propertyId]/tickets/[ticketId]/replies` | อ่านหรือจัดการงานแจ้งเรื่องตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `PATCH` | `/api/v1/admin/properties/[propertyId]/tickets/[ticketId]` | อ่านหรือจัดการงานแจ้งเรื่องตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `GET` | `/api/v1/admin/properties/[propertyId]/tickets` | อ่านหรือจัดการงานแจ้งเรื่องตาม HTTP method และสิทธิ์ของผู้ใช้ |

## แชทเวอร์ชันหลัก

| Method | URL | ใช้ทำอะไร |
|---|---|---|
| `POST` | `/api/v1/chat/conversations/[conversationId]/attachments` | อ่านหรือจัดการไฟล์แนบตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `GET` | `/api/v1/chat/conversations/[conversationId]/stream` | รับข้อความหรือสถานะแชทใหม่แบบต่อเนื่อง (stream) |
| `GET` | `/api/v1/chat/messages/[messageId]/attachment` | อ่านหรือจัดการข้อความแชทตาม HTTP method และสิทธิ์ของผู้ใช้ |

## Super Admin — ดูแลแพลตฟอร์ม

| Method | URL | ใช้ทำอะไร |
|---|---|---|
| `GET` | `/api/v1/super-admin/audit-logs/export` | ส่งออกประวัติการทำงานของระบบเป็นไฟล์ |
| `GET` | `/api/v1/super-admin/audit-logs` | อ่านหรือจัดการประวัติการทำงานของระบบตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `GET` | `/api/v1/super-admin/dashboard` | อ่านหรือจัดการข้อมูลสรุปแดชบอร์ดตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `PATCH` | `/api/v1/super-admin/plans/[planId]` | อ่านหรือจัดการแพ็กเกจ SaaSตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `GET` | `/api/v1/super-admin/plans/export` | ส่งออกแพ็กเกจ SaaSเป็นไฟล์ |
| `GET` `POST` | `/api/v1/super-admin/plans` | อ่านหรือจัดการแพ็กเกจ SaaSตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `GET` `PATCH` | `/api/v1/super-admin/properties/[propertyId]` | อ่านหรือจัดการหอพักตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `PUT` | `/api/v1/super-admin/properties/[propertyId]/subscription` | อ่านหรือจัดการสถานะสมาชิกตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `GET` `POST` | `/api/v1/super-admin/properties/[propertyId]/support-chat` | อ่านหรือจัดการหอพักตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `GET` | `/api/v1/super-admin/properties/export` | ส่งออกหอพักเป็นไฟล์ |
| `GET` | `/api/v1/super-admin/properties` | อ่านหรือจัดการหอพักตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `PATCH` | `/api/v1/super-admin/subscription-payments/[paymentId]` | อ่านหรือจัดการหลักฐานชำระค่าสมาชิกตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `GET` | `/api/v1/super-admin/subscription-payments/[paymentId]/slip` | เปิดดูไฟล์สลิปที่มีสิทธิ์เข้าถึง |
| `GET` | `/api/v1/super-admin/subscription-payments` | อ่านหรือจัดการหลักฐานชำระค่าสมาชิกตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `GET` | `/api/v1/super-admin/support-chat` | อ่านหรือจัดการsupport chatตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `PATCH` | `/api/v1/super-admin/users/[userId]/approval` | อนุมัติหรือปฏิเสธบัญชี |
| `PATCH` | `/api/v1/super-admin/users/[userId]/memberships` | อ่านหรือจัดการบัญชีผู้ใช้ตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `POST` | `/api/v1/super-admin/users/[userId]/temporary-password` | ออกหรือเปลี่ยนรหัสผ่านชั่วคราว |
| `GET` | `/api/v1/super-admin/users/export` | ส่งออกบัญชีผู้ใช้เป็นไฟล์ |
| `GET` | `/api/v1/super-admin/users` | อ่านหรือจัดการบัญชีผู้ใช้ตาม HTTP method และสิทธิ์ของผู้ใช้ |

## Tenant — ผู้เช่า

| Method | URL | ใช้ทำอะไร |
|---|---|---|
| `GET` | `/api/v1/tenant/announcements` | อ่านหรือจัดการประกาศตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `GET` `POST` | `/api/v1/tenant/chat` | อ่านหรือจัดการchatตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `POST` | `/api/v1/tenant/invitations/accept` | ยืนยันรับคำเชิญผู้เช่า |
| `GET` `POST` | `/api/v1/tenant/invoices/[invoiceId]/payment-submissions` | อ่านหรือจัดการบิลตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `GET` | `/api/v1/tenant/invoices/[invoiceId]/promptpay-qr` | อ่านหรือจัดการบิลตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `GET` | `/api/v1/tenant/invoices/[invoiceId]` | อ่านหรือจัดการบิลตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `GET` | `/api/v1/tenant/invoices` | อ่านหรือจัดการบิลตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `GET` | `/api/v1/tenant/lease` | อ่านหรือจัดการleaseตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `GET` | `/api/v1/tenant/lease/signed-document` | อ่านหรือจัดการsigned documentตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `GET` `PATCH` | `/api/v1/tenant/me` | อ่านหรือจัดการข้อมูลบัญชีปัจจุบันตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `GET` | `/api/v1/tenant/notifications/summary` | อ่านข้อมูลสรุปการแจ้งเตือน |
| `POST` | `/api/v1/tenant/occupancy-selection` | อ่านหรือจัดการoccupancy selectionตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `GET` | `/api/v1/tenant/parcels/[parcelId]/image` | อ่านหรือจัดการพัสดุตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `GET` | `/api/v1/tenant/parcels` | อ่านหรือจัดการพัสดุตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `POST` | `/api/v1/tenant/register` | อ่านหรือจัดการregisterตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `GET` | `/api/v1/tenant/room` | อ่านหรือจัดการroomตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `GET` | `/api/v1/tenant/tickets/[ticketId]/attachments/[attachmentId]` | อ่านหรือจัดการไฟล์แนบตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `POST` | `/api/v1/tenant/tickets/[ticketId]/attachments` | อ่านหรือจัดการไฟล์แนบตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `GET` `POST` | `/api/v1/tenant/tickets/[ticketId]/replies` | อ่านหรือจัดการงานแจ้งเรื่องตาม HTTP method และสิทธิ์ของผู้ใช้ |
| `GET` `POST` | `/api/v1/tenant/tickets` | อ่านหรือจัดการงานแจ้งเรื่องตาม HTTP method และสิทธิ์ของผู้ใช้ |

## หมายเหตุสำหรับผู้พัฒนา

- รายการนี้บอกขอบเขตและหน้าที่ระดับภาพรวม ส่วนรูปแบบ request/response ที่ใช้เป็นสัญญาทางเทคนิคอยู่ใน `docs/openapi.json` และไฟล์ validation ของแต่ละโมดูล
- หากเพิ่ม ลบ หรือเปลี่ยน route ให้รัน `npm run docs:api` และ `npm run openapi:check` ก่อนส่งงาน
- เส้นทางเก่าที่ไม่มี `/v1` ยังมีไว้เพื่อรองรับส่วนเดิมของระบบ ควรใช้ `/api/v1/...` สำหรับงานใหม่เมื่อมี endpoint เทียบเท่า

