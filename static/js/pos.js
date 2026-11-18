/* ==========================================================
   FRESH CUT MEAT SHOP - POS BILLING MODULE
   ========================================================== */

const POSModule = {
  products: [],
  cart: [],
  selectedCategory: 'All',
  selectedCustomer: null,
  paymentMethod: 'Cash',
  taxRate: 5.0,
  discount: 0.0,

  async load() {
    await this.fetchProducts();
    await this.fetchCustomers();
    this.renderCategoryBar();
    this.renderProducts();
    this.renderCart();
  },

  async fetchProducts() {
    try {
      const res = await App.api('/api/v1/products?active_only=true');
      this.products = res.products || [];
    } catch (e) {
      console.error('Error loading products for POS:', e);
    }
  },

  async fetchCustomers() {
    try {
      const res = await App.api('/api/v1/customers');
      const select = document.getElementById('pos-customer-select');
      if (select) {
        select.innerHTML = '<option value="">Walk-in Retail Customer</option>' +
          (res.customers || []).map(c => `
            <option value="${c.id}">${c.name} (${c.phone || 'No phone'}) - Due: ₹${parseFloat(c.outstanding_balance).toFixed(2)}</option>
          `).join('');
      }
    } catch (e) {
      console.warn('Customer load failed', e);
    }
  },

  renderCategoryBar() {
    const cats = ['All', 'Chicken', 'Mutton', 'Seafood', 'Beef', 'Cold Cuts & Marinades'];
    const bar = document.getElementById('pos-category-bar');
    if (!bar) return;

    bar.innerHTML = cats.map(cat => `
      <button class="pos-cat-pill ${this.selectedCategory === cat ? 'active' : ''}" onclick="POSModule.selectCategory('${cat}')">
        ${this.getCategoryIcon(cat)} ${cat}
      </button>
    `).join('');
  },

  getCategoryIcon(cat) {
    switch (cat) {
      case 'Chicken': return '<i class="bi bi-egg-fried"></i>';
      case 'Mutton': return '<i class="bi bi-shield-shaded"></i>';
      case 'Seafood': return '<i class="bi bi-water"></i>';
      case 'Beef': return '<i class="bi bi-fire"></i>';
      case 'Cold Cuts & Marinades': return '<i class="bi bi-box2-heart"></i>';
      default: return '<i class="bi bi-grid-fill"></i>';
    }
  },

  selectCategory(cat) {
    this.selectedCategory = cat;
    this.renderCategoryBar();
    this.renderProducts();
  },

  filterProducts(query) {
    this.renderProducts(query);
  },

  renderProducts(filterQuery = '') {
    const grid = document.getElementById('pos-product-grid');
    if (!grid) return;

    let items = this.products;
    if (this.selectedCategory !== 'All') {
      items = items.filter(p => p.category === this.selectedCategory);
    }
    if (filterQuery) {
      const q = filterQuery.toLowerCase();
      items = items.filter(p => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q));
    }

    if (items.length === 0) {
      grid.innerHTML = '<div class="col-12 text-center py-5 text-muted">No meat cuts found matching your search.</div>';
      return;
    }

    grid.innerHTML = items.map(p => `
      <div class="pos-item-card" onclick="POSModule.addToCart('${p.id}', event)">
        <div>
          <div class="pos-card-cat">${p.category}</div>
          <div class="pos-card-name">${p.name}</div>
        </div>
        <div class="pos-card-footer">
          <div>
            <div class="pos-card-price">₹${parseFloat(p.selling_price).toFixed(2)}</div>
            <div class="pos-card-unit">per ${p.unit}</div>
          </div>
          <div>
            <span class="pos-card-stock ${p.current_stock <= p.min_stock ? 'stock-low' : 'stock-in'}">
              ${parseFloat(p.current_stock).toFixed(1)} ${p.unit}
            </span>
          </div>
        </div>
      </div>
    `).join('');
  },

  addToCart(productId, event = null) {
    const prod = this.products.find(p => p.id === productId);
    if (!prod) return;

    if (prod.current_stock <= 0) {
      AnimEngine.showToast(`Warning: '${prod.name}' is currently out of stock.`, 'warning');
    }

    const existing = this.cart.find(item => item.product_id === productId);
    if (existing) {
      existing.quantity = Math.round((existing.quantity + (prod.unit === 'kg' ? 0.5 : 1)) * 100) / 100;
    } else {
      this.cart.push({
        product_id: prod.id,
        name: prod.name,
        unit: prod.unit,
        price: parseFloat(prod.selling_price),
        quantity: prod.unit === 'kg' ? 1.0 : 1
      });
    }

    // Fly animation to cart
    if (event && event.currentTarget) {
      const targetCartBadge = document.getElementById('pos-cart-count');
      AnimEngine.flyToCart(event.currentTarget, targetCartBadge);
    }

    this.renderCart();
  },

  updateQuantity(productId, newQty) {
    const item = this.cart.find(i => i.product_id === productId);
    if (!item) return;

    newQty = parseFloat(newQty);
    if (isNaN(newQty) || newQty <= 0) {
      this.removeFromCart(productId);
      return;
    }

    if (item.unit in ('pcs', 'pack')) {
      newQty = Math.round(newQty);
    }
    item.quantity = newQty;
    this.renderCart();
  },

  setPresetWeight(productId, weight) {
    this.updateQuantity(productId, weight);
  },

  removeFromCart(productId) {
    this.cart = this.cart.filter(item => item.product_id !== productId);
    this.renderCart();
  },

  clearCart() {
    this.cart = [];
    this.discount = 0.0;
    this.renderCart();
  },

  setPaymentMethod(method) {
    this.paymentMethod = method;
    document.querySelectorAll('.pay-tab').forEach(tab => {
      if (tab.getAttribute('data-method') === method) tab.classList.add('active');
      else tab.classList.remove('active');
    });

    // Show dynamic UPI QR code generator modal if UPI chosen
    const upiBadge = document.getElementById('pos-upi-preview');
    if (upiBadge) {
      upiBadge.style.display = method === 'UPI' ? 'block' : 'none';
    }
  },

  renderCart() {
    const container = document.getElementById('pos-cart-items');
    const badge = document.getElementById('pos-cart-count');
    if (badge) badge.innerText = this.cart.length;

    if (!container) return;

    if (this.cart.length === 0) {
      container.innerHTML = `
        <div class="text-center py-5 text-muted">
          <i class="bi bi-cart3 fs-1 d-block mb-2 text-slate-300"></i>
          <p class="mb-0" style="font-size: 0.88rem;">Cart is empty.</p>
          <small class="text-muted">Tap any meat cut on the left to add.</small>
        </div>
      `;
      this.updateSummary(0);
      return;
    }

    let subtotal = 0;
    container.innerHTML = this.cart.map(item => {
      const lineTotal = item.quantity * item.price;
      subtotal += lineTotal;
      const isKg = item.unit === 'kg';

      return `
        <div class="cart-item-row">
          <div class="cart-item-top">
            <div class="cart-item-name">${item.name}</div>
            <button class="cart-item-del-btn" onclick="POSModule.removeFromCart('${item.product_id}')">
              <i class="bi bi-trash3"></i>
            </button>
          </div>
          <div class="cart-item-controls">
            <div class="qty-stepper">
              <button class="stepper-btn" onclick="POSModule.updateQuantity('${item.product_id}', ${item.quantity - (isKg ? 0.25 : 1)})">-</button>
              <input type="number" step="${isKg ? '0.05' : '1'}" min="0" class="stepper-val-input" value="${item.quantity}"
                     onchange="POSModule.updateQuantity('${item.product_id}', this.value)">
              <button class="stepper-btn" onclick="POSModule.updateQuantity('${item.product_id}', ${item.quantity + (isKg ? 0.25 : 1)})">+</button>
            </div>
            <div class="text-end">
              <div class="cart-item-total">₹${lineTotal.toFixed(2)}</div>
              <small class="text-muted" style="font-size: 0.72rem;">@ ₹${item.price}/${item.unit}</small>
            </div>
          </div>
          ${isKg ? `
            <div class="weight-shortcuts">
              <button class="w-btn" onclick="POSModule.setPresetWeight('${item.product_id}', 0.25)">250g</button>
              <button class="w-btn" onclick="POSModule.setPresetWeight('${item.product_id}', 0.5)">500g</button>
              <button class="w-btn" onclick="POSModule.setPresetWeight('${item.product_id}', 0.75)">750g</button>
              <button class="w-btn" onclick="POSModule.setPresetWeight('${item.product_id}', 1.0)">1 kg</button>
              <button class="w-btn" onclick="POSModule.setPresetWeight('${item.product_id}', 2.0)">2 kg</button>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    this.updateSummary(subtotal);
  },

  updateSummary(subtotal) {
    const discountEl = document.getElementById('pos-discount-input');
    const discount = discountEl ? parseFloat(discountEl.value || 0) : 0;
    this.discount = discount;

    const discounted = Math.max(0, subtotal - discount);
    const taxRate = this.taxRate;
    const tax = discounted * (taxRate / 100.0);
    const total = discounted + tax;

    document.getElementById('pos-subtotal').innerText = `₹${subtotal.toFixed(2)}`;
    document.getElementById('pos-tax').innerText = `₹${tax.toFixed(2)}`;
    document.getElementById('pos-total').innerText = `₹${total.toFixed(2)}`;

    // Update UPI dynamic QR code amount if visible
    const upiAmt = document.getElementById('pos-upi-amount');
    if (upiAmt) upiAmt.innerText = `₹${total.toFixed(2)}`;
  },

  async processCheckout() {
    if (this.cart.length === 0) {
      AnimEngine.showToast('Please add products to cart before checkout.', 'warning');
      return;
    }

    const customerSelect = document.getElementById('pos-customer-select');
    const customerId = customerSelect ? customerSelect.value : null;
    const notesInput = document.getElementById('pos-bill-notes');
    const notes = notesInput ? notesInput.value : '';

    const payload = {
      customer_id: customerId || null,
      payment_method: this.paymentMethod,
      discount_amount: this.discount,
      tax_rate: this.taxRate,
      notes: notes,
      items: this.cart.map(i => ({
        product_id: i.product_id,
        quantity: i.quantity,
        unit_price: i.price
      }))
    };

    const checkoutBtn = document.getElementById('pos-checkout-btn');
    if (checkoutBtn) {
      checkoutBtn.disabled = true;
      checkoutBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Finalizing Bill...';
    }

    try {
      const res = await App.api('/api/v1/pos/checkout', {
        method: 'POST',
        body: payload
      });

      AnimEngine.showToast(`Invoice ${res.sale.invoice_no} completed!`, 'success');
      this.clearCart();
      await this.fetchProducts(); // Refresh stock balances
      this.showReceiptModal(res.sale, res.settings);
    } catch (e) {
      console.error('Checkout error:', e);
    } finally {
      if (checkoutBtn) {
        checkoutBtn.disabled = false;
        checkoutBtn.innerHTML = '<i class="bi bi-printer-fill me-2"></i> Complete Sale & Print Bill';
      }
    }
  },

  showReceiptModal(sale, settings = {}) {
    const modalEl = document.getElementById('receiptModal');
    if (!modalEl) return;

    const receiptBox = document.getElementById('thermal-receipt-area');
    if (receiptBox) {
      receiptBox.innerHTML = `
        <div style="text-align: center;">
          <h4 style="font-weight: 800; margin-bottom: 2px;">${settings.shop_name || 'FRESH CUT PRIME MEAT'}</h4>
          <div style="font-size: 11px;">${settings.shop_tagline || 'Fresh & Tender Cuts Everyday'}</div>
          <div style="font-size: 10px;">${settings.shop_address || ''}</div>
          <div style="font-size: 10px;">Phone: ${settings.shop_phone || ''}</div>
          <div style="font-size: 10px;">GSTIN: ${settings.gstin_tax_id || ''}</div>
        </div>
        <div class="receipt-divider"></div>
        <div style="display: flex; justify-content: space-between; font-size: 11px;">
          <span>INV: <b>${sale.invoice_no}</b></span>
          <span>${new Date(sale.created_at).toLocaleDateString()}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 11px;">
          <span>Cashier: ${sale.cashier_name}</span>
          <span>Pay: ${sale.payment_method}</span>
        </div>
        ${sale.customer_name ? `<div style="font-size: 11px;">Customer: ${sale.customer_name}</div>` : ''}
        <div class="receipt-divider"></div>
        <table style="width: 100%; font-size: 11px;">
          <thead>
            <tr style="border-bottom: 1px dashed #000;">
              <th style="text-align: left;">Item</th>
              <th style="text-align: right;">Qty</th>
              <th style="text-align: right;">Rate</th>
              <th style="text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${sale.items.map(item => `
              <tr>
                <td>${item.product_name}</td>
                <td style="text-align: right;">${parseFloat(item.quantity).toFixed(2)} ${item.unit}</td>
                <td style="text-align: right;">₹${parseFloat(item.unit_price).toFixed(0)}</td>
                <td style="text-align: right;">₹${parseFloat(item.total_price).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="receipt-divider"></div>
        <div style="display: flex; justify-content: space-between; font-size: 11px;">
          <span>Subtotal:</span>
          <span>₹${parseFloat(sale.subtotal).toFixed(2)}</span>
        </div>
        ${sale.discount_amount > 0 ? `
          <div style="display: flex; justify-content: space-between; font-size: 11px; color: #b91c1c;">
            <span>Discount:</span>
            <span>- ₹${parseFloat(sale.discount_amount).toFixed(2)}</span>
          </div>
        ` : ''}
        <div style="display: flex; justify-content: space-between; font-size: 11px;">
          <span>GST / Tax:</span>
          <span>₹${parseFloat(sale.tax_amount).toFixed(2)}</span>
        </div>
        <div class="receipt-divider"></div>
        <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: bold;">
          <span>GRAND TOTAL:</span>
          <span>₹${parseFloat(sale.total_amount).toFixed(2)}</span>
        </div>
        <div class="receipt-divider"></div>
        <div style="text-align: center; font-size: 10px; margin-top: 8px;">
          ${settings.receipt_footer_note || 'Thank you for choosing Fresh Cut!'}
        </div>
      `;
    }

    const modal = new bootstrap.Modal(modalEl);
    modal.show();
  },

  printReceipt() {
    window.print();
  }
};
