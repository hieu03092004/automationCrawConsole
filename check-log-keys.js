const fs = require('fs');
const path = require('path');

// Đọc hashDataLogs.json để lấy mapping key->value
let hashDataLogs;
try {
    hashDataLogs = JSON.parse(fs.readFileSync('hashDataLogs.json', 'utf8'));
    console.log('✅ Đã đọc thành công file hashDataLogs.json');
} catch (error) {
    console.error('❌ Error: Could not read hashDataLogs.json:', error.message);
    process.exit(1);
}

// Đọc dữ liệu từ project.json
let projectData;
try {
    projectData = JSON.parse(fs.readFileSync('report/project.json', 'utf8'));
    console.log('✅ Đã đọc thành công file report/project.json');
} catch (error) {
    console.error('❌ Error: Could not read report/project.json:', error.message);
    process.exit(1);
}

// Thuật toán mới sử dụng Set để kiểm tra keys
function checkLogKeysWithSets() {
    console.log('\n🔍 Bắt đầu kiểm tra keys bằng Set...\n');

    // 1. Thu thập tất cả log keys từ project.json vào một Set
    const logKeysSet = new Set();
    if (Array.isArray(projectData.chunkResults)) {
        // Duyệt qua từng chunk
        projectData.chunkResults.forEach(chunk => {
            for (const [url, browsers] of Object.entries(chunk.itemsObject)) {
                for (const [browser, data] of Object.entries(browsers)) {
                    if (data.logs) {
                        const logs = data.logs;
                        [...logs.info, ...logs.warn, ...logs.error].forEach(key => logKeysSet.add(key));
                    }
                }
            }
        });
    } else if (projectData['items-object']) {
        // Trường hợp cũ
        for (const [url, browsers] of Object.entries(projectData['items-object'])) {
            for (const [browser, data] of Object.entries(browsers)) {
                if (data.logs) {
                    const logs = data.logs;
                    [...logs.info, ...logs.warn, ...logs.error].forEach(key => logKeysSet.add(key));
                }
            }
        }
    }

    // 2. Thu thập tất cả keys từ hashDataLogs.json vào một Set
    const hashKeysSet = new Set(Object.keys(hashDataLogs.hash));

    // 3. So sánh kích thước
    const logKeysArr = Array.from(logKeysSet);
    const hashKeysArr = Array.from(hashKeysSet);
    const sameSize = logKeysSet.size === hashKeysSet.size;

    // 4. Tìm các keys bị thiếu ở mỗi bên
    const missingInHash = logKeysArr.filter(key => !hashKeysSet.has(key));
    const extraInHash = hashKeysArr.filter(key => !logKeysSet.has(key));

    // 5. In kết quả
    console.log(`📊 Tổng số keys trong project.json (logKeysSet): ${logKeysSet.size}`);
    console.log(`📊 Tổng số keys trong hashDataLogs.json (hashKeysSet): ${hashKeysSet.size}`);
    if (sameSize && missingInHash.length === 0 && extraInHash.length === 0) {
        console.log('\n✅ TẤT CẢ CÁC KEYS TRONG project.json ĐỀU TỒN TẠI TRONG hashDataLogs.json VÀ NGƯỢC LẠI!');
    } else {
        if (missingInHash.length > 0) {
            console.log(`\n❌ Có ${missingInHash.length} keys xuất hiện trong project.json nhưng KHÔNG có trong hashDataLogs.json:`);
            missingInHash.slice(0, 10).forEach((key, idx) => {
                console.log(`   ${idx + 1}. ${key}`);
            });
            if (missingInHash.length > 10) {
                console.log(`   ... và ${missingInHash.length - 10} keys khác`);
            }
        }
        if (extraInHash.length > 0) {
            console.log(`\n❌ Có ${extraInHash.length} keys xuất hiện trong hashDataLogs.json nhưng KHÔNG có trong project.json:`);
            extraInHash.slice(0, 10).forEach((key, idx) => {
                console.log(`   ${idx + 1}. ${key}`);
            });
            if (extraInHash.length > 10) {
                console.log(`   ... và ${extraInHash.length - 10} keys khác`);
            }
        }
    }

    // Trả về kết quả để dùng cho báo cáo tự động
    return {
        totalLogKeys: logKeysSet.size,
        totalHashKeys: hashKeysSet.size,
        missingInHash,
        extraInHash,
        allMatch: sameSize && missingInHash.length === 0 && extraInHash.length === 0
    };
}

// Hàm tạo báo cáo chi tiết
function generateDetailedReport() {
    console.log('\n📄 BÁO CÁO CHI TIẾT');
    console.log('='.repeat(60));

    const results = checkLogKeysWithSets();

    // Tạo file báo cáo
    const reportData = {
        timestamp: new Date().toISOString(),
        summary: {
            totalLogKeys: results.totalLogKeys,
            totalHashKeys: results.totalHashKeys,
            missingInHash: results.missingInHash.length,
            extraInHash: results.extraInHash.length,
            allMatch: results.allMatch
        },
        missingInHash: results.missingInHash,
        extraInHash: results.extraInHash,
        status: results.allMatch ? 'SUCCESS' : 'WARNING'
    };

    // Lưu báo cáo
    try {
        fs.writeFileSync('log-keys-check-report.json', JSON.stringify(reportData, null, 2));
        console.log('\n💾 Đã lưu báo cáo chi tiết vào file: log-keys-check-report.json');
    } catch (error) {
        console.error('❌ Không thể lưu báo cáo:', error.message);
    }

    return results;
}

// Chạy kiểm tra
if (require.main === module) {
    try {
        const results = generateDetailedReport();

        console.log('\n' + '='.repeat(60));
        console.log('🏁 KẾT LUẬN');
        console.log('='.repeat(60));

        if (results.allMatch) {
            console.log('✅ TẤT CẢ KEYS ĐỀU HỢP LỆ! Có thể yên tâm tạo báo cáo HTML.');
        } else {
            if (results.missingInHash.length > 0) {
                console.log(`❌ PHÁT HIỆN ${results.missingInHash.length} KEYS BỊ THIẾU TRONG hashDataLogs.json!`);
            }
            if (results.extraInHash.length > 0) {
                console.log(`❌ PHÁT HIỆN ${results.extraInHash.length} KEYS THỪA TRONG hashDataLogs.json!`);
            }
            console.log('   Cần kiểm tra lại quá trình crawl và lưu trữ logs.');
        }

        console.log(`\n📈 Tỷ lệ khớp: ${(results.allMatch ? 100 : ((results.totalLogKeys - results.missingInHash.length) / results.totalLogKeys * 100).toFixed(2))}%`);

    } catch (error) {
        console.error('❌ Lỗi trong quá trình kiểm tra:', error.message);
        process.exit(1);
    }
}

module.exports = { checkLogKeysWithSets, generateDetailedReport }; 