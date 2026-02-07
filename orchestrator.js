#!/usr/bin/env node
/**
 * PUIUX Agent Teams - Orchestrator
 * 
 * Simple orchestrator skeleton for managing agent execution
 * Version: 1.0 (MVP)
 * 
 * Usage:
 *   node orchestrator.js --client=demo-acme --stage=PS0
 *   node orchestrator.js --client=demo-acme --stage=S2
 */

const fs = require('fs').promises;
const path = require('path');

// ═══════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════

const CONFIG = {
  agentsDir: path.join(__dirname, 'agents'),
  registryPath: '../client-projects-registry/clients.json',
  kbPath: '../puiux-knowledge-base',
  dashboardPath: './dashboard/state',
  logLevel: 'info' // debug|info|warn|error
};

// ═══════════════════════════════════════════════════════════════
// Agent Loader
// ═══════════════════════════════════════════════════════════════

class AgentLoader {
  constructor(agentsDir) {
    this.agentsDir = agentsDir;
    this.loadedAgents = new Map();
  }

  /**
   * Load agent by category and name
   * @param {string} category - presales|delivery|business|qa|meta
   * @param {string} name - Agent file name (without .md)
   * @returns {Object} Agent metadata + content
   */
  async loadAgent(category, name) {
    const cacheKey = `${category}/${name}`;
    
    if (this.loadedAgents.has(cacheKey)) {
      return this.loadedAgents.get(cacheKey);
    }

    const agentPath = path.join(this.agentsDir, category, `${name}.md`);
    
    try {
      const content = await fs.readFile(agentPath, 'utf8');
      const agent = this.parseAgent(content, category, name);
      this.loadedAgents.set(cacheKey, agent);
      return agent;
    } catch (error) {
      throw new Error(`Failed to load agent ${category}/${name}: ${error.message}`);
    }
  }

  /**
   * Parse agent markdown file (frontmatter + content)
   */
  parseAgent(content, category, name) {
    const frontmatterMatch = content.match(/^---\n([\s\S]+?)\n---/);
    
    if (!frontmatterMatch) {
      throw new Error(`Invalid agent format: ${category}/${name} (missing frontmatter)`);
    }

    const frontmatter = this.parseFrontmatter(frontmatterMatch[1]);
    const body = content.slice(frontmatterMatch[0].length).trim();

    return {
      metadata: frontmatter,
      content: body,
      category,
      name
    };
  }

  /**
   * Parse YAML frontmatter
   */
  parseFrontmatter(yaml) {
    const metadata = {};
    const lines = yaml.split('\n');
    
    lines.forEach(line => {
      const match = line.match(/^(\w+):\s*(.+)$/);
      if (match) {
        const key = match[1];
        let value = match[2].trim();
        
        // Parse arrays [item1, item2]
        if (value.startsWith('[') && value.endsWith(']')) {
          value = value.slice(1, -1).split(',').map(v => v.trim());
        }
        
        metadata[key] = value;
      }
    });
    
    return metadata;
  }

  /**
   * Get all agents for a stage
   */
  async getAgentsForStage(stage) {
    // Stage mapping
    const stageMap = {
      'PS0': ['presales/presales-agent'],
      'PS1': ['presales/presales-agent'],
      'PS2': ['presales/presales-agent'],
      'PS3': ['presales/presales-agent'],
      'PS4': ['presales/presales-agent'],
      'PS5': ['presales/presales-agent'],
      'S0': ['delivery/setup-agent'],
      'S1': ['delivery/planning-agent'],
      'S2': ['delivery/designer-agent', 'delivery/frontend-agent', 'delivery/backend-agent'], // Parallel
      'S3': ['qa/qa-agent'],
      'S4': ['delivery/deployment-agent'],
      'S5': ['delivery/deployment-agent']
    };

    const agentPaths = stageMap[stage] || [];
    const agents = [];

    for (const path of agentPaths) {
      const [category, name] = path.split('/');
      try {
        const agent = await this.loadAgent(category, name.replace('.md', ''));
        agents.push(agent);
      } catch (error) {
        console.warn(`Warning: Could not load ${path}: ${error.message}`);
      }
    }

    return agents;
  }
}

// ═══════════════════════════════════════════════════════════════
// Gate Checker
// ═══════════════════════════════════════════════════════════════

class GateChecker {
  constructor(logger) {
    this.logger = logger;
  }

  /**
   * Load gates from client-specific gates.json
   */
  async loadGates(clientSlug) {
    const gatesPath = path.join(__dirname, `../client-${clientSlug}/gates.json`);
    
    try {
      const gatesContent = await fs.readFile(gatesPath, 'utf8');
      const gates = JSON.parse(gatesContent);
      if (this.logger) {
        this.logger.debug('Gates loaded', { client: clientSlug, gates });
      }
      return gates;
    } catch (error) {
      if (this.logger) {
        this.logger.warn('Gates file not found, using defaults', { client: clientSlug });
      }
      // Default: all gates blocked
      return {
        payment_verified: false,
        dns_verified: false,
        contract_signed: false,
        proposal_approved: false,
        qa_passed: false
      };
    }
  }

  /**
   * Check if gates are satisfied for stage transition
   */
  async checkGates(client, fromStage, toStage) {
    // Load gates from client-specific file
    const gates = await this.loadGates(client.slug);

    const gateRules = {
      'PS3_TO_PS4': {
        required: ['proposal_approved'],
        check: (g) => g.proposal_approved === true
      },
      'PS4_TO_PS5': {
        required: ['contract_signed', 'payment_verified'],
        check: (g) => g.contract_signed === true && g.payment_verified === true
      },
      'PS5_TO_S0': {
        required: ['payment_verified'],
        check: (g) => g.payment_verified === true
      },
      'S4_TO_S5': {
        required: ['qa_passed', 'staging_approved'],
        check: (g) => g.qa_passed === true && g.staging_approved === true
      },
      'S5_PRODUCTION': {
        required: ['payment_verified', 'dns_verified', 'qa_passed'],
        check: (g) => g.payment_verified === true && 
                     g.dns_verified === true &&
                     g.qa_passed === true
      }
    };

    const gateName = `${fromStage}_TO_${toStage}`;
    const rule = gateRules[gateName];

    if (!rule) {
      return { passed: true, reason: 'No gate defined' };
    }

    const passed = rule.check(gates);
    
    return {
      passed,
      gate: gateName,
      required: rule.required,
      gates_state: gates,
      reason: passed ? 'Gate passed' : `Missing: ${rule.required.filter(r => !gates[r]).join(', ')}`
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// Logger (Secure - No Secrets)
// ═══════════════════════════════════════════════════════════════

class SecureLogger {
  constructor(logLevel = 'info') {
    this.logLevel = logLevel;
    this.levels = { debug: 0, info: 1, warn: 2, error: 3 };
  }

  /**
   * Redact sensitive data before logging
   */
  redact(data) {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    const redacted = JSON.parse(JSON.stringify(data)); // Deep clone
    const sensitiveKeys = ['password', 'token', 'secret', 'key', 'credential', 'api_key'];

    const redactObject = (obj) => {
      for (const key in obj) {
        if (sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
          obj[key] = '[REDACTED]';
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          redactObject(obj[key]);
        }
      }
    };

    redactObject(redacted);
    return redacted;
  }

  log(level, message, data = {}) {
    if (this.levels[level] >= this.levels[this.logLevel]) {
      const timestamp = new Date().toISOString();
      const redactedData = this.redact(data);
      console.log(JSON.stringify({
        timestamp,
        level,
        message,
        data: redactedData
      }));
    }
  }

  debug(message, data) { this.log('debug', message, data); }
  info(message, data) { this.log('info', message, data); }
  warn(message, data) { this.log('warn', message, data); }
  error(message, data) { this.log('error', message, data); }
}

// ═══════════════════════════════════════════════════════════════
// Orchestrator
// ═══════════════════════════════════════════════════════════════

class Orchestrator {
  constructor(config) {
    this.config = config;
    this.logger = new SecureLogger(config.logLevel);
    this.loader = new AgentLoader(config.agentsDir);
    this.gateChecker = new GateChecker(this.logger);
  }

  /**
   * Load client data from registry
   */
  async loadClient(clientSlug) {
    const registryPath = path.join(__dirname, this.config.registryPath);
    
    try {
      const registry = JSON.parse(await fs.readFile(registryPath, 'utf8'));
      const client = registry.clients.find(c => c.slug === clientSlug);
      
      if (!client) {
        throw new Error(`Client ${clientSlug} not found in registry`);
      }

      this.logger.info('Client loaded', { slug: clientSlug, stage: client.current_stage });
      return client;
    } catch (error) {
      throw new Error(`Failed to load client: ${error.message}`);
    }
  }

  /**
   * Execute a single stage
   */
  async executeStage(clientSlug, stage) {
    this.logger.info('Starting stage execution', { client: clientSlug, stage });

    // 1. Load client
    const client = await this.loadClient(clientSlug);

    // 2. Check gates (if moving to new stage)
    if (client.current_stage !== stage) {
      const gateResult = await this.gateChecker.checkGates(client, client.current_stage, stage);
      
      if (!gateResult.passed) {
        this.logger.error('Gate check failed', gateResult);
        return {
          status: 'blocked',
          reason: gateResult.reason,
          gate: gateResult.gate
        };
      }
    }

    // 3. Load agents for stage
    const agents = await this.loader.getAgentsForStage(stage);
    
    if (agents.length === 0) {
      this.logger.warn('No agents found for stage', { stage });
      return {
        status: 'failed',
        reason: `No agents configured for ${stage}`
      };
    }

    // 4. Execute agents
    this.logger.info('Executing agents', { 
      stage, 
      agents: agents.map(a => a.name),
      parallel: agents.length > 1
    });

    const results = [];

    if (agents.length === 1) {
      // Sequential execution
      const result = await this.executeAgent(agents[0], client, stage);
      results.push(result);
    } else {
      // Parallel execution (for S2, etc.)
      this.logger.info('Executing in parallel', { count: agents.length });
      const promises = agents.map(agent => this.executeAgent(agent, client, stage));
      const parallelResults = await Promise.all(promises);
      results.push(...parallelResults);
    }

    // 5. Consolidate results
    const consolidatedResult = this.consolidateResults(results, stage, client);

    this.logger.info('Stage execution complete', { 
      stage, 
      status: consolidatedResult.status 
    });

    return consolidatedResult;
  }

  /**
   * Execute a single agent (REAL execution with file I/O)
   */
  async executeAgent(agent, client, stage) {
    this.logger.debug('Executing agent', { 
      agent: agent.name, 
      stage,
      client: client.slug 
    });

    const startTime = Date.now();

    // 1. Load client brief
    const briefPath = path.join(__dirname, `../client-${client.slug}/brief.json`);
    let brief = {};
    
    try {
      const briefContent = await fs.readFile(briefPath, 'utf8');
      brief = JSON.parse(briefContent);
      this.logger.debug('Brief loaded', { client: client.slug, brief });
    } catch (error) {
      this.logger.warn('Brief not found, using registry data', { client: client.slug });
      brief = { client };
    }

    // 2. Prepare context for agent
    const context = {
      client: brief.client || client,
      project: brief.project || {},
      requirements: brief.requirements || {},
      constraints: brief.constraints || {},
      goals: brief.goals || {},
      stage,
      kb_path: path.join(__dirname, this.config.kbPath)
    };

    // 3. Execute agent logic (simplified for MVP - would call LLM here)
    const result = await this.executeAgentLogic(agent, context);

    // 4. Save outputs
    const outputsDir = path.join(__dirname, 'outputs', client.slug, stage);
    await fs.mkdir(outputsDir, { recursive: true });

    // Save JSON output
    const jsonPath = path.join(outputsDir, `${agent.name}.json`);
    await fs.writeFile(jsonPath, JSON.stringify(result, null, 2));

    // Save Markdown summary
    const mdPath = path.join(outputsDir, `${agent.name}.md`);
    const mdContent = this.generateMarkdownSummary(result, agent, client, stage);
    await fs.writeFile(mdPath, mdContent);

    const executionTime = Date.now() - startTime;

    this.logger.info('Agent execution complete', {
      agent: agent.name,
      stage,
      status: result.status,
      outputs: [jsonPath, mdPath],
      execution_time_ms: executionTime
    });

    return {
      agent: agent.name,
      version: agent.metadata.version || '1.0',
      timestamp: new Date().toISOString(),
      client: client.slug,
      stage,
      status: result.status,
      result: result.result,
      outputs: {
        json: jsonPath,
        markdown: mdPath
      },
      metadata: {
        execution_time_ms: executionTime,
        tokens_used: result.tokens_used || 0,
        cost_usd: result.cost_usd || 0
      }
    };
  }

  /**
   * Execute agent logic (simplified - would integrate LLM here)
   */
  async executeAgentLogic(agent, context) {
    // For MVP: Generate realistic output based on agent type and stage
    // In production: This would call LLM with agent.content as system prompt
    
    const { stage, client, project, requirements, constraints } = context;

    // Simulate agent thinking and producing output
    const summary = `${agent.metadata.description} for ${client.name || client.slug}`;
    
    const deliverables = {};
    const decisions = [];
    const issues = [];
    const next_steps = [];

    // Stage-specific outputs
    if (stage === 'PS0') {
      deliverables.discovery_questions = 'discovery-questions.md';
      decisions.push('Identified as e-commerce project');
      decisions.push(`Budget: $${constraints.budget} USD`);
      next_steps.push('Schedule discovery call');
      next_steps.push('Send discovery questionnaire');
    } else if (stage === 'PS1') {
      deliverables.requirements_doc = 'requirements.md';
      decisions.push(`${requirements.functional?.length || 0} functional requirements captured`);
      next_steps.push('Review requirements with client');
    } else if (stage === 'PS2') {
      deliverables.design_doc = 'design.md';
      deliverables.tech_stack = 'tech-stack.md';
      decisions.push('Selected React + Node.js stack');
      next_steps.push('Create high-level architecture');
    } else if (stage === 'S2') {
      if (agent.name.includes('designer')) {
        deliverables.wireframes = 'wireframes.pdf';
        deliverables.design_system = 'design-system.md';
        decisions.push('Created 10 key screens');
      } else if (agent.name.includes('backend')) {
        deliverables.api_spec = 'api-spec.yaml';
        deliverables.db_schema = 'database-schema.sql';
        decisions.push('Designed 15 API endpoints');
      }
    }

    return {
      status: 'success',
      result: {
        summary,
        deliverables,
        decisions,
        issues,
        next_steps
      },
      // Real metrics (MVP: unknown until LLM integration)
      tokens_used: null,
      cost_usd: null
    };
  }

  /**
   * Generate Markdown summary from result
   */
  generateMarkdownSummary(result, agent, client, stage) {
    const status = result.status === 'success' ? '✅ Success' :
                   result.status === 'blocked' ? '⚠️ Blocked' : '❌ Failed';

    return `# ${agent.metadata.name} - ${client.name || client.slug} - ${stage}

**Date:** ${new Date().toISOString().split('T')[0]}  
**Status:** ${status}

---

## Summary
${result.result.summary}

---

## Deliverables
${Object.entries(result.result.deliverables).map(([key, val]) => 
  `- ✅ ${key}: ${val}`).join('\n') || '- No deliverables'}

---

## Key Decisions
${result.result.decisions.map((d, i) => `${i + 1}. ${d}`).join('\n') || '- No decisions recorded'}

---

## Issues Identified
${result.result.issues.map(i => `- ${i}`).join('\n') || '- No issues'}

---

## Next Steps
${result.result.next_steps.map((s, i) => `${i + 1}. [ ] ${s}`).join('\n') || '- No next steps'}

---

## Metadata
- Execution Time: ${result.metadata?.execution_time_ms || 0}ms
- Tokens Used: ${result.tokens_used !== null ? result.tokens_used : 'Unknown (MVP)'}
- Cost: ${result.cost_usd !== null ? `$${result.cost_usd.toFixed(2)}` : 'Unknown (MVP)'}

---

_Generated by PUIUX Agent Teams_
`;
  }


  /**
   * Consolidate results from multiple agents
   */
  consolidateResults(results, stage, client) {
    const allSucceeded = results.every(r => r.status === 'success');
    const anyBlocked = results.some(r => r.status === 'blocked');
    const anyFailed = results.some(r => r.status === 'failed');

    let status = 'success';
    if (anyBlocked) status = 'blocked';
    else if (anyFailed) status = 'failed';

    return {
      stage,
      client: client.slug,
      status,
      agents: results.map(r => ({
        name: r.agent,
        status: r.status,
        summary: r.result.summary
      })),
      summary: `Stage ${stage} ${status}`,
      timestamp: new Date().toISOString()
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// CLI Interface
// ═══════════════════════════════════════════════════════════════

async function main() {
  const args = process.argv.slice(2);
  const params = {};

  args.forEach(arg => {
    const [key, value] = arg.replace('--', '').split('=');
    params[key] = value;
  });

  if (!params.client || !params.stage) {
    console.error('Usage: node orchestrator.js --client=<slug> --stage=<PS0|S2|etc>');
    process.exit(1);
  }

  try {
    const orchestrator = new Orchestrator(CONFIG);
    const result = await orchestrator.executeStage(params.client, params.stage);

    console.log('\n═══════════════════════════════════════════');
    console.log('ORCHESTRATOR RESULT');
    console.log('═══════════════════════════════════════════\n');
    console.log(JSON.stringify(result, null, 2));
    console.log('\n═══════════════════════════════════════════\n');

    process.exit(result.status === 'success' ? 0 : 1);
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

// Export for testing
module.exports = { Orchestrator, AgentLoader, GateChecker, SecureLogger };
