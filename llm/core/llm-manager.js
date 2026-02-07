/**
 * PUIUX Agent Teams - LLM Manager
 * 
 * Central manager for LLM providers with:
 * - Provider selection
 * - Cost tracking
 * - Budget enforcement
 * - Model tier selection (fast/balanced/quality)
 */

const { OpenAIProvider } = require('../clients/openai');
const { AnthropicProvider } = require('../clients/anthropic');

// Model tiers for easy selection
const MODEL_TIERS = {
  fast: {
    openai: 'gpt-4o-mini',
    anthropic: 'claude-3-5-haiku-20241022'
  },
  balanced: {
    openai: 'gpt-4o',
    anthropic: 'claude-3-5-sonnet-20241022'
  },
  quality: {
    openai: 'gpt-4-turbo',
    anthropic: 'claude-3-opus-20240229'
  }
};

// Default budgets (can be overridden via config)
const DEFAULT_BUDGETS = {
  per_run_usd: 1.00,      // Max $1 per single run
  per_client_day_usd: 5.00, // Max $5 per client per day
  per_agent_usd: 0.50     // Max $0.50 per agent execution
};

class LLMManager {
  constructor(config = {}) {
    this.config = config;
    this.budgets = { ...DEFAULT_BUDGETS, ...config.budgets };
    
    // Initialize providers
    this.providers = {};
    
    if (process.env.OPENAI_API_KEY) {
      this.providers.openai = new OpenAIProvider({ apiKey: process.env.OPENAI_API_KEY });
    }
    
    if (process.env.ANTHROPIC_API_KEY) {
      this.providers.anthropic = new AnthropicProvider({ apiKey: process.env.ANTHROPIC_API_KEY });
    }
    
    // Default provider
    this.defaultProvider = config.defaultProvider || 'anthropic';
    
    if (!this.providers[this.defaultProvider]) {
      throw new Error(`Default provider "${this.defaultProvider}" not available. Set API keys via env.`);
    }
    
    // Cost tracker (in-memory for now)
    this.costs = {
      total: 0,
      by_client: {},
      by_run: {}
    };
  }

  /**
   * Generate text with automatic provider selection
   * 
   * @param {Object} options
   * @param {string} options.tier - Model tier: fast|balanced|quality
   * @param {string} options.provider - Provider override: openai|anthropic
   * @param {string} options.model - Specific model override
   * @param {Array} options.messages - Messages array
   * @param {number} options.temperature - Temperature (0-1)
   * @param {number} options.maxTokens - Max output tokens
   * @param {Object} options.jsonSchema - JSON schema for structured output
   * @param {string} options.client - Client slug (for budget tracking)
   * @param {string} options.runId - Run ID (for budget tracking)
   * @param {string} options.agent - Agent name (for budget tracking)
   * @returns {Promise<Object>}
   */
  async generateText(options) {
    // Select provider
    const providerName = options.provider || this.defaultProvider;
    const provider = this.providers[providerName];
    
    if (!provider) {
      throw new Error(`Provider "${providerName}" not available`);
    }
    
    // Select model
    let model = options.model;
    if (!model && options.tier) {
      model = MODEL_TIERS[options.tier]?.[providerName];
    }
    
    // Check budgets BEFORE execution
    await this.checkBudgets(options);
    
    // Generate
    const startTime = Date.now();
    const result = await provider.generateText({
      model,
      messages: options.messages,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      jsonSchema: options.jsonSchema
    });
    
    const duration = Date.now() - startTime;
    
    // Track cost
    this.trackCost({
      client: options.client,
      runId: options.runId,
      agent: options.agent,
      cost: result.cost_usd,
      usage: result.usage,
      model: result.model,
      provider: providerName
    });
    
    // Return with metadata
    return {
      ...result,
      provider: providerName,
      duration_ms: duration
    };
  }

  /**
   * Check if request would exceed budgets
   */
  async checkBudgets(options) {
    const { client, runId, agent } = options;
    
    // Check per-agent budget
    if (agent) {
      // Estimate cost (rough - based on average)
      const estimatedCost = 0.01; // $0.01 estimate
      
      if (estimatedCost > this.budgets.per_agent_usd) {
        throw new Error(`Agent budget exceeded: $${estimatedCost.toFixed(4)} > $${this.budgets.per_agent_usd}`);
      }
    }
    
    // Check per-run budget
    if (runId) {
      const runCost = this.costs.by_run[runId] || 0;
      const estimatedTotal = runCost + 0.05; // Add estimate
      
      if (estimatedTotal > this.budgets.per_run_usd) {
        throw new Error(`Run budget exceeded: $${estimatedTotal.toFixed(4)} > $${this.budgets.per_run_usd}`);
      }
    }
    
    // Check per-client-day budget
    if (client) {
      const today = new Date().toISOString().split('T')[0];
      const key = `${client}:${today}`;
      const clientDayCost = this.costs.by_client[key] || 0;
      const estimatedTotal = clientDayCost + 0.05;
      
      if (estimatedTotal > this.budgets.per_client_day_usd) {
        throw new Error(`Client daily budget exceeded: $${estimatedTotal.toFixed(4)} > $${this.budgets.per_client_day_usd}`);
      }
    }
    
    return true;
  }

  /**
   * Track cost after execution
   */
  trackCost(data) {
    const { client, runId, cost } = data;
    
    // Total
    this.costs.total += cost;
    
    // By run
    if (runId) {
      this.costs.by_run[runId] = (this.costs.by_run[runId] || 0) + cost;
    }
    
    // By client (today)
    if (client) {
      const today = new Date().toISOString().split('T')[0];
      const key = `${client}:${today}`;
      this.costs.by_client[key] = (this.costs.by_client[key] || 0) + cost;
    }
    
    console.log(`💰 Cost tracked: $${cost.toFixed(6)} (Total: $${this.costs.total.toFixed(4)})`);
  }

  /**
   * Get cost summary
   */
  getCostSummary() {
    return {
      total: this.costs.total,
      by_run: this.costs.by_run,
      by_client: this.costs.by_client,
      budgets: this.budgets
    };
  }

  /**
   * Reset cost tracker (for testing)
   */
  resetCosts() {
    this.costs = {
      total: 0,
      by_client: {},
      by_run: {}
    };
  }
}

module.exports = { LLMManager, MODEL_TIERS, DEFAULT_BUDGETS };
