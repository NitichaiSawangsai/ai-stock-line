const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');

class StockDataService {
    constructor(stockDataUrl) {
        this.stockDataUrl = stockDataUrl;
        this.dataDir = path.join(__dirname, '../data');
    }

    async downloadStockData() {
        try {
            logger.process('กำลังดาวน์โหลดข้อมูลหุ้น...');
            
            // Ensure data directory exists
            await fs.mkdir(this.dataDir, { recursive: true });
            
            const response = await axios.get(this.stockDataUrl, {
                timeout: 30000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            // Save raw data
            const rawDataPath = path.join(this.dataDir, 'raw-stock-data.txt');
            await fs.writeFile(rawDataPath, response.data, 'utf8');
            
            logger.success('ดาวน์โหลดข้อมูลหุ้นสำเร็จ');
            return response.data;
            
        } catch (error) {
            logger.error('ข้อผิดพลาดในการดาวน์โหลดข้อมูลหุ้น', error.message);
            throw new Error(`ไม่สามารถดาวน์โหลดข้อมูลหุ้นได้: ${error.message}`);
        }
    }

    parseStockData(rawData) {
        try {
            logger.process('กำลังประมวลผลข้อมูลหุ้น...');
            
            const lines = rawData.split('\n').filter(line => line.trim());
            const stockList = [];
            
            for (const line of lines) {
                // Skip header line
                if (line.includes('ประเภท') || line.includes('ชื่อ') || line.includes('จำนวนหุ้น')) {
                    continue;
                }
                
                // Parse each line - expected format: ประเภท ชื่อ จำนวนหุ้นที่ถืออยู่ [ราคาที่ซื้อ]
                const parts = line.trim().split(/\s+/);
                if (parts.length >= 3) {
                    const type = parts[0];
                    const symbol = parts[1];
                    const amount = parts[2];
                    const purchasePrice = parts.length > 3 ? parts[3] : '-';
                    
                    stockList.push({
                        type: type,
                        symbol: symbol,
                        amount: amount,
                        purchasePrice: purchasePrice,
                        originalLine: line.trim()
                    });
                }
            }
            
            logger.success(`ประมวลผลข้อมูลเสร็จ พบหุ้น ${stockList.length} รายการ`);
            return stockList;
            
        } catch (error) {
            logger.error('ข้อผิดพลาดในการประมวลผลข้อมูล', error.message);
            throw new Error(`ไม่สามารถประมวลผลข้อมูลหุ้นได้: ${error.message}`);
        }
    }

    formatStockListForPrompt(stockList) {
        let formattedList = '';
        
        for (const stock of stockList) {
            if (stock.amount !== '-' && stock.purchasePrice !== '-') {
                // Has both amount and price
                formattedList += `${stock.type} ${stock.symbol} ${stock.amount} ${stock.purchasePrice}\n`;
            } else if (stock.amount !== '-') {
                // Has amount but no price
                formattedList += `${stock.type} ${stock.symbol} ${stock.amount} -\n`;
            } else {
                // No amount or price
                formattedList += `${stock.type} ${stock.symbol} - -\n`;
            }
        }
        
        return formattedList.trim();
    }

    async getFormattedStockData() {
        try {
            const rawData = await this.downloadStockData();
            const stockList = this.parseStockData(rawData);
            const formattedData = this.formatStockListForPrompt(stockList);
            
            // Save formatted data
            const formattedPath = path.join(this.dataDir, 'formatted-stock-data.txt');
            await fs.writeFile(formattedPath, formattedData, 'utf8');
            
            return {
                stockList,
                formattedData
            };
            
        } catch (error) {
            logger.error('ข้อผิดพลาดในการรับข้อมูลหุ้น', error.message);
            throw error;
        }
    }
}

module.exports = StockDataService;