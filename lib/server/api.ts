import { after, NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { writeAuditLogSafely } from "@/lib/server/audit";
import { getRequestActorContext } from "@/lib/server/request-context";
import type { AuditInput } from "@/lib/server/audit";

// ป้องกัน CSRF ตรวจว่าคำขอมาจากหน้าเว็บของเราเอง ไม่ใช่จากเว็บอื่นที่หลอกให้ผู้ใช้กด
// ทุก route ที่เปลี่ยนข้อมูลต้องเรียกตัวนี้
export function assertSameOrigin(
  request: NextRequest,
  expectedContentType: string | null = "application/json",
) {
  const origin = request.headers.get("origin");
  // อยู่หลัง proxy ต้องดู x-forwarded-host เพราะ host จะเป็นของ proxy ไม่ใช่ที่ผู้ใช้เห็น
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",", 1)[0]?.trim();
  const requestHost = forwardedHost || request.headers.get("host") || request.nextUrl.host;
  let originHost = "";
  try {
    originHost = origin ? new URL(origin).host : "";
  } catch {
    // origin รูปแบบผิดก็ปล่อยให้เป็นสตริงว่าง แล้วไปตกที่การเทียบ host ข้างล่างซึ่งจะไม่ผ่านอยู่ดี
  }
  const acceptedHosts = new Set([requestHost, request.nextUrl.host]);
  // ไม่มี origin มาเลยก็ไม่ผ่าน เพราะเบราว์เซอร์ส่งมาเสมอสำหรับคำขอที่เปลี่ยนข้อมูล
  if (!originHost || !acceptedHosts.has(originHost)) throw new ApiError(403, "Request origin is not allowed");
  // บังคับ Content-Type ด้วย เพราะฟอร์ม HTML ธรรมดาส่ง application/json ไม่ได้
  // จึงเป็นอีกชั้นที่กันไม่ให้เว็บอื่นสร้างฟอร์มมายิงใส่ API ของเรา
  if (expectedContentType && request.headers.get("content-type")?.split(";", 1)[0] !== expectedContentType) {
    throw new ApiError(415, `Content-Type must be ${expectedContentType}`);
  }
}

// Error ที่พกรหัสสถานะ HTTP ติดมาด้วย โยนจากที่ไหนก็ได้แล้วกลายเป็นคำตอบที่ถูกต้อง
export class ApiError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

// ตอบกลับตอนสำเร็จ ทุก route ใช้ตัวนี้ จะได้มีรูปแบบและ requestId เหมือนกันหมด
// มีตัวทดสอบคอยเช็คว่าไม่มี route ไหนตอบเองโดยไม่ผ่านตรงนี้
export function apiSuccessResponse(
  request: NextRequest,
  body: Record<string, unknown>,
  init?: { status?: number; headers?: HeadersInit },
  audit?: Omit<AuditInput, "request" | "requestId" | "result">,
) {
  // ใช้ requestId ที่ proxy ส่งมา ไม่มีก็สร้างเอง ผู้ใช้จะได้อ้างอิงรหัสนี้เวลาแจ้งปัญหา
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  // บันทึกเฉพาะคำขอที่เปลี่ยนข้อมูล การอ่านเฉย ๆ ไม่ต้องบันทึก ไม่งั้น log จะท่วม
  if (request.method !== "GET" && request.method !== "HEAD") {
    const context = getRequestActorContext(request);
    const recordSuccess = () => writeAuditLogSafely({
      userId: context.userId,
      propertyId: context.propertyId,
      action: `API_${request.method}_SUCCESS`,
      targetType: request.nextUrl.pathname.slice(0, 120),
      ...audit,
      request,
      requestId,
      result: "SUCCESS",
    });
    // after ทำให้เขียน log หลังส่งคำตอบไปแล้ว ผู้ใช้จะได้ไม่ต้องรอ
    // ใช้ไม่ได้ตอนเรียก route ตรง ๆ ในการทดสอบ จึงมีทางสำรองให้เขียนทันที
    try {
      after(recordSuccess);
    } catch {
      void recordSuccess();
    }
  }
  const headers = new Headers(init?.headers);
  headers.set("x-request-id", requestId);
  // แนบ requestId ไปทั้งใน header และในตัวข้อมูล เผื่อฝั่งเบราว์เซอร์อ่านได้ไม่ครบทั้งสองทาง
  return NextResponse.json({ ...body, requestId }, { ...init, headers });
}

// แบบเดียวกันแต่สำหรับไฟล์ ใช้กับ PDF และ CSV ที่ตอบเป็น JSON ไม่ได้
export function apiSuccessBinaryResponse(
  request: NextRequest,
  body: BodyInit | null,
  init: ResponseInit,
  audit?: Omit<AuditInput, "request" | "requestId" | "result">,
) {
  // ใช้ requestId ที่ proxy ส่งมา ไม่มีก็สร้างเอง ผู้ใช้จะได้อ้างอิงรหัสนี้เวลาแจ้งปัญหา
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  // บันทึกเฉพาะคำขอที่เปลี่ยนข้อมูล การอ่านเฉย ๆ ไม่ต้องบันทึก ไม่งั้น log จะท่วม
  if (request.method !== "GET" && request.method !== "HEAD") {
    const context = getRequestActorContext(request);
    const recordSuccess = () => writeAuditLogSafely({
      userId: context.userId,
      propertyId: context.propertyId,
      action: `API_${request.method}_SUCCESS`,
      targetType: request.nextUrl.pathname.slice(0, 120),
      ...audit,
      request,
      requestId,
      result: "SUCCESS",
    });
    try {
      after(recordSuccess);
    } catch {
      void recordSuccess();
    }
  }
  const headers = new Headers(init.headers);
  headers.set("x-request-id", requestId);
  return new NextResponse(body, { ...init, headers });
}

// ตอบกลับตอนพลาด แปลงข้อผิดพลาดทุกแบบเป็นคำตอบที่ปลอดภัย ไม่หลุดรายละเอียดภายในระบบ
export function apiErrorResponse(error: unknown, request?: NextRequest) {
  const requestId = request?.headers.get("x-request-id") ?? crypto.randomUUID();
  // ข้อมูลไม่ผ่านการตรวจเป็น 400 ที่เราโยนเองใช้รหัสที่ระบุไว้ ที่เหลือคือ 500
  const status = error instanceof ZodError ? 400 : error instanceof ApiError ? error.status : 500;
  if (request && request.method !== "GET" && request.method !== "HEAD") {
    const context = getRequestActorContext(request);
    // คำขอที่พลาดตั้งแต่ก่อนตรวจสิทธิ์จะยังไม่มี propertyId ใน context จึงลองดึงจาก URL แทน
    const pathPropertyId = request.nextUrl.pathname.match(/\/properties\/([^/]+)/)?.[1];
    const recordFailure = async () => {
      let propertyId = context.propertyId;
      if (!propertyId && pathPropertyId && context.userId) {
        const { getDatabase } = await import("@/lib/server/db");
        const user = await getDatabase().user.findUnique({
          where: { id: context.userId },
          select: {
            role: true,
            memberships: { where: { propertyId: pathPropertyId }, select: { propertyId: true } },
          },
        }).catch(() => null);
        // แต่ใช้ได้ต่อเมื่อผู้ใช้มีสิทธิ์ในหอนั้นจริง ไม่งั้นใครก็ใส่ id หอของคนอื่นให้ไปโผล่ใน log ได้
        if (user?.role === "SUPER_ADMIN" || user?.memberships.length) propertyId = pathPropertyId;
      }
      await writeAuditLogSafely({
        request,
        requestId,
        userId: context.userId,
        propertyId,
        action: `API_${request.method}_FAILURE`,
        targetType: request.nextUrl.pathname.slice(0, 120),
        result: "FAILURE",
      });
    };
    try {
      after(recordFailure);
    } catch {
      // การทดสอบที่เรียก route ตรง ๆ ไม่มีขอบเขตคำขอของ Next ให้ after ใช้ จึงเขียนทันทีแทน
      void recordFailure();
    }
  }
  // ข้อผิดพลาดที่ไม่คาดคิดเท่านั้นที่เขียนลง log ของระบบ ส่วนที่เราตั้งใจโยนเป็นเรื่องปกติ
  if (!(error instanceof ZodError) && !(error instanceof ApiError)) {
    console.error(JSON.stringify({ level: "error", event: "api_failed", requestId, message: error instanceof Error ? error.message : "Unknown error" }));
  }
  const headers = { "x-request-id": requestId };
  // บอกได้ว่าช่องไหนผิด เพราะเป็นข้อมูลที่ผู้ใช้กรอกมาเองอยู่แล้ว ไม่ใช่ความลับของระบบ
  if (error instanceof ZodError) return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง", requestId, issues: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })) }, { status, headers });
  if (error instanceof ApiError) return NextResponse.json({ error: error.message, requestId }, { status, headers });
  // ข้อผิดพลาดที่ไม่คาดคิดตอบข้อความกลาง ๆ ไม่ส่ง stack trace หรือข้อความจากฐานข้อมูลออกไป
  return NextResponse.json({ error: "ไม่สามารถดำเนินการได้", requestId }, { status, headers });
}
