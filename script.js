// State Management
const STATE = {
  products: [],
  cart: {}, // Format: { [productId]: { product, quantity } }
  promoDiscount: 0,
  activePromo: null,
  taxRate: 0.08,
};

const VALID_COUPONS = {
  SAVE20: 0.20,
  SAVE10: 0.10,
};

// DOM References
const productGrid = document.getElementById("product-grid");
const productCountBadge = document.getElementById("product-count");
const cartToggleBtn = document.getElementById("cart-toggle-btn");
const cartDrawer = document.getElementById("cart-drawer");
const drawerOverlay = document.getElementById("cart-drawer-overlay");
const closeCartBtn = document.getElementById("close-cart-btn");
const cartBadge = document.getElementById("cart-badge");
const drawerItemCount = document.getElementById("drawer-item-count");
const cartItemsContainer = document.getElementById("cart-items-container");

// Summary Elements
const summarySubtotal = document.getElementById("summary-subtotal");
const summaryDiscount = document.getElementById("summary-discount");
const discountRow = document.getElementById("discount-row");
const discountPercentText = document.getElementById("discount-percent");
const summaryTax = document.getElementById("summary-tax");
const summaryTotal = document.getElementById("summary-total");

// Promo Code Elements
const couponInput = document.getElementById("coupon-input");
const applyCouponBtn = document.getElementById("apply-coupon-btn");
const couponMessage = document.getElementById("coupon-message");

// Modal Elements
const checkoutModal = document.getElementById("checkout-modal");
const checkoutStartBtn = document.getElementById("checkout-start-btn");
const closeModalBtn = document.getElementById("close-modal-btn");
const stepSuccess = document.getElementById("step-success");
const btnCloseSuccess = document.getElementById("btn-close-success");

// Toast Element
const toast = document.getElementById("toast");

/* -------------------------------------------------------------
 * 1. Fetching & Initializing Products with Simulated Inventory
 * ------------------------------------------------------------- */
async function fetchProducts() {
  try {
    const res = await fetch("https://fakestoreapi.com/products");
    const data = await res.json();

    // Attach inventory limits dynamically
    STATE.products = data.map((item) => ({
      ...item,
      // Map pseudo-random stock between 3 and 10 based on id
      stock: (item.id % 7) + 3,
    }));

    renderProducts(STATE.products);
    productCountBadge.textContent = `${STATE.products.length} Products`;
  } catch (error) {
    productGrid.innerHTML = `<p class="empty-cart-text">Failed to load items. Please check network connection.</p>`;
    console.error("Error fetching products:", error);
  }
}

function renderProducts(products) {
  productGrid.innerHTML = products
    .map((product) => {
      const remainingStock = getAvailableStock(product.id);
      const isOutOfStock = remainingStock <= 0;

      let stockTag = `<span class="stock-status in-stock">In Stock (${remainingStock})</span>`;
      if (remainingStock <= 2 && remainingStock > 0) {
        stockTag = `<span class="stock-status low-stock">Only ${remainingStock} left!</span>`;
      } else if (isOutOfStock) {
        stockTag = `<span class="stock-status out-of-stock">Out of Stock</span>`;
      }

      return `
        <article class="product-card">
          <div class="product-image-container">
            <img src="${product.image}" alt="${product.title}" loading="lazy" />
          </div>
          <div class="product-info">
            <span class="product-category">${product.category}</span>
            <h3 class="product-title" title="${product.title}">${product.title}</h3>
            <div class="product-meta">
              <span class="product-price">$${product.price.toFixed(2)}</span>
              ${stockTag}
            </div>
            <button 
              class="btn btn-primary" 
              onclick="handleAddToCart(${product.id})"
              ${isOutOfStock ? "disabled" : ""}
            >
              ${isOutOfStock ? "Sold Out" : "Add to Cart"}
            </button>
          </div>
        </article>
      `;
    })
    .join("");
}

/* -------------------------------------------------------------
 * 2. Cart & Inventory Calculations
 * ------------------------------------------------------------- */
function getAvailableStock(productId) {
  const product = STATE.products.find((p) => p.id === productId);
  if (!product) return 0;
  const inCart = STATE.cart[productId] ? STATE.cart[productId].quantity : 0;
  return product.stock - inCart;
}

function handleAddToCart(productId) {
  const product = STATE.products.find((p) => p.id === productId);
  if (!product) return;

  const inCart = STATE.cart[productId] ? STATE.cart[productId].quantity : 0;
  if (inCart < product.stock) {
    if (!STATE.cart[productId]) {
      STATE.cart[productId] = { product, quantity: 1 };
    } else {
      STATE.cart[productId].quantity++;
    }
    showToast(`Added "${product.title.substring(0, 20)}..." to cart`);
    syncCartUI();
    renderProducts(STATE.products); // Update stock display indicators
  }
}

function updateCartQuantity(productId, delta) {
  if (!STATE.cart[productId]) return;

  const currentQty = STATE.cart[productId].quantity;
  const product = STATE.products.find((p) => p.id === productId);
  const newQty = currentQty + delta;

  if (newQty <= 0) {
    delete STATE.cart[productId];
  } else if (newQty <= product.stock) {
    STATE.cart[productId].quantity = newQty;
  }

  syncCartUI();
  renderProducts(STATE.products);
}

function removeFromCart(productId) {
  delete STATE.cart[productId];
  syncCartUI();
  renderProducts(STATE.products);
}

function calculateTotals() {
  const items = Object.values(STATE.cart);
  const subtotal = items.reduce((acc, item) => acc + item.product.price * item.quantity, 0);
  const discount = subtotal * STATE.promoDiscount;
  const taxableAmount = Math.max(0, subtotal - discount);
  const tax = taxableAmount * STATE.taxRate;
  const grandTotal = taxableAmount + tax;

  return {
    itemCount: items.reduce((acc, item) => acc + item.quantity, 0),
    subtotal,
    discount,
    tax,
    grandTotal,
  };
}

function syncCartUI() {
  const totals = calculateTotals();

  // Badges
  cartBadge.textContent = totals.itemCount;
  drawerItemCount.textContent = totals.itemCount;

  // Render Items List
  const items = Object.values(STATE.cart);
  if (items.length === 0) {
    cartItemsContainer.innerHTML = `<p class="empty-cart-text">Your cart is empty.</p>`;
    checkoutStartBtn.disabled = true;
  } else {
    checkoutStartBtn.disabled = false;
    cartItemsContainer.innerHTML = items
      .map(({ product, quantity }) => {
        const canAddMore = quantity < product.stock;
        return `
        <div class="cart-item">
          <img src="${product.image}" alt="${product.title}">
          <div>
            <h4 class="cart-item-title">${product.title}</h4>
            <div class="cart-item-price">$${product.price.toFixed(2)}</div>
            <div class="quantity-controls">
              <button class="qty-btn" onclick="updateCartQuantity(${product.id}, -1)">−</button>
              <span class="qty-count">${quantity}</span>
              <button class="qty-btn" onclick="updateCartQuantity(${product.id}, 1)" ${!canAddMore ? "disabled" : ""}>+</button>
            </div>
          </div>
          <button class="cart-item-delete" onclick="removeFromCart(${product.id})" aria-label="Remove item">✕</button>
        </div>
      `;
      })
      .join("");
  }

  // Render Totals
  summarySubtotal.textContent = `$${totals.subtotal.toFixed(2)}`;
  if (STATE.promoDiscount > 0) {
    discountRow.style.display = "flex";
    discountPercentText.textContent = `${Math.round(STATE.promoDiscount * 100)}`;
    summaryDiscount.textContent = `-$${totals.discount.toFixed(2)}`;
  } else {
    discountRow.style.display = "none";
  }

  summaryTax.textContent = `$${totals.tax.toFixed(2)}`;
  summaryTotal.textContent = `$${totals.grandTotal.toFixed(2)}`;
}

/* -------------------------------------------------------------
 * 3. Promo Code Handling
 * ------------------------------------------------------------- */
applyCouponBtn.addEventListener("click", () => {
  const code = couponInput.value.trim().toUpperCase();

  if (VALID_COUPONS[code]) {
    STATE.promoDiscount = VALID_COUPONS[code];
    STATE.activePromo = code;
    couponMessage.textContent = `Coupon "${code}" applied successfully!`;
    couponMessage.className = "coupon-msg valid";
  } else {
    STATE.promoDiscount = 0;
    STATE.activePromo = null;
    couponMessage.textContent = "Invalid promo code. Try SAVE20";
    couponMessage.className = "coupon-msg invalid";
  }
  syncCartUI();
});

/* -------------------------------------------------------------
 * 4. Multi-Step Checkout Navigation & Form Validation
 * ------------------------------------------------------------- */


// Final Order Placement


/* -------------------------------------------------------------
 * 5. Drawer & Modal UI Controls
 * ------------------------------------------------------------- */
function toggleCart(isOpen) {
  cartDrawer.classList.toggle("open", isOpen);
  drawerOverlay.classList.toggle("active", isOpen);
}

cartToggleBtn.addEventListener("click", () => toggleCart(true));
closeCartBtn.addEventListener("click", () => toggleCart(false));
drawerOverlay.addEventListener("click", () => toggleCart(false));

checkoutStartBtn.addEventListener("click", () => {
  // Deduct inventory
  Object.values(STATE.cart).forEach(({ product, quantity }) => {
    const item = STATE.products.find((p) => p.id === product.id);
    if (item) item.stock -= quantity;
  });

  // Clear cart and discounts
  STATE.cart = {};
  STATE.promoDiscount = 0;
  STATE.activePromo = null;
  couponInput.value = "";
  couponMessage.className = "coupon-msg";
  couponMessage.textContent = "";

  // Update badges & re-render stock
  syncCartUI();
  renderProducts(STATE.products);

  // Close cart drawer and display success popup
  toggleCart(false);
  document.getElementById("order-ref-no").textContent = `#ORD-${Math.floor(100000 + Math.random() * 900000)}`;
  checkoutModal.classList.add("active");
});

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2500);
}

// Auto format Credit Card Number input (spaces every 4 digits)


// Initialize on DOM load
window.addEventListener("DOMContentLoaded", fetchProducts);