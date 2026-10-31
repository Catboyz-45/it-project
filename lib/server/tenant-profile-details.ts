// ช่องข้อมูลผู้เช่าเพิ่มเติมที่หน้าจอเจ้าของหอแสดงและแก้ไขได้ ใช้ร่วมกันทั้งรายชื่อผู้เช่าและแดชบอร์ด
// รวมไว้ที่เดียว เพิ่มช่องใหม่แล้วจะได้ไม่ลืมแก้อีกที่จนข้อมูลแสดงไม่ตรงกัน

export const tenantProfileDetailSelect = {
  namePrefix: true, nickname: true, nationality: true, nationalId: true, birthDate: true,
  lineId: true, occupation: true, organization: true, studentOrEmployeeId: true, emergencyRelation: true,
} as const;

type TenantProfileDetails = {
  namePrefix: string | null;
  nickname: string | null;
  nationality: string | null;
  nationalId: string | null;
  birthDate: Date | null;
  lineId: string | null;
  occupation: string | null;
  organization: string | null;
  studentOrEmployeeId: string | null;
  emergencyRelation: string | null;
};

// แปลงเป็นรูปแบบที่หน้าจอใช้ ค่าว่างเป็นสตริงว่าง ช่องกรอกจะได้ไม่ต้องคอยเช็ค null
// บันทึกของเจ้าของหอมาจากการเข้าพัก ไม่ใช่จากตัวผู้เช่า จึงรับแยกเข้ามา
export function toTenantProfileDetails(profile: TenantProfileDetails, ownerNote: string | null) {
  return {
    prefix: profile.namePrefix ?? "",
    nickname: profile.nickname ?? "",
    nationality: profile.nationality ?? "",
    nationalId: profile.nationalId ?? "",
    birthDate: profile.birthDate?.toISOString().slice(0, 10) ?? "",
    lineId: profile.lineId ?? "",
    occupation: profile.occupation ?? "",
    organization: profile.organization ?? "",
    studentOrEmployeeId: profile.studentOrEmployeeId ?? "",
    guardianRelation: profile.emergencyRelation ?? "",
    note: ownerNote ?? "",
  };
}
