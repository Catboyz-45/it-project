import { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { requireRequestAuth, requireRole } from "@/lib/server/auth";
import { getDatabase } from "@/lib/server/db";
import { hashPassword } from "@/lib/server/password";

const schema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  displayName: z.string().trim().min(2).max(120),
  password: z.string().min(12).max(128),
  propertyIds: z.array(z.string().cuid()).min(1).max(50),
}).strict();

// ผู้ดูแลระบบสร้างบัญชีเจ้าของหอ พร้อมกำหนดว่าดูแลหอไหนได้บ้าง
export async function POST(request: NextRequest) {
  try {
    // กัน CSRF ตรวจว่าคำขอมาจากหน้าเว็บของเราเอง และบังคับ Content-Type เป็น JSON
    assertSameOrigin(request);
    const auth = await requireRequestAuth(request);
    requireRole(auth, "SUPER_ADMIN");
    const input = schema.parse(await request.json());
    const uniquePropertyIds = [...new Set(input.propertyIds)];
    const propertyCount = await getDatabase().property.count({ where: { id: { in: uniquePropertyIds }, isActive: true } });
    if (propertyCount !== uniquePropertyIds.length) throw new ApiError(400, "ไม่พบหอพักที่เลือก");
    const user = await getDatabase().user.create({
      data: {
        email: input.email,
        displayName: input.displayName,
        passwordHash: await hashPassword(input.password),
        mustChangePassword: true,
        role: "PROPERTY_ADMIN",
        approvalStatus: "PENDING",
        memberships: { create: uniquePropertyIds.map((propertyId) => ({ propertyId })) },
      },
      select: { id: true },
    });
    return apiSuccessResponse(request, { id: user.id, approvalStatus: "PENDING" }, { status: 201 }, {
      userId: auth.userId, action: "PROPERTY_ADMIN_CREATE_PENDING_APPROVAL",
      targetType: "User", targetId: user.id,
    });
  } catch (error) {
    // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
    return apiErrorResponse(error, request);
  }
}
