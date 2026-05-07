const {
  scrapedData,
  saveWorkflowStageRows
} = require("../state/runState");
const { retryScrape } = require("../core/browserActions");
const { scrapeTimeAndSalesRowsForValidation } = require("../scrapers/widgetRows");
const { buildWidgetSummary } = require("./marketDepth");
const {
  normalizeNumber,
  addValidationResult,
  valuesMatch,
  validateAndReportField
} = require("./common");

function getPhaseName(side) {
  return side.toString().trim().toUpperCase();
}

function findTimeAndSalesMatches(rows, savedOrderList) {
  return (rows || []).filter(row =>
    valuesMatch(savedOrderList.transactTime, row.time, "time")
  );
}

function summarizeTimeAndSalesMatches(rows = []) {
  if (!rows || rows.length === 0) return null;

  const execPrices = rows
    .map(row => row.execPrice)
    .filter(value => normalizeNumber(value) !== null);
  const directions = rows
    .map(row => row.direction)
    .filter(Boolean);
  const times = rows
    .map(row => row.time)
    .filter(Boolean);
  const volumeTotal = rows.reduce((sum, row) => sum + (normalizeNumber(row.volume) || 0), 0);
  const cumulativeVolumes = rows
    .map(row => normalizeNumber(row.cumulativeVolume))
    .filter(value => value !== null);

  return {
    time: times[0] || "",
    direction: directions[0] || "",
    execPrice: execPrices[0] || "",
    volume: volumeTotal,
    cumulativeVolume: cumulativeVolumes.length > 0 ? Math.max(...cumulativeVolumes) : "",
    cumulativeVolumeDelta:
      cumulativeVolumes.length >= 2
        ? Math.max(...cumulativeVolumes) - Math.min(...cumulativeVolumes)
        : cumulativeVolumes[0] || "",
    matchedRows: rows.length,
    rows
  };
}

function validateTimeAndSalesRows(rows) {
  if (rows.length === 0) {
    addValidationResult({
      phase: "FINAL",
      widgetName: "Time and Sales",
      validationName: "Time and Sales rows available",
      expected: "At least one visible row",
      actual: 0,
      status: "WARN",
      message: "No Time and Sales rows were scraped."
    });
    return;
  }

  addValidationResult({
    phase: "FINAL",
    widgetName: "Time and Sales",
    validationName: "Time and Sales rows available",
    expected: "At least one visible row",
    actual: rows.length,
    status: "PASS",
    message: "Time and Sales rows were scraped successfully."
  });

  for (const side of ["buy", "sell"]) {
    const phase = getPhaseName(side);
    const savedOrderList = scrapedData.orderList[side];

    if (!savedOrderList.transactTime) {
      addValidationResult({
        phase,
        widgetName: "Time and Sales",
        validationName: `${phase} Transact Time available for matching`,
        expected: "Order List Transact Time",
        actual: savedOrderList.transactTime || "",
        status: "WARN",
        message: "Order List Transact Time not available for Time and Sales cross-check."
      });
      continue;
    }

    if (
      normalizeNumber(savedOrderList.execQty) === 0 ||
      (normalizeNumber(savedOrderList.execQty) === null &&
        normalizeNumber(savedOrderList.execRate) === null)
    ) {
      addValidationResult({
        phase,
        widgetName: "Time and Sales",
        validationName: `${phase} execution data ready`,
        expected: "Executed quantity/rate in Order List",
        actual: {
          execQty: savedOrderList.execQty || "",
          execRate: savedOrderList.execRate || "",
          orderStatus: savedOrderList.orderStatus || ""
        },
        status: "WARN",
        message: "Order List does not show execution data yet, so Time and Sales comparison was skipped."
      });
      continue;
    }

    const matchedRows = findTimeAndSalesMatches(rows, savedOrderList);

    if (!matchedRows || matchedRows.length === 0) {
      addValidationResult({
        phase,
        widgetName: "Time and Sales",
        validationName: `${phase} row match by Transact Time`,
        expected: savedOrderList.transactTime,
        actual: null,
        status: "WARN",
        message: "No Time and Sales row matched the saved Order List Transact Time."
      });
      continue;
    }

    const matchedSummary = summarizeTimeAndSalesMatches(matchedRows);
    scrapedData.timeAndSales[side] = matchedSummary;

    validateAndReportField(phase, "Time and Sales", "Time matches Order List Transact Time", savedOrderList.transactTime, matchedSummary.time, "time", "WARN");
    validateAndReportField(phase, "Time and Sales", "Exec Price matches Order List Exec Rate", savedOrderList.execRate, matchedSummary.execPrice, "number", "WARN");
    validateAndReportField(phase, "Time and Sales", "Aggregated Volume matches Order List Exec Qty", savedOrderList.execQty, matchedSummary.volume, "number", "WARN");
    validateAndReportField(phase, "Time and Sales", "Cumulative Volume delta matches Order List Exec Qty", savedOrderList.execQty, matchedSummary.cumulativeVolumeDelta, "number", "WARN");
  }
}

async function scrapeAndValidateTimeAndSales(driver) {
  const rowsResult = await retryScrape("Time and Sales", async () => {
    const rows = await scrapeTimeAndSalesRowsForValidation(driver);
    return {
      found: rows.length > 0,
      rows
    };
  });

  const rows = rowsResult?.rows || [];
  scrapedData.timeAndSales.rows = rows;

  validateTimeAndSalesRows(rows);

  if (rows.length === 0) {
    return;
  }

  saveWorkflowStageRows("final", "timeAndSales", rows, {
    buy: scrapedData.timeAndSales.buy,
    sell: scrapedData.timeAndSales.sell
  }, buildWidgetSummary);
}

module.exports = {
  findTimeAndSalesMatches,
  summarizeTimeAndSalesMatches,
  validateTimeAndSalesRows,
  scrapeAndValidateTimeAndSales
};
