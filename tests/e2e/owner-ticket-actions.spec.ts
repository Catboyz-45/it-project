import { expect, test } from "@playwright/test";
import { e2e } from "./fixtures";
import { expectLeftLoginPage, openLoginForm } from "./helpers/login";

// แถวเรื่องแจ้งมีปุ่มแชทเปิดข้อความอยู่แล้ว เมนูจัดการจึงต้องมีแค่งานจัดการ ไม่ซ้ำกับปุ่มแชท
test("ticket rows open the chat from one button and keep the menu for management", async ({ page }) => {
  await openLoginForm(page);
  await page.getByLabel("อีเมล").fill(e2e.ownerEmail);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(e2e.password);
  await page.getByRole("button", { name: /เข้าสู่ระบบ/ }).click();
  await expectLeftLoginPage(page);

  await page.goto(`/admin/properties/${e2e.propertyId}/tickets`);
  const row = page.getByRole("row").filter({ hasText: "เสียงดังตอนกลางคืน" });
  await row.getByRole("button", { name: /^จัดการเรื่อง เสียงดังตอนกลางคืน/ }).click();
  await expect(page.getByRole("menuitem")).toHaveText(["แก้ไขเรื่อง", "อัปเดตเป็นสถานะถัดไป", "ยกเลิกเรื่อง"]);
  await page.keyboard.press("Escape");

  await row.getByRole("button", { name: "คุยเรื่อง เสียงดังตอนกลางคืน ในแชท" }).click();
  await expect(page.getByRole("textbox", { name: /ข้อความ/ })).toBeVisible();
});
