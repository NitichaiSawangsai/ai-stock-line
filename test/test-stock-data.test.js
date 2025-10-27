require('dotenv').config();
const StockDataService = require('../services/stockDataService');

async function testStockData() {
    console.log('🧪 กำลังทดสอบการดาวน์โหลดข้อมูลหุ้น...');
    
    try {
        const stockDataService = new StockDataService(process.env.STOCK_DATA_URL);
        
        console.log('📊 กำลังดาวน์โหลดข้อมูล...');
        const result = await stockDataService.getFormattedStockData();
        
        console.log('✅ ดาวน์โหลดสำเร็จ!');
        console.log(`📈 จำนวนหุ้น: ${result.stockList.length} รายการ`);
        console.log('\n📝 ข้อมูลหุ้นที่ดาวน์โหลด:');
        
        result.stockList.forEach((stock, index) => {
            console.log(`${index + 1}. ${stock.type} ${stock.symbol} ${stock.amount} ${stock.purchasePrice}`);
        });
        
        console.log('\n📄 ข้อมูลที่จัดรูปแบบแล้ว:');
        console.log(result.formattedData);
        
    } catch (error) {
        console.error('❌ การทดสอบล้มเหลว:', error.message);
        process.exit(1);
    }
}

testStockData();