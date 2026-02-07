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
