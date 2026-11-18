/* ==========================================================
   FRESH CUT MEAT SHOP - ANIMATION & MICRO-INTERACTIONS ENGINE
   ========================================================== */

const AnimEngine = {
  // 1. Easing Number Counter
  animateCounter(element, targetValue, duration = 1000, prefix = '', decimals = 0, suffix = '') {
    if (!element) return;
    const startValue = parseFloat(element.getAttribute('data-value') || 0);
    const endValue = parseFloat(targetValue);
    const startTime = performance.now();

    element.classList.add('counter-glow');

    function updateCounter(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease Out Quart
      const ease = 1 - Math.pow(1 - progress, 4);
      const current = startValue + (endValue - startValue) * ease;

      const formatted = current.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      });

      element.innerText = `${prefix}${formatted}${suffix}`;

      if (progress < 1) {
        requestAnimationFrame(updateCounter);
      } else {
        element.setAttribute('data-value', endValue);
        setTimeout(() => element.classList.remove('counter-glow'), 400);
      }
    }

    requestAnimationFrame(updateCounter);
  },

  // 2. Button Ripple Effect
  initRipples() {
    document.addEventListener('click', (e) => {
      const target = e.target.closest('.ripple-btn');
      if (!target) return;

      const rect = target.getBoundingClientRect();
      const circle = document.createElement('span');
      const diameter = Math.max(rect.width, rect.height);
      const radius = diameter / 2;

      circle.style.width = circle.style.height = `${diameter}px`;
      circle.style.left = `${e.clientX - rect.left - radius}px`;
      circle.style.top = `${e.clientY - rect.top - radius}px`;
      circle.classList.add('ripple-circle');

      const existing = target.querySelector('.ripple-circle');
      if (existing) existing.remove();

      target.appendChild(circle);
      setTimeout(() => circle.remove(), 600);
    });
  },

  // 3. Toast Notification Manager
  showToast(message, type = 'success', duration = 3500) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container-fresh';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast-fresh toast-${type}`;

    let icon = 'bi-check-circle-fill text-success';
    if (type === 'error') icon = 'bi-exclamation-octagon-fill text-danger';
    if (type === 'warning') icon = 'bi-exclamation-triangle-fill text-warning';

    toast.innerHTML = `
      <i class="bi ${icon} fs-4"></i>
      <div class="flex-grow-1">
        <div class="fw-bold" style="font-size: 0.85rem; text-transform: capitalize;">${type}</div>
        <div style="font-size: 0.82rem; color: #475569;">${message}</div>
      </div>
      <button type="button" class="btn-close btn-close-sm" style="font-size: 0.7rem;"></button>
    `;

    toast.querySelector('.btn-close').onclick = () => removeToast(toast);
    container.appendChild(toast);

    const timer = setTimeout(() => removeToast(toast), duration);

    function removeToast(el) {
      clearTimeout(timer);
      el.classList.add('toast-exit');
      setTimeout(() => el.remove(), 320);
    }
  },

  // 4. Flying Item to Cart Indicator
  flyToCart(startElement, targetElement) {
    if (!startElement || !targetElement) return;
    const startRect = startElement.getBoundingClientRect();
    const targetRect = targetElement.getBoundingClientRect();

    const flyingDot = document.createElement('div');
    flyingDot.style.position = 'fixed';
    flyingDot.style.zIndex = '99999';
    flyingDot.style.width = '24px';
    flyingDot.style.height = '24px';
    flyingDot.style.borderRadius = '50%';
    flyingDot.style.background = '#10b981';
    flyingDot.style.color = '#fff';
    flyingDot.style.display = 'flex';
    flyingDot.style.alignItems = 'center';
    flyingDot.style.justifyContent = 'center';
    flyingDot.style.fontSize = '12px';
    flyingDot.innerHTML = '<i class="bi bi-plus"></i>';
    flyingDot.style.left = `${startRect.left + startRect.width / 2}px`;
    flyingDot.style.top = `${startRect.top + startRect.height / 2}px`;
    flyingDot.style.transition = 'all 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)';
    flyingDot.style.pointerEvents = 'none';
    flyingDot.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.5)';

    document.body.appendChild(flyingDot);

    requestAnimationFrame(() => {
      flyingDot.style.left = `${targetRect.left + targetRect.width / 2}px`;
      flyingDot.style.top = `${targetRect.top + targetRect.height / 2}px`;
      flyingDot.style.transform = 'scale(0.4)';
      flyingDot.style.opacity = '0.3';
    });

    setTimeout(() => {
      flyingDot.remove();
      targetElement.classList.add('counter-glow');
      setTimeout(() => targetElement.classList.remove('counter-glow'), 300);
    }, 500);
  }
};

document.addEventListener('DOMContentLoaded', () => {
  AnimEngine.initRipples();
});
