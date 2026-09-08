/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นโค้ดฝั่งเซิร์ฟเวอร์สำหรับ “api” ซึ่งอาจแตะฐานข้อมูล session ไฟล์ หรือความลับของระบบ
 * การทำงาน: ถูกเรียกจาก Server Component หรือ API route เพื่อทำ use case จริง ตรวจสิทธิ์และกฎธุรกิจก่อนอ่านหรือเปลี่ยนข้อมูล และไม่ควรถูก import ไปยัง Client Component
 */

import { after, NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { writeAuditLogSafely } from "@/lib/server/audit";
import { getRequestActorContext } from "@/lib/server/request-context";
import type { AuditInput } from "@/lib/server/audit";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตรวจเงื่อนไขของ “assert Same Origin” และหยุดด้วยข้อผิดพลาดที่เหมาะสมเมื่อไม่ผ่าน
 * รับค่า:
 * - request: คำขอ HTTP ซึ่งมี URL, header, cookie และข้อมูลจากผู้ใช้
 * - expectedContentType: ค่า “expected Content Type” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
 */
export function assertSameOrigin(
  request: NextRequest,
  expectedContentType: string | null = "application/json",
) {
  const origin = request.headers.get("origin");
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",", 1)[0]?.trim();
  const requestHost = forwardedHost || request.headers.get("host") || request.nextUrl.host;
  let originHost = "";
  try {
    originHost = origin ? new URL(origin).host : "";
  } catch {
    // Invalid origins are rejected by the host comparison below.
  }
  const acceptedHosts = new Set([requestHost, request.nextUrl.host]);
  if (!originHost || !acceptedHosts.has(originHost)) throw new ApiError(403, "Request origin is not allowed");
  if (expectedContentType && request.headers.get("content-type")?.split(";", 1)[0] !== expectedContentType) {
    throw new ApiError(415, `Content-Type must be ${expectedContentType}`);
  }
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คลาส “Api Error” รวมข้อมูลและพฤติกรรมที่ต้องทำงานร่วมกันเป็นออบเจ็กต์เดียว
 */
export class ApiError extends Error {
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: เตรียมค่าเริ่มต้นเมื่อสร้างออบเจ็กต์ api
   * รับค่า:
   * - status: ค่า “status” ที่จำเป็นต่อการทำงานของก้อนนี้
   * - message: ค่า “message” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: ไม่มีค่าคืน; ผลคือออบเจ็กต์หรือสถานะภายในได้รับการตั้งค่า
   */
  constructor(readonly status: number, message: string) { super(message); }
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “api Success Response” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - request: คำขอ HTTP ซึ่งมี URL, header, cookie และข้อมูลจากผู้ใช้
 * - body: ค่า “body” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - init: ค่า “init” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - audit: ค่า “audit” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export function apiSuccessResponse(
  request: NextRequest,
  body: Record<string, unknown>,
  init?: { status?: number; headers?: HeadersInit },
  audit?: Omit<AuditInput, "request" | "requestId" | "result">,
) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  if (request.method !== "GET" && request.method !== "HEAD") {
    const context = getRequestActorContext(request);
    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: รวมขั้นตอนย่อยของ “record Success” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
     * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
     * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
     */
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
  const headers = new Headers(init?.headers);
  headers.set("x-request-id", requestId);
  return NextResponse.json({ ...body, requestId }, { ...init, headers });
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “api Success Binary Response” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - request: คำขอ HTTP ซึ่งมี URL, header, cookie และข้อมูลจากผู้ใช้
 * - body: ค่า “body” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - init: ค่า “init” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - audit: ค่า “audit” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export function apiSuccessBinaryResponse(
  request: NextRequest,
  body: BodyInit | null,
  init: ResponseInit,
  audit?: Omit<AuditInput, "request" | "requestId" | "result">,
) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  if (request.method !== "GET" && request.method !== "HEAD") {
    const context = getRequestActorContext(request);
    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: รวมขั้นตอนย่อยของ “record Success” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
     * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
     * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
     */
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

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “api Error Response” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - error: ข้อผิดพลาดที่ต้องแปลง บันทึก หรือแสดงอย่างปลอดภัย
 * - request: คำขอ HTTP ซึ่งมี URL, header, cookie และข้อมูลจากผู้ใช้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export function apiErrorResponse(error: unknown, request?: NextRequest) {
  const requestId = request?.headers.get("x-request-id") ?? crypto.randomUUID();
  const status = error instanceof ZodError ? 400 : error instanceof ApiError ? error.status : 500;
  if (request && request.method !== "GET" && request.method !== "HEAD") {
    const context = getRequestActorContext(request);
    const pathPropertyId = request.nextUrl.pathname.match(/\/properties\/([^/]+)/)?.[1];
    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: รวมขั้นตอนย่อยของ “record Failure” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
     * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
     * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
     */
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
      // Direct route-handler tests do not provide Next.js request scope.
      void recordFailure();
    }
  }
  if (!(error instanceof ZodError) && !(error instanceof ApiError)) {
    console.error(JSON.stringify({ level: "error", event: "api_failed", requestId, message: error instanceof Error ? error.message : "Unknown error" }));
  }
  const headers = { "x-request-id": requestId };
  if (error instanceof ZodError) return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง", requestId, issues: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })) }, { status, headers });
  if (error instanceof ApiError) return NextResponse.json({ error: error.message, requestId }, { status, headers });
  return NextResponse.json({ error: "ไม่สามารถดำเนินการได้", requestId }, { status, headers });
}
