import { NextRequest, NextResponse } from "next/server";
import { ownAvatarUrl } from "@/lib/avatar";
import { getStorageAdapter } from "@/lib/documents/storage";
import { ApiError, apiErrorResponse, apiSuccessResponse, assertSameOrigin, readFormData } from "@/lib/server/api";
import { assertUploadRateLimit } from "@/lib/server/api-rate-limit";
import { requireRequestAuth } from "@/lib/server/auth";
import { getUserAvatarKey, normalizeAvatarImage, removeUserAvatar, replaceUserAvatar } from "@/lib/server/avatar";

// เปิดรูปโปรไฟล์ของตัวเอง เปิดได้เฉพาะเจ้าของบัญชี จึงไม่ต้องตรวจสิทธิ์ข้ามบัญชี
// ที่อยู่มีเวอร์ชันติดไปเสมอ เก็บในเครื่องได้นาน แต่ห้าม proxy กลางทางเก็บไว้
export async function GET(request: NextRequest) {
  try {
    const auth = await requireRequestAuth(request);
    const avatarKey = await getUserAvatarKey(auth.userId);
    if (!avatarKey) throw new ApiError(404, "ยังไม่มีรูปโปรไฟล์");
    const file = await getStorageAdapter().get(avatarKey);
    return new NextResponse(new Uint8Array(file.body), {
      headers: {
        "Cache-Control": "private, max-age=86400",
        "Content-Type": "image/webp",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    // ดักที่เดียวจบ แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
    return apiErrorResponse(error, request);
  }
}

// อัปโหลดรูปใหม่แทนรูปเดิม
export async function POST(request: NextRequest) {
  try {
    // multipart จึงไม่บังคับ JSON แต่ยังตรวจว่ามาจากหน้าเว็บของเราเอง กัน CSRF
    assertSameOrigin(request, null);
    const auth = await requireRequestAuth(request);
    await assertUploadRateLimit(request, "avatar");
    const file = (await readFormData(request)).get("file");
    if (!(file instanceof File) || file.size === 0) throw new ApiError(400, "กรุณาเลือกรูป");
    const image = await normalizeAvatarImage(new Uint8Array(await file.arrayBuffer()));
    const avatarKey = await replaceUserAvatar(auth.userId, image);
    return apiSuccessResponse(request, { avatarUrl: ownAvatarUrl(avatarKey) }, undefined, {
      userId: auth.userId,
      action: "ACCOUNT_AVATAR_UPDATE",
      targetType: "User",
      targetId: auth.userId,
    });
  } catch (error) {
    return apiErrorResponse(error, request);
  }
}

// เอารูปออก กลับไปใช้วงกลมตัวอักษรแรกของชื่อ
export async function DELETE(request: NextRequest) {
  try {
    assertSameOrigin(request, null);
    const auth = await requireRequestAuth(request);
    await removeUserAvatar(auth.userId);
    return apiSuccessResponse(request, { avatarUrl: null }, undefined, {
      userId: auth.userId,
      action: "ACCOUNT_AVATAR_REMOVE",
      targetType: "User",
      targetId: auth.userId,
    });
  } catch (error) {
    return apiErrorResponse(error, request);
  }
}
