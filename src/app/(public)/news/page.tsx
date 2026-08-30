/**
 * หน้าที่ของไฟล์นี้: หน้าเว็บเส้นทาง /news; เตรียมข้อมูลที่จำเป็นแล้วประกอบส่วนติดต่อผู้ใช้ที่ผู้เยี่ยมชมหรือผู้ดูแลเห็น
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import { Search } from "lucide-react";
import { StoryCard } from "@/components/content-cards";
import {
  EmptyPublicResults,
  PublicPagination,
} from "@/components/public-pagination";
import { createMetadata } from "@/lib/seo";
import { PublicContentService } from "@/server/services/public-content.service";
import { formatThaiDate } from "@/lib/date";
import { ThemeSelect } from "@/components/theme-select";
import {
  ClearPublicFilters,
  PublicFilterForm,
  PublicFilterSubmit,
  PublicResultCount,
} from "@/components/public-filter-feedback";

export const metadata = createMetadata({
  title: "ข่าวสารและบทความ",
  description: "ข่าวบริษัท กิจกรรม โปรโมชัน และความรู้เรื่องระบบปรับอากาศ",
  path: "/news",
});
type Params = { q?: string; category?: string; page?: string };
/** สร้างส่วนหน้าจอ NewsPage; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const raw = await searchParams;
  const page = Math.max(1, Number.parseInt(raw.page ?? "1", 10) || 1);
  const content = new PublicContentService();
  const [result, categories] = await Promise.all([
    content.listNews({
      page,
      pageSize: 9,
      query: raw.q,
      categorySlug: raw.category,
    }),
    content.getNewsCategories(),
  ]);
  const items = result.items.map((item) => ({
    slug: item.slug,
    title: item.title,
    category: item.category.name,
    date: formatThaiDate(item.publishedAt),
    summary: item.summary,
    tone: "mint",
    media: item.coverMedia,
  }));
  const filtered = Boolean(raw.q || raw.category);
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <p className="eyebrow">NEWS & KNOWLEDGE</p>
          <h1 className="display">ข่าวสารและบทความ</h1>
          <p className="lead">
            ติดตามข่าวบริษัท กิจกรรม โปรโมชัน
            และสาระเกี่ยวกับการดูแลระบบปรับอากาศ
          </p>
        </div>
      </section>
      <section className="section">
        <div className="container">
          <PublicFilterForm action="/news">
            <label className="search-field">
              <span className="sr-only">ค้นหาข่าว</span>
              <Search size={18} />
              <input
                className="field"
                name="q"
                defaultValue={raw.q}
                maxLength={120}
                placeholder="ค้นหาข่าวหรือบทความ"
              />
            </label>
            <ThemeSelect
              name="category"
              label="กรองตามหมวดหมู่"
              defaultValue={raw.category}
              options={[
                { value: "", label: "ทุกหมวดหมู่" },
                ...categories.map((value) => ({
                  value: value.slug,
                  label: value.name,
                })),
              ]}
            />
            <PublicFilterSubmit />
            {filtered && <ClearPublicFilters href="/news" />}
          </PublicFilterForm>
          <PublicResultCount>
            พบ {result.total} รายการ
            {filtered ? " จากเงื่อนไขที่เลือก" : ""}
          </PublicResultCount>
          {items.length ? (
            <div className="grid-3">
              {items.map((item) => (
                <StoryCard key={item.slug} item={item} type="news" />
              ))}
            </div>
          ) : (
            <EmptyPublicResults resetHref="/news" />
          )}
          <PublicPagination
            page={result.page}
            pageCount={result.pageCount}
            pathname="/news"
            params={{ q: raw.q, category: raw.category }}
          />
        </div>
      </section>
    </>
  );
}
