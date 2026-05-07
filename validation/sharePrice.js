const {
  placedOrders,
  scrapedData,
  saveWorkflowStageRows
} = require("../state/runState");
const {
  SHARE_PRICE_SCRAPE_ATTEMPTS,
  SHARE_PRICE_SCRAPE_RETRY_DELAY_MS
} = require("../config/runtime");
const { retryScrape } = require("../core/browserActions");
const { scrapeSharePriceRowsForValidation } = require("../scrapers/widgetRows");
const { buildWidgetSummary } = require("./marketDepth");
const {
  normalizeNumber,
  addValidationResult,
  valuesMatch,
  validateAndReportField
} = require("./common");

function validateSharePriceRow(row) {
  scrapedData.sharePrice.row = row;

  validateAndReportField("FINAL", "Share Price", "Trading Code matches GP", "GP", row.tradingCode, "text");

  const orderListTimes = [scrapedData.orderList.buy.time, scrapedData.orderList.sell.time].filter(Boolean);
  const matchedTimes = orderListTimes.filter(time => valuesMatch(time, row.ltTime, "time"));
  scrapedData.sharePrice.matchedTimes = matchedTimes;

  addValidationResult({
    phase: "FINAL",
    widgetName: "Share Price",
    validationName: "LT Time matches Order List Time",
    expected: orderListTimes,
    actual: row.ltTime || "",
    status: matchedTimes.length > 0 ? "PASS" : "WARN",
    message: matchedTimes.length > 0
      ? "Share Price LT Time matched at least one saved Order List time."
      : "Share Price LT Time did not match saved Order List times."
  });

  const referencePrices = [
    scrapedData.orderList.buy.execRate,
    scrapedData.orderList.sell.execRate,
    placedOrders.buy.price,
    placedOrders.sell.price
  ].filter(value => normalizeNumber(value) !== null);

  addValidationResult({
    phase: "FINAL",
    widgetName: "Share Price",
    validationName: "LTP aligns with saved trade price",
    expected: referencePrices,
    actual: row.lastTradedPrice || "",
    status: referencePrices.some(value => valuesMatch(value, row.lastTradedPrice, "number")) ? "PASS" : "WARN",
    message: referencePrices.some(value => valuesMatch(value, row.lastTradedPrice, "number"))
      ? "Share Price LTP aligned with saved trade price."
      : "Share Price LTP did not align with saved trade prices within tolerance."
  });

  const timeAndSalesTimes = [
    scrapedData.timeAndSales.buy?.time,
    scrapedData.timeAndSales.sell?.time
  ].filter(Boolean);
  const matchedTimeAndSalesTimes = timeAndSalesTimes.filter(time => valuesMatch(time, row.ltTime, "time"));

  addValidationResult({
    phase: "FINAL",
    widgetName: "Cross Widget",
    validationName: "Share Price LT Time aligns with Time and Sales",
    expected: timeAndSalesTimes,
    actual: row.ltTime || "",
    status: matchedTimeAndSalesTimes.length > 0 ? "PASS" : "WARN",
    message: matchedTimeAndSalesTimes.length > 0
      ? "Share Price LT Time matched a saved Time and Sales time."
      : "Share Price LT Time did not match the saved Time and Sales times."
  });

  const tasReferencePrices = [
    scrapedData.timeAndSales.buy?.execPrice,
    scrapedData.timeAndSales.sell?.execPrice
  ].filter(value => normalizeNumber(value) !== null);

  addValidationResult({
    phase: "FINAL",
    widgetName: "Cross Widget",
    validationName: "Share Price LTP aligns with Time and Sales Exec Price",
    expected: tasReferencePrices,
    actual: row.lastTradedPrice || "",
    status: tasReferencePrices.some(value => valuesMatch(value, row.lastTradedPrice, "number")) ? "PASS" : "WARN",
    message: tasReferencePrices.some(value => valuesMatch(value, row.lastTradedPrice, "number"))
      ? "Share Price LTP aligned with Time and Sales exec price."
      : "Share Price LTP did not align with the saved Time and Sales exec prices."
  });

  return true;
}

async function scrapeAndValidateSharePrice(driver) {
  const rowsResult = await retryScrape("Share Price", async () => {
    const rows = await scrapeSharePriceRowsForValidation(driver);
    const gpRows = rows.filter(row => valuesMatch("GP", row.tradingCode, "text"));

    return {
      found: gpRows.length > 0,
      rows,
      gpRows
    };
  }, SHARE_PRICE_SCRAPE_ATTEMPTS, SHARE_PRICE_SCRAPE_RETRY_DELAY_MS);

  const rows = rowsResult?.rows || [];
  const gpRows = rowsResult?.gpRows || [];

  scrapedData.sharePrice.rows = rows;
  saveWorkflowStageRows("final", "sharePrice", rows, {
    timeAndSalesBuy: scrapedData.timeAndSales.buy,
    timeAndSalesSell: scrapedData.timeAndSales.sell
  }, buildWidgetSummary);

  if (gpRows.length === 0) {
    console.log(
      `Share Price GP row was not found after ${SHARE_PRICE_SCRAPE_ATTEMPTS} scrape attempts. Skipping Share Price validation.`
    );
    saveWorkflowStageRows("final", "sharePrice", rows, {
      skipped: true,
      skipReason: "GP row was not found after retry attempts.",
      timeAndSalesBuy: scrapedData.timeAndSales.buy,
      timeAndSalesSell: scrapedData.timeAndSales.sell
    }, buildWidgetSummary);
    return false;
  }

  const row = gpRows[0];
  return validateSharePriceRow(row);
}

module.exports = {
  validateSharePriceRow,
  scrapeAndValidateSharePrice
};
