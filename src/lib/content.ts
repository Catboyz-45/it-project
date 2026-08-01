export type ContentStatus = "เผยแพร่แล้ว" | "ฉบับร่าง";

export const services = [
  { slug: "installation", title: "ติดตั้งเครื่องปรับอากาศ", eyebrow: "INSTALLATION", description: "สำรวจหน้างาน ออกแบบ และติดตั้งระบบปรับอากาศให้เหมาะกับพื้นที่", icon: "snowflake" },
  { slug: "cleaning", title: "ล้างและบำรุงรักษา", eyebrow: "MAINTENANCE", description: "ดูแลความสะอาด ตรวจเช็กระบบ และช่วยยืดอายุการใช้งาน", icon: "sparkles" },
  { slug: "repair", title: "ตรวจเช็กและซ่อมแซม", eyebrow: "REPAIR", description: "วิเคราะห์อาการเสีย พร้อมแก้ไขโดยช่างผู้มีประสบการณ์", icon: "wrench" },
  { slug: "me-system", title: "งานระบบ M&E", eyebrow: "ENGINEERING", description: "ออกแบบและติดตั้งงานระบบเครื่องกลและไฟฟ้าสำหรับอาคาร", icon: "building" },
];

export const products = [
  { slug: "daikin-smash-ii", name: "Daikin Smash II", brand: "Daikin", type: "ติดผนัง", btu: "9,200–24,200 BTU", feature: "ประหยัดไฟเบอร์ 5", tone: "mint" },
  { slug: "carrier-x-inverter", name: "Carrier X Inverter", brand: "Carrier", type: "ติดผนัง", btu: "9,000–25,000 BTU", feature: "ระบบ Inverter", tone: "sky" },
  { slug: "mitsubishi-happy-inverter", name: "Happy Inverter", brand: "Mitsubishi Electric", type: "ติดผนัง", btu: "9,212–24,225 BTU", feature: "PM 2.5 Filter", tone: "silver" },
  { slug: "haier-clean-cool", name: "Clean Cool Series", brand: "Haier", type: "ติดผนัง", btu: "9,000–18,000 BTU", feature: "Self Cleaning", tone: "cream" },
  { slug: "daikin-cassette-inverter", name: "Cassette Inverter", brand: "Daikin", type: "สี่ทิศทาง", btu: "18,100–42,000 BTU", feature: "กระจายลม 360°", tone: "silver" },
  { slug: "carrier-ceiling-xpower", name: "Ceiling XPower", brand: "Carrier", type: "แขวนใต้ฝ้า", btu: "18,000–36,000 BTU", feature: "ส่งลมได้ไกล", tone: "sky" },
  { slug: "mitsubishi-move-eye", name: "Move Eye Comfort", brand: "Mitsubishi Electric", type: "ติดผนัง", btu: "12,283–18,084 BTU", feature: "ตรวจจับอุณหภูมิ", tone: "mint" },
  { slug: "haier-cassette-smart", name: "Smart Cassette", brand: "Haier", type: "สี่ทิศทาง", btu: "24,000–36,000 BTU", feature: "ควบคุมผ่าน Wi-Fi", tone: "cream" },
];

export const projects = [
  { slug: "office-renovation", title: "ปรับปรุงระบบปรับอากาศสำนักงาน", category: "งานติดตั้ง", area: "กรุงเทพมหานคร", date: "มิถุนายน 2569", tone: "office" },
  { slug: "factory-maintenance", title: "บำรุงรักษาระบบโรงงาน", category: "งานบำรุงรักษา", area: "ปทุมธานี", date: "พฤษภาคม 2569", tone: "factory" },
  { slug: "commercial-me", title: "งานระบบ M&E อาคารพาณิชย์", category: "งานระบบ M&E", area: "นนทบุรี", date: "เมษายน 2569", tone: "building" },
  { slug: "retail-installation", title: "ติดตั้งระบบปรับอากาศพื้นที่ร้านค้า", category: "งานติดตั้ง", area: "กรุงเทพมหานคร", date: "มีนาคม 2569", tone: "office" },
  { slug: "warehouse-maintenance", title: "ตรวจเช็กระบบคลังสินค้า", category: "งานบำรุงรักษา", area: "สมุทรปราการ", date: "กุมภาพันธ์ 2569", tone: "factory" },
  { slug: "office-me-upgrade", title: "ปรับปรุงงานระบบสำนักงาน", category: "งานระบบ M&E", area: "ปทุมธานี", date: "มกราคม 2569", tone: "building" },
];

export const news = [
  { slug: "choose-air-conditioner", title: "เลือกขนาด BTU อย่างไรให้เหมาะกับห้อง", category: "บทความความรู้", date: "18 กรกฎาคม 2569", summary: "วิธีคำนวณขนาดเครื่องปรับอากาศเบื้องต้น เพื่อความเย็นสบายและประหยัดพลังงาน", tone: "guide" },
  { slug: "maintenance-signs", title: "5 สัญญาณที่บอกว่าแอร์ควรได้รับการดูแล", category: "บทความความรู้", date: "8 กรกฎาคม 2569", summary: "สังเกตอาการผิดปกติก่อนเกิดปัญหาใหญ่ และวางแผนบำรุงรักษาได้ตรงเวลา", tone: "tools" },
  { slug: "new-service-area", title: "ขยายพื้นที่ให้บริการโซนกรุงเทพฯ ตะวันออก", category: "ข่าวบริษัท", date: "1 กรกฎาคม 2569", summary: "พร้อมดูแลลูกค้าบ้านพักอาศัย สำนักงาน และอาคารพาณิชย์ได้ครอบคลุมยิ่งขึ้น", tone: "map" },
  { slug: "save-energy-tips", title: "ดูแลแอร์อย่างไรให้ช่วยประหยัดพลังงาน", category: "บทความความรู้", date: "24 มิถุนายน 2569", summary: "แนวทางใช้งานและดูแลเครื่องปรับอากาศเบื้องต้นเพื่อควบคุมค่าไฟ", tone: "guide" },
  { slug: "service-team-training", title: "อบรมมาตรฐานการทำงานสำหรับทีมบริการ", category: "กิจกรรม", date: "12 มิถุนายน 2569", summary: "ทบทวนขั้นตอนความปลอดภัย การตรวจเช็ก และการส่งมอบงานให้ลูกค้า", tone: "tools" },
  { slug: "maintenance-promotion", title: "แพ็กเกจดูแลระบบปรับอากาศสำหรับสำนักงาน", category: "โปรโมชัน", date: "1 มิถุนายน 2569", summary: "วางแผนตรวจเช็กและบำรุงรักษาให้เหมาะกับรอบการใช้งานของสำนักงาน", tone: "office" },
];

export const cmsRows = {
  products: products.map((item, index) => ({ title: item.name, meta: `${item.brand} · ${item.btu}`, status: index === 3 ? "ฉบับร่าง" : "เผยแพร่แล้ว", updated: `${index + 1} ส.ค. 2569` })),
  services: services.map((item, index) => ({ title: item.title, meta: item.eyebrow, status: "เผยแพร่แล้ว", updated: `${index + 1} ส.ค. 2569` })),
  projects: projects.map((item, index) => ({ title: item.title, meta: `${item.category} · ${item.area}`, status: index === 2 ? "ฉบับร่าง" : "เผยแพร่แล้ว", updated: `${index + 1} ส.ค. 2569` })),
  news: news.map((item, index) => ({ title: item.title, meta: item.category, status: index === 1 ? "ฉบับร่าง" : "เผยแพร่แล้ว", updated: `${index + 1} ส.ค. 2569` })),
} satisfies Record<string, Array<{ title: string; meta: string; status: ContentStatus; updated: string }>>;
