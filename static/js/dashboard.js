/* ==========================================================
   FRESH CUT MEAT SHOP - BUTCHERY DASHBOARD MODULE
   ========================================================== */

const DashboardModule = {
  salesChart: null,
  categoryChart: null,

  async load() {
    try {
      const data = await App.api('/api/v1/dashboard/summary');
      if (data.role === 'admin') {
        this.renderAdminDashboard(data);
      } else {
        this.renderEmployeeDashboard(data);
      }
    } catch (e) {
      console.error('Error loading dashboard:', e);
    }
  },

  renderAdminDashboard(data) {
    document.getElementById('admin-dash-view').style.display = 'block';
    document.getElementById('emp-dash-view').style.display = 'none';

    const kpi = data.kpi || {};
    // Animate KPI Counters
    AnimEngine.animateCounter(document.getElementById('kpi-today-sales'), kpi.today_sales || 0, 1000, '₹', 2);
    AnimEngine.animateCounter(document.getElementById('kpi-total-revenue'), kpi.total_revenue || 0, 1000, '₹', 2);
    AnimEngine.animateCounter(document.getElementById('kpi-total-expenses'), kpi.total_expenses || 0, 1000, '₹', 2);
    AnimEngine.animateCounter(document.getElementById('kpi-gross-profit'), kpi.gross_profit || 0, 1000, '₹', 2);
    AnimEngine.animateCounter(document.getElementById('kpi-net-profit'), kpi.net_operating_result || 0, 1000, '₹', 2);
    AnimEngine.animateCounter(document.getElementById('kpi-stock-kg'), kpi.total_stock_kg || 0, 800, '', 1, ' kg');
    AnimEngine.animateCounter(document.getElementById('kpi-low-stock-count'), kpi.low_stock_count || 0, 600, '', 0);
    AnimEngine.animateCounter(document.getElementById('kpi-today-bills'), kpi.today_bills || 0, 600, '', 0);

    // Render Low Stock Alert list with meat badges
    const alertBox = document.getElementById('dash-low-stock-list');
    if (alertBox) {
      if (data.low_stock_alerts && data.low_stock_alerts.length > 0) {
        alertBox.innerHTML = data.low_stock_alerts.map(item => {
          const isOut = parseFloat(item.current_stock || 0) <= 0;
          return `
            <div class="d-flex align-items-center justify-content-between p-3 mb-2 rounded"
                 style="background: ${isOut ? '#1c1917' : '#fff1f2'}; border: 1px solid ${isOut ? '#292524' : '#fecdd3'}; color: ${isOut ? '#ffffff' : '#991b1b'};">
              <div>
                <div class="fw-bold" style="font-size: 0.9rem;">
                  <i class="bi ${isOut ? 'bi-x-circle-fill text-danger' : 'bi-exclamation-triangle-fill text-warning'} me-1"></i> ${item.name}
                </div>
                <div style="font-size: 0.78rem; opacity: 0.85;">Cut Category: ${item.category} • Min Required: ${item.min_stock} ${item.unit}</div>
              </div>
              <div class="text-end">
                <span class="badge ${isOut ? 'bg-danger' : 'bg-warning text-dark'} pulse-badge">
                  ${isOut ? 'OUT OF STOCK' : `${item.current_stock} ${item.unit} left`}
                </span>
              </div>
            </div>
          `;
        }).join('');
      } else {
        alertBox.innerHTML = `
          <div class="text-center py-4 text-muted">
            <i class="bi bi-shield-check text-success fs-1"></i>
            <p class="mt-2 mb-0 fw-bold" style="font-size: 0.88rem;">All meat cuts are fully stocked above minimum threshold!</p>
          </div>
        `;
      }
    }

    // Render Recent Transactions
    const txBody = document.getElementById('dash-recent-tx-body');
    if (txBody) {
      if (data.recent_transactions && data.recent_transactions.length > 0) {
        txBody.innerHTML = data.recent_transactions.map(tx => `
          <tr>
            <td class="fw-bold text-danger">${tx.invoice_no}</td>
            <td>${tx.customer_name || 'Retail Walk-in'}</td>
            <td><span class="badge bg-light text-dark border">${tx.payment_method}</span></td>
            <td>${new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
            <td class="text-end fw-bold text-dark">₹${parseFloat(tx.total_amount).toFixed(2)}</td>
          </tr>
        `).join('');
      } else {
        txBody.innerHTML = '<tr><td colspan="5" class="text-center py-3 text-muted">No transactions recorded today yet.</td></tr>';
      }
    }

    // Render Charts
    this.renderCharts(data.charts);
  },

  renderEmployeeDashboard(data) {
    document.getElementById('admin-dash-view').style.display = 'none';
    document.getElementById('emp-dash-view').style.display = 'block';

    AnimEngine.animateCounter(document.getElementById('emp-today-sales'), data.today_sales || 0, 1000, '₹', 2);
    AnimEngine.animateCounter(document.getElementById('emp-today-bills'), data.bills_count || 0, 800, '', 0);
    AnimEngine.animateCounter(document.getElementById('emp-active-products'), data.active_products_count || 0, 800, '', 0);

    const empTxBody = document.getElementById('emp-recent-tx-body');
    if (empTxBody) {
      if (data.recent_transactions && data.recent_transactions.length > 0) {
        empTxBody.innerHTML = data.recent_transactions.map(tx => `
          <tr>
            <td class="fw-bold text-danger">${tx.invoice_no}</td>
            <td><span class="badge bg-light text-dark border">${tx.payment_method}</span></td>
            <td>${new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
            <td class="text-end fw-bold">₹${parseFloat(tx.total_amount).toFixed(2)}</td>
          </tr>
        `).join('');
      } else {
        empTxBody.innerHTML = '<tr><td colspan="4" class="text-center py-3 text-muted">No bills generated on your terminal today yet.</td></tr>';
      }
    }
  },

  renderCharts(chartsData = {}) {
    // 1. Sales Trend Line Chart (Artisanal Red Curve)
    const salesCanvas = document.getElementById('dash-sales-chart');
    if (salesCanvas) {
      const ctx = salesCanvas.getContext('2d');
      if (this.salesChart) this.salesChart.destroy();

      const trends = chartsData.daily_trends || [];
      const labels = trends.map(t => new Date(t.sale_date).toLocaleDateString([], { month: 'short', day: 'numeric' }));
      const salesValues = trends.map(t => t.total_sales);
      const cogsValues = trends.map(t => t.total_cogs);

      // Create rich butcher red gradient
      const gradient = ctx.createLinearGradient(0, 0, 0, 300);
      gradient.addColorStop(0, 'rgba(225, 29, 72, 0.35)');
      gradient.addColorStop(1, 'rgba(225, 29, 72, 0.0)');

      this.salesChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: labels.length ? labels : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
          datasets: [
            {
              label: 'Sales Revenue (₹)',
              data: salesValues.length ? salesValues : [2400, 3600, 3100, 4800, 6200, 8900, 7400],
              borderColor: '#be123c',
              backgroundColor: gradient,
              borderWidth: 3,
              fill: true,
              tension: 0.35,
              pointBackgroundColor: '#881337',
              pointRadius: 4,
              pointHoverRadius: 7
            },
            {
              label: 'Cost of Goods Sold (₹)',
              data: cogsValues.length ? cogsValues : [1700, 2500, 2200, 3300, 4200, 6100, 5100],
              borderColor: '#78716c',
              borderDash: [5, 5],
              borderWidth: 2,
              fill: false,
              tension: 0.35,
              pointRadius: 0
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 1200, easing: 'easeOutQuart' },
          plugins: {
            legend: { position: 'top', labels: { boxWidth: 12, font: { family: 'Inter', weight: 600 } } },
            tooltip: {
              backgroundColor: '#1c1917',
              padding: 12,
              cornerRadius: 8,
              callbacks: {
                label: function(ctx) { return `${ctx.dataset.label}: ₹${ctx.parsed.y.toLocaleString()}`; }
              }
            }
          },
          scales: {
            y: { grid: { color: '#f5f5f4' }, ticks: { callback: v => '₹' + v } },
            x: { grid: { display: false } }
          }
        }
      });
    }

    // 2. Meat Category Doughnut Chart
    const catCanvas = document.getElementById('dash-category-chart');
    if (catCanvas) {
      const ctx = catCanvas.getContext('2d');
      if (this.categoryChart) this.categoryChart.destroy();

      const cats = chartsData.categories || [];
      const catLabels = cats.map(c => c.category);
      const catRevenues = cats.map(c => c.revenue);

      this.categoryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: catLabels.length ? catLabels : ['Chicken', 'Mutton', 'Seafood', 'Beef', 'Cold Cuts'],
          datasets: [{
            data: catRevenues.length ? catRevenues : [45, 30, 15, 7, 3],
            backgroundColor: ['#d97706', '#991b1b', '#0284c7', '#701a75', '#059669'],
            borderWidth: 2,
            borderColor: '#ffffff',
            hoverOffset: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 1000 },
          plugins: {
            legend: { position: 'bottom', labels: { boxWidth: 12, padding: 14 } }
          },
          cutout: '70%'
        }
      });
    }
  }
};
