/**
 * หน้าที่ของไฟล์นี้: ชุดทดสอบ security.e2e.spec ยืนยันว่าพฤติกรรมสำคัญยังถูกต้องเมื่อมีการแก้โค้ด
 * ผู้อ่านทั่วไปควรดูคู่มือใน docs ควบคู่กับคอมเมนต์ใกล้กฎสำคัญ
 */
import { expect, test } from "@playwright/test";

test("security headers and correlation ID are present", async ({ request }) => {
  const response = await request.get("/");
  expect(response.headers()["x-request-id"]).toBeTruthy();
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response.headers()["x-frame-options"]).toBe("DENY");
  expect(response.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(response.headers()["permissions-policy"]).toContain("camera=()");
});

test("anonymous users cannot read CMS or admin APIs", async ({ page, request }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login$/);
  expect((await request.get("/api/admin/users")).status()).toBe(403);
  expect((await request.get("/api/admin/audit")).status()).toBe(403);
});

test("cross-origin and malformed CMS mutations are rejected", async ({ request }) => {
  const crossOrigin = await request.post("/api/auth/login", { headers: { Origin: "https://evil.example" }, data: { username: "owner", password: "irrelevant-password" } });
  expect(crossOrigin.status()).toBe(403);
  const noOrigin = await request.post("/api/auth/login", { data: { username: "owner", password: "irrelevant-password" } });
  expect(noOrigin.status()).toBe(403);
});
