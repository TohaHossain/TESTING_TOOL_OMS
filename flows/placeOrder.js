const { By, until } = require("selenium-webdriver");
const { CLICK_TIMEOUT, TIMEOUT } = require("../config/runtime");
const { indexedXpath } = require("../config/locators");
const {
  safeClick,
  visibleElements,
  clickElement,
  clickNthVisibleSpanParentButton,
  retryStep,
  typeInput,
  clearInput,
  waitForInputValue
} = require("../core/browserActions");
const {
  selectAutocompleteAndWait,
  selectBOCodeAndWait
} = require("../core/autocomplete");
const { handleSweetAlertIfPresent } = require("../core/sweetAlert");

async function debugOrderButtons(driver) {
  console.log("===== DEBUG ORDER BUTTONS START =====");
  await visibleElements(driver, "//span[normalize-space()='buy']");
  await visibleElements(driver, "//span[normalize-space()='sell']");
  await visibleElements(driver, "//button[.//span[normalize-space()='buy']]");
  await visibleElements(driver, "//button[.//span[normalize-space()='sell']]");
  console.log("===== DEBUG ORDER BUTTONS END =====");
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

module.exports = {
  fillPlaceOrderForm,
  submitBuyOrder,
  submitSellOrder
};
