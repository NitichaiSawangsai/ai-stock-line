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
    this.timeout = 30 * 60 * 1000; // 30 minutes timeout
    this.stockData = new StockDataService();
    this.newsAnalysis = new NewsAnalysisService();
    this.lineNotification = new LineOfficialAccountService();
    this.scheduler = new SchedulerService();
  }

  async start() {
    const timeoutId = setTimeout(() => {
      logger.error('⏰ Process timeout reached (30 minutes), forcing exit...');
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
      const stocks = await this.stockData.getStockList();
      
      if (!stocks || stocks.length === 0) {
        logger.warn('⚠️ No stocks found in the list');
        return;
      }

      logger.info(`📊 Found ${stocks.length} stocks to analyze`);

      // Check for high-risk stocks
      const highRiskStocks = await this.newsAnalysis.analyzeHighRiskStocks(stocks);
      if (highRiskStocks.length > 0) {
        await this.lineNotification.sendRiskAlert(highRiskStocks);
      }

      // Check for opportunities (only during morning hours)
      const currentHour = moment().tz('Asia/Bangkok').hour();
      if (currentHour >= 5 && currentHour <= 7) {
        const opportunities = await this.newsAnalysis.analyzeStockOpportunities(stocks);
        if (opportunities.length > 0) {
          await this.lineNotification.sendOpportunityAlert(opportunities);
        }
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
    
    // Test ChatGPT API with timeout (non-blocking in dev mode)
    try {
      await Promise.race([
        this.newsAnalysis.testConnection(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('ChatGPT test timeout')), 10000))
      ]);
      logger.info('✅ ChatGPT API service OK');
    } catch (error) {
      logger.error(`❌ ChatGPT API service failed: ${error.message}`);
      logger.warn('⚠️ Continuing without ChatGPT for development mode...');
      // Don't throw error in dev mode for ChatGPT failures
    }
    
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
    
    // Only throw error if critical services failed (not ChatGPT in dev mode)
    if (hasErrors) {
      throw new Error('Critical services failed');
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