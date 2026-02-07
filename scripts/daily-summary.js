#!/usr/bin/env node
/**
 * PUIUX Agent Teams - Daily Summary
 * 
 * Generates and sends daily summary report
 * 
 * Usage:
 *   node scripts/daily-summary.js
 *   PUIUX_ALERT_WEBHOOK_URL="..." node scripts/daily-summary.js
 * 
 * Typically run via cron:
 *   0 9 * * * cd /path/to/puiux-agent-teams && node scripts/daily-summary.js
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

const METRICS_PATH = path.join(__dirname, '..', 'dashboard', 'state', 'metrics.json');
const WEBHOOK_URL = process.env.PUIUX_ALERT_WEBHOOK_URL;

async function main() {
  console.log('📊 Generating daily summary...');
  
  // Load metrics
  let metrics;
  try {
    const content = await fs.readFile(METRICS_PATH, 'utf8');
    metrics = JSON.parse(content);
  } catch (error) {
    console.error('❌ Could not load metrics:', error.message);
    process.exit(1);
  }
  
  // Calculate summary
  const summary = calculateSummary(metrics);
  
  // Print to console
  printSummary(summary);
  
  // Send webhook if configured
  if (WEBHOOK_URL) {
    await sendSummaryWebhook(summary);
    console.log('✅ Summary sent to webhook');
  } else {
    console.log('ℹ️  PUIUX_ALERT_WEBHOOK_URL not set - webhook skipped');
  }
}

function calculateSummary(metrics) {
  const today = new Date().toISOString().split('T')[0];
  
  // Get today's runs
  const todayRuns = (metrics.recent_runs || []).filter(run => {
    const runDate = new Date(run.timestamp).toISOString().split('T')[0];
    return runDate === today;
  });
  
  // Aggregate stats
  const totalRuns = todayRuns.length;
  const successful = todayRuns.filter(r => r.status === 'success').length;
  const failed = todayRuns.filter(r => r.status === 'failed').length;
  const blocked = todayRuns.filter(r => r.status === 'blocked').length;
  
  // Total artifacts
  const totalArtifacts = todayRuns.reduce((sum, r) => sum + (r.artifacts_count || 0), 0);
  
  // Top blocked reasons
  const blockedReasons = {};
  todayRuns.filter(r => r.status === 'blocked').forEach(run => {
    // Try to extract reason from activity log
    const reason = 'Gates not verified'; // Simplified
    blockedReasons[reason] = (blockedReasons[reason] || 0) + 1;
  });
  
  const topBlockedReasons = Object.entries(blockedReasons)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([reason, count]) => `${reason} (${count}x)`);
  
  // Most active clients
  const clientActivity = {};
  todayRuns.forEach(run => {
    const client = run.client_name || run.client;
    clientActivity[client] = (clientActivity[client] || 0) + 1;
  });
  
  const mostActiveClients = Object.entries(clientActivity)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([client, count]) => `${client} (${count} runs)`);
  
  return {
    date: today,
    total_runs: totalRuns,
    successful,
    failed,
    blocked,
    total_artifacts: totalArtifacts,
    total_projects: metrics.registry?.total_clients || 0,
    blocked_projects: metrics.gates_summary?.blocked || 0,
    top_blocked_reasons: topBlockedReasons,
    most_active_clients: mostActiveClients,
    system_status: metrics.system?.status || 'unknown'
  };
}

function printSummary(summary) {
  console.log('\n═══════════════════════════════════════════');
  console.log(`📊 PUIUX Daily Summary - ${summary.date}`);
  console.log('═══════════════════════════════════════════\n');
  
  console.log(`📈 Runs Today: ${summary.total_runs}`);
  console.log(`   ✅ Successful: ${summary.successful}`);
  console.log(`   ❌ Failed: ${summary.failed}`);
  console.log(`   ⛔ Blocked: ${summary.blocked}`);
  
  console.log(`\n📦 Total Artifacts: ${summary.total_artifacts}`);
  console.log(`📂 Total Projects: ${summary.total_projects}`);
  console.log(`🚫 Blocked Projects: ${summary.blocked_projects}`);
  
  if (summary.top_blocked_reasons.length > 0) {
    console.log('\n🔍 Top Blocked Reasons:');
    summary.top_blocked_reasons.forEach(reason => {
      console.log(`   • ${reason}`);
    });
  }
  
  if (summary.most_active_clients.length > 0) {
    console.log('\n🏆 Most Active Clients:');
    summary.most_active_clients.forEach(client => {
      console.log(`   • ${client}`);
    });
  }
  
  console.log(`\n⚙️  System Status: ${summary.system_status}`);
  console.log('\n═══════════════════════════════════════════\n');
}

async function sendSummaryWebhook(summary) {
  const fields = [
    {
      name: '📈 Runs Today',
      value: `Total: ${summary.total_runs}\n✅ Success: ${summary.successful}\n❌ Failed: ${summary.failed}\n⛔ Blocked: ${summary.blocked}`,
      inline: true
    },
    {
      name: '📦 Artifacts',
      value: `${summary.total_artifacts} files generated`,
      inline: true
    },
    {
      name: '📂 Projects',
      value: `${summary.total_projects} total\n${summary.blocked_projects} blocked`,
      inline: true
    }
  ];
  
  if (summary.top_blocked_reasons.length > 0) {
    fields.push({
      name: '🔍 Top Blocked Reasons',
      value: summary.top_blocked_reasons.join('\n') || 'None',
      inline: false
    });
  }
  
  if (summary.most_active_clients.length > 0) {
    fields.push({
      name: '🏆 Most Active Clients',
      value: summary.most_active_clients.join('\n') || 'None',
      inline: false
    });
  }
  
  const payload = {
    username: 'PUIUX Daily Summary',
    avatar_url: 'https://puiux.com/wp-content/uploads/2021/09/Logo-Black-Copress.svg',
    embeds: [
      {
        title: `📊 PUIUX Daily Summary - ${summary.date}`,
        color: parseInt('4CAF50', 16),
        fields,
        footer: {
          text: 'PUIUX Agent Teams Dashboard'
        },
        timestamp: new Date().toISOString()
      }
    ]
  };
  
  // Send via webhook
  const https = require('https');
  const { URL } = require('url');
  const url = new URL(WEBHOOK_URL);
  const data = JSON.stringify(payload);
  
  return new Promise((resolve, reject) => {
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };
    
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(true);
        } else {
          console.error(`Webhook failed: ${res.statusCode} ${body}`);
          resolve(false);
        }
      });
    });
    
    req.on('error', error => {
      console.error('Webhook error:', error.message);
      resolve(false);
    });
    
    req.write(data);
    req.end();
  });
}

// Run
main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
