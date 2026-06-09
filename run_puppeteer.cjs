const puppeteer = require('puppeteer');
(async () => {
  try {
    const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
    
    await page.goto('http://localhost:3000/tools/editor-v2/', { waitUntil: 'networkidle0' });
    
    const modeBtn = await page.$('#mode-script');
    if (modeBtn) {
      console.log('Found mode-script btn, clicking...');
      await modeBtn.click();
      const mode = await page.evaluate(() => document.body.dataset.mode);
      console.log('Body mode after click:', mode);
      
      const isWindowInit = await page.evaluate(() => window.__editorV2Init);
      console.log('window.__editorV2Init is:', isWindowInit);
    } else {
      console.log('Could not find mode-script btn');
    }
    
    await browser.close();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
