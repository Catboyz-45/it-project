/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นการทดสอบอัตโนมัติของ “auth ownership.test” เพื่อป้องกันพฤติกรรมสำคัญย้อนกลับไปเสีย
 * การทำงาน: เตรียมสถานการณ์ เรียกโค้ดเหมือนผู้ใช้หรือระบบจริง แล้วตรวจผลลัพธ์ทั้งกรณีสำเร็จและกรณีที่ต้องปฏิเสธ
 */

import { NextRequest, NextResponse } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import {
  createSession,
  getRequestAuth,
  requirePropertyAccess,
  requireRequestAuth,
  revokeSession,
  sessionCookieName,
} from "@/lib/server/auth";
import { ApiError } from "@/lib/server/api";
import { reviewPropertyAdminAccount } from "@/lib/server/account-approval";
import { getDatabase } from "@/lib/server/db";
import { cleanupIntegrationFixture, createIntegrationFixture } from "./helpers";

let fixture: Awaited<ReturnType<typeof createIntegrationFixture>> | undefined;
let approvalUserId = "";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “request With Token” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - token: ค่า “token” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
 */
const requestWithToken = (token?: string) => new NextRequest("http://localhost/api/v1/plans", {
  headers: token ? { cookie: `${sessionCookieName}=${token}` } : {},
});

beforeAll(async () => {
  fixture = await createIntegrationFixture();
});

afterAll(async () => {
  if (!fixture) return;
  await cleanupIntegrationFixture({
    propertyIds: [fixture.property.id, fixture.otherProperty.id],
    userIds: [approvalUserId, fixture.owner.id, fixture.otherOwner.id, fixture.superAdmin.id].filter(Boolean),
  });
  await getDatabase().$disconnect();
});

describe("authentication integration", () => {
  it("blocks a pending owner until Super Admin approves the account", async () => {
    if (!fixture) throw new Error("Fixture was not initialized");
    const pending = await getDatabase().user.create({
      data: {
        email: `pending-${fixture.suffix}@example.test`,
        passwordHash: fixture.owner.passwordHash,
        displayName: "Pending Owner",
        role: "PROPERTY_ADMIN",
        approvalStatus: "PENDING",
      },
    });
    approvalUserId = pending.id;
    const before = NextResponse.json({ ok: true });
    await createSession(pending.id, before);
    expect(await getRequestAuth(requestWithToken(before.cookies.get(sessionCookieName)?.value))).toBeNull();

    const approved = await reviewPropertyAdminAccount(pending.id, fixture.superAdmin.id, { status: "APPROVED" });
    expect(approved.approvalStatus).toBe("APPROVED");
    const after = NextResponse.json({ ok: true });
    await createSession(pending.id, after);
    expect(await getRequestAuth(requestWithToken(after.cookies.get(sessionCookieName)?.value)))
      .toMatchObject({ userId: pending.id, role: "PROPERTY_ADMIN" });
    await expect(reviewPropertyAdminAccount(pending.id, fixture.superAdmin.id, { status: "REJECTED", rejectionReason: "duplicate" }))
      .rejects.toMatchObject({ status: 409 });
  });

  it("logs in through the real route, sets a secure cookie, and revokes it on logout", async () => {
    if (!fixture) throw new Error("Fixture was not initialized");
    const loginRequest = new NextRequest("http://localhost/api/auth/login", {
      method: "POST",
      headers: { origin: "http://localhost", "content-type": "application/json", "x-forwarded-for": "127.0.0.42" },
      body: JSON.stringify({ email: fixture.owner.email, password: "Integration-Password-123" }),
    });
    const loginResponse = await login(loginRequest);
    expect(loginResponse.status).toBe(200);
    expect(await loginResponse.json()).toEqual(expect.objectContaining({
      redirectTo: "/admin",
      requestId: expect.any(String),
    }));
    const session = loginResponse.cookies.get(sessionCookieName);
    expect(session).toMatchObject({ httpOnly: true, sameSite: "lax" });

    const logoutRequest = new NextRequest("http://localhost/api/auth/logout", {
      method: "POST",
      headers: {
        origin: "http://localhost", "content-type": "application/json",
        cookie: `${sessionCookieName}=${session?.value}`,
      },
      body: "{}",
    });
    const logoutResponse = await logout(logoutRequest);
    expect(logoutResponse.status).toBe(200);
    expect(await getRequestAuth(requestWithToken(session?.value))).toBeNull();
  });

  it("returns generic login failures and rejects cross-origin requests", async () => {
    if (!fixture) throw new Error("Fixture was not initialized");
    const invalid = await login(new NextRequest("http://localhost/api/auth/login", {
      method: "POST",
      headers: { origin: "http://localhost", "content-type": "application/json", "x-forwarded-for": "127.0.0.43" },
      body: JSON.stringify({ email: fixture.owner.email, password: "wrong-password" }),
    }));
    expect(invalid.status).toBe(401);
    expect(await invalid.json()).toEqual(expect.objectContaining({
      error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
      requestId: expect.any(String),
    }));

    const crossOrigin = await login(new NextRequest("http://localhost/api/auth/login", {
      method: "POST",
      headers: { origin: "https://attacker.example", "content-type": "application/json" },
      body: JSON.stringify({ email: fixture.owner.email, password: "Integration-Password-123" }),
    }));
    expect(crossOrigin.status).toBe(403);
  });

  it("creates an HttpOnly session and resolves memberships from PostgreSQL", async () => {
    if (!fixture) throw new Error("Fixture was not initialized");
    const response = NextResponse.json({ ok: true });
    await createSession(fixture.owner.id, response);
    const cookie = response.cookies.get(sessionCookieName);
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("lax");

    const auth = await getRequestAuth(requestWithToken(cookie?.value));
    expect(auth).toMatchObject({
      userId: fixture.owner.id,
      role: "PROPERTY_ADMIN",
      propertyIds: [fixture.property.id],
    });
  });

  it("rejects missing, expired, revoked, and inactive sessions", async () => {
    if (!fixture) throw new Error("Fixture was not initialized");
    await expect(requireRequestAuth(requestWithToken())).rejects.toMatchObject({ status: 401 });

    const expiredResponse = NextResponse.json({ ok: true });
    await createSession(fixture.otherOwner.id, expiredResponse);
    const expiredToken = expiredResponse.cookies.get(sessionCookieName)?.value;
    await getDatabase().session.updateMany({
      where: { userId: fixture.otherOwner.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(await getRequestAuth(requestWithToken(expiredToken))).toBeNull();

    const revokedResponse = NextResponse.json({ ok: true });
    await createSession(fixture.owner.id, revokedResponse);
    const revokedToken = revokedResponse.cookies.get(sessionCookieName)?.value;
    await revokeSession(requestWithToken(revokedToken), NextResponse.json({ ok: true }));
    expect(await getRequestAuth(requestWithToken(revokedToken))).toBeNull();

    const inactiveResponse = NextResponse.json({ ok: true });
    await createSession(fixture.otherOwner.id, inactiveResponse);
    const inactiveToken = inactiveResponse.cookies.get(sessionCookieName)?.value;
    await getDatabase().user.update({ where: { id: fixture.otherOwner.id }, data: { isActive: false } });
    expect(await getRequestAuth(requestWithToken(inactiveToken))).toBeNull();
  });
});

describe("record ownership integration", () => {
  it("uses PropertyMembership as the only scope and reflects membership changes on the next request", async () => {
    if (!fixture) throw new Error("Fixture was not initialized");
    const response = NextResponse.json({ ok: true });
    await createSession(fixture.owner.id, response);
    const token = response.cookies.get(sessionCookieName)?.value;

    expect((await getRequestAuth(requestWithToken(token)))?.propertyIds)
      .toEqual([fixture.property.id]);

    await getDatabase().propertyMembership.create({
      data: { userId: fixture.owner.id, propertyId: fixture.otherProperty.id },
    });
    expect(new Set((await getRequestAuth(requestWithToken(token)))?.propertyIds))
      .toEqual(new Set([fixture.property.id, fixture.otherProperty.id]));

    await getDatabase().propertyMembership.delete({
      where: {
        userId_propertyId: {
          userId: fixture.owner.id,
          propertyId: fixture.otherProperty.id,
        },
      },
    });
    expect((await getRequestAuth(requestWithToken(token)))?.propertyIds)
      .toEqual([fixture.property.id]);
  });

  it("allows an owner only their property and intentionally returns 404 for another property", () => {
    if (!fixture) throw new Error("Fixture was not initialized");
    const current = fixture;
    const ownerAuth = {
      userId: current.owner.id, email: current.owner.email, displayName: current.owner.displayName,
      role: "PROPERTY_ADMIN" as const, propertyIds: [current.property.id],
    };
    expect(() => requirePropertyAccess(ownerAuth, current.property.id)).not.toThrow();
    expect(() => requirePropertyAccess(ownerAuth, current.otherProperty.id)).toThrowError(ApiError);
    try {
      requirePropertyAccess(ownerAuth, current.otherProperty.id);
    } catch (error) {
      expect(error).toMatchObject({ status: 404 });
    }
  });

  it("allows Super Admin cross-property access", () => {
    if (!fixture) throw new Error("Fixture was not initialized");
    const current = fixture;
    const auth = {
      userId: current.superAdmin.id, email: current.superAdmin.email, displayName: current.superAdmin.displayName,
      role: "SUPER_ADMIN" as const, propertyIds: [],
    };
    expect(() => requirePropertyAccess(auth, current.property.id)).not.toThrow();
    expect(() => requirePropertyAccess(auth, current.otherProperty.id)).not.toThrow();
  });
});
