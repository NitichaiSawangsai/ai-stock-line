const axios = require('axios');
const winston = require('winston');

// สร้าง logger สำหรับ Price Conversion
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => {
            return `${timestamp} [PRICE-CONVERTER] [${level.toUpperCase()}]: ${message}`;
        })
    ),
    transports: [
        new winston.transports.Console()
    ]
});

class PriceConversionService {
    constructor() {
        // Exchange rates cache (อัพเดททุก 1 ชั่วโมง)
        this.exchangeRatesCache = {
            data: {},
            lastUpdate: null,
            cacheExpiry: 60 * 60 * 1000 // 1 hour
        };
        
        // API endpoints for price data
        this.priceAPIs = {
            forex: 'https://api.exchangerate-api.com/v4/latest/USD',
            crypto: 'https://api.coingecko.com/api/v3/simple/price',
            stock: 'https://query1.finance.yahoo.com/v8/finance/chart/',
            gold: 'https://api.metals.live/v1/spot/gold'
        };
    }

    /**
     * หาราคาปัจจุบันของ asset และแปลงเป็นเงินไทย
     */
    async getCurrentPriceInTHB(symbol, type) {
        try {
            logger.info(`💰 Getting current price for ${symbol} (${type})`);
            
            let priceData = null;
            
            switch (type.toLowerCase()) {
                case 'หุ้น':
                case 'stock':
                    priceData = await this.getStockPrice(symbol);
                    break;
                case 'สกุลเงิน':
                case 'currency':
                case 'forex':
                    priceData = await this.getCurrencyPrice(symbol);
                    break;
                case 'crypto':
                case 'cryptocurrency':
                    priceData = await this.getCryptoPrice(symbol);
                    break;
                case 'ทอง':
                case 'gold':
                    priceData = await this.getGoldPrice();
                    break;
                default:
                    // พยายามหาราคาแบบ auto-detect
                    priceData = await this.autoDetectPrice(symbol);
            }
            
            if (priceData) {
                const thbPrice = await this.convertToTHB(priceData.price, priceData.currency);
                
                return {
                    symbol: symbol,
                    type: type,
                    currentPrice: priceData.price,
                    currency: priceData.currency,
                    priceInTHB: thbPrice,
                    source: priceData.source,
                    timestamp: new Date().toISOString()
                };
            }
            
            throw new Error(`Cannot find price for ${symbol}`);
            
        } catch (error) {
            logger.error(`❌ Error getting price for ${symbol}: ${error.message}`);
            
            // Return fallback data
            return {
                symbol: symbol,
                type: type,
                currentPrice: 'N/A',
                currency: 'N/A',
                priceInTHB: 'N/A',
                source: 'unavailable',
                timestamp: new Date().toISOString(),
                error: error.message
            };
        }
    }

    /**
     * หาราคาหุ้นจาก Yahoo Finance
     */
    async getStockPrice(symbol) {
        try {
            const response = await axios.get(`${this.priceAPIs.stock}${symbol}`, {
                timeout: 10000
            });
            
            const data = response.data;
            if (data.chart && data.chart.result && data.chart.result[0]) {
                const result = data.chart.result[0];
                const price = result.meta.regularMarketPrice || result.meta.previousClose;
                const currency = result.meta.currency || 'USD';
                
                return {
                    price: price,
                    currency: currency,
                    source: 'Yahoo Finance'
                };
            }
            
            throw new Error('No price data found');
        } catch (error) {
            logger.warn(`⚠️ Yahoo Finance failed for ${symbol}: ${error.message}`);
            throw error;
        }
    }

    /**
     * หาราคาสกุลเงินจาก Exchange Rate API
     */
    async getCurrencyPrice(currency) {
        try {
            const rates = await this.getExchangeRates();
            
            if (currency === 'USD') {
                return {
                    price: 1,
                    currency: 'USD',
                    source: 'Exchange Rate API'
                };
            }
            
            if (rates[currency]) {
                return {
                    price: rates[currency],
                    currency: 'USD',
                    source: 'Exchange Rate API'
                };
            }
            
            throw new Error(`Currency ${currency} not found`);
        } catch (error) {
            logger.warn(`⚠️ Exchange rate failed for ${currency}: ${error.message}`);
            throw error;
        }
    }

    /**
     * หาราคา Crypto จาก CoinGecko
     */
    async getCryptoPrice(symbol) {
        try {
            const cryptoIds = {
                'BTC': 'bitcoin',
                'ETH': 'ethereum',
                'USDT': 'tether',
                'BNB': 'binancecoin',
                'ADA': 'cardano',
                'XRP': 'ripple',
                'SOL': 'solana',
                'DOT': 'polkadot'
            };
            
            const coinId = cryptoIds[symbol.toUpperCase()] || symbol.toLowerCase();
            
            const response = await axios.get(this.priceAPIs.crypto, {
                params: {
                    ids: coinId,
                    vs_currencies: 'usd'
                },
                timeout: 10000
            });
            
            if (response.data[coinId] && response.data[coinId].usd) {
                return {
                    price: response.data[coinId].usd,
                    currency: 'USD',
                    source: 'CoinGecko'
                };
            }
            
            throw new Error(`Crypto ${symbol} not found`);
        } catch (error) {
            logger.warn(`⚠️ CoinGecko failed for ${symbol}: ${error.message}`);
            throw error;
        }
    }

    /**
     * หาราคาทองจาก Metals API
     */
    async getGoldPrice() {
        try {
            const response = await axios.get(this.priceAPIs.gold, {
                timeout: 10000
            });
            
            if (response.data && response.data.price) {
                return {
                    price: response.data.price,
                    currency: 'USD',
                    source: 'Metals Live'
                };
            }
            
            throw new Error('Gold price not available');
        } catch (error) {
            logger.debug(`🔧 Gold price API failed: ${error.message}`);
            
            // Fallback: ราคาทองประมาณ (per ounce)
            return {
                price: 2000, // Approximate gold price per ounce
                currency: 'USD',
                source: 'Estimated'
            };
        }
    }

    /**
     * Auto-detect ประเภท asset และหาราคา
     */
    async autoDetectPrice(symbol) {
        try {
            // ลอง crypto ก่อน
            try {
                return await this.getCryptoPrice(symbol);
            } catch (cryptoError) {
                // ลอง stock
                try {
                    return await this.getStockPrice(symbol);
                } catch (stockError) {
                    // ลอง currency
                    try {
                        return await this.getCurrencyPrice(symbol);
                    } catch (currencyError) {
                        throw new Error(`Cannot detect price type for ${symbol}`);
                    }
                }
            }
        } catch (error) {
            logger.error(`❌ Auto-detect failed for ${symbol}: ${error.message}`);
            throw error;
        }
    }

    /**
     * แปลงราคาเป็นเงินไทย
     */
    async convertToTHB(price, fromCurrency) {
        try {
            if (fromCurrency === 'THB') {
                return price;
            }
            
            const rates = await this.getExchangeRates();
            
            if (fromCurrency === 'USD') {
                const usdToThb = rates.THB || 35; // Fallback rate
                return price * usdToThb;
            }
            
            // Convert via USD
            if (rates[fromCurrency]) {
                const usdPrice = price / rates[fromCurrency];
                const thbRate = rates.THB || 35;
                return usdPrice * thbRate;
            }
            
            throw new Error(`Cannot convert ${fromCurrency} to THB`);
            
        } catch (error) {
            logger.error(`❌ Currency conversion failed: ${error.message}`);
            return 'N/A';
        }
    }

    /**
     * รับ exchange rates และ cache ไว้
     */
    async getExchangeRates() {
        try {
            const now = Date.now();
            
            // ใช้ cache ถ้ายังไม่หมดอายุ
            if (this.exchangeRatesCache.lastUpdate && 
                (now - this.exchangeRatesCache.lastUpdate) < this.exchangeRatesCache.cacheExpiry) {
                return this.exchangeRatesCache.data;
            }
            
            logger.info('🔄 Fetching fresh exchange rates...');
            
            const response = await axios.get(this.priceAPIs.forex, {
                timeout: 15000
            });
            
            if (response.data && response.data.rates) {
                this.exchangeRatesCache.data = response.data.rates;
                this.exchangeRatesCache.lastUpdate = now;
                
                logger.info(`✅ Exchange rates updated: ${Object.keys(response.data.rates).length} currencies`);
                return response.data.rates;
            }
            
            throw new Error('Invalid exchange rate response');
            
        } catch (error) {
            logger.warn(`⚠️ Exchange rate API failed: ${error.message}`);
            
            // Use cache even if expired, or fallback rates
            if (this.exchangeRatesCache.data && Object.keys(this.exchangeRatesCache.data).length > 0) {
                logger.info('📦 Using cached exchange rates');
                return this.exchangeRatesCache.data;
            }
            
            // Fallback rates
            return {
                'THB': 35.0,
                'EUR': 0.85,
                'GBP': 0.73,
                'JPY': 110.0,
                'CNY': 6.4
            };
        }
    }

    /**
     * Format ราคาให้อ่านง่าย
     */
    formatPrice(price, currency) {
        try {
            if (price === 'N/A' || !price) {
                return 'N/A';
            }
            
            const numPrice = parseFloat(price);
            
            if (currency === 'THB') {
                return `${numPrice.toLocaleString('th-TH', { 
                    minimumFractionDigits: 2, 
                    maximumFractionDigits: 2 
                })} บาท`;
            }
            
            return `${numPrice.toLocaleString('en-US', { 
                minimumFractionDigits: 2, 
                maximumFractionDigits: 6 
            })} ${currency}`;
            
        } catch (error) {
            logger.error(`❌ Price formatting error: ${error.message}`);
            return `${price} ${currency}`;
        }
    }
}

module.exports = PriceConversionService;