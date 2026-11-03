import { expect, test } from "@playwright/test";
import { e2e } from "./fixtures";
import { expectLeftLoginPage, openLoginForm } from "./helpers/login";

// หน้าบัญชีของเจ้าของหอเป็นการ์ดชุดเดียวกับทุกบทบาท ปุ่มแก้ไขต้องเปิดกล่องได้ และสวิตช์ข่าวสารต้องบันทึกจริง
test("owner account page shows the profile card and working controls", async ({ page }) => {
  await openLoginForm(page);
  await page.getByLabel("อีเมล").fill(e2e.ownerEmail);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(e2e.password);
  await page.getByRole("button", { name: /เข้าสู่ระบบ/ }).click();
  await expectLeftLoginPage(page);
  await page.goto(`/admin/properties/${e2e.propertyId}/account`);

  const profile = page.getByRole("region", { name: "โปรไฟล์" });
  await expect(profile).toContainText(e2e.ownerEmail);
  await expect(profile).toContainText("เจ้าของหอ");
  await expect(profile).toContainText("บัญชีใช้งานปกติ");
  await expect(page.getByRole("img", { name: "แก้ไขเองไม่ได้" })).toBeVisible();

  await page.getByRole("button", { name: "เปลี่ยนรหัสผ่าน" }).click();
  await expect(page.getByRole("dialog", { name: "เปลี่ยนรหัสผ่าน" })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "ยกเลิก" }).click();

  // สวิตช์บันทึกทันทีแล้วอ่านค่าที่เซิร์ฟเวอร์ตอบกลับ กดสองครั้งให้กลับเป็นค่าเดิม
  const marketing = page.getByRole("switch", { name: "รับข่าวสารและคำแนะนำจาก Nestly" });
  await expect(marketing).toBeEnabled();
  const initial = await marketing.isChecked();
  await marketing.click();
  await expect(marketing).toBeChecked({ checked: !initial });
  await expect(marketing).toBeEnabled();
  await marketing.click();
  await expect(marketing).toBeChecked({ checked: initial });
});
