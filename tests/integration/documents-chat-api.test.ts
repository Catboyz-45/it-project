import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getStorageAdapter } from "@/lib/documents/storage";
import { getDatabase } from "@/lib/server/db";
import { generateInvoice } from "@/lib/server/invoices";
import { createLease } from "@/lib/server/leases";
import { recordMeterReading } from "@/lib/server/meters";
import { createWorkspaceFixture } from "./helpers";
import { callApi } from "./route-client";

// การสร้าง PDF จริงต้องเปิด Chromium ซึ่งช้าและขึ้นกับเครื่อง จึงแทนด้วย PDF สั้น ๆ
// เทสต์นี้สนใจทุกอย่างรอบ ๆ การสร้างไฟล์ แม่แบบ การตรวจข้อมูล การเก็บไฟล์ และสิทธิ์ดาวน์โหลด
vi.mock("@/lib/documents/pdf", () => ({
  generatePdf: vi.fn(async (html: string) => Buffer.from(`%PDF-1.7\n% ${html.length}\n%%EOF`)),
  browserLaunchOptions: vi.fn(() => ({})),
}));

let w: Awaited<ReturnType<typeof createWorkspaceFixture>>;
const owner = () => ({ cookie: w.cookies.owner });
const tenant = () => ({ cookie: w.cookies.tenant });
const withProperty = (path: string) => `${path}${path.includes("?") ? "&" : "?"}propertyId=${w.property.id}`;
const pngFile = (name = "photo.png") => new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13])], name, { type: "image/png" });

const invoiceData = {
  property_name: "หอทดสอบ", room_number: "101", tenant_name: "ผู้เช่าทดสอบ", reference_id: "INV/0001",
  billing_month: "2026-07", rent_amount: 3000, water_amount: 100, electricity_amount: 250, service_amount: 50, total_amount: 3400,
};
const contractData = {
  property_name: "หอทดสอบ", room_number: "101", tenant_name: "ผู้เช่าทดสอบ", reference_id: "LEASE-0001",
  tenant_phone: "0800000000", tenant_address: "กรุงเทพ", start_date: "2026-01-01", end_date: "2026-12-31",
  rent_amount: 3000, deposit_amount: 6000,
};

beforeAll(async () => {
  w = await createWorkspaceFixture("DOCS_CHAT");
}, 60_000);

afterAll(async () => {
  if (!w) return;
  const propertyIds = [w.property.id, w.otherProperty.id];
  const documents = await getDatabase().generatedDocument.findMany({ where: { propertyId: { in: propertyIds } }, select: { storageKey: true } });
  const attachments = await getDatabase().chatMessage.findMany({ where: { propertyId: { in: propertyIds } }, select: { attachmentKey: true } });
  const keys = [...documents.map((row) => row.storageKey), ...attachments.map((row) => row.attachmentKey)];
  await Promise.all(keys.filter(Boolean).map((key) => getStorageAdapter().delete(key!).catch(() => undefined)));
  await getDatabase().generatedDocument.deleteMany({ where: { propertyId: { in: propertyIds } } });
  await getDatabase().documentTemplate.deleteMany({ where: { propertyId: { in: propertyIds } } });
  await w.cleanup();
  await getDatabase().$disconnect();
});

describe("document templates", () => {
  it("creates the default template on first use and keeps it afterwards", async () => {
    expect((await callApi("GET", withProperty("/api/document-templates/invoice"), owner())).json.template).toBeNull();
    const created = await callApi("POST", withProperty("/api/document-templates/invoice"), owner());
    expect(created.status).toBe(201);
    const again = await callApi("POST", withProperty("/api/document-templates/invoice"), owner());
    expect(again.status).toBe(200);
    expect((await callApi("GET", withProperty("/api/document-templates/unknown-kind"), owner())).status).toBe(404);
  });

  it("saves an edited template with scripts stripped and refuses unknown placeholders", async () => {
    const path = withProperty("/api/document-templates/invoice");
    const saved = await callApi("PUT", path, {
      ...owner(),
      body: { name: "บิลของหอ", html: "<h1>{{property_name}}</h1><p>ห้อง {{room_number}} ยอด {{total_amount}}</p><script>alert(1)</script>" },
    });
    expect(saved.status).toBe(200);
    expect(saved.json.template.html).not.toContain("<script");

    const unknown = await callApi("PUT", path, { ...owner(), body: { name: "บิล", html: "<p>{{secret_field}} และข้อความยาวพอ</p>" } });
    expect(unknown.status).toBe(400);
    const remoteImage = await callApi("PUT", path, { ...owner(), body: { name: "บิล", html: '<p>ข้อความยาวพอสมควร</p><img src="http://evil.test/x.png">' } });
    expect(remoteImage.status).toBe(400);
  });
});

describe("generated documents", () => {
  it("generates a stored PDF that only members of the property can download", async () => {
    const generated = await callApi("POST", withProperty("/api/documents"), { ...owner(), body: { kind: "invoice", data: invoiceData } });
    expect(generated.status).toBe(201);
    const download = await callApi("GET", generated.json.downloadUrl, owner());
    expect(download.status).toBe(200);
    expect(download.headers.get("content-type")).toBe("application/pdf");
    // ชื่อไฟล์มาจากเลขอ้างอิง ตัวอักษรพิเศษต้องถูกแทนก่อนใส่ใน header
    expect(download.headers.get("content-disposition")).toContain('filename="INV-0001.pdf"');

    const otherOwner = await callApi("GET", generated.json.downloadUrl, { cookie: await import("./route-client").then((m) => m.sessionCookieFor(w.otherOwner.id)) });
    // คนนอกหอได้คำตอบว่าไม่พบ ไม่บอกว่าเอกสารนี้มีอยู่จริง
    expect(otherOwner.status).toBe(404);
    expect((await callApi("GET", "/api/documents/not-a-cuid/download", owner())).status).toBe(400);
  });

  it("generates a contract with the default template and rejects bad data", async () => {
    await callApi("POST", withProperty("/api/document-templates/contract"), owner());
    expect((await callApi("POST", withProperty("/api/documents"), { ...owner(), body: { kind: "contract", data: contractData } })).status).toBe(201);
    expect((await callApi("POST", withProperty("/api/documents"), { ...owner(), body: { kind: "receipt", data: invoiceData } })).status).toBe(400);
    expect((await callApi("POST", withProperty("/api/documents"), { ...owner(), body: { kind: "contract", data: invoiceData } })).status).toBe(400);
  });

  it("previews a PDF without storing it", async () => {
    const before = await getDatabase().generatedDocument.count({ where: { propertyId: w.property.id } });
    const preview = await callApi("POST", withProperty("/api/documents/preview"), { ...owner(), body: { kind: "invoice", data: invoiceData } });
    expect(preview.status).toBe(200);
    expect(preview.headers.get("content-type")).toBe("application/pdf");
    expect(await getDatabase().generatedDocument.count({ where: { propertyId: w.property.id } })).toBe(before);
  });
});

describe("previews from real records", () => {
  // ไม่ส่ง data มา แปลว่าให้ดึงสัญญาหรือบิลล่าสุดของหอมาใช้ ยังไม่มีก็ต้องบอกให้สร้างก่อน
  it("asks for a lease or an invoice first, then previews the latest one", async () => {
    const preview = (kind: string) => callApi("POST", withProperty("/api/documents/preview"), { ...owner(), body: { kind } });
    expect((await preview("contract")).status).toBe(409);
    expect((await preview("invoice")).status).toBe(409);

    await createLease(w.property.id, w.owner.id, {
      roomId: w.room.id, startDate: new Date("2026-01-01"), endDate: new Date("2026-12-31"), monthlyRent: 3200, depositAmount: 6400,
    });
    expect((await preview("contract")).status).toBe(200);

    for (const type of ["WATER", "ELECTRICITY"] as const) {
      await recordMeterReading(w.property.id, w.owner.id, { roomId: w.room.id, type, billingMonth: "2026-07", previousReading: 1, currentReading: 9 });
    }
    await generateInvoice(w.property.id, { roomId: w.room.id, billingMonth: "2026-07", issueImmediately: false });
    expect((await preview("invoice")).status).toBe(200);
  });
});

describe("tenant chat", () => {
  it("delivers messages both ways and lists conversations for the owner", async () => {
    const sent = await callApi("POST", "/api/v1/tenant/chat", { ...tenant(), body: { body: "สวัสดีครับ", clientId: randomUUID() } });
    expect(sent.status).toBe(201);
    const conversationId = (await callApi("GET", "/api/v1/tenant/chat?limit=20", tenant())).json.conversationId;

    const inbox = await callApi("GET", `/api/v1/admin/properties/${w.property.id}/tenant-chat`, owner());
    expect(inbox.status).toBe(200);
    const threadPath = `/api/v1/admin/properties/${w.property.id}/tenant-chat/${w.tenantProfileId}`;
    expect((await callApi("POST", threadPath, { ...owner(), body: { body: "สวัสดีค่ะ", clientId: randomUUID() } })).status).toBe(201);
    const thread = await callApi("GET", `${threadPath}?limit=20`, owner());
    expect(thread.json.messages.map((message: { body: string }) => message.body)).toEqual(expect.arrayContaining(["สวัสดีครับ", "สวัสดีค่ะ"]));
    expect((await callApi("GET", `/api/v1/admin/properties/${w.property.id}/tenant-chat/${w.otherOwner.id}`, owner())).status).toBe(404);

    // ส่งไฟล์แนบในห้องสนทนา แล้วทั้งสองฝั่งเปิดดูได้
    const form = new FormData();
    form.append("propertyId", w.property.id);
    form.append("body", "รูปห้อง");
    form.append("clientId", randomUUID());
    form.append("file", pngFile());
    const attached = await callApi("POST", `/api/v1/chat/conversations/${conversationId}/attachments`, {
      ...tenant(), form, headers: { "x-property-id": w.property.id },
    });
    expect(attached.status).toBe(201);
    const messageId = attached.json.message.id;
    expect((await callApi("GET", `/api/v1/chat/messages/${messageId}/attachment?propertyId=${w.property.id}`, owner())).status).toBe(200);
    expect((await callApi("GET", `/api/v1/chat/messages/${messageId}/attachment?propertyId=${w.property.id}`, tenant())).status).toBe(200);

    // สตรีมเปิดได้ด้วยสิทธิ์ที่ถูกต้อง และปิดทันทีเมื่อผู้รับเลิกอ่าน
    const stream = await callApi("GET", `/api/v1/chat/conversations/${conversationId}/stream?propertyId=${w.property.id}`, owner());
    expect(stream.status).toBe(200);
    expect(stream.headers.get("content-type")).toBe("text/event-stream");
  });
});

describe("legacy chat endpoints", () => {
  const tenantFields = () => ({ tenantId: "legacy-tenant-1", tenantName: "ผู้เช่าเก่า", roomNumber: "101" });

  it("sends, lists and attaches through the original owner chat API", async () => {
    const sent = await callApi("POST", withProperty("/api/chat/messages"), { ...owner(), body: { ...tenantFields(), body: "แจ้งเตือน", clientId: randomUUID() } });
    expect(sent.status).toBe(201);
    const list = await callApi("GET", withProperty("/api/chat/messages?tenantId=legacy-tenant-1"), owner());
    expect(list.status).toBe(200);
    expect(list.json.messages.length).toBeGreaterThan(0);
    expect((await callApi("GET", withProperty("/api/chat/messages?tenantId=bad id"), owner())).status).toBe(400);

    const form = new FormData();
    for (const [key, value] of Object.entries({ ...tenantFields(), body: "ไฟล์แนบ", clientId: randomUUID() })) form.append(key, value);
    form.append("file", pngFile());
    const attached = await callApi("POST", withProperty("/api/chat/attachments"), { ...owner(), form });
    expect(attached.status).toBe(201);
    const messageId = attached.json.message.id;
    const file = await callApi("GET", withProperty(`/api/chat/attachments/${messageId}`), owner());
    expect(file.status).toBe(200);
    expect(file.headers.get("content-type")).toBe("image/png");

    const notAnImage = new FormData();
    for (const [key, value] of Object.entries({ ...tenantFields(), body: "", clientId: randomUUID() })) notAnImage.append(key, value);
    notAnImage.append("file", new File([new TextEncoder().encode("MZ executable")], "run.exe"));
    expect((await callApi("POST", withProperty("/api/chat/attachments"), { ...owner(), form: notAnImage })).status).toBe(415);

    const stream = await callApi("GET", withProperty("/api/chat/stream?after=2026-01-01T00:00:00Z"), owner());
    expect(stream.status).toBe(200);
  });
});

describe("legal preferences", () => {
  it("reads preferences and toggles marketing consent", async () => {
    expect((await callApi("GET", "/api/legal/preferences", tenant())).status).toBe(200);
    const on = await callApi("POST", "/api/legal/preferences", { ...tenant(), body: { action: "set-marketing", enabled: true } });
    expect(on.status).toBe(200);
    const accepted = await callApi("POST", "/api/legal/preferences", {
      ...tenant(), body: { action: "accept-required", termsAccepted: true, privacyAcknowledged: true },
    });
    expect(accepted.status).toBe(200);
    expect((await callApi("POST", "/api/legal/preferences", { ...tenant(), body: { action: "accept-required", termsAccepted: false } })).status).toBe(400);
    expect((await callApi("GET", "/api/legal/preferences")).status).toBe(401);
  });
});
