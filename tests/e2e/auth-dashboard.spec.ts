/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นการทดสอบอัตโนมัติของ “auth dashboard.spec” เพื่อป้องกันพฤติกรรมสำคัญย้อนกลับไปเสีย
 * การทำงาน: เตรียมสถานการณ์ เรียกโค้ดเหมือนผู้ใช้หรือระบบจริง แล้วตรวจผลลัพธ์ทั้งกรณีสำเร็จและกรณีที่ต้องปฏิเสธ
 */

import { expect, test } from "@playwright/test";

test("rejects invalid credentials without leaking account state", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("อีเมล").fill("unknown@example.com");
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill("incorrect-password");
  await page.getByRole("button", { name: /เข้าสู่ระบบ/ }).click();
  await expect(page.getByRole("alert").filter({ hasText: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" })).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test("super admin can open the aggregated SaaS dashboard", async ({ page }) => {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  test.skip(!email || !password, "Bootstrap credentials are required");
  await page.goto("/login");
  await page.getByLabel("อีเมล").fill(email!);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(password!);
  await page.getByRole("button", { name: /เข้าสู่ระบบ/ }).click();
  await expect(page).toHaveURL(/\/super-admin/);
  await expect(page.getByRole("heading", { name: "แดชบอร์ด", exact: true })).toBeVisible();
  await expect(page.getByText("MRR")).toBeVisible();

  const routes = [
    ["บัญชีเจ้าของหอ", "/super-admin/accounts"],
    ["หอพัก", "/super-admin/properties"],
    ["แพ็กเกจ", "/super-admin/plans"],
    ["การชำระสมาชิก", "/super-admin/subscriptions"],
    ["Audit Log", "/super-admin/audit-logs"],
  ] as const;
  for (const [label, route] of routes) {
    await page.getByRole("link", { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${route}$`));
    await expect(page.getByRole("heading", { name: label === "แพ็กเกจ" ? "แพ็กเกจ SaaS" : label, exact: true }).first()).toBeVisible();
  }
});
