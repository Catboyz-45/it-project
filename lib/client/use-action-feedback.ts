"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import { formatClientError } from "@/lib/client/api-error";

type ActionMessages = { pending: string; success: string; error: string };
type RunActionOptions = {
  fallbackFocusTarget?: HTMLElement | null | (() => HTMLElement | null);
  focusTarget?: HTMLElement | null;
  restoreFocus?: boolean;
};

// โฟกัสโดยไม่ให้หน้าเด้ง คืน false ถ้าโฟกัสไม่ติด ผู้เรียกจะได้ไปลองตัวสำรองต่อ
function focusWithoutScrolling(target: HTMLElement | null | undefined) {
  if (!target?.isConnected) return false;
  target.focus({ preventScroll: true });
  return document.activeElement === target;
}

// ห่อการกระทำที่ต้องรอเซิร์ฟเวอร์ จัดการทั้งสถานะกำลังทำงาน toast เสียงอ่าน และโฟกัสให้ครบในที่เดียว
export function useActionFeedback() {
  const notify = useToast();
  // ใช้ ref ไม่ใช่ state เพราะต้องเช็คได้ทันทีในจังหวะเดียวกัน ไม่ใช่รอ render รอบถัดไป
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);
  const [isPending, setIsPending] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    // ต้องตั้งกลับเป็น true ตอน setup ด้วย ไม่ใช่ตั้งครั้งเดียวตอนประกาศ
    // เพราะโหมด Strict ของ React ตอน dev จะจำลองการ mount แล้ว unmount แล้ว mount ใหม่
    // ถ้าไม่ตั้งกลับ ค่านี้จะค้างเป็น false ตลอด แล้ว runAction จะเงียบไปเลยทั้งชีวิตของคอมโพเนนต์
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const runAction = useCallback(async <T,>(
    action: () => Promise<T>,
    messages: ActionMessages,
    options: RunActionOptions = {},
  ): Promise<T | undefined> => {
    // กันกดซ้ำระหว่างรอเซิร์ฟเวอร์ตอบ
    if (inFlightRef.current) return undefined;
    // จำว่าตอนกดโฟกัสอยู่ที่ไหน เพราะปุ่มที่กดอาจหายไปหลังข้อมูลเปลี่ยน
    const activeElement = options.focusTarget
      ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    inFlightRef.current = true;
    setIsPending(true);
    setError("");
    setAnnouncement(messages.pending);
    try {
      const result = await action();
      // เช็คก่อนทุกครั้งว่าคอมโพเนนต์ยังอยู่ ไม่งั้นจะไปตั้ง state ของสิ่งที่ถูกถอดไปแล้ว
      if (mountedRef.current) {
        setAnnouncement(messages.success);
        notify({ message: messages.success });
      }
      return result;
    } catch (error) {
      if (mountedRef.current) {
        const formattedError = formatClientError(error, messages.error);
        setError(formattedError);
        setAnnouncement(formattedError);
        notify({ message: formattedError, tone: "error" });
      }
      // โยนต่อให้ผู้เรียกตัดสินใจเอง เช่นคงกล่องเปิดไว้หรือไม่ล้างฟอร์ม
      throw error;
    } finally {
      inFlightRef.current = false;
      if (mountedRef.current) setIsPending(false);
      if (options.restoreFocus !== false) {
        // ไล่หาที่ลงของโฟกัสสามชั้น ปุ่มเดิมก่อน ไม่ได้ก็ตัวสำรองที่ผู้เรียกบอก ไม่ได้อีกก็หัวเรื่องของหน้า
        // ถ้าไม่ทำ โฟกัสจะตกไปที่ body แล้วคนใช้คีย์บอร์ดต้อง Tab ใหม่จากต้นหน้า
        window.requestAnimationFrame(() => {
          if (focusWithoutScrolling(activeElement)) return;
          const fallback = typeof options.fallbackFocusTarget === "function"
            ? options.fallbackFocusTarget()
            : options.fallbackFocusTarget;
          if (focusWithoutScrolling(fallback)) return;
          focusWithoutScrolling(document.querySelector<HTMLElement>("[data-action-focus-fallback], main h1, main h2"));
        });
      }
    }
  }, [notify]);

  const clearError = useCallback(() => setError(""), []);

  return { announcement, clearError, error, isPending, runAction };
}
