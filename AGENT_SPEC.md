# PUIUX Agent Specification

**Version:** 1.0  
**Last Updated:** 7 فبراير 2026

---

## 📋 Standard Agent Structure

Every PUIUX agent MUST follow this specification for consistency and interoperability.

---

## 1️⃣ **Agent Metadata (Frontmatter)**

```yaml
---
name: agent-role-name
version: 1.0
description: Brief description of when/why this agent activates
category: presales|delivery|business|qa|meta
stage: PS0|PS1|...|S0|S1|...|ALL
tools: [Read, Write, Edit, Bash, Glob, Grep]
model: sonnet|opus|haiku|inherit
requires: [list of required KB files or other agents]
outputs: [json, markdown, report]
---
```

### **Field Definitions:**

- `name`: Unique agent identifier (kebab-case)
- `version`: Semantic version (1.0, 1.1, etc.)
- `description`: When this agent should be invoked
- `category`: Agent type (presales, delivery, business, qa, meta)
- `stage`: Which pipeline stage(s) this agent handles
- `tools`: Allowed OpenClaw tools
- `model`: Preferred model (sonnet for most, opus for complex, haiku for quick)
- `requires`: Dependencies (KB files, other agents, integrations)
- `outputs`: Expected output formats

---

## 2️⃣ **Agent Role Definition**

```markdown
# Agent Name

## Role
You are a [specific role] specialized in [expertise area] for PUIUX projects.

## Core Responsibilities
- Primary responsibility 1
- Primary responsibility 2
- Primary responsibility 3

## Expertise Areas
- Domain knowledge 1
- Domain knowledge 2
- Technical skill 1
- Technical skill 2
```

---

## 3️⃣ **Standard Inputs**

Every agent receives a standardized context object:

```json
{
  "client": {
    "slug": "client-slug",
    "name": "Client Name",
    "tier": "premium|standard|basic",
    "repo_path": "/path/to/client-repo"
  },
  "stage": {
    "current": "PS2|S3|etc",
    "previous": "PS1|S2|etc",
    "deliverables": {}
  },
  "constraints": {
    "budget": 50000,
    "timeline": "2 months",
    "tech_stack": ["React", "Node.js"],
    "requirements": []
  },
  "context": {
    "kb_files": ["/path/to/relevant-kb-files"],
    "previous_outputs": {},
    "related_agents": []
  }
}
```

---

## 4️⃣ **Standard Outputs**

Every agent MUST produce:

### **A) JSON Output (structured data)**

```json
{
  "agent": "agent-name",
  "version": "1.0",
  "timestamp": "2026-02-07T19:00:00Z",
  "client": "client-slug",
  "stage": "PS2",
  "status": "success|failed|blocked",
  "result": {
    "summary": "Brief summary of what was done",
    "deliverables": {
      "file1": "/path/to/output1",
      "file2": "/path/to/output2"
    },
    "decisions": [
      "Decision 1 made",
      "Decision 2 made"
    ],
    "issues": [
      {
        "severity": "critical|high|medium|low",
        "description": "Issue description",
        "recommendation": "How to fix"
      }
    ],
    "next_steps": [
      "Action 1",
      "Action 2"
    ]
  },
  "metadata": {
    "execution_time_ms": 5000,
    "tokens_used": 12000,
    "cost_usd": 0.24
  }
}
```

### **B) Markdown Summary (human-readable)**

```markdown
# [Agent Name] - [Client Name] - [Stage]

**Date:** 2026-02-07  
**Status:** ✅ Success | ⚠️ Blocked | ❌ Failed

---

## Summary
Brief overview of what this agent accomplished.

---

## Deliverables
- ✅ Deliverable 1: [path/to/file1]
- ✅ Deliverable 2: [path/to/file2]

---

## Key Decisions
1. Decision 1 with rationale
2. Decision 2 with rationale

---

## Issues Identified
### 🔴 Critical
- Issue description + recommendation

### 🟡 Medium
- Issue description + recommendation

---

## Next Steps
1. [ ] Action item 1
2. [ ] Action item 2

---

## Metadata
- Execution Time: 5.0s
- Tokens Used: 12,000
- Cost: $0.24
```

---

## 5️⃣ **Workflow Phases**

Every agent follows this execution pattern:

```markdown
## Agent Workflow

### Phase 1: Context Loading
1. Load client information
2. Load relevant KB files
3. Load previous stage outputs
4. Validate all required inputs

### Phase 2: Analysis
1. Analyze requirements
2. Identify constraints
3. Review standards (from KB)
4. Check for blockers

### Phase 3: Execution
1. Perform primary task
2. Generate deliverables
3. Document decisions
4. Identify issues

### Phase 4: Quality Gates
1. Verify outputs against standards
2. Check completeness
3. Validate format
4. Security check (no secrets in output)

### Phase 5: Handoff
1. Generate JSON output
2. Generate Markdown summary
3. Save deliverables
4. Log to activity.log
5. Return control to orchestrator
```

---

## 6️⃣ **Stop Conditions**

Agents MUST stop and escalate when:

```markdown
## When to Stop & Escalate

### ⛔ Immediate Stop (Critical):
- Missing required input data
- Security concern detected
- Client data integrity issue
- Gate verification failed

### ⚠️ Stop & Request Approval:
- Budget constraint exceeded
- Timeline risk identified
- Technical constraint conflict
- Scope change detected

### 📋 Stop & Request Clarification:
- Ambiguous requirements
- Conflicting constraints
- Missing specifications
- Incomplete previous stage

**Action:** Return status: "blocked" with clear reason in JSON output.
```

---

## 7️⃣ **Quality Standards**

Every agent MUST adhere to:

```markdown
## Quality Checklist

### ✅ Deliverables:
- [ ] All outputs in specified format
- [ ] Files saved in correct locations
- [ ] No secrets/credentials in output
- [ ] Proper naming conventions

### ✅ Documentation:
- [ ] Clear summary provided
- [ ] Decisions documented with rationale
- [ ] Issues logged with severity
- [ ] Next steps actionable

### ✅ Consistency:
- [ ] Follows KB standards
- [ ] Matches PUIUX style guide
- [ ] Professional Arabic when client-facing
- [ ] Technical English for internal docs

### ✅ Security:
- [ ] No credentials in logs
- [ ] No client secrets exposed
- [ ] Proper .gitignore compliance
- [ ] Audit trail complete
```

---

## 8️⃣ **Communication Protocol**

### **Inter-Agent Communication:**

```markdown
## Agent-to-Agent Messages

Format:
{
  "from": "agent-name",
  "to": "target-agent-name",
  "message_type": "request|response|notification",
  "payload": {
    "action": "what you need",
    "context": {},
    "priority": "high|medium|low"
  }
}
```

### **Agent-to-Orchestrator:**

```markdown
## Status Updates

Every agent sends periodic updates:
- Progress percentage
- Current phase
- Estimated time remaining
- Any blockers encountered
```

---

## 9️⃣ **Error Handling**

```markdown
## Error Response Format

{
  "status": "failed",
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error",
    "details": "Technical details",
    "recovery": "Suggested recovery action"
  },
  "context": {
    "stage": "PS2",
    "phase": "Analysis",
    "client": "client-slug"
  }
}

## Common Error Codes:
- INPUT_MISSING: Required input not provided
- GATE_FAILED: Quality gate verification failed
- SECURITY_VIOLATION: Security check failed
- RESOURCE_ERROR: File/API not accessible
- CONSTRAINT_CONFLICT: Conflicting requirements
```

---

## 🔟 **Testing Requirements**

Every agent MUST be tested with:

```markdown
## Test Scenarios

### 1. Happy Path:
- All inputs valid
- No constraints violated
- Expected deliverables produced

### 2. Missing Input:
- Test with incomplete data
- Verify proper error handling
- Check escalation works

### 3. Gate Failure:
- Simulate failed quality gate
- Verify blocking behavior
- Check error messaging

### 4. Edge Cases:
- Maximum constraints
- Minimum requirements
- Conflicting inputs
```

---

## 📝 **Example Agent Template**

```markdown
---
name: example-agent
version: 1.0
description: Example agent for reference
category: meta
stage: ALL
tools: [Read, Write]
model: sonnet
requires: []
outputs: [json, markdown]
---

# Example Agent

## Role
You are an example agent demonstrating PUIUX agent standards.

## Core Responsibilities
- Demonstrate proper agent structure
- Show standard input/output formats
- Illustrate quality gates

## Workflow

### Phase 1: Context Loading
[Load and validate inputs]

### Phase 2: Analysis
[Analyze requirements]

### Phase 3: Execution
[Perform task]

### Phase 4: Quality Gates
[Verify outputs]

### Phase 5: Handoff
[Return results]

## Stop Conditions
- [Condition 1]
- [Condition 2]

## Quality Checklist
- [ ] Outputs in JSON format
- [ ] Markdown summary generated
- [ ] No secrets exposed
- [ ] Audit trail logged
```

---

## 🔒 **Security Requirements**

```markdown
## Mandatory Security Rules

### ❌ NEVER Include in Output:
- API keys, tokens, passwords
- SSH credentials
- Database connection strings
- Client secrets
- Payment information

### ✅ ALWAYS:
- Redact sensitive data
- Use environment variables
- Log to secure audit trail
- Follow SECURITY.md guidelines
```

---

## 🎯 **Compliance Checklist**

Before deploying any agent:

```markdown
- [ ] Follows AGENT_SPEC.md structure
- [ ] Has proper frontmatter metadata
- [ ] Defines clear inputs/outputs
- [ ] Implements all 5 workflow phases
- [ ] Has stop conditions defined
- [ ] Includes quality gates
- [ ] Tested with 4 scenarios
- [ ] Security review passed
- [ ] Documentation complete
- [ ] Version tagged
```

---

_This specification is mandatory for all PUIUX agents._  
_Last updated: 7 فبراير 2026_
