import { expect, test } from "@playwright/test";
import { e2e } from "./fixtures";
import { expectLeftLoginPage, openLoginForm } from "./helpers/login";

// เมนูเลือกหอต้องบอกว่ากำลังดูหอไหน แต่ละหอมีจำนวนห้อง และปิดได้แบบเมนูทั่วไป
// เดิมคลิกข้างนอกหรือกด Escape แล้วเมนูค้าง ต้องกดปุ่มเดิมซ้ำถึงจะปิด
test("property switcher shows room counts and closes like a menu", async ({ page }) => {
  await openLoginForm(page);
  await page.getByLabel("อีเมล").fill(e2e.ownerEmail);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(e2e.password);
  await page.getByRole("button", { name: /เข้าสู่ระบบ/ }).click();
  await expectLeftLoginPage(page);
  await page.goto(`/admin/properties/${e2e.propertyId}`);

  const trigger = page.getByRole("button", { name: /^เปลี่ยนหอพัก ตอนนี้ดู/ });
  await expect(trigger).toContainText(/\d+ ห้อง/);
  await trigger.click();
  const menu = page.getByRole("menu", { name: "หอพักของคุณ" });
  await expect(menu).toBeVisible();
  const items = menu.getByRole("menuitem");
  await expect(items).toHaveCount(2);
  for (const item of await items.all()) await expect(item).toContainText(/\d+ ห้อง/);
  // สองหอในเมนูเดียวกันต้องได้สีไม่ซ้ำกัน แยกด้วยตาได้
  const tones = await menu.locator(".property-avatar").evaluateAll((marks) => marks.map((mark) => mark.getAttribute("data-tone")));
  expect(new Set(tones).size).toBe(tones.length);

  // เปิดแล้วโฟกัสอยู่ที่หอที่ดูอยู่ ลูกศรเลื่อนไปหออื่นได้
  const current = menu.locator('[aria-current="true"]');
  await expect(current).toContainText("กำลังดูอยู่");
  await expect(current).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(current).not.toBeFocused();

  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(trigger).toBeFocused();

  await trigger.click();
  await expect(menu).toBeVisible();
  await page.getByRole("heading", { level: 1 }).click();
  await expect(menu).toBeHidden();
});
