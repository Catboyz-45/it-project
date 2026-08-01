import { PrismaClient } from "@prisma/client";

if (process.env.NODE_ENV === "production" && process.env.ALLOW_PRODUCTION_SEED !== "true") {
  throw new Error("Development seed is disabled in production");
}

const prisma = new PrismaClient();

const brands = ["Daikin", "Carrier", "Mitsubishi Electric", "Haier"];
const productTypes = ["ติดผนัง", "แขวนใต้ฝ้า", "สี่ทิศทาง", "ตู้ตั้งพื้น"];
const newsCategories = ["ข่าวบริษัท", "กิจกรรม", "บทความความรู้", "โปรโมชัน"];

function slugify(value) {
  const known = {
    "Mitsubishi Electric": "mitsubishi-electric",
    "ติดผนัง": "wall-mounted",
    "แขวนใต้ฝ้า": "ceiling-suspended",
    "สี่ทิศทาง": "four-way-cassette",
    "ตู้ตั้งพื้น": "floor-standing",
    "ข่าวบริษัท": "company-news",
    "กิจกรรม": "activities",
    "บทความความรู้": "knowledge",
    "โปรโมชัน": "promotions",
  };
  return known[value] ?? value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function upsertTaxonomies() {
  const brandRecords = new Map();
  for (const [sortOrder, name] of brands.entries()) {
    const record = await prisma.brand.upsert({
      where: { slug: slugify(name) },
      create: { slug: slugify(name), name, sortOrder },
      update: { name, sortOrder, isActive: true, deletedAt: null, purgeAt: null },
    });
    brandRecords.set(name, record);
  }

  const typeRecords = new Map();
  for (const [sortOrder, name] of productTypes.entries()) {
    const record = await prisma.productType.upsert({
      where: { slug: slugify(name) },
      create: { slug: slugify(name), name, sortOrder },
      update: { name, sortOrder, isActive: true, deletedAt: null, purgeAt: null },
    });
    typeRecords.set(name, record);
  }

  const categoryRecords = new Map();
  for (const [sortOrder, name] of newsCategories.entries()) {
    const record = await prisma.newsCategory.upsert({
      where: { slug: slugify(name) },
      create: { slug: slugify(name), name, sortOrder },
      update: { name, sortOrder, isActive: true, deletedAt: null, purgeAt: null },
    });
    categoryRecords.set(name, record);
  }

  return { brandRecords, typeRecords, categoryRecords };
}

async function main() {
  await prisma.company.upsert({
    where: { singletonKey: "PRIMARY" },
    create: {
      singletonKey: "PRIMARY",
      legalName: "บริษัท อยู่เย็นเป็นสุข วิศวกรรม จำกัด",
      displayName: "อยู่เย็นเป็นสุข วิศวกรรม",
      shortDescription: "บริการระบบปรับอากาศและงานระบบ M&E",
      businessHours: "จันทร์–เสาร์ 08:00–17:00 น.",
    },
    update: {},
  });

  const { brandRecords, typeRecords, categoryRecords } = await upsertTaxonomies();
  const publishedAt = new Date("2026-08-01T00:00:00.000Z");

  const serviceSeeds = [
    ["installation", "ติดตั้งเครื่องปรับอากาศ", "INSTALLATION", "สำรวจหน้างาน ออกแบบ และติดตั้งระบบปรับอากาศให้เหมาะกับพื้นที่"],
    ["cleaning", "ล้างและบำรุงรักษา", "MAINTENANCE", "ดูแลความสะอาด ตรวจเช็กระบบ และช่วยยืดอายุการใช้งาน"],
    ["repair", "ตรวจเช็กและซ่อมแซม", "REPAIR", "วิเคราะห์อาการเสีย พร้อมแก้ไขโดยช่างผู้มีประสบการณ์"],
    ["me-system", "งานระบบ M&E", "ENGINEERING", "ออกแบบและติดตั้งงานระบบเครื่องกลและไฟฟ้าสำหรับอาคาร"],
  ];
  const serviceRecords = new Map();
  for (const [sortOrder, [slug, title, eyebrow, summary]] of serviceSeeds.entries()) {
    const record = await prisma.service.upsert({
      where: { slug },
      create: { slug, title, eyebrow, summary, sortOrder, status: "PUBLISHED", publishedAt, isFeatured: true },
      update: { title, eyebrow, summary, sortOrder },
    });
    serviceRecords.set(slug, record);
  }

  const productSeeds = [
    { slug: "daikin-smash-ii", name: "Daikin Smash II", model: "FTKQ Series", brand: "Daikin", type: "ติดผนัง", btuMin: 9200, btuMax: 24200, features: "ระบบ Inverter\nฉลากประหยัดไฟเบอร์ 5" },
    { slug: "carrier-x-inverter", name: "Carrier X Inverter", model: "X Inverter", brand: "Carrier", type: "ติดผนัง", btuMin: 9000, btuMax: 25000, features: "ระบบ Inverter" },
    { slug: "mitsubishi-happy-inverter", name: "Happy Inverter", model: "Happy Inverter", brand: "Mitsubishi Electric", type: "ติดผนัง", btuMin: 9212, btuMax: 24225, features: "แผ่นกรอง PM 2.5" },
    { slug: "haier-clean-cool", name: "Clean Cool Series", model: "Clean Cool", brand: "Haier", type: "ติดผนัง", btuMin: 9000, btuMax: 18000, features: "Self Cleaning" },
  ];
  for (const item of productSeeds) {
    const brand = brandRecords.get(item.brand);
    const productType = typeRecords.get(item.type);
    if (!brand || !productType) throw new Error(`Missing taxonomy for ${item.slug}`);
    await prisma.product.upsert({
      where: { slug: item.slug },
      create: { slug: item.slug, name: item.name, model: item.model, summary: `${item.name} สำหรับบ้านและสำนักงาน`, btuMin: item.btuMin, btuMax: item.btuMax, features: item.features, brandId: brand.id, productTypeId: productType.id, status: "PUBLISHED", publishedAt, isFeatured: true },
      update: { name: item.name, model: item.model, summary: `${item.name} สำหรับบ้านและสำนักงาน`, btuMin: item.btuMin, btuMax: item.btuMax, features: item.features, brandId: brand.id, productTypeId: productType.id },
    });
  }

  const projectSeeds = [
    { slug: "office-renovation", title: "ปรับปรุงระบบปรับอากาศสำนักงาน", projectType: "งานติดตั้ง", area: "กรุงเทพมหานคร", service: "installation" },
    { slug: "factory-maintenance", title: "บำรุงรักษาระบบโรงงาน", projectType: "งานบำรุงรักษา", area: "ปทุมธานี", service: "cleaning" },
    { slug: "commercial-me", title: "งานระบบ M&E อาคารพาณิชย์", projectType: "งานระบบ M&E", area: "นนทบุรี", service: "me-system" },
  ];
  for (const item of projectSeeds) {
    const project = await prisma.project.upsert({
      where: { slug: item.slug },
      create: { slug: item.slug, title: item.title, projectType: item.projectType, area: item.area, summary: `ตัวอย่าง${item.projectType}ในพื้นที่${item.area}`, status: "PUBLISHED", publishedAt, isFeatured: true },
      update: { title: item.title, projectType: item.projectType, area: item.area },
    });
    const service = serviceRecords.get(item.service);
    if (service) await prisma.projectService.upsert({ where: { projectId_serviceId: { projectId: project.id, serviceId: service.id } }, create: { projectId: project.id, serviceId: service.id }, update: {} });
  }

  const knowledge = categoryRecords.get("บทความความรู้");
  const companyNews = categoryRecords.get("ข่าวบริษัท");
  if (!knowledge || !companyNews) throw new Error("Missing news categories");
  const newsSeeds = [
    { slug: "choose-air-conditioner", title: "เลือกขนาด BTU อย่างไรให้เหมาะกับห้อง", summary: "วิธีคำนวณขนาดเครื่องปรับอากาศเบื้องต้น", categoryId: knowledge.id },
    { slug: "maintenance-signs", title: "5 สัญญาณที่บอกว่าแอร์ควรได้รับการดูแล", summary: "สังเกตอาการผิดปกติก่อนเกิดปัญหาใหญ่", categoryId: knowledge.id },
    { slug: "new-service-area", title: "ขยายพื้นที่ให้บริการโซนกรุงเทพฯ ตะวันออก", summary: "พร้อมดูแลลูกค้าได้ครอบคลุมยิ่งขึ้น", categoryId: companyNews.id },
  ];
  for (const item of newsSeeds) {
    await prisma.news.upsert({
      where: { slug: item.slug },
      create: { ...item, status: "PUBLISHED", publishedAt, isFeatured: true },
      update: { title: item.title, summary: item.summary, categoryId: item.categoryId },
    });
  }

  await prisma.banner.upsert({
    where: { id: "dev-home-banner" },
    create: { id: "dev-home-banner", title: "เย็นสบาย มั่นใจได้ในทุกพื้นที่ของคุณ", description: "ครบทุกเรื่องระบบปรับอากาศและงาน M&E", buttonLabel: "ดูบริการของเรา", buttonUrl: "/services", status: "PUBLISHED", publishedAt },
    update: {},
  });
}

main()
  .then(() => console.log("Development seed completed"))
  .catch((error) => { console.error("Development seed failed", error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
