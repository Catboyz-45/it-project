/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นการทดสอบอัตโนมัติของ “contrast.spec” เพื่อป้องกันพฤติกรรมสำคัญย้อนกลับไปเสีย
 * การทำงาน: เตรียมสถานการณ์ เรียกโค้ดเหมือนผู้ใช้หรือระบบจริง แล้วตรวจผลลัพธ์ทั้งกรณีสำเร็จและกรณีที่ต้องปฏิเสธ
 */

import { expect, type Locator, type Page, test } from "@playwright/test";
import { e2e } from "./fixtures";
import { expectContrast } from "./helpers/contrast";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “login” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - page: ค่า “page” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
 */
async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("อีเมล").fill(e2e.ownerEmail);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(e2e.password);
  await page.getByRole("button", { name: /เข้าสู่ระบบ/ }).click();
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “login As” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - page: ค่า “page” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - email: ค่า “email” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
 */
async function loginAs(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("อีเมล").fill(email);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(e2e.password);
  await page.getByRole("button", { name: /เข้าสู่ระบบ/ }).click();
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตรวจเงื่อนไขของ “check Interactive States” และหยุดด้วยข้อผิดพลาดที่เหมาะสมเมื่อไม่ผ่าน
 * รับค่า:
 * - locator: ค่า “locator” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - name: ค่า “name” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - minimum: ค่า “minimum” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
 */
async function checkInteractiveStates(locator: Locator, name: string, minimum = 4.5) {
  await expectContrast(locator, { minimum, name, state: "default" });
  await locator.hover();
  await expectContrast(locator, { minimum, name, state: "hover" });
  await locator.focus();
  await expectContrast(locator, { minimum, name, state: "focus" });
}

test.describe("computed WCAG contrast", () => {
  test.beforeEach(async ({ page }) => login(page));

  test("text and interactive states meet WCAG AA", async ({ page }) => {
    await page.goto(`/admin/properties/${e2e.propertyId}/announcements`);

    const heading = page.getByRole("heading", { name: "ประกาศและข่าวสาร" });
    await expectContrast(heading, { minimum: 4.5, name: "page heading", state: "default" });

    const primary = page.getByRole("button", { name: "สร้างประกาศ" });
    await checkInteractiveStates(primary, "primary action");

    await page.goto(`/admin/properties/${e2e.propertyId}/meters/water`);
    const disabled = page.locator('button[aria-describedby="meter-save-disabled-reason"]');
    await expect(disabled).toBeDisabled();
    await expectContrast(disabled, { minimum: 3, name: "disabled primary action", state: "disabled" });
  });

  test("icons expose non-text contrast in default, hover and focus states", async ({ page }) => {
    await page.goto(`/admin/properties/${e2e.propertyId}/announcements`);
    const iconButton = page.getByRole("button", { name: "จัดการประกาศ ประกาศ E2E" });
    await checkInteractiveStates(iconButton, "action-menu icon", 3);
    const icon = iconButton.locator("svg");
    await expectContrast(icon, { minimum: 3, name: "action-menu icon glyph", state: "focus" });
  });

  test("badges meet text contrast requirements", async ({ page }) => {
    await page.goto(`/admin/properties/${e2e.propertyId}/announcements`);
    const badge = page.locator(".badge").filter({ hasText: "เผยแพร่แล้ว" }).first();
    await expectContrast(badge, { minimum: 4.5, name: "published status badge", state: "default" });
  });

  test("input and button boundaries meet non-text contrast requirements", async ({ page }) => {
    await page.goto(`/admin/properties/${e2e.propertyId}/announcements`);
    await page.getByRole("button", { name: "สร้างประกาศ" }).click();
    const input = page.getByRole("dialog", { name: "สร้างประกาศใหม่" }).getByLabel("หัวข้อประกาศ");

    await expectContrast(input, { kind: "border", minimum: 3, name: "title input boundary", state: "default" });
    await input.focus();
    await expectContrast(input, { kind: "border", minimum: 3, name: "title input boundary", state: "focus" });
  });

  test("shared button variants meet text contrast in every interactive state", async ({ page }) => {
    await page.goto(`/admin/properties/${e2e.propertyId}/announcements`);
    await page.evaluate(() => {
      const fixture = document.createElement("section");
      fixture.id = "contrast-button-fixture";
      fixture.className = "fixed left-4 top-4 z-[9999] grid gap-3 bg-[#fff] p-4";
      fixture.innerHTML = `
        <button class="app-button app-button--primary" data-contrast="primary">ดำเนินการหลัก</button>
        <button class="app-button app-button--secondary" data-contrast="secondary">ดำเนินการรอง</button>
        <button class="app-button app-button--tertiary" data-contrast="tertiary">ดำเนินการเพิ่มเติม</button>
        <button class="app-button app-button--danger" data-contrast="danger">ลบข้อมูล</button>
        <button class="app-button app-button--primary" data-contrast="disabled" disabled>ไม่พร้อมใช้งาน</button>
      `;
      document.body.append(fixture);
    });

    for (const variant of ["primary", "secondary", "tertiary", "danger"] as const) {
      await checkInteractiveStates(page.locator(`[data-contrast="${variant}"]`), `${variant} button`);
    }
    await expectContrast(page.locator('[data-contrast="disabled"]'), {
      minimum: 3,
      name: "disabled button",
      state: "disabled",
    });
  });

  test("semantic feedback colors meet text and boundary contrast contracts", async ({ page }) => {
    await page.goto(`/admin/properties/${e2e.propertyId}/announcements`);
    await page.evaluate(() => {
      const fixture = document.createElement("section");
      fixture.id = "contrast-feedback-fixture";
      fixture.className = "fixed left-4 top-4 z-[9999] grid gap-3 bg-[#fff] p-4";
      fixture.innerHTML = `
        <p class="form-alert" data-contrast="success">บันทึกข้อมูลสำเร็จ</p>
        <p class="form-alert warning" data-contrast="warning">กรุณาตรวจสอบข้อมูล</p>
        <p class="form-alert error" data-contrast="error">ไม่สามารถบันทึกข้อมูลได้</p>
        <p class="disabled-reason" data-contrast="disabled-reason">กรอกข้อมูลให้ครบก่อนดำเนินการ</p>
        <span class="badge badge-paid" data-contrast="paid">ชำระแล้ว</span>
        <span class="badge badge-pending" data-contrast="pending">รอดำเนินการ</span>
        <div class="read-only-notice" data-contrast="read-only"><span>โหมดอ่านอย่างเดียว</span></div>
      `;
      document.body.append(fixture);
    });

    for (const tone of ["success", "warning", "error", "disabled-reason", "paid", "pending", "read-only"] as const) {
      const control = page.locator(`[data-contrast="${tone}"]`);
      await expectContrast(control, { minimum: 4.5, name: `${tone} feedback`, state: "default" });
    }
    for (const tone of ["success", "warning", "error", "read-only"] as const) {
      await expectContrast(page.locator(`[data-contrast="${tone}"]`), {
        kind: "border",
        minimum: 3,
        name: `${tone} feedback boundary`,
        state: "default",
      });
    }
  });
});

test.describe("role-specific computed contrast", () => {
  test("Tenant navigation, notification action and statuses meet WCAG AA", async ({ page }) => {
    await loginAs(page, e2e.tenantEmail);
    await page.goto("/tenant");

    const home = page.getByRole("navigation", { name: "เมนูผู้เช่า" }).getByRole("link", { name: /^หน้าหลัก/ });
    await checkInteractiveStates(home, "tenant navigation link");

    const notifications = page.getByRole("button", { name: /ศูนย์การแจ้งเตือน/ });
    await checkInteractiveStates(notifications, "tenant notification action", 3);

    const status = page.locator(".badge").first();
    if (await status.count()) await expectContrast(status, { minimum: 4.5, name: "tenant status badge", state: "default" });
  });

  test("Super Admin navigation and table statuses meet WCAG AA", async ({ page }) => {
    await loginAs(page, e2e.superAdminEmail);
    const accounts = page.getByRole("navigation", { name: "เมนู Super Admin" })
      .getByRole("link", { name: "บัญชีเจ้าของหอ", exact: true });
    await checkInteractiveStates(accounts, "super admin navigation link");

    await page.goto("/super-admin/accounts");
    const status = page.locator(".badge").first();
    if (await status.count()) await expectContrast(status, { minimum: 4.5, name: "super admin status badge", state: "default" });
  });
});
