import { z } from "zod";

// จำกัดเพดานไว้ กันขอทีเดียวเยอะจนเซิร์ฟเวอร์กับฐานข้อมูลรับไม่ไหว
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

// coerce เพราะค่ามาจาก query string เป็นสตริงเสมอ และค่านี้มาจากผู้ใช้จึงต้องตรวจทุกตัว
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
}).strict();

export type PaginationInput = z.infer<typeof paginationQuerySchema>;

export type PaginatedResult<T> = {
  data: T[];
  pageInfo: {
    page: number;
    pageSize: number;
    hasNextPage: boolean;
    // สองตัวนี้ไม่บังคับ เพราะการนับทั้งตารางทุกครั้งแพงเกินไปสำหรับข้อมูลชุดใหญ่
    total?: number;
    totalPages?: number;
  };
};

export function parsePagination(searchParams: URLSearchParams): PaginationInput {
  return paginationQuerySchema.parse({
    page: searchParams.get("page") ?? undefined,
    pageSize: searchParams.get("pageSize") ?? undefined,
  });
}

// ขอมาเกินหนึ่งแถว เพื่อรู้ว่ายังมีหน้าถัดไปไหม โดยไม่ต้องนับทั้งตาราง
export function paginationQuery(input: PaginationInput) {
  return {
    skip: (input.page - 1) * input.pageSize,
    // +1 คือแถวส่วนเกินนั้น เดี๋ยว toPaginatedResult จะตัดทิ้งก่อนส่งออกไป
    take: input.pageSize + 1,
  };
}

export function toPaginatedResult<T>(
  rows: T[],
  input: PaginationInput,
  total?: number,
): PaginatedResult<T> {
  // ได้แถวเกินที่ขอ แปลว่ายังมีข้อมูลต่อ
  const hasNextPage = rows.length > input.pageSize;
  return {
    // ตัดแถวส่วนเกินทิ้ง ผู้เรียกจะได้จำนวนตามที่ขอพอดี
    data: hasNextPage ? rows.slice(0, input.pageSize) : rows,
    pageInfo: {
      page: input.page,
      pageSize: input.pageSize,
      hasNextPage,
      // ส่ง total มาเฉพาะที่นับคุ้ม อย่างน้อย 1 หน้าเสมอ ตารางว่างจะได้ไม่แสดงว่า 0 หน้า
      ...(total === undefined ? {} : { total, totalPages: Math.max(1, Math.ceil(total / input.pageSize)) }),
    },
  };
}
