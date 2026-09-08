/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เก็บกฎธุรกิจและการตรวจข้อมูลของเรื่อง “enums” โดยไม่ผูกกับหน้าจอ
 * การทำงาน: ฟังก์ชันในชั้นนี้ควรให้ผลลัพธ์เดิมเมื่อรับข้อมูลเดิม จึงทดสอบแยกและนำกลับมาใช้ใน API หลายเส้นได้
 */

import { z } from "zod";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ประกาศค่าหรือ schema “subscription Statuses” ที่ส่วนอื่นนำไปใช้ร่วมกัน เพื่อให้กฎและรูปแบบมีแหล่งอ้างอิงเดียว
 */
export const subscriptionStatuses = ["TRIAL", "ACTIVE", "EXPIRED", "SUSPENDED"] as const;
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ประกาศค่าหรือ schema “subscription Order Statuses” ที่ส่วนอื่นนำไปใช้ร่วมกัน เพื่อให้กฎและรูปแบบมีแหล่งอ้างอิงเดียว
 */
export const subscriptionOrderStatuses = ["PENDING_PAYMENT", "PENDING_REVIEW", "PAID", "REJECTED", "CANCELLED", "EXPIRED"] as const;
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ประกาศค่าหรือ schema “subscription Payment Statuses” ที่ส่วนอื่นนำไปใช้ร่วมกัน เพื่อให้กฎและรูปแบบมีแหล่งอ้างอิงเดียว
 */
export const subscriptionPaymentStatuses = ["PENDING_REVIEW", "APPROVED", "REJECTED"] as const;
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ประกาศค่าหรือ schema “room Statuses” ที่ส่วนอื่นนำไปใช้ร่วมกัน เพื่อให้กฎและรูปแบบมีแหล่งอ้างอิงเดียว
 */
export const roomStatuses = ["AVAILABLE", "OCCUPIED", "MAINTENANCE", "INACTIVE"] as const;
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ประกาศค่าหรือ schema “occupancy Roles” ที่ส่วนอื่นนำไปใช้ร่วมกัน เพื่อให้กฎและรูปแบบมีแหล่งอ้างอิงเดียว
 */
export const occupancyRoles = ["PRIMARY", "CO_OCCUPANT"] as const;
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ประกาศค่าหรือ schema “occupancy Statuses” ที่ส่วนอื่นนำไปใช้ร่วมกัน เพื่อให้กฎและรูปแบบมีแหล่งอ้างอิงเดียว
 */
export const occupancyStatuses = ["PENDING", "ACTIVE", "ENDED", "REJECTED"] as const;
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ประกาศค่าหรือ schema “invitation Statuses” ที่ส่วนอื่นนำไปใช้ร่วมกัน เพื่อให้กฎและรูปแบบมีแหล่งอ้างอิงเดียว
 */
export const invitationStatuses = ["PENDING", "ACCEPTED", "EXPIRED", "REVOKED"] as const;
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ประกาศค่าหรือ schema “lease Statuses” ที่ส่วนอื่นนำไปใช้ร่วมกัน เพื่อให้กฎและรูปแบบมีแหล่งอ้างอิงเดียว
 */
export const leaseStatuses = ["DRAFT", "PENDING_SIGNATURE", "ACTIVE", "EXPIRING", "EXPIRED", "CANCELLED"] as const;
export const meterTypes = ["WATER", "ELECTRICITY"] as const;
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ประกาศค่าหรือ schema “invoice Statuses” ที่ส่วนอื่นนำไปใช้ร่วมกัน เพื่อให้กฎและรูปแบบมีแหล่งอ้างอิงเดียว
 */
export const invoiceStatuses = ["DRAFT", "PENDING", "PAID", "OVERDUE", "CANCELLED"] as const;
export const invoiceItemTypes = ["RENT", "WATER", "ELECTRICITY", "SERVICE", "LATE_FEE", "OTHER"] as const;
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ประกาศค่าหรือ schema “payment Submission Statuses” ที่ส่วนอื่นนำไปใช้ร่วมกัน เพื่อให้กฎและรูปแบบมีแหล่งอ้างอิงเดียว
 */
export const paymentSubmissionStatuses = ["PENDING_REVIEW", "APPROVED", "REJECTED"] as const;
export const ticketTypes = ["REPAIR", "COMPLAINT"] as const;
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ประกาศค่าหรือ schema “ticket Statuses” ที่ส่วนอื่นนำไปใช้ร่วมกัน เพื่อให้กฎและรูปแบบมีแหล่งอ้างอิงเดียว
 */
export const ticketStatuses = ["OPEN", "ACKNOWLEDGED", "IN_PROGRESS", "RESOLVED", "CANCELLED"] as const;
export const ticketPriorities = ["NORMAL", "URGENT"] as const;
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ประกาศค่าหรือ schema “parcel Statuses” ที่ส่วนอื่นนำไปใช้ร่วมกัน เพื่อให้กฎและรูปแบบมีแหล่งอ้างอิงเดียว
 */
export const parcelStatuses = ["WAITING", "RECEIVED", "CANCELLED"] as const;
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ประกาศค่าหรือ schema “announcement Statuses” ที่ส่วนอื่นนำไปใช้ร่วมกัน เพื่อให้กฎและรูปแบบมีแหล่งอ้างอิงเดียว
 */
export const announcementStatuses = ["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"] as const;
export const announcementAudiences = ["ALL_TENANTS", "BUILDING", "FLOOR", "ROOM"] as const;

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ประกาศค่าหรือ schema “subscription Status Schema” ที่ส่วนอื่นนำไปใช้ร่วมกัน เพื่อให้กฎและรูปแบบมีแหล่งอ้างอิงเดียว
 */
export const subscriptionStatusSchema = z.enum(subscriptionStatuses);
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ประกาศค่าหรือ schema “room Status Schema” ที่ส่วนอื่นนำไปใช้ร่วมกัน เพื่อให้กฎและรูปแบบมีแหล่งอ้างอิงเดียว
 */
export const roomStatusSchema = z.enum(roomStatuses);
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ประกาศค่าหรือ schema “occupancy Role Schema” ที่ส่วนอื่นนำไปใช้ร่วมกัน เพื่อให้กฎและรูปแบบมีแหล่งอ้างอิงเดียว
 */
export const occupancyRoleSchema = z.enum(occupancyRoles);
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ประกาศค่าหรือ schema “occupancy Status Schema” ที่ส่วนอื่นนำไปใช้ร่วมกัน เพื่อให้กฎและรูปแบบมีแหล่งอ้างอิงเดียว
 */
export const occupancyStatusSchema = z.enum(occupancyStatuses);
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ประกาศค่าหรือ schema “invitation Status Schema” ที่ส่วนอื่นนำไปใช้ร่วมกัน เพื่อให้กฎและรูปแบบมีแหล่งอ้างอิงเดียว
 */
export const invitationStatusSchema = z.enum(invitationStatuses);
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ประกาศค่าหรือ schema “lease Status Schema” ที่ส่วนอื่นนำไปใช้ร่วมกัน เพื่อให้กฎและรูปแบบมีแหล่งอ้างอิงเดียว
 */
export const leaseStatusSchema = z.enum(leaseStatuses);
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ประกาศค่าหรือ schema “meter Type Schema” ที่ส่วนอื่นนำไปใช้ร่วมกัน เพื่อให้กฎและรูปแบบมีแหล่งอ้างอิงเดียว
 */
export const meterTypeSchema = z.enum(meterTypes);
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ประกาศค่าหรือ schema “invoice Status Schema” ที่ส่วนอื่นนำไปใช้ร่วมกัน เพื่อให้กฎและรูปแบบมีแหล่งอ้างอิงเดียว
 */
export const invoiceStatusSchema = z.enum(invoiceStatuses);
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ประกาศค่าหรือ schema “invoice Item Type Schema” ที่ส่วนอื่นนำไปใช้ร่วมกัน เพื่อให้กฎและรูปแบบมีแหล่งอ้างอิงเดียว
 */
export const invoiceItemTypeSchema = z.enum(invoiceItemTypes);
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ประกาศค่าหรือ schema “payment Submission Status Schema” ที่ส่วนอื่นนำไปใช้ร่วมกัน เพื่อให้กฎและรูปแบบมีแหล่งอ้างอิงเดียว
 */
export const paymentSubmissionStatusSchema = z.enum(paymentSubmissionStatuses);
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ประกาศค่าหรือ schema “ticket Type Schema” ที่ส่วนอื่นนำไปใช้ร่วมกัน เพื่อให้กฎและรูปแบบมีแหล่งอ้างอิงเดียว
 */
export const ticketTypeSchema = z.enum(ticketTypes);
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ประกาศค่าหรือ schema “ticket Status Schema” ที่ส่วนอื่นนำไปใช้ร่วมกัน เพื่อให้กฎและรูปแบบมีแหล่งอ้างอิงเดียว
 */
export const ticketStatusSchema = z.enum(ticketStatuses);
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ประกาศค่าหรือ schema “ticket Priority Schema” ที่ส่วนอื่นนำไปใช้ร่วมกัน เพื่อให้กฎและรูปแบบมีแหล่งอ้างอิงเดียว
 */
export const ticketPrioritySchema = z.enum(ticketPriorities);
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ประกาศค่าหรือ schema “parcel Status Schema” ที่ส่วนอื่นนำไปใช้ร่วมกัน เพื่อให้กฎและรูปแบบมีแหล่งอ้างอิงเดียว
 */
export const parcelStatusSchema = z.enum(parcelStatuses);
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ประกาศค่าหรือ schema “announcement Status Schema” ที่ส่วนอื่นนำไปใช้ร่วมกัน เพื่อให้กฎและรูปแบบมีแหล่งอ้างอิงเดียว
 */
export const announcementStatusSchema = z.enum(announcementStatuses);
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ประกาศค่าหรือ schema “announcement Audience Schema” ที่ส่วนอื่นนำไปใช้ร่วมกัน เพื่อให้กฎและรูปแบบมีแหล่งอ้างอิงเดียว
 */
export const announcementAudienceSchema = z.enum(announcementAudiences);

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Subscription Status” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>;
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Room Status” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type RoomStatus = z.infer<typeof roomStatusSchema>;
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Occupancy Role” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type OccupancyRole = z.infer<typeof occupancyRoleSchema>;
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Occupancy Status” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type OccupancyStatus = z.infer<typeof occupancyStatusSchema>;
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Invitation Status” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type InvitationStatus = z.infer<typeof invitationStatusSchema>;
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Lease Status” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type LeaseStatus = z.infer<typeof leaseStatusSchema>;
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Meter Type” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type MeterType = z.infer<typeof meterTypeSchema>;
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Invoice Status” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type InvoiceStatus = z.infer<typeof invoiceStatusSchema>;
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Invoice Item Type” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type InvoiceItemType = z.infer<typeof invoiceItemTypeSchema>;
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Payment Submission Status” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type PaymentSubmissionStatus = z.infer<typeof paymentSubmissionStatusSchema>;
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Ticket Type” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type TicketType = z.infer<typeof ticketTypeSchema>;
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Ticket Status” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type TicketStatus = z.infer<typeof ticketStatusSchema>;
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Ticket Priority” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type TicketPriority = z.infer<typeof ticketPrioritySchema>;
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Parcel Status” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type ParcelStatus = z.infer<typeof parcelStatusSchema>;
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Announcement Status” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type AnnouncementStatus = z.infer<typeof announcementStatusSchema>;
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Announcement Audience” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type AnnouncementAudience = z.infer<typeof announcementAudienceSchema>;

export const leaseStatusTransitions: Readonly<Record<LeaseStatus, readonly LeaseStatus[]>> = {
  DRAFT: ["PENDING_SIGNATURE", "CANCELLED"],
  PENDING_SIGNATURE: ["DRAFT", "ACTIVE", "CANCELLED"],
  ACTIVE: ["EXPIRING", "EXPIRED", "CANCELLED"],
  EXPIRING: ["ACTIVE", "EXPIRED", "CANCELLED"],
  EXPIRED: [],
  CANCELLED: [],
};

export const invoiceStatusTransitions: Readonly<Record<InvoiceStatus, readonly InvoiceStatus[]>> = {
  DRAFT: ["PENDING", "CANCELLED"],
  PENDING: ["PAID", "OVERDUE", "CANCELLED"],
  PAID: [],
  OVERDUE: ["PAID", "CANCELLED"],
  CANCELLED: [],
};

export const ticketStatusTransitions: Readonly<Record<TicketStatus, readonly TicketStatus[]>> = {
  OPEN: ["ACKNOWLEDGED", "CANCELLED"],
  ACKNOWLEDGED: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
  IN_PROGRESS: ["ACKNOWLEDGED", "RESOLVED", "CANCELLED"],
  RESOLVED: [],
  CANCELLED: [],
};
