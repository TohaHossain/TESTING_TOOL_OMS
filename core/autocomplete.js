const { By, until, Key } = require("selenium-webdriver");
const { TIMEOUT, DROPDOWN_ATTEMPTS } = require("../config/runtime");
const { indexedXpath, xpathLiteral } = require("../config/locators");
const {
  safeClick,
  safeDoubleClick,
  visibleElements
} = require("./browserActions");

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

function escapeRegExp(value) {
  return value.toString().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function boCodeTextMatches(text, expected) {
  const cleanText = (text || "").toString().trim();
  const cleanExpected = expected.toString().trim();
  const regex = new RegExp(`^${escapeRegExp(cleanExpected)}(?!\\d)`);
  return regex.test(cleanText);
}

async function selectOrderListBOCodeExact(driver, boCode) {
  const inputXpath = indexedXpath("//input[@id='BO-Code']", 2);
  const expected = boCode.toString().trim();
  const optionXpath = [
    "//li[@role='option']",
    "//*[@role='option']",
    "//li[contains(@id,'BO-Code-option')]",
    "//*[contains(@class,'MuiAutocomplete-option')]"
  ].join(" | ");

  for (let attempt = 1; attempt <= DROPDOWN_ATTEMPTS; attempt++) {
    try {
      console.log(
        `Order List BO Code exact: selecting "${expected}", attempt ${attempt}/${DROPDOWN_ATTEMPTS}`
      );

      const input = await driver.wait(until.elementLocated(By.xpath(inputXpath)), TIMEOUT);
      await driver.wait(until.elementIsVisible(input), TIMEOUT);
      await driver.wait(until.elementIsEnabled(input), TIMEOUT);

      await safeDoubleClick(driver, input);
      await clearReactAutocompleteInputForHeader(driver, input);
      await input.sendKeys(expected);
      await driver.sleep(1200);

      const options = await visibleElements(driver, optionXpath);
      let matchedOption = null;

      for (const option of options) {
        try {
          const text = (await option.getText()).trim();
          console.log(`Order List BO Code option visible: "${text}"`);

          if (boCodeTextMatches(text, expected)) {
            matchedOption = option;
            break;
          }
        } catch (err) {
          console.log(`Order List BO Code option read failed: ${err.message}`);
        }
      }

      if (!matchedOption) {
        throw new Error(`No exact BO Code option matched ${expected}`);
      }

      await safeClick(driver, matchedOption);
      await driver.sleep(1200);

      const refreshedInput = await driver.wait(until.elementLocated(By.xpath(inputXpath)), TIMEOUT);
      const currentValue = (await refreshedInput.getAttribute("value") || "").trim();

      if (!boCodeTextMatches(currentValue, expected)) {
        throw new Error(
          `Order List BO Code value mismatch. Expected ${expected}, actual "${currentValue}"`
        );
      }

      await refreshedInput.sendKeys(Key.TAB);
      await driver.sleep(1200);
      console.log(`Order List BO Code exact selected and confirmed: ${currentValue}`);
      return true;
    } catch (err) {
      console.log(`Order List BO Code exact attempt failed: ${err.message}`);
      await driver.sleep(1000);
    }
  }

  throw new Error(`Failed to select exact Order List BO Code ${expected} after retries.`);
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

module.exports = {
  escapeRegExp,
  boCodeTextMatches,
  selectAutocompleteAndWait,
  selectBOCodeAndWait,
  selectOrderListBOCodeExact,
  selectAutocompleteHeaderFilter
};
