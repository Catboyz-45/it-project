"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

type ToastTone = "success" | "error" | "info";
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

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmation, setConfirmation] = useState<PendingConfirmation | null>(null);
  const toastId = useRef(0);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  const toast = useCallback((message: string, tone: ToastTone = "success") => {
    const id = ++toastId.current;
    setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), 4500);
  }, []);

  const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean>((resolve) => {
    setConfirmation({ ...options, resolve });
  }), []);

  const closeConfirmation = useCallback((confirmed: boolean) => {
    setConfirmation((current) => {
      current?.resolve(confirmed);
      return null;
    });
  }, []);

  useEffect(() => {
    if (!confirmation) return;
    cancelButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeConfirmation(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [confirmation, closeConfirmation]);

  const value = useMemo(() => ({ toast, confirm }), [toast, confirm]);
  return <UIContext.Provider value={value}>{children}<div className="toast-region" role="region" aria-label="การแจ้งเตือน" aria-live="polite">{toasts.map((item) => <div key={item.id} className={`toast toast-${item.tone}`}><span className="toast-icon">{item.tone === "success" ? <CheckCircle2 size={19} /> : item.tone === "error" ? <AlertTriangle size={19} /> : <Info size={19} />}</span><span>{item.message}</span><button className="icon-btn" onClick={() => setToasts((current) => current.filter((toastItem) => toastItem.id !== item.id))} aria-label="ปิดการแจ้งเตือน"><X size={16} /></button></div>)}</div>{confirmation && <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeConfirmation(false); }}><section className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-description"><span className={`dialog-icon ${confirmation.tone === "danger" ? "danger" : ""}`}><AlertTriangle size={24} /></span><h2 id="confirm-title">{confirmation.title}</h2><p id="confirm-description">{confirmation.description}</p><div className="dialog-actions"><button ref={cancelButtonRef} className="btn btn-outline" onClick={() => closeConfirmation(false)}>ยกเลิก</button><button className={`btn ${confirmation.tone === "danger" ? "btn-danger" : "btn-dark"}`} onClick={() => closeConfirmation(true)}>{confirmation.confirmLabel ?? "ยืนยัน"}</button></div></section></div>}</UIContext.Provider>;
}

export function useUI() {
  const context = useContext(UIContext);
  if (!context) throw new Error("useUI must be used inside UIProvider");
  return context;
}
