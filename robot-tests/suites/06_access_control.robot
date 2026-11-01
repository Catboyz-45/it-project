*** Settings ***
Documentation     ACCESS CONTROL FUNCTION — แต่ละบทบาทต้องเข้าหน้าและข้อมูลของบทบาทอื่นไม่ได้
Metadata          Sheet    Test สิทธิ์และมือถือ
Metadata          Pre-condition    1. เปิด Chrome แล้วเข้า ${BASE_URL}/login\n2. เข้าสู่ระบบด้วยบัญชีตามที่ระบุในแต่ละกรณี
Resource          ../common.robot
Suite Setup       Open Test Browser
Suite Teardown    Close All Browsers
Test Teardown     Capture Evidence


*** Variables ***
${OTHER_PROPERTY}    c000000000000000000000000


*** Test Cases ***
TC-SEC-001 ผู้เช่าเปิดหน้าผู้ดูแลระบบ
    [Documentation]    Section: สิทธิ์ผู้เช่า
    ...    Function: กันหน้าผู้ดูแลระบบ
    ...    Desc: ผู้เช่าพิมพ์ที่อยู่หน้าผู้ดูแลระบบเอง ต้องเข้าไม่ได้
    ...    Type: N
    ...    Data: บัญชีผู้เช่า\nURL : /super-admin
    ...    Steps: 1. เข้าสู่ระบบเป็นผู้เช่า\n2. เปิด /super-admin
    ...    Expected: ถูกพาออกจาก /super-admin และไม่เห็นข้อมูลแพลตฟอร์ม
    ...    Remark: ข้อสังเกต: ผู้เช่าถูกพาไป /admin ซึ่งขึ้นว่า "ยังไม่มีหอพักที่ดูแล" ควรพากลับ /tenant แทน (ไม่กระทบความปลอดภัย)
    Login As Tenant
    Go To    ${BASE_URL}/super-admin
    Wait Until Location Does Not Contain    /super-admin
    Page Should Not Contain Element    xpath://h2[normalize-space(.)="ภาพรวมแพลตฟอร์ม"]
    ${url}=    Get Location
    ${title}=    Get Text    css:h1
    Record Actual    ถูกพาไป ${url} แสดง "${title}" ไม่เห็นข้อมูลแพลตฟอร์ม

TC-SEC-002 ผู้เช่าเปิดหน้าจัดการหอ
    [Documentation]    Section: สิทธิ์ผู้เช่า
    ...    Function: กันหน้าเจ้าของหอ
    ...    Desc: ผู้เช่าเปิดหน้าจัดการหอของตัวเองโดยตรง ต้องเข้าไม่ได้
    ...    Type: N
    ...    Data: บัญชีผู้เช่า\nURL : /admin/properties/<หอพักทดลอง>/tenants
    ...    Steps: 1. เข้าสู่ระบบเป็นผู้เช่า\n2. เปิดหน้ารายชื่อผู้เช่าของหอ
    ...    Expected: แสดงหน้า 404 "ไม่พบหน้าที่คุณต้องการ" และไม่เห็นรายชื่อผู้เช่าคนอื่น
    ...    Remark: ตอบเป็นไม่พบหน้า ไม่บอกว่าหน้านี้มีอยู่จริง
    Login As Tenant
    Go To    ${BASE_URL}${OWNER_HOME}/tenants
    Wait Until Page Contains    ไม่พบหน้าที่คุณต้องการ
    Page Should Not Contain Element    xpath://button[starts-with(@aria-label,"ดูข้อมูล วิชัย")]
    Record Actual    แสดงหน้า 404 "ไม่พบหน้าที่คุณต้องการ" ไม่เห็นรายชื่อผู้เช่าคนอื่น

TC-SEC-003 เจ้าของหอเปิดหน้าผู้ดูแลระบบ
    [Documentation]    Section: สิทธิ์เจ้าของหอ
    ...    Function: กันหน้าผู้ดูแลระบบ
    ...    Desc: เจ้าของหอเปิดหน้าผู้ดูแลระบบ ต้องถูกพากลับหน้าของเจ้าของหอ
    ...    Type: N
    ...    Data: บัญชีเจ้าของหอ\nURL : /super-admin/accounts
    ...    Steps: 1. เข้าสู่ระบบเป็นเจ้าของหอ\n2. เปิด /super-admin/accounts
    ...    Expected: ถูกพาไปหน้า /admin และไม่เห็นรายชื่อบัญชีเจ้าของหอทั้งหมด
    Login As Owner
    Go To    ${BASE_URL}/super-admin/accounts
    Wait Until Location Does Not Contain    /super-admin
    ${url}=    Get Location
    Should Contain    ${url}    /admin
    Page Should Not Contain Element    xpath://button[contains(normalize-space(.),"เพิ่มแอดมินประจำหอ")]
    Record Actual    ถูกพาไป ${url}

TC-SEC-004 ผู้เช่าเรียก API ของผู้ดูแลระบบ
    [Documentation]    Section: สิทธิ์ผู้เช่า
    ...    Function: กัน API ผู้ดูแลระบบ
    ...    Desc: ผู้เช่าเรียก API รายการบัญชีของผู้ดูแลระบบตรง ๆ ต้องถูกปฏิเสธ
    ...    Type: N
    ...    Data: บัญชีผู้เช่า\nAPI : GET /api/v1/super-admin/users
    ...    Steps: 1. เข้าสู่ระบบเป็นผู้เช่า\n2. เรียก API ด้วยคุกกี้ของผู้เช่า
    ...    Expected: ได้รหัส 401 หรือ 403 ไม่ได้ข้อมูลบัญชี
    Login As Tenant
    ${status}=    Fetch Status    /api/v1/super-admin/users
    Should Be True    ${status} in (401, 403)
    Record Actual    ถูกปฏิเสธด้วยรหัส ${status}

TC-SEC-005 เจ้าของหอเรียก API ของหอที่ไม่ได้ดูแล
    [Documentation]    Section: สิทธิ์เจ้าของหอ
    ...    Function: กันข้อมูลหออื่น
    ...    Desc: เจ้าของหอเรียกข้อมูลผู้เช่าของหออื่นโดยเปลี่ยนรหัสหอใน URL ต้องถูกปฏิเสธ
    ...    Type: N
    ...    Data: บัญชีเจ้าของหอ\nAPI : GET /api/v1/admin/properties/<หอที่ไม่ได้ดูแล>/tenants
    ...    Steps: 1. เข้าสู่ระบบเป็นเจ้าของหอ\n2. เรียก API ด้วยรหัสหออื่น
    ...    Expected: ได้รหัส 403 หรือ 404 ไม่ได้ข้อมูลผู้เช่า
    ...    Remark: กันการเปลี่ยนรหัสใน URL เพื่อดูข้อมูลคนอื่น (IDOR)
    Login As Owner
    ${status}=    Fetch Status    /api/v1/admin/properties/${OTHER_PROPERTY}/tenants
    Should Be True    ${status} in (403, 404)
    ${own}=    Fetch Status    /api/v1/admin/properties/${PROPERTY_ID}/tenants
    Should Be Equal As Integers    ${own}    200
    Record Actual    หออื่นได้รหัส ${status} ส่วนหอของตัวเองได้ ${own}

TC-SEC-006 เจ้าของหอเรียก API ของผู้ดูแลระบบ
    [Documentation]    Section: สิทธิ์เจ้าของหอ
    ...    Function: กัน API ผู้ดูแลระบบ
    ...    Desc: เจ้าของหอเรียก API สร้างแพ็กเกจของผู้ดูแลระบบ ต้องถูกปฏิเสธ
    ...    Type: N
    ...    Data: บัญชีเจ้าของหอ\nAPI : GET /api/v1/super-admin/plans
    ...    Steps: 1. เข้าสู่ระบบเป็นเจ้าของหอ\n2. เรียก API แพ็กเกจของผู้ดูแลระบบ
    ...    Expected: ได้รหัส 401 หรือ 403
    Login As Owner
    ${status}=    Fetch Status    /api/v1/super-admin/plans
    Should Be True    ${status} in (401, 403)
    Record Actual    ถูกปฏิเสธด้วยรหัส ${status}
