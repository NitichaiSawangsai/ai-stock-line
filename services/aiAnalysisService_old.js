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
            config.newsApiKey
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
            newsContext = `
🌐 ข้อมูลข่าวสารล่าสุดจากอินเทอร์เน็ต:

📈 ข่าวเศรษฐกิจ:
${newsData.economic.map(news => `• ${news.title}\n  ${news.snippet}\n  แหล่งที่มา: ${news.source} - ${news.url}`).join('\n')}

⚔️ ข่าวภูมิรัฐศาสตร์:
${newsData.geopolitical.map(news => `• ${news.title}\n  ${news.snippet}\n  แหล่งที่มา: ${news.source} - ${news.url}`).join('\n')}

🥇 ข่าวทองคำ:
${newsData.gold.map(news => `• ${news.title}\n  ${news.snippet}\n  แหล่งที่มา: ${news.source} - ${news.url}`).join('\n')}

📈 ข่าวหุ้น:
${newsData.stock.map(news => `• ${news.title}\n  ${news.snippet}\n  แหล่งที่มา: ${news.source} - ${news.url}`).join('\n')}

💎 ข่าวคริปโต:
${newsData.crypto.map(news => `• ${news.title}\n  ${news.snippet}\n  แหล่งที่มา: ${news.source} - ${news.url}`).join('\n')}

💱 ข่าวสกุลเงิน:
${newsData.currency.map(news => `• ${news.title}\n  ${news.snippet}\n  แหล่งที่มา: ${news.source} - ${news.url}`).join('\n')}

สำคัญ: กรุณาใช้ข้อมูลข่าวข้างต้นที่มาจากอินเทอร์เน็ตจริง และอ้างอิง URL จริงในการวิเคราะห์
`;
        } else {
            newsContext = `
⚠️ หมายเหตุ: ไม่สามารถเชื่อมต่อกับอินเทอร์เน็ตเพื่อดึงข่าวล่าสุดได้ 
กรุณาระบุในรายงานว่าข้อมูลเป็นการจำลองและแนะนำให้ผู้ใช้ตรวจสอบข่าวล่าสุดเองเพิ่มเติม
`;
        }

        return `
วันนี้คือ ${todayEng} (${todayThai}) - ปฏิทินไทยใช้พุทธศักราช (พ.ศ.) ซึ่งเพิ่ม 543 ปีจากคริสต์ศักราช

${newsContext}
ข้อมูลต้องเป็นวันนี้ แต่ละข่าวขอ 5 ข่าวต่อวัน ของแต่ละหัวข้อ
ข่าวเศรษกิจ หาทั้งต่างประเทศและประเทศไทย 
ข่าวสงคราม หาทั่วมุมโลกที่จะกระทบกับเศรษฐกิจ
ข่าวทอง หาทั่วมุมโลกที่จะกระทบกับเศรษฐกิจ ขอข้อมูลราคาทองวันนี้เทียบกับ 3 วัน
ข่าวหุ้นไทยและสหรัฐ หาทั่วมุมโลกที่จะกระทบกับเศรษฐกิจ ขอข้อมูลราคาวันนี้เทียบกับ 3 วัน
ข่าวคริปโต  หาทั่วมุมโลกที่จะกระทบกับเศรษฐกิจ ขอข้อมูลราคาวันนี้เทียบกับ 3 วัน
ข่าวสกุลเงิน หาทั่วมุมโลกที่จะกระทบกับเศรษฐกิจ ขอข้อมูลราคาวันนี้เทียบกับ 3 วัน
แต่ละข่าวให้สรุปมาให้เข้าใจกระชับและเข้าใจสถานการณ์อย่างละเอียด ไม่เกิน 1000 ตัวอักษร

ให้นำหุ้นที่อยู่ใน list ไปวิเคาะห์
"
ประเภท ชื่อ จำนวนหุ้นที่ถืออยู่  ราคาที่ซื้อ
${stockData}
"

นำข้อมูลมาวิเคราะห์กับข่าว โดยใช้ข้อมูลปัจจุบันเทียบกับย้อนหลัง 3 วัน
และผลจากวิเคราะห์ข่าวบอกแต่ละข่าวว่าหุ้นไหนมีความเสี่ยง 1-10  10 คือเสี่ยงสุด
และบอกหุ้นไหนที่ลงทุนไว้อาจจะเงินศูนย์หายหรือจะกำลังปิดตัวลงไปเลย 1-10  10 คือเสี่ยงสุด
และผลจากวิเคราะห์ข่าวถ้าซื้อหุ้นใน list ตัวไหนมีโอกาสได้กำไร 1-10 10 คือได้กำไรสูงมากๆ
และผลจากวิเคราะห์ข่าวถ้าไม่ขาย หุ้นใน list มีโอกาสหุ้นตกเท่าไร - 1-10  -10 คือหุ้นหาย เงินหายเลย 
และให้นำผลหุ้นใน list ที่ลงทุนมาเทียบกับราคาปัจจุบัน ว่าได้ + หรือ ได้ - กี่เปอร์เซ็น กำไรได้กี่บาท
และบอกความเชื่อถือของแหล่งข่าวที่เอามา 1-10 10 คือ น่าเชื่อถือมากๆๆ
และขอ URL ที่เอาข้อมูลเอาข่าวมาแต่ละอัน
และบอกว่าความมั่นใจ AI ในการวิเคราะห์ในครั้งนี้ 1-10 10 คือ น่าเชื่อถือมากๆๆ

โดยสรุปมาเป็นภาษาไทยอ่านง่าย ไม่ใช้ภาษาอังกฤษสลับไทยให้ใช้ภาษาไทย 100 %
ขอแบบสรุปที่วางในไฟล์ txt ที่จัดระเบียบอ่านง่าย มีไอคอนแต่ละหัวข้อที่หาสามารถหาได้ง่าย 
และสามารถ copy text ง่ายๆถ้าทำเป็น ตารางใน txt แล้วอ่านยากให้เปลี่ยนแบบสรุปให้อ่านง่ายแทนตารางสรุปความเสี่ยงและโอกาส (10 คือเสี่ยง/กำไรสูงที่สุด)
ไม่ต้องเป็น ตาราง ให้เป็น text อ่านเข้าใจง่ายพอ
`.trim();
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
            if (prompt.length > 8000) {
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
    }    async generateCostSummary() {
        try {
            const summary = await this.costTracker.generateCostSummary();
            
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

อัตราแลกเปลี่ยน: 1 USD = ${summary.currentSession.exchangeRate || 35} THB
`.trim();

            return summaryText;
            
        } catch (error) {
            logger.error('ข้อผิดพลาดในการสร้างสรุปค่าใช้จ่าย', error.message);
            return '❌ ไม่สามารถสร้างสรุปค่าใช้จ่ายได้';
        }
    }
}

module.exports = AIAnalysisService;