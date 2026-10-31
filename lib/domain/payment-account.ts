import { z } from "zod";

// ช่องทางรับเงินที่แสดงให้ผู้จ่ายเห็น ใช้ทั้งบัญชีรับค่าเช่าของหอ และบัญชีรับค่าแพ็กเกจของแพลตฟอร์ม
// ทุกช่องว่างได้ ส่ง null มาคือล้างค่า หอที่ยังไม่ตั้งจะได้ไม่ติดตอนบันทึกส่วนอื่น

// เลขบัญชีธนาคารไทยยาว 10-12 หลัก (ออมสินและ ธ.ก.ส. 12 หลัก) รับขีดกับเว้นวรรคได้ แต่เก็บแค่ตัวเลข
const bankAccountNumberSchema = z.string().trim()
  .transform((value) => value.replace(/[\s-]/g, ""))
  .pipe(z.string().regex(/^\d{10,12}$/, "เลขบัญชีต้องเป็นตัวเลข 10-12 หลัก"));

// เบอร์โทร 10 หลักหรือเลขประจำตัว 13 หลัก เอาเฉพาะตัวเลข เพราะต้องเอาไปสร้าง QR พร้อมเพย์
export const promptPayIdSchema = z.string().trim().regex(/^\d{10,15}$/, "เลขพร้อมเพย์ต้องเป็นตัวเลข 10-15 หลัก");

export const bankAccountFields = {
  bankName: z.string().trim().min(1).max(80).nullable().optional(),
  bankAccountNumber: bankAccountNumberSchema.nullable().optional(),
  bankAccountName: z.string().trim().min(1).max(160).nullable().optional(),
};

// ใส่ไม่ครบชุดแล้วผู้จ่ายโอนไม่ได้ จึงบังคับว่าต้องมีครบทั้งสามช่อง หรือว่างทั้งหมด
export function refineBankAccount(
  value: { bankName?: string | null; bankAccountNumber?: string | null; bankAccountName?: string | null },
  context: z.RefinementCtx,
) {
  const filled = [value.bankName, value.bankAccountNumber, value.bankAccountName].filter(Boolean).length;
  if (filled !== 0 && filled !== 3) {
    context.addIssue({ code: "custom", message: "กรอกธนาคาร เลขบัญชี และชื่อบัญชีให้ครบ หรือเว้นว่างทั้งหมด", path: ["bankAccountNumber"] });
  }
}

// บัญชีรับค่าแพ็กเกจของแพลตฟอร์ม Super Admin บันทึกทั้งชุดทุกครั้ง
export const platformPaymentSettingsSchema = z.object({
  ...bankAccountFields,
  promptPayId: promptPayIdSchema.nullable().optional(),
}).strict().superRefine(refineBankAccount);
