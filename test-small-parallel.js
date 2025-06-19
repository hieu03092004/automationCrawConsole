// test-small-parallel.js - Test với số lượng URLs nhỏ
const { fork, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function createSmallTestData() {
  console.log('1️⃣ Tạo test data nhỏ...');
  
  // Tạo file URLs nhỏ để test
  const testUrls = [
    'https://www.google.com',
    'https://www.github.com',
    'https://www.stackoverflow.com'
  ];
  
  fs.writeFileSync('urls.json', JSON.stringify(testUrls, null, 2));
  console.log(`✅ Tạo ${testUrls.length} URLs test`);
  return testUrls.length;
}

async function splitUrlsForTest() {
  console.log('2️⃣ Splitting URLs for test...');
  
  // Đọc URLs từ file urls.json
  const urls = JSON.parse(fs.readFileSync('urls.json', 'utf8'));
  console.log(`Total URLs found: ${urls.length}`);
  
  // Tạo thư mục chunks nếu chưa có
  const chunksDir = path.join(__dirname, 'chunks');
  if (!fs.existsSync(chunksDir)) {
    fs.mkdirSync(chunksDir, { recursive: true });
  }
  
  // Split thành chunks nhỏ (1 URL per chunk cho test)
  const chunkSize = 1;
  const numberOfChunks = Math.ceil(urls.length / chunkSize);
  
  console.log(`Splitting into ${numberOfChunks} chunks, ${chunkSize} URLs per chunk`);
  
  const chunks = [];
  for (let i = 0; i < urls.length; i += chunkSize) {
    chunks.push(urls.slice(i, i + chunkSize));
  }
  
  // Lưu từng chunk vào file riêng biệt
  chunks.forEach((chunk, index) => {
    const chunkFile = path.join(chunksDir, `chunk-${index + 1}.json`);
    fs.writeFileSync(chunkFile, JSON.stringify(chunk, null, 2));
    console.log(`Created chunk-${index + 1}.json with ${chunk.length} URLs`);
  });
  
  // Lưu metadata về chunks
  const metadata = {
    totalUrls: urls.length,
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
    JSON.stringify(metadata, null, 2)
  );
  
  console.log('URL splitting completed successfully!');
  console.log(`Metadata saved to chunks/metadata.json`);
  
  return chunks.length;
}

function runChunk(i) {
  return new Promise((resolve, reject) => {
    console.log(`→ Forking chunk ${i}…`);
    const cp = fork(path.join(__dirname, 'helpers', 'process-chunk.js'), [String(i)], { stdio: 'inherit' });
    cp.on('exit', code => code === 0
      ? resolve(i)
      : reject(new Error(`Chunk ${i} failed (exit ${code})`))
    );
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
  console.log('🧪 Testing Small Parallel Processing Setup...\n');
  
  // 1. Tạo test data nhỏ
  const urlCount = await createSmallTestData();

  // 2. Split URLs cho test
  const chunkCount = await splitUrlsForTest();

  // 3. Process all chunks in parallel
  console.log('\n3️⃣ Processing chunks in PARALLEL...');
  const start = Date.now();
  await Promise.all(
    Array.from({ length: chunkCount }, (_, idx) => runChunk(idx + 1))
  );
  const end = Date.now();
  const parallelTime = ((end - start) / 1000).toFixed(2);
  console.log(`\n✅ All ${chunkCount} chunks done in ${parallelTime}s (measured)`);

  // 4. Merge & final check
  await mergeResults();

  console.log('\n🎉 Small test completed!');
  console.log(`📊 Processed ${urlCount} URLs in ${parallelTime}s`);
}

main().catch(err => {
  console.error('\n❌ Test failed:', err.message);
  process.exit(1);
}); 