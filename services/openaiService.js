const axios = require('axios');
const logger = require('./logger');

class OpenAIService {
    constructor(apiKey, model) {
        this.apiKey = apiKey;
        this.model = model;
        this.baseUrl = 'https://api.openai.com/v1';
        this.isEnabled = apiKey && apiKey !== 'disabled' && !apiKey.startsWith('sk-svcac');
    }

    async generateResponse(prompt, maxTokens = 4000) {
        if (!this.isEnabled) {
            throw new Error('OpenAI API key is disabled');
        }

        try {
            logger.api(`กำลังเรียกใช้ OpenAI (${this.model})...`);
            
            const response = await axios.post(
                `${this.baseUrl}/chat/completions`,
                {
                    model: this.model,
                    messages: [
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    max_tokens: maxTokens,
                    temperature: 0.7
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 120000 // 2 minutes
                }
            );

            const result = response.data;
            const usage = result.usage;
            
            logger.api(`OpenAI ตอบกลับสำเร็จ (Input: ${usage.prompt_tokens}, Output: ${usage.completion_tokens})`);
            
            return {
                content: result.choices[0].message.content,
                usage: {
                    inputTokens: usage.prompt_tokens,
                    outputTokens: usage.completion_tokens,
                    totalTokens: usage.total_tokens
                },
                model: this.model,
                provider: 'openai'
            };

        } catch (error) {
            logger.error('ข้อผิดพลาด OpenAI', error.response?.data || error.message);
            throw new Error(`OpenAI API Error: ${error.response?.data?.error?.message || error.message}`);
        }
    }

    async generateResponseInChunks(prompt, chunkSize = 3000) {
        // Split prompt into smaller chunks if too long
        const promptChunks = this.splitPrompt(prompt, chunkSize);
        const responses = [];
        
        for (let i = 0; i < promptChunks.length; i++) {
            logger.process(`ประมวลผลส่วนที่ ${i + 1}/${promptChunks.length}...`);
            const response = await this.generateResponse(promptChunks[i]);
            responses.push(response);
            
            // Small delay between requests
            if (i < promptChunks.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        return this.combineResponses(responses);
    }

    splitPrompt(prompt, chunkSize) {
        // Simple approach: split by sentences and group into chunks
        const sentences = prompt.split('\n').filter(s => s.trim());
        const chunks = [];
        let currentChunk = '';
        
        for (const sentence of sentences) {
            if ((currentChunk + sentence).length > chunkSize && currentChunk) {
                chunks.push(currentChunk.trim());
                currentChunk = sentence;
            } else {
                currentChunk += (currentChunk ? '\n' : '') + sentence;
            }
        }
        
        if (currentChunk) {
            chunks.push(currentChunk.trim());
        }
        
        return chunks.length > 0 ? chunks : [prompt];
    }

    combineResponses(responses) {
        const combinedContent = responses.map(r => r.content).join('\n\n');
        const totalUsage = responses.reduce((acc, r) => ({
            inputTokens: acc.inputTokens + r.usage.inputTokens,
            outputTokens: acc.outputTokens + r.usage.outputTokens,
            totalTokens: acc.totalTokens + r.usage.totalTokens
        }), { inputTokens: 0, outputTokens: 0, totalTokens: 0 });

        return {
            content: combinedContent,
            usage: totalUsage,
            model: responses[0]?.model || this.model,
            provider: 'openai'
        };
    }
}

module.exports = OpenAIService;