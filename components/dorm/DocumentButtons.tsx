"use client";

/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นคอมโพเนนต์หน้าจอ “Document Buttons” ที่แยกไว้เพื่อใช้ซ้ำและลดโค้ดซ้ำในหน้า React
 * การทำงาน: รับข้อมูลผ่าน props แสดงผลตามสถานะ และส่ง event กลับไปยังหน้าหรือ service; ถ้าใช้ state หรือ browser API ไฟล์จะประกาศเป็น Client Component
 */

import { Eye, FileDown, Printer } from "lucide-react";
import { useState } from "react";
import type { DocumentKind } from "@/lib/documents/types";

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คอมโพเนนต์ React “Document Buttons” จัดข้อมูลและสร้างส่วนหน้าจอที่ผู้ใช้เห็น
 * รับค่า:
 * - { data, kind }: ชุดข้อมูลที่แยกเฉพาะฟิลด์ซึ่งก้อนนี้ต้องใช้
 * ผลลัพธ์: คืน JSX ซึ่ง React นำไปแสดงเป็นหน้าจอ และอาจผูก event ให้ผู้ใช้โต้ตอบ
 */
export function DocumentButtons({ data, kind }: { data: Record<string, string | number>; kind: DocumentKind }) {
  const [pendingAction, setPendingAction] = useState<"preview" | "generate" | null>(null);
  const [error, setError] = useState("");

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “request Document” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - action: ค่า “action” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนผลลัพธ์หรือเปลี่ยนสถานะตามหน้าที่ของฟังก์ชัน; TypeScript จะอนุมานชนิดจากโค้ด
   */
  const requestDocument = async (action: "preview" | "generate") => {
    const previewWindow = window.open("", "_blank");
    setPendingAction(action);
    setError("");
    try {
      const response = await fetch(action === "preview" ? "/api/documents/preview" : "/api/documents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, data }) });
      if (!response.ok) {
        const result = await response.json() as { error?: string };
        throw new Error(result.error || "สร้างเอกสารไม่สำเร็จ");
      }
      if (action === "preview") {
        const url = URL.createObjectURL(await response.blob());
        if (previewWindow) previewWindow.location.href = url;
        window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
      } else {
        const result = await response.json() as { downloadUrl: string };
        if (previewWindow) previewWindow.location.href = result.downloadUrl;
      }
    } catch (requestError) {
      previewWindow?.close();
      setError(requestError instanceof Error ? requestError.message : "สร้างเอกสารไม่สำเร็จ");
    } finally {
      setPendingAction(null);
    }
  };

  return <div className="document-action-block"><div className="contract-actions"><button className="secondary-button" disabled={pendingAction !== null} onClick={() => void requestDocument("preview")} type="button"><Eye size={16} /> ดูตัวอย่าง</button><button className="primary-button" disabled={pendingAction !== null} onClick={() => void requestDocument("generate")} type="button">{pendingAction === "generate" ? <Printer size={16} /> : <FileDown size={16} />} {pendingAction ? "กำลังสร้าง..." : "สร้าง PDF / พิมพ์"}</button></div>{error ? <small className="form-hint error" role="alert">{error}</small> : null}</div>;
}
