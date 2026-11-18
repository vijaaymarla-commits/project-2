/* ==========================================================
   FRESH CUT MEAT SHOP - POS BILLING MODULE (ENHANCED)
   With Meat Imagery, Out-of-Stock Handling & Fixed Steppers
   ========================================================== */

const POSModule = {
  products: [],
  cart: [],
  selectedCategory: 'All',
  selectedCustomer: null,
  paymentMethod: 'Cash',
  taxRate: 0,          // 0 = GST off by default (optional)
  discount: 0.0,
  extraChargeAmount: 0.0,
  extraChargeLabel: 'Extra Charges',

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
    const cats = ['All', 'Chicken', 'Mutton', 'Seafood', 'Cold Cuts & Marinades'];
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
      case 'Chicken': return '🍗';
      case 'Mutton': return '🥩';
      case 'Seafood': return '🐟';
      case 'Cold Cuts & Marinades': return '🥓';
      default: return '🔪';
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

    // Default meat placeholder image if none assigned
    const defaultMeatImg = 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=500&q=80';

    grid.innerHTML = items.map(p => {
      const stock = parseFloat(p.current_stock || 0);
      const isOut = stock <= 0;
      const isLow = stock > 0 && stock <= parseFloat(p.min_stock || 5);
      const imgUrl = p.image_url || defaultMeatImg;

      return `
        <div class="pos-item-card ${isOut ? 'is-out-of-stock' : ''}"
             onclick="POSModule.handleCardClick('${p.id}', event, ${isOut})">
          
          <div class="pos-item-img-box">
            <img src="${imgUrl}" alt="${p.name}" class="pos-item-img" loading="lazy">
            <span class="pos-item-category-tag">${p.category}</span>
            ${isOut ? '<div class="out-of-stock-ribbon"><i class="bi bi-x-circle-fill me-1"></i> OUT OF STOCK</div>' : ''}
          </div>

          <div class="pos-item-body">
            <div class="pos-card-name">${p.name}</div>
            
            <div class="pos-card-footer">
              <div>
                <div class="pos-card-price">₹${parseFloat(p.selling_price).toFixed(2)}</div>
                <div class="pos-card-unit">per ${p.unit}</div>
              </div>
              <div>
                ${isOut ? `
                  <span class="badge-status-out">Out of Stock</span>
                ` : isLow ? `
                  <span class="pos-card-stock stock-low">Low: ${stock.toFixed(1)} ${p.unit}</span>
                ` : `
                  <span class="pos-card-stock stock-in">${stock.toFixed(1)} ${p.unit}</span>
                `}
              </div>
            </div>
          </div>

        </div>
      `;
    }).join('');
  },

  handleCardClick(productId, event, isOut) {
    if (isOut) {
      AnimEngine.showToast('Sorry! This cut is currently OUT OF STOCK.', 'error');
      return;
    }
    this.addToCart(productId, event);
  },

  addToCart(productId, event = null) {
    const prod = this.products.find(p => p.id === productId);
    if (!prod) return;

    const availableStock = parseFloat(prod.current_stock || 0);
    if (availableStock <= 0) {
      AnimEngine.showToast(`Cannot add '${prod.name}' - item is out of stock!`, 'error');
      return;
    }

    const step = prod.unit === 'kg' ? 0.5 : 1;
    const existing = this.cart.find(item => item.product_id === productId);

    if (existing) {
      const nextQty = Math.round((existing.quantity + step) * 100) / 100;
      if (nextQty > availableStock) {
        AnimEngine.showToast(`Stock limit reached! Only ${availableStock} ${prod.unit} available.`, 'warning');
        existing.quantity = availableStock;
      } else {
        existing.quantity = nextQty;
      }
    } else {
      const initialQty = prod.unit === 'kg' ? 1.0 : 1;
      this.cart.push({
        product_id: prod.id,
        name: prod.name,
        unit: prod.unit,
        price: parseFloat(prod.selling_price),
        quantity: Math.min(initialQty, availableStock),
        max_stock: availableStock
      });
    }

    // Fly animation to cart
    if (event && event.currentTarget) {
      const targetCartBadge = document.getElementById('pos-cart-count');
      AnimEngine.flyToCart(event.currentTarget, targetCartBadge);
    }

    this.renderCart();
  },

  // FIXED STEPPER INCREMENT
  incrementQty(productId) {
    const item = this.cart.find(i => i.product_id === productId);
    if (!item) return;

    const step = item.unit === 'kg' ? 0.5 : 1;
    const nextQty = Math.round((parseFloat(item.quantity) + step) * 100) / 100;

    if (item.max_stock && nextQty > item.max_stock) {
      AnimEngine.showToast(`Cannot exceed current stock of ${item.max_stock} ${item.unit}!`, 'warning');
      item.quantity = item.max_stock;
    } else {
      item.quantity = nextQty;
    }
    this.renderCart();
  },

  // FIXED STEPPER DECREMENT
  decrementQty(productId) {
    const item = this.cart.find(i => i.product_id === productId);
    if (!item) return;

    const step = item.unit === 'kg' ? 0.5 : 1;
    const nextQty = Math.round((parseFloat(item.quantity) - step) * 100) / 100;

    if (nextQty <= 0) {
      this.removeFromCart(productId);
    } else {
      item.quantity = nextQty;
      this.renderCart();
    }
  },

  // MANUAL DIRECT INPUT UPDATE
  updateQuantity(productId, newQty) {
    const item = this.cart.find(i => i.product_id === productId);
    if (!item) return;

    let qty = parseFloat(newQty);
    if (isNaN(qty) || qty <= 0) {
      this.removeFromCart(productId);
      return;
    }

    if (['pcs', 'pack'].includes(item.unit)) {
      qty = Math.round(qty);
    }

    if (item.max_stock && qty > item.max_stock) {
      AnimEngine.showToast(`Cannot exceed current stock of ${item.max_stock} ${item.unit}!`, 'warning');
      qty = item.max_stock;
    }

    item.quantity = Math.round(qty * 100) / 100;
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
    this.extraChargeAmount = 0.0;
    // Reset GST toggle
    const gstToggle = document.getElementById('pos-gst-toggle');
    if (gstToggle) gstToggle.checked = false;
    // Reset extra charge toggle
    const extraToggle = document.getElementById('pos-extra-toggle');
    if (extraToggle) extraToggle.checked = false;
    const extraPanel = document.getElementById('pos-extra-panel');
    if (extraPanel) extraPanel.style.display = 'none';
    // Reset input values
    const discEl = document.getElementById('pos-discount-input');
    if (discEl) discEl.value = 0;
    const extraRateEl = document.getElementById('pos-extra-rate');
    if (extraRateEl) extraRateEl.value = 20;
    this.renderCart();
  },

  setPaymentMethod(method) {
    this.paymentMethod = method;
    document.querySelectorAll('.pay-tab').forEach(tab => {
      if (tab.getAttribute('data-method') === method) tab.classList.add('active');
      else tab.classList.remove('active');
    });

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
          <i class="bi bi-cart3 fs-1 d-block mb-2 text-danger opacity-50"></i>
          <p class="mb-0 fw-bold" style="font-size: 0.95rem; color: #44403c;">Your cart is empty.</p>
          <small class="text-muted">Tap any fresh cut on the left to add.</small>
        </div>
      `;
      this.updateSummary(0);
      return;
    }

    let subtotal = 0;
    container.innerHTML = this.cart.map(item => {
      const qty = parseFloat(item.quantity);
      const lineTotal = Math.round(qty * item.price * 100) / 100;
      subtotal += lineTotal;
      const isKg = item.unit === 'kg';

      return `
        <div class="cart-item-row">
          <div class="cart-item-top">
            <div class="cart-item-name">${item.name}</div>
            <button class="cart-item-del-btn" title="Remove Item" onclick="POSModule.removeFromCart('${item.product_id}')">
              <i class="bi bi-trash3"></i>
            </button>
          </div>
          <div class="cart-item-controls">
            <div class="qty-stepper">
              <button class="stepper-btn" type="button" onclick="POSModule.decrementQty('${item.product_id}')">-</button>
              <input type="number" step="${isKg ? '0.1' : '1'}" min="0" class="stepper-val-input" value="${qty}"
                     onchange="POSModule.updateQuantity('${item.product_id}', this.value)">
              <button class="stepper-btn" type="button" onclick="POSModule.incrementQty('${item.product_id}')">+</button>
            </div>
            <div class="text-end">
              <div class="cart-item-total">₹${lineTotal.toFixed(2)}</div>
              <small class="text-muted" style="font-size: 0.72rem;">@ ₹${item.price}/${item.unit}</small>
            </div>
          </div>
          ${isKg ? `
            <div class="weight-shortcuts">
              <button class="w-btn" type="button" onclick="POSModule.setPresetWeight('${item.product_id}', 0.25)">250g</button>
              <button class="w-btn" type="button" onclick="POSModule.setPresetWeight('${item.product_id}', 0.5)">500g</button>
              <button class="w-btn" type="button" onclick="POSModule.setPresetWeight('${item.product_id}', 0.75)">750g</button>
              <button class="w-btn" type="button" onclick="POSModule.setPresetWeight('${item.product_id}', 1.0)">1 kg</button>
              <button class="w-btn" type="button" onclick="POSModule.setPresetWeight('${item.product_id}', 2.0)">2 kg</button>
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
    this.discount = Math.max(0, discount);

    const discounted = Math.max(0, subtotal - this.discount);

    // --- Optional GST ---
    const gstToggle = document.getElementById('pos-gst-toggle');
    const gstEnabled = gstToggle ? gstToggle.checked : false;
    const gstRateBox = document.getElementById('pos-gst-rate-box');
    const gstPctLabel = document.getElementById('pos-gst-pct-label');
    if (gstRateBox) gstRateBox.style.display = gstEnabled ? 'block' : 'none';
    if (gstPctLabel) gstPctLabel.style.display = gstEnabled ? 'inline' : 'none';

    const gstRateInput = document.getElementById('pos-gst-rate');
    const taxRate = (gstEnabled && gstRateInput) ? (parseFloat(gstRateInput.value) || 0) : 0;
    this.taxRate = taxRate;
    const tax = gstEnabled ? Math.round(discounted * (taxRate / 100) * 100) / 100 : 0;

    const taxEl = document.getElementById('pos-tax');
    if (taxEl) {
      taxEl.innerText = gstEnabled ? `₹${tax.toFixed(2)} (${taxRate}%)` : '—';
      taxEl.className = gstEnabled ? 'text-danger fw-bold' : 'text-muted';
    }

    // --- Dynamic Extra Charges (Per Kg / Per Qty / Flat) ---
    const extraToggle = document.getElementById('pos-extra-toggle');
    const extraEnabled = extraToggle ? extraToggle.checked : false;
    const extraPanel = document.getElementById('pos-extra-panel');
    if (extraPanel) extraPanel.style.display = extraEnabled ? 'block' : 'none';

    let extraAmount = 0;
    let extraLabel = 'Extra Charges';

    if (extraEnabled) {
      const modeEl = document.getElementById('pos-extra-mode');
      const mode = modeEl ? modeEl.value : 'per_kg';
      const rateEl = document.getElementById('pos-extra-rate');
      const rate = rateEl ? (parseFloat(rateEl.value) || 0) : 0;

      const presetEl = document.getElementById('pos-extra-preset');
      const customEl = document.getElementById('pos-extra-custom-label');
      let reason = (presetEl && presetEl.value === 'custom')
        ? (customEl ? customEl.value.trim() : 'Service Charge')
        : (presetEl ? presetEl.value : 'Cutting & Slicing');
      if (!reason) reason = 'Extra Charge';

      // Total kg in cart (items with unit kg)
      const totalKg = this.cart
        .filter(i => (i.unit || '').toLowerCase() === 'kg')
        .reduce((sum, i) => sum + (parseFloat(i.quantity) || 0), 0);

      // Total quantity of all items in cart
      const totalQty = this.cart
        .reduce((sum, i) => sum + (parseFloat(i.quantity) || 0), 0);

      const breakdownEl = document.getElementById('pos-extra-calc-breakdown');

      if (mode === 'per_kg') {
        extraAmount = Math.round(totalKg * rate * 100) / 100;
        extraLabel = `${reason} (${totalKg.toFixed(2)} kg @ ₹${rate.toFixed(0)}/kg)`;
        if (breakdownEl) {
          breakdownEl.innerHTML = `<i class="bi bi-calculator me-1"></i>Weight: <b>${totalKg.toFixed(2)} kg</b> × ₹${rate.toFixed(0)}/kg = <span class="badge bg-danger">₹${extraAmount.toFixed(2)}</span>`;
        }
      } else if (mode === 'per_qty') {
        extraAmount = Math.round(totalQty * rate * 100) / 100;
        extraLabel = `${reason} (${totalQty} units @ ₹${rate.toFixed(0)}/item)`;
        if (breakdownEl) {
          breakdownEl.innerHTML = `<i class="bi bi-calculator me-1"></i>Quantity: <b>${totalQty} items</b> × ₹${rate.toFixed(0)}/item = <span class="badge bg-danger">₹${extraAmount.toFixed(2)}</span>`;
        }
      } else {
        // Flat amount
        extraAmount = Math.round(rate * 100) / 100;
        extraLabel = reason;
        if (breakdownEl) {
          breakdownEl.innerHTML = `<i class="bi bi-tag me-1"></i>Fixed Fee = <span class="badge bg-danger">₹${extraAmount.toFixed(2)}</span>`;
        }
      }
    }

    const extraDisplay = document.getElementById('pos-extra-display');
    if (extraDisplay) {
      extraDisplay.innerText = extraEnabled ? `₹${extraAmount.toFixed(2)}` : '—';
      extraDisplay.className = extraEnabled ? 'text-danger fw-bold' : 'text-muted';
    }

    this.extraChargeAmount = extraAmount;
    this.extraChargeLabel = extraLabel;

    const total = Math.round((discounted + tax + extraAmount) * 100) / 100;

    document.getElementById('pos-subtotal').innerText = `₹${subtotal.toFixed(2)}`;
    document.getElementById('pos-total').innerText = `₹${total.toFixed(2)}`;

    const upiAmt = document.getElementById('pos-upi-amount');
    if (upiAmt) upiAmt.innerText = `₹${total.toFixed(2)}`;
  },

  toggleExtraCharge() {
    this.renderCart();
  },

  onExtraPresetChange(val) {
    const customBox = document.getElementById('pos-extra-custom-box');
    if (customBox) customBox.style.display = val === 'custom' ? 'block' : 'none';
    this.renderCart();
  },

  onExtraModeChange(val) {
    const unitLabel = document.getElementById('pos-extra-unit-label');
    const rateLabel = document.getElementById('pos-extra-rate-label');
    if (val === 'per_kg') {
      if (unitLabel) unitLabel.innerText = '/kg';
      if (rateLabel) rateLabel.innerText = 'Rate: ₹';
    } else if (val === 'per_qty') {
      if (unitLabel) unitLabel.innerText = '/item';
      if (rateLabel) rateLabel.innerText = 'Rate: ₹';
    } else {
      if (unitLabel) unitLabel.innerText = 'flat';
      if (rateLabel) rateLabel.innerText = 'Amount: ₹';
    }
    this.renderCart();
  },

  setExtraRate(val) {
    const rateEl = document.getElementById('pos-extra-rate');
    if (rateEl) rateEl.value = val;
    this.renderCart();
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
      tax_rate: this.taxRate || 0,
      extra_charge_amount: this.extraChargeAmount || 0,
      extra_charge_label: this.extraChargeLabel || 'Extra Charges',
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
      checkoutBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Processing Sale...';
    }

    try {
      const res = await App.api('/api/v1/pos/checkout', {
        method: 'POST',
        body: payload
      });

      AnimEngine.showToast(`Invoice ${res.sale.invoice_no} completed successfully!`, 'success');
      this.clearCart();
      await this.fetchProducts(); // Refresh stock balances
      this.renderProducts();
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
          ${settings.shop_image_url ? `
            <div style="margin-bottom: 6px;">
              <img src="${settings.shop_image_url}" alt="Store Logo" style="max-height: 52px; max-width: 160px; object-fit: contain; border-radius: 4px;">
            </div>
          ` : ''}
          <h4 style="font-weight: 900; margin-bottom: 2px; color: #881337;">${settings.shop_name || 'FRESH CUT PRIME MEAT'}</h4>
          <div style="font-size: 11px; font-weight: bold;">${settings.shop_tagline || 'Artisanal Fresh & Tender Cuts Everyday'}</div>
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
          <span>Pay Mode: <b>${sale.payment_method}</b></span>
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
        ${parseFloat(sale.discount_amount) > 0 ? `
          <div style="display: flex; justify-content: space-between; font-size: 11px; color: #b91c1c;">
            <span>Discount:</span>
            <span>- ₹${parseFloat(sale.discount_amount).toFixed(2)}</span>
          </div>
        ` : ''}
        ${parseFloat(sale.tax_amount) > 0 ? `
          <div style="display: flex; justify-content: space-between; font-size: 11px; color: #0f766e;">
            <span>GST / Tax:</span>
            <span>+ ₹${parseFloat(sale.tax_amount).toFixed(2)}</span>
          </div>
        ` : ''}
        ${parseFloat(sale.extra_charge_amount || 0) > 0 ? `
          <div style="display: flex; justify-content: space-between; font-size: 11px; color: #b45309;">
            <span>${sale.extra_charge_label || 'Extra Charges'}:</span>
            <span>+ ₹${parseFloat(sale.extra_charge_amount).toFixed(2)}</span>
          </div>
        ` : ''}
        <div class="receipt-divider"></div>
        <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: bold; color: #881337;">
          <span>GRAND TOTAL:</span>
          <span>₹${parseFloat(sale.total_amount).toFixed(2)}</span>
        </div>
        <div class="receipt-divider"></div>
        <div style="text-align: center; font-size: 10px; margin-top: 8px;">
          ${settings.receipt_footer_note || 'Thank you for choosing Fresh Cut! Store meat between 0°C to 4°C.'}
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
