// รูปแบบข้อผิดพลาดที่ทุก API ในระบบตอบกลับมาเหมือนกัน
export type ApiErrorPayload = {
  error?: string;
  // รหัสอ้างอิงของคำขอ ผู้ใช้แจ้งรหัสนี้มา ทีมงานจะหา log ของคำขอนั้นเจอ
  requestId?: string;
};

// Error ที่พก requestId ติดมาด้วย จะได้แสดงให้ผู้ใช้เห็นเวลาต้องแจ้งปัญหา
export class ClientApiError extends Error {
  readonly requestId?: string;

  constructor(message: string, requestId?: string) {
    super(message);
    this.name = "ClientApiError";
    this.requestId = requestId;
  }
}

export function createApiError(payload: ApiErrorPayload, fallbackMessage: string) {
  return new ClientApiError(payload.error || fallbackMessage, payload.requestId);
}

// แปลงข้อผิดพลาดเป็นข้อความที่ผู้ใช้อ่านรู้เรื่อง ไม่หลุดรายละเอียดภายในระบบออกไป
export function formatClientError(error: unknown, fallbackMessage: string) {
  // ไม่ใช่ Error ก็แปลว่ามีอะไรผิดปกติที่เราไม่รู้ ใช้ข้อความสำรองไปเลย
  if (!(error instanceof Error)) return fallbackMessage;
  const requestId = error instanceof ClientApiError ? error.requestId : undefined;
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
    throw new ClientApiError(fallbackMessage, response.headers.get("x-request-id") ?? undefined);
  }

  if (!response.ok) {
    throw createApiError({
      ...payload,
      // เอาจากตัวข้อมูลก่อน ไม่มีค่อยไปเอาจาก header
      requestId: payload.requestId ?? response.headers.get("x-request-id") ?? undefined,
    }, fallbackMessage);
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
