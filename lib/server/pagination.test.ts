/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นโค้ดฝั่งเซิร์ฟเวอร์สำหรับ “pagination.test” ซึ่งอาจแตะฐานข้อมูล session ไฟล์ หรือความลับของระบบ
 * การทำงาน: ถูกเรียกจาก Server Component หรือ API route เพื่อทำ use case จริง ตรวจสิทธิ์และกฎธุรกิจก่อนอ่านหรือเปลี่ยนข้อมูล และไม่ควรถูก import ไปยัง Client Component
 */

import { describe, expect, it } from "vitest";
import {
  paginationQuery,
  parsePagination,
  toPaginatedResult,
} from "@/lib/server/pagination";

describe("pagination", () => {
  it("uses safe defaults and fetches one extra row", () => {
    const input = parsePagination(new URLSearchParams());

    expect(input).toEqual({ page: 1, pageSize: 50 });
    expect(paginationQuery(input)).toEqual({ skip: 0, take: 51 });
  });

  it("calculates page offsets and reports a next page without returning the extra row", () => {
    const input = parsePagination(new URLSearchParams({ page: "3", pageSize: "2" }));
    const result = toPaginatedResult(["a", "b", "c"], input);

    expect(paginationQuery(input)).toEqual({ skip: 4, take: 3 });
    expect(result).toEqual({
      data: ["a", "b"],
      pageInfo: { page: 3, pageSize: 2, hasNextPage: true },
    });
  });

  it("rejects invalid and oversized page sizes", () => {
    expect(() => parsePagination(new URLSearchParams({ page: "0" }))).toThrow();
    expect(() => parsePagination(new URLSearchParams({ pageSize: "101" }))).toThrow();
    expect(() => parsePagination(new URLSearchParams({ pageSize: "not-a-number" }))).toThrow();
  });
});
