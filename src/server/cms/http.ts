import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { currentSession } from "@/server/auth/session";
import { assertSameOrigin } from "@/server/security/request";
import { CmsError } from "./errors";
import { errorDetails, log } from "@/server/observability/logger";
import { randomUUID } from "node:crypto";

export async function cmsSession() {
  const session = await currentSession();
  return session?.twoFactorAt && !session.admin.mustChangePassword && session.admin.twoFactorEnabled ? session : null;
}
export function validMutation(request: NextRequest) { return assertSameOrigin(request) && request.headers.get("content-type")?.startsWith("application/json") === true; }
export function cmsError(error: unknown, requestId?: string) {
  if (error instanceof ZodError) return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง", fields: error.flatten().fieldErrors }, { status: 400 });
  if (error instanceof CmsError) return NextResponse.json({ error: error.message }, { status: error.code === "NOT_FOUND" ? 404 : error.code === "FORBIDDEN" ? 403 : 409 });
  if (error instanceof Error && error.message === "MEDIA_IN_USE") return NextResponse.json({ error: "ไฟล์นี้ยังถูกใช้งานโดยเนื้อหา จึงยังลบไม่ได้" }, { status: 409 });
  if (error instanceof Error && ["UPLOAD_NOT_AVAILABLE", "INVALID_UPLOAD_METADATA", "INVALID_FILE_SIGNATURE", "INVALID_IMAGE"].includes(error.message)) return NextResponse.json({ error: "ไฟล์ไม่ถูกต้อง หมดเวลา หรือไม่สามารถประมวลผลได้" }, { status: 422 });
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return NextResponse.json({ error: "ชื่อ, slug หรือข้อมูลอ้างอิงนี้ซ้ำกับรายการเดิม" }, { status: 409 });
  if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2003", "P2014"].includes(error.code)) return NextResponse.json({ error: "ข้อมูลอ้างอิงไม่ถูกต้องหรือรายการนี้ยังถูกใช้งานอยู่" }, { status: 409 });
  const correlationId = requestId ?? randomUUID();
  log("error", "cms_request_failed", { requestId: correlationId, ...errorDetails(error) });
  return NextResponse.json({ error: "ไม่สามารถดำเนินการได้", requestId: correlationId }, { status: 500, headers: { "x-request-id": correlationId, "Cache-Control": "no-store" } });
}
