*** Settings ***
Documentation     RESPONSIVE FUNCTION — หน้าจอมือถือ 375 px และแท็บเล็ต 820 px
Metadata          Sheet    Test สิทธิ์และมือถือ
Metadata          Pre-condition    1. เปิด Chrome จำลองมือถือ 375 x 812 px (หรือแท็บเล็ต 820 x 1000 px ตามที่ระบุ)\n2. เข้าสู่ระบบด้วยบัญชีตามที่ระบุในแต่ละกรณี
Resource          ../common.robot
Suite Setup       Open Mobile Browser
Suite Teardown    Close All Browsers
Test Teardown     Capture Evidence


*** Test Cases ***
TC-MOB-001 หน้าเข้าสู่ระบบบนมือถือ
    [Documentation]    Section: มือถือ
    ...    Function: แสดงผลหน้าเข้าสู่ระบบ
    ...    Desc: หน้าเข้าสู่ระบบบนจอ 375 px ต้องไม่ล้นจอและเห็นปุ่มเข้าสู่ระบบ
    ...    Type: P
    ...    Data: ขนาดจอ 375 x 812 px
    ...    Steps: 1. เปิด /login บนมือถือ
    ...    Expected: ไม่มีแถบเลื่อนแนวนอน และเห็นปุ่ม "เข้าสู่ระบบ"
    Delete All Cookies
    Go To    ${BASE_URL}/login
    Wait Until Element Is Visible    css:button[type=submit]
    ${widths}=    Page Should Have No Horizontal Scroll
    Record Actual    เนื้อหากว้าง ${widths}[0] px ไม่เกินจอ ${widths}[1] px และเห็นปุ่มเข้าสู่ระบบ

TC-MOB-002 หน้าหลักผู้เช่าบนมือถือ
    [Documentation]    Section: มือถือ
    ...    Function: แสดงผลหน้าผู้เช่า
    ...    Desc: หน้าหลักผู้เช่าบนมือถือต้องไม่ล้นจอ และมีเมนูด้านล่างให้กด
    ...    Type: P
    ...    Data: บัญชีผู้เช่า · ขนาดจอ 375 x 812 px
    ...    Steps: 1. เข้าสู่ระบบเป็นผู้เช่า\n2. ดูหน้า /tenant
    ...    Expected: ไม่มีแถบเลื่อนแนวนอน และเห็นเมนูด้านล่างของจอ
    Login As Tenant
    Go To Page    /tenant
    Wait Until Element Is Visible    css:.tenant-mobile-navigation
    ${widths}=    Page Should Have No Horizontal Scroll
    Record Actual    เนื้อหากว้าง ${widths}[0] px ไม่เกินจอ และมีเมนูด้านล่าง

TC-MOB-003 เมนูแฮมเบอร์เกอร์ของเจ้าของหอ
    [Documentation]    Section: มือถือ
    ...    Function: เมนูแบบลิ้นชัก
    ...    Desc: บนมือถือกดปุ่มเมนูแล้วต้องเห็นเมนูของหอ และกดไปหน้าผังห้องได้
    ...    Type: P
    ...    Data: บัญชีเจ้าของหอ · ขนาดจอ 375 x 812 px
    ...    Steps: 1. เข้าสู่ระบบเป็นเจ้าของหอ\n2. กดปุ่ม "เปิดเมนู"\n3. กด "ผังห้องพัก"
    ...    Expected: เมนูเลื่อนออกมา และไปหน้าผังห้องได้โดยหน้าไม่ล้นจอ
    Login As Owner
    Go To Page    ${OWNER_HOME}
    Click Element    xpath:(//button[@aria-label="เปิดเมนู"])[last()]
    Wait Until Element Is Visible    xpath://aside//a[contains(normalize-space(.),"ผังห้องพัก")]
    Click Element    xpath://aside//a[contains(normalize-space(.),"ผังห้องพัก")]
    Wait Until Location Contains    /rooms
    ${widths}=    Page Should Have No Horizontal Scroll
    Record Actual    เปิดเมนูแล้วไปหน้าผังห้องได้ เนื้อหากว้าง ${widths}[0] px ไม่เกินจอ

TC-MOB-004 หัวหน้าผู้ดูแลระบบบนมือถือ
    [Documentation]    Section: มือถือ
    ...    Function: หัวหน้าและตาราง
    ...    Desc: บนมือถือกระดิ่งต้องอยู่แถวเดียวกับชื่อหน้า และคอลัมน์ปุ่มจัดการของตารางต้องตรึงไว้ขอบขวา
    ...    Type: P
    ...    Data: บัญชีผู้ดูแลระบบ · หน้าแพ็กเกจ · ขนาดจอ 375 x 812 px
    ...    Steps: 1. เข้าสู่ระบบเป็นผู้ดูแลระบบ\n2. เปิด /super-admin/plans\n3. วัดตำแหน่งกระดิ่งเทียบชื่อหน้า และดูคอลัมน์ "จัดการ"
    ...    Expected: กระดิ่งอยู่แถวเดียวกับชื่อหน้า และคอลัมน์ "จัดการ" เป็น position: sticky
    ...    Remark: ทดสอบซ้ำจุดที่เคยพบว่ากระดิ่งหล่นไปอยู่แถวของตัวเอง และต้องปัดตารางเพื่อหาปุ่มจัดการ
    Login As Super Admin
    Go To Page    /super-admin/plans
    Wait Until Element Is Visible    css:h1
    ${gap}=    Execute Javascript
    ...    const h = document.querySelector('h1').getBoundingClientRect(); const b = document.querySelector('.super-admin-page-bell').getBoundingClientRect();
    ...    return Math.round(Math.abs(b.top - h.top));
    Should Be True    ${gap} < 40    msg=กระดิ่งอยู่ห่างจากชื่อหน้า ${gap} px ในแนวตั้ง
    ${sticky}=    Execute Javascript    return getComputedStyle(document.querySelector('.admin-resource tbody tr td:last-child')).position;
    Should Be Equal    ${sticky}    sticky
    Record Actual    กระดิ่งห่างจากชื่อหน้า ${gap} px (แถวเดียวกัน) และคอลัมน์จัดการเป็น ${sticky}

TC-MOB-005 แถบเครื่องมือตารางบนแท็บเล็ต
    [Documentation]    Section: แท็บเล็ต
    ...    Function: แถบค้นหาและปุ่มเหนือตาราง
    ...    Desc: บนจอ 820 px ปุ่ม "เพิ่มแอดมินประจำหอ" ต้องอยู่บรรทัดเดียว ไม่ถูกบีบจนตัดคำ
    ...    Type: P
    ...    Data: บัญชีผู้ดูแลระบบ · หน้าบัญชีเจ้าของหอ · ขนาดจอ 820 x 1000 px
    ...    Steps: 1. ปรับจอเป็น 820 px\n2. เปิด /super-admin/accounts\n3. วัดความสูงของปุ่ม
    ...    Expected: ปุ่มสูงไม่เกิน 1 บรรทัด และหน้าไม่ล้นจอ
    ...    Remark: ทดสอบซ้ำจุดที่เคยพบว่าปุ่มถูกบีบเป็น 5 บรรทัด
    Close All Browsers
    Open Test Browser    820    1000
    Login As Super Admin
    Go To Page    /super-admin/accounts
    ${button}=    Set Variable    xpath://button[contains(normalize-space(.),"เพิ่มแอดมินประจำหอ")]
    Wait Until Element Is Visible    ${button}
    ${height}=    Execute Javascript    return Math.round([...document.querySelectorAll('button')].find((b) => b.innerText.includes('เพิ่มแอดมินประจำหอ')).getBoundingClientRect().height);
    Should Be True    ${height} <= 48    msg=ปุ่มสูง ${height} px แปลว่าข้อความถูกตัดเป็นหลายบรรทัด
    ${widths}=    Page Should Have No Horizontal Scroll
    Record Actual    ปุ่มสูง ${height} px (บรรทัดเดียว) และเนื้อหากว้าง ${widths}[0] px ไม่เกินจอ
