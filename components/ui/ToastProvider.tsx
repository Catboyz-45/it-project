"use client";
// เก็บ state ของการแจ้งเตือนและใช้ timer ของเบราว์เซอร์

import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { CheckCircle2, CircleAlert, X } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";

type ToastTone = "success" | "error";
// สิ่งที่ผู้เรียกส่งมา ยังไม่มี id
type ToastInput = { message: string; tone?: ToastTone };
// สิ่งที่เก็บจริงใน state เติม id เพื่อใช้เป็น key และใช้ลบทีหลัง
type ToastItem = ToastInput & { id: string };

// เก็บแค่ฟังก์ชัน notify ไม่ได้เก็บรายการ toast เพราะหน้าอื่นไม่ต้องรู้ว่ามีอะไรค้างอยู่
const ToastContext = createContext<((input: ToastInput) => void) | null>(null);

// ครอบทั้งแอปไว้ที่ layout เพื่อให้ทุกหน้าเรียกแจ้งเตือนได้โดยไม่ต้องมี state ของตัวเอง
export function ToastProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const notify = useCallback((input: ToastInput) => {
    // ต้องมี id เฉพาะตัว เพราะข้อความซ้ำกันสองอันต้องลบแยกกันได้
    const id = crypto.randomUUID();
    setToasts((current) => [...current, { ...input, id }]);
    // หายเองใน 5 วิ กรองด้วย id ไม่ใช่ตัดตัวแรกออก เพราะผู้ใช้อาจกดปิดไปก่อนแล้ว
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 5000);
  }, []);

  // notify ถูก useCallback ไว้แล้ว ห่อ useMemo อีกชั้นกันไม่ให้ context เปลี่ยนทุกครั้งที่ toast เปลี่ยน
  const value = useMemo(() => notify, [notify]);

  return <ToastContext.Provider value={value}>
    {children}
    <div aria-label="การแจ้งเตือน" className="toast-region">
      {toasts.map((toast) => <Toast key={toast.id} onDismiss={() => setToasts((current) => current.filter(({ id }) => id !== toast.id))} toast={toast} />)}
    </div>
  </ToastContext.Provider>;
}

// ข้อผิดพลาดต้องให้โปรแกรมอ่านหน้าจอขัดจังหวะอ่านทันที จึงเป็น role="alert"
// ส่วนที่สำเร็จรอจังหวะว่างได้ ใช้ output ซึ่งมี role="status" ติดมาในตัว
function Toast({ onDismiss, toast }: Readonly<{ onDismiss: () => void; toast: ToastItem }>) {
  const isError = toast.tone === "error";
  const body = <>
    {isError ? <CircleAlert aria-hidden size={20} /> : <CheckCircle2 aria-hidden size={20} />}
    <span>{toast.message}</span>
    {/* ปิดเองได้ ไม่ต้องรอครบ 5 วิ */}
    <IconButton label="ปิดการแจ้งเตือน" onClick={onDismiss}><X size={17} /></IconButton>
  </>;
  if (isError) return <div aria-atomic="true" className="toast toast-error" role="alert">{body}</div>;
  return <output aria-atomic="true" className="toast toast-success">{body}</output>;
}

// โยน error แทนที่จะคืน null เพื่อให้รู้ตั้งแต่ตอนพัฒนาว่าลืมครอบ ToastProvider
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
}
