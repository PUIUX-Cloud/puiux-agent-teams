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
  /**
   * Check if gates are satisfied for stage transition
   */
  async checkGates(client, fromStage, toStage) {
    const gates = {
      'PS3_TO_PS4': {
        required: ['proposal_approved'],
        check: (c) => c.presales?.proposal_approved === true
      },
      'PS4_TO_PS5': {
        required: ['contract_signed', 'deposit_received'],
        check: (c) => c.billing?.payment_verified === true
      },
      'PS5_TO_S0': {
        required: ['handoff_complete'],
        check: (c) => c.presales?.handoff_complete === true
      },
      'S4_TO_S5': {
        required: ['qa_passed', 'staging_approved'],
        check: (c) => c.qa?.all_tests_passed === true
      },
      'S5_PRODUCTION': {
        required: ['payment_verified', 'dns_verified'],
        check: (c) => c.billing?.payment_verified === true && 
                     c.ops?.dns_verified === true
      }
    };

    const gateName = `${fromStage}_TO_${toStage}`;
    const gate = gates[gateName];

    if (!gate) {
      return { passed: true, reason: 'No gate defined' };
    }

    const passed = gate.check(client);
    
    return {
      passed,
      gate: gateName,
      required: gate.required,
      reason: passed ? 'Gate passed' : `Missing: ${gate.required.join(', ')}`
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
    this.loader = new AgentLoader(config.agentsDir);
    this.gateChecker = new GateChecker();
    this.logger = new SecureLogger(config.logLevel);
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
   * Execute a single agent (simulated for now)
   */
  async executeAgent(agent, client, stage) {
    this.logger.debug('Executing agent', { 
      agent: agent.name, 
      stage,
      client: client.slug 
    });

    // TODO: Actually execute the agent using LLM
    // For now, return simulated result
    
    return {
      agent: agent.name,
      version: agent.metadata.version || '1.0',
      timestamp: new Date().toISOString(),
      client: client.slug,
      stage,
      status: 'success', // success|failed|blocked
      result: {
        summary: `${agent.name} executed successfully (simulated)`,
        deliverables: {},
        decisions: [],
        issues: [],
        next_steps: []
      },
      metadata: {
        execution_time_ms: 1000,
        tokens_used: 0,
        cost_usd: 0
      }
    };
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
