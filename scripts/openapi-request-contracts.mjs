/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นคำสั่งสำหรับนักพัฒนา/ระบบอัตโนมัติในงาน “openapi request contracts”
 * การทำงาน: เรียกใช้จาก terminal หรือ package script เพื่อทำงานบำรุงรักษาที่ทำซ้ำได้; ควรทดลองในสภาพแวดล้อมที่ไม่ใช่ production ก่อนเมื่อมีการเขียนข้อมูล
 */

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “text” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - extra: ค่า “extra” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
 */
const text = (extra = {}) => ({ type: "string", ...extra });
const id = text({ minLength: 1 });
const bool = { type: "boolean" };
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “integer” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - minimum: ค่า “minimum” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - maximum: ค่า “maximum” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
 */
const integer = (minimum, maximum) => ({ type: "integer", ...(minimum === undefined ? {} : { minimum }), ...(maximum === undefined ? {} : { maximum }) });
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “number” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - minimum: ค่า “minimum” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
 */
const number = (minimum = 0) => ({ type: "number", minimum });
const dateTime = text({ format: "date-time" });
const billingMonth = text({ pattern: "^\\d{4}-(0[1-9]|1[0-2])$" });
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “nullable” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - schema: ค่า “schema” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
 */
const nullable = (schema) => ({ anyOf: [schema, { type: "null" }] });
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “array” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - items: ค่า “items” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - extra: ค่า “extra” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
 */
const array = (items, extra = {}) => ({ type: "array", items, ...extra });
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “object” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - required: ค่า “required” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - properties: ค่า “properties” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
 */
const object = (required, properties) => ({ type: "object", required, properties, additionalProperties: false });
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “partial” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - properties: ค่า “properties” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
 */
const partial = (properties) => object([], properties);
const file = text({ format: "binary" });

const money = number(0);
const roomFields = {
  roomType: text({ minLength: 1, maxLength: 80 }), monthlyRent: money,
  depositAmount: money, capacity: integer(1, 100),
  furniture: array(text({ minLength: 1, maxLength: 80 }), { maxItems: 100 }),
};
const planFields = {
  code: text({ pattern: "^[A-Z0-9_-]+$", minLength: 2, maxLength: 40 }),
  name: text({ minLength: 2, maxLength: 80 }), description: nullable(text({ maxLength: 500 })),
  monthlyPrice: money, yearlyPrice: nullable(money), maxProperties: integer(1, 10000),
  maxRooms: integer(1, 1000000), allowPromptPay: bool, allowFileUploads: bool,
  allowPrioritySupport: bool, sortOrder: integer(0, 100000), isActive: bool,
};

const contracts = new Map();
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “json” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - method: ค่า “method” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - path: ค่า “path” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - schema: ค่า “schema” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - example: ค่า “example” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
 */
const json = (method, path, schema, example) => contracts.set(`${method} ${path}`, { mediaType: "application/json", schema, example });
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “multipart” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - path: ค่า “path” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - schema: ค่า “schema” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - example: ค่า “example” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
 */
const multipart = (path, schema, example) => contracts.set(`post ${path}`, { mediaType: "multipart/form-data", schema, example });
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “no Body” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - method: ค่า “method” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - path: ค่า “path” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
 */
const noBody = (method, path) => contracts.set(`${method} ${path}`, null);

json("post", "/api/v1/admin/properties/{propertyId}/buildings",
  object(["name", "code", "floors"], {
    name: text({ minLength: 1, maxLength: 120 }), code: text({ pattern: "^[A-Za-z0-9-]+$" }),
    floors: array(object(["number"], { number: integer(1, 999), label: text({ maxLength: 80 }) }), { minItems: 1, maxItems: 200 }),
  }), { name: "อาคาร A", code: "A", floors: [{ number: 1, label: "ชั้น 1" }] });
json("patch", "/api/v1/admin/properties/{propertyId}/buildings/{buildingId}", partial({
  name: text({ minLength: 1, maxLength: 120 }), code: text({ pattern: "^[A-Za-z0-9-]+$" }), isActive: bool,
}), { name: "อาคาร A ใหม่", isActive: true });
json("post", "/api/v1/admin/properties/{propertyId}/buildings/{buildingId}/floors",
  object(["number"], { number: integer(1, 999), label: text({ maxLength: 80 }) }), { number: 2, label: "ชั้น 2" });
json("patch", "/api/v1/admin/properties/{propertyId}/buildings/{buildingId}/floors/{floorId}",
  object(["label"], { label: nullable(text({ minLength: 1, maxLength: 80 })) }), { label: "ชั้นสอง" });
json("post", "/api/v1/admin/properties/{propertyId}/rooms",
  object(["buildingId", "floorId", "number", "roomType", "monthlyRent"], {
    buildingId: id, floorId: id, number: text({ minLength: 1, maxLength: 30 }),
    ...roomFields,
  }), { buildingId: "bld_a", floorId: "floor_a_1", number: "A101", roomType: "STANDARD", monthlyRent: 3500, depositAmount: 7000, capacity: 2, furniture: ["เตียง"] });
json("patch", "/api/v1/admin/properties/{propertyId}/rooms/{roomId}", partial({
  ...roomFields, status: { type: "string", enum: ["AVAILABLE", "MAINTENANCE", "INACTIVE"] },
}), { monthlyRent: 3800, status: "AVAILABLE" });
json("patch", "/api/v1/admin/properties/{propertyId}", partial({
  name: text({ minLength: 2, maxLength: 160 }), shortName: text({ minLength: 1, maxLength: 80 }),
}), { name: "บ้านอยู่สบาย", shortName: "บ้านสบาย" });
json("put", "/api/v1/admin/properties/{propertyId}/settings",
  object(["address", "contactPhone", "waterUnitRate", "electricityUnitRate", "billingDay", "dueDay", "lateFeePerDay", "invoicePrefix"], {
    legalName: nullable(text({ maxLength: 160 })), lessorName: nullable(text({ maxLength: 160 })),
    address: text({ minLength: 1, maxLength: 1000 }), contactPhone: text({ minLength: 1, maxLength: 30 }),
    contactEmail: nullable(text({ format: "email" })), promptPayId: nullable(text({ pattern: "^[0-9]{10,15}$" })),
    waterUnitRate: money, electricityUnitRate: money, billingDay: integer(1, 28), dueDay: integer(1, 31),
    lateFeePerDay: money, lateFeeCap: nullable(money), invoicePrefix: text({ minLength: 1, maxLength: 20 }),
    invoiceFooter: nullable(text({ maxLength: 2000 })), houseRules: nullable(text({ maxLength: 20000 })),
    emergencyContact: nullable(text({ maxLength: 500 })),
  }), { address: "กรุงเทพฯ", contactPhone: "021234567", waterUnitRate: 18, electricityUnitRate: 7.5, billingDay: 25, dueDay: 5, lateFeePerDay: 20, invoicePrefix: "INV" });
json("put", "/api/v1/admin/properties/{propertyId}/catalogs",
  object(["roomTypes", "serviceCharges", "furnitureOptions"], {
    roomTypes: array(object(["name", "rent", "deposit", "capacity"], { name: text(), rent: money, deposit: money, capacity: integer(1, 100) })),
    serviceCharges: array(object(["name", "amount", "frequency", "calculation"], { name: text(), amount: money, frequency: { type: "string", enum: ["monthly", "once"] }, calculation: { type: "string", enum: ["room", "person"] } })),
    furnitureOptions: array(object(["name", "isDefault"], { name: text(), isDefault: bool })),
  }), { roomTypes: [{ name: "ห้องมาตรฐาน", rent: 3500, deposit: 7000, capacity: 2 }], serviceCharges: [], furnitureOptions: [] });

json("post", "/api/v1/admin/properties/{propertyId}/invitations",
  object(["roomId"], { roomId: id, intendedRole: { type: "string", enum: ["PRIMARY", "CO_OCCUPANT"] }, expiresInDays: integer(1, 30) }),
  { roomId: "room_a101", intendedRole: "PRIMARY", expiresInDays: 7 });
noBody("delete", "/api/v1/admin/properties/{propertyId}/invitations/{invitationId}");
json("patch", "/api/v1/admin/properties/{propertyId}/occupancies/{occupancyId}",
  object(["status"], { status: { type: "string", enum: ["ACTIVE", "REJECTED"] } }), { status: "ACTIVE" });
json("delete", "/api/v1/admin/properties/{propertyId}/occupancies/{occupancyId}",
  object(["reason"], { reason: text({ minLength: 1, maxLength: 500 }) }), { reason: "สิ้นสุดสัญญา" });
json("patch", "/api/v1/admin/properties/{propertyId}/tenants/{tenantProfileId}", partial({
  displayName: text({ minLength: 2, maxLength: 120 }), phone: text({ minLength: 8, maxLength: 30 }),
  address: nullable(text({ maxLength: 1000 })), emergencyName: nullable(text({ maxLength: 160 })),
  emergencyPhone: nullable(text({ maxLength: 30 })),
}), { displayName: "สุดา สุขใจ", phone: "0891234567" });
json("post", "/api/v1/admin/properties/{propertyId}/tenants/{tenantProfileId}/transitions",
  object(["type", "effectiveDate", "reason", "deductions"], {
    type: { type: "string", enum: ["MOVE_OUT", "MOVE_ROOM"] }, destinationRoomId: id,
    effectiveDate: text({ format: "date" }), reason: text({ minLength: 1, maxLength: 500 }),
    deductions: array(object(["label", "amount"], { label: text({ minLength: 1, maxLength: 160 }), amount: money }), { maxItems: 30 }),
    settlementNote: text({ maxLength: 1000 }),
  }), { type: "MOVE_ROOM", destinationRoomId: "room_a102", effectiveDate: "2026-08-01", reason: "ต้องการห้องใหญ่ขึ้น", deductions: [] });

json("post", "/api/v1/admin/properties/{propertyId}/meter-readings",
  object(["roomId", "type", "billingMonth", "currentReading"], {
    roomId: id, type: { type: "string", enum: ["WATER", "ELECTRICITY"] },
    billingMonth, previousReading: number(0), currentReading: number(0),
  }), { roomId: "room_a101", type: "ELECTRICITY", billingMonth: "2026-07", previousReading: 1250, currentReading: 1320 });
json("post", "/api/v1/admin/properties/{propertyId}/meter-readings/bulk",
  object(["readings"], { readings: array(object(["roomId", "type", "billingMonth", "currentReading"], {
    roomId: id, type: { type: "string", enum: ["WATER", "ELECTRICITY"] }, billingMonth,
    previousReading: number(0), currentReading: number(0),
  }), { minItems: 1, maxItems: 10000 }) }),
  { readings: [{ roomId: "room_a101", type: "WATER", billingMonth: "2026-07", previousReading: 30, currentReading: 36 }] });
json("post", "/api/v1/admin/properties/{propertyId}/invoices",
  object(["roomId", "billingMonth"], { roomId: id, billingMonth, issueImmediately: { type: "boolean", const: false } }),
  { roomId: "room_a101", billingMonth: "2026-07", issueImmediately: false });
json("post", "/api/v1/admin/properties/{propertyId}/invoices/bulk",
  object(["billingMonth"], { billingMonth, issueImmediately: { type: "boolean", const: false } }), { billingMonth: "2026-07", issueImmediately: false });
json("patch", "/api/v1/admin/properties/{propertyId}/invoices/{invoiceId}",
  {
    oneOf: [
      object(["version"], { version: integer(1) }),
      object(["action", "version", "reason"], {
        action: { type: "string", enum: ["cancel"] },
        version: integer(1),
        reason: text({ minLength: 3, maxLength: 500 }),
      }),
    ],
  },
  { action: "cancel", version: 1, reason: "ออกบิลผิดห้อง" });
json("post", "/api/v1/admin/properties/{propertyId}/invoices/recalculate-overdue",
  partial({ asOf: dateTime }), { asOf: "2026-08-06T00:00:00.000Z" });
json("patch", "/api/v1/admin/properties/{propertyId}/payment-submissions/{paymentId}",
  object(["status"], { status: { type: "string", enum: ["APPROVED", "REJECTED"] }, rejectionNote: text({ maxLength: 500 }) }),
  { status: "APPROVED" });

json("post", "/api/v1/admin/properties/{propertyId}/leases",
  object(["roomId", "startDate", "endDate", "monthlyRent"], { roomId: id, startDate: dateTime, endDate: dateTime, monthlyRent: money, depositAmount: money, templateId: id }),
  { roomId: "room_a101", startDate: "2026-08-01T00:00:00.000Z", endDate: "2027-07-31T00:00:00.000Z", monthlyRent: 3500, depositAmount: 7000 });
json("patch", "/api/v1/admin/properties/{propertyId}/leases/{leaseId}",
  {
    oneOf: [
      object(["expectedVersion", "status"], {
        expectedVersion: integer(1),
        status: { type: "string", enum: ["DRAFT", "PENDING_SIGNATURE", "ACTIVE", "EXPIRING", "EXPIRED", "CANCELLED"] },
      }),
      object(["expectedVersion"], {
        expectedVersion: integer(1), startDate: dateTime, endDate: dateTime,
        monthlyRent: money, depositAmount: money, templateId: nullable(id),
      }),
    ],
  },
  { expectedVersion: 2, status: "PENDING_SIGNATURE" });
json("post", "/api/v1/admin/properties/{propertyId}/leases/{leaseId}/renew",
  object(["startDate", "endDate", "monthlyRent"], {
    startDate: dateTime, endDate: dateTime, monthlyRent: money, depositAmount: money,
  }),
  { startDate: "2027-08-01T00:00:00.000Z", endDate: "2028-07-31T00:00:00.000Z", monthlyRent: 3800, depositAmount: 7000 });
multipart("/api/v1/admin/properties/{propertyId}/leases/{leaseId}/signed-document",
  object(["file"], { file }), { file: "(binary PDF)" });

const announcementFields = {
  title: text({ minLength: 1, maxLength: 200 }), content: text({ minLength: 1, maxLength: 10000 }),
  audience: { type: "string", enum: ["ALL_TENANTS", "BUILDING", "FLOOR", "ROOM"] },
  buildingId: id, floorId: id, roomIds: array(id, { maxItems: 10000 }),
  status: { type: "string", enum: ["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"] }, publishAt: dateTime,
};
json("post", "/api/v1/admin/properties/{propertyId}/announcements",
  object(["title", "content"], announcementFields),
  { title: "แจ้งล้างถังน้ำ", content: "งดใช้น้ำเวลา 09:00–12:00 น.", audience: "ALL_TENANTS", status: "PUBLISHED", roomIds: [] });
json("patch", "/api/v1/admin/properties/{propertyId}/announcements/{announcementId}",
  object(["expectedUpdatedAt"], { ...announcementFields, expectedUpdatedAt: dateTime }),
  { title: "แจ้งเปลี่ยนเวลา", expectedUpdatedAt: "2026-07-28T09:30:00.000Z" });
multipart("/api/v1/admin/properties/{propertyId}/parcels",
  object(["roomId"], { roomId: id, recipientTenantId: id, note: text({ maxLength: 1000 }), file }),
  { roomId: "room_a101", recipientTenantId: "tenant_01", note: "กล่องเล็ก", file: "(binary image, optional)" });
json("patch", "/api/v1/admin/properties/{propertyId}/parcels/{parcelId}",
  object(["status"], { status: { type: "string", enum: ["RECEIVED", "CANCELLED"] }, receivedByTenantId: id }),
  { status: "RECEIVED" });
json("post", "/api/v1/tenant/tickets",
  object(["type", "title", "detail"], {
    type: { type: "string", enum: ["REPAIR", "COMPLAINT"] }, title: text({ minLength: 1, maxLength: 200 }),
    detail: text({ minLength: 1, maxLength: 4000 }), priority: { type: "string", enum: ["NORMAL", "URGENT"] }, isAnonymous: bool,
  }), { type: "REPAIR", title: "ท่อน้ำรั่ว", detail: "ท่อน้ำใต้อ่างล้างหน้ารั่ว", priority: "NORMAL", isAnonymous: false });
json("patch", "/api/v1/admin/properties/{propertyId}/tickets/{ticketId}", partial({
  status: { type: "string", enum: ["OPEN", "ACKNOWLEDGED", "IN_PROGRESS", "RESOLVED", "CANCELLED"] },
  priority: { type: "string", enum: ["NORMAL", "URGENT"] },
}), { status: "IN_PROGRESS", priority: "URGENT" });
for (const path of [
  "/api/v1/admin/properties/{propertyId}/tickets/{ticketId}/replies",
  "/api/v1/tenant/tickets/{ticketId}/replies",
]) json("post", path, object(["body"], {
  body: text({ minLength: 1, maxLength: 4000 }),
}), { body: "รับทราบครับ จะเข้าตรวจสอบช่วงบ่าย" });

const chat = object(["body", "clientId"], { body: text({ minLength: 1, maxLength: 4000 }), clientId: text({ format: "uuid" }) });
for (const path of [
  "/api/v1/admin/properties/{propertyId}/support-chat",
  "/api/v1/admin/properties/{propertyId}/tenant-chat/{tenantProfileId}",
  "/api/v1/super-admin/properties/{propertyId}/support-chat",
  "/api/v1/tenant/chat",
]) json("post", path, chat, { body: "ขอสอบถามข้อมูลเพิ่มเติมครับ", clientId: "891548c5-4d5e-4db4-9506-6f760b4259be" });
multipart("/api/v1/chat/conversations/{conversationId}/attachments",
  object(["propertyId", "body", "clientId", "file"], { propertyId: id, body: text({ maxLength: 4000 }), clientId: text({ format: "uuid" }), file }),
  { propertyId: "prop_baan_sabai", body: "แนบเอกสาร", clientId: "891548c5-4d5e-4db4-9506-6f760b4259be", file: "(binary file)" });
multipart("/api/v1/tenant/tickets/{ticketId}/attachments", object(["file"], { file }), { file: "(binary PNG, JPG or PDF)" });
multipart("/api/v1/tenant/invoices/{invoiceId}/payment-submissions", object(["file"], { file }), { file: "(binary PNG, JPG or PDF)" });

json("post", "/api/v1/tenant/register",
  object(["invitationCode", "email", "password", "displayName", "phone"], {
    invitationCode: text({ minLength: 32, maxLength: 256 }), email: text({ format: "email" }),
    password: text({ minLength: 12, maxLength: 128 }), displayName: text({ minLength: 2, maxLength: 120 }),
    phone: text({ minLength: 8, maxLength: 30 }),
  }), { invitationCode: "invitation-code-at-least-32-characters", email: "tenant@example.com", password: "StrongPassword123", displayName: "สุดา สุขใจ", phone: "0891234567" });
json("post", "/api/v1/tenant/invitations/accept",
  object(["invitationCode"], { invitationCode: text({ minLength: 32, maxLength: 256 }) }),
  { invitationCode: "invitation-code-at-least-32-characters" });
json("post", "/api/v1/tenant/occupancy-selection",
  object(["occupancyId"], { occupancyId: id }), { occupancyId: "occupancy_01" });
json("patch", "/api/v1/tenant/me",
  object(["displayName", "phone", "address", "emergencyName", "emergencyPhone"], {
    displayName: text({ minLength: 2, maxLength: 120 }),
    phone: text({ minLength: 8, maxLength: 30 }),
    address: { anyOf: [text({ maxLength: 1000 }), { type: "null" }] },
    emergencyName: { anyOf: [text({ maxLength: 160 }), { type: "null" }] },
    emergencyPhone: { anyOf: [text({ maxLength: 30 }), { type: "null" }] },
  }), {
    displayName: "สุดา สุขใจ",
    phone: "0891234567",
    address: "99/1 ถนนตัวอย่าง",
    emergencyName: "สมชาย สุขใจ",
    emergencyPhone: "0812345678",
  });

json("post", "/api/v1/super-admin/plans",
  object(["code", "name", "monthlyPrice", "maxProperties", "maxRooms"], planFields),
  { code: "STANDARD", name: "Standard", monthlyPrice: 990, yearlyPrice: 9900, maxProperties: 3, maxRooms: 100, allowPromptPay: true, allowFileUploads: true, allowPrioritySupport: false, sortOrder: 1 });
json("patch", "/api/v1/super-admin/plans/{planId}", partial(planFields),
  { name: "Standard Plus", monthlyPrice: 1290, isActive: true });
json("patch", "/api/v1/super-admin/properties/{propertyId}", partial({
  isActive: bool, memberUserIds: array(id, { maxItems: 50 }),
}), { isActive: true, memberUserIds: ["usr_owner_01"] });
json("put", "/api/v1/super-admin/properties/{propertyId}/subscription",
  object(["planId", "startsAt", "expiresAt"], {
    planId: id, status: { type: "string", enum: ["TRIAL", "ACTIVE", "EXPIRED", "SUSPENDED"] },
    billingInterval: { type: "string", enum: ["MONTHLY", "YEARLY"] }, startsAt: dateTime, expiresAt: dateTime,
  }), { planId: "plan_standard", status: "ACTIVE", billingInterval: "MONTHLY", startsAt: "2026-08-01T00:00:00.000Z", expiresAt: "2026-09-01T00:00:00.000Z" });
json("post", "/api/v1/admin/properties/{propertyId}/subscription-orders",
  object(["planId"], { planId: id, billingInterval: { type: "string", enum: ["MONTHLY", "YEARLY"] } }),
  { planId: "plan_standard", billingInterval: "MONTHLY" });
multipart("/api/v1/admin/properties/{propertyId}/subscription-orders/{orderId}/payments",
  object(["file"], { file }), { file: "(binary PNG, JPG or PDF)" });
json("patch", "/api/v1/super-admin/subscription-payments/{paymentId}",
  object(["status"], { status: { type: "string", enum: ["APPROVED", "REJECTED"] }, rejectionNote: text({ minLength: 2, maxLength: 500 }) }),
  { status: "APPROVED" });
json("patch", "/api/v1/super-admin/users/{userId}/approval",
  object(["status"], { status: { type: "string", enum: ["APPROVED", "REJECTED"] }, rejectionReason: text({ maxLength: 500 }) }),
  { status: "APPROVED" });
json("patch", "/api/v1/super-admin/users/{userId}/memberships",
  object(["propertyIds"], { propertyIds: array(id, { maxItems: 100 }) }),
  { propertyIds: ["property_01", "property_02"] });
noBody("post", "/api/v1/super-admin/users/{userId}/temporary-password");

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “request Contract” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - method: ค่า “method” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - apiPath: ค่า “api Path” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export function requestContract(method, apiPath) {
  const key = `${method} ${apiPath}`;
  if (!contracts.has(key)) throw new Error(`No endpoint-specific request contract for ${key}`);
  return contracts.get(key);
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตอบว่าเงื่อนไข “has Request Contract” เป็นจริงหรือไม่ เพื่อใช้ตัดสินใจในขั้นตอนถัดไป
 * รับค่า:
 * - method: ค่า “method” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - apiPath: ค่า “api Path” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export function hasRequestContract(method, apiPath) {
  return contracts.has(`${method} ${apiPath}`);
}
