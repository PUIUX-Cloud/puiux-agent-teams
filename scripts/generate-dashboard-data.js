#!/usr/bin/env node
/**
 * PUIUX Dashboard Data Generator
 * 
 * Scans outputs/ for run.json files and generates dashboard/state/metrics.json
 * This is the Single Source of Truth for the Dashboard UI
 * 
 * Usage:
 *   node scripts/generate-dashboard-data.js
 */

const fs = require('fs').promises;
const path = require('path');

const OUTPUTS_DIR = path.join(__dirname, '..', 'outputs');
const REGISTRY_PATH = path.join(__dirname, '..', '..', 'client-projects-registry', 'clients.json');
const KB_INDEX_PATH = path.join(__dirname, '..', '..', 'puiux-knowledge-base', 'index.json');
const METRICS_OUTPUT = path.join(__dirname, '..', 'dashboard', 'state', 'metrics.json');

async function main() {
  console.log('🔍 Scanning for run.json files...');
  
  // Scan outputs/ for all run.json files
  const runs = await scanRuns();
  console.log(`✅ Found ${runs.length} runs`);
  
  // Load registry
  const registry = await loadRegistry();
  console.log(`✅ Loaded registry: ${registry.clients.length} clients`);
  
  // Load KB index
  const kb = await loadKnowledgeBase();
  const kbFiles = kb.articles || kb.files || [];
  console.log(`✅ Loaded KB: ${kbFiles.length} files`);
  
  // Generate metrics
  const metrics = generateMetrics(runs, registry, kb);
  
  // Write metrics.json (atomic to prevent corruption)
  const tmpFile = METRICS_OUTPUT + '.tmp';
  await fs.writeFile(tmpFile, JSON.stringify(metrics, null, 2));
  await fs.rename(tmpFile, METRICS_OUTPUT);
  console.log(`✅ Dashboard data generated: ${METRICS_OUTPUT}`);
  
  // Print summary
  console.log('\n📊 Summary:');
  console.log(`   Total runs: ${runs.length}`);
  console.log(`   Successful: ${runs.filter(r => r.status === 'success').length}`);
  console.log(`   Failed: ${runs.filter(r => r.status === 'failed').length}`);
  console.log(`   Blocked: ${runs.filter(r => r.status === 'blocked').length}`);
  console.log(`   Total clients: ${registry.clients.length}`);
  console.log(`   Gates blocked: ${metrics.gates_summary.blocked}`);
}

/**
 * Scan outputs/ directory recursively for run.json files
 */
async function scanRuns() {
  const runs = [];
  
  try {
    const clients = await fs.readdir(OUTPUTS_DIR);
    
    for (const client of clients) {
      const clientPath = path.join(OUTPUTS_DIR, client);
      const stat = await fs.stat(clientPath);
      
      if (!stat.isDirectory()) continue;
      
      const stages = await fs.readdir(clientPath);
      
      for (const stage of stages) {
        const runPath = path.join(clientPath, stage, 'run.json');
        
        try {
          const content = await fs.readFile(runPath, 'utf8');
          const run = JSON.parse(content);
          runs.push(run);
        } catch (error) {
          // run.json doesn't exist for this stage - that's ok
        }
      }
    }
  } catch (error) {
    console.warn('⚠️  Could not scan outputs directory:', error.message);
  }
  
  return runs;
}

/**
 * Load client registry
 */
async function loadRegistry() {
  try {
    const content = await fs.readFile(REGISTRY_PATH, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.warn('⚠️  Could not load registry:', error.message);
    return { clients: [], total_clients: 0 };
  }
}

/**
 * Load Knowledge Base index
 */
async function loadKnowledgeBase() {
  try {
    const content = await fs.readFile(KB_INDEX_PATH, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.warn('⚠️  Could not load KB index:', error.message);
    return { files: [] };
  }
}

/**
 * Generate dashboard metrics from runs, registry, and KB
 */
function generateMetrics(runs, registry, kb) {
  // Sort runs by timestamp (newest first)
  runs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  // Calculate gates summary
  const gatesSummary = {
    total: registry.clients.length,
    ready: 0,
    blocked: 0,
    details: {}
  };
  
  registry.clients.forEach(client => {
    const isReady = client.gates?.payment_verified && client.gates?.dns_verified;
    if (isReady) {
      gatesSummary.ready++;
    } else {
      gatesSummary.blocked++;
    }
    
    gatesSummary.details[client.slug] = {
      payment_verified: client.gates?.payment_verified || false,
      dns_verified: client.gates?.dns_verified || false,
      contract_signed: client.gates?.contract_signed || false
    };
  });
  
  // Build projects list (merge registry + latest run data)
  const projects = registry.clients.map(client => {
    // Find latest run for this client
    const clientRuns = runs.filter(r => r.client === client.slug);
    const latestRun = clientRuns[0]; // Already sorted by timestamp
    
    return {
      slug: client.slug,
      name: client.name,
      status: client.status,
      tier: client.tier,
      pod: client.pod,
      presales_stage: client.presales_stage,
      domains: client.domains,
      gates: client.gates || {},
      latest_run: latestRun ? {
        run_id: latestRun.run_id,
        stage: latestRun.stage,
        status: latestRun.status,
        timestamp: latestRun.timestamp,
        artifacts_count: latestRun.artifacts?.length || 0
      } : null,
      blocked_reason: getBlockedReason(client.gates)
    };
  });
  
  // Build runs list (recent 50 runs)
  const recentRuns = runs.slice(0, 50).map(run => ({
    run_id: run.run_id,
    client: run.client,
    client_name: run.client_name,
    stage: run.stage,
    status: run.status,
    timestamp: run.timestamp,
    artifacts_count: run.artifacts?.length || 0,
    agents_count: run.agents?.length || 0,
    tokens_used: run.metrics?.tokens_used || null,
    cost_usd: run.metrics?.cost_usd || null
  }));
  
  // Build activity log from runs
  const activityLog = runs.slice(0, 20).map(run => ({
    timestamp: run.timestamp,
    type: run.status,
    message: `${run.client_name} - ${run.stage} - ${run.status} (${run.artifacts?.length || 0} artifacts)`
  }));
  
  // Calculate totals
  const totalArtifacts = runs.reduce((sum, r) => sum + (r.artifacts?.length || 0), 0);
  const totalTokens = runs.reduce((sum, r) => sum + (r.metrics?.tokens_used || 0), 0);
  const totalCost = runs.reduce((sum, r) => sum + (r.metrics?.cost_usd || 0), 0);
  
  return {
    generated_at: new Date().toISOString(),
    system: {
      status: 'operational',
      version: '1.0',
      uptime: null
    },
    runs_summary: {
      total: runs.length,
      successful: runs.filter(r => r.status === 'success').length,
      failed: runs.filter(r => r.status === 'failed').length,
      blocked: runs.filter(r => r.status === 'blocked').length
    },
    gates_summary: gatesSummary,
    registry: {
      valid: true,
      total_clients: registry.total_clients || registry.clients.length,
      by_status: calculateByStatus(registry.clients),
      by_tier: calculateByTier(registry.clients),
      duplicates: []
    },
    knowledge_base: {
      total_files: (kb.articles || kb.files || []).length,
      files: kb.articles || kb.files || []
    },
    agents: {
      active: 6, // presales, designer, frontend, backend, qa, coordinator
      available: 6
    },
    projects,
    recent_runs: recentRuns,
    activity_log: activityLog,
    metrics: {
      total_runs: runs.length,
      total_artifacts: totalArtifacts,
      total_tokens: totalTokens > 0 ? totalTokens : null,
      total_cost_usd: totalCost > 0 ? totalCost : null
    }
  };
}

/**
 * Calculate clients by status
 */
function calculateByStatus(clients) {
  const counts = {
    presales: 0,
    active: 0,
    paused: 0,
    delivered: 0,
    archived: 0
  };
  
  clients.forEach(client => {
    if (counts.hasOwnProperty(client.status)) {
      counts[client.status]++;
    }
  });
  
  return counts;
}

/**
 * Calculate clients by tier
 */
function calculateByTier(clients) {
  const counts = {
    beta: 0,
    standard: 0,
    premium: 0,
    enterprise: 0
  };
  
  clients.forEach(client => {
    if (counts.hasOwnProperty(client.tier)) {
      counts[client.tier]++;
    }
  });
  
  return counts;
}

/**
 * Get human-readable blocked reason
 */
function getBlockedReason(gates) {
  if (!gates) return 'No gates configured';
  
  const reasons = [];
  if (!gates.payment_verified) reasons.push('Payment not verified');
  if (!gates.dns_verified) reasons.push('DNS not verified');
  if (!gates.contract_signed) reasons.push('Contract not signed');
  
  return reasons.length > 0 ? reasons.join(', ') : null;
}

// Run
main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
