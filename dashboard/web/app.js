// PUIUX Dashboard - Main App Logic

const METRICS_URL = '../state/metrics.json';
const REFRESH_INTERVAL = 30000; // 30 seconds

// XSS Protection
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

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
  renderKanbanBoard(data.projects);
  updateQuickStats(data);
  renderProjects(data.projects);
  renderGatesTable(data.projects);
  renderKnowledgeBase(data.knowledge_base);
  renderRegistryHealth(data.registry);
  renderRecentRuns(data.recent_runs);
  renderActivityLog(data.activity_log);
  
  // Update last update time
  document.getElementById('last-update').textContent = formatTime(data.generated_at);
}

// Render Kanban Board
function renderKanbanBoard(projects) {
  if (!projects || projects.length === 0) {
    return;
  }

  // Classify projects by status
  const classified = {
    blocked: [],
    working: [],
    ready: [],
    live: []
  };

  projects.forEach(project => {
    const status = classifyProject(project);
    classified[status].push(project);
  });

  // Render each column
  renderKanbanColumn('blocked', classified.blocked);
  renderKanbanColumn('working', classified.working);
  renderKanbanColumn('ready', classified.ready);
  renderKanbanColumn('live', classified.live);

  // Update counts
  document.getElementById('blocked-count').textContent = classified.blocked.length;
  document.getElementById('working-count').textContent = classified.working.length;
  document.getElementById('ready-count').textContent = classified.ready.length;
  document.getElementById('live-count').textContent = classified.live.length;
}

// Classify project by gates status
function classifyProject(project) {
  const gates = project.gates || {};
  const latestRun = project.latest_run;
  
  // Rule: Blocked - any essential gate is false
  if (!gates.payment_verified || !gates.dns_verified || !gates.contract_signed) {
    return 'blocked';
  }
  
  // Rule: Live - all gates true + production domain + delivered status
  const isDelivered = project.status === 'delivered' || 
                       (latestRun && latestRun.stage && latestRun.stage.match(/prod|s5|delivered/i));
  const hasProductionDomain = project.domains && project.domains.production && 
                               !project.domains.production.includes('puiux.cloud');
  
  if (gates.payment_verified && gates.dns_verified && isDelivered && hasProductionDomain) {
    return 'live';
  }
  
  // Rule: Ready - all essential gates true but not live yet
  if (gates.payment_verified && gates.dns_verified && gates.contract_signed) {
    return 'ready';
  }
  
  // Rule: Working - everything else (has runs or progress but not blocked)
  return 'working';
}

// Render Kanban Column
function renderKanbanColumn(columnId, projects) {
  const container = document.getElementById(`${columnId}-cards`);
  
  if (!projects || projects.length === 0) {
    container.innerHTML = '<div class="column-empty">—</div>';
    return;
  }

  container.innerHTML = projects.map(project => createKanbanCard(project)).join('');
}

// Create Kanban Card
function createKanbanCard(project) {
  const latestRun = project.latest_run;
  const gates = project.gates || {};
  
  return `
    <div class="kanban-card">
      <div class="kanban-card-header">
        <div class="kanban-card-title">
          <h4>${escapeHtml(project.name)}</h4>
          <div class="slug">${escapeHtml(project.slug)}</div>
        </div>
        <div class="kanban-card-stage">${escapeHtml(latestRun?.stage || project.presales_stage || project.status)}</div>
      </div>
      
      <div class="kanban-card-gates">
        <div class="kanban-gate-icon ${gates.payment_verified ? 'passed' : 'blocked'}" title="الدفع">
          <i class="fas fa-${gates.payment_verified ? 'check' : 'times'}"></i>
        </div>
        <div class="kanban-gate-icon ${gates.dns_verified ? 'passed' : 'blocked'}" title="DNS">
          <i class="fas fa-${gates.dns_verified ? 'check' : 'times'}"></i>
        </div>
        <div class="kanban-gate-icon ${gates.contract_signed ? 'passed' : 'blocked'}" title="العقد">
          <i class="fas fa-${gates.contract_signed ? 'check' : 'times'}"></i>
        </div>
        ${gates.ssl_verified !== undefined ? `
        <div class="kanban-gate-icon ${gates.ssl_verified ? 'passed' : 'blocked'}" title="SSL">
          <i class="fas fa-${gates.ssl_verified ? 'lock' : 'lock-open'}"></i>
        </div>
        ` : ''}
      </div>
      
      <div class="kanban-card-meta">
        <span>
          <i class="fas fa-file"></i>
          ${latestRun?.artifacts_count || 0} ملف
        </span>
        <span>
          <i class="fas fa-clock"></i>
          ${latestRun ? formatTime(latestRun.timestamp) : '—'}
        </span>
      </div>
      
      <div class="kanban-card-actions">
        ${project.domains?.beta ? `
        <a href="https://${escapeHtml(project.domains.beta)}" target="_blank" class="kanban-quick-btn" title="فتح النسخة التجريبية">
          <i class="fas fa-eye"></i>
        </a>
        ` : ''}
        ${latestRun ? `
        <button class="kanban-quick-btn" title="عرض التفاصيل" onclick="alert('Run ID: ${escapeHtml(latestRun.run_id)}')">
          <i class="fas fa-info-circle"></i>
        </button>
        ` : ''}
        ${latestRun?.artifacts_count ? `
        <button class="kanban-quick-btn" title="الملفات (${latestRun.artifacts_count})">
          <i class="fas fa-file-alt"></i>
        </button>
        ` : ''}
    </div>
  `;
}

// Update system status
function updateSystemStatus(system) {
  const indicator = document.getElementById('status-indicator');
  const text = document.getElementById('status-text');
  
  if (system.status === 'operational') {
    indicator.className = 'status-dot operational';
    text.textContent = 'النظام يعمل';
  } else {
    indicator.className = 'status-dot error';
    text.textContent = 'خطأ';
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
        <h3>${escapeHtml(project.name)}</h3>
        <span class="badge ${project.status}">${getStatusArabic(project.status)}</span>
      </div>
      
      <div class="project-info">
        <div class="info-row">
          <span class="label">المعرّف:</span>
          <span>${project.slug}</span>
        </div>
        <div class="info-row">
          <span class="label">المجموعة:</span>
          <span>${project.pod}</span>
        </div>
        <div class="info-row">
          <span class="label">الفئة:</span>
          <span>${getTierArabic(project.tier)}</span>
        </div>
        ${project.presales_stage ? `
        <div class="info-row">
          <span class="label">المرحلة:</span>
          <span>${project.presales_stage}</span>
        </div>
        ` : ''}
      </div>
      
      <div class="project-gates">
        <div class="gate ${project.gates.payment_verified ? 'passed' : 'blocked'}">
          ${project.gates.payment_verified ? '✅' : '❌'} الدفع
        </div>
        <div class="gate ${project.gates.dns_verified ? 'passed' : 'blocked'}">
          ${project.gates.dns_verified ? '✅' : '❌'} النطاق
        </div>
        <div class="gate ${project.gates.ssl_verified ? 'passed' : 'blocked'}">
          ${project.gates.ssl_verified ? '✅' : '❌'} الشهادة
        </div>
      </div>
      
      ${project.blocked_reason ? `
      <div class="blocked-reason">
        <strong>⛔ محجوب:</strong> ${getBlockedReasonArabic(project.blocked_reason)}
      </div>
      ` : ''}
      
      <div class="project-domains">
        <div class="domain-row">
          <span class="domain-label">تجريبي:</span>
          <a href="https://${project.domains.beta}" target="_blank">${project.domains.beta}</a>
        </div>
        <div class="domain-row">
          <span class="domain-label">مرحلي:</span>
          <a href="https://${project.domains.staging}" target="_blank">${project.domains.staging}</a>
        </div>
        <div class="domain-row production">
          <span class="domain-label">إنتاج:</span>
          <span class="production-domain">${project.domains.production}</span>
        </div>
      </div>
    </div>
  `).join('');
}

// Render gates monitor (Visual)
function renderGatesTable(projects) {
  const container = document.getElementById('gates-monitor');
  
  if (!projects || projects.length === 0) {
    container.innerHTML = '<div class="empty-state">لا توجد مشاريع</div>';
    container.classList.remove('loading');
    return;
  }
  
  container.innerHTML = projects.map(project => {
    const gates = project.gates || {};
    const allPassed = gates.payment_verified && gates.dns_verified && gates.contract_signed;
    
    return `
      <div class="gate-card ${allPassed ? 'all-passed' : 'blocked'}">
        <div class="gate-card-header">
          <div class="gate-card-title">
            <h4>${escapeHtml(project.name)}</h4>
            <span class="gate-slug">${escapeHtml(project.slug)}</span>
          </div>
          <div class="gate-card-badge ${allPassed ? 'success' : 'danger'}">
            <i class="fas fa-${allPassed ? 'check-circle' : 'exclamation-circle'}"></i>
            ${allPassed ? 'جميع البوابات مفتوحة' : 'محجوب'}
          </div>
        </div>
        
        <div class="gates-grid">
          <div class="gate-item ${gates.payment_verified ? 'passed' : 'blocked'}">
            <div class="gate-icon">
              <i class="fas fa-${gates.payment_verified ? 'check' : 'times'}"></i>
            </div>
            <div class="gate-info">
              <div class="gate-label">
                <i class="fas fa-credit-card"></i>
                الدفع
              </div>
              <div class="gate-status">
                ${gates.payment_verified ? 'تم التحقق ✅' : 'لم يتم ❌'}
              </div>
            </div>
          </div>
          
          <div class="gate-item ${gates.dns_verified ? 'passed' : 'blocked'}">
            <div class="gate-icon">
              <i class="fas fa-${gates.dns_verified ? 'check' : 'times'}"></i>
            </div>
            <div class="gate-info">
              <div class="gate-label">
                <i class="fas fa-globe"></i>
                النطاق
              </div>
              <div class="gate-status">
                ${gates.dns_verified ? 'تم التحقق ✅' : 'لم يتم ❌'}
              </div>
            </div>
          </div>
          
          <div class="gate-item ${gates.contract_signed ? 'passed' : 'blocked'}">
            <div class="gate-icon">
              <i class="fas fa-${gates.contract_signed ? 'check' : 'times'}"></i>
            </div>
            <div class="gate-info">
              <div class="gate-label">
                <i class="fas fa-file-contract"></i>
                العقد
              </div>
              <div class="gate-status">
                ${gates.contract_signed ? 'موقّع ✅' : 'غير موقّع ❌'}
              </div>
            </div>
          </div>
          
          ${gates.ssl_verified !== undefined ? `
          <div class="gate-item ${gates.ssl_verified ? 'passed' : 'blocked'}">
            <div class="gate-icon">
              <i class="fas fa-${gates.ssl_verified ? 'lock' : 'lock-open'}"></i>
            </div>
            <div class="gate-info">
              <div class="gate-label">
                <i class="fas fa-shield-alt"></i>
                SSL
              </div>
              <div class="gate-status">
                ${gates.ssl_verified ? 'مفعّل ✅' : 'غير مفعّل ❌'}
              </div>
            </div>
          </div>
          ` : ''}
        </div>
        
        ${project.blocked_reason ? `
        <div class="gate-blocked-alert">
          <i class="fas fa-exclamation-triangle"></i>
          <strong>سبب الحجب:</strong> ${getBlockedReasonArabic(project.blocked_reason)}
        </div>
        ` : ''}
      </div>
    `;
  }).join('');
  
  container.classList.remove('loading');
}

// Render Knowledge Base
function renderKnowledgeBase(kb) {
  // Treat files without status as complete (from index.json)
  const completeFiles = kb.files.filter(f => !f.status || f.status === 'complete').length;
  const progress = (completeFiles / kb.total_files) * 100;
  
  document.getElementById('kb-status').textContent = 
    completeFiles === kb.total_files ? '✅ مكتمل' : '⏳ قيد الإنجاز';
  document.getElementById('kb-count').textContent = `${completeFiles}/${kb.total_files}`;
  document.getElementById('kb-progress-fill').style.width = progress + '%';
  
  const filesList = document.getElementById('kb-files-list');
  filesList.innerHTML = kb.files.map(file => `
    <div class="kb-file ${file.status || 'complete'}">
      <span class="file-status">${(file.status === 'complete' || !file.status) ? '✅' : '⏳'}</span>
      <span class="file-name">${escapeHtml(file.title || file.name || file.id || '—')}</span>
      <span class="file-date">${file.last_updated || '—'}</span>
    </div>
  `).join('');
}

// Render Registry Health
function renderRegistryHealth(registry) {
  const container = document.getElementById('registry-health');
  
  container.innerHTML = `
    <div class="health-row">
      <span class="health-label">الحالة:</span>
      <span class="${registry.valid ? 'status-good' : 'status-bad'}">
        ${registry.valid ? '✅ صحيح' : '❌ غير صحيح'}
      </span>
    </div>
    <div class="health-row">
      <span class="health-label">إجمالي العملاء:</span>
      <span>${registry.total_clients}</span>
    </div>
    <div class="health-row">
      <span class="health-label">حسب الحالة:</span>
      <span>
        مبيعات: ${registry.by_status.presales}، 
        نشط: ${registry.by_status.active}، 
        مسلّم: ${registry.by_status.delivered}
      </span>
    </div>
    <div class="health-row">
      <span class="health-label">حسب الفئة:</span>
      <span>
        تجريبي: ${registry.by_tier.beta}، 
        قياسي: ${registry.by_tier.standard}، 
        مميز: ${registry.by_tier.premium}
      </span>
    </div>
    ${registry.duplicates.length > 0 ? `
    <div class="health-row error">
      <span class="health-label">⚠️ مكررات:</span>
      <span>${registry.duplicates.join(', ')}</span>
    </div>
    ` : ''}
  `;
}

// Render Recent Runs
function renderRecentRuns(runs) {
  const container = document.getElementById('runs-info');
  
  if (!runs || runs.length === 0) {
    container.innerHTML = '<div class="empty-state">لا توجد عمليات تنفيذ</div>';
    return;
  }
  
  container.innerHTML = `
    <table class="runs-table">
      <thead>
        <tr>
          <th>معرّف التشغيل</th>
          <th>العميل</th>
          <th>المرحلة</th>
          <th>الحالة</th>
          <th>الملفات</th>
          <th>التوقيت</th>
        </tr>
      </thead>
      <tbody>
        ${runs.map(run => `
          <tr class="run-row ${run.status}">
            <td>
              <code class="run-id" title="${escapeHtml(run.run_id)}" onclick="copyToClipboard('${escapeHtml(run.run_id)}')">
                ${escapeHtml(run.run_id.substring(0, 20))}...
                <i class="fas fa-copy copy-icon"></i>
              </code>
            </td>
            <td>${escapeHtml(run.client_name || run.client)}</td>
            <td><span class="badge">${escapeHtml(run.stage)}</span></td>
            <td><span class="badge ${run.status}">${getRunStatusIcon(run.status)} ${getRunStatusArabic(run.status)}</span></td>
            <td>${run.artifacts_count} ملف</td>
            <td>${formatTime(run.timestamp)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

// Render Activity Log
function renderActivityLog(log) {
  const container = document.getElementById('activity-info');
  
  if (!log || log.length === 0) {
    container.innerHTML = '<div class="empty-state">لا توجد أحداث</div>';
    return;
  }
  
  container.innerHTML = log.slice(0, 20).map(entry => `
    <div class="log-entry ${entry.type}">
      <span class="log-time">${formatTime(entry.timestamp)}</span>
      <span class="log-type">[${escapeHtml(entry.type)}]</span>
      <span class="log-message">${escapeHtml(entry.message)}</span>
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
    return '<span class="badge success">✅ جاهز</span>';
  }
  return '<span class="badge blocked">⛔ محجوب</span>';
}

function getTierArabic(tier) {
  const map = {
    'beta': 'تجريبي',
    'standard': 'قياسي',
    'premium': 'مميز',
    'enterprise': 'مؤسسات'
  };
  return map[tier] || tier;
}

function getBlockedReasonArabic(reason) {
  if (!reason) return '';
  return reason
    .replace('Payment not verified', 'الدفع غير مؤكد')
    .replace('DNS not verified', 'النطاق غير مؤكد')
    .replace('Contract not signed', 'العقد غير موقّع');
}

function getRunStatusIcon(status) {
  const icons = {
    'success': '✅',
    'failed': '❌',
    'blocked': '⛔',
    'running': '⏳'
  };
  return icons[status] || '❓';
}

function getRunStatusArabic(status) {
  const map = {
    'success': 'نجح',
    'failed': 'فشل',
    'blocked': 'محجوب',
    'running': 'قيد التشغيل'
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

function showError(message) {
  // TODO: Show error notification
  console.error(message);
}

// Copy to clipboard
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    // Show brief feedback
    const toast = document.createElement('div');
    toast.className = 'copy-toast';
    toast.textContent = '✓ تم النسخ';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
  }).catch(err => {
    console.error('Copy failed:', err);
  });
}

// Auto-refresh
setInterval(loadDashboard, REFRESH_INTERVAL);

// Initial load
loadDashboard();
