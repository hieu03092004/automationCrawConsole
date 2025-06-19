const fs = require('fs');

function checkDuplicateValues() {
    try {
        // Đọc file hashDataLogs.json
        const data = fs.readFileSync('hashDataLogs.json', 'utf8');
        const jsonData = JSON.parse(data);
        
        // Lấy object hash từ dữ liệu
        const hashData = jsonData.hash;
        
        if (!hashData) {
            console.log('❌ Không tìm thấy object "hash" trong file hashDataLogs.json');
            return;
        }
        
        console.log('🔍 Đang kiểm tra các values trùng lặp...\n');
        
        // Tạo map để theo dõi values và keys tương ứng
        const valueToKeys = new Map();
        const duplicates = new Map();
        
        // Duyệt qua tất cả các key-value pairs
        for (const [key, value] of Object.entries(hashData)) {
            if (valueToKeys.has(value)) {
                // Nếu value đã tồn tại, thêm vào danh sách trùng lặp
                if (!duplicates.has(value)) {
                    duplicates.set(value, [valueToKeys.get(value), key]);
                } else {
                    duplicates.get(value).push(key);
                }
            } else {
                // Nếu value chưa tồn tại, lưu key đầu tiên
                valueToKeys.set(value, key);
            }
        }
        
        // Hiển thị kết quả
        if (duplicates.size === 0) {
            console.log('✅ Tuyệt vời! Không có values trùng lặp nào được tìm thấy.');
            console.log(`📊 Tổng số entries: ${Object.keys(hashData).length}`);
            console.log(`📊 Số values duy nhất: ${valueToKeys.size}`);
        } else {
            console.log(`❌ Tìm thấy ${duplicates.size} values trùng lặp:\n`);
            
            let duplicateCount = 1;
            for (const [value, keys] of duplicates) {
                console.log(`🔴 Trùng lặp #${duplicateCount}:`);
                console.log(`   Value: "${value}"`);
                console.log(`   Keys: ${keys.join(', ')}`);
                console.log(`   Số lần xuất hiện: ${keys.length}\n`);
                duplicateCount++;
            }
            
            console.log(`📊 Thống kê:`);
            console.log(`   - Tổng số entries: ${Object.keys(hashData).length}`);
            console.log(`   - Số values duy nhất: ${valueToKeys.size}`);
            console.log(`   - Số values trùng lặp: ${duplicates.size}`);
        }
        
    } catch (error) {
        console.error('❌ Lỗi khi đọc file:', error.message);
    }
}

// Chạy function kiểm tra
checkDuplicateValues(); 