/**
 * หน้าที่ของไฟล์นี้: ฟังก์ชันช่วยเหลือ form-validation ที่รวมตรรกะใช้ซ้ำและไม่มีหน้าจอเป็นของตัวเอง
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
export type FieldErrors = Record<string, string[]>;

/** อ่านข้อมูลที่จำเป็นสำหรับ readFieldErrors โดยไม่ตั้งใจเปลี่ยนข้อมูลต้นทาง */
export function readFieldErrors(body: unknown): FieldErrors {
  if (!body || typeof body !== "object" || !("fields" in body)) return {};
  const fields = (body as { fields?: unknown }).fields;
  if (!fields || typeof fields !== "object") return {};
  return Object.fromEntries(Object.entries(fields).flatMap(([name, messages]) => {
    if (!Array.isArray(messages)) return [];
    const valid = messages.filter((message): message is string => typeof message === "string" && Boolean(message));
    return valid.length ? [[name, valid]] : [];
  }));
}

/** ฟังก์ชันสาธารณะ fieldMessage เป็นทางเข้าที่โมดูลอื่นเรียกใช้; รายละเอียดเงื่อนไขอยู่ในบรรทัดภายในฟังก์ชัน */
export function fieldMessage(errors: FieldErrors, name: string) {
  const message = errors[name]?.[0];
  if (!message) return null;
  if (/required|too_small|at least|must contain/i.test(message)) return "จำเป็นต้องกรอกข้อมูลช่องนี้ให้ครบถ้วน";
  if (/too_big|at most|maximum/i.test(message)) return "ข้อมูลยาวหรือมีค่ามากเกินกว่าที่ระบบกำหนด";
  if (/url/i.test(message)) return "กรุณากรอก URL ที่ถูกต้อง เช่น https://example.com";
  if (/email/i.test(message)) return "กรุณากรอกอีเมลให้ถูกต้อง";
  if (/invalid.*string|regex/i.test(message)) return "รูปแบบข้อมูลไม่ถูกต้อง";
  return message;
}

/** ฟังก์ชันสาธารณะ focusFirstInvalid เป็นทางเข้าที่โมดูลอื่นเรียกใช้; รายละเอียดเงื่อนไขอยู่ในบรรทัดภายในฟังก์ชัน */
export function focusFirstInvalid(form: HTMLFormElement, errors: FieldErrors) {
  const name = Object.keys(errors)[0];
  if (!name) return;
  window.requestAnimationFrame(() => {
    const field = form.elements.namedItem(name);
    if (!(field instanceof HTMLElement)) return;
    field.focus({ preventScroll: true });
    field.scrollIntoView({ block: "center" });
  });
}
