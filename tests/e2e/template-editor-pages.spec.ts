import { expect, type Page, test } from "@playwright/test";
import { e2e } from "./fixtures";
import { expectLeftLoginPage, openLoginForm } from "./helpers/login";

// ตัวแก้ไขแบบฟอร์มต้องแบ่งหน้า จัดย่อหน้า และย้อนกลับได้แบบโปรแกรมเอกสารทั่วไป
// ไม่กดบันทึกเลยในไฟล์นี้ แบบฟอร์มของหอทดสอบจึงไม่เปลี่ยน

async function openStandardTemplate(page: Page) {
  await openLoginForm(page);
  await page.getByLabel("อีเมล").fill(e2e.ownerEmail);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(e2e.password);
  await page.getByRole("button", { name: /เข้าสู่ระบบ/ }).click();
  await expectLeftLoginPage(page);
  // หอที่ยังไม่เคยมีแบบฟอร์มต้องสร้างก่อนถึงจะเปิดหน้าแก้ไขได้
  const status = await page.evaluate(async (propertyId) => (await fetch(`/api/document-templates/contract?propertyId=${encodeURIComponent(propertyId)}`, {
    body: "{}",
    headers: { "Content-Type": "application/json" },
    method: "POST",
  })).status, e2e.propertyId);
  expect(status).toBeLessThan(300);
  await page.goto(`/settings/documents/contract/edit?propertyId=${e2e.propertyId}`);
  const editor = page.getByRole("textbox", { name: "เนื้อหาแบบฟอร์ม" });
  await expect(editor).toBeVisible();
  await page.getByRole("button", { name: "คืนค่าแบบฟอร์มมาตรฐาน" }).click();
  await page.getByRole("button", { name: "คืนค่ามาตรฐาน" }).click();
  await expect(editor.locator(".page-break-remove").first()).toBeVisible();
  return editor;
}

const manualBreaks = (page: Page) => page.locator(".document-editor-paper .page-break:not(.editor-auto-page-break)");

// วางเคอร์เซอร์ในย่อหน้าด้วยโค้ด เพราะตำแหน่งคลิกบนกระดาษที่ย่อพอดีจอไม่แน่นอน
async function placeCaret(page: Page, where: "after-first-break" | "middle-of-long-paragraph") {
  await page.evaluate((where) => {
    const paper = document.querySelector<HTMLElement>(".document-editor-paper");
    if (!paper) throw new Error("Editor is missing");
    const range = document.createRange();
    if (where === "after-first-break") {
      const block = paper.querySelector(".page-break:not(.editor-auto-page-break)")?.nextElementSibling;
      if (!block) throw new Error("Standard template must have a page break");
      range.setStart(block, 0);
    } else {
      const paragraph = Array.from(paper.querySelectorAll("p")).find((item) => (item.textContent ?? "").length > 80);
      const text = paragraph && document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT).nextNode();
      if (!paragraph || !text) throw new Error("Standard template must have a long paragraph");
      paragraph.dataset.testParagraph = "true";
      range.setStart(text, 10);
    }
    paper.focus();
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
  }, where);
}

test("page breaks split at the caret, merge with Backspace and undo cleanly", async ({ page }) => {
  await openStandardTemplate(page);
  const before = await manualBreaks(page).count();

  await placeCaret(page, "middle-of-long-paragraph");
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(manualBreaks(page)).toHaveCount(before + 1);
  // ย่อหน้าถูกตัดตรงเคอร์เซอร์ ท่อนหลังไปเริ่มหน้าใหม่ ไม่ใช่ทั้งย่อหน้า
  // ท่อนหลังเป็นสำเนาของย่อหน้าเดิม จึงได้ data-test-paragraph ไปด้วย ตัวแรกคือท่อนหน้า
  const split = page.locator("[data-test-paragraph]").first();
  await expect(split).toHaveText(/^.{10}$/);
  await page.keyboard.type("Z");
  await expect(split.locator("xpath=following-sibling::*[2]")).toHaveText(/^Z/);

  // Backspace ที่ต้นหน้ารวมกับหน้าก่อน แล้วย้อนกลับได้ทีละขั้น ไม่กระโดดข้ามไปไกล
  await placeCaret(page, "after-first-break");
  await page.keyboard.press("Backspace");
  await expect(manualBreaks(page)).toHaveCount(before);
  await page.keyboard.press("ControlOrMeta+z");
  await expect(manualBreaks(page)).toHaveCount(before + 1);

  // ป้ายในช่องเทาเอาตัวแบ่งออกได้ด้วยคลิกเดียว
  await page.locator(".page-break-remove").first().click();
  await expect(manualBreaks(page)).toHaveCount(before);

  // พิมพ์ต่อหลังลูกศรลงข้ามขอบหน้า ตัวอักษรต้องไม่หลุดเข้าไปในตัวแบ่งหน้า
  await placeCaret(page, "after-first-break");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("End");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.type("Q");
  await expect(manualBreaks(page).first()).toHaveText("ตัวแบ่งหน้า ✕");
});

test("heading and list buttons restyle the whole paragraph and toggle back", async ({ page }) => {
  await openStandardTemplate(page);
  const toolbar = page.getByRole("toolbar", { name: "เครื่องมือจัดรูปแบบ" });
  await placeCaret(page, "middle-of-long-paragraph");
  const firstWords = await page.locator("[data-test-paragraph]").first().evaluate((element) => (element.textContent ?? "").slice(0, 12));

  await toolbar.getByRole("button", { exact: true, name: "หัวข้อ" }).click();
  await expect(page.locator(".document-editor-paper h2", { hasText: firstWords })).toHaveCount(1);
  await expect(page.locator(".document-editor-paper p h2")).toHaveCount(0);
  await toolbar.getByRole("button", { exact: true, name: "หัวข้อ" }).click();
  await expect(page.locator(".document-editor-paper p", { hasText: firstWords })).not.toHaveCount(0);

  await toolbar.getByRole("button", { name: "รายการแบบจุด" }).click();
  await expect(page.locator(".document-editor-paper li", { hasText: firstWords })).toHaveCount(1);
  await expect(page.locator(".document-editor-paper li", { hasText: /^รายการ$/ })).toHaveCount(0);
  await toolbar.getByRole("button", { name: "รายการแบบจุด" }).click();
  await expect(page.locator(".document-editor-paper li", { hasText: firstWords })).toHaveCount(0);
});

test("Tab moves between table cells and adds a row from the last cell", async ({ page }) => {
  await openStandardTemplate(page);
  await placeCaret(page, "middle-of-long-paragraph");
  await page.getByRole("toolbar", { name: "เครื่องมือจัดรูปแบบ" }).getByRole("button", { name: /แทรก/ }).click();
  await page.getByRole("menuitem", { name: /ตาราง/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "แทรกตาราง" }).click();
  const table = page.locator(".document-editor-paper table");
  await expect(table.locator("tr")).toHaveCount(3);

  await table.locator("th").first().click();
  await page.keyboard.press("Tab");
  await page.keyboard.type("ช่องสอง");
  await expect(table.locator("th").nth(1)).toHaveText("ช่องสอง");
  await expect(page.getByRole("textbox", { name: "เนื้อหาแบบฟอร์ม" })).toBeFocused();

  await table.locator("td").last().click();
  await page.keyboard.press("Tab");
  await expect(table.locator("tr")).toHaveCount(4);
});
