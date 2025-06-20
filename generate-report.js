const fs = require('fs');
const path = require('path');
// Thêm vào đầu file, ngay dưới các require
function escapeHTML(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')        // escape dấu < 
      .replace(/>/g, '&gt;')        // escape dấu >
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/“/g, '&ldquo;')     // escape curly open-quote
      .replace(/”/g, '&rdquo;')     // escape curly close-quote
      .replace(/`/g, '&#96;');      // nếu bạn có dấu backtick trong log
}

// Đọc hashDataLogs.json để lấy mapping key->value
let hashDataLogs;
try {
    hashDataLogs = JSON.parse(fs.readFileSync('hashDataLogs.json', 'utf8'));
} catch (error) {
    console.error('Error: Could not read hashDataLogs.json:', error.message);
    process.exit(1);
}

// Đọc dữ liệu từ project.json
let projectData;
try {
    projectData = JSON.parse(fs.readFileSync('report/project.json', 'utf8'));
} catch (error) {
    console.error('Error: Could not read report/project.json:', error.message);
    process.exit(1);
}

// Hàm build log list với key và value
function buildLogList(keys, cssClass) {
    return keys.map(key => {
        const val = hashDataLogs.hash[key] || '';
        return `<div class="log-entry ${cssClass}"><span class="log-key">${escapeHTML(key)}:</span> <span class="log-value">${escapeHTML(val)}</span></div>`;
    }).join('');
}

// Tính tổng số URL từ tất cả chunkResults
let totalUrls = 0;
for (const chunk of projectData.chunkResults) {
    totalUrls += Object.keys(chunk.itemsObject).length;
}

// Tạo HTML report với styling hiện đại
let html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${projectData.projectName} - Crawl Report</title>
    <style>
        :root {
            --primary-color: #2196F3;
            --error-color: #f44336;
            --warning-color: #ff9800;
            --success-color: #4CAF50;
            --info-color: #2196F3;
            --background-color: #f5f5f5;
            --card-background: #ffffff;
            --text-color: #333333;
            --border-radius: 8px;
            --box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; background: var(--background-color); color: var(--text-color); padding: 20px; }
        .container { max-width: 1400px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 30px; padding: 20px; background: var(--card-background); border-radius: var(--border-radius); box-shadow: var(--box-shadow); }
        .header h1 { color: var(--primary-color); margin-bottom: 10px; }
        .header .build-info { color: #666; margin-top: 10px; }
        .summary-box { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .summary-item { background: var(--card-background); padding: 20px; border-radius: var(--border-radius); box-shadow: var(--box-shadow); text-align: center; }
        .summary-item h3 { color: var(--text-color); margin-bottom: 10px; }
        .summary-item p { font-size: 24px; font-weight: bold; color: var(--primary-color); }
        .url-section { background: var(--card-background); border-radius: var(--border-radius); box-shadow: var(--box-shadow); margin-bottom: 30px; overflow: hidden; }
        .url-header { background: var(--primary-color); color: white; padding: 15px 20px; font-size: 1.2em; word-break: break-all; }
        .browser-section { padding: 20px; border-bottom: 1px solid #eee; }
        .browser-section:last-child { border-bottom: none; }
        .browser-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid var(--primary-color); }
        .browser-name { font-size: 1.2em; font-weight: bold; color: var(--primary-color); }
        .screenshot-link { display: inline-block; padding: 8px 16px; background: var(--primary-color); color: white; text-decoration: none; border-radius: 4px; transition: background 0.3s; }
        .screenshot-link:hover { background: #1976D2; }
        .logs-container { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-top: 15px; }
        .log-section { background: #f8f9fa; border-radius: var(--border-radius); padding: 15px; }
        .log-section h4 { margin-bottom: 10px; padding-bottom: 5px; border-bottom: 1px solid #ddd; }
        .log-details { margin-top: 10px; padding: 10px; background: #fff; border-radius: 4px; border: 1px solid #ddd; max-height: 300px; overflow-y: auto; }
        .log-entry { padding: 8px; border-bottom: 1px solid #eee; }
        .log-entry:last-child { border-bottom: none; }
        .log-entry:hover { background: #f0f0f0; }
        .log-key { font-weight: bold; color: #666; margin-right: 5px; }
        .log-value { color: var(--text-color); }
        .info-log .log-value { color: var(--info-color); }
        .warning-log .log-value { color: var(--warning-color); }
        .error-log .log-value { color: var(--error-color); }
        .stats { display: flex; gap: 15px; margin-top: 10px; flex-wrap: wrap; }
        .stat-item { padding: 5px 10px; border-radius: 4px; font-size: 0.9em; }
        .total-logs { background: var(--info-color); color: white; }
        .error-count { background: var(--error-color); color: white; }
        .warning-count { background: var(--warning-color); color: white; }
        .success-rate { background: var(--success-color); color: white; }
        @media (max-width: 768px) { .logs-container { grid-template-columns: 1fr; } .summary-box { grid-template-columns: 1fr; } }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${projectData.projectName} - Crawl Report</h1>
            <div class="build-info">Build Number: ${projectData.buildNumber}</div>
            <div class="timestamp">Generated on: ${new Date().toLocaleString()}</div>
        </div>

        <div class="summary-box">
            <div class="summary-item">
                <h3>Total URLs</h3>
                <p>${totalUrls}</p>
            </div>
            <div class="summary-item">
                <h3>Total Browsers</h3>
                <p>3</p>
            </div>
        </div>`;

// Duyệt qua từng chunk, từng url, từng browser để render report
for (const chunk of projectData.chunkResults) {
    for (const [url, browsers] of Object.entries(chunk.itemsObject)) {
        html += `
            <div class="url-section">
                <div class="url-header">${escapeHTML(url)}</div>`;
        for (const [browser, data] of Object.entries(browsers)) {
            if (data.logs) {
                const logs = data.logs;
                const totalLogs = logs.info.length + logs.warn.length + logs.error.length;
                const successRate = totalLogs > 0 
                    ? ((logs.info.length / totalLogs) * 100).toFixed(1) 
                    : 'N/A';
                html += `
                    <div class="browser-section">
                        <div class="browser-header">
                            <div class="browser-name">${browser}</div>
                        </div>
                        <div class="stats">
                            <div class="stat-item total-logs">Total Logs: ${totalLogs}</div>
                            <div class="stat-item error-count">Errors: ${logs.error.length}</div>
                            <div class="stat-item warning-count">Warnings: ${logs.warn.length}</div>
                            <div class="stat-item success-rate">Success Rate: ${successRate}%</div>
                        </div>
                        <div class="logs-container">
                            <div class="log-section">
                                <h4>Info Logs (${logs.info.length})</h4>
                                <div class="log-details">
                                    ${buildLogList(logs.info, 'info-log')}
                                </div>
                            </div>
                            <div class="log-section">
                                <h4>Warning Logs (${logs.warn.length})</h4>
                                <div class="log-details">
                                    ${buildLogList(logs.warn, 'warning-log')}
                                </div>
                            </div>
                            <div class="log-section">
                                <h4>Error Logs (${logs.error.length})</h4>
                                <div class="log-details">
                                    ${buildLogList(logs.error, 'error-log')}
                                </div>
                            </div>
                        </div>
                    </div>`;
            }
        }
        html += `
            </div>`;
    }
}

html += `
    </div>
</body>
</html>`;

// Tạo thư mục report/html nếu chưa tồn tại
const htmlDir = path.join('report', 'html');
if (!fs.existsSync(htmlDir)) {
    fs.mkdirSync(htmlDir, { recursive: true });
}

// Lưu file report
try {
    fs.writeFileSync(path.join(htmlDir, 'index.html'), html);
    console.log('Generated report/html/index.html successfully!');
} catch (error) {
    console.error('Error: Could not write index.html:', error.message);
    process.exit(1);
}