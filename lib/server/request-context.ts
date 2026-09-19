import type { NextRequest } from "next/server";

// ข้อมูลว่าใครเป็นคนยิงคำขอนี้ ใช้ตอนเขียน audit log
export type RequestActorContext = {
  userId?: string;
  propertyId?: string;
};

// WeakMap ผูกข้อมูลไว้กับ request โดยไม่ต้องแก้ตัว request เอง
// พอคำขอจบและถูกเก็บกวาด ข้อมูลตรงนี้ก็หายตามไปเอง ไม่ต้องล้างเอง
const requestContexts = new WeakMap<NextRequest, RequestActorContext>();

// รวมของเดิมกับของใหม่ เพราะ userId กับ propertyId ถูกใส่คนละจังหวะระหว่างทาง
export function setRequestActorContext(
  request: NextRequest,
  context: RequestActorContext,
) {
  requestContexts.set(request, { ...requestContexts.get(request), ...context });
}

// คืน object ว่างถ้ายังไม่มีใครใส่ ผู้เรียกจะได้ไม่ต้องเช็ค null
export function getRequestActorContext(request: NextRequest) {
  return requestContexts.get(request) ?? {};
}
