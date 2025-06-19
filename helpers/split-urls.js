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

  const ct = output.Sitedeclaration['Consolelog-Table'];
  if (!ct) {
    throw new Error(`Missing "Consolelog-Table" trong Sitedeclaration`);
  }
  if (!output[ct] || !Array.isArray(output[ct]) || output[ct].length === 0) {
    throw new Error(`Sheet "${ct}" không tồn tại hoặc rỗng`);
  }

  return output;
}

const joinUrl = (hostname = '', pathname = '') => {
  if (pathname.match(/^https?:\/\//)) {
    return pathname;
  }
  hostname = hostname.replace(/\/+$/, '');
  pathname = pathname.replace(/^\/+/, '/').replace(/\/+/g, '/');
  return `${hostname}${pathname}`;
};

async function getPagesDeclarations() {
  const data = getInput('input/input.xlsx');
  const { BaseURL } = data.Sitedeclaration;
  const pages = data.Pagesdeclarations;
  
  return pages.map(page => joinUrl(BaseURL, page.URL));
}

function splitArrayIntoChunks(array, chunkSize) {
  const chunks = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

async function main() {
  try {
    const urls = await getPagesDeclarations();
    console.log(`Total URLs found: ${urls.length}`);
    
    // Lấy số chunk từ environment variable hoặc mặc định là 30
    const numberOfChunks = parseInt(process.env.NUMBER_OF_CHUNKS) || 30;
    const chunkSize = Math.ceil(urls.length / numberOfChunks);
    
    console.log(`Splitting into ${numberOfChunks} chunks, ${chunkSize} URLs per chunk`);
    
    const chunks = splitArrayIntoChunks(urls, chunkSize);
    
    // Tạo thư mục chunks nếu chưa có
    const chunksDir = path.join(__dirname, '..', 'chunks');
    if (!fs.existsSync(chunksDir)) {
      fs.mkdirSync(chunksDir, { recursive: true });
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
    
  } catch (error) {
    console.error('Error splitting URLs:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { splitArrayIntoChunks, getPagesDeclarations }; 