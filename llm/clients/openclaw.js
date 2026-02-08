/**
 * PUIUX Agent Teams - OpenClaw Provider
 * 
 * Uses OpenClaw's built-in LLM routing (via exec oracle)
 * No separate API keys needed - uses existing OpenClaw subscription
 */

const { execSync } = require('child_process');
const { BaseLLMProvider } = require('../core/base-provider');

// Pricing based on OpenClaw's current models
const PRICING = {
  'sonnet': { input: 3.00 / 1_000_000, output: 15.00 / 1_000_000 },      // Claude Sonnet 4
  'glm': { input: 0.40 / 1_000_000, output: 0.40 / 1_000_000 },          // GLM 4.7
  'gpt': { input: 2.50 / 1_000_000, output: 10.00 / 1_000_000 },         // GPT-5.2
  'gemini': { input: 0.075 / 1_000_000, output: 0.30 / 1_000_000 }       // Gemini 3 Flash
};

class OpenClawProvider extends BaseLLMProvider {
  constructor(config = {}) {
    super({
      apiKey: 'openclaw-internal', // No real key needed
      defaultModel: config.defaultModel || 'sonnet',
      ...config
    });
  }

  async generateText(options) {
    this.validateOptions(options);
    
    const model = options.model || this.defaultModel;
    const temperature = options.temperature !== undefined ? options.temperature : 0.7;
    const maxTokens = options.maxTokens || 4096;
    
    // Build prompt from messages
    const prompt = this.buildPrompt(options.messages, options.jsonSchema);
    
    // Execute via oracle CLI (uses OpenClaw's LLM routing)
    const oracleCmd = this.buildOracleCommand(prompt, model, temperature, maxTokens);
    
    // Execute with retry
    const result = await this.retry(() => this.executeOracle(oracleCmd));
    
    // Parse result
    const text = result.output;
    const usage = this.estimateUsage(prompt, text);
    const cost_usd = this.calculateCost(usage, model);
    
    return {
      text,
      usage,
      model,
      cost_usd
    };
  }

  buildPrompt(messages, jsonSchema) {
    let prompt = '';
    
    // Add JSON schema instruction if provided
    if (jsonSchema) {
      prompt += `You must respond with valid JSON matching this schema:\n${JSON.stringify(jsonSchema, null, 2)}\n\n`;
    }
    
    // Add messages
    messages.forEach(msg => {
      if (msg.role === 'system') {
        prompt += `[SYSTEM]\n${msg.content}\n\n`;
      } else if (msg.role === 'user') {
        prompt += `[USER]\n${msg.content}\n\n`;
      } else if (msg.role === 'assistant') {
        prompt += `[ASSISTANT]\n${msg.content}\n\n`;
      }
    });
    
    prompt += '[ASSISTANT]\n';
    
    return prompt;
  }

  buildOracleCommand(prompt, model, temperature, maxTokens) {
    // Escape prompt for shell
    const escapedPrompt = prompt.replace(/'/g, "'\\''");
    
    // Map model alias to oracle model
    const modelMap = {
      'sonnet': 'sonnet',
      'glm': 'glm',
      'gpt': 'gpt',
      'gemini': 'gemini'
    };
    
    const oracleModel = modelMap[model] || 'sonnet';
    
    return `oracle --model=${oracleModel} '${escapedPrompt}'`;
  }

  async executeOracle(command) {
    try {
      const output = execSync(command, {
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024, // 10MB
        timeout: this.timeout
      });
      
      return { output: output.trim() };
    } catch (error) {
      // Check if timeout
      if (error.signal === 'SIGTERM') {
        throw new Error('Oracle timeout');
      }
      
      // Check if command failed
      throw new Error(`Oracle failed: ${error.message}`);
    }
  }

  estimateUsage(prompt, completion) {
    // Rough estimation (4 chars ≈ 1 token)
    const prompt_tokens = Math.ceil(prompt.length / 4);
    const completion_tokens = Math.ceil(completion.length / 4);
    
    return {
      prompt_tokens,
      completion_tokens,
      total_tokens: prompt_tokens + completion_tokens
    };
  }

  calculateCost(usage, model) {
    const pricing = PRICING[model] || PRICING['sonnet'];
    
    const inputCost = usage.prompt_tokens * pricing.input;
    const outputCost = usage.completion_tokens * pricing.output;
    
    return inputCost + outputCost;
  }
}

module.exports = { OpenClawProvider };
