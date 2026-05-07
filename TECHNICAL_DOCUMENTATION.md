# XFL Trade Selenium Automation - Technical Documentation

## Purpose

This document explains the current Selenium automation from a technical and validation point of view. `login.test.js` is now the main workflow orchestrator, while configuration, locators, browser actions, runtime state, scraping helpers, widget validations, and report writing are split into supporting modules. It covers:

- The end-to-end Selenium workflow.
- The runtime data objects used for validation.
- The widget scraping strategy.
- Each validation rule and the fields compared.
- PASS, WARN, and FAIL behavior.
- Report and diagnostic artifact generation.

## Current File Layout

The automation is now organized across these files:

- `login.test.js`: main workflow orchestration only: login, dashboard setup, trade sequence, filter calls, validation flow calls, and final artifact saving.
- `config/runtime.js`: timeouts, retry counts, feature flags, and numeric tolerances.
- `config/locators.js`: shared XPath locators plus XPath helper functions.
- `core/browserActions.js`: Selenium browser actions and generic workflow helpers such as safe click, visible element lookup, parent button clicks, retry wrappers, scrollbar assist, safe workflow retry, scrape retry, and direct input helpers.
- `core/autocomplete.js`: autocomplete selection helpers for Place Order and widget header filters, including exact BO Code matching.
- `core/sweetAlert.js`: SweetAlert detection and close handling.
- `flows/dashboard.js`: dashboard editing, new sheet creation, and widget opening flow.
- `flows/placeOrder.js`: Place Order form filling plus BUY/SELL submit flows.
- `flows/filters.js`: Order List, Market Depth, Time and Sales, and Share Price filter/search flows.
- `flows/stageCapture.js`: workflow stage snapshot capture for Market Depth and Order List, including state saving, validation result logging, and targeted diagnostics hooks.
- `scrapers/widgetRows.js`: public widget-specific row collection functions for Order List, Market Depth, Time and Sales, and Share Price validation.
- `scrapers/containerXpaths.js`: shared widget container XPath builders, XPath merging, input ancestor XPath builders, value-scoped row XPath builders, and Market Depth container XPath construction.
- `scrapers/genericRows.js`: generic visible element lookup, input value lookup, table row scraping, and widget row scraping.
- `scrapers/marketDepthSnapshot.js`: Market Depth visible text fallback extraction plus compact Market Depth snapshot row construction.
- `scrapers/parsers.js`: row parser functions for Order List, Market Depth, Time and Sales, and Share Price.
- `scrapers/diagnostics.js`: generic widget diagnostics plus targeted Market Depth stage diagnostics captured when row scraping cannot find visible rows.
- `validation/common.js`: shared normalization, tolerant comparison, phase naming, validation result logging, and field-level validation helpers.
- `validation/orderList.js`: Order List row scoring, best-row matching, saved-row shaping, scrape-and-validate flow, and Order List validation result creation.
- `validation/marketDepth.js`: Market Depth scrape-and-validate flow, row matching helpers, snapshot summaries, before/after comparisons, lifecycle comparison, and Market Depth validation result creation.
- `validation/timeAndSales.js`: Time and Sales scrape-and-validate flow, time-based row matching, matched-row summarization, execution readiness checks, and cross-check validation result creation.
- `validation/sharePrice.js`: optional Share Price scrape-and-validate flow, GP row validation, and cross-checks against saved Order List and Time and Sales values.
- `reports/artifacts.js`: validation summary printing plus validation, scraped-data, and diagnostics artifact writing.
- `state/runState.js`: mutable runtime objects and state helpers used during one test run, including validation results, widget diagnostics, placed orders, scraped data, `savePlacedOrder()`, `buildExpectedOrder()`, and `saveWorkflowStageRows()`.

This split keeps `login.test.js` focused on orchestration. Generic widget row scraping, container XPath building, Market Depth fallback extraction, parser logic, workflow stage capture, diagnostics capture, browser helpers, filters, dashboard flow, place-order flow, runtime state, shared validation helpers, widget-specific scrape-and-validate flows, and report artifacts are extracted into focused modules.

The script automates an XFL Trade UAT workflow for a fixed `GP` trade scenario using:

- Broker: `UCB Stock`
- Role: `Trader`
- Screen size: `Desktop Regular`
- Stock exchange: `DSE`
- Market type: `PUBLIC`
- Trading code: `GP`
- BUY BO Code: `10`
- SELL BO Code: `100`
- Quantity: `10`
- Price: `15000`
- Price type: `Limit`
- Display quantity: `2`

## High-Level Workflow

The main entry point is `loginPageFullTest()`.

The active execution order is:

1. Launch Chrome.
2. Log in to XFL Trade UAT.
3. Proceed to dashboard.
4. Open a new sheet.
5. Select broker, role, and screen size.
6. Open dashboard widgets:
   - Place Order
   - Order List
   - Market Depth
   - Time and Sales
   - Share Price
7. Filter Market Depth before BUY.
8. Capture `beforeBuy` Market Depth snapshot.
9. Fill and submit BUY order.
10. Save expected BUY order into `placedOrders.buy`.
11. Filter Order List after BUY.
12. Filter Market Depth after BUY.
13. Capture `afterBuy` Market Depth and Order List snapshots.
14. Validate BUY Order List.
15. Validate BUY Market Depth.
16. Compare `beforeBuy` vs `afterBuy` Market Depth.
17. Filter Market Depth before SELL.
18. Capture `beforeSell` Market Depth snapshot.
19. Fill and submit SELL order.
20. Save expected SELL order into `placedOrders.sell`.
21. Filter Order List after SELL.
22. Filter Market Depth after SELL.
23. Capture `afterSell` Market Depth and Order List snapshots.
24. Validate SELL Order List.
25. Validate SELL Market Depth.
26. Compare `beforeSell` vs `afterSell` Market Depth.
27. Capture final Order List stage.
28. Filter Time and Sales.
29. Scrape and validate Time and Sales.
30. Compare Market Depth lifecycle from pre-BUY to post-SELL.
31. If enabled, run optional Share Price flow:
   - Enlarge Share Price.
   - Put/select `GP`.
   - Scrape Share Price.
   - Validate if GP data is found.
   - Restore previous Share Price size.
   - If GP data is not found, skip Share Price without failing the run.
32. Print validation and diagnostics summaries.
33. Save report artifacts.

## Important Runtime Constants

| Constant | Current value | Purpose |
|---|---:|---|
| `TIMEOUT` | `100000` ms | General Selenium wait timeout. |
| `CLICK_TIMEOUT` | `15000` ms | Click-specific wait timeout. |
| `DROPDOWN_ATTEMPTS` | `10` | Header/autocomplete retry attempts. |
| `ENABLE_SHARE_PRICE_VALIDATION` | `true` | Enables final optional Share Price flow. |
| `PRICE_TOLERANCE` | `1` | Numeric comparison tolerance. |
| `SCRAPE_RETRY_ATTEMPTS` | `4` | General widget scrape retry attempts. |
| `SCRAPE_RETRY_DELAY_MS` | `4000` ms | Delay between general scrape attempts. |
| `SHARE_PRICE_SCRAPE_ATTEMPTS` | `3` | Share Price scrape retry attempts. |
| `SHARE_PRICE_SCRAPE_RETRY_DELAY_MS` | `3000` ms | Delay between Share Price scrape attempts. |

## Main Data Stores

### `placedOrders`

Stores the expected order values that were submitted through Place Order.

Shape:

```js
placedOrders = {
  buy: {},
  sell: {}
}
```

The BUY side is saved as:

```js
{
  orderType: "Buy",
  boCode: "10",
  stockExchange: "DSE",
  tradingCode: "GP",
  quantity: "10",
  price: "15000",
  priceType: "Limit",
  displayQuantity: "2"
}
```

The SELL side is saved as:

```js
{
  orderType: "Sell",
  boCode: "100",
  stockExchange: "DSE",
  tradingCode: "GP",
  quantity: "10",
  price: "15000",
  priceType: "Limit",
  displayQuantity: "2"
}
```

### `scrapedData`

Stores parsed data scraped from widgets and workflow snapshots.

Important sections:

```js
scrapedData = {
  orderList: {
    buy: {},
    sell: {}
  },
  marketDepth: {
    buy: {},
    sell: {}
  },
  timeAndSales: {
    buy: {},
    sell: {},
    rows: []
  },
  sharePrice: {
    row: {},
    rows: [],
    matchedTimes: [],
    rawRows: []
  },
  workflow: {
    beforeBuy: { marketDepth: {} },
    afterBuy: { marketDepth: {}, orderList: {} },
    beforeSell: { marketDepth: {} },
    afterSell: { marketDepth: {}, orderList: {} },
    final: { orderList: {}, timeAndSales: {}, sharePrice: {} }
  }
}
```

### `validationReport`

Array of validation result objects. Each result normally contains:

```js
{
  timestamp,
  phase,
  widgetName,
  validationName,
  expected,
  actual,
  status,
  message
}
```

`status` is one of:

- `PASS`
- `WARN`
- `FAIL`

Final outcome rule:

- If any validation item has `status === "FAIL"`, the run prints `TRADE DATA VALIDATION FAILED`.
- If there are no FAIL items, the run prints `TRADE DATA VALIDATION PASSED`.
- WARN items do not fail the final run.

### `widgetDiagnostics`

Stores targeted diagnostics, mainly for Market Depth when key snapshots are empty.

It records:

- attempted container XPaths
- chosen container metadata
- visible inputs and values
- selector counts
- visible leaf text
- visible rows
- raw text preview

## Value Normalization and Comparison Rules

### Text normalization

`normalizeText(value, toUpper = true)`:

- Converts `null` and `undefined` to empty string.
- Collapses whitespace.
- Trims.
- Uppercases by default.

### Number normalization

`normalizeNumber(value)`:

- Removes commas.
- Removes non-numeric characters except `.` and `-`.
- Converts to `Number`.
- Returns `null` if the value is not parseable.

Examples:

| Raw value | Normalized |
|---|---:|
| `"15,000.00"` | `15000` |
| `"0.00%"` | `0` |
| `""` | `null` |

### Time normalization

`normalizeTime(value)`:

- Extracts values shaped like `HH:MM`, `HH:MM:SS`, optionally with milliseconds and AM/PM.
- Returns normalized clock text.
- Returns empty string for plain numbers such as `"1"`.

`timesClose(expected, actual, toleranceMs = 1500)`:

- Converts both values to comparable Date objects on a dummy date.
- Returns true if the time difference is within 1500 ms.

### Validation result logging

`addValidationResult(...)` lives in `validation/common.js` and appends normalized validation records into `validationReport`.

Each result includes:

- timestamp
- phase
- widgetName
- validationName
- expected
- actual
- status
- message

`validateAndReportField(phase, widgetName, validationName, expected, actual, type, failStatus = "FAIL")` combines `valuesMatch()` with `addValidationResult()`. It is the standard helper for field-level comparisons in the current workflow.

### Generic comparison

`valuesMatch(expected, actual, type)` handles:

| Type | Logic |
|---|---|
| `number` | Normalize both values and compare with `PRICE_TOLERANCE`. |
| `time` | Normalize time, compare exact, compare via `timesClose`, or compare prefix/inclusion for compatible time strings. |
| `boCode` | Uses exact-safe BO matching so `10` does not match `100`. |
| `text` | Normalized exact or word-boundary text comparison. |

## Widget Filters

### Place Order

`fillPlaceOrderForm(driver, orderType, boCode)` fills:

| Field | BUY value | SELL value |
|---|---|---|
| Toggle | BUY | SELL |
| Stock Exchange | `DSE` | `DSE` |
| Market Type | `PUBLIC` | `PUBLIC` |
| Trading Code | `GP` | `GP` |
| BO Code | `10` | `100` |
| Price Type | `Limit` | `Limit` |
| Quantity | `10` | `10` |
| Price | `15000` | `15000` |
| Display Quantity | `2` | `2` |
| Time in Force | `Day` | `Day` |
| Execution Instruction | `Release` | `Release` |
| Minimum Quantity | cleared | cleared |

After filling, the script verifies these input values:

- BO Code
- Stock Exchange
- Market Type
- Trading Code
- Price Type
- Quantity
- Price

### Order List

`fillOrderListSearch(driver, boCode)` filters:

| Field | Value |
|---|---|
| Stock Exchange | `DSE` |
| BO Code | dynamic: `10` after BUY, `100` after SELL |
| Trading Code | `GP` |

BO Code is selected with `selectOrderListBOCodeExact()`, which prevents selecting `100` when the expected value is `10`.

### Market Depth

`fillMarketDepth(driver)` filters:

| Field | Value |
|---|---|
| Stock Exchange | `DSE` |
| Trading Code | `GP` |
| Market Type | `PUBLIC` |

### Time and Sales

`fillTimeAndSales(driver)` filters:

| Field | Value |
|---|---|
| Stock Exchange | `DSE` |
| Trading Code | `GP` |
| Date | current date in `DD/MM/YYYY` |

### Share Price

Share Price is optional and runs last.

`fillSharePrice(driver)` does:

1. Click Share Price enlarge button.
2. Put/select `GP` in Share Price Trading Code.
3. Does not require input value confirmation.
4. Returns state:
   - `ready: true` when GP entry action was performed.
   - `enlarged: true` when the widget was enlarged.
5. After scraping, `restoreSharePriceWindow()` clicks the size button again to restore previous widget size.

If Share Price cannot be enlarged, cannot receive GP, or no GP row appears after retries, the Share Price segment is skipped without failing the run.

## Scraping and Parsing

The script uses a layered scraping strategy:

1. Build likely widget container XPaths.
2. Build likely row XPaths inside those containers.
3. Scrape visible rows.
4. Extract cells from table cells, ARIA grid cells, Material UI cells, and fallback visible leaf text.
5. Parse rows into structured objects.

### Order List parsed fields

Expected parsed fields:

- `boCode`
- `tradingCode`
- `pricingType`
- `qty`
- `type`
- `price`
- `status`
- `time`
- `execQty`
- `execRate`
- `execAmount`
- `transactTime`
- `exchange`
- `orderStatus`
- `execType`

The parser supports both header-based mapping and fallback cell mapping.

### Market Depth parsed fields

Expected parsed fields:

- `tradingCode`
- `bidPrice`
- `bidQuantity`
- `askPrice`
- `askQuantity`
- `marketType`
- `lastTradedPrice`
- `volume`
- `tradeCount`
- `vwap`

Market Depth has extra snapshot extraction logic because the visible DOM is sometimes not a normal grid/table.

### Time and Sales parsed fields

Expected parsed fields:

- `time`
- `market`
- `volume`
- `cumulativeVolume`
- `execPrice`
- `direction`
- `value`
- `tradingCode`

Important current behavior:

- Direction is parsed and stored if present.
- Direction is not used for validation.
- Direction is not used to filter matching rows.

### Share Price parsed fields

Expected parsed fields:

- `tradingCode`
- `ltTime`
- `lastTradedPrice`
- `volume`
- `bestBid`
- `bidQty`
- `bestAsk`
- `askQty`

`ltTime` is extracted from the first real clock-like value in the row, such as `10:41:23 AM`.

## Active Validation Matrix

### 1. Market Depth stage capture

Function: `captureMarketDepthStage()` in `flows/stageCapture.js`

Stages:

- `beforeBuy`
- `afterBuy`
- `beforeSell`
- `afterSell`

Validation:

| Validation | Expected | Actual | PASS | WARN |
|---|---|---|---|---|
| `<stageKey> snapshot captured` | snapshot rows captured | row count | row count > 0 | row count = 0 or scrape error |

Extra diagnostics:

- If `beforeBuy` or `afterSell` is empty, targeted Market Depth diagnostics are captured.

### 2. Order List stage capture

Function: `captureOrderListStage()` in `flows/stageCapture.js`

Stages:

- `afterBuy`
- `afterSell`

Validation:

| Validation | Expected | Actual | PASS | WARN |
|---|---|---|---|---|
| `<stageKey> snapshot captured` | snapshot rows captured | row count | row count > 0 | row count = 0 or scrape error |

### 3. Order List row validation

Function: `scrapeAndValidateOrderListForSide(driver, side)`

Runs for:

- BUY
- SELL

Expected source:

- BUY uses `placedOrders.buy`.
- SELL uses `placedOrders.sell`.

#### Wrong BO Code check

| Side | Expected | Actual | FAIL condition |
|---|---|---|---|
| BUY | Not `100` | Whether rows contain BO `100` + `GP` | Opposite BO Code found |
| SELL | Not `10` | Whether rows contain BO `10` + `GP` | Opposite BO Code found |

#### Exact row presence

The script finds the best matching Order List row using `findBestOrderListMatch()`.

Scoring:

| Field compared | Points |
|---|---:|
| BO Code | 40 |
| Trading Code | 25 |
| Type | 20 |
| Price Type | 10 |
| Quantity | 10 |
| Price | 10 |
| Stock Exchange | 5 |

The row must score at least `70`.

| Validation | Expected | Actual | PASS | FAIL |
|---|---|---|---|---|
| `<BUY/SELL> exact Order List row presence` | full placed order object | best matched row and score | row matched | no row matched |

#### Field-by-field Order List comparisons

| Validation | Expected source | Actual source | Type |
|---|---|---|---|
| BO Code matches Place Order | `placedOrders[side].boCode` | `row.boCode` | `boCode` |
| Trading Code matches Place Order | `placedOrders[side].tradingCode` | `row.tradingCode` | `text` |
| Pricing Type matches Place Order Price Type | `placedOrders[side].priceType` | `row.pricingType` | `text` |
| Qty matches Place Order Quantity | `placedOrders[side].quantity` | `row.qty` | `number` |
| Type matches Place Order Order Type | `placedOrders[side].orderType` | `row.type` | `text` |
| Price matches Place Order Price | `placedOrders[side].price` | `row.price` | `number` |

All of these use `validateAndReportField()` with default fail status `FAIL`.

#### Execution fields captured

Expected fields:

- Time
- Exec Qty
- Exec Rate
- Exec Amount
- Transact Time

Actual source:

- Parsed Order List row.

Status:

- `PASS` if transaction time, exec quantity, or exec rate is available.
- `WARN` if execution-related fields are not available.

Executed rows can derive:

- `execQty` from `qty`
- `execRate` from `price`
- `transactTime` from `time`

### 4. Market Depth validation

Function: `scrapeAndValidateMarketDepth(driver, side)`

Runs for:

- BUY
- SELL

| Validation | Expected | Actual | PASS | WARN |
|---|---|---|---|---|
| `<BUY/SELL> rows available` | at least one visible row | row count | not directly emitted when rows exist | emitted as WARN when row count = 0 |
| `<BUY/SELL> Trading Code GP visible` | `GP` | `row.tradingCode` | actual matches GP | actual does not match GP |
| Market Type matches PUBLIC | `PUBLIC` | `row.marketType` | actual matches PUBLIC | mismatch |

### 5. Market Depth before/after comparison

Function: `compareMarketDepthSnapshots(phase, stageBeforeKey, stageAfterKey, side)`

Runs for:

- BUY: compares `beforeBuy` vs `afterBuy`.
- SELL: compares `beforeSell` vs `afterSell`.

#### Baseline snapshot before order

| Expected | Actual | PASS | WARN |
|---|---|---|---|
| snapshot available before order placement | before row count | row count > 0 | row count = 0 |

#### Snapshot after order

| Expected | Actual | PASS | WARN |
|---|---|---|---|
| snapshot available after order placement | after row count | row count > 0 | row count = 0 |

#### Market Depth changed after order

The script compares:

- total row count
- first row text
- first price
- first quantity

| Validation | PASS | WARN |
|---|---|---|
| `<BUY/SELL> Market Depth changed after order` | any compared value changed | no clear change |

#### Order List and Market Depth flow relation

| Expected | Actual fields | PASS | WARN |
|---|---|---|---|
| Order List confirms order while Market Depth reflects post-order state | `orderListPresent`, `marketDepthGpRows`, `marketDepthRows` | Order List side exists and Market Depth has GP rows or changed | otherwise |

### 6. Market Depth lifecycle comparison

Function: `compareMarketDepthLifecycle()`

Compares:

- `beforeBuy` Market Depth snapshot
- `afterSell` Market Depth snapshot

Expected:

- Market Depth after SELL should align with pre-BUY baseline.

The helper `marketDepthSnapshotsSimilar()` returns true if any of these are true:

- first rows match
- first prices and first quantities match
- row fingerprint overlap exists

| Validation | Expected | Actual | PASS | WARN |
|---|---|---|---|---|
| Market Depth returned to pre-BUY baseline after SELL | beforeBuy summary | afterSell summary | snapshots are similar | cannot confirm baseline return |

### 7. Time and Sales validation

Function: `scrapeAndValidateTimeAndSales(driver)`

The script first verifies rows exist:

| Validation | Expected | Actual | PASS | WARN |
|---|---|---|---|---|
| Time and Sales rows available | at least one visible row | row count | row count > 0 | row count = 0 |

Then it loops over:

- BUY
- SELL

For each side, it uses the saved Order List row from:

- `scrapedData.orderList.buy`
- `scrapedData.orderList.sell`

#### Preconditions

If `savedOrderList.transactTime` is missing:

| Validation | Expected | Actual | Status |
|---|---|---|---|
| `<BUY/SELL> Transact Time available for matching` | Order List Transact Time | empty/missing value | WARN |

If execution data is not ready:

Execution is considered not ready when:

- `execQty` normalizes to `0`, or
- both `execQty` and `execRate` are not parseable.

| Validation | Expected | Actual | Status |
|---|---|---|---|
| `<BUY/SELL> execution data ready` | Executed quantity/rate in Order List | execQty, execRate, orderStatus | WARN |

This commonly happens when BUY remains `Submitted`.

#### Matching rule

Function: `findTimeAndSalesMatches()`

Rows are matched only by:

- `savedOrderList.transactTime` vs `Time and Sales.time`

Direction is intentionally ignored.

#### Time and Sales field comparisons

| Validation | Expected source | Actual source | Type | Failure level |
|---|---|---|---|---|
| Time matches Order List Transact Time | `savedOrderList.transactTime` | matched Time and Sales summary `time` | `time` | WARN |
| Exec Price matches Order List Exec Rate | `savedOrderList.execRate` | matched summary `execPrice` | `number` | WARN |
| Aggregated Volume matches Order List Exec Qty | `savedOrderList.execQty` | sum of matched Time and Sales `volume` | `number` | WARN |
| Cumulative Volume delta matches Order List Exec Qty | `savedOrderList.execQty` | max cumulative volume minus min cumulative volume | `number` | WARN |

Important current rule:

- Time and Sales `direction` is not validated.
- Time and Sales `direction` is not used for filtering matched rows.

### 8. Share Price validation

Function: `scrapeAndValidateSharePrice(driver)`

Share Price runs only if `ENABLE_SHARE_PRICE_VALIDATION === true`.

Preconditions:

1. Share Price must enlarge.
2. The script must put/select `GP`.
3. Scraping must find at least one row where `tradingCode` is `GP`.

If no GP row appears after `SHARE_PRICE_SCRAPE_ATTEMPTS`, Share Price is skipped without a validation failure.

#### Share Price comparisons

| Validation | Expected source | Actual source | Type/logic | Status on mismatch |
|---|---|---|---|---|
| Trading Code matches GP | literal `GP` | `row.tradingCode` | text | FAIL |
| LT Time matches Order List Time | `scrapedData.orderList.buy.time`, `scrapedData.orderList.sell.time` | `row.ltTime` | at least one time match | WARN |
| LTP aligns with saved trade price | `scrapedData.orderList.buy.execRate`, `scrapedData.orderList.sell.execRate`, `placedOrders.buy.price`, `placedOrders.sell.price` | `row.lastTradedPrice` | numeric within tolerance | WARN |
| Share Price LT Time aligns with Time and Sales | `scrapedData.timeAndSales.buy.time`, `scrapedData.timeAndSales.sell.time` | `row.ltTime` | at least one time match | WARN |
| Share Price LTP aligns with Time and Sales Exec Price | `scrapedData.timeAndSales.buy.execPrice`, `scrapedData.timeAndSales.sell.execPrice` | `row.lastTradedPrice` | numeric within tolerance | WARN |

## Current Active Final Result Logic

The final summary is printed by `printValidationSummary()`.

It counts:

- total PASS
- total WARN
- total FAIL

Final result:

| Condition | Printed result |
|---|---|
| `failCount > 0` | `TRADE DATA VALIDATION FAILED` |
| `failCount === 0` | `TRADE DATA VALIDATION PASSED` |

WARN items are treated as non-blocking.

## Output Artifacts

The script writes files relative to the current working directory where `node login.test.js` is executed.

### Validation report

Generated by `saveValidationReport()`:

- `validation-report.json`
- `validation-report-<timestamp>.json`

Contains:

- all validation results
- expected values
- actual values
- PASS/WARN/FAIL status
- message

### Scraped data report

Generated by `saveScrapedDataReport()`:

- `scraped-trade-data.json`
- `scraped-trade-data-<timestamp>.json`

Contains:

- placed/scraped Order List rows
- Market Depth rows and snapshots
- Time and Sales rows and matched summaries
- Share Price rows and matched row
- workflow snapshots

### Widget diagnostics

Generated by `saveWidgetDiagnostics()`:

- `widget-diagnostics.json`

Contains targeted widget diagnostics, mostly for Market Depth empty stage snapshots.

## Known Runtime Behaviors and Non-Blocking Warnings

### BUY execution may remain pending

The BUY order often appears as `Submitted` without execution quantity/rate.

When this happens:

- BUY Time and Sales validation is skipped.
- A WARN is recorded.
- The final run can still pass if there are no FAIL items.

### Market Depth can be unstable

Market Depth sometimes exposes only the filter shell, not the true book rows.

When key snapshots are empty:

- WARN is recorded.
- Diagnostics are captured for `beforeBuy` and `afterSell`.
- The run can still pass if no FAIL items exist.

### Share Price is optional

Share Price is useful for final cross-widget validation, but it is not allowed to break the whole workflow when GP data does not appear.

If Share Price GP data is found, it is validated.

If not found:

- the segment is skipped
- the widget size is restored if it had been enlarged
- no FAIL is added solely because Share Price was unavailable

## Active Validation Functions

These functions are used by the current main workflow:

- `captureMarketDepthStage()` from `flows/stageCapture.js`
- `captureOrderListStage()` from `flows/stageCapture.js`
- `scrapeAndValidateOrderListForSide()` from `validation/orderList.js`
- `scrapeAndValidateMarketDepth()` from `validation/marketDepth.js`
- `compareMarketDepthSnapshots()` from `validation/marketDepth.js`
- `captureFinalOrderListStage()` from `flows/stageCapture.js`
- `scrapeAndValidateTimeAndSales()` from `validation/timeAndSales.js`
- `compareMarketDepthLifecycle()` from `validation/marketDepth.js`
- `fillSharePrice()` from `flows/filters.js`
- `scrapeAndValidateSharePrice()` from `validation/sharePrice.js`

## Summary of Cross-Widget Comparisons

| Source widget | Source field | Target widget | Target field | Purpose |
|---|---|---|---|---|
| Place Order | BO Code | Order List | BO Code | Verify correct account/order owner. |
| Place Order | Trading Code | Order List | Trading Code | Verify GP order appears. |
| Place Order | Order Type | Order List | Type | Verify BUY/SELL side in Order List. |
| Place Order | Price Type | Order List | Pricing Type | Verify Limit order type. |
| Place Order | Quantity | Order List | Qty | Verify order quantity. |
| Place Order | Price | Order List | Price | Verify order price. |
| Order List | Transact Time | Time and Sales | Time | Find matching trade rows. |
| Order List | Exec Rate | Time and Sales | Exec Price | Verify executed price. |
| Order List | Exec Qty | Time and Sales | aggregated Volume | Verify total traded volume. |
| Order List | Exec Qty | Time and Sales | Cumulative Volume delta | Telemetry check, currently WARN-level. |
| Order List | Time | Share Price | LT Time | Verify Share Price updates around order time. |
| Order List / Place Order | Exec Rate / Price | Share Price | LTP | Verify Share Price LTP aligns with order price. |
| Time and Sales | Time | Share Price | LT Time | Verify final widgets reference same event time. |
| Time and Sales | Exec Price | Share Price | LTP | Verify final widget price consistency. |
| Market Depth | before snapshot | Market Depth | after snapshot | Verify book transition around BUY/SELL. |
| Market Depth | beforeBuy snapshot | Market Depth | afterSell snapshot | Verify return to baseline after round trip. |
