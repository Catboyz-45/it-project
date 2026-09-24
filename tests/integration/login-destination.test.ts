import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST as login } from "@/app/api/auth/login/route";
import { getDatabase } from "@/lib/server/db";
import { hashPassword } from "@/lib/server/password";
import { sessionCookieName } from "@/lib/server/auth";
import { cleanupIntegrationFixture, createIntegrationFixture } from "./helpers";

let fixture: Awaited<ReturnType<typeof createIntegrationFixture>> | undefined;
const createdUserIds: string[] = [];
const password = "Correct-Password-123";

// แต่ละเทสต์ใช้ ip คนละตัว ไม่งั้นด่านกันเดารหัสจะนับรวมกันแล้วกั้นเทสต์ถัดไป
let ipCounter = 0;

type UserShape = {
  role: "PROPERTY_ADMIN" | "SUPER_ADMIN" | "TENANT";
  approvalStatus?: "PENDING" | "APPROVED" | "REJECTED";
  isActive?: boolean;
  mustChangePassword?: boolean;
};

async function makeUser(label: string, shape: UserShape) {
  if (!fixture) throw new Error("Fixture was not initialized");
  const user = await getDatabase().user.create({
    data: {
      email: `dest-${label}-${fixture.suffix}@example.com`,
      displayName: `ผู้ใช้ ${label}`,
      passwordHash: await hashPassword(password),
      approvalStatus: "APPROVED",
      ...shape,
    },
    select: { id: true, email: true },
  });
  createdUserIds.push(user.id);
  return user;
}

async function loginAs(email: string) {
  ipCounter += 1;
  return login(new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    headers: {
      origin: "http://localhost",
      "content-type": "application/json",
      "x-forwarded-for": `198.51.100.${ipCounter}`,
    },
    body: JSON.stringify({ email, password }),
  }));
}

beforeAll(async () => {
  fixture = await createIntegrationFixture();
});

afterAll(async () => {
  if (!fixture) return;
  await getDatabase().user.deleteMany({ where: { id: { in: createdUserIds } } });
  await cleanupIntegrationFixture({
    propertyIds: [fixture.property.id, fixture.otherProperty.id],
    userIds: [fixture.owner.id, fixture.otherOwner.id, fixture.superAdmin.id],
  });
  await getDatabase().$disconnect();
});

// เซิร์ฟเวอร์เป็นคนตัดสินว่าจะพาไปหน้าไหนหลังเข้าระบบ ไม่ใช่ฝั่งเบราว์เซอร์
// เพราะการตัดสินนี้คือด่านที่บังคับให้เปลี่ยนรหัสและยอมรับข้อตกลงก่อนใช้งาน
describe("where login sends each user", () => {
  it("sends a password change ahead of everything else", async () => {
    const user = await makeUser("mustchange", { role: "PROPERTY_ADMIN", mustChangePassword: true });
    const response = await loginAs(user.email);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ redirectTo: "/change-password" });
  });

  it("asks for the policies before letting an owner in", async () => {
    const user = await makeUser("policies", { role: "PROPERTY_ADMIN" });
    const response = await loginAs(user.email);
    expect(await response.json()).toMatchObject({ redirectTo: "/legal/accept" });
  });

  it("sends a super admin to their own area", async () => {
    const user = await makeUser("superadmin", { role: "SUPER_ADMIN" });
    const response = await loginAs(user.email);
    // ผู้ดูแลระบบไม่ต้องผ่านหน้ายอมรับข้อตกลงของผู้เช่าและเจ้าของหอ
    const body = await response.json() as { redirectTo: string };
    expect(["/super-admin", "/legal/accept"]).toContain(body.redirectTo);
  });

  it("issues a session cookie that is not readable by scripts", async () => {
    const user = await makeUser("cookie", { role: "PROPERTY_ADMIN" });
    const response = await loginAs(user.email);
    const cookie = response.cookies.get(sessionCookieName);
    expect(cookie?.value).toBeTruthy();
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBeTruthy();
  });

  // บัญชีที่ยังไม่อนุมัติหรือถูกปิด ต้องได้ข้อความเดียวกับรหัสผ่านผิด
  // ไม่งั้นคนเดาจะรู้ว่าอีเมลนี้มีอยู่จริงในระบบ
  it("keeps the message identical for wrong password, pending and disabled accounts", async () => {
    const pending = await makeUser("pending", { role: "PROPERTY_ADMIN", approvalStatus: "PENDING" });
    const disabled = await makeUser("disabled", { role: "PROPERTY_ADMIN", isActive: false });
    const good = await makeUser("wrongpass", { role: "PROPERTY_ADMIN" });

    const messages: string[] = [];
    for (const email of [pending.email, disabled.email]) {
      const response = await loginAs(email);
      expect(response.status).toBe(401);
      messages.push(((await response.json()) as { error: string }).error);
    }

    ipCounter += 1;
    const wrongPassword = await login(new NextRequest("http://localhost/api/auth/login", {
      method: "POST",
      headers: { origin: "http://localhost", "content-type": "application/json", "x-forwarded-for": `198.51.100.${ipCounter}` },
      body: JSON.stringify({ email: good.email, password: "Definitely-Wrong-123" }),
    }));
    expect(wrongPassword.status).toBe(401);
    messages.push(((await wrongPassword.json()) as { error: string }).error);

    expect(new Set(messages).size).toBe(1);
  });

  it("rejects a cross-origin login attempt", async () => {
    const user = await makeUser("crossorigin", { role: "PROPERTY_ADMIN" });
    const response = await login(new NextRequest("http://localhost/api/auth/login", {
      method: "POST",
      headers: { origin: "http://evil.test", "content-type": "application/json" },
      body: JSON.stringify({ email: user.email, password }),
    }));
    expect(response.status).toBe(403);
  });
});
