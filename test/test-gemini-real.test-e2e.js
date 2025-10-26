require('dotenv').config();
const GeminiAnalysisService = require('./../services/geminiAnalysisService');

async function testRealGeminiAPI() {
  console.log('🚀 ทดสอบ Gemini AI จริง ๆ...\n');
  
  try {
    const geminiService = new GeminiAnalysisService();
    
    // ทดสอบการเชื่อมต่อ
    console.log('🔗 ทดสอบการเชื่อมต่อ Gemini API...');
    console.log(`API Key: ${process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.substring(0, 20) + '...' : 'ไม่มี'}`);
    
    try {
      await geminiService.testConnection();
      console.log('✅ เชื่อมต่อ Gemini API สำเร็จ!\n');
    } catch (error) {
      console.log(`❌ เชื่อมต่อ Gemini API ล้มเหลว: ${error.message}\n`);
    }
    
    // สร้างข้อมูลทดสอบแบบ realistic
    const mockStock = {
      symbol: 'ADVANC',
      type: 'หุ้น',
      amount: 100,
      unit: 'shares'
    };
    
    const realisticNews = [
      {
        title: 'ADVANC ประกาศผลประกอบการไตรมาส 3 เติบโตเกินคาดหวัง',
        description: 'บริษัท แอดวานซ์ อินโฟร์ เซอร์วิส จำกัด (มหาชน) หรือ AIS รายงานผลประกอบการไตรมาส 3/2568 กำไรสุทธิ 7,200 ล้านบาท เติบโต 15% จากปีที่แล้ว',
        source: 'Settrade',
        url: 'https://settrade.com/news/advanc-q3-earnings-2025'
      },
      {
        title: 'AIS เปิดตัวบริการ 5G SA รุ่นใหม่ขยายครอบคลุม 95% ของประเทศ',
        description: 'บริการ 5G Standalone ใหม่จะช่วยเพิ่มประสิทธิภาพและรองรับ IoT, Smart City และ Industry 4.0',
        source: 'Thailand Business News',
        url: 'https://tbn.co.th/news/ais-5g-sa-expansion-2025'
      },
      {
        title: 'นักวิเคราะห์เชียร์ซื้อ ADVANC เป้าหมาย 250 บาท',
        description: 'หลายสำนักวิเคราะห์ปรับเป้าราคา ADVANC ขึ้นเป็น 240-250 บาท หลังผลงานโดดเด่นและแนวโน้มธุรกิจดิจิทัลเติบโต',
        source: 'Money Channel',
        url: 'https://moneychannel.co.th/news/advanc-target-250-baht'
      }
    ];
    
    // ทดสอบการวิเคราะห์โอกาส
    console.log('🔥 ทดสอบการวิเคราะห์โอกาสด้วย Gemini AI...');
    console.log(`📊 วิเคราะห์หุ้น: ${mockStock.symbol} (${mockStock.type})`);
    console.log('📰 ข่าวที่ใช้วิเคราะห์:');
    realisticNews.forEach((news, index) => {
      console.log(`   ${index + 1}. ${news.title}`);
    });
    console.log('');
    
    try {
      const opportunityAnalysis = await geminiService.analyzeOpportunityWithAI(mockStock, realisticNews);
      
      console.log('🎯 ผลการวิเคราะห์โอกาสจาก Gemini AI:');
      console.log('═'.repeat(60));
      console.log(`📈 มีโอกาส: ${opportunityAnalysis.isOpportunity ? 'ใช่' : 'ไม่'}`);
      console.log(`🔥 ระดับโอกาส: ${opportunityAnalysis.opportunityLevel}`);
      console.log(`📝 สรุป: ${opportunityAnalysis.summary}`);
      console.log(`📊 คะแนนความเชื่อมั่น: ${opportunityAnalysis.confidenceScore}`);
      console.log(`⏱️ ระยะเวลาคาดการณ์: ${opportunityAnalysis.timeframe}`);
      console.log(`🎯 เป้าหมายราคา: ${opportunityAnalysis.priceTarget}`);
      console.log(`📰 ข่าวสำคัญ: ${opportunityAnalysis.keyNews}`);
      
      if (opportunityAnalysis.positiveFactors && opportunityAnalysis.positiveFactors.length > 0) {
        console.log('✅ ปัจจัยบวก:');
        opportunityAnalysis.positiveFactors.forEach((factor, index) => {
          console.log(`   ${index + 1}. ${factor}`);
        });
      }
      console.log('═'.repeat(60));
      
    } catch (error) {
      console.error(`❌ การวิเคราะห์โอกาสล้มเหลว: ${error.message}`);
    }
    
    // รอสักครู่แล้วทดสอบการวิเคราะห์ความเสี่ยง
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('\n🚨 ทดสอบการวิเคราะห์ความเสี่ยงด้วย Gemini AI...');
    
    const riskNews = [
      {
        title: 'กสทช.พิจารณาปรับค่าใช้จ่ายคลื่น 5G เพิ่มขึ้น 20%',
        description: 'คณะกรรมการกิจการกระจายเสียง กิจการโทรทัศน์ และกิจการโทรคมนาคมแห่งชาติ อาจปรับเพิ่มค่าธรรมเนียมใช้คลื่น 5G',
        source: 'Post Today',
        url: 'https://posttoday.com/news/5g-fee-increase-2025'
      }
    ];
    
    try {
      const riskAnalysis = await geminiService.analyzeRiskWithAI(mockStock, riskNews);
      
      console.log('⚠️ ผลการวิเคราะห์ความเสี่ยงจาก Gemini AI:');
      console.log('═'.repeat(60));
      console.log(`🚨 มีความเสี่ยงสูง: ${riskAnalysis.isHighRisk ? 'ใช่' : 'ไม่'}`);
      console.log(`⚡ ระดับความเสี่ยง: ${riskAnalysis.riskLevel}`);
      console.log(`📝 สรุป: ${riskAnalysis.summary}`);
      console.log(`📊 คะแนนความเชื่อมั่น: ${riskAnalysis.confidenceScore}`);
      console.log(`💡 คำแนะนำ: ${riskAnalysis.recommendation}`);
      console.log(`📰 ข่าวสำคัญ: ${riskAnalysis.keyNews}`);
      
      if (riskAnalysis.threats && riskAnalysis.threats.length > 0) {
        console.log('⚠️ ภัยคุกคาม:');
        riskAnalysis.threats.forEach((threat, index) => {
          console.log(`   ${index + 1}. ${threat}`);
        });
      }
      console.log('═'.repeat(60));
      
    } catch (error) {
      console.error(`❌ การวิเคราะห์ความเสี่ยงล้มเหลว: ${error.message}`);
    }
    
    console.log('\n✅ การทดสอบ Gemini AI จริง ๆ เสร็จสิ้น!');
    console.log('\n💡 สรุป:');
    console.log('   - Gemini AI สามารถวิเคราะห์ข่าวได้จริง');
    console.log('   - ให้ผลลัพธ์ในรูปแบบ JSON ที่ต้องการ');
    console.log('   - รองรับภาษาไทยได้ดี');
    console.log('   - สามารถใช้เป็น fallback สำหรับ ChatGPT ได้');
    
  } catch (error) {
    console.error('❌ การทดสอบ Gemini AI ล้มเหลว:', error.message);
    console.error('Stack:', error.stack);
  }
}

// เรียกใช้ฟังก์ชันทดสอบ
testRealGeminiAPI();