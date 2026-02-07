// PUIUX Dashboard Controls - Admin Interface

const METRICS_URL = '../state/metrics.json';
const ACTIONS_QUEUE_URL = '../state/actions.queue.json';
const ADMIN_TOKEN_KEY = 'puiux_admin_token';

let adminToken = null;
let projectsData = null;

// Check if already authenticated
window.addEventListener('DOMContentLoaded', () => {
  const savedToken = localStorage.getItem(ADMIN_TOKEN_KEY);
  if (savedToken) {
    adminToken = savedToken;
    showControls();
  }
});

// Handle auth form
document.getElementById('auth-form')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const token = document.getElementById('admin-token').value;
  
  // For now, accept any non-empty token
  // TODO: Validate against actual ADMIN_DASHBOARD_TOKEN
  if (token && token.length > 8) {
    adminToken = token;
    localStorage.setItem(ADMIN_TOKEN_KEY, token);
    showControls();
  } else {
    showError('Token غير صالح - يجب أن يكون على الأقل 8 أحرف');
  }
});

// Logout
document.getElementById('logout-btn')?.addEventListener('click', () => {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  adminToken = null;
  location.reload();
});

// Show error message
function showError(message) {
  const errorDiv = document.getElementById('error-message');
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
  
  setTimeout(() => {
    errorDiv.style.display = 'none';
  }, 5000);
}

// Show controls interface
function showControls() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('controls-container').style.display = 'block';
  
  loadControls();
  loadRecentActions();
  
  // Auto-refresh every 30s
  setInterval(loadControls, 30000);
}

// Load controls
async function loadControls() {
  try {
    const response = await fetch(METRICS_URL + '?t=' + Date.now());
    const data = await response.json();
    
    projectsData = data;
    renderControls(data.projects);
    
  } catch (error) {
    console.error('Failed to load data:', error);
  }
}

// Render controls for each project
function renderControls(projects) {
  const container = document.getElementById('controls-list');
  
  if (!projects || projects.length === 0) {
    container.innerHTML = '<div class="empty-state">لا توجد مشاريع</div>';
    return;
  }
  
  container.innerHTML = projects.map(project => `
    <div class="control-card">
      <div class="control-header">
        <div>
          <h3>${project.name}</h3>
          <small style="color: #718096;">${project.slug}</small>
        </div>
        <span class="badge ${project.status}">${getStatusArabic(project.status)}</span>
      </div>
      
      <div class="control-actions">
        
        <!-- Payment Gate -->
        <div class="action-row">
          <span class="action-label">💰 Payment Verified</span>
          <div 
            class="toggle-switch ${project.gates.payment_verified ? 'active' : ''}" 
            onclick="toggleGate('${project.slug}', 'payment_verified', ${!project.gates.payment_verified})"
          ></div>
          <span>${project.gates.payment_verified ? 'نعم' : 'لا'}</span>
        </div>
        
        <!-- DNS Gate -->
        <div class="action-row">
          <span class="action-label">🌐 DNS Verified</span>
          <div 
            class="toggle-switch ${project.gates.dns_verified ? 'active' : ''}" 
            onclick="toggleGate('${project.slug}', 'dns_verified', ${!project.gates.dns_verified})"
          ></div>
          <span>${project.gates.dns_verified ? 'نعم' : 'لا'}</span>
        </div>
        
        <!-- SSL Gate -->
        <div class="action-row">
          <span class="action-label">🔒 SSL Verified</span>
          <div 
            class="toggle-switch ${project.gates.ssl_verified ? 'active' : ''}" 
            onclick="toggleGate('${project.slug}', 'ssl_verified', ${!project.gates.ssl_verified})"
          ></div>
          <span>${project.gates.ssl_verified ? 'نعم' : 'لا'}</span>
        </div>
        
        <!-- Presales Stage -->
        ${project.status === 'presales' ? `
        <div class="action-row">
          <span class="action-label">📊 Presales Stage</span>
          <select 
            class="stage-select" 
            onchange="changeStage('${project.slug}', this.value)"
          >
            <option value="PS0" ${project.presales_stage === 'PS0' ? 'selected' : ''}>PS0 - Lead Intake</option>
            <option value="PS1" ${project.presales_stage === 'PS1' ? 'selected' : ''}>PS1 - Discovery</option>
            <option value="PS2" ${project.presales_stage === 'PS2' ? 'selected' : ''}>PS2 - Proposal Prep</option>
            <option value="PS3" ${project.presales_stage === 'PS3' ? 'selected' : ''}>PS3 - Proposal Delivery</option>
            <option value="PS3.5" ${project.presales_stage === 'PS3.5' ? 'selected' : ''}>PS3.5 - Acceptance</option>
            <option value="PS4" ${project.presales_stage === 'PS4' ? 'selected' : ''}>PS4 - Contract</option>
            <option value="PS5" ${project.presales_stage === 'PS5' ? 'selected' : ''}>PS5 - Invoice & Payment</option>
          </select>
        </div>
        ` : ''}
        
        <!-- Deploy Actions -->
        <div class="action-row">
          <span class="action-label">🚀 Deployment</span>
          <button 
            class="btn-action" 
            onclick="deployStaging('${project.slug}')"
          >
            Deploy Staging
          </button>
          <button 
            class="btn-action" 
            onclick="deployProduction('${project.slug}')"
            ${!project.gates.payment_verified || !project.gates.dns_verified ? 'disabled' : ''}
          >
            Deploy Production ${!project.gates.payment_verified || !project.gates.dns_verified ? '🔒' : ''}
          </button>
        </div>
        
        <!-- Project Actions -->
        <div class="action-row">
          <span class="action-label">⚙️ Actions</span>
          <button 
            class="btn-action" 
            onclick="changeProjectStatus('${project.slug}', '${project.status === 'active' ? 'paused' : 'active'}')"
          >
            ${project.status === 'active' ? '⏸️ Pause' : '▶️ Resume'}
          </button>
          <button 
            class="btn-action btn-danger" 
            onclick="archiveProject('${project.slug}')"
          >
            🗄️ Archive
          </button>
        </div>
        
      </div>
    </div>
  `).join('');
}

// Toggle gate
async function toggleGate(slug, gate, value) {
  const action = {
    type: 'toggle_gate',
    slug: slug,
    gate: gate,
    value: value,
    timestamp: new Date().toISOString(),
    admin_token: adminToken
  };
  
  await queueAction(action);
  showNotification(`✅ ${gate} ${value ? 'تم التفعيل' : 'تم الإلغاء'}`);
  
  // Reload after 1s
  setTimeout(loadControls, 1000);
}

// Change presales stage
async function changeStage(slug, stage) {
  const action = {
    type: 'change_stage',
    slug: slug,
    stage: stage,
    timestamp: new Date().toISOString(),
    admin_token: adminToken
  };
  
  await queueAction(action);
  showNotification(`✅ Stage تم تحديثه إلى ${stage}`);
  
  setTimeout(loadControls, 1000);
}

// Deploy staging
async function deployStaging(slug) {
  if (!confirm(`هل تريد نشر ${slug} على Staging؟`)) return;
  
  const action = {
    type: 'deploy_staging',
    slug: slug,
    timestamp: new Date().toISOString(),
    admin_token: adminToken
  };
  
  await queueAction(action);
  showNotification(`✅ Deploy Staging تم جدولته لـ ${slug}`);
}

// Deploy production
async function deployProduction(slug) {
  if (!confirm(`⚠️ هل تريد نشر ${slug} على PRODUCTION؟\n\nتأكد من:\n- Payment verified\n- DNS verified\n- Testing على Staging`)) return;
  
  const action = {
    type: 'deploy_production',
    slug: slug,
    timestamp: new Date().toISOString(),
    admin_token: adminToken
  };
  
  await queueAction(action);
  showNotification(`✅ Deploy Production تم جدولته لـ ${slug}`);
}

// Change project status
async function changeProjectStatus(slug, newStatus) {
  const action = {
    type: 'change_status',
    slug: slug,
    status: newStatus,
    timestamp: new Date().toISOString(),
    admin_token: adminToken
  };
  
  await queueAction(action);
  showNotification(`✅ Status تم تحديثه إلى ${newStatus}`);
  
  setTimeout(loadControls, 1000);
}

// Archive project
async function archiveProject(slug) {
  if (!confirm(`⚠️ هل تريد أرشفة ${slug}?\n\nلن يظهر في القائمة الرئيسية بعد الأرشفة.`)) return;
  
  const action = {
    type: 'change_status',
    slug: slug,
    status: 'archived',
    timestamp: new Date().toISOString(),
    admin_token: adminToken
  };
  
  await queueAction(action);
  showNotification(`✅ تمت الأرشفة`);
  
  setTimeout(loadControls, 2000);
}

// Queue action for processing
async function queueAction(action) {
  try {
    // Read current queue
    let queue = [];
    try {
      const response = await fetch(ACTIONS_QUEUE_URL + '?t=' + Date.now());
      if (response.ok) {
        queue = await response.json();
      }
    } catch (e) {
      // Queue file doesn't exist yet
    }
    
    // Add new action
    queue.push(action);
    
    // Save queue (this will be picked up by update-dashboard.sh)
    // For now, we'll simulate by showing in console
    console.log('Action queued:', action);
    
    // In a real implementation, this would POST to an API endpoint
    // or write to a file that update-dashboard.sh monitors
    
  } catch (error) {
    console.error('Failed to queue action:', error);
    showNotification('❌ فشل في تنفيذ الإجراء');
  }
}

// Load recent actions
async function loadRecentActions() {
  try {
    const response = await fetch('../state/activity.log?t=' + Date.now());
    if (!response.ok) {
      document.getElementById('recent-actions').innerHTML = '<div class="empty-state">لا توجد إجراءات</div>';
      return;
    }
    
    const text = await response.text();
    const lines = text.trim().split('\n').slice(-20).reverse();
    
    document.getElementById('recent-actions').innerHTML = lines.map(line => {
      try {
        const entry = JSON.parse(line);
        return `
          <div class="log-entry ${entry.type}">
            <span class="log-time">${formatTime(entry.timestamp)}</span>
            <span class="log-type">[${entry.type}]</span>
            <span class="log-message">${entry.message}</span>
          </div>
        `;
      } catch (e) {
        return '';
      }
    }).join('');
    
  } catch (error) {
    console.error('Failed to load activity log:', error);
  }
}

// Show notification
function showNotification(message) {
  // Simple alert for now
  // TODO: Replace with better notification UI
  alert(message);
}

// Helper functions
function getStatusArabic(status) {
  const map = {
    'presales': 'مبيعات',
    'active': 'نشط',
    'paused': 'متوقف',
    'delivered': 'مسلّم',
    'archived': 'مؤرشف'
  };
  return map[status] || status;
}

function formatTime(timestamp) {
  if (!timestamp) return '--';
  const date = new Date(timestamp);
  return date.toLocaleString('ar-EG', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}
