/**
 * หน้าที่ของไฟล์นี้: เครื่องมือฐานข้อมูล pagination สำหรับสร้างการเชื่อมต่อหรือจัดรูปแบบคำสั่งค้นหาอย่างสม่ำเสมอ
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import { z } from "zod";

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationInput = z.input<typeof paginationSchema>;
export type Pagination = z.output<typeof paginationSchema>;

export type Page<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
};

/** สร้างส่วนหน้าจอ parsePagination; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export function parsePagination(input: PaginationInput): Pagination {
  return paginationSchema.parse(input);
}

/** สร้างส่วนหน้าจอ toPage; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export function toPage<T>(items: T[], total: number, pagination: Pagination): Page<T> {
  return {
    items,
    total,
    page: pagination.page,
    pageSize: pagination.pageSize,
    pageCount: Math.ceil(total / pagination.pageSize),
  };
}

/** แปลงหรือจัดรูปข้อมูลด้วย toOffset ให้ส่วนอื่นใช้รูปแบบเดียวกันอย่างคาดเดาได้ */
export function toOffset(pagination: Pagination): number {
  return (pagination.page - 1) * pagination.pageSize;
}
