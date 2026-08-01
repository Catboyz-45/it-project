import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { currentSession } from "@/server/auth/session";
import { createAdmin } from "@/server/auth/admin-users";
import { assertSameOrigin } from "@/server/security/request";
import { requestContext } from "@/server/security/request";
import { audit } from "@/server/auth/audit";
const schema = z.object({ username: z.string().trim().min(3).max(64).regex(/^[a-zA-Z0-9._-]+$/), displayName: z.string().trim().min(1).max(120), role: z.enum(["EDITOR", "SUPER_ADMIN"]) }).strict();
async function superAdmin() { const session = await currentSession(); return session?.twoFactorAt && session.admin.role === "SUPER_ADMIN" ? session : null; }
export async function GET() { const session = await superAdmin(); if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 }); const users = await db.admin.findMany({ where: { deletedAt: null }, select: { id: true, username: true, displayName: true, role: true, isActive: true, twoFactorEnabled: true, createdAt: true }, orderBy: { createdAt: "asc" } }); return NextResponse.json({ users }); }
export async function POST(request: NextRequest) { if (!assertSameOrigin(request)) return NextResponse.json({ error: "Invalid request" }, { status: 403 }); const session = await superAdmin(); const parsed = schema.safeParse(await request.json().catch(() => null)); if (!session || !parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: session ? 400 : 403 }); const result = await createAdmin(parsed.data); await audit({ actorId: session.adminId, action: "ADMIN_CREATED", targetType: "Admin", targetId: result.user.id, result: "SUCCESS", ...requestContext(request) }); return NextResponse.json({ user: { id: result.user.id, username: result.user.username, displayName: result.user.displayName, role: result.user.role }, temporaryPassword: result.temporaryPassword }, { status: 201, headers: { "Cache-Control": "no-store" } }); }
