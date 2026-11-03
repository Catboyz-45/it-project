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

  await panel.getByRole("link", { name: "ดูทั้งหมดในหน้าหลัก" }).click();
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
  await expect(chat.getByText("ไม่พบห้อง ชื่อ หรือเรื่องนี้")).toBeVisible();
  await chat.getByRole("searchbox", { name: "ค้นหาห้องหรือชื่อผู้เช่า" }).fill("E101");
  await chat.getByRole("button", { name: "ห้อง E101 · E2E Tenant" }).click();

  const text = `ทดสอบรายชื่อแชท ${Date.now()}`;
  await chat.getByLabel("ข้อความ", { exact: true }).fill(text);
  await chat.getByRole("button", { name: "ส่งข้อความ" }).click();
  await expect(chat.getByText(text)).toBeVisible();
  await expect(chat.locator(".chat-day-divider").filter({ hasText: "วันนี้" })).toBeVisible();

  await chat.getByRole("button", { name: "ย้อนกลับไปยังรายชื่อผู้เช่า" }).click();
  await expect(chat.getByRole("button", { name: "ห้อง E101 · E2E Tenant" })).toContainText(`คุณ: ${text}`);
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

// เรื่องแจ้งคุยในแชทเล็กได้ทั้งสองฝั่ง เจ้าของหอกด "คุย" จากหน้าแจ้งซ่อม ตอบ แล้วรับเรื่อง ผู้เช่าเห็นคำตอบในแชทของตัวเอง
test("ticket conversations open in the chat window for owner and tenant", async ({ page }) => {
  const title = `แอร์ E2E ${Date.now()}`;
  await openLoginForm(page);
  await page.getByLabel("อีเมล").fill(e2e.tenantEmail);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(e2e.password);
  await page.getByRole("button", { name: /เข้าสู่ระบบ/ }).click();
  await expectLeftLoginPage(page);
  // ส่งผ่าน fetch ในหน้าเว็บ จะได้ผ่านการตรวจ origin กับคุกกี้แบบเดียวกับหน้าจอจริง
  const created = await page.evaluate(async (ticketTitle) => {
    const response = await fetch("/api/v1/tenant/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "REPAIR", title: ticketTitle, detail: "เปิดแล้วมีแต่ลม" }),
    });
    return response.status;
  }, title);
  expect(created).toBe(201);

  await page.context().clearCookies();
  await loginAsOwner(page);
  await page.goto(`/admin/properties/${e2e.propertyId}/tickets`);
  await page.getByRole("button", { name: `คุยเรื่อง ${title} ในแชท` }).click();
  const chat = page.getByRole("complementary", { name: "ข้อความผู้เช่า" });
  await expect(chat.locator(".chat-conversation-brand")).toContainText(title);
  await expect(chat.getByRole("region", { name: "เรื่องที่แจ้ง" })).toContainText("เปิดแล้วมีแต่ลม");
  const reply = `พรุ่งนี้ช่างเข้าดู ${Date.now()}`;
  await chat.getByPlaceholder("พิมพ์ข้อความตอบกลับ...").fill(reply);
  await chat.getByRole("button", { name: "ส่งข้อความ" }).click();
  await expect(chat.getByText(reply)).toBeVisible();
  await chat.getByRole("button", { name: "รับเรื่องและเริ่มตรวจสอบ" }).click();
  await expect(chat.locator(".chat-event").filter({ hasText: "กำลังตรวจสอบ" })).toBeVisible();
  // ปิดงานจากในแชทได้เลย เรื่องจะได้ไม่ค้างไปกวนเทสต์อื่นที่นับเรื่องที่ยังเปิดอยู่
  await chat.getByRole("button", { name: "ทำเครื่องหมายว่าเสร็จ" }).click();
  await expect(chat.locator(".chat-event").filter({ hasText: "เสร็จแล้ว" })).toBeVisible();
  await expect(chat.getByRole("button", { name: "ทำเครื่องหมายว่าเสร็จ" })).toHaveCount(0);

  // รายการรวม กรองเฉพาะเรื่องแจ้งแล้วเห็นคำตอบล่าสุดของเรา
  await chat.getByRole("button", { name: "ย้อนกลับไปยังรายการข้อความ" }).click();
  await chat.getByRole("group", { name: "กรองข้อความ" }).getByRole("button", { name: "เรื่องแจ้ง" }).click();
  await expect(chat.getByRole("button", { name: new RegExp(title) })).toContainText(`คุณ: ${reply}`);

  await page.context().clearCookies();
  await openLoginForm(page);
  await page.getByLabel("อีเมล").fill(e2e.tenantEmail);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(e2e.password);
  await page.getByRole("button", { name: /เข้าสู่ระบบ/ }).click();
  await expectLeftLoginPage(page);
  await page.getByRole("button", { name: /เปิดแชทกับหอพัก/ }).click();
  const tenantChat = page.getByRole("dialog", { name: "แชทกับหอพัก" });
  const ticketRow = tenantChat.getByRole("button", { name: new RegExp(`${title}.*มีข้อความใหม่`) });
  await expect(ticketRow).toContainText(`หอ: ${reply}`);
  await ticketRow.click();
  await expect(tenantChat.getByText(reply)).toBeVisible();
  // ผู้เช่าไม่มีปุ่มเลื่อนสถานะ
  await expect(tenantChat.getByRole("button", { name: "ทำเครื่องหมายว่าเสร็จ" })).toHaveCount(0);
});
