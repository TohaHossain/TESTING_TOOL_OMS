const { By, until, Key } = require("selenium-webdriver");
const {
  TIMEOUT,
  CLICK_TIMEOUT,
  SCRAPE_RETRY_ATTEMPTS,
  SCRAPE_RETRY_DELAY_MS
} = require("../config/runtime");

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

async function scrollWidgetContainers(driver, xpaths = [], label = "widget") {
  for (const xpath of xpaths) {
    try {
      const elements = await driver.findElements(By.xpath(xpath));

      for (const element of elements) {
        if (!(await isDisplayedSafe(element))) continue;

        await driver.executeScript(
          `
          const el = arguments[0];
          const maxLeft = Math.max(0, el.scrollWidth - el.clientWidth);
          const maxTop = Math.max(0, el.scrollHeight - el.clientHeight);
          el.scrollLeft = maxLeft;
          el.scrollTop = maxTop;
          el.dispatchEvent(new Event('scroll', { bubbles: true }));
          `,
          element
        );

        await driver.sleep(250);

        await driver.executeScript(
          `
          const el = arguments[0];
          el.scrollLeft = 0;
          el.scrollTop = 0;
          el.dispatchEvent(new Event('scroll', { bubbles: true }));
          `,
          element
        );

        console.log(`${label}: scrollbar assist used on xpath ${xpath}`);
      }
    } catch (err) {
      console.log(`${label}: scrollbar assist failed for xpath ${xpath}: ${err.message}`);
    }
  }
}

async function safeWorkflowStep(
  driver,
  label,
  fn,
  scrollXpaths = [],
  phase = "FLOW",
  addValidationResult = null
) {
  try {
    await fn();
    return true;
  } catch (err) {
    console.log(`${label} failed on first attempt: ${err.message}`);
  }

  if (scrollXpaths.length > 0) {
    await scrollWidgetContainers(driver, scrollXpaths, label);
  }

  try {
    await fn();
    console.log(`${label} succeeded after scrollbar assist.`);
    return true;
  } catch (err) {
    if (typeof addValidationResult === "function") {
      addValidationResult({
        phase,
        widgetName: label,
        validationName: "Workflow step completed",
        expected: "Step should complete or be skipped safely",
        actual: err.message,
        status: "WARN",
        message: `${label} failed after retry and script moved to the next step.`
      });
    }
    return false;
  }
}

async function retryScrape(
  stepName,
  fn,
  attempts = SCRAPE_RETRY_ATTEMPTS,
  delayMs = SCRAPE_RETRY_DELAY_MS
) {
  let lastResult = null;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    console.log(`${stepName}: scrape attempt ${attempt}/${attempts}`);
    lastResult = await fn(attempt);

    if (lastResult && lastResult.found) {
      return lastResult;
    }

    if (attempt < attempts) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return lastResult;
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

module.exports = {
  safeClick,
  safeDoubleClick,
  visibleElements,
  isDisplayedSafe,
  clickElement,
  clickSpanParentButton,
  clickSvgPathParent,
  clickNthVisibleSpanParentButton,
  retryStep,
  scrollWidgetContainers,
  safeWorkflowStep,
  retryScrape,
  typeInput,
  clearInput,
  getInputValue,
  waitForInputValue
};
