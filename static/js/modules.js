/* ==========================================================
   FRESH CUT MEAT SHOP - MANAGEMENT MODULES (ENHANCED)
   With Meat Images & Stock Badging
   ========================================================== */

// 1. PRODUCTS MODULE
const ProductsModule = {
  async load() {
    try {
      const res = await App.api('/api/v1/products?active_only=false');
      const tbody = document.getElementById('products-table-body');
      if (!tbody) return;

      const isAdmin = App.user.role === 'admin';
      const defaultMeatImg = 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=120&q=80';

      tbody.innerHTML = (res.products || []).map(p => {
        const stock = parseFloat(p.current_stock || 0);
        const isOut = stock <= 0;
        const img = p.image_url || defaultMeatImg;

        return `
          <tr>
            <td style="width: 50px;">
              <img src="${img}" alt="${p.name}" class="rounded shadow-sm" style="width: 44px; height: 44px; object-fit: cover;">
            </td>
            <td class="fw-bold">${p.code}</td>
            <td>
              <div class="fw-bold text-dark">${p.name}</div>
              <small class="text-muted">${p.description || ''}</small>
            </td>
            <td><span class="badge-category cat-${p.category.toLowerCase().replace(/[^a-z]/g, '')}">${p.category}</span></td>
            <td><span class="badge bg-light text-dark border">${p.unit}</span></td>
            <td class="fw-bold text-danger">₹${parseFloat(p.selling_price).toFixed(2)}</td>
            ${isAdmin ? `<td class="text-muted">₹${parseFloat(p.cost_price).toFixed(2)}</td>` : ''}
            <td>
              ${isOut ? `
                <span class="badge-status-out">OUT OF STOCK</span>
              ` : `
                <span class="badge ${stock <= p.min_stock ? 'bg-danger pulse-badge' : 'bg-success'}">
                  ${stock.toFixed(1)} ${p.unit}
                </span>
              `}
            </td>
            <td>
              <span class="badge ${p.is_active ? 'bg-success-subtle text-success' : 'bg-secondary'}">
                ${p.is_active ? 'Active' : 'Inactive'}
              </span>
            </td>
            ${isAdmin ? `
              <td class="text-end">
                <button class="btn btn-sm btn-outline-danger me-1" title="Edit Cut" onclick="ProductsModule.editProduct('${p.id}')">
                  <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-outline-secondary" title="Deactivate" onclick="ProductsModule.deleteProduct('${p.id}')">
                  <i class="bi bi-archive"></i>
                </button>
              </td>
            ` : ''}
          </tr>
        `;
      }).join('');
    } catch (e) {
      console.error(e);
    }
  },

  openAddModal() {
    document.getElementById('product-form').reset();
    document.getElementById('prod-id').value = '';
    document.getElementById('prod-code').readOnly = false;
    new bootstrap.Modal(document.getElementById('productModal')).show();
  },

  async editProduct(id) {
    try {
      const res = await App.api(`/api/v1/products/${id}`);
      const p = res.product;
      document.getElementById('prod-id').value = p.id;
      document.getElementById('prod-code').value = p.code;
      document.getElementById('prod-code').readOnly = true;
      document.getElementById('prod-name').value = p.name;
      document.getElementById('prod-category').value = p.category;
      document.getElementById('prod-unit').value = p.unit;
      document.getElementById('prod-selling-price').value = p.selling_price;
      document.getElementById('prod-cost-price').value = p.cost_price || 0;
      document.getElementById('prod-min-stock').value = p.min_stock;
      document.getElementById('prod-image-url').value = p.image_url || '';
      document.getElementById('prod-description').value = p.description || '';
      document.getElementById('prod-active').checked = p.is_active;

      new bootstrap.Modal(document.getElementById('productModal')).show();
    } catch (e) {
      console.error(e);
    }
  },

  async saveProduct(e) {
    e.preventDefault();
    const id = document.getElementById('prod-id').value;
    const payload = {
      code: document.getElementById('prod-code').value.trim(),
      name: document.getElementById('prod-name').value.trim(),
      category: document.getElementById('prod-category').value,
      unit: document.getElementById('prod-unit').value,
      selling_price: parseFloat(document.getElementById('prod-selling-price').value),
      cost_price: parseFloat(document.getElementById('prod-cost-price').value),
      min_stock: parseFloat(document.getElementById('prod-min-stock').value || 5),
      image_url: document.getElementById('prod-image-url').value.trim(),
      description: document.getElementById('prod-description').value.trim(),
      is_active: document.getElementById('prod-active').checked
    };

    try {
      if (id) {
        await App.api(`/api/v1/products/${id}`, { method: 'PUT', body: payload });
        AnimEngine.showToast('Product cut updated successfully.', 'success');
      } else {
        await App.api('/api/v1/products', { method: 'POST', body: payload });
        AnimEngine.showToast('New fresh cut added to catalog.', 'success');
      }
      bootstrap.Modal.getInstance(document.getElementById('productModal')).hide();
      this.load();
    } catch (err) {
      console.error(err);
    }
  },

  async deleteProduct(id) {
    if (!confirm('Are you sure you want to deactivate this product?')) return;
    try {
      await App.api(`/api/v1/products/${id}`, { method: 'DELETE' });
      AnimEngine.showToast('Product deactivated.', 'warning');
      this.load();
    } catch (e) {
      console.error(e);
    }
  }
};

// 2. INVENTORY & WASTAGE MODULE
const InventoryModule = {
  async load() {
    try {
      const res = await App.api('/api/v1/inventory');
      const tbody = document.getElementById('inventory-table-body');
      if (!tbody) return;

      tbody.innerHTML = (res.inventory || []).map(item => {
        const stock = parseFloat(item.current_stock || 0);
        const isOut = stock <= 0;
        return `
          <tr>
            <td class="fw-bold">${item.code}</td>
            <td><div class="fw-bold text-dark">${item.name}</div></td>
            <td><span class="badge bg-light text-dark border">${item.category}</span></td>
            <td class="fw-bold fs-6 ${isOut ? 'text-secondary' : item.is_low_stock ? 'text-danger' : 'text-success'}">
              ${stock.toFixed(2)} ${item.unit}
            </td>
            <td>${parseFloat(item.min_stock).toFixed(1)} ${item.unit}</td>
            <td>
              ${isOut ? `
                <span class="badge-status-out">OUT OF STOCK</span>
              ` : `
                <span class="${item.is_low_stock ? 'badge-status-low pulse-badge' : 'badge-status-ok'}">
                  ${item.is_low_stock ? '<i class="bi bi-exclamation-triangle"></i> LOW STOCK' : '<i class="bi bi-check2"></i> Sufficient'}
                </span>
              `}
            </td>
            <td class="text-end admin-only">
              <button class="btn btn-sm btn-outline-danger" onclick="InventoryModule.openAdjustModal('${item.product_id}', '${item.name}', '${item.unit}', ${item.current_stock})">
                <i class="bi bi-scissors me-1"></i> Log Wastage / Trim
              </button>
            </td>
          </tr>
        `;
      }).join('');

      this.loadMovements();
    } catch (e) {
      console.error(e);
    }
  },

  async loadMovements() {
    try {
      const res = await App.api('/api/v1/inventory/movements?limit=25');
      const tbody = document.getElementById('movements-table-body');
      if (!tbody) return;

      tbody.innerHTML = (res.movements || []).map(m => `
        <tr>
          <td><small class="text-muted">${new Date(m.created_at).toLocaleString()}</small></td>
          <td class="fw-bold">${m.product_name}</td>
          <td>
            <span class="badge ${m.movement_type === 'SALE' ? 'bg-danger' : m.movement_type === 'PURCHASE' ? 'bg-success' : 'bg-dark'}">
              ${m.movement_type}
            </span>
          </td>
          <td class="fw-bold ${m.quantity > 0 ? 'text-success' : 'text-danger'}">
            ${m.quantity > 0 ? '+' : ''}${parseFloat(m.quantity).toFixed(2)} ${m.unit}
          </td>
          <td>${m.reason || m.reference_id || ''}</td>
          <td><small class="text-muted">${m.performed_by_name || 'System'}</small></td>
        </tr>
      `).join('');
    } catch (e) {
      console.warn('Movements load failed', e);
    }
  },

  openAdjustModal(productId, name, unit, currentStock) {
    document.getElementById('adj-prod-id').value = productId;
    document.getElementById('adj-prod-name').innerText = `${name} (Current: ${currentStock} ${unit})`;
    document.getElementById('adj-quantity').value = '';
    document.getElementById('adj-reason').value = '';
    new bootstrap.Modal(document.getElementById('adjustModal')).show();
  },

  async submitAdjustment(e) {
    e.preventDefault();
    const pid = document.getElementById('adj-prod-id').value;
    const type = document.getElementById('adj-type').value;
    const qty = parseFloat(document.getElementById('adj-quantity').value);
    const reason = document.getElementById('adj-reason').value;

    const delta = type === 'RETURN' || type === 'PURCHASE' ? Math.abs(qty) : -Math.abs(qty);

    try {
      await App.api('/api/v1/inventory/adjust', {
        method: 'POST',
        body: {
          product_id: pid,
          quantity_delta: delta,
          movement_type: type,
          reason: reason
        }
      });
      AnimEngine.showToast('Stock adjustment logged successfully.', 'success');
      bootstrap.Modal.getInstance(document.getElementById('adjustModal')).hide();
      this.load();
    } catch (err) {
      console.error(err);
    }
  }
};

// 3. CUSTOMERS MODULE
const CustomersModule = {
  async load() {
    try {
      const res = await App.api('/api/v1/customers');
      const tbody = document.getElementById('customers-table-body');
      if (!tbody) return;

      tbody.innerHTML = (res.customers || []).map(c => `
        <tr>
          <td class="fw-bold">${c.name}</td>
          <td>${c.phone || '-'}</td>
          <td>${c.address || '-'}</td>
          <td class="fw-bold ${c.outstanding_balance > 0 ? 'text-danger' : 'text-success'}">
            ₹${parseFloat(c.outstanding_balance).toFixed(2)}
          </td>
          <td>₹${parseFloat(c.credit_limit).toFixed(2)}</td>
          <td><small class="text-muted">${c.notes || '-'}</small></td>
        </tr>
      `).join('');
    } catch (e) {
      console.error(e);
    }
  },

  openAddModal() {
    document.getElementById('customer-form').reset();
    new bootstrap.Modal(document.getElementById('customerModal')).show();
  },

  async saveCustomer(e) {
    e.preventDefault();
    const payload = {
      name: document.getElementById('cust-name').value.trim(),
      phone: document.getElementById('cust-phone').value.trim(),
      email: document.getElementById('cust-email').value.trim(),
      address: document.getElementById('cust-address').value.trim(),
      credit_limit: parseFloat(document.getElementById('cust-limit').value || 0),
      notes: document.getElementById('cust-notes').value.trim()
    };
    try {
      await App.api('/api/v1/customers', { method: 'POST', body: payload });
      AnimEngine.showToast('Customer record created.', 'success');
      bootstrap.Modal.getInstance(document.getElementById('customerModal')).hide();
      this.load();
    } catch (err) {
      console.error(err);
    }
  }
};

// 4. SUPPLIERS MODULE
const SuppliersModule = {
  async load() {
    try {
      const res = await App.api('/api/v1/suppliers');
      const tbody = document.getElementById('suppliers-table-body');
      if (!tbody) return;

      tbody.innerHTML = (res.suppliers || []).map(s => `
        <tr>
          <td class="fw-bold">${s.name}</td>
          <td>${s.contact_person || '-'}</td>
          <td>${s.phone}</td>
          <td><span class="badge bg-light text-dark border">${s.category || 'Livestock'}</span></td>
          <td class="fw-bold text-danger">₹${parseFloat(s.outstanding_balance).toFixed(2)}</td>
          <td>${s.address || '-'}</td>
        </tr>
      `).join('');
    } catch (e) {
      console.error(e);
    }
  },

  openAddModal() {
    document.getElementById('supplier-form').reset();
    new bootstrap.Modal(document.getElementById('supplierModal')).show();
  },

  async saveSupplier(e) {
    e.preventDefault();
    const payload = {
      name: document.getElementById('sup-name').value.trim(),
      contact_person: document.getElementById('sup-contact').value.trim(),
      phone: document.getElementById('sup-phone').value.trim(),
      email: document.getElementById('sup-email').value.trim(),
      category: document.getElementById('sup-category').value,
      address: document.getElementById('sup-address').value.trim()
    };
    try {
      await App.api('/api/v1/suppliers', { method: 'POST', body: payload });
      AnimEngine.showToast('Supplier record created.', 'success');
      bootstrap.Modal.getInstance(document.getElementById('supplierModal')).hide();
      this.load();
    } catch (err) {
      console.error(err);
    }
  }
};

// 5. PURCHASES MODULE
const PurchasesModule = {
  async load() {
    try {
      const res = await App.api('/api/v1/purchases');
      const tbody = document.getElementById('purchases-table-body');
      if (!tbody) return;

      tbody.innerHTML = (res.purchases || []).map(p => `
        <tr>
          <td class="fw-bold text-danger">${p.purchase_no}</td>
          <td>${p.supplier_name}</td>
          <td>${new Date(p.purchase_date).toLocaleDateString()}</td>
          <td><span class="badge bg-success">${p.status}</span></td>
          <td class="fw-bold">₹${parseFloat(p.total_amount).toFixed(2)}</td>
          <td>₹${parseFloat(p.paid_amount).toFixed(2)}</td>
          <td>
            <small class="text-muted">
              ${(p.items || []).map(i => `${i.product_name} (${i.quantity} ${i.unit})`).join(', ')}
            </small>
          </td>
        </tr>
      `).join('');
    } catch (e) {
      console.error(e);
    }
  },

  async openAddModal() {
    const [sups, prods] = await Promise.all([
      App.api('/api/v1/suppliers'),
      App.api('/api/v1/products')
    ]);

    const supSelect = document.getElementById('po-supplier-select');
    supSelect.innerHTML = (sups.suppliers || []).map(s => `<option value="${s.id}">${s.name}</option>`).join('');

    const prodSelect = document.getElementById('po-prod-select');
    prodSelect.innerHTML = (prods.products || []).map(p => `<option value="${p.id}" data-cost="${p.cost_price || 0}">${p.name} (${p.unit})</option>`).join('');

    new bootstrap.Modal(document.getElementById('purchaseModal')).show();
  },

  async submitPurchase(e) {
    e.preventDefault();
    const supId = document.getElementById('po-supplier-select').value;
    const prodId = document.getElementById('po-prod-select').value;
    const qty = parseFloat(document.getElementById('po-qty').value);
    const unitCost = parseFloat(document.getElementById('po-cost').value);
    const paid = parseFloat(document.getElementById('po-paid').value || 0);

    const payload = {
      supplier_id: supId,
      paid_amount: paid,
      items: [{
        product_id: prodId,
        quantity: qty,
        unit_cost: unitCost,
        total_cost: qty * unitCost
      }]
    };

    try {
      await App.api('/api/v1/purchases', { method: 'POST', body: payload });
      AnimEngine.showToast('Inbound meat delivery recorded and stock incremented!', 'success');
      bootstrap.Modal.getInstance(document.getElementById('purchaseModal')).hide();
      this.load();
    } catch (err) {
      console.error(err);
    }
  }
};

// 6. EXPENSES MODULE
const ExpensesModule = {
  async load() {
    try {
      const res = await App.api('/api/v1/expenses');
      const tbody = document.getElementById('expenses-table-body');
      if (!tbody) return;

      tbody.innerHTML = (res.expenses || []).map(exp => `
        <tr>
          <td>${new Date(exp.expense_date).toLocaleDateString()}</td>
          <td><span class="badge bg-light text-dark border">${exp.category}</span></td>
          <td class="fw-bold">${exp.title}</td>
          <td class="fw-bold text-danger">₹${parseFloat(exp.amount).toFixed(2)}</td>
          <td><span class="badge bg-secondary-subtle text-secondary">${exp.payment_method}</span></td>
          <td><small class="text-muted">${exp.notes || '-'}</small></td>
        </tr>
      `).join('');

      document.getElementById('total-expenses-display').innerText = `₹${parseFloat(res.total_amount || 0).toFixed(2)}`;
    } catch (e) {
      console.error(e);
    }
  },

  openAddModal() {
    document.getElementById('expense-form').reset();
    new bootstrap.Modal(document.getElementById('expenseModal')).show();
  },

  async saveExpense(e) {
    e.preventDefault();
    const payload = {
      title: document.getElementById('exp-title').value.trim(),
      category: document.getElementById('exp-category').value,
      amount: parseFloat(document.getElementById('exp-amount').value),
      payment_method: document.getElementById('exp-method').value,
      expense_date: document.getElementById('exp-date').value || new Date().toISOString().split('T')[0],
      notes: document.getElementById('exp-notes').value.trim()
    };
    try {
      await App.api('/api/v1/expenses', { method: 'POST', body: payload });
      AnimEngine.showToast('Shop operational expense recorded.', 'success');
      bootstrap.Modal.getInstance(document.getElementById('expenseModal')).hide();
      this.load();
    } catch (err) {
      console.error(err);
    }
  }
};

// 7. REPORTS & ANALYTICS MODULE
const ReportsModule = {
  async load() {
    const startDate = document.getElementById('rep-start-date').value;
    const endDate = document.getElementById('rep-end-date').value;

    let query = '';
    if (startDate) query += `start_date=${startDate}&`;
    if (endDate) query += `end_date=${endDate}`;

    try {
      const [pnl, prodSales, empSales] = await Promise.all([
        App.api(`/api/v1/reports/pnl?${query}`),
        App.api(`/api/v1/reports/products?${query}`),
        App.api(`/api/v1/reports/employees?${query}`)
      ]);

      document.getElementById('pnl-gross-sales').innerText = `₹${pnl.gross_sales.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
      document.getElementById('pnl-discounts').innerText = `- ₹${pnl.total_discounts.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
      document.getElementById('pnl-tax').innerText = `₹${pnl.total_tax.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
      document.getElementById('pnl-net-revenue').innerText = `₹${pnl.net_sales_revenue.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
      document.getElementById('pnl-cogs').innerText = `- ₹${pnl.cogs.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
      document.getElementById('pnl-gross-profit').innerText = `₹${pnl.gross_profit.toLocaleString(undefined, {minimumFractionDigits: 2})} (${pnl.gross_margin_pct}%)`;
      document.getElementById('pnl-wastage').innerText = `- ₹${pnl.total_wastage_loss.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
      document.getElementById('pnl-expenses').innerText = `- ₹${pnl.total_expenses.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
      
      const netProfitEl = document.getElementById('pnl-net-result');
      netProfitEl.innerText = `₹${pnl.net_operating_result.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
      netProfitEl.className = `fw-bold fs-4 ${pnl.net_operating_result >= 0 ? 'text-success' : 'text-danger'}`;

      const prodBody = document.getElementById('rep-products-body');
      prodBody.innerHTML = (prodSales.product_sales || []).map(p => `
        <tr>
          <td class="fw-bold">${p.product_name}</td>
          <td><span class="badge bg-light text-dark border">${p.category}</span></td>
          <td>${parseFloat(p.total_quantity).toFixed(2)} ${p.unit}</td>
          <td class="fw-bold">₹${parseFloat(p.total_revenue).toFixed(2)}</td>
          <td class="text-success fw-bold">₹${parseFloat(p.gross_profit).toFixed(2)}</td>
          <td><span class="badge bg-success-subtle text-success">${p.margin_pct}%</span></td>
        </tr>
      `).join('');

      const empBody = document.getElementById('rep-employees-body');
      empBody.innerHTML = (empSales.employee_sales || []).map(e => `
        <tr>
          <td class="fw-bold">${e.cashier_name}</td>
          <td><span class="badge bg-danger-subtle text-danger fw-bold">${e.total_bills} bills</span></td>
          <td class="fw-bold text-dark">₹${parseFloat(e.total_revenue).toFixed(2)}</td>
          <td>₹${parseFloat(e.avg_bill_value).toFixed(2)}</td>
        </tr>
      `).join('');

    } catch (e) {
      console.error('Reports load error:', e);
    }
  },

  exportReport(format, type = 'sales') {
    const token = App.token;
    const url = `/api/v1/reports/export/${format}?type=${type}&token=${token}`;
    window.open(url, '_blank');
    AnimEngine.showToast(`Downloading ${type.toUpperCase()} report in ${format.toUpperCase()}...`, 'info');
  }
};

// 8. USERS MODULE (ADMIN ONLY)
const UsersModule = {
  async load() {
    try {
      const res = await App.api('/api/v1/auth/users');
      const tbody = document.getElementById('users-table-body');
      if (!tbody) return;

      tbody.innerHTML = (res.users || []).map(u => `
        <tr>
          <td class="fw-bold">${u.full_name}</td>
          <td>${u.email}</td>
          <td>${u.phone || '-'}</td>
          <td>
            <span class="user-role-badge role-${u.role}">${u.role}</span>
          </td>
          <td>
            <span class="badge ${u.is_active ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'}">
              ${u.is_active ? 'Active' : 'Disabled'}
            </span>
          </td>
          <td class="text-end">
            <button class="btn btn-sm ${u.is_active ? 'btn-outline-danger' : 'btn-outline-success'}"
                    onclick="UsersModule.toggleActive('${u.id}', ${!u.is_active})">
              ${u.is_active ? 'Deactivate' : 'Reactivate'}
            </button>
          </td>
        </tr>
      `).join('');
    } catch (e) {
      console.error(e);
    }
  },

  openAddModal() {
    document.getElementById('user-form').reset();
    new bootstrap.Modal(document.getElementById('userModal')).show();
  },

  async saveUser(e) {
    e.preventDefault();
    const payload = {
      full_name: document.getElementById('new-user-name').value.trim(),
      email: document.getElementById('new-user-email').value.trim(),
      phone: document.getElementById('new-user-phone').value.trim(),
      role: document.getElementById('new-user-role').value,
      password: document.getElementById('new-user-pwd').value
    };
    try {
      await App.api('/api/v1/auth/users', { method: 'POST', body: payload });
      AnimEngine.showToast('Staff member account created.', 'success');
      bootstrap.Modal.getInstance(document.getElementById('userModal')).hide();
      this.load();
    } catch (err) {
      console.error(err);
    }
  },

  async toggleActive(userId, newStatus) {
    try {
      await App.api(`/api/v1/auth/users/${userId}`, {
        method: 'PUT',
        body: { is_active: newStatus }
      });
      AnimEngine.showToast('Staff account status updated.', 'success');
      this.load();
    } catch (e) {
      console.error(e);
    }
  }
};

// 9. SETTINGS MODULE
const SettingsModule = {
  async load() {
    try {
      const res = await App.api('/api/v1/settings');
      const s = res.settings || {};
      document.getElementById('set-shop-name').value = s.shop_name || '';
      document.getElementById('set-tagline').value = s.shop_tagline || '';
      document.getElementById('set-phone').value = s.shop_phone || '';
      document.getElementById('set-email').value = s.shop_email || '';
      document.getElementById('set-address').value = s.shop_address || '';
      document.getElementById('set-gstin').value = s.gstin_tax_id || '';
      document.getElementById('set-currency').value = s.currency_symbol || '₹';
      document.getElementById('set-tax-rate').value = s.default_tax_rate || '5.0';
      document.getElementById('set-receipt-footer').value = s.receipt_footer_note || '';
    } catch (e) {
      console.error(e);
    }
  },

  async save(e) {
    e.preventDefault();
    const payload = {
      shop_name: document.getElementById('set-shop-name').value.trim(),
      shop_tagline: document.getElementById('set-tagline').value.trim(),
      shop_phone: document.getElementById('set-phone').value.trim(),
      shop_email: document.getElementById('set-email').value.trim(),
      shop_address: document.getElementById('set-address').value.trim(),
      gstin_tax_id: document.getElementById('set-gstin').value.trim(),
      currency_symbol: document.getElementById('set-currency').value.trim(),
      default_tax_rate: document.getElementById('set-tax-rate').value.trim(),
      receipt_footer_note: document.getElementById('set-receipt-footer').value.trim()
    };
    try {
      await App.api('/api/v1/settings', { method: 'POST', body: payload });
      AnimEngine.showToast('Store settings saved successfully.', 'success');
      App.fetchSettings();
    } catch (err) {
      console.error(err);
    }
  }
};

// 10. AUDIT LOGS MODULE
const AuditModule = {
  async load() {
    try {
      const res = await App.api('/api/v1/audit?limit=50');
      const tbody = document.getElementById('audit-table-body');
      if (!tbody) return;

      tbody.innerHTML = (res.audit_logs || []).map(log => `
        <tr>
          <td><small class="text-muted">${new Date(log.created_at).toLocaleString()}</small></td>
          <td class="fw-bold">${log.user_name}</td>
          <td><span class="badge bg-secondary">${log.action}</span></td>
          <td><span class="badge bg-light text-dark border">${log.entity}</span></td>
          <td><small class="font-monospace text-muted">${log.details || ''}</small></td>
          <td><small class="text-muted">${log.ip_address || '127.0.0.1'}</small></td>
        </tr>
      `).join('');
    } catch (e) {
      console.error(e);
    }
  }
};
