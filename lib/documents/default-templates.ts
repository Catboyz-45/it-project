import type { DocumentKind } from "@/lib/documents/types";
import contractTemplate from "@/lib/documents/contract-template.json";

// Template ตั้งต้นที่ใช้ตอนหอยังไม่ได้แก้เอง ผู้ใช้แก้แล้วจะเก็บเป็นของหอนั้นในฐานข้อมูล
// {{...}} คือช่องที่จะถูกแทนด้วยข้อมูลจริงตอนสร้างเอกสาร
export const defaultTemplates: Record<DocumentKind, { name: string; html: string }> = {
  // สัญญายาวเกินจะเขียนในไฟล์นี้ จึงแยกไปไว้เป็น JSON ต่างหาก
  contract: {
    name: contractTemplate.name,
    html: contractTemplate.html,
  },
  invoice: {
    name: "ใบแจ้งหนี้มาตรฐาน",
    html: `<article class="document"><h1 class="document-title">ใบแจ้งหนี้ / ใบแจ้งค่าเช่า</h1><p class="text-center">{{property_name}}</p><div class="document-row"><span>เลขที่ {{reference_id}}</span><span>รอบ {{billing_month}}</span></div><div class="document-row"><span>ห้อง {{room_number}}</span><strong>{{tenant_name}}</strong></div><hr><div class="document-row"><span class="document-label">ค่าเช่า</span><span class="document-value">{{rent_amount}} บาท</span></div><div class="document-row"><span class="document-label">ค่าน้ำ</span><span class="document-value">{{water_amount}} บาท</span></div><div class="document-row"><span class="document-label">ค่าไฟ</span><span class="document-value">{{electricity_amount}} บาท</span></div><div class="document-row"><span class="document-label">ค่าบริการ</span><span class="document-value">{{service_amount}} บาท</span></div><div class="document-row document-total"><span>ยอดรวม</span><span>{{total_amount}} บาท</span></div></article>`,
  },
};
