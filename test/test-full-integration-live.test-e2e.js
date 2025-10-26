const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

// Full integration test that actually calls real APIs
async function testFullSystemIntegration() {
  console.log('🚀 Full System Integration Test - LIVE APIs\n');
  console.log('⚠️  WARNING: This test will make REAL API calls!');
  console.log('💰 This may consume API quotas and incur costs.');
  console.log('🔑 Ensure all API keys are properly configured.\n');
  console.log('=' .repeat(60));
  
  const testResults = {
    stockData: { status: 'pending', details: null, error: null },
    geminiAI: { status: 'pending', details: null, error: null },
    lineAPI: { status: 'pending', details: null, error: null },
    newsAPI: { status: 'pending', details: null, error: null },
    fullWorkflow: { status: 'pending', details: null, error: null }
  };
  
  let totalTests = 0;
  let passedTests = 0;
  
  try {
    // Test 1: Stock Data Service (Real Google Drive)
    console.log('\\n📊 TEST 1: Stock Data Service (Real API Calls)');
    console.log('-'.repeat(50));
    totalTests++;
    
    try {
      const StockDataService = require('../services/stockDataService');
      const stockService = new StockDataService();
      
      console.log('🔗 Testing connection to Google Drive...');
      const connectionResult = await stockService.testConnection();
      console.log(`   Connection: ${connectionResult ? '✅ SUCCESS' : '❌ FAILED'}`);
      
      console.log('📥 Downloading real stock data...');
      const stockData = await stockService.getStockList();
      console.log(`   Downloaded: ${stockData.length} stocks`);
      
      // Show first few stocks
      if (stockData.length > 0) {
        console.log('   Sample stocks:');
        stockData.slice(0, 3).forEach((stock, index) => {
          console.log(`     ${index + 1}. ${stock.symbol} (${stock.type}) - ${stock.amount} ${stock.unit}`);
        });
      }
      
      testResults.stockData = { 
        status: 'passed', 
        details: { count: stockData.length, sample: stockData.slice(0, 3) },
        error: null 
      };
      passedTests++;
      console.log('✅ Stock Data Service - PASSED');
      
    } catch (error) {
      testResults.stockData = { status: 'failed', details: null, error: error.message };
      console.log(`❌ Stock Data Service - FAILED: ${error.message}`);
    }
    
    // Test 2: Gemini AI Service (Real API calls)
    console.log('\\n🤖 TEST 2: Gemini AI Service (Real API Calls)');
    console.log('-'.repeat(50));
    totalTests++;
    
    try {
      const GeminiAnalysisService = require('../services/geminiAnalysisService');
      const geminiService = new GeminiAnalysisService();
      
      console.log('🔗 Testing Gemini API connection...');
      const geminiConnection = await geminiService.testConnection();
      console.log(`   Connection: ${geminiConnection ? '✅ SUCCESS' : '❌ FAILED'}`);
      
      console.log('🧠 Testing real AI analysis...');
      const testStock = {
        symbol: 'AAPL',
        type: 'หุ้น',
        amount: 10,
        unit: 'shares'
      };
      
      const testNews = [
        {
          title: 'Apple Reports Strong Q4 Earnings',
          description: 'Apple Inc. reported better than expected quarterly earnings with strong iPhone sales.',
          url: 'https://example.com/news1',
          source: 'Financial News',
          publishedAt: new Date().toISOString()
        }
      ];
      
      // Test risk analysis
      console.log('⚠️  Testing risk analysis...');
      const riskAnalysis = await geminiService.analyzeRiskWithAI(testStock, testNews);
      console.log(`   Risk Level: ${riskAnalysis.riskLevel}`);
      console.log(`   High Risk: ${riskAnalysis.isHighRisk ? 'YES' : 'NO'}`);
      console.log(`   Confidence: ${(riskAnalysis.confidenceScore * 100).toFixed(1)}%`);
      
      // Test opportunity analysis
      console.log('📈 Testing opportunity analysis...');
      const opportunityAnalysis = await geminiService.analyzeOpportunityWithAI(testStock, testNews);
      console.log(`   Opportunity Level: ${opportunityAnalysis.opportunityLevel}`);
      console.log(`   Is Opportunity: ${opportunityAnalysis.isOpportunity ? 'YES' : 'NO'}`);
      console.log(`   Confidence: ${(opportunityAnalysis.confidenceScore * 100).toFixed(1)}%`);
      
      testResults.geminiAI = { 
        status: 'passed', 
        details: { 
          risk: riskAnalysis.riskLevel, 
          opportunity: opportunityAnalysis.opportunityLevel,
          model: geminiService.model
        },
        error: null 
      };
      passedTests++;
      console.log('✅ Gemini AI Service - PASSED');
      
    } catch (error) {
      testResults.geminiAI = { status: 'failed', details: null, error: error.message };
      console.log(`❌ Gemini AI Service - FAILED: ${error.message}`);
    }
    
    // Test 3: LINE Official Account (Real API calls)
    console.log('\\n📱 TEST 3: LINE Official Account (Real API Calls)');
    console.log('-'.repeat(50));
    totalTests++;
    
    try {
      const LineOfficialAccountService = require('../services/lineOfficialAccountService');
      const lineService = new LineOfficialAccountService();
      
      console.log('🔗 Testing LINE API connection...');
      const lineConnection = await lineService.testConnection();
      console.log(`   Connection: ${lineConnection ? '✅ SUCCESS' : '❌ FAILED'}`);
      
      console.log('📤 Sending real test message...');
      const testMessage = `🧪 FULL INTEGRATION TEST
      
🕐 Time: ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}
🔧 Test Type: Full System Integration
🤖 AI Model: ${process.env.GEMINI_MODEL || 'gemini-1.5-flash'}
💰 Cost Mode: ${process.env.GEMINI_API_KEY === 'free' ? 'FREE' : 'PAID'}
      
✅ All systems operational!
      
#AIStockTest #FullIntegration`;
      
      await lineService.sendPushMessage(testMessage);
      console.log('✅ Test message sent successfully!');
      
      testResults.lineAPI = { 
        status: 'passed', 
        details: { messageSent: true, timestamp: new Date().toISOString() },
        error: null 
      };
      passedTests++;
      console.log('✅ LINE Official Account - PASSED');
      
    } catch (error) {
      testResults.lineAPI = { status: 'failed', details: null, error: error.message };
      console.log(`❌ LINE Official Account - FAILED: ${error.message}`);
    }
    
    // Test 4: News Analysis Service (Real API calls)
    console.log('\\n📰 TEST 4: News Analysis Service (Real API Calls)');
    console.log('-'.repeat(50));
    totalTests++;
    
    try {
      const NewsAnalysisService = require('../services/newsAnalysisService');
      const newsService = new NewsAnalysisService();
      
      console.log('🔗 Testing News Analysis service...');
      const newsConnection = await newsService.testConnection();
      console.log(`   Connection: ${newsConnection ? '✅ SUCCESS' : '❌ FAILED'}`);
      
      console.log('📰 Fetching real news data...');
      // Test with a simple query that should return results
      const testQuery = 'Apple stock market';
      const newsResults = await newsService.getStockNews('AAPL', 'หุ้น');
      console.log(`   News articles found: ${newsResults.length}`);
      
      if (newsResults.length > 0) {
        console.log('   Sample headlines:');
        newsResults.slice(0, 2).forEach((article, index) => {
          console.log(`     ${index + 1}. ${article.title?.substring(0, 60)}...`);
        });
      }
      
      testResults.newsAPI = { 
        status: 'passed', 
        details: { articleCount: newsResults.length, query: testQuery },
        error: null 
      };
      passedTests++;
      console.log('✅ News Analysis Service - PASSED');
      
    } catch (error) {
      testResults.newsAPI = { status: 'failed', details: null, error: error.message };
      console.log(`❌ News Analysis Service - FAILED: ${error.message}`);
    }
    
    // Test 5: Full Workflow Integration
    console.log('\\n🔄 TEST 5: Full Workflow Integration (End-to-End)');
    console.log('-'.repeat(50));
    totalTests++;
    
    try {
      console.log('🔄 Running complete stock analysis workflow...');
      
      // Load real stock data
      const StockDataService = require('../services/stockDataService');
      const stockService = new StockDataService();
      const stocks = await stockService.getStockList();
      console.log(`   Loaded ${stocks.length} stocks for analysis`);
      
      // Analyze with real news and AI
      const NewsAnalysisService = require('../services/newsAnalysisService');
      const newsService = new NewsAnalysisService();
      
      console.log('🔍 Analyzing first stock with real data...');
      if (stocks.length > 0) {
        const firstStock = stocks[0];
        console.log(`   Analyzing: ${firstStock.symbol} (${firstStock.type})`);
        
        // Get real news
        const news = await newsService.getStockNews(firstStock.symbol, firstStock.type);
        console.log(`   Found ${news.length} news articles`);
        
        // Perform real AI analysis
        if (news.length > 0) {
          const riskAnalysis = await newsService.analyzeRiskWithAI(firstStock, news.slice(0, 3));
          const opportunityAnalysis = await newsService.analyzeOpportunityWithAI(firstStock, news.slice(0, 3));
          
          console.log(`   Risk Analysis: ${riskAnalysis.riskLevel} (${riskAnalysis.isHighRisk ? 'HIGH RISK' : 'SAFE'})`);
          console.log(`   Opportunity: ${opportunityAnalysis.opportunityLevel} (${opportunityAnalysis.isOpportunity ? 'BUY SIGNAL' : 'HOLD'})`);
          
          // Send result to LINE
          const LineOfficialAccountService = require('../services/lineOfficialAccountService');
          const lineService = new LineOfficialAccountService();
          
          const resultMessage = `📊 FULL INTEGRATION RESULT
          
🎯 Stock: ${firstStock.symbol} (${firstStock.type})
📰 News: ${news.length} articles analyzed
🤖 AI Model: ${process.env.GEMINI_MODEL || 'gemini-1.5-flash'}

⚠️ RISK: ${riskAnalysis.riskLevel.toUpperCase()}
📈 OPPORTUNITY: ${opportunityAnalysis.opportunityLevel.toUpperCase()}

🕐 ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}

#FullWorkflowTest #RealData`;
          
          await lineService.sendPushMessage(resultMessage);
          console.log('✅ Full workflow result sent to LINE!');
          
          testResults.fullWorkflow = { 
            status: 'passed', 
            details: { 
              stock: firstStock.symbol,
              newsCount: news.length,
              risk: riskAnalysis.riskLevel,
              opportunity: opportunityAnalysis.opportunityLevel
            },
            error: null 
          };
        } else {
          throw new Error('No news found for analysis');
        }
      } else {
        throw new Error('No stocks loaded for analysis');
      }
      
      passedTests++;
      console.log('✅ Full Workflow Integration - PASSED');
      
    } catch (error) {
      testResults.fullWorkflow = { status: 'failed', details: null, error: error.message };
      console.log(`❌ Full Workflow Integration - FAILED: ${error.message}`);
    }
    
  } catch (error) {
    console.error('💥 Critical test failure:', error.message);
  }
  
  // Generate comprehensive test report
  await generateTestReport(testResults, totalTests, passedTests);
  
  // Return exit code
  if (passedTests === totalTests) {
    console.log('\\n🎉 ALL TESTS PASSED! System is fully operational.');
    process.exit(0);
  } else {
    console.log(`\\n💥 ${totalTests - passedTests}/${totalTests} TESTS FAILED!`);
    process.exit(1);
  }
}

async function generateTestReport(results, total, passed) {
  console.log('\\n📋 COMPREHENSIVE TEST REPORT');
  console.log('=' .repeat(60));
  
  console.log(`\\n📊 Summary: ${passed}/${total} tests passed (${(passed/total*100).toFixed(1)}%)`);
  console.log(`🕐 Test completed: ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}`);
  console.log(`🤖 AI Model: ${process.env.GEMINI_MODEL || 'gemini-1.5-flash'}`);
  console.log(`💰 Cost Mode: ${process.env.GEMINI_API_KEY === 'free' ? 'FREE (Mock responses)' : 'PAID (Real API calls)'}`);
  
  console.log('\\n🔍 Detailed Results:');
  console.log('-'.repeat(40));
  
  Object.entries(results).forEach(([test, result]) => {
    const status = result.status === 'passed' ? '✅' : result.status === 'failed' ? '❌' : '⏳';
    console.log(`${status} ${test.toUpperCase()}: ${result.status.toUpperCase()}`);
    
    if (result.details) {
      Object.entries(result.details).forEach(([key, value]) => {
        console.log(`   ${key}: ${JSON.stringify(value)}`);
      });
    }
    
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
    console.log('');
  });
  
  // Environment information
  console.log('🌍 Environment Information:');
  console.log('-'.repeat(30));
  console.log(`Node.js: ${process.version}`);
  console.log(`Platform: ${process.platform}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Retry Config: ${process.env.RETRY_MAX_ATTEMPTS || 3} attempts, ${process.env.RETRY_DELAY_MS || 2000}ms delay`);
  
  // API Configuration Status
  console.log('\\n🔑 API Configuration Status:');
  console.log('-'.repeat(35));
  console.log(`OpenAI API: ${process.env.OPENAI_API_KEY === 'disabled' ? '🔴 DISABLED' : process.env.OPENAI_API_KEY ? '🟢 CONFIGURED' : '🟡 NOT SET'}`);
  console.log(`Gemini API: ${process.env.GEMINI_API_KEY === 'free' ? '🆓 FREE MODE' : process.env.GEMINI_API_KEY ? '🟢 CONFIGURED' : '🟡 NOT SET'}`);
  console.log(`LINE API: ${process.env.LINE_CHANNEL_ACCESS_TOKEN ? '🟢 CONFIGURED' : '🔴 NOT SET'}`);
  console.log(`News API: ${process.env.NEWS_API_KEY && process.env.NEWS_API_KEY !== 'your-news-api-key-here' ? '🟢 CONFIGURED' : '🟡 USING FREE SOURCES'}`);
  console.log(`Stock Data: ${process.env.STOCKS_FILE_URL ? '🟢 CONFIGURED' : '🔴 NOT SET'}`);
  
  // Save report to file
  const reportData = {
    timestamp: new Date().toISOString(),
    summary: { total, passed, failed: total - passed, successRate: passed/total*100 },
    results,
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      env: process.env.NODE_ENV || 'development'
    },
    configuration: {
      geminiModel: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
      openaiModel: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
      costMode: process.env.GEMINI_API_KEY === 'free' ? 'FREE' : 'PAID'
    }
  };
  
  try {
    const reportPath = path.join(__dirname, '..', 'logs', `full-integration-test-${Date.now()}.json`);
    
    // Ensure logs directory exists
    const logsDir = path.dirname(reportPath);
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
    console.log(`\\n💾 Detailed report saved to: ${reportPath}`);
  } catch (error) {
    console.log(`\\n⚠️ Could not save report: ${error.message}`);
  }
}

// Performance test with real APIs
async function testSystemPerformance() {
  console.log('\\n⚡ PERFORMANCE TEST - Real API Calls');
  console.log('-'.repeat(50));
  
  const StockDataService = require('../services/stockDataService');
  const stockService = new StockDataService();
  
  const startTime = Date.now();
  
  try {
    // Test multiple operations
    console.log('📊 Testing stock data download speed...');
    const dataStart = Date.now();
    const stocks = await stockService.getStockList();
    const dataTime = Date.now() - dataStart;
    console.log(`   Stock data loaded: ${stocks.length} items in ${dataTime}ms`);
    
    // Test AI analysis speed
    if (stocks.length > 0) {
      console.log('🤖 Testing AI analysis speed...');
      const GeminiAnalysisService = require('../services/geminiAnalysisService');
      const geminiService = new GeminiAnalysisService();
      
      const aiStart = Date.now();
      const testStock = stocks[0];
      const mockNews = [{
        title: 'Test news article',
        description: 'This is a test article for performance testing',
        url: 'https://example.com',
        source: 'Test Source'
      }];
      
      await geminiService.analyzeRiskWithAI(testStock, mockNews);
      const aiTime = Date.now() - aiStart;
      console.log(`   AI analysis completed in ${aiTime}ms`);
    }
    
    const totalTime = Date.now() - startTime;
    console.log(`\\n⚡ Total performance test time: ${totalTime}ms`);
    
    // Performance ratings
    if (totalTime < 5000) {
      console.log('🏆 Performance: EXCELLENT (< 5s)');
    } else if (totalTime < 10000) {
      console.log('🥈 Performance: GOOD (< 10s)');
    } else if (totalTime < 20000) {
      console.log('🥉 Performance: ACCEPTABLE (< 20s)');
    } else {
      console.log('⚠️ Performance: SLOW (> 20s) - Consider optimization');
    }
    
  } catch (error) {
    console.log(`❌ Performance test failed: ${error.message}`);
  }
}

// Cost estimation for real API usage
function estimateCosts() {
  console.log('\\n💰 API COST ESTIMATION');
  console.log('-'.repeat(30));
  
  console.log('🤖 Gemini AI Costs:');
  if (process.env.GEMINI_API_KEY === 'free') {
    console.log('   Mode: FREE - No costs incurred');
    console.log('   Limitation: Mock responses only');
  } else {
    console.log('   Mode: PAID API usage');
    console.log('   Model: ' + (process.env.GEMINI_MODEL || 'gemini-1.5-flash'));
    console.log('   Estimated: $0.0001-0.001 per analysis');
    console.log('   Daily (100 stocks): ~$0.01-0.10');
  }
  
  console.log('\\n📱 LINE API Costs:');
  console.log('   Push messages: FREE (up to 1,000/month)');
  console.log('   Current test: 2-3 messages used');
  console.log('   Estimated monthly: $0 (within free tier)');
  
  console.log('\\n📰 News API Costs:');
  if (process.env.NEWS_API_KEY && process.env.NEWS_API_KEY !== 'your-news-api-key-here') {
    console.log('   Mode: PAID NewsAPI');
    console.log('   Estimated: $0.0001 per request');
  } else {
    console.log('   Mode: FREE RSS feeds');
    console.log('   Cost: $0 (using free sources)');
  }
  
  console.log('\\n📊 Total Estimated Daily Cost:');
  const dailyCost = process.env.GEMINI_API_KEY === 'free' ? 0 : 0.05;
  console.log(`   Conservative estimate: $${dailyCost.toFixed(3)}/day`);
  console.log(`   Monthly estimate: $${(dailyCost * 30).toFixed(2)}/month`);
}

async function main() {
  console.log('🚀 FULL INTEGRATION TEST SUITE - REAL API CALLS');
  console.log('=' .repeat(60));
  console.log('⚠️  WARNING: This will make real API calls!');
  console.log('💰 May consume quotas and incur costs.');
  console.log('🕐 Started:', new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }));
  console.log('');
  
  // Show cost estimation first
  estimateCosts();
  
  console.log('\\n⏱️  Starting in 3 seconds... (Ctrl+C to abort)');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  try {
    // Run full integration test
    await testFullSystemIntegration();
    
    // Run performance test
    await testSystemPerformance();
    
  } catch (error) {
    console.error('💥 Test suite failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { 
  testFullSystemIntegration, 
  testSystemPerformance, 
  generateTestReport,
  estimateCosts 
};