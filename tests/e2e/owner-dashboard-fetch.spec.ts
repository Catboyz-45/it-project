import { expect, test } from "@playwright/test";
import { e2e } from "./fixtures";

// read model กับตัวเลขสรุปเป็นสองคำสั่งที่หนักที่สุดในระบบ layout ดึงมาให้ตั้งแต่ฝั่งเซิร์ฟเวอร์แล้ว
// เคยมีรอบหนึ่งที่ shell ยิงซ้ำตอน mount โดยไม่มีอะไรฟ้อง ไฟล์นี้จึงนับจำนวนครั้งไว้ตรง ๆ
test("owner shell does not refetch the read model it already has", async ({ page }) => {
  const calls: string[] = [];
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (/\/api\/v1\/admin\/properties\/[^/]+\/dashboard(\/summary)?$/.test(path)) calls.push(path);
  });

  await page.goto("/login");
  await page.getByLabel("อีเมล").fill(e2e.ownerEmail);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(e2e.password);
  await page.getByRole("button", { name: /เข้าสู่ระบบ/ }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 });
  await page.waitForLoadState("networkidle");
  // เปิดหน้ามาครั้งแรกต้องไม่ยิงเลย ข้อมูลมากับหน้าที่เซิร์ฟเวอร์ render มาแล้ว
  expect(calls).toHaveLength(0);

  await page.getByLabel("เมนูหลัก").getByRole("link", { name: /^ผู้เช่า(?:\s|$)/ }).click();
  await expect(page.getByRole("heading", { name: "ผู้เช่า", exact: true })).toBeVisible();
  await page.waitForLoadState("networkidle");
  // เปลี่ยนหน้าในหอเดิมก็ไม่ต้องยิง เพราะ layout ไม่ได้ถูกสร้างใหม่
  expect(calls).toHaveLength(0);

  await page.getByRole("button", { name: "คำขอเข้าพัก", exact: true }).click();
  const approve = page.getByRole("button", { name: "อนุมัติ E2E Pending Tenant" });
  await approve.waitFor({ state: "visible", timeout: 10_000 });
  await approve.click();
  await page.getByRole("alertdialog", { name: "อนุมัติคำขอเข้าพัก?" })
    .getByRole("button", { name: "อนุมัติ", exact: true }).click();
  await expect(page.getByText("ไม่มีคำขอเข้าพักที่รอตรวจสอบ")).toBeVisible();
  await page.waitForLoadState("networkidle");
  // แต่พอแก้ข้อมูลจริงต้องโหลดใหม่ ไม่งั้นหน้าอื่นจะเห็นข้อมูลเก่า
  expect(calls.length).toBeGreaterThan(0);
});
