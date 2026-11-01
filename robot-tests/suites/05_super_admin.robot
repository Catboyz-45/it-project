*** Settings ***
Documentation     SUPER ADMIN FUNCTION — แดชบอร์ดแพลตฟอร์ม แพ็กเกจ หอพัก บัญชีเจ้าของหอ การชำระสมาชิก บันทึกการใช้งาน และตั้งค่าระบบ
Metadata          Sheet    Test UI ผู้ดูแลระบบ
Metadata          Pre-condition    1. เปิด Chrome แล้วเข้า ${BASE_URL}/login\n2. เข้าสู่ระบบด้วยบัญชีผู้ดูแลระบบ robot.super@nestly.test
Resource          ../common.robot
Suite Setup       Run Keywords    Open Test Browser    AND    Login As Super Admin
Suite Teardown    Close All Browsers
Test Teardown     Capture Evidence


*** Variables ***
${PROPERTY_LINK}    xpath://a[normalize-space(.)="เปิดดู"]


*** Test Cases ***
TC-ADM-001 แดชบอร์ดแพลตฟอร์ม
    [Documentation]    Section: แดชบอร์ด
    ...    Function: ภาพรวมแพลตฟอร์ม
    ...    Desc: แดชบอร์ดต้องแสดงภาพรวม งานที่ต้องทำ สมาชิก และการใช้งานจริง
    ...    Type: P
    ...    Data: -
    ...    Steps: 1. เปิด /super-admin
    ...    Expected: เห็น "ภาพรวมแพลตฟอร์ม" "งานที่ต้องทำ" "สมาชิก" "การใช้งานจริง" และ "รายได้ต่อเดือน (MRR)"
    Go To Page    /super-admin
    Wait Until Page Contains    ภาพรวมแพลตฟอร์ม
    FOR    ${text}    IN    งานที่ต้องทำ    สมาชิก    การใช้งานจริง    รายได้ต่อเดือน (MRR)
        Page Should Contain    ${text}
    END
    Record Actual    แสดงครบทั้ง 4 ส่วนพร้อม MRR

TC-ADM-002 สร้างแพ็กเกจใหม่
    [Documentation]    Section: แพ็กเกจ
    ...    Function: สร้างแพ็กเกจ
    ...    Desc: สร้างแพ็กเกจใหม่ แล้วต้องขึ้นในตารางพร้อมราคา และมีข้อความยืนยัน
    ...    Type: P
    ...    Data: รหัส : RB<เลขรอบ>\nชื่อ : แพ็กเกจโรบอท <เลขรอบ>\nรายเดือน : 199\nรายปี : 1990\nห้องสูงสุด : 20
    ...    Steps: 1. เปิด "แพ็กเกจ"\n2. กด "สร้างแพ็กเกจ"\n3. กรอกข้อมูล\n4. กด "บันทึก"
    ...    Expected: ขึ้นข้อความ "สร้างแพ็กเกจแล้ว" และแพ็กเกจใหม่อยู่ในตาราง ราคา ฿199
    ${suffix}=    Unique Suffix
    Set Suite Variable    ${PLAN_CODE}    RB${suffix}
    Set Suite Variable    ${PLAN_NAME}    แพ็กเกจโรบอท ${suffix}
    Go To Page    /super-admin/plans
    Click Button With Text    สร้างแพ็กเกจ
    Wait Until Element Is Visible    ${DIALOG}
    Input Text    css:[role=dialog] input[name=code]    ${PLAN_CODE}
    Input Text    css:[role=dialog] input[name=name]    ${PLAN_NAME}
    Input Text    css:[role=dialog] input[name=monthlyPrice]    199
    Input Text    css:[role=dialog] input[name=yearlyPrice]    1990
    Input Text    css:[role=dialog] input[name=maxRooms]    20
    Click Dialog Button    บันทึก
    Toast Should Say    สร้างแพ็กเกจแล้ว
    Wait Until Page Contains    ${PLAN_NAME}
    Page Should Contain    ฿199
    Record Actual    ขึ้น "สร้างแพ็กเกจแล้ว" และ "${PLAN_NAME}" อยู่ในตาราง ราคา ฿199

TC-ADM-003 สร้างแพ็กเกจรหัสซ้ำ
    [Documentation]    Section: แพ็กเกจ
    ...    Function: สร้างแพ็กเกจ
    ...    Desc: ใช้รหัสแพ็กเกจที่มีอยู่แล้ว ต้องสร้างไม่ได้
    ...    Type: N
    ...    Data: รหัส : STARTER (มีอยู่แล้ว)\nชื่อ : ซ้ำ\nรายเดือน : 1\nห้องสูงสุด : 5
    ...    Steps: 1. กด "สร้างแพ็กเกจ"\n2. กรอกรหัส STARTER\n3. กด "บันทึก"
    ...    Expected: ป็อปอัพยังเปิดอยู่ และแจ้ง "รหัสแพ็กเกจนี้ถูกใช้งานแล้ว"
    Go To Page    /super-admin/plans
    Click Button With Text    สร้างแพ็กเกจ
    Wait Until Element Is Visible    ${DIALOG}
    Input Text    css:[role=dialog] input[name=code]    STARTER
    Input Text    css:[role=dialog] input[name=name]    ซ้ำ
    Input Text    css:[role=dialog] input[name=monthlyPrice]    1
    Input Text    css:[role=dialog] input[name=maxRooms]    5
    Click Dialog Button    บันทึก
    Wait Until Element Contains    ${DIALOG}    รหัสแพ็กเกจนี้ถูกใช้งานแล้ว
    Click Dialog Button    ยกเลิก
    Record Actual    สร้างไม่ได้ และแจ้ง "รหัสแพ็กเกจนี้ถูกใช้งานแล้ว"

TC-ADM-004 ปิดขายแพ็กเกจ
    [Documentation]    Section: แพ็กเกจ
    ...    Function: แก้ไขแพ็กเกจ
    ...    Desc: แก้ราคาและติ๊กออกจาก "เปิดขายแพ็กเกจ" แล้วสถานะต้องเปลี่ยนเป็นปิดขาย
    ...    Type: P
    ...    Data: แพ็กเกจจาก TC-ADM-002\nรายเดือน : 249\nเปิดขาย : ไม่ติ๊ก
    ...    Steps: 1. กดแก้ไขแพ็กเกจ\n2. เปลี่ยนราคาเป็น 249\n3. ติ๊กออก "เปิดขายแพ็กเกจ"\n4. กด "บันทึก"
    ...    Expected: ขึ้น "บันทึกแพ็กเกจแล้ว" ราคาเป็น ฿249 และสถานะ "ปิดขาย"
    Go To Page    /super-admin/plans
    Wait Until Element Is Visible    xpath://button[@aria-label="แก้ไข ${PLAN_NAME}"]
    Click Element    xpath://button[@aria-label="แก้ไข ${PLAN_NAME}"]
    Wait Until Element Is Visible    ${DIALOG}
    Clear Element Text    css:[role=dialog] input[name=monthlyPrice]
    Input Text    css:[role=dialog] input[name=monthlyPrice]    249
    Unselect Checkbox    css:[role=dialog] input[name=isActive]
    Click Dialog Button    บันทึก
    Toast Should Say    บันทึกแพ็กเกจแล้ว
    ${row}=    Set Variable    xpath://tr[.//strong[normalize-space(.)="${PLAN_NAME}"]]
    Wait Until Element Contains    ${row}    ฿249
    Element Should Contain    ${row}    ปิดขาย
    Record Actual    ขึ้น "บันทึกแพ็กเกจแล้ว" ราคา ฿249 สถานะ "ปิดขาย"

TC-ADM-005 สร้างหอพักใหม่
    [Documentation]    Section: หอพัก
    ...    Function: เพิ่มหอพัก
    ...    Desc: เพิ่มหอใหม่ แล้วต้องขึ้นในตารางพร้อมแพ็กเกจทดลองใช้
    ...    Type: P
    ...    Data: ชื่อเต็ม : หอโรบอท <เลขรอบ>\nชื่อย่อ : RB<เลขรอบ>
    ...    Steps: 1. เปิด "หอพัก"\n2. กด "เพิ่มหอพัก"\n3. กรอกชื่อเต็มและชื่อย่อ\n4. กด "เพิ่มหอพัก" ในป็อปอัพ
    ...    Expected: ขึ้น "เพิ่มหอพักแล้ว" และหอใหม่อยู่ในตาราง แพ็กเกจ Starter
    ${suffix}=    Unique Suffix
    Set Suite Variable    ${DORM_NAME}    หอโรบอท ${suffix}
    Go To Page    /super-admin/properties
    Click Element    xpath://button[normalize-space(.)="เพิ่มหอพัก" and not(ancestor::*[@role="dialog"])]
    Wait Until Element Is Visible    ${DIALOG}
    Input Text    css:[role=dialog] input[name=name]    ${DORM_NAME}
    Input Text    css:[role=dialog] input[name=shortName]    RB${suffix}
    Click Element    xpath://*[@role="dialog"]//button[@type="submit"]
    Toast Should Say    เพิ่มหอพักแล้ว
    ${row}=    Set Variable    xpath://tr[.//td[normalize-space(.)="${DORM_NAME}"]]
    Wait Until Page Contains Element    ${row}
    Element Should Contain    ${row}    Starter
    Record Actual    ขึ้น "เพิ่มหอพักแล้ว" และ "${DORM_NAME}" อยู่ในตาราง แพ็กเกจ Starter

TC-ADM-006 เพิ่มหอพักด้วยชื่อที่มีแต่ช่องว่าง
    [Documentation]    Section: หอพัก
    ...    Function: เพิ่มหอพัก
    ...    Desc: ชื่อหอที่มีแต่ช่องว่างต้องถูกปฏิเสธ และบอกว่าช่องไหนผิด
    ...    Type: N
    ...    Data: ชื่อเต็ม : (ช่องว่าง 3 ตัว)\nชื่อย่อ : x
    ...    Steps: 1. กด "เพิ่มหอพัก"\n2. กรอกชื่อเต็มเป็นช่องว่าง\n3. กด "เพิ่มหอพัก" ในป็อปอัพ
    ...    Expected: ป็อปอัพยังเปิดอยู่ และแจ้ง "ชื่อเต็มของหอต้องมีอย่างน้อย 2 ตัวอักษร"
    Go To Page    /super-admin/properties
    Click Element    xpath://button[normalize-space(.)="เพิ่มหอพัก" and not(ancestor::*[@role="dialog"])]
    Wait Until Element Is Visible    ${DIALOG}
    Input Text    css:[role=dialog] input[name=name]    ${SPACE}${SPACE}${SPACE}
    Input Text    css:[role=dialog] input[name=shortName]    x
    Click Element    xpath://*[@role="dialog"]//button[@type="submit"]
    Wait Until Element Contains    ${DIALOG}    ชื่อเต็มของหอต้องมีอย่างน้อย 2 ตัวอักษร
    Click Dialog Button    ยกเลิก
    Record Actual    ถูกปฏิเสธ และแจ้ง "ชื่อเต็มของหอต้องมีอย่างน้อย 2 ตัวอักษร"

TC-ADM-007 แก้ไขชื่อหอจากหน้ารายละเอียด
    [Documentation]    Section: รายละเอียดหอ
    ...    Function: แก้ไขหอพัก
    ...    Desc: เปลี่ยนชื่อหอจากหน้ารายละเอียด แล้วชื่อบนหัวหน้าต้องเปลี่ยนตาม
    ...    Type: P
    ...    Data: หอจาก TC-ADM-005\nชื่อใหม่ : <ชื่อเดิม> (แก้ไข)
    ...    Steps: 1. กด "เปิดดู" ของหอ\n2. กด "แก้ไขหอพัก"\n3. แก้ชื่อเต็ม\n4. กด "บันทึก"
    ...    Expected: ขึ้น "บันทึกหอพักแล้ว" และหัวหน้าเป็นชื่อใหม่
    Open Dorm Detail    ${DORM_NAME}
    Click Button With Text    แก้ไขหอพัก
    Wait Until Element Is Visible    ${DIALOG}
    Clear Element Text    css:[role=dialog] input[name=name]
    Input Text    css:[role=dialog] input[name=name]    ${DORM_NAME} (แก้ไข)
    Click Dialog Button    บันทึก
    Toast Should Say    บันทึกหอพักแล้ว
    Wait Until Element Contains    css:h1    ${DORM_NAME} (แก้ไข)
    Set Suite Variable    ${DORM_NAME}    ${DORM_NAME} (แก้ไข)
    Record Actual    ขึ้น "บันทึกหอพักแล้ว" หัวหน้าเปลี่ยนเป็น "${DORM_NAME}"

TC-ADM-008 เปลี่ยนแพ็กเกจของหอด้วยตนเอง
    [Documentation]    Section: รายละเอียดหอ
    ...    Function: เปลี่ยนแพ็กเกจด้วยตนเอง
    ...    Desc: เปลี่ยนแพ็กเกจของหอเป็น Growth แล้วต้องเห็นในแพ็กเกจปัจจุบันและประวัติแพ็กเกจ
    ...    Type: P
    ...    Data: หอจาก TC-ADM-005\nแพ็กเกจ : Growth · 150 ห้อง\nรอบบิล : รายเดือน
    ...    Steps: 1. เปิดรายละเอียดหอ\n2. กด "เปลี่ยนแพ็กเกจด้วยตนเอง"\n3. เลือก Growth\n4. กด "บันทึกแพ็กเกจ"
    ...    Expected: ขึ้น "เปลี่ยนแพ็กเกจแล้ว" แพ็กเกจปัจจุบันเป็น Growth และประวัติมีแถว "ผู้ดูแลระบบเปลี่ยนแพ็กเกจ"
    ...    Remark: ฟอร์มต้องเลือกหอนี้ไว้ให้และใส่แพ็กเกจที่หอใช้อยู่ (Starter) มาก่อน
    Open Dorm Detail    ${DORM_NAME}
    Click Button With Text    เปลี่ยนแพ็กเกจด้วยตนเอง
    Wait Until Element Is Visible    ${DIALOG}
    Wait Until Element Contains    ${DIALOG}    Starter · 30 ห้อง
    Click Element    xpath://*[@role="dialog"]//button[.//span[contains(normalize-space(.),"Starter · 30 ห้อง")]]
    Click Element    xpath://*[@role="option" and contains(normalize-space(.),"Growth · 150 ห้อง")]
    Click Dialog Button    บันทึกแพ็กเกจ
    Toast Should Say    เปลี่ยนแพ็กเกจแล้ว
    Wait Until Page Contains    ผู้ดูแลระบบเปลี่ยนแพ็กเกจ
    Element Should Contain    xpath://section[.//h2[normalize-space(.)="แพ็กเกจปัจจุบัน"]]    Growth
    Record Actual    ขึ้น "เปลี่ยนแพ็กเกจแล้ว" แพ็กเกจปัจจุบัน Growth และประวัติมี "ผู้ดูแลระบบเปลี่ยนแพ็กเกจ"

TC-ADM-009 กรองหอที่แพ็กเกจใกล้หมดอายุ
    [Documentation]    Section: หอพัก
    ...    Function: ตัวกรองหอพัก
    ...    Desc: เปิดตารางหอพักด้วยตัวกรอง "แพ็กเกจใกล้หมดอายุ" ต้องเห็นเฉพาะหอที่หมดภายใน 30 วัน
    ...    Type: P
    ...    Data: /super-admin/properties?status=expiring
    ...    Steps: 1. เปิดลิงก์ตัวกรอง (ลิงก์เดียวกับการ์ดบนแดชบอร์ด)
    ...    Expected: ช่องกรองแสดง "แพ็กเกจใกล้หมดอายุ" และหอจาก TC-ADM-008 (Growth หมดใน 1 เดือน) อยู่ในตาราง
    Go To Page    /super-admin/properties?status=expiring
    Wait Until Element Contains    css:.admin-table-filter .dropdown-trigger    แพ็กเกจใกล้หมดอายุ
    Wait Until Page Contains Element    xpath://tr[.//td[normalize-space(.)="${DORM_NAME}"]]
    Record Actual    ช่องกรองเป็น "แพ็กเกจใกล้หมดอายุ" และมี "${DORM_NAME}" ในตาราง

TC-ADM-010 ตัวกรองสถานะบัญชีแสดงตัวเลือกครบ
    [Documentation]    Section: บัญชีเจ้าของหอ
    ...    Function: กรองสถานะอนุมัติ
    ...    Desc: เปิดดรอปดาวน์กรองสถานะแล้วต้องเห็นตัวเลือกครบทั้ง 4 ตัว ไม่ถูกการ์ดตัด
    ...    Type: P
    ...    Data: ตัวเลือก : ทุกสถานะ, รออนุมัติ, อนุมัติแล้ว, ไม่อนุมัติ
    ...    Steps: 1. เปิด "บัญชีเจ้าของหอ"\n2. กดช่องกรองสถานะ\n3. ตรวจว่าตัวเลือกสุดท้ายอยู่ในพื้นที่ที่มองเห็น
    ...    Expected: เห็นครบ 4 ตัว และ "ไม่อนุมัติ" ไม่ถูกตัด
    ...    Remark: ทดสอบซ้ำจุดที่เคยพบว่าตัวเลือกสุดท้ายถูกการ์ดตัด
    Go To Page    /super-admin/accounts
    Click Element    xpath://button[@aria-label="กรองสถานะอนุมัติ"]
    Wait Until Element Is Visible    css:[role=listbox]
    ${clipped}=    Execute Javascript
    ...    const option = [...document.querySelectorAll('[role=option]')].at(-1); const r = option.getBoundingClientRect();
    ...    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !(hit && option.contains(hit));
    Should Not Be True    ${clipped}    msg=ตัวเลือกสุดท้ายถูกบังหรือถูกตัด
    ${count}=    Get Element Count    css:[role=option]
    Should Be Equal As Integers    ${count}    4
    Press Keys    None    ESCAPE
    Record Actual    เห็นตัวเลือกครบ ${count} ตัว และ "ไม่อนุมัติ" กดได้ ไม่ถูกตัด

TC-ADM-011 บันทึกการใช้งานบอกสาเหตุที่ไม่สำเร็จ
    [Documentation]    Section: บันทึกการใช้งาน
    ...    Function: แสดงรายละเอียดเหตุการณ์
    ...    Desc: เหตุการณ์ที่ไม่สำเร็จต้องบอกสาเหตุและหน้าที่เกิด เช่น ข้อมูลไม่ถูกต้อง หรือข้อมูลซ้ำ
    ...    Type: P
    ...    Data: เหตุการณ์จาก TC-ADM-003 และ TC-ADM-006
    ...    Steps: 1. เปิด "บันทึกการใช้งาน"\n2. กรองผลลัพธ์ "ไม่สำเร็จ"
    ...    Expected: แถวที่ไม่สำเร็จมีรายละเอียด เช่น "ข้อมูลซ้ำหรือขัดกับข้อมูลเดิม · /api/v1/super-admin/plans"
    Go To Page    /super-admin/audit-logs
    Click Element    xpath://button[@aria-label="กรองบันทึกการใช้งาน"]
    Click Element    xpath://*[@role="option" and normalize-space(.)="ไม่สำเร็จ"]
    Wait Until Page Contains    ข้อมูลซ้ำหรือขัดกับข้อมูลเดิม · /api/v1/super-admin/plans
    Page Should Contain    ข้อมูลไม่ถูกต้อง · /api/super-admin/properties
    Record Actual    แสดง "ข้อมูลซ้ำหรือขัดกับข้อมูลเดิม · /api/v1/super-admin/plans" และ "ข้อมูลไม่ถูกต้อง · /api/super-admin/properties"

TC-ADM-012 กรอกบัญชีรับเงินไม่ครบ
    [Documentation]    Section: ตั้งค่าระบบ
    ...    Function: บัญชีรับค่าแพ็กเกจ
    ...    Desc: เลือกเฉพาะธนาคารแต่ไม่กรอกเลขบัญชีและชื่อบัญชี ต้องบันทึกไม่ได้และบอกช่องที่ขาด
    ...    Type: N
    ...    Data: ธนาคาร : ธนาคารแรกในรายการ\nเลขที่บัญชี : (ว่าง)\nชื่อบัญชี : (ว่าง)
    ...    Steps: 1. เปิด "ตั้งค่าระบบ"\n2. เลือกธนาคาร\n3. กด "บันทึก"
    ...    Expected: แจ้ง "แก้ช่องที่ขึ้นสีแดงก่อนบันทึก" และช่องเลขที่บัญชีแจ้ง "กรอกเลขที่บัญชี"
    Go To Page    /super-admin/settings
    Wait Until Page Contains    บัญชีธนาคาร
    Click Element    xpath://button[@aria-haspopup="listbox" and @aria-labelledby=//span[normalize-space(.)="ธนาคาร"]/@id]
    Wait Until Element Is Visible    xpath://*[@role="option"][2]
    Click Element    xpath://*[@role="option"][2]
    Click Element    xpath://main//button[normalize-space(.)="บันทึก"]
    Wait Until Page Contains    แก้ช่องที่ขึ้นสีแดงก่อนบันทึก
    Page Should Contain    กรอกเลขที่บัญชี
    Record Actual    บันทึกไม่ได้ แจ้ง "แก้ช่องที่ขึ้นสีแดงก่อนบันทึก" และ "กรอกเลขที่บัญชี"

TC-ADM-013 กระดิ่งแจ้งแพ็กเกจใกล้หมดอายุ
    [Documentation]    Section: แถบด้านบน
    ...    Function: การแจ้งเตือน
    ...    Desc: เมื่อมีหอที่แพ็กเกจใกล้หมดอายุ กระดิ่งต้องแสดงรายการนี้ ตรงกับแดชบอร์ด
    ...    Type: P
    ...    Data: หอจาก TC-ADM-008 (หมดใน 1 เดือน)
    ...    Steps: 1. เปิดแดชบอร์ด\n2. กดกระดิ่ง
    ...    Expected: เห็นรายการ "แพ็กเกจใกล้หมดอายุ" ในศูนย์การแจ้งเตือน
    ...    Remark: ทดสอบซ้ำจุดที่เคยพบว่ากระดิ่งบอก "เรียบร้อยทั้งหมด" ทั้งที่แดชบอร์ดมีงานค้าง
    Go To Page    /super-admin
    Click Element    xpath://button[starts-with(@aria-label,"ศูนย์การแจ้งเตือน")]
    Wait Until Page Contains Element    xpath://*[contains(normalize-space(.),"แพ็กเกจใกล้หมดอายุ") and ancestor::*[contains(@class,"notification")]]
    Press Keys    None    ESCAPE
    Record Actual    กระดิ่งแสดงรายการ "แพ็กเกจใกล้หมดอายุ"


*** Keywords ***
Open Dorm Detail
    [Arguments]    ${name}
    Go To Page    /super-admin/properties
    Input Text    css:.admin-table-search input    ${name}
    Wait Until Page Contains Element    xpath://tr[.//td[normalize-space(.)="${name}"]]
    Click Element    xpath://tr[.//td[normalize-space(.)="${name}"]]//a[normalize-space(.)="เปิดดู"]
    Wait Until Element Contains    css:h1    ${name}
