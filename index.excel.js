// main.js
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const fs = require('fs');
const xlsx = require('xlsx');
const path = require('path');
const { crawConsoleALLBrowser } = require('./craw');
require('dotenv').config();

// Cấu hình yargs
const argv = yargs(hideBin(process.argv))
  .usage('Usage: $0 --excel [excel file] [options]')
  .option('excel', {
    alias: 'e',
    description: 'Đường dẫn đến file Excel cần đọc',
    type: 'string',
    demandOption: true
  })
  .option('json', {
    description: 'Chạy ở chế độ local',
    type: 'boolean',
    default: true
  })
  .option('buildNum', {
    description: 'Build number cho Jenkins mode',
    type: 'number'
  })
  .option('shard', {
    description: 'Shard configuration (e.g., "1/3" means run shard 1 of 3 total shards)',
    type: 'string'
  })
  .help('h')
  .alias('h', 'help')
  .argv;

/**
 * Đọc toàn bộ sheet trong file Excel và build thành object:
 * {
 *   Sitedeclaration: { ...các cột trong row đầu tiên... },
 *   Pagesdeclarations: [ {...}, {...}, ... ],
 *   ...nếu có thêm sheet khác...
 * }
 */
function getInput(file) {
  if (!fs.existsSync(file)) {
    throw new Error(`File "${file}" không tồn tại.`);
  }

  const workbook       = xlsx.readFile(file);
  const sheetNames     = workbook.SheetNames;
  const output         = {};

  sheetNames.forEach(sheet => {
    output[sheet] = xlsx.utils.sheet_to_json(workbook.Sheets[sheet], { raw: true });
  });

  // Ép Sitedeclaration về dạng object (chỉ 1 row)
  if (!output.Sitedeclaration) {
    throw new Error(`Missing "Sitedeclaration" sheet`);
  }
  if (output.Sitedeclaration.length !== 1) {
    throw new Error(`Sheet "Sitedeclaration" phải chỉ có 1 dòng duy nhất`);
  }
  output.Sitedeclaration = output.Sitedeclaration[0];

  // Kiểm tra trường Consolelog-Table
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
    // Case 1: Nếu pathname là full URL (bắt đầu với http:// hoặc https://)
    if (pathname.match(/^https?:\/\//)) {
      return pathname;
    }
  
    // Case 2: Chuẩn hóa hostname - remove trailing slash
    hostname = hostname.replace(/\/+$/, '');
  
    // Case 3: Chuẩn hóa pathname
    // - Thêm leading slash nếu chưa có
    // - Remove multiple slashes
    pathname = pathname.replace(/^\/+/, '/').replace(/\/+/g, '/');
  
    // Join hostname và pathname
    return `${hostname}${pathname}`;
  }
  const timeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
  const try2pass = async (fn) => {
    let maxCount = 5
    while (maxCount) {
      maxCount -= 1
      try {
        return await fn()
      } catch (error) {
        if (!maxCount) {
          throw error
        }
      }
    }
    return false
  }
  async function getPagesDeclarations() {
    const data = getInput(`input/${argv.excel}`);
    const { BaseURL } = data.Sitedeclaration;
    const pages = data.Pagesdeclarations;
    
    return pages.map(page => joinUrl(BaseURL, page.URL));
  }
  async function main() {
    const buildNumber = argv.json ? new Date().getTime() : argv.buildNum
    //console.log(`Tool run with Build Num: ${chalk.yellow(buildNumber)} in ${chalk.yellow(argv.json ? 'local' : 'jenkins')} mode`)
  
    const urls = await getPagesDeclarations()
  
    // Handle sharding if specified
    let shardsUrls = urls;
    let shardSuffix = '';
    
    if (argv.shard) {
      const [currentShard, totalShards] = argv.shard.split('/').map(Number);
      if (!currentShard || !totalShards || currentShard > totalShards) {
        throw new Error('Invalid shard configuration. Format should be "n/m" where n <= m');
      }
      
      const itemsPerShard = Math.ceil(urls.length / totalShards);
      const start = (currentShard - 1) * itemsPerShard;
      const end = Math.min(start + itemsPerShard, urls.length);
      shardsUrls = urls.slice(start, end);
      shardSuffix = `-shard-${currentShard}-${totalShards}`;
    }
  
    const itemsObject = {}
    for (const [i, url] of shardsUrls.entries()) {
      //console.log(chalk.green(`[${i + 1}/${shardsUrls.length}][check-console]: ${url}`))
      try {
        const { consoles } = await try2pass(
          () => crawConsoleALLBrowser({ url })
        )
        itemsObject[url] = consoles
       
        await timeout(3000)
      } catch (error) {
        //console.log(chalk.red(`Error: ${error && error.message}`))
        itemsObject[url] = {
          errorMessage: `[ERROR]: ${error && error.message}`,
          status: 'Error',
          statusCode: 400
        }
      }
    }
  
    // Ensure report directory exists
    if (!fs.existsSync('./report')) {
      fs.mkdirSync('./report', { recursive: true });
    }
  
    const data = getInput(`input/${argv.excel}`);
    const reportData = {
      projectName: data.Sitedeclaration['Project Name'],
      buildNumber,
      'items-object': itemsObject
    }
  
    const reportPath = `./report/project${shardSuffix}.json`;
    console.log(`Creating ${reportPath} file`);
    await fs.promises.writeFile(reportPath, JSON.stringify(reportData, null, 2));
  }
main();
