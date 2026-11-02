import { z } from "zod";

// เบอร์โทรรับได้แค่ตัวเลข มี + นำหน้าได้ และมีขีดหรือช่องว่างคั่นได้ตามที่คนชอบพิมพ์
// ต้องมีตัวเลขจริงอย่างน้อย 8 ตัว กันกรอกตัวอักษรหรือขีดล้วนแล้วผ่านเพราะความยาวถึง
const PHONE_PATTERN = /^\+?\d[\d\s-]*$/;
const PHONE_MESSAGE = "กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง (ตัวเลขอย่างน้อย 8 หลัก)";

export const isValidPhoneNumber = (value: string) =>
  PHONE_PATTERN.test(value) && value.replace(/\D/g, "").length >= 8;

export const phoneNumberSchema = z.string().trim().max(30, PHONE_MESSAGE).refine(isValidPhoneNumber, PHONE_MESSAGE);

// รูปแบบเดียวกันสำหรับแอตทริบิวต์ pattern ของช่องกรอก เบราว์เซอร์จะเตือนก่อนส่งฟอร์ม
export const PHONE_INPUT_PATTERN = "\\+?[0-9][0-9\\s\\-]*";
