import { expect, test } from "@playwright/test";
import { e2e } from "./fixtures";
import { expectLeftLoginPage, openLoginForm } from "./helpers/login";

// แผ่นรายละเอียดผู้เช่าเคยเรียง 28 ช่องลงมาคอลัมน์เดียว ยาวหกเท่าของจอ ตอนนี้แบ่งเป็นสี่แท็บ
// แต่ละแท็บต้องเห็นครบโดยไม่ต้องเลื่อน และช่องที่กรอกผิดต้องพาไปแท็บนั้นเอง
test("tenant detail sheet splits its fields into tabs", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openLoginForm(page);
  await page.getByLabel("อีเมล").fill(e2e.ownerEmail);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(e2e.password);
  await page.getByRole("button", { name: /เข้าสู่ระบบ/ }).click();
  await expectLeftLoginPage(page);

  await page.goto(`/admin/properties/${e2e.propertyId}/tenants`);
  await page.getByRole("button", { name: /E2E Tenant E101/ }).click();
  const dialog = page.getByRole("dialog", { name: /ห้อง E101 · E2E Tenant/ });
  const tabs = dialog.getByRole("tablist", { name: "หมวดข้อมูลผู้เช่า" });
  await expect(tabs.getByRole("tab")).toHaveCount(4);
  await expect(tabs.getByRole("tab", { name: "ส่วนตัว" })).toHaveAttribute("aria-selected", "true");

  // แท็บแรกเห็นครบในจอเดียว ส่วนแผงที่เลื่อนได้ไม่ต้องเลื่อน
  const panel = dialog.getByRole("tabpanel");
  await expect(panel.getByLabel("ชื่อ-นามสกุล")).toBeVisible();
  const sizes = await panel.evaluate((element) => [element.scrollHeight, element.clientHeight]);
  expect(sizes[0], `scroll ${sizes.join("/")}`).toBeLessThanOrEqual(sizes[1] + 1);
  await expect(panel.getByLabel("เลขทะเบียนรถ")).toHaveCount(0);

  // ลูกศรเลื่อนแท็บได้ตามมาตรฐานแท็บ
  await tabs.getByRole("tab", { name: "ส่วนตัว" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(tabs.getByRole("tab", { name: "ติดต่อ" })).toHaveAttribute("aria-selected", "true");
  await expect(panel.getByLabel("ชื่อผู้ติดต่อฉุกเฉิน (ไม่บังคับ)")).toBeVisible();

  await tabs.getByRole("tab", { name: "สัญญา" }).click();
  await expect(panel.locator(".tenant-contract-summary")).toContainText("ห้อง E101");

  // ไม่มีรถก็ไม่มีช่องรถให้เห็น เลือกประเภทรถแล้วช่องค่อยขึ้น
  await tabs.getByRole("tab", { name: "รถ" }).click();
  await panel.getByRole("button", { name: "ประเภทรถ" }).click();
  await page.getByRole("option", { name: "ไม่มีรถ", exact: true }).click();
  await expect(panel.getByLabel("เลขทะเบียนรถ")).toHaveCount(0);
  await panel.getByRole("button", { name: "ประเภทรถ" }).click();
  await page.getByRole("option", { name: "รถยนต์", exact: true }).click();
  await panel.getByLabel("เลขทะเบียนรถ").fill("");

  // กรอกผิดอยู่แท็บอื่น กดบันทึกแล้วต้องพากลับมาแท็บที่มีปัญหา
  await tabs.getByRole("tab", { name: "ส่วนตัว" }).click();
  await dialog.getByRole("button", { name: "บันทึกข้อมูลผู้เช่า" }).click();
  await expect(tabs.getByRole("tab", { name: "รถ" })).toHaveAttribute("aria-selected", "true");
  await expect(dialog.getByRole("alert")).toContainText("เลขทะเบียนรถ");
});
