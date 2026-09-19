import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

// ด่านตรวจใน CI ว่า docs/openapi.json ยังตรงกับ route จริงในโค้ด
// ผิดเมื่อไหร่โยน error ทันที จะได้ไม่ปล่อยเอกสารที่ไม่ตรงกับของจริงออกไป
const document = JSON.parse(await readFile(new URL("../docs/openapi.json", import.meta.url), "utf8"));
if (!String(document.openapi).startsWith("3.1.")) throw new Error("OpenAPI 3.1 is required");
if (!document.info?.title || !document.info?.version) throw new Error("OpenAPI info is incomplete");

// คลาย $ref ให้เป็น schema จริง เอกสารใช้ ref เยอะเพื่อไม่ต้องเขียนซ้ำ
function resolveRef(schema) {
  if (!schema?.$ref) return schema;
  const prefix = "#/components/schemas/";
  if (!schema.$ref.startsWith(prefix)) return schema;
  const name = schema.$ref.slice(prefix.length);
  const resolved = document.components?.schemas?.[name];
  if (!resolved) throw new Error(`Unresolved schema reference: ${schema.$ref}`);
  return resolved;
}

// ตรวจว่าตัวอย่างที่เขียนไว้ตรงกับ schema ของตัวเองจริงไหม
// ตัวอย่างที่ผิดแย่กว่าไม่มีตัวอย่าง เพราะคนจะลอกไปใช้แล้วยิงไม่ผ่าน
// ส่ง location ต่อลงไปทุกชั้น พังตรงไหนจะได้ชี้จุดได้เป๊ะ
function validateExample(schema, value, location, seen = new Set()) {
  if (!schema) return [];
  if (schema.$ref) {
    // จำ ref ที่เคยเข้าไปแล้ว กัน schema ที่อ้างถึงตัวเองจนวนไม่รู้จบ
    const marker = `${schema.$ref}:${location}`;
    if (seen.has(marker)) return [];
    return validateExample(resolveRef(schema), value, location, new Set([...seen, marker]));
  }
  if (schema.anyOf) {
    // anyOf ผ่านแค่แบบเดียวก็พอ
    const alternatives = schema.anyOf.map((candidate) => validateExample(candidate, value, location, seen));
    return alternatives.some((errors) => errors.length === 0)
      ? []
      : [`${location} does not match anyOf`];
  }
  if (schema.oneOf) {
    const alternatives = schema.oneOf.map((candidate) => validateExample(candidate, value, location, seen));
    // oneOf ต้องตรงแบบเดียวเป๊ะ ๆ ตรงหลายแบบก็ผิด เพราะแปลว่า schema เขียนกำกวม
    const matching = alternatives.filter((errors) => errors.length === 0);
    return matching.length === 1 ? [] : [`${location} must match exactly one oneOf schema`];
  }
  if (schema.enum && !schema.enum.includes(value)) return [`${location} is not in the documented enum`];
  if (schema.type === "null") return value === null ? [] : [`${location} must be null`];
  if (schema.type === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [`${location} must be an object`];
    const errors = [];
    for (const required of schema.required ?? []) {
      if (!Object.hasOwn(value, required)) errors.push(`${location}.${required} is required`);
    }
    for (const [key, child] of Object.entries(value)) {
      if (schema.properties?.[key]) {
        errors.push(...validateExample(schema.properties[key], child, `${location}.${key}`, seen));
      } else if (schema.additionalProperties === false) {
        errors.push(`${location}.${key} is not documented`);
      } else if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
        errors.push(...validateExample(schema.additionalProperties, child, `${location}.${key}`, seen));
      }
    }
    return errors;
  }
  if (schema.type === "array") {
    if (!Array.isArray(value)) return [`${location} must be an array`];
    return value.flatMap((item, index) => validateExample(schema.items, item, `${location}[${index}]`, seen));
  }
  if (schema.type === "string" && typeof value !== "string") return [`${location} must be a string`];
  if (schema.type === "integer" && !Number.isInteger(value)) return [`${location} must be an integer`];
  if (schema.type === "number" && typeof value !== "number") return [`${location} must be a number`];
  if (schema.type === "boolean" && typeof value !== "boolean") return [`${location} must be a boolean`];
  return [];
}

// ไล่หา additionalProperties: true ซึ่งแปลว่ารับฟิลด์อะไรก็ได้
// สัญญาที่หลวมแบบนั้นทำให้เอกสารไม่มีความหมาย และเปิดช่องให้ฟิลด์แปลกปลอมหลุดเข้ามา
function findBroadSchemas(value, location, errors) {
  if (!value || typeof value !== "object") return;
  if (value.additionalProperties === true) errors.push(`${location} uses additionalProperties: true`);
  for (const [key, child] of Object.entries(value)) {
    findBroadSchemas(child, `${location}.${key}`, errors);
  }
}

const schemaErrors = [];
findBroadSchemas(document.components?.schemas, "components.schemas", schemaErrors);

// เส้นทางที่สำคัญที่สุด ต้องมีในเอกสารเสมอ หายไปแปลว่ามีคนลบพลาด
const requiredPaths = [
  "/api/health",
  "/api/auth/login",
  "/api/v1/admin/properties/{propertyId}/dashboard/summary",
  "/api/v1/tenant/invoices",
  "/api/v1/super-admin/dashboard",
  "/api/v1/super-admin/plans",
  "/api/v1/super-admin/properties/{propertyId}/subscription",
  "/api/v1/admin/properties/{propertyId}/subscription-orders",
  "/api/v1/super-admin/subscription-payments"
];
for (const path of requiredPaths) {
  if (!document.paths?.[path]) throw new Error(`Missing required OpenAPI path: ${path}`);
}

const operationIds = new Set();
// schema กว้าง ๆ ชุดเก่าที่เลิกใช้แล้ว เจอที่ไหนคือมีคนเผลอเอากลับมาใช้
const forbiddenResponseSchemas = new Set(["DataObject", "DataList", "DataValue", "MessageList"]);
for (const [path, pathItem] of Object.entries(document.paths)) {
  for (const method of ["get", "post", "put", "patch", "delete"]) {
    const operation = pathItem[method];
    if (!operation) continue;
    if (!operation.operationId) throw new Error(`${method.toUpperCase()} ${path} has no operationId`);
    // operationId ต้องไม่ซ้ำ เพราะตัวสร้าง client ใช้ชื่อนี้ตั้งชื่อฟังก์ชัน
    if (operationIds.has(operation.operationId)) throw new Error(`Duplicate operationId: ${operation.operationId}`);
    operationIds.add(operation.operationId);
    if (path.startsWith("/api/v1/")) {
      const success = operation.responses?.[method === "post" ? "201" : "200"];
      const jsonSchema = success?.content?.["application/json"]?.schema;
      const jsonExample = success?.content?.["application/json"]?.example ?? success?.content?.["application/json"]?.examples;
      if (jsonSchema) {
        findBroadSchemas(jsonSchema, `${method.toUpperCase()} ${path} success schema`, schemaErrors);
        const serialized = JSON.stringify(jsonSchema);
        for (const name of forbiddenResponseSchemas) {
          if (serialized.includes(`#/components/responses/${name}`) || serialized.includes(`#/components/schemas/${name}`)) {
            throw new Error(`${method.toUpperCase()} ${path} uses broad response schema ${name}`);
          }
        }
        if (jsonSchema.type === "object" && !jsonSchema.$ref && !jsonSchema.properties) {
          throw new Error(`${method.toUpperCase()} ${path} has an untyped JSON success response`);
        }
        // ทุก endpoint ต้องมีตัวอย่างคำตอบ คนอ่านเอกสารจะได้เห็นหน้าตาข้อมูลจริง
        if (!jsonExample) throw new Error(`${method.toUpperCase()} ${path} has no JSON success example`);
        const examples = success.content["application/json"].examples;
        const values = examples
          ? Object.values(examples).map((entry) => entry?.value).filter((value) => value !== undefined)
          : [jsonExample];
        for (const [index, example] of values.entries()) {
          schemaErrors.push(...validateExample(
            jsonSchema,
            example,
            `${method.toUpperCase()} ${path} response example${values.length > 1 ? ` ${index + 1}` : ""}`,
          ));
        }
      }
      if (operation.requestBody) {
        const body = operation.requestBody.content;
        const media = body?.["application/json"] ?? body?.["multipart/form-data"];
        if (!media?.example && !media?.examples) throw new Error(`${method.toUpperCase()} ${path} has no request example`);
        if (!media?.schema) throw new Error(`${method.toUpperCase()} ${path} has no request schema`);
        findBroadSchemas(media.schema, `${method.toUpperCase()} ${path} request schema`, schemaErrors);
        const values = media.examples
          ? Object.values(media.examples).map((entry) => entry?.value).filter((value) => value !== undefined)
          : [media.example];
        for (const [index, example] of values.entries()) {
          schemaErrors.push(...validateExample(
            media.schema,
            example,
            `${method.toUpperCase()} ${path} request example${values.length > 1 ? ` ${index + 1}` : ""}`,
          ));
        }
      }
      // บังคับให้เขียนกรณีผิดพลาดไว้ครบทุกรหัส คนเรียก API จะได้เตรียมรับมือถูก
      for (const status of ["400", "401", "403", "404", "409", "429", "500"]) {
        if (!operation.responses?.[status]) throw new Error(`${method.toUpperCase()} ${path} does not document HTTP ${status}`);
      }
      // endpoint ที่รับไฟล์ต้องบอกด้วยว่าไฟล์ใหญ่เกินหรือชนิดผิดจะตอบอะไร
      const multipart = operation.requestBody?.content?.["multipart/form-data"];
      if (multipart && (!operation.responses?.["413"] || !operation.responses?.["415"])) {
        throw new Error(`${method.toUpperCase()} ${path} does not document upload HTTP 413/415`);
      }
    }
  }
}

if (schemaErrors.length) {
  throw new Error(`OpenAPI response contract errors:\n- ${schemaErrors.join("\n- ")}`);
}

for (const name of forbiddenResponseSchemas) {
  if (document.components?.responses?.[name] || document.components?.schemas?.[name]) {
    throw new Error(`Obsolete broad schema remains in components: ${name}`);
  }
}

// ไล่เก็บไฟล์ทุกไฟล์ในโฟลเดอร์และโฟลเดอร์ย่อย เรียกตัวเองซ้ำลงไป
async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  }))).flat();
}

const methodNames = ["get", "post", "put", "patch", "delete"];
const appRoot = new URL("../app/", import.meta.url).pathname;
const routeRoot = new URL("../app/api/v1/", import.meta.url).pathname;
const routeFiles = (await walk(routeRoot)).filter((file) => file.endsWith("/route.ts"));
// เก็บสิ่งที่โค้ดจริงมีอยู่ ไว้เทียบสองทางกับเอกสารในสองลูปข้างล่าง
const routeOperations = new Set();
for (const file of routeFiles) {
  const source = await readFile(file, "utf8");
  const apiPath = `/${path.relative(appRoot, file).replace(/\/route\.ts$/, "").replace(/\[([^\]]+)\]/g, "{$1}")}`;
  for (const method of methodNames) {
    if (new RegExp(`export\\s+(?:async\\s+)?function\\s+${method.toUpperCase()}\\b`).test(source)) {
      routeOperations.add(`${method.toUpperCase()} ${apiPath}`);
    }
  }
}

// ทางที่หนึ่ง มีใน route แต่ไม่มีในเอกสาร แปลว่าเขียน API ใหม่แล้วลืมอัปเดตเอกสาร
for (const operation of routeOperations) {
  const separator = operation.indexOf(" ");
  const method = operation.slice(0, separator).toLowerCase();
  const apiPath = operation.slice(separator + 1);
  if (!document.paths?.[apiPath]?.[method]) throw new Error(`Missing OpenAPI operation: ${operation}`);
}

// ทางที่สอง มีในเอกสารแต่ไม่มีใน route แปลว่าลบ API ไปแล้วแต่เอกสารยังค้าง
for (const [apiPath, pathItem] of Object.entries(document.paths)) {
  if (!apiPath.startsWith("/api/v1/")) continue;
  for (const method of methodNames) {
    if (pathItem[method] && !routeOperations.has(`${method.toUpperCase()} ${apiPath}`)) {
      throw new Error(`OpenAPI operation has no route implementation: ${method.toUpperCase()} ${apiPath}`);
    }
  }
}
console.log(`OpenAPI valid: ${operationIds.size} operations; /api/v1 coverage ${routeOperations.size}/${routeOperations.size}`);
