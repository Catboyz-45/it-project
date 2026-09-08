/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นการทดสอบอัตโนมัติของ “subscription access.spec” เพื่อป้องกันพฤติกรรมสำคัญย้อนกลับไปเสีย
 * การทำงาน: เตรียมสถานการณ์ เรียกโค้ดเหมือนผู้ใช้หรือระบบจริง แล้วตรวจผลลัพธ์ทั้งกรณีสำเร็จและกรณีที่ต้องปฏิเสธ
 */

import { expect, type Page, test } from "@playwright/test";
import pg from "pg";
import { e2e } from "./fixtures";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Access Mode” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
type AccessMode = "FULL" | "GRACE" | "READ_ONLY";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “test Database Url” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า: ไม่มี — ใช้ข้อมูลจากขอบเขตของไฟล์หรือค่าที่ระบบเตรียมไว้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function testDatabaseUrl() {
  const value = process.env.DATABASE_URL;
  if (!value || !/test/i.test(new URL(value).pathname)) {
    throw new Error("Subscription E2E tests require a dedicated DATABASE_URL containing 'test'");
  }
  return value;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “query” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - text: ค่า “text” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - values: ค่า “values” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
 */
async function query(text: string, values: unknown[] = []) {
  const pool = new pg.Pool({ connectionString: testDatabaseUrl() });
  try {
    await pool.query(text, values);
  } finally {
    await pool.end();
  }
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: เปลี่ยนข้อมูลหรือสถานะในขั้นตอน “set Access Mode” โดยใช้ค่าที่รับเข้ามา
 * รับค่า:
 * - mode: ค่า “mode” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
 */
async function setAccessMode(mode: AccessMode) {
  const expiresAt = mode === "FULL"
    ? new Date(Date.now() + 30 * 86_400_000)
    : mode === "GRACE"
      ? new Date(Date.now() - 86_400_000)
      : new Date(Date.now() - 10 * 86_400_000);
  await query(
    `UPDATE "PropertySubscription"
     SET "status"=$1, "startsAt"=$2, "expiresAt"=$3, "updatedAt"=NOW()
     WHERE "propertyId"=$4`,
    [mode === "FULL" ? "ACTIVE" : "EXPIRED", new Date(Date.now() - 60 * 86_400_000), expiresAt, e2e.propertyId],
  );
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “login” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - page: ค่า “page” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - email: ค่า “email” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
 */
async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("อีเมล").fill(email);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(e2e.password);
  await page.getByRole("button", { name: /เข้าสู่ระบบ/ }).click();
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “expect No Horizontal Overflow” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - page: ค่า “page” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
 */
async function expectNoHorizontalOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))).toEqual(await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.clientWidth,
  })));
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “expect Minimum Touch Target” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - page: ค่า “page” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - selector: ค่า “selector” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - minimum: ค่า “minimum” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
async function expectMinimumTouchTarget(page: Page, selector: string, minimum = 44) {
  await expect.poll(() => page.locator(selector).evaluateAll((elements, min) => elements
    .filter((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    })
    .map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        height: Math.round(rect.height * 100) / 100,
        label: element.getAttribute("aria-label") ?? element.textContent?.trim() ?? element.tagName,
        width: Math.round(rect.width * 100) / 100,
      };
    })
    .filter(({ height, width }) => height < min || width < min), minimum)).toEqual([]);
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “channel” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - value: ค่า “value” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function channel(value: number) {
  const normalized = value / 255;
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “contrast Ratio” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - locator: ค่า “locator” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
async function contrastRatio(locator: ReturnType<Page["locator"]>) {
  const colors = await locator.evaluate((element) => {
    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: แปลงข้อมูลในขั้นตอน “to Rgb” ให้เป็นรูปแบบมาตรฐานที่ส่วนถัดไปใช้ได้
     * รับค่า:
     * - value: ค่า “value” ที่จำเป็นต่อการทำงานของก้อนนี้
     * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
     */
    const toRgb = (value: string) => {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return [0, 0, 0];
      context.fillStyle = value;
      context.fillRect(0, 0, 1, 1);
      return Array.from(context.getImageData(0, 0, 1, 1).data.slice(0, 3));
    };
    const style = getComputedStyle(element);
    let background = "rgb(255, 255, 255)";
    let ancestor: Element | null = element;
    while (ancestor) {
      const candidate = getComputedStyle(ancestor).backgroundColor;
      const alpha = candidate.match(/[\d.]+/g)?.[3];
      if (alpha === undefined || Number(alpha) > 0) {
        background = candidate;
        break;
      }
      ancestor = ancestor.parentElement;
    }
    return { foreground: toRgb(style.color), background: toRgb(background) };
  });
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “luminance” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - value: ค่า “value” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
   */
  const luminance = (value: number[]) => {
    const [red, green, blue] = value.map(channel);
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  };
  const foreground = luminance(colors.foreground);
  const background = luminance(colors.background);
  return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
}

test.describe.serial("subscription access UX", () => {
  test.afterEach(async () => setAccessMode("FULL"));

  test("FULL keeps owner mutation controls available", async ({ page }) => {
    await setAccessMode("FULL");
    await login(page, e2e.ownerEmail);
    const mainMenu = page.getByLabel("เมนูหลัก");
    await expect(mainMenu.getByRole("link", { name: "แพ็กเกจ SaaS" })).toHaveCount(0);
    await expect(mainMenu.getByRole("link", { name: "คำเชิญผู้เช่า" })).toHaveCount(0);
    await expect(page.getByText(/แพ็กเกจ E2E Standard · ใช้/)).toHaveCount(0);
    await page.goto(`/admin/properties/${e2e.propertyId}/settings`);
    const settingsMenu = page.getByLabel("เมนูตั้งค่า");
    await expect(settingsMenu.getByRole("tab", { name: "คำเชิญผู้เช่า" })).toBeVisible();
    await expect(settingsMenu.getByRole("tab", { name: "แพ็กเกจและการต่ออายุ" })).toBeVisible();
    await page.goto(`/admin/properties/${e2e.propertyId}/contracts`);
    await expect(page.getByRole("button", { name: "สร้างสัญญา" })).toBeEnabled();
    await expect(page.getByText("พื้นที่นี้อยู่ในโหมดอ่านอย่างเดียว")).toHaveCount(0);
  });

  test("GRACE communicates the deadline without disabling work", async ({ page }) => {
    await setAccessMode("GRACE");
    await login(page, e2e.ownerEmail);
    const grace = page.getByRole("status").filter({ hasText: "อยู่ในช่วงผ่อนผัน" });
    await expect(grace).toBeVisible();
    await expect(grace).toContainText("ยังแก้ไขข้อมูลได้ถึง");
    await page.goto(`/admin/properties/${e2e.propertyId}/contracts`);
    await expect(page.getByRole("button", { name: "สร้างสัญญา" })).toBeEnabled();
  });

  test("READ_ONLY preserves reading and renewal while removing mutations", async ({ page }) => {
    await setAccessMode("READ_ONLY");
    await login(page, e2e.ownerEmail);
    const banner = page.getByRole("alert").filter({ hasText: "พื้นที่นี้อยู่ในโหมดอ่านอย่างเดียว" });
    await expect(banner).toBeVisible();
    await expect(banner.getByRole("link", { name: "ต่ออายุแพ็กเกจ" })).toBeVisible();

    await page.goto(`/admin/properties/${e2e.propertyId}/contracts`);
    await expect(page.getByText("CTR-E2E-E101")).toBeVisible();
    await expect(page.getByRole("button", { name: "สร้างสัญญา" })).toHaveCount(0);
    await expect(page.getByRole("status").filter({ hasText: "โหมดอ่านอย่างเดียว" })).toBeVisible();

    await page.goto(`/admin/properties/${e2e.propertyId}/tenants`);
    await expect(page.getByRole("link", { name: "ส่งออก CSV" })).toBeVisible();
    await page.getByRole("button", { name: /E2E Tenant E101/ }).click();
    const dialog = page.getByRole("dialog", { name: /ห้อง E101 · E2E Tenant/ });
    await expect(dialog.getByLabel("ชื่อ-นามสกุล")).toBeDisabled();
    await expect(dialog.getByRole("button", { name: "บันทึกข้อมูลผู้เช่า" })).toHaveCount(0);
    await dialog.getByRole("button", { name: "ปิด", exact: true }).click();

    await page.goto(`/admin/properties/${e2e.propertyId}/subscription`);
    await expect(page.getByRole("button", { name: /สร้างคำสั่งซื้อ|ต่ออายุ/ })).toBeEnabled();
  });

  test("READ_ONLY tenant can read records but cannot submit new data", async ({ page }) => {
    await setAccessMode("READ_ONLY");
    await login(page, e2e.tenantEmail);
    await expect(page.getByRole("alert").filter({ hasText: "หอพักนี้อยู่ในโหมดอ่านอย่างเดียว" })).toBeVisible();

    await page.goto("/tenant/invoices");
    await page.getByRole("button", { name: /E2E-202607-E101/ }).click();
    const invoice = page.getByRole("dialog");
    await expect(invoice.getByText("ไม่สามารถชำระหรือส่งสลิปใหม่ได้", { exact: false })).toBeVisible();
    await expect(invoice.getByRole("button", { name: "ส่งหลักฐาน" })).toHaveCount(0);
    await invoice.getByRole("button", { name: "ปิด", exact: true }).click();

    await page.goto("/tenant/tickets");
    await expect(page.locator("section").getByRole("button", { name: "แจ้งเรื่อง", exact: true })).toHaveCount(0);
    await page.goto("/tenant/chat");
    await expect(page.getByText("อ่านประวัติข้อความได้ แต่ไม่สามารถส่งข้อความใหม่ได้")).toBeVisible();
    await expect(page.getByPlaceholder("พิมพ์ข้อความ...")).toHaveCount(0);
  });

  test("responsive layouts do not overflow at mobile, tablet, or desktop widths", async ({ page }) => {
    await setAccessMode("READ_ONLY");
    await login(page, e2e.ownerEmail);
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 768, height: 1024 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto(`/admin/properties/${e2e.propertyId}/invoices`);
      await expectNoHorizontalOverflow(page);
      await expect(page.getByRole("alert").filter({ hasText: "อ่านอย่างเดียว" })).toBeVisible();
    }
  });

  test("mobile actions expose at least 44 by 44 pixel touch targets", async ({ page }) => {
    await setAccessMode("FULL");
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, e2e.ownerEmail);

    await page.goto(`/admin/properties/${e2e.propertyId}/parcels`);
    await expectMinimumTouchTarget(page, ".parcel-table button, .table-pagination button, .figma-icon-action, .icon-btn");

    const search = page.getByPlaceholder("ค้นหาผู้เช่า ห้อง บิล สัญญา");
    await search.fill("E101");
    await expectMinimumTouchTarget(page, 'button[aria-label="ล้างคำค้น"]');

    await page.getByRole("button", { name: /ศูนย์การแจ้งเตือน/ }).click();
    await expectMinimumTouchTarget(page, '[role="dialog"][aria-label="ศูนย์การแจ้งเตือน"] button');

    await page.goto(`/admin/properties/${e2e.propertyId}/settings`);
    await page.getByRole("tab", { name: "ห้องพัก", exact: true }).click();
    await expectMinimumTouchTarget(page, ".settings-floor-list button, .settings-furniture-grid button, .settings-editable-list button");
  });

  test("keyboard and accessibility semantics expose the read-only state", async ({ page }) => {
    await setAccessMode("READ_ONLY");
    await login(page, e2e.ownerEmail);
    const banner = page.getByRole("alert").filter({ hasText: "พื้นที่นี้อยู่ในโหมดอ่านอย่างเดียว" });
    await expect(banner).toBeVisible();
    await expect(banner).toMatchAriaSnapshot(`
      - alert:
        - strong: พื้นที่นี้อยู่ในโหมดอ่านอย่างเดียว
        - paragraph: ยังดู ค้นหา และดาวน์โหลดข้อมูลเดิมได้ แต่ไม่สามารถเพิ่ม แก้ไข อนุมัติ หรือสร้างรายการใหม่
        - link "ต่ออายุแพ็กเกจ"
    `);
    await page.keyboard.press("Tab");
    await expect.poll(() => page.evaluate(() => document.activeElement?.tagName)).not.toBe("BODY");
    expect(await contrastRatio(banner.locator("strong"))).toBeGreaterThanOrEqual(4.5);
  });

  test("screen reader live regions announce navigation and notification count changes once", async ({ page }) => {
    await setAccessMode("FULL");
    await login(page, e2e.ownerEmail);

    await page.goto(`/admin/properties/${e2e.propertyId}/parcels`);
    await expect(page.getByRole("status").filter({ hasText: "เปิดหน้า คลังพัสดุ" })).toHaveCount(1);

    const notificationButton = page.getByRole("button", { name: /ศูนย์การแจ้งเตือน/ });
    await notificationButton.click();
    const markAllRead = page.getByRole("button", { name: "ทำเครื่องหมายว่าอ่านทั้งหมด" });
    if (await markAllRead.count()) {
      await markAllRead.click();
      await expect(page.getByRole("status").filter({ hasText: "อ่านการแจ้งเตือนครบทั้งหมดแล้ว" })).toHaveCount(1);
    }
  });

  test("shared dialog traps focus, closes on Escape, and restores trigger focus", async ({ page }) => {
    await setAccessMode("FULL");
    await login(page, e2e.ownerEmail);
    await page.goto(`/admin/properties/${e2e.propertyId}/parcels`);

    const trigger = page.getByRole("button", { name: "รับพัสดุใหม่" });
    await trigger.focus();
    await trigger.click();

    const dialog = page.getByRole("dialog", { name: "เพิ่มพัสดุใหม่" });
    const closeButton = dialog.getByRole("button", { name: "ปิด" });
    const lastButton = dialog.getByRole("button", { name: "บันทึกพัสดุ" });
    await expect(dialog).toBeVisible();
    await expect(closeButton).toBeFocused();

    await page.keyboard.press("Shift+Tab");
    await expect(lastButton).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(closeButton).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("icon tooltips support hover, focus, dismissal, action text, and mobile viewport bounds", async ({ page }) => {
    await setAccessMode("FULL");
    await login(page, e2e.ownerEmail);
    await page.goto(`/admin/properties/${e2e.propertyId}/parcels`);

    const trigger = page.getByRole("button", { name: /ศูนย์การแจ้งเตือน/ });
    const expectedText = await trigger.getAttribute("aria-label");
    expect(expectedText).toBeTruthy();

    await trigger.hover();
    let tooltip = page.getByRole("tooltip", { name: expectedText! });
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toHaveText(expectedText!);
    await page.mouse.move(0, 0);
    await expect(tooltip).toBeHidden();

    await trigger.focus();
    tooltip = page.getByRole("tooltip", { name: expectedText! });
    await expect(tooltip).toBeVisible();
    const tooltipId = await tooltip.getAttribute("id");
    expect(tooltipId).toBeTruthy();
    await expect(trigger).toHaveAttribute("aria-describedby", tooltipId!);
    await page.keyboard.press("Escape");
    await expect(tooltip).toBeHidden();
    await expect(trigger).toBeFocused();

    await trigger.blur();
    await expect(page.getByRole("tooltip", { name: expectedText! })).toHaveCount(0);

    await page.setViewportSize({ width: 320, height: 568 });
    await trigger.focus();
    tooltip = page.getByRole("tooltip", { name: expectedText! });
    await expect(tooltip).toBeVisible();
    const bounds = await tooltip.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(568);
  });

  test("slow access checks remain fail-closed and announce progress", async ({ page }) => {
    await setAccessMode("FULL");
    await page.route("**/api/v1/tenant/notifications/summary", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1_500));
      await route.continue();
    });
    await login(page, e2e.tenantEmail);
    await expect(page.getByRole("status").filter({ hasText: "กำลังตรวจสอบสิทธิ์การใช้งาน" })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "กำลังตรวจสอบสิทธิ์การใช้งาน" })).toBeHidden({ timeout: 5_000 });
  });

  test("network errors are not mislabeled as an expired package", async ({ page }) => {
    await setAccessMode("FULL");
    await page.route("**/api/v1/tenant/notifications/summary", (route) => route.abort("failed"));
    await login(page, e2e.tenantEmail);
    await expect(page.getByRole("alert").filter({ hasText: "ยังตรวจสอบสิทธิ์การใช้งานไม่ได้" })).toBeVisible();
    await expect(page.getByText("หอพักนี้อยู่ในโหมดอ่านอย่างเดียว")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "ลองตรวจสอบใหม่" })).toBeVisible();
  });

  test("expired sessions return the user to login", async ({ page }) => {
    await setAccessMode("FULL");
    await login(page, e2e.ownerEmail);
    await query(`UPDATE "Session" SET "expiresAt"=NOW() - INTERVAL '1 minute' WHERE "userId"=$1`, [e2e.ownerId]);
    await page.goto(`/admin/properties/${e2e.propertyId}/contracts`);
    await expect(page).toHaveURL(/\/login(?:\?|$)/);
  });
});
