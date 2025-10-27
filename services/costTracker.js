const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

class CostTracker {
    constructor() {
        this.costFilePath = path.join(__dirname, '../data/cost-tracking.json');
        this.dataDir = path.join(__dirname, '../data');
        
        // Token pricing per 1K tokens (USD)
        this.pricing = {
            openai: {
                'gpt-4': { input: 0.03, output: 0.06 },
                'gpt-4-turbo': { input: 0.01, output: 0.03 },
                'gpt-3.5-turbo': { input: 0.0015, output: 0.002 },
                'gpt-3.5-turbo-16k': { input: 0.003, output: 0.004 }
            },
            gemini: {
                'gemini-2.5-pro': { input: 0.00125, output: 0.005 },
                'gemini-2.5-flash': { input: 0.000075, output: 0.0003 },
                'gemini-flash-latest': { input: 0.000075, output: 0.0003 }
            }
        };
        
        this.freeTiers = {
            openai: ['gpt-3.5-turbo'], // Free tier models
            gemini: ['gemini-2.5-flash', 'gemini-flash-latest'] // Free tier models
        };
    }

    async initCostTracking() {
        try {
            await fs.mkdir(this.dataDir, { recursive: true });
            
            // Load existing cost data or create new
            try {
                const data = await fs.readFile(this.costFilePath, 'utf8');
                return JSON.parse(data);
            } catch (error) {
                // Create new cost tracking file
                const initialData = {
                    currentMonth: new Date().toISOString().slice(0, 7), // YYYY-MM
                    monthlyUsage: {
                        totalTokens: 0,
                        totalCostUSD: 0,
                        totalCostTHB: 0,
                        sessions: []
                    },
                    currentSession: {
                        timestamp: new Date().toISOString(),
                        tokens: 0,
                        costUSD: 0,
                        costTHB: 0,
                        model: null,
                        provider: null
                    }
                };
                
                await fs.writeFile(this.costFilePath, JSON.stringify(initialData, null, 2));
                return initialData;
            }
        } catch (error) {
            console.error('❌ ข้อผิดพลาดในการเริ่มต้นระบบติดตามค่าใช้จ่าย:', error.message);
            throw error;
        }
    }

    async getExchangeRate() {
        try {
            // Get current USD to THB exchange rate
            const response = await axios.get('https://api.exchangerate-api.com/v4/latest/USD', {
                timeout: 10000
            });
            
            const thbRate = response.data.rates.THB;
            console.log(`💱 อัตราแลกเปลี่ยน: 1 USD = ${thbRate} THB`);
            return thbRate;
            
        } catch (error) {
            console.warn('⚠️ ไม่สามารถดึงอัตราแลกเปลี่ยนได้ ใช้อัตราเริ่มต้น 35 บาท');
            return 35; // Fallback rate
        }
    }

    calculateCost(provider, model, inputTokens, outputTokens) {
        const pricing = this.pricing[provider]?.[model];
        if (!pricing) {
            console.warn(`⚠️ ไม่พบราคาสำหรับ ${provider}:${model}`);
            return { inputCost: 0, outputCost: 0, totalCost: 0 };
        }

        const inputCost = (inputTokens / 1000) * pricing.input;
        const outputCost = (outputTokens / 1000) * pricing.output;
        const totalCost = inputCost + outputCost;

        return { inputCost, outputCost, totalCost };
    }

    isFreeTier(provider, model) {
        return this.freeTiers[provider]?.includes(model) || false;
    }

    async updateCostTracking(provider, model, inputTokens, outputTokens, exchangeRate) {
        try {
            const costData = await this.initCostTracking();
            const currentMonth = new Date().toISOString().slice(0, 7);
            
            // Check if we're in a new month
            if (costData.currentMonth !== currentMonth) {
                // Archive previous month and start new
                costData.currentMonth = currentMonth;
                costData.monthlyUsage = {
                    totalTokens: 0,
                    totalCostUSD: 0,
                    totalCostTHB: 0,
                    sessions: []
                };
            }

            const cost = this.calculateCost(provider, model, inputTokens, outputTokens);
            const totalTokens = inputTokens + outputTokens;
            const costTHB = cost.totalCost * exchangeRate;

            // Update current session
            costData.currentSession = {
                timestamp: new Date().toISOString(),
                tokens: totalTokens,
                costUSD: cost.totalCost,
                costTHB: costTHB,
                model: model,
                provider: provider,
                inputTokens: inputTokens,
                outputTokens: outputTokens,
                exchangeRate: exchangeRate
            };

            // Update monthly usage
            costData.monthlyUsage.totalTokens += totalTokens;
            costData.monthlyUsage.totalCostUSD += cost.totalCost;
            costData.monthlyUsage.totalCostTHB += costTHB;
            costData.monthlyUsage.sessions.push({ ...costData.currentSession });

            // Save updated data
            await fs.writeFile(this.costFilePath, JSON.stringify(costData, null, 2));
            
            console.log(`💰 ติดตามค่าใช้จ่าย: ${totalTokens} tokens, $${cost.totalCost.toFixed(4)} (${costTHB.toFixed(2)} บาท)`);
            
            return costData;
            
        } catch (error) {
            console.error('❌ ข้อผิดพลาดในการอัพเดทค่าใช้จ่าย:', error.message);
            throw error;
        }
    }

    async checkBudgetLimit(monthlyCostLimitTHB) {
        try {
            const costData = await this.initCostTracking();
            const isOverBudget = costData.monthlyUsage.totalCostTHB >= monthlyCostLimitTHB;
            
            if (isOverBudget) {
                console.warn(`⚠️ เกินงบประมาณรายเดือน! ใช้ไป ${costData.monthlyUsage.totalCostTHB.toFixed(2)} บาท จากงบ ${monthlyCostLimitTHB} บาท`);
            }
            
            return {
                isOverBudget,
                currentSpend: costData.monthlyUsage.totalCostTHB,
                budgetLimit: monthlyCostLimitTHB,
                remainingBudget: monthlyCostLimitTHB - costData.monthlyUsage.totalCostTHB
            };
            
        } catch (error) {
            console.error('❌ ข้อผิดพลาดในการตรวจสอบงบประมาณ:', error.message);
            return { isOverBudget: false, currentSpend: 0, budgetLimit: monthlyCostLimitTHB, remainingBudget: monthlyCostLimitTHB };
        }
    }

    async generateCostSummary() {
        try {
            const costData = await this.initCostTracking();
            
            const summary = {
                currentSession: {
                    tokens: costData.currentSession.tokens || 0,
                    costUSD: costData.currentSession.costUSD || 0,
                    costTHB: costData.currentSession.costTHB || 0,
                    model: costData.currentSession.model || 'ไม่ระบุ',
                    provider: costData.currentSession.provider || 'ไม่ระบุ'
                },
                monthlyTotal: {
                    tokens: costData.monthlyUsage.totalTokens || 0,
                    costUSD: costData.monthlyUsage.totalCostUSD || 0,
                    costTHB: costData.monthlyUsage.totalCostTHB || 0,
                    sessions: costData.monthlyUsage.sessions?.length || 0
                }
            };
            
            return summary;
            
        } catch (error) {
            console.error('❌ ข้อผิดพลาดในการสร้างสรุปค่าใช้จ่าย:', error.message);
            return {
                currentSession: { tokens: 0, costUSD: 0, costTHB: 0, model: 'ไม่ระบุ', provider: 'ไม่ระบุ' },
                monthlyTotal: { tokens: 0, costUSD: 0, costTHB: 0, sessions: 0 }
            };
        }
    }
}

module.exports = CostTracker;