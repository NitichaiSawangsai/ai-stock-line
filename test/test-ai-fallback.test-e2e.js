require('dotenv').config();
const NewsAnalysisService = require('./../services/newsAnalysisService');
const GeminiAnalysisService = require('./../services/geminiAnalysisService');

async function testAIFallbackSystem() {
  console.log('🧪 ทดสอบระบบ AI Fallback (ChatGPT + Gemini)...\n');
  
  try {
    // ทดสอบ NewsAnalysisService ที่มี fallback
    console.log('📊 ทดสอบ NewsAnalysisService...');
    const newsService = new NewsAnalysisService();
    
    // ทดสอบการเชื่อมต่อ
    console.log('🔗 ทดสอบการเชื่อมต่อ AI services...');
    try {
      await newsService.testConnection();
      console.log('✅ AI service connection successful');
    } catch (error) {
      console.log(`❌ AI service connection failed: ${error.message}`);
    }
    
    // สร้างข้อมูลทดสอบ
    const mockStock = {
      symbol: 'TEST',
      type: 'หุ้น',
      amount: 100,
      unit: 'shares'
    };
    
    const mockNews = [
      {
        title: 'Test Company reports strong earnings',
        description: 'The company exceeded expectations in Q3 results',
        source: 'Test News',
        url: 'https://example.com/news1'
      },
      {
        title: 'New partnership announcement',
        description: 'Strategic alliance with major technology firm',
        source: 'Tech Today',
        url: 'https://example.com/news2'
      }
    ];
    
    // ทดสอบการวิเคราะห์ความเสี่ยง
    console.log('\n🚨 ทดสอบการวิเคราะห์ความเสี่ยง...');
    try {
      const riskAnalysis = await newsService.analyzeRiskWithAI(mockStock, mockNews);
      
      console.log('📋 ผลการวิเคราะห์ความเสี่ยง:');
      console.log(`   - ความเสี่ยงสูง: ${riskAnalysis.isHighRisk ? 'ใช่' : 'ไม่'}`);
      console.log(`   - ระดับความเสี่ยง: ${riskAnalysis.riskLevel}`);
      console.log(`   - สรุป: ${riskAnalysis.summary}`);
      console.log(`   - คะแนนความเชื่อมั่น: ${riskAnalysis.confidenceScore}`);
      console.log(`   - คำแนะนำ: ${riskAnalysis.recommendation}`);
      
    } catch (error) {
      console.error(`❌ Risk analysis failed: ${error.message}`);
    }
    
    // รอสักครู่
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // ทดสอบการวิเคราะห์โอกาส
    console.log('\n🔥 ทดสอบการวิเคราะห์โอกาส...');
    try {
      const opportunityAnalysis = await newsService.analyzeOpportunityWithAI(mockStock, mockNews);
      
      console.log('📋 ผลการวิเคราะห์โอกาส:');
      console.log(`   - มีโอกาส: ${opportunityAnalysis.isOpportunity ? 'ใช่' : 'ไม่'}`);
      console.log(`   - ระดับโอกาส: ${opportunityAnalysis.opportunityLevel}`);
      console.log(`   - สรุป: ${opportunityAnalysis.summary}`);
      console.log(`   - คะแนนความเชื่อมั่น: ${opportunityAnalysis.confidenceScore}`);
      console.log(`   - ระยะเวลา: ${opportunityAnalysis.timeframe}`);
      
    } catch (error) {
      console.error(`❌ Opportunity analysis failed: ${error.message}`);
    }
    
    // ทดสอบ Gemini โดยตรง
    console.log('\n🤖 ทดสอบ Gemini AI โดยตรง...');
    const geminiService = new GeminiAnalysisService();
    
    try {
      await geminiService.testConnection();
      console.log('✅ Gemini direct connection successful');
      
      const geminiRisk = await geminiService.analyzeRiskWithAI(mockStock, mockNews);
      console.log('📋 Gemini risk analysis result:');
      console.log(`   - Risk Level: ${geminiRisk.riskLevel}`);
      console.log(`   - Summary: ${geminiRisk.summary}`);
      
    } catch (error) {
      console.log(`⚠️ Gemini direct test: ${error.message}`);
    }
    
    // แสดงสถานะการใช้ fallback
    console.log('\n📊 สถานะระบบ:');
    console.log(`   - ใช้ Fallback: ${newsService.usingFallback ? 'ใช่' : 'ไม่'}`);
    console.log(`   - Primary AI: ${newsService.usingFallback ? 'Gemini' : 'ChatGPT'}`);
    
    console.log('\n✅ การทดสอบระบบ Fallback เสร็จสิ้น!');
    console.log('\n💡 หมายเหตุ:');
    console.log('   - ถ้า ChatGPT ใช้งานไม่ได้ ระบบจะสลับไปใช้ Gemini อัตโนมัติ');
    console.log('   - Gemini สามารถใช้งานแบบฟรีได้โดยไม่ต้องมี API key');
    console.log('   - ระบบจะแจ้งเตือนเมื่อมีการสลับ AI service');
    
  } catch (error) {
    console.error('❌ การทดสอบระบบ Fallback ล้มเหลว:', error.message);
    console.error('Stack:', error.stack);
  }
}

// เรียกใช้ฟังก์ชันทดสอบ
testAIFallbackSystem();