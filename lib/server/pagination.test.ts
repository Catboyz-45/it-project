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
    // take 51 ไม่ใช่ 50 เพราะขอเกินมาหนึ่งแถวไว้เช็คว่ามีหน้าถัดไปไหม โดยไม่ต้องนับทั้งตาราง
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

  // ค่ามาจาก URL ที่ผู้ใช้พิมพ์เองได้ ขอเกินเพดานหรือส่งค่าที่ไม่ใช่ตัวเลขมาต้องไม่ผ่าน
  it("rejects invalid and oversized page sizes", () => {
    expect(() => parsePagination(new URLSearchParams({ page: "0" }))).toThrow();
    expect(() => parsePagination(new URLSearchParams({ pageSize: "101" }))).toThrow();
    expect(() => parsePagination(new URLSearchParams({ pageSize: "not-a-number" }))).toThrow();
  });
});
