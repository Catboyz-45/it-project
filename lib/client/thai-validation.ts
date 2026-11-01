// แปลข้อความเตือนของฟอร์มเป็นภาษาไทย แทนข้อความของเบราว์เซอร์ที่เป็นภาษาอังกฤษในเครื่องที่ตั้งภาษาอังกฤษ
// เช่น "Please fill out this field" ทำงานกับช่องที่ใช้ required, min, max, minLength และ type="email" อยู่แล้ว

type ValidatedField = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

// ข้อมูลเท่าที่ต้องใช้เลือกข้อความ แยกจาก DOM จริงไว้ให้เทสต์ได้โดยไม่ต้องมีเบราว์เซอร์
export type FieldState = {
  validity: Pick<ValidityState, "valueMissing" | "typeMismatch" | "badInput" | "tooShort" | "tooLong" | "rangeUnderflow" | "rangeOverflow" | "stepMismatch" | "patternMismatch">;
  tag: "input" | "select" | "textarea";
  type?: string;
  minLength?: number;
  maxLength?: number;
  min?: string;
  max?: string;
  title?: string;
};

// เลือกข้อความจากสถานะที่เบราว์เซอร์ตรวจแล้ว ไล่จากข้อที่พบบ่อยที่สุดก่อน คืนค่าว่างถ้าไม่ต้องแปล
export function thaiValidationMessage(field: FieldState) {
  const { validity, type = "" } = field;
  if (validity.valueMissing) {
    if (field.tag === "select") return "กรุณาเลือกตัวเลือก";
    if (type === "file") return "กรุณาเลือกไฟล์";
    if (type === "checkbox") return "กรุณาติ๊กช่องนี้ก่อนดำเนินการต่อ";
    if (type === "radio") return "กรุณาเลือกหนึ่งตัวเลือก";
    return "กรุณากรอกช่องนี้";
  }
  if (validity.typeMismatch) return type === "email" ? "รูปแบบอีเมลไม่ถูกต้อง เช่น name@example.com" : "รูปแบบข้อมูลไม่ถูกต้อง";
  if (validity.badInput) return "กรุณากรอกเป็นตัวเลข";
  if (validity.tooShort) return `กรุณากรอกอย่างน้อย ${field.minLength} ตัวอักษร`;
  if (validity.tooLong) return `กรอกได้ไม่เกิน ${field.maxLength} ตัวอักษร`;
  if (validity.rangeUnderflow) return `ต้องไม่น้อยกว่า ${Number(field.min).toLocaleString("th-TH")}`;
  if (validity.rangeOverflow) return `ต้องไม่เกิน ${Number(field.max).toLocaleString("th-TH")}`;
  if (validity.stepMismatch) return "ตัวเลขมีทศนิยมเกินที่กำหนด";
  // ช่องที่ใส่ title ไว้อธิบายรูปแบบ ใช้ข้อความนั้นเลย จะได้บอกได้ตรงกว่าข้อความกลาง
  if (validity.patternMismatch) return field.title || "รูปแบบข้อมูลไม่ถูกต้อง";
  return "";
}

function fieldState(field: ValidatedField): FieldState {
  if (field instanceof HTMLSelectElement) return { validity: field.validity, tag: "select" };
  if (field instanceof HTMLTextAreaElement) return { validity: field.validity, tag: "textarea", minLength: field.minLength, maxLength: field.maxLength };
  return {
    validity: field.validity, tag: "input", type: field.type,
    minLength: field.minLength, maxLength: field.maxLength, min: field.min, max: field.max, title: field.title,
  };
}

// ติดตั้งครั้งเดียวที่ document ดักทุกฟอร์มทั้งแอป คืนฟังก์ชันถอนออก
// จำไว้ว่าช่องไหนเราตั้งข้อความให้ ตอนผู้ใช้แก้จะล้างเฉพาะของเรา ไม่ไปล้างข้อความที่โค้ดหน้าอื่นตั้งไว้เอง
export function installThaiValidationMessages(root: Document) {
  const translated = new WeakSet<EventTarget>();
  const isField = (target: EventTarget | null): target is ValidatedField =>
    target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;

  const onInvalid = (event: Event) => {
    const field = event.target;
    if (!isField(field) || (field.validity.customError && !translated.has(field))) return;
    const message = thaiValidationMessage(fieldState(field));
    if (!message) return;
    field.setCustomValidity(message);
    translated.add(field);
  };
  const onEdit = (event: Event) => {
    const field = event.target;
    if (!isField(field) || !translated.has(field)) return;
    field.setCustomValidity("");
    translated.delete(field);
  };

  // capture เพราะ invalid ไม่ลอยขึ้นมาถึง document เอง
  root.addEventListener("invalid", onInvalid, true);
  root.addEventListener("input", onEdit, true);
  root.addEventListener("change", onEdit, true);
  return () => {
    root.removeEventListener("invalid", onInvalid, true);
    root.removeEventListener("input", onEdit, true);
    root.removeEventListener("change", onEdit, true);
  };
}
