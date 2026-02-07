# SECURITY POLICY - Secrets & Credentials

## 🔒 **ZERO TOLERANCE FOR SECRETS IN OUTPUT**

### **Prohibited Actions:**

❌ **NEVER print/echo/log any credentials:**
- API tokens
- GitHub tokens  
- Database passwords
- SSH keys
- API keys
- Environment variables containing secrets

❌ **NEVER search for credentials without explicit permission**

❌ **NEVER commit secrets to Git:**
- .env files
- tokens
- passwords
- private keys

---

## ✅ **Safe Practices:**

### **1. Redaction Layer:**
Any script that handles secrets MUST redact them in output:

```bash
# ❌ WRONG
echo $GH_TOKEN

# ✅ RIGHT
echo "[REDACTED]"
```

### **2. Environment Variables:**
Use environment variables, never hardcode:

```bash
# ❌ WRONG
git remote add origin https://ghp_xxxxx@github.com/...

# ✅ RIGHT
git remote add origin https://$GH_TOKEN@github.com/...
# (and ensure GH_TOKEN is NEVER printed)
```

### **3. Git Operations:**
Always use credential helpers or SSH keys:

```bash
# Use credential helper
git config credential.helper store

# Or use SSH
git remote add origin git@github.com:org/repo.git
```

---

## 🚨 **Incident Response:**

### **If a secret is exposed:**

1. **Immediate revocation:** Revoke/rotate the exposed credential
2. **Audit:** Check where it was exposed (logs, commits, messages)
3. **Clean up:** Remove all traces
4. **Document:** Log the incident in security-incidents.md
5. **Report:** Notify management immediately

---

## 📋 **Pre-Deployment Checklist:**

Before ANY deployment or commit:

☑️ No secrets in code
☑️ No secrets in logs/output
☑️ .env files excluded (.gitignore)
☑️ Credentials in secure vault/env only
☑️ Output redacted (no tokens/passwords visible)

---

## 🛡️ **Dashboard Specific:**

### **Admin Controls:**
- ✅ Token-based authentication (ADMIN_DASHBOARD_TOKEN)
- ✅ Token stored in .env (NEVER committed)
- ✅ IP allowlist or VPN (network-level security)
- ✅ HTTPS only (SSL/TLS required)

### **State Files:**
Runtime data MUST NOT be committed:
- dashboard/state/metrics.json
- dashboard/state/actions.queue.json  
- dashboard/state/activity.log

Add to .gitignore immediately.

---

## 🔐 **Token Security:**

### **GitHub Tokens:**
- Use fine-grained tokens (repo scope only)
- Set expiration (90 days max)
- Rotate regularly
- Store in environment variables ONLY
- NEVER print/log/commit

### **Dashboard Admin Token:**
- Strong, random (32+ characters)
- Store in .env
- Rotate monthly
- Log all admin actions

---

## ⚠️ **Red Flags:**

If you see ANY of these, STOP immediately:

🚨 Token visible in terminal output
🚨 Password in log file
🚨 API key in error message
🚨 .env file in git staging
🚨 Credential in commit message

---

_Last updated: 2026-02-07_  
_Policy: ZERO TOLERANCE - No exceptions_
