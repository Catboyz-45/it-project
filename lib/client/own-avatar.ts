"use client";

import { useSyncExternalStore } from "react";

// รูปโปรไฟล์ของตัวเองที่เพิ่งเปลี่ยนในหน้านี้ แถบข้างกับการ์ดโปรไฟล์อ่านจากที่เดียวกัน
// อัปโหลดรูปแล้ววงกลมทุกจุดเปลี่ยนตามทันที ไม่ต้องรีเฟรชหรือส่ง callback ย้อนขึ้นไปหลายชั้น
let changed: { url: string | null } | undefined;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setOwnAvatarUrl(url: string | null) {
  changed = { url };
  listeners.forEach((listener) => listener());
}

// ยังไม่เคยเปลี่ยนในหน้านี้ก็ใช้ค่าที่เซิร์ฟเวอร์ส่งมา
export function useOwnAvatarUrl(initialUrl: string | null | undefined) {
  const current = useSyncExternalStore(subscribe, () => changed, () => undefined);
  return current ? current.url : initialUrl ?? null;
}
