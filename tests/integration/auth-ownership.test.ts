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

// สร้างคำขอปลอมพร้อมคุกกี้เซสชัน ใช้เรียกฟังก์ชันตรวจสิทธิ์ได้โดยไม่ต้องเปิดเบราว์เซอร์
// ไม่ส่ง token มาก็ได้คำขอที่ไม่มีคุกกี้ ใช้ทดสอบกรณีที่ยังไม่ล็อกอิน
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
  // สมัครแล้วยังไม่ได้รับอนุมัติต้องเข้าระบบไม่ได้ ถึงจะมีเซสชันอยู่ในมือก็ตาม
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
    // มีคุกกี้จริงแต่ยังไม่อนุมัติ ต้องได้ null การเช็คสถานะอนุมัติอยู่ตอนอ่านเซสชัน ไม่ใช่แค่ตอนล็อกอิน
    expect(await getRequestAuth(requestWithToken(before.cookies.get(sessionCookieName)?.value))).toBeNull();

    const approved = await reviewPropertyAdminAccount(pending.id, fixture.superAdmin.id, { status: "APPROVED" });
    expect(approved.approvalStatus).toBe("APPROVED");
    const after = NextResponse.json({ ok: true });
    await createSession(pending.id, after);
    expect(await getRequestAuth(requestWithToken(after.cookies.get(sessionCookieName)?.value)))
      .toMatchObject({ userId: pending.id, role: "PROPERTY_ADMIN" });
    // อนุมัติไปแล้วจะกลับมาปฏิเสธไม่ได้ ต้องได้ 409 กันการกดซ้ำหรือกดสวนกัน
    await expect(reviewPropertyAdminAccount(pending.id, fixture.superAdmin.id, { status: "REJECTED", rejectionReason: "duplicate" }))
      .rejects.toMatchObject({ status: 409 });
  });

  // เรียก route จริงทั้งเส้น ไม่ได้ mock จึงเช็คได้ถึงธงของคุกกี้ที่เซิร์ฟเวอร์ตั้งจริง
  it("logs in through the real route, sets a secure cookie, and revokes it on logout", async () => {
    if (!fixture) throw new Error("Fixture was not initialized");
    const loginRequest = new NextRequest("http://localhost/api/auth/login", {
      method: "POST",
      // ต้องมี origin ตรงกันและ content-type เป็น JSON ไม่งั้นด่านกัน CSRF จะปฏิเสธก่อน
      // ตั้ง IP ต่างกันในแต่ละเทสต์ จะได้ไม่ไปใช้โควตาการจำกัดจำนวนครั้งของกันและกัน
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
    // HttpOnly ทำให้ JavaScript อ่านคุกกี้ไม่ได้ ส่วน SameSite=lax กันเว็บอื่นยิงคำขอพร้อมคุกกี้
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
    // ออกจากระบบแล้วโทเคนเดิมต้องใช้ไม่ได้ทันที เพราะแถวในฐานข้อมูลถูกลบ ไม่ใช่แค่ลบคุกกี้ในเบราว์เซอร์
    expect(await getRequestAuth(requestWithToken(session?.value))).toBeNull();
  });

  // สองเรื่องในเทสต์เดียว ข้อความผิดพลาดต้องกลาง ๆ และคำขอจากเว็บอื่นต้องถูกปฏิเสธ
  it("returns generic login failures and rejects cross-origin requests", async () => {
    if (!fixture) throw new Error("Fixture was not initialized");
    const invalid = await login(new NextRequest("http://localhost/api/auth/login", {
      method: "POST",
      headers: { origin: "http://localhost", "content-type": "application/json", "x-forwarded-for": "127.0.0.43" },
      body: JSON.stringify({ email: fixture.owner.email, password: "wrong-password" }),
    }));
    expect(invalid.status).toBe(401);
    expect(await invalid.json()).toEqual(expect.objectContaining({
      // ข้อความเดียวกันทั้งกรณีอีเมลไม่มีและรหัสผิด คนเดาจึงแยกไม่ออกว่าอีเมลไหนมีในระบบ
      error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
      requestId: expect.any(String),
    }));

    const crossOrigin = await login(new NextRequest("http://localhost/api/auth/login", {
      method: "POST",
      headers: { origin: "https://attacker.example", "content-type": "application/json" },
      body: JSON.stringify({ email: fixture.owner.email, password: "Integration-Password-123" }),
    }));
    // origin เป็นเว็บอื่นต้องได้ 403 ตั้งแต่ยังไม่ทันตรวจรหัสผ่าน
    expect(crossOrigin.status).toBe(403);
  });

  // รายชื่อหอที่เข้าถึงได้ต้องมาจากฐานข้อมูลทุกครั้ง ไม่ได้ฝังไว้ในคุกกี้
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

  // สี่กรณีที่เซสชันต้องใช้ไม่ได้ ไม่มีคุกกี้ หมดอายุ ถูกเพิกถอน และบัญชีถูกระงับ
  it("rejects missing, expired, revoked, and inactive sessions", async () => {
    if (!fixture) throw new Error("Fixture was not initialized");
    await expect(requireRequestAuth(requestWithToken())).rejects.toMatchObject({ status: 401 });

    const expiredResponse = NextResponse.json({ ok: true });
    await createSession(fixture.otherOwner.id, expiredResponse);
    const expiredToken = expiredResponse.cookies.get(sessionCookieName)?.value;
    await getDatabase().session.updateMany({
      where: { userId: fixture.otherOwner.id },
      // ดันวันหมดอายุไปเป็นอดีต แทนการนั่งรอให้หมดอายุจริง
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
    // ระงับบัญชีแล้วเซสชันที่ออกไปก่อนหน้าต้องใช้ไม่ได้ทันที ไม่ต้องรอหมดอายุ
    await getDatabase().user.update({ where: { id: fixture.otherOwner.id }, data: { isActive: false } });
    expect(await getRequestAuth(requestWithToken(inactiveToken))).toBeNull();
  });
});

describe("record ownership integration", () => {
  // ตาราง PropertyMembership เป็นตัวตัดสินเพียงอย่างเดียว เพิ่มหรือถอนสิทธิ์แล้วต้องมีผลในคำขอถัดไปเลย
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
    // เทียบด้วย Set เพราะลำดับที่ฐานข้อมูลคืนมาไม่รับประกัน
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

  // เข้าหอของคนอื่นต้องได้ 404 ไม่ใช่ 403 เพราะ 403 เท่ากับยืนยันว่าหอรหัสนี้มีอยู่จริง
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

  // ซูเปอร์แอดมินเข้าได้ทุกหอ แม้ propertyIds จะว่าง เพราะตัดสินจากบทบาทไม่ใช่จากรายชื่อหอ
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
