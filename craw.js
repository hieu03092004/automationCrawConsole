const playwright = require('playwright');
const { nanoid } = require('nanoid');
const fs = require('fs');
const path = require('path');

// KHÔNG CÒN BIẾN TOÀN CỤC (GLOBAL VARIABLE)
// const allLogsMap = new Map(); 

const BROWSER_OPTION = { 
  chromium: playwright.chromium,
  firefox: playwright.firefox,
  webkit: playwright.webkit
};

// Hàm này giờ sẽ làm việc trên một map được truyền vào
function getOrCreateLogKey(msg, logMap) {
  for (const [key, value] of logMap.entries()) {
    if (value === msg) return key;
  }
  const key = nanoid();
  logMap.set(key, msg);
  return key;
}

function parseURL(urlString) {
  try {
    const urlObject = new URL(urlString);
    const username = urlObject.username;
    const password = urlObject.password;

    urlObject.username = '';
    urlObject.password = '';
    
    return {
      url: urlObject.href,
      username: decodeURIComponent(username),
      password: decodeURIComponent(password),
    };
  } catch (e) {
    return { url: urlString, username: '', password: '' };
  }
}

// Hàm này giờ sẽ làm việc trên một map được truyền vào
const crawConsoleBrowser = async (crawParams = {}, logMap) => {
  let { url, browser } = crawParams;
  if (!url || !browser) {
    throw new Error('Invalid payload input');
  }

  const browserOS = BROWSER_OPTION[browser];
  if (!browserOS) {
    throw new Error('Can\'t support this browser');
  }

  const browserInstance = await browserOS.launch({
    headless: true,
    args: browser === 'webkit' ? [] : ['--no-sandbox', '--disable-setuid-sandbox']
  });
  // Tắt log này để đỡ nhiễu
  // console.log(`[Start browser ${browser} - ${browserInstance.version()}] success`);

  const contextParams = { ignoreHTTPSErrors: true };
  const itemURL = parseURL(url);

  if (itemURL.username && itemURL.password) {
    contextParams.httpCredentials = { username: itemURL.username, password: itemURL.password };
  }
  url = itemURL.url;

  const context = await browserInstance.newContext(contextParams);
  const page = await context.newPage();
  
  const logsMap = {
    info: new Set(),
    warn: new Set(),
    error: new Set()
  };

  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    const logKey = getOrCreateLogKey(text.trim(), logMap); // Sử dụng logMap được truyền vào
    switch(type) {
      case 'error':
        logsMap.error.add(logKey);
        break;
      case 'warning':
        logsMap.warn.add(logKey);
        break;
      default:
        logsMap.info.add(logKey);
    }
  });

  try {
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  } catch(error) {
    // Không log lỗi ở đây để tránh nhiễu, vì đã có try2pass xử lý
  }
  
  await page.evaluate(() => {
    document.querySelector('#onetrust-accept-btn-handler')?.click();
    document?.querySelector("#usercentrics-root")?.shadowRoot?.querySelector("[data-testid='uc-accept-all-button']")?.click();
  });

  try {
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  } catch (error) {
    // Không log lỗi ở đây
  }

  if (page.viewportSize()) {
    const viewportHeight = page.viewportSize().height;
    const stepHeight = Math.round(viewportHeight / 3);
    let distanceToScroll = await page.evaluate(() => document.body.scrollHeight);
    let scrollDistance = 0;
    while (scrollDistance < distanceToScroll) {
      await page.mouse.wheel(0, stepHeight);
      await page.waitForTimeout(100);
      scrollDistance += stepHeight;
      const newScrollHeight = await page.evaluate(() => document.body.scrollHeight);
      if (newScrollHeight > distanceToScroll) {
          distanceToScroll = newScrollHeight;
      }
    }
  }
  
  await page.waitForTimeout(5000);

  await browserInstance.close();
  // console.log(`[Stop browser ${browser}] success`);

  const logsObject = {
    info: Array.from(logsMap.info),
    warn: Array.from(logsMap.warn),
    error: Array.from(logsMap.error)
  };

  return { 
    [browser]: {
      logs: logsObject
    }
  };
};

const crawConsoleALLBrowser = async ({ url }) => {
  const localLogMapForThisUrl = new Map(); // Map cục bộ cho lần crawl này
  const consoles = {};
  
  for (const browser in BROWSER_OPTION) {
    if (Object.prototype.hasOwnProperty.call(BROWSER_OPTION, browser)) {
      const data = await crawConsoleBrowser({ url, browser }, localLogMapForThisUrl);
      consoles[browser] = data[browser];
    }
  }

  // Chuyển đổi map thành object {key: value} để trả về
  const collectedLogs = {};
  for (const [key, value] of localLogMapForThisUrl.entries()) {
    collectedLogs[key] = value;
  }
  
  return { consoles, collectedLogs }; // Trả về cả kết quả và log đã thu thập
};

// Xóa hàm không còn sử dụng
// function getAccumulatedLogs() { ... }

module.exports = {
  crawConsoleALLBrowser,
};