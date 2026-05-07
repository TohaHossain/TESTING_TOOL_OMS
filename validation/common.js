const { PRICE_TOLERANCE } = require("../config/runtime");
const { validationReport } = require("../state/runState");
const {
  escapeRegExp,
  boCodeTextMatches
} = require("../core/autocomplete");

function normalizeText(value, toUpper = true) {
  if (value === null || value === undefined) return "";
  const cleaned = value.toString().replace(/\s+/g, " ").trim();
  return toUpper ? cleaned.toUpperCase() : cleaned;
}

function normalizeNumber(value) {
  if (value === null || value === undefined) return null;
  const cleaned = value
    .toString()
    .replace(/,/g, "")
    .replace(/[^\d.-]/g, "");

  if (!cleaned || cleaned === "-" || cleaned === "." || cleaned === "-.") {
    return null;
  }

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeTime(value) {
  const cleaned = normalizeText(value, false);
  if (!cleaned) return "";

  const timeOnlyMatch = cleaned.match(/(\d{1,2}:\d{2}(?::\d{2})?)(?:\.\d+)?\s*(AM|PM)?/i);
  if (timeOnlyMatch) {
    const clock = timeOnlyMatch[1];
    const meridiem = timeOnlyMatch[2] ? ` ${timeOnlyMatch[2].toUpperCase()}` : "";
    return normalizeText(`${clock}${meridiem}`);
  }

  return "";
}

function addValidationResult(
  widgetNameOrOptions,
  validationName,
  expected,
  actual,
  status,
  message
) {
  const options =
    typeof widgetNameOrOptions === "object" && widgetNameOrOptions !== null
      ? widgetNameOrOptions
      : {
          widgetName: widgetNameOrOptions,
          validationName,
          expected,
          actual,
          status,
          message
        };

  const normalizedStatus = (options.status || "WARN").toUpperCase();
  const item = {
    timestamp: new Date().toISOString(),
    phase: options.phase || "",
    widgetName: options.widgetName || "",
    validationName: options.validationName || "",
    expected: options.expected,
    actual: options.actual,
    status: normalizedStatus,
    message: options.message || ""
  };

  validationReport.push(item);

  const symbol = normalizedStatus === "PASS" ? "PASS" : normalizedStatus === "FAIL" ? "FAIL" : "WARN";
  console.log(
    `${symbol} [${normalizedStatus}] ${item.phase || "GENERAL"} | ${item.widgetName} | ${
      item.validationName
    } | expected=${JSON.stringify(item.expected)} | actual=${JSON.stringify(item.actual)} | ${
      item.message
    }`
  );
}

function timeStringToComparableDate(value) {
  const cleaned = normalizeText(value, false);
  if (!cleaned) return null;

  const match = cleaned.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.(\d+))?\s*(AM|PM)?/i);
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3] || "0");
  const milliseconds = Number((match[4] || "0").slice(0, 3).padEnd(3, "0"));
  const meridiem = (match[5] || "").toUpperCase();

  if (meridiem === "PM" && hours < 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;

  const comparable = new Date(Date.UTC(2000, 0, 1, hours, minutes, seconds, milliseconds));
  return Number.isNaN(comparable.getTime()) ? null : comparable;
}

function timesClose(expected, actual, toleranceMs = 1500) {
  const expectedDate = timeStringToComparableDate(expected);
  const actualDate = timeStringToComparableDate(actual);

  if (!expectedDate || !actualDate) return false;
  return Math.abs(actualDate.getTime() - expectedDate.getTime()) <= toleranceMs;
}

function numbersClose(actual, expected, tolerance = PRICE_TOLERANCE) {
  const normalizedActual = normalizeNumber(actual);
  const normalizedExpected = normalizeNumber(expected);

  if (normalizedActual === null || normalizedExpected === null) return false;
  return Math.abs(normalizedActual - normalizedExpected) <= tolerance;
}

function valuesMatch(expected, actual, type = "text") {
  if (type === "number") {
    const expectedNumber = normalizeNumber(expected);
    const actualNumber = normalizeNumber(actual);

    if (expectedNumber === null || actualNumber === null) return false;
    return numbersClose(actualNumber, expectedNumber, PRICE_TOLERANCE);
  }

  if (type === "time") {
    const expectedTime = normalizeTime(expected);
    const actualTime = normalizeTime(actual);

    if (!expectedTime || !actualTime) return false;

    return (
      expectedTime === actualTime ||
      timesClose(expected, actual) ||
      expectedTime.includes(actualTime) ||
      actualTime.includes(expectedTime) ||
      expectedTime.startsWith(actualTime) ||
      actualTime.startsWith(expectedTime)
    );
  }

  if (type === "boCode") {
    return boCodeTextMatches(actual, expected) || boCodeTextMatches(expected, actual);
  }

  const expectedText = normalizeText(expected);
  const actualText = normalizeText(actual);

  if (!expectedText || !actualText) return false;
  if (expectedText === actualText) return true;

  if (/^\d+$/.test(expectedText) && /^\d+$/.test(actualText)) {
    return expectedText === actualText;
  }

  const escapedExpected = escapeRegExp(expectedText);
  const escapedActual = escapeRegExp(actualText);
  const expectedAsWord = new RegExp(`(^|\\s|[^A-Z0-9])${escapedExpected}($|\\s|[^A-Z0-9])`);
  const actualAsWord = new RegExp(`(^|\\s|[^A-Z0-9])${escapedActual}($|\\s|[^A-Z0-9])`);

  return expectedAsWord.test(actualText) || actualAsWord.test(expectedText);
}

function validateAndReportField(phase, widgetName, validationName, expected, actual, type, failStatus = "FAIL") {
  const matched = valuesMatch(expected, actual, type);

  addValidationResult({
    phase,
    widgetName,
    validationName,
    expected,
    actual,
    status: matched ? "PASS" : failStatus,
    message: matched
      ? `${validationName} matched successfully.`
      : `${validationName} mismatch detected.`
  });

  return matched;
}

function getPhaseName(side) {
  return side.toString().trim().toUpperCase();
}

module.exports = {
  normalizeText,
  normalizeNumber,
  normalizeTime,
  addValidationResult,
  timeStringToComparableDate,
  timesClose,
  numbersClose,
  valuesMatch,
  validateAndReportField,
  getPhaseName
};
