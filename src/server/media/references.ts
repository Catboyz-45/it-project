/**
 * หน้าที่ของไฟล์นี้: ระบบสื่อ references ดูแลการตรวจไฟล์ ประมวลผล อ้างอิง หรือวงจรชีวิตของรูปภาพและ PDF
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import { db } from "@/server/db/client";

/** นับจำนวนตำแหน่งที่อ้างถึง media ก่อนอนุญาตให้ลบ ป้องกันรูปหรือ PDF หายจากเนื้อหา */
export async function referenceCount(mediaId: string) {
  const [company, banners, services, productCovers, productCatalogs, productGallery, projectCovers, projectGallery, news] = await db.$transaction([
    db.company.count({ where: { logoMediaId: mediaId } }),
    db.banner.count({ where: { imageId: mediaId } }),
    db.service.count({ where: { coverMediaId: mediaId } }),
    db.product.count({ where: { coverMediaId: mediaId } }),
    db.product.count({ where: { catalogMediaId: mediaId } }),
    db.productMedia.count({ where: { mediaId } }),
    db.project.count({ where: { coverMediaId: mediaId } }),
    db.projectMedia.count({ where: { mediaId } }),
    db.news.count({ where: { coverMediaId: mediaId } }),
  ]);
  return company + banners + services + productCovers + productCatalogs + productGallery + projectCovers + projectGallery + news;
}
