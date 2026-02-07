# PUIUX Dashboard - Web UI

## Overview

Real-time monitoring dashboard for PUIUX Agent Teams system.

## Files

- `index.html` - Main dashboard (public view)
- `app.js` - Dashboard logic & data fetching
- `styles.css` - Dashboard styling
- `controls.html` - Admin controls (PROTECTED)
- `controls.js` - Admin actions logic

---

## 🔒 Security

### **Admin Controls Access:**

`controls.html` is **ADMIN ONLY** - requires:

1. **Token authentication** (set in `.env`)
2. **Network protection** (IP allowlist or VPN)
3. **HTTPS only** (SSL/TLS required)

### **Setup:**

1. Copy `.env.example` to `.env`:
   ```bash
   cp ../.env.example ../.env
   ```

2. Generate strong token:
   ```bash
   openssl rand -hex 32
   ```

3. Add to `.env`:
   ```
   ADMIN_DASHBOARD_TOKEN=your_generated_token_here
   ```

4. Configure network protection (Nginx example):
   ```nginx
   location /controls.html {
       allow 1.2.3.4;  # Your IP
       deny all;
       # Plus token check in JS
   }
   ```

---

## 📊 Data Source

Dashboard reads from:
- `../state/metrics.json` (auto-updated by `update-dashboard.sh`)

---

## 🚀 Deployment

**Local:**
```bash
python3 -m http.server 8080
```

**Production (Nginx):**
```nginx
server {
    listen 443 ssl;
    server_name dashboard.puiux.cloud;
    
    root /path/to/dashboard/web;
    
    location /controls.html {
        # IP allowlist here
        allow YOUR_IP;
        deny all;
    }
}
```

---

## ⚠️ NEVER Commit:

- `.env` files
- State files (metrics.json, actions.queue.json, activity.log)
- Any credentials/tokens

All excluded in `.gitignore`.

---

_For admin documentation, see `../API.md`_
