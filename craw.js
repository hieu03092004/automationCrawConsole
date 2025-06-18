const playwright = require('playwright');
const { nanoid } = require('nanoid');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Khai báo allLogsMap ở scope toàn cục
const allLogsMap = new Map(); // key: nanoid, value: log message

const BROWSER_OPTION = { 
  chromium: playwright.chromium,
  firefox: playwright.firefox,
  webkit: playwright.webkit
};

// Hàm tạo tên file an toàn từ URL
function getUrlHash(url) {
  return crypto.createHash('md5').update(url).digest('hex').substring(0, 8);
}

function getOrCreateLogKey(msg) {
  for (const [key, value] of allLogsMap.entries()) {
    if (value === msg) return key;
  }
  // Nếu chưa có, tạo mới
  const key = nanoid();
  allLogsMap.set(key, msg);
  return key;
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

  const browserInstance = await browserOS.launch();
  const page = await browserInstance.newPage();
  
  // Sử dụng Set để lưu trữ logs dạng key
  const logsMap = {
    info: new Set(),
    warn: new Set(),
    error: new Set()
  };

  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    // Lấy key cho log message này
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

  await page.goto(url, { waitUntil: 'load' });
  await page.evaluate(async () => {
    await new Promise(resolve => {
      let total = 0;
      const distance = window.innerHeight;
      const timer = setInterval(() => {
        const prev = total;
        window.scrollBy(0, distance);
        total += distance;
        if (total > document.body.scrollHeight || total === prev) {
          clearInterval(timer);
          resolve();
        }
      }, 500);
    });
  });

  // Tạo thư mục images nếu chưa có
  const imagesDir = path.join('report', 'images');
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }

  // Tạo tên file ảnh từ URL và browser
  const urlHash = getUrlHash(url);
  const screenshotName = `${urlHash}-${browser}.png`;
  const screenshotPath = path.join(imagesDir, screenshotName);

  try {
    await page.screenshot({ 
      path: screenshotPath,
      fullPage: true
    });
  } catch (error) {
    console.error(`Error taking screenshot for ${url} on ${browser}:`, error.message);
  }

  // Chuyển đổi Set thành mảng key
  const logsObject = {
    info: Array.from(logsMap.info),
    warn: Array.from(logsMap.warn),
    error: Array.from(logsMap.error)
  };

  await browserInstance.close();

  // Lưu hash data logs
  const hashDataLogs = { hash: {} };
  for (const [key, value] of allLogsMap.entries()) {
    hashDataLogs.hash[key] = value;
  }
  fs.writeFileSync(
    path.resolve(__dirname, 'hashDataLogs.json'),
    JSON.stringify(hashDataLogs, null, 2)
  );

  return { 
    [browser]: {
      screenshot: `../images/${screenshotName}`,  // Đường dẫn tương đối từ report/html/index.html
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

module.exports = {
  crawConsoleALLBrowser
};
