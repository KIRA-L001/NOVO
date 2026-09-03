const App = {
  filters: { category: null, brand: null, maxPrice: 16000, size: null, color: null, search: '' },

  init() {
    this.bindHeader();
    this.bindSearch();
    this.bindFilters();
    this.bindCart();
    this.bindCheckout();
    this.bindSort();
    this.parseUrlParams();
    this.renderProducts();
    this.renderFilters();
    this.updateCartCount();
    this.setupImageFallback();
  },

  parseUrlParams() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('category')) {
      this.filters.category = params.get('category');
    }
    if (params.get('search')) {
      this.filters.search = params.get('search');
      document.getElementById('searchInput').value = this.filters.search;
    }
  },

  bindHeader() {
    document.getElementById('mobileMenuBtn')?.addEventListener('click', () => {
      const nav = document.querySelector('.main-nav');
      nav.style.display = nav.style.display === 'flex' ? 'none' : 'flex';
    });
  },

  bindSearch() {
    const input = document.getElementById('searchInput');
    const btn = document.getElementById('searchBtn');
    if (input) {
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') this.doSearch(input.value);
      });
    }
    if (btn) {
      btn.addEventListener('click', () => this.doSearch(input.value));
    }
  },

  doSearch(query) {
    this.filters.search = query;
    this.filters.category = null;
    this.renderProducts();
    Analytics.track('product_searched', { query });
  },

  bindFilters() {
    const priceFilter = document.getElementById('priceFilter');
    const priceLabel = document.getElementById('priceFilterLabel');
    if (priceFilter) {
      priceFilter.addEventListener('input', e => {
        this.filters.maxPrice = parseInt(e.target.value);
        priceLabel.textContent = 'Up to ₹' + this.filters.maxPrice.toLocaleString();
        this.renderProducts();
      });
    }

    document.getElementById('clearFiltersBtn')?.addEventListener('click', () => {
      this.filters = { category: null, brand: null, maxPrice: 16000, size: null, color: null, search: '' };
      document.getElementById('searchInput').value = '';
      priceFilter.value = 16000;
      priceLabel.textContent = 'Up to ₹16,000';
      this.renderFilters();
      this.renderProducts();
    });
  },

  bindSort() {
    document.getElementById('sortSelect')?.addEventListener('change', e => {
      this.renderProducts(e.target.value);
    });
  },

  bindCart() {
    document.getElementById('cartBtn')?.addEventListener('click', () => this.openCart());
    document.getElementById('cartCloseBtn')?.addEventListener('click', () => this.closeCart());
    document.getElementById('cartOverlay')?.addEventListener('click', () => this.closeCart());
  },

  openCart() {
    document.getElementById('cartDrawer').classList.add('open');
    document.getElementById('cartOverlay').classList.add('open');
    this.renderCartItems();
    Analytics.track('cart_viewed', {});
  },

  closeCart() {
    document.getElementById('cartDrawer').classList.remove('open');
    document.getElementById('cartOverlay').classList.remove('open');
  },

  bindCheckout() {
    document.getElementById('checkoutBtn')?.addEventListener('click', () => this.openCheckout());
    document.getElementById('checkoutCloseBtn')?.addEventListener('click', () => this.closeCheckout());
    document.getElementById('checkoutForm')?.addEventListener('submit', e => this.handleCheckout(e));
    document.getElementById('continueShoppingBtn')?.addEventListener('click', () => {
      document.getElementById('checkoutSuccess').classList.remove('open');
    });
  },

  openCheckout() {
    const items = CartService.getCartWithProducts();
    if (items.length === 0) return;
    this.closeCart();
    this.renderCheckoutItems();
    document.getElementById('checkoutModal').classList.add('open');
  },

  closeCheckout() {
    document.getElementById('checkoutModal').classList.remove('open');
  },

  renderCheckoutItems() {
    const items = CartService.getCartWithProducts();
    document.getElementById('checkoutItems').innerHTML = items.map(item =>
      `<div class="checkout-order-item">
        <span class="item-name">${item.product.name}</span>
        <span class="item-qty">×${item.quantity}</span>
        <span class="item-price">₹${(item.product.price * item.quantity).toLocaleString()}</span>
      </div>`
    ).join('');
    document.getElementById('checkoutTotal').textContent = '₹' + CartService.getSubtotal().toLocaleString();
  },

  handleCheckout(e) {
    e.preventDefault();
    if (!RAZORPAY_CONFIG.key || RAZORPAY_CONFIG.key.includes('YOUR_KEY')) {
      alert('Replace rzp_test_YOUR_KEY_HERE in index.html with your actual Razorpay test key.\n\nGet one at: https://dashboard.razorpay.com/app/keys');
      return;
    }
    const name = document.getElementById('checkoutName').value.trim();
    const email = document.getElementById('checkoutEmail').value.trim();
    const phone = document.getElementById('checkoutPhone').value.trim();
    const address = document.getElementById('checkoutAddress').value.trim();
    const total = CartService.getSubtotal();
    const orderId = 'NOVO-' + Date.now().toString(36).toUpperCase();

    const options = {
      key: RAZORPAY_CONFIG.key,
      amount: total * 100,
      currency: RAZORPAY_CONFIG.currency,
      name: RAZORPAY_CONFIG.name,
      description: orderId,
      theme: RAZORPAY_CONFIG.theme,
      handler: (response) => {
        CartService.clearCart();
        this.updateCartCount();
        this.closeCheckout();
        document.getElementById('orderId').textContent = orderId;
        document.getElementById('confirmEmail').textContent = email;
        document.getElementById('checkoutSuccess').classList.add('open');
        document.getElementById('checkoutForm').reset();
        Analytics.track('checkout_completed', { orderId, name, email, paymentId: response.razorpay_payment_id });
      },
      prefill: { name, email, contact: phone },
      notes: { address },
      modal: {
        ondismiss: () => { /* user closed payment modal, cart stays */ }
      }
    };

    this._loadRazorpay().then(() => {
      new window.Razorpay(options).open();
    }).catch(() => {
      alert('Payment gateway failed to load. Check your connection and disable ad blockers.');
    });
  },

  _loadRazorpay() {
    if (window.Razorpay) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://checkout.razorpay.com/v1/checkout.js';
      s.onload = () => {
        // # ponytail: Razorpay有时在onload后还没挂载，轮询一次
        if (window.Razorpay) return resolve();
        const t = setInterval(() => {
          if (window.Razorpay) { clearInterval(t); resolve(); }
        }, 50);
        setTimeout(() => { clearInterval(t); reject(); }, 3000);
      };
      s.onerror = reject;
      document.head.appendChild(s);
    });
  },

  renderCartItems() {
    const container = document.getElementById('cartItems');
    const footer = document.getElementById('cartFooter');
    const items = CartService.getCartWithProducts();

    if (items.length === 0) {
      container.innerHTML = '<p style="text-align:center;color:#666;padding:48px 0;">Your cart is empty.</p>';
      footer.style.display = 'none';
      return;
    }

    footer.style.display = 'block';
    container.innerHTML = items.map(item => `
      <div class="cart-item" data-product-id="${item.productId}">
        <img src="${item.product.image}" alt="${item.product.name}">
        <div class="cart-item-info">
          <div class="cart-item-name">${item.product.name}</div>
          <div class="cart-item-price">₹${item.product.price.toLocaleString()}</div>
          <div class="cart-item-controls">
            <button onclick="App.updateCartItem('${item.productId}', ${item.quantity - 1})">−</button>
            <span>${item.quantity}</span>
            <button onclick="App.updateCartItem('${item.productId}', ${item.quantity + 1})">+</button>
          </div>
        </div>
        <button class="cart-item-remove" onclick="App.removeCartItem('${item.productId}')">✕</button>
      </div>
    `).join('');

    document.getElementById('cartSubtotal').textContent = '₹' + CartService.getSubtotal().toLocaleString();
  },

  updateCartItem(productId, qty) {
    CartService.updateQuantity(productId, qty);
    this.updateCartCount();
    this.renderCartItems();
  },

  removeCartItem(productId) {
    CartService.removeItem(productId);
    this.updateCartCount();
    this.renderCartItems();
  },

  updateCartCount() {
    document.getElementById('cartCount').textContent = CartService.getItemCount();
  },

  renderFilters() {
    const categories = ProductService.getCategories();
    const sizes = [...new Set(PRODUCTS.flatMap(p => p.sizes))];
    const colors = [...new Set(PRODUCTS.flatMap(p => p.colors))];

    document.getElementById('categoryFilters').innerHTML = categories.map(c => `
      <div class="filter-checkbox">
        <input type="checkbox" id="cat-${c}" value="${c}" ${this.filters.category === c ? 'checked' : ''}>
        <label for="cat-${c}">${c}</label>
      </div>
    `).join('');

    document.querySelectorAll('#categoryFilters input').forEach(cb => {
      cb.addEventListener('change', e => {
        this.filters.category = e.target.checked ? e.target.value : null;
        this.renderProducts();
      });
    });

    document.getElementById('sizeFilters').innerHTML = sizes.map(s => `
      <button class="size-btn ${this.filters.size === s ? 'active' : ''}" data-size="${s}">${s}</button>
    `).join('');

    document.querySelectorAll('.size-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        const size = e.target.dataset.size;
        this.filters.size = this.filters.size === size ? null : size;
        this.renderFilters();
        this.renderProducts();
      });
    });

    document.getElementById('colorFilters').innerHTML = colors.map(c => `
      <button class="color-btn ${this.filters.color === c ? 'active' : ''}" data-color="${c}">${c}</button>
    `).join('');

    document.querySelectorAll('.color-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        const color = e.target.dataset.color;
        this.filters.color = this.filters.color === color ? null : color;
        this.renderFilters();
        this.renderProducts();
      });
    });
  },

  renderProducts(sortBy = 'default') {
    let products = ProductService.filterProducts(this.filters);

    switch (sortBy) {
      case 'price-asc': products.sort((a, b) => a.price - b.price); break;
      case 'price-desc': products.sort((a, b) => b.price - a.price); break;
      case 'rating': products.sort((a, b) => b.rating - a.rating); break;
      case 'name': products.sort((a, b) => a.name.localeCompare(b.name)); break;
    }

    const title = document.getElementById('productsTitle');
    if (this.filters.category) {
      title.textContent = this.filters.category;
    } else if (this.filters.search) {
      title.textContent = 'Results for "' + this.filters.search + '"';
    } else {
      title.textContent = 'All Products';
    }

    document.getElementById('productGrid').innerHTML = products.map(p => {
      const discount = Math.round((1 - p.price / p.originalPrice) * 100);
      return `
        <article class="product-card" role="listitem"
          data-product-id="${p.id}"
          data-product-name="${p.name}"
          data-product-brand="${p.brand}"
          data-product-category="${p.category}"
          data-product-price="${p.price}"
          data-product-currency="${p.currency}"
          data-product-stock="${p.stock}"
          data-product-type="product">
          <span class="product-badge" style="display:${discount > 0 ? 'block' : 'none'}">-${discount}%</span>
          <a href="product.html?id=${p.id}" class="product-image-link">
            <img src="${p.image}" alt="${p.name}" loading="lazy">
          </a>
          <div class="product-info">
            <p class="product-brand">${p.brand}</p>
            <h3 class="product-name"><a href="product.html?id=${p.id}">${p.name}</a></h3>
            <p class="product-category" style="display:none">${p.category}</p>
            <p class="product-description" style="display:none">${p.description}</p>
            <div class="product-rating">
              <span class="stars">${'★'.repeat(Math.floor(p.rating))}</span>
              <span>${p.rating}</span>
              <span>(${p.reviewCount})</span>
            </div>
            <div class="product-pricing">
              <span class="product-price">₹${p.price.toLocaleString()}</span>
              <span class="product-original-price">₹${p.originalPrice.toLocaleString()}</span>
              <span class="product-discount">-${discount}%</span>
            </div>
          </div>
          <div class="product-card-actions">
            <button class="btn btn-primary btn-add-card" onclick="App.addToCart('${p.id}')">Add to Cart</button>
            <button class="btn-wishlist" onclick="App.toggleWishlist('${p.id}')" aria-label="Add to wishlist">♡</button>
          </div>
        </article>`;
    }).join('');

    if (products.length === 0) {
      document.getElementById('productGrid').innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#666;padding:48px 0;">No products found matching your criteria.</p>';
    }
  },

  addToCart(productId) {
    CartService.addItem(productId, 1);
    this.updateCartCount();
    const product = ProductService.getProduct(productId);
    if (product) {
      alert(product.name + ' added to cart!');
    }
  },

  toggleWishlist(productId) {
    Analytics.track('wishlist_added', { productId });
  },

  setupImageFallback() {
    document.addEventListener('error', e => {
      if (e.target.tagName === 'IMG' && !e.target.dataset.fallback) {
        e.target.dataset.fallback = '1';
        const label = e.target.alt || 'Product';
        e.target.src = 'data:image/svg+xml,' + encodeURIComponent(
          '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><rect fill="%23e5e5e5" width="600" height="600"/><text fill="%23999" font-family="sans-serif" font-size="24" x="50%" y="50%" text-anchor="middle" dy=".3em">' + label + '</text></svg>'
        );
      }
    }, true);
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
