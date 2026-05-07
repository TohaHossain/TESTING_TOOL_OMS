const {
  MARKET_DEPTH_GRID_XPATHS,
  MARKET_DEPTH_TRADING_CODE_INPUT_XPATHS,
  xpathLiteral
} = require("../config/locators");

function buildWidgetContainerXpaths(widgetTitle, classHints = []) {
  const titleLiteral = xpathLiteral(widgetTitle);
  const containers = [];

  containers.push(
    `//*[normalize-space()=${titleLiteral}]/ancestor::div[contains(@class,'MuiPaper-root')][1]`,
    `//*[normalize-space()=${titleLiteral}]/ancestor::div[contains(@class,'MuiCard-root')][1]`,
    `//*[normalize-space()=${titleLiteral}]/ancestor::div[contains(@class,'react-draggable')][1]`,
    `//*[contains(normalize-space(), ${titleLiteral})]/ancestor::div[contains(@class,'MuiPaper-root')][1]`,
    `//*[contains(normalize-space(), ${titleLiteral})]/ancestor::div[contains(@class,'MuiCard-root')][1]`,
    `//*[contains(normalize-space(), ${titleLiteral})]/ancestor::div[contains(@class,'react-draggable')][1]`
  );

  for (const hint of classHints) {
    containers.push(`//div[contains(@class,'${hint}')]`);
  }

  containers.push(
    `//*[self::div or self::section or self::article][.//*[normalize-space()=${titleLiteral}]]`,
    `//*[self::div or self::section or self::article][.//*[contains(normalize-space(), ${titleLiteral})]]`
  );

  return containers;
}

function mergeUniqueXpaths(...groups) {
  const merged = [];

  for (const group of groups) {
    for (const xpath of group || []) {
      if (xpath && !merged.includes(xpath)) {
        merged.push(xpath);
      }
    }
  }

  return merged;
}

function buildInputAncestorXpaths(inputXpaths = [], classHints = []) {
  const ancestors = [];

  for (const inputXpath of inputXpaths) {
    ancestors.push(
      `${inputXpath}/ancestor::div[contains(@class,'MuiPaper-root')][1]`,
      `${inputXpath}/ancestor::div[contains(@class,'MuiCard-root')][1]`,
      `${inputXpath}/ancestor::div[contains(@class,'react-draggable')][1]`,
      `${inputXpath}/ancestor::div[contains(@class,'example-wrapper')][1]`,
      `${inputXpath}/ancestor::div[contains(@class,'scrollbarContainer')][1]`
    );

    for (const hint of classHints) {
      ancestors.push(`${inputXpath}/ancestor::div[contains(@class,'${hint}')][1]`);
    }
  }

  return ancestors;
}

function buildValueScopedRowXpaths(containerXpaths = [], expectedValue = "") {
  const scopedXpaths = [];
  const cleanValue = expectedValue.toString().trim();

  if (!cleanValue) return scopedXpaths;

  const valueLiteral = xpathLiteral(cleanValue);

  for (const containerXpath of containerXpaths) {
    scopedXpaths.push(
      `${containerXpath}//*[contains(@class,'ag-row')][.//*[normalize-space()=${valueLiteral}] or contains(normalize-space(.), ${valueLiteral})]`,
      `${containerXpath}//tr[.//*[normalize-space()=${valueLiteral}] or contains(normalize-space(.), ${valueLiteral})]`,
      `${containerXpath}//*[@role='row'][.//*[normalize-space()=${valueLiteral}] or contains(normalize-space(.), ${valueLiteral})]`,
      `${containerXpath}//*[contains(@class,'MuiTableRow')][.//*[normalize-space()=${valueLiteral}] or contains(normalize-space(.), ${valueLiteral})]`,
      `${containerXpath}//div[contains(@class,'row')][.//*[normalize-space()=${valueLiteral}] or contains(normalize-space(.), ${valueLiteral})]`
    );
  }

  return scopedXpaths;
}

function buildMarketDepthContainerXpaths() {
  return mergeUniqueXpaths(
    MARKET_DEPTH_GRID_XPATHS,
    buildInputAncestorXpaths(MARKET_DEPTH_TRADING_CODE_INPUT_XPATHS, [
      "market-depth-content-container",
      "market-depth"
    ])
  );
}

module.exports = {
  buildWidgetContainerXpaths,
  mergeUniqueXpaths,
  buildInputAncestorXpaths,
  buildValueScopedRowXpaths,
  buildMarketDepthContainerXpaths
};
