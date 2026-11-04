"use client";
// สถานะของหน้าต่างดูตัวอย่าง PDF ที่ใช้ร่วมกันทั้งหน้า ใครกดดูตัวอย่างก็มาเปิดหน้าต่างเดียวกันนี้
// แยกจากตัวคอมโพเนนต์ เพราะคนเรียกเป็นฟังก์ชันธรรมดาใน lib/client/documents.ts ไม่ใช่ React

export type PdfPreviewState =
  | { status: "closed" }
  | { status: "loading"; id: number; title: string }
  | { status: "ready"; id: number; title: string; url: string };

let state: PdfPreviewState = { status: "closed" };
let nextId = 1;
// นับหน้าต่างที่วางรออยู่ ไม่มีเลยแปลว่าหน้านั้นไม่ได้ใส่ไว้ คนเรียกจะได้ไปเปิดแท็บใหม่แทน
let mountedHosts = 0;
const listeners = new Set<() => void>();

function setState(next: PdfPreviewState) {
  // คืนหน่วยความจำของไฟล์เดิมทุกครั้งที่เลิกแสดง ไม่งั้นเปิดดูหลายรอบแล้วกินหน่วยความจำสะสม
  if (state.status === "ready" && (next.status !== "ready" || next.url !== state.url)) URL.revokeObjectURL(state.url);
  state = next;
  listeners.forEach((listener) => listener());
}

export function subscribePdfPreview(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function getPdfPreviewState() {
  return state;
}

export function registerPdfPreviewHost() {
  mountedHosts += 1;
  return () => { mountedHosts -= 1; };
}

export function hasPdfPreviewHost() {
  return mountedHosts > 0;
}

// เปิดหน้าต่างทันทีตอนกด ผู้ใช้จะเห็นว่ากำลังสร้างอยู่ ไม่ใช่กดแล้วเงียบไปหลายวินาที
export function startPdfPreview(title: string) {
  const id = nextId++;
  setState({ status: "loading", id, title });
  return id;
}

// ผู้ใช้ปิดหน้าต่างไปก่อนไฟล์เสร็จ ก็ไม่ต้องเด้งกลับขึ้นมาอีก
export function showPdfPreview(id: number, url: string) {
  if (state.status === "closed" || state.id !== id) {
    URL.revokeObjectURL(url);
    return;
  }
  setState({ status: "ready", id, title: state.title, url });
}

export function closePdfPreview(id?: number) {
  if (state.status === "closed" || (id !== undefined && state.id !== id)) return;
  setState({ status: "closed" });
}
