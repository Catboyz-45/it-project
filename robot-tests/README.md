# ทดสอบ Nestly ด้วย Robot Framework

ทดสอบหน้าจอจริงผ่าน Chrome ทั้ง 3 บทบาท (ผู้ดูแลระบบ เจ้าของหอ ผู้เช่า) รวม 71 กรณี
รันกับเว็บในเครื่องและฐานข้อมูลทดสอบที่แยกไว้ ไม่แตะเว็บจริง

| ไฟล์ | ชีตในรายงาน | จำนวน |
| --- | --- | --- |
| `suites/01_public_login.robot`, `02_public_pages.robot` | Test UI หน้าสาธารณะ | 16 |
| `suites/03_tenant.robot` | Test UI ผู้เช่า | 12 |
| `suites/04_owner.robot` | Test UI เจ้าของหอ | 19 |
| `suites/05_super_admin.robot` | Test UI ผู้ดูแลระบบ | 13 |
| `suites/06_access_control.robot`, `07_responsive.robot` | Test สิทธิ์และมือถือ | 11 |

## ติดตั้งครั้งแรก

ต้องมี Google Chrome และ Python 3 วาง venv ไว้นอกโปรเจกต์
เพราะ Next.js เฝ้าไฟล์ทั้งโฟลเดอร์ ถ้า venv อยู่ในโปรเจกต์หน้าเว็บจะรีโหลดวนไม่หยุด

```bash
python3 -m venv ~/.venvs/nestly-robot
```

```bash
~/.venvs/nestly-robot/bin/pip install robotframework robotframework-seleniumlibrary openpyxl pillow
```

## รันทดสอบ

1. สร้างฐานข้อมูลทดสอบเปล่า ชื่อต้องมีคำว่า `test` แล้วตั้ง `DATABASE_URL` ชี้ไปที่ฐานนั้น
2. ใส่ข้อมูลเดโมและบัญชีทดสอบ (ค่าอยู่ใน `robot.env`):

```bash
DATABASE_URL="postgresql://USER:PASS@127.0.0.1:55432/nestly_robot_test" robot-tests/prepare.sh
```

3. เปิดเว็บทดสอบที่พอร์ต 3400 ทิ้งไว้อีกหน้าต่าง:

```bash
DATABASE_URL="postgresql://USER:PASS@127.0.0.1:55432/nestly_robot_test" robot-tests/start-app.sh
```

4. รันทุกชุด แล้วสร้างไฟล์สรุป:

```bash
robot-tests/run.sh
```

ผลอยู่ที่ `robot-tests/results/`

- `ผลการทดสอบ_TestCase.xlsx` ไฟล์สรุปผลแยกชีตตามบทบาท
- `report.html`, `log.html`, `output.xml` ผลจาก Robot Framework
- `screenshots/` ภาพหน้าจอท้ายทุกกรณี ตั้งชื่อตามรหัสกรณี

กรณีทดสอบบางข้อสร้างข้อมูลใหม่ (ประกาศ พัสดุ แพ็กเกจ หอ) โดยใส่ "โรบอท" และเลขเวลาที่รันไว้ในชื่อ
รันซ้ำได้โดยไม่ต้องล้างฐานข้อมูล ถ้าอยากได้ผลจากสภาพเริ่มต้นให้สร้างฐานข้อมูลใหม่แล้วรัน `prepare.sh` อีกครั้ง

## แก้หรือเพิ่มกรณีทดสอบ

รายละเอียดที่ขึ้นในไฟล์ Excel อ่านจาก `[Documentation]` ของแต่ละกรณีในไฟล์ `.robot`
(`Section` `Function` `Desc` `Type` `Data` `Steps` `Expected` `Remark`) แก้ที่ไฟล์ `.robot` แล้วรัน `run.sh` ใหม่
ชีตที่กรณีไปอยู่มาจาก `Metadata    Sheet` ของไฟล์นั้น
