# LLM Integration - Phase 1: Core Layer ✅

**Status:** COMPLETE  
**Version:** 1.0  
**Date:** 2026-02-08

---

## 📋 Overview

This is the LLM integration layer for PUIUX Agent Teams. It provides:

- **Provider Abstraction**: Unified interface for multiple LLM providers
- **Cost Tracking**: Per-run token usage and cost calculation
- **Budget Enforcement**: Configurable limits (per-run, per-stage, per-client)
- **Provider Selection**: Smart routing based on agent type and task
- **JSON Mode**: Structured outputs with schema validation
- **Retry Logic**: Automatic retries with exponential backoff

---

## 🏗️ Architecture

```
llm/
├── core/
│   ├── base-provider.js      # Abstract base class
│   └── provider-factory.js   # Provider selection strategy
├── clients/
│   ├── openai.js             # OpenAI (GPT-4o, GPT-4o-mini)
│   ├── anthropic.js          # Anthropic (Claude Sonnet, Haiku)
│   └── gemini.js             # Google (Gemini Pro, Flash)
├── test-providers.js         # Test suite
└── README.md                 # This file
```

---

## 🚀 Usage

### 1. Basic Generation

```javascript
const OpenAIProvider = require('./llm/clients/openai');

const provider = new OpenAIProvider();

const result = await provider.generate({
  model: 'gpt-4o-mini',
  messages: [
    { role: 'user', content: 'Hello, world!' }
  ],
  maxTokens: 500,
  temperature: 0.7
});

console.log(result.text);
console.log(`Cost: $${result.cost}`);
```

### 2. JSON Mode

```javascript
const result = await provider.generate({
  model: 'gpt-4o-mini',
  messages: [
    { role: 'user', content: 'Generate user profile' }
  ],
  responseFormat: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      age: { type: 'number' },
      active: { type: 'boolean' }
    },
    required: ['name', 'age']
  }
});

console.log(result.parsed); // { name: "...", age: 25, active: true }
```

### 3. Provider Factory

```javascript
const ProviderFactory = require('./llm/core/provider-factory');

const factory = new ProviderFactory();

// Get provider for agent
const agent = {
  category: 'delivery',
  name: 'frontend-dev'
};

const { provider, model } = factory.getProvider(agent);
const result = await provider.generate({ model, messages: [...] });
```

---

## 💰 Pricing (Per 1M Tokens)

| Provider  | Model            | Input   | Output  | Best For          |
|-----------|------------------|---------|---------|-------------------|
| OpenAI    | GPT-4o           | $5.00   | $15.00  | Complex reasoning |
| OpenAI    | GPT-4o-mini      | $0.15   | $0.60   | Fast, cheap       |
| Anthropic | Claude Sonnet    | $3.00   | $15.00  | Creative, detailed|
| Anthropic | Claude Haiku     | $0.25   | $1.25   | Fast, systematic  |
| Gemini    | Gemini Pro       | $1.25   | $5.00   | Long context      |
| Gemini    | Gemini Flash     | $0.075  | $0.30   | Cheapest option   |

---

## 🎯 Provider Selection Strategy

**Strategy: Mix of Gemini (cheap) + OpenAI (quality) + Anthropic (backup)**

```javascript
// Default preferences per agent type
{
  presales:    { provider: 'gemini',    model: 'flash' },      // Fast & cheap
  designer:    { provider: 'gemini',    model: 'pro' },        // Creative
  frontend:    { provider: 'openai',    model: 'gpt-4o-mini' },// Code gen (best)
  backend:     { provider: 'anthropic', model: 'haiku' },      // Complex logic
  qa:          { provider: 'gemini',    model: 'flash' },      // Systematic
  coordinator: { provider: 'openai',    model: 'gpt-4o-mini' } // Consolidation
}
```

**Smart Fallback:** If OpenAI API key is missing (no credit), automatically falls back to Gemini Flash.

**Cost with OpenAI:**
- 4 agents use Gemini (~$0.000004/req)
- 2 agents use OpenAI (~$0.000003/req for gpt-4o-mini)
- 1 agent uses Anthropic (~$0.000021/req)

**Cost without OpenAI (fallback):**
- 6 agents use Gemini/Anthropic (same as before)

---

## 💵 Budget Limits

Configured in `orchestrator.js`:

```javascript
budgets: {
  per_run: 2.00,      // Max $2 per agent run
  per_stage: 10.00,   // Max $10 per stage
  per_client: 50.00   // Max $50 per client (total)
}
```

Budget is checked before each stage execution. If exceeded, the run is blocked with status `blocked` and `budget_exceeded: true`.

---

## 📊 Cost Tracking

Cost is tracked in `run.json`:

```json
{
  "run_id": "S2-demo-acme-1739000000000",
  "llm_usage": {
    "total_input_tokens": 5000,
    "total_output_tokens": 1500,
    "total_cost_usd": 0.0225,
    "by_agent": [
      {
        "agent": "frontend-dev",
        "provider": "openai",
        "model": "gpt-4o",
        "input_tokens": 2500,
        "output_tokens": 800,
        "total_tokens": 3300,
        "cost_usd": 0.0115
      },
      {
        "agent": "backend-api",
        "provider": "anthropic",
        "model": "claude-3-5-sonnet-20241022",
        "input_tokens": 2500,
        "output_tokens": 700,
        "total_tokens": 3200,
        "cost_usd": 0.0110
      }
    ]
  }
}
```

---

## 🧪 Testing

Run test suite:

```bash
node llm/test-providers.js
```

Tests:
1. ✅ Simple response (Arabic)
2. ✅ JSON mode (all providers)
3. ✅ Provider factory (agent routing)

---

## 🔑 Environment Variables

### Setup

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Add your API keys to `.env`:
   ```bash
   # Required (free tier available)
   GOOGLE_AI_API_KEY=AIzaSy...
   
   # Optional (for quality tasks)
   ANTHROPIC_API_KEY=sk-ant-api03-...
   
   # Optional (not currently used)
   OPENAI_API_KEY=sk-...
   ```

3. **Never commit `.env` to Git!** (already in `.gitignore`)

### Get API Keys

- **Gemini (Free):** https://ai.google.dev → Get API Key
- **Anthropic:** https://console.anthropic.com → API Keys
- **OpenAI:** https://platform.openai.com → API Keys

**Security:** Keys are loaded from environment, **never** hardcoded or committed.

---

## 📈 Estimated Costs

### Scenario 1: With OpenAI Credit (Recommended)

**Per Client Project:**
- **Presales (PS0-PS5)**: ~$0.05 - $0.15 (Gemini Flash)
- **Delivery (S0-S5)**: ~$0.25 - $0.60 (Gemini + OpenAI + Anthropic)
- **Total per project**: ~$0.40 - $1.20

**Monthly (10 clients):** ~**$4 - $12/month**

**Breakdown:**
- 4 agents use Gemini (~$0.000004/req)
- 2 agents use OpenAI GPT-4o-mini (~$0.000003/req)
- 1 agent uses Anthropic Haiku (~$0.000021/req)

### Scenario 2: Without OpenAI (Fallback)

**Per Client Project:**
- **Presales (PS0-PS5)**: ~$0.05 - $0.15 (Gemini Flash)
- **Delivery (S0-S5)**: ~$0.20 - $0.50 (Gemini + Anthropic)
- **Total per project**: ~$0.30 - $1.00

**Monthly (10 clients):** ~**$3 - $10/month**

**Breakdown:**
- 6 agents use Gemini/Anthropic (auto-fallback if no OpenAI key)

---

## ✅ Phase 1 Complete

**Implemented:**
- ✅ Base provider abstraction
- ✅ OpenAI client (GPT-4o, GPT-4o-mini)
- ✅ Anthropic client (Claude Sonnet, Haiku)
- ✅ Gemini client (Gemini Pro, Flash)
- ✅ Cost tracking persistence
- ✅ Budget enforcement
- ✅ Provider selection strategy
- ✅ Test suite

**Next Steps:**
- 🔄 **Phase 2**: Agent Prompting (prompt templates, JSON schemas)
- 🔄 **Phase 3**: Replace simulated agents with real LLM calls

---

## 📚 Resources

- [OpenAI API Docs](https://platform.openai.com/docs/api-reference)
- [Anthropic API Docs](https://docs.anthropic.com/en/api)
- [Gemini API Docs](https://ai.google.dev/api/rest)
- [PUIUX Agent Teams](../README.md)

---

**Built by PUIUX** 🤖  
**Date:** 2026-02-08
