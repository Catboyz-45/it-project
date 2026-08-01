import "server-only";
import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { getAuthEnv } from "@/server/env";
import { keyedHash } from "./crypto";

export function requestContext(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  return { requestId: request.headers.get("x-request-id") || randomUUID(), ipHash: keyedHash(ip), userAgent: request.headers.get("user-agent")?.slice(0, 500) || null };
}
export function assertSameOrigin(request: NextRequest): boolean {
  return isSameOrigin(request.headers.get("origin"), getAuthEnv().APP_URL);
}
export function isSameOrigin(origin: string | null, appUrl: string): boolean {
  if (!origin) return false;
  try { return new URL(origin).origin === new URL(appUrl).origin; } catch { return false; }
}
