const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:3000/tools/');
  await page.waitForLoadState('networkidle');
  
  // Click Scenes tab
  await page.click('button.workspace-tab:has-text("Scenes")');
  
  // Check if scene grid is visible
  await page.waitForSelector('.scene-grid');
  const text = await page.innerText('.view-header h1');
  console.log("Header text:", text);
  
  await browser.close();
})();
