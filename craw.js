const playwright = require('playwright');
const { nanoid } = require('nanoid');
const fs = require('fs');
const path = require('path');

// Khai báo allLogsMap ở scope toàn cục
const allLogsMap = new Map(); // key: nanoid, value: log message

// File lock mechanism để tránh conflict khi nhiều process cùng ghi file
let isSaving = false;
const saveQueue = [];

const BROWSER_OPTION = { 
  chromium: playwright.chromium,
  firefox: playwright.firefox,
  webkit: playwright.webkit
};

function getOrCreateLogKey(msg) {
  // Ưu tiên kiểm tra trong allLogsMap (bộ nhớ tạm của process)
  for (const [key, value] of allLogsMap.entries()) {
    if (value === msg) return key;
  }
  // Nếu chưa có, kiểm tra trong file hashDataLogs.json
  const hashDataLogsPath = path.resolve(__dirname, 'hashDataLogs.json');
  if (fs.existsSync(hashDataLogsPath)) {
    try {
      const existingData = JSON.parse(fs.readFileSync(hashDataLogsPath, 'utf8'));
      if (existingData.hash) {
        for (const [key, value] of Object.entries(existingData.hash)) {
          if (value === msg) {
            // Lưu vào allLogsMap để các lần sau dùng lại trong process
            allLogsMap.set(key, value);
            return key;
          }
        }
      }
    } catch (error) {
      // Bỏ qua lỗi đọc file
    }
  }
  // Nếu chưa có ở đâu, tạo mới
  const key = nanoid();
  allLogsMap.set(key, msg);
  return key;
}

// Hàm load existing hashDataLogs
function loadExistingHashDataLogs() {
  const hashDataLogsPath = path.resolve(__dirname, 'hashDataLogs.json');
  if (fs.existsSync(hashDataLogsPath)) {
    try {
      const existingData = JSON.parse(fs.readFileSync(hashDataLogsPath, 'utf8'));
      if (existingData.hash) {
        for (const [key, value] of Object.entries(existingData.hash)) {
          allLogsMap.set(key, value);
        }
        console.log(`Loaded ${Object.keys(existingData.hash).length} existing log keys`);
      }
    } catch (error) {
      console.warn('Error loading existing hashDataLogs.json:', error.message);
    }
  }
}

// Hàm save hashDataLogs với file lock mechanism
async function saveHashDataLogs() {
  return new Promise((resolve, reject) => {
    saveQueue.push({ resolve, reject });
    processSaveQueue();
  });
}

async function processSaveQueue() {
  if (isSaving || saveQueue.length === 0) {
    return;
  }

  isSaving = true;
  const { resolve, reject } = saveQueue.shift();

  try {
    const hashDataLogsPath = path.resolve(__dirname, 'hashDataLogs.json');
    
    // Load existing data first
    let existingData = { hash: {} };
    if (fs.existsSync(hashDataLogsPath)) {
      try {
        existingData = JSON.parse(fs.readFileSync(hashDataLogsPath, 'utf8'));
      } catch (error) {
        console.warn('Error reading existing hashDataLogs.json:', error.message);
      }
    }
    
    // Tạo map để kiểm tra values đã tồn tại
    const existingValues = new Map();
    for (const [key, value] of Object.entries(existingData.hash)) {
      existingValues.set(value, key);
    }
    
    // Merge with current allLogsMap, tránh duplicate values
    const mergedHash = { ...existingData.hash };
    let newKeysAdded = 0;
    let duplicateValuesSkipped = 0;
    
    for (const [key, value] of allLogsMap.entries()) {
      if (existingValues.has(value)) {
        // Value đã tồn tại, bỏ qua key mới này
        duplicateValuesSkipped++;
      } else {
        // Value chưa tồn tại, thêm vào
        mergedHash[key] = value;
        existingValues.set(value, key);
        newKeysAdded++;
      }
    }
    
    const hashDataLogs = { hash: mergedHash };
    fs.writeFileSync(hashDataLogsPath, JSON.stringify(hashDataLogs, null, 2));
    
    console.log(`Saved ${newKeysAdded} new log keys to hashDataLogs.json (skipped ${duplicateValuesSkipped} duplicates, total: ${Object.keys(mergedHash).length})`);
    
    resolve();
  } catch (error) {
    console.error('Error saving hashDataLogs:', error.message);
    reject(error);
  } finally {
    isSaving = false;
    // Process next item in queue
    setTimeout(processSaveQueue, 100);
  }
}

// Load existing data khi module được load
loadExistingHashDataLogs();

const crawConsoleBrowser = async (crawParams = {}) => {
  let { url, browser } = crawParams;
  if (!url || !browser) {
    throw new Error('Invalid payload input');
  }

  const browserOS = BROWSER_OPTION[browser];
  if (!browserOS) {
    throw new Error('Can\'t support this browser');
  }

  // Sửa: chỉ truyền args đặc biệt cho Chromium
  const launchOptions = {
    timeout: 20000
  };
  if (browser === 'chromium') {
    launchOptions.args = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--ignore-certificate-errors',
      '--ignore-ssl-errors',
      '--ignore-certificate-errors-spki-list',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
      '--disable-dev-shm-usage',
      '--no-first-run',
      '--no-default-browser-check'
    ];
  }

  const browserInstance = await browserOS.launch(launchOptions);
  
  const page = await browserInstance.newPage();
  
  // Set timeout cao hơn cho page operations để tăng độ tin cậy
  page.setDefaultTimeout(30000); // Tăng lên 30s
  page.setDefaultNavigationTimeout(30000);
  
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

  try {
    await page.goto(url, { waitUntil: 'load' });
    
    // Giảm thời gian scroll để tăng tốc
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
        }, 200); // Giảm từ 500ms xuống 200ms
      });
    });

    // Chuyển đổi Set thành mảng key
    const logsObject = {
      info: Array.from(logsMap.info),
      warn: Array.from(logsMap.warn),
      error: Array.from(logsMap.error)
    };

    await browserInstance.close();

    // Không save ngay lập tức để tránh overhead
    // saveHashDataLogs() sẽ được gọi ở cuối chunk processing

    return { 
      [browser]: {
        logs: logsObject
      }
    };
  } catch (error) {
    await browserInstance.close();
    throw error;
  }
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

// Hàm save tất cả logs đã tích lũy
async function saveAllLogs() {
  try {
    await saveHashDataLogs();
    console.log('All accumulated logs saved successfully');
  } catch (error) {
    console.error('Error saving all logs:', error.message);
  }
}

module.exports = {
  crawConsoleALLBrowser,
  saveHashDataLogs,
  saveAllLogs
};
