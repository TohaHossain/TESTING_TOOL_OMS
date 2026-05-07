function indexedXpath(xpath, index) {
  return `(${xpath})[${index}]`;
}

function xpathLiteral(text) {
  if (!text.includes("'")) return `'${text}'`;
  if (!text.includes('"')) return `"${text}"`;
  return "concat('" + text.replace(/'/g, "',\"'\",'") + "')";
}

const SHARE_PRICE_ENLARGE_ICON_PATH_D = "M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z";
const SHARE_PRICE_ENLARGE_XPATHS = [
  `//*[normalize-space()='Share Price']/ancestor::div[contains(@class,'component-title') or contains(@class,'curser-move')][1]//button[.//*[name()='path' and @d=${xpathLiteral(SHARE_PRICE_ENLARGE_ICON_PATH_D)}]]`,
  `//button[contains(@class,'MuiButton-root') and contains(@class,'MuiButton-text') and .//*[name()='path' and @d=${xpathLiteral(SHARE_PRICE_ENLARGE_ICON_PATH_D)}]]`,
  `//button[contains(@class,'MuiButtonBase-root') and contains(@class,'MuiButton-root') and @type='button' and .//*[name()='svg' and @viewBox='0 0 24 24']/*[name()='path' and @d=${xpathLiteral(SHARE_PRICE_ENLARGE_ICON_PATH_D)}]]`,
  `//button[contains(@style,'margin-right: 2px') and .//*[name()='path' and @d=${xpathLiteral(SHARE_PRICE_ENLARGE_ICON_PATH_D)}]]`,
  "//body/div[@id='root']/div/div/div[@class='jss19']/div[@class='jss26']/div[contains(@class,'custom-scrollbar-dark')]/div[@data-darkmode='true']/div[@class='react-tabs']/div[@id='react-tabs-1']/div[@class='popupContainer']/div[@class='MuiBox-root jss61 mainBoxContainer']/div[@class='react-draggable']/div[@class='MuiPaper-root MuiCard-root MuiPaper-elevation1 MuiPaper-rounded']/div[@class='MuiBox-root jss64 curser-move component-title']/div/button[1]/span[1]//*[name()='svg']",
  "//body/div[@id='root']/div/div/div[@class='jss19']/div[@class='jss26']/div[contains(@class,'custom-scrollbar-dark')]/div[@data-darkmode='true']/div[@class='react-tabs']/div[@id='react-tabs-1']/div[@class='popupContainer']/div[@class='MuiBox-root jss61 mainBoxContainer']/div[@class='react-draggable react-draggable-dragged']/div[@class='MuiPaper-root MuiCard-root MuiPaper-elevation1 MuiPaper-rounded']/div[@class='MuiBox-root jss176 curser-move component-title']/div/button[1]/span[1]//*[name()='svg']"
];
const SHARE_PRICE_TRADING_CODE_INPUT_XPATHS = [
  "//*[normalize-space()='Share Price']/ancestor::div[contains(@class,'MuiPaper-root')][1]//input[@id='Trading-Code']",
  "//*[normalize-space()='Share Price']/ancestor::div[contains(@class,'MuiCard-root')][1]//input[@id='Trading-Code']",
  "//*[normalize-space()='Share Price']/ancestor::div[contains(@class,'react-draggable')][1]//input[@id='Trading-Code']",
  "//*[contains(normalize-space(),'Share Price')]/ancestor::div[contains(@class,'MuiPaper-root')][1]//input[@id='Trading-Code']",
  "//div[contains(@class,'share-price')]//input[@id='Trading-Code']",
  "//div[contains(@class,'sharePrice')]//input[@id='Trading-Code']",
  "//div[contains(@class,'share-price-content-container')]//input[@id='Trading-Code']",
  "//div[contains(@class,'share-price')]//input[contains(@id,'Trading-Code')]",
  indexedXpath("//input[@id='Trading-Code']", 4),
  indexedXpath("//input[@id='Trading-Code']", 5)
];
const SHARE_PRICE_SCOPED_INPUT_XPATHS = [
  "//*[normalize-space()='Share Price']/ancestor::div[contains(@class,'MuiPaper-root')][1]//input[@id='Trading-Code']",
  "//*[normalize-space()='Share Price']/ancestor::div[contains(@class,'MuiCard-root')][1]//input[@id='Trading-Code']",
  "//*[normalize-space()='Share Price']/ancestor::div[contains(@class,'react-draggable')][1]//input[@id='Trading-Code']",
  "//*[contains(normalize-space(),'Share Price')]/ancestor::div[contains(@class,'MuiPaper-root')][1]//input[@id='Trading-Code']",
  "//div[contains(@class,'share-price')]//input[@id='Trading-Code']",
  "//div[contains(@class,'sharePrice')]//input[@id='Trading-Code']",
  "//div[contains(@class,'share-price-content-container')]//input[@id='Trading-Code']",
  "//div[contains(@class,'share-price')]//input[contains(@id,'Trading-Code')]",
  indexedXpath("//input[@id='Trading-Code']", 4),
  indexedXpath("//input[@id='Trading-Code']", 5)
];
const MARKET_DEPTH_TRADING_CODE_INPUT_XPATHS = [
  "//div[@class='MuiGrid-root market-depth-content-container MuiGrid-container']//input[@id='Trading-Code-market-depth']",
  "//input[@id='Trading-Code-market-depth']",
  "//div[contains(@class,'market-depth-content-container')]//input[@id='Trading-Code']",
  "//div[contains(@class,'market-depth')]//input[contains(@id,'Trading-Code')]"
];
const MARKET_DEPTH_MARKET_TYPE_INPUT_XPATHS = [
  "//div[@class='MuiGrid-root market-depth-content-container MuiGrid-container']//input[@id='Market-Type']",
  "//div[contains(@class,'market-depth-content-container')]//input[@id='Market-Type']",
  "//div[contains(@class,'market-depth')]//input[@id='Market-Type']"
];
const MARKET_DEPTH_GRID_XPATHS = [
  "//div[@class='MuiGrid-root market-depth-content-container MuiGrid-container']"
];
const ORDER_LIST_GRID_XPATHS = [
  "//div[@class='ag-body-horizontal-scroll-viewport']"
];
const SHARE_PRICE_GRID_XPATHS = [
  "//div[@class='MuiGrid-root share-price-content-container MuiGrid-container MuiGrid-spacing-xs-1']",
  "//div[@class='MuiCardContent-root remove-margin-padding card-content']//div//div//div//div//div[@class='example-wrapper']//div[@class='scrollbarContainer ag-theme-balham-dark']//div//div[@class='ag-body-horizontal-scroll-container']",
  "//div[@class='ag-body-vertical-scroll']//div[@class='ag-body-vertical-scroll-viewport']"
];
const TIME_AND_SALES_GRID_XPATHS = [
  "//div[@class='MuiGrid-root time-and-sales-content-container MuiGrid-container MuiGrid-spacing-xs-1']",
  "//div[@class='timeAndSales']//div//div[@class='example-wrapper']//div[@class='scrollbarContainer ag-theme-balham-dark']//div//div[@class='ag-body-horizontal-scroll-container']",
  "//div[@class='timeAndSales']//div//div[@class='example-wrapper']//div[@class='scrollbarContainer ag-theme-balham-dark']//div//div[@class='ag-body-vertical-scroll-viewport']"
];
const DASHBOARD_VIEW_XPATHS = [
  "//div[@class=' custom-scrollbar-dark']"
];
const ORDER_LIST_SCROLL_XPATHS = [
  "//div[@class='ag-body-horizontal-scroll-viewport']"
];
const TIME_AND_SALES_SCROLL_XPATHS = [
  "//div[@class='MuiGrid-root time-and-sales-content-container MuiGrid-container MuiGrid-spacing-xs-1']",
  "//div[@class='timeAndSales']//div//div[@class='example-wrapper']//div[@class='scrollbarContainer ag-theme-balham-dark']//div//div[@class='ag-body-horizontal-scroll-container']",
  "//div[@class='timeAndSales']//div//div[@class='example-wrapper']//div[@class='scrollbarContainer ag-theme-balham-dark']//div//div[@class='ag-body-vertical-scroll-viewport']"
];
const MARKET_DEPTH_SCROLL_XPATHS = [
  "//div[@class='MuiGrid-root market-depth-content-container MuiGrid-container']"
];

module.exports = {
  indexedXpath,
  xpathLiteral,
  SHARE_PRICE_ENLARGE_ICON_PATH_D,
  SHARE_PRICE_ENLARGE_XPATHS,
  SHARE_PRICE_TRADING_CODE_INPUT_XPATHS,
  SHARE_PRICE_SCOPED_INPUT_XPATHS,
  MARKET_DEPTH_TRADING_CODE_INPUT_XPATHS,
  MARKET_DEPTH_MARKET_TYPE_INPUT_XPATHS,
  MARKET_DEPTH_GRID_XPATHS,
  ORDER_LIST_GRID_XPATHS,
  SHARE_PRICE_GRID_XPATHS,
  TIME_AND_SALES_GRID_XPATHS,
  DASHBOARD_VIEW_XPATHS,
  ORDER_LIST_SCROLL_XPATHS,
  TIME_AND_SALES_SCROLL_XPATHS,
  MARKET_DEPTH_SCROLL_XPATHS
};
