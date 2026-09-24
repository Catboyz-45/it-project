import { NextRequest, NextResponse } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST as previewDocument } from "@/app/api/documents/preview/route";
import { createSession, sessionCookieName } from "@/lib/server/auth";
import { getDatabase } from "@/lib/server/db";
import { cleanupIntegrationFixture, createIntegrationFixture } from "./helpers";

let fixture: Awaited<ReturnType<typeof createIntegrationFixture>> | undefined;
let ownerCookie = "";

async function sessionCookieFor(userId: string) {
  const response = NextResponse.json({ ok: true });
  await createSession(userId, response);
  const token = response.cookies.get(sessionCookieName)?.value;
  if (!token) throw new Error("Failed to create a session for the integration test");
  return token;
}

// propertyId ส่งผ่าน query string ตามที่ requireRequestProperty รับ
function previewRequest(body: unknown, cookie: string, origin = "http://localhost") {
  const propertyId = fixture?.property.id ?? "";
  return new NextRequest(`http://localhost/api/documents/preview?propertyId=${propertyId}`, {
    method: "POST",
    headers: { origin, cookie: `${sessionCookieName}=${cookie}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  fixture = await createIntegrationFixture();
  ownerCookie = await sessionCookieFor(fixture.owner.id);
});

afterAll(async () => {
  if (!fixture) return;
  await cleanupIntegrationFixture({
    propertyIds: [fixture.property.id, fixture.otherProperty.id],
    userIds: [fixture.owner.id, fixture.otherOwner.id, fixture.superAdmin.id],
  });
  await getDatabase().$disconnect();
});

// ส่ง data มาเองจะข้ามการดึงบิลจริงจากฐานข้อมูล ตัวอย่างจึงสร้างได้โดยไม่ต้องมีบิลอยู่ก่อน
const invoiceData = {
  property_name: "หอทดสอบ",
  room_number: "101",
  tenant_name: "ผู้เช่าทดสอบ",
  reference_id: "INV-0001",
  billing_month: "2026-07",
  rent_amount: 3000,
  water_amount: 100,
  electricity_amount: 250,
  service_amount: 50,
  total_amount: 3400,
};

// ครอบเฉพาะด่านตรวจก่อนถึงขั้นสร้างไฟล์ ส่วนการสร้าง PDF จริงต้องเปิด Chromium ผ่าน
// Puppeteer ซึ่งช้าและขึ้นกับเครื่อง จึงไม่เอาเข้าชุดนี้ให้เทสต์เปราะ
describe("document preview binary response", () => {
  // คำขอข้ามต้นทางต้องถูกปฏิเสธก่อนถึงขั้นสร้างไฟล์ ไม่งั้นเว็บอื่นสั่งให้เราปั่น PDF ได้ฟรี
  it("rejects a cross-origin request", async () => {
    const response = await previewDocument(previewRequest({ kind: "invoice", data: invoiceData }, ownerCookie, "http://evil.test"));
    expect(response.status).toBe(403);
  });

  it("rejects an unknown document kind", async () => {
    const response = await previewDocument(previewRequest({ kind: "NOT_A_REAL_KIND", data: invoiceData }, ownerCookie));
    expect(response.status).toBe(400);
    expect(response.headers.get("content-type")).toContain("application/json");
  });

  // strict schema ปฏิเสธช่องที่ไม่รู้จัก กันการแอบยัดค่าอื่นลงไปในเอกสาร
  it("rejects document data carrying an unknown field", async () => {
    const response = await previewDocument(previewRequest(
      { kind: "invoice", data: { ...invoiceData, secret_note: "แอบใส่" } }, ownerCookie));
    expect(response.status).toBeGreaterThanOrEqual(400);
  });

  // ไม่ส่ง data มาแปลว่าให้ดึงบิลจริง ยังไม่มีบิลก็ต้องบอกให้ไปสร้างก่อน ไม่ใช่พัง
  it("explains that an invoice must exist when no data is supplied", async () => {
    const response = await previewDocument(previewRequest({ kind: "invoice" }, ownerCookie));
    expect(response.status).toBe(409);
  });

  it("rejects a request with no session", async () => {
    const response = await previewDocument(new NextRequest(`http://localhost/api/documents/preview?propertyId=${fixture!.property.id}`, {
      method: "POST",
      headers: { origin: "http://localhost", "content-type": "application/json" },
      body: JSON.stringify({ kind: "invoice", data: invoiceData }),
    }));
    expect(response.status).toBe(401);
  });
});
