const { normalizeText } = require("../validation/common");
const { extractMarketDepthNumber } = require("./parsers");
const { findFirstVisibleElementByXpaths } = require("./genericRows");

async function captureVisibleTextRowsFromContainer(driver, containerXpaths = [], widgetName = "Widget") {
  const containerMatch = await findFirstVisibleElementByXpaths(driver, containerXpaths);
  if (!containerMatch || !containerMatch.element) {
    return [];
  }

  try {
    const visibleLines = await driver.executeScript(
      `
      const container = arguments[0];

      const isVisible = el => {
        if (!el) return false;
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return style &&
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          rect.width > 0 &&
          rect.height > 0;
      };

      const textOf = el => (el.innerText || el.textContent || "").replace(/\\s+/g, " ").trim();

      const blocks = Array.from(container.querySelectorAll("div, span, p, td, th"))
        .filter(isVisible)
        .map(el => textOf(el))
        .filter(Boolean);

      const rawText = textOf(container);
      const lines = rawText
        .split(/\\r?\\n+/)
        .map(line => line.replace(/\\s+/g, " ").trim())
        .filter(Boolean);

      const merged = [];
      for (const line of [...lines, ...blocks]) {
        if (!line) continue;
        if (!merged.includes(line)) {
          merged.push(line);
        }
      }

      return merged.slice(0, 120);
      `,
      containerMatch.element
    );

    const candidateLines = (visibleLines || []).filter(line => {
      const normalized = normalizeText(line);
      if (!normalized) return false;
      if (normalized.includes("STOCK EXCHANGE") || normalized.includes("TRADING CODE-MARKET-DEPTH")) return false;
      if (normalized.includes("ORDER LIST")) return false;
      if (normalized.includes("TIME AND SALES")) return false;

      return (
        normalized.includes("GP") ||
        normalized.includes("PUBLIC") ||
        normalized.includes("BID") ||
        normalized.includes("ASK") ||
        normalized.includes("LTP") ||
        normalized.includes("VWAP") ||
        /\d{1,2}:\d{2}:\d{2}/.test(line) ||
        /15,000/.test(line)
      );
    });

    return candidateLines.map((line, index) => ({
      widgetName,
      timestamp: new Date().toISOString(),
      rowIndex: index + 1,
      rowText: line,
      cells: line.split(/\s{2,}|\t/).map(part => normalizeText(part, false)).filter(Boolean),
      rawText: line,
      source: "container-visible-text",
      containerXpath: containerMatch.xpath
    }));
  } catch (err) {
    console.log(`${widgetName}: container visible text fallback failed: ${err.message}`);
    return [];
  }
}

function extractMarketDepthBidAskValues(text, leafTexts = []) {
  const candidates = []
    .concat(leafTexts || [])
    .concat((text || "").split(/\r?\n+/))
    .map(value => normalizeText(value, false))
    .filter(Boolean);

  for (const candidate of candidates) {
    if (/BID QTY\s+BID\s+ASK\s+ASK QTY/i.test(candidate)) continue;
    if (/OPEN|HIGH|LOW|LTP|VWAP|MARKET DEPTH|PUBLIC|DSE|GP/i.test(candidate)) continue;

    const fourValueMatch = candidate.match(
      /^\s*([0-9][0-9,]*)\s+([0-9][0-9,]*(?:\.\d+)?)\s+([0-9][0-9,]*(?:\.\d+)?)\s+([0-9][0-9,]*)\s*$/
    );
    if (fourValueMatch) {
      return {
        bidQuantity: fourValueMatch[1],
        bidPrice: fourValueMatch[2],
        askPrice: fourValueMatch[3],
        askQuantity: fourValueMatch[4]
      };
    }

    const bidOnlyMatch = candidate.match(
      /^\s*([0-9][0-9,]*)\s+([0-9][0-9,]*(?:\.\d+)?)\s*$/
    );
    if (bidOnlyMatch) {
      return {
        bidQuantity: bidOnlyMatch[1],
        bidPrice: bidOnlyMatch[2],
        askPrice: "",
        askQuantity: ""
      };
    }
  }

  return {
    bidQuantity: "",
    bidPrice: "",
    askPrice: "",
    askQuantity: ""
  };
}

function buildMarketDepthSnapshotRow(payload, fallbackTradingCode = "GP", fallbackMarketType = "PUBLIC") {
  if (!payload) return null;

  const rawText = normalizeText(payload.rawText || "", false);
  const leafTexts = (payload.leafTexts || []).map(text => normalizeText(text, false)).filter(Boolean);
  const inputValues = (payload.inputValues || []).map(text => normalizeText(text, false)).filter(Boolean);
  const joined = [rawText, ...leafTexts, ...inputValues].filter(Boolean).join(" | ");
  const bidAsk = extractMarketDepthBidAskValues(rawText, leafTexts);

  const tradingCode =
    leafTexts.find(text => normalizeText(text) === normalizeText(fallbackTradingCode)) ||
    inputValues.find(text => normalizeText(text) === normalizeText(fallbackTradingCode)) ||
    (normalizeText(joined).includes(normalizeText(fallbackTradingCode)) ? fallbackTradingCode : "") ||
    fallbackTradingCode;
  const marketType =
    leafTexts.find(text => normalizeText(text) === normalizeText(fallbackMarketType)) ||
    inputValues.find(text => normalizeText(text) === normalizeText(fallbackMarketType)) ||
    (normalizeText(joined).includes(normalizeText(fallbackMarketType)) ? fallbackMarketType : "") ||
    fallbackMarketType;

  const open = extractMarketDepthNumber(joined, "Open");
  const high = extractMarketDepthNumber(joined, "High");
  const low = extractMarketDepthNumber(joined, "Low");
  const ltp = extractMarketDepthNumber(joined, "LTP");
  const volume = extractMarketDepthNumber(joined, "Vol");
  const trade = extractMarketDepthNumber(joined, "Trade");
  const vwap = extractMarketDepthNumber(joined, "VWAP");

  const hasUsefulState = [
    bidAsk.bidQuantity,
    bidAsk.bidPrice,
    bidAsk.askPrice,
    bidAsk.askQuantity,
    ltp,
    volume,
    trade,
    vwap
  ].some(Boolean);

  if (!hasUsefulState) {
    return null;
  }

  const rowText = [
    tradingCode,
    marketType,
    bidAsk.bidQuantity ? `BID QTY ${bidAsk.bidQuantity}` : "",
    bidAsk.bidPrice ? `BID ${bidAsk.bidPrice}` : "",
    bidAsk.askPrice ? `ASK ${bidAsk.askPrice}` : "",
    bidAsk.askQuantity ? `ASK QTY ${bidAsk.askQuantity}` : "",
    ltp ? `LTP ${ltp}` : "",
    volume ? `VOL ${volume}` : "",
    trade ? `TRADE ${trade}` : "",
    vwap ? `VWAP ${vwap}` : ""
  ].filter(Boolean).join(" | ");

  return {
    widgetName: "Market Depth",
    timestamp: new Date().toISOString(),
    rowIndex: 1,
    rowText,
    cells: [
      tradingCode,
      marketType,
      bidAsk.bidQuantity,
      bidAsk.bidPrice,
      bidAsk.askPrice,
      bidAsk.askQuantity,
      ltp,
      volume,
      trade,
      vwap
    ].filter(value => value !== null && value !== undefined && value !== ""),
    rawText: rowText || joined,
    source: "market-depth-state",
    containerXpath: payload.containerXpath || "",
    tradingCode,
    marketType,
    bidQuantity: bidAsk.bidQuantity,
    bidPrice: bidAsk.bidPrice,
    askPrice: bidAsk.askPrice,
    askQuantity: bidAsk.askQuantity,
    lastTradedPrice: ltp,
    volume,
    tradeCount: trade,
    vwap,
    open,
    high,
    low
  };
}

async function captureMarketDepthSnapshotFromContainer(
  driver,
  containerXpaths = [],
  fallbackTradingCode = "GP",
  fallbackMarketType = "PUBLIC"
) {
  const containerMatch = await findFirstVisibleElementByXpaths(driver, containerXpaths);
  if (!containerMatch || !containerMatch.element) {
    return null;
  }

  try {
    const payload = await driver.executeScript(
      `
      const container = arguments[0];

      const isVisible = el => {
        if (!el) return false;
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return style &&
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          rect.width > 0 &&
          rect.height > 0;
      };

      const textOf = el => (el.innerText || el.textContent || "").replace(/\\s+/g, " ").trim();

      const leafTexts = [];
      const candidates = Array.from(container.querySelectorAll("div, span, p, td, th, label"));
      for (const el of candidates) {
        if (!isVisible(el)) continue;
        const text = textOf(el);
        if (!text) continue;

        const hasVisibleTextChild = Array.from(el.children || []).some(child => isVisible(child) && textOf(child));
        if (!hasVisibleTextChild) {
          leafTexts.push(text);
        }
      }

      const dedupedLeafTexts = [];
      for (const text of leafTexts) {
        if (!dedupedLeafTexts.includes(text)) {
          dedupedLeafTexts.push(text);
        }
      }

      const inputValues = Array.from(container.querySelectorAll("input"))
        .filter(isVisible)
        .map(input => (input.value || "").replace(/\\s+/g, " ").trim())
        .filter(Boolean);

      return {
        rawText: textOf(container),
        leafTexts: dedupedLeafTexts.slice(0, 200),
        inputValues: inputValues.slice(0, 20)
      };
      `,
      containerMatch.element
    );

    return buildMarketDepthSnapshotRow(
      {
        ...payload,
        containerXpath: containerMatch.xpath
      },
      fallbackTradingCode,
      fallbackMarketType
    );
  } catch (err) {
    console.log(`Market Depth: container snapshot extraction failed: ${err.message}`);
    return null;
  }
}

module.exports = {
  captureVisibleTextRowsFromContainer,
  extractMarketDepthBidAskValues,
  buildMarketDepthSnapshotRow,
  captureMarketDepthSnapshotFromContainer
};
