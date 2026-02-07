# Monitoring & Alerts - Complete Guide

**Status:** ✅ Complete  
**Date:** 2026-02-08  
**Version:** 1.0

---

## Overview

Real-time monitoring and alerting system for PUIUX Agent Teams.

---

## Components

### 1. Webhook Connector (`scripts/notify-webhook.js`)

Sends alerts to Slack/Discord via webhook.

**Features:**
- Supports multiple alert types (failed, blocked, production, schema_fail)
- Auto-redacts secrets before sending
- Discord/Slack compatible format
- Includes dashboard links
- Commercial-friendly Arabic messages

### 2. Alert Triggers (integrated in `orchestrator.js`)

Automatically triggers alerts on:
- ✅ **Failed runs** - Immediate alert
- ✅ **Blocked runs** - Immediate alert with gates info
- ✅ **Production attempts** - High-priority alert

### 3. Daily Summary (`scripts/daily-summary.js`)

Generates daily digest with:
- Total runs (success/failed/blocked)
- Total artifacts generated
- Top blocked reasons
- Most active clients
- System status

---

## Setup

### Step 1: Get Webhook URL

**Slack:**
1. Go to https://api.slack.com/apps
2. Create new app → "From scratch"
3. Add "Incoming Webhooks" feature
4. Activate and create webhook
5. Copy webhook URL

**Discord:**
1. Go to Server Settings → Integrations → Webhooks
2. Create webhook
3. Copy webhook URL

### Step 2: Configure Environment

```bash
# Add to /docker/openclaw-jjuw/.env
PUIUX_ALERT_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
PUIUX_ALERT_CHANNEL="#puiux-alerts"  # Optional
```

**Or** for VPS deployment:

```bash
# Add to /etc/environment or .bashrc
export PUIUX_ALERT_WEBHOOK_URL="https://hooks.slack.com/..."
```

### Step 3: Test

```bash
# Test blocked notification
npm run notify:test

# Test failed notification
npm run notify:test-failed

# Test production notification
npm run notify:test-production

# Test daily summary
npm run summary
```

---

## Alert Types

### 1️⃣ Blocked Run Alert

**Trigger:** Gates prevent stage execution

**Example:**
```
🚨 PUIUX Alert: RUN BLOCKED

Client: demo-acme
Stage: S2
Status: blocked
Run ID: S2-demo-acme-1770506294181
Missing Gates: payment_verified
Action Required: يرجى إتمام الدفع أولاً. تواصل مع قسم المالية.
Time: 2026-02-08T01:30:00Z
Links: Dashboard • Run JSON
```

**Priority:** Medium  
**Color:** Orange (#FF9800)

---

### 2️⃣ Failed Run Alert

**Trigger:** Agent execution fails

**Example:**
```
🚨 PUIUX Alert: RUN FAILED

Client: demo-retail
Stage: S3
Status: failed
Run ID: S3-demo-retail-1770510000000
Artifacts: 0
Time: 2026-02-08T02:15:00Z
Links: Dashboard • Run JSON
```

**Priority:** High  
**Color:** Red (#F44336)

---

### 3️⃣ Production Deployment Alert

**Trigger:** Any DEPLOY/PROD/RELEASE stage attempt

**Example:**
```
🚀 PUIUX Alert: PRODUCTION DEPLOYMENT ATTEMPT

Client: demo-acme
Stage: DEPLOY
Status: success
Run ID: DEPLOY-demo-acme-1770512000000
Artifacts: 42
Time: 2026-02-08T03:00:00Z
Links: Dashboard • Run JSON
```

**Priority:** Critical  
**Color:** Blue (#2196F3)

---

### 4️⃣ Schema Validation Failure (CI only)

**Trigger:** Invalid run.json or metrics.json

**Example:**
```
❌ PUIUX Alert: SCHEMA VALIDATION FAILED

Reason: run.json does not match schema
Run ID: S2-demo-acme-1770514000000
Time: 2026-02-08T03:30:00Z
```

**Priority:** High  
**Color:** Purple (#9C27B0)

---

## Daily Summary

**Schedule:** Every day at 9:00 AM (configurable)

**Content:**
```
📊 PUIUX Daily Summary - 2026-02-08

📈 Runs Today
Total: 12
✅ Success: 8
❌ Failed: 1
⛔ Blocked: 3

📦 Artifacts
45 files generated

📂 Projects
4 total
2 blocked

🔍 Top Blocked Reasons
• Payment not verified (2x)
• DNS not verified (1x)

🏆 Most Active Clients
• ACME Corporation (5 runs)
• RetailPro Solutions (4 runs)
• NewClient Inc (3 runs)
```

---

## Scheduling Daily Summary

### Option A: GitHub Actions (Recommended)

```yaml
# .github/workflows/daily-summary.yml
name: Daily Summary

on:
  schedule:
    - cron: '0 9 * * *'  # 9 AM UTC daily
  workflow_dispatch:

jobs:
  summary:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22.22.0'
      - run: npm install
      - run: npm run summary
        env:
          PUIUX_ALERT_WEBHOOK_URL: ${{ secrets.WEBHOOK_URL }}
```

### Option B: Cron (VPS)

```bash
# Add to crontab
crontab -e

# Add this line (9 AM daily)
0 9 * * * cd /var/www/puiux-agent-teams && PUIUX_ALERT_WEBHOOK_URL="https://..." node scripts/daily-summary.js >> /var/log/puiux-summary.log 2>&1
```

---

## Testing & Debugging

### Dry Run (No Webhook)

```bash
# Just print to console
node scripts/daily-summary.js
```

### Test with Real Webhook

```bash
# Set webhook URL temporarily
PUIUX_ALERT_WEBHOOK_URL="https://hooks.slack.com/..." npm run notify:test
```

### Check Logs

```bash
# Orchestrator logs (includes alert attempts)
tail -f /var/log/puiux-orchestrator.log

# Dashboard activity log
tail -f dashboard/state/activity.log
```

---

## Customization

### Add Custom Alert Type

Edit `scripts/notify-webhook.js`:

```javascript
const ALERT_CONFIG = {
  // ... existing types
  custom: {
    emoji: '🎨',
    color: '#00BCD4',
    title: 'PUIUX Alert: CUSTOM EVENT',
    priority: 'low'
  }
};
```

### Change Alert Priority Thresholds

Edit `orchestrator.js`:

```javascript
// Only alert on production failures (not all failures)
if (manifest.status === 'failed' && isProductionStage(stage)) {
  await this.sendAlert({ ... });
}
```

### Custom Daily Summary Fields

Edit `scripts/daily-summary.js`:

```javascript
function calculateSummary(metrics) {
  return {
    // ... existing fields
    custom_metric: calculateCustomMetric(metrics)
  };
}
```

---

## Security

### Secrets Protection

- All alerts pass through `redactSecrets()` before sending
- Webhook URL **NEVER** logged to files or console
- Environment variables only

### Rate Limiting

- Max 1 alert per run (no spam)
- Daily summary limited to once per day
- Webhook failures logged but don't block execution

---

## Troubleshooting

### "Webhook not configured"

**Problem:** `PUIUX_ALERT_WEBHOOK_URL` not set

**Solution:**
```bash
export PUIUX_ALERT_WEBHOOK_URL="https://hooks.slack.com/..."
```

### "Failed to send alert"

**Problem:** Webhook URL invalid or unreachable

**Debug:**
```bash
# Test webhook manually
curl -X POST "YOUR_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{"text": "Test message"}'
```

### "Alert not received"

**Checklist:**
1. ✅ Webhook URL correct?
2. ✅ Environment variable set?
3. ✅ Network connectivity?
4. ✅ Slack/Discord workspace active?

---

## Metrics

### Alert Volume (Expected)

| Type | Frequency |
|------|-----------|
| Blocked | 2-5 per day (varies by gates status) |
| Failed | 0-1 per day (should be rare) |
| Production | 1-3 per week (controlled deployments) |
| Daily Summary | 1 per day |

**Total:** ~5-10 alerts per day

### Response Time

| Metric | Target |
|--------|--------|
| Alert delivery | < 5 seconds |
| Webhook timeout | 5 seconds max |
| Daily summary generation | < 10 seconds |

---

## Next Steps

1. ✅ Webhook connector complete
2. ✅ Triggers integrated
3. ✅ Daily summary working
4. 🔲 Schedule daily summary (GitHub Actions or cron)
5. 🔲 Configure Slack/Discord workspace
6. 🔲 Test in production

---

**Approved by:** م. محمود أبو النجا  
**Date:** 2026-02-08
