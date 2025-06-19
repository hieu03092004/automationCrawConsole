const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

function getInput(file) {
  if (!fs.existsSync(file)) {
    throw new Error(`File "${file}" không tồn tại.`);
  }

  const workbook = xlsx.readFile(file);
  const sheetNames = workbook.SheetNames;
  const output = {};

  sheetNames.forEach(sheet => {
    output[sheet] = xlsx.utils.sheet_to_json(workbook.Sheets[sheet], { raw: true });
  });

  if (!output.Sitedeclaration) {
    throw new Error(`Missing "Sitedeclaration" sheet`);
  }
  if (output.Sitedeclaration.length !== 1) {
    throw new Error(`Sheet "Sitedeclaration" phải chỉ có 1 dòng duy nhất`);
  }
  output.Sitedeclaration = output.Sitedeclaration[0];

  return output;
}

async function mergeResults() {
  try {
    // Đọc metadata để biết có bao nhiêu chunk
    const metadataFile = path.join(__dirname, '..', 'chunks', 'metadata.json');
    if (!fs.existsSync(metadataFile)) {
      throw new Error('Metadata file not found. Please run split-urls.js first.');
    }

    const metadata = JSON.parse(fs.readFileSync(metadataFile, 'utf8'));
    console.log(`Merging results from ${metadata.numberOfChunks} chunks...`);

    // Merge tất cả itemsObject từ các chunk
    const mergedItemsObject = {};
    const chunkResults = [];
    let totalProcessedUrls = 0;
    let totalProcessingTime = 0;

    for (let i = 1; i <= metadata.numberOfChunks; i++) {
      const resultFile = path.join(__dirname, '..', 'results', `chunk-${i}-result.json`);
      
      if (fs.existsSync(resultFile)) {
        const chunkResult = JSON.parse(fs.readFileSync(resultFile, 'utf8'));
        chunkResults.push(chunkResult);
        
        // Merge itemsObject
        Object.assign(mergedItemsObject, chunkResult.itemsObject);
        
        totalProcessedUrls += chunkResult.processedUrls;
        totalProcessingTime += parseFloat(chunkResult.processingTime);
        
        console.log(`Loaded chunk ${i}: ${chunkResult.processedUrls} URLs processed in ${chunkResult.processingTime}`);
      } else {
        console.warn(`Warning: Result file for chunk ${i} not found`);
      }
    }

    // Đọc thông tin project từ input file
    const data = getInput('input/input.xlsx');
    
    // Tạo report data
    const reportData = {
      projectName: data.Sitedeclaration['Project Name'],
      buildNumber: new Date().getTime(),
      totalUrls: metadata.totalUrls,
      totalProcessedUrls: totalProcessedUrls,
      totalProcessingTime: `${totalProcessingTime.toFixed(2)}s`,
      numberOfChunks: metadata.numberOfChunks,
      chunkResults: chunkResults,
      'items-object': mergedItemsObject
    };

    // Lưu report cuối cùng
    const reportDir = path.join(__dirname, '..', 'report');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const reportFile = path.join(reportDir, 'project.json');
    fs.writeFileSync(reportFile, JSON.stringify(reportData, null, 2));

    console.log('\n=== MERGE COMPLETED ===');
    console.log(`Total URLs: ${metadata.totalUrls}`);
    console.log(`Processed URLs: ${totalProcessedUrls}`);
    console.log(`Total Processing Time: ${totalProcessingTime.toFixed(2)}s`);
    console.log(`Success Rate: ${((totalProcessedUrls / metadata.totalUrls) * 100).toFixed(2)}%`);
    console.log(`Report saved to: ${reportFile}`);

    // Tạo summary file
    const summary = {
      timestamp: new Date().toISOString(),
      projectName: data.Sitedeclaration['Project Name'],
      totalUrls: metadata.totalUrls,
      processedUrls: totalProcessedUrls,
      successRate: `${((totalProcessedUrls / metadata.totalUrls) * 100).toFixed(2)}%`,
      totalTime: `${totalProcessingTime.toFixed(2)}s`,
      chunks: chunkResults.map(chunk => ({
        chunkNumber: chunk.chunkNumber,
        processedUrls: chunk.processedUrls,
        processingTime: chunk.processingTime
      }))
    };

    const summaryFile = path.join(reportDir, 'summary.json');
    fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
    console.log(`Summary saved to: ${summaryFile}`);

    // Merge hashDataLogs từ tất cả các chunk
    console.log('\n=== MERGING HASH DATA LOGS & REMAPPING LOGS ===');
    const { valueToKey, keyToValue } = await mergeHashDataLogsAndRemapLogs(chunkResults, mergedItemsObject);
    // Sau khi remap, ghi lại project.json với logs đã remap
    const remappedReportDir = path.join(__dirname, '..', 'report');
    const remappedReportFile = path.join(remappedReportDir, 'project.json');
    // Đọc lại project.json, cập nhật chunkResults và mergedItemsObject đã remap
    let remappedReportData = JSON.parse(fs.readFileSync(remappedReportFile, 'utf8'));
    remappedReportData['items-object'] = mergedItemsObject;
    remappedReportData.chunkResults = chunkResults;
    fs.writeFileSync(remappedReportFile, JSON.stringify(remappedReportData, null, 2));
    console.log('Đã ghi lại project.json với logs đã remap về key duy nhất.');

    // Đảm bảo tất cả keys từ project.json có trong hashDataLogs.json
    console.log('\n=== ENSURING ALL KEYS ARE PRESENT ===');
    await ensureAllKeysPresent(remappedReportData);

    return remappedReportData;

  } catch (error) {
    console.error('Error merging results:', error.message);
    throw error;
  }
}

// Hàm merge hashDataLogs từ tất cả các chunk
async function mergeHashDataLogsAndRemapLogs(chunkResults, mergedItemsObject) {
  try {
    const metadataFile = path.join(__dirname, '..', 'chunks', 'metadata.json');
    const metadata = JSON.parse(fs.readFileSync(metadataFile, 'utf8'));
    
    // Map value -> key duy nhất (ưu tiên key đầu tiên gặp)
    const valueToKey = new Map();
    // Map key -> value (tạm)
    const keyToValue = new Map();

    // Duyệt qua tất cả các chunk hashDataLogs
    for (let i = 1; i <= metadata.numberOfChunks; i++) {
      const chunkHashDataLogsPath = path.join(__dirname, '..', 'results', `chunk-${i}-hashDataLogs.json`);
      if (fs.existsSync(chunkHashDataLogsPath)) {
        try {
          const chunkHashData = JSON.parse(fs.readFileSync(chunkHashDataLogsPath, 'utf8'));
          for (const [key, value] of Object.entries(chunkHashData.hash)) {
            if (!valueToKey.has(value)) {
              valueToKey.set(value, key);
            }
            keyToValue.set(key, value);
          }
        } catch (error) {
          console.warn(`Error reading hashDataLogs from chunk ${i}:`, error.message);
        }
      }
    }
    // Đọc cả hashDataLogs.json chính nếu có
    const mainHashDataLogsPath = path.join(__dirname, '..', 'hashDataLogs.json');
    if (fs.existsSync(mainHashDataLogsPath)) {
      try {
        const mainHashData = JSON.parse(fs.readFileSync(mainHashDataLogsPath, 'utf8'));
        for (const [key, value] of Object.entries(mainHashData.hash)) {
          if (!valueToKey.has(value)) {
            valueToKey.set(value, key);
          }
          keyToValue.set(key, value);
        }
      } catch (error) {}
    }

    // Thu thập tất cả keys từ logs để đảm bảo có đủ mapping
    const allLogKeys = new Set();
    function collectLogKeys(logs) {
      if (!logs) return;
      const collect = arr => Array.isArray(arr) ? arr.forEach(key => allLogKeys.add(key)) : null;
      collect(logs.info);
      collect(logs.warn);
      collect(logs.error);
    }
    
    // Thu thập từ mergedItemsObject
    for (const [url, browsers] of Object.entries(mergedItemsObject)) {
      for (const [browser, data] of Object.entries(browsers)) {
        if (data.logs) {
          collectLogKeys(data.logs);
        }
      }
    }
    // Thu thập từ chunkResults
    for (const chunk of chunkResults) {
      for (const [url, browsers] of Object.entries(chunk.itemsObject)) {
        for (const [browser, data] of Object.entries(browsers)) {
          if (data.logs) {
            collectLogKeys(data.logs);
          }
        }
      }
    }

    // Đảm bảo mọi key trong logs đều có value, nếu không thì tạo placeholder
    for (const key of allLogKeys) {
      if (!keyToValue.has(key)) {
        // Tìm value trong các file hashDataLogs
        let found = false;
        for (let i = 1; i <= metadata.numberOfChunks; i++) {
          const chunkHashDataLogsPath = path.join(__dirname, '..', 'results', `chunk-${i}-hashDataLogs.json`);
          if (fs.existsSync(chunkHashDataLogsPath)) {
            try {
              const chunkHashData = JSON.parse(fs.readFileSync(chunkHashDataLogsPath, 'utf8'));
              if (chunkHashData.hash[key]) {
                const value = chunkHashData.hash[key];
                keyToValue.set(key, value);
                if (!valueToKey.has(value)) {
                  valueToKey.set(value, key);
                }
                found = true;
                break;
              }
            } catch (error) {}
          }
        }
        // Nếu vẫn chưa tìm thấy, kiểm tra file chính
        if (!found && fs.existsSync(mainHashDataLogsPath)) {
          try {
            const mainHashData = JSON.parse(fs.readFileSync(mainHashDataLogsPath, 'utf8'));
            if (mainHashData.hash[key]) {
              const value = mainHashData.hash[key];
              keyToValue.set(key, value);
              if (!valueToKey.has(value)) {
                valueToKey.set(value, key);
              }
              found = true;
            }
          } catch (error) {}
        }
        // Nếu vẫn chưa tìm thấy, tạo value placeholder
        if (!found) {
          const placeholder = `[PLACEHOLDER] Log message for key: ${key}`;
          keyToValue.set(key, placeholder);
          if (!valueToKey.has(placeholder)) {
            valueToKey.set(placeholder, key);
          }
        }
      }
    }

    // Đảm bảo valueToKey chỉ có 1 key duy nhất cho mỗi value
    // (ưu tiên key đầu tiên gặp)
    // Remap lại các logs trong mergedItemsObject và chunkResults
    function remapLogs(logs) {
      if (!logs) return logs;
      const remap = arr => Array.isArray(arr) ? arr.map(key => {
        const value = keyToValue.get(key);
        if (value && valueToKey.has(value)) {
          return valueToKey.get(value);
        }
        return key; // Giữ nguyên nếu không tìm thấy value
      }) : [];
      return {
        info: remap(logs.info),
        warn: remap(logs.warn),
        error: remap(logs.error)
      };
    }
    // Remap mergedItemsObject
    for (const [url, browsers] of Object.entries(mergedItemsObject)) {
      for (const [browser, data] of Object.entries(browsers)) {
        if (data.logs) {
          data.logs = remapLogs(data.logs);
        }
      }
    }
    // Remap chunkResults
    for (const chunk of chunkResults) {
      for (const [url, browsers] of Object.entries(chunk.itemsObject)) {
        for (const [browser, data] of Object.entries(browsers)) {
          if (data.logs) {
            data.logs = remapLogs(data.logs);
          }
        }
      }
    }
    // Ghi lại hashDataLogs.json chỉ chứa 1 key cho mỗi value
    const mergedHashData = { hash: {} };
    for (const [value, key] of valueToKey.entries()) {
      mergedHashData.hash[key] = value;
    }
    fs.writeFileSync(mainHashDataLogsPath, JSON.stringify(mergedHashData, null, 2));
    console.log(`\n=== HASH DATA LOGS MERGE COMPLETED (deduplicated, full coverage) ===`);
    console.log(`Total unique log messages: ${valueToKey.size}`);
    console.log(`Total log keys processed: ${allLogKeys.size}`);
    console.log(`Merged hashDataLogs saved to: ${mainHashDataLogsPath}`);
    return { valueToKey, keyToValue };
  } catch (error) {
    console.error('Error merging hashDataLogs:', error.message);
    throw error;
  }
}

// Hàm đảm bảo tất cả keys từ project.json có trong hashDataLogs.json
async function ensureAllKeysPresent(reportData) {
  try {
    const mainHashDataLogsPath = path.join(__dirname, '..', 'hashDataLogs.json');
    
    if (!fs.existsSync(mainHashDataLogsPath)) {
      console.log('hashDataLogs.json not found, skipping key validation');
      return;
    }

    // Đọc hashDataLogs.json hiện tại
    let hashDataLogs = JSON.parse(fs.readFileSync(mainHashDataLogsPath, 'utf8'));
    const existingKeys = new Set(Object.keys(hashDataLogs.hash));
    
    // Extract tất cả keys từ project.json
    const allKeysFromProject = new Set();
    
    for (const [url, browsers] of Object.entries(reportData['items-object'])) {
      for (const [browser, data] of Object.entries(browsers)) {
        if (data.logs) {
          const logs = data.logs;
          const logKeys = [
            ...logs.info,
            ...logs.warn,
            ...logs.error
          ];
          logKeys.forEach(key => allKeysFromProject.add(key));
        }
      }
    }
    
    // Tìm keys bị thiếu
    const missingKeys = Array.from(allKeysFromProject).filter(key => !existingKeys.has(key));
    
    if (missingKeys.length === 0) {
      console.log('✅ All keys from project.json are present in hashDataLogs.json');
      return;
    }
    
    console.log(`⚠️  Found ${missingKeys.length} missing keys, adding placeholder values...`);
    
    // Thêm placeholder values cho missing keys
    let addedKeys = 0;
    for (const key of missingKeys) {
      const placeholderMessage = `[PLACEHOLDER] Log message for key: ${key}`;
      hashDataLogs.hash[key] = placeholderMessage;
      addedKeys++;
    }
    
    // Lưu file đã cập nhật
    fs.writeFileSync(mainHashDataLogsPath, JSON.stringify(hashDataLogs, null, 2));
    
    console.log(`✅ Added ${addedKeys} placeholder keys to hashDataLogs.json`);
    console.log(`📊 Total keys in hashDataLogs.json: ${Object.keys(hashDataLogs.hash).length}`);
    
  } catch (error) {
    console.error('Error ensuring all keys are present:', error.message);
  }
}

async function main() {
  try {
    await mergeResults();
    console.log('Results merging completed successfully!');
  } catch (error) {
    console.error('Failed to merge results:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { mergeResults }; 