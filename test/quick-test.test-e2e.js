#!/usr/bin/env node
require('dotenv').config();

// Set up immediate exit on errors
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('💥 Unhandled Rejection:', reason);
  process.exit(1);
});

// Quick test function
async function quickTest() {
  console.log('🚀 Quick System Test - Will exit immediately on any error\n');
  
  const startTime = Date.now();
  
  // Set a global timeout
  const globalTimeout = setTimeout(() => {
    console.error('⏰ Global timeout reached (10 seconds)');
    process.exit(1);
  }, 10000);
  
  try {
    // Test 1: Stock Data Download
    console.log('1️⃣ Testing stock data download...');
    const StockDataService = require('./../services/stockDataService');
    const stockService = new StockDataService();
    
    const stocks = await Promise.race([
      stockService.getStockList(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Stock data timeout')), 5000)
      )
    ]);
    
    console.log(`✅ Downloaded ${stocks.length} stocks in ${Date.now() - startTime}ms`);
    
    // Test 2: Quick validation
    console.log('\n2️⃣ Validating data...');
    if (stocks.length === 0) {
      throw new Error('No stocks found');
    }
    
    stocks.forEach(stock => {
      if (!stock.symbol || !stock.type) {
        throw new Error(`Invalid stock data: ${JSON.stringify(stock)}`);
      }
    });
    
    console.log('✅ Data validation passed');
    
    // Success
    clearTimeout(globalTimeout);
    const duration = Date.now() - startTime;
    console.log(`\n🎉 SUCCESS! All tests passed in ${duration}ms`);
    console.log('\n📋 Results:');
    stocks.forEach((stock, i) => {
      console.log(`  ${i+1}. ${stock.type} ${stock.symbol} (${stock.amount})`);
    });
    
    console.log('\n✅ System is working! Stock data can be downloaded from Google Drive.');
    console.log('🔧 To enable full functionality, add your API keys to .env file');
    
    process.exit(0);
    
  } catch (error) {
    clearTimeout(globalTimeout);
    console.error(`\n❌ TEST FAILED: ${error.message}`);
    console.error(`Duration: ${Date.now() - startTime}ms`);
    process.exit(1);
  }
}

quickTest();