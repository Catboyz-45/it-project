/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นการทดสอบอัตโนมัติของ “accessibility controls.spec” เพื่อป้องกันพฤติกรรมสำคัญย้อนกลับไปเสีย
 * การทำงาน: เตรียมสถานการณ์ เรียกโค้ดเหมือนผู้ใช้หรือระบบจริง แล้วตรวจผลลัพธ์ทั้งกรณีสำเร็จและกรณีที่ต้องปฏิเสธ
 */

import { expect, type Locator, type Page, test } from "@playwright/test";
import { e2e } from "./fixtures";
import { measureContrast } from "./helpers/contrast";

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
 * หน้าที่: รวมขั้นตอนย่อยของ “contrast Ratio” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - locator: ค่า “locator” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
async function contrastRatio(locator: Locator) {
  return locator.evaluate((element) => {
    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: แปลงข้อมูลในขั้นตอน “parse” ให้เป็นรูปแบบมาตรฐานที่ส่วนถัดไปใช้ได้
     * รับค่า:
     * - value: ค่า “value” ที่จำเป็นต่อการทำงานของก้อนนี้
     * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
     */
    const parse = (value: string) => {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return [0, 0, 0, 1];
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = value;
      context.fillRect(0, 0, 1, 1);
      const [red, green, blue, alpha] = context.getImageData(0, 0, 1, 1).data;
      return [red, green, blue, alpha / 255];
    };
    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: รวมขั้นตอนย่อยของ “composite” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
     * รับค่า:
     * - foreground: ค่า “foreground” ที่จำเป็นต่อการทำงานของก้อนนี้
     * - background: ค่า “background” ที่จำเป็นต่อการทำงานของก้อนนี้
     * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
     */
    const composite = (foreground: number[], background: number[]) => foreground
      .slice(0, 3)
      .map((channel, index) => channel * foreground[3] + background[index] * (1 - foreground[3]));
    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: รวมขั้นตอนย่อยของ “background For” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
     * รับค่า:
     * - start: ค่า “start” ที่จำเป็นต่อการทำงานของก้อนนี้
     * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
     */
    const backgroundFor = (start: Element) => {
      let result = [255, 255, 255];
      const layers: number[][] = [];
      for (let current: Element | null = start; current; current = current.parentElement) {
        const color = parse(getComputedStyle(current).backgroundColor);
        if (color[3] > 0) layers.push(color);
        if (color[3] >= 1) break;
      }
      for (const layer of layers.reverse()) result = composite(layer, result);
      return result;
    };
    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: รวมขั้นตอนย่อยของ “linear” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
     * รับค่า:
     * - value: ค่า “value” ที่จำเป็นต่อการทำงานของก้อนนี้
     * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
     */
    const linear = (value: number) => {
      const normalized = value / 255;
      return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    };
    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: รวมขั้นตอนย่อยของ “luminance” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
     * รับค่า:
     * - color: ค่า “color” ที่จำเป็นต่อการทำงานของก้อนนี้
     * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
     */
    const luminance = (color: number[]) => 0.2126 * linear(color[0]) + 0.7152 * linear(color[1]) + 0.0722 * linear(color[2]);
    const background = backgroundFor(element);
    const foreground = composite(parse(getComputedStyle(element).color), background);
    const light = Math.max(luminance(foreground), luminance(background));
    const dark = Math.min(luminance(foreground), luminance(background));
    return (light + 0.05) / (dark + 0.05);
  });
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “expect Touch Target” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - locator: ค่า “locator” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
 */
async function expectTouchTarget(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box, "control must have a rendered bounding box").not.toBeNull();
  expect(box!.width, "touch target width").toBeGreaterThanOrEqual(44);
  expect(box!.height, "touch target height").toBeGreaterThanOrEqual(44);
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “expect Visible Focus Indicator” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - locator: ค่า “locator” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
async function expectVisibleFocusIndicator(locator: Locator) {
  await locator.focus();
  // Programmatic focus does not always activate :focus-visible for button-like
  // controls. Move away and back with the keyboard to test the real Tab path.
  await locator.page().keyboard.press("Tab");
  await locator.page().keyboard.press("Shift+Tab");
  await expect(locator).toBeFocused();
  await expect.poll(() => locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      outlineColor: style.outlineColor,
      outlineStyle: style.outlineStyle,
      outlineWidth: Number.parseFloat(style.outlineWidth),
      shadow: style.boxShadow,
    };
  })).toMatchObject({
    outlineColor: "rgb(70, 81, 199)",
    outlineStyle: "solid",
    outlineWidth: 3,
  });
  expect(await locator.evaluate((element) => getComputedStyle(element).boxShadow)).not.toBe("none");
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “expect Tooltip On Keyboard Focus” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - locator: ค่า “locator” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - text: ค่า “text” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
async function expectTooltipOnKeyboardFocus(locator: Locator, text: string) {
  await locator.focus();
  await expect(locator).toBeFocused();
  const tooltipId = await locator.getAttribute("aria-describedby");
  expect(tooltipId).toBeTruthy();
  const tooltip = locator.page().locator(`[role="tooltip"]#${tooltipId}`);
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toHaveText(text);
  await expect.poll(() => tooltip.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return rect.left >= 0 && rect.right <= window.innerWidth && rect.top >= 0 && rect.bottom <= window.innerHeight;
  })).toBe(true);
  await locator.blur();
  await expect(tooltip).toBeHidden();
  await locator.hover();
  const currentLabel = await locator.getAttribute("aria-label");
  await expect(locator.page().getByRole("tooltip")).toHaveText(currentLabel ?? text);
  await locator.focus();
}

test.describe("Owner accessibility controls", () => {
  test("empty search results are compact, centered and clearly red", async ({ page }) => {
    await login(page, e2e.ownerEmail);
    await page.goto(`/admin/properties/${e2e.propertyId}/contracts`);
    await page.getByLabel("ค้นหาสัญญา").fill("ไม่มีรายการนี้แน่นอน-e2e");

    const emptyResult = page.getByRole("status").filter({ hasText: "ไม่พบสัญญาที่ค้นหา" });
    await expect(emptyResult).toBeVisible();
    const layout = await emptyResult.evaluate((element) => {
      const container = element.getBoundingClientRect();
      const icon = element.querySelector("svg")?.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        height: container.height,
        iconOffset: icon ? Math.abs((icon.left + icon.width / 2) - (container.left + container.width / 2)) : null,
        textAlign: style.textAlign,
        width: container.width,
      };
    });

    const color = await measureContrast(emptyResult);
    const channels = color.foreground.match(/\d+/g)?.map(Number);
    expect(color.ratio, "empty-state text must meet WCAG AA contrast").toBeGreaterThanOrEqual(4.5);
    expect(channels, "normalized foreground color must expose RGB channels").toHaveLength(3);
    expect(channels![0], "empty-state text must remain visually red").toBeGreaterThan(channels![1]);
    expect(channels![0], "empty-state text must remain visually red").toBeGreaterThan(channels![2]);
    expect(layout.height).toBeLessThan(180);
    expect(layout.iconOffset).not.toBeNull();
    expect(layout.iconOffset!).toBeLessThan(2);
    expect(layout.textAlign).toBe("center");
    expect(layout.width).toBeLessThanOrEqual(512);
  });

  test("document toolbar exposes toggle state, keyboard navigation and focus tooltips", async ({ page }) => {
    await login(page, e2e.ownerEmail);
    const templateStatus = await page.evaluate(async (propertyId) => {
      const response = await fetch(`/api/document-templates/contract?propertyId=${encodeURIComponent(propertyId)}`, {
        body: "{}",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      return response.status;
    }, e2e.propertyId);
    expect(templateStatus).toBeLessThan(300);
    await page.goto(`/settings/documents/contract/edit?propertyId=${e2e.propertyId}`);

    const toolbar = page.getByRole("toolbar", { name: "เครื่องมือจัดรูปแบบ" });
    const heading = toolbar.getByRole("button", { exact: true, name: "หัวข้อ" });
    const bold = toolbar.getByRole("button", { name: "ตัวหนา" });
    const center = toolbar.getByRole("button", { name: "กึ่งกลาง" });
    await expect(toolbar).toBeVisible();

    await heading.focus();
    await page.keyboard.press("ArrowRight");
    await expect(bold).toBeFocused();
    await expect(page.getByRole("tooltip", { name: "ตัวหนา" })).toBeVisible();
    await page.keyboard.press("End");
    await expect(toolbar.locator("button, input").last()).toBeFocused();
    await page.keyboard.press("Home");
    await expect(heading).toBeFocused();

    const editor = page.getByRole("textbox", { name: "เนื้อหา template" });
    await editor.evaluate((element) => {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      const textNode = walker.nextNode();
      if (!textNode?.textContent) throw new Error("Seeded document must contain text");
      const range = document.createRange();
      range.selectNodeContents(textNode);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      document.dispatchEvent(new Event("selectionchange"));
    });
    await bold.click();
    await expect(bold).toHaveAttribute("aria-pressed", "true");

    await editor.click();
    await center.click();
    await expect(center).toHaveAttribute("aria-pressed", "true");
    await expect(toolbar.getByRole("button", { name: "ชิดซ้าย" })).toHaveAttribute("aria-pressed", "false");
  });

  test("focus indicators are consistent for links, fields, cards and tabs", async ({ page }) => {
    await login(page, e2e.ownerEmail);

    await expectVisibleFocusIndicator(page.getByRole("link", { name: "แดชบอร์ด" }));
    await page.goto(`/admin/properties/${e2e.propertyId}/announcements`);
    await page.getByRole("button", { name: "สร้างประกาศ" }).click();
    const dialog = page.getByRole("dialog", { name: "สร้างประกาศใหม่" });
    await expectVisibleFocusIndicator(dialog.getByLabel("หัวข้อประกาศ"));
    await expectVisibleFocusIndicator(dialog.getByRole("button", { name: "กลุ่มผู้รับ" }));
    await page.keyboard.press("Escape");

    await page.goto(`/admin/properties/${e2e.propertyId}/rooms`);
    await expectVisibleFocusIndicator(page.getByRole("tab", { name: "ทุกชั้น" }));
    await expectVisibleFocusIndicator(page.getByRole("button", { name: /จัดการห้อง E101|ดูรายละเอียดห้อง E101/ }));
  });

  test("dropdown supports complete keyboard navigation and type-ahead", async ({ page }) => {
    await login(page, e2e.ownerEmail);
    await page.goto(`/admin/properties/${e2e.propertyId}/invoices`);

    const trigger = page.getByRole("button", { name: "กรองสถานะ" });
    await trigger.focus();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("option", { name: "ทุกสถานะ" })).toBeFocused();

    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("option", { name: "ฉบับร่าง" })).toBeFocused();
    await page.keyboard.press("End");
    await expect(page.getByRole("option", { name: "ยกเลิก" })).toBeFocused();
    await page.keyboard.press("Home");
    await expect(page.getByRole("option", { name: "ทุกสถานะ" })).toBeFocused();

    for (const key of Array.from("ค้าง")) {
      await page.locator(":focus").dispatchEvent("keydown", { key });
    }
    await expect(page.getByRole("option", { name: "ค้างชำระ" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(trigger).toContainText("ค้างชำระ");

    await trigger.focus();
    await page.keyboard.press("Space");
    await expect(page.getByRole("option", { name: "ค้างชำระ" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    await expect(page.getByRole("listbox")).toBeHidden();
  });

  test("keyboard menu, tooltip, contrast and mobile targets meet the UI contract", async ({ page }) => {
    await login(page, e2e.ownerEmail);
    await page.goto(`/admin/properties/${e2e.propertyId}/announcements`);

    const createButton = page.getByRole("button", { name: "สร้างประกาศ" });
    await expect(createButton).toBeVisible();
    expect(await contrastRatio(createButton)).toBeGreaterThanOrEqual(4.5);

    const menuTrigger = page.getByRole("button", { name: "จัดการประกาศ ประกาศ E2E" });
    await expectTooltipOnKeyboardFocus(menuTrigger, "จัดการประกาศ ประกาศ E2E");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("menuitem", { name: "แก้ไข" })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("menuitem", { name: "ลบ" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(menuTrigger).toBeFocused();

    await createButton.focus();
    await page.keyboard.press("Enter");
    const announcementDialog = page.getByRole("dialog", { name: "สร้างประกาศใหม่" });
    await expect(announcementDialog).toBeVisible();
    await expect(announcementDialog).toHaveAttribute("aria-describedby", "create-announcement-description");
    await expect(announcementDialog.getByLabel("หัวข้อประกาศ")).toBeFocused();

    const dialogButtons = announcementDialog.getByRole("button");
    await dialogButtons.last().focus();
    await page.keyboard.press("Tab");
    await expect(announcementDialog.getByRole("button", { name: "ปิด" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(announcementDialog).toBeHidden();
    await expect(createButton).toBeFocused();

    await menuTrigger.click();
    await page.getByRole("menuitem", { name: "ลบ" }).click();
    const confirmation = page.getByRole("alertdialog", { name: /ลบ/ });
    await expect(confirmation).toBeVisible();
    const confirmationLayout = await confirmation.evaluate((element) => {
      const dialog = element.getBoundingClientRect();
      const backdrop = element.parentElement?.getBoundingClientRect();
      return {
        backdropBottom: backdrop?.bottom,
        backdropLeft: backdrop?.left,
        backdropRight: backdrop?.right,
        backdropTop: backdrop?.top,
        dialogWidth: dialog.width,
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth,
      };
    });
    expect(confirmationLayout.backdropTop).toBe(0);
    expect(confirmationLayout.backdropLeft).toBe(0);
    expect(confirmationLayout.backdropRight).toBe(confirmationLayout.viewportWidth);
    expect(confirmationLayout.backdropBottom).toBe(confirmationLayout.viewportHeight);
    expect(confirmationLayout.dialogWidth).toBeLessThanOrEqual(512);
    await confirmation.getByRole("button", { name: "ยกเลิก" }).click();
    await expect(confirmation).toBeHidden();
    await expect(menuTrigger).toBeFocused();
    await expect.poll(() => page.evaluate(() => document.activeElement !== document.body)).toBe(true);

    await page.setViewportSize({ width: 390, height: 844 });
    await expectTouchTarget(createButton);
    await expectTouchTarget(menuTrigger);
  });
});

test.describe("Tenant accessibility controls", () => {
  test("keyboard tooltip, contrast and mobile targets meet the UI contract", async ({ page }) => {
    await login(page, e2e.tenantEmail);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/tenant");

    const notificationButton = page.getByRole("button", { name: /ศูนย์การแจ้งเตือน/ });
    const notificationLabel = await notificationButton.getAttribute("aria-label");
    expect(notificationLabel).toBeTruthy();
    await expectTooltipOnKeyboardFocus(notificationButton, notificationLabel!);
    await expectTouchTarget(notificationButton);
    expect(await contrastRatio(notificationButton)).toBeGreaterThanOrEqual(4.5);

    await page.keyboard.press("Enter");
    const notificationDialog = page.getByRole("dialog", { name: "ศูนย์การแจ้งเตือน" });
    await expect(notificationDialog).toBeVisible();
    await expect(notificationDialog).toHaveAttribute("aria-modal", "true");
    await expect.poll(() => notificationDialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
    const closeButton = notificationDialog.getByRole("button", { name: "ปิดศูนย์การแจ้งเตือน" });
    await expectTouchTarget(closeButton);
    await closeButton.focus();
    await page.keyboard.press("Enter");
    await expect(notificationDialog).toBeHidden();
    await expect(notificationButton).toBeFocused();

    const mobileNavigation = page.getByRole("navigation", { name: "เมนูผู้เช่าบนมือถือ" });
    const homeLink = mobileNavigation.getByRole("link", { name: "หน้าหลัก" });
    await expectTouchTarget(homeLink);
    expect(await contrastRatio(homeLink)).toBeGreaterThanOrEqual(4.5);
  });
});
