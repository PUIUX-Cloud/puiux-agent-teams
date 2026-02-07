# Attribution & Acknowledgments

This project was inspired by and learned from several excellent open-source projects in the AI agents space.

---

## Inspirations

### 1. **VoltAgent/awesome-claude-code-subagents**
- **URL:** https://github.com/VoltAgent/awesome-claude-code-subagents
- **License:** MIT
- **What we learned:**
  - Agent frontmatter structure (YAML metadata)
  - Category organization (presales, delivery, qa, meta)
  - Tool assignment philosophy
  - Model routing patterns

**Note:** We did NOT copy code directly. We used the structure and organization as inspiration for building our own PUIUX-specific agents from scratch.

---

### 2. **obra/superpowers**
- **URL:** https://github.com/obra/superpowers
- **License:** MIT
- **What we learned:**
  - Workflow methodology (brainstorming → planning → execution)
  - Test-driven development principles
  - Quality gates between stages
  - Git worktrees for isolation

**Note:** We adopted the workflow philosophy but implemented our own PUIUX presales/delivery pipeline.

---

### 3. **KeygraphHQ/shannon**
- **URL:** https://github.com/KeygraphHQ/shannon
- **License:** AGPL-3.0 ⚠️
- **What we learned:**
  - Multi-phase architecture concept
  - Parallel processing patterns
  - Professional reporting structure

**Important:** We did NOT use any code from shannon due to AGPL license restrictions. We only adopted the high-level architectural concepts (multi-phase, parallel execution).

---

### 4. **ComposioHQ/awesome-claude-skills**
- **URL:** https://github.com/ComposioHQ/awesome-claude-skills
- **License:** Apache-2.0
- **What we learned:**
  - Skills categorization (Document Processing, Development, Business, etc.)
  - Skill structure format (SKILL.md)
  - Integration patterns for SaaS apps

**Note:** We used the categorization ideas for organizing our Knowledge Base but built custom PUIUX workflows.

---

### 5. **OpenAI/skills**
- **URL:** https://github.com/openai/skills
- **License:** MIT
- **What we learned:**
  - Skill folder structure
  - Simple, clean metadata format
  - Separation of system/curated/experimental skills

**Note:** We adopted the `.system/`, `.curated/`, `.experimental/` concept for our KB organization.

---

## What We Built from Scratch

All PUIUX-specific code and content is original:

1. **AGENT_SPEC.md** - 100% PUIUX standard
2. **All agents** - Built specifically for PUIUX workflows (PS0-PS5, S0-S5)
3. **orchestrator.js** - Custom implementation with our gate system
4. **Knowledge Base** - PUIUX-specific playbooks, templates, standards

---

## License Compliance

We have ensured:
- ✅ No code copied from AGPL projects (shannon)
- ✅ All inspirations from MIT/Apache-2.0 licensed projects
- ✅ Used concepts/patterns, not implementations
- ✅ All PUIUX code is proprietary and original

---

## Acknowledgment

We're grateful to the open-source community for sharing their work and ideas. Standing on the shoulders of giants allows us to build better systems faster.

If you're a maintainer of any project listed above and have concerns about how we've referenced your work, please contact us at bot@puiux.com.

---

_Last updated: 7 فبراير 2026_  
_PUIUX Agent Teams v1.0_
