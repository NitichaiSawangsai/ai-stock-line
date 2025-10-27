// ทดสอบระบบข่าวโดยตรง
const NewsAnalysisService = require('./services/newsAnalysisService');
const ReliableDataService = require('./services/reliableDataService');
const winston = require('winston');

// สร้าง logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [TEST] [${level.toUpperCase()}]: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console()
  ]
});

async function testNewsGathering() {
  try {
    console.log('📰 Testing news gathering system...');
    
    // สร้าง services
    const reliableDataService = new ReliableDataService();
    const newsAnalysis = new NewsAnalysisService(reliableDataService);
    
    // ข้อมูลหุ้นทดสอบ (จำนวนน้อยเพื่อทดสอบ)
    const testStocks = [
      { symbol: 'VOO', type: 'หุ้น', amount: 500, unit: 'USD', displayName: 'Vanguard S&P 500 ETF' },
      { symbol: 'NVDA', type: 'หุ้น', amount: 100, unit: 'USD', displayName: 'NVIDIA Corporation' },
      { symbol: 'AAPL', type: 'หุ้น', amount: 200, unit: 'USD', displayName: 'Apple Inc.' }
    ];
    
    console.log(`🔍 Gathering news for ${testStocks.length} stocks...`);
    
    // เรียกใช้ฟังก์ชันจัดเก็บข่าว
    const newsResult = await newsAnalysis.gatherAllStockNews(testStocks);
    
    console.log('✅ News gathering test completed!');
    console.log('📊 Result:', {
      totalStocks: newsResult.length,
      stocksWithNews: newsResult.filter(s => s.totalNews > 0).length,
      totalNewsArticles: newsResult.reduce((sum, s) => sum + s.totalNews, 0)
    });
    
    // ตรวจสอบไฟล์ที่สร้าง
    const fs = require('fs').promises;
    const path = require('path');
    const outputPath = path.join(__dirname, 'data', 'output-summary.txt');
    
    try {
      const content = await fs.readFile(outputPath, 'utf8');
      console.log('\n📄 File created successfully!');
      console.log('📁 Location:', outputPath);
      console.log('📏 Content length:', content.length, 'characters');
      console.log('\n📖 Content preview:');
      console.log(content.substring(0, 500) + '...');
    } catch (error) {
      console.log('⚠️ File not found:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// รันการทดสอบ
testNewsGathering();