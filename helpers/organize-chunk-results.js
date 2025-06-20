const fs = require('fs');
const path = require('path');

async function organizeChunkResults() {
  try {
    const resultsDir = path.join(__dirname, '..', 'results');
    const chunkResultsDir = path.join(__dirname, '..', 'chunk-results');
    
    // Tạo thư mục chunk-results nếu chưa có
    if (!fs.existsSync(chunkResultsDir)) {
      fs.mkdirSync(chunkResultsDir, { recursive: true });
    }
    
    // Đọc tất cả file trong thư mục results
    if (fs.existsSync(resultsDir)) {
      const files = fs.readdirSync(resultsDir);
      
      // Lọc ra các file chunk result và hash logs
      const chunkResultFiles = files.filter(file => 
        file.startsWith('chunk-') && 
        (file.endsWith('-result.json') || file.endsWith('-hashDataLogs.json'))
      );
      
      console.log(`Found ${chunkResultFiles.length} chunk files to organize`);
      
      // Di chuyển từng file vào thư mục chunk-results
      for (const file of chunkResultFiles) {
        const sourcePath = path.join(resultsDir, file);
        const destPath = path.join(chunkResultsDir, file);
        
        if (fs.existsSync(sourcePath)) {
          fs.renameSync(sourcePath, destPath);
          console.log(`Moved ${file} to chunk-results/`);
        }
      }
      
      console.log(`✅ Successfully organized ${chunkResultFiles.length} files into chunk-results/`);
    } else {
      console.log('No results directory found');
    }
    
  } catch (error) {
    console.error('Error organizing chunk results:', error.message);
    throw error;
  }
}

async function main() {
  try {
    await organizeChunkResults();
    console.log('Chunk results organization completed successfully!');
  } catch (error) {
    console.error('Failed to organize chunk results:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { organizeChunkResults }; 