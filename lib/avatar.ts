// ที่อยู่รูปโปรไฟล์ของตัวเอง ใช้ได้ทั้งฝั่งเซิร์ฟเวอร์และเบราว์เซอร์
// ใส่ชื่อไฟล์สุ่มต่อท้ายเป็นเวอร์ชัน เปลี่ยนรูปแล้วที่อยู่เปลี่ยนตาม เบราว์เซอร์จึงไม่ค้างรูปเก่า
export function ownAvatarUrl(avatarKey: string | null | undefined) {
  if (!avatarKey) return null;
  const version = avatarKey.split("/").pop()?.replace(/\.[a-z]+$/i, "") ?? "";
  return `/api/account/avatar?v=${encodeURIComponent(version)}`;
}
