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

export function parsePagination(input: PaginationInput): Pagination {
  return paginationSchema.parse(input);
}

export function toPage<T>(items: T[], total: number, pagination: Pagination): Page<T> {
  return {
    items,
    total,
    page: pagination.page,
    pageSize: pagination.pageSize,
    pageCount: Math.ceil(total / pagination.pageSize),
  };
}

export function toOffset(pagination: Pagination): number {
  return (pagination.page - 1) * pagination.pageSize;
}
