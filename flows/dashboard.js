const { TIMEOUT } = require("../config/runtime");
const {
  clickElement,
  clickSvgPathParent
} = require("../core/browserActions");

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

module.exports = {
  clickEditIfNeeded,
  openNewSheet,
  openAllDashboardComponents
};
