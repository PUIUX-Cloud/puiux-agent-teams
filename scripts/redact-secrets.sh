#!/bin/bash
# Script to redact secrets from logs/output
# Usage: command 2>&1 | ./scripts/redact-secrets.sh

# Patterns to redact (case insensitive)
redact_patterns=(
  "ghp_[A-Za-z0-9_]{36,255}"           # GitHub Personal Access Token
  "github_pat_[A-Za-z0-9_]{36,255}"     # GitHub Fine-grained Token
  "gho_[A-Za-z0-9_]{36,255}"           # GitHub OAuth Token
  "ghu_[A-Za-z0-9_]{36,255}"           # GitHub User Token
  "ghs_[A-Za-z0-9_]{36,255}"           # GitHub Server Token
  "ghr_[A-Za-z0-9_]{36,255}"           # GitHub Refresh Token
  "AKIA[0-9A-Z]{16}"                    # AWS Access Key ID
  "sk-[A-Za-z0-9]{32,64}"               # OpenAI API Key
  "AIza[0-9A-Za-z_-]{35}"               # Google API Key
  "ya29\.[0-9A-Za-z_-]{68,}"            # Google OAuth Token
  "[0-9]+-[0-9A-Za-z_]{32}\.apps\.googleusercontent\.com" # Google OAuth Client ID
)

# Build sed pattern
sed_pattern=""
for pattern in "${redact_patterns[@]}"; do
  if [ -z "$sed_pattern" ]; then
    sed_pattern="s/$pattern/[REDACTED]/gI"
  else
    sed_pattern="$sed_pattern; s/$pattern/[REDACTED]/gI"
  fi
done

# Read from stdin and redact
sed -E "$sed_pattern"
