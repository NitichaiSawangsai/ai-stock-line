require('dotenv').config();
const StockDataService = require('./services/stockDataService');
const AIAnalysisService = require('./services/aiAnalysisService');
const { MessageService } = require('./services/messageService');
const { RetryManager, TimeoutManager } = require('./services/retryManager');
const logger = require('./services/logger');

class StockAnalysisApp {
    constructor() {
        // Load configuration from environment
        this.config = {
            // OpenAI Configuration
            openaiApiKey: process.env.OPENAI_API_KEY,
            openaiModel: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
            
            // Gemini Configuration
            geminiApiKey: process.env.GEMINI_API_KEY,
            geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
            
            // Web Search Configuration
            googleSearchApiKey: process.env.GOOGLE_SEARCH_API_KEY,
            googleSearchEngineId: process.env.GOOGLE_SEARCH_ENGINE_ID,
            googleSearchDailyLimit: parseInt(process.env.GOOGLE_SEARCH_DAILY_LIMIT) || 200,
            googleSearchFreeDaily: parseInt(process.env.GOOGLE_SEARCH_FREE_DAILY) || 100,
            googleSearchCostPer1000: parseFloat(process.env.GOOGLE_SEARCH_COST_PER_1000?.replace('$', '')) || 5,
            newsApiKey: process.env.NEWS_API_KEY,
            
            // LINE Configuration
            lineChannelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
            lineChannelSecret: process.env.LINE_CHANNEL_SECRET,
            lineUserId: process.env.LINE_USER_ID,
            
            // Stock Data Configuration
            stockDataUrl: process.env.STOCK_DATA_URL,
            
            // App Configuration
            monthlyCostLimit: parseFloat(process.env.MONTHLY_COST_LIMIT_THB) || 100,
            retryMaxAttempts: parseInt(process.env.RETRY_MAX_ATTEMPTS) || 3,
            timeoutEndApp: parseInt(process.env.TIMEOUT_END_APP_MS) || 1800000, // 30 minutes
            
            // Environment
            nodeEnv: process.env.NODE_ENV || 'development',
            logLevel: process.env.LOG_LEVEL || 'info'
        };

        // Initialize services
        this.stockDataService = new StockDataService(this.config.stockDataUrl);
        this.aiAnalysisService = new AIAnalysisService(this.config);
        this.messageService = new MessageService({
            channelAccessToken: this.config.lineChannelAccessToken,
            channelSecret: this.config.lineChannelSecret,
            userId: this.config.lineUserId
        });

        // Initialize managers
        this.retryManager = new RetryManager(this.config.retryMaxAttempts);
        this.timeoutManager = new TimeoutManager(this.config.timeoutEndApp);
    }

    validateConfiguration() {
        const requiredFields = [
            'stockDataUrl',
            'lineChannelAccessToken',
            'lineChannelSecret',
            'lineUserId'
        ];

        const missingFields = requiredFields.filter(field => !this.config[field]);
        
        if (missingFields.length > 0) {
            throw new Error(`Missing required configuration: ${missingFields.join(', ')}`);
        }

        // Check if at least one AI service is configured
        const hasOpenAI = this.config.openaiApiKey && this.config.openaiApiKey !== 'disabled';
        const hasGemini = this.config.geminiApiKey;
        
        if (!hasOpenAI && !hasGemini) {
            logger.warn('ไม่มี AI API Key ที่ใช้งานได้ จะใช้โหมดฟรี');
        }

        logger.success('ตรวจสอบการตั้งค่าเรียบร้อย');
    }

    async downloadAndParseStockData() {
        logger.startOperation('ดาวน์โหลดข้อมูลหุ้น');
        
        const result = await this.retryManager.executeWithRetryAndTimeout(
            async () => {
                this.timeoutManager.checkTimeout();
                return await this.stockDataService.getFormattedStockData();
            },
            60000, // 1 minute timeout for download
            'ดาวน์โหลดข้อมูลหุ้น'
        );

        logger.finishOperation(`ดาวน์โหลดและประมวลผลข้อมูลหุ้น (${result.stockList.length} รายการ)`);
        return result;
    }

    async generateAIAnalysis(stockData) {
        logger.startOperation('การวิเคราะห์ด้วย AI');
        
        const analysis = await this.retryManager.executeWithRetryAndTimeout(
            async () => {
                this.timeoutManager.checkTimeout();
                return await this.aiAnalysisService.generateAnalysis(
                    stockData.formattedData, 
                    this.config.monthlyCostLimit
                );
            },
            300000, // 5 minutes timeout for AI analysis
            'การวิเคราะห์ด้วย AI'
        );

        logger.finishOperation('การวิเคราะห์ด้วย AI');
        return analysis;
    }

    async sendAnalysisResults(analysisContent) {
        logger.startOperation('การส่งผลการวิเคราะห์');
        
        const result = await this.retryManager.executeWithRetry(
            async () => {
                this.timeoutManager.checkTimeout();
                return await this.messageService.sendAnalysisResult(analysisContent);
            },
            'ส่งผลการวิเคราะห์'
        );

        logger.finishOperation(`ส่งผลการวิเคราะห์ (วิธี: ${result.method})`);
        return result;
    }

    async sendCostSummary() {
        logger.startOperation('การส่งสรุปค่าใช้จ่าย');
        
        const costSummary = await this.aiAnalysisService.generateCostSummary();
        
        const result = await this.retryManager.executeWithRetry(
            async () => {
                this.timeoutManager.checkTimeout();
                return await this.messageService.sendCostSummary(costSummary);
            },
            'ส่งสรุปค่าใช้จ่าย'
        );

        logger.finishOperation(`ส่งสรุปค่าใช้จ่าย (วิธี: ${result.method})`);
        return result;
    }

    async run() {
        const startTime = Date.now();
        logger.header('Stock Analysis App');
        logger.info(`กำหนดเวลาสูงสุด: ${this.config.timeoutEndApp / 60000} นาที`);
        
        try {
            // Step 1: Validate configuration
            this.validateConfiguration();
            
            // Step 2: Clear previous results
            await this.messageService.clearPreviousResults();
            
            // Step 3: Download and parse stock data
            const stockData = await this.downloadAndParseStockData();
            console.log(`⏱️  เวลาผ่านไป: ${this.timeoutManager.formatElapsedTime()}`);
            
            // Step 4: Generate AI analysis
            const analysis = await this.generateAIAnalysis(stockData);
            console.log(`⏱️  เวลาผ่านไป: ${this.timeoutManager.formatElapsedTime()}`);
            
            // Step 5: Send analysis results
            await this.sendAnalysisResults(analysis.content);
            console.log(`⏱️  เวลาผ่านไป: ${this.timeoutManager.formatElapsedTime()}`);
            
            // Step 6: Send cost summary
            await this.sendCostSummary();
            console.log(`⏱️  เวลาผ่านไป: ${this.timeoutManager.formatElapsedTime()}`);
            
            // Final success message
            const totalTime = Date.now() - startTime;
            logger.success(`การทำงานเสร็จสิ้นสมบูรณ์! ใช้เวลารวม: ${Math.round(totalTime / 1000)} วินาที`);
            
            return {
                success: true,
                duration: totalTime,
                stockCount: stockData.stockList.length,
                analysisLength: analysis.content.length
            };

        } catch (error) {
            const totalTime = Date.now() - startTime;
            logger.error(`เกิดข้อผิดพลาดร้ายแรง: ${error.message}`);
            logger.time(`เวลาที่ใช้ก่อนล้มเหลว: ${Math.round(totalTime / 1000)} วินาที`);
            
            // Try to send error notification
            try {
                const errorMessage = `❌ Stock Analysis Error\n\nเวลา: ${new Date().toLocaleString('th-TH')}\nข้อผิดพลาด: ${error.message}\nระยะเวลา: ${Math.round(totalTime / 1000)} วินาที`;
                await this.messageService.sendCostSummary(errorMessage);
            } catch (notificationError) {
                logger.error('ไม่สามารถส่งแจ้งเตือนข้อผิดพลาดได้', notificationError.message);
            }
            
            throw error;
        }
    }
}

// Main execution
async function main() {
    const app = new StockAnalysisApp();
    
    try {
        const result = await app.run();
        logger.success('ผลลัพธ์การทำงาน', result);
        process.exit(0);
        
    } catch (error) {
        logger.error('การทำงานล้มเหลว', error.message);
        process.exit(1);
    }
}

// Run only if this file is executed directly
if (require.main === module) {
    main();
}

module.exports = StockAnalysisApp;