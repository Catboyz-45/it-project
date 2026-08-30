/**
 * หน้าที่ของไฟล์นี้: คอมโพเนนต์ React structured-data ซึ่งรวมหน้าตาและพฤติกรรมที่นำกลับมาใช้ซ้ำในหน้าเว็บ
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import { companyPublicConfig as company } from "@/lib/public-config";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.yuyenengineering.co.th";

/** สร้างส่วนหน้าจอ StructuredData; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export function StructuredData({ data }: { data: Record<string, unknown> }) { return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />; }

/** สร้างส่วนหน้าจอ LocalBusinessStructuredData; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export function LocalBusinessStructuredData({ company: databaseCompany }: { company?: { displayName?: string | null; phoneHref?: string | null; address?: string | null; shortDescription?: string | null } | null }) {
  const value = { name: databaseCompany?.displayName ?? company.name, phoneHref: databaseCompany?.phoneHref ?? company.phoneHref, address: databaseCompany?.address ?? company.address, description: databaseCompany?.shortDescription ?? "บริการจำหน่าย ติดตั้ง ล้าง และซ่อมบำรุงระบบปรับอากาศ พร้อมงานระบบ M&E" };
  const data = {
    "@context": "https://schema.org",
    "@type": ["LocalBusiness", "HVACBusiness"],
    "@id": `${siteUrl}/#business`,
    name: value.name,
    url: siteUrl,
    image: `${siteUrl}/opengraph-image`,
    description: value.description,
    ...(value.phoneHref ? { telephone: value.phoneHref } : {}), ...(value.address ? { address: value.address } : {}),
    priceRange: "สอบถามราคา",
    areaServed: { "@type": "AdministrativeArea", name: "กรุงเทพมหานครและปริมณฑล" },
    openingHoursSpecification: [{ "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"], opens: "08:00", closes: "17:00" }],
  };

  return <StructuredData data={data} />;
}
