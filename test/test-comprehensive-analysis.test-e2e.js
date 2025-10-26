/**
 * ทดสอบระบบวิเคราะห์ครบชุดด้วยข้อมูลครอบคลุม
 */

const NewsAnalysisService = require('./../services/newsAnalysisService');
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

async function testComprehensiveAnalysis() {
  console.log('🚀 ทดสอบระบบวิเคราะห์ครบชุดด้วยข้อมูลครอบคลุม');
  console.log('='.repeat(70));
  
  try {
    const newsService = new NewsAnalysisService(logger);
    
    // ทดสอบกับหุ้นตัวอย่าง
    const testStocks = [
      { symbol: 'AAPL', type: 'หุ้น', amount: 1, unit: 'หุ้น' },
      { symbol: 'TSLA', type: 'หุ้น', amount: 1, unit: 'หุ้น' }
    ];
    
    console.log(`\n📊 ทดสอบการวิเคราะห์ความเสี่ยงกับ ${testStocks.length} หุ้น...`);
    console.log('-'.repeat(50));
    
    const startTime = Date.now();
    
    // ทดสอบวิเคราะห์ความเสี่ยง
    const riskAnalysis = await newsService.analyzeHighRiskStocks(testStocks);
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log(`\n🚨 ผลการวิเคราะห์ความเสี่ยง (ใช้เวลา ${duration} วินาที)`);
    console.log('='.repeat(50));
    
    if (riskAnalysis && riskAnalysis.length > 0) {
      riskAnalysis.forEach((result, index) => {
        const { stock, riskAnalysis: analysis, comprehensiveData } = result;
        
        console.log(`\n${index + 1}. 🚨 HIGH RISK: ${stock.symbol}`);
        console.log(`   ระดับความเสี่ยง: ${analysis.riskLevel}`);
        console.log(`   ความมั่นใจ: ${Math.round(analysis.confidenceScore * 100)}%`);
        console.log(`   สรุป: ${analysis.summary}`);
        
        if (comprehensiveData) {
          console.log(`   📊 ข้อมูล: ${comprehensiveData.newsCount} ข่าว, ${Object.keys(result.comprehensiveData.sources || {}).length} แหล่ง`);
          console.log(`   💭 Sentiment: ${comprehensiveData.socialSentiment}`);
          console.log(`   📈 สัญญาณเทคนิค: ${comprehensiveData.technicalSignals}`);
          console.log(`   ⭐ คุณภาพข้อมูล: ${comprehensiveData.dataQuality}`);
        }
        
        if (result.topNews && result.topNews.length > 0) {
          console.log(`   📰 ข่าวสำคัญ:`);
          result.topNews.slice(0, 2).forEach((news, i) => {
            console.log(`      ${i + 1}. [${news.source || 'Unknown'}] ${news.title.substring(0, 80)}...`);
          });
        }
      });
    } else {
      console.log('✅ ไม่พบหุ้นที่มีความเสี่ยงสูง');
    }
    
    console.log(`\n📈 ทดสอบการวิเคราะห์โอกาสลงทุน...`);
    console.log('-'.repeat(50));
    
    const opportunityStartTime = Date.now();
    
    // ทดสอบวิเคราะห์โอกาส
    const opportunityAnalysis = await newsService.analyzeStockOpportunities(testStocks);
    
    const opportunityDuration = ((Date.now() - opportunityStartTime) / 1000).toFixed(2);
    
    console.log(`\n🔥 ผลการวิเคราะห์โอกาส (ใช้เวลา ${opportunityDuration} วินาที)`);
    console.log('='.repeat(50));
    
    if (opportunityAnalysis && opportunityAnalysis.length > 0) {
      opportunityAnalysis.forEach((result, index) => {
        console.log(`\n${index + 1}. 🔥 OPPORTUNITY: ${result.symbol}`);
        
        if (result.opportunityAnalysis) {
          const analysis = result.opportunityAnalysis;
          console.log(`   ระดับโอกาส: ${analysis.opportunityLevel}`);
          console.log(`   ความมั่นใจ: ${Math.round(analysis.confidenceScore * 100)}%`);
          console.log(`   สรุป: ${analysis.summary}`);
          console.log(`   กรอบเวลา: ${analysis.timeframe}`);
        }
        
        if (result.comprehensiveData) {
          const comprehensiveData = result.comprehensiveData;
          console.log(`   📊 ข้อมูล: ${comprehensiveData.newsCount || 0} ข่าว, ${Object.keys(comprehensiveData.sources || {}).length} แหล่ง`);
          console.log(`   💭 Sentiment: ${comprehensiveData.socialSentiment}`);
          console.log(`   📈 สัญญาณเทคนิค: ${comprehensiveData.technicalSignals || 0}`);
          console.log(`   ⭐ คุณภาพข้อมูล: ${comprehensiveData.dataQuality}`);
        }
        
        if (result.topNews && result.topNews.length > 0) {
          console.log(`   📰 ข่าวดี:`);
          result.topNews.slice(0, 2).forEach((news, i) => {
            console.log(`      ${i + 1}. [${news.source || 'Unknown'}] ${news.title.substring(0, 80)}...`);
          });
        }
      });
    } else {
      console.log('📊 ไม่พบโอกาสลงทุนที่โดดเด่น');
    }
    
    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log(`\n📋 สรุปการทดสอบ`);
    console.log('='.repeat(50));
    console.log(`⏱️  เวลารวม: ${totalDuration} วินาที`);
    console.log(`🚨 หุ้นเสี่ยงสูง: ${riskAnalysis.length}/${testStocks.length}`);
    console.log(`🔥 โอกาสลงทุน: ${opportunityAnalysis.length}/${testStocks.length}`);
    console.log(`✅ การทดสอบระบบครบชุดสำเร็จ!`);
    
    return true;
    
  } catch (error) {
    console.error('❌ การทดสอบล้มเหลว:', error.message);
    console.error('Stack:', error.stack);
    return false;
  }
}

// รันการทดสอบ
if (require.main === module) {
  testComprehensiveAnalysis()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { testComprehensiveAnalysis };