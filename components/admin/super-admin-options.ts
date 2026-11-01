"use client";
// ช่องเลือกหอพักและแพ็กเกจของผู้ดูแลระบบ โหลดทีละหน้าและค้นได้
// เพราะระบบมีหอและแพ็กเกจมากเกินกว่าจะดึงมาทั้งหมดในครั้งเดียว

import { useCallback, useEffect, useState } from "react";
import { readApiPayload } from "@/lib/client/api-error";

// subscription ใช้ตั้งค่าเริ่มต้นของฟอร์มเปลี่ยนแพ็กเกจให้ตรงกับที่หอใช้อยู่
export type PropertyOption = {
  id: string;
  name: string;
  subscription?: { planId: string | null; billingInterval: "MONTHLY" | "YEARLY" } | null;
};
export type PlanOption = { id: string; name: string; maxRooms: number };

// ตัวช่วยยิง POST แบบ JSON ให้ทุกฟอร์มของผู้ดูแลระบบจัดการข้อผิดพลาดเหมือนกัน
export async function postJson(url: string, body: unknown) {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  // หยิบข้อความภาษาไทยรายช่องจากเซิร์ฟเวอร์ก่อน ไม่มีค่อยใช้ข้อความรวม
  await readApiPayload(response, "บันทึกไม่สำเร็จ");
}

// onError ต้องเป็นฟังก์ชันที่ไม่เปลี่ยนตัวตนระหว่าง render เช่น setter ของ useState
// ไม่งั้น effect จะยิงซ้ำไม่จบ
export function usePagedOptions<T extends { id: string }>({
  endpoint,
  errorMessage,
  initialQuery = "",
  onError,
}: {
  endpoint: string;
  errorMessage: string;
  // คำค้นตั้งต้น ใช้ตอนเปิดฟอร์มมาพร้อมรายการที่เลือกไว้แล้ว รายการนั้นจะได้อยู่ในหน้าแรกแน่ ๆ
  initialQuery?: string;
  onError: (message: string) => void;
}) {
  const [items, setItems] = useState<T[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [query, setQuery] = useState(initialQuery);

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
// fallbackToFirst: false ใช้กับช่องที่ผู้ใช้ต้องเลือกเอง เช่นหอพักที่จะเปลี่ยนแพ็กเกจ เลือกผิดหอแล้วเสียหาย
export function useSelectionWithinOptions<T extends { id: string }>(options: T[], { fallbackToFirst = true, initialId = "" } = {}) {
  const [selectedId, setSelectedId] = useState(initialId);
  useEffect(() => {
    setSelectedId((current) => {
      // รายการยังโหลดไม่เสร็จ อย่าเพิ่งล้างค่าที่ส่งมาตั้งต้น
      if (options.length === 0) return current;
      if (options.some(({ id }) => id === current)) return current;
      return fallbackToFirst ? options[0]?.id ?? "" : "";
    });
  }, [fallbackToFirst, options]);
  return [selectedId, setSelectedId] as const;
}
