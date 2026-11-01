*** Settings ***
Documentation     ของที่ใช้ร่วมกันทุกชุดทดสอบ: ที่อยู่ระบบทดสอบ บัญชีทดสอบ การเปิดเบราว์เซอร์ การเข้าสู่ระบบ และการเก็บหลักฐาน
...
...               ระบบทดสอบเปิดด้วย robot-tests/start-app.sh (พอร์ต 3400) บนฐานข้อมูลที่ robot-tests/prepare.sh เตรียมไว้
...               บัญชีทดสอบทุกบัญชีถูกสร้างจาก robot-tests/robot.env ค่าข้างล่างต้องตรงกัน
Library           SeleniumLibrary    timeout=15s    implicit_wait=0s    run_on_failure=Nothing
Library           String
Library           Collections
Library           DateTime


*** Variables ***
${BROWSER}              headlesschrome
${BASE_URL}             http://localhost:3400
${PROPERTY_ID}          cc744716b4623c1ba44bc3b53
${OWNER_HOME}           /admin/properties/${PROPERTY_ID}

${SUPER_EMAIL}          robot.super@nestly.test
${SUPER_PASSWORD}       Robot-Super-2026
${OWNER_EMAIL}          robot.owner@nestly.test
${OWNER_PASSWORD}       Robot-Owner-2026
${TENANT_EMAIL}         somchai@nestly.demo
${TENANT_PASSWORD}      Robot-Tenant-2026
${TENANT_NAME}          สมชาย ใจดี

${DIALOG}               css:[role=dialog]


*** Keywords ***
Open Test Browser
    [Documentation]    เปิด Chrome แบบไม่มีหน้าต่าง ขนาดจอโน้ตบุ๊กทั่วไป (เปลี่ยนได้ด้วย --variable BROWSER:chrome)
    [Arguments]    ${width}=1366    ${height}=900
    Open Browser    ${BASE_URL}/login    ${BROWSER}
    ...    options=add_argument("--window-size=${width},${height}");add_argument("--lang=th-TH")
    Set Window Size    ${width}    ${height}

Open Mobile Browser
    [Documentation]    จำลองมือถือจอ 375 x 812 พร้อม user agent ของมือถือ
    ${opts}=    Set Variable
    ...    add_argument("--window-size=375,812");add_argument("--lang=th-TH");add_experimental_option("mobileEmulation", {"deviceMetrics": {"width": 375, "height": 812, "pixelRatio": 2}, "userAgent": "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Mobile Safari/537.36"})
    Open Browser    ${BASE_URL}/login    ${BROWSER}    options=${opts}

Go To Page
    [Documentation]    เปิดหน้าในระบบทดสอบ แล้วรอให้โครงหลอกระหว่างโหลดหายไป
    [Arguments]    ${path}
    Go To    ${BASE_URL}${path}
    Wait Until Page Does Not Contain Element    css:.loading-skeleton    timeout=20s

Fill Login Form
    [Arguments]    ${email}    ${password}
    Wait Until Element Is Visible    css:input[type=email]
    Input Text    css:input[type=email]    ${email}
    Input Password    css:input[type=password]    ${password}
    Click Button    css:button[type=submit]

Login As
    [Documentation]    เข้าสู่ระบบด้วยอีเมลและรหัสผ่าน ถ้าเป็นการเข้าครั้งแรกจะยอมรับข้อตกลงที่จำเป็นให้
    [Arguments]    ${email}    ${password}
    Delete All Cookies
    Go To    ${BASE_URL}/login
    # หน้าเข้าสู่ระบบอาจยังโหลด JavaScript ไม่เสร็จในรอบแรก ลองซ้ำได้
    Wait Until Keyword Succeeds    3x    2s    Fill Login Form    ${email}    ${password}
    Wait Until Location Does Not Contain    /login    timeout=20s
    Accept Legal If Asked

Accept Legal If Asked
    ${url}=    Get Location
    IF    '/legal/accept' in '''${url}'''
        Execute Javascript    document.querySelectorAll('input[type=checkbox]').forEach((box, index) => { if (index < 2 && !box.checked) box.click(); })
        Click Button    css:button[type=submit]
        Wait Until Location Does Not Contain    /legal/accept    timeout=20s
    END

Login As Super Admin
    Login As    ${SUPER_EMAIL}    ${SUPER_PASSWORD}

Login As Owner
    Login As    ${OWNER_EMAIL}    ${OWNER_PASSWORD}

Login As Tenant
    Login As    ${TENANT_EMAIL}    ${TENANT_PASSWORD}

Click Button With Text
    [Documentation]    กดปุ่มจากข้อความบนปุ่มหรือ aria-label (ตัวแรกที่มองเห็น)
    [Arguments]    ${text}
    ${locator}=    Set Variable    xpath://button[normalize-space(.)="${text}" or @aria-label="${text}"]
    Wait Until Element Is Visible    ${locator}
    Click Element    ${locator}

Click Dialog Button
    [Documentation]    กดปุ่มในกล่องป็อปอัพที่เปิดอยู่
    [Arguments]    ${text}
    ${locator}=    Set Variable    xpath://*[@role="dialog"]//button[normalize-space(.)="${text}" or @aria-label="${text}"]
    Wait Until Element Is Visible    ${locator}
    Click Element    ${locator}

Field By Label
    [Documentation]    หาช่องกรอกจากข้อความของ label ที่ผูกกับช่องนั้น (คืนเป็น WebElement)
    [Arguments]    ${label}
    Wait Until Keyword Succeeds    10x    1s    Label Should Exist    ${label}
    ${element}=    Execute Javascript
    ...    return [...document.querySelectorAll('input,textarea')].find((field) => field.offsetParent !== null && field.labels && [...field.labels].some((label) => label.innerText.trim().startsWith(arguments[0])));
    ...    ARGUMENTS    ${label}
    RETURN    ${element}

Label Should Exist
    [Arguments]    ${label}
    ${found}=    Execute Javascript
    ...    return [...document.querySelectorAll('input,textarea')].some((field) => field.offsetParent !== null && field.labels && [...field.labels].some((label) => label.innerText.trim().startsWith(arguments[0])));
    ...    ARGUMENTS    ${label}
    Should Be True    ${found}    msg=ไม่พบช่องกรอกที่มีป้าย "${label}"

Input By Label
    [Arguments]    ${label}    ${value}
    ${field}=    Field By Label    ${label}
    Clear Element Text    ${field}
    Input Text    ${field}    ${value}

Field Validation Message
    [Documentation]    ข้อความที่เบราว์เซอร์จะแจ้งสำหรับช่องนั้น ค่าว่างแปลว่าผ่านการตรวจ
    [Arguments]    ${css}
    ${message}=    Execute Javascript    return document.querySelector(arguments[0]).validationMessage;    ARGUMENTS    ${css}
    RETURN    ${message}

Page Should Have No Horizontal Scroll
    ${widths}=    Execute Javascript    return [document.documentElement.scrollWidth, document.documentElement.clientWidth];
    Should Be True    ${widths}[0] <= ${widths}[1] + 1    msg=เนื้อหากว้าง ${widths}[0] px เกินจอ ${widths}[1] px
    RETURN    ${widths}

Toast Should Say
    [Arguments]    ${text}
    Wait Until Element Contains    css:.toast-region    ${text}    timeout=20s

Fetch Status
    [Documentation]    เรียก API จากหน้าเว็บด้วยคุกกี้ของผู้ใช้ที่เข้าสู่ระบบอยู่ แล้วคืนรหัสสถานะ HTTP
    [Arguments]    ${path}
    ${status}=    Execute Async Javascript
    ...    const done = arguments[arguments.length - 1];
    ...    fetch(arguments[0], { credentials: 'same-origin', cache: 'no-store' }).then((response) => done(response.status)).catch(() => done(0));
    ...    ARGUMENTS    ${path}
    RETURN    ${status}

Unique Suffix
    ${stamp}=    Get Current Date    result_format=%m%d%H%M%S
    RETURN    ${stamp}

Record Actual
    [Documentation]    บันทึกผลที่เกิดขึ้นจริงไว้ในข้อความของเคส รายงาน Excel อ่านไปใส่ช่อง Remark
    [Arguments]    ${text}
    Set Test Message    ${text}

Capture Evidence
    [Documentation]    ภาพหน้าจอท้ายทุกเคส ชื่อไฟล์เป็นรหัสเคส ใช้เป็นหลักฐานในรายงาน
    ${id}=    Fetch From Left    ${TEST NAME}    ${SPACE}
    Run Keyword And Ignore Error    Capture Page Screenshot    screenshots/${id}.png
