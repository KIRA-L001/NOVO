const ProductService = {
  getProducts() {
    return PRODUCTS;
  },

  getProduct(id) {
    return PRODUCTS.find(p => p.id === id) || null;
  },

  getCategories() {
    return [...new Set(PRODUCTS.map(p => p.category))];
  },

  getBrands() {
    return [...new Set(PRODUCTS.map(p => p.brand))];
  },

  getProductsByCategory(category) {
    return PRODUCTS.filter(p => p.category === category);
  },

  searchProducts(query) {
    if (!query) return PRODUCTS;
    const q = query.toLowerCase();
    return PRODUCTS.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.tags.some(t => t.toLowerCase().includes(q)) ||
      p.colors.some(c => c.toLowerCase().includes(q))
    );
  },

  filterProducts(filters) {
    let results = PRODUCTS;

    if (filters.category) {
      results = results.filter(p => p.category === filters.category);
    }

    if (filters.brand) {
      results = results.filter(p => p.brand === filters.brand);
    }

    if (filters.minPrice !== undefined) {
      results = results.filter(p => p.price >= filters.minPrice);
    }

    if (filters.maxPrice !== undefined) {
      results = results.filter(p => p.price <= filters.maxPrice);
    }

    if (filters.size) {
      results = results.filter(p => p.sizes.includes(filters.size));
    }

    if (filters.color) {
      results = results.filter(p =>
        p.colors.some(c => c.toLowerCase() === filters.color.toLowerCase())
      );
    }

    if (filters.search) {
      const q = filters.search.toLowerCase();
      results = results.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.tags.some(t => t.toLowerCase().includes(q))
      );
    }

    return results;
  }
};
