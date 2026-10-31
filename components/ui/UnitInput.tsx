// ช่องกรอกที่มีหน่วยอยู่ในกล่อง ชิดขวา เช่น "3,500 บาท/เดือน"
// เดิมวางหน่วยไว้นอกกล่อง หน่วยยาวไม่เท่ากันกล่องจึงสั้นยาวต่างกันทุกแถว
// ย้ายหน่วยเข้ามาในกล่อง ทุกช่องจึงกว้างเท่ากันไม่ว่าหน่วยจะยาวแค่ไหน

import type { CSSProperties, InputHTMLAttributes } from "react";

type UnitInputProps = InputHTMLAttributes<HTMLInputElement> & {
  // คำนำหน้าตัวเลข เช่น "วันที่"
  prefix?: string;
  // หน่วยท้ายตัวเลข เช่น "บาท" "คน" "ของเดือนถัดไป"
  unit?: string;
};

export function UnitInput({ prefix, unit, ...inputProps }: Readonly<UnitInputProps>) {
  // เผื่อที่ในช่องตามความยาวคำ ตัวเลขยาว ๆ จะได้ไม่วิ่งไปทับหน่วย
  const style = {
    "--unit-input-prefix": prefix ? `${prefix.length}ch` : "0ch",
    "--unit-input-suffix": unit ? `${unit.length}ch` : "0ch",
  } as CSSProperties;

  return <span className={`unit-input${prefix ? " has-prefix" : ""}${unit ? " has-unit" : ""}`} style={style}>
    {prefix ? <span className="unit-input-affix unit-input-prefix">{prefix}</span> : null}
    <input {...inputProps} />
    {unit ? <span className="unit-input-affix unit-input-unit">{unit}</span> : null}
  </span>;
}
