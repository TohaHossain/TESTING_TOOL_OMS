const { Builder, By, until } = require("selenium-webdriver");
const {
  TIMEOUT,
  ENABLE_SHARE_PRICE_VALIDATION
} = require("./config/runtime");
const {
  ORDER_LIST_SCROLL_XPATHS,
  TIME_AND_SALES_SCROLL_XPATHS,
  MARKET_DEPTH_SCROLL_XPATHS
} = require("./config/locators");
const {
  placedOrders,
  savePlacedOrder,
  buildExpectedOrder
} = require("./state/runState");
const {
  clickSpanParentButton,
  safeWorkflowStep
} = require("./core/browserActions");
const {
  selectAutocompleteAndWait
} = require("./core/autocomplete");
const {
  addValidationResult
} = require("./validation/common");
const {
  scrapeAndValidateOrderListForSide
} = require("./validation/orderList");
const {
  buildWidgetSummary,
  scrapeAndValidateMarketDepth,
  compareMarketDepthSnapshots,
  compareMarketDepthLifecycle
} = require("./validation/marketDepth");
const {
  scrapeAndValidateTimeAndSales
} = require("./validation/timeAndSales");
const {
  scrapeAndValidateSharePrice
} = require("./validation/sharePrice");
const {
  captureFinalOrderListStage,
  captureMarketDepthStage,
  captureOrderListStage
} = require("./flows/stageCapture");
const {
  handleSweetAlertIfPresent
} = require("./core/sweetAlert");
const {
  clickEditIfNeeded,
  openNewSheet,
  openAllDashboardComponents
} = require("./flows/dashboard");
const {
  fillPlaceOrderForm,
  submitBuyOrder,
  submitSellOrder
} = require("./flows/placeOrder");
const {
  fillOrderListSearch,
  fillMarketDepth,
  fillTimeAndSales,
  fillSharePrice,
  restoreSharePriceWindow
} = require("./flows/filters");
const {
  printValidationSummary,
  printWidgetDiagnosticsSummary,
  saveValidationReport,
  saveScrapedDataReport,
  saveWidgetDiagnostics
} = require("./reports/artifacts");

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

    await safeWorkflowStep(
      driver,
      "Initial Market Depth filter",
      async () => {
        await fillMarketDepth(driver);
      },
      MARKET_DEPTH_SCROLL_XPATHS,
      "PRE-BUY",
      addValidationResult
    );
    await captureMarketDepthStage(driver, "beforeBuy", "PRE-BUY", buildExpectedOrder("BUY", "10"), buildWidgetSummary);

    /*
      WORKFLOW STEP 1:
      Place BUY order.
    */
    await fillPlaceOrderForm(driver, "BUY", "10");
    savePlacedOrder("buy", {
      orderType: "Buy",
      boCode: "10",
      stockExchange: "DSE",
      tradingCode: "GP",
      quantity: "10",
      price: "15000",
      priceType: "Limit",
      displayQuantity: "2"
    });
    await submitBuyOrder(driver);

    await driver.sleep(2000);
    await handleSweetAlertIfPresent(driver);

    await safeWorkflowStep(
      driver,
      "Order List filter after BUY",
      async () => {
        await fillOrderListSearch(driver, "10");
      },
      ORDER_LIST_SCROLL_XPATHS,
      "BUY",
      addValidationResult
    );

    await safeWorkflowStep(
      driver,
      "Market Depth filter after BUY",
      async () => {
        await fillMarketDepth(driver);
      },
      MARKET_DEPTH_SCROLL_XPATHS,
      "BUY",
      addValidationResult
    );
    await captureMarketDepthStage(driver, "afterBuy", "BUY", placedOrders.buy, buildWidgetSummary);
    await captureOrderListStage(driver, "afterBuy", "buy", "BUY", buildWidgetSummary);
    await scrapeAndValidateOrderListForSide(driver, "buy");
    await scrapeAndValidateMarketDepth(driver, "buy");
    compareMarketDepthSnapshots("BUY", "beforeBuy", "afterBuy", "buy");

    await safeWorkflowStep(
      driver,
      "Market Depth baseline before SELL",
      async () => {
        await fillMarketDepth(driver);
      },
      MARKET_DEPTH_SCROLL_XPATHS,
      "PRE-SELL",
      addValidationResult
    );
    await captureMarketDepthStage(driver, "beforeSell", "PRE-SELL", buildExpectedOrder("SELL", "100"), buildWidgetSummary);

    /*
      WORKFLOW STEP 4:
      Place SELL order.
    */
    await fillPlaceOrderForm(driver, "SELL", "100");
    savePlacedOrder("sell", {
      orderType: "Sell",
      boCode: "100",
      stockExchange: "DSE",
      tradingCode: "GP",
      quantity: "10",
      price: "15000",
      priceType: "Limit",
      displayQuantity: "2"
    });
    await submitSellOrder(driver);

    await driver.sleep(2000);
    await handleSweetAlertIfPresent(driver);

    await safeWorkflowStep(
      driver,
      "Order List filter after SELL",
      async () => {
        await fillOrderListSearch(driver, "100");
      },
      ORDER_LIST_SCROLL_XPATHS,
      "SELL",
      addValidationResult
    );

    await safeWorkflowStep(
      driver,
      "Market Depth filter after SELL",
      async () => {
        await fillMarketDepth(driver);
      },
      MARKET_DEPTH_SCROLL_XPATHS,
      "SELL",
      addValidationResult
    );
    await captureMarketDepthStage(driver, "afterSell", "SELL", placedOrders.sell, buildWidgetSummary);
    await captureOrderListStage(driver, "afterSell", "sell", "SELL", buildWidgetSummary);
    await scrapeAndValidateOrderListForSide(driver, "sell");
    await scrapeAndValidateMarketDepth(driver, "sell");
    compareMarketDepthSnapshots("SELL", "beforeSell", "afterSell", "sell");

    /*
      WORKFLOW STEP 7:
      After both BUY and SELL are done, filter Time and Sales.
    */
    await captureFinalOrderListStage(driver, buildWidgetSummary);
    await safeWorkflowStep(
      driver,
      "Time and Sales filter",
      async () => {
        await fillTimeAndSales(driver);
      },
      TIME_AND_SALES_SCROLL_XPATHS,
      "FINAL",
      addValidationResult
    );

    /*
      WORKFLOW STEP 8:
      Lastly, filter Share Price.
    */
    await scrapeAndValidateTimeAndSales(driver);
    compareMarketDepthLifecycle();

    if (ENABLE_SHARE_PRICE_VALIDATION) {
      let sharePriceState = {
        ready: false,
        enlarged: false
      };

      try {
        sharePriceState = await fillSharePrice(driver);

        if (sharePriceState.ready) {
          const sharePriceValidated = await scrapeAndValidateSharePrice(driver);

          if (!sharePriceValidated) {
            console.log("Share Price segment skipped because relevant GP data was not found.");
          }
        } else {
          console.log("Share Price segment skipped because enlarge/search did not complete.");
        }
      } catch (err) {
        console.log(`Share Price optional segment failed and was ignored: ${err.message}`);
      } finally {
        if (sharePriceState.enlarged) {
          await restoreSharePriceWindow(driver);
        }
      }
    } else {
      console.log("Share Price validation is disabled for this run.");
    }

    console.log("Full automation completed successfully with required workflow order.");
  } catch (err) {
    console.error("Test failed:", err);
  } finally {
    printValidationSummary();
    printWidgetDiagnosticsSummary();
    saveValidationReport();
    saveScrapedDataReport();
    saveWidgetDiagnostics();

    // Keep browser open for debugging.
    // Uncomment when you want browser to close automatically.
    // await driver.quit();
  }
}

if (require.main === module) {
  loginPageFullTest();
}

module.exports = {
  loginPageFullTest
};
