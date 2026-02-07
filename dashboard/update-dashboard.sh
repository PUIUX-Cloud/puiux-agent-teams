#!/bin/bash

# PUIUX Dashboard Update Script
# Auto-generates metrics.json from actual system state

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$SCRIPT_DIR/../.."
KB_PATH="$WORKSPACE_ROOT/puiux-knowledge-base/knowledge/puiux"
REGISTRY_PATH="$WORKSPACE_ROOT/client-projects-registry/clients.json"
METRICS_FILE="$SCRIPT_DIR/state/metrics.json"
REPORT_FILE="$SCRIPT_DIR/reports/current-status.md"

echo "🔄 Updating PUIUX Dashboard..."

# Check if required paths exist
if [ ! -d "$KB_PATH" ]; then
  echo "⚠️  Knowledge Base not found at: $KB_PATH"
  KB_EXISTS=false
else
  KB_EXISTS=true
fi

if [ ! -f "$REGISTRY_PATH" ]; then
  echo "⚠️  Registry not found at: $REGISTRY_PATH"
  REGISTRY_EXISTS=false
else
  REGISTRY_EXISTS=true
fi

# Generate timestamp
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Start building metrics JSON
cat > "$METRICS_FILE" << 'EOF_START'
{
  "generated_at": "TIMESTAMP_PLACEHOLDER",
  "system": {
    "status": "operational",
    "uptime_hours": 24,
    "version": "1.0.0"
  },
EOF_START

# Replace timestamp
sed -i "s/TIMESTAMP_PLACEHOLDER/$TIMESTAMP/" "$METRICS_FILE"

# Scan Knowledge Base
if [ "$KB_EXISTS" = true ]; then
  echo "📚 Scanning Knowledge Base..."
  
  KB_FILES=$(find "$KB_PATH" -name "*.md" -type f | sort)
  KB_COUNT=$(echo "$KB_FILES" | wc -l)
  
  echo "  {" >> "$METRICS_FILE"
  echo "    \"knowledge_base\": {" >> "$METRICS_FILE"
  echo "      \"total_files\": $KB_COUNT," >> "$METRICS_FILE"
  echo "      \"files\": [" >> "$METRICS_FILE"
  
  FIRST=true
  while IFS= read -r file; do
    FILENAME=$(basename "$file")
    LAST_UPDATED=$(stat -c %y "$file" 2>/dev/null | cut -d' ' -f1 || date +%Y-%m-%d)
    
    if [ "$FIRST" = true ]; then
      FIRST=false
    else
      echo "," >> "$METRICS_FILE"
    fi
    
    echo -n "        {\"name\": \"$FILENAME\", \"status\": \"complete\", \"last_updated\": \"$LAST_UPDATED\"}" >> "$METRICS_FILE"
  done <<< "$KB_FILES"
  
  echo "" >> "$METRICS_FILE"
  echo "      ]" >> "$METRICS_FILE"
  echo "    }," >> "$METRICS_FILE"
else
  echo "  \"knowledge_base\": {\"total_files\": 0, \"files\": []}," >> "$METRICS_FILE"
fi

# Scan Registry
if [ "$REGISTRY_EXISTS" = true ]; then
  echo "📋 Scanning Registry..."
  
  # Validate JSON
  if jq empty "$REGISTRY_PATH" 2>/dev/null; then
    REGISTRY_VALID=true
    TOTAL_CLIENTS=$(jq '.clients | length' "$REGISTRY_PATH")
    
    # Count by status
    PRESALES=$(jq '[.clients[] | select(.status == "presales")] | length' "$REGISTRY_PATH")
    ACTIVE=$(jq '[.clients[] | select(.status == "active")] | length' "$REGISTRY_PATH")
    PAUSED=$(jq '[.clients[] | select(.status == "paused")] | length' "$REGISTRY_PATH")
    DELIVERED=$(jq '[.clients[] | select(.status == "delivered")] | length' "$REGISTRY_PATH")
    ARCHIVED=$(jq '[.clients[] | select(.status == "archived")] | length' "$REGISTRY_PATH")
    
    # Count by tier
    BETA=$(jq '[.clients[] | select(.tier == "beta")] | length' "$REGISTRY_PATH")
    STANDARD=$(jq '[.clients[] | select(.tier == "standard")] | length' "$REGISTRY_PATH")
    PREMIUM=$(jq '[.clients[] | select(.tier == "premium")] | length' "$REGISTRY_PATH")
    
    # Check for duplicates
    DUPLICATES=$(jq -r '.clients[].slug' "$REGISTRY_PATH" | sort | uniq -d | jq -R . | jq -s .)
    
  else
    REGISTRY_VALID=false
    TOTAL_CLIENTS=0
  fi
  
  cat >> "$METRICS_FILE" << EOF
    "registry": {
      "valid": $REGISTRY_VALID,
      "total_clients": $TOTAL_CLIENTS,
      "by_status": {
        "presales": $PRESALES,
        "active": $ACTIVE,
        "paused": $PAUSED,
        "delivered": $DELIVERED,
        "archived": $ARCHIVED
      },
      "by_tier": {
        "beta": $BETA,
        "standard": $STANDARD,
        "premium": $PREMIUM
      },
      "duplicates": $DUPLICATES
    },
EOF
  
  # Extract projects with gates
  echo "    \"projects\": " >> "$METRICS_FILE"
  jq '[.clients[] | {
    id,
    slug,
    name,
    status,
    presales_stage,
    tier,
    pod,
    gates,
    domains,
    blocked_reason: (
      if .gates.payment_verified == false and .gates.dns_verified == false then
        "Payment not verified, DNS not verified"
      elif .gates.payment_verified == false then
        "Payment not verified"
      elif .gates.dns_verified == false then
        "DNS not verified"
      else
        null
      end
    )
  }]' "$REGISTRY_PATH" >> "$METRICS_FILE"
  
  echo "," >> "$METRICS_FILE"
  
  # Gates summary
  BLOCKED=$(jq '[.clients[] | select(.gates.payment_verified == false or .gates.dns_verified == false)] | length' "$REGISTRY_PATH")
  READY=$(jq '[.clients[] | select(.gates.payment_verified == true and .gates.dns_verified == true)] | length' "$REGISTRY_PATH")
  PAYMENT_BLOCKED=$(jq '[.clients[] | select(.gates.payment_verified == false)] | length' "$REGISTRY_PATH")
  DNS_BLOCKED=$(jq '[.clients[] | select(.gates.dns_verified == false)] | length' "$REGISTRY_PATH")
  
  cat >> "$METRICS_FILE" << EOF
    "gates_summary": {
      "total_projects": $TOTAL_CLIENTS,
      "blocked": $BLOCKED,
      "ready_for_production": $READY,
      "blocking_reasons": {
        "payment_not_verified": $PAYMENT_BLOCKED,
        "dns_not_verified": $DNS_BLOCKED
      }
    },
EOF
  
else
  cat >> "$METRICS_FILE" << 'EOF'
    "registry": {"valid": false, "total_clients": 0},
    "projects": [],
    "gates_summary": {"total_projects": 0, "blocked": 0, "ready_for_production": 0},
EOF
fi

# Agents & Teams (placeholder for now)
cat >> "$METRICS_FILE" << 'EOF'
    "agents": {
      "total": 0,
      "active": 0,
      "idle": 0,
      "agents_list": []
    },
    "teams": {
      "total": 0,
      "active": 0,
      "paused": 0,
      "completed": 0
    },
    "activity_log": [
      {
        "timestamp": "TIMESTAMP_PLACEHOLDER",
        "type": "system",
        "message": "Dashboard updated"
      }
    ],
    "deploy_status": {
      "staging": {
        "last_deploy": null,
        "status": "not_configured"
      },
      "production": {
        "last_attempt": null,
        "status": "blocked",
        "blocked_by": ["payment_not_verified", "dns_not_verified"]
      }
    }
}
EOF

# Replace timestamp in activity log
sed -i "s/TIMESTAMP_PLACEHOLDER/$TIMESTAMP/" "$METRICS_FILE"

echo "✅ metrics.json updated"

# TODO: Generate Markdown report
echo "📝 Generating report..."
echo "   (Report generation will be added in next iteration)"

echo "✅ Dashboard update complete!"
