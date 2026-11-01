// ฟอร์มของผู้ดูแลระบบโหลดหน้าใหม่หลังบันทึก เพราะตารางถูกวาดมาจากฝั่งเซิร์ฟเวอร์
// toast ที่ขึ้นก่อนโหลดจะหายไปพร้อมหน้าเก่า จึงฝากข้อความไว้ใน sessionStorage
// แล้วให้ ToastProvider หยิบมาแสดงหลังหน้าใหม่ขึ้นมา

const storageKey = "nestly:pending-toast";

export function reloadWithToast(message: string) {
  try {
    window.sessionStorage.setItem(storageKey, message);
  } catch {
    // เบราว์เซอร์ปิด storage ไว้ก็แค่ไม่มีข้อความยืนยัน การบันทึกสำเร็จไปแล้ว
  }
  window.location.reload();
}

// อ่านแล้วลบทิ้งทันที โหลดหน้าซ้ำอีกรอบจะได้ไม่ขึ้นข้อความเดิม
export function takePendingToast() {
  try {
    const message = window.sessionStorage.getItem(storageKey);
    if (message) window.sessionStorage.removeItem(storageKey);
    return message;
  } catch {
    return null;
  }
}
