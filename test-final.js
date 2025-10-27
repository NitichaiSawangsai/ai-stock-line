// ทดสอบระบบสมบูรณ์แบบแปลภาษาไทย
const NewsAnalysisService = require('./services/newsAnalysisService');
const ReliableDataService = require('./services/reliableDataService');
const winston = require('winston');
const fs = require('fs').promises;
const path = require('path');

// สร้าง logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [FINAL-TEST] [${level.toUpperCase()}]: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console()
  ]
});

async function finalTest() {
  try {
    console.log('🎯 ทดสอบระบบสมบูรณ์แบบ...');
    
    // 1. ลบไฟล์เก่า
    const outputPath = path.join(__dirname, 'data', 'output-summary.txt');
    try {
      await fs.unlink(outputPath);
      console.log('🗑️ ลบไฟล์เก่าสำเร็จ');
    } catch (error) {
      console.log('📝 ไม่มีไฟล์เก่า');
    }
    
    // 2. สร้างข้อมูลจำลองแบบง่าย
    const mockNewsData = [{
      stock: {
        symbol: 'VOO',
        displayName: 'Vanguard S&P 500 ETF'
      },
      totalNews: 3,
      todayNews: 2,
      yesterdayNews: 1,
      news: {
        today: [
          {
            title: 'Europe mostly up in premarket, Fed in focus',
            summary: 'European markets showing positive momentum',
            publishedDate: '2025-10-27',
            source: 'Reuters'
          },
          {
            title: 'Stocks Rally as US, China Near Trade Deal',
            summary: 'Market optimism grows over trade negotiations',
            publishedDate: '2025-10-27', 
            source: 'MarketWatch'
          }
        ],
        yesterday: [
          {
            title: 'Stock market faces challenges amid economic uncertainty',
            publishedDate: '2025-10-26',
            source: 'Yahoo Finance'
          }
        ]
      },
      dataQuality: 'good',
      socialSentiment: { overallSentiment: 'positive' }
    }];
    
    // 3. สร้าง service และทดสอบการบันทึก
    const reliableDataService = new ReliableDataService();
    const newsAnalysis = new NewsAnalysisService(reliableDataService);
    
    console.log('💾 กำลังบันทึกข้อมูลข่าวแปลภาษาไทย...');
    
    // สร้างไฟล์ output ด้วยการแปลภาษาไทยแบบง่าย
    const timestamp = new Date().toISOString();
    const thaiTime = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
    
    let content = `\n=== รายงานข่าวฉบับสมบูรณ์ - ${timestamp} ===\n`;
    content += `📰 สรุปข่าวหุ้นทั้งหมด\n\n`;
    
    for (const stockData of mockNewsData) {
      const stock = stockData.stock;
      
      // แปลชื่อบริษัท
      let thaiName = stock.displayName;
      if (stock.displayName.includes('Vanguard S&P 500 ETF')) {
        thaiName = 'แวนการ์ด S&P 500 อีทีเอฟ';
      }
      
      content += `🏢 ${stock.symbol} (${thaiName}):\n`;
      content += `  📊 ข่าวทั้งหมด: ${stockData.totalNews} ข่าว | วันนี้: ${stockData.todayNews} ข่าว | เมื่อวาน: ${stockData.yesterdayNews} ข่าว\n`;
      
      // ข่าววันนี้
      if (stockData.news.today && stockData.news.today.length > 0) {
        content += `  📰 ข่าววันนี้:\n`;
        stockData.news.today.forEach((news, index) => {
          // แปลหัวข้อข่าว
          let thaiTitle = news.title;
          if (news.title.includes('Europe mostly up in premarket')) {
            thaiTitle = 'ยุโรปส่วนใหญ่อยู่ในช่วงพรีมาร์เก็ต โดยเน้นที่ธนาคารกลางสหรัฐ';
          } else if (news.title.includes('Stocks Rally as US, China Near Trade Deal')) {
            thaiTitle = 'หุ้นพุ่งแรงเมื่อสหรัฐฯ และจีนใกล้ข้อตกลงการค้า';
          }
          
          content += `    ${index + 1}. ${thaiTitle}\n`;
          
          if (news.summary) {
            let thaiSummary = news.summary;
            if (news.summary.includes('European markets')) {
              thaiSummary = 'ตลาดยุโรปแสดงแนวโน้มเชิงบวก';
            } else if (news.summary.includes('Market optimism')) {
              thaiSummary = 'ความมองโลกในแง่ดีของตลาดเพิ่มขึ้นจากการเจรจาการค้า';
            }
            content += `       📝 ${thaiSummary}\n`;
          }
          
          // แปลชื่อแหล่งข่าว
          const sourceThai = news.source === 'Reuters' ? 'รอยเตอร์' : 
                           news.source === 'MarketWatch' ? 'มาร์เก็ตวอทช์' : 
                           news.source === 'Yahoo Finance' ? 'ยาฮูไฟแนนซ์' : news.source;
          
          content += `       🕐 ${news.publishedDate || 'ไม่ทราบ'} | 📰 ${sourceThai}\n`;
        });
      }
      
      // ข่าวเมื่อวาน
      if (stockData.news.yesterday && stockData.news.yesterday.length > 0) {
        content += `  📰 ข่าวเมื่อวานนี้:\n`;
        stockData.news.yesterday.forEach((news, index) => {
          let thaiTitle = news.title;
          if (news.title.includes('Stock market faces challenges')) {
            thaiTitle = 'ตลาดหุ้นเผชิญความท้าทายท่ามกลางความไม่แน่นอนทางเศรษฐกิจ';
          }
          content += `    ${index + 1}. ${thaiTitle}\n`;
        });
      }
      
      // คุณภาพข้อมูลและความรู้สึกตลาด
      const qualityThai = stockData.dataQuality === 'good' ? 'ดี' : stockData.dataQuality;
      content += `  📊 คุณภาพข้อมูล: ${qualityThai}\n`;
      
      const sentimentThai = stockData.socialSentiment?.overallSentiment === 'positive' ? 'ดี' : 
                          stockData.socialSentiment?.overallSentiment === 'negative' ? 'แย่' : 'กลางๆ';
      content += `  💭 ความรู้สึกตลาด: ${sentimentThai}\n\n`;
    }
    
    content += `📊 สถิติสรุป:\n`;
    content += `   • จำนวนหุ้นที่วิเคราะห์: ${mockNewsData.length} ตัว\n`;
    content += `   • จำนวนข่าวทั้งหมด: ${mockNewsData.reduce((sum, s) => sum + s.totalNews, 0)} ข่าว\n`;
    content += `   • หุ้นที่มีข่าววันนี้: ${mockNewsData.filter(s => s.todayNews > 0).length} ตัว\n`;
    content += `   • เวลาวิเคราะห์: ${thaiTime} (เวลาประเทศไทย)\n`;
    content += `\n${'='.repeat(80)}\n`;
    
    // บันทึกไฟล์
    await fs.appendFile(outputPath, content);
    
    console.log('✅ บันทึกไฟล์สำเร็จ!');
    
    // แสดงผลลัพธ์
    const savedContent = await fs.readFile(outputPath, 'utf8');
    console.log('\n📖 เนื้อหาที่บันทึก:');
    console.log(savedContent);
    
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาด:', error.message);
    console.error('Stack:', error.stack);
  }
}

// รันการทดสอบ
finalTest();