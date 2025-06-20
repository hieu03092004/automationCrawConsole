const fs = require('fs');
const path = require('path');
const { crawConsoleALLBrowser } = require('../craw');
const { nanoid } = require('nanoid');

const timeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const try2pass = async (fn) => {
  let maxCount = 4;
  while (maxCount) {
    maxCount -= 1;
    try {
      return await fn();
    } catch (error) {
      if (!maxCount) {
        throw error;
      }
      console.log(`Retry attempt ${5 - maxCount}/5: ${error.message}`);
      await timeout(2000);
    }
  }
  return false;
};

async function processChunk(chunkNumber) {
  try {
    // Đọc chunk file
    const chunkFile = path.join(__dirname, '..', 'chunks', `chunk-${chunkNumber}.json`);
    if (!fs.existsSync(chunkFile)) {
      throw new Error(`Chunk file ${chunkFile} not found`);
    }

    const urls = JSON.parse(fs.readFileSync(chunkFile, 'utf8'));
    console.log(`Processing chunk ${chunkNumber} with ${urls.length} URLs`);

    const itemsObject = {};
    const chunkWideLogs = {};
    const startTime = Date.now();

    for (const [i, url] of urls.entries()) {
      console.log(`[${i + 1}/${urls.length}][check-console]: ${url}`);
      
      try {
        const { consoles, collectedLogs } = await try2pass(
          () => crawConsoleALLBrowser({ url })
        );
        itemsObject[url] = consoles;
        
        Object.assign(chunkWideLogs, collectedLogs);

        await timeout(2000);
      } catch (error) {
        console.error(`Error processing ${url}: ${error.message}`);
        itemsObject[url] = {
          errorMessage: `[ERROR]: ${error && error.message}`,
          status: 'Error',
          statusCode: 400
        };
      }
    }

    const endTime = Date.now();
    const processingTime = (endTime - startTime) / 1000;

    // Tạo kết quả cho chunk này
    const chunkResult = {
      chunkNumber: chunkNumber,
      totalUrls: urls.length,
      processedUrls: Object.keys(itemsObject).length,
      processingTime: `${processingTime}s`,
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
      itemsObject: itemsObject
    };

    // Lưu kết quả chunk
    const resultsDir = path.join(__dirname, '..', 'results');
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }

    const resultFile = path.join(resultsDir, `chunk-${chunkNumber}-result.json`);
    fs.writeFileSync(resultFile, JSON.stringify(chunkResult, null, 2));

    // Ghi tất cả log đã được tổng hợp hợp lệ của chunk ra file
    const chunkHashDataLogsPath = path.join(resultsDir, `chunk-${chunkNumber}-hashDataLogs.json`);
    fs.writeFileSync(chunkHashDataLogsPath, JSON.stringify({ hash: chunkWideLogs }, null, 2));
    console.log(`Saved chunk hashDataLogs to ${chunkHashDataLogsPath}`);

    console.log(`Chunk ${chunkNumber} completed in ${processingTime}s`);
    console.log(`Result saved to ${resultFile}`);

    return chunkResult;

  } catch (error) {
    console.error(`Error processing chunk ${chunkNumber}:`, error.message);
    throw error;
  }
}

async function main() {
  const chunkNumber = process.argv[2];
  
  if (!chunkNumber) {
    console.error('Usage: node process-chunk.js <chunk-number>');
    process.exit(1);
  }

  try {
    await processChunk(chunkNumber);
    console.log(`Chunk ${chunkNumber} processing completed successfully!`);
  } catch (error) {
    console.error(`Failed to process chunk ${chunkNumber}:`, error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { processChunk }; 