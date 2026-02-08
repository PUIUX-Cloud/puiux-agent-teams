/**
 * PUIUX Agent Teams - LLM Base Provider
 * 
 * Abstract base class for all LLM providers
 * Ensures consistent interface across OpenAI, Anthropic, Gemini, etc.
 */

class BaseLLMProvider {
  constructor() {
    // Base class - no initialization needed
    // Subclasses will handle their own config
  }

  /**
   * Generate text completion
   * @param {Object} options - Generation options
   * @param {string} options.model - Model identifier
   * @param {Array} options.messages - Messages array [{role, content}]
   * @param {number} options.temperature - Randomness (0-1)
   * @param {number} options.maxTokens - Max output tokens
   * @param {Object} options.jsonSchema - JSON schema for structured output (optional)
   * @returns {Promise<Object>} - {text, usage, model, cost_usd}
   */
  async generateText(options) {
    throw new Error('generateText() must be implemented by subclass');
  }

  /**
   * Calculate cost in USD
   * @param {Object} usage - Token usage {prompt_tokens, completion_tokens}
   * @param {string} model - Model identifier
   * @returns {number} - Cost in USD
   */
  calculateCost(usage, model) {
    throw new Error('calculateCost() must be implemented by subclass');
  }

  /**
   * Retry logic with exponential backoff
   * @param {Function} fn - Async function to retry
   * @param {number} retries - Number of retries
   * @returns {Promise<any>}
   */
  async retry(fn, retries = this.maxRetries) {
    let lastError;
    
    for (let i = 0; i < retries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        // Don't retry on invalid requests (4xx errors)
        if (error.status >= 400 && error.status < 500) {
          throw error;
        }
        
        // Exponential backoff: 1s, 2s, 4s, 8s...
        const delay = Math.min(1000 * Math.pow(2, i), 30000);
        console.warn(`Retry ${i + 1}/${retries} after ${delay}ms:`, error.message);
        await this.sleep(delay);
      }
    }
    
    throw lastError;
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validate options
   */
  validateOptions(options) {
    if (!options.messages || !Array.isArray(options.messages)) {
      throw new Error('messages array required');
    }
    
    if (options.messages.length === 0) {
      throw new Error('messages array cannot be empty');
    }
    
    return true;
  }
}

module.exports = BaseLLMProvider;
