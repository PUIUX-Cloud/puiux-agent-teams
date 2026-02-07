#!/bin/bash

# PUIUX Dashboard - Process Actions Queue
# Executes queued admin actions and updates registry

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$SCRIPT_DIR/../.."
REGISTRY_PATH="$WORKSPACE_ROOT/client-projects-registry/clients.json"
QUEUE_FILE="$SCRIPT_DIR/state/actions.queue.json"
ACTIVITY_LOG="$SCRIPT_DIR/state/activity.log"

# Check if queue file exists
if [ ! -f "$QUEUE_FILE" ]; then
  echo "[]" > "$QUEUE_FILE"
  exit 0
fi

# Check if queue is empty
QUEUE_SIZE=$(jq 'length' "$QUEUE_FILE")
if [ "$QUEUE_SIZE" -eq 0 ]; then
  # No actions to process
  exit 0
fi

echo "⚙️ Processing $QUEUE_SIZE action(s)..."

# Process each action
jq -c '.[]' "$QUEUE_FILE" | while read -r action; do
  ACTION_TYPE=$(echo "$action" | jq -r '.type')
  SLUG=$(echo "$action" | jq -r '.slug')
  TIMESTAMP=$(echo "$action" | jq -r '.timestamp')
  
  echo "  → $ACTION_TYPE for $SLUG"
  
  case "$ACTION_TYPE" in
    
    toggle_gate)
      GATE=$(echo "$action" | jq -r '.gate')
      VALUE=$(echo "$action" | jq -r '.value')
      
      # Update registry
      jq --arg slug "$SLUG" --arg gate "$GATE" --argjson value "$VALUE" \
        '(.clients[] | select(.slug == $slug) | .gates[$gate]) = $value | 
         (.clients[] | select(.slug == $slug) | .updated) = (now | strftime("%Y-%m-%d"))' \
        "$REGISTRY_PATH" > "$REGISTRY_PATH.tmp" && mv "$REGISTRY_PATH.tmp" "$REGISTRY_PATH"
      
      # Log action
      echo "{\"timestamp\":\"$TIMESTAMP\",\"type\":\"admin_action\",\"message\":\"$SLUG: $GATE set to $VALUE\"}" >> "$ACTIVITY_LOG"
      ;;
    
    change_stage)
      STAGE=$(echo "$action" | jq -r '.stage')
      
      # Update registry
      jq --arg slug "$SLUG" --arg stage "$STAGE" \
        '(.clients[] | select(.slug == $slug) | .presales_stage) = $stage | 
         (.clients[] | select(.slug == $slug) | .updated) = (now | strftime("%Y-%m-%d"))' \
        "$REGISTRY_PATH" > "$REGISTRY_PATH.tmp" && mv "$REGISTRY_PATH.tmp" "$REGISTRY_PATH"
      
      # Log action
      echo "{\"timestamp\":\"$TIMESTAMP\",\"type\":\"admin_action\",\"message\":\"$SLUG: Stage changed to $STAGE\"}" >> "$ACTIVITY_LOG"
      ;;
    
    change_status)
      STATUS=$(echo "$action" | jq -r '.status')
      
      # Update registry
      jq --arg slug "$SLUG" --arg status "$STATUS" \
        '(.clients[] | select(.slug == $slug) | .status) = $status | 
         (.clients[] | select(.slug == $slug) | .updated) = (now | strftime("%Y-%m-%d"))' \
        "$REGISTRY_PATH" > "$REGISTRY_PATH.tmp" && mv "$REGISTRY_PATH.tmp" "$REGISTRY_PATH"
      
      # Log action
      echo "{\"timestamp\":\"$TIMESTAMP\",\"type\":\"admin_action\",\"message\":\"$SLUG: Status changed to $STATUS\"}" >> "$ACTIVITY_LOG"
      ;;
    
    deploy_staging)
      # TODO: Implement actual staging deploy
      echo "    (Deploy staging not implemented yet - queued for future)"
      echo "{\"timestamp\":\"$TIMESTAMP\",\"type\":\"deploy\",\"message\":\"$SLUG: Staging deploy queued (not implemented)\"}" >> "$ACTIVITY_LOG"
      ;;
    
    deploy_production)
      # TODO: Implement actual production deploy
      # Must check gates first
      echo "    (Deploy production not implemented yet - queued for future)"
      echo "{\"timestamp\":\"$TIMESTAMP\",\"type\":\"deploy\",\"message\":\"$SLUG: Production deploy queued (not implemented)\"}" >> "$ACTIVITY_LOG"
      ;;
    
    *)
      echo "    Unknown action type: $ACTION_TYPE"
      ;;
  esac
  
done

# Clear queue
echo "[]" > "$QUEUE_FILE"

echo "✅ Actions processed successfully"

# Update metrics after processing actions
cd "$SCRIPT_DIR"
./update-dashboard.sh > /dev/null 2>&1
