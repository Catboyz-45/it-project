/**
 * หน้าที่ของไฟล์นี้: หน้าเว็บเส้นทาง /products; เตรียมข้อมูลที่จำเป็นแล้วประกอบส่วนติดต่อผู้ใช้ที่ผู้เยี่ยมชมหรือผู้ดูแลเห็น
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import { Search } from "lucide-react";
import { ProductCard } from "@/components/content-cards";
import {
  EmptyPublicResults,
  PublicPagination,
} from "@/components/public-pagination";
import { createMetadata } from "@/lib/seo";
import { PublicContentService } from "@/server/services/public-content.service";
import { ThemeSelect } from "@/components/theme-select";
import {
  ClearPublicFilters,
  PublicFilterForm,
  PublicFilterSubmit,
  PublicResultCount,
} from "@/components/public-filter-feedback";

export const metadata = createMetadata({
  title: "สินค้าเครื่องปรับอากาศ",
  description:
    "เลือกดูเครื่องปรับอากาศตามยี่ห้อ ประเภท รุ่น และขนาด BTU พร้อมสอบถามราคา",
  path: "/products",
});
type Params = {
  q?: string;
  brand?: string;
  type?: string;
  btu?: string;
  page?: string;
};
/** สร้างส่วนหน้าจอ ProductsPage; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const raw = await searchParams;
  const page = Math.max(1, Number.parseInt(raw.page ?? "1", 10) || 1);
  const btu = raw.btu ? Number.parseInt(raw.btu, 10) : undefined;
  const validSlug = (value?: string) =>
    value && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) ? value : undefined;
  const query = raw.q?.trim().slice(0, 120) || undefined;
  const brand = validSlug(raw.brand);
  const type = validSlug(raw.type);
  const content = new PublicContentService();
  const [result, [brands, types]] = await Promise.all([
    content.listProducts({
      page,
      pageSize: 12,
      query,
      brandSlug: brand,
      typeSlug: type,
      btu: Number.isFinite(btu) && (btu ?? 0) > 0 ? btu : undefined,
    }),
    content.getProductFilters(),
  ]);
  const items = result.items.map((item) => ({
    slug: item.slug,
    name: item.name,
    brand: item.brand.name,
    type: item.productType.name,
    btu:
      item.btuMin && item.btuMax
        ? `${item.btuMin.toLocaleString()}–${item.btuMax.toLocaleString()} BTU`
        : "สอบถามขนาด",
    feature: item.summary,
    tone: "silver",
    media: item.coverMedia,
  }));
  const filtered = Boolean(raw.q || raw.brand || raw.type || raw.btu);
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <p className="eyebrow">PRODUCTS</p>
          <h1 className="display">สินค้าเครื่องปรับอากาศ</h1>
          <p className="lead">
            เลือกดูสินค้าตามยี่ห้อ ประเภท และขนาด BTU หากไม่แน่ใจ
            ทีมงานพร้อมช่วยแนะนำรุ่นที่เหมาะกับพื้นที่
          </p>
        </div>
      </section>
      <section className="section">
        <div className="container">
          <PublicFilterForm action="/products">
            <label className="search-field">
              <span className="sr-only">ค้นหาสินค้า</span>
              <Search size={18} />
              <input
                className="field"
                name="q"
                defaultValue={raw.q}
                maxLength={120}
                placeholder="ค้นหาชื่อหรือรุ่น"
              />
            </label>
            <ThemeSelect
              name="brand"
              label="กรองตามยี่ห้อ"
              defaultValue={raw.brand}
              options={[
                { value: "", label: "ทุกยี่ห้อ" },
                ...brands.map((value) => ({
                  value: value.slug,
                  label: value.name,
                })),
              ]}
            />
            <ThemeSelect
              name="type"
              label="กรองตามประเภท"
              defaultValue={raw.type}
              options={[
                { value: "", label: "ทุกประเภท" },
                ...types.map((value) => ({
                  value: value.slug,
                  label: value.name,
                })),
              ]}
            />
            <input
              className="field filter-select"
              type="number"
              name="btu"
              min="1"
              defaultValue={raw.btu}
              placeholder="BTU ที่ต้องการ"
              aria-label="กรองตาม BTU"
            />
            <PublicFilterSubmit />
            {filtered && <ClearPublicFilters href="/products" />}
          </PublicFilterForm>
          <PublicResultCount>
            พบสินค้า {result.total} รายการ
            {filtered ? " จากเงื่อนไขที่เลือก" : ""}
          </PublicResultCount>
          {items.length ? (
            <div className="grid-4">
              {items.map((item) => (
                <ProductCard key={item.slug} item={item} />
              ))}
            </div>
          ) : (
            <EmptyPublicResults resetHref="/products" />
          )}
          <PublicPagination
            page={result.page}
            pageCount={result.pageCount}
            pathname="/products"
            params={{
              q: raw.q,
              brand: raw.brand,
              type: raw.type,
              btu: raw.btu,
            }}
          />
        </div>
      </section>
    </>
  );
}
