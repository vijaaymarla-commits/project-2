/* ==========================================================
   FRESH CUT MEAT SHOP - APP SHELL & CLIENT ROUTER
   ========================================================== */

const App = {
  token: localStorage.getItem('fresh_token') || null,
  user: JSON.parse(localStorage.getItem('fresh_user') || 'null'),
  settings: {},
  currentView: 'dashboard',

  async init() {
    // Check if authenticated
    if (!this.token || !this.user) {
      await this.loginAs('admin@freshcuts.com', 'admin123', true);
    } else {
      this.updateUserUI();
    }

    await this.fetchSettings();
    this.setupNavigation();
    this.switchView('dashboard');
    this.startClock();
  },

  async api(endpoint, options = {}) {
    const headers = options.headers || {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }
    options.headers = headers;

    try {
      const response = await fetch(endpoint, options);
      if (response.status === 401) {
        AnimEngine.showToast('Session expired. Switching to admin demo session...', 'warning');
        await this.loginAs('admin@freshcuts.com', 'admin123');
        return this.api(endpoint, options);
      }
      if (response.status === 403) {
        const err = await response.json();
        AnimEngine.showToast(err.error || 'Access denied. Administrator privileges required.', 'error');
        throw new Error(err.error);
      }
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Request failed.' }));
        AnimEngine.showToast(err.error || 'An error occurred.', 'error');
        throw new Error(err.error);
      }
      return await response.json();
    } catch (e) {
      console.error('[API Error]', e);
      throw e;
    }
  },

  async loginAs(email, password, silent = false) {
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      this.token = data.token;
      this.user = data.user;
      localStorage.setItem('fresh_token', this.token);
      localStorage.setItem('fresh_user', JSON.stringify(this.user));

      this.updateUserUI();
      if (!silent) {
        AnimEngine.showToast(`Logged in as ${this.user.full_name} (${this.user.role.toUpperCase()})`, 'success');
      }
      this.switchView(this.currentView || 'dashboard');
    } catch (err) {
      console.error('Login error:', err);
      if (!silent) AnimEngine.showToast(err.message, 'error');
    }
  },

  logout() {
    this.token = null;
    this.user = null;
    localStorage.removeItem('fresh_token');
    localStorage.removeItem('fresh_user');
    AnimEngine.showToast('Logged out. Reconnecting default demo account...', 'warning');
    setTimeout(() => this.loginAs('admin@freshcuts.com', 'admin123'), 800);
  },

  async fetchSettings() {
    try {
      const res = await this.api('/api/v1/settings');
      this.settings = res.settings || {};
      document.querySelectorAll('.store-name-text').forEach(el => el.innerText = this.settings.shop_name || 'Fresh Cut Meat Shop');
    } catch (e) {
      console.warn('Failed to load settings', e);
    }
  },

  updateUserUI() {
    if (!this.user) return;
    const nameEl = document.getElementById('sidebar-user-name');
    const roleBadge = document.getElementById('sidebar-user-role');
    const avatarEl = document.getElementById('sidebar-user-avatar');

    if (nameEl) nameEl.innerText = this.user.full_name;
    if (avatarEl) avatarEl.innerText = this.user.full_name.charAt(0);
    if (roleBadge) {
      roleBadge.innerText = this.user.role;
      roleBadge.className = `user-role-badge role-${this.user.role}`;
    }

    // Role-based visibility enforcement
    const isAdmin = this.user.role === 'admin';
    document.querySelectorAll('.admin-only').forEach(el => {
      el.style.display = isAdmin ? '' : 'none';
    });

    const demoBtn = document.getElementById('role-toggle-btn');
    if (demoBtn) {
      demoBtn.innerHTML = isAdmin
        ? '<i class="bi bi-person-badge"></i> Switch to Employee (POS View)'
        : '<i class="bi bi-shield-lock"></i> Switch to Admin (Full Control)';
    }
  },

  toggleDemoRole() {
    if (this.user.role === 'admin') {
      this.loginAs('emp1@freshcuts.com', 'emp123');
    } else {
      this.loginAs('admin@freshcuts.com', 'admin123');
    }
  },

  setupNavigation() {
    document.querySelectorAll('.nav-link[data-view]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const view = link.getAttribute('data-view');
        this.switchView(view);
        // Mobile sidebar close
        const sidebar = document.querySelector('.app-sidebar');
        if (sidebar && sidebar.classList.contains('show-mobile')) {
          sidebar.classList.remove('show-mobile');
        }
      });
    });

    const mobileBtn = document.getElementById('mobile-menu-toggle');
    if (mobileBtn) {
      mobileBtn.onclick = () => {
        document.querySelector('.app-sidebar').classList.toggle('show-mobile');
      };
    }
  },

  switchView(viewName) {
    this.currentView = viewName;
    document.querySelectorAll('.nav-link[data-view]').forEach(l => {
      if (l.getAttribute('data-view') === viewName) {
        l.classList.add('active');
      } else {
        l.classList.remove('active');
      }
    });

    // Hide all view containers
    document.querySelectorAll('.view-container').forEach(c => c.style.display = 'none');

    // Show target view container
    const target = document.getElementById(`view-${viewName}`);
    if (target) {
      target.style.display = 'block';
      target.classList.remove('view-animate-fade');
      void target.offsetWidth; // trigger reflow
      target.classList.add('view-animate-fade');
    }

    // Update header title
    const headerTitle = document.getElementById('page-header-title');
    const headerDesc = document.getElementById('page-header-desc');
    const titles = {
      'dashboard': { title: 'Executive Dashboard', desc: 'Real-time sales, inventory alerts and financial analytics' },
      'pos': { title: 'Point of Sale (POS)', desc: 'High-speed touch billing, weighing scale & digital receipts' },
      'products': { title: 'Products & Cuts Catalog', desc: 'Manage fresh meat cuts, pricing rules and stock thresholds' },
      'inventory': { title: 'Inventory & Wastage Control', desc: 'Track shelf stock, trimming losses and spoilage records' },
      'customers': { title: 'Customer Ledger', desc: 'Retail and wholesale accounts with credit management' },
      'suppliers': { title: 'Supplier Directory', desc: 'Livestock breeders, poultry farms and seafood logistics' },
      'purchases': { title: 'Purchase Orders & Inbound', desc: 'Receive stock shipments and record supplier invoices' },
      'expenses': { title: 'Shop Expense Logger', desc: 'Track electricity, rent, cold-storage and operations' },
      'reports': { title: 'Reports & P&L Analytics', desc: 'Pandas financial statements, COGS analysis and file exports' },
      'users': { title: 'Employee Accounts', desc: 'Role permissions and staff access administration' },
      'settings': { title: 'Store Settings', desc: 'GSTIN, currency, tax rates and thermal receipt templates' },
      'audit': { title: 'Security & Audit Trail', desc: 'Immutable log of system events, logins and transaction edits' }
    };

    if (titles[viewName]) {
      if (headerTitle) headerTitle.innerText = titles[viewName].title;
      if (headerDesc) headerDesc.innerText = titles[viewName].desc;
    }

    // Trigger view-specific data loader
    if (viewName === 'dashboard') DashboardModule.load();
    else if (viewName === 'pos') POSModule.load();
    else if (viewName === 'products') ProductsModule.load();
    else if (viewName === 'inventory') InventoryModule.load();
    else if (viewName === 'customers') CustomersModule.load();
    else if (viewName === 'suppliers') SuppliersModule.load();
    else if (viewName === 'purchases') PurchasesModule.load();
    else if (viewName === 'expenses') ExpensesModule.load();
    else if (viewName === 'reports') ReportsModule.load();
    else if (viewName === 'users') UsersModule.load();
    else if (viewName === 'settings') SettingsModule.load();
    else if (viewName === 'audit') AuditModule.load();
  },

  startClock() {
    const clockEl = document.getElementById('live-clock');
    if (!clockEl) return;
    const update = () => {
      const now = new Date();
      clockEl.innerText = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };
    update();
    setInterval(update, 1000);
  }
};

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
