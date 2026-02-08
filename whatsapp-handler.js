#!/usr/bin/env node
/**
 * PUIUX Agent Teams - WhatsApp Command Handler
 * 
 * Handles WhatsApp commands to control Agent Teams
 * 
 * Commands:
 *   /start PS0 demo-acme - Start a stage
 *   /status demo-acme - Get project status
 *   /gates demo-acme - Show gates status
 *   /runs demo-acme - Show recent runs
 *   /dashboard - Get dashboard link
 * 
 * Usage (from AGENTS.md in main OpenClaw session):
 *   This file is called automatically when a WhatsApp message
 *   starts with "/" or contains agent team keywords
 */

const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

const fs = require('fs').promises;
const path = require('path');

// ═══════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════

const DASHBOARD_URL = 'https://dashboard.puiux.cloud';
const METRICS_PATH = path.join(__dirname, 'dashboard', 'state', 'metrics.json');
const REGISTRY_PATH = path.join(__dirname, '..', 'client-projects-registry', 'clients.json');

// ═══════════════════════════════════════════════════════════════
// Main Handler
// ═══════════════════════════════════════════════════════════════

async function handleCommand(message, sender) {
  // Parse command
  const parts = message.trim().split(/\s+/);
  const command = parts[0].toLowerCase();
  const args = parts.slice(1);
  
  console.log(`📱 WhatsApp command: ${command}`, args);
  
  try {
    let response;
    
    switch (command) {
      case '/start':
        response = await handleStart(args);
        break;
      
      case '/status':
        response = await handleStatus(args);
        break;
      
      case '/gates':
        response = await handleGates(args);
        break;
      
      case '/runs':
        response = await handleRuns(args);
        break;
      
      case '/dashboard':
        response = handleDashboard();
        break;
      
      case '/help':
        response = handleHelp();
        break;
      
      default:
        response = `❓ أمر غير معروف: ${command}\n\nاستخدم */help* لعرض الأوامر المتاحة.`;
    }
    
    return response;
  } catch (error) {
    console.error('Error handling command:', error);
    return `❌ خطأ: ${error.message}`;
  }
}

// ═══════════════════════════════════════════════════════════════
// Command Handlers
// ═══════════════════════════════════════════════════════════════

async function handleStart(args) {
  if (args.length < 2) {
    return '❌ *خطأ:* يجب تحديد المرحلة والعميل\n\n*مثال:* /start PS0 demo-acme';
  }
  
  const [stage, client] = args;
  
  // Validate client exists
  const clientExists = await checkClientExists(client);
  if (!clientExists) {
    return `❌ *خطأ:* العميل "${client}" غير موجود\n\nاستخدم */status* لعرض العملاء المتاحين.`;
  }
  
  // Execute orchestrator
  console.log(`🚀 Starting ${stage} for ${client}...`);
  
  try {
    const { stdout, stderr } = await execAsync(
      `node orchestrator.js --client=${client} --stage=${stage}`,
      { cwd: __dirname, timeout: 120000 } // 2 minutes timeout
    );
    
    // Parse result (look for run ID in output)
    const runIdMatch = stdout.match(/run_id["\s:]+([A-Z0-9-]+)/i);
    const runId = runIdMatch ? runIdMatch[1] : 'unknown';
    
    // Check if blocked or success
    if (stdout.includes('"status": "blocked"')) {
      const reasonMatch = stdout.match(/"reason":\s*"([^"]+)"/);
      const reason = reasonMatch ? reasonMatch[1] : 'غير محدد';
      
      return `⛔ *محجوب*\n\n` +
             `*العميل:* ${client}\n` +
             `*المرحلة:* ${stage}\n` +
             `*السبب:* ${reason}\n\n` +
             `يرجى إتمام المتطلبات أولاً.`;
    }
    
    if (stdout.includes('"status": "success"')) {
      const artifactsMatch = stdout.match(/"artifacts_count":\s*(\d+)/);
      const artifacts = artifactsMatch ? artifactsMatch[1] : '0';
      
      return `✅ *نجح التشغيل*\n\n` +
             `*العميل:* ${client}\n` +
             `*المرحلة:* ${stage}\n` +
             `*Run ID:* \`${runId}\`\n` +
             `*الملفات:* ${artifacts}\n\n` +
             `🔗 ${DASHBOARD_URL}`;
    }
    
    // Generic success
    return `✅ تم تشغيل ${stage} للعميل ${client}\n\nRun ID: \`${runId}\``;
    
  } catch (error) {
    console.error('Execution error:', error);
    return `❌ *فشل التشغيل*\n\n` +
           `*العميل:* ${client}\n` +
           `*المرحلة:* ${stage}\n` +
           `*الخطأ:* ${error.message}\n\n` +
           `تحقق من الـ logs للمزيد من التفاصيل.`;
  }
}

async function handleStatus(args) {
  const client = args[0];
  
  // Load metrics
  let metrics;
  try {
    const content = await fs.readFile(METRICS_PATH, 'utf8');
    metrics = JSON.parse(content);
  } catch (error) {
    return '❌ فشل تحميل البيانات';
  }
  
  // If no client specified, show all
  if (!client) {
    let response = `📊 *حالة النظام*\n\n`;
    response += `*الحالة:* ${metrics.system.status === 'operational' ? '✅ يعمل' : '❌ خطأ'}\n`;
    response += `*المشاريع:* ${metrics.registry.total_clients}\n`;
    response += `*المحجوبة:* ${metrics.gates_summary.blocked}\n\n`;
    
    response += `*العملاء:*\n`;
    metrics.projects.forEach(p => {
      const status = p.gates.payment_verified && p.gates.dns_verified ? '✅' : '⛔';
      response += `${status} ${p.name}\n`;
    });
    
    response += `\n🔗 ${DASHBOARD_URL}`;
    
    return response;
  }
  
  // Find specific client
  const project = metrics.projects.find(p => p.slug === client || p.name.includes(client));
  
  if (!project) {
    return `❓ العميل "${client}" غير موجود`;
  }
  
  let response = `📊 *${project.name}*\n\n`;
  response += `*Slug:* ${project.slug}\n`;
  response += `*الحالة:* ${getStatusArabic(project.status)}\n`;
  response += `*الفئة:* ${getTierArabic(project.tier)}\n`;
  response += `*Pod:* ${project.pod}\n\n`;
  
  response += `*البوابات:*\n`;
  response += `${project.gates.payment_verified ? '✅' : '❌'} الدفع\n`;
  response += `${project.gates.dns_verified ? '✅' : '❌'} النطاق\n`;
  response += `${project.gates.contract_signed ? '✅' : '❌'} العقد\n\n`;
  
  if (project.latest_run) {
    response += `*آخر تشغيل:*\n`;
    response += `المرحلة: ${project.latest_run.stage}\n`;
    response += `الحالة: ${getStatusArabic(project.latest_run.status)}\n`;
    response += `الملفات: ${project.latest_run.artifacts_count}\n`;
  }
  
  return response;
}

async function handleGates(args) {
  const client = args[0];
  
  if (!client) {
    return '❌ *خطأ:* يجب تحديد العميل\n\n*مثال:* /gates demo-acme';
  }
  
  // Load registry
  let registry;
  try {
    const content = await fs.readFile(REGISTRY_PATH, 'utf8');
    registry = JSON.parse(content);
  } catch (error) {
    return '❌ فشل تحميل البيانات';
  }
  
  const project = registry.clients.find(c => c.slug === client);
  
  if (!project) {
    return `❓ العميل "${client}" غير موجود`;
  }
  
  const gates = project.gates || {};
  
  let response = `🚦 *بوابات ${project.name}*\n\n`;
  
  response += `${gates.payment_verified ? '✅' : '❌'} *الدفع*\n`;
  if (!gates.payment_verified) {
    response += `   يرجى إتمام الدفع أولاً\n`;
  }
  
  response += `${gates.dns_verified ? '✅' : '❌'} *النطاق*\n`;
  if (!gates.dns_verified) {
    response += `   يرجى توثيق النطاق\n`;
  }
  
  response += `${gates.contract_signed ? '✅' : '❌'} *العقد*\n`;
  if (!gates.contract_signed) {
    response += `   يرجى توقيع العقد\n`;
  }
  
  response += `${gates.ssl_verified ? '✅' : '❌'} *SSL*\n`;
  
  const allPassed = gates.payment_verified && gates.dns_verified && gates.contract_signed;
  
  if (allPassed) {
    response += `\n✅ *جميع البوابات مفتوحة*`;
  } else {
    response += `\n⛔ *يوجد بوابات محجوبة*`;
  }
  
  return response;
}

async function handleRuns(args) {
  const client = args[0];
  
  // Load metrics
  let metrics;
  try {
    const content = await fs.readFile(METRICS_PATH, 'utf8');
    metrics = JSON.parse(content);
  } catch (error) {
    return '❌ فشل تحميل البيانات';
  }
  
  let runs = metrics.recent_runs || [];
  
  // Filter by client if specified
  if (client) {
    runs = runs.filter(r => r.client === client || r.client_name.includes(client));
  }
  
  if (runs.length === 0) {
    return client 
      ? `❓ لا توجد عمليات تشغيل للعميل "${client}"`
      : '❓ لا توجد عمليات تشغيل';
  }
  
  let response = `📋 *آخر ${Math.min(runs.length, 5)} عمليات*\n\n`;
  
  runs.slice(0, 5).forEach(run => {
    const statusEmoji = run.status === 'success' ? '✅' : 
                       run.status === 'blocked' ? '⛔' : '❌';
    response += `${statusEmoji} *${run.stage}* - ${run.client_name}\n`;
    response += `   الحالة: ${getStatusArabic(run.status)}\n`;
    response += `   الملفات: ${run.artifacts_count}\n`;
    response += `   ${formatTime(run.timestamp)}\n\n`;
  });
  
  response += `🔗 ${DASHBOARD_URL}`;
  
  return response;
}

function handleDashboard() {
  return `📊 *Dashboard*\n\n` +
         `🔗 ${DASHBOARD_URL}\n\n` +
         `*Credentials:*\n` +
         `Username: admin\n` +
         `Password: (محفوظ في السجلات الآمنة)\n\n` +
         `*Features:*\n` +
         `• Kanban Board\n` +
         `• Gates Monitor\n` +
         `• Recent Runs\n` +
         `• Knowledge Base\n` +
         `• Health Status`;
}

function handleHelp() {
  return `📱 *PUIUX Agent Teams - أوامر WhatsApp*\n\n` +
         `*/start* \`<stage> <client>\`\n` +
         `   تشغيل مرحلة معينة\n` +
         `   مثال: /start PS0 demo-acme\n\n` +
         `*/status* \`[client]\`\n` +
         `   عرض حالة النظام أو عميل معين\n\n` +
         `*/gates* \`<client>\`\n` +
         `   عرض حالة البوابات\n\n` +
         `*/runs* \`[client]\`\n` +
         `   عرض آخر العمليات\n\n` +
         `*/dashboard*\n` +
         `   رابط Dashboard\n\n` +
         `*/help*\n` +
         `   عرض هذه المساعدة\n\n` +
         `🔗 ${DASHBOARD_URL}`;
}

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

async function checkClientExists(slug) {
  try {
    const content = await fs.readFile(REGISTRY_PATH, 'utf8');
    const registry = JSON.parse(content);
    return registry.clients.some(c => c.slug === slug);
  } catch (error) {
    return false;
  }
}

function getStatusArabic(status) {
  const map = {
    'success': 'نجح',
    'failed': 'فشل',
    'blocked': 'محجوب',
    'presales': 'مبيعات',
    'active': 'نشط',
    'delivered': 'مسلّم'
  };
  return map[status] || status;
}

function getTierArabic(tier) {
  const map = {
    'beta': 'تجريبي',
    'standard': 'قياسي',
    'premium': 'مميز'
  };
  return map[tier] || tier;
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleString('ar-EG', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// ═══════════════════════════════════════════════════════════════
// Export / CLI
// ═══════════════════════════════════════════════════════════════

if (require.main === module) {
  // Called from CLI
  const message = process.argv[2];
  const sender = process.argv[3] || 'unknown';
  
  handleCommand(message, sender).then(response => {
    console.log(response);
  }).catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
}

module.exports = { handleCommand };
