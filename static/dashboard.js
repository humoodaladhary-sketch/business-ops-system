document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('report-date').textContent = new Date().toLocaleDateString('en-GB', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    const [dashboard, kpis, satRecords, satCompliance, auditItems, auditSummary, risks, cqiIdeas] = await Promise.all([
        fetchJSON('/api/dashboard'),
        fetchJSON('/api/kpis'),
        fetchJSON('/api/sat/records'),
        fetchJSON('/api/sat/compliance'),
        fetchJSON('/api/audit/items'),
        fetchJSON('/api/audit/summary'),
        fetchJSON('/api/risks'),
        fetchJSON('/api/cqi/ideas'),
    ]);

    renderScoreBanner(dashboard);
    renderKPITable(kpis);
    renderSATSection(satRecords, satCompliance);
    renderAuditSection(auditItems, auditSummary);
    renderRisks(risks);
    renderCQI(cqiIdeas);
});

async function fetchJSON(url) {
    try {
        const res = await fetch(url);
        return await res.json();
    } catch (e) {
        console.error(`Failed to fetch ${url}:`, e);
        return null;
    }
}

function renderScoreBanner(d) {
    if (!d) return;
    document.getElementById('overall-score').textContent = d.overall_score.toFixed(1) + '%';

    const badge = document.getElementById('rating-badge');
    badge.textContent = d.rating;
    const ratingClass = {
        'OUTSTANDING': 'rating-outstanding',
        'EXCEEDS EXPECTATIONS': 'rating-exceeds',
        'MEETS EXPECTATIONS': 'rating-meets',
        'NEEDS IMPROVEMENT': 'rating-needs',
        'UNSATISFACTORY': 'rating-unsatisfactory',
    }[d.rating] || 'rating-needs';
    badge.className = 'rating ' + ratingClass;

    document.getElementById('behind-count').textContent = d.kpis_behind;
    document.getElementById('at-risk-count').textContent = d.kpis_at_risk;
    document.getElementById('sat-compliance').textContent = (d.sat_compliance?.compliance_rate || 0) + '%';
}

function renderKPITable(kpis) {
    if (!kpis) return;
    const tbody = document.getElementById('kpi-table-body');
    // Sort by priority
    kpis.sort((a, b) => a.priority - b.priority);

    tbody.innerHTML = kpis.map(k => {
        const pct = k.target_value > 0 ? Math.min((k.current_value / k.target_value) * 100, 100) : 0;
        const score = k.target_value > 0 ? Math.min((k.current_value / k.target_value) * k.weight, k.weight) : 0;
        const colorClass = pct >= 95 ? 'progress-green' : pct >= 80 ? 'progress-yellow' : 'progress-red';
        const statusText = (k.status || 'on_track').replace('KPIStatus.', '');

        return `<tr>
            <td><strong>P${k.priority}</strong></td>
            <td>${k.name}</td>
            <td>${k.weight}%</td>
            <td>${k.target_value} ${k.unit}</td>
            <td>${k.current_value} ${k.unit}</td>
            <td>
                <div style="min-width:120px">
                    <div style="display:flex;justify-content:space-between;font-size:11px">
                        <span>${pct.toFixed(0)}%</span>
                    </div>
                    <div class="progress-bar"><div class="progress-fill ${colorClass}" style="width:${pct}%"></div></div>
                </div>
            </td>
            <td><strong>${score.toFixed(1)}</strong> / ${k.weight}</td>
            <td>${badge(statusText)}</td>
        </tr>`;
    }).join('');
}

function renderSATSection(records, compliance) {
    if (!records) return;
    const summary = document.getElementById('sat-summary');
    if (compliance) {
        summary.innerHTML = `
            <div style="display:flex;gap:24px;margin-bottom:16px;font-size:13px">
                <div><strong style="color:#34d399">${compliance.on_time || 0}</strong> On Time</div>
                <div><strong style="color:#f87171">${compliance.delayed || 0}</strong> Delayed</div>
                <div><strong style="color:#fbbf24">${compliance.missing_ho_documents || 0}</strong> Missing HO Docs</div>
                <div><strong style="color:#fb923c">${compliance.no_precheck || 0}</strong> No Pre-Check</div>
            </div>
            ${compliance.risk_flag && compliance.risk_flag !== 'LOW' ?
                `<div style="background:#7f1d1d;color:#fef2f2;padding:8px 12px;border-radius:6px;font-size:12px;margin-bottom:12px;font-weight:600">
                    RISK FLAG: ${compliance.risk_flag}
                </div>` : ''}
        `;
    }

    const tbody = document.getElementById('sat-table-body');
    tbody.innerHTML = records.map(s => `<tr>
        <td><strong>${s.site_id}</strong><br><span style="font-size:11px;color:#94a3b8">${s.site_name}</span></td>
        <td>${s.region}</td>
        <td>${s.sla_deadline || '-'}</td>
        <td>${s.ho_documents_complete ? badge('compliant') : badge('non_compliant')}</td>
        <td>${s.pre_check_done ? badge('compliant') : badge('pending')}</td>
        <td>${badge(s.status)}</td>
    </tr>`).join('');
}

function renderAuditSection(items, summary) {
    if (!items) return;
    const summaryDiv = document.getElementById('audit-summary');
    if (summary) {
        summaryDiv.innerHTML = `
            <div style="display:flex;gap:24px;margin-bottom:16px;font-size:13px">
                <div><strong style="color:#34d399">${summary.compliant || 0}</strong> Compliant</div>
                <div><strong style="color:#f87171">${summary.non_compliant || 0}</strong> Non-Compliant</div>
                <div><strong style="color:#fbbf24">${summary.in_progress || 0}</strong> In Progress</div>
                <div><strong style="color:#94a3b8">${summary.pending || 0}</strong> Pending</div>
            </div>
        `;
    }

    const tbody = document.getElementById('audit-table-body');
    tbody.innerHTML = items.map(a => `<tr>
        <td>${a.data_center}</td>
        <td>${a.category}</td>
        <td style="font-size:12px">${a.checklist_item}</td>
        <td>${badge(a.status)}</td>
    </tr>`).join('');
}

function renderRisks(risks) {
    if (!risks) return;
    const container = document.getElementById('risks-container');
    container.innerHTML = risks.map(r => {
        const sevText = (r.severity || 'medium').replace('Severity.', '').toLowerCase();
        return `<div class="risk-item risk-${sevText}">
            <div class="risk-title">${badge(sevText)} ${r.risk_description}</div>
            <div class="risk-detail"><strong>KPI:</strong> ${r.kpi_affected} | <strong>Likelihood:</strong> ${r.likelihood}</div>
            <div class="risk-detail"><strong>Impact:</strong> ${r.impact}</div>
            <div class="risk-action"><strong>Mitigation:</strong> ${r.mitigation}</div>
        </div>`;
    }).join('');
}

function renderCQI(ideas) {
    if (!ideas) return;
    const tbody = document.getElementById('cqi-table-body');
    tbody.innerHTML = ideas.map(c => `<tr>
        <td><strong>${c.title}</strong><br><span style="font-size:11px;color:#94a3b8">${(c.description || '').substring(0, 80)}...</span></td>
        <td>${c.category}</td>
        <td>${c.kpi_affected}</td>
        <td style="font-size:12px">${c.estimated_improvement || '-'}</td>
        <td>${badge(c.effort)}</td>
        <td>${badge(c.status)}</td>
    </tr>`).join('');
}

function badge(status) {
    if (!status) return '';
    const s = status.toLowerCase().replace(/ /g, '_');
    const classMap = {
        'on_track': 'badge-on-track', 'completed': 'badge-completed', 'compliant': 'badge-compliant',
        'at_risk': 'badge-at-risk', 'in_progress': 'badge-in-progress', 'medium': 'badge-at-risk',
        'behind': 'badge-behind', 'delayed': 'badge-delayed', 'non_compliant': 'badge-non-compliant', 'high': 'badge-behind',
        'pending': 'badge-pending', 'proposed': 'badge-pending', 'low': 'badge-on-track',
        'critical': 'badge-critical',
    };
    return `<span class="badge ${classMap[s] || 'badge-pending'}">${status.replace(/_/g, ' ')}</span>`;
}
