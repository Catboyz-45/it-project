import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createSession, sessionCookieName } from "@/lib/server/auth";
import { ensureTenantConversation } from "@/lib/server/chat";
import { getDatabase } from "@/lib/server/db";
import { generateInvoice, issueInvoice } from "@/lib/server/invoices";
import { recordMeterReading } from "@/lib/server/meters";
import { createTenantTicket } from "@/lib/server/property-operations";
import { createInvitation, registerTenant, reviewOccupancy } from "@/lib/server/tenant-onboarding";
import { cleanupIntegrationFixture, createIntegrationFixture } from "./helpers";

// เทสต์กวาดทุก route ใน app/api ทีละเส้น ไม่ต้องเขียนรายชื่อเอง route ใหม่ที่เพิ่มเข้ามาจะถูกตรวจทันที
// ตรวจสามเรื่องที่ทุกเส้นต้องทำได้เหมือนกัน
// 1. ไม่ได้ล็อกอินต้องถูกปฏิเสธ (ปฏิเสธเป็นค่าเริ่มต้น)
// 2. ล็อกอินผิดบทบาทต้องถูกปฏิเสธ
// 3. ล็อกอินถูกบทบาทแต่ส่งข้อมูลว่างหรือ id ที่ไม่มีอยู่ ต้องได้คำตอบที่จัดการแล้ว ไม่ใช่ 500

type Handler = (request: NextRequest, context: { params: Promise<Record<string, string>> }) => Promise<Response>;
type RouteModule = Partial<Record<(typeof methods)[number], Handler>>;
// anyUser คือเส้นที่ใช้ได้ทุกบทบาทที่ล็อกอินแล้ว เช่นแก้ข้อมูลบัญชีของตัวเอง
type Role = "owner" | "tenant" | "superAdmin" | "anyUser" | "public";
type SignedInRole = Exclude<Role, "public" | "anyUser">;

const methods = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
const routeModules = import.meta.glob<RouteModule>("/app/api/**/route.ts");

// งานตามกำหนดเวลาตอบ 503 ถ้ายังไม่ได้ตั้งรหัสลับไว้ ตั้งค่าทดสอบไว้ให้มันไปถึงด่านตรวจรหัสจริง
process.env.JOB_SECRET ??= `route-sweep-${randomUUID()}-${randomUUID()}`;

let fixture: Awaited<ReturnType<typeof createIntegrationFixture>> | undefined;
let planId = "";
let tenantUserId = "";
const cookies: Record<SignedInRole, string> = { owner: "", tenant: "", superAdmin: "" };
// id จริงของข้อมูลที่สร้างไว้ ใช้เติมใน path ของคำขอ GET เพื่อให้วิ่งลึกถึงชั้น service
const knownIds: Record<string, string> = {};

// แปลงพาธไฟล์เป็น URL และรายชื่อพารามิเตอร์ เช่น [propertyId] กลายเป็นค่าที่ใช้เรียกจริง
function describeRoute(file: string) {
  const segments = file.replace(/^\/app/, "").replace(/\/route\.ts$/, "").split("/");
  const paramNames = segments
    .filter((segment) => segment.startsWith("[") && segment.endsWith("]"))
    .map((segment) => segment.slice(1, -1));
  return { path: segments.join("/"), paramNames };
}

// public คือเส้นที่ตั้งใจเปิดให้เรียกได้โดยไม่ล็อกอิน เช่นหน้าเข้าสู่ระบบ สมัคร และตรวจสุขภาพระบบ
function roleFor(path: string): Role {
  if (/^\/api\/(auth|health)\b/.test(path)) return "public";
  if (path === "/api/v1/plans" || path === "/api/v1/tenant/register" || path === "/api/internal/jobs/maintenance") return "public";
  if (/^\/api\/(account|legal)\b/.test(path)) return "anyUser";
  if (path.includes("/super-admin")) return "superAdmin";
  if (path.startsWith("/api/v1/tenant/")) return "tenant";
  return "owner";
}

// บทบาทอื่นที่ต้องเข้าไม่ได้ ใช้ตรวจว่าแต่ละกลุ่ม route ไม่ยอมรับบทบาทที่ไม่ใช่ของตัวเอง
const wrongRoleFor: Record<SignedInRole, SignedInRole> = {
  owner: "tenant",
  tenant: "owner",
  superAdmin: "owner",
};

function paramsFor(paramNames: string[], useKnownIds: boolean) {
  const params: Record<string, string> = {};
  for (const name of paramNames) {
    params[name] = name === "propertyId" ? fixture!.property.id : (useKnownIds && knownIds[name]) || randomUUID();
  }
  return params;
}

let ipCounter = 0;
// สุ่มส่วนต้นของ IP ทุกครั้งที่รัน แถวโควตาในฐานข้อมูลอยู่ได้หนึ่งชั่วโมง รันซ้ำเร็ว ๆ จะได้ไม่ชนของรอบก่อน
const ipPrefix = `10.${Math.floor(Math.random() * 200) + 20}`;
// IP คนละค่าทุกคำขอ จะได้ไม่ไปชนโควตาจำกัดจำนวนครั้งของกันและกัน
function requestFor(path: string, params: Record<string, string>, method: string, cookie?: string) {
  let url = `http://localhost${path}`;
  for (const [name, value] of Object.entries(params)) url = url.replace(`[${name}]`, value);
  ipCounter += 1;
  const headers: Record<string, string> = {
    origin: "http://localhost",
    host: "localhost",
    "content-type": "application/json",
    "x-forwarded-for": `${ipPrefix}.${Math.floor(ipCounter / 250)}.${ipCounter % 250}`,
  };
  if (cookie) headers.cookie = `${sessionCookieName}=${cookie}`;
  return new NextRequest(url, {
    method,
    headers,
    ...(method === "GET" ? {} : { body: "{}" }),
  });
}

async function call(file: string, method: (typeof methods)[number], cookie: string | undefined, useKnownIds: boolean) {
  const handler = (await routeModules[file]())[method]!;
  const { path, paramNames } = describeRoute(file);
  const params = paramsFor(paramNames, useKnownIds);
  let response: Response;
  try {
    response = await handler(requestFor(path, params, method, cookie), { params: Promise.resolve(params) });
  } catch {
    // route ที่ปล่อย error หลุดออกมา Next จะตอบเป็น 500 จึงนับเป็น 500 ให้เห็นในผลเทสต์
    return 500;
  }
  // ปิด body ทุกครั้ง โดยเฉพาะ route แบบ stream ที่จะค้างเปิดไว้ถ้าไม่มีคนอ่าน
  await response.body?.cancel().catch(() => undefined);
  return response.status;
}

async function sessionCookieFor(userId: string) {
  const response = NextResponse.json({ ok: true });
  await createSession(userId, response);
  const token = response.cookies.get(sessionCookieName)?.value;
  if (!token) throw new Error("Failed to create a session for the integration test");
  return token;
}

// รายการ route กับเมท็อดทั้งหมด โหลดครั้งเดียวแล้วใช้ร่วมกันทุกเทสต์
async function listOperations() {
  const operations: Array<{ file: string; method: (typeof methods)[number]; role: Role }> = [];
  for (const file of Object.keys(routeModules).sort()) {
    const loaded = await routeModules[file]();
    const role = roleFor(describeRoute(file).path);
    for (const method of methods) if (typeof loaded[method] === "function") operations.push({ file, method, role });
  }
  return operations;
}

let operations: Awaited<ReturnType<typeof listOperations>> = [];

beforeAll(async () => {
  fixture = await createIntegrationFixture();
  const plan = await getDatabase().saasPlan.create({
    data: {
      code: `SWEEP_${fixture.suffix.toUpperCase()}`,
      name: "Route sweep plan",
      monthlyPrice: 990,
      maxProperties: 1,
      maxRooms: 100,
      allowFileUploads: true,
    },
  });
  planId = plan.id;
  await getDatabase().propertySubscription.create({
    data: {
      propertyId: fixture.property.id,
      planId: plan.id,
      planName: plan.name,
      status: "ACTIVE",
      maxProperties: 1,
      maxRooms: 100,
      startsAt: new Date(Date.now() - 86_400_000),
      expiresAt: new Date(Date.now() + 30 * 86_400_000),
    },
  });

  const invitation = await createInvitation(fixture.property.id, fixture.owner.id, {
    roomId: fixture.room.id, intendedRole: "PRIMARY", expiresInDays: 7,
  });
  const registration = await registerTenant({
    invitationCode: invitation.invitationCode,
    email: `sweep-tenant-${fixture.suffix}@example.test`,
    password: "Tenant-Password-123",
    displayName: "Sweep Tenant",
    phone: "0812224444",
    termsAccepted: true,
    privacyAcknowledged: true,
    marketingConsent: false,
  });
  tenantUserId = registration.userId;
  await reviewOccupancy(fixture.property.id, registration.occupancy.id, fixture.owner.id, { status: "ACTIVE" });
  const profile = await getDatabase().tenantProfile.findUniqueOrThrow({ where: { userId: tenantUserId } });

  await recordMeterReading(fixture.property.id, fixture.owner.id, {
    roomId: fixture.room.id, type: "WATER", billingMonth: "2026-08", previousReading: 100, currentReading: 106,
  });
  await recordMeterReading(fixture.property.id, fixture.owner.id, {
    roomId: fixture.room.id, type: "ELECTRICITY", billingMonth: "2026-08", previousReading: 1000, currentReading: 1070,
  });
  const draft = await generateInvoice(fixture.property.id, {
    roomId: fixture.room.id, billingMonth: "2026-08", issueImmediately: false,
  });
  const invoice = await issueInvoice(fixture.property.id, draft.id, draft.version);
  const ticket = await createTenantTicket({
    propertyId: fixture.property.id, roomId: fixture.room.id, tenantProfileId: profile.id, userId: tenantUserId,
    data: { type: "REPAIR", title: "Sweep ticket", detail: "Door", priority: "NORMAL", isAnonymous: false },
  });
  const conversation = await ensureTenantConversation({
    propertyId: fixture.property.id, tenantProfileId: profile.id, tenantName: "Sweep Tenant", roomNumber: fixture.room.number,
  });

  Object.assign(knownIds, {
    roomId: fixture.room.id,
    buildingId: fixture.building.id,
    floorId: fixture.floor.id,
    invoiceId: invoice.id,
    ticketId: ticket.id,
    conversationId: conversation.id,
    tenantProfileId: profile.id,
    occupancyId: registration.occupancy.id,
    invitationId: invitation.invitation.id,
    userId: fixture.owner.id,
    planId: plan.id,
  });

  [cookies.owner, cookies.tenant, cookies.superAdmin] = await Promise.all([
    sessionCookieFor(fixture.owner.id),
    sessionCookieFor(tenantUserId),
    sessionCookieFor(fixture.superAdmin.id),
  ]);
  operations = await listOperations();
}, 120_000);

afterAll(async () => {
  if (fixture) {
    await cleanupIntegrationFixture({
      propertyIds: [fixture.property.id, fixture.otherProperty.id],
      userIds: [tenantUserId, fixture.owner.id, fixture.otherOwner.id, fixture.superAdmin.id].filter(Boolean),
    });
  }
  if (planId) await getDatabase().saasPlan.deleteMany({ where: { id: planId } });
  await getDatabase().$disconnect();
});

describe("API route sweep", () => {
  it("finds every route handler", () => {
    // กันกรณี glob ไม่เจออะไรเลยแล้วเทสต์ข้างล่างผ่านแบบว่างเปล่า
    expect(operations.length).toBeGreaterThan(100);
  });

  it("refuses anonymous requests on every protected route", async () => {
    const leaks: string[] = [];
    for (const { file, method, role } of operations) {
      if (role === "public") continue;
      const status = await call(file, method, undefined, false);
      // 404 นับว่าปฏิเสธด้วย เพราะบางเส้นตั้งใจตอบว่าไม่พบ เพื่อไม่บอกว่าข้อมูลมีอยู่จริง
      // 400 ก็นับ เพราะบางเส้นตรวจรูปแบบ id ก่อนตรวจสิทธิ์ ซึ่งยังไม่แตะข้อมูลใด ๆ
      if (![400, 401, 403, 404].includes(status)) leaks.push(`${method} ${file} -> ${status}`);
    }
    expect(leaks).toEqual([]);
  }, 300_000);

  it("refuses a signed-in user of the wrong role", async () => {
    const leaks: string[] = [];
    for (const { file, method, role } of operations) {
      if (role === "public" || role === "anyUser") continue;
      const status = await call(file, method, cookies[wrongRoleFor[role]], false);
      if (status < 400 || status >= 500) leaks.push(`${method} ${file} -> ${status}`);
    }
    expect(leaks).toEqual([]);
  }, 300_000);

  it("answers every route without a server error for an empty body or unknown id", async () => {
    const failures: string[] = [];
    for (const { file, method, role } of operations) {
      const cookie = role === "public" ? undefined : cookies[role === "anyUser" ? "owner" : role];
      // อ่านด้วย id จริง จะได้วิ่งผ่าน service จนจบ ส่วนคำขอเขียนใช้ id สุ่ม ไม่ให้ไปแก้หรือลบข้อมูลตั้งต้น
      const status = await call(file, method, cookie, method === "GET");
      if (status >= 500) failures.push(`${method} ${file} -> ${status}`);
    }
    expect(failures).toEqual([]);
  }, 300_000);
});
