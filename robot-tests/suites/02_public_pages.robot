*** Settings ***
Documentation     PUBLIC PAGES FUNCTION — ลืมรหัสผ่าน สมัครด้วยรหัสเชิญ เอกสารนโยบาย และหน้าที่ต้องเข้าสู่ระบบ
Metadata          Sheet    Test UI หน้าสาธารณะ
Metadata          Pre-condition    1. เปิด Chrome แล้วเข้า ${BASE_URL}\n2. ยังไม่ได้เข้าสู่ระบบ
Resource          ../common.robot
Suite Setup       Open Test Browser
Suite Teardown    Close All Browsers
Test Setup        Delete All Cookies
Test Teardown     Capture Evidence


*** Variables ***
${FAKE_INVITE}      ZZZZ-INVALID-INVITATION-CODE-0000000000


*** Test Cases ***
TC-PUB-010 ขอลิงก์ตั้งรหัสผ่านใหม่
    [Documentation]    Section: ลืมรหัสผ่าน
    ...    Function: ขอลิงก์ตั้งรหัสผ่าน
    ...    Desc: กรอกอีเมลแล้วกดส่ง ระบบต้องตอบข้อความกลาง ๆ ไม่บอกว่ามีบัญชีนี้หรือไม่
    ...    Type: P
    ...    Data: email : robot.owner@nestly.test
    ...    Steps: 1. เปิด /forgot-password\n2. กรอกอีเมล\n3. กด "ส่งลิงก์ตั้งรหัสผ่านใหม่"
    ...    Expected: แจ้ง "หากอีเมลนี้อยู่ในระบบ เราจะส่งลิงก์ตั้งรหัสผ่านใหม่ให้"
    ...    Remark: เครื่องทดสอบไม่ได้ตั้งค่าบริการอีเมล จึงไม่มีอีเมลส่งออกจริง
    Go To    ${BASE_URL}/forgot-password
    Wait Until Element Is Visible    css:input[type=email]
    Input Text    css:input[type=email]    ${OWNER_EMAIL}
    Click Button With Text    ส่งลิงก์ตั้งรหัสผ่านใหม่
    Wait Until Page Contains    หากอีเมลนี้อยู่ในระบบ
    Record Actual    แจ้ง "หากอีเมลนี้อยู่ในระบบ เราจะส่งลิงก์ตั้งรหัสผ่านใหม่ให้"

TC-PUB-011 สมัครด้วยรหัสเชิญที่ไม่ถูกต้อง
    [Documentation]    Section: สมัครผู้เช่า
    ...    Function: สมัครด้วยรหัสเชิญ
    ...    Desc: รหัสเชิญที่ไม่มีอยู่จริงต้องสมัครไม่ได้
    ...    Type: N
    ...    Data: รหัสเชิญ : ZZZZ-INVALID-INVITATION-CODE-0000000000\nชื่อ : ผู้เช่า โรบอท\nemail : robot.new@nestly.test\nเบอร์ : 0812345678\npassword : Robot-New-2026
    ...    Steps: 1. เปิด /register\n2. กรอกรหัสเชิญปลอมและข้อมูลครบ\n3. ติ๊กยอมรับข้อกำหนดและความเป็นส่วนตัว\n4. กด "สมัครเป็นผู้เช่า"
    ...    Expected: อยู่หน้าเดิม และแจ้ง "รหัสเชิญไม่ถูกต้องหรือหมดอายุ"
    Go To    ${BASE_URL}/register
    Wait Until Element Is Visible    css:input[name=invitationCode]
    Input Text    css:input[name=invitationCode]    ${FAKE_INVITE}
    Select Checkbox    css:input[name=termsAccepted]
    Select Checkbox    css:input[name=privacyAcknowledged]
    Input Text    css:input[name=displayName]    ผู้เช่า โรบอท
    Input Text    css:input[name=email]    robot.new@nestly.test
    Input Text    css:input[name=phone]    0812345678
    Input Password    css:input[name=password]    Robot-New-2026
    Click Button With Text    สมัครเป็นผู้เช่า
    Wait Until Page Contains    รหัสเชิญไม่ถูกต้องหรือหมดอายุ
    Location Should Contain    /register
    Record Actual    อยู่หน้า /register และแจ้ง "รหัสเชิญไม่ถูกต้องหรือหมดอายุ"

TC-PUB-012 เกณฑ์รหัสผ่านตอนสมัคร
    [Documentation]    Section: สมัครผู้เช่า
    ...    Function: ตรวจความแข็งแรงของรหัสผ่าน
    ...    Desc: พิมพ์รหัสผ่านแล้วรายการเกณฑ์ต้องเปลี่ยนเป็นผ่านตามที่พิมพ์
    ...    Type: P
    ...    Data: password : abc (ไม่ผ่าน) แล้วเปลี่ยนเป็น Robot-New-2026 (ผ่านครบ)
    ...    Steps: 1. เปิด /register\n2. พิมพ์ "abc"\n3. เปลี่ยนเป็น "Robot-New-2026"
    ...    Expected: ตอนพิมพ์ "abc" ยังไม่ผ่านบางข้อ เมื่อพิมพ์รหัสที่แข็งแรงผ่านครบ 4 ข้อ
    Go To    ${BASE_URL}/register
    Wait Until Element Is Visible    css:input[name=password]
    Input Password    css:input[name=password]    abc
    ${weak}=    Get Element Count    xpath://span[@class="sr-only" and normalize-space(.)="ยังไม่ผ่าน"]
    Should Be True    ${weak} > 0
    Clear Element Text    css:input[name=password]
    Input Password    css:input[name=password]    Robot-New-2026
    Wait Until Page Does Not Contain Element    xpath://span[@class="sr-only" and normalize-space(.)="ยังไม่ผ่าน"]    timeout=5s
    ${met}=    Get Element Count    xpath://span[@class="sr-only" and normalize-space(.)="ผ่านแล้ว"]
    Record Actual    "abc" ไม่ผ่าน ${weak} ข้อ / "Robot-New-2026" ผ่านครบ ${met} ข้อ

TC-PUB-013 สมัครโดยไม่ยอมรับข้อกำหนด
    [Documentation]    Section: สมัครผู้เช่า
    ...    Function: ยอมรับข้อตกลง
    ...    Desc: ไม่ติ๊กยอมรับข้อกำหนดการใช้บริการ ต้องสมัครไม่ได้
    ...    Type: N
    ...    Data: กรอกข้อมูลครบ แต่ไม่ติ๊ก "ยอมรับข้อกำหนดการใช้บริการ"
    ...    Steps: 1. เปิด /register\n2. กรอกข้อมูลครบ\n3. ไม่ติ๊กข้อกำหนด\n4. กด "สมัครเป็นผู้เช่า"
    ...    Expected: ฟอร์มไม่ถูกส่ง ช่องติ๊กข้อกำหนดแจ้งว่าจำเป็น
    Go To    ${BASE_URL}/register
    Wait Until Element Is Visible    css:input[name=invitationCode]
    Input Text    css:input[name=invitationCode]    ${FAKE_INVITE}
    Select Checkbox    css:input[name=privacyAcknowledged]
    Input Text    css:input[name=displayName]    ผู้เช่า โรบอท
    Input Text    css:input[name=email]    robot.new@nestly.test
    Input Text    css:input[name=phone]    0812345678
    Input Password    css:input[name=password]    Robot-New-2026
    Click Button With Text    สมัครเป็นผู้เช่า
    Sleep    1s
    Location Should Contain    /register
    ${message}=    Field Validation Message    input[name=termsAccepted]
    Should Not Be Empty    ${message}
    Page Should Not Contain    รหัสเชิญไม่ถูกต้อง
    Record Actual    ฟอร์มไม่ถูกส่ง ช่องข้อกำหนดแจ้ง "${message}"

TC-PUB-014 เปิดเอกสารนโยบายครบทั้งสามหน้า
    [Documentation]    Section: เอกสารนโยบาย
    ...    Function: แสดงเอกสาร
    ...    Desc: หน้าข้อกำหนด ความเป็นส่วนตัว และคุกกี้ ต้องเปิดได้และมีเลขเวอร์ชัน
    ...    Type: P
    ...    Data: /legal/terms, /legal/privacy, /legal/cookies
    ...    Steps: 1. เปิดทีละหน้า\n2. ตรวจหัวเรื่องและวันที่มีผล
    ...    Expected: ทั้งสามหน้าแสดงหัวเรื่องและข้อความ "มีผลตั้งแต่"
    FOR    ${path}    ${title}    IN
    ...    /legal/terms    ข้อกำหนดการใช้บริการ
    ...    /legal/privacy    ประกาศความเป็นส่วนตัว
    ...    /legal/cookies    นโยบายคุกกี้
        Go To    ${BASE_URL}${path}
        Wait Until Element Contains    css:h1    ${title}
        Page Should Contain    มีผลตั้งแต่
    END
    Record Actual    เปิดได้ครบ 3 หน้า ทุกหน้ามีหัวเรื่องและวันที่มีผล

TC-PUB-015 เปิดหน้าที่ไม่มีอยู่จริง
    [Documentation]    Section: หน้า 404
    ...    Function: แจ้งไม่พบหน้า
    ...    Desc: พิมพ์ที่อยู่ผิดต้องเห็นหน้าแจ้งไม่พบ พร้อมปุ่มกลับหน้าแรก
    ...    Type: N
    ...    Data: /this-page-does-not-exist
    ...    Steps: 1. เปิด URL ที่ไม่มีอยู่
    ...    Expected: แสดง "404" และ "ไม่พบหน้าที่คุณต้องการ" พร้อมลิงก์ "กลับหน้าแรก"
    Go To    ${BASE_URL}/this-page-does-not-exist
    Wait Until Page Contains    ไม่พบหน้าที่คุณต้องการ
    Page Should Contain    404
    Page Should Contain Link    กลับหน้าแรก
    Record Actual    แสดงหน้า 404 "ไม่พบหน้าที่คุณต้องการ" พร้อมลิงก์กลับหน้าแรก

TC-PUB-016 เปิดหน้าที่ต้องเข้าสู่ระบบโดยยังไม่เข้าสู่ระบบ
    [Documentation]    Section: การป้องกันหน้า
    ...    Function: บังคับเข้าสู่ระบบ
    ...    Desc: เปิดหน้าของผู้ดูแลระบบ เจ้าของหอ และผู้เช่าโดยตรงต้องถูกพาไปหน้าเข้าสู่ระบบ
    ...    Type: N
    ...    Data: /super-admin, /admin, /tenant
    ...    Steps: 1. ล้างคุกกี้\n2. เปิดทีละหน้า
    ...    Expected: ทุกหน้าถูกพาไป /login
    FOR    ${path}    IN    /super-admin    /admin    /tenant
        Go To    ${BASE_URL}${path}
        Wait Until Location Contains    /login
    END
    Record Actual    ทั้ง /super-admin, /admin และ /tenant ถูกพาไป /login
