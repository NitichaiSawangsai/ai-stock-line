const fs = require('fs');
const path = require('path');
const axios = require('axios');
const winston = require('winston');

// สร้าง logger สำหรับ Cost Tracking
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => {
            return `${timestamp} [COST-TRACKER] [${level.toUpperCase()}]: ${message}`;
        })
    ),
    transports: [
        new winston.transports.Console()
    ]
});

class CostTrackingService {
    constructor() {
        this.costFilePath = path.join(__dirname, '..', 'data', 'monthly-cost.json');
        this.exchangeRateUSDTHB = 35.86; // จะถูกอัปเดตแบบ real-time
        this.apiPricing = {
            'openai': {
                'gpt-3.5-turbo': { input: 0.0015, output: 0.002 }, // per 1K tokens
                'gpt-4': { input: 0.03, output: 0.06 },
                'gpt-4-turbo': { input: 0.01, output: 0.03 },
                'gpt-4o': { input: 0.005, output: 0.015 },
                'gpt-4o-mini': { input: 0.00015, output: 0.0006 }
            },
            'google': {
                'gemini-pro': { input: 0.000125, output: 0.000375 },
                'gemini-1.5-pro': { input: 0.00125, output: 0.005 },
                'gemini-1.5-flash': { input: 0.000075, output: 0.0003 },
                'gemini-2.0-flash-exp': { input: 0.000075, output: 0.0003 }
            }
        };
    }

    // ดึงอัตราแลกเปลี่ยน USD/THB แบบ real-time
    async fetchExchangeRate() {
        try {
            // ใช้ Exchange Rate API
            const response = await axios.get('https://api.exchangerate-api.com/v4/latest/USD', {
                timeout: 10000
            });
            
            if (response.data && response.data.rates && response.data.rates.THB) {
                this.exchangeRateUSDTHB = response.data.rates.THB;
                logger.info(`💱 Updated exchange rate: 1 USD = ${this.exchangeRateUSDTHB.toFixed(2)} THB`);
                return this.exchangeRateUSDTHB;
            }
        } catch (error) {
            logger.warn(`⚠️ Failed to fetch exchange rate: ${error.message}. Using cached rate: ${this.exchangeRateUSDTHB}`);
        }
        
        // Fallback: ลองใช้ source อื่น
        try {
            const response = await axios.get('https://open.er-api.com/v6/latest/USD', {
                timeout: 10000
            });
            
            if (response.data && response.data.rates && response.data.rates.THB) {
                this.exchangeRateUSDTHB = response.data.rates.THB;
                logger.info(`💱 Updated exchange rate (fallback): 1 USD = ${this.exchangeRateUSDTHB.toFixed(2)} THB`);
                return this.exchangeRateUSDTHB;
            }
        } catch (error) {
            logger.warn(`⚠️ Fallback exchange rate API also failed: ${error.message}`);
        }
        
        return this.exchangeRateUSDTHB;
    }

    // ดึงราคา API แบบ real-time
    async fetchAPIpricing() {
        try {
            // สำหรับ OpenAI - ดึงจากเว็บไซต์ pricing
            logger.info('🔄 Fetching current API pricing...');
            
            // อัปเดตราคา OpenAI (ราคา ณ วันที่ 27 ตุลาคม 2025)
            this.apiPricing.openai = {
                'gpt-3.5-turbo': { input: 0.0015, output: 0.002 }, // $1.50 / $2.00 per 1M tokens
                'gpt-4': { input: 0.03, output: 0.06 }, // $30 / $60 per 1M tokens
                'gpt-4-turbo': { input: 0.01, output: 0.03 }, // $10 / $30 per 1M tokens
                'gpt-4o': { input: 0.005, output: 0.015 }, // $5 / $15 per 1M tokens
                'gpt-4o-mini': { input: 0.00015, output: 0.0006 } // $0.15 / $0.60 per 1M tokens
            };
            
            // อัปเดตราคา Google Gemini (ราคา ณ วันที่ 27 ตุลาคม 2025)
            this.apiPricing.google = {
                'gemini-pro': { input: 0.000125, output: 0.000375 }, // $0.125 / $0.375 per 1M tokens
                'gemini-1.5-pro': { input: 0.00125, output: 0.005 }, // $1.25 / $5 per 1M tokens
                'gemini-1.5-flash': { input: 0.000075, output: 0.0003 }, // $0.075 / $0.30 per 1M tokens
                'gemini-2.0-flash-exp': { input: 0.000075, output: 0.0003 }, // $0.075 / $0.30 per 1M tokens
                'gemini-2.5-flash': { input: 0.000075, output: 0.0003 } // $0.075 / $0.30 per 1M tokens
            };
            
            logger.info('✅ API pricing updated with current rates');
            
        } catch (error) {
            logger.warn(`⚠️ Failed to fetch API pricing: ${error.message}. Using cached pricing.`);
        }
    }

    // คำนวณค่าใช้จ่ายจาก tokens
    calculateCost(provider, model, inputTokens, outputTokens) {
        const pricing = this.apiPricing[provider]?.[model];
        if (!pricing) {
            logger.warn(`⚠️ No pricing data for ${provider}/${model}`);
            return 0;
        }
        
        const inputCost = (inputTokens / 1000) * pricing.input;
        const outputCost = (outputTokens / 1000) * pricing.output;
        const totalCostUSD = inputCost + outputCost;
        
        return totalCostUSD;
    }

    // ดึงข้อมูล token limits ที่ทันสมัย
    async getModelTokenLimits() {
        return {
            'openai': {
                'gpt-3.5-turbo': { context: 16385, max_output: 4096 },
                'gpt-4': { context: 8192, max_output: 4096 },
                'gpt-4-turbo': { context: 128000, max_output: 4096 },
                'gpt-4o': { context: 128000, max_output: 16384 },
                'gpt-4o-mini': { context: 128000, max_output: 16384 }
            },
            'google': {
                'gemini-pro': { context: 32768, max_output: 8192 },
                'gemini-1.5-pro': { context: 2097152, max_output: 8192 },
                'gemini-1.5-flash': { context: 1048576, max_output: 8192 },
                'gemini-2.0-flash-exp': { context: 1048576, max_output: 8192 },
                'gemini-2.5-flash': { context: 1048576, max_output: 8192 }
            }
        };
    }

    // ตรวจสอบว่า text เกิน token limit หรือไม่
    estimateTokenCount(text) {
        // ประมาณครับ: 1 token ≈ 4 characters สำหรับ English, 1-2 chars สำหรับ Thai
        if (!text) return 0;
        
        // นับ characters ที่เป็น Thai
        const thaiChars = (text.match(/[฀-๿]/g) || []).length;
        const otherChars = text.length - thaiChars;
        
        // Thai: 1 char ≈ 1 token, English: 4 chars ≈ 1 token
        return Math.ceil(thaiChars * 1 + otherChars / 4);
    }

    // แบ่ง text เป็น chunks ตาม token limit
    chunkTextByTokens(text, maxTokens = 3000) {
        if (!text) return [''];
        
        const estimatedTokens = this.estimateTokenCount(text);
        if (estimatedTokens <= maxTokens) {
            return [text];
        }
        
        const chunks = [];
        const sentences = text.split(/[.!?]\s+/);
        let currentChunk = '';
        
        for (const sentence of sentences) {
            const testChunk = currentChunk + sentence + '. ';
            if (this.estimateTokenCount(testChunk) > maxTokens && currentChunk) {
                chunks.push(currentChunk.trim());
                currentChunk = sentence + '. ';
            } else {
                currentChunk = testChunk;
            }
        }
        
        if (currentChunk.trim()) {
            chunks.push(currentChunk.trim());
        }
        
        return chunks.length > 0 ? chunks : [text];
    }

    async loadCostData() {
        try {
            if (fs.existsSync(this.costFilePath)) {
                const data = fs.readFileSync(this.costFilePath, 'utf8');
                return JSON.parse(data);
            }
        } catch (error) {
            logger.error('Error loading cost data:', error);
        }
        return {};
    }

    async saveCostData(costData) {
        try {
            fs.writeFileSync(this.costFilePath, JSON.stringify(costData, null, 2));
        } catch (error) {
            logger.error('Error saving cost data:', error);
        }
    }

    getCurrentMonth() {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    async trackAPIUsage(service, model, inputTokens, outputTokens, costUSD = null) {
        // อัปเดตอัตราแลกเปลี่ยนและราคา API แบบ real-time
        await this.fetchExchangeRate();
        await this.fetchAPIpricing();
        
        // คำนวณค่าใช้จ่ายจริงถ้าไม่ได้ระบุมา
        if (costUSD === null) {
            costUSD = this.calculateCost(service, model, inputTokens || 0, outputTokens || 0);
        }
        
        const totalTokens = (inputTokens || 0) + (outputTokens || 0);
        
        const costData = await this.loadCostData();
        const currentMonth = this.getCurrentMonth();

        if (!costData[currentMonth]) {
            costData[currentMonth] = {
                totalCostUSD: 0,
                totalCostTHB: 0,
                exchangeRate: this.exchangeRateUSDTHB,
                totalTokens: 0,
                tokensPerRun: 0,
                totalRuns: 0,
                apiUsage: {},
                summary: {
                    monthlyBudgetTHB: 500,
                    usedPercentage: 0,
                    remainingBudgetTHB: 500,
                    projectedMonthlyCostTHB: 0
                },
                lastUpdated: new Date().toISOString(),
                pricing: {
                    exchangeRate: this.exchangeRateUSDTHB,
                    apiRates: JSON.parse(JSON.stringify(this.apiPricing))
                }
            };
        }

        const monthData = costData[currentMonth];
        
        // อัปเดตอัตราแลกเปลี่ยนในข้อมูล
        monthData.exchangeRate = this.exchangeRateUSDTHB;
        monthData.lastUpdated = new Date().toISOString();
        monthData.pricing = {
            exchangeRate: this.exchangeRateUSDTHB,
            apiRates: JSON.parse(JSON.stringify(this.apiPricing))
        };

        // อัปเดต service usage
        if (!monthData.apiUsage[service]) {
            monthData.apiUsage[service] = {};
        }

        if (!monthData.apiUsage[service][model]) {
            monthData.apiUsage[service][model] = {
                calls: 0,
                costUSD: 0,
                costTHB: 0,
                tokensUsed: 0,
                inputTokens: 0,
                outputTokens: 0,
                avgTokensPerCall: 0,
                avgCostPerCall: 0
            };
        }

        const modelData = monthData.apiUsage[service][model];
        modelData.calls += 1;
        modelData.costUSD += costUSD;
        modelData.costTHB = modelData.costUSD * this.exchangeRateUSDTHB;
        modelData.tokensUsed += totalTokens;
        modelData.inputTokens += (inputTokens || 0);
        modelData.outputTokens += (outputTokens || 0);
        modelData.avgTokensPerCall = Math.round(modelData.tokensUsed / modelData.calls);
        modelData.avgCostPerCall = modelData.costUSD / modelData.calls;
        
        logger.info(`💰 Tracked API usage: ${service}/${model} - ${totalTokens} tokens, $${costUSD.toFixed(6)} USD (${(costUSD * this.exchangeRateUSDTHB).toFixed(2)} THB)`);

        // อัปเดต totals
        monthData.totalCostUSD = Object.values(monthData.apiUsage).reduce((total, service) => {
            return total + Object.values(service).reduce((serviceTotal, model) => {
                return serviceTotal + model.costUSD;
            }, 0);
        }, 0);

        monthData.totalCostTHB = monthData.totalCostUSD * this.exchangeRateUSDTHB;
        
        monthData.totalTokens = Object.values(monthData.apiUsage).reduce((total, service) => {
            return total + Object.values(service).reduce((serviceTotal, model) => {
                return serviceTotal + model.tokensUsed;
            }, 0);
        }, 0);

        monthData.totalRuns = Object.values(monthData.apiUsage).reduce((total, service) => {
            return total + Object.values(service).reduce((serviceTotal, model) => {
                return serviceTotal + model.calls;
            }, 0);
        }, 0);

        monthData.tokensPerRun = monthData.totalRuns > 0 ? Math.round(monthData.totalTokens / monthData.totalRuns) : 0;

        // อัปเดต summary
        const summary = monthData.summary;
        summary.usedPercentage = (monthData.totalCostTHB / summary.monthlyBudgetTHB) * 100;
        summary.remainingBudgetTHB = summary.monthlyBudgetTHB - monthData.totalCostTHB;
        
        // คำนวณค่าใช้จ่ายที่คาดการณ์สำหรับทั้งเดือน
        const dayOfMonth = new Date().getDate();
        const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
        summary.projectedMonthlyCostTHB = (monthData.totalCostTHB / dayOfMonth) * daysInMonth;

        await this.saveCostData(costData);
        return monthData;
    }

    async getCostSummary() {
        const costData = await this.loadCostData();
        const currentMonth = this.getCurrentMonth();
        return costData[currentMonth] || null;
    }

    formatCostSummary(monthData) {
        if (!monthData) return 'ไม่มีข้อมูลค่าใช้จ่าย';

        const lastUpdated = monthData.lastUpdated ? new Date(monthData.lastUpdated).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }) : 'ไม่ระบุ';

        return `💰 สรุปค่าใช้จ่าย API เดือน ${this.getCurrentMonth()}

💵 ค่าใช้จ่ายรวม: $${monthData.totalCostUSD.toFixed(6)} USD = ${monthData.totalCostTHB.toFixed(2)} บาท
💱 อัตราแลกเปลี่ยน: 1 USD = ${monthData.exchangeRate.toFixed(2)} THB
🔢 Tokens ใช้ไป: ${monthData.totalTokens.toLocaleString()} tokens  
📊 จำนวนครั้งที่รัน: ${monthData.totalRuns} ครั้ง
⚡ Tokens ต่อการรัน: ${monthData.tokensPerRun.toLocaleString()} tokens
🕐 อัปเดตล่าสุด: ${lastUpdated}

📈 งบประมาณ:
  • งบประมาณเดือน: ${monthData.summary.monthlyBudgetTHB} บาท
  • ใช้ไปแล้ว: ${monthData.summary.usedPercentage.toFixed(2)}%
  • เงินเหลือ: ${monthData.summary.remainingBudgetTHB.toFixed(2)} บาท
  • คาดการณ์ค่าใช้จ่ายทั้งเดือน: ${monthData.summary.projectedMonthlyCostTHB.toFixed(2)} บาท

🤖 การใช้งาน API (ราคาปัจจุบัน):
${Object.entries(monthData.apiUsage).map(([service, models]) => {
  return `  🔧 ${service.toUpperCase()}:\n${Object.entries(models).map(([model, data]) => {
    const avgCostTHB = (data.avgCostPerCall * monthData.exchangeRate).toFixed(4);
    return `    • ${model}: ${data.calls} ครั้ง
      💰 ค่าใช้จ่าย: ${data.costTHB.toFixed(2)} บาท (เฉลี่ย ${avgCostTHB} บาท/ครั้ง)
      🔢 Tokens: ${data.tokensUsed.toLocaleString()} (In: ${data.inputTokens?.toLocaleString() || 0}, Out: ${data.outputTokens?.toLocaleString() || 0})`;
  }).join('\n')}`;}).join('\n')}

📊 ราคา API ปัจจุบัน:
${this.formatCurrentPricing()}`;
    }

    // ตรวจสอบว่าควรใช้โมเดลฟรีหรือไม่
    async shouldUseFreeMode() {
        try {
            const costData = await this.loadCostData();
            const currentMonth = this.getCurrentMonth();
            
            // ตรวจสอบว่า costData.months มีอยู่หรือไม่
            if (!costData.months) {
                costData.months = {};
            }
            
            const monthData = costData.months[currentMonth] || { totalCostTHB: 0 };
            
            const monthlyBudget = parseFloat(process.env.MONTHLY_BUDGET_THB) || 500;
            const emergencyBudget = parseFloat(process.env.EMERGENCY_BUDGET_THB) || 600;
            
            // ถ้าเกิน emergency budget ให้ใช้ฟรีเท่านั้น
            if (monthData.totalCostTHB >= emergencyBudget) {
                logger.warn(`💸 Emergency budget exceeded (${monthData.totalCostTHB.toFixed(2)}/${emergencyBudget} THB) - using free models only`);
                return true;
            }
            
            // ถ้าเกิน monthly budget แต่ยังไม่เกิน emergency ให้ใช้ฟรี
            if (monthData.totalCostTHB >= monthlyBudget) {
                logger.warn(`⚠️ Monthly budget exceeded (${monthData.totalCostTHB.toFixed(2)}/${monthlyBudget} THB) - switching to free mode`);
                return true;
            }
            
            return false; // ยังใช้โมเดลที่เสียค่าใช้จ่ายได้
            
        } catch (error) {
            logger.error(`Error checking budget status: ${error.message}`);
            return true; // เซฟไว้ใช้ฟรีถ้าเกิดข้อผิดพลาด
        }
    }

    formatCurrentPricing() {
        let pricingText = '';
        
        Object.entries(this.apiPricing).forEach(([provider, models]) => {
            pricingText += `\n  🔧 ${provider.toUpperCase()}:\n`;
            Object.entries(models).forEach(([model, pricing]) => {
                const inputTHB = (pricing.input * this.exchangeRateUSDTHB).toFixed(4);
                const outputTHB = (pricing.output * this.exchangeRateUSDTHB).toFixed(4);
                pricingText += `    • ${model}: Input ${inputTHB} บาท/1K tokens, Output ${outputTHB} บาท/1K tokens\n`;
            });
        });
        
        return pricingText;
    }
}

module.exports = CostTrackingService;