import { expect, test } from "@playwright/test";
import { e2e } from "./fixtures";
import { expectLeftLoginPage, openLoginForm } from "./helpers/login";

// หน้าบัญชีของเจ้าของหอเป็นการ์ดชุดเดียวกับทุกบทบาท แก้ชื่อและรหัสผ่านในการ์ดได้เลย และสวิตช์ข่าวสารต้องบันทึกจริง
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
  // แก้ชื่อในการ์ดได้เลย ปุ่มอัปเดตกดได้เมื่อชื่อเปลี่ยน กดแล้วชื่อบนการ์ดโปรไฟล์เปลี่ยนตาม แล้วเปลี่ยนกลับ
  const nameField = page.getByLabel("ชื่อที่แสดง");
  const update = page.getByRole("button", { exact: true, name: "อัปเดต" });
  const originalName = await nameField.inputValue();
  await expect(update).toBeDisabled();
  await nameField.fill(`${originalName} ทดสอบ`);
  await update.click();
  await expect(profile).toContainText(`${originalName} ทดสอบ`);
  await expect(update).toBeDisabled();
  await nameField.fill(originalName);
  await update.click();
  await expect(profile).toContainText(originalName);
  await expect(profile).not.toContainText("ทดสอบ");

  // อีเมลแก้เองไม่ได้ และปุ่มเปลี่ยนรหัสผ่านรอจนกรอกครบ ช่องเกณฑ์รหัสผ่านโผล่เมื่อเริ่มพิมพ์รหัสใหม่
  await expect(page.getByLabel("อีเมลสำหรับเข้าสู่ระบบ")).toHaveAttribute("readonly", "");
  const changePassword = page.getByRole("button", { name: "เปลี่ยนรหัสผ่าน" });
  await expect(changePassword).toBeDisabled();
  await page.getByLabel("รหัสผ่านปัจจุบัน").fill("not-the-password");
  await page.getByLabel("รหัสผ่านใหม่", { exact: true }).fill("Brand-New-Pass-2026");
  await page.getByLabel("ยืนยันรหัสผ่านใหม่").fill("Different-Pass-2026");
  await expect(changePassword).toBeEnabled();
  await changePassword.click();
  await expect(page.getByRole("alert").filter({ hasText: "ไม่ตรงกัน" })).toBeVisible();

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
