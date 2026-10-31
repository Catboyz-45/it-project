import { z } from "zod";

// กฎรหัสผ่านชุดเดียวของทั้งระบบ เซิร์ฟเวอร์ใช้ตรวจจริงผ่าน newPasswordSchema
// ส่วนหน้าจอใช้ passwordRules ทำเช็คลิสต์ ผู้ใช้จะเห็นกฎตรงกับที่ระบบบังคับเสมอ
// เดิมแต่ละหน้าเขียนกฎเอง จนหน้ารีเซ็ตรหัสผ่านตรวจแค่ความยาว ขณะที่หน้าเปลี่ยนรหัสบังคับครบทุกข้อ

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

export type PasswordRule = {
  id: "length" | "uppercase" | "lowercase" | "digit";
  label: string;
  // ข้อความตอนเซิร์ฟเวอร์ปฏิเสธ บอกว่าขาดอะไร
  message: string;
  test: (value: string) => boolean;
};

export const passwordRules: readonly PasswordRule[] = [
  {
    id: "length",
    label: `อย่างน้อย ${PASSWORD_MIN_LENGTH} ตัวอักษร`,
    message: `รหัสผ่านต้องมีอย่างน้อย ${PASSWORD_MIN_LENGTH} ตัวอักษร`,
    test: (value) => value.length >= PASSWORD_MIN_LENGTH,
  },
  {
    id: "uppercase",
    label: "ตัวพิมพ์ใหญ่ภาษาอังกฤษ (A-Z)",
    message: "รหัสผ่านต้องมีตัวอักษรภาษาอังกฤษพิมพ์ใหญ่",
    test: (value) => /[A-Z]/.test(value),
  },
  {
    id: "lowercase",
    label: "ตัวพิมพ์เล็กภาษาอังกฤษ (a-z)",
    message: "รหัสผ่านต้องมีตัวอักษรภาษาอังกฤษพิมพ์เล็ก",
    test: (value) => /[a-z]/.test(value),
  },
  {
    id: "digit",
    label: "ตัวเลข (0-9)",
    message: "รหัสผ่านต้องมีตัวเลข",
    test: (value) => /\d/.test(value),
  },
];

export function meetsPasswordPolicy(value: string) {
  return value.length <= PASSWORD_MAX_LENGTH && passwordRules.every((rule) => rule.test(value));
}

// ใช้กับทุกช่องที่ตั้งรหัสผ่านใหม่ ทั้งสมัคร รีเซ็ต เปลี่ยนรหัส และแอดมินสร้างบัญชี
export const newPasswordSchema = passwordRules.reduce(
  (schema, rule) => schema.refine(rule.test, rule.message),
  z.string().max(PASSWORD_MAX_LENGTH, `รหัสผ่านต้องไม่เกิน ${PASSWORD_MAX_LENGTH} ตัวอักษร`),
);
