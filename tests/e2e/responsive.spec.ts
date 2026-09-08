/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นการทดสอบอัตโนมัติของ “responsive.spec” เพื่อป้องกันพฤติกรรมสำคัญย้อนกลับไปเสีย
 * การทำงาน: เตรียมสถานการณ์ เรียกโค้ดเหมือนผู้ใช้หรือระบบจริง แล้วตรวจผลลัพธ์ทั้งกรณีสำเร็จและกรณีที่ต้องปฏิเสธ
 */

import { expect, Page, test } from "@playwright/test";
import { e2e } from "./fixtures";

test.use({ viewport: { width: 390, height: 844 } });

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “login” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - page: ค่า “page” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - email: ค่า “email” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - password: ค่า “password” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
 */
async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("อีเมล").fill(email);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(password);
  await page.getByRole("button", { name: /เข้าสู่ระบบ/ }).click();
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “expect No Page Overflow” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - page: ค่า “page” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
async function expectNoPageOverflow(page: Page) {
  await expect.poll(async () => page.evaluate(() => {
    const root = document.documentElement;
    return Boolean(root) && root.scrollWidth <= root.clientWidth + 1;
  })).toBe(true);
}

test("owner workspace remains usable on a mobile viewport", async ({ page }) => {
  await login(page, e2e.ownerEmail, e2e.password);
  await expect(page).toHaveURL(/\/admin/);
  await expect(page.getByRole("heading", { name: "แดชบอร์ด", exact: true })).toBeVisible();
  await expectNoPageOverflow(page);

  await page.getByRole("link", { name: /ผู้เช่า/ }).first().click();
  await expectNoPageOverflow(page);
});

test("tenant portal remains usable on a mobile viewport", async ({ page }) => {
  await login(page, e2e.tenantEmail, e2e.password);
  await expect(page).toHaveURL(/\/tenant/);
  await expect(page.getByRole("navigation", { name: "เมนูผู้เช่าบนมือถือ", exact: true })).toBeVisible();
  await expectNoPageOverflow(page);

  const mobileNavigation = page.getByRole("navigation", { name: "เมนูผู้เช่าบนมือถือ", exact: true });
  await mobileNavigation.getByText("เพิ่มเติม", { exact: true }).click();
  await mobileNavigation.getByRole("link", { name: "บัญชีของฉัน", exact: true }).click();
  await expect(page.getByRole("heading", { name: "บัญชีของฉัน" })).toBeVisible();
  await expectNoPageOverflow(page);
});

test("super admin navigation remains usable on a mobile viewport", async ({ page }) => {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  test.skip(!email || !password, "Bootstrap credentials are required");

  await login(page, email!, password!);
  await expect(page).toHaveURL(/\/super-admin/);
  await expect(page.getByRole("navigation", { name: "เมนู Super Admin" })).toBeVisible();
  await expectNoPageOverflow(page);
});
