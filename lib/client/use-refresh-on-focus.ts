"use client";
// โหลดตัวเลขแจ้งเตือนใหม่เองเมื่อผู้ใช้กลับมาที่แท็บ และเป็นระยะระหว่างเปิดหน้าทิ้งไว้
// ข้อความหรืองานใหม่จะได้ขึ้นป้ายโดยไม่ต้องกดรีเฟรชหน้า

import { useEffect, useRef } from "react";

export function useRefreshOnFocus(refresh: () => unknown, intervalMs = 60_000) {
  // เก็บฟังก์ชันล่าสุดไว้ใน ref ตัวจับเวลาจะได้ไม่ต้องตั้งใหม่ทุกครั้งที่ฟังก์ชันเปลี่ยนตัว
  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    // แท็บที่ซ่อนอยู่ไม่ต้องถามเซิร์ฟเวอร์ เดี๋ยวกลับมาเปิดก็โหลดให้ทันทีอยู่แล้ว
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refreshRef.current();
    };
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    const timer = window.setInterval(refreshWhenVisible, intervalMs);
    return () => {
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.clearInterval(timer);
    };
  }, [intervalMs]);
}
