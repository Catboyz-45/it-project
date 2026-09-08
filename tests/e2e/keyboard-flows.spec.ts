/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นการทดสอบอัตโนมัติของ “keyboard flows.spec” เพื่อป้องกันพฤติกรรมสำคัญย้อนกลับไปเสีย
 * การทำงาน: เตรียมสถานการณ์ เรียกโค้ดเหมือนผู้ใช้หรือระบบจริง แล้วตรวจผลลัพธ์ทั้งกรณีสำเร็จและกรณีที่ต้องปฏิเสธ
 */

import { expect, type Locator, type Page, test } from "@playwright/test";
import { e2e } from "./fixtures";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “keyboard Login” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - page: ค่า “page” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - email: ค่า “email” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
 */
async function keyboardLogin(page: Page, email: string) {
  await page.goto("/login");
  const emailField = page.getByLabel("อีเมล");
  await emailField.focus();
  await page.keyboard.type(email);
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("รหัสผ่าน", { exact: true })).toBeFocused();
  await page.keyboard.type(e2e.password);
  await page.keyboard.press("Enter");
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “activate” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - control: ค่า “control” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
 */
async function activate(control: Locator) {
  await control.focus();
  await expect(control).toBeFocused();
  await control.page().keyboard.press("Enter");
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “expect Keyboard Focus” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - page: ค่า “page” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
async function expectKeyboardFocus(page: Page) {
  await page.keyboard.press("Tab");
  await expect.poll(() => page.evaluate(() => {
    const active = document.activeElement;
    return Boolean(active && active !== document.body && active !== document.documentElement);
  })).toBe(true);
}

test.describe.serial("keyboard coverage for critical flows", () => {
  test("Login and Owner Dashboard are operable without a pointer", async ({ page }) => {
    await keyboardLogin(page, e2e.ownerEmail);
    await expect(page.getByRole("heading", { name: "แดชบอร์ด" })).toBeVisible();

    const roomsLink = page.getByLabel("เมนูหลัก").getByRole("link", { name: /ผังห้องพัก/ });
    await activate(roomsLink);
    await expect(page).toHaveURL(new RegExp(`/admin/properties/${e2e.propertyId}/rooms$`));
    await expectKeyboardFocus(page);
  });

  test("Owner rooms, tenants and contracts support keyboard navigation", async ({ page }) => {
    await keyboardLogin(page, e2e.ownerEmail);

    await page.goto(`/admin/properties/${e2e.propertyId}/rooms`);
    const floorTabs = page.getByRole("tablist", { name: "เลือกชั้น" });
    const allFloors = floorTabs.getByRole("tab", { name: "ทุกชั้น" });
    await allFloors.focus();
    await page.keyboard.press("ArrowRight");
    await expect(floorTabs.getByRole("tab", { name: "ชั้น 1" })).toBeFocused();
    await page.keyboard.press("Home");
    await expect(allFloors).toBeFocused();

    await page.goto(`/admin/properties/${e2e.propertyId}/tenants`);
    const tenant = page.getByRole("button", { name: /E2E Tenant E101/ });
    await activate(tenant);
    const tenantDialog = page.getByRole("dialog", { name: /ห้อง E101 · E2E Tenant/ });
    await expect(tenantDialog).toBeVisible();
    await expect.poll(() => tenantDialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);

    const startDateTrigger = tenantDialog.getByRole("button", { name: "วันเริ่มสัญญา" });
    await activate(startDateTrigger);
    const calendar = page.getByRole("dialog", { name: "เลือกวันเริ่มสัญญา" });
    await expect(calendar).toBeVisible();
    await expect.poll(() => page.locator(":focus").getAttribute("data-date")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const initialDate = await page.locator(":focus").getAttribute("data-date");
    expect(initialDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => page.locator(":focus").getAttribute("data-date")).not.toBe(initialDate);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Home");
    await page.keyboard.press("End");
    await page.keyboard.press("PageDown");
    await page.keyboard.press("Escape");
    await expect(calendar).toBeHidden();
    await expect(startDateTrigger).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(tenantDialog).toBeHidden();
    await expect(tenant).toBeFocused();

    await page.goto(`/admin/properties/${e2e.propertyId}/contracts`);
    const contractSearch = page.getByLabel("ค้นหาสัญญา");
    await contractSearch.focus();
    await page.keyboard.type("CTR-E2E");
    await expect(page.getByText("CTR-E2E-E101", { exact: true })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: /พบ \d+ รายการ(?:ในหน้านี้)? กำลังแสดงหน้า 1/ })).toHaveCount(1);
    const contractMenu = page.getByRole("button", { name: "จัดการสัญญา CTR-E2E-E101" });
    await activate(contractMenu);
    await expect(page.getByRole("menuitem").first()).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(contractMenu).toBeFocused();
  });

  test("Owner invoices, meters and parcels support keyboard workflows", async ({ page }) => {
    await keyboardLogin(page, e2e.ownerEmail);

    await page.goto(`/admin/properties/${e2e.propertyId}/invoices`);
    const invoiceFilter = page.getByRole("button", { name: "กรองสถานะ" });
    await invoiceFilter.focus();
    await page.keyboard.press("Space");
    await expect(page.getByRole("option", { name: "ทุกสถานะ" })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(invoiceFilter).toBeFocused();

    await page.goto(`/admin/properties/${e2e.propertyId}/water-meter`);
    const readings = page.locator('input[aria-label^="เลขมิเตอร์ล่าสุดห้อง"]');
    if (await readings.count()) {
      await readings.first().focus();
      await page.keyboard.press("Enter");
      if (await readings.count() > 1) await expect(readings.nth(1)).toBeFocused();
    }

    await page.goto(`/admin/properties/${e2e.propertyId}/parcels`);
    const parcelTrigger = page.getByRole("button", { name: "รับพัสดุใหม่" });
    await activate(parcelTrigger);
    const parcelDialog = page.getByRole("dialog", { name: "เพิ่มพัสดุใหม่" });
    await expect(parcelDialog).toBeVisible();
    await page.keyboard.press("Shift+Tab");
    await expect(parcelDialog.getByRole("button", { name: "บันทึกพัสดุ" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(parcelDialog).toBeHidden();
    await expect(parcelTrigger).toBeFocused();
  });

  test("Settings, Dropdown, Action Menu and Notification Center honor keyboard contracts", async ({ page }) => {
    await keyboardLogin(page, e2e.ownerEmail);
    await page.goto(`/admin/properties/${e2e.propertyId}/settings`);

    const settings = page.getByRole("tablist", { name: "เมนูตั้งค่า" });
    const first = settings.getByRole("tab").first();
    await first.focus();
    await page.keyboard.press("End");
    await expect(settings.getByRole("tab").last()).toBeFocused();
    await page.keyboard.press("Home");
    await expect(first).toBeFocused();

    await page.goto(`/admin/properties/${e2e.propertyId}/announcements`);
    const actionMenu = page.getByRole("button", { name: "จัดการประกาศ ประกาศ E2E" });
    await activate(actionMenu);
    await expect(page.getByRole("menuitem", { name: "แก้ไข" })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("menuitem", { name: "ลบ" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(actionMenu).toBeFocused();

    const notifications = page.getByRole("button", { name: /ศูนย์การแจ้งเตือน/ });
    await activate(notifications);
    const notificationDialog = page.getByRole("dialog", { name: "ศูนย์การแจ้งเตือน" });
    await expect(notificationDialog).toBeVisible();
    await expect(notificationDialog).toHaveAttribute("aria-modal", "true");
    await expect.poll(() => notificationDialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
    const notificationControls = notificationDialog.locator("a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])");
    await notificationControls.last().focus();
    await page.keyboard.press("Tab");
    await expect(notificationControls.first()).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(notificationControls.last()).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(notificationDialog).toBeHidden();
    await expect(notifications).toBeFocused();
  });

  test("Tenant Portal navigation and modal are keyboard operable", async ({ page }) => {
    await keyboardLogin(page, e2e.tenantEmail);
    const invoiceLink = page.getByRole("navigation", { name: "เมนูผู้เช่า" })
      .getByRole("link", { name: /^บิลและชำระเงิน/ });
    await activate(invoiceLink);
    await expect(page).toHaveURL(/\/tenant\/invoices$/);

    // Invoice details expand inline (accordion) and stay keyboard-operable
    // through the same trigger button rather than a dialog with Escape.
    const invoice = page.getByRole("button", { name: /E2E-202607-E101/ });
    await activate(invoice);
    const invoiceDetails = page.getByLabel("รายละเอียดบิล E2E-202607-E101", { exact: true });
    await expect(invoiceDetails).toBeVisible();
    await expect(invoice).toBeFocused();
    await activate(invoice);
    await expect(invoiceDetails).toBeHidden();
    await expect(invoice).toBeFocused();
  });

  test("Super Admin navigation is covered with a seeded test account", async ({ page }) => {
    await keyboardLogin(page, e2e.superAdminEmail);
    await expect(page).toHaveURL(/\/super-admin\/?$/);
    await expect(page.getByRole("heading", { name: "แดชบอร์ด", exact: true })).toBeVisible();

    const navigation = page.getByRole("navigation", { name: "เมนู Super Admin" });
    const accounts = navigation.getByRole("link", { name: "บัญชีเจ้าของหอ", exact: true });
    await activate(accounts);
    await expect(page).toHaveURL(/\/super-admin\/accounts$/);
    await expect(page.getByRole("heading", { name: "บัญชีเจ้าของหอ", exact: true })).toBeVisible();
  });
});
