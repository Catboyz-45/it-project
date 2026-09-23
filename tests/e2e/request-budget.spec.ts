import { expect, type Page, test } from "@playwright/test";
import { e2e } from "./fixtures";

// งบคำขอของแต่ละหน้า
//
// เขียนไฟล์นี้ขึ้นมาเพราะเคยมีลูปที่ยิง 42 คำขอต่อวินาทีอยู่ในหน้าแจ้งเรื่องของผู้เช่า
// หน้ากระพริบให้เห็นชัด ๆ แต่เทสต์ทั้ง 54 ตัวผ่านหมด เพราะไม่มีตัวไหนนับจำนวนคำขอเลย
// ลูปแบบนั้นไม่ทำให้อะไรพัง มันแค่กินเครื่องผู้ใช้กับเซิร์ฟเวอร์ไปเรื่อย ๆ
//
// ตอน dev React เรียก effect สองรอบ จำนวนที่วัดได้จึงเป็นสองเท่าของที่ควรเป็น
// งบด้านล่างเผื่อไว้แล้ว และยังต่ำกว่าเลขของลูปจริงหลายสิบเท่า
const openTicketBudget = 10;
const idleBudget = 2;

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("อีเมล").fill(email);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(e2e.password);
  await page.getByRole("button", { name: /เข้าสู่ระบบ/ }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 });
  await page.waitForLoadState("networkidle");
}

// นับเฉพาะคำขอที่ยิงไปที่ API ไม่นับไฟล์หน้าเว็บกับรูป
function countApiRequests(page: Page) {
  const calls: string[] = [];
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith("/api/")) calls.push(path);
  });
  return calls;
}

test.describe("งบคำขอของแต่ละหน้า", () => {
  test("กางเรื่องแจ้งของผู้เช่าแล้วไม่วนโหลดซ้ำ", async ({ page }) => {
    const calls = countApiRequests(page);
    await login(page, e2e.tenantEmail);
    await page.goto("/tenant/tickets");
    await page.waitForLoadState("networkidle");
    await page.getByRole("tab", { name: /ประวัติ/ }).first().click();
    await page.waitForTimeout(1500);

    const before = calls.length;
    await page.getByRole("button", { name: /^ขยายรายละเอียด/ }).first().click();
    // รอให้กล่องสนทนาโหลดเสร็จ แล้วเฝ้าดูต่อว่ามันหยุดยิงจริงไหม
    await page.waitForTimeout(5000);
    const opened = calls.length - before;
    expect(opened, `กางเรื่องแล้วยิง ${opened} คำขอใน 5 วินาที`).toBeLessThanOrEqual(openTicketBudget);
  });

  test("เปิดข้อความของเรื่องร้องเรียนฝั่งเจ้าของหอแล้วไม่วนโหลดซ้ำ", async ({ page }) => {
    const calls = countApiRequests(page);
    await login(page, e2e.ownerEmail);
    await page.goto(`/admin/properties/${e2e.propertyId}/tickets`);
    await page.waitForLoadState("networkidle");

    const before = calls.length;
    await page.getByRole("button", { name: /จัดการเรื่องร้องเรียน/ }).first().click();
    await page.getByRole("menuitem", { name: /เปิดข้อความ/ }).click();
    await page.waitForTimeout(5000);
    const opened = calls.length - before;
    expect(opened, `เปิดข้อความแล้วยิง ${opened} คำขอใน 5 วินาที`).toBeLessThanOrEqual(openTicketBudget);
  });

  test("ทุกหน้าหยุดยิงคำขอเมื่อโหลดเสร็จแล้ว", async ({ page }) => {
    // เดินหลายหน้าและเฝ้าดูหน้าละ 3 วินาที จึงใช้เวลามากกว่าค่าเริ่มต้น
    test.setTimeout(180_000);
    const calls = countApiRequests(page);
    const pages: Array<[string, string]> = [
      [e2e.ownerEmail, `/admin/properties/${e2e.propertyId}`],
      [e2e.ownerEmail, `/admin/properties/${e2e.propertyId}/tenants`],
      [e2e.ownerEmail, `/admin/properties/${e2e.propertyId}/invoices`],
      [e2e.tenantEmail, "/tenant"],
      [e2e.tenantEmail, "/tenant/invoices"],
      [e2e.superAdminEmail, "/super-admin"],
      [e2e.superAdminEmail, "/super-admin/accounts"],
    ];
    let currentUser = "";
    for (const [email, path] of pages) {
      if (email !== currentUser) {
        if (currentUser) {
          await page.request.post("/api/auth/logout", { data: {}, headers: { origin: new URL(page.url()).origin } });
        }
        await login(page, email);
        currentUser = email;
      }
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      // นับใหม่หลังหน้านิ่งแล้ว ที่เกินจากนี้คือการยิงซ้ำโดยไม่มีใครสั่ง
      const settled = calls.length;
      await page.waitForTimeout(3000);
      const extra = calls.length - settled;
      expect(extra, `${path} ยิงเพิ่ม ${extra} คำขอหลังหน้านิ่งแล้ว`).toBeLessThanOrEqual(idleBudget);
    }
  });
});
