const playwright = require('playwright');
const { nanoid } = require('nanoid');
const fs = require('fs');
const path = require('path');

// Khai báo allLogsMap ở scope toàn cục
const allLogsMap = new Map(); // key: nanoid, value: log message

const BROWSER_OPTION = { 
  chromium: playwright.chromium,
  firefox: playwright.firefox,
  webkit: playwright.webkit
};

function getOrCreateLogKey(msg) {
  for (const [key, value] of allLogsMap.entries()) {
    if (value === msg) return key;
  }
  // Nếu chưa có, tạo mới
  const key = nanoid();
  allLogsMap.set(key, msg);
  return key;
}

function parseURL(urlString) {
  try {
    const urlObject = new URL(urlString);
    const username = urlObject.username;
    const password = urlObject.password;

    // Xây dựng lại URL không chứa thông tin đăng nhập
    urlObject.username = '';
    urlObject.password = '';
    
    return {
      url: urlObject.href,
      username: decodeURIComponent(username),
      password: decodeURIComponent(password),
    };
  } catch (e) {
    // Nếu phân tích URL thất bại, giả định đó là URL đơn giản không có thông tin xác thực
    return { url: urlString, username: '', password: '' };
  }
}

const crawConsoleBrowser = async (crawParams = {}) => {
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
  console.log(`[Start browser ${browser} - ${browserInstance.version()}] success`);

  const contextParams = { ignoreHTTPSErrors: true };
  const itemURL = parseURL(url);

  if (itemURL.username && itemURL.password) {
    contextParams.httpCredentials = { username: itemURL.username, password: itemURL.password };
  }
  url = itemURL.url;

  const context = await browserInstance.newContext(contextParams);
  const page = await context.newPage();
  
  // Logic thu thập log vẫn giữ nguyên
  const logsMap = {
    info: new Set(),
    warn: new Set(),
    error: new Set()
  };

  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    const logKey = getOrCreateLogKey(text.trim());
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
    console.error(`Error on first goto for ${url}: ${error.message}`);
  }
  
  // Cố gắng click vào các banner cookies
  await page.evaluate(() => {
    document.querySelector('#onetrust-accept-btn-handler')?.click();
    document?.querySelector("#usercentrics-root")?.shadowRoot?.querySelector("[data-testid='uc-accept-all-button']")?.click();
  });

  // Tải lại trang sau khi đã xử lý cookies
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  } catch (error) {
    console.error(`Error on second goto for ${url}: ${error.message}`);
  }

  // Cuộn trang bằng mouse wheel để mô phỏng người dùng
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
  
  // Chờ thêm để bắt các log có thể xuất hiện muộn
  await page.waitForTimeout(5000);

  await browserInstance.close();
  console.log(`[Stop browser ${browser}] success`);

  // Chuyển đổi Set thành mảng key, logic này giữ nguyên
  const logsObject = {
    info: Array.from(logsMap.info),
    warn: Array.from(logsMap.warn),
    error: Array.from(logsMap.error)
  };

  // Cấu trúc trả về giữ nguyên
  return { 
    [browser]: {
      logs: logsObject
    }
  };
};

const crawConsoleALLBrowser = async ({ url }) => {
  const consoles = {};
  
  for (const browser in BROWSER_OPTION) {
    if (Object.prototype.hasOwnProperty.call(BROWSER_OPTION, browser)) {
      const data = await crawConsoleBrowser({ url, browser });
      consoles[browser] = data[browser];
    }
  }
  return { consoles };
};

function getAccumulatedLogs() {
  const hash = {};
  for (const [key, value] of allLogsMap.entries()) {
    hash[key] = value;
  }
  return { hash };
}

module.exports = {
  crawConsoleALLBrowser,
  getAccumulatedLogs
};