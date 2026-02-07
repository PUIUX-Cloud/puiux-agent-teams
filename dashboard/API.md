# PUIUX Dashboard API

**Status:** Placeholder for future implementation

---

## Overview

Currently, dashboard controls use a **queue-based system** (`actions.queue.json`) processed by `process-actions.sh`.

**Future:** Direct API endpoints for real-time control.

---

## Planned Endpoints

### **POST /api/dashboard/actions**

Execute admin action.

**Headers:**
```
Authorization: Bearer <ADMIN_DASHBOARD_TOKEN>
Content-Type: application/json
```

**Body:**
```json
{
  "type": "toggle_gate|change_stage|change_status|deploy_staging|deploy_production",
  "slug": "client-slug",
  "gate": "payment_verified|dns_verified|ssl_verified",
  "value": true|false,
  "stage": "PS0|PS1|PS2|PS3|PS3.5|PS4|PS5",
  "status": "presales|active|paused|delivered|archived"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Action executed successfully",
  "action_id": "uuid"
}
```

---

### **GET /api/dashboard/metrics**

Get current metrics (same as `metrics.json`).

**Headers:**
```
Authorization: Bearer <ADMIN_DASHBOARD_TOKEN>
```

**Response:**
Same structure as `dashboard/state/metrics.json`.

---

### **GET /api/dashboard/activity**

Get activity log.

**Headers:**
```
Authorization: Bearer <ADMIN_DASHBOARD_TOKEN>
```

**Query Params:**
- `limit` (default: 50)
- `offset` (default: 0)

**Response:**
```json
{
  "total": 123,
  "items": [
    {
      "timestamp": "2026-02-07T18:47:00Z",
      "type": "admin_action|deploy|system",
      "message": "Action description"
    }
  ]
}
```

---

## Current Workaround (Queue-based)

**Frontend:**
1. User performs action in `controls.html`
2. Action added to `actions.queue.json` (via localStorage for now)
3. Admin manually runs: `./dashboard/process-actions.sh`
4. Actions executed and logged

**Automatic Processing:**
Add to cron:
```bash
*/5 * * * * /path/to/dashboard/process-actions.sh >> /var/log/puiux-actions.log 2>&1
```

---

## Authentication

### **Current:**
- Admin token stored in localStorage
- No server-side validation yet
- Actions logged with token for audit

### **Future:**
- Server validates `ADMIN_DASHBOARD_TOKEN`
- Multi-role support (admin, manager, finance, sales)
- JWT tokens with expiry

---

## Security

**Required for production:**
- ✅ HTTPS only
- ✅ Token validation
- ✅ Rate limiting
- ✅ Audit logging
- ✅ CSRF protection (if using cookies)

---

## Implementation Notes

**When implementing API:**

1. **Add authentication middleware:**
   ```javascript
   function requireAdmin(req, res, next) {
     const token = req.headers.authorization?.split(' ')[1];
     if (token !== process.env.ADMIN_DASHBOARD_TOKEN) {
       return res.status(401).json({error: 'Unauthorized'});
     }
     next();
   }
   ```

2. **Validate actions:**
   ```javascript
   const validActions = ['toggle_gate', 'change_stage', 'change_status', 'deploy_staging', 'deploy_production'];
   if (!validActions.includes(action.type)) {
     return res.status(400).json({error: 'Invalid action type'});
   }
   ```

3. **Log all actions:**
   ```javascript
   await fs.appendFile('activity.log', 
     JSON.stringify({
       timestamp: new Date().toISOString(),
       type: 'admin_action',
       message: `${action.slug}: ${action.type}`,
       user: req.user?.email || 'admin'
     }) + '\n'
   );
   ```

4. **Return immediately, process async:**
   ```javascript
   res.json({success: true, action_id: uuid});
   await processAction(action); // Background
   ```

---

_This API will be implemented when moving from queue-based to real-time control._
