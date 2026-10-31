// รูปแบบข้อผิดพลาดที่ทุก API ในระบบตอบกลับมาเหมือนกัน
export type ApiErrorPayload = {
  error?: string;
  // รหัสอ้างอิงของคำขอ ผู้ใช้แจ้งรหัสนี้มา ทีมงานจะหา log ของคำขอนั้นเจอ
  requestId?: string;
};

// Error ที่พก requestId ติดมาด้วย จะได้แสดงให้ผู้ใช้เห็นเวลาต้องแจ้งปัญหา
export class ClientApiError extends Error {
  readonly requestId?: string;
  // รหัสสถานะ HTTP ถ้ารู้ ใช้แยกว่าเป็นเงื่อนไขทางธุรกิจที่ตั้งใจตอบ หรือระบบขัดข้องจริง
  readonly status?: number;

  constructor(message: string, requestId?: string, status?: number) {
    super(message);
    this.name = "ClientApiError";
    this.requestId = requestId;
    this.status = status;
  }
}

export function createApiError(payload: ApiErrorPayload, fallbackMessage: string, status?: number) {
  return new ClientApiError(payload.error || fallbackMessage, payload.requestId, status);
}

// แปลงข้อผิดพลาดเป็นข้อความที่ผู้ใช้อ่านรู้เรื่อง ไม่หลุดรายละเอียดภายในระบบออกไป
export function formatClientError(error: unknown, fallbackMessage: string) {
  // ไม่ใช่ Error ก็แปลว่ามีอะไรผิดปกติที่เราไม่รู้ ใช้ข้อความสำรองไปเลย
  if (!(error instanceof Error)) return fallbackMessage;
  // ข้อผิดพลาด 4xx คือเงื่อนไขที่ระบบตั้งใจบอก เช่น "หอพักยังไม่ได้ตั้งค่า PromptPay" ข้อความอธิบายครบแล้ว
  // แนบรหัสอ้างอิงเฉพาะตอนระบบขัดข้องหรือไม่รู้สถานะ ซึ่งผู้ใช้ต้องใช้รหัสนี้แจ้งทีมงาน
  const isExpectedFailure = error instanceof ClientApiError && error.status !== undefined && error.status < 500;
  const requestId = error instanceof ClientApiError && !isExpectedFailure ? error.requestId : undefined;
  return requestId ? `${error.message} (รหัสอ้างอิง: ${requestId})` : error.message;
}

// อ่านคำตอบจาก API พร้อมโยน error ที่มีข้อความและรหัสอ้างอิงครบ
export async function readApiPayload<T extends ApiErrorPayload>(
  response: Response,
  fallbackMessage: string,
): Promise<T> {
  let payload: T;
  try {
    payload = await response.json() as T;
  } catch {
    // ตอบกลับมาไม่ใช่ JSON เช่นหน้า error ของ proxy ก็ยังพอเอา requestId จาก header ได้
    throw new ClientApiError(fallbackMessage, response.headers.get("x-request-id") ?? undefined, response.status);
  }

  if (!response.ok) {
    throw createApiError({
      ...payload,
      // เอาจากตัวข้อมูลก่อน ไม่มีค่อยไปเอาจาก header
      requestId: payload.requestId ?? response.headers.get("x-request-id") ?? undefined,
    }, fallbackMessage, response.status);
  }
  return payload;
}

// แบบเดียวกันแต่ดึงเฉพาะ data ออกมาให้เลย ตอบ 200 แต่ไม่มี data ก็ถือว่าไม่สำเร็จ
export async function readApiData<T>(response: Response, fallbackMessage: string): Promise<T> {
  const payload = await readApiPayload<ApiErrorPayload & { data?: T }>(response, fallbackMessage);
  if (payload.data === undefined) {
    throw new ClientApiError(fallbackMessage, payload.requestId ?? response.headers.get("x-request-id") ?? undefined);
  }
  return payload.data;
}
