const CartService = {
  STORAGE_KEY: 'novo_cart',

  getCart() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      return raw ? JSON.parse(raw) : { items: [] };
    } catch {
      return { items: [] };
    }
  },

  addItem(productId, quantity = 1) {
    const cart = this.getCart();
    const existing = cart.items.find(i => i.productId === productId);
    if (existing) {
      existing.quantity += quantity;
    } else {
      cart.items.push({ productId, quantity });
    }
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(cart));
    this._emit('product_added_to_cart', { productId, quantity });
    return cart;
  },

  removeItem(productId) {
    const cart = this.getCart();
    cart.items = cart.items.filter(i => i.productId !== productId);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(cart));
    this._emit('product_removed_from_cart', { productId });
    return cart;
  },

  updateQuantity(productId, quantity) {
    const cart = this.getCart();
    const item = cart.items.find(i => i.productId === productId);
    if (item) {
      if (quantity <= 0) {
        return this.removeItem(productId);
      }
      item.quantity = quantity;
    }
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(cart));
    this._emit('cart_updated', { productId, quantity });
    return cart;
  },

  getItemCount() {
    const cart = this.getCart();
    return cart.items.reduce((sum, i) => sum + i.quantity, 0);
  },

  getCartWithProducts() {
    const cart = this.getCart();
    return cart.items.map(item => {
      const product = ProductService.getProduct(item.productId);
      return { ...item, product };
    }).filter(i => i.product);
  },

  getSubtotal() {
    return this.getCartWithProducts().reduce((sum, i) => sum + (i.product.price * i.quantity), 0);
  },

  clearCart() {
    localStorage.removeItem(this.STORAGE_KEY);
    this._emit('cart_cleared', {});
    return { items: [] };
  },

  _emit(event, detail) {
    window.dispatchEvent(new CustomEvent('ray:' + event, { detail }));
  }
};
