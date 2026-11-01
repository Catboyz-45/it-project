*** Settings ***
Documentation     LOGIN FUNCTION — การเข้าสู่ระบบและออกจากระบบของทุกบทบาท
Metadata          Sheet    Test UI หน้าสาธารณะ
Metadata          Pre-condition    1. เปิด Chrome แล้วเข้า ${BASE_URL}/login\n2. ยังไม่ได้เข้าสู่ระบบ (ล้างคุกกี้ก่อนทุกกรณี)
Resource          ../common.robot
Suite Setup       Open Test Browser
Suite Teardown    Close All Browsers
Test Setup        Delete All Cookies
Test Teardown     Capture Evidence


*** Test Cases ***
TC-PUB-001 ผู้ดูแลระบบเข้าสู่ระบบสำเร็จ
    [Documentation]    Section: หน้าเข้าสู่ระบบ
    ...    Function: เข้าสู่ระบบ
    ...    Desc: ผู้ดูแลระบบเข้าสู่ระบบด้วยบัญชีที่ถูกต้องแล้วไปหน้าแดชบอร์ดผู้ดูแลระบบ
    ...    Type: P
    ...    Data: email : robot.super@nestly.test\npassword : รหัสผ่านทดสอบที่ถูกต้อง
    ...    Steps: 1. กรอกอีเมล\n2. กรอกรหัสผ่าน\n3. กด "เข้าสู่ระบบ"
    ...    Expected: เข้าหน้า /super-admin และเห็นหัวข้อ "แดชบอร์ด"
    Login As Super Admin
    Location Should Contain    /super-admin
    Wait Until Page Contains    ภาพรวมแพลตฟอร์ม
    Record Actual    เข้าหน้า /super-admin แสดง "ภาพรวมแพลตฟอร์ม"

TC-PUB-002 เจ้าของหอเข้าสู่ระบบสำเร็จ
    [Documentation]    Section: หน้าเข้าสู่ระบบ
    ...    Function: เข้าสู่ระบบ
    ...    Desc: เจ้าของหอเข้าสู่ระบบแล้วไปหน้าแดชบอร์ดของหอที่ดูแล
    ...    Type: P
    ...    Data: email : robot.owner@nestly.test\npassword : รหัสผ่านทดสอบที่ถูกต้อง
    ...    Steps: 1. กรอกอีเมล\n2. กรอกรหัสผ่าน\n3. กด "เข้าสู่ระบบ"
    ...    Expected: เข้าหน้า /admin/properties/<รหัสหอ> และเห็นส่วน "ภาพรวมธุรกิจ"
    Login As Owner
    Location Should Contain    ${OWNER_HOME}
    Wait Until Page Contains    ภาพรวมธุรกิจ
    Record Actual    เข้าหน้าแดชบอร์ดของหอทดลอง แสดง "ภาพรวมธุรกิจ"

TC-PUB-003 ผู้เช่าเข้าสู่ระบบสำเร็จ
    [Documentation]    Section: หน้าเข้าสู่ระบบ
    ...    Function: เข้าสู่ระบบ
    ...    Desc: ผู้เช่าเข้าสู่ระบบแล้วไปหน้าหลักของผู้เช่า พร้อมชื่อและเลขห้อง
    ...    Type: P
    ...    Data: email : somchai@nestly.demo\npassword : รหัสผ่านทดสอบที่ถูกต้อง
    ...    Steps: 1. กรอกอีเมล\n2. กรอกรหัสผ่าน\n3. กด "เข้าสู่ระบบ"
    ...    Expected: เข้าหน้า /tenant แสดงชื่อ "สมชาย ใจดี" และ "ห้อง 101"
    Login As Tenant
    Location Should Contain    /tenant
    Wait Until Page Contains    ${TENANT_NAME}
    Page Should Contain    ห้อง 101
    Record Actual    เข้าหน้า /tenant แสดง "${TENANT_NAME}" และ "ห้อง 101"

TC-PUB-004 รหัสผ่านไม่ถูกต้อง
    [Documentation]    Section: หน้าเข้าสู่ระบบ
    ...    Function: เข้าสู่ระบบ
    ...    Desc: กรอกรหัสผ่านผิดต้องเข้าสู่ระบบไม่ได้
    ...    Type: N
    ...    Data: email : robot.owner@nestly.test\npassword : Wrong-Pass-999
    ...    Steps: 1. กรอกอีเมลที่ถูกต้อง\n2. กรอกรหัสผ่านผิด\n3. กด "เข้าสู่ระบบ"
    ...    Expected: อยู่หน้าเดิม และแจ้ง "อีเมลหรือรหัสผ่านไม่ถูกต้อง"
    Go To    ${BASE_URL}/login
    Wait Until Keyword Succeeds    3x    2s    Fill Login Form    ${OWNER_EMAIL}    Wrong-Pass-999
    Wait Until Page Contains    อีเมลหรือรหัสผ่านไม่ถูกต้อง
    Location Should Contain    /login
    Record Actual    อยู่หน้า /login และแจ้ง "อีเมลหรือรหัสผ่านไม่ถูกต้อง"

TC-PUB-005 อีเมลที่ไม่มีในระบบ
    [Documentation]    Section: หน้าเข้าสู่ระบบ
    ...    Function: เข้าสู่ระบบ
    ...    Desc: อีเมลที่ไม่มีบัญชีต้องได้ข้อความเดียวกับรหัสผิด เพื่อไม่ให้ไล่เดาอีเมลได้
    ...    Type: N
    ...    Data: email : nobody@nestly.test\npassword : Some-Password-123
    ...    Steps: 1. กรอกอีเมลที่ไม่มีในระบบ\n2. กรอกรหัสผ่าน\n3. กด "เข้าสู่ระบบ"
    ...    Expected: อยู่หน้าเดิม และแจ้ง "อีเมลหรือรหัสผ่านไม่ถูกต้อง" เหมือนกรณีรหัสผิด
    ...    Remark: กันการไล่เดาอีเมล (account enumeration)
    Go To    ${BASE_URL}/login
    Wait Until Keyword Succeeds    3x    2s    Fill Login Form    nobody@nestly.test    Some-Password-123
    Wait Until Page Contains    อีเมลหรือรหัสผ่านไม่ถูกต้อง
    Location Should Contain    /login
    Record Actual    แจ้ง "อีเมลหรือรหัสผ่านไม่ถูกต้อง" เหมือนกรณีรหัสผิด

TC-PUB-006 ไม่กรอกอีเมลและรหัสผ่าน
    [Documentation]    Section: หน้าเข้าสู่ระบบ
    ...    Function: ตรวจข้อมูลก่อนส่ง
    ...    Desc: กดเข้าสู่ระบบโดยไม่กรอกอะไรเลย ฟอร์มต้องไม่ถูกส่ง
    ...    Type: N
    ...    Data: email : (ว่าง)\npassword : (ว่าง)
    ...    Steps: 1. ไม่กรอกข้อมูล\n2. กด "เข้าสู่ระบบ"
    ...    Expected: อยู่หน้าเดิม ช่องอีเมลแจ้งให้กรอกข้อมูล
    Go To    ${BASE_URL}/login
    Wait Until Element Is Visible    css:button[type=submit]
    Click Button    css:button[type=submit]
    Sleep    1s
    Location Should Contain    /login
    ${message}=    Field Validation Message    input[type=email]
    Should Not Be Empty    ${message}
    Record Actual    ฟอร์มไม่ถูกส่ง ช่องอีเมลแจ้ง "${message}"

TC-PUB-007 อีเมลผิดรูปแบบ
    [Documentation]    Section: หน้าเข้าสู่ระบบ
    ...    Function: ตรวจข้อมูลก่อนส่ง
    ...    Desc: อีเมลที่ไม่มี @โดเมน ต้องถูกแจ้งว่ารูปแบบไม่ถูกต้อง
    ...    Type: N
    ...    Data: email : robot.owner\npassword : Robot-Owner-2026
    ...    Steps: 1. กรอกอีเมลที่ไม่มี @\n2. กรอกรหัสผ่าน\n3. กด "เข้าสู่ระบบ"
    ...    Expected: ฟอร์มไม่ถูกส่ง ช่องอีเมลแจ้งรูปแบบไม่ถูกต้อง
    Go To    ${BASE_URL}/login
    Wait Until Keyword Succeeds    3x    2s    Fill Login Form    robot.owner    ${OWNER_PASSWORD}
    Sleep    1s
    Location Should Contain    /login
    ${message}=    Field Validation Message    input[type=email]
    Should Not Be Empty    ${message}
    Record Actual    ฟอร์มไม่ถูกส่ง ช่องอีเมลแจ้ง "${message}"

TC-PUB-008 ปุ่มแสดงและซ่อนรหัสผ่าน
    [Documentation]    Section: หน้าเข้าสู่ระบบ
    ...    Function: แสดงรหัสผ่าน
    ...    Desc: กดปุ่มรูปตาแล้วรหัสผ่านต้องแสดงเป็นตัวอักษร กดอีกครั้งต้องซ่อนกลับ
    ...    Type: P
    ...    Data: password : Robot-Owner-2026
    ...    Steps: 1. กรอกรหัสผ่าน\n2. กด "แสดงรหัสผ่าน"\n3. กด "ซ่อนรหัสผ่าน"
    ...    Expected: ช่องเปลี่ยนเป็นข้อความธรรมดา แล้วกลับเป็นช่องรหัสผ่าน
    Go To    ${BASE_URL}/login
    Wait Until Element Is Visible    css:input[type=password]
    Input Password    css:input[type=password]    ${OWNER_PASSWORD}
    Click Button With Text    แสดงรหัสผ่าน
    Wait Until Page Contains Element    css:input[autocomplete=current-password][type=text]
    Click Button With Text    ซ่อนรหัสผ่าน
    Wait Until Page Contains Element    css:input[autocomplete=current-password][type=password]
    Record Actual    กดแล้วสลับเป็นข้อความธรรมดา และซ่อนกลับได้

TC-PUB-009 ออกจากระบบแล้วเข้าหน้าที่ต้องเข้าสู่ระบบไม่ได้
    [Documentation]    Section: เมนูบัญชี
    ...    Function: ออกจากระบบ
    ...    Desc: กดออกจากระบบจากเมนูบัญชี แล้วเปิดหน้าผู้ดูแลระบบอีกครั้งต้องถูกพาไปหน้าเข้าสู่ระบบ
    ...    Type: P
    ...    Data: บัญชีผู้ดูแลระบบ
    ...    Steps: 1. เข้าสู่ระบบ\n2. เปิดเมนูบัญชี\n3. กด "ออกจากระบบ"\n4. เปิด /super-admin อีกครั้ง
    ...    Expected: กลับหน้า /login และเปิด /super-admin แล้วถูกพาไป /login
    Login As Super Admin
    Click Element    xpath://button[starts-with(@aria-label,"เปิดเมนูบัญชี")]
    Click Element    xpath://*[normalize-space(.)="ออกจากระบบ" and (self::button or self::a or @role="menuitem")]
    Wait Until Location Contains    /login
    Go To    ${BASE_URL}/super-admin
    Wait Until Location Contains    /login
    Record Actual    ออกจากระบบแล้วกลับ /login และเปิด /super-admin ถูกพาไป /login
