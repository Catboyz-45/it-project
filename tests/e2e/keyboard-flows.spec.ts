import { expect, type Locator, type Page, test } from "@playwright/test";
import { e2e } from "./fixtures";

// ล็อกอินด้วยคีย์บอร์ดล้วน ไม่แตะเมาส์เลย เพื่อพิสูจน์ว่าคนที่ใช้เมาส์ไม่ได้ก็เข้าระบบได้
async function keyboardLogin(page: Page, email: string) {
  await page.goto("/login");
  const emailField = page.getByLabel("อีเมล");
  await emailField.focus();
  await page.keyboard.type(email);
  // กด Tab แล้วต้องไปที่ช่องรหัสผ่านพอดี ลำดับโฟกัสต้องตรงกับลำดับที่ตาเห็น
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("รหัสผ่าน", { exact: true })).toBeFocused();
  await page.keyboard.type(e2e.password);
  // กด Enter ในช่องกรอกต้องส่งฟอร์มได้เลย ไม่ต้องไปกดปุ่ม
  await page.keyboard.press("Enter");
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
}

// โฟกัสแล้วกด Enter เลียนแบบการกดปุ่มด้วยคีย์บอร์ด เช็คด้วยว่าโฟกัสไปลงจริง
async function activate(control: Locator) {
  await control.focus();
  await expect(control).toBeFocused();
  await control.page().keyboard.press("Enter");
}

// เช็คว่ากด Tab แล้วโฟกัสไปเกาะอะไรสักอย่าง ไม่ใช่หล่นไปที่ body จนกด Tab ต่อไม่ได้
// ใช้ poll เพราะหน้าที่เพิ่งเปลี่ยนอาจยังจัดโฟกัสไม่เสร็จ
async function expectKeyboardFocus(page: Page) {
  await page.keyboard.press("Tab");
  await expect.poll(() => page.evaluate(() => {
    const active = document.activeElement;
    return Boolean(active && active !== document.body && active !== document.documentElement);
  })).toBe(true);
}

// serial บังคับให้รันเรียงกัน ทุกเทสต์ใช้ข้อมูลชุดเดียวกันจึงรันขนานกันไม่ได้
test.describe.serial("keyboard coverage for critical flows", () => {
  test("Login and Owner Dashboard are operable without a pointer", async ({ page }) => {
    await keyboardLogin(page, e2e.ownerEmail);
    await expect(page.getByRole("heading", { name: "แดชบอร์ด" })).toBeVisible();

    const roomsLink = page.getByLabel("เมนูหลัก").getByRole("link", { name: /ผังห้องพัก/ });
    await activate(roomsLink);
    await expect(page).toHaveURL(new RegExp(`/admin/properties/${e2e.propertyId}/rooms$`));
    await expectKeyboardFocus(page);
  });

  // ไล่เช็คสามหน้าหลักของเจ้าของหอ แท็บ กล่องซ้อนกล่อง และเมนู ว่าใช้คีย์บอร์ดได้ครบ
  test("Owner rooms, tenants and contracts support keyboard navigation", async ({ page }) => {
    await keyboardLogin(page, e2e.ownerEmail);

    await page.goto(`/admin/properties/${e2e.propertyId}/rooms`);
    const floorTabs = page.getByRole("tablist", { name: "เลือกชั้น" });
    const allFloors = floorTabs.getByRole("tab", { name: "ทุกชั้น" });
    await allFloors.focus();
    // แท็บตามมาตรฐาน ARIA ใช้ลูกศรเลื่อน ไม่ใช่ Tab และ Home ต้องกลับมาอันแรก
    await page.keyboard.press("ArrowRight");
    await expect(floorTabs.getByRole("tab", { name: "ชั้น 1" })).toBeFocused();
    await page.keyboard.press("Home");
    await expect(allFloors).toBeFocused();

    await page.goto(`/admin/properties/${e2e.propertyId}/tenants`);
    const tenant = page.getByRole("button", { name: /E2E Tenant E101/ });
    await activate(tenant);
    const tenantDialog = page.getByRole("dialog", { name: /ห้อง E101 · E2E Tenant/ });
    await expect(tenantDialog).toBeVisible();
    // เปิดกล่องแล้วโฟกัสต้องย้ายเข้าไปข้างใน ไม่ค้างอยู่ข้างหลังจนกด Tab หลุดออกไปหลังกล่อง
    await expect.poll(() => tenantDialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);

    const startDateTrigger = tenantDialog.getByRole("button", { name: "วันเริ่มสัญญา" });
    await activate(startDateTrigger);
    const calendar = page.getByRole("dialog", { name: "เลือกวันเริ่มสัญญา" });
    await expect(calendar).toBeVisible();
    // ปฏิทินมีแค่วันเดียวที่ Tab เข้าถึงได้ ที่เหลือใช้ลูกศรเลื่อน จึงอ่านวันที่จากช่องที่โฟกัสอยู่
    await expect.poll(() => page.locator(":focus").getAttribute("data-date")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const initialDate = await page.locator(":focus").getAttribute("data-date");
    expect(initialDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => page.locator(":focus").getAttribute("data-date")).not.toBe(initialDate);
    // ไล่กดปุ่มที่ปฏิทินต้องรองรับให้ครบ ไม่เช็คผลทีละปุ่ม แค่ต้องไม่พังกลางทาง
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Home");
    await page.keyboard.press("End");
    await page.keyboard.press("PageDown");
    await page.keyboard.press("Escape");
    // Escape ปิดทีละชั้น ปิดปฏิทินก่อน แล้วโฟกัสต้องเด้งกลับปุ่มที่กดเปิด ไม่ใช่หายไปเฉย ๆ
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
    // ต้องมีข้อความบอกจำนวนผลลัพธ์ที่โปรแกรมอ่านหน้าจออ่านได้ คนที่มองไม่เห็นจะได้รู้ว่าค้นเจอกี่รายการ
    await expect(page.getByRole("status").filter({ hasText: /พบ \d+ รายการ(?:ในหน้านี้)? กำลังแสดงหน้า 1/ })).toHaveCount(1);
    const contractMenu = page.getByRole("button", { name: "จัดการสัญญา CTR-E2E-E101" });
    await activate(contractMenu);
    // เปิดเมนูแล้วต้องโฟกัสรายการแรกให้เลย ตามมาตรฐาน ARIA ของเมนู
    await expect(page.getByRole("menuitem").first()).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(contractMenu).toBeFocused();
  });

  // เช็คงานประจำวันที่พิมพ์เยอะ ต้องทำได้ลื่นด้วยคีย์บอร์ดอย่างเดียว
  test("Owner invoices, meters and parcels support keyboard workflows", async ({ page }) => {
    await keyboardLogin(page, e2e.ownerEmail);

    await page.goto(`/admin/properties/${e2e.propertyId}/invoices`);
    const invoiceFilter = page.getByRole("button", { name: "กรองสถานะ" });
    await invoiceFilter.focus();
    // dropdown ต้องเปิดได้ทั้ง Space และ Enter แล้วโฟกัสลงตัวเลือกแรก
    await page.keyboard.press("Space");
    await expect(page.getByRole("option", { name: "ทุกสถานะ" })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(invoiceFilter).toBeFocused();

    await page.goto(`/admin/properties/${e2e.propertyId}/water-meter`);
    const readings = page.locator('input[aria-label^="เลขมิเตอร์ล่าสุดห้อง"]');
    // กด Enter ในช่องจดมิเตอร์แล้วกระโดดไปห้องถัดไป คนจดจะได้พิมพ์รวดเดียวไม่ต้องละมือ
    // เช็คเฉพาะตอนที่มีห้องให้จด เดือนที่จดครบแล้วช่องจะถูกล็อก
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
    // Shift+Tab จากอันแรกต้องวนไปอันสุดท้ายในกล่อง ไม่หลุดออกไปข้างหลัง
    await page.keyboard.press("Shift+Tab");
    await expect(parcelDialog.getByRole("button", { name: "บันทึกพัสดุ" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(parcelDialog).toBeHidden();
    await expect(parcelTrigger).toBeFocused();
  });

  // เช็คคอมโพเนนต์ที่ใช้ซ้ำทั่วแอป พังตัวเดียวกระทบหลายหน้า
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
    // รวบทุกอย่างที่โฟกัสได้ในกล่อง ไว้เช็คว่าโฟกัสวนอยู่ข้างในไม่หลุดออกไป
    const notificationControls = notificationDialog.locator("a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])");
    await notificationControls.last().focus();
    // Tab จากอันสุดท้ายต้องวนกลับมาอันแรก เป็นหัวใจของการขังโฟกัสไว้ในกล่อง
    await page.keyboard.press("Tab");
    await expect(notificationControls.first()).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(notificationControls.last()).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(notificationDialog).toBeHidden();
    await expect(notifications).toBeFocused();
  });

  // ฝั่งผู้เช่าใช้คนละ layout จึงต้องเช็คแยก
  test("Tenant Portal navigation and modal are keyboard operable", async ({ page }) => {
    await keyboardLogin(page, e2e.tenantEmail);
    const invoiceLink = page.getByRole("navigation", { name: "เมนูผู้เช่า" })
      .getByRole("link", { name: /^บิลและชำระเงิน/ });
    await activate(invoiceLink);
    await expect(page).toHaveURL(/\/tenant\/invoices$/);

    // รายละเอียดบิลกางออกในหน้าเลย ไม่ใช่กล่องซ้อน จึงกดปุ่มเดิมซ้ำเพื่อปิด ไม่ได้ใช้ Escape
    const invoice = page.getByRole("button", { name: /E2E-202607-E101/ });
    await activate(invoice);
    const invoiceDetails = page.getByLabel("รายละเอียดบิล E2E-202607-E101", { exact: true });
    await expect(invoiceDetails).toBeVisible();
    await expect(invoice).toBeFocused();
    await activate(invoice);
    await expect(invoiceDetails).toBeHidden();
    await expect(invoice).toBeFocused();
  });

  // ใช้บัญชีซูเปอร์แอดมินจากข้อมูลตั้งต้น ไม่ใช่บัญชี bootstrap จากไฟล์ env จึงรันได้ทุกเครื่อง
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
