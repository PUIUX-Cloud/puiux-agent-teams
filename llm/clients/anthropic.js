/**
 * PUIUX Agent Teams - Anthropic Provider
 * 
 * Anthropic (Claude) API client with cost tracking
 */

const https = require('https');
const { BaseLLMProvider } = require('../core/base-provider');

// Anthropic Pricing (as of Feb 2026)
// https://www.anthropic.com/pricing
const PRICING = {
  'claude-3-5-sonnet-20241022': { input: 3.00 / 1_000_000, output: 15.00 / 1_000_000 },
  'claude-3-5-haiku-20241022': { input: 0.80 / 1_000_000, output: 4.00 / 1_000_000 },
  'claude-3-opus-20240229': { input: 15.00 / 1_000_000, output: 75.00 / 1_000_000 },
  'claude-sonnet-4-5': { input: 3.00 / 1_000_000, output: 15.00 / 1_000_000 } // Alias
};

class AnthropicProvider extends BaseLLMProvider {
  constructor(config = {}) {
    super({
      apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY,
      defaultModel: config.defaultModel || 'claude-3-5-sonnet-20241022',
      ...config
    });
    
    this.baseURL = 'api.anthropic.com';
    this.apiVersion = '2023-06-01';
  }

  async generateText(options) {
    this.validateOptions(options);
    
    const model = options.model || this.defaultModel;
    const temperature = options.temperature !== undefined ? options.temperature : 0.7;
    const maxTokens = options.maxTokens || 4096;
    
    // Convert messages to Anthropic format
    const { system, messages } = this.convertMessages(options.messages, options.jsonSchema);
    
    const payload = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens
    };
    
    if (system) {
      payload.system = system;
    }
    
    // Execute with retry
    const response = await this.retry(() => this.makeRequest(payload));
    
    // Extract text
    const text = response.content[0]?.text || '';
    const usage = response.usage || {};
    
    // Calculate cost
    const cost_usd = this.calculateCost(usage, model);
    
    return {
      text,
      usage: {
        prompt_tokens: usage.input_tokens || 0,
        completion_tokens: usage.output_tokens || 0,
        total_tokens: (usage.input_tokens || 0) + (usage.output_tokens || 0)
      },
      model,
      cost_usd
    };
  }

  convertMessages(messages, jsonSchema) {
    let system = null;
    const converted = [];
    
    // Extract system messages
    const systemMessages = messages.filter(m => m.role === 'system');
    if (systemMessages.length > 0) {
      system = systemMessages.map(m => m.content).join('\n\n');
    }
    
    // Add JSON schema to system if provided
    if (jsonSchema) {
      const schemaInstr = `You must respond with valid JSON matching this schema:\n${JSON.stringify(jsonSchema, null, 2)}`;
      system = system ? `${system}\n\n${schemaInstr}` : schemaInstr;
    }
    
    // Convert non-system messages
    messages
      .filter(m => m.role !== 'system')
      .forEach(msg => {
        converted.push({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content
        });
      });
    
    return { system, messages: converted };
  }

  async makeRequest(payload) {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(payload);
      
      const options = {
        hostname: this.baseURL,
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': this.apiVersion,
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
              const error = new Error(json.error?.message || `Anthropic API error: ${res.statusCode}`);
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
    const pricing = PRICING[model] || PRICING['claude-3-5-sonnet-20241022']; // Fallback
    
    const inputCost = (usage.input_tokens || 0) * pricing.input;
    const outputCost = (usage.output_tokens || 0) * pricing.output;
    
    return inputCost + outputCost;
  }
}

module.exports = { AnthropicProvider };
