import { expect, type Locator, type Page, test } from "@playwright/test";
import { e2e } from "./fixtures";

// สัญญาของตารางทุกตัวในระบบ ทั้งสามโรล
//
// เขียนไฟล์นี้ขึ้นมาเพราะการรื้อโครงตารางทำให้หน้าพังแบบเงียบสองครั้ง โดยที่เทสต์อีก 51 ตัวผ่านหมด
// ครั้งแรกคอลัมน์ยุบติดกันจนอ่านไม่ออก ครั้งที่สองคลาสใหม่ไปทับคลาสเดิมจนตารางเนทีฟเสียรูป
// เทสต์ชุดเดิมตรวจว่ากดได้ ข้อความถูก ปุ่มใหญ่พอ แต่ไม่มีตัวไหนมองว่าคอลัมน์ยังเป็นคอลัมน์อยู่ไหม
const minimumColumnWidth = 40;
const minimumRowHeight = 32;

// รายการตารางที่ต้องมีจริงทุกครั้ง พร้อมจำนวนคอลัมน์ที่ตั้งใจให้มี
// เพิ่มหรือลดคอลัมน์แล้วเทสต์จะฟ้อง ให้มาแก้ตัวเลขที่นี่ด้วยความตั้งใจ ไม่ใช่หลุดไปโดยไม่รู้ตัว
const ownerTables = [
  // หน้าผังห้องเปิดมาเป็นการ์ด ต้องสลับไปมุมมองตารางก่อน
  { columns: 8, needsTableView: true, path: "/rooms", title: "ผังห้องพัก" },
  { columns: 7, path: "/tenants", title: "ผู้เช่า" },
  { columns: 8, path: "/contracts", title: "สัญญาเช่า" },
  { columns: 9, path: "/invoices", title: "บิล" },
  { columns: 6, path: "/parcels", title: "พัสดุ" },
  { columns: 8, path: "/meters/water", title: "มิเตอร์น้ำ" },
  { columns: 5, path: "/announcements", title: "ประกาศ" },
  { columns: 6, path: "/tickets", title: "เรื่องร้องเรียน" },
  // สองแท็บนี้อยู่ในหน้าผู้เช่า เก็บแท็บที่เลือกไว้ใน URL จึงเข้าตรงได้
  { columns: 8, path: "/tenants?tab=pending", title: "คำขอเข้าพัก" },
  { columns: 6, path: "/tenants?tab=transitions", title: "ประวัติย้ายออก/ย้ายห้อง" },
] as const;

// ตารางประวัติของผู้เช่าอยู่หลังแท็บ "ประวัติ" และต้องมีข้อมูลใน seed ถึงจะ render
const tenantTables = [
  { columns: 6, path: "/tenant/invoices", title: "ประวัติบิล" },
  { columns: 5, path: "/tenant/parcels", title: "ประวัติพัสดุ" },
  { columns: 5, path: "/tenant/tickets", title: "ประวัติเรื่องแจ้ง" },
] as const;

const superAdminTables = [
  { columns: 6, path: "/super-admin/accounts", title: "บัญชีผู้ดูแล" },
  { columns: 4, path: "/super-admin/properties", title: "หอพัก" },
  { columns: 7, path: "/super-admin/plans", title: "แพ็กเกจ" },
  { columns: 5, path: "/super-admin/audit-logs", title: "บันทึกระบบ" },
  { columns: 6, path: "/super-admin/subscriptions", title: "ตรวจค่าสมาชิก" },
  { columns: 6, path: `/super-admin/properties/${e2e.secondPropertyId}`, title: "ประวัติแพ็กเกจของหอ" },
] as const;

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("อีเมล").fill(email);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(e2e.password);
  await page.getByRole("button", { name: /เข้าสู่ระบบ/ }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 });
}

// อ่านทุกอย่างที่ต้องตรวจออกมาในรอบเดียว จะได้ไม่ต้องยิง evaluate หลายรอบให้ช้า
async function readTableShape(table: Locator) {
  return table.evaluate((element) => {
    const headers = Array.from(element.querySelectorAll("thead th"));
    const rows = Array.from(element.querySelectorAll("tbody tr"));
    const head = element.querySelector("thead");
    const firstBodyCell = element.querySelector("tbody tr > :first-child");
    return {
      columns: headers.length,
      headerWidths: headers.map((cell) => Math.round(cell.getBoundingClientRect().width)),
      rowHeights: rows.map((row) => Math.round(row.getBoundingClientRect().height)),
      scoped: headers.filter((cell) => cell.getAttribute("scope") === "col").length,
      // หัวตารางต้องตรึงไว้ และคอลัมน์แรกต้องปักไว้ซ้ายสุด ทั้งคู่ใช้ position: sticky
      stickyHead: head ? getComputedStyle(head).position : "none",
      pinnedFirstColumn: firstBodyCell ? getComputedStyle(firstBodyCell).position : "none",
    };
  });
}

async function expectTableContract(page: Page, table: Locator, expected: { columns: number; title: string }) {
  const shape = await readTableShape(table);

  expect(shape.columns, `${expected.title}: จำนวนคอลัมน์`).toBe(expected.columns);
  // ทุกหัวคอลัมน์ต้องบอกว่าเป็นหัวของคอลัมน์ ไม่งั้นโปรแกรมอ่านหน้าจอจับคู่ค่ากับหัวไม่ได้
  expect(shape.scoped, `${expected.title}: หัวคอลัมน์ที่มี scope="col"`).toBe(expected.columns);
  // คอลัมน์ยุบคือของที่พังแล้วเทสต์ชุดเดิมมองไม่เห็น ตรวจตรงนี้ตรง ๆ
  expect(Math.min(...shape.headerWidths), `${expected.title}: คอลัมน์ที่แคบที่สุด`)
    .toBeGreaterThanOrEqual(minimumColumnWidth);
  expect(shape.rowHeights.length, `${expected.title}: ต้องมีอย่างน้อยหนึ่งแถว`).toBeGreaterThan(0);
  expect(Math.min(...shape.rowHeights), `${expected.title}: แถวที่เตี้ยที่สุด`)
    .toBeGreaterThanOrEqual(minimumRowHeight);
  expect(shape.stickyHead, `${expected.title}: หัวตารางต้องตรึงไว้`).toBe("sticky");
  expect(shape.pinnedFirstColumn, `${expected.title}: คอลัมน์แรกต้องปักไว้`).toBe("sticky");
}

test.describe("สัญญาของตารางทุกโรล", () => {
  test("ตารางฝั่งเจ้าของหอครบทุกหน้า", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, e2e.ownerEmail);
    for (const entry of ownerTables) {
      await page.goto(`/admin/properties/${e2e.propertyId}${entry.path}`);
      await page.waitForLoadState("networkidle");
      if ("needsTableView" in entry && entry.needsTableView) {
        await page.getByRole("tab", { name: /ตาราง/ }).first().click();
      }
      // รอให้โครงหลอกหายไปก่อน ไม่งั้นจะไปวัดโครงหลอกแทนตารางจริง
      await expect(page.locator(".loading-skeleton")).toHaveCount(0, { timeout: 10_000 });
      const table = page.locator("table").first();
      await expect(table, `${entry.title}: ต้องมีตารางในหน้านี้`).toBeVisible({ timeout: 10_000 });
      await expectTableContract(page, table, entry);
    }
  });

  test("ตารางประวัติฝั่งผู้เช่า", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, e2e.tenantEmail);
    for (const entry of tenantTables) {
      await page.goto(entry.path);
      await page.waitForLoadState("networkidle");
      // แท็บเป็น role="tab" ไม่ใช่ปุ่มธรรมดา
      await page.getByRole("tab", { name: /ประวัติ/ }).first().click();
      // รอให้โครงหลอกหายไปก่อน ไม่งั้นจะไปวัดโครงหลอกแทนตารางจริง
      await expect(page.locator(".loading-skeleton")).toHaveCount(0, { timeout: 10_000 });
      const table = page.locator("table").first();
      await expect(table, `${entry.title}: ต้องมีตารางในหน้านี้`).toBeVisible({ timeout: 10_000 });
      await expectTableContract(page, table, entry);
    }
  });

  test("ตารางฝั่งผู้ดูแลระบบ", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, e2e.superAdminEmail);
    for (const entry of superAdminTables) {
      await page.goto(entry.path);
      await page.waitForLoadState("networkidle");
      // รอให้โครงหลอกหายไปก่อน ไม่งั้นจะไปวัดโครงหลอกแทนตารางจริง
      await expect(page.locator(".loading-skeleton")).toHaveCount(0, { timeout: 10_000 });
      const table = page.locator("table").first();
      await expect(table, `${entry.title}: ต้องมีตารางในหน้านี้`).toBeVisible({ timeout: 10_000 });
      await expectTableContract(page, table, entry);
    }
  });
});
