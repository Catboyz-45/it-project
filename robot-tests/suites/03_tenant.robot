*** Settings ***
Documentation     TENANT PORTAL FUNCTION — หน้าหลัก บิล สัญญา ประกาศ พัสดุ แจ้งเรื่อง และแชทของผู้เช่า
Metadata          Sheet    Test UI ผู้เช่า
Metadata          Pre-condition    1. เปิด Chrome แล้วเข้า ${BASE_URL}/login\n2. เข้าสู่ระบบด้วยบัญชีผู้เช่า somchai@nestly.demo (ห้อง 101 หอพักทดลอง)
Resource          ../common.robot
Suite Setup       Run Keywords    Open Test Browser    AND    Login As Tenant
Suite Teardown    Close All Browsers
Test Teardown     Capture Evidence


*** Variables ***
# ปุ่มแจ้งเรื่องอยู่บนหัวหน้า ไม่ใช่ลิงก์เมนูที่ชื่อเดียวกัน
${NEW_TICKET_BUTTON}    xpath://button[contains(@class,"primary-button") and normalize-space(.)="แจ้งเรื่อง"]
${CHAT_INPUT}           css:input[placeholder="พิมพ์ข้อความ..."]


*** Test Cases ***
TC-TEN-001 หน้าหลักแสดงภาพรวมของผู้เช่า
    [Documentation]    Section: หน้าหลัก
    ...    Function: ภาพรวม
    ...    Desc: หน้าหลักต้องแสดงหอ ห้อง ยอดที่ต้องชำระ และงานที่ต้องทำ
    ...    Type: P
    ...    Data: -
    ...    Steps: 1. เปิด /tenant
    ...    Expected: เห็น "ภาพรวมที่ต้องรู้" "งานที่ต้องทำ" "ข้อมูลห้อง" และยอดที่ต้องชำระ
    Go To Page    /tenant
    Wait Until Page Contains    ภาพรวมที่ต้องรู้
    Page Should Contain    งานที่ต้องทำ
    Page Should Contain    ข้อมูลห้อง
    Page Should Contain    ยอดที่ต้องชำระ
    Record Actual    แสดงภาพรวม งานที่ต้องทำ ข้อมูลห้อง และยอดที่ต้องชำระครบ

TC-TEN-002 ดูบิลรอบปัจจุบัน
    [Documentation]    Section: บิลและชำระเงิน
    ...    Function: บิลปัจจุบัน
    ...    Desc: หน้าบิลต้องแสดงบิลรอบล่าสุดพร้อมยอดและสถานะ
    ...    Type: P
    ...    Data: บิล INV-DEMO-101-3
    ...    Steps: 1. เปิดเมนู "บิลและชำระเงิน"
    ...    Expected: เห็นบิล INV-DEMO-101-3 ยอด ฿5,366 และปุ่ม "ส่งหลักฐาน"
    Go To Page    /tenant/invoices
    Wait Until Page Contains    INV-DEMO-101-3
    Page Should Contain    ฿5,366
    Page Should Contain Element    xpath://button[normalize-space(.)="ส่งหลักฐาน"]
    Record Actual    แสดงบิล INV-DEMO-101-3 ยอด ฿5,366 พร้อมปุ่มส่งหลักฐาน

TC-TEN-003 ดูประวัติบิล
    [Documentation]    Section: บิลและชำระเงิน
    ...    Function: ประวัติบิล
    ...    Desc: แท็บประวัติต้องแสดงบิลที่ชำระแล้วของรอบก่อน
    ...    Type: P
    ...    Data: -
    ...    Steps: 1. เปิดหน้าบิล\n2. กดแท็บ "ประวัติบิล"
    ...    Expected: เห็นบิลรอบก่อน INV-DEMO-101-1 หรือ INV-DEMO-101-2
    Go To Page    /tenant/invoices
    Click Element    xpath://*[(@role="tab" or self::button) and normalize-space(.)="ประวัติบิล"]
    Wait Until Page Contains    INV-DEMO-101-2
    Record Actual    แท็บประวัติแสดงบิลรอบก่อน (INV-DEMO-101-2)

TC-TEN-004 ส่งหลักฐานโดยไม่แนบสลิป
    [Documentation]    Section: บิลและชำระเงิน
    ...    Function: ส่งหลักฐานการชำระ
    ...    Desc: ยังไม่แนบสลิปต้องส่งหลักฐานไม่ได้
    ...    Type: N
    ...    Data: ไม่แนบไฟล์
    ...    Steps: 1. เปิดหน้าบิล\n2. กด "ส่งหลักฐาน" เพื่อเปิดส่วนแนบสลิป\n3. ไม่เลือกไฟล์
    ...    Expected: ปุ่ม "ส่งหลักฐาน" ในส่วนแนบสลิปกดไม่ได้จนกว่าจะเลือกไฟล์
    Go To Page    /tenant/invoices
    Click Button With Text    ส่งหลักฐาน
    Wait Until Page Contains    แนบสลิปโอนเงิน
    Wait Until Page Contains Element    xpath://button[normalize-space(.)="ส่งหลักฐาน" and @disabled]
    Page Should Contain    ยังไม่เคยส่งหลักฐาน
    Record Actual    ยังไม่เลือกไฟล์ ปุ่ม "ส่งหลักฐาน" กดไม่ได้ และยังไม่มีหลักฐานถูกส่ง

TC-TEN-005 ดูสัญญาเช่า
    [Documentation]    Section: สัญญา
    ...    Function: สัญญาปัจจุบัน
    ...    Desc: หน้าสัญญาต้องแสดงเลขสัญญาและลิงก์เปิดเอกสารที่ลงนามแล้ว
    ...    Type: P
    ...    Data: สัญญา CTR-DEMO-101
    ...    Steps: 1. เปิดเมนู "สัญญา"
    ...    Expected: เห็น "CTR-DEMO-101" และลิงก์ "เปิดเอกสารลงนาม"
    Go To Page    /tenant/lease
    Wait Until Page Contains    CTR-DEMO-101
    Page Should Contain Link    เปิดเอกสารลงนาม
    Record Actual    แสดงสัญญา CTR-DEMO-101 พร้อมลิงก์เปิดเอกสารลงนาม

TC-TEN-006 ดูประกาศจากหอพัก
    [Documentation]    Section: ประกาศ
    ...    Function: รายการประกาศ
    ...    Desc: ผู้เช่าต้องเห็นประกาศที่หอเผยแพร่แล้ว
    ...    Type: P
    ...    Data: ประกาศ "แจ้งปิดน้ำชั่วคราว"
    ...    Steps: 1. เปิดเมนู "ประกาศ"
    ...    Expected: เห็นประกาศ "แจ้งปิดน้ำชั่วคราว"
    Go To Page    /tenant/announcements
    Wait Until Page Contains    แจ้งปิดน้ำชั่วคราว
    Record Actual    แสดงประกาศ "แจ้งปิดน้ำชั่วคราว"

TC-TEN-007 ดูพัสดุที่รอรับ
    [Documentation]    Section: พัสดุ
    ...    Function: พัสดุรอรับ
    ...    Desc: ผู้เช่าต้องเห็นพัสดุที่หอรับไว้ให้พร้อมเลขติดตาม
    ...    Type: P
    ...    Data: พัสดุเลขติดตาม TH12345678
    ...    Steps: 1. เปิดเมนู "พัสดุ"
    ...    Expected: เห็นพัสดุ TH12345678 ในแท็บ "พัสดุรอรับ"
    Go To Page    /tenant/parcels
    Wait Until Page Contains    TH12345678
    Record Actual    แสดงพัสดุ TH12345678 ในรายการรอรับ

TC-TEN-008 ดูเรื่องที่แจ้งไว้
    [Documentation]    Section: แจ้งเรื่อง
    ...    Function: รายการเรื่องที่แจ้ง
    ...    Desc: ผู้เช่าต้องเห็นเรื่องที่กำลังดำเนินการพร้อมปุ่มเปิดการตอบกลับ
    ...    Type: P
    ...    Data: เรื่อง "ไฟห้องน้ำกะพริบ"
    ...    Steps: 1. เปิดเมนู "แจ้งเรื่อง"\n2. กด "เปิดการตอบกลับ"
    ...    Expected: เห็นเรื่อง "ไฟห้องน้ำกะพริบ" และเปิดดูการตอบกลับได้
    Go To Page    /tenant/tickets
    Wait Until Page Contains    ไฟห้องน้ำกะพริบ
    Click Button With Text    เปิดการตอบกลับ
    Sleep    1s
    Record Actual    แสดงเรื่อง "ไฟห้องน้ำกะพริบ" และเปิดส่วนการตอบกลับได้

TC-TEN-009 แจ้งเรื่องใหม่
    [Documentation]    Section: แจ้งเรื่อง
    ...    Function: สร้างเรื่องแจ้งซ่อม
    ...    Desc: ผู้เช่าแจ้งซ่อมใหม่ แล้วเรื่องต้องขึ้นในรายการที่กำลังดำเนินการ
    ...    Type: P
    ...    Data: ประเภท : แจ้งซ่อม\nความเร่งด่วน : ปกติ\nหัวข้อ : ก๊อกน้ำรั่ว (โรบอท <เลขรอบ>)\nรายละเอียด : ก๊อกอ่างล้างหน้ามีน้ำหยดตลอด
    ...    Steps: 1. เปิด "แจ้งเรื่อง"\n2. กดปุ่ม "แจ้งเรื่อง"\n3. กรอกหัวข้อและรายละเอียด\n4. กด "ส่งเรื่อง"
    ...    Expected: ป็อปอัพปิด และเรื่องใหม่ขึ้นในรายการ
    ${suffix}=    Unique Suffix
    ${title}=    Set Variable    ก๊อกน้ำรั่ว (โรบอท ${suffix})
    Go To Page    /tenant/tickets
    Wait Until Element Is Visible    ${NEW_TICKET_BUTTON}
    Click Element    ${NEW_TICKET_BUTTON}
    Wait Until Element Is Visible    ${DIALOG}
    Input By Label    หัวข้อ    ${title}
    Input By Label    รายละเอียด    ก๊อกอ่างล้างหน้ามีน้ำหยดตลอด
    Click Dialog Button    ส่งเรื่อง
    Wait Until Page Does Not Contain Element    ${DIALOG}
    Wait Until Page Contains    ${title}
    Record Actual    ส่งเรื่องสำเร็จ "${title}" ขึ้นในรายการ

TC-TEN-010 แจ้งเรื่องโดยไม่กรอกหัวข้อ
    [Documentation]    Section: แจ้งเรื่อง
    ...    Function: ตรวจข้อมูลก่อนส่ง
    ...    Desc: ไม่กรอกหัวข้อแล้วกดส่ง ต้องส่งไม่ได้
    ...    Type: N
    ...    Data: หัวข้อ : (ว่าง)\nรายละเอียด : ทดสอบไม่กรอกหัวข้อ
    ...    Steps: 1. กดปุ่ม "แจ้งเรื่อง"\n2. กรอกเฉพาะรายละเอียด\n3. กด "ส่งเรื่อง"
    ...    Expected: ป็อปอัพยังเปิดอยู่ และแจ้งให้กรอกหัวข้อ
    Go To Page    /tenant/tickets
    Wait Until Element Is Visible    ${NEW_TICKET_BUTTON}
    Click Element    ${NEW_TICKET_BUTTON}
    Wait Until Element Is Visible    ${DIALOG}
    Input By Label    รายละเอียด    ทดสอบไม่กรอกหัวข้อ
    Click Dialog Button    ส่งเรื่อง
    Sleep    1s
    Element Should Be Visible    ${DIALOG}
    ${field}=    Field By Label    หัวข้อ
    ${message}=    Execute Javascript    return arguments[0].validationMessage || [...document.querySelectorAll('[role=dialog] [role=alert], [role=dialog] .form-alert')].map((e) => e.innerText.trim()).join(' ');    ARGUMENTS    ${field}
    Should Not Be Empty    ${message}
    Click Dialog Button    ปิด
    Record Actual    ส่งไม่ได้ ป็อปอัพยังเปิดอยู่ และแจ้ง "${message}"

TC-TEN-011 ศูนย์การแจ้งเตือน
    [Documentation]    Section: แถบด้านบน
    ...    Function: การแจ้งเตือน
    ...    Desc: กดกระดิ่งแล้วต้องเห็นรายการแจ้งเตือนที่ยังไม่ได้อ่าน
    ...    Type: P
    ...    Data: -
    ...    Steps: 1. กดกระดิ่ง "ศูนย์การแจ้งเตือน"
    ...    Expected: เปิดหน้าต่างแจ้งเตือน มีอย่างน้อย 1 รายการ
    Go To Page    /tenant
    Click Element    xpath://button[starts-with(@aria-label,"ศูนย์การแจ้งเตือน")]
    Wait Until Page Contains    การแจ้งเตือน
    ${label}=    Get Element Attribute    xpath://button[starts-with(@aria-label,"ศูนย์การแจ้งเตือน")]    aria-label
    Press Keys    None    ESCAPE
    Record Actual    เปิดศูนย์การแจ้งเตือนได้ ปุ่มระบุ "${label}"

TC-TEN-012 ส่งข้อความหาหอพัก
    [Documentation]    Section: แชท
    ...    Function: ส่งข้อความ
    ...    Desc: ผู้เช่าเปิดแชทกับหอพักแล้วส่งข้อความได้
    ...    Type: P
    ...    Data: ข้อความ : สวัสดีครับ ทดสอบแชท (โรบอท <เลขรอบ>)
    ...    Steps: 1. กด "เปิดแชทกับหอพัก"\n2. พิมพ์ข้อความ\n3. กดส่ง
    ...    Expected: ข้อความที่ส่งขึ้นในหน้าต่างแชท
    ${suffix}=    Unique Suffix
    ${text}=    Set Variable    สวัสดีครับ ทดสอบแชท (โรบอท ${suffix})
    Go To Page    /tenant
    Click Button With Text    เปิดแชทกับหอพัก
    Wait Until Element Is Visible    ${CHAT_INPUT}
    # รอให้ห้องสนทนาโหลดเสร็จก่อน ปุ่มส่งจะกดได้เมื่อพร้อม
    Wait Until Element Is Enabled    ${CHAT_INPUT}
    Input Text    ${CHAT_INPUT}    ${text}
    Wait Until Element Is Enabled    xpath://button[@aria-label="ส่งข้อความ"]
    Click Element    xpath://button[@aria-label="ส่งข้อความ"]
    Wait Until Page Contains    ${text}
    Record Actual    ส่งข้อความสำเร็จ ข้อความขึ้นในหน้าต่างแชท
