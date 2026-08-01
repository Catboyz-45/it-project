import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { getSessionByToken, SESSION_COOKIE, sessionCookieOptions } from "@/server/auth/session";
import { assertSameOrigin } from "@/server/security/request";
export async function POST(request: NextRequest) { if (!assertSameOrigin(request)) return NextResponse.json({ error: "Invalid request" }, { status: 403 }); const session = await getSessionByToken(request.cookies.get(SESSION_COOKIE)?.value); if (session) await db.session.update({ where: { id: session.id }, data: { revokedAt: new Date(), revokeReason: "LOGOUT" } }); const response = NextResponse.json({ next: "/login" }); response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions, maxAge: 0 }); return response; }
