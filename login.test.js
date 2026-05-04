const { Builder, By, until, Key } = require("selenium-webdriver");

const TIMEOUT = 100000;
const CLICK_TIMEOUT = 15000;
const DROPDOWN_ATTEMPTS = 10;

function indexedXpath(xpath, index) {
  return `(${xpath})[${index}]`;
}

function xpathLiteral(text) {
  if (!text.includes("'")) return `'${text}'`;
  if (!text.includes('"')) return `"${text}"`;
  return "concat('" + text.replace(/'/g, "',\"'\",'") + "')";
}

async function safeClick(driver, element) {
  await driver.executeScript(
    "arguments[0].scrollIntoView({block: 'center', inline: 'center'});",
    element
  );

  await driver.sleep(500);

  try {
    await element.click();
  } catch (err) {
    console.log("Normal click failed, trying JavaScript click...");
    await driver.executeScript("arguments[0].click();", element);
  }
}

async function safeDoubleClick(driver, element) {
  await driver.executeScript(
    "arguments[0].scrollIntoView({block: 'center', inline: 'center'});",
    element
  );

  await driver.sleep(300);

  try {
    await driver.actions({ async: true }).doubleClick(element).perform();
  } catch (err) {
    console.log("Double click failed, trying click twice...");
    await safeClick(driver, element);
    await driver.sleep(200);
    await safeClick(driver, element);
  }
}

async function visibleElements(driver, xpath) {
  const elements = await driver.findElements(By.xpath(xpath));
  const visible = [];

  for (let i = 0; i < elements.length; i++) {
    try {
      const displayed = await elements[i].isDisplayed();
      const text = await elements[i].getText();

      console.log(
        `Element check: xpath=${xpath}, index=${i + 1}, displayed=${displayed}, text="${text}"`
      );

      if (displayed) {
        visible.push(elements[i]);
      }
    } catch (err) {
      console.log(`Element check failed at index ${i + 1}: ${err.message}`);
    }
  }

  console.log(`Visible elements found for xpath [${xpath}]: ${visible.length}`);
  return visible;
}

async function isDisplayedSafe(element) {
  try {
    return await element.isDisplayed();
  } catch (err) {
    return false;
  }
}

async function clickElement(driver, xpath, timeout = TIMEOUT) {
  const element = await driver.wait(until.elementLocated(By.xpath(xpath)), timeout);
  await driver.wait(until.elementIsVisible(element), timeout);
  await driver.wait(until.elementIsEnabled(element), timeout);
  await safeClick(driver, element);
}

async function optionalClickElement(driver, xpath, label, timeout = 8000) {
  try {
    const elements = await driver.findElements(By.xpath(xpath));

    for (const element of elements) {
      if (await isDisplayedSafe(element)) {
        await driver.wait(until.elementIsEnabled(element), timeout);
        await safeClick(driver, element);
        console.log(`${label} clicked`);
        return true;
      }
    }

    console.log(`${label} not found or not visible. Moving next.`);
    return false;
  } catch (err) {
    console.log(`${label} optional click failed. Moving next.`);
    console.log(err.message);
    return false;
  }
}

async function clickSpanParentButton(driver, spanXpath, timeout = TIMEOUT) {
  const span = await driver.wait(until.elementLocated(By.xpath(spanXpath)), timeout);
  await driver.wait(until.elementIsVisible(span), timeout);

  const button = await span.findElement(By.xpath("ancestor::button"));
  await driver.wait(until.elementIsVisible(button), timeout);
  await driver.wait(until.elementIsEnabled(button), timeout);

  await safeClick(driver, button);
}

async function clickSvgPathParent(driver, pathXpath, timeout = TIMEOUT) {
  const path = await driver.wait(until.elementLocated(By.xpath(pathXpath)), timeout);
  const clickableParent = await path.findElement(
    By.xpath("ancestor::*[self::button or self::svg or self::span or self::div][1]")
  );

  await driver.wait(until.elementIsVisible(clickableParent), timeout);
  await safeClick(driver, clickableParent);
}

async function clickNthVisibleSpanParentButton(
  driver,
  spanXpath,
  visibleIndex = 1,
  timeout = CLICK_TIMEOUT
) {
  await driver.wait(async () => {
    const visible = await visibleElements(driver, spanXpath);
    return visible.length >= visibleIndex;
  }, timeout);

  const visible = await visibleElements(driver, spanXpath);
  const span = visible[visibleIndex - 1];

  const button = await span.findElement(By.xpath("ancestor::button"));
  await driver.wait(until.elementIsVisible(button), timeout);
  await driver.wait(until.elementIsEnabled(button), timeout);

  await safeClick(driver, button);
}

async function retryStep(stepName, fn, maxAttempts = 3) {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`Starting step: ${stepName}, attempt ${attempt}/${maxAttempts}`);
      await fn();
      console.log(`Step success: ${stepName}`);
      return true;
    } catch (err) {
      lastError = err;
      console.log(`Step failed: ${stepName}, attempt ${attempt}/${maxAttempts}`);
      console.log(`Error name: ${err.name}`);
      console.log(`Error message: ${err.message}`);

      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  throw lastError;
}

async function debugOrderButtons(driver) {
  console.log("===== DEBUG ORDER BUTTONS START =====");
  await visibleElements(driver, "//span[normalize-space()='buy']");
  await visibleElements(driver, "//span[normalize-space()='sell']");
  await visibleElements(driver, "//button[.//span[normalize-space()='buy']]");
  await visibleElements(driver, "//button[.//span[normalize-space()='sell']]");
  console.log("===== DEBUG ORDER BUTTONS END =====");
}

async function typeInput(driver, inputXpath, value, timeout = TIMEOUT) {
  const input = await driver.wait(until.elementLocated(By.xpath(inputXpath)), timeout);
  await driver.wait(until.elementIsVisible(input), timeout);
  await driver.wait(until.elementIsEnabled(input), timeout);

  await safeClick(driver, input);

  await input.sendKeys(Key.chord(Key.CONTROL, "a"));
  await input.sendKeys(Key.BACK_SPACE);

  if (value !== null && value !== undefined && value !== "") {
    await input.sendKeys(value);
    console.log(`${value} entered`);
  } else {
    console.log("Input cleared");
  }
}

async function clearInput(driver, inputXpath, timeout = TIMEOUT) {
  const input = await driver.wait(until.elementLocated(By.xpath(inputXpath)), timeout);
  await driver.wait(until.elementIsVisible(input), timeout);
  await driver.wait(until.elementIsEnabled(input), timeout);

  await safeClick(driver, input);

  await input.sendKeys(Key.chord(Key.CONTROL, "a"));
  await input.sendKeys(Key.BACK_SPACE);

  console.log("Input cleared");
}

async function getInputValue(driver, inputXpath, timeout = TIMEOUT) {
  const input = await driver.wait(until.elementLocated(By.xpath(inputXpath)), timeout);
  return await input.getAttribute("value");
}

async function waitForInputValue(driver, inputXpath, expectedValue, timeout = TIMEOUT) {
  await driver.wait(async () => {
    try {
      const value = await getInputValue(driver, inputXpath, 5000);
      return value && value.toString().trim().includes(expectedValue.toString());
    } catch (err) {
      return false;
    }
  }, timeout);

  console.log(`Confirmed input value contains: ${expectedValue}`);
}

/*
  ORIGINAL AUTOCOMPLETE FUNCTION.
  Used for Place Order BUY and SELL workflow.
*/
async function selectAutocompleteAndWait(driver, inputXpath, value, timeout = TIMEOUT) {
  const input = await driver.wait(until.elementLocated(By.xpath(inputXpath)), timeout);
  await driver.wait(until.elementIsVisible(input), timeout);
  await driver.wait(until.elementIsEnabled(input), timeout);

  await safeClick(driver, input);

  await input.sendKeys(Key.chord(Key.CONTROL, "a"));
  await input.sendKeys(Key.BACK_SPACE);
  await input.sendKeys(value);

  console.log(`Typing ${value} and waiting for dropdown option...`);

  await driver.sleep(1500);

  const optionXpath =
    `//li[contains(normalize-space(),'${value}')]` +
    ` | //*[@role='option' and contains(normalize-space(),'${value}')]` +
    ` | //*[normalize-space()='${value}']`;

  const option = await driver.wait(until.elementLocated(By.xpath(optionXpath)), timeout);
  await driver.wait(until.elementIsVisible(option), timeout);
  await driver.wait(until.elementIsEnabled(option), timeout);

  await safeClick(driver, option);

  await driver.sleep(1500);

  await driver.wait(async () => {
    try {
      const refreshedInput = await driver.wait(
        until.elementLocated(By.xpath(inputXpath)),
        5000
      );

      const currentValue = await refreshedInput.getAttribute("value");
      return currentValue && currentValue.toString().trim().includes(value.toString());
    } catch (err) {
      return false;
    }
  }, timeout);

  console.log(`${value} selected and confirmed`);
}

/*
  BO CODE FUNCTION FOR PLACE ORDER.
*/
async function selectBOCodeAndWait(driver, inputXpath, value, timeout = TIMEOUT) {
  let selected = false;

  for (let attempt = 1; attempt <= 4; attempt++) {
    console.log(`BO Code selection attempt ${attempt}: ${value}`);

    const input = await driver.wait(until.elementLocated(By.xpath(inputXpath)), timeout);
    await driver.wait(until.elementIsVisible(input), timeout);
    await driver.wait(until.elementIsEnabled(input), timeout);

    await safeClick(driver, input);

    await input.sendKeys(Key.chord(Key.CONTROL, "a"));
    await input.sendKeys(Key.BACK_SPACE);
    await input.sendKeys(value);

    await driver.sleep(2500);

    const optionXpath =
      `//li[contains(normalize-space(),'${value}')]` +
      ` | //*[@role='option' and contains(normalize-space(),'${value}')]` +
      ` | //*[contains(@id,'BO-Code-option') and contains(normalize-space(),'${value}')]` +
      ` | //*[normalize-space()='${value}']`;

    try {
      const option = await driver.wait(until.elementLocated(By.xpath(optionXpath)), 20000);
      await driver.wait(until.elementIsVisible(option), 20000);
      await driver.wait(until.elementIsEnabled(option), 20000);

      await safeClick(driver, option);

      await driver.sleep(2500);

      const refreshedInput = await driver.wait(
        until.elementLocated(By.xpath(inputXpath)),
        timeout
      );

      const currentValue = await refreshedInput.getAttribute("value");

      if (currentValue && currentValue.toString().trim().includes(value.toString())) {
        selected = true;
        console.log(`BO Code ${value} selected and confirmed`);
        break;
      }

      console.log(`BO Code value not confirmed yet. Current value: ${currentValue}`);
    } catch (err) {
      console.log(`BO Code option was not selected on attempt ${attempt}`);
      console.log(err.message);
    }

    await driver.sleep(1000);
  }

  if (!selected) {
    throw new Error(`Failed to select BO Code ${value}. Stopping test to avoid wrong order.`);
  }
}

/*
  HEADER FILTER ONLY FUNCTIONS.
*/
async function clearReactAutocompleteInputForHeader(driver, input) {
  await safeClick(driver, input);
  await input.sendKeys(Key.chord(Key.CONTROL, "a"));
  await input.sendKeys(Key.BACK_SPACE);
  await driver.sleep(300);

  await driver.executeScript(
    `
    arguments[0].value = "";
    arguments[0].dispatchEvent(new Event("input", { bubbles: true }));
    arguments[0].dispatchEvent(new Event("change", { bubbles: true }));
    `,
    input
  );

  await driver.sleep(300);
}

async function getVisibleAutocompleteOptionsForHeader(driver, value) {
  const literal = xpathLiteral(value);

  const optionXpath = [
    `//li[@role='option' and normalize-space()=${literal}]`,
    `//li[@role='option' and contains(normalize-space(), ${literal})]`,
    `//*[@role='option' and normalize-space()=${literal}]`,
    `//*[@role='option' and contains(normalize-space(), ${literal})]`,
    `//li[contains(@id,'option') and normalize-space()=${literal}]`,
    `//li[contains(@id,'option') and contains(normalize-space(), ${literal})]`,
    `//*[contains(@class,'MuiAutocomplete-option') and normalize-space()=${literal}]`,
    `//*[contains(@class,'MuiAutocomplete-option') and contains(normalize-space(), ${literal})]`
  ].join(" | ");

  return await visibleElements(driver, optionXpath);
}

async function waitForDropdownOptionsForHeader(driver, value, timeout = 10000) {
  await driver.wait(async () => {
    const options = await getVisibleAutocompleteOptionsForHeader(driver, value);
    return options.length > 0;
  }, timeout);

  return await getVisibleAutocompleteOptionsForHeader(driver, value);
}

async function selectAutocompleteHeaderFilter(driver, inputXpath, value, label = "Header Filter") {
  let lastError = null;

  for (let attempt = 1; attempt <= DROPDOWN_ATTEMPTS; attempt++) {
    try {
      console.log(`${label}: selecting "${value}", attempt ${attempt}/${DROPDOWN_ATTEMPTS}`);

      const input = await driver.wait(until.elementLocated(By.xpath(inputXpath)), TIMEOUT);
      await driver.wait(until.elementIsVisible(input), TIMEOUT);
      await driver.wait(until.elementIsEnabled(input), TIMEOUT);

      await safeDoubleClick(driver, input);
      await clearReactAutocompleteInputForHeader(driver, input);

      await input.sendKeys(value);
      await driver.sleep(1000);

      let selected = false;

      try {
        const options = await waitForDropdownOptionsForHeader(driver, value, 12000);

        if (options.length > 0) {
          await safeClick(driver, options[0]);
          selected = true;
          console.log(`${label}: visible option clicked for ${value}`);
        }
      } catch (optionErr) {
        console.log(`${label}: visible option not found, using keyboard fallback`);
      }

      if (!selected) {
        await safeDoubleClick(driver, input);
        await driver.sleep(500);
        await input.sendKeys(Key.ARROW_DOWN);
        await driver.sleep(300);
        await input.sendKeys(Key.ENTER);
        await driver.sleep(700);
      }

      await driver.sleep(1200);

      const refreshedInput = await driver.wait(until.elementLocated(By.xpath(inputXpath)), TIMEOUT);
      const currentValue = await refreshedInput.getAttribute("value");

      if (
        currentValue &&
        currentValue.toString().trim().toLowerCase().includes(value.toString().trim().toLowerCase())
      ) {
        await refreshedInput.sendKeys(Key.TAB);
        await driver.sleep(2000);

        console.log(`${label}: "${value}" selected and confirmed`);
        return true;
      }

      throw new Error(`${label}: value not confirmed. Current value: ${currentValue}`);
    } catch (err) {
      lastError = err;
      console.log(`${label}: attempt ${attempt}/${DROPDOWN_ATTEMPTS} failed`);
      console.log(err.message);
      await driver.sleep(1200);
    }
  }

  console.log(`${label}: skipped after ${DROPDOWN_ATTEMPTS} failed attempts`);
  if (lastError) console.log(`${label}: last error: ${lastError.message}`);

  return false;
}

async function setToggle(driver, toggleIndex, shouldBeChecked, timeout = TIMEOUT) {
  const toggleXpath = indexedXpath("//input[@name='toggle']", toggleIndex);
  const toggle = await driver.wait(until.elementLocated(By.xpath(toggleXpath)), timeout);
  await driver.wait(until.elementIsEnabled(toggle), timeout);

  const isChecked = await toggle.isSelected();

  if (isChecked !== shouldBeChecked) {
    await safeClick(driver, toggle);
    await driver.sleep(1000);
  }

  console.log(`Toggle ${toggleIndex} set to ${shouldBeChecked ? "BUY" : "SELL"}`);
}

function getCurrentDateForInput() {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = now.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

async function waitUntilSweetAlertClosed(driver, timeout = 30000) {
  await driver.wait(async () => {
    const overlays = await driver.findElements(
      By.xpath("//div[contains(@class,'swal-overlay') and contains(@class,'swal-overlay--show-modal')]")
    );

    for (const overlay of overlays) {
      if (await isDisplayedSafe(overlay)) {
        return false;
      }
    }

    return true;
  }, timeout);
}

async function handleSweetAlertIfPresent(driver, timeout = 30000) {
  try {
    const overlayXpath =
      "//div[contains(@class,'swal-overlay') and contains(@class,'swal-overlay--show-modal')]";

    const overlay = await driver.wait(until.elementLocated(By.xpath(overlayXpath)), 8000);
    await driver.wait(until.elementIsVisible(overlay), 8000);

    console.log("SweetAlert popup found");

    const buttonXpaths = [
      "//div[contains(@class,'swal-modal')]//button[contains(@class,'swal-button--confirm')]",
      "//div[contains(@class,'swal-modal')]//button[contains(@class,'swal-button')]",
      "//button[normalize-space()='OK']",
      "//button[normalize-space()='Ok']",
      "//button[normalize-space()='ok']"
    ];

    let clicked = false;

    for (const xpath of buttonXpaths) {
      const buttons = await driver.findElements(By.xpath(xpath));

      for (const button of buttons) {
        if (await isDisplayedSafe(button)) {
          await driver.wait(until.elementIsEnabled(button), timeout);
          await safeClick(driver, button);
          clicked = true;
          console.log("SweetAlert popup closed");
          break;
        }
      }

      if (clicked) break;
    }

    if (!clicked) {
      await driver.actions().sendKeys(Key.ENTER).perform();
      console.log("SweetAlert popup closed by ENTER key");
    }

    await waitUntilSweetAlertClosed(driver, timeout);
    await driver.sleep(1000);
  } catch (err) {
    console.log("No SweetAlert popup found. Continuing...");
  }
}

async function clickEditIfNeeded(driver) {
  try {
    await clickElement(
      driver,
      "//button[@class='MuiButtonBase-root MuiButton-root MuiButton-contained jss47 MuiButton-containedPrimary']//span[@class='MuiButton-label']//*[name()='svg']",
      10000
    );

    console.log("Edit button clicked");
  } catch (err) {
    console.log("Edit button not found or page is already editable");
  }
}

async function openNewSheet(driver) {
  await clickSvgPathParent(
    driver,
    "//*[name()='path' and contains(@d,'M14 10H2v2')]",
    15000
  );

  console.log("New sheet clicked");
}

async function openPlaceOrder(driver) {
  await clickSvgPathParent(
    driver,
    "//*[name()='path' and contains(@d,'M.5 1a.5.5')]",
    TIMEOUT
  );

  console.log("Place Order opened");
}

async function openOrderList(driver) {
  await clickSvgPathParent(
    driver,
    "//*[name()='path' and contains(@d,'M19 5v14H5')]",
    TIMEOUT
  );

  console.log("Order List opened");
}

async function openMarketDepth(driver) {
  await clickElement(
    driver,
    "//button[@id='MarketDepth']//span[@class='MuiButton-label']//*[name()='svg']"
  );

  console.log("Market Depth opened");
}

async function openTimeAndSales(driver) {
  await clickElement(
    driver,
    "//button[@id='TimeAndSales']//span[@class='MuiButton-label']//*[name()='svg']"
  );

  console.log("Time and Sales opened");
}

async function openSharePrice(driver) {
  try {
    await clickElement(
      driver,
      "//button[@id='SharePrice']//span[@class='MuiButton-label']//*[name()='svg']",
      15000
    );
  } catch (err) {
    await clickSvgPathParent(
      driver,
      "//*[name()='path' and contains(@d,'M377 105L2')]",
      TIMEOUT
    );
  }

  console.log("Share Price opened");
}

async function openAllDashboardComponents(driver) {
  await openPlaceOrder(driver);
  await driver.sleep(1000);

  await openOrderList(driver);
  await driver.sleep(1000);

  await openMarketDepth(driver);
  await driver.sleep(1000);

  await openTimeAndSales(driver);
  await driver.sleep(1000);

  await openSharePrice(driver);
  await driver.sleep(1000);

  console.log("All required dashboard components opened first with only one Place Order");
}

/*
  PLACE ORDER FUNCTION.
*/
async function fillPlaceOrderForm(driver, orderType, boCode) {
  const isBuy = orderType.toUpperCase() === "BUY";

  console.log(`Starting ${orderType} order in the SAME Place Order component...`);

  await setToggle(driver, 1, isBuy);

  await selectAutocompleteAndWait(driver, indexedXpath("//input[@id='Stock-Exchange']", 1), "DSE");
  await selectAutocompleteAndWait(driver, indexedXpath("//input[@id='Market-Type']", 1), "PUBLIC");
  await selectAutocompleteAndWait(driver, indexedXpath("//input[@id='Trading-Code']", 1), "GP");

  await driver.sleep(2500);

  await selectBOCodeAndWait(driver, indexedXpath("//input[@id='BO-Code']", 1), boCode);

  await selectAutocompleteAndWait(driver, indexedXpath("//input[@id='Price-Type']", 1), "Limit");

  await typeInput(driver, indexedXpath("//input[@placeholder='Quantity*']", 1), "10");
  await waitForInputValue(driver, indexedXpath("//input[@placeholder='Quantity*']", 1), "10");

  await typeInput(driver, indexedXpath("//input[@placeholder='Price*']", 1), "15000");
  await waitForInputValue(driver, indexedXpath("//input[@placeholder='Price*']", 1), "15000");

  await typeInput(driver, indexedXpath("//input[@placeholder='Display Quantity']", 1), "2");
  await waitForInputValue(driver, indexedXpath("//input[@placeholder='Display Quantity']", 1), "2");

  await selectAutocompleteAndWait(driver, indexedXpath("//input[@id='Order-Time-in-Force']", 1), "Day");
  await selectAutocompleteAndWait(driver, indexedXpath("//input[@id='ExecutionInstruction']", 1), "Release");

  await clearInput(driver, indexedXpath("//input[@placeholder='Minimum Quantity']", 1));

  await waitForInputValue(driver, indexedXpath("//input[@id='BO-Code']", 1), boCode);
  await waitForInputValue(driver, indexedXpath("//input[@id='Stock-Exchange']", 1), "DSE");
  await waitForInputValue(driver, indexedXpath("//input[@id='Market-Type']", 1), "PUBLIC");
  await waitForInputValue(driver, indexedXpath("//input[@id='Trading-Code']", 1), "GP");
  await waitForInputValue(driver, indexedXpath("//input[@id='Price-Type']", 1), "Limit");
  await waitForInputValue(driver, indexedXpath("//input[@placeholder='Quantity*']", 1), "10");
  await waitForInputValue(driver, indexedXpath("//input[@placeholder='Price*']", 1), "15000");

  console.log(`${orderType} order form filled and verified in same Place Order component`);
}

async function submitBuyOrder(driver) {
  await debugOrderButtons(driver);

  await retryStep("Click BUY button from same Place Order widget", async () => {
    await clickNthVisibleSpanParentButton(driver, "//span[normalize-space()='buy']", 1, CLICK_TIMEOUT);
  }, 3);

  console.log("Buy clicked");

  await retryStep("Click BUY confirmation button", async () => {
    await clickElement(driver, "//button[normalize-space()='BUY']", CLICK_TIMEOUT);
  }, 3);

  console.log("BUY confirmation clicked");

  await handleSweetAlertIfPresent(driver);
}

async function submitSellOrder(driver) {
  await debugOrderButtons(driver);

  await retryStep("Click SELL button from same Place Order widget", async () => {
    await clickNthVisibleSpanParentButton(driver, "//span[normalize-space()='sell']", 1, CLICK_TIMEOUT);
  }, 3);

  console.log("Sell clicked");

  await retryStep("Click SELL confirmation button", async () => {
    await clickElement(driver, "//button[normalize-space()='SELL']", CLICK_TIMEOUT);
  }, 3);

  console.log("SELL confirmation clicked");

  await handleSweetAlertIfPresent(driver);
}

/*
  ORDER LIST FILTER.
  boCode is dynamic:
  after BUY = 10
  after SELL = 100
*/
async function fillOrderListSearch(driver, boCode) {
  console.log(`Starting Order List header filter with BO Code ${boCode}...`);

  await selectAutocompleteHeaderFilter(
    driver,
    indexedXpath("//input[@id='Stock-Exchange']", 2),
    "DSE",
    "Order List Stock Exchange"
  );

  await selectAutocompleteHeaderFilter(
    driver,
    indexedXpath("//input[@id='BO-Code']", 2),
    boCode,
    `Order List BO Code ${boCode}`
  );

  await selectAutocompleteHeaderFilter(
    driver,
    indexedXpath("//input[@id='Trading-Code']", 2),
    "GP",
    "Order List Trading Code"
  );

  console.log(`Order List header filter completed with BO Code ${boCode}`);
}

/*
  MARKET DEPTH FILTER.
  This runs after BUY and again after SELL.
*/
async function fillMarketDepth(driver) {
  console.log("Starting Market Depth header filter...");

  await selectAutocompleteHeaderFilter(
    driver,
    "//div[contains(@class,'market-depth-content-container')]//input[@id='Stock-Exchange']",
    "DSE",
    "Market Depth Stock Exchange"
  );

  await selectAutocompleteHeaderFilter(
    driver,
    "//input[@id='Trading-Code-market-depth']",
    "GP",
    "Market Depth Trading Code"
  );

  await selectAutocompleteHeaderFilter(
    driver,
    "//div[contains(@class,'market-depth-content-container')]//input[@id='Market-Type']",
    "PUBLIC",
    "Market Depth Market Type"
  );

  console.log("Market Depth header filter completed");
}

/*
  TIME AND SALES FILTER.
  This runs only after BUY and SELL workflows are complete.
*/
async function fillTimeAndSales(driver) {
  console.log("Starting Time and Sales header filter...");

  const currentDate = getCurrentDateForInput();

  await selectAutocompleteHeaderFilter(
    driver,
    "//div[contains(@class,'time-and-sales-content-container')]//input[@id='Stock-Exchange']",
    "DSE",
    "Time and Sales Stock Exchange"
  );

  await selectAutocompleteHeaderFilter(
    driver,
    "//div[contains(@class,'time-and-sales-content-container')]//input[@id='Trading-Code']",
    "GP",
    "Time and Sales Trading Code"
  );

  try {
    await clickElement(driver, "//button[@class='example-custom-input']", 10000);
    await driver.sleep(800);

    const active = await driver.switchTo().activeElement();

    try {
      await active.sendKeys(Key.chord(Key.CONTROL, "a"));
      await active.sendKeys(currentDate);
      await active.sendKeys(Key.ENTER);
      console.log(`Time and Sales date typed: ${currentDate}`);
    } catch (dateErr) {
      console.log("Date popup/input does not accept typing. Date button clicked only.");
    }
  } catch (err) {
    console.log("Time and Sales date button not found. Continuing...");
  }

  await driver.sleep(1500);

  console.log("Time and Sales header filter completed");
}

/*
  SHARE PRICE helper:
  Try to put GP in Share Price trading-code field.
  If no Share Price trading-code field is found, return false.
*/
async function putGPInSharePriceTradingCode(driver, label = "Share Price GP") {
  const possibleTradingCodeXPaths = [
    "//div[contains(@class,'share-price')]//input[@id='Trading-Code']",
    "//div[contains(@class,'sharePrice')]//input[@id='Trading-Code']",
    "//div[contains(@class,'share-price')]//input[contains(@id,'Trading-Code')]",
    indexedXpath("//input[@id='Trading-Code']", 4),
    indexedXpath("//input[@id='Trading-Code']", 5),
    "//input[@id='Trading-Code']"
  ];

  for (const xpath of possibleTradingCodeXPaths) {
    try {
      console.log(`${label}: trying xpath ${xpath}`);

      const elements = await driver.findElements(By.xpath(xpath));
      let targetInput = null;

      for (const element of elements) {
        if (await isDisplayedSafe(element)) {
          targetInput = element;
          break;
        }
      }

      if (!targetInput) {
        console.log(`${label}: no visible input for xpath ${xpath}`);
        continue;
      }

      await driver.wait(until.elementIsEnabled(targetInput), 10000);

      await safeDoubleClick(driver, targetInput);
      await targetInput.sendKeys(Key.chord(Key.CONTROL, "a"));
      await targetInput.sendKeys(Key.BACK_SPACE);
      await targetInput.sendKeys("GP");

      await driver.sleep(1200);

      const optionXpath =
        "//li[@role='option' and normalize-space()='GP']" +
        " | //*[@role='option' and normalize-space()='GP']" +
        " | //li[contains(@id,'option') and normalize-space()='GP']" +
        " | //*[contains(@class,'MuiAutocomplete-option') and normalize-space()='GP']";

      const options = await visibleElements(driver, optionXpath);

      if (options.length > 0) {
        await safeClick(driver, options[0]);
        await driver.sleep(1000);
        console.log(`${label}: GP option clicked`);
      } else {
        console.log(`${label}: GP option not visible, pressing ARROW_DOWN + ENTER fallback`);
        await targetInput.sendKeys(Key.ARROW_DOWN);
        await driver.sleep(300);
        await targetInput.sendKeys(Key.ENTER);
        await driver.sleep(1000);
      }

      console.log(`${label}: GP put successfully`);
      return true;
    } catch (err) {
      console.log(`${label}: failed for one xpath`);
      console.log(err.message);
      await driver.sleep(800);
    }
  }

  console.log(`${label}: GP field not found or not usable`);
  return false;
}

/*
  SHARE PRICE FILTER.
  This runs last.
  1. Try putting GP first.
  2. If GP field is not found, enlarge Share Price with relative XPath.
  3. Put GP again.
  4. End.
*/
async function fillSharePrice(driver) {
  console.log("Starting Share Price GP workflow...");

  const gpBeforeEnlarge = await putGPInSharePriceTradingCode(
    driver,
    "Share Price before enlarge"
  );

  if (gpBeforeEnlarge) {
    console.log("Share Price GP completed before enlarge. No need to enlarge.");
    return;
  }

  console.log("Share Price GP field not found before enlarge. Enlarging Share Price window now...");

  await retryStep("Enlarge Share Price window using relative XPath", async () => {
    await clickElement(
      driver,
      "//body/div[@id='root']/div/div/div[@class='jss19']/div[@class='jss26']/div[contains(@class,'custom-scrollbar-dark')]/div[@data-darkmode='true']/div[@class='react-tabs']/div[@id='react-tabs-1']/div[@class='popupContainer']/div[@class='MuiBox-root jss61 mainBoxContainer']/div[@class='react-draggable react-draggable-dragged']/div[@class='MuiPaper-root MuiCard-root MuiPaper-elevation1 MuiPaper-rounded']/div[@class='MuiBox-root jss176 curser-move component-title']/div/button[1]/span[1]//*[name()='svg']",
      20000
    );
  }, 3);

  await driver.sleep(2500);

  const gpAfterEnlarge = await putGPInSharePriceTradingCode(
    driver,
    "Share Price after enlarge"
  );

  if (gpAfterEnlarge) {
    console.log("Share Price GP completed after enlarge.");
  } else {
    console.log("Share Price GP was still not found after enlarge. Moving on.");
  }
}

async function loginPageFullTest() {
  const driver = await new Builder().forBrowser("chrome").build();

  try {
    await driver.manage().window().maximize();

    await driver.get("https://uat.xfltrade.com/app/Login");

    const userId = await driver.wait(
      until.elementLocated(By.xpath("//input[@id='loginId']")),
      10000
    );

    const password = await driver.wait(
      until.elementLocated(By.xpath("//input[@id='password']")),
      10000
    );

    await userId.clear();
    await userId.sendKeys("xfl_admin_toha");

    await password.clear();
    await password.sendKeys("Toha@2000");

    await clickSpanParentButton(
      driver,
      "//span[@class='MuiButton-label'][normalize-space()='Login']"
    );

    console.log("Login clicked");

    await driver.wait(
      until.elementLocated(By.xpath("//span[normalize-space()='Proceed']")),
      TIMEOUT
    );

    await clickSpanParentButton(driver, "//span[normalize-space()='Proceed']");

    await driver.wait(until.urlContains("dashboard"), 150000);
    console.log("Login successful, landed on dashboard");

    await clickEditIfNeeded(driver);

    await openNewSheet(driver);
    await driver.sleep(1000);

    await selectAutocompleteAndWait(
      driver,
      "//input[@id='broker-list']",
      "UCB Stock",
      150000
    );

    await selectAutocompleteAndWait(
      driver,
      "//input[@id='Role']",
      "Trader",
      150000
    );

    await selectAutocompleteAndWait(
      driver,
      "//input[@id='ScreenSize']",
      "Desktop Regular",
      150000
    );

    await openAllDashboardComponents(driver);

    /*
      WORKFLOW STEP 1:
      Place BUY order.
    */
    await fillPlaceOrderForm(driver, "BUY", "10");
    await submitBuyOrder(driver);

    await driver.sleep(2000);
    await handleSweetAlertIfPresent(driver);

    /*
      WORKFLOW STEP 2:
      After BUY, filter Order List with BO Code 10.
    */
    await fillOrderListSearch(driver, "10");

    /*
      WORKFLOW STEP 3:
      After BUY, filter Market Depth.
    */
    await fillMarketDepth(driver);

    /*
      WORKFLOW STEP 4:
      Place SELL order.
    */
    await fillPlaceOrderForm(driver, "SELL", "100");
    await submitSellOrder(driver);

    await driver.sleep(2000);
    await handleSweetAlertIfPresent(driver);

    /*
      WORKFLOW STEP 5:
      After SELL, filter Order List with BO Code 100.
    */
    await fillOrderListSearch(driver, "100");

    /*
      WORKFLOW STEP 6:
      After SELL, filter Market Depth again.
    */
    await fillMarketDepth(driver);

    /*
      WORKFLOW STEP 7:
      After both BUY and SELL are done, filter Time and Sales.
    */
    await fillTimeAndSales(driver);

    /*
      WORKFLOW STEP 8:
      Lastly, filter Share Price.
    */
    await fillSharePrice(driver);

    console.log("Full automation completed successfully with required workflow order.");
  } catch (err) {
    console.error("Test failed:", err);
  } finally {
    // Keep browser open for debugging.
    // Uncomment when you want browser to close automatically.
    // await driver.quit();
  }
}

loginPageFullTest();