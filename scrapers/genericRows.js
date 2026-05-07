const { By } = require("selenium-webdriver");
const { isDisplayedSafe } = require("../core/browserActions");
const { normalizeText } = require("../validation/common");
const { collectWidgetDiagnostics } = require("./diagnostics");

async function getFirstVisibleInputValueByXpaths(driver, xpaths = []) {
  for (const xpath of xpaths) {
    try {
      const elements = await driver.findElements(By.xpath(xpath));

      for (const element of elements) {
        if (!(await isDisplayedSafe(element))) continue;

        const value = normalizeText(await element.getAttribute("value") || "", false);
        if (value) {
          return value;
        }
      }
    } catch (err) {
      console.log(`Input value lookup failed for xpath ${xpath}: ${err.message}`);
    }
  }

  return "";
}

async function findFirstVisibleElementByXpaths(driver, xpaths) {
  for (const xpath of xpaths || []) {
    try {
      const elements = await driver.findElements(By.xpath(xpath));

      for (const element of elements) {
        if (await isDisplayedSafe(element)) {
          return { element, xpath };
        }
      }
    } catch (err) {
      console.log(`Visible element lookup failed for xpath ${xpath}: ${err.message}`);
    }
  }

  return null;
}

async function scrapeTableRows(driver, widgetName, rowXpath, containerXpaths = []) {
  const timestamp = new Date().toISOString();
  const rowXpaths = Array.isArray(rowXpath) ? rowXpath : [rowXpath];

  try {
    let visibleRows = [];
    let selectedXpath = null;
    let containerPreview = null;
    let containerMatch = null;

    for (const xpath of rowXpaths) {
      const rows = await driver.findElements(By.xpath(xpath));
      const visibleForXpath = [];

      for (const row of rows) {
        try {
          if (await isDisplayedSafe(row)) {
            visibleForXpath.push(row);
          }
        } catch (err) {
          console.log(`${widgetName} row visibility check failed: ${err.message}`);
        }
      }

      if (visibleForXpath.length > 0) {
        visibleRows = visibleForXpath;
        selectedXpath = xpath;
        break;
      }
    }

    if (visibleRows.length === 0 && containerXpaths.length > 0) {
      containerMatch = await findFirstVisibleElementByXpaths(driver, containerXpaths);

      if (containerMatch) {
        selectedXpath = `${containerMatch.xpath} -> descendant row fallback`;

        try {
          const previewText = normalizeText(await containerMatch.element.getText(), false);
          containerPreview = previewText.slice(0, 600);
        } catch (previewErr) {
          console.log(`${widgetName} container preview read failed: ${previewErr.message}`);
        }

        const descendantRows = await containerMatch.element.findElements(
          By.xpath(
            ".//tr | .//*[@role='row'] | .//*[contains(@class,'MuiTableRow-root')] | .//*[contains(@class,'ag-row')] | .//*[contains(@class,'rt-tr')] | .//*[contains(@class,'row')]"
          )
        );

        for (const row of descendantRows) {
          try {
            if (await isDisplayedSafe(row)) {
              visibleRows.push(row);
            }
          } catch (err) {
            console.log(`${widgetName} descendant row visibility check failed: ${err.message}`);
          }
        }
      }
    }

    if (visibleRows.length === 0) {
      console.log(`[WARN] ${widgetName}: no visible rows found. Returning empty dataset.`);
      if (containerPreview) {
        console.log(`${widgetName} visible container preview: ${containerPreview}`);
      }
      await collectWidgetDiagnostics(
        driver,
        widgetName,
        containerMatch,
        rowXpaths,
        "No visible rows found during scrape"
      );
      return [];
    }

    const scraped = [];

    for (let index = 0; index < visibleRows.length; index++) {
      const row = visibleRows[index];

      try {
        const cellElements = await row.findElements(
          By.xpath(".//td | .//th | .//*[@role='cell'] | .//*[contains(@class,'MuiTableCell-root')]")
        );

        const cells = [];
        for (const cell of cellElements) {
          try {
            if (await isDisplayedSafe(cell)) {
              const cellText = normalizeText(await cell.getText(), false);
              if (cellText) cells.push(cellText);
            }
          } catch (cellErr) {
            console.log(`${widgetName}: cell read failed on row ${index + 1}: ${cellErr.message}`);
          }
        }

        if (cells.length === 0) {
          try {
            const fallbackCells = await driver.executeScript(
              `
              const row = arguments[0];

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

              const descendants = Array.from(
                row.querySelectorAll("td, th, [role='cell'], .MuiTableCell-root, span, div, p")
              ).filter(isVisible);

              const leafTexts = [];
              for (const el of descendants) {
                const text = textOf(el);
                if (!text) continue;

                const hasVisibleTextChild = Array.from(el.children || []).some(child => {
                  return isVisible(child) && textOf(child);
                });

                if (!hasVisibleTextChild) {
                  leafTexts.push(text);
                }
              }

              const deduped = [];
              for (const text of leafTexts) {
                if (deduped.length === 0 || deduped[deduped.length - 1] !== text) {
                  deduped.push(text);
                }
              }

              return deduped.slice(0, 40);
              `,
              row
            );

            for (const text of fallbackCells || []) {
              if (text) cells.push(normalizeText(text, false));
            }
          } catch (fallbackErr) {
            console.log(`${widgetName}: fallback cell extraction failed on row ${index + 1}: ${fallbackErr.message}`);
          }
        }

        const rowText = normalizeText(await row.getText(), false);
        if (!rowText && cells.length === 0) continue;

        scraped.push({
          widgetName,
          timestamp,
          rowIndex: index + 1,
          rowText,
          cells,
          rawText: rowText || cells.join(" | ")
        });
      } catch (rowErr) {
        console.log(`${widgetName}: row scrape failed on index ${index + 1}: ${rowErr.message}`);
      }
    }

    console.log(
      `${widgetName}: scraped ${scraped.length} visible rows using xpath "${selectedXpath}"`
    );
    return scraped;
  } catch (err) {
    console.log(`[WARN] ${widgetName}: table scrape failed: ${err.message}`);
    return [];
  }
}

async function scrapeWidgetRows(driver, widgetName, containerXpaths, preferredRowXpaths = []) {
  const rowXpaths = [...(preferredRowXpaths || [])];

  for (const containerXpath of containerXpaths || []) {
    rowXpaths.push(`${containerXpath}//tbody/tr`);
    rowXpaths.push(`${containerXpath}//*[@role='row']`);
    rowXpaths.push(`${containerXpath}//*[contains(@class,'MuiTableRow')]`);
    rowXpaths.push(`${containerXpath}//tr`);
    rowXpaths.push(`${containerXpath}//div[contains(@class,'row')]`);
  }

  return await scrapeTableRows(driver, widgetName, rowXpaths, containerXpaths);
}

module.exports = {
  getFirstVisibleInputValueByXpaths,
  findFirstVisibleElementByXpaths,
  scrapeTableRows,
  scrapeWidgetRows
};
