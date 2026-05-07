const {
  placedOrders,
  scrapedData,
  saveWorkflowStageRows
} = require("../state/runState");
const { addValidationResult } = require("../validation/common");
const {
  buildMarketDepthContainerXpaths
} = require("../scrapers/containerXpaths");
const {
  findFirstVisibleElementByXpaths
} = require("../scrapers/genericRows");
const {
  scrapeMarketDepthRowsForValidation,
  scrapeOrderListRowsForValidation
} = require("../scrapers/widgetRows");
const {
  collectMarketDepthStageDiagnostics
} = require("../scrapers/diagnostics");

async function captureMarketDepthStage(driver, stageKey, phase, expectedOrder = null, buildSummary = null) {
  try {
    const rows = await scrapeMarketDepthRowsForValidation(driver);
    saveWorkflowStageRows(stageKey, "marketDepth", rows, {
      expectedOrder
    }, buildSummary);

    if ((stageKey === "beforeBuy" || stageKey === "afterSell") && rows.length === 0) {
      await collectMarketDepthStageDiagnostics(
        driver,
        stageKey,
        phase,
        "Targeted Market Depth diagnostic captured because the stage snapshot was empty.",
        {
          buildContainerXpaths: buildMarketDepthContainerXpaths,
          findFirstVisibleElementByXpaths
        }
      );
    }

    addValidationResult({
      phase,
      widgetName: "Market Depth",
      validationName: `${stageKey} snapshot captured`,
      expected: "Snapshot rows captured",
      actual: rows.length,
      status: rows.length > 0 ? "PASS" : "WARN",
      message: rows.length > 0
        ? `Market Depth ${stageKey} snapshot was captured.`
        : `Market Depth ${stageKey} snapshot was empty.`
    });

    return rows;
  } catch (err) {
    saveWorkflowStageRows(stageKey, "marketDepth", [], {
      expectedOrder,
      error: err.message
    }, buildSummary);

    if (stageKey === "beforeBuy" || stageKey === "afterSell") {
      await collectMarketDepthStageDiagnostics(
        driver,
        stageKey,
        phase,
        `Targeted Market Depth diagnostic captured because stage scrape failed: ${err.message}`,
        {
          buildContainerXpaths: buildMarketDepthContainerXpaths,
          findFirstVisibleElementByXpaths
        }
      );
    }

    addValidationResult({
      phase,
      widgetName: "Market Depth",
      validationName: `${stageKey} snapshot captured`,
      expected: "Snapshot rows captured",
      actual: err.message,
      status: "WARN",
      message: `Market Depth ${stageKey} snapshot failed and the flow continued.`
    });

    return [];
  }
}

async function captureOrderListStage(driver, stageKey, side, phase, buildSummary = null) {
  try {
    const rows = await scrapeOrderListRowsForValidation(driver);
    saveWorkflowStageRows(stageKey, "orderList", rows, {
      side,
      expectedOrder: placedOrders[side]
    }, buildSummary);

    addValidationResult({
      phase,
      widgetName: "Order List",
      validationName: `${stageKey} snapshot captured`,
      expected: "Snapshot rows captured",
      actual: rows.length,
      status: rows.length > 0 ? "PASS" : "WARN",
      message: rows.length > 0
        ? `Order List ${stageKey} snapshot was captured.`
        : `Order List ${stageKey} snapshot was empty.`
    });

    return rows;
  } catch (err) {
    saveWorkflowStageRows(stageKey, "orderList", [], {
      side,
      expectedOrder: placedOrders[side],
      error: err.message
    }, buildSummary);

    addValidationResult({
      phase,
      widgetName: "Order List",
      validationName: `${stageKey} snapshot captured`,
      expected: "Snapshot rows captured",
      actual: err.message,
      status: "WARN",
      message: `Order List ${stageKey} snapshot failed and the flow continued.`
    });

    return [];
  }
}

async function captureFinalOrderListStage(driver, buildSummary = null) {
  try {
    const rows = await scrapeOrderListRowsForValidation(driver);
    saveWorkflowStageRows("final", "orderList", rows, {
      buy: scrapedData.orderList.buy,
      sell: scrapedData.orderList.sell
    }, buildSummary);
    return rows;
  } catch (err) {
    saveWorkflowStageRows("final", "orderList", [], { error: err.message }, buildSummary);
    return [];
  }
}

module.exports = {
  captureMarketDepthStage,
  captureOrderListStage,
  captureFinalOrderListStage
};
