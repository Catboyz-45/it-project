import { z } from "zod";

// สถานะทั้งหมดของระบบอยู่ที่นี่ที่เดียว ทั้งฐานข้อมูล ตัวตรวจ และหน้าจออ้างอิงจากชุดนี้
// as const ทำให้ TypeScript รู้ค่าที่เป็นไปได้ทั้งหมด พิมพ์ผิดจะจับได้ตั้งแต่ตอนคอมไพล์
export const subscriptionStatuses = ["TRIAL", "ACTIVE", "EXPIRED", "SUSPENDED"] as const;
export const subscriptionOrderStatuses = ["PENDING_PAYMENT", "PENDING_REVIEW", "PAID", "REJECTED", "CANCELLED", "EXPIRED"] as const;
export const subscriptionPaymentStatuses = ["PENDING_REVIEW", "APPROVED", "REJECTED"] as const;
export const roomStatuses = ["AVAILABLE", "OCCUPIED", "MAINTENANCE", "INACTIVE"] as const;
export const occupancyRoles = ["PRIMARY", "CO_OCCUPANT"] as const;
export const occupancyStatuses = ["PENDING", "ACTIVE", "ENDED", "REJECTED"] as const;
export const invitationStatuses = ["PENDING", "ACCEPTED", "EXPIRED", "REVOKED"] as const;
export const leaseStatuses = ["DRAFT", "PENDING_SIGNATURE", "ACTIVE", "EXPIRING", "EXPIRED", "CANCELLED"] as const;
export const meterTypes = ["WATER", "ELECTRICITY"] as const;
export const invoiceStatuses = ["DRAFT", "PENDING", "PAID", "OVERDUE", "CANCELLED"] as const;
export const invoiceItemTypes = ["RENT", "WATER", "ELECTRICITY", "SERVICE", "LATE_FEE", "OTHER"] as const;
export const paymentSubmissionStatuses = ["PENDING_REVIEW", "APPROVED", "REJECTED"] as const;
export const ticketTypes = ["REPAIR", "COMPLAINT"] as const;
export const ticketStatuses = ["OPEN", "ACKNOWLEDGED", "IN_PROGRESS", "RESOLVED", "CANCELLED"] as const;
export const ticketPriorities = ["NORMAL", "URGENT"] as const;
export const parcelStatuses = ["WAITING", "RECEIVED", "CANCELLED"] as const;
export const announcementStatuses = ["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"] as const;
export const announcementAudiences = ["ALL_TENANTS", "BUILDING", "FLOOR", "ROOM"] as const;

// สร้างตัวตรวจจากรายการข้างบน จะได้ไม่ต้องเขียนค่าซ้ำสองที่แล้วหลุดไม่ตรงกัน
export const subscriptionStatusSchema = z.enum(subscriptionStatuses);
export const roomStatusSchema = z.enum(roomStatuses);
export const occupancyRoleSchema = z.enum(occupancyRoles);
export const occupancyStatusSchema = z.enum(occupancyStatuses);
export const invitationStatusSchema = z.enum(invitationStatuses);
export const leaseStatusSchema = z.enum(leaseStatuses);
export const meterTypeSchema = z.enum(meterTypes);
export const invoiceStatusSchema = z.enum(invoiceStatuses);
export const invoiceItemTypeSchema = z.enum(invoiceItemTypes);
export const paymentSubmissionStatusSchema = z.enum(paymentSubmissionStatuses);
export const ticketTypeSchema = z.enum(ticketTypes);
export const ticketStatusSchema = z.enum(ticketStatuses);
export const ticketPrioritySchema = z.enum(ticketPriorities);
export const parcelStatusSchema = z.enum(parcelStatuses);
export const announcementStatusSchema = z.enum(announcementStatuses);
export const announcementAudienceSchema = z.enum(announcementAudiences);

// ดึงชนิดออกมาจากตัวตรวจ ชนิดกับกฎการตรวจจึงตรงกันเสมอ
export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>;
export type RoomStatus = z.infer<typeof roomStatusSchema>;
export type OccupancyRole = z.infer<typeof occupancyRoleSchema>;
export type OccupancyStatus = z.infer<typeof occupancyStatusSchema>;
export type InvitationStatus = z.infer<typeof invitationStatusSchema>;
export type LeaseStatus = z.infer<typeof leaseStatusSchema>;
export type MeterType = z.infer<typeof meterTypeSchema>;
export type InvoiceStatus = z.infer<typeof invoiceStatusSchema>;
export type InvoiceItemType = z.infer<typeof invoiceItemTypeSchema>;
export type PaymentSubmissionStatus = z.infer<typeof paymentSubmissionStatusSchema>;
export type TicketType = z.infer<typeof ticketTypeSchema>;
export type TicketStatus = z.infer<typeof ticketStatusSchema>;
export type TicketPriority = z.infer<typeof ticketPrioritySchema>;
export type ParcelStatus = z.infer<typeof parcelStatusSchema>;
export type AnnouncementStatus = z.infer<typeof announcementStatusSchema>;
export type AnnouncementAudience = z.infer<typeof announcementAudienceSchema>;

// ตารางว่าสถานะไหนไปต่อเป็นอะไรได้บ้าง อาเรย์ว่างคือจุดจบ ไปต่อไม่ได้แล้ว
// เขียนเป็นข้อมูลแทนการเขียน if กระจายทั้งระบบ จะได้เห็นกฎทั้งหมดในที่เดียวและทดสอบได้
// Readonly กันเผลอแก้ตอนทำงาน
export const leaseStatusTransitions: Readonly<Record<LeaseStatus, readonly LeaseStatus[]>> = {
  DRAFT: ["PENDING_SIGNATURE", "CANCELLED"],
  // ถอยกลับเป็นร่างได้ เผื่อพบว่ากรอกผิดตอนรอลงนาม
  PENDING_SIGNATURE: ["DRAFT", "ACTIVE", "CANCELLED"],
  ACTIVE: ["EXPIRING", "EXPIRED", "CANCELLED"],
  EXPIRING: ["ACTIVE", "EXPIRED", "CANCELLED"],
  // หมดอายุกับยกเลิกเป็นจุดจบ ต้องทำสัญญาใหม่ ไม่ใช่รื้อของเดิมกลับมา
  EXPIRED: [],
  CANCELLED: [],
};

export const invoiceStatusTransitions: Readonly<Record<InvoiceStatus, readonly InvoiceStatus[]>> = {
  DRAFT: ["PENDING", "CANCELLED"],
  PENDING: ["PAID", "OVERDUE", "CANCELLED"],
  PAID: [],
  // ค้างชำระแล้วจ่ายทีหลังได้ แต่กลับไปเป็นรอชำระไม่ได้ เพราะเลยกำหนดไปแล้วจริง ๆ
  OVERDUE: ["PAID", "CANCELLED"],
  CANCELLED: [],
};

export const ticketStatusTransitions: Readonly<Record<TicketStatus, readonly TicketStatus[]>> = {
  OPEN: ["ACKNOWLEDGED", "CANCELLED"],
  ACKNOWLEDGED: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
  // ถอยกลับเป็นรับเรื่องได้ เผื่อพบว่าต้องรอข้อมูลเพิ่มจากผู้แจ้ง
  IN_PROGRESS: ["ACKNOWLEDGED", "RESOLVED", "CANCELLED"],
  RESOLVED: [],
  CANCELLED: [],
};
