// PUIUX Dashboard - Main App Logic

const METRICS_URL = '../state/metrics.json';
const REFRESH_INTERVAL = 30000; // 30 seconds

// Load and render dashboard
async function loadDashboard() {
  try {
    const response = await fetch(METRICS_URL + '?t=' + Date.now());
    const data = await response.json();
    
    renderDashboard(data);
    
  } catch (error) {
    console.error('Failed to load metrics:', error);
    showError('فشل تحميل البيانات');
  }
}

// Render all dashboard sections
function renderDashboard(data) {
  updateSystemStatus(data.system);
  updateQuickStats(data);
  renderProjects(data.projects);
  renderGatesTable(data.projects);
  renderKnowledgeBase(data.knowledge_base);
  renderRegistryHealth(data.registry);
  renderActivityLog(data.activity_log);
  
  // Update last update time
  document.getElementById('last-update').textContent = formatTime(data.generated_at);
}

// Update system status
function updateSystemStatus(system) {
  const indicator = document.getElementById('status-indicator');
  const text = document.getElementById('status-text');
  
  if (system.status === 'operational') {
    indicator.className = 'status-dot operational';
    text.textContent = 'Operational';
  } else {
    indicator.className = 'status-dot error';
    text.textContent = 'Error';
  }
}

// Update quick stats
function updateQuickStats(data) {
  document.getElementById('total-projects').textContent = data.registry.total_clients;
  document.getElementById('blocked-projects').textContent = data.gates_summary.blocked;
  document.getElementById('active-agents').textContent = data.agents.active;
  document.getElementById('kb-files').textContent = data.knowledge_base.total_files;
}

// Render projects
function renderProjects(projects) {
  const container = document.getElementById('projects-container');
  
  if (!projects || projects.length === 0) {
    container.innerHTML = '<div class="empty-state">لا توجد مشاريع</div>';
    return;
  }
  
  container.innerHTML = projects.map(project => `
    <div class="project-card">
      <div class="project-header">
        <h3>${project.name}</h3>
        <span class="badge ${project.status}">${getStatusArabic(project.status)}</span>
      </div>
      
      <div class="project-info">
        <div class="info-row">
          <span class="label">Slug:</span>
          <span>${project.slug}</span>
        </div>
        <div class="info-row">
          <span class="label">Pod:</span>
          <span>${project.pod}</span>
        </div>
        <div class="info-row">
          <span class="label">Tier:</span>
          <span>${project.tier}</span>
        </div>
        ${project.presales_stage ? `
        <div class="info-row">
          <span class="label">Stage:</span>
          <span>${project.presales_stage}</span>
        </div>
        ` : ''}
      </div>
      
      <div class="project-gates">
        <div class="gate ${project.gates.payment_verified ? 'passed' : 'blocked'}">
          ${project.gates.payment_verified ? '✅' : '❌'} Payment
        </div>
        <div class="gate ${project.gates.dns_verified ? 'passed' : 'blocked'}">
          ${project.gates.dns_verified ? '✅' : '❌'} DNS
        </div>
        <div class="gate ${project.gates.ssl_verified ? 'passed' : 'blocked'}">
          ${project.gates.ssl_verified ? '✅' : '❌'} SSL
        </div>
      </div>
      
      ${project.blocked_reason ? `
      <div class="blocked-reason">
        <strong>⛔ Blocked:</strong> ${project.blocked_reason}
      </div>
      ` : ''}
      
      <div class="project-domains">
        <div class="domain-row">
          <span class="domain-label">Beta:</span>
          <a href="https://${project.domains.beta}" target="_blank">${project.domains.beta}</a>
        </div>
        <div class="domain-row">
          <span class="domain-label">Staging:</span>
          <a href="https://${project.domains.staging}" target="_blank">${project.domains.staging}</a>
        </div>
        <div class="domain-row production">
          <span class="domain-label">Production:</span>
          <span class="production-domain">${project.domains.production}</span>
        </div>
      </div>
    </div>
  `).join('');
}

// Render gates table
function renderGatesTable(projects) {
  const tbody = document.querySelector('#gates-table tbody');
  
  if (!projects || projects.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">لا توجد مشاريع</td></tr>';
    return;
  }
  
  tbody.innerHTML = projects.map(project => `
    <tr class="${getGatesStatus(project.gates)}">
      <td><strong>${project.name}</strong><br><small>${project.slug}</small></td>
      <td>${project.presales_stage || project.status}</td>
      <td class="gate-cell ${project.gates.payment_verified ? 'passed' : 'blocked'}">
        ${project.gates.payment_verified ? '✅ Verified' : '❌ Not Verified'}
      </td>
      <td class="gate-cell ${project.gates.dns_verified ? 'passed' : 'blocked'}">
        ${project.gates.dns_verified ? '✅ Verified' : '❌ Not Verified'}
      </td>
      <td class="gate-cell ${project.gates.ssl_verified ? 'passed' : 'blocked'}">
        ${project.gates.ssl_verified ? '✅ Active' : '❌ Not Active'}
      </td>
      <td>
        ${getGatesStatusBadge(project.gates)}
      </td>
    </tr>
  `).join('');
}

// Render Knowledge Base
function renderKnowledgeBase(kb) {
  const completeFiles = kb.files.filter(f => f.status === 'complete').length;
  const progress = (completeFiles / kb.total_files) * 100;
  
  document.getElementById('kb-status').textContent = 
    completeFiles === kb.total_files ? '✅ Complete' : '⏳ In Progress';
  document.getElementById('kb-count').textContent = `${completeFiles}/${kb.total_files}`;
  document.getElementById('kb-progress-fill').style.width = progress + '%';
  
  const filesList = document.getElementById('kb-files-list');
  filesList.innerHTML = kb.files.map(file => `
    <div class="kb-file ${file.status}">
      <span class="file-status">${file.status === 'complete' ? '✅' : '⏳'}</span>
      <span class="file-name">${file.name}</span>
      <span class="file-date">${file.last_updated}</span>
    </div>
  `).join('');
}

// Render Registry Health
function renderRegistryHealth(registry) {
  const container = document.getElementById('registry-health');
  
  container.innerHTML = `
    <div class="health-row">
      <span class="health-label">Status:</span>
      <span class="${registry.valid ? 'status-good' : 'status-bad'}">
        ${registry.valid ? '✅ Valid' : '❌ Invalid'}
      </span>
    </div>
    <div class="health-row">
      <span class="health-label">Total Clients:</span>
      <span>${registry.total_clients}</span>
    </div>
    <div class="health-row">
      <span class="health-label">By Status:</span>
      <span>
        Presales: ${registry.by_status.presales}, 
        Active: ${registry.by_status.active}, 
        Delivered: ${registry.by_status.delivered}
      </span>
    </div>
    <div class="health-row">
      <span class="health-label">By Tier:</span>
      <span>
        Beta: ${registry.by_tier.beta}, 
        Standard: ${registry.by_tier.standard}, 
        Premium: ${registry.by_tier.premium}
      </span>
    </div>
    ${registry.duplicates.length > 0 ? `
    <div class="health-row error">
      <span class="health-label">⚠️ Duplicates:</span>
      <span>${registry.duplicates.join(', ')}</span>
    </div>
    ` : ''}
  `;
}

// Render Activity Log
function renderActivityLog(log) {
  const container = document.getElementById('activity-log');
  
  if (!log || log.length === 0) {
    container.innerHTML = '<div class="empty-state">لا توجد أحداث</div>';
    return;
  }
  
  container.innerHTML = log.slice(0, 20).map(entry => `
    <div class="log-entry ${entry.type}">
      <span class="log-time">${formatTime(entry.timestamp)}</span>
      <span class="log-type">[${entry.type}]</span>
      <span class="log-message">${entry.message}</span>
    </div>
  `).join('');
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

function getGatesStatus(gates) {
  if (gates.payment_verified && gates.dns_verified) return 'gates-passed';
  return 'gates-blocked';
}

function getGatesStatusBadge(gates) {
  if (gates.payment_verified && gates.dns_verified) {
    return '<span class="badge success">✅ Ready</span>';
  }
  return '<span class="badge blocked">⛔ Blocked</span>';
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

function showError(message) {
  // TODO: Show error notification
  console.error(message);
}

// Auto-refresh
setInterval(loadDashboard, REFRESH_INTERVAL);

// Initial load
loadDashboard();
