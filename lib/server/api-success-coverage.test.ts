import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// ไล่หาไฟล์ route.ts ทุกอันใต้ app/api แบบลงลึกทุกโฟลเดอร์
function routeFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return routeFiles(path);
    return entry.name === "route.ts" ? [path] : [];
  });
}

// ตัวทดสอบที่อ่านโค้ดของโปรเจกเอง ไม่ได้เรียกฟังก์ชันไหน
// เพราะการตอบกลับที่รูปแบบไม่ตรงกันจะทำให้ฝั่งเบราว์เซอร์อ่านผลไม่ได้ และคนเขียน route ใหม่มักลืม
describe("mutation API success responses", () => {
  it("uses the central success response helper in every mutation route", () => {
    const root = process.cwd();
    const files = routeFiles(join(root, "app/api"));

    const missing = files.filter((file) => {
      const source = readFileSync(file, "utf8");
      // สนใจเฉพาะ route ที่เปลี่ยนข้อมูล ส่วน GET ตอบกลับได้หลายรูปแบบ เช่นไฟล์หรือสตรีม
      if (!/export async function (POST|PUT|PATCH|DELETE)/.test(source)) return false;
      return !source.includes("apiSuccessResponse(") && !source.includes("apiSuccessBinaryResponse(");
    });

    // เทียบกับอาเรย์ว่าง ไม่ใช่เช็คความยาว เพราะถ้าพลาดจะได้เห็นชื่อไฟล์ที่ต้องไปแก้เลย
    expect(missing).toEqual([]);
  });
});
