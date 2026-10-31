import { expect, type Page, test } from "@playwright/test";
import { e2e } from "./fixtures";
import { expectLeftLoginPage, openLoginForm } from "./helpers/login";

// ป้ายตัวเลขของข้อความต้องหายเมื่อเปิดอ่าน ไม่ต้องรีเฟรชหน้า ทั้งฝั่งผู้เช่าและฝั่งแอดมินใหญ่
test.use({ viewport: { width: 1280, height: 800 } });

async function login(page: Page, email: string) {
  await openLoginForm(page);
  await page.getByLabel("อีเมล").fill(email);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(e2e.password);
  await page.getByRole("button", { name: /เข้าสู่ระบบ/ }).click();
  await expectLeftLoginPage(page);
}

// ส่งผ่าน fetch ในหน้าเว็บ จะได้ผ่านการตรวจ origin กับคุกกี้แบบเดียวกับที่หน้าจอส่งจริง
async function sendAsOwner(page: Page, path: string, body: string) {
  const status = await page.evaluate(async ({ body: text, path: url }) => {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: text, clientId: crypto.randomUUID() }),
    });
    return response.status;
  }, { body, path });
  expect(status).toBe(201);
}

test("tenant chat badge clears once the tenant opens the conversation", async ({ page }) => {
  await login(page, e2e.ownerEmail);
  await sendAsOwner(page, `/api/v1/admin/properties/${e2e.propertyId}/tenant-chat/${e2e.tenantProfileId}`, "ทดสอบป้ายแจ้งเตือนผู้เช่า");

  await page.context().clearCookies();
  await login(page, e2e.tenantEmail);
  // ผู้เช่าเปิดแชทจากปุ่มลอยมุมจอ ป้ายจำนวนอยู่ในชื่อปุ่มด้วย โปรแกรมอ่านหน้าจอจะได้รู้
  await page.getByRole("button", { name: /^เปิดแชทกับหอพัก มีข้อความใหม่/ }).click();
  const chat = page.getByRole("dialog", { name: "แชทกับหอพัก" });
  await expect(chat.getByText("ทดสอบป้ายแจ้งเตือนผู้เช่า").first()).toBeVisible({ timeout: 15_000 });
  await chat.getByRole("button", { name: "ปิดช่องแชท" }).click();
  // เปิดอ่านแล้วป้ายบนปุ่มต้องหายเอง โดยไม่ต้องรีเฟรชหน้า
  await expect(page.getByRole("button", { name: "เปิดแชทกับหอพัก", exact: true })).toBeVisible();
});

test("super admin bell counts owner support messages and clears them after reading", async ({ page }) => {
  await login(page, e2e.ownerEmail);
  await sendAsOwner(page, `/api/v1/admin/properties/${e2e.propertyId}/support-chat`, "ทดสอบป้ายแจ้งเตือนแอดมินใหญ่");

  await page.context().clearCookies();
  await login(page, e2e.superAdminEmail);
  const bell = page.getByRole("button", { name: /^ศูนย์การแจ้งเตือน มี \d+ รายการ/ });
  await expect(bell).toBeVisible();
  await bell.click();
  await page.getByRole("button", { name: /^ข้อความใหม่จากเจ้าของหอ/ }).click();

  const chat = page.getByRole("complementary", { name: "ข้อความจากหอพัก" });
  await chat.getByRole("button", { name: /E2E/ }).first().click();
  await expect(chat.getByText("ทดสอบป้ายแจ้งเตือนแอดมินใหญ่").first()).toBeVisible({ timeout: 15_000 });
  // อ่านแล้วกระดิ่งต้องไม่เหลือเรื่องข้อความค้าง งานค้างอื่นในข้อมูลทดสอบยังอยู่ได้ จึงเช็คเฉพาะหัวข้อข้อความ
  await page.getByRole("button", { name: /^ศูนย์การแจ้งเตือน/ }).click();
  await expect(page.getByRole("dialog", { name: "ศูนย์การแจ้งเตือน" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^ข้อความใหม่จากเจ้าของหอ/ })).toHaveCount(0);
});
