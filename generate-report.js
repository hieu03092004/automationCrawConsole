const fs = require('fs');
const path = require('path');

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

// Hàm escape HTML để tránh XSS
function escapeHTML(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Hàm build log list với key và value
function buildLogList(keys, cssClass) {
    if (!keys || keys.length === 0) {
        return '<div class="no-logs">No logs found</div>';
    }
    
    return keys.map(key => {
        const val = hashDataLogs.hash[key] || 'Log message not found';
        return `<div class="log-entry ${cssClass}">
            <span class="log-key">${escapeHTML(key)}:</span> 
            <span class="log-value">${escapeHTML(val)}</span>
        </div>`;
    }).join('');
}

// Hàm tạo summary statistics từ chunkResults
function generateSummaryStats() {
    let totalLogs = 0;
    let totalErrors = 0;
    let totalWarnings = 0;
    let totalInfo = 0;
    let processedUrls = 0;

    // Duyệt qua tất cả chunkResults
    projectData.chunkResults.forEach(chunk => {
        const urls = Object.keys(chunk.itemsObject);
        processedUrls += urls.length;
        
        urls.forEach(url => {
            const browsers = chunk.itemsObject[url];
            Object.values(browsers).forEach(browserData => {
                if (browserData.logs) {
                    totalInfo += browserData.logs.info.length;
                    totalWarnings += browserData.logs.warn.length;
                    totalErrors += browserData.logs.error.length;
                    totalLogs += browserData.logs.info.length + browserData.logs.warn.length + browserData.logs.error.length;
                }
            });
        });
    });

    return {
        totalUrls: projectData.totalUrls,
        processedUrls: processedUrls,
        failedUrls: projectData.totalUrls - processedUrls,
        totalLogs,
        totalErrors,
        totalWarnings,
        totalInfo,
        successRate: totalLogs > 0 ? ((totalInfo / totalLogs) * 100).toFixed(1) : '0',
        processingSuccessRate: ((processedUrls / projectData.totalUrls) * 100).toFixed(1)
    };
}

// Tạo HTML report với styling hiện đại
const stats = generateSummaryStats();
const buildDate = new Date(projectData.buildNumber).toLocaleString();

let html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${projectData.projectName} - Console Crawl Report</title>
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
        
        * { 
            margin: 0; 
            padding: 0; 
            box-sizing: border-box; 
        }
        
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            line-height: 1.6; 
            background: var(--background-color); 
            color: var(--text-color); 
            padding: 20px; 
        }
        
        .container { 
            max-width: 1400px; 
            margin: 0 auto; 
        }
        
        .header { 
            text-align: center; 
            margin-bottom: 30px; 
            padding: 30px; 
            background: var(--card-background); 
            border-radius: var(--border-radius); 
            box-shadow: var(--box-shadow);
            border-left: 5px solid var(--primary-color);
        }
        
        .header h1 { 
            color: var(--primary-color); 
            margin-bottom: 10px; 
            font-size: 2.5em;
        }
        
        .header .build-info { 
            color: #666; 
            margin-top: 10px; 
            font-size: 1.1em;
        }
        
        .summary-box { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); 
            gap: 20px; 
            margin-bottom: 30px; 
        }
        
        .summary-item { 
            background: var(--card-background); 
            padding: 25px; 
            border-radius: var(--border-radius); 
            box-shadow: var(--box-shadow); 
            text-align: center;
            border-top: 4px solid var(--primary-color);
        }
        
        .summary-item h3 { 
            color: var(--text-color); 
            margin-bottom: 15px; 
            font-size: 1.1em;
        }
        
        .summary-item p { 
            font-size: 2em; 
            font-weight: bold; 
            color: var(--primary-color); 
        }
        
        .summary-item.error p { color: var(--error-color); }
        .summary-item.warning p { color: var(--warning-color); }
        .summary-item.success p { color: var(--success-color); }
        
        .chunk-section {
            background: var(--card-background);
            border-radius: var(--border-radius);
            box-shadow: var(--box-shadow);
            margin-bottom: 30px;
            overflow: hidden;
            border: 1px solid #e0e0e0;
        }
        
        .chunk-header {
            background: linear-gradient(135deg, #4CAF50, #45a049);
            color: white;
            padding: 20px;
            font-size: 1.3em;
            font-weight: 500;
        }
        
        .chunk-info {
            display: flex;
            gap: 20px;
            flex-wrap: wrap;
            padding: 15px 20px;
            background: #f8f9fa;
            border-bottom: 1px solid #e0e0e0;
        }
        
        .chunk-stat {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 10px 15px;
            background: white;
            border-radius: 6px;
            border: 1px solid #e0e0e0;
            min-width: 120px;
        }
        
        .chunk-stat-label {
            font-size: 0.9em;
            color: #666;
            margin-bottom: 5px;
        }
        
        .chunk-stat-value {
            font-weight: bold;
            color: var(--primary-color);
        }
        
        .url-section { 
            background: var(--card-background); 
            border-radius: var(--border-radius); 
            box-shadow: var(--box-shadow); 
            margin-bottom: 20px; 
            overflow: hidden;
            border: 1px solid #e0e0e0;
        }
        
        .url-header { 
            background: linear-gradient(135deg, var(--primary-color), #1976D2); 
            color: white; 
            padding: 20px; 
            font-size: 1.3em; 
            word-break: break-all;
            font-weight: 500;
        }
        
        .browser-section { 
            padding: 25px; 
            border-bottom: 1px solid #eee; 
        }
        
        .browser-section:last-child { 
            border-bottom: none; 
        }
        
        .browser-header { 
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            margin-bottom: 20px; 
            padding-bottom: 15px; 
            border-bottom: 2px solid var(--primary-color); 
        }
        
        .browser-name { 
            font-size: 1.4em; 
            font-weight: bold; 
            color: var(--primary-color); 
            text-transform: capitalize;
        }
        
        .screenshot-link { 
            display: inline-block; 
            padding: 10px 20px; 
            background: var(--primary-color); 
            color: white; 
            text-decoration: none; 
            border-radius: 6px; 
            transition: all 0.3s; 
            font-weight: 500;
        }
        
        .screenshot-link:hover { 
            background: #1976D2; 
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        }
        
        .logs-container { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); 
            gap: 25px; 
            margin-top: 20px; 
        }
        
        .log-section { 
            background: #f8f9fa; 
            border-radius: var(--border-radius); 
            padding: 20px; 
            border: 1px solid #e9ecef;
        }
        
        .log-section h4 { 
            margin-bottom: 15px; 
            padding-bottom: 10px; 
            border-bottom: 2px solid #dee2e6; 
            font-size: 1.2em;
            color: var(--text-color);
        }
        
        .log-details { 
            margin-top: 15px; 
            padding: 15px; 
            background: #fff; 
            border-radius: 6px; 
            border: 1px solid #dee2e6; 
            max-height: 400px; 
            overflow-y: auto; 
        }
        
        .log-entry { 
            padding: 12px; 
            border-bottom: 1px solid #eee; 
            margin-bottom: 8px;
            border-radius: 4px;
            background: #fafafa;
        }
        
        .log-entry:last-child { 
            border-bottom: none; 
            margin-bottom: 0;
        }
        
        .log-entry:hover { 
            background: #f0f0f0; 
        }
        
        .log-key { 
            font-weight: bold; 
            color: #666; 
            margin-right: 8px; 
            font-family: 'Courier New', monospace;
            font-size: 0.9em;
        }
        
        .log-value { 
            color: var(--text-color); 
            word-break: break-word;
            line-height: 1.4;
        }
        
        .info-log .log-value { color: var(--info-color); }
        .warning-log .log-value { color: var(--warning-color); }
        .error-log .log-value { color: var(--error-color); }
        
        .stats { 
            display: flex; 
            gap: 15px; 
            margin-top: 15px; 
            flex-wrap: wrap; 
        }
        
        .stat-item { 
            padding: 8px 15px; 
            border-radius: 6px; 
            font-size: 0.9em; 
            font-weight: 500;
        }
        
        .total-logs { background: var(--info-color); color: white; }
        .error-count { background: var(--error-color); color: white; }
        .warning-count { background: var(--warning-color); color: white; }
        .success-rate { background: var(--success-color); color: white; }
        
        .no-logs {
            color: #999;
            font-style: italic;
            text-align: center;
            padding: 20px;
        }
        
        .footer {
            text-align: center;
            margin-top: 40px;
            padding: 20px;
            color: #666;
            border-top: 1px solid #eee;
        }
        
        @media (max-width: 768px) { 
            .logs-container { grid-template-columns: 1fr; } 
            .summary-box { grid-template-columns: 1fr; } 
            .browser-header { flex-direction: column; gap: 10px; }
            .stats { justify-content: center; }
            .chunk-info { flex-direction: column; }
        }
        
        /* Scrollbar styling */
        .log-details::-webkit-scrollbar {
            width: 8px;
        }
        
        .log-details::-webkit-scrollbar-track {
            background: #f1f1f1;
            border-radius: 4px;
        }
        
        .log-details::-webkit-scrollbar-thumb {
            background: #c1c1c1;
            border-radius: 4px;
        }
        
        .log-details::-webkit-scrollbar-thumb:hover {
            background: #a8a8a8;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${escapeHTML(projectData.projectName)} - Console Crawl Report</h1>
            <div class="build-info">
                <strong>Build Number:</strong> ${projectData.buildNumber}<br>
                <strong>Build Date:</strong> ${buildDate}<br>
                <strong>Total URLs:</strong> ${stats.totalUrls} | 
                <strong>Processed URLs:</strong> ${stats.processedUrls} | 
                <strong>Failed URLs:</strong> ${stats.failedUrls} | 
                <strong>Processing Success Rate:</strong> ${stats.processingSuccessRate}% | 
                <strong>Log Success Rate:</strong> ${stats.successRate}%
            </div>
        </div>

        <div class="summary-box">
            <div class="summary-item">
                <h3>Total URLs</h3>
                <p>${stats.totalUrls}</p>
            </div>
            <div class="summary-item">
                <h3>Processed URLs</h3>
                <p>${stats.processedUrls}</p>
            </div>
            <div class="summary-item error">
                <h3>Failed URLs</h3>
                <p>${stats.failedUrls}</p>
            </div>
            <div class="summary-item">
                <h3>Total Logs</h3>
                <p>${stats.totalLogs}</p>
            </div>
            <div class="summary-item error">
                <h3>Errors</h3>
                <p>${stats.totalErrors}</p>
            </div>
            <div class="summary-item warning">
                <h3>Warnings</h3>
                <p>${stats.totalWarnings}</p>
            </div>
            <div class="summary-item success">
                <h3>Processing Success</h3>
                <p>${stats.processingSuccessRate}%</p>
            </div>
            <div class="summary-item success">
                <h3>Log Success Rate</h3>
                <p>${stats.successRate}%</p>
            </div>
        </div>`;

// Xử lý từng chunk
projectData.chunkResults.forEach((chunk, chunkIndex) => {
    html += `
        <div class="chunk-section">
            <div class="chunk-header">
                Chunk ${chunk.chunkNumber} - ${chunk.processedUrls}/${chunk.totalUrls} URLs Processed
            </div>
            <div class="chunk-info">
                <div class="chunk-stat">
                    <div class="chunk-stat-label">Processing Time</div>
                    <div class="chunk-stat-value">${chunk.processingTime}</div>
                </div>
                <div class="chunk-stat">
                    <div class="chunk-stat-label">Start Time</div>
                    <div class="chunk-stat-value">${new Date(chunk.startTime).toLocaleString()}</div>
                </div>
                <div class="chunk-stat">
                    <div class="chunk-stat-label">End Time</div>
                    <div class="chunk-stat-value">${new Date(chunk.endTime).toLocaleString()}</div>
                </div>
            </div>`;

    // Xử lý từng URL trong chunk
    for (const [url, browsers] of Object.entries(chunk.itemsObject)) {
        html += `
            <div class="url-section">
                <div class="url-header">${escapeHTML(url)}</div>`;

        // Xử lý từng trình duyệt
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
                            <a href="${data.screenshot}" class="screenshot-link" target="_blank">
                                📸 View Screenshot
                            </a>
                        </div>
                        
                        <div class="stats">
                            <div class="stat-item total-logs">Total Logs: ${totalLogs}</div>
                            <div class="stat-item error-count">Errors: ${logs.error.length}</div>
                            <div class="stat-item warning-count">Warnings: ${logs.warn.length}</div>
                            <div class="stat-item success-rate">Success Rate: ${successRate}%</div>
                        </div>

                        <div class="logs-container">
                            <div class="log-section">
                                <h4>✅ Info Logs (${logs.info.length})</h4>
                                <div class="log-details">
                                    ${buildLogList(logs.info, 'info-log')}
                                </div>
                            </div>
                            
                            <div class="log-section">
                                <h4>⚠️ Warning Logs (${logs.warn.length})</h4>
                                <div class="log-details">
                                    ${buildLogList(logs.warn, 'warning-log')}
                                </div>
                            </div>
                            
                            <div class="log-section">
                                <h4>❌ Error Logs (${logs.error.length})</h4>
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

    html += `
        </div>`;
});

html += `
        <div class="footer">
            <p>Report generated on ${new Date().toLocaleString()} | 
            Total Processing Time: ${projectData.totalProcessingTime || 'N/A'} | 
            Number of Chunks: ${projectData.numberOfChunks || 'N/A'} | 
            Processed URLs: ${projectData.totalProcessedUrls || stats.processedUrls}/${projectData.totalUrls || stats.totalUrls}</p>
        </div>
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
    console.log('✅ Generated report/html/index.html successfully!');
    console.log(`📊 Report Summary:`);
    console.log(`   - Total URLs: ${stats.totalUrls}`);
    console.log(`   - Processed URLs: ${stats.processedUrls}`);
    console.log(`   - Failed URLs: ${stats.failedUrls}`);
    console.log(`   - Total Logs: ${stats.totalLogs}`);
    console.log(`   - Errors: ${stats.totalErrors}`);
    console.log(`   - Warnings: ${stats.totalWarnings}`);
    console.log(`   - Processing Success Rate: ${stats.processingSuccessRate}%`);
    console.log(`   - Log Success Rate: ${stats.successRate}%`);
    console.log(`   - Number of Chunks: ${projectData.numberOfChunks || 'N/A'}`);
    console.log(`🌐 Open report/html/index.html in your browser to view the report`);
} catch (error) {
    console.error('❌ Error: Could not write index.html:', error.message);
    process.exit(1);
}