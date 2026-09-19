import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "tertiary" | "danger" | "icon";
export type ButtonSize = "sm" | "md" | "lg";

// ตัด aria-label ออกจาก prop มาตรฐาน แล้วค่อยกำหนดใหม่ข้างล่างให้บังคับเฉพาะปุ่มไอคอน
type SharedButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> & {
  isLoading?: boolean;
  // ข้อความแทนระหว่างกำลังทำงาน ปุ่มไอคอนจะซ่อนไว้ให้โปรแกรมอ่านหน้าจอเท่านั้น
  loadingLabel?: string;
  size?: ButtonSize;
};

// ปุ่มไอคอนไม่มีข้อความให้อ่าน จึงบังคับ aria-label ตั้งแต่ตอนคอมไพล์ ไม่ใช่ไปเจอตอนทดสอบ
type IconButtonProps = SharedButtonProps & {
  "aria-label": string;
  children: ReactNode;
  variant: "icon";
};

// ปุ่มปกติมีข้อความอยู่แล้ว aria-label จึงเป็นของเสริม
type StandardButtonProps = SharedButtonProps & {
  "aria-label"?: string;
  variant?: Exclude<ButtonVariant, "icon">;
};

// union สองแบบ ทำให้ TypeScript เลือกกฎตาม variant ที่ส่งมา
export type ButtonProps = IconButtonProps | StandardButtonProps;

// ต่อคลาสโดยทิ้งค่า undefined และ false ทิ้ง จะได้ไม่มีช่องว่างเกินใน class
function joinClassNames(...classNames: Array<string | undefined | false>) {
  return classNames.filter(Boolean).join(" ");
}

// forwardRef เพราะบางที่ต้องสั่งโฟกัสปุ่มนี้จากภายนอก เช่น หลังปิดกล่องโต้ตอบ
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    children,
    className,
    disabled = false,
    isLoading = false,
    loadingLabel = "กำลังดำเนินการ...",
    size = "md",
    // ตั้ง button เป็นค่าเริ่มต้น กัน submit ฟอร์มโดยไม่ตั้งใจ
    type = "button",
    variant = "primary",
    ...props
  },
  ref,
) {
  const iconOnly = variant === "icon";

  return (
    <button
      {...props}
      // undefined เพื่อไม่ให้ attribute โผล่ใน DOM ตอนไม่ได้โหลด
      aria-busy={isLoading || undefined}
      className={joinClassNames(
        "app-button",
        `app-button--${variant}`,
        `app-button--${size}`,
        isLoading && "app-button--loading",
        className,
      )}
      // ปิดปุ่มตอนโหลดด้วย กันกดซ้ำแล้วส่งข้อมูลสองรอบ
      disabled={disabled || isLoading}
      ref={ref}
      type={type}
    >
      {isLoading ? (
        <>
          <span aria-hidden="true" className="app-button__spinner" />
          {/* ปุ่มไอคอนแคบเกินใส่ข้อความ จึงซ่อนไว้ให้โปรแกรมอ่านหน้าจอรู้ว่ากำลังทำงาน */}
          {iconOnly ? <span className="sr-only">{loadingLabel}</span> : <span>{loadingLabel}</span>}
        </>
      ) : children}
    </button>
  );
});
