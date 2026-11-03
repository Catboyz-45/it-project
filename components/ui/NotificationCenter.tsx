"use client";
// เก็บสถานะเปิดปิด และจำรายการที่อ่านแล้วไว้ใน localStorage

import Link from "next/link";
import { Bell, CheckCircle2, ChevronRight, LockKeyhole, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { IconButton } from "@/components/ui/IconButton";
import { LiveAnnouncement } from "@/components/ui/LiveAnnouncement";
import { useDialogAccessibility } from "@/lib/client/use-dialog-accessibility";
import {
  acknowledgeNotifications,
  isNotificationUnread,
  type NotificationReadState,
  parseNotificationReadState,
  settleNotificationReadState,
} from "@/lib/client/notification-read-state";

export type NotificationCenterItem = {
  // จำนวนที่ค้างอยู่ เช่นมีบิลรอตรวจ 3 ใบ เป็น 0 จะไม่แสดงรายการนี้
  count: number;
  description: string;
  // ส่ง href ถ้ากดแล้วไปหน้าอื่น หรือส่ง onSelect ถ้าอยากทำอย่างอื่นแทน
  href?: string;
  icon: ReactNode;
  id: string;
  onSelect?: () => void;
  title: string;
  // ความเร่งด่วน กำหนดสีไอคอนและกลุ่มที่แสดง urgent แดง attention เหลือง ไม่ใส่คือเรื่องทั่วไปสีเทา
  tone?: NotificationTone;
};

export type NotificationTone = "urgent" | "attention" | "info";

const toneOrder: Record<NotificationTone, number> = { urgent: 0, attention: 1, info: 2 };

// กระดิ่งแจ้งเตือนบนแถบหัวเรื่อง รวมงานค้างของหน้าต่าง ๆ ไว้ที่เดียว
// จำว่าแต่ละหัวข้อรับทราบไปแล้วกี่รายการ จำนวนเพิ่มเกินนั้นเมื่อไหร่ถึงนับว่ามีเรื่องใหม่

function writeReadState(storageKey: string, state: NotificationReadState) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    // โหมดส่วนตัวหรือปิดการเก็บข้อมูลไว้ กระดิ่งยังใช้ได้ แค่จำข้ามการโหลดหน้าไม่ได้
  }
}

// รายการในแผง ว่างเพราะไม่มีงานค้าง ไม่ใช่เพราะระบบพัง
// แบ่งเป็นสองกลุ่ม เรื่องที่ต้องรีบทำขึ้นก่อน เรื่องทั่วไปตามหลัง แต่ละกลุ่มเรียงจากด่วนมากไปน้อย
function NotificationList({ items, onSelect, readState }: Readonly<{
  items: NotificationCenterItem[];
  onSelect: (item: NotificationCenterItem) => void;
  readState: NotificationReadState;
}>) {
  if (items.length === 0) {
    return <div className="grid justify-items-center px-6 py-10 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-emerald-50 text-emerald-600"><CheckCircle2 size={24} /></span>
      <strong className="mt-3">เรียบร้อยทั้งหมด</strong>
      <p className="mt-1 text-sm text-[#73757d]">เมื่อมีรายการใหม่หรือรายการที่ต้องดำเนินการ จะแสดงที่นี่</p>
    </div>;
  }
  const sorted = [...items].sort((left, right) => toneOrder[left.tone ?? "info"] - toneOrder[right.tone ?? "info"]);
  const groups = [
    { label: "ต้องรีบดู", items: sorted.filter((item) => (item.tone ?? "info") !== "info") },
    { label: "ทั่วไป", items: sorted.filter((item) => (item.tone ?? "info") === "info") },
  ].filter((group) => group.items.length > 0);
  return <>{groups.map((group) => <section aria-label={group.label} className="notification-group" key={group.label}>
    {/* หัวกลุ่มมีเมื่อมีครบสองกลุ่ม กลุ่มเดียวไม่ต้องแยกให้รก */}
    {groups.length > 1 ? <h3 className="notification-group-label">{group.label}</h3> : null}
    {group.items.map((item) => <NotificationRow
      isUnread={isNotificationUnread(readState, item)}
      item={item}
      key={item.id}
      onSelect={onSelect}
    />)}
  </section>)}</>;
}

function NotificationRow({ isUnread, item, onSelect }: Readonly<{
  isUnread: boolean;
  item: NotificationCenterItem;
  onSelect: (item: NotificationCenterItem) => void;
}>) {
  const actionLabel = item.href ? "เปิดหน้าที่เกี่ยวข้อง" : "เปิดรายการนี้";
  // เรื่องใหม่บอกด้วยจุดสีกับตัวหนา แทนการทาพื้นทั้งแถว รายการจะได้ไม่เป็นก้อนสีม่วงทั้งแผง
  const className = "notification-item";
  const label = `${item.title} ${item.count} รายการ${isUnread ? " ยังไม่ได้อ่าน" : ""} ${actionLabel}`;
  const content = <>
    <span className="notification-item-icon" data-tone={item.tone ?? "info"}>{item.icon}</span>
    <span className="min-w-0 flex-1">
      <strong className="notification-item-title" data-unread={isUnread || undefined}>{item.title}</strong>
      <small className="mt-0.5 block leading-5 text-[#62646c]">{item.description}</small>
    </span>
    <span className="notification-item-count" data-tone={item.tone ?? "info"}>{item.count > 99 ? "99+" : item.count}</span>
    {isUnread ? <span aria-hidden="true" className="notification-item-dot" /> : <ChevronRight aria-hidden="true" className="notification-item-chevron" size={16} />}
    <span className="sr-only">{actionLabel}</span>
  </>;

  // มี href ใช้ Link เพื่อให้เปิดแท็บใหม่หรือคัดลอกลิงก์ได้ ไม่มีก็เป็นปุ่มธรรมดา
  if (item.href) {
    return <Link aria-label={label} className={className} data-unread={isUnread || undefined} href={item.href} onClick={() => onSelect(item)}>{content}</Link>;
  }
  return <button aria-label={label} className={className} data-unread={isUnread || undefined} onClick={() => onSelect(item)} type="button">{content}</button>;
}

// หัวแผงแจ้งเตือน ปุ่มอ่านทั้งหมดเป็นลิงก์ข้อความเล็ก ๆ ไม่แย่งความสนใจจากรายการ
// ไม่มีปุ่มรีเฟรชแล้ว เพราะเปิดแผงเมื่อไหร่ระบบโหลดใหม่ให้เอง
function NotificationPanelHeader({ hasUnread, onClose, onMarkAllRead, readOnly, total }: Readonly<{
  hasUnread: boolean;
  onClose: () => void;
  onMarkAllRead: () => void;
  readOnly: boolean;
  total: number;
}>) {
  return <header className="notification-panel-header">
    <div className="min-w-0">
      <h2 className="text-base font-bold">การแจ้งเตือน</h2>
      <p className="mt-0.5 text-xs text-[#62646c]">{total > 0 ? `${total} รายการใหม่` : "ไม่มีรายการใหม่"}</p>
      {/* บอกล่วงหน้าว่าดูได้แต่กดทำอะไรไม่ได้ ดีกว่าปล่อยให้กดแล้วเจอปฏิเสธทีหลัง */}
      {readOnly ? <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-[11px] font-bold text-amber-900"><LockKeyhole size={12} /> เปิดดูได้ แต่ยังดำเนินการไม่ได้</span> : null}
    </div>
    <div className="flex items-center gap-1">
      {/* ซ่อนเมื่ออ่านครบแล้ว จะได้ไม่มีปุ่มที่กดไปก็ไม่เกิดอะไร */}
      {hasUnread ? <button aria-label="ทำเครื่องหมายว่าอ่านทั้งหมด" className="notification-mark-read" onClick={onMarkAllRead} type="button">อ่านทั้งหมด</button> : null}
      <IconButton className="notification-close" label="ปิดศูนย์การแจ้งเตือน" onClick={onClose}>
        <X aria-hidden="true" size={18} />
      </IconButton>
    </div>
  </header>;
}

export function NotificationCenter({
  footerLink,
  isLoading = false,
  items,
  onRefresh,
  // true = ดูได้อย่างเดียว ใช้กับบทบาทที่ยังไม่มีสิทธิ์จัดการ
  readOnly = false,
  // แยก key ตามบทบาทหรือหอพัก ไม่งั้นสถานะอ่านแล้วจะปนกันข้ามบัญชี
  storageKey,
}: Readonly<{
  // ลิงก์ท้ายแผงไปหน้าที่รวมงานทั้งหมด เช่นแดชบอร์ด
  footerLink?: { href: string; label: string };
  isLoading?: boolean;
  items: NotificationCenterItem[];
  onRefresh?: () => void | Promise<void>;
  readOnly?: boolean;
  storageKey: string;
}>) {
  const [isOpen, setIsOpen] = useState(false);
  const [readState, setReadState] = useState<NotificationReadState>({});
  const [loadedStorageKey, setLoadedStorageKey] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previousTotalRef = useRef<number | null>(null);
  const [countAnnouncement, setCountAnnouncement] = useState("");

  // ซ่อนรายการที่ไม่มีอะไรค้าง จะได้เห็นเฉพาะเรื่องที่ต้องทำจริง
  const visibleItems = items.filter((item) => item.count > 0);

  const unreadItems = visibleItems.filter((item) => isNotificationUnread(readState, item));

  // นับจากที่ยังไม่ได้อ่านเท่านั้น ตัวเลขบนกระดิ่งจะได้ลดลงเมื่อกดอ่าน
  const total = unreadItems.reduce((sum, item) => sum + item.count, 0);

  // จัดการ Esc ขังโฟกัสไว้ในแผง และคืนโฟกัสให้กระดิ่งตอนปิด
  useDialogAccessibility(dialogRef, () => setIsOpen(false), isOpen);

  useEffect(() => {
    const previousTotal = previousTotalRef.current;
    previousTotalRef.current = total;
    // รอบแรกยังไม่มีค่าเก่าไว้เทียบ และค่าเท่าเดิมก็ไม่ต้องประกาศซ้ำให้รำคาญ
    if (previousTotal === null || previousTotal === total) return;
    // คนที่ใช้โปรแกรมอ่านหน้าจอไม่เห็นตัวเลขบนกระดิ่ง จึงต้องบอกด้วยเสียงแทน
    setCountAnnouncement(total > 0
      ? `จำนวนการแจ้งเตือนที่ยังไม่ได้อ่านเปลี่ยนเป็น ${total} รายการ`
      : "อ่านการแจ้งเตือนครบทั้งหมดแล้ว");
  }, [total]);

  useEffect(() => {
    // อ่านใน effect ไม่ใช่ตอนตั้ง state เพราะฝั่งเซิร์ฟเวอร์ไม่มี localStorage
    // try/catch เผื่อเบราว์เซอร์ปิดการเก็บข้อมูลไว้ ค่าที่เสียหาย parse จัดการให้แล้ว
    let raw: string | null = null;
    try { raw = localStorage.getItem(storageKey); } catch { raw = null; }
    setReadState(parseNotificationReadState(raw));
    setLoadedStorageKey(storageKey);
  }, [storageKey]);

  // งานที่ถูกจัดการไปจนจำนวนลด ต้องลดค่าที่รับทราบตาม งานใหม่ที่เข้ามาแทนจะได้ขึ้นว่ายังไม่อ่าน
  const itemCounts = items.map((item) => `${item.id}:${item.count}`).join("|");
  useEffect(() => {
    // รอให้อ่านค่าที่เก็บไว้เสร็จก่อน ไม่งั้นจะไปปรับค่าว่างแล้วเขียนทับของจริง
    if (loadedStorageKey !== storageKey) return;
    setReadState((current) => {
      const next = settleNotificationReadState(current, items);
      if (next !== current) writeReadState(storageKey, next);
      return next;
    });
    // ผูกกับจำนวนจริงแทน items ที่เป็นอาร์เรย์ใหม่ทุก render จะได้ไม่วนทำซ้ำโดยไม่จำเป็น
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemCounts, loadedStorageKey, storageKey]);

  const markRead = (readItems: NotificationCenterItem[]) => setReadState((current) => {
    const next = acknowledgeNotifications(current, readItems);
    writeReadState(storageKey, next);
    return next;
  });

  useEffect(() => {
    // ผูก listener เฉพาะตอนแผงเปิด ปิดแล้วไม่ต้องไปกวน event ของทั้งหน้า
    if (!isOpen) return;

    // คลิกที่ไหนก็ได้นอกแผงแล้วปิด ส่วน Esc มี useDialogAccessibility ดูแลอยู่แล้ว
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
    };
  }, [isOpen]);

  // กดรายการไหนถือว่าอ่านแล้ว แล้วปิดแผงเพื่อให้เห็นหน้าปลายทาง
  const selectItem = (item: NotificationCenterItem) => {
    markRead([item]);
    setIsOpen(false);
    item.onSelect?.();
  };

  return (
    <div className="relative" ref={rootRef}>
      <LiveAnnouncement message={countAnnouncement} />
      <IconButton
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className={`notification-trigger relative grid size-11 place-items-center rounded-xl border border-[#d7d8df] bg-[#fff] text-[#35363c] shadow-sm transition hover:border-brand/40 hover:bg-brand/[.04] hover:text-[#4651c7] ${isOpen ? "notification-trigger-open" : ""}`}
        // hover ใช้ #4651c7 ไม่ใช่ text-brand เพราะพื้นหลังตอน hover มี tint 4%
        // ทำให้ #5865f2 เหลือ contrast 4.38:1 ต่ำกว่าเกณฑ์ 4.5 ส่วนสีนี้ได้ 6.12:1
        // ใส่จำนวนใน label ด้วย เพราะโปรแกรมอ่านหน้าจอมองไม่เห็นป้ายตัวเลข
        label={total > 0 ? `ศูนย์การแจ้งเตือน มี ${total} รายการ` : "ศูนย์การแจ้งเตือน"}
        onClick={() => {
          // เปิดแผงเมื่อไหร่โหลดตัวเลขใหม่ให้เลย จะได้ไม่ต้องมีปุ่มรีเฟรชในแผง
          if (!isOpen && !isLoading) void onRefresh?.();
          setIsOpen((current) => !current);
        }}
      >
        <Bell aria-hidden="true" size={20} />
        {total > 0 ? (
          <span className="notification-count-badge absolute -right-1.5 -top-1.5 inline-flex min-w-5 items-center justify-center rounded-full border-2 border-[#fff] bg-red-500 px-1 text-[10px] font-black leading-4 text-[#fff]">
            {/* ตัดที่ 99+ กันเลขหลายหลักดันป้ายจนล้นออกนอกกระดิ่ง */}
            {total > 99 ? "99+" : total}
          </span>
        ) : null}
      </IconButton>

      {isOpen ? (
        <dialog
          aria-label="ศูนย์การแจ้งเตือน"
          // บอกว่าส่วนอื่นของหน้าถูกบังอยู่ โปรแกรมอ่านหน้าจอจะไม่หลุดออกไปอ่านข้างนอก
          aria-modal="true"
          // min() กันแผงล้นจอบนมือถือ กว้างสุด 390px แต่ไม่เกินความกว้างจอ
          className="notification-panel absolute right-0 top-[calc(100%+0.75rem)] z-50 w-[min(390px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[#d7d8df] bg-[#fff] text-[#292a30] shadow-2xl"
          ref={dialogRef}
          open
          // -1 ให้โฟกัสด้วยโค้ดได้ แต่ผู้ใช้กด Tab มาโดนเองไม่ได้
          tabIndex={-1}
        >
          <NotificationPanelHeader
            hasUnread={unreadItems.length > 0}
            onClose={() => setIsOpen(false)}
            onMarkAllRead={() => markRead(visibleItems)}
            readOnly={readOnly}
            total={total}
          />

          {/* จำกัดความสูงแล้วให้เลื่อนข้างใน กันแผงยาวเกินจอตอนมีรายการเยอะ */}
          <div aria-busy={isLoading || undefined} className="notification-list max-h-[min(520px,65vh)] overflow-y-auto">
            <NotificationList items={visibleItems} onSelect={selectItem} readState={readState} />
          </div>
          {footerLink && visibleItems.length > 0 ? <Link className="notification-footer-link" href={footerLink.href} onClick={() => setIsOpen(false)}>{footerLink.label}</Link> : null}
        </dialog>
      ) : null}
    </div>
  );
}
