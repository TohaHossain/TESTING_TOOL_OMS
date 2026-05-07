const { pickFirstNonEmpty } = require("../scrapers/parsers");
const {
  placedOrders,
  scrapedData
} = require("../state/runState");
const { retryScrape } = require("../core/browserActions");
const { scrapeOrderListRowsForValidation } = require("../scrapers/widgetRows");
const {
  normalizeText,
  normalizeNumber,
  normalizeTime,
  addValidationResult,
  valuesMatch,
  validateAndReportField,
  getPhaseName
} = require("./common");

function scoreOrderListRow(row, expectedOrder) {
  let score = 0;

  if (valuesMatch(expectedOrder.boCode, row.boCode, "boCode")) score += 40;
  if (valuesMatch(expectedOrder.tradingCode, row.tradingCode, "text")) score += 25;
  if (valuesMatch(expectedOrder.orderType, row.type, "text")) score += 20;
  if (valuesMatch(expectedOrder.priceType, row.pricingType, "text")) score += 10;
  if (valuesMatch(expectedOrder.quantity, row.qty, "number")) score += 10;
  if (valuesMatch(expectedOrder.price, row.price, "number")) score += 10;
  if (valuesMatch(expectedOrder.stockExchange, row.exchange, "text")) score += 5;

  return score;
}

function findBestOrderListMatch(rows, expectedOrder) {
  let best = null;

  for (const row of rows || []) {
    const score = scoreOrderListRow(row, expectedOrder);
    if (!best || score > best.score) {
      best = { row, score };
    }
  }

  return best && best.score >= 65 ? best : null;
}

function hasExecutionData(row) {
  return (
    normalizeTime(row.transactTime) ||
    normalizeNumber(row.execQty) !== null ||
    normalizeNumber(row.execRate) !== null
  );
}

function buildSavedOrderListRow(row) {
  const rowStatus = normalizeText(row.orderStatus || row.status || "");
  const isExecutedRow =
    rowStatus.includes("EXECUTED") ||
    rowStatus.includes("FILLED") ||
    rowStatus.includes("PARTIALLY EXECUTED");
  const derivedExecQty = pickFirstNonEmpty(row.execQty, isExecutedRow ? row.qty : "");
  const derivedExecRate = pickFirstNonEmpty(row.execRate, isExecutedRow ? row.price : "");
  const derivedTransactTime = pickFirstNonEmpty(row.transactTime, row.time);

  return {
    boCode: row.boCode || "",
    tradingCode: row.tradingCode || "",
    pricingType: row.pricingType || "",
    qty: row.qty || "",
    type: row.type || "",
    price: row.price || "",
    time: row.time || "",
    execQty: derivedExecQty || "",
    execRate: derivedExecRate || "",
    execAmount: row.execAmount || "",
    transactTime: derivedTransactTime || "",
    exchange: row.exchange || "",
    orderStatus: row.orderStatus || row.status || "",
    execType: row.execType || "",
    rawText: row.rawText || "",
    cells: row.cells || []
  };
}

function validateOrderListResult({ phase, expectedOrder, result, oppositeBoCode }) {
  const wrongBoCodeFound = (result?.rows || []).some(row =>
    valuesMatch(oppositeBoCode, row.boCode, "boCode") &&
    valuesMatch(expectedOrder.tradingCode, row.tradingCode, "text")
  );

  addValidationResult({
    phase,
    widgetName: "Order List",
    validationName: `${phase} wrong BO Code check`,
    expected: `Not ${oppositeBoCode}`,
    actual: wrongBoCodeFound ? oppositeBoCode : expectedOrder.boCode,
    status: wrongBoCodeFound ? "FAIL" : "PASS",
    message: wrongBoCodeFound
      ? `Order List showed unexpected BO Code ${oppositeBoCode}.`
      : "Order List did not show the opposite BO Code."
  });

  if (!result || !result.matchedRow) {
    addValidationResult({
      phase,
      widgetName: "Order List",
      validationName: `${phase} exact Order List row presence`,
      expected: expectedOrder,
      actual: (result?.rows || []).slice(0, 3),
      status: "FAIL",
      message: `No Order List row could be matched to the ${phase} placed order.`
    });
    return null;
  }

  const row = result.matchedRow;
  const savedRow = buildSavedOrderListRow(row);

  addValidationResult({
    phase,
    widgetName: "Order List",
    validationName: `${phase} exact Order List row presence`,
    expected: expectedOrder,
    actual: {
      matchScore: result.matchScore,
      row: savedRow
    },
    status: "PASS",
    message: `Order List row matched to the ${phase} placed order.`
  });

  validateAndReportField(phase, "Order List", "BO Code matches Place Order", expectedOrder.boCode, row.boCode, "boCode");
  validateAndReportField(phase, "Order List", "Trading Code matches Place Order", expectedOrder.tradingCode, row.tradingCode, "text");
  validateAndReportField(phase, "Order List", "Pricing Type matches Place Order Price Type", expectedOrder.priceType, row.pricingType, "text");
  validateAndReportField(phase, "Order List", "Qty matches Place Order Quantity", expectedOrder.quantity, row.qty, "number");
  validateAndReportField(phase, "Order List", "Type matches Place Order Order Type", expectedOrder.orderType, row.type, "text");
  validateAndReportField(phase, "Order List", "Price matches Place Order Price", expectedOrder.price, row.price, "number");

  addValidationResult({
    phase,
    widgetName: "Order List",
    validationName: `${phase} execution fields captured`,
    expected: ["Time", "Exec Qty", "Exec Rate", "Exec Amount", "Transact Time"],
    actual: {
      time: row.time || "",
      execQty: savedRow.execQty,
      execRate: savedRow.execRate,
      execAmount: row.execAmount || "",
      transactTime: savedRow.transactTime,
      orderStatus: row.orderStatus || row.status || ""
    },
    status: hasExecutionData(savedRow) ? "PASS" : "WARN",
    message: hasExecutionData(savedRow)
      ? "Order List execution-related fields captured."
      : "Execution-related fields were not fully available in Order List."
  });

  return savedRow;
}

function getOppositeBoCode(side) {
  return side === "buy" ? "100" : "10";
}

async function scrapeAndValidateOrderListForSide(driver, side) {
  const phase = getPhaseName(side);
  const expectedOrder = placedOrders[side];

  const result = await retryScrape(`Order List ${phase}`, async () => {
    const rows = await scrapeOrderListRowsForValidation(driver);
    const bestMatch = findBestOrderListMatch(rows, expectedOrder);

    return {
      found: !!bestMatch,
      rows,
      matchedRow: bestMatch ? bestMatch.row : null,
      matchScore: bestMatch ? bestMatch.score : 0
    };
  });

  const oppositeBoCode = getOppositeBoCode(side);
  const savedOrderListRow = validateOrderListResult({
    phase,
    expectedOrder,
    result,
    oppositeBoCode
  });

  if (savedOrderListRow) {
    scrapedData.orderList[side] = savedOrderListRow;
  }
}

module.exports = {
  scoreOrderListRow,
  findBestOrderListMatch,
  hasExecutionData,
  buildSavedOrderListRow,
  validateOrderListResult,
  scrapeAndValidateOrderListForSide
};
