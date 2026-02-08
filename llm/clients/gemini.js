/**
 * Google Gemini Provider
 * 
 * Supports:
 * - gemini-1.5-pro-002 (most capable, 2M context)
 * - gemini-1.5-flash-002 (fast & cheap, 1M context)
 * 
 * API: https://ai.google.dev/api/rest
 * Pricing: https://ai.google.dev/pricing
 */

const https = require('https');
const BaseLLMProvider = require('../core/base-provider');

class GeminiProvider extends BaseLLMProvider {
  constructor(apiKey) {
    super();
    this.apiKey = apiKey || process.env.GOOGLE_AI_API_KEY;
    this.baseUrl = 'generativelanguage.googleapis.com';
    
    // Pricing per 1M tokens (USD)
    this.pricing = {
      'gemini-1.5-pro-002': { input: 1.25, output: 5.00 },
      'gemini-1.5-flash-002': { input: 0.075, output: 0.30 }
    };
    
    // Model aliases
    this.aliases = {
      'pro': 'gemini-1.5-pro-002',
      'flash': 'gemini-1.5-flash-002',
      'default': 'gemini-1.5-flash-002'
    };
  }

  /**
   * Generate completion
   * @param {Object} params
   * @param {string} params.model - Model name or alias
   * @param {Array} params.messages - Chat messages
   * @param {Object} params.responseFormat - JSON schema (optional)
   * @param {number} params.maxTokens - Max output tokens (default: 8192)
   * @param {number} params.temperature - Temperature 0-2 (default: 0.7)
   * @returns {Promise<Object>}
   */
  async generate(params) {
    const model = this.resolveModel(params.model);
    const messages = params.messages || [];
    const maxTokens = params.maxTokens || 8192;
    const temperature = params.temperature || 0.7;

    // Build request body
    const body = {
      contents: this._formatMessages(messages),
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature
      }
    };

    // JSON mode (if requested)
    if (params.responseFormat) {
      body.generationConfig.responseMimeType = 'application/json';
      body.generationConfig.responseSchema = this._convertSchema(params.responseFormat);
    }

    // Make API call
    const response = await this._makeRequest(model, body);

    // Extract text
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Parse JSON if requested
    let parsed = null;
    if (params.responseFormat) {
      parsed = this._parseJSON(text);
    }

    // Count tokens
    const inputTokens = response.usageMetadata?.promptTokenCount || this._estimateTokens(messages);
    const outputTokens = response.usageMetadata?.candidatesTokenCount || this._estimateTokens([{ role: 'model', parts: [{ text }] }]);

    return {
      provider: 'gemini',
      model,
      text,
      parsed,
      usage: {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: inputTokens + outputTokens
      },
      cost: this.calculateCost(model, inputTokens, outputTokens),
      raw: response
    };
  }

  /**
   * Format messages for Gemini API
   * @private
   */
  _formatMessages(messages) {
    const contents = [];
    
    for (const msg of messages) {
      if (msg.role === 'system') {
        // System message → user message with special marker
        contents.push({
          role: 'user',
          parts: [{ text: `[SYSTEM INSTRUCTION]\n${msg.content}` }]
        });
      } else {
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        });
      }
    }
    
    return contents;
  }

  /**
   * Convert JSON schema to Gemini format
   * @private
   */
  _convertSchema(schema) {
    // Gemini uses OpenAPI 3.0 schema format
    return {
      type: 'object',
      properties: schema.properties || {},
      required: schema.required || []
    };
  }

  /**
   * Parse JSON from response
   * @private
   */
  _parseJSON(text) {
    try {
      return JSON.parse(text.trim());
    } catch (err) {
      console.warn('[Gemini] JSON parse failed:', err.message);
      return null;
    }
  }

  /**
   * Estimate tokens (rough approximation)
   * @private
   */
  _estimateTokens(contents) {
    const text = contents.map(c => 
      c.parts?.map(p => p.text).join(' ') || c.content || ''
    ).join(' ');
    return Math.ceil(text.length / 4); // ~4 chars per token
  }

  /**
   * Calculate cost in USD
   * @param {string} model
   * @param {number} inputTokens
   * @param {number} outputTokens
   * @returns {number}
   */
  calculateCost(model, inputTokens, outputTokens) {
    const pricing = this.pricing[model];
    if (!pricing) return 0;

    const inputCost = (inputTokens / 1_000_000) * pricing.input;
    const outputCost = (outputTokens / 1_000_000) * pricing.output;
    
    return parseFloat((inputCost + outputCost).toFixed(6));
  }

  /**
   * Validate response structure
   * @param {Object} response
   * @param {Object} schema
   * @returns {boolean}
   */
  validateResponse(response, schema) {
    if (!response.parsed) return false;
    
    // Basic validation: check required fields
    if (schema.required) {
      for (const field of schema.required) {
        if (!(field in response.parsed)) {
          return false;
        }
      }
    }
    
    return true;
  }

  /**
   * Resolve model alias
   * @private
   */
  resolveModel(model) {
    return this.aliases[model] || model || this.aliases.default;
  }

  /**
   * Make HTTPS request to Gemini API
   * @private
   */
  _makeRequest(model, body) {
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify(body);
      const path = `/v1beta/models/${model}:generateContent?key=${this.apiKey}`;
      
      const options = {
        hostname: this.baseUrl,
        port: 443,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            
            if (res.statusCode >= 400) {
              reject(new Error(`Gemini API error (${res.statusCode}): ${parsed.error?.message || data}`));
            } else {
              resolve(parsed);
            }
          } catch (err) {
            reject(new Error(`Failed to parse Gemini response: ${err.message}`));
          }
        });
      });

      req.on('error', (err) => {
        reject(new Error(`Gemini request failed: ${err.message}`));
      });

      req.write(payload);
      req.end();
    });
  }
}

module.exports = GeminiProvider;
