import { expect, test } from "@playwright/test";
import { e2e } from "./fixtures";
import { expectLeftLoginPage, openLoginForm } from "./helpers/login";

// ปุ่มบันทึกมิเตอร์อยู่ในแถบลอยด้านล่าง โผล่เมื่อกรอกเลขแล้วเท่านั้น และล้างที่กรอกได้โดยต้องยืนยันก่อน
test("meter save bar appears after typing and clears the drafts", async ({ page }) => {
  await openLoginForm(page);
  await page.getByLabel("อีเมล").fill(e2e.ownerEmail);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(e2e.password);
  await page.getByRole("button", { name: /เข้าสู่ระบบ/ }).click();
  await expectLeftLoginPage(page);
  await page.goto(`/admin/properties/${e2e.propertyId}/meters/water`);

  const bar = page.getByRole("region", { name: "บันทึกมิเตอร์" });
  const latest = page.locator('input[data-meter-field="latest"]:not(:disabled)').first();
  await expect(latest).toBeVisible();
  await expect(bar).toHaveCount(0);

  await latest.fill("123456");
  await expect(bar).toBeVisible();
  await expect(bar.getByRole("button", { name: "ตรวจสอบและบันทึก 1 ห้อง" })).toBeEnabled();
  // หัวหน้าเพจไม่มีปุ่มบันทึกแล้ว เหลือแค่ค้นหาและการแจ้งเตือน
  await expect(page.locator(".page-header-slot").getByRole("button", { name: /บันทึก/ })).toHaveCount(0);

  await bar.getByRole("button", { name: "ล้างที่กรอก" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "ล้างที่กรอก" }).click();
  await expect(bar).toHaveCount(0);
  await expect(latest).toHaveValue("");
});
