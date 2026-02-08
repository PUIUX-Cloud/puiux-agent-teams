# PUIUX Agent Teams

Multi-agent system for automating PUIUX presales and delivery workflows.

---

## Quick Start

### Run a Stage

```bash
node orchestrator.js --client=demo-acme --stage=PS0
node orchestrator.js --client=demo-acme --stage=S2
```

### Inputs

**Client fixtures are stored INSIDE this repo** at `clients/{slug}/`:

```
clients/
├── demo-acme/
│   ├── brief.json
│   └── gates.json
└── demo-retail/
    ├── brief.json
    └── gates.json
```

**brief.json** structure:
```json
{
  "client": {
    "slug": "demo-acme",
    "name": "Acme Corporation",
    "industry": "E-commerce"
  },
  "project": {
    "title": "Online Store Platform",
    "description": "Build a modern e-commerce platform"
  },
  "requirements": {
    "functional": ["Product catalog", "Shopping cart", "Payment"],
    "technical": ["Mobile responsive", "SEO friendly"]
  },
  "constraints": {
    "budget": 50000,
    "budget_currency": "USD",
    "timeline": "12 weeks",
    "tech_preferences": ["React", "Node.js"]
  },
  "goals": {
    "target_launch": "2026-05-01",
    "expected_users": "10,000/month"
  }
}
```

**gates.json** structure:
```json
{
  "payment_verified": false,
  "dns_verified": false,
  "contract_signed": false,
  "proposal_approved": false
}
```

> **Note:** For production clients, link to actual client repos in `client-projects-registry`.

### Outputs

All outputs saved to `outputs/{client-slug}/{stage}/`:

```
outputs/demo-acme/PS0/
├── presales-agent.json    # Structured data
├── presales-agent.md      # Human-readable report
└── run.json               # Run manifest (SSOT for Dashboard)
```

**run.json** includes:
- Run ID, client, stage, status, timestamp
- All artifacts generated
- Gates status snapshot
- Agents executed (name, status, version)
- Metrics (tokens, cost, artifact count)

---

## Dashboard

### Live Monitoring

Open `dashboard/web/index.html` to view:
- **Recent Runs**: Latest pipeline executions with status
- **Gates Monitor**: Payment/DNS/Contract verification status
- **System Status**: Active agents, total clients, KB files
- **Activity Log**: Real-time execution events

### How It Works

1. **orchestrator.js** generates `run.json` after each execution
2. **generate-dashboard-data.js** aggregates all `run.json` files into `dashboard/state/metrics.json`
3. **Dashboard UI** reads `metrics.json` and auto-refreshes every 30s

### Manual Refresh

```bash
node scripts/generate-dashboard-data.js
```

**Output:**
```
🔍 Scanning for run.json files...
✅ Found 4 runs
✅ Loaded registry: 2 clients
✅ Loaded KB: 9 files
✅ Dashboard data generated
```

---

## LLM Integration ✅

### Phase 1: Core Layer (COMPLETE)

PUIUX Agent Teams integrates with multiple LLM providers:

**Supported Providers:**
- ✅ **OpenAI**: GPT-4o, GPT-4o-mini
- ✅ **Anthropic**: Claude Sonnet, Claude Haiku
- ✅ **Gemini**: Gemini Pro, Gemini Flash

**Features:**
- 💰 **Cost Tracking**: Per-run token usage and cost in `run.json`
- 🛡️ **Budget Enforcement**: Configurable limits (per-run, per-stage, per-client)
- 🎯 **Smart Routing**: Provider selection based on agent type
- 📝 **JSON Mode**: Structured outputs with schema validation
- 🔄 **Retry Logic**: Automatic retries with exponential backoff

### Quick Example

```javascript
const ProviderFactory = require('./llm/core/provider-factory');

const factory = new ProviderFactory();
const { provider, model } = factory.getProvider({ category: 'presales', name: 'presales-discovery' });

const result = await provider.generate({
  model,
  messages: [{ role: 'user', content: 'What is 2+2?' }]
});

console.log(result.text);
console.log(`Cost: $${result.cost}`);
```

### Pricing

| Provider  | Model            | Input/1M | Output/1M | Best For          |
|-----------|------------------|----------|-----------|-------------------|
| OpenAI    | GPT-4o           | $5       | $15       | Complex reasoning |
| OpenAI    | GPT-4o-mini      | $0.15    | $0.60     | Fast, cheap       |
| Anthropic | Claude Sonnet    | $3       | $15       | Creative tasks    |
| Anthropic | Claude Haiku     | $0.25    | $1.25     | Fast, systematic  |
| Gemini    | Gemini Pro       | $1.25    | $5        | Long context      |
| Gemini    | Gemini Flash     | $0.075   | $0.30     | Cheapest option   |

### Estimated Costs

- **Per project**: ~$3 - $6
- **Monthly (10 clients)**: ~$30 - $60

**See:** [llm/README.md](./llm/README.md) for full documentation.

---

## Agents

### Presales (PS0-PS5)
- **presales-agent**: Discovery → Requirements → Design → Proposal → Contract → Kickoff

### Delivery (S2)
- **designer-agent**: UI/UX, wireframes, mockups
- **backend-agent**: API, database, architecture

### QA (S3)
- **qa-agent**: Test plans, acceptance criteria

### Meta
- **coordinator-agent**: Consolidates parallel outputs

---

## Architecture

```
orchestrator.js
├── AgentLoader        # Load & parse agents
├── GateChecker        # Verify gates (payment, DNS)
├── ArtifactChecker    # Validate deliverables exist
├── SecureLogger       # Auto-redact secrets
└── Orchestrator       # Execute stages
```

### Key Features (Phase 3.5 Hardening)

✅ **Artifact Integrity**: All deliverables validated for existence
✅ **Derived Calculations**: Zero magic numbers - all metrics calculated from real data
✅ **Conflict Detection**: Tech stack mismatches, coverage gaps, invalid endpoints
✅ **QA Test Generation**: Extracts endpoints from `api-spec.md`, screens from `wireframes-notes.md`
✅ **Action Items**: Auto-generated from conflicts and issues
✅ **Robust Parsing**: JSON markers prevent false positives

### Sequential Execution (PS0):
```
presales-agent → outputs
```

### Parallel Execution (S2):
```
designer-agent ┐
               ├→ outputs (parallel)
backend-agent  ┘
```

---

## Development

### Add New Agent

1. Create `agents/{category}/{name}-agent.md`:

```markdown
---
name: my-agent
description: What it does
stage: PS0|S2|etc
tools: [Read, Write]
model: sonnet
---

# Agent content following AGENT_SPEC.md
```

2. Update `orchestrator.js` stage mapping

3. Test: `node orchestrator.js --client=demo-acme --stage=YOUR_STAGE`

---

## Pipeline Runner

Run complete pipelines (all stages at once):

```bash
# Run full delivery pipeline (S2 → S3)
node pipeline-runner.js --client=demo-acme --pipeline=delivery

# Run full presales pipeline (PS0 → PS5)
node pipeline-runner.js --client=demo-acme --pipeline=presales
```

**Output:**
```
╔═══════════════════════════════════════════╗
║  PUIUX Pipeline Runner - DELIVERY        ║
╚═══════════════════════════════════════════╝

Client: demo-acme
Stages: S2 → S3

🚀 Running S2...
✅ S2 completed successfully

🚀 Running S3...
✅ S3 completed successfully

Total: 2/2 stages completed
✅ Pipeline completed successfully!
```

---

## Testing

```bash
# Test single stage
node orchestrator.js --client=demo-acme --stage=PS0
node orchestrator.js --client=demo-acme --stage=S2

# Test full pipeline
node pipeline-runner.js --client=demo-acme --pipeline=delivery
node pipeline-runner.js --client=demo-retail --pipeline=delivery

# Verify outputs
ls -la outputs/demo-acme/S2/
cat outputs/demo-acme/S2/coordinator-agent.md
jq '.result.consolidated' outputs/demo-acme/S2/coordinator-agent.json
```

---

## Security

- ✅ Auto-redacts secrets in logs
- ✅ `outputs/` excluded from git
- ✅ No credentials in codebase
- ✅ Follows SECURITY.md guidelines

---

## Standards

All agents follow `AGENT_SPEC.md`:
- Standard inputs/outputs
- 5-phase workflow
- Quality gates
- Error handling

---

## License

Proprietary - PUIUX © 2026
