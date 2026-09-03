const RAY = {
  initialized: false,
  storeId: null,

  init(config) {
    this.storeId = config.storeId;
    this.initialized = true;

    this._setupWidget();
    this._setupStoreContext();

    console.log('[RAY] SDK initialized for store:', config.storeId);
    window.dispatchEvent(new CustomEvent('ray:initialized', { detail: { storeId: config.storeId } }));
  },

  _setupWidget() {
    const widgetBtn = document.getElementById('rayWidgetBtn');
    const chat = document.getElementById('rayChat');
    const closeBtn = document.getElementById('rayCloseBtn');
    const input = document.getElementById('rayInput');
    const sendBtn = document.getElementById('raySendBtn');

    if (widgetBtn) {
      widgetBtn.addEventListener('click', () => chat.classList.toggle('open'));
    }
    if (closeBtn) {
      closeBtn.addEventListener('click', () => chat.classList.remove('open'));
    }
    if (sendBtn && input) {
      const send = () => {
        const text = input.value.trim();
        if (!text) return;
        this._handleMessage(text);
        input.value = '';
      };
      sendBtn.addEventListener('click', send);
      input.addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
    }
  },

  _setupStoreContext() {
    window.RAY_STORE = {
      storeId: this.storeId,

      getCurrentPage() {
        const path = window.location.pathname;
        if (path.includes('product.html')) return 'product';
        if (path.includes('crawler-test.html')) return 'crawler-test';
        if (path.includes('sdk-test.html')) return 'sdk-test';
        return 'home';
      },

      getCurrentProduct() {
        const params = new URLSearchParams(window.location.search);
        const id = params.get('id');
        return id ? ProductService.getProduct(id) : null;
      },

      getVisibleProducts() {
        const cards = document.querySelectorAll('.product-card');
        return Array.from(cards).map(c => c.dataset.productId).map(id => ProductService.getProduct(id)).filter(Boolean);
      },

      getCart() {
        return CartService.getCart();
      },

      getCartItems() {
        return CartService.getCartWithProducts();
      },

      addToCart(productId, quantity) {
        CartService.addItem(productId, quantity || 1);
        if (typeof App !== 'undefined') App.updateCartCount();
        Analytics.track('add_to_cart', { productId, quantity: quantity || 1 });
        return CartService.getCart();
      },

      removeFromCart(productId) {
        CartService.removeItem(productId);
        if (typeof App !== 'undefined') App.updateCartCount();
        return CartService.getCart();
      },

      searchProducts(query) {
        return ProductService.searchProducts(query);
      },

      filterProducts(filters) {
        return ProductService.filterProducts(filters);
      },

      getProduct(id) {
        return ProductService.getProduct(id);
      },

      getFilters() {
        return typeof App !== 'undefined' ? { ...App.filters } : {};
      },

      openProduct(productId) {
        window.location.href = 'product.html?id=' + productId;
      },

      openCart() {
        if (typeof App !== 'undefined') App.openCart();
      }
    };
  },

  _handleMessage(text) {
    const messages = document.getElementById('rayMessages');

    const userDiv = document.createElement('div');
    userDiv.className = 'ray-msg ray-msg-user';
    userDiv.innerHTML = '<p>' + this._escapeHTML(text) + '</p>';
    messages.appendChild(userDiv);

    const response = this._processQuery(text);
    const aiDiv = document.createElement('div');
    aiDiv.className = 'ray-msg ray-msg-ai';
    aiDiv.innerHTML = response;
    messages.appendChild(aiDiv);

    messages.scrollTop = messages.scrollHeight;
    Analytics.track('ray:message_sent', { query: text });
  },

  _processQuery(text) {
    const q = text.toLowerCase();
    const store = window.RAY_STORE;

    if (q.includes('add') && q.includes('cart')) {
      const product = this._findProductFromText(q);
      if (product) {
        store.addToCart(product.id, 1);
        return `<p>Added <strong>${product.name}</strong> to your cart.</p>
                <div class="ray-product-result">
                  <h5>${product.name}</h5>
                  <p class="ray-result-price">₹${product.price.toLocaleString()}</p>
                </div>`;
      }
      return '<p>I couldn\'t find a matching product to add. Could you be more specific?</p>';
    }

    if (q.includes('cart') || q.includes('checkout')) {
      const items = store.getCartItems();
      if (items.length === 0) return '<p>Your cart is empty.</p>';
      const list = items.map(i => `<div class="ray-product-result"><h5>${i.product.name}</h5><p>${i.quantity}x ₹${i.product.price.toLocaleString()}</p></div>`).join('');
      return `<p>You have ${items.length} item(s) in your cart:</p>${list}`;
    }

    const keywords = q.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2);
    let results = PRODUCTS.filter(p => keywords.some(k =>
      p.name.toLowerCase().includes(k) ||
      p.category.toLowerCase().includes(k) ||
      p.description.toLowerCase().includes(k) ||
      p.tags.some(t => t.includes(k)) ||
      p.colors.some(c => c.toLowerCase().includes(k))
    ));

    const priceMatch = q.match(/under\s*₹?\s*(\d[\d,]*)/);
    if (priceMatch) {
      const maxPrice = parseInt(priceMatch[1].replace(/,/g, ''));
      results = results.filter(p => p.price <= maxPrice);
    }

    const cheapMatch = q.match(/cheap|affordable|budget|low price/);
    if (cheapMatch) {
      results = results.filter(p => p.price < 4000);
    }

    const lightweightMatch = q.match(/lightweight|light/);
    if (lightweightMatch) {
      results = results.filter(p => p.tags.some(t => t.includes('lightweight') || t.includes('light')));
    }

    if (results.length === 0) {
      results = PRODUCTS.filter(p => keywords.some(k =>
        p.name.toLowerCase().includes(k) ||
        p.category.toLowerCase().includes(k)
      )).slice(0, 3);
    }

    if (results.length === 0) {
      return '<p>I couldn\'t find products matching that. Try asking about a category like "running shoes" or "jackets", or mention a price like "under ₹5,000".</p>';
    }

    const productList = results.slice(0, 4).map(p => `
      <div class="ray-product-result">
        <h5>${p.name}</h5>
        <p>${p.category} · <span class="ray-result-price">₹${p.price.toLocaleString()}</span></p>
        <button class="ray-add-btn" onclick="window.RAY_STORE.addToCart('${p.id}', 1); App.updateCartCount();">Add to Cart</button>
      </div>
    `).join('');

    const count = results.length;
    return `<p>I found ${count > 4 ? '4+' : count} product${count !== 1 ? 's' : ''} matching your request:</p>${productList}
            <p style="font-size:13px;color:#666;margin-top:8px;">Ask me to add any of these to your cart.</p>`;
  },

  _findProductFromText(text) {
    for (const p of PRODUCTS) {
      if (text.includes(p.name.toLowerCase())) return p;
      if (text.includes(p.id)) return p;
    }
    const keywords = text.split(/\s+/).filter(w => w.length > 3);
    for (const k of keywords) {
      const match = PRODUCTS.find(p => p.name.toLowerCase().includes(k));
      if (match) return match;
    }
    return null;
  },

  _escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  trackEvent(event, data) {
    console.log('[RAY] Event:', event, data);
  }
};

window.RAY = RAY;

document.addEventListener('DOMContentLoaded', () => {
  RAY.init({ storeId: 'novo-demo-store', apiKey: 'YOUR_PUBLIC_SDK_KEY' });
});
