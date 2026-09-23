import { expect, type Page, test } from "@playwright/test";
import { e2e } from "./fixtures";

// เก็บทุกครั้งที่หน้าจอขอ read model หรือตัวเลขสรุปจากเซิร์ฟเวอร์ ไว้นับทีหลัง
// ต้องผูกก่อนเปิดหน้าแรก ไม่งั้นคำขอที่เกิดตอนโหลดครั้งแรกจะหลุดไป
function trackDashboardRequests(page: Page) {
  const calls: string[] = [];
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (/\/api\/v1\/admin\/properties\/[^/]+\/dashboard(\/summary)?$/.test(path)) calls.push(path);
  });
  return calls;
}

async function loginAsOwner(page: Page) {
  await page.goto("/login");
  await page.getByLabel("อีเมล").fill(e2e.ownerEmail);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(e2e.password);
  await page.getByRole("button", { name: /เข้าสู่ระบบ/ }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 });
  await page.waitForLoadState("networkidle");
}

// read model กับตัวเลขสรุปเป็นสองคำสั่งที่หนักที่สุดในระบบ layout ดึงมาให้ตั้งแต่ฝั่งเซิร์ฟเวอร์แล้ว
// เคยมีรอบหนึ่งที่ shell ยิงซ้ำตอน mount โดยไม่มีอะไรฟ้อง ไฟล์นี้จึงนับจำนวนครั้งไว้ตรง ๆ
test("owner shell does not refetch the read model it already has", async ({ page }) => {
  const calls = trackDashboardRequests(page);
  await loginAsOwner(page);
  // เปิดหน้ามาครั้งแรกต้องไม่ยิงเลย ข้อมูลมากับหน้าที่เซิร์ฟเวอร์ render มาแล้ว
  expect(calls).toHaveLength(0);

  await page.getByLabel("เมนูหลัก").getByRole("link", { name: /^ผู้เช่า(?:\s|$)/ }).click();
  await expect(page.getByRole("heading", { name: "ผู้เช่า", exact: true })).toBeVisible();
  await page.waitForLoadState("networkidle");
  // เปลี่ยนหน้าในหอเดิมก็ไม่ต้องยิง เพราะ layout ไม่ได้ถูกสร้างใหม่
  expect(calls).toHaveLength(0);

  await page.getByRole("button", { name: "คำขอเข้าพัก", exact: true }).click();
  const approve = page.getByRole("button", { name: "อนุมัติ E2E Pending Tenant" });
  await approve.waitFor({ state: "visible", timeout: 10_000 });
  await approve.click();
  await page.getByRole("alertdialog", { name: "อนุมัติคำขอเข้าพัก?" })
    .getByRole("button", { name: "อนุมัติ", exact: true }).click();
  // คิวมีมากกว่าหนึ่งใบ จึงดูว่าใบที่เพิ่งอนุมัติหลุดออกจากคิวไป ไม่ใช่ว่าคิวต้องว่าง
  await expect(approve).toBeHidden();
  await page.waitForLoadState("networkidle");
  // แต่พอแก้ข้อมูลจริงต้องโหลดใหม่ ไม่งั้นหน้าอื่นจะเห็นข้อมูลเก่า
  expect(calls.length).toBeGreaterThan(0);
});

// สลับหอใช้การโหลดหน้าใหม่ทั้งหน้าโดยตั้งใจ เพื่อทิ้ง state ของหอเดิมให้หมด
// ข้อมูลของหอใหม่จึงมากับหน้าที่เซิร์ฟเวอร์ render เหมือนตอนเปิดครั้งแรก ไม่ต้องยิงเพิ่ม
test("switching property shows the other property without refetching", async ({ page }) => {
  const calls = trackDashboardRequests(page);
  await loginAsOwner(page);
  // มีสองหอแล้วก็ยังต้องพาไปหอแรกตามตัวอักษรเหมือนเดิม
  await expect(page).toHaveURL(new RegExp(`/admin/properties/${e2e.propertyId}$`));

  await page.goto(`/admin/properties/${e2e.propertyId}/rooms`);
  await expect(page.getByRole("button", { name: /E101/ }).first()).toBeVisible();

  await page.locator(".sidebar-property > button").first().click();
  await page.getByRole("menuitem", { name: /E2E ฮาเฮ/ }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/properties/${e2e.secondPropertyId}$`));
  await page.waitForLoadState("networkidle");
  expect(calls).toHaveLength(0);

  // ห้องที่เห็นต้องเป็นของหอใหม่ล้วน ๆ ไม่มีของหอเดิมค้างมาจาก state ชุดเก่า
  await page.goto(`/admin/properties/${e2e.secondPropertyId}/rooms`);
  await expect(page.getByRole("button", { name: /F201/ }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /E101/ })).toHaveCount(0);
  await page.waitForLoadState("networkidle");
  expect(calls).toHaveLength(0);
});
