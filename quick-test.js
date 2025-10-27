// ทดสอบแค่ 1 หุ้นอย่างรวดเร็ว
const NewsAnalysisService = require('./services/newsAnalysisService');
const ReliableDataService = require('./services/reliableDataService');
const winston = require('winston');

// สร้าง logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [QUICK-TEST] [${level.toUpperCase()}]: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console()
  ]
});

async function quickTest() {
  try {
    console.log('🚀 Quick news test - single stock...');
    
    // สร้าง services
    const reliableDataService = new ReliableDataService();
    const newsAnalysis = new NewsAnalysisService(reliableDataService);
    
    // ทดสอบแค่ 1 หุ้น
    const testStocks = [
      { symbol: 'VOO', type: 'หุ้น', amount: 500, unit: 'USD', displayName: 'Vanguard S&P 500 ETF' }
    ];
    
    console.log('📰 Testing with VOO only...');
    
    // เรียกใช้ฟังก์ชันจัดเก็บข่าว
    const newsResult = await newsAnalysis.gatherAllStockNews(testStocks);
    
    console.log('✅ Quick test completed!');
    console.log('📊 Result:', {
      totalStocks: newsResult.length,
      stocksWithNews: newsResult.filter(s => s.totalNews > 0).length,
      totalNewsArticles: newsResult.reduce((sum, s) => sum + s.totalNews, 0),
      details: newsResult.map(s => ({
        symbol: s.stock.symbol,
        totalNews: s.totalNews,
        todayNews: s.todayNews,
        yesterdayNews: s.yesterdayNews
      }))
    });
    
    // ตรวจสอบไฟล์ที่สร้าง
    const fs = require('fs').promises;
    const path = require('path');
    const outputPath = path.join(__dirname, 'data', 'output-summary.txt');
    
    try {
      const content = await fs.readFile(outputPath, 'utf8');
      console.log('\n✅ File was created/updated!');
      console.log('📁 Location:', outputPath);
      console.log('📏 Content length:', content.length, 'characters');
      
      // แสดงเฉพาะส่วนใหม่ล่าสุด
      const lastReportIndex = content.lastIndexOf('=== COMPREHENSIVE_NEWS_REPORT');
      if (lastReportIndex !== -1) {
        const latestReport = content.substring(lastReportIndex);
        console.log('\n📖 Latest news report:');
        console.log(latestReport.substring(0, 800) + '...');
      }
    } catch (error) {
      console.log('⚠️ File not found:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Quick test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// รันการทดสอบ
quickTest();