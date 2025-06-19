const fs = require('fs');
const path = require('path');

function checkFailedUrls() {
    console.log('🔍 Đang kiểm tra URLs bị fail...\n');
    
    try {
        // Đọc project.json
        const projectData = JSON.parse(fs.readFileSync('report/project.json', 'utf8'));
        
        // Đọc metadata để biết URLs ban đầu
        const metadata = JSON.parse(fs.readFileSync('chunks/metadata.json', 'utf8'));
        
        // Lấy tất cả URLs từ metadata
        const allUrls = [];
        for (let i = 1; i <= metadata.numberOfChunks; i++) {
            const chunkFile = path.join('chunks', `chunk-${i}.json`);
            if (fs.existsSync(chunkFile)) {
                const chunkUrls = JSON.parse(fs.readFileSync(chunkFile, 'utf8'));
                allUrls.push(...chunkUrls);
            }
        }
        
        // Lấy URLs có dữ liệu từ project.json
        const processedUrls = Object.keys(projectData['items-object']);
        
        console.log(`📊 Thống kê:`);
        console.log(`   - Total URLs (metadata): ${allUrls.length}`);
        console.log(`   - Total URLs (project.json): ${projectData.totalUrls}`);
        console.log(`   - Processed URLs: ${processedUrls.length}`);
        console.log(`   - Failed URLs: ${allUrls.length - processedUrls.length}`);
        
        // Tìm URLs bị fail
        const failedUrls = allUrls.filter(url => !processedUrls.includes(url));
        
        if (failedUrls.length > 0) {
            console.log(`\n❌ URLs bị fail (${failedUrls.length}):`);
            failedUrls.forEach((url, index) => {
                console.log(`   ${index + 1}. ${url}`);
            });
        } else {
            console.log('\n✅ Không có URLs nào bị fail!');
        }
        
        // Kiểm tra URLs có dữ liệu nhưng bị lỗi
        console.log(`\n📋 URLs có dữ liệu nhưng có thể bị lỗi:`);
        processedUrls.forEach(url => {
            const browsers = projectData['items-object'][url];
            const hasError = Object.values(browsers).some(browser => 
                browser.errorMessage || browser.status === 'Error'
            );
            
            if (hasError) {
                console.log(`   ❌ ${url} - Có lỗi trong dữ liệu`);
            }
        });
        
    } catch (error) {
        console.error('❌ Lỗi khi kiểm tra:', error.message);
    }
}

// Chạy function kiểm tra
checkFailedUrls(); 