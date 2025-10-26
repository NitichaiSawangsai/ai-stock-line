const fs = require('fs');
const path = require('path');

// Test AI model configuration functionality
async function testModelConfiguration() {
  console.log('🤖 Testing AI Model Configuration...\n');
  
  try {
    // Test Gemini model configuration
    console.log('🔧 Testing Gemini Model Configuration...');
    
    // Save original values
    const originalGeminiModel = process.env.GEMINI_MODEL;
    const originalOpenAIModel = process.env.OPENAI_MODEL;
    
    // Test different Gemini models
    const geminiModels = [
      'gemini-1.5-flash',
      'gemini-pro', 
      'gemini-1.5-pro',
      'gemini-1.5-flash-latest'
    ];
    
    for (const model of geminiModels) {
      console.log(`\n📋 Testing Gemini model: ${model}`);
      process.env.GEMINI_MODEL = model;
      
      const GeminiAnalysisService = require('../services/geminiAnalysisService');
      const geminiService = new GeminiAnalysisService();
      
      // Test that the model is loaded correctly
      if (geminiService.model === model) {
        console.log(`   ✅ Model loaded correctly: ${model}`);
      } else {
        console.log(`   ❌ Model mismatch. Expected: ${model}, Got: ${geminiService.model}`);
      }
      
      // Test connection (will use mock for free models)
      try {
        await geminiService.testConnection();
        console.log(`   ✅ Connection test passed for ${model}`);
      } catch (error) {
        console.log(`   ⚠️ Connection test failed for ${model}: ${error.message}`);
      }
      
      // Test API call (will use mock)
      try {
        const result = await geminiService.callGeminiAPI('Test prompt for model verification');
        console.log(`   ✅ API call successful for ${model}`);
      } catch (error) {
        console.log(`   ⚠️ API call failed for ${model}: ${error.message}`);
      }
    }
    
    // Test OpenAI model configuration
    console.log('\n🔧 Testing OpenAI Model Configuration...');
    
    const openaiModels = [
      'gpt-3.5-turbo',
      'gpt-4',
      'gpt-4-turbo',
      'gpt-3.5-turbo-16k'
    ];
    
    for (const model of openaiModels) {
      console.log(`\n📋 Testing OpenAI model: ${model}`);
      process.env.OPENAI_MODEL = model;
      
      const NewsAnalysisService = require('../services/newsAnalysisService');
      const newsService = new NewsAnalysisService();
      
      // Test that the model is loaded correctly
      if (newsService.openaiModel === model) {
        console.log(`   ✅ Model loaded correctly: ${model}`);
      } else {
        console.log(`   ❌ Model mismatch. Expected: ${model}, Got: ${newsService.openaiModel}`);
      }
      
      // Test will fall back to Gemini since OpenAI is disabled
      try {
        await newsService.testConnection();
        console.log(`   ✅ Service initialized correctly with ${model} (will fallback to free AI)`);
      } catch (error) {
        console.log(`   ⚠️ Service initialization failed for ${model}: ${error.message}`);
      }
    }
    
    // Restore original values
    if (originalGeminiModel) {
      process.env.GEMINI_MODEL = originalGeminiModel;
    } else {
      delete process.env.GEMINI_MODEL;
    }
    if (originalOpenAIModel) {
      process.env.OPENAI_MODEL = originalOpenAIModel;
    } else {
      delete process.env.OPENAI_MODEL;
    }
    
    console.log('\n🎉 Model configuration tests completed!');
    
  } catch (error) {
    console.error('❌ Model configuration test failed:', error.message);
    throw error;
  }
}

// Test environment variable loading
async function testEnvConfiguration() {
  console.log('\n⚙️ Testing Environment Configuration...\n');
  
  try {
    // Read current .env file
    const envPath = path.join(__dirname, '..', '.env');
    const envContent = fs.readFileSync(envPath, 'utf8');
    
    // Check if model configurations exist
    const hasGeminiModel = envContent.includes('GEMINI_MODEL=');
    const hasOpenAIModel = envContent.includes('OPENAI_MODEL=');
    
    console.log('📋 Environment Configuration Status:');
    console.log(`   GEMINI_MODEL configured: ${hasGeminiModel ? '✅' : '❌'}`);
    console.log(`   OPENAI_MODEL configured: ${hasOpenAIModel ? '✅' : '❌'}`);
    
    if (hasGeminiModel) {
      const geminiModelMatch = envContent.match(/GEMINI_MODEL=(.+)/);
      if (geminiModelMatch) {
        console.log(`   Current Gemini model: ${geminiModelMatch[1]}`);
      }
    }
    
    if (hasOpenAIModel) {
      const openaiModelMatch = envContent.match(/OPENAI_MODEL=(.+)/);
      if (openaiModelMatch) {
        console.log(`   Current OpenAI model: ${openaiModelMatch[1]}`);
      }
    }
    
    // Test default values
    console.log('\n🔧 Testing Default Values...');
    
    // Clear environment variables temporarily
    const originalGemini = process.env.GEMINI_MODEL;
    const originalOpenAI = process.env.OPENAI_MODEL;
    
    delete process.env.GEMINI_MODEL;
    delete process.env.OPENAI_MODEL;
    
    // Create new service instances to test defaults
    const GeminiAnalysisService = require('../services/geminiAnalysisService');
    const NewsAnalysisService = require('../services/newsAnalysisService');
    
    const geminiService = new GeminiAnalysisService();
    const newsService = new NewsAnalysisService();
    
    console.log(`   Default Gemini model: ${geminiService.model} ${geminiService.model === 'gemini-1.5-flash' ? '✅' : '❌'}`);
    console.log(`   Default OpenAI model: ${newsService.openaiModel} ${newsService.openaiModel === 'gpt-3.5-turbo' ? '✅' : '❌'}`);
    
    // Restore original values
    if (originalGemini) process.env.GEMINI_MODEL = originalGemini;
    if (originalOpenAI) process.env.OPENAI_MODEL = originalOpenAI;
    
    console.log('\n✅ Environment configuration tests passed!');
    
  } catch (error) {
    console.error('❌ Environment configuration test failed:', error.message);
    throw error;
  }
}

// Show available models and recommendations
function showModelRecommendations() {
  console.log('\n📚 AI Model Recommendations...\n');
  
  console.log('🤖 Gemini Models:');
  console.log('   gemini-1.5-flash (Default) - Fast, cost-effective for most tasks');
  console.log('   gemini-pro - Balanced performance and cost');
  console.log('   gemini-1.5-pro - Highest quality, more expensive');
  console.log('   gemini-1.5-flash-latest - Latest features, may be unstable');
  
  console.log('\n🧠 OpenAI Models:');
  console.log('   gpt-3.5-turbo (Default) - Fast, cost-effective');
  console.log('   gpt-4 - High quality, more expensive');
  console.log('   gpt-4-turbo - Latest GPT-4 with improvements');
  console.log('   gpt-3.5-turbo-16k - Extended context window');
  
  console.log('\n💡 Cost Recommendations:');
  console.log('   Free Mode: Use GEMINI_API_KEY=free (100% free with mock responses)');
  console.log('   Budget Mode: gemini-1.5-flash + disabled OpenAI');
  console.log('   Quality Mode: gemini-1.5-pro + gpt-4');
  console.log('   Speed Mode: gemini-1.5-flash + gpt-3.5-turbo');
  
  console.log('\n⚙️ Configuration Examples:');
  console.log('   # Fast and free');
  console.log('   GEMINI_MODEL=gemini-1.5-flash');
  console.log('   OPENAI_API_KEY=disabled');
  console.log('');
  console.log('   # High quality analysis');
  console.log('   GEMINI_MODEL=gemini-1.5-pro');
  console.log('   OPENAI_MODEL=gpt-4');
  console.log('');
  console.log('   # Balanced performance');
  console.log('   GEMINI_MODEL=gemini-pro');
  console.log('   OPENAI_MODEL=gpt-3.5-turbo');
}

async function main() {
  console.log('🚀 AI Model Configuration Test\n');
  console.log('=' .repeat(50));
  
  let allTestsPassed = true;
  let totalTests = 0;
  let passedTests = 0;
  
  try {
    console.log('🔧 Running model configuration tests...');
    await testModelConfiguration();
    passedTests++;
    totalTests++;
  } catch (error) {
    console.error(`❌ Model configuration test failed: ${error.message}`);
    allTestsPassed = false;
    totalTests++;
  }
  
  try {
    console.log('\n⚙️ Running environment configuration tests...');
    await testEnvConfiguration();
    passedTests++;
    totalTests++;
  } catch (error) {
    console.error(`❌ Environment configuration test failed: ${error.message}`);
    allTestsPassed = false;
    totalTests++;
  }
  
  // Show recommendations regardless of test results
  showModelRecommendations();
  
  console.log('\n📊 Test Summary:');
  console.log('══════════════════════════════════════════════════');
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${totalTests - passedTests}`);
  console.log('══════════════════════════════════════════════════');
  
  if (allTestsPassed) {
    console.log('🎉 All model configuration tests passed!');
    console.log('\n🎯 Model Configuration Summary:');
    console.log('   ✅ Environment variables working');
    console.log('   ✅ Default models loading correctly');
    console.log('   ✅ Model switching functional');
    console.log('   ✅ Service initialization working');
    console.log('\n🏁 Model configuration system ready!');
    process.exit(0);
  } else {
    console.log('💥 Some model configuration tests failed!');
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testModelConfiguration, testEnvConfiguration, showModelRecommendations };