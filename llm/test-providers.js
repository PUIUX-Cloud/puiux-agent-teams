#!/usr/bin/env node
/**
 * LLM Providers Test Script
 * 
 * Tests all 3 providers with sample prompts
 * 
 * Usage:
 *   node llm/test-providers.js
 */

const OpenAIProvider = require('./clients/openai');
const AnthropicProvider = require('./clients/anthropic');
const GeminiProvider = require('./clients/gemini');
const ProviderFactory = require('./core/provider-factory');

// ═══════════════════════════════════════════════════════════════
// Test Cases
// ═══════════════════════════════════════════════════════════════

const testCases = {
  simple: {
    messages: [
      { role: 'user', content: 'What is 2+2? Answer in Arabic.' }
    ]
  },
  
  json: {
    messages: [
      { 
        role: 'user', 
        content: 'Generate a JSON object with: name (string), age (number), active (boolean)' 
      }
    ],
    responseFormat: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
        active: { type: 'boolean' }
      },
      required: ['name', 'age', 'active']
    }
  },
  
  presales: {
    messages: [
      { 
        role: 'user', 
        content: 'Client wants an e-commerce website. What are 3 key questions to ask?' 
      }
    ]
  }
};

// ═══════════════════════════════════════════════════════════════
// Test Runner
// ═══════════════════════════════════════════════════════════════

async function testProvider(name, provider, model, testCase) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${name} (${model})`);
  console.log(`${'='.repeat(60)}`);
  
  try {
    const start = Date.now();
    const result = await provider.generate({
      model,
      messages: testCase.messages,
      responseFormat: testCase.responseFormat,
      maxTokens: 500
    });
    const duration = Date.now() - start;
    
    console.log(`✅ Success (${duration}ms)`);
    console.log(`\nResponse:`);
    console.log(result.text.substring(0, 200));
    if (result.text.length > 200) console.log('...');
    
    if (testCase.responseFormat && result.parsed) {
      console.log(`\nParsed JSON:`);
      console.log(JSON.stringify(result.parsed, null, 2));
    }
    
    console.log(`\nUsage:`);
    console.log(`  Input tokens:  ${result.usage.input_tokens}`);
    console.log(`  Output tokens: ${result.usage.output_tokens}`);
    console.log(`  Total tokens:  ${result.usage.total_tokens}`);
    console.log(`  Cost:          $${result.cost.toFixed(6)}`);
    
    return { success: true, result };
  } catch (error) {
    console.log(`❌ Failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log('\n🧪 LLM Providers Test Suite\n');
  
  const providers = [
    { name: 'OpenAI GPT-4o', provider: new OpenAIProvider(), model: 'gpt-4o' },
    { name: 'OpenAI GPT-4o-mini', provider: new OpenAIProvider(), model: 'gpt-4o-mini' },
    { name: 'Anthropic Sonnet', provider: new AnthropicProvider(), model: 'sonnet' },
    { name: 'Anthropic Haiku', provider: new AnthropicProvider(), model: 'haiku' },
    { name: 'Gemini Pro', provider: new GeminiProvider(), model: 'pro' },
    { name: 'Gemini Flash', provider: new GeminiProvider(), model: 'flash' }
  ];
  
  const results = {
    passed: 0,
    failed: 0,
    total: 0
  };
  
  // Test each provider with simple test
  console.log('\n📝 Test 1: Simple Response (Arabic)\n');
  for (const p of providers) {
    const result = await testProvider(p.name, p.provider, p.model, testCases.simple);
    results.total++;
    if (result.success) results.passed++;
    else results.failed++;
  }
  
  // Test JSON mode with selected providers
  console.log('\n\n📝 Test 2: JSON Mode\n');
  const jsonProviders = [
    { name: 'OpenAI GPT-4o-mini', provider: new OpenAIProvider(), model: 'gpt-4o-mini' },
    { name: 'Anthropic Sonnet', provider: new AnthropicProvider(), model: 'sonnet' },
    { name: 'Gemini Flash', provider: new GeminiProvider(), model: 'flash' }
  ];
  
  for (const p of jsonProviders) {
    const result = await testProvider(p.name, p.provider, p.model, testCases.json);
    results.total++;
    if (result.success) results.passed++;
    else results.failed++;
  }
  
  // Test Provider Factory
  console.log('\n\n📝 Test 3: Provider Factory\n');
  const factory = new ProviderFactory();
  
  const agentTypes = [
    { category: 'presales', name: 'presales-discovery' },
    { category: 'delivery', name: 'designer-ui' },
    { category: 'delivery', name: 'frontend-dev' },
    { category: 'delivery', name: 'backend-api' },
    { category: 'qa', name: 'qa-tester' },
    { category: 'meta', name: 'coordinator-agent' }
  ];
  
  for (const agent of agentTypes) {
    const { provider, model } = factory.getProvider(agent);
    console.log(`${agent.name.padEnd(25)} → ${provider.constructor.name.padEnd(20)} (${model})`);
  }
  
  // Summary
  console.log(`\n\n${'='.repeat(60)}`);
  console.log(`Test Summary`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Total:  ${results.total}`);
  console.log(`Passed: ${results.passed} ✅`);
  console.log(`Failed: ${results.failed} ❌`);
  console.log(`\n✅ LLM Phase 1 Core Layer: COMPLETE\n`);
}

// Run tests
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { testProvider, runTests };
