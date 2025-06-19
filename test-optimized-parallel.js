// test-optimized-parallel.js - Test tối ưu cho URLs từ Excel
const { fork, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function createOptimizedTestData() {
  console.log('1️⃣ Đọc URLs từ file Excel...');
  
  // Sử dụng npm run split để đọc từ Excel
  require('child_process').execSync('npm run split', { stdio: 'inherit' });
  
  // Đọc metadata để biết số lượng URLs
  const metadata = JSON.parse(fs.readFileSync(path.join('chunks','metadata.json'), 'utf8'));
  console.log(`✅ Đọc ${metadata.totalUrls} URLs từ Excel file`);
  return metadata.totalUrls;
}

async function splitUrlsForReliability() {
  console.log('2️⃣ Splitting URLs cho độ tin cậy cao...');
  
  // Đọc metadata đã có
  const metadata = JSON.parse(fs.readFileSync(path.join('chunks','metadata.json'), 'utf8'));
  console.log(`Total URLs found: ${metadata.totalUrls}`);
  
  // Tối ưu chunk size cho độ tin cậy (thay vì tốc độ)
  const chunkSize = 2; // 2 URLs per chunk để giảm failed chunks
  const numberOfChunks = Math.ceil(metadata.totalUrls / chunkSize);
  
  console.log(`Splitting into ${numberOfChunks} chunks, ${chunkSize} URLs per chunk (OPTIMIZED FOR RELIABILITY)`);
  
  // Đọc tất cả URLs từ các chunk hiện tại
  const allUrls = [];
  for (let i = 1; i <= metadata.numberOfChunks; i++) {
    const chunkFile = path.join(__dirname, 'chunks', `chunk-${i}.json`);
    if (fs.existsSync(chunkFile)) {
      const chunkUrls = JSON.parse(fs.readFileSync(chunkFile, 'utf8'));
      allUrls.push(...chunkUrls);
    }
  }
  
  // Tạo thư mục chunks mới
  const chunksDir = path.join(__dirname, 'chunks');
  
  // Xóa tất cả chunk files cũ trước khi tạo mới
  console.log('🧹 Cleaning up old chunk files...');
  for (let i = 1; i <= metadata.numberOfChunks; i++) {
    const oldChunkFile = path.join(chunksDir, `chunk-${i}.json`);
    if (fs.existsSync(oldChunkFile)) {
      fs.unlinkSync(oldChunkFile);
    }
  }
  
  // Split lại thành chunks tối ưu cho độ tin cậy
  const chunks = [];
  for (let i = 0; i < allUrls.length; i += chunkSize) {
    chunks.push(allUrls.slice(i, i + chunkSize));
  }
  
  // Lưu từng chunk vào file riêng biệt
  chunks.forEach((chunk, index) => {
    const chunkFile = path.join(chunksDir, `chunk-${index + 1}.json`);
    fs.writeFileSync(chunkFile, JSON.stringify(chunk, null, 2));
    console.log(`Created chunk-${index + 1}.json with ${chunk.length} URLs`);
  });
  
  // Lưu metadata về chunks mới
  const newMetadata = {
    totalUrls: allUrls.length,
    numberOfChunks: chunks.length,
    chunkSize: chunkSize,
    chunks: chunks.map((chunk, index) => ({
      chunkNumber: index + 1,
      urlCount: chunk.length,
      filename: `chunk-${index + 1}.json`
    }))
  };
  
  fs.writeFileSync(
    path.join(chunksDir, 'metadata.json'),
    JSON.stringify(newMetadata, null, 2)
  );
  
  console.log('URL splitting completed successfully!');
  console.log(`Metadata saved to chunks/metadata.json`);
  
  return chunks.length;
}

function runChunk(i) {
  return new Promise((resolve, reject) => {
    console.log(`→ Forking chunk ${i}…`);
    const cp = fork(path.join(__dirname, 'helpers', 'process-chunk.js'), [String(i)], { 
      stdio: 'inherit',
      timeout: 180000 // 3 minutes timeout per chunk (tăng lên cho độ tin cậy)
    });
    
    cp.on('exit', code => {
      if (code === 0) {
        console.log(`✅ Chunk ${i} completed successfully`);
        resolve(i);
      } else {
        console.error(`❌ Chunk ${i} failed with exit code ${code}`);
        reject(new Error(`Chunk ${i} failed (exit ${code})`));
      }
    });
    
    cp.on('error', (error) => {
      console.error(`❌ Chunk ${i} error:`, error.message);
      reject(error);
    });
  });
}

async function mergeResults() {
  console.log('\n4️⃣ Testing results merging...');
  require('child_process').execSync('npm run merge', { stdio: 'inherit' });
  const summary = JSON.parse(fs.readFileSync(path.join('report','summary.json'), 'utf8'));
  console.log(`✅ Merge: ${summary.processedUrls}/${summary.totalUrls} URLs (${summary.successRate})`);
  console.log(`⏱ totalTime (from summary): ${summary.totalTime}`);
}

async function main() {
  console.log('🚀 Testing Optimized Parallel Processing for URLs from Excel...\n');
  
  try {
    // 1. Tạo test data tối ưu
    const urlCount = await createOptimizedTestData();

    // 2. Split
    const chunkCount = await splitUrlsForReliability();

    // 3. Process all chunks in parallel với timeout và retry
    console.log('\n3️⃣ Processing chunks in PARALLEL (OPTIMIZED FOR RELIABILITY)...');
    const start = Date.now();
    
    // Thêm retry mechanism cho failed chunks
    const maxRetries = 2;
    const chunkResults = new Array(chunkCount).fill(null);
    
    for (let retry = 0; retry <= maxRetries; retry++) {
      if (retry > 0) {
        console.log(`\n🔄 Retry attempt ${retry}/${maxRetries} for failed chunks...`);
      }
      
      const chunkPromises = Array.from({ length: chunkCount }, (_, idx) => {
        const chunkIndex = idx + 1;
        if (chunkResults[idx] !== null) {
          // Chunk đã thành công, bỏ qua
          return Promise.resolve(chunkIndex);
        }
        
        return runChunk(chunkIndex)
          .then(result => {
            chunkResults[idx] = result;
            return result;
          })
          .catch(error => {
            console.error(`Chunk ${chunkIndex} failed:`, error.message);
            return null;
          });
      });
      
      const results = await Promise.all(chunkPromises);
      
      // Kiểm tra xem có chunk nào còn failed không
      const failedChunks = chunkResults.filter(result => result === null).length;
      if (failedChunks === 0) {
        console.log(`✅ All chunks completed successfully!`);
        break;
      } else if (retry < maxRetries) {
        console.log(`⚠️  ${failedChunks} chunks still failed, will retry...`);
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s before retry
      }
    }
    
    const successfulChunks = chunkResults.filter(result => result !== null);
    
    const end = Date.now();
    const parallelTime = ((end - start) / 1000).toFixed(2);
    
    console.log(`\n✅ Processing completed in ${parallelTime}s`);
    console.log(`📊 Successful chunks: ${successfulChunks.length}/${chunkCount}`);
    console.log(`📊 Failed chunks: ${chunkCount - successfulChunks.length}`);

    // 4. Merge & final check
    await mergeResults();

    console.log('\n🎉 Optimized test completed!');
    console.log(`📊 Processed ${urlCount} URLs in ${parallelTime}s`);
    console.log(`📊 Success rate: ${((successfulChunks.length / chunkCount) * 100).toFixed(2)}%`);
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

main();