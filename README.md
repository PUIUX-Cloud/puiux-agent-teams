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

Clients need a `brief.json` file in `../client-{slug}/`:

```json
{
  "client": {
    "slug": "demo-acme",
    "name": "Acme Corporation"
  },
  "project": {
    "title": "Project Name",
    "description": "What to build"
  },
  "requirements": {
    "functional": ["Feature 1", "Feature 2"],
    "technical": ["Requirement 1"]
  },
  "constraints": {
    "budget": 50000,
    "timeline": "12 weeks"
  }
}
```

### Outputs

All outputs saved to `outputs/{client-slug}/{stage}/`:

```
outputs/demo-acme/PS0/
├── presales-agent.json    # Structured data
└── presales-agent.md      # Human-readable summary
```

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
├── AgentLoader      # Load & parse agents
├── GateChecker      # Verify gates (payment, DNS)
├── SecureLogger     # Auto-redact secrets
└── Orchestrator     # Execute stages
```

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

## Testing

```bash
# Test presales workflow
node orchestrator.js --client=demo-acme --stage=PS0

# Test parallel delivery
node orchestrator.js --client=demo-acme --stage=S2

# Check outputs
ls outputs/demo-acme/PS0/
ls outputs/demo-acme/S2/
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
