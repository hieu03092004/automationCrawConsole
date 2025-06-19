const fs = require('fs');
const path = require('path');

function removeUnusedKeys() {
    console.log('🔍 Đang phân tích và loại bỏ keys không sử dụng...\n');
    
    const startTime = Date.now();
    
    try {
        // Đọc hashDataLogs.json
        const hashDataLogsPath = path.resolve(__dirname, 'hashDataLogs.json');
        if (!fs.existsSync(hashDataLogsPath)) {
            console.log('❌ File hashDataLogs.json không tồn tại.');
            return;
        }
        
        const hashDataLogs = JSON.parse(fs.readFileSync(hashDataLogsPath, 'utf8'));
        const originalKeys = Object.keys(hashDataLogs.hash);
        console.log(`📊 Keys ban đầu trong hashDataLogs.json: ${originalKeys.length}`);
        
        // Đọc project.json
        const projectPath = path.resolve(__dirname, 'report', 'project.json');
        if (!fs.existsSync(projectPath)) {
            console.log('❌ File report/project.json không tồn tại.');
            return;
        }
        
        const projectData = JSON.parse(fs.readFileSync(projectPath, 'utf8'));
        
        // Extract tất cả keys được sử dụng từ project.json
        console.log('🔍 Đang extract keys được sử dụng từ project.json...');
        const usedKeys = new Set(); // O(1) lookup time
        
        // Time Complexity: O(N * M * K)
        // N = số URLs, M = số browsers, K = số logs per browser
        for (const [url, browsers] of Object.entries(projectData['items-object'])) {
            for (const [browser, data] of Object.entries(browsers)) {
                if (data.logs) {
                    const logs = data.logs;
                    const logKeys = [
                        ...logs.info,
                        ...logs.warn,
                        ...logs.error
                    ];
                    logKeys.forEach(key => usedKeys.add(key)); // O(1) per add
                }
            }
        }
        
        console.log(`📊 Keys được sử dụng trong project.json: ${usedKeys.size}`);
        
        // Tìm keys không sử dụng
        console.log('🔍 Đang tìm keys không sử dụng...');
        const unusedKeys = [];
        
        // Time Complexity: O(P) where P = số keys trong hashDataLogs
        for (const key of originalKeys) {
            if (!usedKeys.has(key)) { // O(1) lookup
                unusedKeys.push(key);
            }
        }
        
        console.log(`📊 Keys không sử dụng: ${unusedKeys.length}`);
        
        // Tạo backup
        const backupPath = path.resolve(__dirname, 'hashDataLogs_backup_before_cleanup.json');
        fs.writeFileSync(backupPath, JSON.stringify(hashDataLogs, null, 2));
        console.log(`💾 Backup đã được tạo: ${backupPath}`);
        
        // Loại bỏ keys không sử dụng
        console.log('🧹 Đang loại bỏ keys không sử dụng...');
        const cleanedHash = {};
        
        // Time Complexity: O(P) where P = số keys trong hashDataLogs
        for (const key of originalKeys) {
            if (usedKeys.has(key)) { // O(1) lookup
                cleanedHash[key] = hashDataLogs.hash[key];
            }
        }
        
        // Lưu file đã cleanup
        const cleanedData = { hash: cleanedHash };
        fs.writeFileSync(hashDataLogsPath, JSON.stringify(cleanedData, null, 2));
        
        const endTime = Date.now();
        const processingTime = (endTime - startTime) / 1000;
        
        console.log('\n✅ Cleanup completed!');
        console.log(`📊 Keys ban đầu: ${originalKeys.length}`);
        console.log(`📊 Keys sau cleanup: ${Object.keys(cleanedHash).length}`);
        console.log(`🗑️  Đã xóa ${unusedKeys.length} keys không sử dụng`);
        console.log(`📈 Giảm ${((unusedKeys.length / originalKeys.length) * 100).toFixed(2)}% keys`);
        console.log(`⏱️  Thời gian xử lý: ${processingTime.toFixed(3)}s`);
        
        // Hiển thị một số keys bị xóa (nếu có)
        if (unusedKeys.length > 0) {
            console.log('\n📋 Một số keys bị xóa:');
            unusedKeys.slice(0, 5).forEach(key => {
                console.log(`   - "${key}"`);
            });
            if (unusedKeys.length > 5) {
                console.log(`   ... và ${unusedKeys.length - 5} keys khác`);
            }
        }
        
        // Time Complexity Analysis
        console.log('\n📊 PHÂN TÍCH TIME COMPLEXITY:');
        console.log(`   - URLs: ${Object.keys(projectData['items-object']).length}`);
        console.log(`   - Total logs: ${usedKeys.size}`);
        console.log(`   - HashDataLogs keys: ${originalKeys.length}`);
        console.log(`   - Overall: O(N*M*K + P) ≈ O(${Object.keys(projectData['items-object']).length}*3*${Math.ceil(usedKeys.size/Object.keys(projectData['items-object']).length)} + ${originalKeys.length})`);
        console.log(`   - Thực tế: ${processingTime.toFixed(3)}s cho ${originalKeys.length} keys`);
        
    } catch (error) {
        console.error('❌ Lỗi khi cleanup:', error.message);
    }
}

// Chạy function cleanup
removeUnusedKeys(); 