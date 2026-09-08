/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นคำสั่งสำหรับนักพัฒนา/ระบบอัตโนมัติในงาน “sync openapi v1”
 * การทำงาน: เรียกใช้จาก terminal หรือ package script เพื่อทำงานบำรุงรักษาที่ทำซ้ำได้; ควรทดลองในสภาพแวดล้อมที่ไม่ใช่ production ก่อนเมื่อมีการเขียนข้อมูล
 */

import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { jsonSuccessResponse, responseSchemas } from "./openapi-response-contracts.mjs";
import { requestContract } from "./openapi-request-contracts.mjs";

const root = new URL("../", import.meta.url);
const methods = ["get", "post", "put", "patch", "delete"];

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “walk” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - directory: ค่า “directory” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  }))).flat();
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “open Api Path” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - file: ค่า “file” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function openApiPath(file) {
  return `/${path.relative(new URL("app/", root).pathname, file)
    .replace(/\/route\.ts$/, "")
    .replace(/\[([^\]]+)\]/g, "{$1}")}`;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “operation Id” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - method: ค่า “method” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - apiPath: ค่า “api Path” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function operationId(method, apiPath) {
  const words = apiPath
    .replace(/^\/api\/v1\//, "")
    .replace(/\{([^}]+)\}/g, " by $1 ")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
  return method + words.map((word) => word[0].toUpperCase() + word.slice(1)).join("");
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “tag For” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - apiPath: ค่า “api Path” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function tagFor(apiPath) {
  if (apiPath.includes("/subscription-orders") || apiPath.includes("/subscription-payments")) return "SaaS";
  if (apiPath.includes("/super-admin/")) return apiPath.includes("/plans") || apiPath.includes("/subscription") ? "SaaS" : apiPath.includes("chat") ? "Chat" : "Super Admin";
  if (apiPath.startsWith("/api/v1/tenant/")) return apiPath.endsWith("/chat") ? "Chat" : "Tenant Portal";
  if (apiPath.includes("/chat/")) return "Chat";
  if (apiPath.includes("/dashboard")) return "Owner Dashboard";
  if (/\/(invoices|meter-readings|payment-submissions)(\/|$)/.test(apiPath)) return "Billing";
  if (/\/(rooms|buildings|floors|catalogs)(\/|$)/.test(apiPath)) return "Rooms";
  if (/\/(tenants|occupancies|invitations)(\/|$)/.test(apiPath)) return "Tenants";
  if (/\/leases(\/|$)/.test(apiPath)) return "Contracts";
  if (/\/(announcements|parcels|tickets)(\/|$)/.test(apiPath)) return "Operations";
  return "Properties";
}

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

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “parameters For” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - method: ค่า “method” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - apiPath: ค่า “api Path” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function parametersFor(method, apiPath) {
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “parameters” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - match: ค่า “match” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
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
        schema: { type: "string", pattern: "^\\d{4}-(0[1-9]|1[0-2])$", example: "2026-07" },
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
        schema: { type: "string", pattern: "^\\d{4}-(0[1-9]|1[0-2])$", example: "2026-07" },
      },
    );
  }
  return parameters;
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตอบว่าเงื่อนไข “is Multipart” เป็นจริงหรือไม่ เพื่อใช้ตัดสินใจในขั้นตอนถัดไป
 * รับค่า:
 * - method: ค่า “method” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - apiPath: ค่า “api Path” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function isMultipart(method, apiPath) {
  return method === "post" && (
    apiPath.endsWith("/attachments") ||
    apiPath.endsWith("/signed-document") ||
    apiPath.endsWith("/payment-submissions") ||
    apiPath.endsWith("/parcels")
  );
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตอบว่าเงื่อนไข “is Binary Get” เป็นจริงหรือไม่ เพื่อใช้ตัดสินใจในขั้นตอนถัดไป
 * รับค่า:
 * - method: ค่า “method” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - apiPath: ค่า “api Path” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function isBinaryGet(method, apiPath) {
  return method === "get" && (
    apiPath.endsWith("/image") ||
    apiPath.endsWith("/slip") ||
    apiPath.endsWith("/signed-document") ||
    apiPath.endsWith("/attachment")
  );
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: ตอบว่าเงื่อนไข “is Csv Get” เป็นจริงหรือไม่ เพื่อใช้ตัดสินใจในขั้นตอนถัดไป
 * รับค่า:
 * - method: ค่า “method” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - apiPath: ค่า “api Path” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function isCsvGet(method, apiPath) {
  return method === "get" && (
    apiPath.endsWith("/exports/{resource}") ||
    /^\/api\/v1\/super-admin\/(audit-logs|plans|properties|users)\/export$/.test(apiPath)
  );
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “request Body For” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - method: ค่า “method” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - apiPath: ค่า “api Path” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
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

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “error Response” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - description: ค่า “description” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - error: ข้อผิดพลาดที่ต้องแปลง บันทึก หรือแสดงอย่างปลอดภัย
 * - extra: ค่า “extra” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
 */
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

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: รวมขั้นตอนย่อยของ “responses For” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
 * รับค่า:
 * - method: ค่า “method” ที่จำเป็นต่อการทำงานของก้อนนี้
 * - apiPath: ค่า “api Path” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
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

const documentUrl = new URL("../docs/openapi.json", import.meta.url);
const document = JSON.parse(await readFile(documentUrl, "utf8"));
document.components.schemas = { ...document.components.schemas, ...responseSchemas };
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
    const exported = new RegExp(`export\\s+(?:async\\s+)?function\\s+${method.toUpperCase()}\\b`).test(source);
    const current = document.paths[apiPath][method];
    if (!exported || (current && !String(current.description ?? "").startsWith("Implementation:"))) continue;
    const requestBody = requestBodyFor(method, apiPath);
    document.paths[apiPath][method] = {
      operationId: operationId(method, apiPath),
      summary: `${method.toUpperCase()} ${apiPath}`,
      description: `Implementation: ${path.relative(root.pathname, file)}`,
      tags: [tagFor(apiPath)],
      ...(apiPath === "/api/v1/tenant/register" ? { security: [] } : {}),
      ...(parametersFor(method, apiPath).length ? { parameters: parametersFor(method, apiPath) } : {}),
      ...(requestBody ? { requestBody } : {}),
      responses: responsesFor(method, apiPath),
    };
  }
}

document.tags ??= [];
if (!document.tags.some((tag) => tag.name === "Contracts")) document.tags.push({ name: "Contracts" });
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
document.paths = Object.fromEntries(Object.entries(document.paths).sort(([left], [right]) => left.localeCompare(right)));
await writeFile(documentUrl, `${JSON.stringify(document, null, 2)}\n`);
