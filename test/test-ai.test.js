require('dotenv').config();
const AIAnalysisService = require('../services/aiAnalysisService');

async function testAI() {
    console.log('🧪 กำลังทดสอบ AI Analysis Service...');
    
    try {
        const config = {
            openaiApiKey: process.env.OPENAI_API_KEY,
            openaiModel: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
            geminiApiKey: process.env.GEMINI_API_KEY,
            geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash'
        };
        
        const aiService = new AIAnalysisService(config);
        
        // Test data
        const testStockData = `หุ้น VOO 0.00394415 24.35 USD
หุ้น NVDA 0.0830829 15.21 USD
สกุลเงินคริปโต BTC 0.00005653 btc 213.42 บาท
ทอง ทอง 1 บาท 2 หมื่นบาท`;

        console.log('🤖 กำลังทดสอบการวิเคราะห์...');
        const analysis = await aiService.generateAnalysis(testStockData, 100);
        
        console.log('✅ การวิเคราะห์สำเร็จ!');
        console.log(`📊 โมเดล: ${analysis.provider}/${analysis.model}`);
        console.log(`🔢 Token: ${analysis.usage.totalTokens} (Input: ${analysis.usage.inputTokens}, Output: ${analysis.usage.outputTokens})`);
        console.log('\n📝 ผลการวิเคราะห์:');
        console.log('='.repeat(80));
        console.log(analysis.content.substring(0, 1000) + '...');
        console.log('='.repeat(80));
        
        // Test cost summary
        console.log('\n💰 กำลังทดสอบสรุปค่าใช้จ่าย...');
        const costSummary = await aiService.generateCostSummary();
        console.log(costSummary);
        
    } catch (error) {
        console.error('❌ การทดสอบ AI ล้มเหลว:', error.message);
        process.exit(1);
    }
}

testAI();