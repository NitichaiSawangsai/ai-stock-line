const OpenAIService = require('./openaiService');
const GeminiService = require('./geminiService');
const WebSearchService = require('./webSearchService');
const CostTracker = require('./costTracker');
const logger = require('./logger');

class AIAnalysisService {
    constructor(config) {
        this.config = config;
        this.costTracker = new CostTracker();
        
        // Initialize AI services
        this.openaiService = new OpenAIService(config.openaiApiKey, config.openaiModel);
        this.geminiService = new GeminiService(config.geminiApiKey, config.geminiModel);
        
        // Initialize Web Search service
        this.webSearchService = new WebSearchService(
            config.googleSearchApiKey, 
            config.googleSearchEngineId, 
            config.newsApiKey,
            config.googleSearchDailyLimit,
            config.googleSearchFreeDaily
        );
    }

    createAnalysisPrompt(stockData, newsData = null) {
        const today = new Date();
        const todayThai = today.toLocaleDateString('th-TH', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        const todayEng = today.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        let newsContext = '';
        if (newsData) {
            // ลดขนาด prompt โดยใช้ข้อมูลข่าวแบบสังเขป
            const allNews = [
                ...newsData.economic.slice(0, 2),
                ...newsData.geopolitical.slice(0, 1),
                ...newsData.gold.slice(0, 1),
                ...newsData.stock.slice(0, 2),
                ...newsData.crypto.slice(0, 1),
                ...newsData.currency.slice(0, 1)
            ];
            
            newsContext = `ข่าวล่าสุด:\n${allNews.map(news => `• ${news.title} - ${news.url}`).join('\n')}`;
        } else {
            newsContext = `⚠️ ไม่สามารถเชื่อมต่อกับอินเทอร์เน็ตได้`;
        }

        return `วันนี้: ${todayEng} (${todayThai})

${newsContext}

หุ้นที่ลงทุน:
${stockData}

กรุณาสรุปสั้นๆ ในรูปแบบ:
📊 ข่าวสำคัญ (2-3 ข่าว) พร้อม URL
📈 ผลกระทบต่อหุ้น: ความเสี่ยง 1-10, โอกาสกำไร 1-10
💡 คำแนะนำ`;
    }

    async selectBestAIService(monthlyCostLimit) {
        try {
            // Check budget status
            const budgetStatus = await this.costTracker.checkBudgetLimit(monthlyCostLimit);
            
            if (budgetStatus.isOverBudget) {
                logger.money('เกินงบประมาณ! เปลี่ยนไปใช้โมเดลฟรี');
                // Switch to free models
                if (this.geminiService.isFree || this.costTracker.isFreeTier('gemini', this.config.geminiModel)) {
                    return { service: this.geminiService, reason: 'เกินงบประมาณ - ใช้ Gemini ฟรี' };
                } else {
                    // Force free mode
                    this.geminiService.isFree = true;
                    return { service: this.geminiService, reason: 'เกินงบประมาณ - บังคับใช้โหมดฟรี' };
                }
            }

            // Check which service is available
            if (this.openaiService.isEnabled) {
                return { service: this.openaiService, reason: 'OpenAI API พร้อมใช้งาน' };
            } else if (this.geminiService.isEnabled) {
                return { service: this.geminiService, reason: 'Gemini API พร้อมใช้งาน' };
            } else {
                console.log('🆓 ไม่มี API Key พร้อมใช้งาน เปลี่ยนไปใช้โหมดฟรี');
                this.geminiService.isFree = true;
                return { service: this.geminiService, reason: 'ไม่มี API Key - ใช้โหมดฟรี' };
            }

        } catch (error) {
            console.error('❌ ข้อผิดพลาดในการเลือก AI Service:', error.message);
            // Fallback to free mode
            this.geminiService.isFree = true;
            return { service: this.geminiService, reason: 'ข้อผิดพลาด - ใช้โหมดฟรี' };
        }
    }

    async generateAnalysis(stockData, monthlyCostLimit = 100) {
        try {
            console.log('🔍 เริ่มต้นการวิเคราะห์...');
            
            // ค้นหาข่าวจากอินเทอร์เน็ตก่อน
            let newsData = null;
            if (this.webSearchService.isGoogleEnabled || this.webSearchService.isNewsEnabled) {
                newsData = await this.webSearchService.searchAllNews();
            } else {
                logger.warn('⚠️ Web Search APIs ไม่ได้เปิดใช้งาน - จะใช้ข้อมูลจำลอง');
            }
            
            // Select best AI service based on budget
            const { service, reason } = await this.selectBestAIService(monthlyCostLimit);
            logger.info(`เลือกใช้: ${service.constructor.name} (${reason})`);

            // Create prompt with news data
            const prompt = this.createAnalysisPrompt(stockData, newsData);
            logger.process(`สร้าง Prompt เสร็จ (${prompt.length} ตัวอักษร)`);

            // Generate response
            let response;
            if (prompt.length > 4000) {
                logger.process('Prompt ยาวเกินไป แบ่งเป็นส่วน...');
                response = await service.generateResponseInChunks(prompt);
            } else {
                response = await service.generateResponse(prompt);
            }

            // Track costs if not free
            if (!service.isFree) {
                const exchangeRate = await this.costTracker.getExchangeRate();
                await this.costTracker.updateCostTracking(
                    response.provider,
                    response.model,
                    response.usage.inputTokens,
                    response.usage.outputTokens,
                    exchangeRate
                );
            }

            logger.success('การวิเคราะห์เสร็จสิ้น');
            return response;

        } catch (error) {
            logger.error('ข้อผิดพลาดในการวิเคราะห์', error.message);
            throw error;
        }
    }

    async generateCostSummary() {
        try {
            const summary = await this.costTracker.generateCostSummary();
            const quotaStatus = await this.webSearchService.getQuotaStatus();
            
            const summaryText = `
💰 สรุปการใช้งานและค่าใช้จ่าย

📊 การรันครั้งนี้:
• Token ที่ใช้: ${summary.currentSession.tokens.toLocaleString()} tokens
• ค่าใช้จ่าย: $${summary.currentSession.costUSD.toFixed(4)} (${summary.currentSession.costTHB.toFixed(2)} บาท)
• โมเดล: ${summary.currentSession.provider}/${summary.currentSession.model}

📈 สรุปของเดือนนี้:
• Token รวม: ${summary.monthlyTotal.tokens.toLocaleString()} tokens
• ค่าใช้จ่ายรวม: $${summary.monthlyTotal.costUSD.toFixed(4)} (${summary.monthlyTotal.costTHB.toFixed(2)} บาท)
• จำนวนครั้งที่ใช้: ${summary.monthlyTotal.sessions} ครั้ง

🔍 Google Search Quota วันนี้:
• ใช้แล้ว: ${quotaStatus.used}/${quotaStatus.limit} คำค้น (${quotaStatus.percentage}%)
• ฟรี: ${quotaStatus.freeUsed}/${quotaStatus.freeLimit} คำค้น
• คิดค่า: ${quotaStatus.paidUsed} คำค้น
• ค่าใช้จ่ายวันนี้: ${quotaStatus.todayCost.toFixed(2)} บาท
• ค่าใช้จ่ายเดือนนี้: ${quotaStatus.monthlyCost.toFixed(2)} บาท
• เหลือ: ${quotaStatus.remaining} คำค้น
• Reset: ${quotaStatus.resetTime}

อัตราแลกเปลี่ยน: 1 USD = ${summary.currentSession.exchangeRate || 35} THB
`.trim();

            return summaryText;
        } catch (error) {
            logger.error('ข้อผิดพลาดในการสร้างสรุปค่าใช้จ่าย', error.message);
            return `
💰 สรุปการใช้งานและค่าใช้จ่าย

ไม่สามารถดึงข้อมูลค่าใช้จ่ายได้ในขณะนี้
`.trim();
        }
    }
}

module.exports = AIAnalysisService;