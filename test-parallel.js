// test-parallel.js
const { fork, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function splitUrls() {
  console.log('1️⃣ Testing URL splitting...');
  require('child_process').execSync('npm run split', { stdio: 'inherit' });
  const meta = JSON.parse(fs.readFileSync(path.join('chunks','metadata.json'), 'utf8'));
  console.log(`✅ Split: ${meta.totalUrls} URLs → ${meta.numberOfChunks} chunks`);
  return meta.numberOfChunks;
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
  console.log('\n3️⃣ Testing results merging...');
  require('child_process').execSync('npm run merge', { stdio: 'inherit' });
  const summary = JSON.parse(fs.readFileSync(path.join('report','summary.json'), 'utf8'));
  console.log(`✅ Merge: ${summary.processedUrls}/${summary.totalUrls} URLs (${summary.successRate})`);
  console.log(`⏱ totalTime (from summary): ${summary.totalTime}`);
}

async function main() {
  console.log('🧪 Testing Parallel Processing Setup...\n');
  // 1. Split
  const chunkCount = await splitUrls();

  // 2. Process all chunks in parallel
  console.log('\n2️⃣ Processing chunks in PARALLEL...');
  const start = Date.now();
  await Promise.all(
    Array.from({ length: chunkCount }, (_, idx) => runChunk(idx + 1))
  );
  const end = Date.now();
  const parallelTime = ((end - start) / 1000).toFixed(2);
  console.log(`\n✅ All ${chunkCount} chunks done in ${parallelTime}s (measured)`);

  // 3. Merge & final check
  await mergeResults();

  console.log('\n🎉 Test completed!');
}

main().catch(err => {
  console.error('\n❌ Test failed:', err.message);
  process.exit(1);
});
