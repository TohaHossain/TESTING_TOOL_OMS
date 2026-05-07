const { By, until, Key } = require("selenium-webdriver");
const {
  safeClick,
  isDisplayedSafe
} = require("./browserActions");

async function waitUntilSweetAlertClosed(driver, timeout = 30000) {
  await driver.wait(async () => {
    const overlays = await driver.findElements(
      By.xpath("//div[contains(@class,'swal-overlay') and contains(@class,'swal-overlay--show-modal')]")
    );

    for (const overlay of overlays) {
      if (await isDisplayedSafe(overlay)) {
        return false;
      }
    }

    return true;
  }, timeout);
}

async function handleSweetAlertIfPresent(driver, timeout = 30000) {
  try {
    const overlayXpath =
      "//div[contains(@class,'swal-overlay') and contains(@class,'swal-overlay--show-modal')]";

    const overlay = await driver.wait(until.elementLocated(By.xpath(overlayXpath)), 8000);
    await driver.wait(until.elementIsVisible(overlay), 8000);

    console.log("SweetAlert popup found");

    const buttonXpaths = [
      "//div[contains(@class,'swal-modal')]//button[contains(@class,'swal-button--confirm')]",
      "//div[contains(@class,'swal-modal')]//button[contains(@class,'swal-button')]",
      "//button[normalize-space()='OK']",
      "//button[normalize-space()='Ok']",
      "//button[normalize-space()='ok']"
    ];

    let clicked = false;

    for (const xpath of buttonXpaths) {
      const buttons = await driver.findElements(By.xpath(xpath));

      for (const button of buttons) {
        if (await isDisplayedSafe(button)) {
          await driver.wait(until.elementIsEnabled(button), timeout);
          await safeClick(driver, button);
          clicked = true;
          console.log("SweetAlert popup closed");
          break;
        }
      }

      if (clicked) break;
    }

    if (!clicked) {
      await driver.actions().sendKeys(Key.ENTER).perform();
      console.log("SweetAlert popup closed by ENTER key");
    }

    await waitUntilSweetAlertClosed(driver, timeout);
    await driver.sleep(1000);
  } catch (err) {
    console.log("No SweetAlert popup found. Continuing...");
  }
}

module.exports = {
  waitUntilSweetAlertClosed,
  handleSweetAlertIfPresent
};
