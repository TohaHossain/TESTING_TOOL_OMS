const { By, until, Key } = require("selenium-webdriver");
const {
  SHARE_PRICE_ENLARGE_XPATHS,
  SHARE_PRICE_TRADING_CODE_INPUT_XPATHS,
  indexedXpath,
  xpathLiteral
} = require("../config/locators");
const {
  safeClick,
  safeDoubleClick,
  visibleElements,
  isDisplayedSafe,
  clickElement
} = require("../core/browserActions");
const {
  selectOrderListBOCodeExact,
  selectAutocompleteHeaderFilter
} = require("../core/autocomplete");

function getCurrentDateForInput() {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = now.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

async function fillOrderListSearch(driver, boCode) {
  const expectedBOCode = boCode.toString().trim();
  console.log(`Starting Order List header filter with BO Code ${expectedBOCode}...`);

  await selectAutocompleteHeaderFilter(
    driver,
    indexedXpath("//input[@id='Stock-Exchange']", 2),
    "DSE",
    "Order List Stock Exchange"
  );

  await selectOrderListBOCodeExact(driver, expectedBOCode);

  await selectAutocompleteHeaderFilter(
    driver,
    indexedXpath("//input[@id='Trading-Code']", 2),
    "GP",
    "Order List Trading Code"
  );

  console.log(`Order List header filter completed with BO Code ${expectedBOCode}`);
}

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

async function putGPInSharePriceTradingCode(driver, label = "Share Price GP") {
  const possibleTradingCodeXPaths = SHARE_PRICE_TRADING_CODE_INPUT_XPATHS;

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
        await targetInput.sendKeys(Key.TAB);
        await driver.sleep(1500);
        console.log(`${label}: GP entry sent. Proceeding without input value confirmation.`);
        return true;
      }

      console.log(`${label}: GP option not visible, pressing ARROW_DOWN + ENTER fallback`);
      await targetInput.sendKeys(Key.ARROW_DOWN);
      await driver.sleep(300);
      await targetInput.sendKeys(Key.ENTER);
      await driver.sleep(1000);
      await targetInput.sendKeys(Key.TAB);
      await driver.sleep(1500);
      console.log(`${label}: GP keyboard fallback sent. Proceeding without input value confirmation.`);
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

async function enlargeSharePriceWindow(driver) {
  for (const xpath of SHARE_PRICE_ENLARGE_XPATHS) {
    try {
      console.log(`Share Price enlarge: trying xpath ${xpath}`);
      await clickElement(driver, xpath, 20000);
      console.log("Share Price enlarge clicked");
      return true;
    } catch (err) {
      console.log(`Share Price enlarge failed for one xpath: ${err.message}`);
    }
  }

  try {
    const titleText = xpathLiteral("Share Price");
    const headerXpaths = [
      `//*[normalize-space()=${titleText}]/ancestor::div[contains(@class,'component-title')][1]`,
      `//*[normalize-space()=${titleText}]/ancestor::div[contains(@class,'curser-move')][1]`,
      `//*[contains(normalize-space(), ${titleText})]/ancestor::div[contains(@class,'component-title')][1]`,
      `//*[contains(normalize-space(), ${titleText})]/ancestor::div[contains(@class,'curser-move')][1]`
    ];

    for (const headerXpath of headerXpaths) {
      const headers = await driver.findElements(By.xpath(headerXpath));

      for (const header of headers) {
        if (!(await isDisplayedSafe(header))) continue;

        const buttons = await header.findElements(By.xpath(".//button"));
        for (const button of buttons) {
          if (!(await isDisplayedSafe(button))) continue;

          console.log(`Share Price enlarge: trying generic header button from ${headerXpath}`);
          await safeClick(driver, button);
          console.log("Share Price enlarge clicked by generic header button");
          return true;
        }
      }
    }
  } catch (err) {
    console.log(`Share Price enlarge generic fallback failed: ${err.message}`);
  }

  return false;
}

async function restoreSharePriceWindow(driver) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    console.log(`Share Price restore size attempt ${attempt}/3`);

    const restored = await enlargeSharePriceWindow(driver);
    if (restored) {
      console.log("Share Price restored to previous size.");
      await driver.sleep(1500);
      return true;
    }

    await driver.sleep(1000);
  }

  console.log("Share Price restore size button was not clicked. Continuing.");
  return false;
}

async function fillSharePrice(driver) {
  console.log("Starting Share Price GP workflow...");

  let enlarged = false;
  for (let attempt = 1; attempt <= 3; attempt++) {
    console.log(`Share Price enlarge before GP attempt ${attempt}/3`);
    enlarged = await enlargeSharePriceWindow(driver);

    if (enlarged) {
      break;
    }

    await driver.sleep(1000);
  }

  if (enlarged) {
    console.log("Share Price enlarged before GP entry.");
    await driver.sleep(2500);
  } else {
    console.log("Share Price enlarge button was not clicked. Skipping Share Price search.");
    return {
      ready: false,
      enlarged: false
    };
  }

  const gpAfterEnlarge = await putGPInSharePriceTradingCode(
    driver,
    "Share Price after enlarge"
  );

  if (gpAfterEnlarge) {
    console.log("Share Price GP completed.");
    return {
      ready: true,
      enlarged: true
    };
  }

  console.log("Share Price GP was not found after enlarge attempt. Skipping Share Price segment.");
  return {
    ready: false,
    enlarged: true
  };
}

module.exports = {
  fillOrderListSearch,
  fillMarketDepth,
  fillTimeAndSales,
  fillSharePrice,
  restoreSharePriceWindow
};
