import "dotenv/config";
import { randomBytes, scrypt as nodeScrypt } from "node:crypto";
import { promisify } from "node:util";
import pg from "pg";

// เติมข้อมูลตัวอย่างให้หอสาธิต เปิดเข้ามาแล้วเห็นระบบทำงานจริง ไม่ใช่หน้าว่าง
// ใช้ pg ตรงแทน Prisma เพราะต้องรันได้บนเครื่องปลายทางที่ไม่ได้ build โค้ดไว้
// รันซ้ำได้เสมอ ทุกคำสั่งเป็น upsert และผูกกับ id คงที่ จึงไม่สร้างของซ้ำ
const { Pool } = pg;
const scrypt = promisify(nodeScrypt);

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

// รหัสผ่านของผู้เช่าตัวอย่าง อ่านจาก env เพื่อไม่ให้มีรหัสจริงอยู่ในไฟล์ที่ commit
const tenantPassword = process.env.DEMO_TENANT_PASSWORD;
if (!tenantPassword || tenantPassword.length < 12) {
  throw new Error("DEMO_TENANT_PASSWORD must contain at least 12 characters");
}

// id คงที่ทั้งหมด รันซ้ำจึงทับของเดิมแทนที่จะเพิ่มชุดใหม่
const propertyId = "demo-property";
const planId = "demo-plan";
const buildingId = "demo-building";
const floorIds = ["demo-floor-1", "demo-floor-2"];

// แฮชต้องตรงรูปแบบกับ lib/server/password.ts เป๊ะ ไม่งั้นระบบตรวจรหัสไม่ผ่าน
async function createPasswordHash(value) {
  const salt = randomBytes(16);
  const key = await scrypt(value, salt, 64);
  return `scrypt-v1$${salt.toString("base64")}$${key.toString("base64")}`;
}

// วันแรกของเดือนที่ห่างจากเดือนนี้ตามจำนวนที่ระบุ ใช้ตั้งรอบบิลย้อนหลัง
function monthStart(offset = 0) {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
}

function daysFromNow(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

const pool = new Pool({ connectionString: databaseUrl });
const run = (text, values) => pool.query(text, values);

try {
  // หอต้องมีอยู่ก่อน สคริปต์ admin:bootstrap เป็นคนสร้าง
  const property = await run(`SELECT "id" FROM "Property" WHERE "id" = $1`, [propertyId]);
  if (!property.rowCount) {
    throw new Error(`ยังไม่มีหอสาธิต ให้รัน npm run admin:bootstrap ก่อน`);
  }
  const owner = await run(
    `SELECT "userId" FROM "PropertyMembership" WHERE "propertyId" = $1 LIMIT 1`,
    [propertyId],
  );
  if (!owner.rowCount) throw new Error("หอสาธิตยังไม่มีเจ้าของหอ ให้ตั้ง DEMO_PROPERTY_ADMIN_* แล้วรัน admin:bootstrap");
  const ownerId = owner.rows[0].userId;

  await run("BEGIN");

  // แพ็กเกจและอายุสมาชิก ถ้าไม่มีอันนี้พื้นที่เจ้าของหอจะกลายเป็นโหมดอ่านอย่างเดียว
  await run(
    `INSERT INTO "SaasPlan" ("id","code","name","monthlyPrice","maxRooms","isActive","allowPromptPay","allowFileUploads","createdAt","updatedAt")
     VALUES ($1,'DEMO','แพ็กเกจสาธิต',1500,50,true,true,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
     ON CONFLICT ("id") DO UPDATE SET "isActive" = true, "updatedAt" = CURRENT_TIMESTAMP`,
    [planId],
  );
  await run(
    `INSERT INTO "PropertySubscription" ("propertyId","planId","planName","maxRooms","status","startsAt","expiresAt","createdAt","updatedAt")
     VALUES ($1,$2,'แพ็กเกจสาธิต',50,'ACTIVE',$3,$4,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
     ON CONFLICT ("propertyId") DO UPDATE SET
       "status" = 'ACTIVE', "expiresAt" = EXCLUDED."expiresAt", "updatedAt" = CURRENT_TIMESTAMP`,
    [propertyId, planId, daysFromNow(-30), daysFromNow(365)],
  );

  await run(
    `INSERT INTO "PropertySettings" ("propertyId","address","contactPhone","contactEmail","houseRules","updatedAt")
     VALUES ($1,'99/1 ถนนงามวงศ์วาน แขวงลาดยาว เขตจตุจักร กรุงเทพฯ 10900','021234567','contact@nestly.demo',
             'ปิดประตูหอเวลา 23.00 น. · ห้ามเลี้ยงสัตว์ · แยกขยะก่อนทิ้ง',CURRENT_TIMESTAMP)
     ON CONFLICT ("propertyId") DO UPDATE SET "updatedAt" = CURRENT_TIMESTAMP`,
    [propertyId],
  );

  // ตัวเลือกที่เจ้าของหอตั้งไว้ใช้ซ้ำ ทำให้หน้าตั้งค่ามีข้อมูลให้ดู
  for (const [index, [name, rent]] of [["ห้องแอร์", 4500], ["ห้องพัดลม", 3200]].entries()) {
    await run(
      `INSERT INTO "RoomTypeConfig" ("id","propertyId","name","monthlyRent","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
       ON CONFLICT ("id") DO UPDATE SET "monthlyRent" = EXCLUDED."monthlyRent", "updatedAt" = CURRENT_TIMESTAMP`,
      [`demo-roomtype-${index}`, propertyId, name, rent],
    );
  }
  for (const [index, name] of ["เตียง", "ตู้เสื้อผ้า", "โต๊ะทำงาน", "เครื่องปรับอากาศ"].entries()) {
    await run(
      `INSERT INTO "FurnitureOption" ("id","propertyId","name","createdAt","updatedAt")
       VALUES ($1,$2,$3,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
       ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name", "updatedAt" = CURRENT_TIMESTAMP`,
      [`demo-furniture-${index}`, propertyId, name],
    );
  }

  await run(
    `INSERT INTO "Building" ("id","propertyId","name","code","isActive","createdAt","updatedAt")
     VALUES ($1,$2,'อาคาร A','A',true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
     ON CONFLICT ("id") DO UPDATE SET "isActive" = true, "updatedAt" = CURRENT_TIMESTAMP`,
    [buildingId, propertyId],
  );
  for (const [index, floorId] of floorIds.entries()) {
    await run(
      `INSERT INTO "Floor" ("id","propertyId","buildingId","number","label","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
       ON CONFLICT ("id") DO UPDATE SET "label" = EXCLUDED."label", "updatedAt" = CURRENT_TIMESTAMP`,
      [floorId, propertyId, buildingId, index + 1, `ชั้น ${index + 1}`],
    );
  }

  // สิบห้อง สองชั้น สถานะคละกันให้ผังห้องดูมีชีวิต
  const rooms = [];
  for (const [floorIndex, floorId] of floorIds.entries()) {
    for (let slot = 1; slot <= 5; slot += 1) {
      const number = `${floorIndex + 1}0${slot}`;
      const isAir = slot <= 3;
      rooms.push({ id: `demo-room-${number}`, number, floorId, rent: isAir ? 4500 : 3200 });
      await run(
        `INSERT INTO "Room" ("id","propertyId","buildingId","floorId","number","roomType","monthlyRent","depositAmount","capacity","status","createdAt","updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,2,$9,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
         ON CONFLICT ("id") DO UPDATE SET
           "monthlyRent" = EXCLUDED."monthlyRent", "status" = EXCLUDED."status", "updatedAt" = CURRENT_TIMESTAMP`,
        [
          `demo-room-${number}`, propertyId, buildingId, floorId, number,
          isAir ? "ห้องแอร์" : "ห้องพัดลม", isAir ? 4500 : 3200, (isAir ? 4500 : 3200) * 2,
          slot === 5 ? "MAINTENANCE" : "AVAILABLE",
        ],
      );
      // ผูกเฟอร์นิเจอร์ให้ห้องแอร์ หน้ารายละเอียดห้องจะได้มีข้อมูลให้ดู
      if (isAir) {
        await run(
          `INSERT INTO "RoomFurniture" ("roomId","furnitureOptionId","quantity","createdAt")
           VALUES ($1,$2,1,CURRENT_TIMESTAMP) ON CONFLICT ("roomId","furnitureOptionId") DO NOTHING`,
          [`demo-room-${number}`, "demo-furniture-3"],
        );
      }
    }
  }

  // ผู้เช่าสามคน สองคนอยู่ห้องเดียวกันเพื่อให้เห็นกรณีผู้พักร่วม
  const tenantPasswordHash = await createPasswordHash(tenantPassword);
  const tenants = [
    { key: "somchai", name: "สมชาย ใจดี", phone: "0891234567", room: "101", role: "PRIMARY", vehicle: ["CAR", "1กก 1234"] },
    { key: "suda", name: "สุดา สุขใจ", phone: "0812345678", room: "101", role: "CO_OCCUPANT", vehicle: null },
    { key: "wichai", name: "วิชัย ตั้งใจ", phone: "0956781234", room: "202", role: "PRIMARY", vehicle: ["MOTORCYCLE", "2ขข 5678"] },
  ];
  const tenantIds = {};
  for (const tenant of tenants) {
    const userId = `demo-user-${tenant.key}`;
    const profileId = `demo-profile-${tenant.key}`;
    await run(
      `INSERT INTO "User" ("id","email","passwordHash","displayName","role","isActive","approvalStatus","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,'TENANT',true,'APPROVED',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
       ON CONFLICT ("email") DO UPDATE SET
         "passwordHash" = EXCLUDED."passwordHash", "displayName" = EXCLUDED."displayName",
         "isActive" = true, "approvalStatus" = 'APPROVED', "updatedAt" = CURRENT_TIMESTAMP`,
      [userId, `${tenant.key}@nestly.demo`, tenantPasswordHash, tenant.name],
    );
    const resolved = await run(`SELECT "id" FROM "User" WHERE "email" = $1`, [`${tenant.key}@nestly.demo`]);
    const resolvedUserId = resolved.rows[0].id;
    await run(
      `INSERT INTO "TenantProfile" ("id","userId","phone","address","emergencyName","emergencyPhone","createdAt","updatedAt")
       VALUES ($1,$2,$3,'123 หมู่ 4 ต.คลองหนึ่ง อ.คลองหลวง จ.ปทุมธานี','ผู้ปกครอง','0891110000',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
       ON CONFLICT ("userId") DO UPDATE SET "phone" = EXCLUDED."phone", "updatedAt" = CURRENT_TIMESTAMP
       RETURNING "id"`,
      [profileId, resolvedUserId, tenant.phone],
    );
    const profile = await run(`SELECT "id" FROM "TenantProfile" WHERE "userId" = $1`, [resolvedUserId]);
    tenantIds[tenant.key] = profile.rows[0].id;

    if (tenant.vehicle) {
      await run(
        `INSERT INTO "TenantVehicle" ("id","tenantProfileId","type","licensePlate","province","createdAt","updatedAt")
         VALUES ($1,$2,$3,$4,'กรุงเทพมหานคร',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
         ON CONFLICT ("tenantProfileId") DO UPDATE SET "licensePlate" = EXCLUDED."licensePlate", "updatedAt" = CURRENT_TIMESTAMP`,
        [`demo-vehicle-${tenant.key}`, tenantIds[tenant.key], tenant.vehicle[0], tenant.vehicle[1]],
      );
    }
    await run(
      `INSERT INTO "RoomOccupancy" ("id","propertyId","roomId","tenantProfileId","role","status","startedAt","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,'ACTIVE',$6,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
       ON CONFLICT ("id") DO UPDATE SET "status" = 'ACTIVE', "updatedAt" = CURRENT_TIMESTAMP`,
      [`demo-occ-${tenant.key}`, propertyId, `demo-room-${tenant.room}`, tenantIds[tenant.key], tenant.role, daysFromNow(-120)],
    );
    await run(
      `UPDATE "Room" SET "status" = 'OCCUPIED', "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = $1`,
      [`demo-room-${tenant.room}`],
    );
  }

  // สัญญาของผู้เช่าหลักแต่ละห้อง
  for (const tenant of tenants.filter((item) => item.role === "PRIMARY")) {
    await run(
      `INSERT INTO "Lease" ("id","propertyId","roomId","leaseNumber","startDate","endDate","monthlyRent","depositAmount","status","currentVersion","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'ACTIVE',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
       ON CONFLICT ("id") DO UPDATE SET "status" = 'ACTIVE', "updatedAt" = CURRENT_TIMESTAMP`,
      [
        `demo-lease-${tenant.key}`, propertyId, `demo-room-${tenant.room}`,
        `CTR-DEMO-${tenant.room}`, daysFromNow(-120), daysFromNow(245), tenant.room === "101" ? 4500 : 3200,
        (tenant.room === "101" ? 4500 : 3200) * 2,
      ],
    );
    // ผูกสัญญากับการเข้าพัก ไม่ใช่กับตัวผู้เช่าตรง ๆ เพราะคนเดียวย้ายห้องได้
    await run(
      `INSERT INTO "LeaseTenant" ("leaseId","occupancyId","isPrimary","createdAt")
       VALUES ($1,$2,true,CURRENT_TIMESTAMP) ON CONFLICT ("leaseId","occupancyId") DO NOTHING`,
      [`demo-lease-${tenant.key}`, `demo-occ-${tenant.key}`],
    );
  }

  // มิเตอร์และบิลย้อนหลังสามเดือน เดือนล่าสุดยังไม่จ่ายเพื่อให้เห็นยอดค้าง
  const meterBase = { WATER: 120, ELECTRICITY: 850 };
  for (const [monthOffset, status] of [[-2, "PAID"], [-1, "PAID"], [0, "PENDING"]]) {
    const billingMonth = monthStart(monthOffset);
    for (const tenant of tenants.filter((item) => item.role === "PRIMARY")) {
      const roomId = `demo-room-${tenant.room}`;
      const rent = tenant.room === "101" ? 4500 : 3200;
      const step = 3 + monthOffset;
      let water = 0;
      let electricity = 0;
      for (const [type, base] of Object.entries(meterBase)) {
        const previous = base + step * (type === "WATER" ? 8 : 60);
        const current = previous + (type === "WATER" ? 9 : 72);
        const rate = type === "WATER" ? 18 : 7;
        const amount = (current - previous) * rate;
        if (type === "WATER") water = amount; else electricity = amount;
        await run(
          `INSERT INTO "MeterReading" ("id","propertyId","roomId","type","billingMonth","previousReading","currentReading","unitRate","recordedById","createdAt","updatedAt")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
           ON CONFLICT ("id") DO UPDATE SET "currentReading" = EXCLUDED."currentReading", "updatedAt" = CURRENT_TIMESTAMP`,
          [`demo-meter-${tenant.room}-${monthOffset}-${type}`, propertyId, roomId, type, billingMonth, previous, current, rate, ownerId],
        );
      }
      const invoiceId = `demo-invoice-${tenant.room}-${monthOffset}`;
      const total = rent + water + electricity + 200;
      await run(
        `INSERT INTO "Invoice" ("id","propertyId","roomId","invoiceNumber","billingMonth","dueDate","status","total","version","createdAt","updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
         ON CONFLICT ("id") DO UPDATE SET "status" = EXCLUDED."status", "total" = EXCLUDED."total", "updatedAt" = CURRENT_TIMESTAMP`,
        [
          invoiceId, propertyId, roomId, `INV-DEMO-${tenant.room}-${3 + monthOffset}`,
          billingMonth, new Date(billingMonth.getTime() + 4 * 24 * 60 * 60 * 1000), status, total,
        ],
      );
      const items = [
        ["RENT", "ค่าเช่าห้อง", rent],
        ["WATER", "ค่าน้ำ", water],
        ["ELECTRICITY", "ค่าไฟ", electricity],
        ["SERVICE", "ค่าส่วนกลาง", 200],
      ];
      for (const [type, description, amount] of items) {
        await run(
          `INSERT INTO "InvoiceItem" ("id","invoiceId","type","description","quantity","unitPrice","amount")
           VALUES ($1,$2,$3,$4,1,$5,$5)
           ON CONFLICT ("id") DO UPDATE SET "amount" = EXCLUDED."amount", "unitPrice" = EXCLUDED."unitPrice"`,
          [`${invoiceId}-${type}`, invoiceId, type, description, amount],
        );
      }
    }
  }

  // พัสดุ เรื่องแจ้งซ่อม และประกาศ ให้ทุกเมนูมีข้อมูลให้กด
  await run(
    `INSERT INTO "Parcel" ("id","propertyId","roomId","recipientTenantId","note","status","registeredById","registeredAt","createdAt","updatedAt")
     VALUES ($1,$2,$3,$4,'พัสดุไปรษณีย์ไทย เลขติดตาม TH12345678','WAITING',$5,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
     ON CONFLICT ("id") DO UPDATE SET "status" = 'WAITING', "updatedAt" = CURRENT_TIMESTAMP`,
    ["demo-parcel-1", propertyId, "demo-room-101", tenantIds.somchai, ownerId],
  );
  await run(
    `INSERT INTO "ServiceTicket" ("id","propertyId","roomId","tenantProfileId","type","status","priority","title","detail","createdByUserId","createdAt","updatedAt")
     VALUES ($1,$2,$3,$4,'REPAIR','OPEN','NORMAL','ไฟห้องน้ำกะพริบ','หลอดไฟในห้องน้ำกะพริบตลอดเวลา รบกวนช่วยเข้ามาดูให้หน่อยครับ',$5,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
     ON CONFLICT ("id") DO UPDATE SET "status" = 'OPEN', "updatedAt" = CURRENT_TIMESTAMP`,
    ["demo-ticket-1", propertyId, "demo-room-101", tenantIds.somchai, `demo-user-somchai`],
  );
  await run(
    `INSERT INTO "Announcement" ("id","propertyId","title","content","audience","status","publishedAt","createdById","createdAt","updatedAt")
     VALUES ($1,$2,'แจ้งปิดน้ำชั่วคราว','วันเสาร์ที่จะถึงนี้ ปิดน้ำเวลา 09.00-12.00 น. เพื่อล้างถังเก็บน้ำ ขออภัยในความไม่สะดวก',
             'ALL_TENANTS','PUBLISHED',CURRENT_TIMESTAMP,$3,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
     ON CONFLICT ("id") DO UPDATE SET "status" = 'PUBLISHED', "updatedAt" = CURRENT_TIMESTAMP`,
    ["demo-announcement-1", propertyId, ownerId],
  );

  await run("COMMIT");

  console.log("เติมข้อมูลตัวอย่างเรียบร้อย");
  console.log(`  หอ: หอพักทดลอง (${rooms.length} ห้อง)`);
  console.log("  ผู้เช่าสำหรับเข้าทดสอบ:");
  for (const tenant of tenants) console.log(`    ${tenant.key}@nestly.demo  (${tenant.name} ห้อง ${tenant.room})`);
  console.log("  รหัสผ่านผู้เช่าทุกคนคือค่าที่ตั้งไว้ใน DEMO_TENANT_PASSWORD");
} catch (error) {
  await pool.query("ROLLBACK").catch(() => undefined);
  throw error;
} finally {
  await pool.end();
}
