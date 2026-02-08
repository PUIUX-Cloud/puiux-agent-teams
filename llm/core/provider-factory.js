/**
 * LLM Provider Factory
 * 
 * Selects the appropriate provider based on:
 * - Agent preference (specified in agent metadata)
 * - Task type (presales, design, code, qa, etc.)
 * - Budget constraints
 * - Fallback strategy
 */

const OpenAIProvider = require('../clients/openai');
const AnthropicProvider = require('../clients/anthropic');
const GeminiProvider = require('../clients/gemini');

class ProviderFactory {
  constructor() {
    this.providers = {
      openai: new OpenAIProvider(),
      anthropic: new AnthropicProvider(),
      gemini: new GeminiProvider()
    };
    
    // Default preferences per agent type
    // Strategy: Mix of Gemini (cheap) + OpenAI (quality) + Anthropic (backup)
    this.defaultPreferences = {
      // Presales: Fast & cheap (lots of exploration)
      presales: { provider: 'gemini', model: 'flash' },
      
      // Designer: Creative & detailed (Gemini Pro is good enough)
      designer: { provider: 'gemini', model: 'pro' },
      
      // Frontend: Code generation (OpenAI GPT-4o is best for code)
      // Note: Requires OpenAI API credit - falls back to Gemini if no key
      frontend: { provider: 'openai', model: 'gpt-4o-mini' },
      
      // Backend: Complex logic, API design (Anthropic for quality)
      backend: { provider: 'anthropic', model: 'haiku' },
      
      // QA: Fast & systematic
      qa: { provider: 'gemini', model: 'flash' },
      
      // Coordinator: Consolidation & summary (OpenAI good at this)
      // Note: Requires OpenAI API credit - falls back to Gemini if no key
      coordinator: { provider: 'openai', model: 'gpt-4o-mini' }
    };
  }

  /**
   * Get provider for agent
   * @param {Object} agent - Agent metadata
   * @param {string} agent.category - presales|delivery|business|qa|meta
   * @param {string} agent.name - Agent name
   * @param {Object} agent.llm_config - Optional LLM config from agent
   * @returns {Object} { provider, model }
   */
  getProvider(agent) {
    // 1. Check agent-specific config
    if (agent.llm_config && agent.llm_config.provider) {
      const provider = this.providers[agent.llm_config.provider];
      const model = agent.llm_config.model || 'default';
      
      if (provider) {
        return { provider, model };
      }
    }

    // 2. Use agent type default
    const agentType = this._getAgentType(agent);
    const preference = this.defaultPreferences[agentType];
    
    if (preference) {
      let provider = this.providers[preference.provider];
      let model = preference.model;
      
      // Smart fallback: If OpenAI requested but no API key, use Gemini
      if (preference.provider === 'openai' && !process.env.OPENAI_API_KEY) {
        console.warn(`[ProviderFactory] OpenAI requested for ${agentType} but no API key - falling back to Gemini Flash`);
        provider = this.providers.gemini;
        model = 'flash';
      }
      
      return { provider, model };
    }

    // 3. Fallback to cheapest (Gemini Flash)
    return {
      provider: this.providers.gemini,
      model: 'flash'
    };
  }

  /**
   * Determine agent type from category and name
   * @private
   */
  _getAgentType(agent) {
    // Extract type from category or name
    if (agent.category === 'presales') return 'presales';
    if (agent.category === 'meta' && agent.name.includes('coordinator')) return 'coordinator';
    if (agent.category === 'qa') return 'qa';
    
    // Delivery agents: check name
    if (agent.name.includes('designer') || agent.name.includes('design')) return 'designer';
    if (agent.name.includes('frontend') || agent.name.includes('ui')) return 'frontend';
    if (agent.name.includes('backend') || agent.name.includes('api')) return 'backend';
    
    // Default: coordinator
    return 'coordinator';
  }

  /**
   * Get all available providers
   * @returns {Object}
   */
  getAllProviders() {
    return this.providers;
  }

  /**
   * Get provider by name
   * @param {string} name - openai|anthropic|gemini
   * @returns {Object|null}
   */
  getProviderByName(name) {
    return this.providers[name] || null;
  }
}

module.exports = ProviderFactory;
