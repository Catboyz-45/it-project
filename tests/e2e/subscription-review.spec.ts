import { expect, test } from "@playwright/test";
import { e2e } from "./fixtures";
import { expectLeftLoginPage, openLoginForm } from "./helpers/login";

// หน้าตรวจค่าสมาชิกของแอดมินใหญ่ แบบ Google Admin console
// เทสต์นี้อ่านอย่างเดียว ไม่กดอนุมัติหรือปฏิเสธ เพราะสลิปใน seed ใช้ร่วมกับเทสต์ตารางและหน้ารายละเอียดหอ
test.use({ viewport: { width: 1440, height: 900 } });

test("super admin reviews subscription slips with summary, suggestions and filters", async ({ page }) => {
  await openLoginForm(page);
  await page.getByLabel("อีเมล").fill(e2e.superAdminEmail);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(e2e.password);
  await page.getByRole("button", { name: /เข้าสู่ระบบ/ }).click();
  await expectLeftLoginPage(page);

  await page.goto("/super-admin/subscriptions");
  await expect(page.getByRole("heading", { name: "การชำระสมาชิก" })).toBeVisible();
  await expect(page.getByText("รับเงินเดือนนี้")).toBeVisible();

  // สลิปที่ seed ไว้ต้องอยู่ในตาราง และแผงขวาต้องเปิดรายการแรกให้เลย พร้อมปุ่มตัดสิน
  const review = page.getByRole("region", { name: "ตรวจค่าสมาชิก" });
  await expect(review.getByTestId("subscription-payment-review").filter({ hasText: "E2E-ORDER-0001" })).toBeVisible();
  const detail = page.getByRole("complementary", { name: "รายละเอียดสลิป" });
  await expect(detail.getByRole("button", { name: "อนุมัติ" })).toBeVisible();
  await expect(detail.getByRole("button", { name: "ปฏิเสธ" })).toBeVisible();

  // พิมพ์ชื่อหอไม่ครบก็ต้องมีคำแนะนำขึ้นมา เลือกแล้วค่าต้องลงช่องค้นหาและตารางกรองตาม
  const search = review.getByRole("combobox");
  await search.fill("ฮาเ");
  const suggestion = page.getByRole("option", { name: /หอ E2E ฮาเฮ/ });
  await expect(suggestion).toBeVisible();
  await search.press("ArrowDown");
  await search.press("Enter");
  await expect(search).toHaveValue("หอ E2E ฮาเฮ");
  await expect(page.getByRole("option")).toHaveCount(0);
  await expect(review.getByTestId("subscription-payment-review").first()).toContainText("หอ E2E ฮาเฮ");

  // คำค้นที่ไม่ตรงอะไรต้องบอกว่าไม่พบ ไม่ใช่ตารางว่างเปล่าเงียบ ๆ
  await search.fill("ไม่มีหอนี้แน่นอน");
  await expect(review.getByText("ไม่พบรายการที่ค้นหา")).toBeVisible();
  await search.fill("");

  // ชิปสถานะกดแล้วต้องบอกสถานะที่เลือกอยู่ให้โปรแกรมอ่านหน้าจอรู้
  const allChip = review.getByRole("button", { name: "ทั้งหมด", exact: true });
  await allChip.click();
  await expect(allChip).toHaveAttribute("aria-pressed", "true");
  await expect(review.getByTestId("subscription-payment-review").first()).toBeVisible();

  // การแก้แพ็กเกจด้วยตนเองย้ายไปเป็นป็อปอัพ เปิดแล้วต้องมีฟอร์มครบ และปิดด้วย Esc ได้
  await page.getByRole("button", { name: "เปลี่ยนแพ็กเกจด้วยตนเอง" }).click();
  const dialog = page.getByRole("dialog", { name: "เปลี่ยนแพ็กเกจด้วยตนเอง" });
  await expect(dialog.getByRole("button", { name: "บันทึกแพ็กเกจ" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});
