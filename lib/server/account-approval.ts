/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นโค้ดฝั่งเซิร์ฟเวอร์สำหรับ “account approval” ซึ่งอาจแตะฐานข้อมูล session ไฟล์ หรือความลับของระบบ
 * การทำงาน: ถูกเรียกจาก Server Component หรือ API route เพื่อทำ use case จริง ตรวจสิทธิ์และกฎธุรกิจก่อนอ่านหรือเปลี่ยนข้อมูล และไม่ควรถูก import ไปยัง Client Component
 */

import type { ReviewAccountApprovalInput } from "@/lib/domain/account-approval";
import { ApiError } from "@/lib/server/api";
import { getDatabase } from "@/lib/server/db";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: เปลี่ยนข้อมูลหรือสถานะในขั้นตอน “review Property Admin Account” โดยใช้ค่าที่รับเข้ามา
 * รับค่า:
 * - userId: รหัสภายในของบัญชีผู้ใช้
 * - reviewerId: รหัสภายในของ reviewer
 * - input: ข้อมูลขาเข้าที่ต้องนำไปตรวจและประมวลผล
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function reviewPropertyAdminAccount(
  userId: string,
  reviewerId: string,
  input: ReviewAccountApprovalInput,
) {
  if (userId === reviewerId) throw new ApiError(409, "ไม่สามารถอนุมัติบัญชีของตนเอง");
  return getDatabase().$transaction(async (database) => {
    const account = await database.user.findFirst({
      where: { id: userId, role: "PROPERTY_ADMIN" },
      select: { id: true, approvalStatus: true },
    });
    if (!account) throw new ApiError(404, "ไม่พบบัญชีเจ้าของหอ");
    if (account.approvalStatus !== "PENDING") {
      throw new ApiError(409, "บัญชีนี้ผ่านการตรวจสอบแล้ว");
    }
    const reviewedAt = new Date();
    const updated = await database.user.update({
      where: { id: account.id },
      data: {
        approvalStatus: input.status,
        approvalReviewedAt: reviewedAt,
        approvalReviewedById: reviewerId,
        approvalRejectionReason: input.status === "REJECTED" ? input.rejectionReason : null,
      },
      select: {
        id: true, email: true, displayName: true, role: true, isActive: true,
        approvalStatus: true, approvalReviewedAt: true, approvalRejectionReason: true,
      },
    });
    if (input.status === "REJECTED") {
      await database.session.deleteMany({ where: { userId: account.id } });
    }
    return updated;
  }, { isolationLevel: "Serializable" });
}
