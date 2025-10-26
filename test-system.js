require('dotenv').config();
const GoogleDriveService = require('./services/googleDriveService');
const NewsAnalysisService = require('./services/newsAnalysisService');

async function testStockSystem() {
  console.log('🚀 Testing AOM Stock Notification System...\n');
  
  try {
    // Test Google Drive service
    console.log('📂 Testing Google Drive service...');
    const googleDrive = new GoogleDriveService();
    
    const stocks = await googleDrive.getStockList();
    console.log(`✅ Successfully loaded ${stocks.length} stocks from Google Drive`);
    
    // Display stock information
    console.log('\n📊 Stock Portfolio:');
    console.log('='.repeat(60));
    stocks.forEach((stock, index) => {
      console.log(`${index + 1}. ${stock.type} | ${stock.symbol} | ${stock.amount} ${stock.unit}`);
    });
    console.log('='.repeat(60));
    
    // Test news analysis (without API key)
    console.log('\n📰 Testing news analysis (simulation)...');
    const newsAnalysis = new NewsAnalysisService();
    
    // Simulate risk analysis for first stock
    if (stocks.length > 0) {
      const testStock = stocks[0];
      console.log(`\n🔍 Analyzing ${testStock.symbol} for risks...`);
      
      // Simulate news data
      const mockNews = [
        {
          title: `${testStock.symbol} shows strong performance`,
          description: 'Market analysis indicates positive trends',
          source: 'Test Source',
          url: 'https://example.com/news'
        }
      ];
      
      console.log('📝 Mock analysis results:');
      console.log('- Risk Level: LOW');
      console.log('- Confidence: 0.75');
      console.log('- Recommendation: Continue monitoring');
      
      // Example LINE notification format
      console.log('\n📱 Example LINE notification format:');
      console.log('─'.repeat(50));
      console.log(`🔥 [โอกาสขึ้น] ${testStock.symbol}

📰 ข่าว: "${mockNews[0].title}"

📝 สรุป: ${mockNews[0].description}

📊 คะแนนความน่าเชื่อถือ: 0.85

📈 แนวโน้ม: 🔺 หุ้นมีโอกาสขึ้น

🔗 แหล่งข่าว: ${mockNews[0].source}
ลิงก์: ${mockNews[0].url}

⏰ เวลา: ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}`);
      console.log('─'.repeat(50));
    }
    
    // Show cron schedule example
    console.log('\n⏰ Scheduled tasks (example):');
    console.log('- Risk check: Every hour (0 * * * *)');
    console.log('- Opportunity check: Daily at 6:10 AM (10 6 * * *)');
    console.log('- Health check: Daily at 8:00 AM (0 8 * * *)');
    
    console.log('\n✅ All tests completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Get OpenAI API key from https://platform.openai.com/api-keys');
    console.log('2. Get LINE Notify token from https://notify-bot.line.me/my/');
    console.log('3. Update .env file with your API keys');
    console.log('4. Run: yarn start --risk (for risk check)');
    console.log('5. Run: yarn start --opportunity (for opportunity check)');
    console.log('6. Set up cronjob for automated monitoring');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testStockSystem();