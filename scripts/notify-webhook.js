#!/usr/bin/env node
/**
 * PUIUX Agent Teams - Webhook Notifier
 * 
 * Sends alerts to Slack/Discord via webhook
 * 
 * Usage:
 *   node scripts/notify-webhook.js --type=failed --client=demo-acme --stage=S2 --run-id=...
 *   PUIUX_ALERT_WEBHOOK_URL="https://..." node scripts/notify-webhook.js --type=blocked ...
 * 
 * Environment Variables:
 *   PUIUX_ALERT_WEBHOOK_URL - Webhook URL (required)
 *   PUIUX_ALERT_CHANNEL - Channel override (optional)
 */

const https = require('https');
const { URL } = require('url');
const { redactSecrets } = require('./redact-secrets');

// ═══════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════

const WEBHOOK_URL = process.env.PUIUX_ALERT_WEBHOOK_URL;
const CHANNEL = process.env.PUIUX_ALERT_CHANNEL;
const DASHBOARD_URL = 'https://dashboard.puiux.cloud';

// ═══════════════════════════════════════════════════════════════
// Alert Types & Emojis
// ═══════════════════════════════════════════════════════════════

const ALERT_CONFIG = {
  failed: {
    emoji: '🚨',
    color: '#F44336',
    title: 'PUIUX Alert: RUN FAILED',
    priority: 'high'
  },
  blocked: {
    emoji: '⛔',
    color: '#FF9800',
    title: 'PUIUX Alert: RUN BLOCKED',
    priority: 'medium'
  },
  production: {
    emoji: '🚀',
    color: '#2196F3',
    title: 'PUIUX Alert: PRODUCTION DEPLOYMENT ATTEMPT',
    priority: 'critical'
  },
  schema_fail: {
    emoji: '❌',
    color: '#9C27B0',
    title: 'PUIUX Alert: SCHEMA VALIDATION FAILED',
    priority: 'high'
  },
  success: {
    emoji: '✅',
    color: '#4CAF50',
    title: 'PUIUX: Run Successful',
    priority: 'low'
  }
};

// ═══════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════

async function main() {
  // Parse args
  const args = parseArgs();
  
  // Validate webhook URL
  if (!WEBHOOK_URL) {
    console.error('❌ PUIUX_ALERT_WEBHOOK_URL not set');
    console.error('Set it via: export PUIUX_ALERT_WEBHOOK_URL="https://hooks.slack.com/..."');
    process.exit(1);
  }
  
  // Build alert payload
  const alert = buildAlert(args);
  
  // Send webhook
  const success = await sendWebhook(alert);
  
  if (success) {
    console.log('✅ Alert sent successfully');
  } else {
    console.error('❌ Failed to send alert');
    process.exit(1);
  }
}

// ═══════════════════════════════════════════════════════════════
// Parse Arguments
// ═══════════════════════════════════════════════════════════════

function parseArgs() {
  const args = {};
  
  process.argv.slice(2).forEach(arg => {
    const match = arg.match(/^--([^=]+)=(.+)$/);
    if (match) {
      const key = match[1].replace(/-/g, '_');
      args[key] = match[2];
    }
  });
  
  // Required
  if (!args.type) {
    console.error('❌ Missing --type (failed|blocked|production|schema_fail)');
    process.exit(1);
  }
  
  return args;
}

// ═══════════════════════════════════════════════════════════════
// Build Alert Payload
// ═══════════════════════════════════════════════════════════════

function buildAlert(args) {
  const config = ALERT_CONFIG[args.type] || ALERT_CONFIG.failed;
  
  const fields = [
    {
      name: 'Client',
      value: args.client || 'N/A',
      inline: true
    },
    {
      name: 'Stage',
      value: args.stage || 'N/A',
      inline: true
    },
    {
      name: 'Status',
      value: args.status || args.type,
      inline: true
    }
  ];
  
  // Add run ID if available
  if (args.run_id) {
    fields.push({
      name: 'Run ID',
      value: `\`${args.run_id}\``,
      inline: false
    });
  }
  
  // Add reason if blocked/failed
  if (args.reason) {
    fields.push({
      name: 'Reason',
      value: redactSecrets(args.reason),
      inline: false
    });
  }
  
  // Add missing gates if blocked
  if (args.missing_gates) {
    fields.push({
      name: 'Missing Gates',
      value: args.missing_gates,
      inline: false
    });
  }
  
  // Add commercial message if available
  if (args.commercial_message) {
    fields.push({
      name: 'Action Required',
      value: redactSecrets(args.commercial_message),
      inline: false
    });
  }
  
  // Add artifacts count
  if (args.artifacts_count !== undefined) {
    fields.push({
      name: 'Artifacts',
      value: args.artifacts_count,
      inline: true
    });
  }
  
  // Add timestamp
  fields.push({
    name: 'Time',
    value: args.timestamp || new Date().toISOString(),
    inline: true
  });
  
  // Add links
  const links = [];
  if (args.client && args.stage) {
    links.push(`[Dashboard](${DASHBOARD_URL})`);
    if (args.run_id) {
      links.push(`[Run JSON](${DASHBOARD_URL}/outputs/${args.client}/${args.stage}/run.json)`);
    }
  }
  
  if (links.length > 0) {
    fields.push({
      name: 'Links',
      value: links.join(' • '),
      inline: false
    });
  }
  
  // Build payload (Discord/Slack compatible)
  return {
    username: 'PUIUX Agent Teams',
    avatar_url: 'https://puiux.com/wp-content/uploads/2021/09/Logo-Black-Copress.svg',
    embeds: [
      {
        title: `${config.emoji} ${config.title}`,
        color: parseInt(config.color.replace('#', ''), 16),
        fields,
        footer: {
          text: 'PUIUX Agent Teams Dashboard'
        },
        timestamp: new Date().toISOString()
      }
    ]
  };
}

// ═══════════════════════════════════════════════════════════════
// Send Webhook
// ═══════════════════════════════════════════════════════════════

function sendWebhook(payload) {
  return new Promise((resolve, reject) => {
    const url = new URL(WEBHOOK_URL);
    const data = JSON.stringify(payload);
    
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
      
      res.on('data', chunk => {
        body += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(true);
        } else {
          console.error(`Webhook failed: ${res.statusCode} ${body}`);
          resolve(false);
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('Webhook error:', error.message);
      resolve(false);
    });
    
    req.write(data);
    req.end();
  });
}

// ═══════════════════════════════════════════════════════════════
// Run
// ═══════════════════════════════════════════════════════════════

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
}

module.exports = { sendWebhook, buildAlert };
