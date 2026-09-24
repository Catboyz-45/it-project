import { NextRequest, NextResponse } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET as search } from "@/app/api/v1/admin/properties/[propertyId]/search/route";
import { createSession, sessionCookieName } from "@/lib/server/auth";
import { getDatabase } from "@/lib/server/db";
import { cleanupIntegrationFixture, createIntegrationFixture } from "./helpers";

let fixture: Awaited<ReturnType<typeof createIntegrationFixture>> | undefined;
let ownerCookie = "";
let otherOwnerCookie = "";
let tenantUserId = "";

type SearchResult = { id: string; type: string; title: string; subtitle: string; href: string };

async function sessionCookieFor(userId: string) {
  const response = NextResponse.json({ ok: true });
  await createSession(userId, response);
  const token = response.cookies.get(sessionCookieName)?.value;
  if (!token) throw new Error("Failed to create a session for the integration test");
  return token;
}

function searchRequest(propertyId: string, query: string, cookie: string) {
  const url = `http://localhost/api/v1/admin/properties/${propertyId}/search?query=${encodeURIComponent(query)}`;
  return search(
    new NextRequest(url, { headers: { cookie: `${sessionCookieName}=${cookie}` } }),
    { params: Promise.resolve({ propertyId }) },
  );
}

async function resultsOf(response: Response) {
  const payload = await response.json() as { data?: SearchResult[] };
  return payload.data ?? [];
}

beforeAll(async () => {
  fixture = await createIntegrationFixture();
  ownerCookie = await sessionCookieFor(fixture.owner.id);
  otherOwnerCookie = await sessionCookieFor(fixture.otherOwner.id);

  const tenant = await getDatabase().user.create({
    data: {
      email: `searchable-${fixture.suffix}@example.com`,
      displayName: "สมชาย ค้นหาได้",
      role: "TENANT",
      approvalStatus: "APPROVED",
      passwordHash: "x",
      tenantProfile: { create: { phone: "0873334444" } },
    },
    select: { id: true, tenantProfile: { select: { id: true } } },
  });
  tenantUserId = tenant.id;
  await getDatabase().roomOccupancy.create({
    data: {
      propertyId: fixture.property.id,
      roomId: fixture.room.id,
      tenantProfileId: tenant.tenantProfile!.id,
      role: "PRIMARY",
      status: "ACTIVE",
    },
  });
});

afterAll(async () => {
  if (!fixture) return;
  await cleanupIntegrationFixture({
    propertyIds: [fixture.property.id, fixture.otherProperty.id],
    userIds: [tenantUserId, fixture.owner.id, fixture.otherOwner.id, fixture.superAdmin.id].filter(Boolean),
  });
  await getDatabase().$disconnect();
});

describe("owner global search", () => {
  it("finds a tenant by name and says which room they are in", async () => {
    if (!fixture) throw new Error("Fixture was not initialized");
    const results = await resultsOf(await searchRequest(fixture.property.id, "สมชาย", ownerCookie));
    const tenant = results.find((item) => item.type === "tenant");
    expect(tenant?.title).toBe("สมชาย ค้นหาได้");
    // ผู้เช่าที่มีห้องต้องขึ้นเลขห้องนำหน้าเบอร์โทร
    expect(tenant?.subtitle).toContain(fixture.room.number);
    expect(tenant?.subtitle).toContain("0873334444");
  });

  it("finds a tenant by phone number", async () => {
    if (!fixture) throw new Error("Fixture was not initialized");
    const results = await resultsOf(await searchRequest(fixture.property.id, "0873334444", ownerCookie));
    expect(results.some((item) => item.type === "tenant")).toBe(true);
  });

  it("finds a room by its number", async () => {
    if (!fixture) throw new Error("Fixture was not initialized");
    const results = await resultsOf(await searchRequest(fixture.property.id, fixture.room.number, ownerCookie));
    expect(results.some((item) => item.type === "room")).toBe(true);
  });

  // คำค้นสั้นกว่าสองตัวจะกวาดมาทั้งหอ จึงต้องถูกปฏิเสธที่เซิร์ฟเวอร์ ไม่ใช่กันแค่ฝั่งหน้าจอ
  it("refuses a query shorter than two characters", async () => {
    if (!fixture) throw new Error("Fixture was not initialized");
    const response = await searchRequest(fixture.property.id, "ก", ownerCookie);
    expect(response.status).toBeGreaterThanOrEqual(400);
  });

  // ผลค้นหาต้องไม่ข้ามหอ เจ้าของหออื่นขอค้นในหอนี้ต้องถูกปฏิเสธ
  it("does not let another owner search this property", async () => {
    if (!fixture) throw new Error("Fixture was not initialized");
    const response = await searchRequest(fixture.property.id, "สมชาย", otherOwnerCookie);
    expect(response.status).toBeGreaterThanOrEqual(403);
  });

  it("rejects a request with no session", async () => {
    if (!fixture) throw new Error("Fixture was not initialized");
    const response = await searchRequest(fixture.property.id, "สมชาย", "not-a-real-token");
    expect(response.status).toBe(401);
  });
});
