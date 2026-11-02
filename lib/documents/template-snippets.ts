import type { DocumentKind } from "@/lib/documents/types";

// ข้อความสำเร็จรูปที่แทรกลงแบบฟอร์มได้ในคลิกเดียว เจ้าของหอไม่ต้องพิมพ์สัญญาเองทั้งฉบับ
// ใช้ช่อง {{...}} แบบเดียวกับ Template ตัวแก้ไขจะแปลงเป็นป้ายให้เอง และผ่าน sanitizeTemplate ตอนบันทึกเหมือนข้อความที่พิมพ์เอง
export type TemplateSnippet = {
  description: string;
  html: string;
  id: string;
  title: string;
};

const clause = (title: string, body: string) => `<p><strong>${title}</strong> ${body}</p>`;

export const contractClauses: readonly TemplateSnippet[] = [
  {
    id: "payment",
    title: "การชำระค่าเช่า",
    description: "ยอดค่าเช่า วันครบกำหนด และค่าปรับเมื่อชำระช้า",
    html: clause("การชำระค่าเช่า", "ผู้เช่าตกลงชำระค่าเช่าเดือนละ {{rent_amount}} บาท ({{rent_amount_text}}) ภายในวันที่ {{payment_due_day}} ของทุกเดือน หากชำระล่าช้า ผู้ให้เช่ามีสิทธิ์คิดค่าปรับตามอัตราที่หอพักประกาศไว้"),
  },
  {
    id: "utilities",
    title: "ค่าน้ำและค่าไฟ",
    description: "อัตราต่อหน่วยตามที่ตั้งค่าไว้ในระบบ",
    html: clause("ค่าน้ำและค่าไฟ", "ผู้เช่าตกลงชำระค่าน้ำประปาหน่วยละ {{water_rate}} บาท และค่าไฟฟ้าหน่วยละ {{electricity_rate}} บาท ตามเลขมิเตอร์ที่จดในแต่ละรอบบิล"),
  },
  {
    id: "deposit",
    title: "เงินประกันและการคืนเงิน",
    description: "ยอดเงินประกันและเงื่อนไขการหักก่อนคืน",
    html: clause("เงินประกัน", "ผู้เช่าได้วางเงินประกันไว้เป็นจำนวน {{deposit_amount}} บาท ({{deposit_amount_text}}) ผู้ให้เช่าจะคืนเงินประกันภายใน 30 วันนับจากวันที่ผู้เช่าย้ายออกและส่งมอบห้องคืน หลังหักค่าเสียหายหรือค่าใช้จ่ายที่ค้างชำระ (ถ้ามี)"),
  },
  {
    id: "furniture",
    title: "ทรัพย์สินในห้อง",
    description: "รายการเฟอร์นิเจอร์ของห้องจากหน้าตั้งค่าห้อง",
    html: clause("ทรัพย์สินในห้อง", "ผู้ให้เช่าส่งมอบห้องพร้อมทรัพย์สินดังนี้ {{furniture_list}} ผู้เช่าต้องดูแลรักษาให้อยู่ในสภาพดี หากชำรุดเสียหายจากการใช้งานผิดปกติ ผู้เช่าต้องรับผิดชอบค่าซ่อมแซมหรือค่าทดแทน"),
  },
  {
    id: "rules",
    title: "ข้อห้ามภายในห้องพัก",
    description: "สัตว์เลี้ยง การดัดแปลงห้อง และการให้ผู้อื่นเช่าช่วง",
    html: clause("ข้อห้าม", "ผู้เช่าจะไม่นำสัตว์เลี้ยงเข้ามาในห้องพัก ไม่ดัดแปลงหรือต่อเติมห้องโดยไม่ได้รับอนุญาตเป็นลายลักษณ์อักษร ไม่ให้ผู้อื่นเช่าช่วง และไม่กระทำการใดที่รบกวนผู้พักอาศัยรายอื่นหรือผิดกฎหมาย"),
  },
  {
    id: "termination",
    title: "การบอกเลิกสัญญา",
    description: "การแจ้งล่วงหน้าและกรณีที่ผู้ให้เช่าเลิกสัญญาได้",
    html: clause("การบอกเลิกสัญญา", "หากผู้เช่าประสงค์จะย้ายออกก่อนครบกำหนด ต้องแจ้งผู้ให้เช่าล่วงหน้าไม่น้อยกว่า 30 วัน หากผู้เช่าผิดสัญญาข้อใดข้อหนึ่งหรือค้างชำระค่าเช่าเกินกว่าที่กฎหมายกำหนด ผู้ให้เช่ามีสิทธิ์บอกเลิกสัญญาได้ทันที"),
  },
  {
    id: "period",
    title: "ระยะเวลาเช่า",
    description: "วันเริ่มและวันสิ้นสุดสัญญา",
    html: clause("ระยะเวลาเช่า", "สัญญานี้มีกำหนดระยะเวลาตั้งแต่วันที่ {{start_date}} ถึงวันที่ {{end_date}} เมื่อครบกำหนดแล้วหากทั้งสองฝ่ายประสงค์จะเช่าต่อ ให้ทำสัญญาฉบับใหม่"),
  },
];

// บล็อกลายเซ็นสองฝั่ง มีเส้นเซ็น ชื่อในวงเล็บ และที่ลงวันที่ ใช้คลาส signature-grid ที่ PDF รู้จักอยู่แล้ว
const signatureParties: Record<DocumentKind, [string, string, string, string]> = {
  contract: ["{{lessor_name}}", "ผู้ให้เช่า", "{{tenant_name}}", "ผู้เช่า"],
  invoice: ["{{property_name}}", "ผู้ออกบิล", "{{tenant_name}}", "ผู้รับบิล"],
  receipt: ["{{property_name}}", "ผู้รับเงิน", "{{tenant_name}}", "ผู้ชำระเงิน"],
};

export function signatureBlockHtml(kind: DocumentKind) {
  const [leftName, leftRole, rightName, rightRole] = signatureParties[kind];
  const party = (name: string, role: string) => `<div class="signature-line">ลงชื่อ<br>(${name})<br>${role}<br>วันที่ ........./........./.........</div>`;
  return `<div class="signature-grid">${party(leftName, leftRole)}${party(rightName, rightRole)}</div>`;
}
