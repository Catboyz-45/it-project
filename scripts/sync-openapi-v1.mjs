import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { jsonSuccessResponse, responseSchemas } from "./openapi-response-contracts.mjs";
import { requestContract } from "./openapi-request-contracts.mjs";

// สร้าง docs/openapi.json ใหม่จาก route จริงใต้ app/api/v1
// เขียนด้วยมือทั้งไฟล์คงตามไม่ไหว มี 120 กว่าเส้นทาง ให้เครื่องสร้างตามโค้ดแทน
const root = new URL("../", import.meta.url);
const methods = ["get", "post", "put", "patch", "delete"];

// ไล่เก็บไฟล์ทุกไฟล์ในโฟลเดอร์และโฟลเดอร์ย่อย เรียกตัวเองซ้ำลงไป
async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  }))).flat();
}

// แปลงพาธไฟล์เป็น URL ของ OpenAPI โฟลเดอร์ [propertyId] กลายเป็น {propertyId}
function openApiPath(file) {
  return `/${path.relative(new URL("app/", root).pathname, file)
    .replace(/\/route\.ts$/, "")
    .replace(/\[([^\]]+)\]/g, "{$1}")}`;
}

// ตั้งชื่อ operation จาก URL เช่น getAdminPropertiesByPropertyIdInvoices
// ตัวสร้าง client เอาชื่อนี้ไปตั้งชื่อฟังก์ชัน จึงต้องคาดเดาได้และไม่ซ้ำกัน
function operationId(method, apiPath) {
  const words = apiPath
    .replace(/^\/api\/v1\//, "")
    .replace(/\{([^}]+)\}/g, " by $1 ")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
  return method + words.map((word) => word[0].toUpperCase() + word.slice(1)).join("");
}

// จัดกลุ่ม endpoint ตามงาน ไล่จากเฉพาะเจาะจงไปกว้าง อันแรกที่ตรงชนะ
// tag เป็นตัวแบ่งหัวข้อในหน้าเอกสาร คนอ่านจะได้หาของที่ต้องการเจอ
// กลุ่มที่เดาได้จากชื่อ resource ใน URL เรียงตามลำดับที่ตรวจเดิม อันแรกที่ตรงชนะ
const resourceTags = [
  { pattern: /\/(invoices|meter-readings|payment-submissions)(\/|$)/, tag: "Billing" },
  { pattern: /\/(rooms|buildings|floors|catalogs)(\/|$)/, tag: "Rooms" },
  { pattern: /\/(tenants|occupancies|invitations)(\/|$)/, tag: "Tenants" },
  { pattern: /\/leases(\/|$)/, tag: "Contracts" },
  { pattern: /\/(announcements|parcels|tickets)(\/|$)/, tag: "Operations" },
];

// ฝั่งซูเปอร์แอดมินมีทั้งงาน SaaS งานแชต และงานดูแลระบบทั่วไป แยกออกมาให้อ่านง่าย
function superAdminTag(apiPath) {
  if (apiPath.includes("/plans") || apiPath.includes("/subscription")) return "SaaS";
  return apiPath.includes("chat") ? "Chat" : "Super Admin";
}

function tagFor(apiPath) {
  if (apiPath.includes("/subscription-orders") || apiPath.includes("/subscription-payments")) return "SaaS";
  if (apiPath.includes("/super-admin/")) return superAdminTag(apiPath);
  if (apiPath.startsWith("/api/v1/tenant/")) return apiPath.endsWith("/chat") ? "Chat" : "Tenant Portal";
  if (apiPath.includes("/chat/")) return "Chat";
  if (apiPath.includes("/dashboard")) return "Owner Dashboard";
  const matched = resourceTags.find(({ pattern }) => pattern.test(apiPath));
  return matched?.tag ?? "Properties";
}

// รายชื่อ endpoint ที่แบ่งหน้า ต้องเติม page กับ pageSize ให้ในเอกสาร
// เขียนไว้เป็นรายชื่อเพราะเดาจากชื่อ URL ไม่ได้ ต้องดูโค้ดจริงว่าเส้นไหนแบ่งหน้า
const paginatedPaths = new Set([
  "/api/v1/admin/properties/{propertyId}/announcements",
  "/api/v1/admin/properties/{propertyId}/invitations",
  "/api/v1/admin/properties/{propertyId}/invoices",
  "/api/v1/admin/properties/{propertyId}/leases",
  "/api/v1/admin/properties/{propertyId}/meter-readings",
  "/api/v1/admin/properties/{propertyId}/meter-readings/worksheet",
  "/api/v1/admin/properties/{propertyId}/occupancies",
  "/api/v1/admin/properties/{propertyId}/parcels",
  "/api/v1/admin/properties/{propertyId}/payment-submissions",
  "/api/v1/admin/properties/{propertyId}/tenants",
  "/api/v1/admin/properties/{propertyId}/tickets",
  "/api/v1/admin/properties/{propertyId}/tickets/{ticketId}/replies",
  "/api/v1/admin/properties/{propertyId}/tenant-chat",
  "/api/v1/super-admin/support-chat",
  "/api/v1/tenant/announcements",
  "/api/v1/tenant/invoices",
  "/api/v1/tenant/parcels",
  "/api/v1/tenant/tickets",
  "/api/v1/tenant/tickets/{ticketId}/replies",
]);

// ประกอบพารามิเตอร์ของ endpoint หนึ่งเส้น ทั้งที่อยู่ใน path และใน query string
function parametersFor(method, apiPath) {
  // ดึงชื่อในวงเล็บปีกกาออกมาเป็นพารามิเตอร์ของ path ทุกตัวบังคับกรอก
  // propertyId ใช้ ref ที่ประกาศไว้ที่เดียว เพราะโผล่ในเกือบทุกเส้นทาง
  const parameters = [...apiPath.matchAll(/\{([^}]+)\}/g)].map((match) => match[1] === "propertyId"
    ? { $ref: "#/components/parameters/PropertyId" }
    : {
      name: match[1],
      in: "path",
      required: true,
      schema: match[1] === "resource" && apiPath.endsWith("/exports/{resource}")
        ? { type: "string", enum: ["invoices", "tenants"] }
        : { type: "string" },
    });
  if (method === "get" && paginatedPaths.has(apiPath)) {
    parameters.push(
      { $ref: "#/components/parameters/Page" },
      { $ref: "#/components/parameters/PageSize" },
    );
  }
  if (method === "get" && apiPath.endsWith("/meter-readings/worksheet")) {
    parameters.push(
      {
        name: "billingMonth", in: "query", required: true,
        schema: { type: "string", pattern: String.raw`^\d{4}-(0[1-9]|1[0-2])$`, example: "2026-07" },
      },
      {
        name: "type", in: "query", required: true,
        schema: { type: "string", enum: ["WATER", "ELECTRICITY"] },
      },
    );
  }
  if (method === "get" && apiPath === "/api/v1/admin/properties/{propertyId}/search") {
    parameters.push({
      name: "query", in: "query", required: true,
      description: "Search rooms, tenants, invoices, and leases in the selected property.",
      schema: { type: "string", minLength: 2, maxLength: 100, example: "A101" },
    });
  }
  if (method === "get" && apiPath.endsWith("/exports/{resource}")) {
    parameters.push(
      {
        name: "query", in: "query", required: false,
        description: "Search text applied to the exported resource.",
        schema: { type: "string", maxLength: 100 },
      },
      {
        name: "status", in: "query", required: false,
        description: "Invoice status filter. Used only when resource is invoices.",
        schema: { type: "string", enum: ["DRAFT", "PENDING", "PAID", "OVERDUE", "CANCELLED"] },
      },
      {
        name: "billingMonth", in: "query", required: false,
        description: "Invoice billing month filter. Used only when resource is invoices.",
        schema: { type: "string", pattern: String.raw`^\d{4}-(0[1-9]|1[0-2])$`, example: "2026-07" },
      },
    );
  }
  return parameters;
}

// เส้นทางที่รับไฟล์อัปโหลด ต้องบอกในเอกสารว่าไฟล์ใหญ่เกินหรือชนิดผิดจะตอบอะไร
function isMultipart(method, apiPath) {
  return method === "post" && (
    apiPath.endsWith("/attachments") ||
    apiPath.endsWith("/signed-document") ||
    apiPath.endsWith("/payment-submissions") ||
    apiPath.endsWith("/parcels")
  );
}

// เส้นทางที่ตอบกลับเป็นไฟล์ ไม่ใช่ JSON จึงต้องเขียนคำตอบคนละแบบ
function isBinaryGet(method, apiPath) {
  return method === "get" && (
    apiPath.endsWith("/image") ||
    apiPath.endsWith("/slip") ||
    apiPath.endsWith("/signed-document") ||
    apiPath.endsWith("/attachment")
  );
}

// เส้นทางส่งออก CSV ตอบเป็นไฟล์ตาราง ไม่ใช่ JSON เหมือนกัน
function isCsvGet(method, apiPath) {
  return method === "get" && (
    apiPath.endsWith("/exports/{resource}") ||
    /^\/api\/v1\/super-admin\/(audit-logs|plans|properties|users)\/export$/.test(apiPath)
  );
}

// รูปของข้อมูลขาเข้าเก็บแยกไว้ในไฟล์ contract คนละไฟล์ ที่นี่แค่ดึงมาใส่
function requestBodyFor(method, apiPath) {
  if (method === "get") return undefined;
  const contract = requestContract(method, apiPath);
  if (!contract) return undefined;
  return {
    required: true,
    content: {
      [contract.mediaType]: {
        schema: contract.schema,
        example: contract.example,
      },
    },
  };
}

// คำตอบกรณีผิดพลาดหน้าตาเหมือนกันหมด ทำเป็นตัวช่วยอันเดียวแล้วเรียกใช้ซ้ำ
const errorResponse = (description, error, extra = {}) => ({
  description,
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/Error" },
      example: { error },
    },
  },
  ...extra,
});

// ประกอบคำตอบทั้งชุดของ endpoint หนึ่งเส้น ทั้งกรณีสำเร็จและกรณีผิดพลาด
// ดักเส้นทางที่ตอบไม่ใช่ JSON ก่อน แล้วที่เหลือค่อยใช้รูปแบบมาตรฐาน
function responsesFor(method, apiPath) {
  if (isCsvGet(method, apiPath)) {
    return {
      200: {
        description: "UTF-8 CSV file with a BOM for spreadsheet compatibility.",
        content: { "text/csv": { schema: { type: "string", format: "binary" } } },
      },
      400: { $ref: "#/components/responses/BadRequest" },
      401: { $ref: "#/components/responses/Unauthorized" },
      403: { $ref: "#/components/responses/Forbidden" },
      404: { $ref: "#/components/responses/NotFound" },
      413: { $ref: "#/components/responses/PayloadTooLarge" },
      500: { $ref: "#/components/responses/InternalServerError" },
    };
  }
  if (method === "get" && apiPath.endsWith("/stream")) {
    return {
      200: {
        description: "Server-sent event stream",
        content: { "text/event-stream": { schema: { type: "string" } } },
      },
      400: { $ref: "#/components/responses/BadRequest" },
      401: { $ref: "#/components/responses/Unauthorized" },
      403: { $ref: "#/components/responses/Forbidden" },
      404: { $ref: "#/components/responses/NotFound" },
      409: { $ref: "#/components/responses/Conflict" },
      500: { $ref: "#/components/responses/InternalServerError" },
    };
  }
  if (method === "get" && apiPath.endsWith("/promptpay-qr")) {
    return {
      200: {
        description: "PromptPay QR PNG, or JSON metadata when format=json",
        content: {
          "image/png": { schema: { type: "string", format: "binary" } },
          "application/json": jsonSuccessResponse(method, apiPath).content["application/json"],
        },
      },
      400: { $ref: "#/components/responses/BadRequest" },
      401: { $ref: "#/components/responses/Unauthorized" },
      403: { $ref: "#/components/responses/Forbidden" },
      404: { $ref: "#/components/responses/NotFound" },
      409: { $ref: "#/components/responses/Conflict" },
      500: { $ref: "#/components/responses/InternalServerError" },
    };
  }
  const success = method === "post" ? "201" : "200";
  return {
    [success]: isBinaryGet(method, apiPath)
      ? {
        description: "Authorized private file",
        content: { "application/octet-stream": { schema: { type: "string", format: "binary" } } },
      }
      : jsonSuccessResponse(method, apiPath),
    400: { $ref: "#/components/responses/BadRequest" },
    401: { $ref: "#/components/responses/Unauthorized" },
    403: { $ref: "#/components/responses/Forbidden" },
    404: { $ref: "#/components/responses/NotFound" },
    409: { $ref: "#/components/responses/Conflict" },
    ...(isMultipart(method, apiPath) ? {
      413: { $ref: "#/components/responses/PayloadTooLarge" },
      415: { $ref: "#/components/responses/UnsupportedMediaType" },
    } : {}),
    500: { $ref: "#/components/responses/InternalServerError" },
  };
}

// อ่านไฟล์เดิมมาแก้ ไม่ได้สร้างใหม่ทั้งใบ ส่วนที่คนเขียนเพิ่มไว้เองจะได้ไม่หาย
const documentUrl = new URL("../docs/openapi.json", import.meta.url);
const document = JSON.parse(await readFile(documentUrl, "utf8"));
document.components.schemas = { ...document.components.schemas, ...responseSchemas };
// รูปของ error ที่ทุก endpoint ใช้ร่วมกัน ตรงกับที่ apiErrorResponse ส่งออกจริง
document.components.schemas.Error = {
  type: "object",
  required: ["error"],
  properties: {
    error: { type: "string", description: "Safe user-facing error message." },
    requestId: { type: "string", description: "Correlation identifier when available." },
    issues: {
      type: "array",
      description: "Field-level validation failures. Present only for validation errors.",
      items: {
        type: "object",
        required: ["path", "message"],
        properties: { path: { type: "string" }, message: { type: "string" } },
        additionalProperties: false,
      },
    },
  },
  additionalProperties: false,
};
document.components.parameters.Page = {
  name: "page", in: "query", required: false,
  description: "One-based page number.",
  schema: { type: "integer", minimum: 1, default: 1 },
};
document.components.parameters.PageSize = {
  name: "pageSize", in: "query", required: false,
  description: "Number of records per page (maximum 100).",
  schema: { type: "integer", minimum: 1, maximum: 100, default: 50 },
};
document.components.responses = {
  ...document.components.responses,
  BadRequest: errorResponse("The request body, parameters, or business input is invalid.", "ข้อมูลไม่ถูกต้อง", {
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/Error" },
        examples: {
          validation: {
            summary: "Zod validation failed",
            value: { error: "ข้อมูลไม่ถูกต้อง", issues: [{ path: "billingMonth", message: "รูปแบบเดือนไม่ถูกต้อง" }] },
          },
          invalidInput: { summary: "Invalid business input", value: { error: "เลขมิเตอร์ล่าสุดต้องไม่น้อยกว่าเลขครั้งก่อน" } },
        },
      },
    },
  }),
  Unauthorized: errorResponse("Authentication is required or the session has expired.", "กรุณาเข้าสู่ระบบ"),
  Forbidden: errorResponse("The actor is authenticated but lacks the required role, ownership, or active subscription.", "คุณไม่มีสิทธิ์ดำเนินการ"),
  NotFound: errorResponse("The record does not exist or is intentionally hidden by ownership checks.", "ไม่พบข้อมูล"),
  Conflict: errorResponse("The request conflicts with the current resource state or a business rule.", "สถานะข้อมูลไม่อนุญาตให้ดำเนินการ"),
  PayloadTooLarge: errorResponse("The uploaded file exceeds the 5 MB limit.", "ไฟล์ต้องมีขนาดไม่เกิน 5 MB"),
  UnsupportedMediaType: errorResponse("Content-Type or the detected file type is not supported.", "ประเภทไฟล์หรือ Content-Type ไม่รองรับ"),
  TooManyRequests: errorResponse("The request rate limit was exceeded. Retry after the current window.", "ส่งคำขอบ่อยเกินไป กรุณาลองใหม่ภายหลัง"),
  InternalServerError: errorResponse("An unexpected server error occurred. No internal details are exposed.", "ไม่สามารถดำเนินการได้"),
};
const routeRoot = new URL("../app/api/v1/", import.meta.url).pathname;
const routeFiles = (await walk(routeRoot)).filter((file) => file.endsWith("/route.ts")).sort();

for (const file of routeFiles) {
  const source = await readFile(file, "utf8");
  const apiPath = openApiPath(file);
  document.paths[apiPath] ??= {};
  for (const method of methods) {
    const exported = new RegExp(String.raw`export\s+(?:async\s+)?function\s+${method.toUpperCase()}\b`).test(source);
    const current = document.paths[apiPath][method];
    // ข้ามอันที่คนแก้เอง ดูจากคำว่า Implementation: ที่สคริปต์นี้ใส่ไว้เป็นเครื่องหมาย
    // ไม่มีเครื่องหมายแปลว่ามีคนมาเขียนทับ ต้องเคารพของที่เขียนด้วยมือ
    if (!exported || (current && !String(current.description ?? "").startsWith("Implementation:"))) continue;
    const requestBody = requestBodyFor(method, apiPath);
    document.paths[apiPath][method] = {
      operationId: operationId(method, apiPath),
      summary: `${method.toUpperCase()} ${apiPath}`,
      description: `Implementation: ${path.relative(root.pathname, file)}`,
      tags: [tagFor(apiPath)],
      // หน้าสมัครเป็นเส้นเดียวที่เปิดให้ยิงได้โดยไม่ต้องล็อกอิน security ว่างคือไม่ต้องยืนยันตัวตน
      ...(apiPath === "/api/v1/tenant/register" ? { security: [] } : {}),
      ...(parametersFor(method, apiPath).length ? { parameters: parametersFor(method, apiPath) } : {}),
      ...(requestBody ? { requestBody } : {}),
      responses: responsesFor(method, apiPath),
    };
  }
}

document.tags ??= [];
if (!document.tags.some((tag) => tag.name === "Contracts")) document.tags.push({ name: "Contracts" });
// รอบสอง ไล่บังคับให้ทุก endpoint มีคำตอบกรณีผิดพลาดครบทุกรหัส
// รวมถึงอันที่คนเขียนเองด้วย เอกสารจะได้ไม่มีเส้นไหนตกหล่น
for (const [apiPath, pathItem] of Object.entries(document.paths)) {
  if (!apiPath.startsWith("/api/v1/")) continue;
  for (const method of methods) {
    const operation = pathItem[method];
    if (!operation) continue;
    if (method !== "get") {
      const endpointBody = requestBodyFor(method, apiPath);
      if (endpointBody) operation.requestBody = endpointBody;
      else delete operation.requestBody;
    }
    if (!isBinaryGet(method, apiPath) && !isCsvGet(method, apiPath) && !apiPath.endsWith("/stream")) {
      const success = method === "post" ? "201" : "200";
      operation.responses[success] = jsonSuccessResponse(method, apiPath);
    }
    operation.responses["400"] = { $ref: "#/components/responses/BadRequest" };
    operation.responses["401"] = { $ref: "#/components/responses/Unauthorized" };
    operation.responses["403"] = { $ref: "#/components/responses/Forbidden" };
    operation.responses["404"] = { $ref: "#/components/responses/NotFound" };
    operation.responses["409"] = { $ref: "#/components/responses/Conflict" };
    operation.responses["429"] = { $ref: "#/components/responses/TooManyRequests" };
    operation.responses["500"] = { $ref: "#/components/responses/InternalServerError" };
    if (operation.requestBody?.content?.["multipart/form-data"]) {
      operation.responses["413"] = { $ref: "#/components/responses/PayloadTooLarge" };
      operation.responses["415"] = { $ref: "#/components/responses/UnsupportedMediaType" };
    }
  }
}
for (const obsolete of ["DataObject", "DataList", "DataValue", "MessageList"]) delete document.components.responses[obsolete];
// เรียงตามตัวอักษรก่อนเขียน diff ของ git จะได้อ่านง่าย ไม่สลับที่ไปมาทุกครั้งที่รัน
document.paths = Object.fromEntries(Object.entries(document.paths).sort(([left], [right]) => left.localeCompare(right)));
await writeFile(documentUrl, `${JSON.stringify(document, null, 2)}\n`);
