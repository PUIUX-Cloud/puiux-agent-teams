# Security Notes - Dashboard

## ⚠️ Current Dashboard Authentication

**Method:** HTTP Basic Auth (Caddy)
- Username: `admin`
- Password: Set via `caddy hash-password`
- Hash stored in `/etc/caddy/Caddyfile`

**Current Setup:**
```bash
basic_auth {
    admin $2a$14$...hash...
}
```

---

## 🔐 Security Recommendations

### Immediate (Priority 1):
1. **Change Password Regularly** (every 90 days)
2. **Use Strong Password** (min 16 chars, mixed case, symbols)
3. **Don't Share Passwords in Chat** (even in private sessions)

### Short-term (Priority 2):
4. **Enable IP Allowlist** (restrict to trusted IPs only)
   ```
   @allowed {
       remote_ip 1.2.3.4 5.6.7.8
   }
   ```

5. **Add Rate Limiting** (prevent brute force)
   ```
   rate_limit {
       zone dashboard {
           key {remote_host}
           events 5
           window 1m
       }
   }
   ```

### Long-term (Priority 3):
6. **Cloudflare Access** (OAuth/SSO integration)
7. **2FA/MFA** (Time-based OTP)
8. **Audit Logs** (track all access)

---

## 📋 Password Change Procedure

**On VPS (as puiux):**

```bash
# 1. Generate new hash
caddy hash-password --plaintext 'YourNewStrongPassword'

# 2. Update Caddyfile
sudo nano /etc/caddy/Caddyfile
# Replace hash in dashboard.puiux.cloud block

# 3. Reload Caddy
sudo systemctl reload caddy

# 4. Test
curl -u admin:YourNewStrongPassword https://dashboard.puiux.cloud
```

---

## 🚨 If Password Leaked:

1. **Change immediately** (follow procedure above)
2. **Check access logs** (`/var/log/caddy/dashboard-access.log`)
3. **Review metrics.json** for unauthorized changes
4. **Enable IP allowlist** (restrict access)

---

## ✅ Best Practices

- ✅ **Use password manager** (1Password, Bitwarden)
- ✅ **Store in encrypted vault**
- ✅ **Share via secure channel** (encrypted email, secure messenger)
- ❌ **Never in chat/Slack/Discord**
- ❌ **Never in git commits**
- ❌ **Never in screenshots**

---

_Last Updated: 2026-02-07_
