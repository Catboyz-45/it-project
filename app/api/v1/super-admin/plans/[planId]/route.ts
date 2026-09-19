import { NextRequest } from "next/server";
import { z } from "zod";
import { updateSaasPlanSchema } from "@/lib/domain/saas";
import { apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { requireRequestAuth, requireRole } from "@/lib/server/auth";
import { updateSaasPlan } from "@/lib/server/saas";

type Context = { params: Promise<{ planId: string }> };
const idSchema = z.string().min(3).max(100);

// แก้ราคา โควตา หรือปิดขายแพ็กเกจ
export async function PATCH(request: NextRequest, context: Context) {
  try {
    // กัน CSRF ตรวจว่าคำขอมาจากหน้าเว็บของเราเอง และบังคับ Content-Type เป็น JSON
    assertSameOrigin(request);
    const auth = await requireRequestAuth(request);
    requireRole(auth, "SUPER_ADMIN");
    const planId = idSchema.parse((await context.params).planId);
    const data = await updateSaasPlan(planId, updateSaasPlanSchema.parse(await request.json()));
    return apiSuccessResponse(request, { data }, undefined, {
      userId: auth.userId, action: "SAAS_PLAN_UPDATE", targetType: "SaasPlan", targetId: planId,
    });
  // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
  } catch (error) { return apiErrorResponse(error, request); }
}
