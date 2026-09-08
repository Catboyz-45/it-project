/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นตัวช่วยฝั่งเบราว์เซอร์สำหรับ “api error” เช่น interaction การเรียก API หรือสถานะหน้าจอ
 * การทำงาน: ทำงานหลังหน้าโหลดแล้วและต้องถือว่าข้อมูลจากผู้ใช้ไม่น่าเชื่อถือ; เซิร์ฟเวอร์ยังต้องตรวจข้อมูลและสิทธิ์ซ้ำเสมอ
 */

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: type “Api Error Payload” อธิบายรูปแบบข้อมูลให้ TypeScript ตรวจระหว่างพัฒนา; ก้อนนี้ไม่ทำงานเองตอน runtime
 */
export type ApiErrorPayload = {
  error?: string;
  requestId?: string;
};

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: คลาส “Client Api Error” รวมข้อมูลและพฤติกรรมที่ต้องทำงานร่วมกันเป็นออบเจ็กต์เดียว
 */
export class ClientApiError extends Error {
  readonly requestId?: string;

  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: เตรียมค่าเริ่มต้นเมื่อสร้างออบเจ็กต์ api error
   * รับค่า:
   * - message: ค่า “message” ที่จำเป็นต่อการทำงานของก้อนนี้
   * - requestId: รหัสภายในของ request
   * ผลลัพธ์: ไม่มีค่าคืน; ผลคือออบเจ็กต์หรือสถานะภายในได้รับการตั้งค่า
   */
  constructor(message: string, requestId?: string) {
    super(message);
    this.name = "ClientApiError";
    this.requestId = requestId;
  }
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: สร้างหรือส่งข้อมูลในขั้นตอน “create Api Error” หลังผ่านการตรวจที่เกี่ยวข้อง
 * รับค่า:
 * - payload: ค่า “payload” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - fallbackMessage: ค่า “fallback Message” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export function createApiError(payload: ApiErrorPayload, fallbackMessage: string) {
  return new ClientApiError(payload.error || fallbackMessage, payload.requestId);
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: แปลงข้อมูลในขั้นตอน “format Client Error” ให้เป็นรูปแบบมาตรฐานที่ส่วนถัดไปใช้ได้
 * รับค่า:
 * - error: ข้อผิดพลาดที่ต้องแปลง บันทึก หรือแสดงอย่างปลอดภัย
 * - fallbackMessage: ค่า “fallback Message” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export function formatClientError(error: unknown, fallbackMessage: string) {
  if (!(error instanceof Error)) return fallbackMessage;
  const requestId = error instanceof ClientApiError ? error.requestId : undefined;
  return requestId ? `${error.message} (รหัสอ้างอิง: ${requestId})` : error.message;
}

/** Read the shared API envelope without losing the request ID returned by the server. */
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “read Api Payload” แล้วส่งผลที่เหมาะสมกลับไป
 * รับค่า:
 * - response: ผลตอบกลับ HTTP ที่กำลังจัดเตรียม
 * - fallbackMessage: ค่า “fallback Message” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลชนิด Promise<T> ตามสัญญา TypeScript ของฟังก์ชัน
 */
export async function readApiPayload<T extends ApiErrorPayload>(
  response: Response,
  fallbackMessage: string,
): Promise<T> {
  let payload: T;
  try {
    payload = await response.json() as T;
  } catch {
    throw new ClientApiError(fallbackMessage, response.headers.get("x-request-id") ?? undefined);
  }

  if (!response.ok) {
    throw createApiError({
      ...payload,
      requestId: payload.requestId ?? response.headers.get("x-request-id") ?? undefined,
    }, fallbackMessage);
  }
  return payload;
}

/** Read the standard `{ data, requestId }` success envelope. */
/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “read Api Data” แล้วส่งผลที่เหมาะสมกลับไป
 * รับค่า:
 * - response: ผลตอบกลับ HTTP ที่กำลังจัดเตรียม
 * - fallbackMessage: ค่า “fallback Message” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลชนิด Promise<T> ตามสัญญา TypeScript ของฟังก์ชัน
 */
export async function readApiData<T>(response: Response, fallbackMessage: string): Promise<T> {
  const payload = await readApiPayload<ApiErrorPayload & { data?: T }>(response, fallbackMessage);
  if (payload.data === undefined) {
    throw new ClientApiError(fallbackMessage, payload.requestId ?? response.headers.get("x-request-id") ?? undefined);
  }
  return payload.data;
}
