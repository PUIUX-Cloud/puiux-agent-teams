#!/usr/bin/env node
/**
 * PUIUX Agent Teams - LLM Test Script
 * 
 * Tests LLM providers with simple prompts
 * 
 * Usage:
 *   ANTHROPIC_API_KEY="..." node llm/test-llm.js
 *   OPENAI_API_KEY="..." node llm/test-llm.js --provider=openai
 */

const { LLMManager } = require('./core/llm-manager');

async function test() {
  console.log('🧪 Testing LLM Manager...\n');
  
  // Initialize manager
  const llm = new LLMManager({
    defaultProvider: 'anthropic' // or 'openai'
  });
  
  console.log('✅ LLM Manager initialized');
  console.log(`   Available providers: ${Object.keys(llm.providers).join(', ')}\n`);
  
  // Test 1: Simple text generation (fast tier)
  console.log('📝 Test 1: Fast tier (simple question)...');
  try {
    const result1 = await llm.generateText({
      tier: 'fast',
      messages: [
        { role: 'user', content: 'What is 2+2? Answer in one word.' }
      ],
      client: 'test-client',
      runId: 'test-run-1',
      agent: 'test-agent'
    });
    
    console.log(`✅ Response: "${result1.text.trim()}"`);
    console.log(`   Model: ${result1.model}`);
    console.log(`   Tokens: ${result1.usage.total_tokens}`);
    console.log(`   Cost: $${result1.cost_usd.toFixed(6)}`);
    console.log(`   Duration: ${result1.duration_ms}ms\n`);
  } catch (error) {
    console.error(`❌ Test 1 failed: ${error.message}\n`);
  }
  
  // Test 2: JSON mode
  console.log('📝 Test 2: JSON schema (structured output)...');
  try {
    const result2 = await llm.generateText({
      tier: 'fast',
      messages: [
        { role: 'user', content: 'Give me 3 color names.' }
      ],
      jsonSchema: {
        type: 'object',
        properties: {
          colors: {
            type: 'array',
            items: { type: 'string' }
          }
        },
        required: ['colors']
      },
      client: 'test-client',
      runId: 'test-run-2',
      agent: 'test-agent'
    });
    
    console.log(`✅ Response:\n${result2.text}`);
    console.log(`   Model: ${result2.model}`);
    console.log(`   Cost: $${result2.cost_usd.toFixed(6)}\n`);
    
    // Parse JSON
    const json = JSON.parse(result2.text);
    console.log(`   Parsed colors: ${json.colors.join(', ')}\n`);
  } catch (error) {
    console.error(`❌ Test 2 failed: ${error.message}\n`);
  }
  
  // Test 3: Budget check
  console.log('📝 Test 3: Budget enforcement...');
  try {
    // Override budget to very low amount
    llm.budgets.per_run_usd = 0.001; // $0.001 max
    
    await llm.generateText({
      tier: 'quality', // Expensive tier
      messages: [
        { role: 'user', content: 'Write a long essay about AI.' }
      ],
      client: 'test-client',
      runId: 'test-run-expensive',
      agent: 'test-agent'
    });
    
    console.error('❌ Budget check FAILED - should have thrown error\n');
  } catch (error) {
    if (error.message.includes('budget exceeded')) {
      console.log(`✅ Budget check works: "${error.message}"\n`);
    } else {
      console.error(`❌ Unexpected error: ${error.message}\n`);
    }
  }
  
  // Print cost summary
  console.log('💰 Cost Summary:');
  const summary = llm.getCostSummary();
  console.log(`   Total: $${summary.total.toFixed(6)}`);
  console.log(`   By Run:`);
  Object.entries(summary.by_run).forEach(([runId, cost]) => {
    console.log(`     ${runId}: $${cost.toFixed(6)}`);
  });
  console.log(`   By Client (today):`);
  Object.entries(summary.by_client).forEach(([key, cost]) => {
    console.log(`     ${key}: $${cost.toFixed(6)}`);
  });
  
  console.log('\n✅ All tests complete!');
}

// Run
test().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
