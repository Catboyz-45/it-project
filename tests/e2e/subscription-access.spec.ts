import { expect, type Page, test } from "@playwright/test";
import pg from "pg";
import { e2e } from "./fixtures";

// สามระดับสิทธิ์ตามอายุแพ็กเกจ ใช้ได้เต็ม ช่วงผ่อนผัน และเหลือแค่อ่าน
type AccessMode = "FULL" | "GRACE" | "READ_ONLY";

// ด่านกันพลาด ไฟล์นี้แก้ข้อมูลในฐานโดยตรง ชื่อฐานต้องมีคำว่า test เท่านั้น
function testDatabaseUrl() {
  const value = process.env.DATABASE_URL;
  if (!value || !/test/i.test(new URL(value).pathname)) {
    throw new Error("Subscription E2E tests require a dedicated DATABASE_URL containing 'test'");
  }
  return value;
}

// ยิง SQL ตรงเพื่อดัดวันหมดอายุ เร็วกว่าการไปกดผ่านหน้าจอมาก
// เปิดปิด pool ทุกครั้ง ใช้ไม่บ่อยจึงไม่คุ้มที่จะเปิดค้างไว้
async function query(text: string, values: unknown[] = []) {
  const pool = new pg.Pool({ connectionString: testDatabaseUrl() });
  try {
    await pool.query(text, values);
  } finally {
    await pool.end();
  }
}

// ปรับวันหมดอายุเพื่อพาหอไปอยู่ในสิทธิ์ที่ต้องการ
// FULL หมดอีก 30 วัน GRACE หมดเมื่อวาน READ_ONLY หมดไป 10 วันซึ่งพ้นช่วงผ่อนผันแล้ว
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

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("อีเมล").fill(email);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(e2e.password);
  await page.getByRole("button", { name: /เข้าสู่ระบบ/ }).click();
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
}

// เช็คว่าไม่มีอะไรล้นจนต้องเลื่อนซ้ายขวา เทียบ scrollWidth กับ clientWidth ต้องเท่ากัน
async function expectNoHorizontalOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))).toEqual(await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.clientWidth,
  })));
}

// ปุ่มต้องไม่เล็กกว่า 44x44 พิกเซล วัดทุกปุ่มรวดเดียวในเบราว์เซอร์เพื่อความเร็ว
async function expectMinimumTouchTarget(page: Page, selector: string, minimum = 44) {
  await expect.poll(() => page.locator(selector).evaluateAll((elements, min) => elements
    // ตัดปุ่มที่ซ่อนอยู่ออกก่อน วัดขนาดไปก็ได้ศูนย์แล้วตกทุกอัน
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

// แปลงค่าสีเป็นความสว่างเชิงเส้น ตัวเลขทั้งหมดมาจากสเปก sRGB
function channel(value: number) {
  const normalized = value / 255;
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

// วัดความต่างของสีตามสูตรของ WCAG ใช้เช็คว่าข้อความอ่านออกจริง
async function contrastRatio(locator: ReturnType<Page["locator"]>) {
  const colors = await locator.evaluate((element) => {
    // ยืมมือ canvas แปลงสี CSS ทุกรูปแบบเป็นตัวเลข rgb ไม่ต้องเขียนตัวแปลงเอง
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
    // ไล่ขึ้นไปหาตัวแม่จนเจอชั้นที่ไม่โปร่งใส เพราะตัวเองอาจมองทะลุไปเห็นพื้นหลังข้างหลัง
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
  const luminance = (value: number[]) => {
    const [red, green, blue] = value.map(channel);
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  };
  const foreground = luminance(colors.foreground);
  const background = luminance(colors.background);
  // สูตรอัตราส่วนของ WCAG บวก 0.05 กันการหารด้วยศูนย์ตอนพื้นดำสนิท
  return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
}

// serial บังคับให้รันเรียงกัน ทุกเทสต์แก้แพ็กเกจของหอเดียวกัน รันขนานกันจะชนกัน
test.describe.serial("subscription access UX", () => {
  // คืนสิทธิ์เป็นเต็มหลังจบทุกเทสต์ เทสต์ตัวถัดไปจะได้เริ่มจากสภาพปกติ
  test.afterEach(async () => setAccessMode("FULL"));

  // สิทธิ์เต็มต้องแก้ไขอะไรก็ได้ และต้องไม่มีป้ายเตือนโหมดอ่านอย่างเดียวโผล่มา
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

  // ช่วงผ่อนผันต้องเตือนให้เห็นแต่ยังทำงานได้ปกติ ไม่ใช่ตัดการใช้งานทันทีที่หมดอายุ
  test("GRACE communicates the deadline without disabling work", async ({ page }) => {
    await setAccessMode("GRACE");
    await login(page, e2e.ownerEmail);
    const grace = page.getByRole("status").filter({ hasText: "อยู่ในช่วงผ่อนผัน" });
    await expect(grace).toBeVisible();
    await expect(grace).toContainText("ยังแก้ไขข้อมูลได้ถึง");
    await page.goto(`/admin/properties/${e2e.propertyId}/contracts`);
    await expect(page.getByRole("button", { name: "สร้างสัญญา" })).toBeEnabled();
  });

  // โหมดอ่านอย่างเดียวยังต้องดูข้อมูลเดิม ส่งออกไฟล์ และต่ออายุได้
  // ถ้าต่ออายุไม่ได้ด้วยก็จะกลายเป็นทางตัน ลูกค้าจ่ายเงินไม่ได้
  test("READ_ONLY preserves reading and renewal while removing mutations", async ({ page }) => {
    await setAccessMode("READ_ONLY");
    await login(page, e2e.ownerEmail);
    const banner = page.getByRole("alert").filter({ hasText: "พื้นที่นี้อยู่ในโหมดอ่านอย่างเดียว" });
    await expect(banner).toBeVisible();
    await expect(banner.getByRole("link", { name: "ต่ออายุแพ็กเกจ" })).toBeVisible();

    await page.goto(`/admin/properties/${e2e.propertyId}/contracts`);
    await expect(page.getByText("CTR-E2E-E101")).toBeVisible();
    // ปุ่มที่แก้ข้อมูลต้องหายไปเลย ไม่ใช่แค่กดไม่ได้ จะได้ไม่หลอกให้กดแล้วเจอ error
    await expect(page.getByRole("button", { name: "สร้างสัญญา" })).toHaveCount(0);
    await expect(page.getByRole("status").filter({ hasText: "โหมดอ่านอย่างเดียว" })).toBeVisible();

    await page.goto(`/admin/properties/${e2e.propertyId}/tenants`);
    await expect(page.getByRole("link", { name: "ส่งออก CSV" })).toBeVisible();
    await page.getByRole("button", { name: /E2E Tenant E101/ }).click();
    const dialog = page.getByRole("dialog", { name: /ห้อง E101 · E2E Tenant/ });
    // ยังเปิดดูรายละเอียดได้ แต่ช่องกรอกถูกล็อกและปุ่มบันทึกหายไป
    await expect(dialog.getByLabel("ชื่อ-นามสกุล")).toBeDisabled();
    await expect(dialog.getByRole("button", { name: "บันทึกข้อมูลผู้เช่า" })).toHaveCount(0);
    await dialog.getByRole("button", { name: "ปิด", exact: true }).click();

    await page.goto(`/admin/properties/${e2e.propertyId}/subscription`);
    await expect(page.getByRole("button", { name: /สร้างคำสั่งซื้อ|ต่ออายุ/ })).toBeEnabled();
  });

  // ฝั่งผู้เช่าก็ถูกจำกัดตามหอ ดูของเดิมได้แต่ส่งของใหม่ไม่ได้
  test("READ_ONLY tenant can read records but cannot submit new data", async ({ page }) => {
    await setAccessMode("READ_ONLY");
    await login(page, e2e.tenantEmail);
    await expect(page.getByRole("alert").filter({ hasText: "หอพักนี้อยู่ในโหมดอ่านอย่างเดียว" })).toBeVisible();

    await page.goto("/tenant/invoices");
    await page.getByRole("button", { name: /E2E-202607-E101/ }).click();
    const invoice = page.getByLabel("รายละเอียดบิล E2E-202607-E101", { exact: true });
    await expect(invoice.getByText("ไม่สามารถชำระหรือส่งสลิปใหม่ได้", { exact: false })).toBeVisible();
    await expect(invoice.getByRole("button", { name: "ส่งหลักฐาน" })).toHaveCount(0);

    await page.goto("/tenant/tickets");
    await expect(page.locator("section").getByRole("button", { name: "แจ้งเรื่อง", exact: true })).toHaveCount(0);
    await page.goto("/tenant/chat");
    await expect(page.getByText("อ่านประวัติข้อความได้ แต่ไม่สามารถส่งข้อความใหม่ได้")).toBeVisible();
    await expect(page.getByPlaceholder("พิมพ์ข้อความ...")).toHaveCount(0);
  });

  // ป้ายเตือนโหมดอ่านอย่างเดียวต้องไม่ดันให้หน้าล้นในจอทุกขนาด
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

  // ไล่เช็คขนาดปุ่มในหน้าที่กดบ่อยบนมือถือ
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

  // ป้ายเตือนต้องสื่อถึงโปรแกรมอ่านหน้าจอด้วย ไม่ใช่แค่คนที่มองเห็นเท่านั้นที่รู้
  test("keyboard and accessibility semantics expose the read-only state", async ({ page }) => {
    await setAccessMode("READ_ONLY");
    await login(page, e2e.ownerEmail);
    const banner = page.getByRole("alert").filter({ hasText: "พื้นที่นี้อยู่ในโหมดอ่านอย่างเดียว" });
    await expect(banner).toBeVisible();
    // ล็อกโครงสร้าง ARIA ไว้ทั้งก้อน แก้ป้ายแล้วโครงสร้างเปลี่ยนจะรู้ทันที
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

  // ข้อความแจ้งต้องประกาศครั้งเดียว ประกาศซ้ำจะกวนคนที่ใช้โปรแกรมอ่านหน้าจอมาก
  test("screen reader live regions announce navigation and notification count changes once", async ({ page }) => {
    await setAccessMode("FULL");
    await login(page, e2e.ownerEmail);

    await page.goto(`/admin/properties/${e2e.propertyId}/parcels`);
    // toHaveCount(1) เป็นหัวใจของเทสต์นี้ ไม่ใช่แค่เช็คว่ามี แต่ต้องมีอันเดียว
    await expect(page.getByRole("status").filter({ hasText: "เปิดหน้า คลังพัสดุ" })).toHaveCount(1);

    const notificationButton = page.getByRole("button", { name: /ศูนย์การแจ้งเตือน/ });
    await notificationButton.click();
    const markAllRead = page.getByRole("button", { name: "ทำเครื่องหมายว่าอ่านทั้งหมด" });
    if (await markAllRead.count()) {
      await markAllRead.click();
      await expect(page.getByRole("status").filter({ hasText: "อ่านการแจ้งเตือนครบทั้งหมดแล้ว" })).toHaveCount(1);
    }
  });

  // สัญญาสามข้อของกล่องซ้อนที่ใช้ทั่วแอป ขังโฟกัส ปิดด้วย Escape และคืนโฟกัสให้ปุ่มเดิม
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

    // Shift+Tab จากอันแรกวนไปอันสุดท้าย แล้ว Tab วนกลับมา คือการขังโฟกัสไว้ในกล่อง
    await page.keyboard.press("Shift+Tab");
    await expect(lastButton).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(closeButton).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  // tooltip ต้องใช้ได้ทั้งเมาส์และคีย์บอร์ด ปิดด้วย Escape ได้ และไม่ล้นจอบนมือถือ
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
    // ผูกกันด้วย aria-describedby โปรแกรมอ่านหน้าจอจึงอ่าน tooltip ต่อจากชื่อปุ่มได้
    await expect(trigger).toHaveAttribute("aria-describedby", tooltipId!);
    await page.keyboard.press("Escape");
    await expect(tooltip).toBeHidden();
    await expect(trigger).toBeFocused();

    await trigger.blur();
    await expect(page.getByRole("tooltip", { name: expectedText! })).toHaveCount(0);

    // ย่อเป็นจอเล็กสุด tooltip ต้องยังอยู่ในจอครบทั้งสี่ด้าน
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

  // API ช้าต้องขึ้นว่ากำลังตรวจสอบ ไม่ใช่เดาไปก่อนว่ามีสิทธิ์แล้วปล่อยให้ใช้
  test("slow access checks remain fail-closed and announce progress", async ({ page }) => {
    await setAccessMode("FULL");
    // หน่วงคำขอไว้ 1.5 วินาทีเพื่อจำลองเน็ตช้า
    await page.route("**/api/v1/tenant/notifications/summary", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1_500));
      await route.continue();
    });
    await login(page, e2e.tenantEmail);
    await expect(page.getByRole("status").filter({ hasText: "กำลังตรวจสอบสิทธิ์การใช้งาน" })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "กำลังตรวจสอบสิทธิ์การใช้งาน" })).toBeHidden({ timeout: 5_000 });
  });

  // เน็ตพังกับแพ็กเกจหมดอายุเป็นคนละเรื่อง ต้องไม่ขึ้นข้อความผิดจนลูกค้าเข้าใจว่าต้องจ่ายเงิน
  test("network errors are not mislabeled as an expired package", async ({ page }) => {
    await setAccessMode("FULL");
    await page.route("**/api/v1/tenant/notifications/summary", (route) => route.abort("failed"));
    await login(page, e2e.tenantEmail);
    await expect(page.getByRole("alert").filter({ hasText: "ยังตรวจสอบสิทธิ์การใช้งานไม่ได้" })).toBeVisible();
    await expect(page.getByText("หอพักนี้อยู่ในโหมดอ่านอย่างเดียว")).toHaveCount(0);
    // ต้องมีปุ่มให้ลองใหม่ ไม่ใช่ทางตันที่ต้องปิดหน้าทิ้ง
    await expect(page.getByRole("button", { name: "ลองตรวจสอบใหม่" })).toBeVisible();
  });

  // เซสชันหมดอายุระหว่างใช้งานต้องเด้งกลับหน้า login ไม่ใช่ค้างอยู่หน้าเดิมแล้วขึ้น error
  test("expired sessions return the user to login", async ({ page }) => {
    await setAccessMode("FULL");
    await login(page, e2e.ownerEmail);
    await query(`UPDATE "Session" SET "expiresAt"=NOW() - INTERVAL '1 minute' WHERE "userId"=$1`, [e2e.ownerId]);
    await page.goto(`/admin/properties/${e2e.propertyId}/contracts`);
    await expect(page).toHaveURL(/\/login(?:\?|$)/);
  });
});
