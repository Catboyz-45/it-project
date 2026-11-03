import { expect, test } from "@playwright/test";
import { e2e } from "./fixtures";
import { expectLeftLoginPage, openLoginForm } from "./helpers/login";

async function loginAsOwner(page: import("@playwright/test").Page) {
  await openLoginForm(page);
  await page.getByLabel("อีเมล").fill(e2e.ownerEmail);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(e2e.password);
  await page.getByRole("button", { name: /เข้าสู่ระบบ/ }).click();
  await expectLeftLoginPage(page);
}

// กระดิ่งแยกเรื่องที่ต้องรีบดูออกจากเรื่องทั่วไป บิลเลยกำหนดเป็นสีแดง และมีลิงก์ท้ายแผงไปแดชบอร์ด
test("bell groups urgent items first and links to the dashboard", async ({ page }) => {
  await loginAsOwner(page);
  await page.goto(`/admin/properties/${e2e.propertyId}/parcels`);
  await page.getByRole("button", { name: /ศูนย์การแจ้งเตือน/ }).click();
  const panel = page.getByRole("dialog", { name: "ศูนย์การแจ้งเตือน" });
  await expect(panel).toBeVisible();

  const urgentGroup = panel.getByRole("region", { name: "ต้องรีบดู" });
  await expect(urgentGroup).toBeVisible();
  await expect(urgentGroup.locator('.notification-item-icon[data-tone="urgent"]').first()).toBeVisible();
  // ไม่มีปุ่มรีเฟรชในแผงแล้ว เปิดแผงเมื่อไหร่ระบบโหลดใหม่เอง
  await expect(panel.getByRole("button", { name: "อัปเดตการแจ้งเตือน" })).toHaveCount(0);

  await panel.getByRole("link", { name: "ดูทั้งหมดในแดชบอร์ด" }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/properties/${e2e.propertyId}$`));
  await expect(panel).toBeHidden();
});

// รายชื่อแชทบอกข้อความล่าสุดของแต่ละห้อง ในห้องสนทนามีป้ายคั่นวัน และค้นหาห้องได้
test("chat list previews the latest message and the thread shows day dividers", async ({ page }) => {
  await loginAsOwner(page);
  await page.goto(`/admin/properties/${e2e.propertyId}/parcels`);
  await page.locator(".chat-launcher").click();
  const chat = page.getByRole("complementary", { name: "ข้อความผู้เช่า" });

  await chat.getByRole("searchbox", { name: "ค้นหาห้องหรือชื่อผู้เช่า" }).fill("ไม่มีห้องนี้");
  await expect(chat.getByText("ไม่พบห้องหรือชื่อนี้")).toBeVisible();
  await chat.getByRole("searchbox", { name: "ค้นหาห้องหรือชื่อผู้เช่า" }).fill("E101");
  await chat.getByRole("button", { name: /ห้อง E101/ }).click();

  const text = `ทดสอบรายชื่อแชท ${Date.now()}`;
  await chat.getByLabel("ข้อความ", { exact: true }).fill(text);
  await chat.getByRole("button", { name: "ส่งข้อความ" }).click();
  await expect(chat.getByText(text)).toBeVisible();
  await expect(chat.locator(".chat-day-divider").filter({ hasText: "วันนี้" })).toBeVisible();

  await chat.getByRole("button", { name: "ย้อนกลับไปยังรายชื่อผู้เช่า" }).click();
  await expect(chat.getByRole("button", { name: /ห้อง E101/ })).toContainText(`คุณ: ${text}`);
});

// เปิดกระดิ่งแล้วระบบโหลดข้อมูลใหม่ ระหว่างนั้นหน้าต้องไม่กระโดด หัวหน้าต้องอยู่ที่เดิมตลอด
test("opening the bell refreshes without pushing the page down", async ({ page }) => {
  await loginAsOwner(page);
  await page.goto(`/admin/properties/${e2e.propertyId}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.evaluate(() => {
    const heading = document.querySelector("h1")!;
    const start = heading.getBoundingClientRect().top;
    const record = window as unknown as { maxShift: number };
    record.maxShift = 0;
    const observer = new MutationObserver(() => {
      record.maxShift = Math.max(record.maxShift, Math.abs(heading.getBoundingClientRect().top - start));
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });
  await page.getByRole("button", { name: /ศูนย์การแจ้งเตือน/ }).click();
  await expect(page.getByRole("dialog", { name: "ศูนย์การแจ้งเตือน" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(await page.evaluate(() => (window as unknown as { maxShift: number }).maxShift)).toBeLessThan(2);
});

// ห้องสนทนากับฝั่งแพลตฟอร์มใช้ชื่อทีม ไม่ใช่ชื่อบทบาทภายใน
test("owner chat shows the support team as a pinned conversation", async ({ page }) => {
  await loginAsOwner(page);
  await page.goto(`/admin/properties/${e2e.propertyId}/parcels`);
  await page.locator(".chat-launcher").click();
  const chat = page.getByRole("complementary", { name: "ข้อความผู้เช่า" });
  const support = chat.locator(".chat-support-contact");
  await expect(support).toContainText("ทีมช่วยเหลือ Nestly");
  await expect(support).toContainText("ปักหมุด");
  await support.click();
  await expect(chat.locator(".chat-conversation-brand")).toContainText("ทีมช่วยเหลือ Nestly");
});
