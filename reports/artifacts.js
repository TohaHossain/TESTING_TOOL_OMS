const fs = require("fs");
const {
  validationReport,
  widgetDiagnostics,
  scrapedData
} = require("../state/runState");

function printValidationSummary() {
  console.log("===== VALIDATION SUMMARY START =====");
  console.log(JSON.stringify(validationReport, null, 2));

  const passCount = validationReport.filter(item => item.status === "PASS").length;
  const warnCount = validationReport.filter(item => item.status === "WARN").length;
  const failCount = validationReport.filter(item => item.status === "FAIL").length;

  console.log(`Total PASS: ${passCount}`);
  console.log(`Total WARN: ${warnCount}`);
  console.log(`Total FAIL: ${failCount}`);

  if (failCount > 0) {
    console.log("TRADE DATA VALIDATION FAILED");
  } else {
    console.log("TRADE DATA VALIDATION PASSED");
  }

  console.log("===== VALIDATION SUMMARY END =====");
}

function printWidgetDiagnosticsSummary() {
  console.log("===== WIDGET DIAGNOSTICS SUMMARY START =====");

  if (widgetDiagnostics.length === 0) {
    console.log("No widget diagnostics captured.");
    console.log("===== WIDGET DIAGNOSTICS SUMMARY END =====");
    return;
  }

  console.log(JSON.stringify(widgetDiagnostics, null, 2));
  console.log(`Total diagnostic captures: ${widgetDiagnostics.length}`);
  console.log("===== WIDGET DIAGNOSTICS SUMMARY END =====");
}

function buildArtifactTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function saveValidationReport() {
  try {
    const content = JSON.stringify(validationReport, null, 2);
    const timestamp = buildArtifactTimestamp();
    fs.writeFileSync("validation-report.json", content);
    fs.writeFileSync(`validation-report-${timestamp}.json`, content);
    console.log("validation-report.json saved");
  } catch (err) {
    console.log(`Failed to save validation-report.json: ${err.message}`);
  }
}

function saveScrapedDataReport() {
  try {
    const content = JSON.stringify(scrapedData, null, 2);
    const timestamp = buildArtifactTimestamp();
    fs.writeFileSync("scraped-trade-data.json", content);
    fs.writeFileSync(`scraped-trade-data-${timestamp}.json`, content);
    console.log("scraped-trade-data.json saved");
  } catch (err) {
    console.log(`Failed to save scraped-trade-data.json: ${err.message}`);
  }
}

function saveWidgetDiagnostics() {
  try {
    fs.writeFileSync("widget-diagnostics.json", JSON.stringify(widgetDiagnostics, null, 2));
    console.log("widget-diagnostics.json saved");
  } catch (err) {
    console.log(`Failed to save widget-diagnostics.json: ${err.message}`);
  }
}

module.exports = {
  printValidationSummary,
  printWidgetDiagnosticsSummary,
  saveValidationReport,
  saveScrapedDataReport,
  saveWidgetDiagnostics
};
