/**
 * ทดสอบ ReliableDataService ด้วยข้อมูลจริง
 */

const ReliableDataService = require('./../services/reliableDataService');
const winston = require('winston');

// Setup logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level.toUpperCase()}]: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
  ]
});

async function testReliableDataService() {
  console.log('🔍 ทดสอบ ReliableDataService ด้วยข้อมูลจริง');
  console.log('='.repeat(60));
  
  try {
    const reliableData = new ReliableDataService(logger);
    
    // ทดสอบกับหุ้น Apple
    const testSymbol = 'AAPL';
    console.log(`\n📊 ทดสอบการเก็บข้อมูลครอบคลุมสำหรับ ${testSymbol}...`);
    
    const startTime = Date.now();
    
    const comprehensiveData = await reliableData.gatherComprehensiveData(testSymbol, {
      includeNews: true,
      includeSocial: true,
      includeTechnical: true,
      includeFundamental: true,
      maxNewsItems: 10
    });
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log(`\n📈 ผลการวิเคราะห์ ${testSymbol} (ใช้เวลา ${duration} วินาที)`);
    console.log('-'.repeat(50));
    
    // แสดงข้อมูลที่เก็บได้
    if (comprehensiveData.analysis) {
      const { analysis } = comprehensiveData;
      
      if (analysis.newsData && analysis.newsData.length > 0) {
        console.log(`📰 ข่าวสาร: ${analysis.newsData.length} ข่าว`);
        analysis.newsData.slice(0, 3).forEach((news, index) => {
          console.log(`   ${index + 1}. [${news.source}] ${news.title.substring(0, 80)}...`);
        });
      } else {
        console.log('📰 ข่าวสาร: ไม่พบข่าว');
      }
      
      if (analysis.technicalData && Object.keys(analysis.technicalData).length > 0) {
        console.log(`📊 ข้อมูลเทคนิค: ${Object.keys(analysis.technicalData).length} ตัวชี้วัด`);
        if (analysis.technicalData.price) {
          console.log(`   💰 ราคา: $${analysis.technicalData.price}`);
        }
        if (analysis.technicalData.trend) {
          console.log(`   📈 แนวโน้ม: ${analysis.technicalData.trend}`);
        }
      } else {
        console.log('📊 ข้อมูลเทคนิค: ไม่พบข้อมูล');
      }
      
      if (analysis.socialSentiment && analysis.socialSentiment.overall) {
        console.log(`💭 Social Sentiment: ${analysis.socialSentiment.overall}`);
        if (analysis.socialSentiment.bullishPercent !== undefined) {
          console.log(`   📈 Bullish: ${analysis.socialSentiment.bullishPercent}%`);
          console.log(`   📉 Bearish: ${analysis.socialSentiment.bearishPercent}%`);
        }
      } else {
        console.log('💭 Social Sentiment: ไม่พบข้อมูล');
      }
      
      if (analysis.fundamentalData && Object.keys(analysis.fundamentalData).length > 0) {
        console.log(`📋 ข้อมูลพื้นฐาน: ${Object.keys(analysis.fundamentalData).length} ตัวชี้วัด`);
      } else {
        console.log('📋 ข้อมูลพื้นฐาน: ไม่พบข้อมูล');
      }
    }
    
    // แสดงแหล่งข้อมูล
    if (comprehensiveData.sources) {
      console.log(`\n🔍 แหล่งข้อมูล: ${Object.keys(comprehensiveData.sources).length} แหล่ง`);
      Object.entries(comprehensiveData.sources).forEach(([key, source]) => {
        console.log(`   ${key}: ${source}`);
      });
    }
    
    // แสดงคุณภาพข้อมูล
    if (comprehensiveData.dataQuality) {
      console.log(`\n⭐ คุณภาพข้อมูล: ${comprehensiveData.dataQuality}`);
    }
    
    console.log('\n✅ การทดสอบ ReliableDataService สำเร็จ!');
    return true;
    
  } catch (error) {
    console.error('❌ การทดสอบล้มเหลว:', error.message);
    console.error('Stack:', error.stack);
    return false;
  }
}

// รันการทดสอบ
if (require.main === module) {
  testReliableDataService()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { testReliableDataService };