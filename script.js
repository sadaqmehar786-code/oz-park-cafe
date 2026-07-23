document.addEventListener('DOMContentLoaded', () => {
  // ==========================================================================
  // LANGUAGE TOGGLE SYSTEM
  // ==========================================================================
  const langSwitchButtons = document.querySelectorAll('.lang-switch');
  
  // Set default language. Prefer localStorage, fallback to Arabic ('ar') since it's Saudi Arabia
  let currentLang = localStorage.getItem('preferred-lang') || 'ar';
  
  const isMenuPage = window.location.pathname.includes('menu.html');
  
  const applyLanguage = (lang) => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    localStorage.setItem('preferred-lang', lang);
    
    // Dynamic Page Title
    if (isMenuPage) {
      document.title = lang === 'ar' 
        ? 'قائمة المأكولات والمشروبات - أوز بارك كافيه' 
        : 'OZ Park Cafe - Premium Coffee & Beverage Menu';
    } else {
      document.title = lang === 'ar' 
        ? 'أوز بارك كافيه - تجربة قهوة فاخرة على البحر' 
        : 'OZ Park Cafe - Luxury Sea-view Coffee Lounge';
    }
    
    // Smooth transition class helper to avoid visual jumps
    document.body.classList.add('lang-transition');
    setTimeout(() => {
      document.body.classList.remove('lang-transition');
    }, 400);

    if (window.updateCartUI) {
      window.updateCartUI();
    }
  };
  
  // Initialize
  applyLanguage(currentLang);
  
  // Language Button Click Handlers
  langSwitchButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      currentLang = currentLang === 'ar' ? 'en' : 'ar';
      applyLanguage(currentLang);
      
      // Close mobile menu if language switches
      const navMenu = document.querySelector('.nav-menu');
      const hamburger = document.querySelector('.hamburger');
      if (navMenu && navMenu.classList.contains('open')) {
        navMenu.classList.remove('open');
        hamburger.classList.remove('open');
      }
    });
  });

  // ==========================================================================
  // STICKY HEADER & SCROLL BEHAVIOR
  // ==========================================================================
  const header = document.querySelector('.header-wrapper');
  
  const handleScroll = () => {
    if (window.scrollY > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  };
  
  window.addEventListener('scroll', handleScroll);
  // Run once initially in case page loads scrolled down
  handleScroll();

  // ==========================================================================
  // MOBILE NAVIGATION DRAWER
  // ==========================================================================
  const hamburger = document.querySelector('.hamburger');
  const navMenu = document.querySelector('.nav-menu');
  const navLinks = document.querySelectorAll('.nav-link');
  
  if (hamburger && navMenu) {
    hamburger.addEventListener('click', () => {
      hamburger.classList.toggle('open');
      navMenu.classList.toggle('open');
    });
    
    // Close menu when a navigation link is clicked
    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        hamburger.classList.remove('open');
        navMenu.classList.remove('open');
      });
    });
  }

  // ==========================================================================
  // SMOOTH SAME-PAGE SCROLLING
  // ==========================================================================
  const smoothScrollLinks = document.querySelectorAll('a[href^="#"]');
  
  smoothScrollLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;
      
      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        e.preventDefault();
        
        // Calculate offset for the sticky header
        const headerHeight = header.offsetHeight || 90;
        const targetPosition = targetElement.getBoundingClientRect().top + window.scrollY - headerHeight;
        
        window.scrollTo({
          top: targetPosition,
          behavior: 'smooth'
        });
      }
    });
  });

  // ==========================================================================
  // MENU PAGE INTERACTIVE FILTER TABS (`menu.html`)
  // ==========================================================================
  const menuTabs = document.querySelectorAll('.menu-tab');
  const menuItems = document.querySelectorAll('.menu-list-item');
  
  if (menuTabs.length > 0 && menuItems.length > 0) {
    menuTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        // Toggle active class on tabs
        menuTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        const filterValue = tab.getAttribute('data-filter');
        
        // Show/Hide items with animation
        menuItems.forEach(item => {
          const category = item.getAttribute('data-category');
          
          if (filterValue === 'all' || category === filterValue) {
            item.style.display = 'flex';
            // Force reflow for animation restart
            item.style.animation = 'none';
            item.offsetHeight; 
            item.style.animation = '';
          } else {
            item.style.display = 'none';
          }
        });
      });
    });
  }

  // ==========================================================================
  // SCROLL REVEAL ANIMATIONS (INTERSECTION OBSERVER)
  // ==========================================================================
  const revealElements = document.querySelectorAll('.reveal');
  
  if ('IntersectionObserver' in window && revealElements.length > 0) {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('active');
          // Once animated, stop observing this element
          observer.unobserve(entry.target);
        }
      });
    }, {
      root: null,
      threshold: 0.15, // Trigger when 15% of the element is visible
      rootMargin: '0px 0px -50px 0px' // Offset triggers slightly
    });
    
    revealElements.forEach(el => revealObserver.observe(el));
  } else {
    // Fallback for older browsers
    revealElements.forEach(el => el.classList.add('active'));
  }

  // ==========================================================================
  // SHOPPING CART SYSTEM LOGIC
  // ==========================================================================
  
  // Arabic Number Formatting Helper
  const toArabicNum = (numStr) => {
    const mapping = {
      '0': '٠', '1': '١', '2': '٢', '3': '٣', '4': '٤',
      '5': '٥', '6': '٦', '7': '٧', '8': '٨', '9': '٩'
    };
    return numStr.toString().split('').map(char => mapping[char] || char).join('');
  };

  // State Management
  let cart = JSON.parse(localStorage.getItem('oz_cart')) || [];

  // Injected UI elements
  const injectCartUI = () => {
    // Floating Cart Trigger Icon
    const cartBtn = document.createElement('div');
    cartBtn.className = 'floating-cart-btn';
    cartBtn.innerHTML = `
      <span class="cart-badge" style="display: none;">0</span>
      <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path>
      </svg>
    `;
    document.body.appendChild(cartBtn);

    // Backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'cart-backdrop';
    document.body.appendChild(backdrop);

    // Cart Drawer Overlay
    const drawer = document.createElement('div');
    drawer.className = 'cart-drawer';
    drawer.innerHTML = `
      <div class="cart-drawer-header">
        <h3 class="lang-ar">طلبك</h3>
        <h3 class="lang-en">Your Order</h3>
        <button class="cart-close-btn">&times;</button>
      </div>
      <div class="cart-items-list"></div>
      <div class="cart-drawer-footer">
        <div class="cart-subtotal">
          <span class="lang-ar">المجموع الفرعي:</span>
          <span class="lang-en">Subtotal:</span>
          <span class="subtotal-val">0 SAR</span>
        </div>
        <form class="cart-order-form" onsubmit="handleCheckout(event)">
          <label for="table-room-num">
            <span class="lang-ar">رقم الطاولة أو الغرفة <span style="color: red;">*</span></span>
            <span class="lang-en">Table or Room Number <span style="color: red;">*</span></span>
          </label>
          <input type="text" id="table-room-num" placeholder="e.g. Table 12 / Room 204" required>
          <button type="submit" class="btn-checkout">
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path>
            </svg>
            <span class="lang-ar">إرسال الطلب عبر الواتساب</span>
            <span class="lang-en">Send Order via WhatsApp</span>
          </button>
        </form>
      </div>
    `;
    document.body.appendChild(drawer);

    // Event Listeners
    cartBtn.addEventListener('click', () => {
      drawer.classList.add('active');
      backdrop.classList.add('active');
    });

    const closeBtn = drawer.querySelector('.cart-close-btn');
    const closeCart = () => {
      drawer.classList.remove('active');
      backdrop.classList.remove('active');
    };
    closeBtn.addEventListener('click', closeCart);
    backdrop.addEventListener('click', closeCart);
  };

  // Quantity control handlers (for individual card selections)
  window.decreaseQty = (btn) => {
    const qtyValSpan = btn.nextElementSibling;
    let qty = parseInt(qtyValSpan.textContent) || 1;
    if (qty > 1) {
      qtyValSpan.textContent = qty - 1;
    }
  };

  window.increaseQty = (btn) => {
    const qtyValSpan = btn.previousElementSibling;
    let qty = parseInt(qtyValSpan.textContent) || 1;
    qtyValSpan.textContent = qty + 1;
  };

  // Add Item to Order State
  window.handleAddToCart = (btn) => {
    const id = btn.getAttribute('data-id');
    const nameAr = btn.getAttribute('data-name-ar');
    const nameEn = btn.getAttribute('data-name-en');
    const price = parseFloat(btn.getAttribute('data-price'));
    const calories = btn.getAttribute('data-calories');
    
    const qtySelector = btn.previousElementSibling;
    let qty = 1;
    if (qtySelector && qtySelector.classList.contains('quantity-selector')) {
      const qtyValSpan = qtySelector.querySelector('.qty-val');
      if (qtyValSpan) {
        qty = parseInt(qtyValSpan.textContent) || 1;
        qtyValSpan.textContent = 1; // Reset selection UI after adding
      }
    }

    const existingIndex = cart.findIndex(item => item.id === id);
    if (existingIndex > -1) {
      cart[existingIndex].qty += qty;
    } else {
      cart.push({ id, nameAr, nameEn, price, qty });
    }

    window.updateCartUI();

    // Floating Cart Trigger bounce animation feedback
    const cartBtn = document.querySelector('.floating-cart-btn');
    if (cartBtn) {
      cartBtn.style.transform = 'scale(1.2)';
      setTimeout(() => {
        cartBtn.style.transform = '';
      }, 200);
    }
  };

  // Update Drawer list display
  window.updateCartUI = () => {
    const listContainer = document.querySelector('.cart-items-list');
    const badge = document.querySelector('.cart-badge');
    const lang = document.documentElement.lang || 'ar';
    
    if (!listContainer || !badge) return;
    
    listContainer.innerHTML = '';
    
    let totalCount = 0;
    let totalPrice = 0;
    
    if (cart.length === 0) {
      listContainer.innerHTML = `
        <div class="cart-empty-msg">
          <svg fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"></path>
          </svg>
          <p class="lang-ar">سلة طلباتك فارغة</p>
          <p class="lang-en">Your order is empty</p>
        </div>
      `;
      badge.style.display = 'none';
    } else {
      cart.forEach(item => {
        totalCount += item.qty;
        totalPrice += item.price * item.qty;
        
        const itemRow = document.createElement('div');
        itemRow.className = 'cart-item-row';
        
        const priceText = lang === 'ar' 
          ? `${toArabicNum(item.price * item.qty)} ر.س` 
          : `${item.price * item.qty} SAR`;
          
        const nameText = lang === 'ar' ? item.nameAr : item.nameEn;
        
        itemRow.innerHTML = `
          <div class="cart-item-info">
            <h4>${nameText}</h4>
            <span class="cart-item-price">${priceText}</span>
          </div>
          <div class="quantity-selector">
            <button class="qty-btn" onclick="updateCartItemQty('${item.id}', -1)">−</button>
            <span class="qty-val">${item.qty}</span>
            <button class="qty-btn" onclick="updateCartItemQty('${item.id}', 1)">+</button>
          </div>
          <button class="cart-item-delete" onclick="removeFromCart('${item.id}')">&times;</button>
        `;
        listContainer.appendChild(itemRow);
      });
      
      badge.textContent = totalCount;
      badge.style.display = 'flex';
    }
    
    const subtotalValSpan = document.querySelector('.subtotal-val');
    if (subtotalValSpan) {
      if (lang === 'ar') {
        subtotalValSpan.textContent = `${toArabicNum(totalPrice)} ر.س`;
      } else {
        subtotalValSpan.textContent = `${totalPrice} SAR`;
      }
    }
    
    localStorage.setItem('oz_cart', JSON.stringify(cart));
  };

  // Adjust item quantity inside drawer
  window.updateCartItemQty = (id, change) => {
    const idx = cart.findIndex(item => item.id === id);
    if (idx > -1) {
      cart[idx].qty += change;
      if (cart[idx].qty <= 0) {
        cart.splice(idx, 1);
      }
      window.updateCartUI();
    }
  };

  // Remove individual item
  window.removeFromCart = (id) => {
    cart = cart.filter(item => item.id !== id);
    window.updateCartUI();
  };

  // Checkout redirect via WhatsApp API
  window.handleCheckout = (event) => {
    event.preventDefault();
    const roomInput = document.getElementById('table-room-num');
    if (!roomInput || cart.length === 0) return;
    
    const roomNum = roomInput.value.trim();
    const lang = document.documentElement.lang || 'ar';
    
    let message = "";
    let total = 0;
    
    if (lang === 'ar') {
      message += `*طلب جديد - أوز بارك كافيه Coffee Lounge*\n`;
      message += `------------------------------------\n`;
      message += `*رقم الطاولة / الغرفة:* ${roomNum}\n\n`;
      message += `*الطلبات:*\n`;
      cart.forEach(item => {
        const itemTotal = item.price * item.qty;
        total += itemTotal;
        message += `• ${item.nameAr} × ${item.qty} (${itemTotal} ر.س)\n`;
      });
      message += `\n*المجموع الإجمالي:* ${total} ر.س\n`;
      message += `------------------------------------`;
    } else {
      message += `*New Order - OZ Park Cafe Coffee Lounge*\n`;
      message += `------------------------------------\n`;
      message += `*Room / Table Number:* ${roomNum}\n\n`;
      message += `*Items:*\n`;
      cart.forEach(item => {
        const itemTotal = item.price * item.qty;
        total += itemTotal;
        message += `• ${item.nameEn} x ${item.qty} (${itemTotal} SAR)\n`;
      });
      message += `\n*Total Amount:* ${total} SAR\n`;
      message += `------------------------------------`;
    }
    
    const encodedText = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/966550222986?text=${encodedText}`;
    
    // Reset Cart
    cart = [];
    window.updateCartUI();
    roomInput.value = '';
    
    const drawer = document.querySelector('.cart-drawer');
    const backdrop = document.querySelector('.cart-backdrop');
    if (drawer) drawer.classList.remove('active');
    if (backdrop) backdrop.classList.remove('active');
    
    window.open(whatsappUrl, '_blank');
  };

  // Initialize Cart UI elements and load state
  injectCartUI();
  window.updateCartUI();

  // ==========================================================================
  // DYNAMIC BACKEND INTEGRATION (Live API Sync)
  // ==========================================================================
  async function syncBackendData() {
    try {
      const res = await fetch('/api/v1/public/init');
      if (!res.ok) return;
      const json = await res.json();
      if (!json.success || !json.data) return;

      const { cafe, menuItems } = json.data;

      // 1. Update Contact & Opening Hours
      if (cafe) {
        document.querySelectorAll('.cafe-phone-val').forEach(el => el.textContent = cafe.phone);
        document.querySelectorAll('.cafe-hours-ar-val').forEach(el => el.textContent = cafe.opening_hours_ar);
        document.querySelectorAll('.cafe-hours-en-val').forEach(el => el.textContent = cafe.opening_hours_en);

        if (cafe.whatsapp) {
          window.cafeWhatsApp = cafe.whatsapp.replace(/[^0-9]/g, '');
        }
      }

      // 2. Dynamic Featured Menu Grid Renderer for index.html (#menu .menu-grid)
      const homeMenuGrid = document.querySelector('#menu .menu-grid');
      if (homeMenuGrid && menuItems && Array.isArray(menuItems) && menuItems.length > 0) {
        const featuredItems = menuItems.filter(i => i.is_featured === 1 || i.is_bestseller === 1).slice(0, 6);
        const displayList = featuredItems.length > 0 ? featuredItems : menuItems.slice(0, 6);

        homeMenuGrid.innerHTML = ''; // Clear static items
        displayList.forEach(item => {
          const card = document.createElement('div');
          card.className = 'menu-card reveal active';
          const caloriesTextAr = item.calories ? `${toArabicNum(item.calories)} سعرة` : '';
          const caloriesTextEn = item.calories ? `${item.calories} kcal` : '';

          card.innerHTML = `
            <div class="menu-card-img-wrapper">
              <img src="${item.image_url}" alt="${item.name_en}" class="menu-card-img">
              <span class="menu-card-badge">
                <span class="lang-ar">${item.category_name_ar || ''}</span>
                <span class="lang-en">${item.category_name_en || ''}</span>
              </span>
            </div>
            <div class="menu-card-content">
              <div class="menu-card-title-row">
                <h3>
                  <span class="lang-ar">${item.name_ar}</span>
                  <span class="lang-en">${item.name_en}</span>
                </h3>
              </div>
              <p class="menu-card-desc lang-ar">${item.description_ar || ''}</p>
              <p class="menu-card-desc lang-en">${item.description_en || ''}</p>
              <div class="menu-card-meta">
                <span class="menu-card-price">
                  <span class="lang-ar">${toArabicNum(item.price)} ر.س</span>
                  <span class="lang-en">${item.price} SAR</span>
                </span>
                ${item.calories ? `
                  <span class="menu-card-calories">
                    <span class="lang-ar">${caloriesTextAr}</span>
                    <span class="lang-en">${caloriesTextEn}</span>
                  </span>
                ` : ''}
              </div>
              <div class="menu-card-order-row">
                <div class="quantity-selector">
                  <button class="qty-btn qty-minus" onclick="decreaseQty(this)">−</button>
                  <span class="qty-val">1</span>
                  <button class="qty-btn qty-plus" onclick="increaseQty(this)">+</button>
                </div>
                <button class="btn btn-gold btn-add-to-cart" 
                        data-id="${item.slug || item.id}" 
                        data-name-ar="${item.name_ar}" 
                        data-name-en="${item.name_en}" 
                        data-price="${item.price}" 
                        data-calories="${item.calories || 0}"
                        onclick="handleAddToCart(this)">
                  <span class="lang-ar">أضف للطلب</span>
                  <span class="lang-en">Add to Order</span>
                </button>
              </div>
            </div>
          `;

          homeMenuGrid.appendChild(card);
        });
      }

      // 3. Dynamic Full Menu Grid Renderer for menu.html (.menu-page-grid)
      const menuGridContainer = document.querySelector('.menu-page-grid');
      if (menuGridContainer && menuItems && Array.isArray(menuItems) && menuItems.length > 0) {
        menuGridContainer.innerHTML = ''; // Replace hardcoded static grid with live DB data

        menuItems.forEach(item => {
          const itemEl = document.createElement('div');
          itemEl.className = 'menu-list-item';
          itemEl.setAttribute('data-category', item.category_slug || 'hot');

          const caloriesTextAr = item.calories ? `${toArabicNum(item.calories)} سعرة` : '';
          const caloriesTextEn = item.calories ? `${item.calories} kcal` : '';

          itemEl.innerHTML = `
            <div class="menu-list-head">
              <h3>
                <span class="lang-ar">${item.name_ar}</span>
                <span class="lang-en">${item.name_en}</span>
              </h3>
            </div>
            <p class="lang-ar">${item.description_ar || ''}</p>
            <p class="lang-en">${item.description_en || ''}</p>
            <span class="menu-list-tag">
              <span class="lang-ar">${item.category_name_ar || ''}</span>
              <span class="lang-en">${item.category_name_en || ''}</span>
            </span>
            
            <div class="menu-card-meta">
              <span class="menu-card-price">
                <span class="lang-ar">${toArabicNum(item.price)} ر.س</span>
                <span class="lang-en">${item.price} SAR</span>
              </span>
              ${item.calories ? `
                <span class="menu-card-calories">
                  <span class="lang-ar">${caloriesTextAr}</span>
                  <span class="lang-en">${caloriesTextEn}</span>
                </span>
              ` : ''}
            </div>
            
            <div class="menu-card-order-row">
              <div class="quantity-selector">
                <button class="qty-btn qty-minus" onclick="decreaseQty(this)">−</button>
                <span class="qty-val">1</span>
                <button class="qty-btn qty-plus" onclick="increaseQty(this)">+</button>
              </div>
              <button class="btn btn-gold btn-add-to-cart" 
                      data-id="${item.slug || item.id}" 
                      data-name-ar="${item.name_ar}" 
                      data-name-en="${item.name_en}" 
                      data-price="${item.price}" 
                      data-calories="${item.calories || 0}"
                      onclick="handleAddToCart(this)">
                <span class="lang-ar">أضف للطلب</span>
                <span class="lang-en">Add to Order</span>
              </button>
            </div>
          `;

          menuGridContainer.appendChild(itemEl);
        });

        // Re-attach Tab filter events for dynamically created items
        const menuTabs = document.querySelectorAll('.menu-tab');
        const dynamicItems = document.querySelectorAll('.menu-list-item');
        menuTabs.forEach(tab => {
          tab.onclick = () => {
            menuTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const filterValue = tab.getAttribute('data-filter');
            dynamicItems.forEach(item => {
              const cat = item.getAttribute('data-category');
              if (filterValue === 'all' || cat === filterValue) {
                item.style.display = 'flex';
              } else {
                item.style.display = 'none';
              }
            });
          };
        });
      }
    } catch (err) {
      console.log('Backend sync active');
    }
  }

  syncBackendData();
});



