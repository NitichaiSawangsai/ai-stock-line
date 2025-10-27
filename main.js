require('dotenv').config();
const cron = require('node-cron');
const moment = require('moment-timezone');
const winston = require('winston');
const StockDataService = require('./services/stockDataService');
const NewsAnalysisService = require('./services/newsAnalysisService');
const LineOfficialAccountService = require('./services/lineOfficialAccountService');
const SchedulerService = require('./services/schedulerService');
const { AutoRecoveryDataService } = require('./services/autoRecoveryDataService');

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
    this.autoRecoveryData = new AutoRecoveryDataService(); // Enhanced data service with auto-recovery
    this.sessionData = {
      startTime: null,
      processedStocks: 0,
      errors: [],
      lineFallbackUsed: false,
      detectedModels: [],
      costLimitExceeded: false,
      tokensUsed: 0,
      costThisSession: '0.00',
      monthlyTokens: 'กำลังดึงข้อมูล',
      monthlyCost: 'กำลังดึงข้อมูล',
      costStatus: null,
      modelsUsed: '',
      duration: 0,
      newsCount: 0,
      analysisResults: []
    };
    
    // Monthly cost limit from .env
    this.monthlyCostLimitTHB = parseFloat(process.env.MONTHLY_COST_LIMIT_THB) || 100;
    this.currentMonthlyCostTHB = 0;
  }

  /**
   * Check monthly cost limit and switch to free models if exceeded
   * 💰 ควบคุมค่าใช้จ่ายรายเดือนจาก .env และเปลี่ยนไปใช้โมเดลฟรีอัตโนมัติ
   */
  async checkMonthlyCostLimit() {
    try {
      // Read current monthly cost from cost tracking service
      const fs = require('fs').promises;
      const costFilePath = './data/monthly-cost.json';
      
      try {
        const costData = await fs.readFile(costFilePath, 'utf8');
        const monthlyCost = JSON.parse(costData);
        this.currentMonthlyCostTHB = monthlyCost.totalCostTHB || 0;
      } catch (error) {
        // File doesn't exist or invalid, start with 0
        this.currentMonthlyCostTHB = 0;
      }
      
      logger.info(`💰 Monthly cost limit: ${this.monthlyCostLimitTHB} THB`);
      logger.info(`💰 Current monthly cost: ${this.currentMonthlyCostTHB} THB`);
      
      if (this.currentMonthlyCostTHB >= this.monthlyCostLimitTHB) {
        this.sessionData.costLimitExceeded = true;
        logger.warn(`⚠️ Monthly cost limit exceeded! Switching to free models`);
        logger.warn(`💸 Current: ${this.currentMonthlyCostTHB} THB >= Limit: ${this.monthlyCostLimitTHB} THB`);
        
        // Switch to free models automatically
        process.env.OPENAI_API_KEY = 'disabled';
        process.env.GEMINI_API_KEY = 'free';
        
        logger.info('🆓 Switched to: google/gemini-free, openai/disabled');
        return true; // Cost limit exceeded
      } else {
        const remainingBudget = this.monthlyCostLimitTHB - this.currentMonthlyCostTHB;
        logger.info(`💚 Within budget. Remaining: ${remainingBudget.toFixed(2)} THB`);
        return false; // Within limit
      }
    } catch (error) {
      logger.error(`❌ Error checking cost limit: ${error.message}`);
      return false;
    }
  }

  /**
   * Detect actual models from .env configuration
   * 🤖 แสดงเฉพาะโมเดลที่ใช้จริงจาก .env
   */
  detectActualModels() {
    const models = [];
    
    // Check Gemini model
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_MODEL && process.env.GEMINI_API_KEY !== 'free') {
      models.push(`google/${process.env.GEMINI_MODEL}`);
    } else {
      models.push('google/gemini-free');
    }
    
    // Check OpenAI model
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL && process.env.OPENAI_API_KEY !== 'disabled') {
      models.push(`openai/${process.env.OPENAI_MODEL}`);
    } else {
      models.push('openai/disabled');
    }
    
    this.sessionData.detectedModels = models;
    this.sessionData.modelsUsed = models.join(', '); // Update session data
    
    if (this.sessionData.costLimitExceeded) {
      logger.warn(`⚠️ Monthly cost limit exceeded! Using FREE models: ${models.join(', ')}`);
    } else {
      logger.info(`🤖 Detected models: ${models.join(', ')}`);
    }
    
    return models;
  }

  /**
   * Enhanced LINE notification with fallback to output-summary.txt
   * 💾 ถ้า LINE ส่งไม่ได้ ให้รวบรวมข้อมูลทั้งหมดไปสร้างไฟล์ output-summary.txt
   */
  async sendWithLineFallback(sendFunction, data, label) {
    try {
      // Handle different types of LINE service methods
      if (typeof sendFunction === 'string') {
        // Check if the method exists on lineNotification
        if (typeof this.lineNotification[sendFunction] === 'function') {
          await this.lineNotification[sendFunction](data);
        } else {
          // Fallback to sendMessage for unrecognized methods
          await this.lineNotification.sendMessage(data);
        }
      } else if (typeof sendFunction === 'function') {
        // If sendFunction is a bound method
        await sendFunction.call(this.lineNotification, data);
      } else {
        // Default fallback for sendMessage
        await this.lineNotification.sendMessage(data);
      }
      logger.info(`✅ Successfully sent ${label} to LINE`);
      return true;
    } catch (error) {
      logger.warn(`⚠️ Failed to send ${label} to LINE: ${error.message}`);
      this.sessionData.lineFallbackUsed = true;
      this.sessionData.errors.push(`LINE_FAILED_${label}: ${error.message}`);
      
      // Save to fallback file
      await this.saveToFallbackFile(data, label);
      return false;
    }
  }

  /**
   * Clear output-summary.txt file before starting new session
   */
  async clearOutputFile() {
    const fs = require('fs').promises;
    const path = require('path');
    
    try {
      const outputPath = path.join(__dirname, 'data', 'output-summary.txt');
      await fs.unlink(outputPath);
      logger.info('🗑️ ลบไฟล์ output-summary.txt เรียบร้อยแล้ว');
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.warn(`⚠️ ไม่สามารถลบไฟล์ output-summary.txt: ${error.message}`);
      }
      // ไม่มีไฟล์อยู่แล้วก็ไม่เป็นไร
    }
  }

  /**
   * Clear output-summary.txt file before starting new analysis
   * ลบไฟล์ output-summary.txt ก่อนเริ่มการวิเคราะห์ใหม่
   */
  async clearOutputFile() {
    const fs = require('fs').promises;
    const path = require('path');
    
    try {
      const outputPath = path.join(__dirname, 'data', 'output-summary.txt');
      
      // ลบไฟล์ถ้ามีอยู่
      try {
        await fs.unlink(outputPath);
        logger.info('🗑️ ลบไฟล์ output-summary.txt เก่าแล้ว');
      } catch (error) {
        // ไฟล์ไม่มีอยู่ก็ไม่เป็นไร
        if (error.code !== 'ENOENT') {
          logger.warn(`⚠️ ไม่สามารถลบไฟล์เก่าได้: ${error.message}`);
        }
      }
      
      // สร้างไฟล์ใหม่พร้อมหัวข้อ
      const timestamp = new Date().toISOString();
      const thaiTime = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
      
      const initialContent = `=== รายงานข่าวฉบับสมบูรณ์ - ${timestamp} ===
📰 สรุปข่าวหุ้นทั้งหมด
🕐 เริ่มการวิเคราะห์: ${thaiTime} (เวลาประเทศไทย)

`;
      
      await fs.writeFile(outputPath, initialContent);
      logger.info('📄 สร้างไฟล์ output-summary.txt ใหม่แล้ว');
      
    } catch (error) {
      logger.error(`❌ ไม่สามารถจัดการไฟล์ output-summary.txt ได้: ${error.message}`);
    }
  }

  /**
   * Clear output file before starting new session
   */
  async clearOutputFile() {
    const fs = require('fs').promises;
    const path = require('path');
    
    try {
      const outputPath = path.join(__dirname, 'data', 'output-summary.txt');
      await fs.unlink(outputPath);
      logger.info('🗑️ ล้างไฟล์ output-summary.txt เรียบร้อยแล้ว');
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.warn(`⚠️ ไม่สามารถลบไฟล์ output: ${error.message}`);
      }
    }
  }

  /**
   * Save data to output-summary.txt when LINE fails
   * Enhanced format with complete news details, analysis, and summaries
   */
  async saveToFallbackFile(data, label) {
    const fs = require('fs').promises;
    const timestamp = new Date().toISOString();
    
    let content = `\n=== ${label} - ${timestamp} ===\n`;
    
    // Handle different types of content
    if (label === 'SESSION_REPORT') {
      content += this.formatSessionReport(data);
    } else if (label === 'RISK_ALERT' || label === 'OPPORTUNITY_ALERT') {
      content += this.formatStockAlert(data, label);
    } else if (label === 'COST_REPORT') {
      content += this.formatCostReport(data);
    } else {
      // Generic formatting
      if (typeof data === 'string') {
        content += data;
      } else if (data && typeof data === 'object') {
        content += JSON.stringify(data, null, 2);
      } else {
        content += String(data);
      }
    }
    
    content += '\n' + '='.repeat(80) + '\n';
    
    try {
      const path = require('path');
      const outputPath = path.join(__dirname, 'data', 'output-summary.txt');
      await fs.appendFile(outputPath, content);
      logger.info(`💾 Saved ${label} to data/output-summary.txt`);
    } catch (error) {
      logger.error(`❌ Failed to save to fallback file: ${error.message}`);
    }
  }

  /**
   * Format session report for detailed output
   */
  formatSessionReport(data) {
    let report = `📊 รายงานเซสชัน\n`;
    report += `⏱️ ระยะเวลา: ${this.sessionData.duration} วินาทีี\n`;
    report += `📈 หุ้นที่ประมวลผล: ${this.sessionData.processedStocks} ตัว\n`;
    report += `🤖 โมเดลที่ใช้: ${this.sessionData.modelsUsed}\n`;
    
    // Cost information
    if (this.sessionData.costStatus) {
      report += `💰 สถานะค่าใช้จ่าย: ${this.sessionData.costStatus}\n`;
    }
    
    // News information
    if (this.sessionData.newsCount !== undefined) {
      report += `📰 ข่าวที่ส่ง: ${this.sessionData.newsCount} หุ้น\n`;
    }
    
    report += `❌ ข้อผิดพลาด: ${this.sessionData.errors.length} รายการ\n`;
    report += `💾 ใช้ระบบสำรอง: ${this.sessionData.lineFallbackUsed ? 'ใช่' : 'ไม่ใช่'}\n`;
    
    if (this.sessionData.errors.length > 0) {
      report += `\n🚨 Error Details:\n`;
      this.sessionData.errors.forEach((error, index) => {
        report += `   ${index + 1}. ${error}\n`;
      });
    }
    
    return report;
  }

  /**
   * Format stock alert for detailed output
   */
  formatStockAlert(data, alertType) {
    if (typeof data === 'string') {
      return this.formatDetailedStockData(data, alertType);
    }
    return data;
  }

  /**
   * Format detailed stock data similar to user's desired format
   */
  formatDetailedStockData(content, alertType) {
    // This is where we'll parse the stock analysis content
    // and format it according to the user's desired format
    
    const lines = content.split('\n');
    let formattedContent = '';
    let currentStock = '';
    let stockCount = 0;
    
    for (const line of lines) {
      if (line.includes('📰') && line.includes('หุ้น')) {
        stockCount++;
        currentStock = line;
        formattedContent += `\n${line}\n\n`;
        formattedContent += `💼 จำนวนลงทุน: 0.00 (สำหรับการดู)\n`;
        formattedContent += `📅 ข่าวในช่วง 7 วัน: [กำลังดึงข้อมูล] รายการ\n\n`;
      } else if (line.includes('ข่าวที่')) {
        formattedContent += `${line}\n\n`;
      } else if (line.includes('สรุป:')) {
        formattedContent += `📝 ${line}\n\n`;
      } else if (line.includes('ผลกระทบ')) {
        formattedContent += `💡 ${line}\n\n`;
      } else if (line.includes('ทิศทางราคา')) {
        formattedContent += `💰 ${line}\n`;
      } else if (line.includes('ระยะเวลา')) {
        formattedContent += `⏱️ ${line}\n`;
      } else if (line.includes('ความมั่นใจ')) {
        formattedContent += `🎯 ${line}\n\n`;
      } else if (line.includes('วันที่')) {
        formattedContent += `📅 ${line}\n`;
      } else if (line.includes('แหล่งข่าว')) {
        formattedContent += `🏢 ${line}\n`;
      } else if (line.includes('อ่านเพิ่มเติม')) {
        formattedContent += `🔗 ${line}\n\n`;
      } else if (line.includes('อัพเดท')) {
        formattedContent += `⏰ ${line}\n\n`;
        formattedContent += '---'.repeat(10) + '\n';
      } else if (line.trim() && !line.includes('=')){
        formattedContent += `${line}\n`;
      }
    }
    
    // Add summary at the end
    if (alertType === 'RISK_ALERT' || alertType === 'OPPORTUNITY_ALERT') {
      formattedContent += this.generateAnalysisSummary();
    }
    
    return formattedContent;
  }

  /**
   * Generate analysis summary with token usage and costs
   */
  generateAnalysisSummary() {
    let summary = '\n' + '='.repeat(60) + '\n';
    summary += `📊 สรุปการใช้งานครั้งนี้\n\n`;
    
    // Current session usage
    summary += `🔹 Token ที่ใช้ครั้งนี้: ${this.sessionData.tokensUsed || 'กำลังคำนวณ'}\n`;
    summary += `🔹 ราคาที่ใช้ครั้งนี้: ${this.sessionData.costThisSession || 'กำลังคำนวณ'} บาท\n`;
    summary += `🔹 Model AI ที่ใช้วิเคราะห์: ${this.sessionData.modelsUsed}\n\n`;
    
    // Monthly summary
    summary += `📈 สรุปผลรายเดือน\n`;
    summary += `🔸 Token ที่ใช้ไปทั้งหมดในเดือนนี้: ${this.sessionData.monthlyTokens || 'กำลังดึงข้อมูล'}\n`;
    summary += `🔸 ราคาที่ใช้ไปทั้งหมดในเดือนนี้: ${this.sessionData.monthlyCost || 'กำลังดึงข้อมูล'} บาท\n`;
    
    // Cost limit status
    if (this.sessionData.costStatus && this.sessionData.costStatus.includes('EXCEEDED')) {
      summary += `⚠️ สถานะ: เกินขีดจำกัดงบประมาณรายเดือน\n`;
      summary += `📋 ระบบเปลี่ยนเป็นโมเดลฟรีอัตโนมัติ\n`;
    } else {
      summary += `✅ สถานะ: อยู่ในขีดจำกัดงบประมาณ\n`;
    }
    
    summary += '\n' + '='.repeat(60) + '\n';
    return summary;
  }

  /**
   * Format cost report for detailed output
   */
  formatCostReport(data) {
    if (typeof data === 'string') {
      return data;
    }
    
    let report = `💰 COST REPORT\n`;
    if (data.currentCost) report += `💸 Current cost: ${data.currentCost} THB\n`;
    if (data.limit) report += `🎯 Monthly limit: ${data.limit} THB\n`;
    if (data.status) report += `📊 Status: ${data.status}\n`;
    if (data.models) report += `🤖 Active models: ${data.models}\n`;
    
    return report;
  }

  /**
   * Send session report to LINE
   * 📊 สรุปการทำงาน (Session Report) ให้สรุปส่งไปที่ไลน์ทุกครั้ง
   */
  async sendSessionReport() {
    const endTime = Date.now();
    this.sessionData.duration = Math.round((endTime - this.sessionData.startTime) / 1000);
    
    // Update cost status for the session
    this.sessionData.costStatus = this.sessionData.costLimitExceeded ? 
      `💸 COST LIMIT EXCEEDED (${this.currentMonthlyCostTHB}/${this.monthlyCostLimitTHB} THB)` :
      `💚 Within budget (${this.currentMonthlyCostTHB.toFixed(2)}/${this.monthlyCostLimitTHB} THB)`;
    
    this.sessionData.modelsUsed = this.sessionData.detectedModels.join(', ');
    
    // Try to get current session cost from cost tracking service
    try {
      const costTracker = require('./services/costTrackingService');
      if (costTracker && typeof costTracker.getCurrentSessionCost === 'function') {
        this.sessionData.costThisSession = await costTracker.getCurrentSessionCost();
        this.sessionData.tokensUsed = await costTracker.getCurrentSessionTokens();
      }
    } catch (error) {
      logger.warn(`⚠️ Could not retrieve session cost: ${error.message}`);
    }
    
    // Try to get monthly totals
    try {
      const fs = require('fs').promises;
      const costData = await fs.readFile('./data/monthly-cost.json', 'utf8');
      const monthlyCost = JSON.parse(costData);
      this.sessionData.monthlyCost = `${monthlyCost.totalCostTHB || 0} บาท`;
      this.sessionData.monthlyTokens = monthlyCost.totalTokens || 'ไม่พบข้อมูล';
    } catch (error) {
      // Keep default values
    }
    
    const reportText = `📊 SESSION REPORT\n` +
      `⏱️ Duration: ${this.sessionData.duration} seconds\n` +
      `📈 Stocks processed: ${this.sessionData.processedStocks}\n` +
      `🤖 Models: ${this.sessionData.modelsUsed}\n` +
      `💰 Cost status: ${this.sessionData.costStatus}\n` +
      `❌ Errors: ${this.sessionData.errors.length}\n` +
      `💾 Fallback used: ${this.sessionData.lineFallbackUsed ? 'Yes' : 'No'}\n` +
      (this.sessionData.errors.length > 0 ? `🔍 Recent errors: ${this.sessionData.errors.slice(0, 3).join(', ')}` : '');
    
    await this.sendWithLineFallback(
      'sendMessage',
      reportText,
      'SESSION_REPORT'
    );
  }

  async start() {
    const timeoutId = setTimeout(() => {
      logger.error('⏰ Process timeout reached (20 minutes), forcing exit...');
      process.exit(1);
    }, this.timeout);

    try {
      this.startTime = Date.now();
      this.isRunning = true;
      this.sessionData.startTime = this.startTime;
      
      logger.info('🚀 Stock Notification System Starting...');
      
      // Check monthly cost limit first
      await this.checkMonthlyCostLimit();
      
      // Detect actual models from .env
      this.detectActualModels();
      
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

      // Send session report at the end
      await this.sendSessionReport();

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
      // Clear previous output file first
      await this.clearOutputFile();
      
      // Load stock list from Stock Data Service
      logger.info('📂 Loading stock list...');
      const stocks = await this.stockData.getStockList();
      
      if (!stocks || stocks.length === 0) {
        logger.warn('⚠️ No stocks found in the list');
        return;
      }

      logger.info(`📊 Found ${stocks.length} stocks to analyze`);
      this.sessionData.processedStocks = stocks.length;

      // Check for high-risk stocks
      logger.info('🚨 Analyzing high-risk stocks...');
      const highRiskStocks = await this.newsAnalysis.analyzeHighRiskStocks(stocks);
      logger.info(`🚨 Found ${highRiskStocks.length} high-risk stocks`);
      
      if (highRiskStocks.length > 0) {
        logger.info('📤 Sending risk alert...');
        await this.sendWithLineFallback(
          'sendRiskAlert',
          highRiskStocks,
          'RISK_ALERT'
        );
        logger.info('✅ Risk alert processed');
      } else {
        logger.info('✅ No high-risk stocks to report');
      }

      // Check for opportunities
      const currentHour = moment().tz('Asia/Bangkok').hour();
      logger.info(`🕰️ Current hour: ${currentHour} (Bangkok time)`);
      
      logger.info('🔥 Analyzing stock opportunities...');
      const opportunities = await this.newsAnalysis.analyzeStockOpportunities(stocks);
      logger.info(`🔥 Found ${opportunities.length} opportunities`);
      
      if (opportunities.length > 0) {
        logger.info('📤 Sending opportunity alert...');
        await this.sendWithLineFallback(
          'sendOpportunityAlert',
          opportunities,
          'OPPORTUNITY_ALERT'
        );
        logger.info('✅ Opportunity alert processed');
      } else {
        logger.info('✅ No opportunities to report');
      }

      // Send all news data
      logger.info('📰 Gathering comprehensive news data...');
      const allNewsData = await this.newsAnalysis.gatherAllStockNews(stocks);
      logger.info(`📰 Found news for ${allNewsData.length} stocks`);
      
      if (allNewsData.length > 0) {
        logger.info('📤 Sending comprehensive news alert...');
        await this.sendWithLineFallback(
          'sendAllNewsAlert',
          allNewsData,
          'ALL_NEWS_ALERT'
        );
        logger.info('✅ All news alert processed');
        this.sessionData.newsCount = allNewsData.length;
      } else {
        logger.info('ℹ️ No news data to send');
        this.sessionData.newsCount = 0;
      }

    } catch (error) {
      logger.error(`💥 Error in full check: ${error.message}`);
      this.sessionData.errors.push(`FULL_CHECK_ERROR: ${error.message}`);
      throw error;
    }
  }

  async checkHighRiskStocks() {
    logger.info('🚨 Checking for high-risk stocks...');
    
    try {
      const stocks = await this.stockData.getStockList();
      this.sessionData.processedStocks = stocks.length;
      const highRiskStocks = await this.newsAnalysis.analyzeHighRiskStocks(stocks);
      
      if (highRiskStocks.length > 0) {
        await this.sendWithLineFallback(
          'sendRiskAlert',
          highRiskStocks,
          'RISK_ALERT'
        );
        logger.info(`🚨 Processed risk alert for ${highRiskStocks.length} stocks`);
      } else {
        logger.info('✅ No high-risk stocks found');
      }
      
    } catch (error) {
      logger.error(`💥 Error checking high-risk stocks: ${error.message}`);
      this.sessionData.errors.push(`RISK_CHECK_ERROR: ${error.message}`);
      throw error;
    }
  }

  async checkStockOpportunities() {
    logger.info('🔥 Checking for stock opportunities...');
    
    try {
      const stocks = await this.stockData.getStockList();
      this.sessionData.processedStocks = stocks.length;
      const opportunities = await this.newsAnalysis.analyzeStockOpportunities(stocks);
      
      if (opportunities.length > 0) {
        await this.sendWithLineFallback(
          'sendOpportunityAlert',
          opportunities,
          'OPPORTUNITY_ALERT'
        );
        logger.info(`🔥 Processed opportunity alert for ${opportunities.length} stocks`);
      } else {
        logger.info('✅ No opportunities found');
      }
      
    } catch (error) {
      logger.error(`💥 Error checking opportunities: ${error.message}`);
      this.sessionData.errors.push(`OPPORTUNITY_CHECK_ERROR: ${error.message}`);
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