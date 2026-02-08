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
    this.defaultPreferences = {
      // Presales: Fast & cheap (lots of exploration)
      presales: { provider: 'gemini', model: 'flash' },
      
      // Designer: Creative & detailed
      designer: { provider: 'anthropic', model: 'sonnet' },
      
      // Frontend: Structured output, code generation
      frontend: { provider: 'openai', model: 'gpt-4o' },
      
      // Backend: Complex logic, API design
      backend: { provider: 'anthropic', model: 'sonnet' },
      
      // QA: Fast & systematic
      qa: { provider: 'gemini', model: 'flash' },
      
      // Coordinator: Consolidation & summary
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
      const provider = this.providers[preference.provider];
      const model = preference.model;
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
