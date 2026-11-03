import { expect, test } from "@playwright/test";
import { e2e } from "./fixtures";
import { expectLeftLoginPage, openLoginForm } from "./helpers/login";

// ส่งออก CSV อยู่คู่ช่องค้นหาในการ์ดตาราง ไม่ใช่บนหัวหน้า และแท็บประวัติย้ายตอนโหลดต้องเป็นโครงตารางสีเทา ไม่กระพริบเป็นกล่องสีเขียว
test("tenants page keeps export with the table and loads history without a green flash", async ({ page }) => {
  await openLoginForm(page);
  await page.getByLabel("อีเมล").fill(e2e.ownerEmail);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(e2e.password);
  await page.getByRole("button", { name: /เข้าสู่ระบบ/ }).click();
  await expectLeftLoginPage(page);
  await page.goto(`/admin/properties/${e2e.propertyId}/tenants`);

  const exportLink = page.getByRole("link", { name: "ส่งออก CSV" });
  await expect(exportLink).toBeVisible();
  await expect(page.locator(".figma-table-toolbar").getByRole("link", { name: "ส่งออก CSV" })).toBeVisible();
  await expect(page.locator(".page-header-slot").getByRole("link", { name: "ส่งออก CSV" })).toHaveCount(0);

  // หน่วงคำตอบไว้ให้เห็นช่วงกำลังโหลดแน่ ๆ
  let delayed = 0;
  await page.route(/\/occupancy-transitions(\?|$)/, async (route) => {
    delayed += 1;
    await new Promise((resolve) => setTimeout(resolve, 600));
    await route.continue();
  });
  await page.getByRole("button", { name: "ประวัติย้ายออก/ย้ายห้อง" }).click();
  await expect.poll(() => delayed).toBeGreaterThan(0);
  await expect(page.getByText("กำลังโหลดประวัติการย้าย")).toBeAttached();
  await expect(page.locator(".form-alert:not(.error):not(.warning)")).toHaveCount(0);
  // ระหว่างรอต้องไม่ขึ้นว่าไม่มีประวัติ
  await expect(page.getByText("ยังไม่มีประวัติการย้ายออกหรือย้ายห้อง")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "ประวัติการเปลี่ยนห้องและย้ายออก" })).toBeVisible();
  await expect(page.getByText("กำลังโหลดประวัติการย้าย")).toHaveCount(0);
  // แท็บนี้ไม่มีปุ่มส่งออก เพราะส่งออกได้เฉพาะรายชื่อผู้เช่า
  await expect(exportLink).toHaveCount(0);
});
