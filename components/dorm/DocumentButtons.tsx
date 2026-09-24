"use client";

import { Eye, FileDown, Printer } from "lucide-react";
import { useState } from "react";
import { formatClientError } from "@/lib/client/api-error";
import { generateDocumentPdf, previewDocumentPdf } from "@/lib/client/documents";
import type { DocumentData } from "@/lib/documents/placeholders";
import type { DocumentKind } from "@/lib/documents/types";

// ปุ่มดูตัวอย่างกับสร้าง PDF ของเอกสาร ใช้ซ้ำได้ทั้งสัญญา ใบเสร็จ และใบแจ้งหนี้
export function DocumentButtons({ data, kind, propertyId }: Readonly<{ data: DocumentData; kind: DocumentKind; propertyId: string }>) {
  // เก็บว่ากำลังทำอะไรอยู่ ไม่ใช่แค่ true/false เพราะต้องรู้ด้วยว่าปุ่มไหนกำลังทำงาน
  const [pendingAction, setPendingAction] = useState<"preview" | "generate" | null>(null);
  const [error, setError] = useState("");

  const requestDocument = async (action: "preview" | "generate") => {
    setPendingAction(action);
    // ล้างข้อความผิดพลาดเก่าก่อน ไม่งั้นครั้งนี้สำเร็จแต่ข้อความเดิมยังค้างอยู่
    setError("");
    try {
      if (action === "preview") {
        await previewDocumentPdf(propertyId, kind, data);
      } else {
        await generateDocumentPdf(propertyId, kind, data);
      }
    } catch (requestError) {
      // formatClientError แปลงข้อผิดพลาดเป็นข้อความที่ผู้ใช้อ่านรู้เรื่อง ไม่หลุดรายละเอียดระบบออกไป
      setError(formatClientError(requestError, "สร้างเอกสารไม่สำเร็จ"));
    } finally {
      // ปลดล็อกปุ่มไม่ว่าจะสำเร็จหรือพัง ไม่ปล่อยค้างว่ากำลังสร้าง
      setPendingAction(null);
    }
  };

  // ปิดทั้งสองปุ่มระหว่างทำงาน กันสั่งสร้างซ้อนกันจนได้ไฟล์หลายใบ
  return <div className="document-action-block"><div className="contract-actions"><button className="secondary-button" disabled={pendingAction !== null} onClick={() => void requestDocument("preview")} type="button"><Eye size={16} /> ดูตัวอย่าง</button><button className="primary-button" disabled={pendingAction !== null} onClick={() => void requestDocument("generate")} type="button">{pendingAction === "generate" ? <Printer size={16} /> : <FileDown size={16} />} {pendingAction ? "กำลังสร้าง..." : "สร้าง PDF / พิมพ์"}</button></div>{error ? <small className="form-hint error" role="alert">{error}</small> : null}</div>;
}
