/**
 * หน้าที่ของไฟล์นี้: คอมโพเนนต์ React ui-feedback ซึ่งรวมหน้าตาและพฤติกรรมที่นำกลับมาใช้ซ้ำในหน้าเว็บ
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
"use client";

import type { RefObject } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { useModalAccessibility } from "@/hooks/use-modal-accessibility";
import { FLASH_EVENT, takeFlashMessage } from "@/lib/client-flash";

export type ToastTone = "success" | "info" | "warning" | "error";
type Toast = { id: number; message: string; tone: ToastTone };
type ConfirmOptions = {
  title: string;
  description: string;
  confirmLabel?: string;
  tone?: "default" | "danger";
};
type PendingConfirmation = ConfirmOptions & { resolve: (confirmed: boolean) => void };

type UIContextValue = {
  toast: (message: string, tone?: ToastTone) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const UIContext = createContext<UIContextValue | null>(null);

/** สร้างส่วนหน้าจอ UIProvider; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export function UIProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmation, setConfirmation] = useState<PendingConfirmation | null>(null);
  const toastId = useRef(0);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const confirmationRef = useRef<HTMLElement>(null);

  const toast = useCallback((message: string, tone: ToastTone = "success") => {
    const id = ++toastId.current;
    setToasts((current) => [...current, { id, message, tone }]);
    const duration = tone === "error" || tone === "warning" ? 6500 : 4500;
    window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), duration);
  }, []);

  useEffect(() => {
    const showFlash = () => {
      const flash = takeFlashMessage();
      if (flash) toast(flash.message, flash.tone);
    };
    showFlash();
    window.addEventListener(FLASH_EVENT, showFlash);
    return () => window.removeEventListener(FLASH_EVENT, showFlash);
  }, [toast]);

  const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean>((resolve) => {
    setConfirmation({ ...options, resolve });
  }), []);

  const closeConfirmation = useCallback((confirmed: boolean) => {
    setConfirmation((current) => {
      current?.resolve(confirmed);
      return null;
    });
  }, []);

  const value = useMemo(() => ({ toast, confirm }), [toast, confirm]);
  return <UIContext.Provider value={value}>{children}<div className="toast-region" role="region" aria-label="การแจ้งเตือน">{toasts.map((item) => <div key={item.id} className={`toast toast-${item.tone}`} role={item.tone === "error" || item.tone === "warning" ? "alert" : "status"} aria-live={item.tone === "error" || item.tone === "warning" ? "assertive" : "polite"}><span className="toast-icon" aria-hidden="true">{item.tone === "success" ? <CheckCircle2 size={19} /> : item.tone === "error" ? <AlertCircle size={19} /> : item.tone === "warning" ? <AlertTriangle size={19} /> : <Info size={19} />}</span><span>{item.message}</span><button className="icon-btn" onClick={() => setToasts((current) => current.filter((toastItem) => toastItem.id !== item.id))} aria-label="ปิดการแจ้งเตือน"><X size={16} /></button></div>)}</div>{confirmation && <ConfirmationDialog confirmation={confirmation} dialogRef={confirmationRef} cancelRef={cancelButtonRef} onClose={closeConfirmation} />}</UIContext.Provider>;
}

function ConfirmationDialog({ confirmation, dialogRef, cancelRef, onClose }: { confirmation: PendingConfirmation; dialogRef: RefObject<HTMLElement | null>; cancelRef: RefObject<HTMLButtonElement | null>; onClose: (confirmed: boolean) => void }) {
  const close = useCallback(() => onClose(false), [onClose]);
  useModalAccessibility({ containerRef: dialogRef, initialFocusRef: cancelRef, onClose: close });
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}><section ref={dialogRef} className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-description" tabIndex={-1}><span className={`dialog-icon ${confirmation.tone === "danger" ? "danger" : ""}`}><AlertTriangle size={24} /></span><h2 id="confirm-title">{confirmation.title}</h2><p id="confirm-description">{confirmation.description}</p><div className="dialog-actions"><button ref={cancelRef} className="btn btn-outline" onClick={close}>ยกเลิก</button><button className={`btn ${confirmation.tone === "danger" ? "btn-danger" : "btn-dark"}`} onClick={() => onClose(true)}>{confirmation.confirmLabel ?? "ยืนยัน"}</button></div></section></div>;
}

/** React Hook useUI รวม state และพฤติกรรมฝั่ง browser เพื่อให้คอมโพเนนต์เรียกใช้ตามกฎเดียวกัน */
export function useUI() {
  const context = useContext(UIContext);
  if (!context) throw new Error("useUI must be used inside UIProvider");
  return context;
}
