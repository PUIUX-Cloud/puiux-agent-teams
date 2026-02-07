# PUIUX Agent Teams

**Orchestrator and Agent Teams System for PUIUX projects.**

---

## 📊 Dashboard

### **Access Dashboard:**

**Web UI (View Only):**
```bash
# Open in browser
open dashboard/web/index.html

# Or serve via HTTP server
cd dashboard/web
python3 -m http.server 8080
# Then open: http://localhost:8080
```

**Admin Controls:**
```bash
# Serve dashboard
cd dashboard/web
python3 -m http.server 8080

# Open controls (requires admin token)
open http://localhost:8080/controls.html
```

**Admin Token:**
```bash
# Set in environment
export ADMIN_DASHBOARD_TOKEN="your-secure-token-here"

# Or generate a random one
export ADMIN_DASHBOARD_TOKEN=$(openssl rand -hex 32)
```

### **Features:**

**1. Projects Overview:**
- All client projects
- Gates status (Payment, DNS, SSL)
- Blocked reasons
- Domains (Beta, Staging, Production)

**2. Gates Monitor:**
- Real-time gates status
- Production deploy blocking
- Clear visibility of blockers

**3. Knowledge Base Progress:**
- KB files status
- Completion percentage
- Last update times

**4. Registry Health:**
- Validation status
- Client counts (by status, tier)
- Duplicate detection

**5. Activity Log:**
- Recent system events
- File updates
- Deploy attempts

---

## 🔄 Auto-Update

### **Manual Update:**
```bash
cd dashboard
./update-dashboard.sh
```

### **Auto-Update (Cron):**
```bash
# Add to crontab (every minute)
* * * * * /path/to/dashboard/update-dashboard.sh >> /var/log/puiux-dashboard.log 2>&1
```

---

## 📁 Structure

```
puiux-agent-teams/
├── dashboard/
│   ├── web/
│   │   ├── index.html       (Dashboard UI)
│   │   ├── app.js           (Logic)
│   │   └── styles.css       (Styling)
│   ├── state/
│   │   └── metrics.json     (Auto-generated data)
│   ├── reports/
│   │   └── current-status.md (Markdown report)
│   └── update-dashboard.sh  (Update script)
├── src/                     (Agent implementations - TBD)
└── README.md
```

---

## 🎯 Data Sources

Dashboard reads from:

**1. Knowledge Base:**
```
../../puiux-knowledge-base/knowledge/puiux/*.md
```

**2. Registry:**
```
../../client-projects-registry/clients.json
```

**3. Client Projects:**
```
../../client-*/client.json
```

---

## 🚀 Usage

### **View Current Status:**
1. Run update script: `./dashboard/update-dashboard.sh`
2. Open dashboard: `open dashboard/web/index.html`
3. Dashboard auto-refreshes every 30 seconds

### **Check Specific Project:**
- Look in "Projects Overview" section
- Check gates status
- See blocked reasons

### **Monitor Gates:**
- "Gates Monitor" table shows all projects
- Red = Blocked
- Green = Ready

---

## ⚙️ Configuration

Dashboard auto-detects paths based on repo structure.

**If paths are different, edit:**
```bash
# In dashboard/update-dashboard.sh
WORKSPACE_ROOT="$SCRIPT_DIR/../.."
KB_PATH="$WORKSPACE_ROOT/puiux-knowledge-base/knowledge/puiux"
REGISTRY_PATH="$WORKSPACE_ROOT/client-projects-registry/clients.json"
```

---

## 🔒 Gates System

### **Payment Gate:**
- **false** → Delivery stages LOCKED
- **true** → Delivery stages UNLOCKED

### **DNS Gate:**
- **false** → Production deploy BLOCKED
- **true** → Production deploy ALLOWED

### **SSL Gate (optional):**
- **false** → SSL not configured
- **true** → SSL active

**Critical Rule:**
> Production deploy requires: `payment_verified=true` AND `dns_verified=true`

---

## 📝 Activity Log

All system events are logged:
- KB file updates
- Registry changes
- Gate status changes
- Deploy attempts

View in:
- Dashboard "Activity Log" section
- `dashboard/reports/current-status.md`

---

## 🐛 Troubleshooting

### **Dashboard shows no data:**
```bash
# Check if metrics.json exists
cat dashboard/state/metrics.json

# Run update manually
./dashboard/update-dashboard.sh

# Check paths
ls ../../puiux-knowledge-base/
ls ../../client-projects-registry/
```

### **Auto-refresh not working:**
- Check browser console for errors
- Ensure metrics.json is accessible
- Check file permissions

---

## 🔧 Development

### **Add New Metrics:**
1. Edit `dashboard/update-dashboard.sh`
2. Add data to metrics.json
3. Edit `dashboard/web/app.js` to render
4. Update `dashboard/web/index.html` if needed

### **Customize UI:**
- Edit `dashboard/web/styles.css`
- Modify `dashboard/web/index.html`
- Update `dashboard/web/app.js` logic

---

## 🔧 Admin Controls

### **Access:**
1. Navigate to `controls.html` in browser
2. Enter admin token
3. Control projects in real-time

### **Available Actions:**

**Gates Control:**
- ✅ Toggle `payment_verified`
- ✅ Toggle `dns_verified`
- ✅ Toggle `ssl_verified`

**Project Management:**
- ✅ Change presales stage (PS0 → PS5)
- ✅ Pause/Resume project
- ✅ Archive project

**Deployment:**
- ⏳ Deploy to Staging (queued for future)
- ⏳ Deploy to Production (queued for future)

### **How It Works:**

**Current (Queue-based):**
1. Admin performs action in UI
2. Action queued in `actions.queue.json`
3. Run `process-actions.sh` to execute
4. Registry updated + logged in `activity.log`

**Run manually:**
```bash
./dashboard/process-actions.sh
```

**Or set up cron:**
```bash
# Process actions every 5 minutes
*/5 * * * * /path/to/dashboard/process-actions.sh >> /var/log/puiux-actions.log 2>&1
```

### **Security:**

**Admin-only:**
- Requires `ADMIN_DASHBOARD_TOKEN`
- Token stored in localStorage
- All actions logged

**Future:**
- Multi-role support (admin, manager, finance, sales)
- API endpoints (see `dashboard/API.md`)
- Real-time validation

---

## 📝 Activity Log

All admin actions are logged:
```
dashboard/state/activity.log
```

Format:
```json
{"timestamp":"2026-02-07T18:47:00Z","type":"admin_action","message":"demo-acme: payment_verified set to true"}
```

View in:
- `controls.html` → Recent Actions
- `cat dashboard/state/activity.log`

---

## TODO

- [ ] Agents implementation
- [ ] Teams orchestration
- [ ] Real-time WebSocket updates
- [ ] Deploy integration (staging + production)
- [ ] Notification system
- [ ] API endpoints for controls
- [ ] Multi-role authentication

---

_Dashboard MVP v1.0.0 - Admin Controls Added_
