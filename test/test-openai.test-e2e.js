require('dotenv').config();
const axios = require('axios');

async function testOpenAIAPI() {
  const apiKey = process.env.OPENAI_API_KEY;
  
  console.log('🧪 Testing OpenAI API connection...');
  console.log(`API Key: ${apiKey ? apiKey.substring(0, 20) + '...' : 'NOT SET'}`);
  
  if (!apiKey) {
    console.error('❌ OpenAI API key not found in .env file');
    return;
  }
  
  try {
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: "gpt-3.5-turbo",
      messages: [{ 
        role: "user", 
        content: "Hello, this is a test message. Please respond with 'API working!'" 
      }],
      max_tokens: 10
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    console.log('✅ OpenAI API connection successful!');
    console.log('📝 Response:', response.data.choices[0].message.content);
    console.log('💰 Tokens used:', response.data.usage);
    
  } catch (error) {
    console.error('❌ OpenAI API test failed:');
    
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Error: ${error.response.data.error?.message || error.response.data}`);
      
      switch (error.response.status) {
        case 401:
          console.error('🔑 Invalid API key. Please check your OpenAI API key.');
          break;
        case 403:
          console.error('🚫 Insufficient permissions or quota exceeded.');
          break;
        case 429:
          console.error('⏰ Rate limit exceeded. Please wait and try again.');
          break;
        case 500:
          console.error('🔧 OpenAI server error. Please try again later.');
          break;
      }
    } else if (error.code === 'ECONNABORTED') {
      console.error('⏰ Connection timeout. Please check your internet connection.');
    } else {
      console.error('🌐 Network error:', error.message);
    }
  }
}

// Run the test
testOpenAIAPI().then(() => {
  console.log('\n🏁 Test completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Unexpected error:', error.message);
  process.exit(1);
});