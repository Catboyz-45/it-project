import { expect, test } from "@playwright/test";
import sharp from "sharp";
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

// อัปโหลดรูปโปรไฟล์จากการ์ดบนสุด รูปต้องขึ้นทั้งในการ์ดและปุ่มบัญชีท้ายแถบข้างทันที แล้วลบกลับเป็นตัวอักษรได้
test("owner can upload and remove a profile picture", async ({ page }) => {
  await openLoginForm(page);
  await page.getByLabel("อีเมล").fill(e2e.ownerEmail);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(e2e.password);
  await page.getByRole("button", { name: /เข้าสู่ระบบ/ }).click();
  await expectLeftLoginPage(page);
  await page.goto(`/admin/properties/${e2e.propertyId}/account`);

  const profile = page.getByRole("region", { name: "โปรไฟล์" });
  const sidebarAvatar = page.locator(".sidebar .account-avatar img");
  const photo = await sharp({ create: { width: 640, height: 480, channels: 3, background: "#c03b84" } }).jpeg().toBuffer();
  await profile.locator('input[type="file"]').setInputFiles({ buffer: photo, mimeType: "image/jpeg", name: "me.jpg" });
  await expect(page.getByText("เปลี่ยนรูปโปรไฟล์แล้ว")).toBeVisible();
  await expect(profile.locator(".initial-avatar img")).toBeVisible();
  await expect(sidebarAvatar).toBeVisible();

  // ไฟล์ที่ได้กลับมาถูกแปลงเป็น WebP สี่เหลี่ยมจัตุรัสแล้ว
  const src = await sidebarAvatar.getAttribute("src");
  const response = await page.request.get(src!);
  expect(response.headers()["content-type"]).toBe("image/webp");
  expect((await sharp(await response.body()).metadata()).width).toBe(256);

  // รีเฟรชแล้วรูปยังอยู่ เพราะเก็บที่เซิร์ฟเวอร์ ไม่ใช่แค่ในหน้า
  await page.reload();
  await expect(sidebarAvatar).toBeVisible();

  // ไฟล์ที่ไม่ใช่รูปถูกปฏิเสธในหน้าเลย
  await profile.locator('input[type="file"]').setInputFiles({ buffer: Buffer.from("%PDF-1.7"), mimeType: "application/pdf", name: "doc.pdf" });
  await expect(profile.getByRole("alert")).toContainText("PNG, JPG และ WebP");

  await profile.getByRole("button", { name: "ลบรูป" }).click();
  await expect(page.getByText("ลบรูปโปรไฟล์แล้ว")).toBeVisible();
  await expect(profile.locator(".initial-avatar img")).toHaveCount(0);
  await expect(sidebarAvatar).toHaveCount(0);
  expect((await page.request.get("/api/account/avatar")).status()).toBe(404);
});
