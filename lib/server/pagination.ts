/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นโค้ดฝั่งเซิร์ฟเวอร์สำหรับ “pagination” ซึ่งอาจแตะฐานข้อมูล session ไฟล์ หรือความลับของระบบ
 * การทำงาน: ถูกเรียกจาก Server Component หรือ API route เพื่อทำ use case จริง ตรวจสิทธิ์และกฎธุรกิจก่อนอ่านหรือเปลี่ยนข้อมูล และไม่ควรถูก import ไปยัง Client Component
 */

import { z } from "zod";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ประกาศค่าหรือ schema “pagination Query Schema” ที่ส่วนอื่นนำไปใช้ร่วมกัน เพื่อให้กฎและรูปแบบมีแหล่งอ้างอิงเดียว
 */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
}).strict();

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Pagination Input” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type PaginationInput = z.infer<typeof paginationQuerySchema>;

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Paginated Result” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type PaginatedResult<T> = {
  data: T[];
  pageInfo: {
    page: number;
    pageSize: number;
    hasNextPage: boolean;
    total?: number;
    totalPages?: number;
  };
};

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: แปลงข้อมูลในขั้นตอน “parse Pagination” ให้เป็นรูปแบบมาตรฐานที่ส่วนถัดไปใช้ได้
 * รับค่า:
 * - searchParams: ค่า “search Params” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลชนิด PaginationInput ตามสัญญา TypeScript ของฟังก์ชัน
 */
export function parsePagination(searchParams: URLSearchParams): PaginationInput {
  return paginationQuerySchema.parse({
    page: searchParams.get("page") ?? undefined,
    pageSize: searchParams.get("pageSize") ?? undefined,
  });
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “pagination Query” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - input: ข้อมูลขาเข้าที่ต้องนำไปตรวจและประมวลผล
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export function paginationQuery(input: PaginationInput) {
  return {
    skip: (input.page - 1) * input.pageSize,
    take: input.pageSize + 1,
  };
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: แปลงข้อมูลในขั้นตอน “to Paginated Result” ให้เป็นรูปแบบมาตรฐานที่ส่วนถัดไปใช้ได้
 * รับค่า:
 * - rows: ค่า “rows” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - input: ข้อมูลขาเข้าที่ต้องนำไปตรวจและประมวลผล
 * - total: ค่า “total” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลชนิด PaginatedResult<T> ตามสัญญา TypeScript ของฟังก์ชัน
 */
export function toPaginatedResult<T>(
  rows: T[],
  input: PaginationInput,
  total?: number,
): PaginatedResult<T> {
  const hasNextPage = rows.length > input.pageSize;
  return {
    data: hasNextPage ? rows.slice(0, input.pageSize) : rows,
    pageInfo: {
      page: input.page,
      pageSize: input.pageSize,
      hasNextPage,
      ...(total === undefined ? {} : { total, totalPages: Math.max(1, Math.ceil(total / input.pageSize)) }),
    },
  };
}
