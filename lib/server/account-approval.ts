import type { ReviewAccountApprovalInput } from "@/lib/domain/account-approval";
import { ApiError } from "@/lib/server/api";
import { getDatabase } from "@/lib/server/db";

// อนุมัติหรือปฏิเสธบัญชีเจ้าของหอ
export async function reviewPropertyAdminAccount(
  userId: string,
  reviewerId: string,
  input: ReviewAccountApprovalInput,
) {
  // ห้ามอนุมัติบัญชีตัวเอง เป็นหลักการแยกคนทำกับคนตรวจออกจากกัน
  if (userId === reviewerId) throw new ApiError(409, "ไม่สามารถอนุมัติบัญชีของตนเอง");
  // ทำใน transaction เพราะต้องอ่านสถานะแล้วเขียนทับ ถ้าแยกกันสองคนกดพร้อมกันจะอนุมัติซ้อนกัน
  return getDatabase().$transaction(async (database) => {
    const account = await database.user.findFirst({
      where: { id: userId, role: "PROPERTY_ADMIN" },
      select: { id: true, approvalStatus: true },
    });
    if (!account) throw new ApiError(404, "ไม่พบบัญชีเจ้าของหอ");
    // ตรวจไปแล้วก็ตรวจซ้ำไม่ได้ ต้องเป็นสถานะรอตรวจเท่านั้น
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
    // ปฏิเสธแล้วต้องตัด session ที่เปิดค้างอยู่ทิ้งด้วย ไม่งั้นยังใช้งานต่อได้จนกว่าจะหมดอายุเอง
    if (input.status === "REJECTED") {
      await database.session.deleteMany({ where: { userId: account.id } });
    }
    return updated;
  // Serializable คือระดับที่เข้มที่สุด เพราะการอนุมัติซ้อนกันเป็นเรื่องที่ยอมให้เกิดไม่ได้
  }, { isolationLevel: "Serializable" });
}
