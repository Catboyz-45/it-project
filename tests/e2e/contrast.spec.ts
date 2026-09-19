import { expect, type Locator, type Page, test } from "@playwright/test";
import { e2e } from "./fixtures";
import { expectContrast } from "./helpers/contrast";

// ล็อกอินด้วยบัญชีเจ้าของหอ ใช้ซ้ำในทุกเทสต์ของกลุ่มแรก
async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("อีเมล").fill(e2e.ownerEmail);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(e2e.password);
  await page.getByRole("button", { name: /เข้าสู่ระบบ/ }).click();
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
}

// เหมือน login แต่ระบุอีเมลได้ ใช้กับเทสต์ที่ต้องสลับเป็นผู้เช่าหรือซูเปอร์แอดมิน
async function loginAs(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("อีเมล").fill(email);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(e2e.password);
  await page.getByRole("button", { name: /เข้าสู่ระบบ/ }).click();
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
}

// เช็คสามสถานะรวดเดียว ปกติ ชี้เมาส์ และโฟกัส เพราะหลายที่พลาดเฉพาะตอน hover ที่สีอ่อนลง
// ค่าเริ่มต้น 4.5 คือเกณฑ์ข้อความของ WCAG AA ส่วนไอคอนกับเส้นขอบใช้ 3
async function checkInteractiveStates(locator: Locator, name: string, minimum = 4.5) {
  await expectContrast(locator, { minimum, name, state: "default" });
  await locator.hover();
  await expectContrast(locator, { minimum, name, state: "hover" });
  await locator.focus();
  await expectContrast(locator, { minimum, name, state: "focus" });
}

test.describe("computed WCAG contrast", () => {
  // ล็อกอินใหม่ทุกเทสต์ แต่ละเทสต์จะได้เริ่มจากสถานะเดียวกัน
  test.beforeEach(async ({ page }) => login(page));

  test("text and interactive states meet WCAG AA", async ({ page }) => {
    await page.goto(`/admin/properties/${e2e.propertyId}/announcements`);

    const heading = page.getByRole("heading", { name: "ประกาศ/ข่าวสาร" });
    await expectContrast(heading, { minimum: 4.5, name: "page heading", state: "default" });

    const primary = page.getByRole("button", { name: "สร้างประกาศ" });
    await checkInteractiveStates(primary, "primary action");

    await page.goto(`/admin/properties/${e2e.propertyId}/meters/water`);
    // ปุ่มที่กดไม่ได้ใช้เกณฑ์ 3 ตามสเปก เพราะตั้งใจให้ดูจางกว่าเพื่อบอกว่ากดไม่ได้
    const disabled = page.locator('button[aria-describedby="meter-save-disabled-reason"]');
    await expect(disabled).toBeDisabled();
    await expectContrast(disabled, { minimum: 3, name: "disabled primary action", state: "disabled" });
  });

  // ไอคอนใช้เกณฑ์ 3 เพราะเป็นภาพ ไม่ใช่ข้อความ
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

  // เส้นขอบช่องกรอกต้องเห็นชัด ไม่งั้นคนสายตาไม่ดีจะไม่รู้ว่าตรงไหนพิมพ์ได้
  test("input and button boundaries meet non-text contrast requirements", async ({ page }) => {
    await page.goto(`/admin/properties/${e2e.propertyId}/announcements`);
    await page.getByRole("button", { name: "สร้างประกาศ" }).click();
    const input = page.getByRole("dialog", { name: "สร้างประกาศใหม่" }).getByLabel("หัวข้อประกาศ");

    await expectContrast(input, { kind: "border", minimum: 3, name: "title input boundary", state: "default" });
    await input.focus();
    await expectContrast(input, { kind: "border", minimum: 3, name: "title input boundary", state: "focus" });
  });

  // ปุ่มบางแบบไม่มีใช้ในหน้านี้ จึงแทรก HTML ทดสอบเข้าไปเองเพื่อวัดให้ครบทุกแบบในที่เดียว
  test("shared button variants meet text contrast in every interactive state", async ({ page }) => {
    await page.goto(`/admin/properties/${e2e.propertyId}/announcements`);
    await page.evaluate(() => {
      const fixture = document.createElement("section");
      fixture.id = "contrast-button-fixture";
      // ตรึงไว้มุมบนซ้ายและดันขึ้นชั้นบนสุด กันของอื่นบังจนวัดไม่ได้
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

    // วนเช็คทุกแบบ ปุ่มที่กดไม่ได้แยกออกมาเพราะใช้เกณฑ์คนละตัวและ hover ไม่ได้
    for (const variant of ["primary", "secondary", "tertiary", "danger"] as const) {
      await checkInteractiveStates(page.locator(`[data-contrast="${variant}"]`), `${variant} button`);
    }
    await expectContrast(page.locator('[data-contrast="disabled"]'), {
      minimum: 3,
      name: "disabled button",
      state: "disabled",
    });
  });

  // สีบอกผลอย่างสำเร็จ เตือน ผิดพลาด ต้องอ่านออกทั้งตัวอักษรและเส้นขอบ
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
    // เช็คเส้นขอบเฉพาะอันที่มีกรอบ ป้ายสถานะไม่มีกรอบจึงไม่อยู่ในรอบนี้
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
  // เช็คฝั่งผู้เช่าแยกต่างหาก เพราะใช้ชุดสีและ layout คนละแบบกับฝั่งเจ้าของหอ
  test("Tenant navigation, notification action and statuses meet WCAG AA", async ({ page }) => {
    await loginAs(page, e2e.tenantEmail);
    await page.goto("/tenant");

    const home = page.getByRole("navigation", { name: "เมนูผู้เช่า" }).getByRole("link", { name: /^หน้าหลัก/ });
    await checkInteractiveStates(home, "tenant navigation link");

    const notifications = page.getByRole("button", { name: /ศูนย์การแจ้งเตือน/ });
    await checkInteractiveStates(notifications, "tenant notification action", 3);

    // เช็คป้ายสถานะเฉพาะตอนที่มีให้เห็น บัญชีทดสอบอาจยังไม่มีบิลหรือรายการค้าง
    const status = page.locator(".badge").first();
    if (await status.count()) await expectContrast(status, { minimum: 4.5, name: "tenant status badge", state: "default" });
  });

  // ฝั่งซูเปอร์แอดมินก็ใช้ชุดสีของตัวเอง จึงต้องเช็คแยกอีกชุด
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
