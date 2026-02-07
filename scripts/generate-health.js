#!/usr/bin/env node
/**
 * PUIUX Dashboard - Health Endpoint Generator
 * 
 * Generates health.json with current system status
 * 
 * Usage:
 *   node scripts/generate-health.js
 */

const fs = require('fs').promises;
const path = require('path');

const METRICS_PATH = path.join(__dirname, '..', 'dashboard', 'state', 'metrics.json');
const HEALTH_OUTPUT = path.join(__dirname, '..', 'dashboard', 'web', 'health.json');

async function generateHealth() {
  let metricsData = null;
  let metricsStatus = 'ok';
  let lastUpdate = null;
  
  try {
    const metricsContent = await fs.readFile(METRICS_PATH, 'utf8');
    metricsData = JSON.parse(metricsContent);
    lastUpdate = metricsData.generated_at;
  } catch (error) {
    metricsStatus = 'error';
    console.warn('⚠️  Could not load metrics:', error.message);
  }
  
  const health = {
    status: metricsStatus === 'ok' ? 'operational' : 'degraded',
    version: '1.0',
    service: 'PUIUX Agent Teams Dashboard',
    timestamp: new Date().toISOString(),
    checks: {
      filesystem: 'ok',
      metrics: metricsStatus,
      last_metrics_update: lastUpdate || null
    },
    metrics_summary: metricsData ? {
      total_runs: metricsData.runs_summary?.total || 0,
      total_projects: metricsData.registry?.total_clients || 0,
      blocked_runs: metricsData.runs_summary?.blocked || 0,
      successful_runs: metricsData.runs_summary?.successful || 0
    } : null
  };
  
  // Write health.json (atomic)
  const tmpFile = HEALTH_OUTPUT + '.tmp';
  await fs.writeFile(tmpFile, JSON.stringify(health, null, 2));
  await fs.rename(tmpFile, HEALTH_OUTPUT);
  
  console.log('✅ Health endpoint generated:', HEALTH_OUTPUT);
  console.log('   Status:', health.status);
  console.log('   Metrics:', health.checks.metrics);
}

// Run
generateHealth().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
