const { PRICE_TOLERANCE } = require("../config/runtime");
const {
  placedOrders,
  scrapedData
} = require("../state/runState");
const { retryScrape } = require("../core/browserActions");
const { scrapeMarketDepthRowsForValidation } = require("../scrapers/widgetRows");
const {
  escapeRegExp,
  boCodeTextMatches
} = require("../core/autocomplete");
const {
  normalizeText,
  normalizeNumber,
  addValidationResult,
  numbersClose,
  valuesMatch,
  validateAndReportField,
  getPhaseName
} = require("./common");

function rowContainsText(row, expectedText) {
  const expected = normalizeText(expectedText);
  const raw = normalizeText(row.rawText || row.rowText || "");
  return raw.includes(expected);
}

function rowContainsExpectedPrice(row, expectedPrice, tolerance = PRICE_TOLERANCE) {
  const candidates = [
    row.price,
    row.tradePrice,
    row.lastTradedPrice,
    row.bidPrice,
    row.askPrice,
    row.bid,
    row.ask
  ];

  if (candidates.some(value => numbersClose(value, expectedPrice, tolerance))) {
    return true;
  }

  const raw = normalizeText(row.rawText || "", false);
  return raw.includes(expectedPrice.toString()) || raw.includes(expectedPrice.toLocaleString("en-US"));
}

function rowContainsExpectedQuantity(row, expectedQuantity) {
  const candidates = [
    row.quantity,
    row.tradeQuantity,
    row.bidQuantity,
    row.askQuantity,
    row.volume
  ];

  if (candidates.some(value => normalizeNumber(value) === normalizeNumber(expectedQuantity))) {
    return true;
  }

  const raw = normalizeText(row.rawText || "", false);
  const regex = new RegExp(`\\b${escapeRegExp(expectedQuantity.toString())}\\b`);
  return regex.test(raw);
}

function findExpectedOrderRows(rows, expectedOrder) {
  return (rows || []).filter(row => {
    const boCodeOk = expectedOrder.boCode ? row.boCode === expectedOrder.boCode || rowContainsText(row, expectedOrder.boCode) : true;
    const tradingCodeOk = expectedOrder.tradingCode
      ? normalizeText(row.tradingCode || "") === expectedOrder.tradingCode || rowContainsText(row, expectedOrder.tradingCode)
      : true;
    const sideOk = expectedOrder.orderType
      ? normalizeText(row.side || "") === expectedOrder.orderType || rowContainsText(row, expectedOrder.orderType)
      : true;
    const qtyOk = expectedOrder.quantity ? rowContainsExpectedQuantity(row, expectedOrder.quantity) : true;
    const priceOk = expectedOrder.price ? rowContainsExpectedPrice(row, expectedOrder.price, PRICE_TOLERANCE) : true;

    return boCodeOk && tradingCodeOk && sideOk && qtyOk && priceOk;
  });
}

function getFirstMatchingRow(rows, predicate) {
  for (const row of rows || []) {
    if (predicate(row)) return row;
  }
  return null;
}

function getFirstValidNumber(rows, keys) {
  for (const row of rows || []) {
    for (const key of keys) {
      const value = normalizeNumber(row[key]);
      if (value !== null) return value;
    }
  }
  return null;
}

function findMatchingRows(rows, criteria = {}) {
  return (rows || []).filter(row => {
    const raw = normalizeText(row.rawText || row.rowText || "");
    const rowBoCode = normalizeText(row.boCode || "");
    const rowTradingCode = normalizeText(row.tradingCode || "");
    const rowSide = normalizeText(row.side || "");

    if (criteria.tradingCode) {
      const expectedTrading = normalizeText(criteria.tradingCode);
      const hasTradingCode =
        rowTradingCode === expectedTrading || raw.includes(` ${expectedTrading} `) || raw.includes(expectedTrading);
      if (!hasTradingCode) return false;
    }

    if (criteria.boCode) {
      const expectedBoCode = criteria.boCode.toString().trim();
      const hasBoCode =
        boCodeTextMatches(rowBoCode, expectedBoCode) ||
        boCodeTextMatches(raw, expectedBoCode) ||
        new RegExp(`\\b${escapeRegExp(expectedBoCode)}(?!\\d)\\b`).test(raw);
      if (!hasBoCode) return false;
    }

    if (criteria.side) {
      const expectedSide = normalizeText(criteria.side);
      const hasSide = rowSide === expectedSide || raw.includes(expectedSide);
      if (!hasSide) return false;
    }

    return true;
  });
}

function buildWidgetSummary(rows, expectedOrder = null) {
  const summary = {
    totalRows: (rows || []).length,
    gpRows: findMatchingRows(rows || [], { tradingCode: "GP" }).length,
    boCodeRows: expectedOrder ? findMatchingRows(rows || [], { boCode: expectedOrder.boCode }).length : null,
    matchingRows: expectedOrder ? findExpectedOrderRows(rows || [], expectedOrder).length : null,
    firstRow: rows && rows.length > 0 ? normalizeText(rows[0].rawText || "", false).slice(0, 200) : null,
    firstPrice: getFirstValidNumber(rows || [], [
      "price",
      "tradePrice",
      "lastTradedPrice",
      "bidPrice",
      "askPrice",
      "bid",
      "ask",
      "vwap"
    ]),
    firstQuantity: getFirstValidNumber(rows || [], [
      "quantity",
      "tradeQuantity",
      "bidQuantity",
      "askQuantity",
      "volume",
      "tradeCount"
    ])
  };

  if (expectedOrder) {
    const exactRow = getFirstMatchingRow(rows || [], row =>
      findExpectedOrderRows([row], expectedOrder).length > 0
    );

    summary.expectedPriceMatched = !!exactRow && rowContainsExpectedPrice(exactRow, expectedOrder.price);
    summary.expectedQuantityMatched = !!exactRow && rowContainsExpectedQuantity(exactRow, expectedOrder.quantity);
  }

  return summary;
}

function normalizeRowFingerprint(row) {
  return normalizeText((row && (row.rawText || row.rowText)) || "", false)
    .replace(/\s+/g, " ")
    .trim();
}

function marketDepthSnapshotsSimilar(beforeRows, afterRows) {
  const beforeSummary = buildWidgetSummary(beforeRows || []);
  const afterSummary = buildWidgetSummary(afterRows || []);

  if ((beforeRows || []).length === 0 || (afterRows || []).length === 0) {
    return false;
  }

  const beforeFingerprints = (beforeRows || [])
    .map(normalizeRowFingerprint)
    .filter(Boolean)
    .slice(0, 5);
  const afterFingerprints = (afterRows || [])
    .map(normalizeRowFingerprint)
    .filter(Boolean)
    .slice(0, 5);

  const firstRowsMatch =
    beforeSummary.firstRow &&
    afterSummary.firstRow &&
    normalizeText(beforeSummary.firstRow, false) === normalizeText(afterSummary.firstRow, false);
  const priceMatches =
    beforeSummary.firstPrice !== null &&
    afterSummary.firstPrice !== null &&
    numbersClose(beforeSummary.firstPrice, afterSummary.firstPrice, PRICE_TOLERANCE);
  const quantityMatches =
    beforeSummary.firstQuantity !== null &&
    afterSummary.firstQuantity !== null &&
    beforeSummary.firstQuantity === afterSummary.firstQuantity;
  const fingerprintOverlap = beforeFingerprints.some(line => afterFingerprints.includes(line));

  return firstRowsMatch || (priceMatches && quantityMatches) || fingerprintOverlap;
}

function validateMarketDepthResult(phase, result) {
  const rows = result?.rows || [];

  if (rows.length === 0) {
    addValidationResult({
      phase,
      widgetName: "Market Depth",
      validationName: `${phase} rows available`,
      expected: "At least one visible row",
      actual: 0,
      status: "WARN",
      message: "No Market Depth rows were scraped."
    });
    return null;
  }

  const row = result?.matchedRow || rows[0];

  addValidationResult({
    phase,
    widgetName: "Market Depth",
    validationName: `${phase} Trading Code GP visible`,
    expected: "GP",
    actual: row.tradingCode || "",
    status: valuesMatch("GP", row.tradingCode, "text") ? "PASS" : "WARN",
    message: valuesMatch("GP", row.tradingCode, "text")
      ? "Market Depth shows GP after filtering."
      : "Market Depth row was scraped but GP was not confirmed."
  });

  validateAndReportField(
    phase,
    "Market Depth",
    "Market Type matches PUBLIC",
    "PUBLIC",
    row.marketType,
    "text",
    "WARN"
  );

  return row;
}

async function scrapeAndValidateMarketDepth(driver, side) {
  const phase = getPhaseName(side);

  const result = await retryScrape(`Market Depth ${phase}`, async () => {
    const rows = await scrapeMarketDepthRowsForValidation(driver);
    const gpRows = rows.filter(row => valuesMatch("GP", row.tradingCode, "text"));

    return {
      found: gpRows.length > 0,
      rows,
      matchedRow: gpRows[0] || null
    };
  });

  const row = validateMarketDepthResult(phase, result);

  if (row) {
    scrapedData.marketDepth[side] = row;
  }
}

function compareMarketDepthSnapshots(phase, stageBeforeKey, stageAfterKey, side) {
  const beforeRows = scrapedData.workflow[stageBeforeKey]?.marketDepth?.rows || [];
  const afterRows = scrapedData.workflow[stageAfterKey]?.marketDepth?.rows || [];
  const beforeSummary = buildWidgetSummary(beforeRows);
  const afterSummary = buildWidgetSummary(afterRows, placedOrders[side]);
  const changed =
    beforeSummary.totalRows !== afterSummary.totalRows ||
    beforeSummary.firstRow !== afterSummary.firstRow ||
    beforeSummary.firstPrice !== afterSummary.firstPrice ||
    beforeSummary.firstQuantity !== afterSummary.firstQuantity;

  addValidationResult({
    phase,
    widgetName: "Market Depth",
    validationName: `${phase} baseline snapshot before order`,
    expected: "Snapshot available before order placement",
    actual: beforeRows.length,
    status: beforeRows.length > 0 ? "PASS" : "WARN",
    message: beforeRows.length > 0
      ? "Market Depth baseline snapshot was saved before placing the order."
      : "Market Depth baseline snapshot was empty before placing the order."
  });

  addValidationResult({
    phase,
    widgetName: "Market Depth",
    validationName: `${phase} snapshot after order`,
    expected: "Snapshot available after order placement",
    actual: afterRows.length,
    status: afterRows.length > 0 ? "PASS" : "WARN",
    message: afterRows.length > 0
      ? "Market Depth snapshot was saved after placing the order."
      : "Market Depth snapshot was empty after placing the order."
  });

  addValidationResult({
    phase,
    widgetName: "Cross Widget",
    validationName: `${phase} Market Depth changed after order`,
    expected: "Before/after Market Depth relation should show a visible transition",
    actual: {
      changed,
      beforeFirstRow: beforeSummary.firstRow,
      afterFirstRow: afterSummary.firstRow
    },
    status: changed ? "PASS" : "WARN",
    message: changed
      ? "Market Depth changed between the baseline and post-order snapshots."
      : "Market Depth did not show a clear before/after change in the captured rows."
  });

  addValidationResult({
    phase,
    widgetName: "Cross Widget",
    validationName: `${phase} Order List and Market Depth flow relation`,
    expected: "Order List confirms the order while Market Depth reflects post-order state",
    actual: {
      orderListPresent: !!scrapedData.orderList[side]?.tradingCode,
      marketDepthGpRows: afterSummary.gpRows,
      marketDepthRows: afterRows.length
    },
    status:
      scrapedData.orderList[side]?.tradingCode && (afterSummary.gpRows > 0 || changed)
        ? "PASS"
        : "WARN",
    message:
      scrapedData.orderList[side]?.tradingCode && (afterSummary.gpRows > 0 || changed)
        ? "Order List and Market Depth show a reasonable post-order flow relation."
        : "Could not fully confirm the Order List to Market Depth flow relation."
  });
}

function compareMarketDepthLifecycle() {
  const beforeBuyRows = scrapedData.workflow.beforeBuy?.marketDepth?.rows || [];
  const afterSellRows = scrapedData.workflow.afterSell?.marketDepth?.rows || [];
  const beforeBuySummary = buildWidgetSummary(beforeBuyRows);
  const afterSellSummary = buildWidgetSummary(afterSellRows);
  const returnedToBaseline = marketDepthSnapshotsSimilar(beforeBuyRows, afterSellRows);

  addValidationResult({
    phase: "FINAL",
    widgetName: "Cross Widget",
    validationName: "Market Depth returned to pre-BUY baseline after SELL",
    expected: {
      beforeBuyRows: beforeBuyRows.length,
      beforeBuyFirstRow: beforeBuySummary.firstRow,
      beforeBuyFirstPrice: beforeBuySummary.firstPrice,
      beforeBuyFirstQuantity: beforeBuySummary.firstQuantity
    },
    actual: {
      afterSellRows: afterSellRows.length,
      afterSellFirstRow: afterSellSummary.firstRow,
      afterSellFirstPrice: afterSellSummary.firstPrice,
      afterSellFirstQuantity: afterSellSummary.firstQuantity
    },
    status: returnedToBaseline ? "PASS" : "WARN",
    message: returnedToBaseline
      ? "Market Depth after SELL aligned with the pre-BUY baseline."
      : "Could not confirm that Market Depth returned to the pre-BUY baseline after SELL."
  });
}

module.exports = {
  rowContainsText,
  rowContainsExpectedPrice,
  rowContainsExpectedQuantity,
  findExpectedOrderRows,
  findMatchingRows,
  buildWidgetSummary,
  marketDepthSnapshotsSimilar,
  validateMarketDepthResult,
  scrapeAndValidateMarketDepth,
  compareMarketDepthSnapshots,
  compareMarketDepthLifecycle
};
