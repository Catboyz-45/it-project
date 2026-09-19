import { z } from "zod";

// ตรวจผลการอนุมัติบัญชีเจ้าของหอ
export const reviewAccountApprovalSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  rejectionReason: z.string().trim().min(2).max(500).optional(),
// superRefine เพราะเงื่อนไขขึ้นกับความสัมพันธ์ระหว่างสองฟิลด์ ตรวจทีละฟิลด์ไม่พอ
}).strict().superRefine((value, context) => {
  // ไม่อนุมัติต้องบอกเหตุผล เพราะเจ้าของหอต้องรู้ว่าต้องแก้อะไรก่อนสมัครใหม่
  if (value.status === "REJECTED" && !value.rejectionReason) {
    context.addIssue({ code: "custom", path: ["rejectionReason"], message: "กรุณาระบุเหตุผลที่ไม่อนุมัติ" });
  }
  // อนุมัติแล้วส่งเหตุผลมาด้วยแปลว่าฝั่งที่เรียกเข้าใจผิด ปฏิเสธไปเลยดีกว่าเก็บข้อมูลที่ขัดกันเอง
  if (value.status === "APPROVED" && value.rejectionReason) {
    context.addIssue({ code: "custom", path: ["rejectionReason"], message: "บัญชีที่อนุมัติไม่ต้องระบุเหตุผล" });
  }
});

export type ReviewAccountApprovalInput = z.infer<typeof reviewAccountApprovalSchema>;
