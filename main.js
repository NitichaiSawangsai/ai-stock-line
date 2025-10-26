require('dotenv').config();
const cron = require('node-cron');
const moment = require('moment-timezone');
const winston = require('winston');
const StockDataService = require('./services/stockDataService');
const NewsAnalysisService = require('./services/newsAnalysisService');
const LineOfficialAccountService = require('./services/lineOfficialAccountService');
const SchedulerService = require('./services/schedulerService');

// Configure logger
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
    new winston.transports.File({ filename: 'logs/app.log' })
  ]
});

class StockNotificationApp {
  constructor() {
    this.isRunning = false;
    this.startTime = null;
    this.timeout = 20 * 60 * 1000; // 20 minutes timeout
    this.stockData = new StockDataService();
    this.newsAnalysis = new NewsAnalysisService();
    this.lineNotification = new LineOfficialAccountService();
    this.scheduler = new SchedulerService();
  }

  async start() {
    const timeoutId = setTimeout(() => {
      logger.error('⏰ Process timeout reached (20 minutes), forcing exit...');
      process.exit(1);
    }, this.timeout);

    try {
      this.startTime = Date.now();
      this.isRunning = true;
      
      logger.info('🚀 Stock Notification System Starting...');
      
      // Check if this is a scheduled run or manual run
      const args = process.argv.slice(2);
      const runType = args.includes('--risk') ? 'risk' : 
                     args.includes('--opportunity') ? 'opportunity' : 
                     args.includes('--dev') ? 'dev' : 'full';

      switch (runType) {
        case 'risk':
          await this.checkHighRiskStocks();
          break;
        case 'opportunity':
          await this.checkStockOpportunities();
          break;
        case 'dev':
          await this.runDevelopmentMode();
          break;
        default:
          await this.runFullCheck();
      }

      clearTimeout(timeoutId);
      this.gracefulExit(0);
      
    } catch (error) {
      clearTimeout(timeoutId);
      logger.error(`❌ Application error: ${error.message}`);
      
      // Try to send error notification but don't wait if it fails
      try {
        await Promise.race([
          this.lineNotification.sendErrorNotification(error),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Notification timeout')), 5000))
        ]);
      } catch (notifyError) {
        logger.warn(`⚠️ Failed to send error notification: ${notifyError.message}`);
      }
      
      this.forceExit(1);
    }
  }

  async runFullCheck() {
    logger.info('🔍 Running full stock analysis...');
    
    try {
      // Load stock list from Stock Data Service
      logger.info('📂 Loading stock list...');
      const stocks = await this.stockData.getStockList();
      
      if (!stocks || stocks.length === 0) {
        logger.warn('⚠️ No stocks found in the list');
        return;
      }

      logger.info(`📊 Found ${stocks.length} stocks to analyze`);

      // Check for high-risk stocks
      logger.info('🚨 Analyzing high-risk stocks...');
      const highRiskStocks = await this.newsAnalysis.analyzeHighRiskStocks(stocks);
      logger.info(`🚨 Found ${highRiskStocks.length} high-risk stocks`);
      
      if (highRiskStocks.length > 0) {
        logger.info('📤 Sending risk alert...');
        await this.lineNotification.sendRiskAlert(highRiskStocks);
        logger.info('✅ Risk alert sent successfully');
      } else {
        logger.info('✅ No high-risk stocks to report');
      }

      // Check for opportunities - ลบเงื่อนไขเวลาออกเพื่อ test
      const currentHour = moment().tz('Asia/Bangkok').hour();
      logger.info(`🕰️ Current hour: ${currentHour} (Bangkok time)`);
      
      logger.info('🔥 Analyzing stock opportunities...');
      const opportunities = await this.newsAnalysis.analyzeStockOpportunities(stocks);
      logger.info(`🔥 Found ${opportunities.length} opportunities`);
      
      if (opportunities.length > 0) {
        logger.info('📤 Sending opportunity alert...');
        await this.lineNotification.sendOpportunityAlert(opportunities);
        logger.info('✅ Opportunity alert sent successfully');
      } else {
        logger.info('✅ No opportunities to report');
      }

    } catch (error) {
      logger.error(`💥 Error in full check: ${error.message}`);
      throw error;
    }
  }

  async checkHighRiskStocks() {
    logger.info('🚨 Checking for high-risk stocks...');
    
    try {
      const stocks = await this.stockData.getStockList();
      const highRiskStocks = await this.newsAnalysis.analyzeHighRiskStocks(stocks);
      
      if (highRiskStocks.length > 0) {
        await this.lineNotification.sendRiskAlert(highRiskStocks);
        logger.info(`🚨 Sent risk alert for ${highRiskStocks.length} stocks`);
      } else {
        logger.info('✅ No high-risk stocks found');
      }
      
    } catch (error) {
      logger.error(`💥 Error checking high-risk stocks: ${error.message}`);
      throw error;
    }
  }

  async checkStockOpportunities() {
    logger.info('🔥 Checking for stock opportunities...');
    
    try {
      const stocks = await this.stockData.getStockList();
      const opportunities = await this.newsAnalysis.analyzeStockOpportunities(stocks);
      
      if (opportunities.length > 0) {
        await this.lineNotification.sendOpportunityAlert(opportunities);
        logger.info(`🔥 Sent opportunity alert for ${opportunities.length} stocks`);
      } else {
        logger.info('✅ No opportunities found');
      }
      
    } catch (error) {
      logger.error(`💥 Error checking opportunities: ${error.message}`);
      throw error;
    }
  }

  async runDevelopmentMode() {
    logger.info('🔧 Running in development mode...');
    
    // Test all services
    await this.testServices();
    
    // Run a quick analysis
    await this.runFullCheck();
  }

  async testServices() {
    logger.info('🧪 Testing all services...');
    
    let hasErrors = false;
    
    // Test Stock Data service with timeout
    try {
      await Promise.race([
        this.stockData.testConnection(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Stock data test timeout')), 10000))
      ]);
      logger.info('✅ Stock data service OK');
    } catch (error) {
      logger.error(`❌ Stock data service failed: ${error.message}`);
      hasErrors = true;
    }
    
    // Test AI Services with detailed status
    await this.testAIServices();
    
    // Test LINE notification with timeout
    try {
      await Promise.race([
        this.lineNotification.testConnection(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('LINE test timeout')), 10000))
      ]);
      logger.info('✅ LINE notification service OK');
    } catch (error) {
      logger.error(`❌ LINE notification service failed: ${error.message}`);
      hasErrors = true;
    }
    
    // Only throw error if critical services failed (not AI in dev mode)
    if (hasErrors) {
      throw new Error('Critical services failed');
    }
  }

  async testAIServices() {
    logger.info('🤖 Testing AI Services...');
    
    // Check AI configuration
    const openaiKey = process.env.OPENAI_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;
    const openaiModel = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
    const geminiModel = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    
    logger.info('📋 AI Configuration:');
    logger.info(`   OpenAI Key: ${openaiKey === 'disabled' ? '🔴 DISABLED' : openaiKey ? '🟢 CONFIGURED' : '🟡 NOT SET'}`);
    logger.info(`   OpenAI Model: ${openaiModel}`);
    logger.info(`   Gemini Key: ${geminiKey === 'free' ? '🆓 FREE MODE' : geminiKey ? '🟢 CONFIGURED' : '🟡 NOT SET'}`);
    logger.info(`   Gemini Model: ${geminiModel}`);
    
    // Test OpenAI/ChatGPT
    if (openaiKey && openaiKey !== 'disabled') {
      try {
        logger.info('🧪 Testing OpenAI ChatGPT connection...');
        const testResult = await Promise.race([
          this.newsAnalysis.testOpenAIConnection(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('OpenAI test timeout')), 15000))
        ]);
        
        if (testResult) {
          logger.info(`✅ OpenAI ChatGPT (${openaiModel}) - CONNECTED`);
        } else {
          logger.warn(`⚠️ OpenAI ChatGPT (${openaiModel}) - CONNECTION FAILED`);
        }
      } catch (error) {
        logger.error(`❌ OpenAI ChatGPT (${openaiModel}) - ERROR: ${error.message}`);
        if (error.message.includes('401')) {
          logger.error('   🔑 Authentication failed - Check API key');
        } else if (error.message.includes('429')) {
          logger.error('   ⏱️ Rate limit exceeded - Wait and try again');
        } else if (error.message.includes('timeout')) {
          logger.error('   ⏰ Connection timeout - Network issue');
        }
      }
    } else {
      logger.warn(`⚠️ OpenAI ChatGPT - DISABLED (Using Gemini fallback)`);
    }
    
    // Test Gemini
    try {
      logger.info('🧪 Testing Google Gemini connection...');
      const GeminiAnalysisService = require('./services/geminiAnalysisService');
      const geminiService = new GeminiAnalysisService();
      
      const testResult = await Promise.race([
        geminiService.testConnection(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Gemini test timeout')), 15000))
      ]);
      
      if (testResult) {
        if (geminiKey === 'free') {
          logger.info(`✅ Google Gemini (${geminiModel}) - FREE MODE (Mock responses)`);
        } else {
          logger.info(`✅ Google Gemini (${geminiModel}) - CONNECTED`);
        }
      } else {
        logger.warn(`⚠️ Google Gemini (${geminiModel}) - CONNECTION FAILED`);
      }
      
      // Test actual AI analysis
      try {
        logger.info('🧠 Testing AI analysis capability...');
        const testStock = { symbol: 'APPLE', type: 'หุ้น', amount: 100, unit: 'หุ้น' };
        const testNews = [{ title: 'Apple quarterly earnings', description: 'Strong financial performance reported' }];
        
        const analysisStart = Date.now();
        const riskResult = await geminiService.analyzeRiskWithAI(testStock, testNews);
        const analysisTime = Date.now() - analysisStart;
        
        logger.info(`✅ AI Analysis test completed in ${analysisTime}ms`);
        logger.info(`   Risk Level: ${riskResult.riskLevel}`);
        logger.info(`   Confidence: ${(riskResult.confidenceScore * 100).toFixed(1)}%`);
        
      } catch (analysisError) {
        logger.error(`❌ AI Analysis test failed: ${analysisError.message}`);
        if (analysisError.message.includes('404')) {
          logger.error('   🚫 Model not found - Check model name');
        } else if (analysisError.message.includes('403')) {
          logger.error('   🔑 Permission denied - Check API key permissions');
        }
      }
      
    } catch (error) {
      logger.error(`❌ Google Gemini (${geminiModel}) - ERROR: ${error.message}`);
      if (error.message.includes('401')) {
        logger.error('   🔑 Authentication failed - Check API key');
      } else if (error.message.includes('429')) {
        logger.error('   ⏱️ Rate limit exceeded - Wait and try again');
      } else if (error.message.includes('timeout')) {
        logger.error('   ⏰ Connection timeout - Network issue');
      }
    }
    
    // Test News Analysis service overall
    try {
      const connectionResult = await Promise.race([
        this.newsAnalysis.testConnection(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('News analysis test timeout')), 10000))
      ]);
      
      if (connectionResult) {
        logger.info('✅ News Analysis service OK (with AI fallback)');
      } else {
        logger.warn('⚠️ News Analysis service degraded (fallback mode)');
      }
    } catch (error) {
      logger.error(`❌ News Analysis service failed: ${error.message}`);
    }
  }

  setupCronJobs() {
    logger.info('⏰ Setting up cron jobs...');
    
    // High-risk check every hour
    cron.schedule('0 * * * *', async () => {
      logger.info('🕐 Running hourly high-risk check...');
      try {
        await this.checkHighRiskStocks();
      } catch (error) {
        logger.error(`❌ Hourly check failed: ${error.message}`);
        await this.lineNotification.sendErrorNotification(error);
      }
    }, {
      timezone: 'Asia/Bangkok'
    });

    // Opportunity check at 6:10 AM Bangkok time
    cron.schedule('10 6 * * *', async () => {
      logger.info('🌅 Running morning opportunity check...');
      try {
        await this.checkStockOpportunities();
      } catch (error) {
        logger.error(`❌ Morning check failed: ${error.message}`);
        await this.lineNotification.sendErrorNotification(error);
      }
    }, {
      timezone: 'Asia/Bangkok'
    });

    logger.info('✅ Cron jobs configured successfully');
  }

  gracefulExit(code = 0) {
    this.isRunning = false;
    const duration = Date.now() - this.startTime;
    logger.info(`🏁 Process completed in ${Math.round(duration / 1000)}s, exiting with code ${code}`);
    process.exit(code);
  }

  forceExit(code = 1) {
    this.isRunning = false;
    const duration = this.startTime ? Date.now() - this.startTime : 0;
    logger.error(`🛑 Force exiting after ${Math.round(duration / 1000)}s with code ${code}`);
    
    // Force exit immediately
    setTimeout(() => {
      process.exit(code);
    }, 100);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.info('🛑 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('🛑 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error(`💥 Uncaught Exception: ${error.message}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error(`💥 Unhandled Rejection at: ${promise}, reason: ${reason}`);
  process.exit(1);
});

// Start the application
const app = new StockNotificationApp();

// Check if we're running as a one-time job or setting up cron
const args = process.argv.slice(2);
if (args.includes('--setup-cron')) {
  app.setupCronJobs();
  logger.info('🔄 Cron jobs running... Press Ctrl+C to stop');
} else {
  app.start();
}