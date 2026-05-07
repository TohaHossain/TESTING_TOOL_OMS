const validationReport = [];
const widgetDiagnostics = [];

const placedOrders = {
  buy: {},
  sell: {}
};

const scrapedData = {
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
    beforeBuy: {
      marketDepth: {}
    },
    afterBuy: {
      marketDepth: {},
      orderList: {}
    },
    beforeSell: {
      marketDepth: {}
    },
    afterSell: {
      marketDepth: {},
      orderList: {}
    },
    final: {
      orderList: {},
      timeAndSales: {},
      sharePrice: {}
    }
  }
};

function savePlacedOrder(side, data) {
  placedOrders[side] = {
    orderType: data.orderType || "",
    boCode: data.boCode || "",
    stockExchange: data.stockExchange || "",
    tradingCode: data.tradingCode || "",
    quantity: data.quantity || "",
    price: data.price || "",
    priceType: data.priceType || "",
    displayQuantity: data.displayQuantity || ""
  };

  console.log(`Placed order data saved for ${side}: ${JSON.stringify(placedOrders[side])}`);
}

function buildExpectedOrder(orderType, boCode) {
  return {
    orderType: orderType.toString().trim().toUpperCase(),
    boCode: boCode.toString().trim(),
    tradingCode: "GP",
    stockExchange: "DSE",
    marketType: "PUBLIC",
    quantity: 10,
    price: 15000,
    displayQuantity: 2
  };
}

function saveWorkflowStageRows(stageKey, widgetName, rows, extra = {}, buildSummary = null) {
  if (!scrapedData.workflow[stageKey]) {
    scrapedData.workflow[stageKey] = {};
  }

  scrapedData.workflow[stageKey][widgetName] = {
    timestamp: new Date().toISOString(),
    totalRows: (rows || []).length,
    rows: rows || [],
    summary: typeof buildSummary === "function" ? buildSummary(rows || []) : null,
    ...extra
  };
}

module.exports = {
  validationReport,
  widgetDiagnostics,
  placedOrders,
  scrapedData,
  savePlacedOrder,
  buildExpectedOrder,
  saveWorkflowStageRows
};
