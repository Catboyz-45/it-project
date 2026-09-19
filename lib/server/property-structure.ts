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

export async function listBuildings(propertyId: string) {
  return getDatabase().building.findMany({
    where: { propertyId },
    orderBy: [{ isActive: "desc" }, { code: "asc" }],
    select: buildingSelect,
  });
}

// สร้างอาคารพร้อมชั้นในคำสั่งเดียว อาคารที่ไม่มีชั้นเลยใช้งานไม่ได้
export async function createBuilding(propertyId: string, input: CreateBuildingInput) {
  return getDatabase().$transaction(async (database) => {
    const duplicate = await database.building.findUnique({
      where: { propertyId_code: { propertyId, code: input.code } },
      select: { id: true },
    });
    // รหัสอาคารต้องไม่ซ้ำในหอเดียวกัน เพราะใช้อ้างอิงในเลขห้องและรายงาน
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
      // รหัสอาคารต้องไม่ซ้ำในหอเดียวกัน เพราะใช้อ้างอิงในเลขห้องและรายงาน
    if (duplicate) throw new ApiError(409, "รหัสอาคารนี้ถูกใช้งานแล้ว");
    }

    if (input.isActive === false) {
      const activeRooms = await database.room.count({
        where: { buildingId, propertyId, status: { not: "INACTIVE" } },
      });
      if (activeRooms > 0) {
      // ปิดอาคารที่ยังมีห้องเปิดอยู่ไม่ได้ ไม่งั้นห้องจะลอยอยู่ในอาคารที่ไม่มีแล้ว
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
    // ชั้นซ้ำในอาคารเดียวกันไม่ได้ เพราะเลขห้องอ้างอิงจากเลขชั้น
    if (duplicate) throw new ApiError(409, "หมายเลขชั้นนี้มีอยู่แล้ว");

    return database.floor.create({
      data: { propertyId, buildingId, ...input },
      select: { id: true, number: true, label: true },
    });
  });
}

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
    // เช็คว่าชั้นที่ส่งมาอยู่ในอาคารของหอนี้จริง กันส่ง id ของหออื่นมาสร้างห้องข้ามหอ
    if (!floor) throw new ApiError(400, "อาคารหรือชั้นไม่อยู่ในหอพักนี้");
    if (duplicate) throw new ApiError(409, "เลขห้องนี้ถูกใช้งานแล้ว");

    const subscription = property.subscription;
    assertSubscriptionWriteAccess(subscription);
    const roomCount = await database.room.count({ where: { propertyId } });
    if (roomCount >= subscription.maxRooms) {
    // จำนวนห้องจำกัดตามแพ็กเกจ นับในคำสั่งเดียวกับที่สร้าง จึงเกินไม่ได้แม้กดพร้อมกัน
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
      // ห้องที่มีคนอยู่เปลี่ยนสถานะเองไม่ได้ ต้องผ่านขั้นตอนย้ายออก ข้อมูลจะได้ไม่ขัดกัน
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

// แปลงชื่อเฟอร์นิเจอร์เป็น id ที่มีอยู่จริง กันสร้างรายการซ้ำจากชื่อที่พิมพ์ไม่ตรงกัน
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
