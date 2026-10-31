import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getStorageAdapter } from "@/lib/documents/storage";
import { getDatabase } from "@/lib/server/db";
import { createWorkspaceFixture } from "./helpers";
import { callApi } from "./route-client";

// งานประจำเดือนของหอผ่าน API จริงทั้งสองฝั่ง
// เจ้าของหอจดมิเตอร์ ออกบิล ตรวจสลิป ส่วนผู้เช่าเห็นบิล ส่งสลิป แจ้งซ่อม และรับพัสดุ

let w: Awaited<ReturnType<typeof createWorkspaceFixture>>;
let base = "";
const owner = () => ({ cookie: w.cookies.owner });
const tenant = () => ({ cookie: w.cookies.tenant });
const billingMonth = "2026-09";
const nextMonth = "2026-10";

// ไบต์หัวไฟล์ PNG จริง ให้ตัวตรวจลายเซ็นไฟล์ยอมรับ
const pngFile = (name = "slip.png") => new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13])], name, { type: "image/png" });
const formWith = (fields: Record<string, string | File>) => {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  return form;
};

beforeAll(async () => {
  w = await createWorkspaceFixture("BILLING_API");
  base = `/api/v1/admin/properties/${w.property.id}`;
}, 60_000);

afterAll(async () => {
  if (!w) return;
  // ไฟล์ที่อัปโหลดอยู่นอกฐานข้อมูล ต้องตามไปลบเอง
  const propertyId = w.property.id;
  const [slips, parcels, attachments] = await Promise.all([
    getDatabase().paymentSubmission.findMany({ where: { propertyId }, select: { slipStorageKey: true } }),
    getDatabase().parcel.findMany({ where: { propertyId }, select: { imageStorageKey: true } }),
    getDatabase().ticketAttachment.findMany({ where: { ticket: { propertyId } }, select: { storageKey: true } }),
  ]);
  const keys = [...slips.map((row) => row.slipStorageKey), ...parcels.map((row) => row.imageStorageKey), ...attachments.map((row) => row.storageKey)];
  await Promise.all(keys.filter(Boolean).map((key) => getStorageAdapter().delete(key!).catch(() => undefined)));
  await w.cleanup();
  await getDatabase().$disconnect();
});

describe("meters and invoices", () => {
  let invoiceId = "";
  let version = 0;

  it("records water one room at a time and electricity in bulk, then reads the worksheet", async () => {
    const worksheet = await callApi("GET", `${base}/meter-readings/worksheet?billingMonth=${billingMonth}&type=WATER`, owner());
    expect(worksheet.status).toBe(200);

    const water = await callApi("POST", `${base}/meter-readings`, {
      ...owner(), body: { roomId: w.room.id, type: "WATER", billingMonth, previousReading: 10, currentReading: 18 },
    });
    expect(water.status).toBe(201);
    // เลขล่าสุดน้อยกว่าครั้งก่อนต้องไม่ผ่าน
    expect((await callApi("POST", `${base}/meter-readings`, {
      ...owner(), body: { roomId: w.room.id, type: "WATER", billingMonth, previousReading: 20, currentReading: 18 },
    })).status).toBe(400);

    const bulk = await callApi("POST", `${base}/meter-readings/bulk`, {
      ...owner(), body: { readings: [{ roomId: w.room.id, type: "ELECTRICITY", billingMonth, previousReading: 100, currentReading: 160 }] },
    });
    expect(bulk.status).toBe(201);
    const duplicate = { roomId: w.room.id, type: "ELECTRICITY", billingMonth, currentReading: 170 };
    expect((await callApi("POST", `${base}/meter-readings/bulk`, { ...owner(), body: { readings: [duplicate, duplicate] } })).status).toBe(400);

    expect((await callApi("GET", `${base}/meter-readings?billingMonth=${billingMonth}`, owner())).status).toBe(200);
    expect((await callApi("GET", `${base}/meter-readings/worksheet?billingMonth=${billingMonth}&type=GAS`, owner())).status).toBe(400);
  });

  it("checks readiness, creates a draft invoice, and issues it", async () => {
    const preflight = await callApi("GET", `${base}/invoices/preflight?billingMonth=${billingMonth}&roomId=${w.room.id}`, owner());
    expect(preflight.status).toBe(200);

    const draft = await callApi("POST", `${base}/invoices`, { ...owner(), body: { roomId: w.room.id, billingMonth } });
    expect(draft.status).toBe(201);
    invoiceId = draft.json.data.id;
    version = draft.json.data.version;
    expect(draft.json.data.status).toBe("DRAFT");
    // ห้องเดียวกันเดือนเดียวกันออกบิลซ้ำไม่ได้
    expect((await callApi("POST", `${base}/invoices`, { ...owner(), body: { roomId: w.room.id, billingMonth } })).status).toBe(409);

    // version เก่าแปลว่ามีคนแก้ไปก่อนแล้ว ต้องถูกปฏิเสธ
    expect((await callApi("PATCH", `${base}/invoices/${invoiceId}`, { ...owner(), body: { version: version + 5 } })).status).toBe(409);
    const issued = await callApi("PATCH", `${base}/invoices/${invoiceId}`, { ...owner(), body: { version } });
    expect(issued.status).toBe(200);
    expect(issued.json.data.status).toBe("PENDING");

    const list = await callApi("GET", `${base}/invoices?billingMonth=${billingMonth}&status=PENDING&query=${encodeURIComponent(w.room.number)}`, owner());
    expect(list.status).toBe(200);
    expect(list.json.data.map((invoice: { id: string }) => invoice.id)).toContain(invoiceId);
  });

  it("shows the bill to the tenant with a PromptPay QR code", async () => {
    const list = await callApi("GET", "/api/v1/tenant/invoices", tenant());
    expect(list.status).toBe(200);
    expect((await callApi("GET", "/api/v1/tenant/invoices?view=history", tenant())).status).toBe(200);
    expect((await callApi("GET", "/api/v1/tenant/invoices?view=nope", tenant())).status).toBe(400);
    expect((await callApi("GET", `/api/v1/tenant/invoices/${invoiceId}`, tenant())).status).toBe(200);
    const qr = await callApi("GET", `/api/v1/tenant/invoices/${invoiceId}/promptpay-qr`, tenant());
    expect(qr.status).toBe(200);
    const svg = await callApi("GET", `/api/v1/tenant/invoices/${invoiceId}/promptpay-qr?format=svg`, tenant());
    expect(svg.status).toBe(200);
  });

  // บัญชีธนาคารที่เจ้าของหอตั้งไว้ ผู้เช่าเห็นคู่กับ QR ในหน้าชำระบิล
  it("shows the tenant the dorm's bank account for the bill", async () => {
    const settings = {
      address: "กรุงเทพฯ", contactPhone: "021234567", waterUnitRate: 18, electricityUnitRate: 7.5,
      billingDay: 1, dueDay: 5, lateFeePerDay: 0, invoicePrefix: "INV", promptPayId: "0812345678",
      bankName: "ไทยพาณิชย์", bankAccountNumber: "987-6-54321-0", bankAccountName: "หอทดสอบ",
    };
    // กรอกบัญชีไม่ครบชุดต้องถูกปฏิเสธ ผู้เช่าจะได้ไม่เห็นบัญชีที่โอนไม่ได้จริง
    expect((await callApi("PUT", `${base}/settings`, { ...owner(), body: { ...settings, bankAccountName: null } })).status).toBe(400);
    expect((await callApi("PUT", `${base}/settings`, { ...owner(), body: settings })).status).toBe(200);
    const account = await callApi("GET", `/api/v1/tenant/invoices/${invoiceId}/payment-account`, tenant());
    expect(account.status).toBe(200);
    expect(account.json.data).toEqual({ bankName: "ไทยพาณิชย์", bankAccountNumber: "9876543210", bankAccountName: "หอทดสอบ" });
    expect((await callApi("GET", `/api/v1/tenant/invoices/${invoiceId}/payment-account`, owner())).status).toBe(403);
  });

  it("lets the tenant send a slip and the owner approve it, which marks the bill paid", async () => {
    const paymentPath = `/api/v1/tenant/invoices/${invoiceId}/payment-submissions`;
    // ไฟล์ที่ไม่ใช่รูปหรือ PDF ต้องถูกปฏิเสธ ไม่ว่าชื่อไฟล์จะบอกว่าอะไร
    const fake = new File([new TextEncoder().encode("<script>")], "slip.png", { type: "image/png" });
    expect((await callApi("POST", paymentPath, { ...tenant(), form: formWith({ file: fake }) })).status).toBe(415);
    expect((await callApi("POST", paymentPath, { ...tenant(), form: formWith({ note: "no file" }) })).status).toBe(400);

    const sent = await callApi("POST", paymentPath, { ...tenant(), form: formWith({ file: pngFile() }) });
    expect(sent.status).toBe(201);
    const paymentId = sent.json.data.id;
    expect((await callApi("GET", paymentPath, tenant())).json.data).toHaveLength(1);

    const pending = await callApi("GET", `${base}/payment-submissions?status=PENDING_REVIEW`, owner());
    expect(pending.json.data.map((payment: { id: string }) => payment.id)).toContain(paymentId);
    const slip = await callApi("GET", `${base}/payment-submissions/${paymentId}/slip`, owner());
    expect(slip.status).toBe(200);
    expect(slip.headers.get("content-type")).toBe("image/png");

    expect((await callApi("PATCH", `${base}/payment-submissions/${paymentId}`, { ...owner(), body: { status: "REJECTED" } })).status).toBe(400);
    const approved = await callApi("PATCH", `${base}/payment-submissions/${paymentId}`, { ...owner(), body: { status: "APPROVED" } });
    expect(approved.status).toBe(200);
    const invoice = await getDatabase().invoice.findUniqueOrThrow({ where: { id: invoiceId }, select: { status: true } });
    expect(invoice.status).toBe("PAID");
    // ตรวจไปแล้วตรวจซ้ำไม่ได้ ระบบหาเฉพาะรายการที่ยังรอตรวจ จึงตอบว่าไม่พบ
    expect((await callApi("PATCH", `${base}/payment-submissions/${paymentId}`, { ...owner(), body: { status: "APPROVED" } })).status).toBe(404);
  });

  it("creates the next month in bulk, cancels a draft with a reason, and recalculates overdue bills", async () => {
    await callApi("POST", `${base}/meter-readings/bulk`, {
      ...owner(),
      body: {
        readings: [
          { roomId: w.room.id, type: "WATER", billingMonth: nextMonth, previousReading: 18, currentReading: 25 },
          { roomId: w.room.id, type: "ELECTRICITY", billingMonth: nextMonth, previousReading: 160, currentReading: 210 },
        ],
      },
    });
    const bulk = await callApi("POST", `${base}/invoices/bulk`, { ...owner(), body: { billingMonth: nextMonth } });
    expect(bulk.status).toBe(201);
    const draft = await getDatabase().invoice.findFirstOrThrow({
      where: { propertyId: w.property.id, roomId: w.room.id, status: "DRAFT" },
      select: { id: true, version: true },
    });
    const cancelPath = `${base}/invoices/${draft.id}`;
    expect((await callApi("PATCH", cancelPath, { ...owner(), body: { action: "cancel", version: draft.version, reason: "x" } })).status).toBe(400);
    const cancelled = await callApi("PATCH", cancelPath, { ...owner(), body: { action: "cancel", version: draft.version, reason: "ออกบิลผิดเดือน" } });
    expect(cancelled.status).toBe(200);
    expect(cancelled.json.data.status).toBe("CANCELLED");

    const recalculated = await callApi("POST", `${base}/invoices/recalculate-overdue`, { ...owner(), body: { asOf: "2027-01-01" } });
    expect(recalculated.status).toBe(200);
  });

  it("exports invoices and tenants as CSV", async () => {
    const invoices = await callApi("GET", `${base}/exports/invoices?billingMonth=${billingMonth}&status=PAID`, owner());
    expect(invoices.status).toBe(200);
    expect(invoices.headers.get("content-type")).toContain("text/csv");
    expect(invoices.text).toContain(w.room.number);
    const tenants = await callApi("GET", `${base}/exports/tenants?query=BILLING`, owner());
    expect(tenants.status).toBe(200);
    expect((await callApi("GET", `${base}/exports/rooms`, owner())).status).toBe(400);
    expect((await callApi("GET", `${base}/exports/invoices?status=LOST`, owner())).status).toBe(400);
  });
});

describe("announcements", () => {
  it("publishes an announcement, edits it with a fresh timestamp, and refuses a stale edit", async () => {
    const created = await callApi("POST", `${base}/announcements`, {
      ...owner(), body: { title: "ปิดน้ำ", content: "ปิดน้ำวันเสาร์ 9-12 น.", status: "PUBLISHED" },
    });
    expect(created.status).toBe(201);
    const { id, updatedAt } = created.json.data;
    expect((await callApi("GET", `${base}/announcements`, owner())).status).toBe(200);

    const edited = await callApi("PATCH", `${base}/announcements/${id}`, {
      ...owner(), body: { title: "ปิดน้ำ (เลื่อน)", expectedUpdatedAt: updatedAt },
    });
    expect(edited.status).toBe(200);
    const stale = await callApi("PATCH", `${base}/announcements/${id}`, { ...owner(), body: { title: "ช้าไป", expectedUpdatedAt: updatedAt } });
    expect(stale.status).toBe(409);

    const forTenant = await callApi("GET", "/api/v1/tenant/announcements", tenant());
    expect(forTenant.json.data.map((item: { id: string }) => item.id)).toContain(id);
  });

  it("targets an announcement to specific rooms", async () => {
    const created = await callApi("POST", `${base}/announcements`, {
      ...owner(), body: { title: "เฉพาะห้อง", content: "แจ้งเฉพาะห้องนี้", audience: "ROOM", roomIds: [w.room.id], status: "PUBLISHED" },
    });
    expect(created.status).toBe(201);
  });
});

describe("parcels", () => {
  it("registers a parcel with a photo, shows it to the tenant, and marks it received", async () => {
    const created = await callApi("POST", `${base}/parcels`, {
      ...owner(), form: formWith({ roomId: w.room.id, recipientTenantId: w.tenantProfileId, note: "กล่องใหญ่", file: pngFile("parcel.png") }),
    });
    expect(created.status).toBe(201);
    const parcelId = created.json.data.id;
    expect((await callApi("GET", `${base}/parcels`, owner())).status).toBe(200);
    expect((await callApi("GET", `${base}/parcels/${parcelId}/image`, owner())).status).toBe(200);

    const mine = await callApi("GET", "/api/v1/tenant/parcels", tenant());
    expect(mine.json.data.map((parcel: { id: string }) => parcel.id)).toContain(parcelId);
    expect((await callApi("GET", "/api/v1/tenant/parcels?view=history", tenant())).status).toBe(200);
    expect((await callApi("GET", `/api/v1/tenant/parcels/${parcelId}/image`, tenant())).status).toBe(200);

    const received = await callApi("PATCH", `${base}/parcels/${parcelId}`, {
      ...owner(), body: { status: "RECEIVED", receivedByTenantId: w.tenantProfileId },
    });
    expect(received.status).toBe(200);
    expect((await callApi("PATCH", `${base}/parcels/${parcelId}`, { ...owner(), body: {} })).status).toBe(400);
  });

  it("registers a parcel without a photo", async () => {
    const created = await callApi("POST", `${base}/parcels`, { ...owner(), form: formWith({ roomId: w.room.id }) });
    expect(created.status).toBe(201);
    expect((await callApi("GET", `${base}/parcels/${created.json.data.id}/image`, owner())).status).toBe(404);
  });
});

describe("repair tickets", () => {
  let ticketId = "";

  it("lets the tenant open a ticket with a photo and the owner see it", async () => {
    const created = await callApi("POST", "/api/v1/tenant/tickets", {
      ...tenant(), body: { type: "REPAIR", title: "ก๊อกน้ำรั่ว", detail: "ห้องน้ำ", priority: "URGENT" },
    });
    expect(created.status).toBe(201);
    ticketId = created.json.data.id;
    expect((await callApi("GET", "/api/v1/tenant/tickets", tenant())).status).toBe(200);
    expect((await callApi("GET", "/api/v1/tenant/tickets?view=history", tenant())).status).toBe(200);

    const attached = await callApi("POST", `/api/v1/tenant/tickets/${ticketId}/attachments`, { ...tenant(), form: formWith({ file: pngFile("leak.png") }) });
    expect(attached.status).toBe(201);
    const attachmentId = attached.json.data.id;
    expect((await callApi("GET", `/api/v1/tenant/tickets/${ticketId}/attachments/${attachmentId}`, tenant())).status).toBe(200);
    expect((await callApi("GET", `${base}/tickets/${ticketId}/attachments/${attachmentId}`, owner())).status).toBe(200);

    const list = await callApi("GET", `${base}/tickets?status=OPEN&type=REPAIR`, owner());
    expect(list.json.data.map((ticket: { id: string }) => ticket.id)).toContain(ticketId);
    expect((await callApi("GET", `${base}/tickets?type=NOT_A_TYPE`, owner())).status).toBe(400);
  });

  it("moves the ticket through allowed states only", async () => {
    const path = `${base}/tickets/${ticketId}`;
    expect((await callApi("PATCH", path, { ...owner(), body: { status: "ACKNOWLEDGED" } })).status).toBe(200);
    expect((await callApi("PATCH", path, { ...owner(), body: { status: "OPEN" } })).status).toBe(409);
    expect((await callApi("PATCH", path, { ...owner(), body: { status: "RESOLVED", priority: "NORMAL" } })).status).toBe(200);
  });

  it("exchanges replies between owner and tenant", async () => {
    const ownerReplies = `${base}/tickets/${ticketId}/replies`;
    const tenantReplies = `/api/v1/tenant/tickets/${ticketId}/replies`;
    expect((await callApi("POST", ownerReplies, { ...owner(), body: { body: "ช่างจะเข้าไปพรุ่งนี้" } })).status).toBe(201);
    expect((await callApi("POST", tenantReplies, { ...tenant(), body: { body: "ขอบคุณครับ" } })).status).toBe(201);
    expect((await callApi("POST", tenantReplies, { ...tenant(), body: { body: "  " } })).status).toBe(400);
    const thread = await callApi("GET", ownerReplies, owner());
    expect(thread.json.data).toHaveLength(2);
    expect((await callApi("GET", tenantReplies, tenant())).status).toBe(200);
  });
});

describe("dashboards and notifications", () => {
  it("serves the owner dashboard, summary and unread counts", async () => {
    expect((await callApi("GET", `${base}/dashboard`, owner())).status).toBe(200);
    expect((await callApi("GET", `${base}/dashboard/summary`, owner())).status).toBe(200);
    expect((await callApi("GET", `${base}/notifications/unread`, owner())).status).toBe(200);
  });

  it("serves the tenant home data", async () => {
    for (const path of ["/api/v1/tenant/me", "/api/v1/tenant/room", "/api/v1/tenant/lease", "/api/v1/tenant/notifications/summary"]) {
      expect((await callApi("GET", path, tenant())).status, path).toBeLessThan(500);
    }
    const me = await callApi("PATCH", "/api/v1/tenant/me", {
      ...tenant(), body: { displayName: "ผู้เช่าแก้เอง", phone: "0891234567", address: "", emergencyName: "", emergencyPhone: "" },
    });
    expect(me.status).toBe(200);
    const selected = await callApi("POST", "/api/v1/tenant/occupancy-selection", { ...tenant(), body: { occupancyId: w.occupancyId } });
    expect(selected.status).toBe(200);
    expect((await callApi("POST", "/api/v1/tenant/occupancy-selection", { ...tenant(), body: { occupancyId: w.room.id } })).status).toBe(404);
  });
});
