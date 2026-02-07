# Security Hardening - Implementation Guide

**Status:** ✅ Complete  
**Date:** 2026-02-08  
**Version:** 1.0

---

## Overview

Production-grade security hardening for PUIUX Agent Teams Dashboard.

---

## A1: Rate Limiting ✅

### Implementation

**Nginx Configuration:**

```nginx
# /etc/nginx/nginx.conf (http context)
limit_req_zone $binary_remote_addr zone=dashboard_general:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=dashboard_metrics:10m rate=2r/s;
limit_req_zone $binary_remote_addr zone=dashboard_api:10m rate=5r/s;

# /etc/nginx/sites-available/dashboard.puiux.cloud
location /state/ {
    limit_req zone=dashboard_metrics burst=5 nodelay;
    limit_req_status 429;
    try_files $uri $uri/ =404;
}

location / {
    limit_req zone=dashboard_general burst=20 nodelay;
    limit_req_status 429;
    try_files $uri $uri/ /index.html;
}
```

### Limits

| Endpoint | Rate | Burst | Purpose |
|----------|------|-------|---------|
| `/state/metrics.json` | 2 req/s | 5 | Prevent hammering |
| `/` (general) | 10 req/s | 20 | Normal traffic |
| `/state/*` (other) | 5 req/s | 10 | API endpoints |

### Testing

```bash
# Should return 429 after burst exhausted
for i in {1..30}; do
  curl -s -o /dev/null -w "%{http_code} " \
    -u "admin:PASSWORD" \
    https://dashboard.puiux.cloud/state/metrics.json
done
```

---

## A2: IP Allowlist ❌

**Status:** Optional (not implemented)

**Why skipped:**
- Basic Auth already provides access control
- VPS is low-profile (not high-value target)
- Can be added later if needed

**How to add (if needed):**

```nginx
# /etc/nginx/sites-available/dashboard.puiux.cloud
location / {
    # Allow specific IPs
    allow 1.2.3.4;      # Office
    allow 5.6.7.8;      # م. محمود home
    deny all;           # Block everyone else
    
    # ... rest of config
}
```

**Disable switch (emergency access):**

```bash
# Comment out the deny line temporarily
sudo sed -i 's/deny all;/# deny all;/' /etc/nginx/sites-available/dashboard.puiux.cloud
sudo systemctl reload nginx
```

---

## A3: Health Endpoint ✅

### Implementation

**Location:** `/health.json`

**Generator:** `scripts/generate-health.js`

**Auto-generation:** Integrated into `scripts/generate-dashboard-data.js`

### Response Format

```json
{
  "status": "operational",
  "version": "1.0",
  "service": "PUIUX Agent Teams Dashboard",
  "timestamp": "2026-02-08T01:30:00.000Z",
  "checks": {
    "filesystem": "ok",
    "metrics": "ok",
    "last_metrics_update": "2026-02-08T01:28:00.000Z"
  },
  "metrics_summary": {
    "total_runs": 5,
    "total_projects": 2,
    "blocked_runs": 2,
    "successful_runs": 3
  }
}
```

### Monitoring

**UptimeRobot:**
```
URL: https://dashboard.puiux.cloud/health.json
Type: Keyword Monitor
Keyword: "operational"
Interval: 5 minutes
```

**BetterStack:**
```
URL: https://dashboard.puiux.cloud/health.json
Assertion: status == "operational"
Interval: 1 minute
```

---

## A4: CSP + Security Headers ✅

### Headers Applied

```nginx
add_header Content-Security-Policy "
  default-src 'self';
  script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com;
  style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com;
  font-src 'self' https://cdnjs.cloudflare.com https://fonts.gstatic.com;
  img-src 'self' https: data:;
  connect-src 'self';
" always;

add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
```

### Why Each Header

| Header | Purpose |
|--------|---------|
| CSP | Prevent XSS by whitelisting sources |
| X-Frame-Options | Prevent clickjacking |
| X-Content-Type-Options | Prevent MIME sniffing |
| X-XSS-Protection | Browser XSS filter |
| Referrer-Policy | Control referrer info leakage |
| Permissions-Policy | Disable unnecessary APIs |

### Testing

```bash
curl -I -u "admin:PASSWORD" https://dashboard.puiux.cloud | grep -E "Content-Security|X-Frame|Permissions"
```

---

## A5: Atomic Write + File Lock ✅

### Implementation

**Lock Library:** `proper-lockfile`

**Locking Strategy:**
```javascript
const lockfile = require('proper-lockfile');

// Acquire lock
const release = await lockfile.lock(lockDir, {
  lockfilePath: path.join(lockDir, '.metrics.lock'),
  retries: {
    retries: 20,
    minTimeout: 100,
    maxTimeout: 500
  }
});

// Critical section (write)
const tmpFile = METRICS_OUTPUT + '.tmp';
await fs.writeFile(tmpFile, JSON.stringify(data, null, 2));
await fs.rename(tmpFile, METRICS_OUTPUT);

// Release lock
await release();
```

### Why It Matters

**Scenario:** Two pipeline runs finish at the same time

- **Without lock:** Both write metrics.json → corrupted file
- **With lock:** Second waits for first → atomic, correct

### Testing

```bash
# Run two pipelines in parallel
node orchestrator.js --client=demo-acme --stage=S2 &
node orchestrator.js --client=demo-retail --stage=S2 &
wait

# Check metrics.json is valid
jq empty dashboard/state/metrics.json && echo "✅ Valid"
```

---

## A6: Schema Validation ✅

### Schemas

1. **run.schema.json** - Validates `outputs/*/run.json`
2. **metrics.schema.json** - Validates `dashboard/state/metrics.json`

### Commands

```bash
# Validate all
npm run validate:schemas

# Validate metrics only
npm run validate:metrics

# Validate runs only
npm run validate:runs
```

### CI Integration

```yaml
- name: Validate schemas
  run: |
    node scripts/generate-dashboard-data.js
    npm run validate:schemas
```

### Example Schema (run.json)

```json
{
  "required": ["run_id", "client", "stage", "status", "timestamp"],
  "properties": {
    "status": {
      "type": "string",
      "enum": ["success", "failed", "blocked"]
    }
  }
}
```

---

## Testing Checklist

- [x] Rate limiting returns 429 on burst exhaustion
- [x] Health endpoint accessible and returns valid JSON
- [x] CSP headers present in response
- [x] File locking prevents corruption in parallel runs
- [x] Schema validation catches invalid data
- [x] CI workflow includes schema validation step

---

## Maintenance

### Regular Tasks

1. **Monitor health endpoint** (UptimeRobot/BetterStack)
2. **Review rate limit logs** (`/var/log/nginx/dashboard.error.log`)
3. **Update schemas** when adding new fields
4. **Test security** monthly (penetration testing recommended)

### Emergency Procedures

**If Dashboard is Down:**
```bash
# 1. Check Nginx status
sudo systemctl status nginx

# 2. Check error logs
sudo tail -50 /var/log/nginx/dashboard.error.log

# 3. Restart Nginx
sudo systemctl restart nginx

# 4. Check health
curl https://dashboard.puiux.cloud/health.json
```

**If Rate Limited (False Positive):**
```bash
# Temporarily increase rate limit
sudo sed -i 's/rate=2r\/s/rate=10r\/s/' /etc/nginx/nginx.conf
sudo systemctl reload nginx

# Restore after incident
sudo sed -i 's/rate=10r\/s/rate=2r\/s/' /etc/nginx/nginx.conf
sudo systemctl reload nginx
```

---

## Security Audit Log

| Date | Action | By | Status |
|------|--------|-----|--------|
| 2026-02-08 | Initial hardening | م. محمود | ✅ Complete |
| - | Next audit | - | 2026-03-08 |

---

## Next Steps

1. ✅ Security hardening complete
2. 🔲 Monitoring & Alerts (Slack webhooks)
3. 🔲 Penetration testing (optional)
4. 🔲 Security audit (quarterly)

---

**Approved by:** م. محمود أبو النجا  
**Date:** 2026-02-08  
**Review:** 2026-03-08
