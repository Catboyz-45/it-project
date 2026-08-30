/**
 * หน้าที่ของไฟล์นี้: React Hook use-dirty-form สำหรับรวมพฤติกรรมฝั่งเบราว์เซอร์ที่หลายคอมโพเนนต์เรียกใช้ร่วมกัน
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUI } from "@/components/ui-feedback";

/** React Hook useDirtyForm รวม state และพฤติกรรมฝั่ง browser เพื่อให้คอมโพเนนต์เรียกใช้ตามกฎเดียวกัน */
export function useDirtyForm() {
  const [isDirty, setIsDirty] = useState(false);
  const { confirm } = useUI();
  const router = useRouter();

  useEffect(() => {
    if (!isDirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const interceptNavigation = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement).closest("a");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin || destination.href === window.location.href) return;
      event.preventDefault();
      void confirm({
        title: "ออกจากหน้านี้หรือไม่?",
        description: "การเปลี่ยนแปลงที่ยังไม่ได้บันทึกจะหายไป",
        confirmLabel: "ออกโดยไม่บันทึก",
        tone: "danger",
      }).then((shouldLeave) => {
        if (!shouldLeave) return;
        setIsDirty(false);
        router.push(`${destination.pathname}${destination.search}${destination.hash}`);
      });
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", interceptNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", interceptNavigation, true);
    };
  }, [confirm, isDirty, router]);

  const navigate = useCallback(async (href: string) => {
    if (!isDirty) {
      router.push(href);
      return true;
    }
    const shouldLeave = await confirm({
      title: "ออกจากหน้านี้หรือไม่?",
      description: "การเปลี่ยนแปลงที่ยังไม่ได้บันทึกจะหายไป",
      confirmLabel: "ออกโดยไม่บันทึก",
      tone: "danger",
    });
    if (shouldLeave) {
      setIsDirty(false);
      router.push(href);
    }
    return shouldLeave;
  }, [confirm, isDirty, router]);

  return { isDirty, markDirty: () => setIsDirty(true), markClean: () => setIsDirty(false), navigate };
}
