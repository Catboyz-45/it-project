"use client";
// ปุ่มคัดลอกข้อความ เช่นเลขบัญชีหรือเลขพร้อมเพย์ ผู้เช่าส่วนใหญ่โอนผ่านแอปธนาคารในมือถือเครื่องเดียวกัน
// จึงต้องคัดลอกไปวางแทนการพิมพ์เลขยาว ๆ เอง ซึ่งพิมพ์ผิดง่าย

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/components/ui/ToastProvider";

export function CopyButton({ label, value }: Readonly<{ label: string; value: string }>) {
  const [copied, setCopied] = useState(false);
  const notify = useToast();

  const copy = async () => {
    try {
      // คลิปบอร์ดใช้ไม่ได้ถ้าไม่ได้อยู่บน HTTPS หรือผู้ใช้ไม่อนุญาต จึงบอกให้คัดลอกเองแทน
      await navigator.clipboard.writeText(value);
      setCopied(true);
      notify({ message: `คัดลอก${label}แล้ว` });
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      notify({ message: `คัดลอกอัตโนมัติไม่สำเร็จ กรุณากดค้างที่${label}เพื่อคัดลอกเอง`, tone: "error" });
    }
  };

  return <button aria-label={`คัดลอก${label}`} className="secondary-button min-h-10 px-3 py-1.5 text-sm" onClick={() => void copy()} type="button">
    {copied ? <Check aria-hidden="true" size={16} /> : <Copy aria-hidden="true" size={16} />}
    {copied ? "คัดลอกแล้ว" : "คัดลอก"}
  </button>;
}
