/* ==========================================================
   FRESH CUT MEAT SHOP - APP CONTROLLER
   With Separate Admin & Staff Sign-In Portals
   ========================================================== */

const App = {
  token: localStorage.getItem('fresh_token') || null,
  user: JSON.parse(localStorage.getItem('fresh_user') || 'null'),
  settings: {},
  currentView: 'dashboard',
  selectedLoginRole: 'admin', // 'admin' or 'employee'

  async init() {
    await this.fetchSettings();

    // Check if valid token exists
    if (this.token && this.user) {
      this.showAppScreen();
      this.updateUserUI();
      this.switchView('dashboard');
    } else {
      this.showAuthScreen('admin');
    }

    this.setupNavigation();
    this.startClock();
  },

  showAuthScreen(role = 'admin') {
    this.selectedLoginRole = role;
    const authContainer = document.getElementById('auth-screen-container');
    const appContainer = document.getElementById('app-container');

    if (authContainer) authContainer.style.display = 'flex';
    if (appContainer) appContainer.style.display = 'none';

    this.setAuthPortalTab(role);
  },

  showAppScreen() {
    const authContainer = document.getElementById('auth-screen-container');
    const appContainer = document.getElementById('app-container');

    if (authContainer) authContainer.style.display = 'none';
    if (appContainer) appContainer.style.display = 'flex';
  },

  setAuthPortalTab(role) {
    this.selectedLoginRole = role;

    const adminTab = document.getElementById('tab-admin-portal');
    const staffTab = document.getElementById('tab-staff-portal');
    const roleTitle = document.getElementById('auth-role-title');
    const roleDesc = document.getElementById('auth-role-desc');
    const emailInput = document.getElementById('auth-email-input');
    const pwdInput = document.getElementById('auth-pwd-input');
    const iconHeader = document.getElementById('auth-role-icon');

    if (role === 'admin') {
      if (adminTab) adminTab.classList.add('active');
      if (staffTab) staffTab.classList.remove('active');
      if (roleTitle) roleTitle.innerText = '🛡️ Owner & Administrator Portal';
      if (roleDesc) roleDesc.innerText = 'Access executive P&L, shop expenses, staff administration, and settings';
      if (emailInput) emailInput.value = 'admin@freshcuts.com';
      if (pwdInput) pwdInput.value = 'admin123';
      if (iconHeader) iconHeader.className = 'bi bi-shield-lock-fill text-danger fs-2 mb-2';
    } else {
      if (staffTab) staffTab.classList.add('active');
      if (adminTab) adminTab.classList.remove('active');
      if (roleTitle) roleTitle.innerText = '👨‍🍳 Staff & Cashier Terminal';
      if (roleDesc) roleDesc.innerText = 'Access high-speed POS billing, digital receipts, and shelf stock';
      if (emailInput) emailInput.value = 'emp1@freshcuts.com';
      if (pwdInput) pwdInput.value = 'emp123';
      if (iconHeader) iconHeader.className = 'bi bi-receipt-cutoff text-success fs-2 mb-2';
    }
  },

  async handleLoginFormSubmit(e) {
    e.preventDefault();
    const email = document.getElementById('auth-email-input').value.trim();
    const password = document.getElementById('auth-pwd-input').value;
    const loginBtn = document.getElementById('auth-submit-btn');

    if (loginBtn) {
      loginBtn.disabled = true;
      loginBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Authenticating...';
    }

    try {
      await this.login(email, password);
    } finally {
      if (loginBtn) {
        loginBtn.disabled = false;
        loginBtn.innerHTML = '<i class="bi bi-box-arrow-in-right me-2"></i> Sign In to Terminal';
      }
    }
  },

  async login(email, password, silent = false) {
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

      this.showAppScreen();
      this.updateUserUI();

      if (!silent) {
        AnimEngine.showToast(`Welcome ${this.user.full_name} (${this.user.role.toUpperCase()})`, 'success');
      }

      this.switchView('dashboard');
    } catch (err) {
      console.error('Login error:', err);
      AnimEngine.showToast(err.message, 'error');
    }
  },

  logout() {
    this.token = null;
    this.user = null;
    localStorage.removeItem('fresh_token');
    localStorage.removeItem('fresh_user');
    AnimEngine.showToast('You have been signed out.', 'info');
    this.showAuthScreen(this.selectedLoginRole || 'admin');
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
        AnimEngine.showToast('Session expired. Please sign in again.', 'warning');
        this.logout();
        throw new Error('Unauthorized');
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

  async fetchSettings() {
    try {
      const res = await fetch('/api/v1/settings', {
        headers: this.token ? { 'Authorization': `Bearer ${this.token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        this.settings = data.settings || {};
        document.querySelectorAll('.store-name-text').forEach(el => el.innerText = this.settings.shop_name || 'Fresh Cut Meat Shop');
      }
    } catch (e) {
      console.warn('Settings load warning', e);
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

    // Role-based visibility
    const isAdmin = this.user.role === 'admin';
    document.querySelectorAll('.admin-only').forEach(el => {
      el.style.display = isAdmin ? '' : 'none';
    });

    const demoBtn = document.getElementById('role-toggle-btn');
    if (demoBtn) {
      demoBtn.innerHTML = isAdmin
        ? '<i class="bi bi-person-badge"></i> Switch to Cashier'
        : '<i class="bi bi-shield-lock"></i> Switch to Owner';
    }
  },

  toggleDemoRole() {
    if (this.user.role === 'admin') {
      this.login('emp1@freshcuts.com', 'emp123');
    } else {
      this.login('admin@freshcuts.com', 'admin123');
    }
  },

  setupNavigation() {
    document.querySelectorAll('.nav-link[data-view]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const view = link.getAttribute('data-view');
        this.switchView(view);
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

    document.querySelectorAll('.view-container').forEach(c => c.style.display = 'none');

    const target = document.getElementById(`view-${viewName}`);
    if (target) {
      target.style.display = 'block';
      target.classList.remove('view-animate-fade');
      void target.offsetWidth;
      target.classList.add('view-animate-fade');
    }

    const headerTitle = document.getElementById('page-header-title');
    const headerDesc = document.getElementById('page-header-desc');
    const titles = {
      'dashboard': { title: 'Executive Butchery Dashboard', desc: 'Real-time sales, meat inventory balances and profit analytics' },
      'pos': { title: 'Fresh Cut POS Billing', desc: 'High-speed touch billing, weighing scale & digital receipts' },
      'products': { title: 'Meat Cuts & Pricing Catalog', desc: 'Manage poultry, mutton, seafood, beef cuts and price rules' },
      'inventory': { title: 'Inventory & Trimming Wastage', desc: 'Track shelf stock, bone/fat trimming losses and spoilage' },
      'customers': { title: 'Customer Credit Ledger', desc: 'Retail and wholesale accounts with credit management' },
      'suppliers': { title: 'Suppliers & Livestock Farms', desc: 'Livestock breeders, poultry hatcheries and seafood logistics' },
      'purchases': { title: 'Inbound Stock Purchases', desc: 'Receive stock shipments and record supplier invoices' },
      'expenses': { title: 'Shop Operational Expenses', desc: 'Track electricity, walk-in chiller, rent and packaging' },
      'reports': { title: 'Reports & P&L Analytics', desc: 'Pandas financial statements, COGS analysis and file exports' },
      'users': { title: 'Staff & Cashier Accounts', desc: 'Role permissions and staff access administration' },
      'settings': { title: 'Store Settings & Tax', desc: 'GSTIN, currency, tax rates and thermal receipt templates' },
      'audit': { title: 'Security & Audit Trail', desc: 'Immutable log of system events, logins and transaction edits' }
    };

    if (titles[viewName]) {
      if (headerTitle) headerTitle.innerText = titles[viewName].title;
      if (headerDesc) headerDesc.innerText = titles[viewName].desc;
    }

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
