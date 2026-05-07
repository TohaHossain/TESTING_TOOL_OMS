const {
  normalizeText,
  normalizeNumber,
  normalizeTime
} = require("../validation/common");
const { escapeRegExp } = require("../core/autocomplete");

function parseByRegex(text, regex, group = 1) {
  const match = (text || "").match(regex);
  return match ? match[group] : null;
}

function extractMarketDepthNumber(text, label) {
  if (!text || !label) return null;

  const regex = new RegExp(`${escapeRegExp(label)}\\s*:?\\s*([0-9][0-9,]*(?:\\.\\d+)?)`, "i");
  const match = text.match(regex);
  return match ? match[1] : null;
}

function pickFirstNonEmpty(...values) {
  for (const value of values) {
    if (value !== null && value !== undefined && value !== "") return value;
  }
  return "";
}

function findFirstTimeText(...groups) {
  for (const group of groups || []) {
    const values = Array.isArray(group) ? group : [group];

    for (const value of values) {
      const text = normalizeText(value, false);
      if (!text) continue;

      const match = text.match(/\b\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?\s*(?:AM|PM)\b/i);
      if (match) return match[0];
    }
  }

  return "";
}

function parseOrderListRow(row) {
  const rawText = normalizeText(row.rawText || "");
  const rawTextOriginal = normalizeText(row.rawText || "", false);
  const rawRegexMatch = rawTextOriginal.match(
    /^(\d+)\s+([A-Z])\s+([A-Z0-9]+)\s+(Buy|Sell)\s+(Limit|Market|Stop Limit|Stop)\s+(\d+)\s+([0-9,]+(?:\.\d+)?)\s+(.+?)\s+(\d{2}-[A-Za-z]{3}-\d{4}\s+\d{2}:\d{2}:\d{2}\.\d{3}\s+[AP]M)\s+(\d{2}:\d{2}:\d{2}\.\d{3}\s+[AP]M)(?:\s+(\d+)\s+([0-9,]+(?:\.\d+)?))?/i
  );

  let boCode = parseByRegex(rawText, /\bBO[\s-]*CODE[:\s-]*([0-9]+)\b/);
  if (!boCode) {
    for (const cell of row.cells || []) {
      const token = parseByRegex(normalizeText(cell), /^([0-9]+)(?!\d)/);
      if (token) {
        boCode = token;
        break;
      }
    }
  }
  if (!boCode && rawRegexMatch) {
    boCode = rawRegexMatch[1];
  }

  const tradingCode = rawRegexMatch ? rawRegexMatch[3] : parseByRegex(rawText, /\b([A-Z]{2,12})\b/) || null;
  const side = rawRegexMatch ? normalizeText(rawRegexMatch[4]) : rawText.includes("BUY") ? "BUY" : rawText.includes("SELL") ? "SELL" : null;
  const quantity = rawRegexMatch ? normalizeNumber(rawRegexMatch[6]) : normalizeNumber(parseByRegex(rawTextOriginal, /\b([0-9][0-9,]*)\b/));
  const price = rawRegexMatch ? normalizeNumber(rawRegexMatch[7]) : normalizeNumber(parseByRegex(rawTextOriginal, /\b([0-9][0-9,]*\.[0-9]+|[0-9]{3,})\b/));
  const orderStatus =
    (rawRegexMatch ? rawRegexMatch[8] : parseByRegex(rawText, /\b(PENDING|OPEN|FILLED|PARTIAL|REJECTED|CANCELLED|DONE|EXECUTED|SUBMITTED|NEW)\b/)) || null;
  const time = rawRegexMatch ? rawRegexMatch[10] : parseByRegex(rawTextOriginal, /(\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?\s?(?:AM|PM)?)/i);
  const orderId =
    parseByRegex(rawTextOriginal, /ORDER[\s-]*ID[:\s-]*([A-Za-z0-9-]+)/i) ||
    parseByRegex(rawTextOriginal, /\b([0-9]{5,})\b/);

  return {
    ...row,
    boCode,
    tradingCode,
    side,
    quantity,
    price,
    pricingType: rawRegexMatch ? rawRegexMatch[5] : null,
    orderStatus,
    time,
    execQty: rawRegexMatch && rawRegexMatch[11] ? normalizeNumber(rawRegexMatch[11]) : row.execQty,
    execRate: rawRegexMatch && rawRegexMatch[12] ? normalizeNumber(rawRegexMatch[12]) : row.execRate,
    orderId
  };
}

function parseMarketDepthRow(row) {
  const rawText = normalizeText(row.rawText || "");
  const rawTextOriginal = normalizeText(row.rawText || "", false);

  return {
    ...row,
    tradingCode: row.tradingCode || (rawText.includes("GP") ? "GP" : parseByRegex(rawText, /\b([A-Z]{2,5})\b/)),
    bidPrice: pickFirstNonEmpty(
      row.bidPrice,
      normalizeNumber(parseByRegex(rawTextOriginal, /\b([0-9][0-9,]*\.[0-9]+|[0-9]{3,})\b/))
    ),
    bidQuantity: pickFirstNonEmpty(
      row.bidQuantity,
      normalizeNumber(parseByRegex(rawTextOriginal, /\b([0-9][0-9,]*)\b/))
    ),
    askPrice: pickFirstNonEmpty(
      row.askPrice,
      normalizeNumber(parseByRegex(rawTextOriginal, /\b([0-9][0-9,]*\.[0-9]+|[0-9]{3,})\b/))
    ),
    askQuantity: pickFirstNonEmpty(
      row.askQuantity,
      normalizeNumber(parseByRegex(rawTextOriginal, /\b([0-9][0-9,]*)\b/))
    ),
    marketType: row.marketType || (rawText.includes("PUBLIC") ? "PUBLIC" : null),
    lastTradedPrice: pickFirstNonEmpty(row.lastTradedPrice, extractMarketDepthNumber(rawTextOriginal, "LTP")),
    volume: pickFirstNonEmpty(row.volume, extractMarketDepthNumber(rawTextOriginal, "Vol")),
    tradeCount: pickFirstNonEmpty(row.tradeCount, extractMarketDepthNumber(rawTextOriginal, "Trade")),
    vwap: pickFirstNonEmpty(row.vwap, extractMarketDepthNumber(rawTextOriginal, "VWAP"))
  };
}

function parseTimeAndSalesRow(row) {
  const rawText = normalizeText(row.rawText || "");
  const rawTextOriginal = normalizeText(row.rawText || "", false);

  return {
    ...row,
    tradingCode: rawText.includes("GP") ? "GP" : parseByRegex(rawText, /\b([A-Z]{2,5})\b/),
    tradePrice: normalizeNumber(parseByRegex(rawTextOriginal, /\b([0-9][0-9,]*\.[0-9]+|[0-9]{3,})\b/)),
    tradeQuantity: normalizeNumber(parseByRegex(rawTextOriginal, /\b([0-9][0-9,]*)\b/)),
    tradeTime: parseByRegex(rawTextOriginal, /(\d{1,2}:\d{2}(?::\d{2})?\s?(?:AM|PM)?)/i),
    side: rawText.includes("BUY") ? "BUY" : rawText.includes("SELL") ? "SELL" : null
  };
}

function parseSharePriceRow(row) {
  const rawText = normalizeText(row.rawText || "");
  const rawTextOriginal = normalizeText(row.rawText || "", false);
  const cells = row.cells || [];

  return {
    ...row,
    tradingCode: rawText.includes("GP") ? "GP" : parseByRegex(rawText, /\b([A-Z]{2,5})\b/),
    lastTradedPrice: normalizeNumber(parseByRegex(rawTextOriginal, /\b([0-9][0-9,]*\.[0-9]+|[0-9]{3,})\b/)),
    change: normalizeNumber(parseByRegex(rawTextOriginal, /([+-]?[0-9]+(?:\.[0-9]+)?)/)),
    volume: normalizeNumber(parseByRegex(rawTextOriginal, /\b([0-9][0-9,]*)\b/)),
    bid: normalizeNumber(parseByRegex(rawTextOriginal, /\b([0-9][0-9,]*\.[0-9]+|[0-9]{3,})\b/)),
    ask: normalizeNumber(parseByRegex(rawTextOriginal, /\b([0-9][0-9,]*\.[0-9]+|[0-9]{3,})\b/)),
    ltTime: findFirstTimeText(cells, rawTextOriginal)
  };
}

function headerMatchesAlias(headerText, alias) {
  const header = normalizeText(headerText);
  const normalizedAlias = normalizeText(alias);

  if (!header || !normalizedAlias) return false;
  if (header === normalizedAlias) return true;

  return normalizedAlias.length > 4 && header.includes(normalizedAlias);
}

function getHeaderIndexMap(headers, aliases) {
  const indexMap = {};

  for (let index = 0; index < headers.length; index++) {
    const headerText = headers[index];

    for (const [key, possibleHeaders] of Object.entries(aliases)) {
      if (indexMap[key] !== undefined) continue;

      const matched = possibleHeaders.some(alias => headerMatchesAlias(headerText, alias));

      if (matched) {
        indexMap[key] = index;
      }
    }
  }

  return indexMap;
}

function findHeaderRow(rows, aliases, minimumMatches = 3) {
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    const cells = (row.cells || []).map(cell => normalizeText(cell, false)).filter(Boolean);

    if (cells.length === 0) continue;

    const indexMap = getHeaderIndexMap(cells, aliases);
    if (Object.keys(indexMap).length >= minimumMatches) {
      return {
        headerRowIndex: index,
        headers: cells,
        indexMap
      };
    }
  }

  return null;
}

function mapCellsByIndexMap(cells, indexMap) {
  const mapped = {};

  for (const [key, index] of Object.entries(indexMap || {})) {
    mapped[key] = cells[index] !== undefined ? cells[index] : "";
  }

  return mapped;
}

function isOrderListLikeRow(row) {
  const raw = normalizeText((row && row.rawText) || "");
  return (
    (raw.includes(" BUY ") || raw.includes(" SELL ")) &&
    raw.includes(" LIMIT ") &&
    /\b\d{2}-[A-Z]{3}-\d{4}\b/.test(raw)
  );
}

function pickFirstMatchingCell(cells, pattern, excludedValues = []) {
  const excluded = excludedValues.map(value => normalizeText(value));

  for (const cell of cells || []) {
    const original = normalizeText(cell, false);
    const normalized = normalizeText(cell);

    if (excluded.includes(normalized)) continue;
    if (pattern.test(original) || pattern.test(normalized)) {
      return original;
    }
  }

  return "";
}

function collectTimeCells(cells) {
  return (cells || []).filter(cell => normalizeTime(cell));
}

function buildFallbackOrderListMap(cells) {
  const timeCells = collectTimeCells(cells);

  return {
    boCode: cells[0] || "",
    tradingCode: pickFirstMatchingCell(cells, /^[A-Z]{2,12}$/i, [
      "BUY",
      "SELL",
      "LIMIT",
      "MARKET",
      "NEW",
      "FILLED",
      "EXECUTED",
      "PUBLIC",
      "DSE"
    ]),
    type: pickFirstMatchingCell(cells, /\b(BUY|SELL)\b/i),
    pricingType: pickFirstMatchingCell(cells, /\b(LIMIT|MARKET|STOP|STOP LIMIT)\b/i),
    qty: cells[5] || pickFirstMatchingCell(cells, /^\d+$/),
    price: cells[6] || pickFirstMatchingCell(cells, /^\d+(?:\.\d+)?$/),
    status: cells[7] || pickFirstMatchingCell(cells, /\b(EXECUTED|SUBMITTED|NEW|FILLED|PARTIAL|CANCELLED|REJECTED)\b/i),
    time: cells[10] || timeCells[0] || "",
    execQty: cells[11] || "",
    execRate: cells[12] || "",
    execAmount: cells[16] || "",
    transactTime: cells[19] || timeCells[timeCells.length - 1] || "",
    exchange: cells[23] || pickFirstMatchingCell(cells, /\b(DSE|CSE)\b/i),
    orderStatus: cells[24] || "",
    execType: cells[25] || ""
  };
}

function parseOrderListStructuredRows(rows) {
  const headerAliases = {
    boCode: ["BO CODE"],
    tradingCode: ["TRADING CODE"],
    pricingType: ["PRICING TYPE", "PRICE TYPE"],
    qty: ["QTY", "QUANTITY"],
    type: ["TYPE", "ORDER TYPE"],
    price: ["PRICE"],
    status: ["STATUS"],
    time: ["TIME"],
    execQty: ["EXEC QTY", "EXECUTED QTY"],
    execRate: ["EXEC RATE", "EXECUTED RATE"],
    execAmount: ["EXEC AMOUNT", "EXECUTED AMOUNT"],
    transactTime: ["TRANSACT TIME"],
    exchange: ["EXCHANGE"],
    orderStatus: ["ORDER STATUS"],
    execType: ["EXEC TYPE"]
  };

  const headerRow = findHeaderRow(rows, headerAliases, 5);
  const dataRows = headerRow ? rows.slice(headerRow.headerRowIndex + 1) : rows;

  return dataRows
    .map(row => {
      const mapped = headerRow ? mapCellsByIndexMap(row.cells || [], headerRow.indexMap) : {};
      const fallback = buildFallbackOrderListMap(row.cells || []);

      return {
        ...row,
        boCode: pickFirstNonEmpty(mapped.boCode, row.boCode, fallback.boCode),
        tradingCode: pickFirstNonEmpty(mapped.tradingCode, row.tradingCode, fallback.tradingCode),
        pricingType: pickFirstNonEmpty(mapped.pricingType, row.pricingType, fallback.pricingType),
        qty: pickFirstNonEmpty(mapped.qty, row.quantity, row.qty, fallback.qty),
        type: pickFirstNonEmpty(mapped.type, row.side, row.type, fallback.type),
        price: pickFirstNonEmpty(mapped.price, row.price, fallback.price),
        status: pickFirstNonEmpty(mapped.status, row.orderStatus, fallback.status),
        time: pickFirstNonEmpty(mapped.time, row.time, fallback.time),
        execQty: pickFirstNonEmpty(mapped.execQty, row.execQty, fallback.execQty),
        execRate: pickFirstNonEmpty(mapped.execRate, row.execRate, fallback.execRate),
        execAmount: pickFirstNonEmpty(mapped.execAmount, row.execAmount, fallback.execAmount),
        transactTime: pickFirstNonEmpty(mapped.transactTime, row.transactTime, fallback.transactTime),
        exchange: pickFirstNonEmpty(mapped.exchange, row.exchange, fallback.exchange),
        orderStatus: pickFirstNonEmpty(mapped.orderStatus, row.orderStatus, fallback.orderStatus),
        execType: pickFirstNonEmpty(mapped.execType, row.execType, fallback.execType)
      };
    })
    .filter(row => {
      const raw = normalizeText(row.rawText || "");
      return !(
        raw.includes("TRADING CODE") &&
        raw.includes("PRICING TYPE") &&
        raw.includes("TRANSACT TIME")
      );
    });
}

function parseTimeAndSalesStructuredRows(rows) {
  const headerAliases = {
    time: ["TIME"],
    market: ["MARKET"],
    volume: ["VOLUME"],
    cumulativeVolume: ["CUM VOLUME", "CUMULATIVE VOLUME"],
    execPrice: ["EXEC PRICE"],
    direction: ["DIRECTION"],
    value: ["VALUE"]
  };

  const headerRow = findHeaderRow(rows, headerAliases, 4);
  const dataRows = headerRow ? rows.slice(headerRow.headerRowIndex + 1) : rows;

  return dataRows.map(row => {
    const mapped = headerRow ? mapCellsByIndexMap(row.cells || [], headerRow.indexMap) : {};
    const cells = row.cells || [];

    return {
      ...row,
      time: pickFirstNonEmpty(mapped.time, cells[0], row.tradeTime, ""),
      market: pickFirstNonEmpty(mapped.market, cells[1], row.market, ""),
      volume: pickFirstNonEmpty(mapped.volume, cells[3], row.volume, row.tradeQuantity, ""),
      cumulativeVolume: pickFirstNonEmpty(mapped.cumulativeVolume, cells[4], row.cumulativeVolume, ""),
      execPrice: pickFirstNonEmpty(mapped.execPrice, cells[5], row.tradePrice, row.execPrice, ""),
      direction: pickFirstNonEmpty(mapped.direction, cells[7], row.side, row.direction, ""),
      value: pickFirstNonEmpty(mapped.value, cells[8], row.value, ""),
      tradingCode: "GP"
    };
  }).filter(row => !normalizeText(row.rawText || "").includes("CUM VOLUME"));
}

function parseSharePriceStructuredRows(rows) {
  const headerAliases = {
    tradingCode: ["TRADING CODE"],
    ltTime: ["LT TIME"],
    lastTradedPrice: ["LTP"],
    volume: ["VOLUME"],
    bestBid: ["BEST BID"],
    bidQty: ["BID QTY"],
    bestAsk: ["BEST ASK"],
    askQty: ["ASK QTY"]
  };

  const headerRow = findHeaderRow(rows, headerAliases, 4);
  const dataRows = headerRow ? rows.slice(headerRow.headerRowIndex + 1) : rows;

  return dataRows.map(row => {
    const mapped = headerRow ? mapCellsByIndexMap(row.cells || [], headerRow.indexMap) : {};
    const cells = row.cells || [];
    const ltTime = pickFirstNonEmpty(
      mapped.ltTime,
      findFirstTimeText(cells, row.rawText),
      row.ltTime,
      row.time,
      ""
    );

    return {
      ...row,
      tradingCode: pickFirstNonEmpty(mapped.tradingCode, cells[0], row.tradingCode),
      ltTime,
      lastTradedPrice: pickFirstNonEmpty(mapped.lastTradedPrice, cells[3], cells[4], row.lastTradedPrice, row.price, ""),
      volume: pickFirstNonEmpty(mapped.volume, cells[8], cells[9], row.volume, ""),
      bestBid: pickFirstNonEmpty(mapped.bestBid, cells[15], cells[26], row.bid, ""),
      bidQty: pickFirstNonEmpty(mapped.bidQty, cells[14], cells[27], row.bidQty, ""),
      bestAsk: pickFirstNonEmpty(mapped.bestAsk, cells[16], cells[28], row.ask, ""),
      askQty: pickFirstNonEmpty(mapped.askQty, cells[17], cells[29], row.askQty, "")
    };
  }).filter(row => !normalizeText(row.rawText || "").includes("TRADING STATE"));
}

module.exports = {
  parseByRegex,
  extractMarketDepthNumber,
  pickFirstNonEmpty,
  findFirstTimeText,
  isOrderListLikeRow,
  parseOrderListRow,
  parseMarketDepthRow,
  parseTimeAndSalesRow,
  parseSharePriceRow,
  parseOrderListStructuredRows,
  parseTimeAndSalesStructuredRows,
  parseSharePriceStructuredRows
};
