import { NextRequest, NextResponse } from "next/server";
import { currentSession } from "@/server/auth/session";
import { resetAdminTwoFactor } from "@/server/auth/admin-users";
import { assertSameOrigin } from "@/server/security/request";
import { requestContext } from "@/server/security/request";
import { audit } from "@/server/auth/audit";
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { if (!assertSameOrigin(request)) return NextResponse.json({ error: "Invalid request" }, { status: 403 }); const session = await currentSession(); if (!session?.twoFactorAt || session.admin.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 }); const id = (await params).id; await resetAdminTwoFactor(id); await audit({ actorId: session.adminId, action: "ADMIN_TWO_FACTOR_RESET", targetType: "Admin", targetId: id, result: "SUCCESS", ...requestContext(request) }); return NextResponse.json({ success: true }); }
