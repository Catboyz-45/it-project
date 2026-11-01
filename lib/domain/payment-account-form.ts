import { formatBankAccount, formatThaiPhone } from "@/lib/thai-format";

// ตัวช่วยของฟอร์มช่องทางรับเงิน ตรวจแบบเดียวกับ platformPaymentSettingsSchema ฝั่งเซิร์ฟเวอร์
// เพื่อบอกผิดตรงช่องทันที ไม่ต้องรอกดบันทึกแล้วอ่านข้อความรวมท้ายฟอร์ม

// ธนาคารที่คนไทยใช้รับโอนบ่อย เก็บเป็นชื่อเต็มภาษาไทย ค่าเดียวกับที่ผู้จ่ายเห็นในหน้าชำระ
export const thaiBanks = [
  "ธนาคารกสิกรไทย",
  "ธนาคารไทยพาณิชย์",
  "ธนาคารกรุงเทพ",
  "ธนาคารกรุงไทย",
  "ธนาคารกรุงศรีอยุธยา",
  "ธนาคารทหารไทยธนชาต",
  "ธนาคารออมสิน",
  "ธนาคารเพื่อการเกษตรและสหกรณ์การเกษตร",
  "ธนาคารอาคารสงเคราะห์",
  "ธนาคารยูโอบี",
  "ธนาคารซีไอเอ็มบี ไทย",
  "ธนาคารเกียรตินาคินภัทร",
  "ธนาคารแลนด์ แอนด์ เฮ้าส์",
  "ธนาคารทิสโก้",
  "ธนาคารอิสลามแห่งประเทศไทย",
] as const;

export type PaymentAccountDraft = {
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;
  promptPayId: string;
};

export type PaymentAccountErrors = Partial<Record<keyof PaymentAccountDraft, string>>;

const digitsOf = (value: string) => value.replace(/[\s-]/g, "");

// ชื่อธนาคารที่เคยพิมพ์ไว้เองก่อนมีรายการให้เลือก ต้องยังเลือกได้ ไม่งั้นช่องจะว่างทั้งที่มีค่าอยู่
export function bankOptions(current: string) {
  const names: string[] = [...thaiBanks];
  if (current.trim() && !names.includes(current.trim())) names.unshift(current.trim());
  return names;
}

// เลขพร้อมเพย์ เบอร์มือถือ 10 หลักเป็น 081-234-5678 เลขประจำตัว 13 หลักเป็น 0-1055-00000-00-1
export function formatPromptPayId(value: string) {
  const digits = digitsOf(value);
  if (digits.length === 10) return formatThaiPhone(digits);
  if (digits.length === 13) return `${digits.slice(0, 1)}-${digits.slice(1, 5)}-${digits.slice(5, 10)}-${digits.slice(10, 12)}-${digits.slice(12)}`;
  return value;
}

export function formatAccountNumber(value: string) {
  return formatBankAccount(digitsOf(value)) || value;
}

export function validatePaymentAccount(draft: PaymentAccountDraft): PaymentAccountErrors {
  const errors: PaymentAccountErrors = {};
  const bank = { bankName: draft.bankName.trim(), bankAccountNumber: digitsOf(draft.bankAccountNumber), bankAccountName: draft.bankAccountName.trim() };
  const filled = Object.values(bank).filter(Boolean).length;
  // ครบทั้งสามช่องหรือว่างทั้งหมด ใส่ไม่ครบผู้จ่ายโอนไม่ได้
  if (filled > 0 && filled < 3) {
    if (!bank.bankName) errors.bankName = "เลือกธนาคาร";
    if (!bank.bankAccountNumber) errors.bankAccountNumber = "กรอกเลขที่บัญชี";
    if (!bank.bankAccountName) errors.bankAccountName = "กรอกชื่อบัญชี";
  }
  if (bank.bankAccountNumber && !/^\d{10,12}$/.test(bank.bankAccountNumber)) errors.bankAccountNumber = "เลขบัญชีต้องเป็นตัวเลข 10-12 หลัก";
  const promptPay = digitsOf(draft.promptPayId);
  if (promptPay && !/^\d{10,15}$/.test(promptPay)) errors.promptPayId = "เลขพร้อมเพย์ต้องเป็นตัวเลข 10-15 หลัก";
  return errors;
}

// ค่าที่ส่งให้เซิร์ฟเวอร์ ช่องว่างเป็น null เพื่อล้างค่า เลขส่งแค่ตัวเลข
export function toPaymentAccountPayload(draft: PaymentAccountDraft) {
  const text = (value: string) => value.trim() || null;
  return {
    bankName: text(draft.bankName),
    bankAccountNumber: text(digitsOf(draft.bankAccountNumber)),
    bankAccountName: text(draft.bankAccountName),
    promptPayId: text(digitsOf(draft.promptPayId)),
  };
}

export function hasBankAccount(draft: PaymentAccountDraft) {
  return Boolean(draft.bankName.trim() && digitsOf(draft.bankAccountNumber) && draft.bankAccountName.trim());
}
