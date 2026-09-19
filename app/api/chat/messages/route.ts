import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listTenantMessages, sendAdminMessage } from "@/lib/server/chat";
import { parsePagination } from "@/lib/server/pagination";
import { apiErrorResponse, apiSuccessResponse, assertSameOrigin } from "@/lib/server/api";
import { requireRequestProperty } from "@/lib/server/auth";

const tenantIdSchema = z.string().trim().min(1).max(80).regex(/^[a-zA-Z0-9_-]+$/);
const sendSchema = z.object({
  tenantId: tenantIdSchema,
  tenantName: z.string().trim().min(1).max(160),
  roomNumber: z.string().trim().min(1).max(30),
  body: z.string().trim().min(1).max(4000),
  clientId: z.string().uuid(),
}).strict();

// ประวัติข้อความของทางเดิม
export async function GET(request: NextRequest) {
  try {
    const { propertyId } = await requireRequestProperty(request);
    const tenantId = tenantIdSchema.parse(request.nextUrl.searchParams.get("tenantId"));
    const result = await listTenantMessages(
      propertyId,
      tenantId,
      parsePagination(request.nextUrl.searchParams),
    );
    return NextResponse.json({ messages: result.data, pageInfo: result.pageInfo });
  } catch (error) {
    return apiErrorResponse(error, request);
  }
}

// ส่งข้อความของทางเดิม
export async function POST(request: NextRequest) {
  try {
    // กัน CSRF ตรวจว่าคำขอมาจากหน้าเว็บของเราเอง และบังคับ Content-Type เป็น JSON
    assertSameOrigin(request);
    const { auth, propertyId } = await requireRequestProperty(request);
    const input = sendSchema.parse(await request.json());
    const message = await sendAdminMessage({ propertyId, userId: auth.userId, ...input });
    return apiSuccessResponse(request, { message }, { status: 201 }, {
      userId: auth.userId, propertyId, action: "CHAT_MESSAGE_SEND",
      targetType: "ChatMessage", targetId: message.id,
    });
  } catch (error) {
    return apiErrorResponse(error, request);
  }
}
