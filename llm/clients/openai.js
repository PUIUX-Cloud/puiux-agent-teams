/**
 * PUIUX Agent Teams - OpenAI Provider
 * 
 * OpenAI API client with cost tracking and retries
 */

const https = require('https');
const { BaseLLMProvider } = require('../core/base-provider');

// OpenAI Pricing (as of Feb 2026)
// https://openai.com/pricing
const PRICING = {
  'gpt-4o': { input: 2.50 / 1_000_000, output: 10.00 / 1_000_000 },
  'gpt-4o-mini': { input: 0.15 / 1_000_000, output: 0.60 / 1_000_000 },
  'gpt-4-turbo': { input: 10.00 / 1_000_000, output: 30.00 / 1_000_000 },
  'gpt-3.5-turbo': { input: 0.50 / 1_000_000, output: 1.50 / 1_000_000 }
};

class OpenAIProvider extends BaseLLMProvider {
  constructor(config = {}) {
    super({
      apiKey: config.apiKey || process.env.OPENAI_API_KEY,
      defaultModel: config.defaultModel || 'gpt-4o-mini',
      ...config
    });
    
    this.baseURL = 'api.openai.com';
  }

  async generateText(options) {
    this.validateOptions(options);
    
    const model = options.model || this.defaultModel;
    const temperature = options.temperature !== undefined ? options.temperature : 0.7;
    const maxTokens = options.maxTokens || 4096;
    
    const payload = {
      model,
      messages: options.messages,
      temperature,
      max_tokens: maxTokens
    };
    
    // Add JSON mode if schema provided
    if (options.jsonSchema) {
      payload.response_format = { type: 'json_object' };
      
      // Inject schema into system message
      const schemaMsg = {
        role: 'system',
        content: `You must respond with valid JSON matching this schema:\n${JSON.stringify(options.jsonSchema, null, 2)}`
      };
      payload.messages = [schemaMsg, ...payload.messages];
    }
    
    // Execute with retry
    const response = await this.retry(() => this.makeRequest(payload));
    
    // Extract text
    const text = response.choices[0]?.message?.content || '';
    const usage = response.usage || {};
    
    // Calculate cost
    const cost_usd = this.calculateCost(usage, model);
    
    return {
      text,
      usage: {
        prompt_tokens: usage.prompt_tokens || 0,
        completion_tokens: usage.completion_tokens || 0,
        total_tokens: usage.total_tokens || 0
      },
      model,
      cost_usd
    };
  }

  async makeRequest(payload) {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(payload);
      
      const options = {
        hostname: this.baseURL,
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Length': Buffer.byteLength(data)
        },
        timeout: this.timeout
      };
      
      const req = https.request(options, (res) => {
        let body = '';
        
        res.on('data', chunk => {
          body += chunk;
        });
        
        res.on('end', () => {
          try {
            const json = JSON.parse(body);
            
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(json);
            } else {
              const error = new Error(json.error?.message || `OpenAI API error: ${res.statusCode}`);
              error.status = res.statusCode;
              error.response = json;
              reject(error);
            }
          } catch (parseError) {
            reject(new Error(`Failed to parse response: ${body}`));
          }
        });
      });
      
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      
      req.write(data);
      req.end();
    });
  }

  calculateCost(usage, model) {
    const pricing = PRICING[model] || PRICING['gpt-4o-mini']; // Fallback
    
    const inputCost = (usage.prompt_tokens || 0) * pricing.input;
    const outputCost = (usage.completion_tokens || 0) * pricing.output;
    
    return inputCost + outputCost;
  }
}

module.exports = { OpenAIProvider };
