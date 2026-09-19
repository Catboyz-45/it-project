// Tailwind v4 ทำงานเป็นปลั๊กอินของ PostCSS ไม่ต้องมีไฟล์ tailwind.config แยกอีกแล้ว
const postcssConfig = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default postcssConfig;
