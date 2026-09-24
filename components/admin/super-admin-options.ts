"use client";
// ช่องเลือกหอพักและแพ็กเกจของผู้ดูแลระบบ โหลดทีละหน้าและค้นได้
// เพราะระบบมีหอและแพ็กเกจมากเกินกว่าจะดึงมาทั้งหมดในครั้งเดียว

import { useCallback, useEffect, useState } from "react";

export type PropertyOption = { id: string; name: string };
export type PlanOption = { id: string; name: string; maxRooms: number };

// ตัวช่วยยิง POST แบบ JSON ให้ทุกฟอร์มของผู้ดูแลระบบจัดการข้อผิดพลาดเหมือนกัน
export async function postJson(url: string, body: unknown) {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json() as { error?: string };
  if (!response.ok) throw new Error(result.error || "บันทึกไม่สำเร็จ");
}

// onError ต้องเป็นฟังก์ชันที่ไม่เปลี่ยนตัวตนระหว่าง render เช่น setter ของ useState
// ไม่งั้น effect จะยิงซ้ำไม่จบ
export function usePagedOptions<T extends { id: string }>({
  endpoint,
  errorMessage,
  onError,
}: {
  endpoint: string;
  errorMessage: string;
  onError: (message: string) => void;
}) {
  const [items, setItems] = useState<T[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [query, setQuery] = useState("");

  const load = useCallback(async (nextPage: number, append: boolean) => {
    const search = new URLSearchParams({ page: String(nextPage), pageSize: "20", activeOnly: "true", query });
    const response = await fetch(`${endpoint}?${search}`, { cache: "no-store" });
    const result = await response.json() as { data?: T[]; error?: string; pageInfo?: { hasNextPage: boolean } };
    if (!response.ok || !result.data || !result.pageInfo) throw new Error(result.error || errorMessage);
    const loaded = result.data;
    setItems((current) => append ? [...current, ...loaded] : loaded);
    setPage(nextPage);
    setHasMore(result.pageInfo.hasNextPage);
  }, [endpoint, errorMessage, query]);

  // หน่วงไว้ 250ms หลังผู้ใช้หยุดพิมพ์ ไม่ยิงคำขอทุกตัวอักษร
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void load(1, false).catch((cause: unknown) => onError(cause instanceof Error ? cause.message : errorMessage));
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [errorMessage, load, onError]);

  return {
    hasMore,
    items,
    loadMore: () => void load(page + 1, true),
    query,
    setQuery,
  };
}

// ค่าที่เลือกอยู่ต้องมีอยู่จริงในรายการที่โหลดมา ไม่งั้นย้อนกลับไปใช้ตัวแรก
export function useSelectionWithinOptions<T extends { id: string }>(options: T[]) {
  const [selectedId, setSelectedId] = useState("");
  useEffect(() => {
    setSelectedId((current) => options.some(({ id }) => id === current) ? current : options[0]?.id ?? "");
  }, [options]);
  return [selectedId, setSelectedId] as const;
}
