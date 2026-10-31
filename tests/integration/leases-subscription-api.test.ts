import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getStorageAdapter } from "@/lib/documents/storage";
import { getDatabase } from "@/lib/server/db";
import { createWorkspaceFixture } from "./helpers";
import { callApi } from "./route-client";

// งานรายตัวที่ยังไม่ครอบด้วยเทสต์อื่น ผ่าน API จริง
// วงจรสัญญาเช่าตั้งแต่ร่างจนลงนามและต่อสัญญา การซื้อแพ็กเกจเอง และงานบำรุงรักษาตามกำหนดเวลา

// งานตามกำหนดเวลาต้องมีรหัสลับอย่างน้อย 32 ตัว ตั้งก่อนที่ route จะถูกโหลด
process.env.JOB_SECRET ??= `lease-subscription-${randomUUID()}-${randomUUID()}`;

let w: Awaited<ReturnType<typeof createWorkspaceFixture>>;
let base = "";
const owner = () => ({ cookie: w.cookies.owner });
const pdfFile = (name = "signed.pdf") => new File([new TextEncoder().encode("%PDF-1.7\nsigned lease\n%%EOF")], name, { type: "application/pdf" });
const pngFile = (name = "slip.png") => new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13])], name, { type: "image/png" });
const formWith = (file: File) => {
  const form = new FormData();
  form.append("file", file);
  return form;
};

beforeAll(async () => {
  w = await createWorkspaceFixture("LEASE_API");
  base = `/api/v1/admin/properties/${w.property.id}`;
}, 60_000);

afterAll(async () => {
  if (!w) return;
  const propertyId = w.property.id;
  const [leases, versions, payments] = await Promise.all([
    getDatabase().lease.findMany({ where: { propertyId }, select: { signedStorageKey: true } }),
    getDatabase().leaseVersion.findMany({ where: { lease: { propertyId } }, select: { signedStorageKey: true } }),
    getDatabase().subscriptionPayment.findMany({ where: { order: { propertyId } }, select: { storageKey: true } }),
  ]);
  const keys = [...leases, ...versions].map((row) => row.signedStorageKey).concat(payments.map((row) => row.storageKey));
  await Promise.all(keys.filter(Boolean).map((key) => getStorageAdapter().delete(key!).catch(() => undefined)));
  await getDatabase().subscriptionPayment.deleteMany({ where: { order: { propertyId } } });
  await getDatabase().subscriptionOrder.deleteMany({ where: { propertyId } });
  await w.cleanup();
  await getDatabase().$disconnect();
});

describe("lease lifecycle", () => {
  let leaseId = "";
  const versionOf = async () => (await callApi("GET", `${base}/leases/${leaseId}`, owner())).json.data.currentVersion as number;

  it("drafts a lease for the room's primary tenant", async () => {
    const created = await callApi("POST", `${base}/leases`, {
      ...owner(), body: { roomId: w.room.id, startDate: "2026-01-01", endDate: "2026-12-31", monthlyRent: 3500, depositAmount: 7000 },
    });
    expect(created.status).toBe(201);
    leaseId = created.json.data.id;
    expect(created.json.data.status).toBe("DRAFT");
    // ร่างหลายฉบับในห้องเดียวกันมีได้ เพราะยังไม่ผูกมัด ร่างที่ไม่ใช้ก็ยกเลิกทิ้ง
    const extra = await callApi("POST", `${base}/leases`, {
      ...owner(), body: { roomId: w.room.id, startDate: "2026-01-01", endDate: "2026-12-31", monthlyRent: 3500 },
    });
    expect(extra.status).toBe(201);
    const cancelled = await callApi("PATCH", `${base}/leases/${extra.json.data.id}`, {
      ...owner(), body: { expectedVersion: extra.json.data.currentVersion, status: "CANCELLED" },
    });
    expect(cancelled.json.data.status).toBe("CANCELLED");
    expect((await callApi("POST", `${base}/leases`, {
      ...owner(), body: { roomId: w.room.id, startDate: "2026-12-31", endDate: "2026-01-01", monthlyRent: 3500 },
    })).status).toBe(400);

    const list = await callApi("GET", `${base}/leases?query=${encodeURIComponent(w.room.number)}`, owner());
    expect(list.json.data.map((lease: { id: string }) => lease.id)).toContain(leaseId);
  });

  it("edits the draft only with the current version", async () => {
    const version = await versionOf();
    const stale = await callApi("PATCH", `${base}/leases/${leaseId}`, { ...owner(), body: { expectedVersion: version + 3, monthlyRent: 3600 } });
    expect(stale.status).toBe(409);
    const edited = await callApi("PATCH", `${base}/leases/${leaseId}`, { ...owner(), body: { expectedVersion: version, monthlyRent: 3600 } });
    expect(edited.status).toBe(200);
    expect(Number(edited.json.data.monthlyRent)).toBe(3600);
  });

  it("requires a signed copy before the lease becomes active", async () => {
    const pending = await callApi("PATCH", `${base}/leases/${leaseId}`, { ...owner(), body: { expectedVersion: await versionOf(), status: "PENDING_SIGNATURE" } });
    expect(pending.status).toBe(200);
    const tooEarly = await callApi("PATCH", `${base}/leases/${leaseId}`, { ...owner(), body: { expectedVersion: await versionOf(), status: "ACTIVE" } });
    expect(tooEarly.status).toBe(409);

    const notPdf = await callApi("POST", `${base}/leases/${leaseId}/signed-document`, { ...owner(), form: formWith(pngFile("lease.pdf")) });
    expect(notPdf.status).toBe(415);
    const uploaded = await callApi("POST", `${base}/leases/${leaseId}/signed-document`, { ...owner(), form: formWith(pdfFile()) });
    expect(uploaded.status).toBe(201);
    const download = await callApi("GET", `${base}/leases/${leaseId}/signed-document`, owner());
    expect(download.status).toBe(200);
    expect(download.headers.get("content-type")).toBe("application/pdf");

    const active = await callApi("PATCH", `${base}/leases/${leaseId}`, { ...owner(), body: { expectedVersion: await versionOf(), status: "ACTIVE" } });
    expect(active.status).toBe(200);
    expect(active.json.data.status).toBe("ACTIVE");
    // ย้อนสถานะที่ไม่อนุญาต
    expect((await callApi("PATCH", `${base}/leases/${leaseId}`, { ...owner(), body: { expectedVersion: await versionOf(), status: "DRAFT" } })).status).toBe(409);
  });

  it("lets the tenant read the active lease and its signed copy", async () => {
    expect((await callApi("GET", "/api/v1/tenant/lease", { cookie: w.cookies.tenant })).status).toBe(200);
    const signed = await callApi("GET", `/api/v1/tenant/lease/signed-document?leaseId=${leaseId}`, { cookie: w.cookies.tenant });
    expect(signed.status).toBe(200);
    expect((await callApi("GET", "/api/v1/tenant/lease/signed-document?leaseId=bad", { cookie: w.cookies.tenant })).status).toBe(404);
  });

  it("renews the active lease into a new draft", async () => {
    const renewed = await callApi("POST", `${base}/leases/${leaseId}/renew`, {
      ...owner(), body: { startDate: "2027-01-01", endDate: "2027-12-31", monthlyRent: 3800, depositAmount: 7000 },
    });
    expect(renewed.status).toBe(201);
    expect(renewed.json.data.id).not.toBe(leaseId);
    // ต่อซ้ำทั้งที่มีฉบับต่ออายุที่ยังไม่จบอยู่แล้วไม่ได้
    expect((await callApi("POST", `${base}/leases/${leaseId}/renew`, {
      ...owner(), body: { startDate: "2027-01-01", endDate: "2027-12-31", monthlyRent: 3800 },
    })).status).toBe(409);
  });
});

describe("self-service subscription orders", () => {
  it("orders a plan, uploads the transfer slip, and gets activated by Super Admin", async () => {
    expect((await callApi("GET", `${base}/subscription-orders`, owner())).status).toBe(200);
    const ordered = await callApi("POST", `${base}/subscription-orders`, { ...owner(), body: { planId: "plan_growth", billingInterval: "YEARLY" } });
    expect(ordered.status).toBe(201);
    const orderId = ordered.json.data.id;
    expect((await callApi("POST", `${base}/subscription-orders`, { ...owner(), body: { planId: "plan_missing" } })).status).toBeGreaterThanOrEqual(400);

    const paymentPath = `${base}/subscription-orders/${orderId}/payments`;
    expect((await callApi("POST", paymentPath, { ...owner(), form: formWith(new File([new TextEncoder().encode("nope")], "x.png")) })).status).toBe(415);
    const paid = await callApi("POST", paymentPath, { ...owner(), form: formWith(pngFile()) });
    expect(paid.status).toBe(201);
    const paymentId = paid.json.data.id;

    const admin = { cookie: w.cookies.superAdmin };
    const queue = await callApi("GET", "/api/v1/super-admin/subscription-payments", admin);
    expect(queue.json.data.map((payment: { id: string }) => payment.id)).toContain(paymentId);
    const slip = await callApi("GET", `/api/v1/super-admin/subscription-payments/${paymentId}/slip`, admin);
    expect(slip.status).toBe(200);
    expect(slip.headers.get("content-type")).toBe("image/png");

    const approved = await callApi("PATCH", `/api/v1/super-admin/subscription-payments/${paymentId}`, { ...admin, body: { status: "APPROVED" } });
    expect(approved.status).toBe(200);
    const subscription = await getDatabase().propertySubscription.findUniqueOrThrow({
      where: { propertyId: w.property.id }, select: { planId: true, billingInterval: true },
    });
    expect(subscription).toMatchObject({ planId: "plan_growth", billingInterval: "YEARLY" });
  });

  it("rejects a slip with a reason", async () => {
    const ordered = await callApi("POST", `${base}/subscription-orders`, { ...owner(), body: { planId: "plan_starter" } });
    expect(ordered.status).toBe(201);
    const paid = await callApi("POST", `${base}/subscription-orders/${ordered.json.data.id}/payments`, { ...owner(), form: formWith(pngFile()) });
    const admin = { cookie: w.cookies.superAdmin };
    const path = `/api/v1/super-admin/subscription-payments/${paid.json.data.id}`;
    expect((await callApi("PATCH", path, { ...admin, body: { status: "REJECTED" } })).status).toBe(400);
    expect((await callApi("PATCH", path, { ...admin, body: { status: "REJECTED", rejectionNote: "ยอดไม่ตรง" } })).status).toBe(200);
  });

  // หน้าตรวจค่าสมาชิกกรองตามสถานะ สรุปยอดเดือนนี้ และแนะนำคำค้นจากคำที่พิมพ์ไม่ครบ
  it("filters reviewed slips, summarises this month, and suggests search terms", async () => {
    const admin = { cookie: w.cookies.superAdmin };
    const listIds = async (status: string) => (await callApi("GET", `/api/v1/super-admin/subscription-payments?status=${status}&pageSize=100`, admin))
      .json.data.map((payment: { id: string; status: string }) => payment);
    const approved = await listIds("APPROVED");
    const rejected = await listIds("REJECTED");
    expect(approved.length).toBeGreaterThan(0);
    expect(approved.every((payment: { status: string }) => payment.status === "APPROVED")).toBe(true);
    expect(rejected.every((payment: { status: string }) => payment.status === "REJECTED")).toBe(true);
    // ค่าเริ่มต้นคือคิวรอตรวจ ของที่ตรวจแล้วต้องไม่หลุดเข้ามา
    const pending = await listIds("PENDING_REVIEW");
    expect(pending.some((payment: { id: string }) => approved.some((done: { id: string }) => done.id === payment.id))).toBe(false);
    expect((await callApi("GET", "/api/v1/super-admin/subscription-payments?status=PAID", admin)).status).toBe(400);

    const summary = await callApi("GET", "/api/v1/super-admin/subscription-payments/summary", admin);
    expect(summary.status).toBe(200);
    expect(summary.json.data.approvedThisMonth).toBeGreaterThan(0);
    expect(Number(summary.json.data.approvedAmountThisMonth)).toBeGreaterThan(0);

    // พิมพ์แค่บางส่วนของชื่อหอก็ต้องได้คำแนะนำ และไม่พิมพ์อะไรต้องได้รายการว่าง ไม่ใช่ทุกอย่างในระบบ
    const partialName = w.property.name.slice(0, 6);
    const suggestions = await callApi("GET", `/api/v1/super-admin/subscription-payments/suggestions?status=ALL&query=${encodeURIComponent(partialName)}`, admin);
    expect(suggestions.json.data).toContainEqual(expect.objectContaining({ kind: "property", value: w.property.name }));
    const empty = await callApi("GET", "/api/v1/super-admin/subscription-payments/suggestions?query=", admin);
    expect(empty.json.data).toEqual([]);

    // เจ้าของหอเห็นตัวเลขของทั้งระบบไม่ได้
    expect((await callApi("GET", "/api/v1/super-admin/subscription-payments/summary", owner())).status).toBe(403);
    expect((await callApi("GET", "/api/v1/super-admin/subscription-payments/suggestions?query=a", owner())).status).toBe(403);
  });
});

describe("scheduled maintenance job", () => {
  it("runs only with the shared secret", async () => {
    const path = "/api/internal/jobs/maintenance";
    expect((await callApi("POST", path)).status).toBe(401);
    expect((await callApi("POST", path, { headers: { authorization: "Bearer wrong-secret" } })).status).toBe(401);
    const ran = await callApi("POST", path, { headers: { authorization: `Bearer ${process.env.JOB_SECRET}` } });
    expect([200, 202]).toContain(ran.status);
    expect(ran.headers.get("cache-control")).toBe("no-store");
  });
});
