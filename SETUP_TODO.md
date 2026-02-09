# SETUP TODO - Designer Agent MCP Integration

**Status:** ⏳ NOT DONE YET

---

## Required Steps:

### 1. Pencil.dev Setup
```bash
# On VPS (76.13.131.3)
[ ] Install Pencil desktop app or headless server
[ ] Start Pencil MCP server
[ ] Verify MCP server running (check port)
```

### 2. Google Stitch MCP Setup
```bash
[ ] Install gcloud CLI
[ ] gcloud auth login
[ ] gcloud auth application-default login
[ ] Configure Stitch MCP (follow: stitch.withgoogle.com/docs/mcp/setup)
[ ] Test connection
```

### 3. OpenClaw MCP Configuration
```bash
# File: ~/.openclaw/openclaw.json or MCP config
[ ] Add Pencil MCP server
[ ] Add Stitch MCP server
[ ] Restart OpenClaw
[ ] Verify connections
```

### 4. Designer Agent Testing
```bash
[ ] Spawn Designer agent
[ ] Test Pencil: "Create a simple button component"
[ ] Verify outputs:
  [ ] .pen file created
  [ ] React code generated
  [ ] Screenshots exported (get_screenshot)
  [ ] HTML preview built and uploaded
```

### 5. Client Preview Setup
```bash
[ ] Create preview subdomain: preview.puiux.cloud
[ ] Nginx config for static hosting
[ ] Auto-deploy script for HTML builds
[ ] Test with sample project
```

---

## When to do this:
**Before testing Designer Agent in production!**

---

## Notes:
- Pencil = Primary (production workflow)
- Stitch = Backup (quick mockups)
- One tool per project rule

---

**Created:** 2026-02-08  
**Priority:** HIGH (don't forget!)
