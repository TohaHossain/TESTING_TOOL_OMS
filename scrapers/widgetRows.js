const {
  SHARE_PRICE_SCOPED_INPUT_XPATHS,
  MARKET_DEPTH_TRADING_CODE_INPUT_XPATHS,
  MARKET_DEPTH_MARKET_TYPE_INPUT_XPATHS,
  ORDER_LIST_GRID_XPATHS,
  SHARE_PRICE_GRID_XPATHS,
  TIME_AND_SALES_GRID_XPATHS,
  DASHBOARD_VIEW_XPATHS
} = require("../config/locators");
const { scrapedData } = require("../state/runState");
const { normalizeText } = require("../validation/common");
const {
  buildWidgetContainerXpaths,
  mergeUniqueXpaths,
  buildInputAncestorXpaths,
  buildValueScopedRowXpaths,
  buildMarketDepthContainerXpaths
} = require("./containerXpaths");
const {
  getFirstVisibleInputValueByXpaths,
  scrapeWidgetRows
} = require("./genericRows");
const {
  captureVisibleTextRowsFromContainer,
  captureMarketDepthSnapshotFromContainer
} = require("./marketDepthSnapshot");
const {
  pickFirstNonEmpty,
  isOrderListLikeRow,
  parseOrderListRow,
  parseMarketDepthRow,
  parseTimeAndSalesRow,
  parseSharePriceRow,
  parseOrderListStructuredRows,
  parseTimeAndSalesStructuredRows,
  parseSharePriceStructuredRows
} = require("./parsers");

async function scrapeOrderListRowsForValidation(driver) {
  const rows = await scrapeWidgetRows(
    driver,
    "Order List",
    mergeUniqueXpaths(
      ORDER_LIST_GRID_XPATHS,
      buildWidgetContainerXpaths("Order List", [
        "order-list",
        "orderList",
        "order-list-content-container"
      ]),
      DASHBOARD_VIEW_XPATHS
    )
  );

  return parseOrderListStructuredRows(rows.map(parseOrderListRow));
}

async function scrapeMarketDepthRowsForValidation(driver) {
  const tradingCodeValue = pickFirstNonEmpty(
    await getFirstVisibleInputValueByXpaths(driver, MARKET_DEPTH_TRADING_CODE_INPUT_XPATHS),
    "GP"
  );
  const marketTypeValue = pickFirstNonEmpty(
    await getFirstVisibleInputValueByXpaths(driver, MARKET_DEPTH_MARKET_TYPE_INPUT_XPATHS),
    "PUBLIC"
  );
  const containerXpaths = buildMarketDepthContainerXpaths();
  let rawRows = await scrapeWidgetRows(
    driver,
    "Market Depth",
    containerXpaths
  );

  if (rawRows.length === 0 || rawRows.every(row => normalizeText(row.rawText || "") === "BID QTY BID ASK ASK QTY")) {
    rawRows = await captureVisibleTextRowsFromContainer(driver, containerXpaths, "Market Depth");
  }

  const snapshotRow = await captureMarketDepthSnapshotFromContainer(
    driver,
    containerXpaths,
    tradingCodeValue,
    marketTypeValue
  );

  let rows = rawRows
    .map(parseMarketDepthRow)
    .filter(row => {
      const raw = normalizeText((row && row.rawText) || "");
      return (
        !isOrderListLikeRow(row) &&
        raw !== "BID QTY BID ASK ASK QTY" &&
        !raw.includes(" SUBMITTED ") &&
        !raw.includes(" EXECUTED ") &&
        !raw.includes(" PARTIALLY EXECUTED ")
      );
    });

  if (snapshotRow) {
    if (rows.length === 0) {
      rows = [parseMarketDepthRow(snapshotRow)];
    } else {
      rows = rows.map((row, index) =>
        index === 0
          ? parseMarketDepthRow({
              ...snapshotRow,
              ...row,
              tradingCode: pickFirstNonEmpty(row.tradingCode, snapshotRow.tradingCode),
              marketType: pickFirstNonEmpty(row.marketType, snapshotRow.marketType),
              bidQuantity: pickFirstNonEmpty(row.bidQuantity, snapshotRow.bidQuantity),
              bidPrice: pickFirstNonEmpty(row.bidPrice, snapshotRow.bidPrice),
              askPrice: pickFirstNonEmpty(row.askPrice, snapshotRow.askPrice),
              askQuantity: pickFirstNonEmpty(row.askQuantity, snapshotRow.askQuantity),
              lastTradedPrice: pickFirstNonEmpty(row.lastTradedPrice, snapshotRow.lastTradedPrice),
              volume: pickFirstNonEmpty(row.volume, snapshotRow.volume),
              tradeCount: pickFirstNonEmpty(row.tradeCount, snapshotRow.tradeCount),
              vwap: pickFirstNonEmpty(row.vwap, snapshotRow.vwap),
              rawText: row.rawText || snapshotRow.rawText,
              rowText: row.rowText || snapshotRow.rowText,
              cells: row.cells && row.cells.length > 0 ? row.cells : snapshotRow.cells
            })
          : row
      );
    }
  }

  rows = rows.map(row =>
    parseMarketDepthRow({
      ...row,
      tradingCode: pickFirstNonEmpty(row.tradingCode, tradingCodeValue),
      marketType: pickFirstNonEmpty(row.marketType, marketTypeValue)
    })
  );

  if (rows.length === 0 && rawRows.length > 0) {
    scrapedData.marketDepth.rawRows = rawRows.slice(0, 10);
    console.log(`Market Depth raw row sample: ${JSON.stringify(rawRows.slice(0, 2))}`);
  }

  return rows;
}

async function scrapeTimeAndSalesRowsForValidation(driver) {
  const rows = await scrapeWidgetRows(
    driver,
    "Time and Sales",
    mergeUniqueXpaths(
      TIME_AND_SALES_GRID_XPATHS,
      buildWidgetContainerXpaths("Time and Sales", [
        "time-and-sales-content-container",
        "time-and-sales"
      ]),
      DASHBOARD_VIEW_XPATHS
    )
  );

  return parseTimeAndSalesStructuredRows(rows.map(parseTimeAndSalesRow)).filter(row => !isOrderListLikeRow(row));
}

async function scrapeSharePriceRowsForValidation(driver) {
  const tradingCodeValue = pickFirstNonEmpty(
    await getFirstVisibleInputValueByXpaths(driver, SHARE_PRICE_SCOPED_INPUT_XPATHS),
    "GP"
  );
  const containerXpaths = mergeUniqueXpaths(
    buildInputAncestorXpaths(SHARE_PRICE_SCOPED_INPUT_XPATHS, [
      "share-price-content-container",
      "share-price",
      "sharePrice"
    ]),
    buildWidgetContainerXpaths("Share Price", [
      "share-price-content-container",
      "share-price",
      "sharePrice"
    ]),
    SHARE_PRICE_GRID_XPATHS,
    DASHBOARD_VIEW_XPATHS
  );
  const rawRows = await scrapeWidgetRows(
    driver,
    "Share Price",
    containerXpaths,
    buildValueScopedRowXpaths(containerXpaths, tradingCodeValue)
  );
  const rows = parseSharePriceStructuredRows(rawRows.map(parseSharePriceRow)).filter(row => !isOrderListLikeRow(row));

  if (rows.length === 0 && rawRows.length > 0) {
    scrapedData.sharePrice.rawRows = rawRows.slice(0, 10);
    console.log(`Share Price raw row sample: ${JSON.stringify(rawRows.slice(0, 2))}`);
  }

  return rows;
}

module.exports = {
  scrapeOrderListRowsForValidation,
  scrapeMarketDepthRowsForValidation,
  scrapeTimeAndSalesRowsForValidation,
  scrapeSharePriceRowsForValidation
};
