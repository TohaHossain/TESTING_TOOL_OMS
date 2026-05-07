const { widgetDiagnostics } = require("../state/runState");

async function collectWidgetDiagnostics(driver, widgetName, containerMatch, rowXpaths = [], reason = "") {
  const timestamp = new Date().toISOString();

  try {
    let diagnostic = {
      timestamp,
      widgetName,
      reason,
      containerXpath: containerMatch ? containerMatch.xpath : null,
      rowXpaths,
      container: null,
      selectorCounts: {},
      visibleSamples: []
    };

    if (containerMatch && containerMatch.element) {
      diagnostic = await driver.executeScript(
        `
        const container = arguments[0];
        const rowXpaths = arguments[1];
        const widgetName = arguments[2];
        const reason = arguments[3];

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

        const summarize = el => ({
          tagName: (el.tagName || "").toLowerCase(),
          id: el.id || "",
          className: typeof el.className === "string" ? el.className : "",
          role: el.getAttribute("role") || "",
          text: (el.innerText || el.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 160)
        });

        const selectors = {
          tr: "tr",
          roleRow: "[role='row']",
          muiTableRow: ".MuiTableRow-root",
          agRow: ".ag-row",
          reactTableRow: ".rt-tr",
          genericRow: ".row",
          grid: "[role='grid']",
          table: "table",
          cell: "td, th, [role='cell'], .MuiTableCell-root",
          input: "input",
          button: "button",
          svg: "svg"
        };

        const selectorCounts = {};
        for (const [key, selector] of Object.entries(selectors)) {
          selectorCounts[key] = container.querySelectorAll(selector).length;
        }

        const candidates = Array.from(
          container.querySelectorAll(
            "tr, [role='row'], .MuiTableRow-root, .ag-row, .rt-tr, .row, [role='cell'], td, th, .MuiTableCell-root, div, span"
          )
        )
          .filter(isVisible)
          .map(summarize)
          .filter(item => item.text)
          .slice(0, 25);

        return {
          timestamp: new Date().toISOString(),
          widgetName,
          reason,
          rowXpaths,
          container: {
            ...summarize(container),
            childElementCount: container.childElementCount
          },
          selectorCounts,
          visibleSamples: candidates
        };
        `,
        containerMatch.element,
        rowXpaths,
        widgetName,
        reason
      );

      diagnostic.containerXpath = containerMatch.xpath;
    }

    widgetDiagnostics.push(diagnostic);

    console.log(`Widget diagnostics captured for ${widgetName}`);
    if (diagnostic.container) {
      console.log(
        `${widgetName} container: tag=${diagnostic.container.tagName}, id=${diagnostic.container.id}, class=${diagnostic.container.className}`
      );
    }

    if (diagnostic.selectorCounts) {
      console.log(`${widgetName} selector counts: ${JSON.stringify(diagnostic.selectorCounts)}`);
    }

    if (diagnostic.visibleSamples && diagnostic.visibleSamples.length > 0) {
      console.log(
        `${widgetName} visible samples: ${diagnostic.visibleSamples
          .slice(0, 5)
          .map(sample => sample.text)
          .join(" || ")}`
      );
    }
  } catch (err) {
    console.log(`[WARN] ${widgetName}: widget diagnostics failed: ${err.message}`);
  }
}

async function collectMarketDepthStageDiagnostics(
  driver,
  stageKey,
  phase,
  reason,
  { buildContainerXpaths, findFirstVisibleElementByXpaths }
) {
  const timestamp = new Date().toISOString();
  const containerXpaths = buildContainerXpaths();
  const containerMatch = await findFirstVisibleElementByXpaths(driver, containerXpaths);

  if (!containerMatch || !containerMatch.element) {
    widgetDiagnostics.push({
      timestamp,
      diagnosticType: "market-depth-stage",
      widgetName: "Market Depth",
      phase,
      stageKey,
      reason,
      containerXpath: null,
      attemptedContainerXpaths: containerXpaths,
      message: "No visible Market Depth container found at targeted diagnostic moment."
    });
    console.log(`Market Depth targeted diagnostics captured for ${stageKey}: no visible container.`);
    return;
  }

  try {
    const diagnostic = await driver.executeScript(
      `
      const container = arguments[0];
      const stageKey = arguments[1];
      const phase = arguments[2];
      const reason = arguments[3];
      const attemptedXpaths = arguments[4];

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
      const summarize = el => ({
        tagName: (el.tagName || "").toLowerCase(),
        id: el.id || "",
        className: typeof el.className === "string" ? el.className : "",
        role: el.getAttribute("role") || "",
        text: textOf(el).slice(0, 220)
      });

      const selectors = {
        roleRow: "[role='row']",
        agRow: ".ag-row",
        rowLike: ".row",
        headerCell: ".ag-header-cell, th, [role='columnheader']",
        gridBody: ".ag-body-viewport, .ag-center-cols-viewport, .ag-center-cols-container, .ag-body-horizontal-scroll-viewport",
        input: "input",
        button: "button",
        svg: "svg",
        div: "div",
        span: "span"
      };

      const selectorCounts = {};
      for (const [key, selector] of Object.entries(selectors)) {
        selectorCounts[key] = container.querySelectorAll(selector).length;
      }

      const visibleInputs = Array.from(container.querySelectorAll("input"))
        .filter(isVisible)
        .map(el => ({
          id: el.id || "",
          name: el.name || "",
          className: typeof el.className === "string" ? el.className : "",
          value: (el.value || "").trim()
        }));

      const visibleHeaders = Array.from(
        container.querySelectorAll(".ag-header-cell, th, [role='columnheader']")
      )
        .filter(isVisible)
        .map(textOf)
        .filter(Boolean)
        .slice(0, 30);

      const visibleRows = Array.from(
        container.querySelectorAll(".ag-row, [role='row'], tr, .row")
      )
        .filter(isVisible)
        .map(summarize)
        .filter(item => item.text)
        .slice(0, 20);

      const visibleLeafTexts = Array.from(
        container.querySelectorAll("div, span, p, td, th, label")
      )
        .filter(isVisible)
        .map(textOf)
        .filter(Boolean)
        .filter((text, index, arr) => arr.indexOf(text) === index)
        .slice(0, 80);

      return {
        timestamp: new Date().toISOString(),
        diagnosticType: "market-depth-stage",
        widgetName: "Market Depth",
        phase,
        stageKey,
        reason,
        attemptedContainerXpaths: attemptedXpaths,
        container: {
          ...summarize(container),
          childElementCount: container.childElementCount
        },
        selectorCounts,
        visibleInputs,
        visibleHeaders,
        visibleRows,
        visibleLeafTexts,
        rawTextPreview: textOf(container).slice(0, 2000)
      };
      `,
      containerMatch.element,
      stageKey,
      phase,
      reason,
      containerXpaths
    );

    diagnostic.containerXpath = containerMatch.xpath;
    widgetDiagnostics.push(diagnostic);
    console.log(`Market Depth targeted diagnostics captured for ${stageKey}.`);
  } catch (err) {
    widgetDiagnostics.push({
      timestamp,
      diagnosticType: "market-depth-stage",
      widgetName: "Market Depth",
      phase,
      stageKey,
      reason,
      containerXpath: containerMatch.xpath,
      attemptedContainerXpaths: containerXpaths,
      error: err.message
    });
    console.log(`Market Depth targeted diagnostics failed for ${stageKey}: ${err.message}`);
  }
}

module.exports = {
  collectWidgetDiagnostics,
  collectMarketDepthStageDiagnostics
};
