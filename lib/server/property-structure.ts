/**
 * คำอธิบายสำหรับผู้เริ่มต้น
 * ภาพรวมไฟล์: เป็นโค้ดฝั่งเซิร์ฟเวอร์สำหรับ “property structure” ซึ่งอาจแตะฐานข้อมูล session ไฟล์ หรือความลับของระบบ
 * การทำงาน: ถูกเรียกจาก Server Component หรือ API route เพื่อทำ use case จริง ตรวจสิทธิ์และกฎธุรกิจก่อนอ่านหรือเปลี่ยนข้อมูล และไม่ควรถูก import ไปยัง Client Component
 */

import type {
  CreateBuildingInput,
  CreateFloorInput,
  CreateRoomInput,
  UpdateBuildingInput,
  UpdateFloorInput,
  UpdateRoomInput,
} from "@/lib/domain/property-structure";
import type { Prisma } from "@/generated/prisma/client";
import { ApiError } from "@/lib/server/api";
import { getDatabase } from "@/lib/server/db";
import { assertSubscriptionWriteAccess } from "@/lib/server/subscription-guard";

const buildingSelect = {
  id: true,
  name: true,
  code: true,
  isActive: true,
  floors: {
    orderBy: { number: "asc" as const },
    select: { id: true, number: true, label: true },
  },
  _count: { select: { rooms: true } },
} as const;

const roomSelect = {
  id: true,
  buildingId: true,
  floorId: true,
  number: true,
  roomType: true,
  monthlyRent: true,
  depositAmount: true,
  capacity: true,
  status: true,
  furnitureItems: {
    orderBy: { furnitureOption: { name: "asc" as const } },
    select: {
      quantity: true,
      furnitureOption: { select: { id: true, name: true } },
    },
  },
  building: { select: { name: true, code: true } },
  floor: { select: { number: true, label: true } },
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: แปลงข้อมูลในขั้นตอน “serialize Room” ให้เป็นรูปแบบมาตรฐานที่ส่วนถัดไปใช้ได้
 * รับค่า:
 * - room: ค่า “room” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
function serializeRoom<T extends {
  monthlyRent: { toString(): string };
  depositAmount: { toString(): string };
  furnitureItems: Array<{ quantity: number; furnitureOption: { id: string; name: string } }>;
}>(room: T) {
  const { furnitureItems, ...data } = room;
  return {
    ...data,
    furniture: furnitureItems.map((item) => item.furnitureOption.name),
    monthlyRent: room.monthlyRent.toString(),
    depositAmount: room.depositAmount.toString(),
  };
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “list Buildings” แล้วส่งผลที่เหมาะสมกลับไป
 * รับค่า:
 * - propertyId: รหัสภายในของหอพักที่ใช้จำกัดขอบเขตข้อมูล
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function listBuildings(propertyId: string) {
  return getDatabase().building.findMany({
    where: { propertyId },
    orderBy: [{ isActive: "desc" }, { code: "asc" }],
    select: buildingSelect,
  });
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: สร้างหรือส่งข้อมูลในขั้นตอน “create Building” หลังผ่านการตรวจที่เกี่ยวข้อง
 * รับค่า:
 * - propertyId: รหัสภายในของหอพักที่ใช้จำกัดขอบเขตข้อมูล
 * - input: ข้อมูลขาเข้าที่ต้องนำไปตรวจและประมวลผล
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function createBuilding(propertyId: string, input: CreateBuildingInput) {
  return getDatabase().$transaction(async (database) => {
    const duplicate = await database.building.findUnique({
      where: { propertyId_code: { propertyId, code: input.code } },
      select: { id: true },
    });
    if (duplicate) throw new ApiError(409, "รหัสอาคารนี้ถูกใช้งานแล้ว");

    return database.building.create({
      data: {
        propertyId,
        name: input.name,
        code: input.code,
        floors: { create: input.floors.map((floor) => ({ propertyId, ...floor })) },
      },
      select: buildingSelect,
    });
  });
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: เปลี่ยนข้อมูลหรือสถานะในขั้นตอน “update Building” โดยใช้ค่าที่รับเข้ามา
 * รับค่า:
 * - propertyId: รหัสภายในของหอพักที่ใช้จำกัดขอบเขตข้อมูล
 * - buildingId: รหัสภายในของ building
 * - input: ข้อมูลขาเข้าที่ต้องนำไปตรวจและประมวลผล
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function updateBuilding(
  propertyId: string,
  buildingId: string,
  input: UpdateBuildingInput,
) {
  return getDatabase().$transaction(async (database) => {
    const building = await database.building.findFirst({
      where: { id: buildingId, propertyId },
      select: { id: true },
    });
    if (!building) throw new ApiError(404, "ไม่พบอาคาร");

    if (input.code) {
      const duplicate = await database.building.findFirst({
        where: { propertyId, code: input.code, id: { not: buildingId } },
        select: { id: true },
      });
      if (duplicate) throw new ApiError(409, "รหัสอาคารนี้ถูกใช้งานแล้ว");
    }

    if (input.isActive === false) {
      const activeRooms = await database.room.count({
        where: { buildingId, propertyId, status: { not: "INACTIVE" } },
      });
      if (activeRooms > 0) {
        throw new ApiError(409, "ต้องปิดใช้งานห้องทั้งหมดในอาคารก่อน");
      }
    }

    return database.building.update({
      where: { id: buildingId },
      data: input,
      select: buildingSelect,
    });
  });
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: สร้างหรือส่งข้อมูลในขั้นตอน “create Floor” หลังผ่านการตรวจที่เกี่ยวข้อง
 * รับค่า:
 * - propertyId: รหัสภายในของหอพักที่ใช้จำกัดขอบเขตข้อมูล
 * - buildingId: รหัสภายในของ building
 * - input: ข้อมูลขาเข้าที่ต้องนำไปตรวจและประมวลผล
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function createFloor(
  propertyId: string,
  buildingId: string,
  input: CreateFloorInput,
) {
  return getDatabase().$transaction(async (database) => {
    const building = await database.building.findFirst({
      where: { id: buildingId, propertyId, isActive: true },
      select: { id: true },
    });
    if (!building) throw new ApiError(404, "ไม่พบอาคารที่เปิดใช้งาน");

    const duplicate = await database.floor.findUnique({
      where: { buildingId_number: { buildingId, number: input.number } },
      select: { id: true },
    });
    if (duplicate) throw new ApiError(409, "หมายเลขชั้นนี้มีอยู่แล้ว");

    return database.floor.create({
      data: { propertyId, buildingId, ...input },
      select: { id: true, number: true, label: true },
    });
  });
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: เปลี่ยนข้อมูลหรือสถานะในขั้นตอน “update Floor” โดยใช้ค่าที่รับเข้ามา
 * รับค่า:
 * - propertyId: รหัสภายในของหอพักที่ใช้จำกัดขอบเขตข้อมูล
 * - buildingId: รหัสภายในของ building
 * - floorId: รหัสภายในของ floor
 * - input: ข้อมูลขาเข้าที่ต้องนำไปตรวจและประมวลผล
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function updateFloor(
  propertyId: string,
  buildingId: string,
  floorId: string,
  input: UpdateFloorInput,
) {
  const floor = await getDatabase().floor.findFirst({
    where: { id: floorId, buildingId, propertyId },
    select: { id: true },
  });
  if (!floor) throw new ApiError(404, "ไม่พบชั้น");
  return getDatabase().floor.update({
    where: { id: floorId },
    data: input,
    select: { id: true, number: true, label: true },
  });
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “list Rooms” แล้วส่งผลที่เหมาะสมกลับไป
 * รับค่า:
 * - propertyId: รหัสภายในของหอพักที่ใช้จำกัดขอบเขตข้อมูล
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function listRooms(propertyId: string) {
  const rooms = await getDatabase().room.findMany({
    where: { propertyId },
    orderBy: [
      { building: { code: "asc" } },
      { floor: { number: "asc" } },
      { number: "asc" },
    ],
    select: roomSelect,
  });
  return rooms.map(serializeRoom);
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: สร้างหรือส่งข้อมูลในขั้นตอน “create Room” หลังผ่านการตรวจที่เกี่ยวข้อง
 * รับค่า:
 * - propertyId: รหัสภายในของหอพักที่ใช้จำกัดขอบเขตข้อมูล
 * - input: ข้อมูลขาเข้าที่ต้องนำไปตรวจและประมวลผล
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function createRoom(propertyId: string, input: CreateRoomInput) {
  const room = await getDatabase().$transaction(async (database) => {
    const property = await database.property.findFirst({
        where: { id: propertyId, isActive: true },
        select: {
          subscription: {
            select: {
              status: true, startsAt: true, expiresAt: true,
              maxProperties: true, maxRooms: true,
              plan: {
                select: {
                  allowPromptPay: true,
                  allowFileUploads: true,
                  allowPrioritySupport: true,
                },
              },
            },
          },
        },
      });
    const floor = await database.floor.findFirst({
        where: {
          id: input.floorId,
          propertyId,
          buildingId: input.buildingId,
          building: { isActive: true },
        },
        select: { id: true },
      });
    const duplicate = await database.room.findUnique({
        where: { propertyId_number: { propertyId, number: input.number } },
        select: { id: true },
      });

    if (!property) throw new ApiError(404, "ไม่พบหอพักที่เปิดใช้งาน");
    if (!floor) throw new ApiError(400, "อาคารหรือชั้นไม่อยู่ในหอพักนี้");
    if (duplicate) throw new ApiError(409, "เลขห้องนี้ถูกใช้งานแล้ว");

    const subscription = property.subscription;
    assertSubscriptionWriteAccess(subscription);
    const roomCount = await database.room.count({ where: { propertyId } });
    if (roomCount >= subscription.maxRooms) {
      throw new ApiError(409, "จำนวนห้องถึงขีดจำกัดของแพ็กเกจแล้ว");
    }

    return database.room.create({
      data: {
        propertyId,
        buildingId: input.buildingId,
        floorId: input.floorId,
        number: input.number,
        roomType: input.roomType,
        monthlyRent: input.monthlyRent,
        depositAmount: input.depositAmount,
        capacity: input.capacity,
        furnitureItems: input.furniture.length ? {
          create: await resolveFurniture(database, propertyId, input.furniture),
        } : undefined,
      },
      select: roomSelect,
    });
  }, { isolationLevel: "Serializable" });

  return serializeRoom(room);
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: เปลี่ยนข้อมูลหรือสถานะในขั้นตอน “update Room” โดยใช้ค่าที่รับเข้ามา
 * รับค่า:
 * - propertyId: รหัสภายในของหอพักที่ใช้จำกัดขอบเขตข้อมูล
 * - roomId: รหัสภายในของห้องพัก
 * - input: ข้อมูลขาเข้าที่ต้องนำไปตรวจและประมวลผล
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
export async function updateRoom(
  propertyId: string,
  roomId: string,
  input: UpdateRoomInput,
) {
  const room = await getDatabase().$transaction(async (database) => {
    const existing = await database.room.findFirst({
      where: { id: roomId, propertyId },
      select: { id: true, buildingId: true },
    });
    if (!existing) throw new ApiError(404, "ไม่พบห้องพัก");
    if (input.floorId && !await database.floor.count({
      where: { id: input.floorId, propertyId, buildingId: existing.buildingId },
    })) throw new ApiError(400, "ชั้นไม่อยู่ในอาคารของห้องนี้");

    if (input.status) {
      const activeOccupancy = await database.roomOccupancy.count({
        where: { roomId, propertyId, status: "ACTIVE" },
      });
      if (activeOccupancy > 0) {
        throw new ApiError(409, "ไม่สามารถเปลี่ยนสถานะห้องที่มีผู้เช่าอยู่");
      }
    }

    const { furniture, ...roomData } = input;
    return database.room.update({
      where: { id: roomId },
      data: {
        ...roomData,
        ...(furniture ? {
          furnitureItems: {
            deleteMany: {},
            create: await resolveFurniture(database, propertyId, furniture),
          },
        } : {}),
      },
      select: roomSelect,
    });
  });

  return serializeRoom(room);
}

/**
 * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
 * หน้าที่: อ่านหรือค้นหาข้อมูลสำหรับ “resolve Furniture” แล้วส่งผลที่เหมาะสมกลับไป
 * รับค่า:
 * - database: ตัวเชื่อมต่อฐานข้อมูลที่ใช้ใน transaction นี้
 * - propertyId: รหัสภายในของหอพักที่ใช้จำกัดขอบเขตข้อมูล
 * - names: ค่า “names” ที่จำเป็นต่อการทำงานของก้อนนี้
 * ผลลัพธ์: คืนข้อมูลที่ก้อนนี้อ่าน คำนวณ หรือประกอบให้ผู้เรียก
 */
async function resolveFurniture(
  database: Prisma.TransactionClient,
  propertyId: string,
  names: string[],
) {
  const uniqueNames = [...new Set(names.map((name) => name.trim()))];
  const options = await database.furnitureOption.findMany({
    where: { propertyId, name: { in: uniqueNames } },
    select: { id: true, name: true },
  });
  const found = new Set(options.map((option) => option.name));
  /**
   * คำอธิบายก้อนโค้ดสำหรับผู้เริ่มต้น
   * หน้าที่: รวมขั้นตอนย่อยของ “missing” ไว้ในจุดเดียว เพื่อให้ส่วนอื่นเรียกใช้ซ้ำและทดสอบได้
   * รับค่า:
   * - name: ค่า “name” ที่จำเป็นต่อการทำงานของก้อนนี้
   * ผลลัพธ์: คืนค่าที่คำนวณจาก expression นี้โดยตรง
   */
  const missing = uniqueNames.filter((name) => !found.has(name));
  if (missing.length) {
    await database.furnitureOption.createMany({
      data: missing.map((name) => ({ propertyId, name, isDefault: false })),
      skipDuplicates: true,
    });
    return database.furnitureOption.findMany({
      where: { propertyId, name: { in: uniqueNames } },
      select: { id: true },
    }).then((rows) => rows.map(({ id }) => ({ furnitureOptionId: id })));
  }
  return options.map(({ id }) => ({ furnitureOptionId: id }));
}
