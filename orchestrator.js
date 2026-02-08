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
const { redactSecrets } = require('./scripts/redact-secrets');

// ═══════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════

const CONFIG = {
  agentsDir: path.join(__dirname, 'agents'),
  registryPath: '../client-projects-registry/clients.json',
  kbPath: '../puiux-knowledge-base',
  dashboardPath: './dashboard/state',
  logLevel: 'info', // debug|info|warn|error
  
  // LLM Budget Limits (USD)
  budgets: {
    per_run: 2.00,      // Max $2 per agent run
    per_stage: 10.00,   // Max $10 per stage
    per_client: 50.00   // Max $50 per client (total)
  }
};

// ═══════════════════════════════════════════════════════════════
// Gate Policy (Production-grade enforcement)
// ═══════════════════════════════════════════════════════════════

const GATE_POLICY = {
  presales: {
    // PS0-PS4: Always allowed (part of sales process)
    allow: ['PS0', 'PS1', 'PS2', 'PS3', 'PS4'],
    // PS5: Invoice & Payment Verification - requires contract
    require_contract: ['PS5']
  },
  delivery: {
    // S0-S5: All require payment verification
    require_payment: ['S0', 'S1', 'S2', 'S3', 'S4', 'S5']
  },
  production: {
    // Production deployment requires all gates
    require_all: ['DEPLOY', 'PROD', 'RELEASE', 'PRODUCTION']
  }
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
   * Load gates from client-specific gates.json or registry
   */
  async loadGates(clientSlug) {
    // Try client-specific gates.json first (in fixtures)
    const fixturesGatesPath = path.join(__dirname, 'clients', clientSlug, 'gates.json');
    
    try {
      const gatesContent = await fs.readFile(fixturesGatesPath, 'utf8');
      const gates = JSON.parse(gatesContent);
      if (this.logger) {
        this.logger.debug('Gates loaded from fixtures', { client: clientSlug, gates });
      }
      return gates;
    } catch (error) {
      // Fallback: try registry
      try {
        const registryPath = path.join(__dirname, '..', 'client-projects-registry', 'clients.json');
        const registryContent = await fs.readFile(registryPath, 'utf8');
        const registry = JSON.parse(registryContent);
        const client = registry.clients.find(c => c.slug === clientSlug);
        
        if (client && client.gates) {
          if (this.logger) {
            this.logger.debug('Gates loaded from registry', { client: clientSlug, gates: client.gates });
          }
          return client.gates;
        }
      } catch (regError) {
        // Ignore
      }
      
      if (this.logger) {
        this.logger.warn('Gates not found, using blocked defaults', { client: clientSlug });
      }
      
      // Default: all gates blocked (fail-safe)
      return {
        payment_verified: false,
        dns_verified: false,
        contract_signed: false,
        ssl_verified: false
      };
    }
  }

  /**
   * Normalize stage name for comparison
   */
  normalizeStage(stage) {
    return String(stage || '').toUpperCase().trim();
  }

  /**
   * Determine stage family
   */
  stageFamily(stage) {
    const stageNorm = this.normalizeStage(stage);
    
    if (stageNorm.startsWith('PS')) return 'presales';
    if (stageNorm.startsWith('S')) return 'delivery';
    if (['DEPLOY', 'PROD', 'PRODUCTION', 'RELEASE'].includes(stageNorm)) return 'production';
    
    return 'unknown';
  }

  /**
   * Check required gates
   */
  requireGates(gates, requiredKeys) {
    const missing = requiredKeys.filter(k => !gates?.[k]);
    
    if (missing.length > 0) {
      return {
        passed: false,
        reason: `⛔ لا يمكن تشغيل المرحلة. البوابات المطلوبة: ${missing.join(', ')}`,
        missing,
        commercial_message: this.getCommercialMessage(missing)
      };
    }
    
    return { passed: true };
  }

  /**
   * Get commercial-friendly error message
   */
  getCommercialMessage(missingGates) {
    const messages = {
      payment_verified: 'يرجى إتمام الدفع أولاً. تواصل مع قسم المالية.',
      dns_verified: 'يرجى توثيق النطاق أولاً. تواصل مع قسم التقنية.',
      contract_signed: 'يرجى توقيع العقد أولاً. تواصل مع قسم المبيعات.',
      ssl_verified: 'يرجى تفعيل شهادة SSL أولاً. تواصل مع قسم التقنية.'
    };
    
    return missingGates.map(gate => messages[gate] || `Missing: ${gate}`).join('\n');
  }

  /**
   * Check gates for stage execution (production-grade enforcement)
   */
  async checkGates(client, fromStage, toStage) {
    const stage = toStage || fromStage;
    const stageNorm = this.normalizeStage(stage);
    const family = this.stageFamily(stageNorm);
    
    // Load gates
    const gates = await this.loadGates(client.slug);
    
    this.logger.info('Gate check', { 
      client: client.slug, 
      stage: stageNorm, 
      family,
      gates 
    });
    
    let decision = { passed: true };
    
    // Apply policy based on stage family
    if (family === 'presales') {
      // PS0-PS4: Always allowed
      if (GATE_POLICY.presales.allow.includes(stageNorm)) {
        decision = { passed: true, reason: 'Presales stage - always allowed' };
      }
      // PS5: Requires contract
      else if (GATE_POLICY.presales.require_contract.includes(stageNorm)) {
        decision = this.requireGates(gates, ['contract_signed']);
      }
    } 
    else if (family === 'delivery') {
      // S0-S5: All require payment
      decision = this.requireGates(gates, ['payment_verified']);
    } 
    else if (family === 'production') {
      // Production: Requires payment + DNS + SSL
      decision = this.requireGates(gates, ['payment_verified', 'dns_verified', 'ssl_verified']);
    }
    
    if (!decision.passed) {
      this.logger.warn('Gate check FAILED', { 
        client: client.slug, 
        stage: stageNorm, 
        reason: decision.reason,
        missing: decision.missing
      });
    } else {
      this.logger.info('Gate check PASSED', { 
        client: client.slug, 
        stage: stageNorm 
      });
    }
    
    return {
      ...decision,
      stage: stageNorm,
      family,
      gates_state: gates
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// Artifact Integrity Checker
// ═══════════════════════════════════════════════════════════════

class ArtifactChecker {
  /**
   * Check if all artifacts mentioned in deliverables actually exist
   * @param {Object} deliverables - Map of deliverable_name -> filename
   * @param {string} outputDir - Directory where artifacts should exist
   * @returns {Object} { valid: boolean, missing: string[] }
   */
  async checkArtifacts(deliverables, outputDir) {
    const missing = [];
    
    for (const [name, filename] of Object.entries(deliverables)) {
      const filePath = path.join(outputDir, filename);
      
      try {
        await fs.access(filePath);
      } catch {
        missing.push({ name, filename, expected_path: filePath });
      }
    }
    
    return {
      valid: missing.length === 0,
      missing,
      checked: Object.keys(deliverables).length
    };
  }

  /**
   * Basic validation of output structure (NOT full schema validation)
   * TODO: Replace with Ajv for proper JSON schema validation
   * @param {Object} output - Agent output to validate
   * @returns {Object} { valid: boolean, errors: string[] }
   */
  basicValidate(output) {
    // Simple validation (in production should use ajv for proper schema validation)
    const errors = [];
    
    // Check required fields
    if (!output.status || !['success', 'blocked', 'failed'].includes(output.status)) {
      errors.push('Invalid or missing status');
    }
    
    if (!output.result || typeof output.result !== 'object') {
      errors.push('Missing result object');
    } else {
      if (!output.result.summary || typeof output.result.summary !== 'string') {
        errors.push('Missing or invalid result.summary');
      }
      if (!output.result.deliverables || typeof output.result.deliverables !== 'object') {
        errors.push('Missing or invalid result.deliverables');
      }
      if (!output.result.decisions || !Array.isArray(output.result.decisions)) {
        errors.push('Missing or invalid result.decisions');
      }
    }
    
    if (!output.metadata || typeof output.metadata !== 'object') {
      errors.push('Missing metadata object');
    }
    
    return {
      valid: errors.length === 0,
      errors
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
   * Uses pattern matching for tokens + key-based redaction
   */
  redact(data) {
    // Handle strings - apply pattern-based redaction
    if (typeof data === 'string') {
      return redactSecrets(data);
    }
    
    // Handle non-objects
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    const redacted = JSON.parse(JSON.stringify(data)); // Deep clone
    const sensitiveKeys = ['password', 'token', 'secret', 'key', 'credential', 'api_key', 'auth'];

    const redactObject = (obj) => {
      for (const key in obj) {
        // Check if key indicates a secret
        if (sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
          obj[key] = '[REDACTED]';
        } else if (typeof obj[key] === 'string') {
          // Apply pattern-based redaction to string values
          obj[key] = redactSecrets(obj[key]);
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
    this.artifactChecker = new ArtifactChecker();
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
   * Check LLM budget before execution
   * @param {Object} client
   * @param {string} stage
   * @returns {Promise<Object>} { withinBudget: boolean, spent: number, limit: number, reason: string }
   */
  async checkBudget(client, stage) {
    const outputsDir = path.join(__dirname, 'outputs', client.slug);
    
    // Calculate total spent so far
    let totalSpent = 0;
    let stageSpent = 0;

    try {
      const stages = await fs.readdir(outputsDir);
      
      for (const stageDir of stages) {
        const runJsonPath = path.join(outputsDir, stageDir, 'run.json');
        try {
          const runData = JSON.parse(await fs.readFile(runJsonPath, 'utf8'));
          if (runData.llm_usage && runData.llm_usage.total_cost_usd) {
            totalSpent += runData.llm_usage.total_cost_usd;
            if (stageDir === stage) {
              stageSpent += runData.llm_usage.total_cost_usd;
            }
          }
        } catch (err) {
          // Skip if run.json doesn't exist or invalid
        }
      }
    } catch (err) {
      // outputs dir doesn't exist yet - first run
      this.logger.debug('No previous runs found for budget check', { client: client.slug });
    }

    // Check limits
    const limits = this.config.budgets;
    
    if (totalSpent >= limits.per_client) {
      return {
        withinBudget: false,
        spent: totalSpent,
        limit: limits.per_client,
        reason: `تجاوز الحد الأقصى للعميل ($${limits.per_client}). تم صرف $${totalSpent.toFixed(2)}`
      };
    }

    if (stageSpent >= limits.per_stage) {
      return {
        withinBudget: false,
        spent: stageSpent,
        limit: limits.per_stage,
        reason: `تجاوز الحد الأقصى للمرحلة ($${limits.per_stage}). تم صرف $${stageSpent.toFixed(2)}`
      };
    }

    return {
      withinBudget: true,
      spent: totalSpent,
      remaining: limits.per_client - totalSpent
    };
  }

  /**
   * Execute a single stage
   */
  async executeStage(clientSlug, stage) {
    this.logger.info('Starting stage execution', { client: clientSlug, stage });

    // 1. Load client
    const client = await this.loadClient(clientSlug);

    // 2. CHECK GATES (production-grade enforcement)
    const gateResult = await this.gateChecker.checkGates(client, client.current_stage, stage);
    
    if (!gateResult.passed) {
      this.logger.error('❌ Gate check BLOCKED', {
        client: clientSlug,
        stage,
        reason: gateResult.reason,
        missing: gateResult.missing
      });
      
      // Write blocked run manifest (important for visibility!)
      const blockedResult = {
        run_id: `${stage}-${clientSlug}-${Date.now()}`,
        stage,
        client: clientSlug,
        client_name: client.name,
        status: 'blocked',
        reason: gateResult.reason,
        commercial_message: gateResult.commercial_message,
        missing_gates: gateResult.missing,
        gates_state: gateResult.gates_state,
        timestamp: new Date().toISOString(),
        artifacts: [],
        agents: []
      };
      
      // Save blocked manifest
      await this.writeBlockedRunManifest(blockedResult, client, stage);
      
      // Log activity
      await this.appendActivityLog({
        type: 'blocked',
        timestamp: new Date().toISOString(),
        message: `${client.name} حاول تشغيل ${stage} واتمنع: ${gateResult.reason}`
      });
      
      // Update dashboard
      await this.updateDashboard();
      
      return blockedResult;
    }
    
    this.logger.info('✅ Gate check PASSED', { client: clientSlug, stage });

    // 3. CHECK BUDGET
    const budgetCheck = await this.checkBudget(client, stage);
    
    if (!budgetCheck.withinBudget) {
      this.logger.error('❌ Budget limit exceeded', {
        client: clientSlug,
        stage,
        spent: budgetCheck.spent,
        limit: budgetCheck.limit
      });
      
      // Write blocked run manifest
      const blockedResult = {
        run_id: `${stage}-${clientSlug}-${Date.now()}`,
        stage,
        client: clientSlug,
        client_name: client.name,
        status: 'blocked',
        reason: budgetCheck.reason,
        commercial_message: 'تم تجاوز الحد الأقصى للميزانية. يرجى التواصل مع الدعم.',
        budget_exceeded: true,
        spent_usd: budgetCheck.spent,
        limit_usd: budgetCheck.limit,
        timestamp: new Date().toISOString(),
        artifacts: [],
        agents: []
      };
      
      await this.writeBlockedRunManifest(blockedResult, client, stage);
      await this.updateDashboard();
      
      return blockedResult;
    }
    
    this.logger.info('✅ Budget check PASSED', { 
      spent: budgetCheck.spent, 
      remaining: budgetCheck.remaining 
    });

    // 4. Load agents for stage
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

      // 5. After parallel execution, run coordinator if available
      if (stage === 'S2' || agents.length > 1) {
        this.logger.info('Running coordinator consolidation', { stage });
        const coordinatorResult = await this.runCoordinator(client, stage, parallelResults);
        if (coordinatorResult) {
          results.push(coordinatorResult);
        }
      }
    }

    // 6. Consolidate results
    const consolidatedResult = this.consolidateResults(results, stage, client);

    // 7. Generate run manifest
    await this.generateRunManifest(consolidatedResult, client, stage, results);

    // 8. Update dashboard data
    await this.updateDashboard();

    this.logger.info('Stage execution complete', { 
      stage, 
      status: consolidatedResult.status 
    });

    return consolidatedResult;
  }

  /**
   * Run coordinator to consolidate parallel agent outputs
   */
  async runCoordinator(client, stage, agentResults) {
    try {
      const coordinator = await this.loader.loadAgent('meta', 'coordinator-agent');
      
      this.logger.info('Coordinator consolidating outputs', { 
        stage, 
        agents_count: agentResults.length 
      });

      // Prepare context with outputs from all agents
      const context = {
        client: client,
        stage,
        agent_outputs: agentResults,
        kb_path: path.join(__dirname, this.config.kbPath)
      };

      // Execute coordinator
      const startTime = Date.now();
      const consolidatedResult = await this.executeCoordinatorLogic(coordinator, context);

      // Save consolidated outputs
      const outputsDir = path.join(__dirname, 'outputs', client.slug, stage);
      await fs.mkdir(outputsDir, { recursive: true });

      const jsonPath = path.join(outputsDir, 'coordinator-agent.json');
      await fs.writeFile(jsonPath, JSON.stringify(consolidatedResult, null, 2));

      const mdPath = path.join(outputsDir, 'coordinator-agent.md');
      const mdContent = this.generateCoordinatorMarkdown(consolidatedResult, client, stage, agentResults);
      await fs.writeFile(mdPath, mdContent);

      const executionTime = Date.now() - startTime;

      this.logger.info('Coordinator consolidation complete', { 
        stage,
        outputs: [jsonPath, mdPath],
        execution_time_ms: executionTime
      });

      return {
        agent: 'coordinator-agent',
        version: '1.0',
        timestamp: new Date().toISOString(),
        client: client.slug,
        stage,
        status: 'success',
        result: consolidatedResult.result,
        outputs: {
          json: jsonPath,
          markdown: mdPath
        },
        metadata: {
          execution_time_ms: executionTime,
          agents_consolidated: agentResults.length
        }
      };
    } catch (error) {
      this.logger.error('Coordinator failed', { error: error.message });
      return null;
    }
  }

  /**
   * Execute coordinator logic (consolidate outputs) - REAL CALCULATION
   */
  async executeCoordinatorLogic(coordinator, context) {
    const { stage, client, agent_outputs, requirements, constraints } = context;

    // ═══════════════════════════════════════════════════════════
    // 4.1: Read actual JSON outputs from disk (Single Source of Truth)
    // ═══════════════════════════════════════════════════════════
    const outputsDir = path.join(__dirname, 'outputs', client.slug, stage);
    const agentFiles = ['designer-agent.json', 'frontend-agent.json', 'backend-agent.json'];
    const agentData = [];
    const missingInputs = [];

    for (const filename of agentFiles) {
      const filePath = path.join(outputsDir, filename);
      try {
        const content = await fs.readFile(filePath, 'utf8');
        const data = JSON.parse(content);
        agentData.push({ filename, data });
      } catch (error) {
        missingInputs.push(filename);
      }
    }

    // If any agent output missing → BLOCKED
    if (missingInputs.length > 0) {
      return {
        status: 'blocked',
        result: {
          summary: 'Cannot consolidate - missing agent outputs',
          deliverables: {},
          consolidated: {
            total_deliverables: 0,
            total_decisions: 0,
            total_issues: 1,
            total_actions: 0,
            conflicts: 0
          },
          decisions: [],
          issues: [{
            severity: 'critical',
            description: `Missing ${missingInputs.length} agent output(s)`,
            recommendation: 'Ensure all agents in stage completed successfully',
            missing_inputs: missingInputs
          }],
          next_steps: []
        },
        tokens_used: null,
        cost_usd: null
      };
    }

    // ═══════════════════════════════════════════════════════════
    // 4.2: Calculate deliverables with exists check
    // ═══════════════════════════════════════════════════════════
    const allDeliverables = [];
    const deliverablesByAgent = {};

    for (const { filename, data } of agentData) {
      const agentName = filename.replace('.json', '');
      const deliverables = data.result?.deliverables || {};
      
      deliverablesByAgent[agentName] = Object.keys(deliverables).length;

      for (const [key, file] of Object.entries(deliverables)) {
        const filePath = path.join(outputsDir, file);
        let exists = false;
        
        try {
          await fs.access(filePath);
          exists = true;
        } catch {
          exists = false;
        }

        allDeliverables.push({
          agent: agentName,
          key,
          file,
          exists
        });
      }
    }

    const totalDeliverables = allDeliverables.length;
    const missingDeliverables = allDeliverables.filter(d => !d.exists);

    // ═══════════════════════════════════════════════════════════
    // 4.3: Calculate decisions/issues/actions (derived from reality)
    // ═══════════════════════════════════════════════════════════
    const allDecisions = [];
    const allIssues = [];
    const allNextSteps = [];

    for (const { filename, data } of agentData) {
      const agentName = filename.replace('.json', '');
      
      // Collect decisions
      (data.result?.decisions || []).forEach(d => {
        allDecisions.push({ agent: agentName, decision: d });
      });

      // Collect issues
      (data.result?.issues || []).forEach(i => {
        allIssues.push({ agent: agentName, issue: i });
      });

      // Collect next steps
      (data.result?.next_steps || []).forEach(s => {
        allNextSteps.push({ agent: agentName, action: s });
      });
    }

    // ═══════════════════════════════════════════════════════════
    // 4.4: Conflict Detection
    // ═══════════════════════════════════════════════════════════
    const conflicts = [];

    // Conflict A: Tech stack mismatch
    const preferredTech = constraints?.tech_preferences?.[0];
    if (preferredTech) {
      for (const { filename, data } of agentData) {
        const decisions = (data.result?.decisions || []).join(' ');
        
        // Check if frontend agent chose different tech
        if (filename.includes('frontend')) {
          const hasPreferred = decisions.toLowerCase().includes(preferredTech.toLowerCase());
          if (!hasPreferred) {
            conflicts.push({
              type: 'tech_stack_mismatch',
              severity: 'medium',
              description: `Frontend agent didn't mention preferred tech: ${preferredTech}`,
              agents: ['frontend-agent'],
              recommendation: 'Verify tech stack alignment with constraints'
            });
          }
        }
      }
    }

    // Conflict B: Functional requirements coverage
    const requiredFeatures = requirements?.functional || [];
    const allDeliverablesText = allDeliverables.map(d => d.file).join(' ').toLowerCase();
    
    const uncoveredFeatures = requiredFeatures.filter(feature => {
      const featureSlug = feature.toLowerCase().replace(/[^a-z0-9]/g, '-');
      return !allDeliverablesText.includes(featureSlug);
    });

    if (uncoveredFeatures.length > 0) {
      conflicts.push({
        type: 'coverage_gap',
        severity: 'high',
        description: `${uncoveredFeatures.length} functional requirements not reflected in deliverables`,
        uncovered: uncoveredFeatures,
        recommendation: 'Review requirements coverage in design and API specs'
      });
    }

    // Conflict C: Invalid endpoint naming (API spec quality check)
    for (const deliverable of allDeliverables) {
      if (deliverable.file.includes('api-spec') && deliverable.exists) {
        const apiSpecPath = path.join(outputsDir, deliverable.file);
        try {
          const content = await fs.readFile(apiSpecPath, 'utf8');
          const invalidEndpoints = [];
          
          const lines = content.split('\n');
          lines.forEach((line, idx) => {
            const match = line.match(/- \*\*(GET|POST|PUT|PATCH|DELETE)\*\*\s+(\/api\/[^\s]+)/i);
            if (match) {
              const endpoint = match[2].replace('/api/', '');
              // Check for invalid characters (should be slug-safe)
              if (endpoint.includes('(') || endpoint.includes(')') || endpoint.includes(' ')) {
                invalidEndpoints.push({ line: idx + 1, endpoint: match[2] });
              }
            }
          });

          if (invalidEndpoints.length > 0) {
            conflicts.push({
              type: 'invalid_endpoint_naming',
              severity: 'medium',
              description: `${invalidEndpoints.length} API endpoints have non-slug-safe names`,
              file: deliverable.file,
              examples: invalidEndpoints.slice(0, 3),
              recommendation: 'Normalize endpoint slugs (remove spaces, parentheses)'
            });
          }
        } catch (error) {
          // Can't read file - already tracked in missing deliverables
        }
      }
    }

    // ═══════════════════════════════════════════════════════════
    // 4.5: Generate Action Items (derived from issues/conflicts)
    // ═══════════════════════════════════════════════════════════
    const actionItems = [];
    let actionId = 1;

    // Add missing deliverables as action items
    missingDeliverables.forEach(d => {
      actionItems.push({
        id: `${stage}-AI-${String(actionId).padStart(3, '0')}`,
        owner: d.agent,
        severity: 'high',
        title: `Create missing artifact: ${d.file}`,
        source: 'coordinator',
        evidence: `deliverable ${d.key} declared but file not found`,
        next_step: `Write ${d.file} to outputs/${client.slug}/${stage}/`
      });
      actionId++;
    });

    // Add conflicts as action items
    conflicts.forEach(conflict => {
      actionItems.push({
        id: `${stage}-AI-${String(actionId).padStart(3, '0')}`,
        owner: conflict.agents?.[0] || 'team',
        severity: conflict.severity,
        title: conflict.description,
        source: 'coordinator-conflict-detection',
        evidence: conflict.file || conflict.type,
        next_step: conflict.recommendation
      });
      actionId++;
    });

    // Add critical issues as action items
    allIssues.filter(i => i.issue?.severity === 'critical').forEach(i => {
      actionItems.push({
        id: `${stage}-AI-${String(actionId).padStart(3, '0')}`,
        owner: i.agent,
        severity: 'critical',
        title: i.issue.description,
        source: i.agent,
        evidence: i.issue.recommendation || 'See agent output',
        next_step: i.issue.recommendation || 'Resolve critical issue'
      });
      actionId++;
    });

    // ═══════════════════════════════════════════════════════════
    // 4.6: Build consolidated result (ALL NUMBERS DERIVED)
    // ═══════════════════════════════════════════════════════════
    const consolidated = {
      total_deliverables: totalDeliverables,
      deliverables_by_agent: deliverablesByAgent,
      total_decisions: allDecisions.length,
      total_issues: allIssues.length,
      total_actions: actionItems.length,
      conflicts: conflicts.length,
      all_deliverables: allDeliverables,
      all_decisions: allDecisions,
      all_issues: allIssues,
      action_items: actionItems,
      conflicts_detail: conflicts
    };

    // Determine status
    const hasCriticalIssues = allIssues.some(i => i.issue?.severity === 'critical');
    const hasMissingDeliverables = missingDeliverables.length > 0;
    const status = (hasCriticalIssues || hasMissingDeliverables) ? 'blocked' : 'success';

    return {
      status,
      result: {
        summary: `Consolidated outputs from ${agentData.length} agents for stage ${stage}`,
        deliverables: {
          consolidated_brief: 'consolidated-brief.md',
          next_actions: 'next-actions.md',
          blockers: (allIssues.length > 0 || conflicts.length > 0) ? 'blockers.md' : null,
          owners: 'owners.json'
        },
        consolidated,
        decisions: [
          `Consolidated ${agentData.length} agent outputs`,
          `Total deliverables: ${totalDeliverables} (${missingDeliverables.length} missing)`,
          `Total decisions: ${allDecisions.length}`,
          `Total issues: ${allIssues.length}`,
          `Action items: ${actionItems.length}`,
          `Conflicts detected: ${conflicts.length}`
        ],
        issues: hasMissingDeliverables ? [{
          severity: 'high',
          description: `${missingDeliverables.length} deliverables declared but files not found`,
          recommendation: 'Check artifact integrity',
          missing: missingDeliverables.map(d => d.file)
        }] : allIssues,
        next_steps: actionItems.map(a => `[${a.owner}] ${a.title}`)
      },
      tokens_used: null,
      cost_usd: null
    };
  }

  /**
   * Generate coordinator markdown summary
   */
  generateCoordinatorMarkdown(result, client, stage, agentResults) {
    const { consolidated } = result.result;

    return `# Coordinator Consolidation - ${client.name || client.slug} - ${stage}

**Date:** ${new Date().toISOString().split('T')[0]}  
**Status:** ✅ Success  
**Agents Consolidated:** ${agentResults.length}

---

## Summary
${result.result.summary}

---

## Consolidated Metrics
- **Deliverables:** ${consolidated.total_deliverables}
- **Decisions Made:** ${consolidated.total_decisions}
- **Issues Identified:** ${consolidated.total_issues}
- **Action Items:** ${consolidated.total_actions}
- **Conflicts:** ${consolidated.conflicts}

---

## All Deliverables
${(consolidated.all_deliverables || []).map(d => 
  `- ${d.exists ? '✅' : '❌'} **[${d.agent}]** ${d.key} → ${d.file}`).join('\n') || '- No deliverables'}

---

## Decisions by Agent
${consolidated.all_decisions.map((d, i) => 
  `${i + 1}. [${d.agent}] ${d.decision}`).join('\n') || '- No decisions'}

---

## Issues & Blockers
${consolidated.all_issues.map(i => 
  `- [${i.agent}] ${i.issue}`).join('\n') || '- No issues'}

---

## Action Items with Owners
${(consolidated.action_items || []).map(a => 
  `- **${a.severity || 'medium'}**: ${a.title}
  - Next: ${a.next_step || '—'}
  - Owner: ${a.owner || 'unassigned'}`).join('\n') || '- No actions'}

---

## Next Steps
1. Review consolidated brief
2. Assign action items to team members
3. Resolve any blockers
4. Proceed to next stage

---

_Generated by PUIUX Coordinator Agent_
`;
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
    const briefPath = path.join(__dirname, 'clients', client.slug, 'brief.json');
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

    // Write artifact files first (deliverables must exist before validation)
    if (result.result?.deliverables) {
      await this.writeArtifactFiles(result.result.deliverables, outputsDir, context);
    }

    // Validate artifacts integrity
    if (result.result?.deliverables) {
      const artifactCheck = await this.artifactChecker.checkArtifacts(
        result.result.deliverables,
        outputsDir
      );

      if (!artifactCheck.valid) {
        this.logger.warn('Missing artifacts detected', {
          stage,
          agent: agent.name,
          missing: artifactCheck.missing
        });

        // Add to issues
        result.result.issues = result.result.issues || [];
        result.result.issues.push({
          severity: 'high',
          description: `Missing ${artifactCheck.missing.length} artifact file(s)`,
          recommendation: 'Ensure all deliverables are written to disk',
          missing_artifacts: artifactCheck.missing
        });

        // Block if critical
        if (result.status === 'success') {
          result.status = 'blocked';
        }
      }
    }

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
        deliverables.wireframes_notes = 'wireframes-notes.md';
        deliverables.design_system = 'design-system.md';
        
        // Count screens from requirements
        const screenCount = requirements.functional?.length || 5;
        decisions.push(`Created ${screenCount} key screens based on requirements`);
        decisions.push('Defined color palette and typography');
      } else if (agent.name.includes('frontend')) {
        deliverables.component_structure = 'component-structure.md';
        deliverables.state_management = 'state-management.md';
        
        const techStack = constraints.tech_preferences?.[0] || 'React';
        decisions.push(`Selected ${techStack} for frontend`);
        decisions.push('Planned component hierarchy');
      } else if (agent.name.includes('backend')) {
        deliverables.api_spec = 'api-spec.md';
        deliverables.db_schema = 'database-schema.md';
        
        // Count endpoints from requirements
        const endpointCount = requirements.functional?.length * 2 || 10;
        decisions.push(`Designed ${endpointCount} API endpoints`);
        decisions.push('Defined database schema with relationships');
      }
    } else if (stage === 'S3') {
      // ═══════════════════════════════════════════════════════════
      // S3: QA - DERIVED TEST CASES from S2 coordinator outputs
      // ═══════════════════════════════════════════════════════════
      const s2OutputPath = path.join(__dirname, 'outputs', client.slug, 'S2', 'coordinator-agent.json');
      const s2OutputDir = path.join(__dirname, 'outputs', client.slug, 'S2');
      let s2Data = null;
      
      try {
        const s2Content = await fs.readFile(s2OutputPath, 'utf8');
        s2Data = JSON.parse(s2Content);
      } catch (error) {
        issues.push({
          severity: 'critical',
          description: 'S2 outputs not found - cannot create test plan',
          recommendation: 'Run S2 stage first'
        });
      }

      if (s2Data) {
        const consolidated = s2Data.result?.consolidated || {};
        const allDeliverables = consolidated.all_deliverables || [];
        const actionItems = consolidated.action_items || [];

        // Extract API endpoints from api-spec.md
        const apiSpecDeliverable = allDeliverables.find(d => d.file.includes('api-spec'));
        const endpoints = [];
        
        if (apiSpecDeliverable && apiSpecDeliverable.exists) {
          try {
            const apiSpecPath = path.join(s2OutputDir, apiSpecDeliverable.file);
            const apiContent = await fs.readFile(apiSpecPath, 'utf8');
            
            // Parse endpoints from markdown (all HTTP methods)
            const lines = apiContent.split('\n');
            lines.forEach((line, idx) => {
              const match = line.match(/- \*\*(GET|POST|PUT|PATCH|DELETE)\*\*\s+(\/api\/[^\s]+)/i);
              if (match) {
                endpoints.push({
                  method: match[1],
                  path: match[2],
                  line: idx + 1
                });
              }
            });
          } catch (error) {
            // API spec not readable
          }
        }

        // Extract screens from wireframes
        const wireframesDeliverable = allDeliverables.find(d => d.file.includes('wireframes'));
        const screens = [];
        
        if (wireframesDeliverable && wireframesDeliverable.exists) {
          try {
            const wireframesPath = path.join(s2OutputDir, wireframesDeliverable.file);
            const wireframesContent = await fs.readFile(wireframesPath, 'utf8');
            
            // Parse screens from ## Screens section
            const lines = wireframesContent.split('\n');
            let inScreensSection = false;
            
            lines.forEach(line => {
              if (line.includes('## Screens')) {
                inScreensSection = true;
              } else if (inScreensSection && line.match(/^\d+\./)) {
                const screenName = line.replace(/^\d+\.\s*/, '').trim();
                screens.push(screenName);
              } else if (inScreensSection && line.startsWith('##')) {
                inScreensSection = false;
              }
            });
          } catch (error) {
            // Wireframes not readable
          }
        }

        // Generate test cases based on derived data
        const testCases = [];
        let apiTestId = 1;
        let uiTestId = 1;

        // Test cases from API endpoints
        endpoints.forEach(endpoint => {
          testCases.push({
            id: `TC-API-${String(apiTestId).padStart(3, '0')}`,
            title: `${endpoint.method} ${endpoint.path} returns valid response`,
            preconditions: ['user authenticated', 'valid request payload'],
            steps: [
              `Send ${endpoint.method} request to ${endpoint.path}`,
              'Validate response status code',
              'Validate response schema'
            ],
            expected: [
              'Status 200 or 201',
              'Valid JSON response',
              'Response matches API spec'
            ],
            source: `api-spec.md:${endpoint.line}`
          });
          apiTestId++;
        });

        // Test cases from screens
        screens.forEach(screen => {
          testCases.push({
            id: `TC-UI-${String(uiTestId).padStart(3, '0')}`,
            title: `${screen} - UI elements render correctly`,
            preconditions: ['user logged in', 'screen accessible'],
            steps: [
              `Navigate to ${screen}`,
              'Verify all UI elements present',
              'Test interactions'
            ],
            expected: [
              'Screen loads within 3s',
              'All elements visible',
              'No console errors'
            ],
            source: 'wireframes-notes.md'
          });
          uiTestId++;
        });

        // Security test cases
        const securityTests = [
          {
            id: 'SEC-001',
            title: 'Authentication required for protected endpoints',
            preconditions: ['unauthenticated user'],
            steps: ['Attempt to access protected API without token'],
            expected: ['Status 401', 'Error message: Unauthorized']
          },
          {
            id: 'SEC-002',
            title: 'SQL injection prevention',
            preconditions: ['user input fields available'],
            steps: ['Submit SQL injection payload in input'],
            expected: ['Input sanitized', 'No database error', 'Invalid input message']
          },
          {
            id: 'SEC-003',
            title: 'XSS prevention',
            preconditions: ['user can input text'],
            steps: ['Submit script tag in input field'],
            expected: ['Script not executed', 'Text escaped properly']
          },
          {
            id: 'SEC-004',
            title: 'CSRF token validation',
            preconditions: ['CSRF protection enabled'],
            steps: ['Submit form without CSRF token'],
            expected: ['Status 403', 'Request rejected']
          },
          {
            id: 'SEC-005',
            title: 'Rate limiting on API endpoints',
            preconditions: ['rate limit: 100/min'],
            steps: ['Send 101 requests within 1 minute'],
            expected: ['First 100 succeed', '101st returns 429']
          }
        ];

        // Acceptance criteria from action items
        const acceptanceCriteria = actionItems.map((item, idx) => ({
          id: `AC-${String(idx + 1).padStart(3, '0')}`,
          title: item.title,
          criteria: [
            `Issue resolved: ${item.title}`,
            `Evidence provided`,
            `Verified by ${item.owner}`
          ],
          owner: item.owner,
          priority: item.severity
        }));

        deliverables.test_plan = 'test-plan.md';
        deliverables.test_cases = 'test-cases.json';
        deliverables.acceptance_criteria = 'acceptance-criteria.json';
        deliverables.security_tests = 'security-tests.json';

        // Store derived data for artifact generation
        context.testCases = testCases;
        context.securityTests = securityTests;
        context.acceptanceCriteria = acceptanceCriteria;

        decisions.push(`Generated ${testCases.length} test cases from ${endpoints.length} endpoints + ${screens.length} screens`);
        decisions.push(`Created ${securityTests.length} security test scenarios (OWASP-based)`);
        decisions.push(`Defined acceptance criteria for ${actionItems.length} action items`);
        decisions.push(`Identified ${screens.length} UI screens for testing`);

        next_steps.push('Review test plan with team');
        next_steps.push('Set up test automation framework');
        next_steps.push(`Execute ${testCases.length} test cases`);
        next_steps.push('Perform security testing');
      }
    }

    return {
      status: issues.some(i => i.severity === 'critical') ? 'blocked' : 'success',
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
   * Write artifact files mentioned in deliverables
   * @param {Object} deliverables - Map of deliverable_name -> filename
   * @param {string} outputDir - Directory to write artifacts
   * @param {Object} context - Agent execution context
   */
  async writeArtifactFiles(deliverables, outputDir, context) {
    const { stage, client, project, requirements, constraints } = context;

    for (const [name, filename] of Object.entries(deliverables)) {
      const filePath = path.join(outputDir, filename);
      let content = '';

      // Generate placeholder content based on artifact type
      if (filename.includes('wireframes')) {
        content = `# Wireframes - ${project.title || client.name}\n\n`;
        content += `## Overview\n${project.description || 'UI/UX wireframes for the project'}\n\n`;
        content += `## Screens\n`;
        (requirements.functional || []).forEach((req, i) => {
          content += `${i + 1}. ${req}\n`;
        });
      } else if (filename.includes('design-system')) {
        content = `# Design System\n\n`;
        content += `## Colors\n- Primary: #007bff\n- Secondary: #6c757d\n\n`;
        content += `## Typography\n- Headings: Inter, sans-serif\n- Body: System UI\n\n`;
      } else if (filename.includes('api-spec')) {
        content = `# API Specification\n\n`;
        content += `## Endpoints\n`;
        (requirements.functional || []).forEach((req, i) => {
          const endpoint = req.toLowerCase().replace(/\s+/g, '-');
          content += `### ${i + 1}. ${req}\n`;
          content += `- **GET** /api/${endpoint}\n`;
          content += `- **POST** /api/${endpoint}\n\n`;
        });
      } else if (filename.includes('database-schema')) {
        content = `# Database Schema\n\n`;
        content += `## Tables\n`;
        (requirements.functional || []).forEach((req, i) => {
          const table = req.split(' ')[0].toLowerCase();
          content += `### ${table}\n- id (UUID)\n- created_at (TIMESTAMP)\n- updated_at (TIMESTAMP)\n\n`;
        });
      } else if (filename.includes('component-structure')) {
        content = `# Component Structure\n\n`;
        content += `## Component Hierarchy\n`;
        content += `- App\n  - Header\n  - Main\n  - Footer\n\n`;
      } else if (filename.includes('test-plan')) {
        content = `# Test Plan\n\n`;
        content += `## Overview\n`;
        content += `Test plan for ${project.title || client.name}\n\n`;
        content += `## Functional Tests\n`;
        (requirements.functional || []).forEach((req, i) => {
          content += `${i + 1}. Test: ${req}\n`;
        });
      } else if (filename.includes('test-cases.json')) {
        // Write JSON test cases from context
        const testCases = context.testCases || [];
        content = JSON.stringify(testCases, null, 2);
      } else if (filename.includes('security-tests.json')) {
        // Write JSON security tests from context
        const securityTests = context.securityTests || [];
        content = JSON.stringify(securityTests, null, 2);
      } else if (filename.includes('acceptance-criteria.json')) {
        // Write JSON acceptance criteria from context
        const acceptanceCriteria = context.acceptanceCriteria || [];
        content = JSON.stringify(acceptanceCriteria, null, 2);
      } else {
        // Generic placeholder
        content = `# ${name.replace(/_/g, ' ').toUpperCase()}\n\n`;
        content += `Generated for ${client.name || client.slug} - Stage ${stage}\n\n`;
        content += `*This is a placeholder artifact. In production, real content would be generated here.*\n`;
      }

      await fs.writeFile(filePath, content);
    }
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
   * Write blocked run manifest (when gates prevent execution)
   * Important: This makes blocked attempts visible in Dashboard
   */
  async writeBlockedRunManifest(blockedResult, client, stage) {
    const outputsDir = path.join(__dirname, 'outputs', client.slug, stage);
    await fs.mkdir(outputsDir, { recursive: true });
    
    const runPath = path.join(outputsDir, 'run.json');
    await fs.writeFile(runPath, JSON.stringify(blockedResult, null, 2));
    
    this.logger.info('Blocked run manifest saved', { path: runPath });
    
    // Send alert notification
    await this.sendAlert({
      type: 'blocked',
      client: client.slug,
      client_name: client.name,
      stage,
      status: 'blocked',
      run_id: blockedResult.run_id,
      reason: blockedResult.reason,
      missing_gates: blockedResult.missing_gates?.join(', '),
      commercial_message: blockedResult.commercial_message,
      timestamp: blockedResult.timestamp
    });
  }

  /**
   * Append to activity log (dashboard/state/activity.log)
   */
  async appendActivityLog(entry) {
    const activityPath = path.join(__dirname, 'dashboard', 'state', 'activity.log');
    
    // Ensure directory exists
    await fs.mkdir(path.dirname(activityPath), { recursive: true });
    
    const logLine = JSON.stringify(entry) + '\n';
    
    try {
      await fs.appendFile(activityPath, logLine);
    } catch (error) {
      this.logger.warn('Failed to append activity log', { error: error.message });
    }
  }

  /**
   * Generate run manifest (run.json) for each pipeline execution
   * This is the Single Source of Truth for the Dashboard
   * 
   * @param {Object} consolidatedResult - Consolidated execution results
   * @param {Object} client - Client object
   * @param {string} stage - Stage identifier
   * @param {Array} agentResults - Individual agent results
   */
  async generateRunManifest(consolidatedResult, client, stage, agentResults) {
    const outputsDir = path.join(__dirname, 'outputs', client.slug, stage);
    
    // Collect all artifact files
    const artifacts = [];
    try {
      const files = await fs.readdir(outputsDir);
      files.forEach(file => {
        if (file.endsWith('.json') || file.endsWith('.md') || file.endsWith('.yaml')) {
          artifacts.push(file);
        }
      });
    } catch (error) {
      this.logger.warn('Could not read outputs directory for manifest', { 
        dir: outputsDir, 
        error: error.message 
      });
    }

    // Load gates status (from registry or client metadata)
    let gates = {
      payment_verified: false,
      dns_verified: false,
      contract_signed: false,
      proposal_approved: false
    };

    try {
      const gatesPath = path.join(__dirname, 'clients', client.slug, 'gates.json');
      const gatesContent = await fs.readFile(gatesPath, 'utf8');
      gates = JSON.parse(gatesContent);
    } catch (error) {
      this.logger.warn('Could not load gates for manifest', { 
        client: client.slug, 
        error: error.message 
      });
    }

    // Generate run ID (timestamp-based for determinism + uniqueness)
    const runId = `${stage}-${client.slug}-${Date.now()}`;

    // Calculate total cost and tokens (sum from all agents)
    let totalTokens = 0;
    let totalCost = 0;
    agentResults.forEach(result => {
      if (result.tokens_used) totalTokens += result.tokens_used;
      if (result.cost_usd) totalCost += result.cost_usd;
    });

    // Collect LLM usage per agent (if available)
    const llmUsage = {
      total_input_tokens: 0,
      total_output_tokens: 0,
      total_cost_usd: 0,
      by_agent: []
    };

    agentResults.forEach(result => {
      if (result.llm_usage) {
        llmUsage.total_input_tokens += result.llm_usage.input_tokens || 0;
        llmUsage.total_output_tokens += result.llm_usage.output_tokens || 0;
        llmUsage.total_cost_usd += result.llm_usage.cost || 0;
        
        llmUsage.by_agent.push({
          agent: result.agent,
          provider: result.llm_usage.provider || 'unknown',
          model: result.llm_usage.model || 'unknown',
          input_tokens: result.llm_usage.input_tokens || 0,
          output_tokens: result.llm_usage.output_tokens || 0,
          total_tokens: result.llm_usage.total_tokens || 0,
          cost_usd: result.llm_usage.cost || 0
        });
      }
    });

    // Build run manifest
    const manifest = {
      run_id: runId,
      client: client.slug,
      client_name: client.name || client.slug,
      stage,
      status: consolidatedResult.status,
      timestamp: consolidatedResult.timestamp,
      artifacts,
      gates,
      agents: agentResults.map(r => ({
        name: r.agent,
        status: r.status,
        version: r.version || '1.0'
      })),
      metrics: {
        total_artifacts: artifacts.length,
        total_agents: agentResults.length,
        tokens_used: totalTokens || null,
        cost_usd: totalCost || null
      },
      llm_usage: llmUsage.by_agent.length > 0 ? llmUsage : null
    };

    // Write manifest
    const manifestPath = path.join(outputsDir, 'run.json');
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    
    // Log to activity
    await this.appendActivityLog({
      type: manifest.status,
      timestamp: manifest.timestamp,
      message: `${client.name} - ${stage} - ${manifest.status} (${artifacts.length} artifacts)`
    });

    this.logger.info('Run manifest generated', {
      path: manifestPath,
      run_id: runId,
      artifacts_count: artifacts.length
    });
    
    // Send alert if failed or production stage
    if (manifest.status === 'failed') {
      await this.sendAlert({
        type: 'failed',
        client: client.slug,
        client_name: client.name,
        stage,
        status: 'failed',
        run_id: runId,
        artifacts_count: artifacts.length,
        timestamp: manifest.timestamp
      });
    }
    
    // Alert on production deployment attempts
    const stageNorm = String(stage).toUpperCase();
    if (['DEPLOY', 'PROD', 'PRODUCTION', 'RELEASE'].includes(stageNorm)) {
      await this.sendAlert({
        type: 'production',
        client: client.slug,
        client_name: client.name,
        stage,
        status: manifest.status,
        run_id: runId,
        artifacts_count: artifacts.length,
        timestamp: manifest.timestamp
      });
    }

    return manifest;
  }

  /**
   * Update dashboard data after run completion
   */
  async updateDashboard() {
    try {
      const { execSync } = require('child_process');
      const scriptPath = path.join(__dirname, 'scripts', 'generate-dashboard-data.js');
      
      execSync(`node "${scriptPath}"`, { 
        cwd: __dirname,
        stdio: 'ignore' // Silent execution
      });
      
      this.logger.debug('Dashboard data updated');
    } catch (error) {
      this.logger.warn('Could not update dashboard', { error: error.message });
      // Non-critical - don't fail the run
    }
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

  /**
   * Send alert notification via webhook
   */
  async sendAlert(alertData) {
    // Only send if webhook URL is configured
    if (!process.env.PUIUX_ALERT_WEBHOOK_URL) {
      this.logger.debug('Webhook not configured, skipping alert');
      return;
    }
    
    try {
      const { execSync } = require('child_process');
      
      // Build command args
      const args = Object.entries(alertData)
        .filter(([_, value]) => value !== undefined && value !== null)
        .map(([key, value]) => `--${key.replace(/_/g, '-')}="${value}"`)
        .join(' ');
      
      const cmd = `node ${path.join(__dirname, 'scripts', 'notify-webhook.js')} ${args}`;
      
      // Execute webhook notification (async, don't wait)
      execSync(cmd, { 
        stdio: 'ignore',
        timeout: 5000 
      });
      
      this.logger.info('Alert sent', { type: alertData.type });
    } catch (error) {
      this.logger.warn('Failed to send alert', { error: error.message });
    }
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
    console.log('<<<PIPELINE_JSON_START>>>');
    console.log(JSON.stringify(result, null, 2));
    console.log('<<<PIPELINE_JSON_END>>>');
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
