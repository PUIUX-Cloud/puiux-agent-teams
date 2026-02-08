# WhatsApp Integration - PUIUX Agent Teams

**Status:** ✅ Ready  
**Date:** 2026-02-08  
**Version:** 1.0

---

## Overview

Control PUIUX Agent Teams directly from WhatsApp with commands.

---

## Features

✅ **Start Stages** - `/start PS0 demo-acme`  
✅ **Check Status** - `/status demo-acme`  
✅ **View Gates** - `/gates demo-acme`  
✅ **Recent Runs** - `/runs demo-acme`  
✅ **Dashboard Link** - `/dashboard`  
✅ **Help** - `/help`

---

## Setup

### 1. Add to AGENTS.md (Main OpenClaw Session)

Add this to your main OpenClaw workspace `/data/.openclaw/workspace/AGENTS.md`:

```markdown
## WhatsApp Commands for Agent Teams

When I receive a WhatsApp message starting with `/` that looks like an Agent Teams command:

1. Check if it's one of: /start, /status, /gates, /runs, /dashboard, /help
2. If yes, execute:
   ```bash
   cd /data/.openclaw/workspace/puiux-repos/puiux-agent-teams
   node whatsapp-handler.js "$MESSAGE" "$SENDER"
   ```
3. Send the response back to WhatsApp

**Examples:**
- Message: `/status demo-acme`
- Command: `node whatsapp-handler.js "/status demo-acme" "+201029899994"`
- Response: (send to WhatsApp)
```

### 2. Test

```bash
cd /data/.openclaw/workspace/puiux-repos/puiux-agent-teams

# Test status command
node whatsapp-handler.js "/status"

# Test specific client
node whatsapp-handler.js "/status demo-acme"

# Test gates
node whatsapp-handler.js "/gates demo-acme"

# Test help
node whatsapp-handler.js "/help"
```

---

## Commands

### `/start <stage> <client>`

**Start a pipeline stage**

**Example:**
```
/start PS0 demo-acme
```

**Response:**
```
✅ نجح التشغيل

العميل: demo-acme
المرحلة: PS0
Run ID: PS0-demo-acme-1770520000000
الملفات: 4

🔗 https://dashboard.puiux.cloud
```

**If blocked:**
```
⛔ محجوب

العميل: demo-acme
المرحلة: S2
السبب: ⛔ لا يمكن تشغيل المرحلة. البوابات المطلوبة: payment_verified

يرجى إتمام المتطلبات أولاً.
```

---

### `/status [client]`

**Check system or client status**

**Example (all clients):**
```
/status
```

**Response:**
```
📊 حالة النظام

الحالة: ✅ يعمل
المشاريع: 2
المحجوبة: 2

العملاء:
⛔ ACME Corporation (Demo)
⛔ RetailPro Solutions (Demo)

🔗 https://dashboard.puiux.cloud
```

**Example (specific client):**
```
/status demo-acme
```

**Response:**
```
📊 ACME Corporation (Demo)

Slug: demo-acme
الحالة: مبيعات
الفئة: تجريبي
Pod: corporate

البوابات:
❌ الدفع
❌ النطاق
❌ العقد

آخر تشغيل:
المرحلة: PS0
الحالة: نجح
الملفات: 4
```

---

### `/gates <client>`

**Check gates status**

**Example:**
```
/gates demo-acme
```

**Response:**
```
🚦 بوابات ACME Corporation (Demo)

❌ الدفع
   يرجى إتمام الدفع أولاً
❌ النطاق
   يرجى توثيق النطاق
❌ العقد
   يرجى توقيع العقد
✅ SSL

⛔ يوجد بوابات محجوبة
```

**When all passed:**
```
🚦 بوابات ACME Corporation (Demo)

✅ الدفع
✅ النطاق
✅ العقد
✅ SSL

✅ جميع البوابات مفتوحة
```

---

### `/runs [client]`

**View recent runs**

**Example:**
```
/runs demo-acme
```

**Response:**
```
📋 آخر 5 عمليات

✅ PS0 - ACME Corporation (Demo)
   الحالة: نجح
   الملفات: 4
   فبر. 7, 23:18

⛔ S2 - ACME Corporation (Demo)
   الحالة: محجوب
   الملفات: 0
   فبر. 7, 23:18

🔗 https://dashboard.puiux.cloud
```

---

### `/dashboard`

**Get dashboard link and credentials**

**Response:**
```
📊 Dashboard

🔗 https://dashboard.puiux.cloud

Credentials:
Username: admin
Password: (محفوظ في السجلات الآمنة)

Features:
• Kanban Board
• Gates Monitor
• Recent Runs
• Knowledge Base
• Health Status
```

---

### `/help`

**Show available commands**

**Response:**
```
📱 PUIUX Agent Teams - أوامر WhatsApp

/start <stage> <client>
   تشغيل مرحلة معينة
   مثال: /start PS0 demo-acme

/status [client]
   عرض حالة النظام أو عميل معين

/gates <client>
   عرض حالة البوابات

/runs [client]
   عرض آخر العمليات

/dashboard
   رابط Dashboard

/help
   عرض هذه المساعدة

🔗 https://dashboard.puiux.cloud
```

---

## Integration with PUIUX Bot (OpenClaw Main Session)

Add this logic to your main OpenClaw bot's message handler:

```javascript
// In message handler (when WhatsApp message received)

if (message.startsWith('/') && isAgentTeamsCommand(message)) {
  const { execSync } = require('child_process');
  
  try {
    const response = execSync(
      `cd /data/.openclaw/workspace/puiux-repos/puiux-agent-teams && ` +
      `node whatsapp-handler.js "${message}" "${sender}"`,
      { encoding: 'utf8', timeout: 120000 }
    );
    
    // Send response back to WhatsApp
    await sendWhatsAppMessage(sender, response);
  } catch (error) {
    await sendWhatsAppMessage(sender, `❌ خطأ: ${error.message}`);
  }
}

function isAgentTeamsCommand(msg) {
  return ['/start', '/status', '/gates', '/runs', '/dashboard', '/help']
    .some(cmd => msg.startsWith(cmd));
}
```

---

## Security

### Allowed Users

Only م. محمود (+201029899994) can execute commands.

Add this check in AGENTS.md:

```markdown
## Security Check for Agent Teams Commands

Before executing any `/start` command:
1. Verify sender is +201029899994
2. If not, respond: "⛔ غير مصرح. هذا الأمر متاح فقط للمدير."
```

### Rate Limiting

- Max 5 commands per minute
- Max 20 commands per hour
- Prevents abuse

---

## Alerts via WhatsApp

To receive alerts on WhatsApp instead of Slack:

### Option 1: Via PUIUX Bot

Add to orchestrator.js `sendAlert()`:

```javascript
async sendAlert(alertData) {
  // Send via WhatsApp if configured
  if (process.env.WHATSAPP_ALERTS_ENABLED === 'true') {
    const { execSync } = require('child_process');
    
    const message = formatAlertForWhatsApp(alertData);
    
    execSync(
      `echo "${message}" | ... # Send to WhatsApp via sessions_send`
    );
  }
  
  // Also send webhook (Slack/Discord) if configured
  if (process.env.PUIUX_ALERT_WEBHOOK_URL) {
    // ... existing webhook logic
  }
}
```

### Option 2: Modify notify-webhook.js

Support WhatsApp as a webhook target:

```javascript
// In notify-webhook.js
if (WEBHOOK_URL.includes('whatsapp')) {
  // Send via WhatsApp API
} else {
  // Send via Slack/Discord
}
```

---

## Troubleshooting

### "العميل غير موجود"

**Problem:** Client slug not found

**Solution:** Use correct slug (check with `/status`)

### "فشل التشغيل"

**Problem:** Stage execution failed

**Solution:** Check:
1. Gates status (`/gates client`)
2. Dashboard logs
3. Recent runs (`/runs client`)

### No Response

**Problem:** Handler not called

**Solution:** Check:
1. AGENTS.md integration correct
2. WhatsApp message starts with `/`
3. Logs in OpenClaw main session

---

## Future Enhancements

- [ ] `/cancel <run-id>` - Cancel running stage
- [ ] `/logs <client> <stage>` - View logs
- [ ] `/deploy <client>` - Deploy to production
- [ ] Voice commands via WhatsApp voice messages
- [ ] Interactive buttons (if WhatsApp supports)
- [ ] File attachments (send artifacts)

---

**Approved by:** م. محمود أبو النجا  
**Date:** 2026-02-08
