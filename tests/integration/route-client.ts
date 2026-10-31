import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createSession, sessionCookieName } from "@/lib/server/auth";

// ตัวเรียก route handler ตรง ๆ ให้เทสต์เขียนเหมือนเรียก API จริงด้วย URL
// หาไฟล์ route จาก URL เองตามกติกาโฟลเดอร์ของ Next ([propertyId] คือพารามิเตอร์)
// จึงไม่ต้อง import route ทีละไฟล์ และได้ทดสอบทั้งชั้น route กับชั้น service พร้อมกัน

export const routeMethods = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
export type RouteMethod = (typeof routeMethods)[number];
type Handler = (request: NextRequest, context: { params: Promise<Record<string, string>> }) => Promise<Response>;
export type RouteModule = Partial<Record<RouteMethod, Handler>>;

export const routeModules = import.meta.glob<RouteModule>("/app/api/**/route.ts");

const routeTable = Object.keys(routeModules)
  .map((file) => ({ file, segments: file.replace(/^\/app/, "").replace(/\/route\.ts$/, "").split("/") }))
  // เส้นที่มีส่วนคงที่มากกว่าต้องถูกเลือกก่อน เช่น /tenants/export ต้องชนะ /tenants/[id]
  .sort((left, right) => countDynamic(left.segments) - countDynamic(right.segments));

function countDynamic(segments: string[]) {
  return segments.filter((segment) => segment.startsWith("[")).length;
}

function resolveRoute(pathname: string) {
  const parts = pathname.split("/");
  for (const route of routeTable) {
    if (route.segments.length !== parts.length) continue;
    const params: Record<string, string> = {};
    const matches = route.segments.every((segment, index) => {
      if (segment.startsWith("[") && segment.endsWith("]")) {
        params[segment.slice(1, -1)] = decodeURIComponent(parts[index]);
        return true;
      }
      return segment === parts[index];
    });
    if (matches) return { file: route.file, params };
  }
  throw new Error(`No route handler for ${pathname}`);
}

export async function sessionCookieFor(userId: string) {
  const response = NextResponse.json({ ok: true });
  await createSession(userId, response);
  const token = response.cookies.get(sessionCookieName)?.value;
  if (!token) throw new Error("Failed to create a session for the integration test");
  return token;
}

let ipCounter = 0;
// สุ่มส่วนต้นของ IP ทุกครั้งที่รัน แถวโควตาในฐานข้อมูลอยู่ได้หนึ่งชั่วโมง รันซ้ำเร็ว ๆ จะได้ไม่ชนของรอบก่อน
const ipPrefix = `10.${Math.floor(Math.random() * 200) + 20}`;

export type ApiCallOptions = {
  cookie?: string;
  body?: unknown;
  form?: FormData;
  headers?: Record<string, string>;
};

// เรียก route ตาม method กับ URL แล้วคืนสถานะกับ JSON ที่อ่านแล้ว (ถ้าคำตอบเป็น JSON)
export async function callApi(method: RouteMethod, url: string, options: ApiCallOptions = {}) {
  const target = new URL(url, "http://localhost");
  const { file, params } = resolveRoute(target.pathname);
  const handler = (await routeModules[file]())[method];
  if (!handler) throw new Error(`${file} has no ${method} handler`);
  ipCounter += 1;
  const headers: Record<string, string> = {
    origin: "http://localhost",
    host: "localhost",
    // IP คนละค่าทุกคำขอ จะได้ไม่ไปชนโควตาจำกัดจำนวนครั้งของกันและกัน
    "x-forwarded-for": `${ipPrefix}.${Math.floor(ipCounter / 250)}.${ipCounter % 250}`,
    "x-request-id": randomUUID(),
    ...(options.form ? {} : { "content-type": "application/json" }),
    ...(options.cookie ? { cookie: `${sessionCookieName}=${options.cookie}` } : {}),
    ...options.headers,
  };
  const body = options.form ?? (options.body === undefined ? undefined : JSON.stringify(options.body));
  const request = new NextRequest(target, { method, headers, body });
  const response = await handler(request, { params: Promise.resolve(params) });
  const contentType = response.headers.get("content-type") ?? "";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let json: any;
  let text: string | undefined;
  if (contentType.includes("application/json")) json = await response.json();
  // สตรีมแบบ event-stream ไม่มีวันจบเอง ต้องปิดทิ้ง ไม่งั้นการอ่านจะค้าง
  else if (contentType.includes("text/event-stream")) await response.body?.cancel().catch(() => undefined);
  else text = await response.text();
  return { status: response.status, json, text, headers: response.headers };
}
