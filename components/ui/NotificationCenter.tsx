"use client";
// เก็บสถานะเปิดปิด และจำรายการที่อ่านแล้วไว้ใน localStorage

import Link from "next/link";
import { Bell, CheckCheck, CheckCircle2, LockKeyhole, RefreshCw, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { IconButton } from "@/components/ui/IconButton";
import { LiveAnnouncement } from "@/components/ui/LiveAnnouncement";
import { useDialogAccessibility } from "@/lib/client/use-dialog-accessibility";

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
};

// กระดิ่งแจ้งเตือนบนแถบหัวเรื่อง รวมงานค้างของหน้าต่าง ๆ ไว้ที่เดียว
// ผูก id กับจำนวนไว้ด้วยกัน พอจำนวนเปลี่ยนก็ถือว่าเป็นเรื่องใหม่ที่ยังไม่ได้อ่าน
function fingerprintOf(item: NotificationCenterItem) {
  return `${item.id}:${item.count}`;
}

// รายการในแผง ว่างเพราะไม่มีงานค้าง ไม่ใช่เพราะระบบพัง
function NotificationList({ items, onSelect, readFingerprints }: Readonly<{
  items: NotificationCenterItem[];
  onSelect: (item: NotificationCenterItem) => void;
  readFingerprints: string[];
}>) {
  if (items.length === 0) {
    return <div className="grid justify-items-center px-6 py-10 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-emerald-50 text-emerald-600"><CheckCircle2 size={24} /></span>
      <strong className="mt-3">เรียบร้อยทั้งหมด</strong>
      <p className="mt-1 text-sm text-[#73757d]">เมื่อมีรายการใหม่หรือรายการที่ต้องดำเนินการ จะแสดงที่นี่</p>
    </div>;
  }
  return <>{items.map((item) => <NotificationRow
    isUnread={!readFingerprints.includes(fingerprintOf(item))}
    item={item}
    key={item.id}
    onSelect={onSelect}
  />)}</>;
}

function NotificationRow({ isUnread, item, onSelect }: Readonly<{
  isUnread: boolean;
  item: NotificationCenterItem;
  onSelect: (item: NotificationCenterItem) => void;
}>) {
  const actionLabel = item.href ? "เปิดหน้าที่เกี่ยวข้อง" : "เปิดรายการนี้";
  // อ่านแล้วทำให้จางลง เพื่อให้เรื่องใหม่เด่นกว่าโดยไม่ต้องซ่อนของเก่า
  const className = `notification-item interactive-card flex w-full items-start gap-3 rounded-xl border border-transparent p-3 text-left text-[#292a30] no-underline hover:bg-brand/5 hover:no-underline ${isUnread ? "bg-brand/[0.03]" : "opacity-70"}`;
  const label = `${item.title} ${item.count} รายการ ${actionLabel}`;
  const content = <>
    <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">{item.icon}</span>
    <span className="min-w-0 flex-1">
      <strong className="block text-sm">{item.title}</strong>
      <small className="mt-1 block leading-5 text-[#73757d]">{item.description}</small>
    </span>
    <span className={isUnread ? "rounded-full bg-red-50 px-2 py-1 text-xs font-black text-red-600" : "rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-500"}>{item.count > 99 ? "99+" : item.count}</span>
    <span className="sr-only">{actionLabel}</span>
  </>;

  // มี href ใช้ Link เพื่อให้เปิดแท็บใหม่หรือคัดลอกลิงก์ได้ ไม่มีก็เป็นปุ่มธรรมดา
  if (item.href) {
    return <Link aria-label={label} className={className} href={item.href} onClick={() => onSelect(item)}>{content}</Link>;
  }
  return <button aria-label={label} className={className} onClick={() => onSelect(item)} type="button">{content}</button>;
}

// หัวแผงแจ้งเตือน รวมปุ่มอ่านทั้งหมด ปุ่มรีเฟรช และปุ่มปิด
function NotificationPanelHeader({ hasUnread, isLoading, onClose, onMarkAllRead, onRefresh, readOnly, total }: Readonly<{
  hasUnread: boolean;
  isLoading: boolean;
  onClose: () => void;
  onMarkAllRead: () => void;
  onRefresh?: () => void | Promise<void>;
  readOnly: boolean;
  total: number;
}>) {
  return <header className="flex items-center justify-between border-b border-black/10 px-5 py-4">
    <div>
      <h2 className="text-base font-black">การแจ้งเตือน</h2>
      <p className="mt-0.5 text-xs text-[#73757d]">{total > 0 ? `${total} รายการที่ควรตรวจสอบ` : "ไม่มีรายการค้างอยู่"}</p>
      {/* บอกล่วงหน้าว่าดูได้แต่กดทำอะไรไม่ได้ ดีกว่าปล่อยให้กดแล้วเจอปฏิเสธทีหลัง */}
      {readOnly ? <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-[11px] font-bold text-amber-900"><LockKeyhole size={12} /> เปิดดูได้ แต่ยังดำเนินการไม่ได้</span> : null}
    </div>
    <div className="flex items-center gap-1">
      {/* ซ่อนปุ่มนี้เมื่ออ่านครบแล้ว จะได้ไม่มีปุ่มที่กดไปก็ไม่เกิดอะไร */}
      {hasUnread ? <IconButton label="ทำเครื่องหมายว่าอ่านทั้งหมด" onClick={onMarkAllRead}><CheckCheck size={18} /></IconButton> : null}
      {onRefresh ? <IconButton
        // ปิดปุ่มระหว่างโหลด กันกดรัวจนยิงหลายรอบ
        disabled={isLoading}
        label="อัปเดตการแจ้งเตือน"
        onClick={() => void onRefresh()}
      >
        <RefreshCw aria-hidden="true" className={isLoading ? "animate-spin" : ""} size={17} />
      </IconButton> : null}
      <IconButton
        // ขยายพื้นที่กดให้ถึงเกณฑ์นิ้วสัมผัสบนมือถือ
        className="min-h-[45px] min-w-[45px]"
        label="ปิดศูนย์การแจ้งเตือน"
        onClick={onClose}
      >
        <X aria-hidden="true" size={18} />
      </IconButton>
    </div>
  </header>;
}

export function NotificationCenter({
  isLoading = false,
  items,
  onRefresh,
  // true = ดูได้อย่างเดียว ใช้กับบทบาทที่ยังไม่มีสิทธิ์จัดการ
  readOnly = false,
  // แยก key ตามบทบาทหรือหอพัก ไม่งั้นสถานะอ่านแล้วจะปนกันข้ามบัญชี
  storageKey,
}: Readonly<{
  isLoading?: boolean;
  items: NotificationCenterItem[];
  onRefresh?: () => void | Promise<void>;
  readOnly?: boolean;
  storageKey: string;
}>) {
  const [isOpen, setIsOpen] = useState(false);
  const [readFingerprints, setReadFingerprints] = useState<string[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const previousTotalRef = useRef<number | null>(null);
  const [countAnnouncement, setCountAnnouncement] = useState("");

  // ซ่อนรายการที่ไม่มีอะไรค้าง จะได้เห็นเฉพาะเรื่องที่ต้องทำจริง
  const visibleItems = items.filter((item) => item.count > 0);

  const unreadItems = visibleItems.filter((item) => !readFingerprints.includes(fingerprintOf(item)));

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
    // try/catch เผื่อค่าที่เก็บไว้เสียหรือเบราว์เซอร์ปิดการเก็บข้อมูลไว้
    try { setReadFingerprints(JSON.parse(localStorage.getItem(storageKey) ?? "[]") as string[]); } catch { setReadFingerprints([]); }
  }, [storageKey]);

  const markRead = (fingerprints: string[]) => setReadFingerprints((current) => {
    // Set กันค่าซ้ำ และเก็บแค่ 100 รายการหลังสุด ไม่ให้ localStorage โตไม่รู้จบ
    const next = [...new Set([...current, ...fingerprints])].slice(-100);
    localStorage.setItem(storageKey, JSON.stringify(next));
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
    markRead([fingerprintOf(item)]);
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
        onClick={() => setIsOpen((current) => !current)}
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
        <section
          aria-label="ศูนย์การแจ้งเตือน"
          // บอกว่าส่วนอื่นของหน้าถูกบังอยู่ โปรแกรมอ่านหน้าจอจะไม่หลุดออกไปอ่านข้างนอก
          aria-modal="true"
          // min() กันแผงล้นจอบนมือถือ กว้างสุด 390px แต่ไม่เกินความกว้างจอ
          className="notification-panel absolute right-0 top-[calc(100%+0.75rem)] z-50 w-[min(390px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[#d7d8df] bg-[#fff] text-[#292a30] shadow-2xl"
          ref={dialogRef}
          role="dialog"
          // -1 ให้โฟกัสด้วยโค้ดได้ แต่ผู้ใช้กด Tab มาโดนเองไม่ได้
          tabIndex={-1}
        >
          <NotificationPanelHeader
            hasUnread={unreadItems.length > 0}
            isLoading={isLoading}
            onClose={() => setIsOpen(false)}
            onMarkAllRead={() => markRead(visibleItems.map(fingerprintOf))}
            onRefresh={onRefresh}
            readOnly={readOnly}
            total={total}
          />

          {/* จำกัดความสูงแล้วให้เลื่อนข้างใน กันแผงยาวเกินจอตอนมีรายการเยอะ */}
          <div className="notification-list max-h-[min(520px,65vh)] overflow-y-auto p-2">
            <NotificationList items={visibleItems} onSelect={selectItem} readFingerprints={readFingerprints} />
          </div>
        </section>
      ) : null}
    </div>
  );
}
