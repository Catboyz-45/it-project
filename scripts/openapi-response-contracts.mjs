/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นคำสั่งสำหรับนักพัฒนา/ระบบอัตโนมัติในงาน “openapi response contracts”
 * การทำงาน: เรียกใช้จาก terminal หรือ package script เพื่อทำงานบำรุงรักษาที่ทำซ้ำได้; ควรทดลองในสภาพแวดล้อมที่ไม่ใช่ production ก่อนเมื่อมีการเขียนข้อมูล
 */

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “ref” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - name: ค่า “name” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
 */
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “nullable Ref” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - name: ค่า “name” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
 */
const nullableRef = (name) => ({ anyOf: [ref(name), { type: "null" }] });
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “array Of” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - name: ค่า “name” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
 */
const arrayOf = (name) => ({ type: "array", items: ref(name) });

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “entity” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - required: ค่า “required” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - properties: ค่า “properties” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
 */
const entity = (required, properties) => ({
  type: "object",
  required,
  properties,
  additionalProperties: false,
});

const id = { type: "string", minLength: 1 };
const text = { type: "string" };
const dateTime = { type: "string", format: "date-time" };
const money = { type: "string", pattern: "^-?\\d+(\\.\\d+)?$" };

export const responseSchemas = {
  PropertySearchResult: entity(["id", "type", "title", "subtitle", "href"], {
    id,
    type: { type: "string", enum: ["room", "tenant", "invoice", "lease"] },
    title: text,
    subtitle: text,
    href: { type: "string", pattern: "^/admin/properties/" },
  }),
  Property: entity(["id", "name"], {
    id, name: text, shortName: text, inviteCode: text, isActive: { type: "boolean" },
    settings: nullableRef("PropertySettings"),
    subscription: nullableRef("PropertySubscription"),
    memberships: {
      type: "array",
      items: entity(["user"], {
        user: entity(["id", "email", "displayName", "approvalStatus", "isActive"], {
          id,
          email: { type: "string", format: "email" },
          displayName: text,
          approvalStatus: { type: "string", enum: ["PENDING", "APPROVED", "REJECTED"] },
          isActive: { type: "boolean" },
        }),
      }),
    },
  }),
  UserSummary: entity(["id", "name"], { id, name: text, email: { type: "string", format: "email" }, role: text, approvalStatus: { type: "string", enum: ["PENDING", "APPROVED", "REJECTED"] } }),
  AccountApproval: entity(["id", "email", "displayName", "role", "approvalStatus"], {
    id, email: { type: "string", format: "email" }, displayName: text,
    role: { type: "string", enum: ["PROPERTY_ADMIN"] }, isActive: { type: "boolean" },
    approvalStatus: { type: "string", enum: ["PENDING", "APPROVED", "REJECTED"] },
    approvalReviewedAt: { anyOf: [dateTime, { type: "null" }] },
    approvalRejectionReason: { anyOf: [text, { type: "null" }] },
  }),
  SuperAdminUser: entity(["id", "email", "displayName", "isActive", "approvalStatus", "approvalRejectionReason", "memberships"], {
    id, email: { type: "string", format: "email" }, displayName: text,
    isActive: { type: "boolean" },
    approvalStatus: { type: "string", enum: ["PENDING", "APPROVED", "REJECTED"] },
    approvalRejectionReason: { anyOf: [text, { type: "null" }] },
    memberships: {
      type: "array",
      items: entity(["property"], { property: entity(["name"], { name: text }) }),
    },
  }),
  PropertyAdminMembershipUpdate: entity(["id", "memberships"], {
    id,
    memberships: {
      type: "array",
      items: entity(["property"], {
        property: entity(["id", "name"], { id, name: text }),
      }),
    },
  }),
  AuditLog: entity(["id", "action", "result", "createdAt", "user", "property"], {
    id, action: text, result: text, createdAt: dateTime,
    user: { anyOf: [entity(["email"], { email: { type: "string", format: "email" } }), { type: "null" }] },
    property: { anyOf: [entity(["name"], { name: text }), { type: "null" }] },
  }),
  PropertySettings: entity(["propertyId"], {
    propertyId: id, waterBillingMode: text, electricityBillingMode: text,
    waterRate: money, electricityRate: money, lateFee: money, promptPayId: text,
  }),
  Building: entity(["id", "name"], { id, propertyId: id, name: text, code: text, floors: arrayOf("Floor") }),
  Floor: entity(["id", "name"], { id, buildingId: id, name: text, number: { type: "integer" } }),
  RoomTypeCatalog: entity(["id", "name", "monthlyRent", "depositAmount", "capacity"], {
    id, name: text, monthlyRent: money, depositAmount: money,
    capacity: { type: "integer", minimum: 1 },
  }),
  ServiceChargeCatalog: entity(["id", "name", "amount", "frequency", "calculation"], {
    id, name: text, amount: money, frequency: text, calculation: text,
  }),
  FurnitureCatalog: entity(["id", "name", "isDefault"], {
    id, name: text, isDefault: { type: "boolean" },
  }),
  PropertyCatalogs: entity(["roomTypes", "serviceCharges", "furnitureOptions"], {
    roomTypes: arrayOf("RoomTypeCatalog"),
    serviceCharges: arrayOf("ServiceChargeCatalog"),
    furnitureOptions: arrayOf("FurnitureCatalog"),
  }),
  Room: entity(["id", "number", "status"], {
    id, propertyId: id, buildingId: id, floorId: id, number: text, status: text,
    monthlyRent: money, depositAmount: money, capacity: { type: "integer" },
    building: nullableRef("Building"), floor: nullableRef("Floor"),
  }),
  Tenant: entity(["id"], {
    id, firstName: text, lastName: text, phone: text, nationalId: text,
    user: nullableRef("UserSummary"), occupancies: arrayOf("Occupancy"),
  }),
  OwnerTenantListItem: entity(["id", "name", "phone", "email", "roomId", "deposit", "monthlyRent"], {
    id, name: text, phone: text, email: { type: "string", format: "email" }, roomId: text,
    address: text, guardianName: text, guardianPhone: text,
    vehicleType: text, vehiclePlate: text, vehicleDetail: text,
    startDate: text, contractEnd: { anyOf: [text, { type: "null" }] },
    deposit: { type: "number" }, monthlyRent: { type: "number" },
    leaseNumber: text, leaseStatus: text,
  }),
  Invitation: entity(["id", "code", "status"], {
    id, propertyId: id, roomId: id, code: text, status: text, expiresAt: dateTime,
    room: nullableRef("Room"), createdAt: dateTime,
  }),
  Occupancy: entity(["id", "propertyId", "roomId", "status"], {
    id, propertyId: id, roomId: id, tenantProfileId: id, role: text, status: text,
    approvedAt: { anyOf: [dateTime, { type: "null" }] }, room: nullableRef("Room"), tenant: nullableRef("Tenant"),
  }),
  OccupancyTransition: entity(["id", "type", "effectiveDate", "depositAmount", "outstandingAmount", "refundAmount", "amountDue", "transferredAmount", "sourceRoom"], {
    id, type: { type: "string", enum: ["MOVE_OUT", "MOVE_ROOM"] }, effectiveDate: dateTime,
    reason: text, tenantName: text, deductions: { type: "array", items: entity(["label", "amount"], { label: text, amount: { type: "number", minimum: 0 } }) },
    depositAmount: { type: "number", minimum: 0 }, outstandingAmount: { type: "number", minimum: 0 },
    refundAmount: { type: "number", minimum: 0 }, amountDue: { type: "number", minimum: 0 }, transferredAmount: { type: "number", minimum: 0 },
    sourceRoom: entity(["number"], { number: text }),
    destinationRoom: { anyOf: [entity(["number"], { number: text }), { type: "null" }] },
    completedBy: entity(["displayName"], { displayName: text }), createdAt: dateTime,
  }),
  Lease: entity(["id", "propertyId", "roomId", "status"], {
    id, propertyId: id, roomId: id, status: text, startDate: dateTime, endDate: dateTime,
    monthlyRent: money, depositAmount: money, currentVersion: nullableRef("LeaseVersion"),
    versions: arrayOf("LeaseVersion"), room: nullableRef("Room"), tenants: arrayOf("Tenant"),
  }),
  LeaseVersion: entity(["id", "version"], {
    id, leaseId: id, version: { type: "integer" }, status: text, terms: text,
    createdAt: dateTime, approvedAt: { anyOf: [dateTime, { type: "null" }] },
  }),
  TenantLease: entity(["id", "leaseNumber", "status", "startDate", "endDate", "monthlyRent", "depositAmount", "currentVersion", "activatedAt", "room"], {
    id, leaseNumber: text, status: text, startDate: dateTime, endDate: dateTime,
    monthlyRent: money, depositAmount: money, currentVersion: { type: "integer" },
    activatedAt: { anyOf: [dateTime, { type: "null" }] },
    room: entity(["number"], { number: text }),
  }),
  MeterReading: entity(["id", "type", "billingMonth", "previousReading", "currentReading", "unitRate"], {
    id, propertyId: id, roomId: id,
    type: { type: "string", enum: ["WATER", "ELECTRICITY"] },
    billingMonth: dateTime, previousReading: money, currentReading: money, unitRate: money,
    recordedAt: dateTime, room: nullableRef("Room"),
  }),
  MeterWorksheetRow: entity(["room", "readingId", "previousReading", "currentReading", "unitRate"], {
    room: {
      type: "object",
      required: ["id", "number", "building", "floor"],
      properties: {
        id, number: text,
        building: {
          type: "object",
          required: ["id", "name", "code"],
          properties: { id, name: text, code: text },
          additionalProperties: false,
        },
        floor: {
          type: "object",
          required: ["id", "number"],
          properties: {
            id, number: { type: "integer" },
            label: { anyOf: [text, { type: "null" }] },
          },
          additionalProperties: false,
        },
      },
      additionalProperties: false,
    },
    tenantName: { anyOf: [text, { type: "null" }] },
    readingId: { anyOf: [id, { type: "null" }] },
    previousReading: { anyOf: [money, { type: "null" }] },
    currentReading: { anyOf: [money, { type: "null" }] },
    unitRate: money,
    recordedAt: { anyOf: [dateTime, { type: "null" }] },
  }),
  InvoiceItem: entity(["id", "type", "amount"], {
    id, type: text, description: text, quantity: money, unitPrice: money, amount: money,
  }),
  TenantInvoiceListItem: entity(["id", "invoiceNumber", "billingMonth", "status", "dueDate", "total", "paidAt"], {
    id, invoiceNumber: text, billingMonth: dateTime, status: text, dueDate: dateTime,
    total: money, paidAt: { anyOf: [dateTime, { type: "null" }] },
  }),
  Invoice: entity(["id", "invoiceNumber", "status", "total"], {
    id, propertyId: id, roomId: id, invoiceNumber: text, billingMonth: text, status: text,
    issuedAt: { anyOf: [dateTime, { type: "null" }] }, subtotal: money, lateFee: money,
    total: money, dueDate: dateTime, paidAt: { anyOf: [dateTime, { type: "null" }] },
    version: { type: "integer" }, createdAt: dateTime,
    room: nullableRef("Room"), items: arrayOf("InvoiceItem"), paymentSubmissions: arrayOf("PaymentSubmission"),
  }),
  BulkInvoiceResult: entity(["created", "skipped"], {
    created: arrayOf("Invoice"),
    skipped: { type: "array", items: entity(["roomId", "reason"], { roomId: id, reason: text }) },
  }),
  OverdueRecalculation: entity(["updated"], { updated: { type: "integer", minimum: 0 }, asOf: dateTime }),
  PaymentSubmission: entity(["id", "status", "amount", "submittedAt"], {
    id, invoiceId: id, tenantProfileId: id, status: text, amount: money,
    submittedAt: dateTime, reviewedAt: { anyOf: [dateTime, { type: "null" }] },
    rejectionNote: { anyOf: [text, { type: "null" }] },
    slipAvailable: { type: "boolean" },
    invoice: nullableRef("Invoice"), tenantProfile: nullableRef("Tenant"),
  }),
  Announcement: entity(["id", "title", "status"], {
    id, propertyId: id, title: text, content: text, status: text, audience: text,
    publishedAt: { anyOf: [dateTime, { type: "null" }] }, createdAt: dateTime,
  }),
  TenantAnnouncement: entity(["id", "title", "content", "publishedAt", "publishAt", "createdAt"], {
    id, title: text, content: text,
    publishedAt: { anyOf: [dateTime, { type: "null" }] },
    publishAt: { anyOf: [dateTime, { type: "null" }] },
    createdAt: dateTime,
  }),
  Parcel: entity(["id", "status"], {
    id, propertyId: id, roomId: id, status: text,
    note: { anyOf: [text, { type: "null" }] }, registeredAt: dateTime,
    receivedAt: { anyOf: [dateTime, { type: "null" }] },
    imageUrl: { anyOf: [text, { type: "null" }] }, room: nullableRef("Room"),
    recipientTenant: {
      anyOf: [
        entity(["id", "user"], {
          id,
          user: entity(["displayName"], { displayName: text }),
        }),
        { type: "null" },
      ],
    },
  }),
  TenantParcel: entity(["id", "status", "note", "registeredAt", "receivedAt", "imageUrl"], {
    id, status: text, note: { anyOf: [text, { type: "null" }] }, registeredAt: dateTime,
    receivedAt: { anyOf: [dateTime, { type: "null" }] },
    imageUrl: { anyOf: [text, { type: "null" }] },
  }),
  TicketAttachment: entity(["id", "fileName"], {
    id, ticketId: id, fileName: text, mimeType: text, sizeBytes: { type: "integer" },
  }),
  TicketEvent: entity(["id", "type", "createdAt"], {
    id,
    type: { type: "string", enum: ["CREATED", "STATUS_CHANGED", "PRIORITY_CHANGED", "ATTACHMENT_ADDED", "REPLY_ADDED"] },
    fromValue: { anyOf: [text, { type: "null" }] },
    toValue: { anyOf: [text, { type: "null" }] },
    attachmentId: { anyOf: [id, { type: "null" }] },
    replyId: { anyOf: [id, { type: "null" }] },
    createdAt: dateTime,
    actorUser: {
      anyOf: [
        entity(["id", "displayName", "role"], { id, displayName: text, role: text }),
        { type: "null" },
      ],
    },
  }),
  ServiceTicket: entity(["id", "type", "status", "title"], {
    id, propertyId: id, roomId: id, tenantProfileId: id, type: text, status: text,
    priority: text, title: text, detail: text, isAnonymous: { type: "boolean" },
    createdAt: dateTime, updatedAt: dateTime,
    resolvedAt: { anyOf: [dateTime, { type: "null" }] },
    room: nullableRef("Room"), tenantProfile: nullableRef("Tenant"),
    attachments: arrayOf("TicketAttachment"),
    events: arrayOf("TicketEvent"),
    hasUnreadReply: { type: "boolean" },
  }),
  TenantTicket: entity(["id", "type", "status", "priority", "title", "detail", "createdAt", "updatedAt", "attachments", "hasUnreadReply"], {
    id, type: text, status: text, priority: text, title: text, detail: text,
    createdAt: dateTime, updatedAt: dateTime,
    resolvedAt: { anyOf: [dateTime, { type: "null" }] },
    attachments: arrayOf("TicketAttachment"),
    events: arrayOf("TicketEvent"),
    hasUnreadReply: { type: "boolean" },
  }),
  TicketReply: entity(["id", "body", "createdAt", "authorUser"], {
    id, body: text, createdAt: dateTime,
    authorUser: {
      anyOf: [
        entity(["id", "displayName", "role"], { id, displayName: text, role: text }),
        { type: "null" },
      ],
    },
  }),
  TicketUnreadSummary: entity(["total", "ticketReplies"], {
    total: { type: "integer", minimum: 0 },
    ticketReplies: { type: "integer", minimum: 0 },
  }),
  ChatMessage: entity(["id", "conversationId", "senderRole", "createdAt"], {
    id, conversationId: id, senderId: id, senderRole: text, content: text,
    attachmentName: text, attachmentMimeType: text, createdAt: dateTime,
  }),
  ChatConversation: entity(["id", "type"], {
    id, propertyId: id, tenantProfileId: id, type: text, updatedAt: dateTime,
    messages: arrayOf("ChatMessage"), property: nullableRef("Property"), tenant: nullableRef("Tenant"),
  }),
  ChatThread: entity(["conversationId", "messages"], { conversationId: id, messages: arrayOf("ChatMessage") }),
  ChatMessageResult: entity(["message"], { message: ref("ChatMessage") }),
  ConversationList: entity(["conversations", "pageInfo"], {
    conversations: arrayOf("ChatConversation"),
    pageInfo: ref("PageInfo"),
  }),
  SaasPlan: entity(["id", "code", "name", "monthlyPrice", "yearlyPrice", "maxProperties", "maxRooms", "allowPromptPay", "allowFileUploads", "allowPrioritySupport", "isActive", "sortOrder", "_count"], {
    id, code: text, name: text, description: { anyOf: [text, { type: "null" }] },
    monthlyPrice: money, yearlyPrice: { anyOf: [money, { type: "null" }] },
    maxProperties: { type: "integer" }, maxRooms: { type: "integer" },
    allowPromptPay: { type: "boolean" }, allowFileUploads: { type: "boolean" },
    allowPrioritySupport: { type: "boolean" }, isActive: { type: "boolean" },
    sortOrder: { type: "integer" }, createdAt: dateTime, updatedAt: dateTime,
    _count: entity(["subscriptions"], { subscriptions: { type: "integer" } }),
  }),
  PropertySubscription: entity(["propertyId", "planId", "planName", "status", "billingInterval", "priceAmount", "maxProperties", "maxRooms", "startsAt", "expiresAt"], {
    propertyId: id, planId: { anyOf: [id, { type: "null" }] }, planName: text,
    status: text, billingInterval: text, priceAmount: money,
    maxProperties: { type: "integer" }, maxRooms: { type: "integer" },
    startsAt: dateTime, expiresAt: dateTime,
    suspendedAt: { anyOf: [dateTime, { type: "null" }] },
  }),
  SubscriptionPayment: entity(["id", "orderId", "amount", "status", "mimeType", "sizeBytes", "submittedAt"], {
    id, orderId: id, amount: money,
    status: { type: "string", enum: ["PENDING_REVIEW", "APPROVED", "REJECTED"] },
    mimeType: text, sizeBytes: { type: "integer" }, submittedAt: dateTime,
    reviewedAt: { anyOf: [dateTime, { type: "null" }] },
    rejectionNote: { anyOf: [text, { type: "null" }] },
  }),
  SubscriptionOrder: entity(["id", "orderNumber", "propertyId", "planId", "planCode", "planName", "type", "status", "billingInterval", "amount", "expiresAt", "payments"], {
    id, orderNumber: text, propertyId: id, planId: { anyOf: [id, { type: "null" }] },
    planCode: text, planName: text,
    type: { type: "string", enum: ["NEW", "RENEWAL"] },
    status: { type: "string", enum: ["PENDING_PAYMENT", "PENDING_REVIEW", "PAID", "REJECTED", "CANCELLED", "EXPIRED"] },
    billingInterval: { type: "string", enum: ["MONTHLY", "YEARLY"] },
    amount: money, expiresAt: dateTime,
    payments: arrayOf("SubscriptionPayment"),
  }),
  SubscriptionPaymentReview: entity(["paymentId", "orderId", "status"], {
    paymentId: id, orderId: id,
    status: { type: "string", enum: ["APPROVED", "REJECTED"] },
    startsAt: dateTime, expiresAt: dateTime,
  }),
  OwnerDashboard: entity(["property", "rooms", "activeOccupancies", "finance", "operations", "subscription", "trends", "generatedAt"], {
    property: entity(["id", "name"], { id, name: text }),
    rooms: entity(["total", "occupied", "available", "maintenance", "occupancyRate"], {
      total: { type: "integer" }, occupied: { type: "integer" }, available: { type: "integer" },
      maintenance: { type: "integer" }, occupancyRate: { type: "number" },
    }),
    activeOccupancies: { type: "integer" },
    finance: entity(["billed", "collected", "outstanding", "overdueInvoices", "pendingPayments"], {
      billed: { type: "number" }, collected: { type: "number" }, outstanding: { type: "number" },
      overdueInvoices: { type: "integer" }, pendingPayments: { type: "integer" },
    }),
    operations: entity(["openTickets", "waitingParcels", "unreadTenantMessages"], {
      openTickets: { type: "integer" }, waitingParcels: { type: "integer" },
      unreadTenantMessages: { type: "integer" },
    }),
    subscription: {
      anyOf: [
        entity(["planCode", "planName", "status", "billingInterval", "priceAmount", "startsAt", "expiresAt", "maxRooms", "usedRooms", "roomUsagePercent"], {
          planCode: { anyOf: [text, { type: "null" }] }, planName: text, status: text,
          billingInterval: text, priceAmount: money, startsAt: dateTime, expiresAt: dateTime,
          maxRooms: { type: "integer" }, usedRooms: { type: "integer" }, roomUsagePercent: { type: "number" },
        }),
        { type: "null" },
      ],
    },
    trends: {
      type: "array",
      items: entity(["month", "billed", "collected", "outstanding"], {
        month: text, billed: { type: "number" }, collected: { type: "number" }, outstanding: { type: "number" },
      }),
    },
    generatedAt: dateTime,
  }),
  PlatformDashboard: entity(["properties", "users", "usage", "revenue", "subscriptions", "operations", "generatedAt"], {
    properties: entity(["active", "totalSubscriptions"], {
      active: { type: "integer" }, totalSubscriptions: { type: "integer" },
    }),
    users: { type: "object", additionalProperties: { type: "integer" } },
    usage: entity(["rooms", "activeTenants"], { rooms: { type: "integer" }, activeTenants: { type: "integer" } }),
    revenue: entity(["mrr", "arr"], { mrr: { type: "number" }, arr: { type: "number" } }),
    subscriptions: entity(["active", "trial", "suspended", "expired", "expiringWithin30Days", "byPlan"], {
      active: { type: "integer" }, trial: { type: "integer" }, suspended: { type: "integer" },
      expired: { type: "integer" }, expiringWithin30Days: { type: "integer" },
      byPlan: {
        type: "array",
        items: entity(["code", "name", "subscriptions", "mrr"], {
          code: { anyOf: [text, { type: "null" }] }, name: text,
          subscriptions: { type: "integer" }, mrr: { type: "number" },
        }),
      },
    }),
    operations: entity(["pendingPayments", "openTickets"], {
      pendingPayments: { type: "integer" }, openTickets: { type: "integer" },
    }),
    generatedAt: dateTime,
  }),
  OwnerWorkspaceReadModel: entity(["rooms", "tenants", "invoices", "repairs", "complaints", "parcels", "announcements", "settings"], {
    rooms: { type: "array", items: { type: "object", additionalProperties: false, properties: {} } },
    tenants: { type: "array", items: { type: "object", additionalProperties: false, properties: {} } },
    invoices: { type: "array", items: { type: "object", additionalProperties: false, properties: {} } },
    repairs: { type: "array", items: { type: "object", additionalProperties: false, properties: {} } },
    complaints: { type: "array", items: { type: "object", additionalProperties: false, properties: {} } },
    parcels: { type: "array", items: { type: "object", additionalProperties: false, properties: {} } },
    announcements: { type: "array", items: { type: "object", additionalProperties: false, properties: {} } },
    settings: { type: "object" },
  }),
  TenantAccountUser: entity(["displayName", "email"], {
    displayName: text, email: { type: "string", format: "email" },
  }),
  TenantAccountOccupancy: entity(["id", "role", "status", "startedAt", "endedAt", "room", "property"], {
    id, role: text, status: text,
    startedAt: { anyOf: [dateTime, { type: "null" }] },
    endedAt: { anyOf: [dateTime, { type: "null" }] },
    room: entity(["number"], { number: text }),
    property: entity(["id", "name", "shortName", "isActive"], {
      id, name: text, shortName: text, isActive: { type: "boolean" },
    }),
  }),
  TenantAccount: entity(["id", "phone", "address", "emergencyName", "emergencyPhone", "user", "occupancies"], {
    id, phone: text,
    address: { anyOf: [text, { type: "null" }] },
    emergencyName: { anyOf: [text, { type: "null" }] },
    emergencyPhone: { anyOf: [text, { type: "null" }] },
    user: ref("TenantAccountUser"), occupancies: arrayOf("TenantAccountOccupancy"),
  }),
  TenantNotificationSummary: entity(["unpaidInvoices", "waitingParcels", "openTickets", "unreadMessages", "unreadTicketReplies"], {
    unpaidInvoices: { type: "integer", minimum: 0 },
    waitingParcels: { type: "integer", minimum: 0 },
    openTickets: { type: "integer", minimum: 0 },
    unreadMessages: { type: "integer", minimum: 0 },
    unreadTicketReplies: { type: "integer", minimum: 0 },
  }),
  TenantRoomSettings: entity(["address", "contactPhone", "contactEmail", "houseRules", "emergencyContact"], {
    address: text, contactPhone: text,
    contactEmail: { anyOf: [text, { type: "null" }] },
    houseRules: { anyOf: [text, { type: "null" }] },
    emergencyContact: { anyOf: [text, { type: "null" }] },
  }),
  TenantRoom: entity(["role", "startedAt", "room"], {
    role: text, startedAt: { anyOf: [dateTime, { type: "null" }] },
    room: entity(["id", "number", "roomType", "monthlyRent", "capacity", "status", "furniture", "building", "floor", "property"], {
      id, number: text, roomType: text, monthlyRent: money, capacity: { type: "integer" },
      status: text, furniture: { type: "array", items: text },
      building: entity(["name", "code"], { name: text, code: text }),
      floor: entity(["number", "label"], { number: { type: "integer" }, label: { anyOf: [text, { type: "null" }] } }),
      property: entity(["id", "name", "shortName", "settings"], {
        id, name: text, shortName: text, settings: nullableRef("TenantRoomSettings"),
      }),
    }),
  }),
  TenantRegistration: entity(["userId", "occupancyStatus", "message"], {
    userId: id,
    occupancyStatus: { type: "string", enum: ["PENDING"] },
    message: text,
  }),
  TenantInvitationAcceptance: entity(["occupancy", "message"], {
    occupancy: ref("TenantAcceptedOccupancy"),
    message: text,
  }),
  TenantAcceptedOccupancy: entity(["id", "status", "role", "room", "property"], {
    id,
    status: { type: "string", enum: ["PENDING"] },
    role: { type: "string", enum: ["PRIMARY", "CO_OCCUPANT"] },
    room: entity(["number"], { number: text }),
    property: entity(["id", "name"], { id, name: text }),
  }),
  TenantOccupancySelection: entity(["id", "status", "propertyId", "roomId", "role"], {
    id,
    status: { type: "string", enum: ["PENDING", "ACTIVE"] },
    propertyId: id,
    roomId: id,
    role: { type: "string", enum: ["PRIMARY", "CO_OCCUPANT"] },
  }),
  PromptPay: entity(["payload", "amount"], { payload: text, amount: money, promptPayId: text, invoiceId: id }),
  UploadResult: entity(["uploaded"], { uploaded: { type: "boolean" } }),
  SuccessResult: entity(["success"], { success: { type: "boolean" } }),
  TemporaryPasswordResult: entity(["temporaryPassword", "mustChangePassword"], {
    temporaryPassword: { type: "string", minLength: 12 },
    mustChangePassword: { type: "boolean", const: true },
  }),
  PageInfo: {
    type: "object",
    required: ["page", "pageSize", "hasNextPage"],
    properties: {
      page: { type: "integer", minimum: 1 },
      pageSize: { type: "integer", minimum: 1, maximum: 100 },
      hasNextPage: { type: "boolean" },
    },
    additionalProperties: false,
  },
};

const samples = {
  PropertySearchResult: {
    id: "room_a101",
    type: "room",
    title: "ห้อง A101",
    subtitle: "OCCUPIED",
    href: "/admin/properties/prop_baan_sabai/rooms",
  },
  UserSummary: { id: "usr_owner_01", name: "สมชาย ใจดี", email: "owner@example.com", role: "PROPERTY_ADMIN", approvalStatus: "APPROVED" },
  AccountApproval: { id: "usr_owner_01", email: "owner@example.com", displayName: "สมชาย ใจดี", role: "PROPERTY_ADMIN", isActive: true, approvalStatus: "APPROVED", approvalReviewedAt: "2026-07-28T10:00:00.000Z", approvalRejectionReason: null },
  SuperAdminUser: { id: "usr_owner_01", email: "owner@example.com", displayName: "สมชาย ใจดี", isActive: true, approvalStatus: "APPROVED", approvalRejectionReason: null, memberships: [{ property: { name: "บ้านอยู่สบาย" } }] },
  PropertyAdminMembershipUpdate: { id: "usr_owner_01", memberships: [{ property: { id: "property_01", name: "บ้านอยู่สบาย" } }] },
  AuditLog: { id: "audit_01", action: "ACCOUNT_APPROVAL_UPDATE", result: "SUCCESS", createdAt: "2026-07-28T10:00:00.000Z", user: { email: "admin@example.com" }, property: { name: "บ้านอยู่สบาย" } },
  Property: { id: "prop_baan_sabai", name: "บ้านอยู่สบาย", shortName: "บ้านสบาย", inviteCode: "SABAI2026", isActive: true },
  PropertySettings: { propertyId: "prop_baan_sabai", waterBillingMode: "METERED", electricityBillingMode: "METERED", waterRate: "18.00", electricityRate: "7.50", lateFee: "100.00", promptPayId: "0812345678" },
  Building: { id: "bld_a", propertyId: "prop_baan_sabai", name: "อาคาร A", code: "A", floors: [] },
  Floor: { id: "floor_a_1", buildingId: "bld_a", name: "ชั้น 1", number: 1 },
  PropertyCatalogs: { roomTypes: [{ id: "standard", name: "ห้องมาตรฐาน", monthlyRent: "3500.00" }], serviceCharges: [{ id: "internet", name: "ค่าอินเทอร์เน็ต", amount: "300.00" }], furnitureOptions: [{ id: "bed", name: "เตียง" }] },
  Room: { id: "room_a101", propertyId: "prop_baan_sabai", buildingId: "bld_a", floorId: "floor_a_1", number: "A101", status: "OCCUPIED", monthlyRent: "3500.00", depositAmount: "7000.00", capacity: 2 },
  Tenant: { id: "tenant_01", firstName: "สุดา", lastName: "สุขใจ", phone: "0891234567", nationalId: "1100000000001", occupancies: [] },
  OwnerTenantListItem: { id: "tenant_01", name: "สุดา สุขใจ", phone: "0891234567", email: "tenant@example.com", roomId: "A101", address: "", guardianName: "", guardianPhone: "", vehicleType: "", vehiclePlate: "", vehicleDetail: "", startDate: "2026-08-01", contractEnd: "2027-07-31", deposit: 7000, monthlyRent: 3500, leaseNumber: "LEASE-001", leaseStatus: "ACTIVE" },
  Invitation: { id: "invite_01", propertyId: "prop_baan_sabai", roomId: "room_a101", code: "JOIN-A101", status: "PENDING", expiresAt: "2026-08-31T16:59:59.000Z", createdAt: "2026-07-28T10:00:00.000Z" },
  Occupancy: { id: "occupancy_01", propertyId: "prop_baan_sabai", roomId: "room_a101", tenantProfileId: "tenant_01", role: "PRIMARY", status: "ACTIVE", approvedAt: "2026-07-28T10:00:00.000Z" },
  OccupancyTransition: { id: "transition_01", type: "MOVE_ROOM", effectiveDate: "2026-08-01T00:00:00.000Z", reason: "ต้องการห้องใหญ่ขึ้น", tenantName: "สุดา สุขใจ", depositAmount: 7000, deductions: [], outstandingAmount: 0, refundAmount: 0, amountDue: 0, transferredAmount: 7000, sourceRoom: { number: "A101" }, destinationRoom: { number: "A102" }, completedBy: { displayName: "สมชาย ใจดี" }, createdAt: "2026-08-01T00:00:00.000Z" },
  LeaseVersion: { id: "lease_version_02", leaseId: "lease_01", version: 2, status: "PUBLISHED", terms: "ชำระค่าเช่าภายในวันที่ 5 ของทุกเดือน", createdAt: "2026-07-28T10:00:00.000Z", approvedAt: "2026-07-28T11:00:00.000Z" },
  Lease: { id: "lease_01", propertyId: "prop_baan_sabai", roomId: "room_a101", status: "ACTIVE", startDate: "2026-08-01T00:00:00.000Z", endDate: "2027-07-31T23:59:59.000Z", monthlyRent: "3500.00", depositAmount: "7000.00", versions: [], tenants: [] },
  TenantLease: { id: "lease_01", leaseNumber: "LEASE-001", status: "ACTIVE", startDate: "2026-08-01T00:00:00.000Z", endDate: "2027-07-31T23:59:59.000Z", monthlyRent: "3500.00", depositAmount: "7000.00", currentVersion: 2, activatedAt: "2026-08-01T00:00:00.000Z", room: { number: "A101" } },
  MeterReading: { id: "meter_01", propertyId: "prop_baan_sabai", roomId: "room_a101", type: "ELECTRICITY", billingMonth: "2026-07-01T00:00:00.000Z", previousReading: "1250.00", currentReading: "1320.00", unitRate: "7.50", recordedAt: "2026-07-28T10:00:00.000Z" },
  MeterWorksheetRow: { room: { id: "room_a101", number: "A101", building: { id: "bld_a", name: "อาคาร A", code: "A" }, floor: { id: "floor_a_1", number: 1, label: "ชั้น 1" } }, tenantName: "สุดา สุขใจ", readingId: "meter_01", previousReading: "1250.00", currentReading: "1320.00", unitRate: "7.50", recordedAt: "2026-07-28T10:00:00.000Z" },
  InvoiceItem: { id: "item_rent_01", type: "RENT", description: "ค่าเช่าห้องเดือนกรกฎาคม 2569", quantity: "1.00", unitPrice: "3500.00", amount: "3500.00" },
  TenantInvoiceListItem: { id: "invoice_01", invoiceNumber: "INV-202607-A101", billingMonth: "2026-07-01T00:00:00.000Z", status: "PENDING", dueDate: "2026-08-05T16:59:59.000Z", total: "4325.00", paidAt: null },
  Invoice: { id: "invoice_01", propertyId: "prop_baan_sabai", roomId: "room_a101", invoiceNumber: "INV-202607-A101", billingMonth: "2026-07-01T00:00:00.000Z", status: "PENDING", issuedAt: "2026-07-28T10:00:00.000Z", subtotal: "4325.00", lateFee: "0.00", total: "4325.00", dueDate: "2026-08-05T16:59:59.000Z", paidAt: null, version: 1, createdAt: "2026-07-28T10:00:00.000Z", items: [], paymentSubmissions: [] },
  BulkInvoiceResult: { created: [], skipped: [{ roomId: "room_a102", reason: "ยังไม่มีเลขมิเตอร์ประจำเดือน" }] },
  OverdueRecalculation: { updated: 3, asOf: "2026-08-06T00:00:00.000Z" },
  PaymentSubmission: { id: "payment_01", invoiceId: "invoice_01", tenantProfileId: "tenant_01", status: "PENDING_REVIEW", amount: "4325.00", submittedAt: "2026-08-03T09:30:00.000Z", reviewedAt: null, rejectionNote: null },
  Announcement: { id: "announcement_01", propertyId: "prop_baan_sabai", title: "แจ้งล้างถังน้ำ", content: "งดใช้น้ำวันที่ 1 สิงหาคม เวลา 09:00–12:00 น.", status: "PUBLISHED", audience: "ALL", publishedAt: "2026-07-28T10:00:00.000Z", createdAt: "2026-07-28T09:30:00.000Z" },
  TenantAnnouncement: { id: "announcement_01", title: "แจ้งล้างถังน้ำ", content: "งดใช้น้ำวันที่ 1 สิงหาคม เวลา 09:00–12:00 น.", publishedAt: "2026-07-28T10:00:00.000Z", publishAt: null, createdAt: "2026-07-28T09:30:00.000Z" },
  Parcel: { id: "parcel_01", propertyId: "prop_baan_sabai", roomId: "room_a101", status: "WAITING", note: "พัสดุกล่องเล็ก", registeredAt: "2026-07-28T10:00:00.000Z", receivedAt: null, imageUrl: null },
  TenantParcel: { id: "parcel_01", status: "WAITING", note: "พัสดุกล่องเล็ก", registeredAt: "2026-07-28T10:00:00.000Z", receivedAt: null, imageUrl: null },
  TicketAttachment: { id: "attachment_01", ticketId: "ticket_01", fileName: "leaking-pipe.jpg", mimeType: "image/jpeg", sizeBytes: 245760 },
  ServiceTicket: { id: "ticket_01", propertyId: "prop_baan_sabai", roomId: "room_a101", tenantProfileId: "tenant_01", type: "REPAIR", status: "OPEN", priority: "NORMAL", title: "ท่อน้ำรั่ว", detail: "ท่อน้ำใต้อ่างล้างหน้ารั่ว", isAnonymous: false, createdAt: "2026-07-28T10:00:00.000Z", updatedAt: "2026-07-28T10:00:00.000Z", resolvedAt: null, attachments: [] },
  TenantTicket: { id: "ticket_01", type: "REPAIR", status: "OPEN", priority: "NORMAL", title: "ท่อน้ำรั่ว", detail: "ท่อน้ำใต้อ่างล้างหน้ารั่ว", createdAt: "2026-07-28T10:00:00.000Z", updatedAt: "2026-07-28T10:00:00.000Z", resolvedAt: null, attachments: [], hasUnreadReply: false },
  TicketReply: { id: "reply_01", body: "รับทราบครับ จะเข้าตรวจสอบช่วงบ่าย", createdAt: "2026-07-28T11:00:00.000Z", authorUser: { id: "usr_owner_01", displayName: "สมชาย ใจดี", role: "PROPERTY_ADMIN" } },
  TicketUnreadSummary: { total: 1, ticketReplies: 1 },
  ChatMessage: { id: "message_01", conversationId: "conversation_01", senderId: "tenant_01", senderRole: "TENANT", content: "ขอสอบถามยอดบิลเดือนนี้ครับ", attachmentName: "", attachmentMimeType: "", createdAt: "2026-07-28T10:00:00.000Z" },
  ChatConversation: { id: "conversation_01", propertyId: "prop_baan_sabai", tenantProfileId: "tenant_01", type: "TENANT_PROPERTY", updatedAt: "2026-07-28T10:00:00.000Z", messages: [] },
  SaasPlan: { id: "plan_standard", code: "STANDARD", name: "Standard", description: "สำหรับหอพักขนาดกลาง", monthlyPrice: "990.00", yearlyPrice: "9900.00", maxProperties: 3, maxRooms: 100, allowPromptPay: true, allowFileUploads: true, allowPrioritySupport: false, isActive: true, sortOrder: 1, createdAt: "2026-07-01T00:00:00.000Z", updatedAt: "2026-07-01T00:00:00.000Z", _count: { subscriptions: 12 } },
  PropertySubscription: { propertyId: "prop_baan_sabai", planId: "plan_standard", planName: "Standard", status: "ACTIVE", billingInterval: "MONTHLY", priceAmount: "990.00", maxProperties: 3, maxRooms: 100, startsAt: "2026-07-01T00:00:00.000Z", expiresAt: "2026-08-01T00:00:00.000Z", suspendedAt: null },
  SubscriptionPayment: { id: "subpay_01", orderId: "suborder_01", amount: "990.00", status: "PENDING_REVIEW", mimeType: "image/png", sizeBytes: 245760, submittedAt: "2026-07-29T06:00:00.000Z", reviewedAt: null, rejectionNote: null },
  SubscriptionOrder: { id: "suborder_01", orderNumber: "SUB-20260729-A1B2C3D4", propertyId: "prop_baan_sabai", planId: "plan_standard", planCode: "STANDARD", planName: "Standard", type: "RENEWAL", status: "PENDING_PAYMENT", billingInterval: "MONTHLY", amount: "990.00", expiresAt: "2026-07-31T06:00:00.000Z", payments: [] },
  SubscriptionPaymentReview: { paymentId: "subpay_01", orderId: "suborder_01", status: "APPROVED", startsAt: "2026-08-01T00:00:00.000Z", expiresAt: "2026-09-01T00:00:00.000Z" },
  TenantRegistration: { userId: "usr_tenant_01", occupancyStatus: "PENDING", message: "สมัครสำเร็จและกำลังรอเจ้าของหออนุมัติ" },
  TenantInvitationAcceptance: {
    occupancy: {
      id: "occupancy_02", status: "PENDING", role: "CO_OCCUPANT",
      room: { number: "A102" },
      property: { id: "prop_baan_sabai", name: "บ้านอยู่สบาย" },
    },
    message: "รับคำเชิญแล้ว กรุณารอเจ้าของหออนุมัติ",
  },
  TenantOccupancySelection: {
    id: "occupancy_01", status: "ACTIVE", propertyId: "prop_baan_sabai",
    roomId: "room_a101", role: "PRIMARY",
  },
  PromptPay: { payload: "00020101021229370016A000000677010111011300668123456785802TH530376454074325.006304ABCD", amount: "4325.00", promptPayId: "0812345678", invoiceId: "invoice_01" },
  UploadResult: { uploaded: true },
  SuccessResult: { success: true },
  TemporaryPasswordResult: { temporaryPassword: "Df1-example-temporary", mustChangePassword: true },
};

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “sample” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - name: ค่า “name” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function sample(name) {
  if (samples[name]) return structuredClone(samples[name]);
  if (name === "ChatThread") return { conversationId: "conversation_01", messages: [sample("ChatMessage")] };
  if (name === "ChatMessageResult") return { message: sample("ChatMessage") };
  if (name === "ConversationList") return {
    conversations: [sample("ChatConversation")],
    pageInfo: { page: 1, pageSize: 50, hasNextPage: false },
  };
  if (name === "OwnerDashboard") return {
    property: { id: "prop_baan_sabai", name: "บ้านอยู่สบาย" },
    rooms: { total: 50, occupied: 42, available: 7, maintenance: 1, occupancyRate: 84 },
    activeOccupancies: 44,
    finance: { billed: 180000, collected: 150000, outstanding: 30000, overdueInvoices: 3, pendingPayments: 2 },
    operations: { openTickets: 3, waitingParcels: 5, unreadTenantMessages: 4 },
    subscription: null,
    trends: [{ month: "2026-07", billed: 180000, collected: 150000, outstanding: 30000 }],
    generatedAt: "2026-07-28T10:00:00.000Z",
  };
  if (name === "PlatformDashboard") return {
    properties: { active: 12, totalSubscriptions: 12 },
    users: { PROPERTY_ADMIN: 12, TENANT: 420 },
    usage: { rooms: 500, activeTenants: 420 },
    revenue: { mrr: 11880, arr: 142560 },
    subscriptions: { active: 10, trial: 1, suspended: 0, expired: 1, expiringWithin30Days: 2, byPlan: [{ code: "STANDARD", name: "Standard", subscriptions: 10, mrr: 9900 }] },
    operations: { pendingPayments: 8, openTickets: 15 },
    generatedAt: "2026-07-28T10:00:00.000Z",
  };
  if (name === "OwnerWorkspaceReadModel") return {
    rooms: [], tenants: [], invoices: [], repairs: [], complaints: [], parcels: [], announcements: [], settings: {},
  };
  if (name === "TenantAccount") return {
    id: "tenant_01", phone: "0891234567", address: null, emergencyName: null, emergencyPhone: null,
    user: { displayName: "สุดา สุขใจ", email: "tenant@example.com" },
    occupancies: [{
      id: "occupancy_01", role: "PRIMARY", status: "ACTIVE",
      startedAt: "2026-08-01T00:00:00.000Z", endedAt: null,
      room: { number: "A101" },
      property: { id: "prop_baan_sabai", name: "บ้านอยู่สบาย", shortName: "บ้านสบาย", isActive: true },
    }],
  };
  if (name === "TenantNotificationSummary") return {
    unpaidInvoices: 1, waitingParcels: 1, openTickets: 0, unreadMessages: 2, unreadTicketReplies: 1,
  };
  if (name === "TenantRoom") return {
    role: "PRIMARY", startedAt: "2026-08-01T00:00:00.000Z",
    room: {
      id: "room_a101", number: "A101", roomType: "STANDARD", monthlyRent: "3500.00",
      capacity: 2, status: "OCCUPIED", furniture: ["เตียง"],
      building: { name: "อาคาร A", code: "A" }, floor: { number: 1, label: "ชั้น 1" },
      property: {
        id: "prop_baan_sabai", name: "บ้านอยู่สบาย", shortName: "บ้านสบาย",
        settings: { address: "กรุงเทพฯ", contactPhone: "021234567", contactEmail: null, houseRules: null, emergencyContact: null },
      },
    },
  };
  return {};
}

const collectionSchemas = new Map([
  ["announcements", "Announcement"], ["buildings", "Building"], ["invitations", "Invitation"],
  ["invoices", "Invoice"], ["leases", "Lease"], ["meter-readings", "MeterReading"],
  ["occupancies", "Occupancy"], ["parcels", "Parcel"], ["payment-submissions", "PaymentSubmission"],
  ["rooms", "Room"], ["tenants", "Tenant"], ["tickets", "ServiceTicket"],
]);

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “data” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - schema: ค่า “schema” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - array: ค่า “array” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - nullable: ค่า “nullable” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function data(schema, array = false, nullable = false) {
  const value = array ? arrayOf(schema) : nullable ? nullableRef(schema) : ref(schema);
  return {
    description: "Successful response",
    content: {
      "application/json": {
        schema: {
          type: "object",
          required: ["data"],
          properties: { data: value },
          additionalProperties: false,
        },
        example: { data: array ? [sample(schema)] : sample(schema) },
      },
    },
  };
}

const paginatedPaths = new Set([
  "/api/v1/admin/properties/{propertyId}/announcements",
  "/api/v1/admin/properties/{propertyId}/invitations",
  "/api/v1/admin/properties/{propertyId}/invoices",
  "/api/v1/admin/properties/{propertyId}/leases",
  "/api/v1/admin/properties/{propertyId}/meter-readings",
  "/api/v1/admin/properties/{propertyId}/occupancies",
  "/api/v1/admin/properties/{propertyId}/parcels",
  "/api/v1/admin/properties/{propertyId}/payment-submissions",
  "/api/v1/admin/properties/{propertyId}/subscription-orders",
  "/api/v1/admin/properties/{propertyId}/tenants",
  "/api/v1/admin/properties/{propertyId}/tickets",
  "/api/v1/tenant/announcements",
  "/api/v1/tenant/invoices",
  "/api/v1/tenant/parcels",
  "/api/v1/tenant/tickets",
  "/api/v1/super-admin/subscription-payments",
  "/api/v1/super-admin/audit-logs",
  "/api/v1/super-admin/plans",
  "/api/v1/super-admin/properties",
  "/api/v1/super-admin/users",
]);

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “paginated Data” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - schema: ค่า “schema” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function paginatedData(schema) {
  return {
    description: "Successful paginated response",
    content: {
      "application/json": {
        schema: {
          type: "object",
          required: ["data", "pageInfo"],
          properties: {
            data: arrayOf(schema),
            pageInfo: ref("PageInfo"),
          },
          additionalProperties: false,
        },
        example: {
          data: [sample(schema)],
          pageInfo: { page: 1, pageSize: 50, hasNextPage: false },
        },
      },
    },
  };
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “direct” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - schema: ค่า “schema” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function direct(schema) {
  return { description: "Successful response", content: { "application/json": { schema: ref(schema), example: sample(schema) } } };
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “request Example” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - method: ค่า “method” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - apiPath: ค่า “api Path” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export function requestExample(method, apiPath) {
  if (method === "get" || method === "delete") return undefined;
  if (apiPath.endsWith("/temporary-password")) return undefined;
  if (apiPath.endsWith("/catalogs")) return { roomTypes: [{ name: "ห้องมาตรฐาน", monthlyRent: 3500 }], serviceCharges: [], furnitureOptions: [] };
  if (apiPath.includes("support-chat") || apiPath.endsWith("/tenant/chat") || /tenant-chat\/\{tenantProfileId\}$/.test(apiPath)) return { content: "ขอสอบถามข้อมูลเพิ่มเติมครับ" };
  if (apiPath.endsWith("/buildings")) return { name: "อาคาร A", code: "A" };
  if (apiPath.endsWith("/floors")) return { name: "ชั้น 1", number: 1 };
  if (apiPath.endsWith("/rooms")) return { buildingId: "bld_a", floorId: "floor_a_1", number: "A101", monthlyRent: 3500, depositAmount: 7000, capacity: 2 };
  if (apiPath.includes("/rooms/{roomId}")) return { status: "AVAILABLE", monthlyRent: 3800 };
  if (apiPath.endsWith("/invitations")) return { roomId: "room_a101", role: "PRIMARY", expiresInDays: 7 };
  if (apiPath.includes("/occupancies/{occupancyId}")) return { status: "ACTIVE" };
  if (apiPath.endsWith("/leases")) return { roomId: "room_a101", startDate: "2026-08-01", endDate: "2027-07-31", monthlyRent: 3500, depositAmount: 7000 };
  if (apiPath.includes("/leases/{leaseId}")) return { expectedVersion: 2, status: "PENDING_SIGNATURE", terms: "ชำระค่าเช่าภายในวันที่ 5" };
  if (apiPath.endsWith("/meter-readings")) return { roomId: "room_a101", meterType: "ELECTRICITY", billingMonth: "2026-07", previousReading: 1250, currentReading: 1320 };
  if (apiPath.endsWith("/meter-readings/bulk")) return { billingMonth: "2026-07", readings: [{ roomId: "room_a101", meterType: "WATER", previousReading: 30, currentReading: 36 }] };
  if (apiPath.endsWith("/invoices")) return { roomId: "room_a101", billingMonth: "2026-07", dueDate: "2026-08-05" };
  if (apiPath.endsWith("/invoices/bulk")) return { billingMonth: "2026-07", dueDate: "2026-08-05" };
  if (apiPath.endsWith("/invoices/recalculate-overdue")) return { asOf: "2026-08-06" };
  if (apiPath.endsWith("/announcements")) return { title: "แจ้งล้างถังน้ำ", content: "งดใช้น้ำเวลา 09:00–12:00 น.", audience: "ALL", status: "PUBLISHED" };
  if (apiPath.includes("/announcements/")) return { title: "แจ้งเปลี่ยนเวลา", expectedUpdatedAt: "2026-07-28T09:30:00.000Z" };
  if (apiPath.includes("/parcels/{parcelId}")) return { status: "COLLECTED" };
  if (apiPath.includes("/payment-submissions/{paymentId}")) return { status: "APPROVED" };
  if (apiPath.endsWith("/subscription-orders")) return { planId: "plan_standard", billingInterval: "MONTHLY" };
  if (apiPath.includes("/super-admin/subscription-payments/{paymentId}")) return { status: "APPROVED" };
  if (apiPath.endsWith("/tickets")) return { type: "REPAIR", priority: "NORMAL", title: "ท่อน้ำรั่ว", description: "ท่อน้ำใต้อ่างล้างหน้ารั่ว" };
  if (apiPath.includes("/tickets/{ticketId}")) return { status: "IN_PROGRESS", priority: "HIGH" };
  if (apiPath === "/api/v1/tenant/register") return { email: "tenant@example.com", password: "example-password-123", firstName: "สุดา", lastName: "สุขใจ", phone: "0891234567", inviteCode: "JOIN-A101" };
  if (apiPath === "/api/v1/tenant/invitations/accept") return { invitationCode: "invitation-code-at-least-32-characters" };
  if (apiPath === "/api/v1/tenant/occupancy-selection") return { occupancyId: "occupancy_01" };
  if (apiPath === "/api/v1/super-admin/plans") return { code: "STANDARD", name: "Standard", price: 990, billingInterval: "MONTHLY", maxProperties: 3, maxRooms: 100 };
  if (apiPath.includes("/super-admin/plans/")) return { name: "Standard Plus", price: 1290, isActive: true };
  if (apiPath.endsWith("/subscription")) return { planId: "plan_standard", startsAt: "2026-08-01" };
  if (apiPath.endsWith("/approval")) return { status: "APPROVED" };
  if (/\/super-admin\/properties\/\{propertyId\}$/.test(apiPath)) {
    return { isActive: true, memberUserIds: ["usr_owner_01"] };
  }
  return { file: "(binary file)" };
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “json Success Response” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - method: ค่า “method” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - apiPath: ค่า “api Path” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export function jsonSuccessResponse(method, apiPath) {
  if (method === "get" && apiPath === "/api/v1/admin/properties/{propertyId}/search") {
    return data("PropertySearchResult", true);
  }
  if (method === "get" && apiPath.endsWith("/meter-readings/worksheet")) {
    return paginatedData("MeterWorksheetRow");
  }
  if (method === "get" && paginatedPaths.has(apiPath)) {
    if (apiPath === "/api/v1/super-admin/audit-logs") return paginatedData("AuditLog");
    if (apiPath === "/api/v1/super-admin/plans") return paginatedData("SaasPlan");
    if (apiPath === "/api/v1/super-admin/properties") return paginatedData("Property");
    if (apiPath === "/api/v1/super-admin/users") return paginatedData("SuperAdminUser");
    if (apiPath.endsWith("/subscription-orders")) return paginatedData("SubscriptionOrder");
    if (apiPath === "/api/v1/super-admin/subscription-payments") return paginatedData("SubscriptionPayment");
    if (apiPath === "/api/v1/admin/properties/{propertyId}/tenants") {
      return paginatedData("OwnerTenantListItem");
    }
    if (apiPath === "/api/v1/tenant/invoices") return paginatedData("TenantInvoiceListItem");
    if (apiPath === "/api/v1/tenant/announcements") return paginatedData("TenantAnnouncement");
    if (apiPath === "/api/v1/tenant/parcels") return paginatedData("TenantParcel");
    if (apiPath === "/api/v1/tenant/tickets") return paginatedData("TenantTicket");
    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: รวมขั้นตอนย่อยของ “segment” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
     * รับค่า:
     * - candidate: ค่าจริง/เท็จที่ใช้เปิดหรือปิดเงื่อนไขนี้
     * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
     */
    const segment = [...collectionSchemas.keys()].find((candidate) => apiPath.endsWith(`/${candidate}`));
    if (!segment) throw new Error(`No paginated schema for ${apiPath}`);
    return paginatedData(collectionSchemas.get(segment));
  }
  if (apiPath.endsWith("/tickets/{ticketId}/replies")) {
    return method === "get" ? paginatedData("TicketReply") : data("TicketReply");
  }
  if (apiPath.endsWith("/notifications/unread")) return data("TicketUnreadSummary");
  if (apiPath.endsWith("/promptpay-qr")) return data("PromptPay");
  if (apiPath.endsWith("/catalogs")) return direct("SuccessResult");
  if (apiPath.endsWith("/signed-document") && method === "post") return data("UploadResult");
  if (apiPath === "/api/v1/plans") return data("SaasPlan", true);
  if (apiPath === "/api/v1/super-admin/dashboard") return data("PlatformDashboard");
  if (apiPath === "/api/v1/super-admin/plans") return data("SaasPlan", method === "get");
  if (/\/super-admin\/plans\/\{planId\}$/.test(apiPath)) return data("SaasPlan");
  if (/\/subscription$/.test(apiPath)) return data("PropertySubscription");
  if (apiPath.endsWith("/subscription-orders")) return data("SubscriptionOrder");
  if (apiPath.endsWith("/payments") && apiPath.includes("/subscription-orders/")) return data("SubscriptionPayment");
  if (apiPath.includes("/super-admin/subscription-payments/{paymentId}")) return data("SubscriptionPaymentReview");
  if (/\/super-admin\/users\/\{userId\}\/approval$/.test(apiPath)) return data("AccountApproval");
  if (/\/super-admin\/users\/\{userId\}\/memberships$/.test(apiPath)) return data("PropertyAdminMembershipUpdate");
  if (/\/super-admin\/users\/\{userId\}\/temporary-password$/.test(apiPath)) return data("TemporaryPasswordResult");
  if (apiPath === "/api/v1/super-admin/support-chat" || apiPath.endsWith("/tenant-chat")) return direct("ConversationList");
  if (apiPath.includes("support-chat") || /\/tenant-chat\/\{tenantProfileId\}$/.test(apiPath) || apiPath === "/api/v1/tenant/chat") {
    return direct(method === "get" ? "ChatThread" : "ChatMessageResult");
  }
  if (apiPath.endsWith("/attachments") && apiPath.includes("/chat/")) return direct("ChatMessageResult");
  if (apiPath === "/api/v1/admin/properties/{propertyId}/dashboard") return data("OwnerWorkspaceReadModel");
  if (apiPath.endsWith("/dashboard/summary")) return data("OwnerDashboard");
  if (apiPath === "/api/v1/admin/properties/{propertyId}/occupancy-transitions") return data("OccupancyTransition", true);
  if (apiPath.endsWith("/tenants/{tenantProfileId}/transitions")) return data("OccupancyTransition", method === "get");
  if (apiPath === "/api/v1/admin/properties/{propertyId}") return data("Property");
  if (apiPath.endsWith("/settings")) return data("PropertySettings");
  if (apiPath.endsWith("/invoices/bulk")) return data("BulkInvoiceResult");
  if (apiPath.endsWith("/invoices/recalculate-overdue")) return data("OverdueRecalculation");
  if (apiPath.endsWith("/meter-readings/bulk")) return data("MeterReading", true);
  if (apiPath === "/api/v1/tenant/register") return data("TenantRegistration");
  if (apiPath === "/api/v1/tenant/invitations/accept") return data("TenantInvitationAcceptance");
  if (apiPath === "/api/v1/tenant/occupancy-selection") return data("TenantOccupancySelection");
  if (apiPath === "/api/v1/tenant/me") return data("TenantAccount");
  if (apiPath === "/api/v1/tenant/notifications/summary") return data("TenantNotificationSummary");
  if (apiPath === "/api/v1/tenant/room") return data("TenantRoom");
  if (apiPath === "/api/v1/tenant/lease") return data("TenantLease", false, true);
  if (apiPath.startsWith("/api/v1/tenant/")) {
    if (apiPath.includes("/invoices")) return data(apiPath.includes("payment-submissions") ? "PaymentSubmission" : "Invoice", method === "get" && !apiPath.includes("{invoiceId}"));
    if (apiPath.endsWith("/announcements")) return data("Announcement", true);
    if (apiPath.endsWith("/parcels")) return data("Parcel", true);
    if (apiPath.includes("/tickets")) return data(apiPath.endsWith("/attachments") ? "TicketAttachment" : "ServiceTicket", method === "get" && !apiPath.includes("{ticketId}"));
  }
  if (apiPath.includes("/buildings/") && apiPath.includes("/floors")) return data("Floor");
  if (apiPath.endsWith("/buildings")) return data("Building", method === "get");
  if (apiPath.includes("/buildings/{buildingId}")) return data("Building");
  for (const [segment, schema] of collectionSchemas) {
    if (!apiPath.includes(`/${segment}`)) continue;
    const isCollection = apiPath.endsWith(`/${segment}`);
    return data(schema, method === "get" && isCollection);
  }
  if (apiPath.includes("/announcements/")) return data("Announcement");
  if (apiPath.includes("/parcels/")) return data("Parcel");
  if (apiPath.includes("/payment-submissions/")) return data("PaymentSubmission");
  if (apiPath.includes("/rooms/")) return data("Room");
  if (apiPath.includes("/tenants/")) return data("Tenant");
  if (apiPath.includes("/tickets/")) return data("ServiceTicket");
  if (apiPath.includes("/leases/")) return data("Lease");
  if (apiPath.includes("/occupancies/")) return data("Occupancy");
  if (apiPath.includes("/invitations/")) return data("Invitation");
  if (apiPath.startsWith("/api/v1/super-admin/properties/")) return data("Property");
  throw new Error(`No JSON response contract for ${method.toUpperCase()} ${apiPath}`);
}
