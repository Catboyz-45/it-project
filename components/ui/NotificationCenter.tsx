"use client";

/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นคอมโพเนนต์หน้าจอ “Notification Center” ที่แยกไว้เพื่อใช้ซ้ำและลดโค้ดซ้ำในหน้า React
 * การทำงาน: รับข้อมูลผ่าน props แสดงผลตามสถานะ และส่ง event กลับไปยังหน้าหรือ service; ถ้าใช้ state หรือ browser API ไฟล์จะประกาศเป็น Client Component
 */

import Link from "next/link";
import { Bell, CheckCheck, CheckCircle2, LockKeyhole, RefreshCw, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { IconButton } from "@/components/ui/IconButton";
import { LiveAnnouncement } from "@/components/ui/LiveAnnouncement";
import { useDialogAccessibility } from "@/lib/client/use-dialog-accessibility";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Notification Center Item” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type NotificationCenterItem = {
  count: number;
  description: string;
  href?: string;
  icon: ReactNode;
  id: string;
  onSelect?: () => void;
  title: string;
};

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Notification Center” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { isLoading = false, items, onRefresh, readOnly = false, sto: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
export function NotificationCenter({
  isLoading = false,
  items,
  onRefresh,
  readOnly = false,
  storageKey,
}: {
  isLoading?: boolean;
  items: NotificationCenterItem[];
  onRefresh?: () => void | Promise<void>;
  readOnly?: boolean;
  storageKey: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [readFingerprints, setReadFingerprints] = useState<string[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const previousTotalRef = useRef<number | null>(null);
  const [countAnnouncement, setCountAnnouncement] = useState("");
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “visible Items” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - item: ค่า “item” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const visibleItems = items.filter((item) => item.count > 0);
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “fingerprint” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - item: ค่า “item” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const fingerprint = (item: NotificationCenterItem) => `${item.id}:${item.count}`;
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “unread Items” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - item: ค่า “item” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const unreadItems = visibleItems.filter((item) => !readFingerprints.includes(fingerprint(item)));
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: แปลงข้อมูลในขั้นตอน “total” ให้เป็นรูปแบบมาตรฐานที่ส่วนถัดไปใช้ได้
   * รับค่า:
   * - sum: ค่า “sum” ที่จำเป็นต่อการทำงานของก้อนนี้
   * - item: ค่า “item” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const total = unreadItems.reduce((sum, item) => sum + item.count, 0);
  useDialogAccessibility(dialogRef, () => setIsOpen(false), isOpen);

  useEffect(() => {
    const previousTotal = previousTotalRef.current;
    previousTotalRef.current = total;
    if (previousTotal === null || previousTotal === total) return;
    setCountAnnouncement(total > 0
      ? `จำนวนการแจ้งเตือนที่ยังไม่ได้อ่านเปลี่ยนเป็น ${total} รายการ`
      : "อ่านการแจ้งเตือนครบทั้งหมดแล้ว");
  }, [total]);

  useEffect(() => {
    try { setReadFingerprints(JSON.parse(localStorage.getItem(storageKey) ?? "[]") as string[]); } catch { setReadFingerprints([]); }
  }, [storageKey]);

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: เปลี่ยนข้อมูลหรือสถานะในขั้นตอน “mark Read” โดยใช้ค่าที่รับเข้ามา
   * รับค่า:
   * - fingerprints: ค่า “fingerprints” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const markRead = (fingerprints: string[]) => setReadFingerprints((current) => {
    const next = [...new Set([...current, ...fingerprints])].slice(-100);
    localStorage.setItem(storageKey, JSON.stringify(next));
    return next;
  });

  useEffect(() => {
    if (!isOpen) return;
    /**
     * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
     * หน้าที่: ลบ ยกเลิก หรือปิดข้อมูลในขั้นตอน “close On Outside Click” ตามกฎของระบบ
     * รับค่า:
     * - event: เหตุการณ์จากผู้ใช้หรือเบราว์เซอร์
     * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
     */
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
    };
  }, [isOpen]);

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “select Item” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - item: ค่า “item” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const selectItem = (item: NotificationCenterItem) => {
    markRead([fingerprint(item)]);
    setIsOpen(false);
    item.onSelect?.();
  };

  return (
    <div className="relative" ref={rootRef}>
      <LiveAnnouncement message={countAnnouncement} />
      <IconButton
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className={`notification-trigger relative grid size-11 place-items-center rounded-xl border border-[#d7d8df] bg-[#fff] text-[#35363c] shadow-sm transition hover:border-brand/40 hover:bg-brand/[.04] hover:text-brand ${isOpen ? "notification-trigger-open" : ""}`}
        label={total > 0 ? `ศูนย์การแจ้งเตือน มี ${total} รายการ` : "ศูนย์การแจ้งเตือน"}
        onClick={() => setIsOpen((current) => !current)}
      >
        <Bell aria-hidden="true" size={20} />
        {total > 0 ? (
          <span className="notification-count-badge absolute -right-1.5 -top-1.5 inline-flex min-w-5 items-center justify-center rounded-full border-2 border-[#fff] bg-red-500 px-1 text-[10px] font-black leading-4 text-[#fff]">
            {total > 99 ? "99+" : total}
          </span>
        ) : null}
      </IconButton>

      {isOpen ? (
        <section
          aria-label="ศูนย์การแจ้งเตือน"
          aria-modal="true"
          className="notification-panel absolute right-0 top-[calc(100%+0.75rem)] z-50 w-[min(390px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[#d7d8df] bg-[#fff] text-[#292a30] shadow-2xl"
          ref={dialogRef}
          role="dialog"
          tabIndex={-1}
        >
          <header className="flex items-center justify-between border-b border-black/10 px-5 py-4">
            <div>
              <h2 className="text-base font-black">การแจ้งเตือน</h2>
              <p className="mt-0.5 text-xs text-[#73757d]">{total > 0 ? `${total} รายการที่ควรตรวจสอบ` : "ไม่มีรายการค้างอยู่"}</p>
              {readOnly ? <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-[11px] font-bold text-amber-900"><LockKeyhole size={12} /> เปิดดูได้ แต่ยังดำเนินการไม่ได้</span> : null}
            </div>
            <div className="flex items-center gap-1">
              {unreadItems.length ? <IconButton label="ทำเครื่องหมายว่าอ่านทั้งหมด" onClick={() => markRead(visibleItems.map(fingerprint))}><CheckCheck size={18} /></IconButton> : null}
              {onRefresh ? (
                <IconButton
                  disabled={isLoading}
                  label="อัปเดตการแจ้งเตือน"
                  onClick={() => void onRefresh()}
                >
                  <RefreshCw aria-hidden="true" className={isLoading ? "animate-spin" : ""} size={17} />
                </IconButton>
              ) : null}
              <IconButton
                className="min-h-[45px] min-w-[45px]"
                label="ปิดศูนย์การแจ้งเตือน"
                onClick={() => setIsOpen(false)}
              >
                <X aria-hidden="true" size={18} />
              </IconButton>
            </div>
          </header>

          <div className="notification-list max-h-[min(520px,65vh)] overflow-y-auto p-2">
            {visibleItems.length ? visibleItems.map((item) => {
              const isUnread = !readFingerprints.includes(fingerprint(item));
              const content = (
                <>
                  <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">{item.icon}</span>
                  <span className="min-w-0 flex-1">
                    <strong className="block text-sm">{item.title}</strong>
                    <small className="mt-1 block leading-5 text-[#73757d]">{item.description}</small>
                  </span>
                  <span className={isUnread ? "rounded-full bg-red-50 px-2 py-1 text-xs font-black text-red-600" : "rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-500"}>{item.count > 99 ? "99+" : item.count}</span>
                </>
              );
              const actionLabel = item.href ? "เปิดหน้าที่เกี่ยวข้อง" : "เปิดรายการนี้";
              const className = `notification-item interactive-card flex w-full items-start gap-3 rounded-xl border border-transparent p-3 text-left text-[#292a30] no-underline hover:bg-brand/5 hover:no-underline ${isUnread ? "bg-brand/[0.03]" : "opacity-70"}`;
              return item.href ? (
                <Link aria-label={`${item.title} ${item.count} รายการ ${actionLabel}`} className={className} href={item.href} key={item.id} onClick={() => selectItem(item)}>{content}<span className="sr-only">{actionLabel}</span></Link>
              ) : (
                <button aria-label={`${item.title} ${item.count} รายการ ${actionLabel}`} className={className} key={item.id} onClick={() => selectItem(item)} type="button">{content}<span className="sr-only">{actionLabel}</span></button>
              );
            }) : (
              <div className="grid justify-items-center px-6 py-10 text-center">
                <span className="grid size-12 place-items-center rounded-full bg-emerald-50 text-emerald-600"><CheckCircle2 size={24} /></span>
                <strong className="mt-3">เรียบร้อยทั้งหมด</strong>
                <p className="mt-1 text-sm text-[#73757d]">เมื่อมีรายการใหม่หรือรายการที่ต้องดำเนินการ จะแสดงที่นี่</p>
              </div>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
