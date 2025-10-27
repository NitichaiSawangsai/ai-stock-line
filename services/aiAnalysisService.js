const OpenAIService = require('./openaiService');
const GeminiService = require('./geminiService');
const WebSearchService = require('./webSearchService');
const CostTracker = require('./costTracker');
const StockRiskAnalyzer = require('./stockRiskAnalyzer');
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
        
        // Initialize Stock Risk Analyzer
        this.stockRiskAnalyzer = new StockRiskAnalyzer(this.webSearchService, this.costTracker);
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
            
            // Step 1: ทำการวิเคราะห์ความเสี่ยงหุ้นแบบละเอียด
            logger.startOperation('วิเคราะห์ความเสี่ยงหุ้นแบบครอบคลุม');
            const riskAnalysis = await this.stockRiskAnalyzer.analyzeStockRisk(stockData);
            const riskReport = this.stockRiskAnalyzer.generateRiskReport(riskAnalysis);
            logger.finishOperation('วิเคราะห์ความเสี่ยงเสร็จสิ้น');
            
            // Step 2: ค้นหาข่าวทั่วไปเพิ่มเติม
            let newsData = null;
            if (this.webSearchService.isGoogleEnabled || this.webSearchService.isNewsEnabled) {
                newsData = await this.webSearchService.searchAllNews();
            } else {
                logger.warn('⚠️ Web Search APIs ไม่ได้เปิดใช้งาน - จะใช้ข้อมูลจำลอง');
            }
            
            // Step 3: แยก stockData เป็น stockList เพื่อวิเคราะห์แต่ละหุ้น
            const stockList = this.parseStockDataToList(stockData);
            
            // Step 4: ค้นหาข่าวและวิเคราะห์เฉพาะแต่ละหุ้น
            let stockAnalysis = [];
            if (stockList.length > 0 && this.webSearchService.isGoogleEnabled) {
                stockAnalysis = await this.webSearchService.searchStockSpecificNews(stockList);
            }
            
            // Step 5: Select best AI service based on budget
            const { service, reason } = await this.selectBestAIService(monthlyCostLimit);
            logger.info(`เลือกใช้: ${service.constructor.name} (${reason})`);

            // Step 6: Create enhanced prompt with comprehensive risk analysis
            const prompt = this.createComprehensiveAnalysisPrompt(stockData, newsData, stockAnalysis, riskReport);
            logger.process(`สร้าง Prompt เสร็จ (${prompt.length} ตัวอักษร)`);

            // Step 7: Generate response
            let response;
            if (prompt.length > 4000) {
                logger.process('Prompt ยาวเกินไป แบ่งเป็นส่วน...');
                response = await service.generateResponseInChunks(prompt);
            } else {
                response = await service.generateResponse(prompt);
            }

            // Step 8: Combine AI response with risk analysis
            const combinedAnalysis = this.combineAnalysisResults(response.content, riskReport, riskAnalysis);
            response.content = combinedAnalysis;

            // Step 9: Track costs if not free
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
    
    // แยก stockData string เป็น array ของหุ้น
    parseStockDataToList(stockData) {
        const lines = stockData.split('\n').filter(line => line.trim());
        const stockList = [];
        
        for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 3) {
                stockList.push({
                    type: parts[0],
                    symbol: parts[1], 
                    amount: parts[2],
                    purchasePrice: parts.length > 3 ? parts[3] : '-'
                });
            }
        }
        
        return stockList;
    }

    // สร้าง prompt ที่รวมข้อมูลวิเคราะห์เจาะลึกแต่ละหุ้น
    createEnhancedAnalysisPrompt(stockData, newsData = null, stockAnalysis = []) {
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
            const allNews = [
                ...newsData.economic.slice(0, 2),
                ...newsData.geopolitical.slice(0, 1),
                ...newsData.gold.slice(0, 1),
                ...newsData.stock.slice(0, 2),
                ...newsData.crypto.slice(0, 1),
                ...newsData.currency.slice(0, 1)
            ];
            
            newsContext = `ข่าวทั่วไป:\n${allNews.map(news => `• ${news.title} - ${news.url}`).join('\n')}`;
        } else {
            newsContext = `⚠️ ไม่สามารถเชื่อมต่อกับอินเทอร์เน็ตได้`;
        }
        
        // ข้อมูลวิเคราะห์เฉพาะแต่ละหุ้น
        let stockSpecificContext = '';
        if (stockAnalysis.length > 0) {
            stockSpecificContext = '\n\nวิเคราะห์เฉพาะแต่ละหุ้น:\n';
            
            for (const stock of stockAnalysis) {
                stockSpecificContext += `\n${stock.symbol}:\n`;
                stockSpecificContext += `- ราคาปัจจุบัน: ${stock.currentPrice}\n`;
                stockSpecificContext += `- ความเสี่ยง: ${stock.analysis.riskLevel}/10\n`;
                stockSpecificContext += `- โอกาสกำไร: ${stock.analysis.profitOpportunity}/10\n`;
                stockSpecificContext += `- ความเสี่ยงล้มละลาย: ${stock.analysis.bankruptcyRisk}\n`;
                if (stock.analysis.currentReturn !== 'N/A') {
                    stockSpecificContext += `- กำไรปัจจุบัน: ${stock.analysis.currentReturn}\n`;
                }
                stockSpecificContext += `- คำแนะนำ: ${stock.analysis.recommendation}\n`;
                
                if (stock.news.length > 0) {
                    stockSpecificContext += `- ข่าวล่าสุด: ${stock.news[0].title}\n`;
                }
            }
        }

        return `วันนี้: ${todayEng} (${todayThai})

${newsContext}${stockSpecificContext}

หุ้นที่ลงทุน:
${stockData}

กรุณาสรุปสั้นๆ ในรูปแบบ:
📊 ข่าวสำคัญ (รวมข้อมูลเฉพาะหุ้น)
📈 ผลกระทบต่อหุ้น: ความเสี่ยง 1-10, โอกาสกำไร 1-10
💡 คำแนะนำเฉพาะแต่ละหุ้น`;
    }

    // สร้าง prompt ที่ครอบคลุมพร้อมการวิเคราะห์ความเสี่ยง
    createComprehensiveAnalysisPrompt(stockData, newsData = null, stockAnalysis = [], riskReport = '') {
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

การวิเคราะห์ความเสี่ยงที่ได้ทำไว้:
${riskReport}

กรุณาให้คำแนะนำสั้นๆ เพิ่มเติมในรูปแบบ:
📰 สรุปข่าวที่มีผลกระทบ
🎯 ยืนยันการวิเคราะห์ความเสี่ยง
💭 คำแนะนำเพิ่มเติมจากข่าวปัจจุบัน`;
    }

    // รวมผลการวิเคราะห์
    combineAnalysisResults(aiResponse, riskReport, riskAnalysis) {
        const separator = '\n' + '='.repeat(50) + '\n';
        
        let combinedResult = '🔍 **การวิเคราะห์หุ้นแบบครอบคลุม**\n';
        combinedResult += `📅 **วันที่:** ${new Date().toLocaleDateString('th-TH')}\n\n`;
        
        // เพิ่มรายงานความเสี่ยงแบบละเอียด
        combinedResult += riskReport;
        combinedResult += separator;
        
        // เพิ่มการวิเคราะห์จาก AI
        combinedResult += '🤖 **การวิเคราะห์เพิ่มเติมจาก AI:**\n\n';
        combinedResult += aiResponse;
        combinedResult += separator;
        
        // เพิ่มสรุปข้อมูลเพิ่มเติม
        if (riskAnalysis.length > 0) {
            combinedResult += '📊 **ข้อมูลเพิ่มเติม:**\n';
            
            let totalCurrentValue = 0;
            let totalPurchaseValue = 0;
            
            for (const analysis of riskAnalysis) {
                totalCurrentValue += analysis.currentValue;
                totalPurchaseValue += analysis.purchaseValue;
            }
            
            const totalReturnPct = totalPurchaseValue > 0 ? 
                ((totalCurrentValue - totalPurchaseValue) / totalPurchaseValue) * 100 : 0;
            
            combinedResult += `• มูลค่าพอร์ตรวม: $${totalCurrentValue.toFixed(2)} (≈${(totalCurrentValue * 34.5).toFixed(0)} บาท)\n`;
            combinedResult += `• กำไร/ขาดทุนรวม: ${totalReturnPct >= 0 ? '📈' : '📉'} ${totalReturnPct.toFixed(1)}%\n`;
            combinedResult += `• จำนวนหุ้นที่วิเคราะห์: ${riskAnalysis.length} ตัว\n`;
        }
        
        combinedResult += '\n⏰ **อัปเดตล่าสุด:** ' + new Date().toLocaleString('th-TH');
        
        return combinedResult;
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