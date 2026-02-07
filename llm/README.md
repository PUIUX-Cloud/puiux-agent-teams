# PUIUX Agent Teams - LLM Integration

**Status:** 🚧 Phase 1 Complete (Core Layer)  
**Date:** 2026-02-08  
**Version:** 1.0

---

## Overview

Production-grade LLM integration with:
- ✅ Multi-provider support (OpenAI, Anthropic)
- ✅ Cost tracking and budgets
- ✅ Retry logic with exponential backoff
- ✅ JSON schema support for structured outputs
- ✅ Model tier selection (fast/balanced/quality)

---

## Architecture

```
llm/
├── core/
│   ├── base-provider.js     # Abstract base class
│   └── llm-manager.js        # Central manager (provider selection + budgets)
├── clients/
│   ├── openai.js             # OpenAI provider
│   └── anthropic.js          # Anthropic (Claude) provider
└── test-llm.js               # Test script
```

---

## Setup

### 1. Install Dependencies

No external dependencies required - uses Node.js built-in `https` module.

### 2. Configure API Keys

```bash
# Add to /docker/openclaw-jjuw/.env
ANTHROPIC_API_KEY="sk-ant-..."
OPENAI_API_KEY="sk-..."

# Or export directly
export ANTHROPIC_API_KEY="sk-ant-..."
export OPENAI_API_KEY="sk-..."
```

### 3. Test

```bash
# Test Anthropic (Claude)
ANTHROPIC_API_KEY="..." node llm/test-llm.js

# Test OpenAI
OPENAI_API_KEY="..." node llm/test-llm.js --provider=openai
```

---

## Usage

### Basic Example

```javascript
const { LLMManager } = require('./llm/core/llm-manager');

const llm = new LLMManager({
  defaultProvider: 'anthropic' // or 'openai'
});

const result = await llm.generateText({
  tier: 'fast',  // fast|balanced|quality
  messages: [
    { role: 'user', content: 'What is PUIUX?' }
  ],
  client: 'demo-acme',
  runId: 'PS0-demo-acme-123',
  agent: 'presales-agent'
});

console.log(result.text);
console.log(`Cost: $${result.cost_usd}`);
```

---

## Model Tiers

| Tier | Purpose | OpenAI | Anthropic | Cost |
|------|---------|--------|-----------|------|
| **fast** | Simple tasks, high speed | gpt-4o-mini | claude-3-5-haiku | $$ |
| **balanced** | Most tasks (recommended) | gpt-4o | claude-3-5-sonnet | $$$ |
| **quality** | Complex reasoning | gpt-4-turbo | claude-3-opus | $$$$ |

**Recommendation:** Use `fast` for most tasks, `balanced` for complex logic, `quality` only when necessary.

---

## Structured Outputs (JSON Mode)

```javascript
const result = await llm.generateText({
  tier: 'fast',
  messages: [
    { role: 'user', content: 'List 3 popular programming languages.' }
  ],
  jsonSchema: {
    type: 'object',
    properties: {
      languages: {
        type: 'array',
        items: { type: 'string' }
      }
    },
    required: ['languages']
  }
});

const json = JSON.parse(result.text);
console.log(json.languages); // ['Python', 'JavaScript', 'Java']
```

---

## Cost Tracking

### Automatic Tracking

Every LLM call is tracked automatically:
- ✅ Total cost (all calls)
- ✅ Cost per run
- ✅ Cost per client per day
- ✅ Token usage

### Get Summary

```javascript
const summary = llm.getCostSummary();

console.log(`Total: $${summary.total}`);
console.log('By Run:', summary.by_run);
console.log('By Client:', summary.by_client);
```

---

## Budget Enforcement

### Default Budgets

```javascript
{
  per_run_usd: 1.00,      // Max $1 per run
  per_client_day_usd: 5.00, // Max $5 per client per day
  per_agent_usd: 0.50     // Max $0.50 per agent
}
```

### Custom Budgets

```javascript
const llm = new LLMManager({
  budgets: {
    per_run_usd: 2.00,      // Increase to $2
    per_client_day_usd: 10.00
  }
});
```

### Budget Exceeded

```javascript
try {
  await llm.generateText({ ... });
} catch (error) {
  if (error.message.includes('budget exceeded')) {
    console.error('💰 Budget limit reached!');
    // Send alert, stop execution, etc.
  }
}
```

---

## Retry Logic

Automatic retries with exponential backoff:
- ✅ Max 3 retries (configurable)
- ✅ Backoff: 1s, 2s, 4s, 8s...
- ✅ No retry on 4xx errors (client errors)
- ✅ Retry on 5xx errors (server errors)

---

## Error Handling

```javascript
try {
  const result = await llm.generateText({ ... });
} catch (error) {
  if (error.status === 429) {
    // Rate limit exceeded
  } else if (error.status >= 500) {
    // Server error
  } else if (error.message.includes('budget')) {
    // Budget exceeded
  } else {
    // Other error
  }
}
```

---

## Pricing (as of Feb 2026)

### OpenAI

| Model | Input (per 1M tokens) | Output (per 1M tokens) |
|-------|----------------------|------------------------|
| gpt-4o-mini | $0.15 | $0.60 |
| gpt-4o | $2.50 | $10.00 |
| gpt-4-turbo | $10.00 | $30.00 |

### Anthropic

| Model | Input (per 1M tokens) | Output (per 1M tokens) |
|-------|----------------------|------------------------|
| claude-3-5-haiku | $0.80 | $4.00 |
| claude-3-5-sonnet | $3.00 | $15.00 |
| claude-3-opus | $15.00 | $75.00 |

**Cost Example:**
- Simple task (100 tokens in, 200 tokens out) with `fast` tier:
  - OpenAI: ~$0.00015
  - Anthropic: ~$0.00088

---

## Best Practices

### 1. Use Appropriate Tier

```javascript
// ❌ Wasteful
tier: 'quality'  // For simple task

// ✅ Efficient
tier: 'fast'     // For simple task
tier: 'balanced' // For complex task
```

### 2. Set Budgets

```javascript
// ❌ No limits
const llm = new LLMManager();

// ✅ With limits
const llm = new LLMManager({
  budgets: {
    per_run_usd: 0.50  // Prevent runaway costs
  }
});
```

### 3. Handle Errors

```javascript
// ❌ No error handling
const result = await llm.generateText({ ... });

// ✅ Graceful degradation
try {
  const result = await llm.generateText({ ... });
} catch (error) {
  console.error('LLM failed:', error.message);
  // Fallback to template or simulated output
}
```

### 4. Track Costs

```javascript
// ✅ Log costs in run.json
const result = await llm.generateText({ ... });

runManifest.metrics = {
  tokens_used: result.usage.total_tokens,
  cost_usd: result.cost_usd,
  model: result.model
};
```

---

## Next Steps (Phase 2)

- [ ] Gemini provider
- [ ] Prompt templates for each agent
- [ ] Response caching (by hash)
- [ ] Streaming support
- [ ] Context window management
- [ ] Multi-turn conversations

---

## Testing

```bash
# Run test script
ANTHROPIC_API_KEY="..." node llm/test-llm.js

# Expected output:
# ✅ Test 1: Fast tier
# ✅ Test 2: JSON schema
# ✅ Test 3: Budget enforcement
# ✅ All tests complete!
```

---

## Troubleshooting

### "API key required"

**Problem:** No API key set

**Solution:**
```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

### "Provider not available"

**Problem:** API key for requested provider not set

**Solution:** Either set the key OR change provider:
```javascript
const llm = new LLMManager({
  defaultProvider: 'openai'  // If only OpenAI key is set
});
```

### "Budget exceeded"

**Problem:** Cost limit reached

**Solution:** Increase budget OR optimize prompts:
```javascript
// Increase budget
const llm = new LLMManager({
  budgets: { per_run_usd: 2.00 }
});

// OR use faster tier
tier: 'fast' instead of 'quality'
```

---

**Approved by:** م. محمود أبو النجا  
**Date:** 2026-02-08
