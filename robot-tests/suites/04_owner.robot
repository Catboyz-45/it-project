*** Settings ***
Documentation     OWNER FUNCTION — แดชบอร์ด ห้องพัก ผู้เช่า สัญญา มิเตอร์ บิล งานแจ้งซ่อม พัสดุ ประกาศ และตั้งค่าหอ
Metadata          Sheet    Test UI เจ้าของหอ
Metadata          Pre-condition    1. เปิด Chrome แล้วเข้า ${BASE_URL}/login\n2. เข้าสู่ระบบด้วยบัญชีเจ้าของหอ robot.owner@nestly.test (ดูแลหอพักทดลอง 10 ห้อง ผู้เช่า 3 คน)
Resource          ../common.robot
Suite Setup       Run Keywords    Open Test Browser    AND    Login As Owner
Suite Teardown    Close All Browsers
Test Teardown     Capture Evidence


*** Variables ***
# ตรวจที่ปุ่มของแถวที่มองเห็น ไม่ใช่ข้อความทั้งหน้า เพราะข้อมูลตั้งต้นที่ซ่อนในหน้ายังมีชื่อทุกคนอยู่
${TENANT_ROW}       xpath://main//button[starts-with(@aria-label,"ดูข้อมูล${SPACE}
${INVOICE_ROW}      xpath://main//button[starts-with(@aria-label,"จัดการบิล${SPACE}


*** Test Cases ***
TC-OWN-001 แดชบอร์ดของหอ
    [Documentation]    Section: แดชบอร์ด
    ...    Function: ภาพรวมหอ
    ...    Desc: แดชบอร์ดต้องแสดงภาพรวมธุรกิจ งานที่ต้องทำ สถานะห้อง และบิลที่ต้องตาม
    ...    Type: P
    ...    Data: -
    ...    Steps: 1. เปิดหน้าแดชบอร์ดของหอ
    ...    Expected: เห็น "ภาพรวมธุรกิจ" "งานที่ต้องทำ" "สถานะห้อง" และ "บิลที่ต้องตาม"
    Go To Page    ${OWNER_HOME}
    Wait Until Page Contains    ภาพรวมธุรกิจ
    Page Should Contain    งานที่ต้องทำ
    Page Should Contain    สถานะห้อง
    Page Should Contain    บิลที่ต้องตาม
    Record Actual    แสดงภาพรวมธุรกิจ งานที่ต้องทำ สถานะห้อง และบิลที่ต้องตามครบ

TC-OWN-002 ผังห้องกรองตามชั้น
    [Documentation]    Section: ผังห้องพัก
    ...    Function: กรองตามชั้น
    ...    Desc: กดชั้น 2 แล้วต้องเห็นเฉพาะห้องชั้น 2
    ...    Type: P
    ...    Data: ชั้น 2 (ห้อง 201–205)
    ...    Steps: 1. เปิด "ผังห้องพัก"\n2. กด "ชั้น 2"
    ...    Expected: เห็นห้อง 201 และไม่เห็นห้อง 101
    Go To Page    ${OWNER_HOME}/rooms
    Wait Until Page Contains    ห้องทั้งหมด
    Click Button With Text    ชั้น 2
    Wait Until Page Contains Element    xpath://button[starts-with(@aria-label,"เปิดหน้าจัดการห้อง 201")]
    Page Should Not Contain Element    xpath://button[starts-with(@aria-label,"เปิดหน้าจัดการห้อง 101")]
    Record Actual    แสดงเฉพาะห้องชั้น 2 (มี 201 ไม่มี 101)

TC-OWN-003 สลับผังห้องเป็นตาราง
    [Documentation]    Section: ผังห้องพัก
    ...    Function: มุมมองตาราง
    ...    Desc: กดมุมมอง "ตาราง" แล้วต้องเห็นห้องในรูปตาราง
    ...    Type: P
    ...    Data: -
    ...    Steps: 1. เปิด "ผังห้องพัก"\n2. กด "ตาราง"
    ...    Expected: แสดงตารางห้อง มีหัวคอลัมน์และห้อง 101
    Go To Page    ${OWNER_HOME}/rooms
    Click Element    xpath://*[(@role="tab" or self::button) and normalize-space(.)="ตาราง"]
    Wait Until Page Contains Element    css:table
    Element Should Contain    css:table    101
    Record Actual    สลับเป็นตารางได้ และแสดงห้อง 101

TC-OWN-004 เปิดรายละเอียดห้อง
    [Documentation]    Section: ผังห้องพัก
    ...    Function: รายละเอียดห้อง
    ...    Desc: กดการ์ดห้อง 101 แล้วต้องเห็นข้อมูลห้องและผู้เช่า
    ...    Type: P
    ...    Data: ห้อง 101 (มีผู้เช่า)
    ...    Steps: 1. เปิด "ผังห้องพัก"\n2. กดห้อง 101
    ...    Expected: เปิดรายละเอียดห้อง 101 และเห็นชื่อผู้เช่า "สมชาย ใจดี"
    Go To Page    ${OWNER_HOME}/rooms
    Click Element    xpath://button[starts-with(@aria-label,"เปิดหน้าจัดการห้อง 101")]
    Wait Until Page Contains    ${TENANT_NAME}
    Record Actual    เปิดรายละเอียดห้อง 101 แสดงผู้เช่า "${TENANT_NAME}"

TC-OWN-005 รายชื่อผู้เช่าและการค้นหา
    [Documentation]    Section: ผู้เช่า
    ...    Function: ค้นหาผู้เช่า
    ...    Desc: ค้นหาชื่อผู้เช่าแล้วต้องเหลือเฉพาะคนที่ตรง
    ...    Type: P
    ...    Data: คำค้น : สุดา
    ...    Steps: 1. เปิด "ผู้เช่า"\n2. พิมพ์ "สุดา" ในช่องค้นหา
    ...    Expected: เห็น "สุดา สุขใจ" และไม่เห็น "วิชัย ตั้งใจ"
    Go To Page    ${OWNER_HOME}/tenants
    Wait Until Page Contains Element    ${TENANT_ROW}วิชัย ตั้งใจ")]
    Input Text    css:input[placeholder^="ค้นหาชื่อ ห้อง"]    สุดา
    Wait Until Page Does Not Contain Element    ${TENANT_ROW}วิชัย ตั้งใจ")]
    Page Should Contain Element    ${TENANT_ROW}สุดา สุขใจ")]
    Record Actual    ค้นหา "สุดา" เหลือ "สุดา สุขใจ" คนเดียว

TC-OWN-006 ค้นหาผู้เช่าที่ไม่มีอยู่
    [Documentation]    Section: ผู้เช่า
    ...    Function: ค้นหาผู้เช่า
    ...    Desc: ค้นหาคำที่ไม่ตรงกับใคร ต้องเห็นข้อความว่าไม่พบ
    ...    Type: N
    ...    Data: คำค้น : ไม่มีคนนี้แน่นอน
    ...    Steps: 1. เปิด "ผู้เช่า"\n2. พิมพ์คำค้นที่ไม่มีอยู่
    ...    Expected: ไม่มีรายชื่อ และแสดงข้อความว่าไม่พบ
    Go To Page    ${OWNER_HOME}/tenants
    Wait Until Page Contains Element    ${TENANT_ROW}สมชาย ใจดี")]
    Input Text    css:input[placeholder^="ค้นหาชื่อ ห้อง"]    ไม่มีคนนี้แน่นอน
    Wait Until Page Does Not Contain Element    ${TENANT_ROW}")]
    Wait Until Element Is Visible    xpath://main//*[contains(normalize-space(.),"ไม่พบ") and not(*)]
    Record Actual    ไม่มีรายชื่อ และแสดงข้อความว่าไม่พบ

TC-OWN-007 ดูข้อมูลผู้เช่า
    [Documentation]    Section: ผู้เช่า
    ...    Function: รายละเอียดผู้เช่า
    ...    Desc: กดดูข้อมูลผู้เช่าแล้วต้องเห็นข้อมูลติดต่อและห้อง
    ...    Type: P
    ...    Data: ผู้เช่า วิชัย ตั้งใจ ห้อง 202
    ...    Steps: 1. เปิด "ผู้เช่า"\n2. กด "ดูข้อมูล วิชัย ตั้งใจ"
    ...    Expected: เปิดหน้าต่างข้อมูลผู้เช่า แสดงชื่อและห้อง 202
    Go To Page    ${OWNER_HOME}/tenants
    Click Element    xpath://button[starts-with(@aria-label,"ดูข้อมูล วิชัย ตั้งใจ")]
    Wait Until Element Is Visible    ${DIALOG}
    Element Should Contain    ${DIALOG}    วิชัย ตั้งใจ
    Element Should Contain    ${DIALOG}    202
    Press Keys    None    ESCAPE
    Record Actual    เปิดข้อมูลผู้เช่า "วิชัย ตั้งใจ" ห้อง 202

TC-OWN-008 รายการสัญญาเช่า
    [Documentation]    Section: สัญญาเช่า
    ...    Function: รายการสัญญา
    ...    Desc: หน้าสัญญาต้องแสดงสัญญาที่ใช้งานอยู่ของทุกห้อง
    ...    Type: P
    ...    Data: CTR-DEMO-101, CTR-DEMO-202
    ...    Steps: 1. เปิด "สัญญาเช่า"
    ...    Expected: เห็นสัญญา CTR-DEMO-101 และ CTR-DEMO-202 พร้อมปุ่ม "สร้างสัญญา"
    Go To Page    ${OWNER_HOME}/contracts
    Wait Until Page Contains    CTR-DEMO-101
    Page Should Contain    CTR-DEMO-202
    Page Should Contain Element    xpath://button[normalize-space(.)="สร้างสัญญา"]
    Record Actual    แสดงสัญญา CTR-DEMO-101 และ CTR-DEMO-202 พร้อมปุ่มสร้างสัญญา

TC-OWN-009 บันทึกมิเตอร์โดยยังไม่กรอกเลข
    [Documentation]    Section: ค่าน้ำและค่าไฟ
    ...    Function: บันทึกมิเตอร์น้ำ
    ...    Desc: ยังไม่กรอกเลขมิเตอร์ห้องไหนเลย ต้องกดบันทึกไม่ได้
    ...    Type: N
    ...    Data: ไม่กรอกเลขมิเตอร์
    ...    Steps: 1. เปิด "มิเตอร์น้ำ"\n2. ดูปุ่มบันทึก
    ...    Expected: ปุ่ม "ตรวจสอบและบันทึก 0 ห้อง" กดไม่ได้ และบอกให้กรอกเลขก่อน
    Go To Page    ${OWNER_HOME}/meters/water
    Wait Until Page Contains Element    xpath://button[contains(normalize-space(.),"ตรวจสอบและบันทึก 0 ห้อง")]
    Element Should Be Disabled    xpath://button[contains(normalize-space(.),"ตรวจสอบและบันทึก 0 ห้อง")]
    Page Should Contain    กรอกเลขมิเตอร์ล่าสุดอย่างน้อย 1 ห้องก่อน
    Record Actual    ปุ่มบันทึกกดไม่ได้ และแจ้ง "กรอกเลขมิเตอร์ล่าสุดอย่างน้อย 1 ห้องก่อน"

TC-OWN-010 กรอกเลขมิเตอร์แล้วปุ่มบันทึกนับห้อง
    [Documentation]    Section: ค่าน้ำและค่าไฟ
    ...    Function: บันทึกมิเตอร์น้ำ
    ...    Desc: กรอกเลขมิเตอร์ใหม่หนึ่งห้อง ปุ่มบันทึกต้องนับเป็น 1 ห้องและกดได้
    ...    Type: P
    ...    Data: เลขใหม่ห้องแรก : เลขเริ่ม + 12
    ...    Steps: 1. เปิด "มิเตอร์น้ำ"\n2. กรอกช่อง "เลขใหม่" ของห้องแรก
    ...    Expected: ปุ่มเปลี่ยนเป็น "ตรวจสอบและบันทึก 1 ห้อง" และกดได้
    Go To Page    ${OWNER_HOME}/meters/water
    Wait Until Page Contains Element    css:input[placeholder="เลขใหม่"]
    ${start}=    Execute Javascript    const s = document.querySelector('input[placeholder="เลขเริ่ม"]'); return Number(s.value || s.placeholder.replace(/\\D/g, '') || 0);
    ${next}=    Evaluate    int(${start}) + 12
    Input Text    css:input[placeholder="เลขใหม่"]    ${next}
    Wait Until Page Contains Element    xpath://button[contains(normalize-space(.),"ตรวจสอบและบันทึก 1 ห้อง")]
    Element Should Be Enabled    xpath://button[contains(normalize-space(.),"ตรวจสอบและบันทึก 1 ห้อง")]
    Record Actual    กรอกเลขใหม่ ${next} แล้วปุ่มเปลี่ยนเป็น "ตรวจสอบและบันทึก 1 ห้อง" และกดได้

TC-OWN-011 รายการบิลและค้นหาบิล
    [Documentation]    Section: บิลและการเงิน
    ...    Function: ค้นหาบิล
    ...    Desc: ค้นหาเลขบิลแล้วต้องเหลือเฉพาะบิลของห้องนั้น
    ...    Type: P
    ...    Data: คำค้น : INV-DEMO-202
    ...    Steps: 1. เปิด "บิลและการเงิน"\n2. พิมพ์ "INV-DEMO-202"
    ...    Expected: เห็นบิล INV-DEMO-202-* และไม่เห็น INV-DEMO-101-*
    Go To Page    ${OWNER_HOME}/invoices
    Wait Until Page Contains Element    ${INVOICE_ROW}INV-DEMO-101-3")]
    Input Text    css:input[placeholder^="ค้นหาเลขที่บิล"]    INV-DEMO-202
    Wait Until Page Does Not Contain Element    ${INVOICE_ROW}INV-DEMO-101")]
    Page Should Contain Element    ${INVOICE_ROW}INV-DEMO-202-3")]
    Record Actual    ค้นหา "INV-DEMO-202" เหลือเฉพาะบิลห้อง 202

TC-OWN-012 ส่งออกรายการบิลเป็น CSV
    [Documentation]    Section: บิลและการเงิน
    ...    Function: ส่งออก CSV
    ...    Desc: ลิงก์ส่งออก CSV ต้องได้ไฟล์ CSV จริง
    ...    Type: P
    ...    Data: -
    ...    Steps: 1. เปิด "บิลและการเงิน"\n2. เรียกลิงก์ "ส่งออก CSV"
    ...    Expected: ได้สถานะ 200 และเนื้อหาเป็น text/csv
    Go To Page    ${OWNER_HOME}/invoices
    ${href}=    Get Element Attribute    xpath://a[contains(normalize-space(.),"ส่งออก CSV")]    href
    ${result}=    Execute Async Javascript
    ...    const done = arguments[arguments.length - 1];
    ...    fetch(arguments[0], { credentials: 'same-origin' }).then(async (r) => done([r.status, r.headers.get('content-type') || ''])).catch(() => done([0, '']));
    ...    ARGUMENTS    ${href}
    Should Be Equal As Integers    ${result}[0]    200
    Should Contain    ${result}[1]    text/csv
    Record Actual    ได้สถานะ ${result}[0] ชนิด ${result}[1]

TC-OWN-013 ตอบกลับเรื่องแจ้งซ่อมของผู้เช่า
    [Documentation]    Section: แจ้งซ่อม/ร้องเรียน
    ...    Function: ตอบกลับเรื่องแจ้ง
    ...    Desc: เจ้าของหอเปิดข้อความของเรื่องที่ผู้เช่าแจ้ง แล้วตอบกลับได้
    ...    Type: P
    ...    Data: เรื่อง : ไฟห้องน้ำกะพริบ\nข้อความ : รับเรื่องแล้วครับ จะเข้าไปดูพรุ่งนี้ (โรบอท <เลขรอบ>)
    ...    Steps: 1. เปิด "แจ้งซ่อม/ร้องเรียน"\n2. กดเมนูจัดการของเรื่อง\n3. กด "เปิดข้อความ"\n4. พิมพ์ข้อความแล้วกดส่ง
    ...    Expected: ข้อความตอบกลับขึ้นในกล่องข้อความของเรื่องนั้น
    ${suffix}=    Unique Suffix
    ${reply}=    Set Variable    รับเรื่องแล้วครับ จะเข้าไปดูพรุ่งนี้ (โรบอท ${suffix})
    Go To Page    ${OWNER_HOME}/tickets
    Wait Until Page Contains Element    xpath://button[starts-with(@aria-label,"จัดการเรื่อง ไฟห้องน้ำกะพริบ")]
    Click Element    xpath://button[starts-with(@aria-label,"จัดการเรื่อง ไฟห้องน้ำกะพริบ")]
    Wait Until Element Is Visible    xpath://*[@role="menuitem" and contains(normalize-space(.),"เปิดข้อความ")]
    Click Element    xpath://*[@role="menuitem" and contains(normalize-space(.),"เปิดข้อความ")]
    Wait Until Element Is Visible    css:input[placeholder="พิมพ์ข้อความตอบกลับ..."]
    Input Text    css:input[placeholder="พิมพ์ข้อความตอบกลับ..."]    ${reply}
    Click Element    xpath://input[@placeholder="พิมพ์ข้อความตอบกลับ..."]/ancestor::form//button[@type="submit"]
    Wait Until Element Is Visible    xpath://main//*[contains(normalize-space(.),"${reply}") and not(self::input) and not(*)]
    Record Actual    ตอบกลับเรื่อง "ไฟห้องน้ำกะพริบ" สำเร็จ ข้อความขึ้นในกล่องข้อความ

TC-OWN-014 รับพัสดุเข้าหอ
    [Documentation]    Section: คลังพัสดุ
    ...    Function: รับพัสดุใหม่
    ...    Desc: บันทึกพัสดุใหม่ให้ห้อง 101 แล้วต้องขึ้นในรายการรอผู้เช่ารับ
    ...    Type: P
    ...    Data: ชั้น : ชั้น 1\nห้อง : ห้อง 101\nหมายเหตุ : กล่องโรบอท <เลขรอบ>
    ...    Steps: 1. เปิด "คลังพัสดุ"\n2. กด "รับพัสดุใหม่"\n3. เลือกชั้นและห้อง กรอกหมายเหตุ\n4. กด "บันทึกพัสดุ"
    ...    Expected: ป็อปอัพปิด และจำนวน "รอผู้เช่ารับ" เพิ่มขึ้น
    ${suffix}=    Unique Suffix
    Go To Page    ${OWNER_HOME}/parcels
    Wait Until Page Contains    รอผู้เช่ารับ
    ${before}=    Get Element Count    xpath://button[starts-with(@aria-label,"จัดการพัสดุห้อง")]
    Click Button With Text    รับพัสดุใหม่
    Wait Until Element Is Visible    ${DIALOG}
    Input By Label    หมายเหตุ    กล่องโรบอท ${suffix}
    Click Dialog Button    บันทึกพัสดุ
    Wait Until Page Does Not Contain Element    ${DIALOG}
    Wait Until Keyword Succeeds    10x    1s    Parcel Count Should Be Greater Than    ${before}
    Record Actual    บันทึกพัสดุสำเร็จ รายการรอรับเพิ่มจาก ${before} รายการ

TC-OWN-015 สร้างประกาศถึงผู้เช่า
    [Documentation]    Section: ประกาศ/ข่าวสาร
    ...    Function: สร้างประกาศ
    ...    Desc: สร้างประกาศแบบเผยแพร่ทันที แล้วต้องขึ้นในรายการประกาศ
    ...    Type: P
    ...    Data: หัวข้อ : ทดสอบประกาศ (โรบอท <เลขรอบ>)\nเนื้อหา : ประกาศจากการทดสอบอัตโนมัติ\nการเผยแพร่ : เผยแพร่ทันที
    ...    Steps: 1. เปิด "ประกาศ/ข่าวสาร"\n2. กด "สร้างประกาศ"\n3. กรอกหัวข้อและเนื้อหา\n4. กด "สร้างประกาศ" ในป็อปอัพ
    ...    Expected: ป็อปอัพปิด และประกาศใหม่ขึ้นในรายการ
    ${suffix}=    Unique Suffix
    ${title}=    Set Variable    ทดสอบประกาศ (โรบอท ${suffix})
    Go To Page    ${OWNER_HOME}/announcements
    Click Element    xpath://button[normalize-space(.)="สร้างประกาศ" and not(ancestor::*[@role="dialog"])]
    Wait Until Element Is Visible    ${DIALOG}
    Input By Label    หัวข้อประกาศ    ${title}
    Input By Label    เนื้อหาประกาศ    ประกาศจากการทดสอบอัตโนมัติ
    Click Dialog Button    สร้างประกาศ
    Wait Until Page Does Not Contain Element    ${DIALOG}
    Wait Until Page Contains    ${title}
    Record Actual    สร้างประกาศ "${title}" สำเร็จ และขึ้นในรายการ

TC-OWN-016 สร้างประกาศโดยไม่กรอกหัวข้อ
    [Documentation]    Section: ประกาศ/ข่าวสาร
    ...    Function: ตรวจข้อมูลก่อนส่ง
    ...    Desc: ไม่กรอกหัวข้อประกาศ ต้องสร้างไม่ได้
    ...    Type: N
    ...    Data: หัวข้อ : (ว่าง)\nเนื้อหา : ไม่มีหัวข้อ
    ...    Steps: 1. กด "สร้างประกาศ"\n2. กรอกเฉพาะเนื้อหา\n3. กด "สร้างประกาศ" ในป็อปอัพ
    ...    Expected: ป็อปอัพยังเปิดอยู่ และแจ้งให้กรอกหัวข้อ
    Go To Page    ${OWNER_HOME}/announcements
    Click Element    xpath://button[normalize-space(.)="สร้างประกาศ" and not(ancestor::*[@role="dialog"])]
    Wait Until Element Is Visible    ${DIALOG}
    Input By Label    เนื้อหาประกาศ    ไม่มีหัวข้อ
    Click Dialog Button    สร้างประกาศ
    Sleep    1s
    Element Should Be Visible    ${DIALOG}
    ${field}=    Field By Label    หัวข้อประกาศ
    ${message}=    Execute Javascript    return arguments[0].validationMessage || [...document.querySelectorAll('[role=dialog] [role=alert], [role=dialog] .form-alert')].map((e) => e.innerText.trim()).join(' ');    ARGUMENTS    ${field}
    Should Not Be Empty    ${message}
    Click Dialog Button    ยกเลิก
    Record Actual    สร้างไม่ได้ และแจ้ง "${message}"

TC-OWN-017 แท็บตั้งค่าหอเปิดได้ครบ
    [Documentation]    Section: ตั้งค่าหอ
    ...    Function: เมนูตั้งค่า
    ...    Desc: ทุกแท็บในหน้าตั้งค่าหอต้องเปิดได้
    ...    Type: P
    ...    Data: ข้อมูลหอ, ค่าใช้จ่าย, รอบบิล, ห้องพัก, เฟอร์นิเจอร์และทรัพย์สิน, เอกสาร, คำเชิญผู้เช่า, แพ็กเกจและการต่ออายุ
    ...    Steps: 1. เปิด "ตั้งค่าหอ"\n2. กดทีละแท็บ
    ...    Expected: ทุกแท็บเปิดได้ หัวข้อเปลี่ยนตามแท็บ และไม่มีหน้าข้อผิดพลาด
    Go To Page    ${OWNER_HOME}/settings
    FOR    ${tab}    IN    ค่าใช้จ่าย    รอบบิล    ห้องพัก    เฟอร์นิเจอร์และทรัพย์สิน    เอกสาร    คำเชิญผู้เช่า    แพ็กเกจและการต่ออายุ    ข้อมูลหอ
        Click Button With Text    ${tab}
        Wait Until Element Contains    css:main h2    ${tab}
        Page Should Not Contain    เกิดข้อผิดพลาด
    END
    Record Actual    เปิดได้ครบ 8 แท็บ หัวข้อเปลี่ยนตามแท็บทุกครั้ง

TC-OWN-018 สร้างรหัสเชิญผู้เช่า
    [Documentation]    Section: ตั้งค่าหอ
    ...    Function: คำเชิญผู้เช่า
    ...    Desc: สร้างรหัสเชิญสำหรับห้องว่าง แล้วต้องได้รหัสไปให้ผู้เช่าสมัคร
    ...    Type: P
    ...    Data: ห้อง : ห้องว่างที่ระบบเลือกไว้\nรูปแบบ : ผู้เช่าหลัก\nอายุรหัส : 7 วัน\nอีเมล : (ไม่กรอก)
    ...    Steps: 1. เปิด "คำเชิญผู้เช่า"\n2. ใช้ห้องที่ระบบเลือกไว้\n3. กด "สร้างคำเชิญ"
    ...    Expected: แสดงรหัสเชิญที่สร้างใหม่พร้อมปุ่มคัดลอก และขึ้นในประวัติคำเชิญว่า "รอรับคำเชิญ"
    ...    Remark: รหัสแสดงครั้งเดียว ระบบเก็บเฉพาะค่า hash
    Go To Page    ${OWNER_HOME}/invitations
    Wait Until Page Contains    สร้างคำเชิญผู้เช่า
    Click Button With Text    สร้างคำเชิญ
    Wait Until Page Contains    สร้างคำเชิญแล้ว กรุณาคัดลอกรหัสและส่งให้ผู้เช่า
    Page Should Contain    รหัสคำเชิญที่สร้างใหม่
    Page Should Contain Element    xpath://button[normalize-space(.)="คัดลอกรหัส"]
    Page Should Contain    รอรับคำเชิญ
    Record Actual    แจ้ง "สร้างคำเชิญแล้ว กรุณาคัดลอกรหัสและส่งให้ผู้เช่า" มีปุ่มคัดลอกรหัส และขึ้นในประวัติว่า "รอรับคำเชิญ"

TC-OWN-019 ค้นหาทั้งหอจากแถบด้านบน
    [Documentation]    Section: แถบด้านบน
    ...    Function: ค้นหาทั้งหอ
    ...    Desc: พิมพ์ชื่อผู้เช่าในช่องค้นหาทั้งหอ แล้วต้องเห็นผลลัพธ์ที่ตรง
    ...    Type: P
    ...    Data: คำค้น : สมชาย
    ...    Steps: 1. พิมพ์ "สมชาย" ในช่อง "ค้นหาผู้เช่า ห้อง บิล สัญญา"
    ...    Expected: มีรายการผลค้นหาที่มีชื่อ "สมชาย ใจดี"
    Go To Page    ${OWNER_HOME}
    Input Text    css:input[placeholder="ค้นหาผู้เช่า ห้อง บิล สัญญา"]    สมชาย
    Wait Until Element Is Visible    xpath://a[.//strong[contains(normalize-space(.),"สมชาย ใจดี")]]
    Record Actual    ผลค้นหามี "สมชาย ใจดี"


*** Keywords ***
Parcel Count Should Be Greater Than
    [Arguments]    ${before}
    ${after}=    Get Element Count    xpath://button[starts-with(@aria-label,"จัดการพัสดุห้อง")]
    Should Be True    ${after} > ${before}
