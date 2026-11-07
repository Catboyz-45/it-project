import { expect, test } from "@playwright/test";
import { e2e } from "./fixtures";
import { expectLeftLoginPage, openLoginForm } from "./helpers/login";

// หัวหน้าเคยมีช่องค้นหาทั้งหอยาว ๆ หน้าตาเหมือนช่องกรองตารางของหน้านั้น ผู้ใช้ไม่รู้ว่าควรพิมพ์ช่องไหน
// ตอนนี้เป็นปุ่ม "ค้นหา" ที่เปิดกล่องค้นหา และหน้ามิเตอร์ย้ายตัวกรองที่กรองแค่ตารางเข้าไปอยู่หัวตาราง
test("global search opens from a button and table filters sit with their table", async ({ page }) => {
  await openLoginForm(page);
  await page.getByLabel("อีเมล").fill(e2e.ownerEmail);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(e2e.password);
  await page.getByRole("button", { name: /เข้าสู่ระบบ/ }).click();
  await expectLeftLoginPage(page);

  await page.goto(`/admin/properties/${e2e.propertyId}/meters/water`);
  await expect(page.getByPlaceholder("ค้นหาผู้เช่า ห้อง บิล สัญญา")).toHaveCount(0);
  const button = page.getByRole("button", { name: "ค้นหาทั้งหอ" });
  await expect(button).toHaveText("ค้นหา");

  await button.click();
  const dialog = page.getByRole("dialog", { name: "ค้นหาทั้งหอ" });
  const input = dialog.getByPlaceholder("ค้นหาผู้เช่า ห้อง บิล สัญญา");
  await expect(input).toBeFocused();
  await input.fill("E101");
  await expect(dialog.getByRole("link").first()).toBeVisible();
  // ลูกศรลงจากช่องพิมพ์ไปผลแรก แล้ว Esc ปิดกล่องและคืนโฟกัสให้ปุ่ม
  await page.keyboard.press("ArrowDown");
  await expect(dialog.getByRole("link").first()).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(button).toBeFocused();

  // ทางลัดคีย์บอร์ดยังเปิดได้ทั้ง Ctrl+K และ ⌘K
  await page.keyboard.press("Control+k");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");

  // รอบมิเตอร์เปลี่ยนทั้งหน้า จึงอยู่เหนือการ์ด ส่วนอาคาร ชั้น และช่องค้นหากรองแค่ตาราง จึงอยู่ในการ์ดตาราง
  const table = page.locator(".meter-table-card");
  await expect(table.getByRole("button", { name: "กรองอาคาร" })).toBeVisible();
  await expect(table.getByRole("button", { name: "กรองชั้น" })).toBeVisible();
  await expect(table.getByPlaceholder("ค้นหาห้องหรือผู้เช่า...")).toBeVisible();
  const period = page.getByRole("button", { name: "รอบมิเตอร์", exact: true });
  await expect(table.getByRole("button", { name: "รอบมิเตอร์", exact: true })).toHaveCount(0);
  const periodBox = (await period.boundingBox())!;
  const cardsBox = (await page.getByRole("group", { name: "ความคืบหน้าการจดมิเตอร์" }).boundingBox())!;
  expect(periodBox.y).toBeLessThan(cardsBox.y);
});
