document.addEventListener('DOMContentLoaded', () => {
  // ==========================================================================
  // LANGUAGE TOGGLE SYSTEM
  // ==========================================================================
  const langSwitchButtons = document.querySelectorAll('.lang-switch');
  
  let currentLang = localStorage.getItem('preferred-lang') || 'ar';
  const isMenuPage = window.location.pathname.includes('menu.html');
  
  const applyLanguage = (lang) => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    localStorage.setItem('preferred-lang', lang);
    
    if (isMenuPage) {
      document.title = lang === 'ar' 
        ? 'قائمة المأكولات والمشروبات - أوز بارك كافيه' 
        : 'OZ Park Cafe - Premium Coffee & Beverage Menu';
    } else {
      document.title = lang === 'ar' 
        ? 'أوز بارك كافيه - تجربة قهوة فاخرة على البحر' 
        : 'OZ Park Cafe - Luxury Sea-view Coffee Lounge';
    }
    
    document.body.classList.add('lang-transition');
    setTimeout(() => {
      document.body.classList.remove('lang-transition');
    }, 400);

    if (window.updateCartUI) {
      window.updateCartUI();
    }
  };
  
  applyLanguage(currentLang);
  
  langSwitchButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      currentLang = currentLang === 'ar' ? 'en' : 'ar';
      applyLanguage(currentLang);
      
      const navMenu = document.querySelector('.nav-menu');
      const hamburger = document.querySelector('.hamburger');
      if (navMenu && navMenu.classList.contains('open')) {
        navMenu.classList.remove('open');
        hamburger.classList.remove('open');
      }
    });
  });

  // ==========================================================================
  // SCROLL REVEAL ANIMATIONS (Ensures 100% Visibility for all homepage sections)
  // ==========================================================================
  const revealElements = document.querySelectorAll('.reveal');
  revealElements.forEach(el => el.classList.add('active'));

  if ('IntersectionObserver' in window && revealElements.length > 0) {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('active');
        }
      });
    }, { threshold: 0.05 });

    revealElements.forEach(el => revealObserver.observe(el));
  }

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
    
    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        hamburger.classList.remove('open');
        navMenu.classList.remove('open');
      });
    });
  }

  // Helper for Arabic numbers
  const toArabicNum = (num) => {
    if (num === null || num === undefined) return '';
    const numStr = num.toString();
    const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    return numStr.replace(/[0-9]/g, (w) => arabicDigits[+w]);
  };

  // Helper to check if item has a custom uploaded image from backend
  const hasCustomUploadedImage = (url) => {
    if (!url) return false;
    const cleanUrl = url.trim();
    if (cleanUrl === '' || cleanUrl.includes('assets/images/coffee.jpg') || cleanUrl.includes('assets/images/fresh-juice.jpg')) {
      return false;
    }
    return cleanUrl.startsWith('data:image/') || cleanUrl.startsWith('/api/') || cleanUrl.startsWith('/uploads/') || cleanUrl.startsWith('uploads/') || cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://');
  };

  // ==========================================================================
  // SHOPPING CART & WHATSAPP CHECKOUT SYSTEM
  // ==========================================================================
  let cart = JSON.parse(localStorage.getItem('oz_cart')) || [];

  window.increaseQty = (btn) => {
    const qtyVal = btn.parentElement.querySelector('.qty-val');
    if (qtyVal) {
      let current = parseInt(qtyVal.textContent, 10) || 1;
      qtyVal.textContent = current + 1;
    }
  };

  window.decreaseQty = (btn) => {
    const qtyVal = btn.parentElement.querySelector('.qty-val');
    if (qtyVal) {
      let current = parseInt(qtyVal.textContent, 10) || 1;
      if (current > 1) {
        qtyVal.textContent = current - 1;
      }
    }
  };

  window.handleAddToCart = (btn) => {
    const id = btn.getAttribute('data-id');
    const nameAr = btn.getAttribute('data-name-ar');
    const nameEn = btn.getAttribute('data-name-en');
    const price = parseFloat(btn.getAttribute('data-price')) || 0;
    
    const qtyEl = btn.parentElement ? btn.parentElement.querySelector('.qty-val') : null;
    const qty = qtyEl ? parseInt(qtyEl.textContent, 10) || 1 : 1;

    const existingIdx = cart.findIndex(item => item.id === id);
    if (existingIdx > -1) {
      cart[existingIdx].qty += qty;
    } else {
      cart.push({ id, nameAr, nameEn, price, qty });
    }

    // Reset qty display to 1
    if (qtyEl) qtyEl.textContent = 1;

    window.updateCartUI();
    
    // Open drawer on add
    const drawer = document.querySelector('.cart-drawer');
    const backdrop = document.querySelector('.cart-backdrop');
    if (drawer) drawer.classList.add('active');
    if (backdrop) backdrop.classList.add('active');
  };

  const injectCartUI = () => {
    if (document.querySelector('.floating-cart-btn')) return;

    // Floating Cart Trigger Button
    const triggerBtn = document.createElement('div');
    triggerBtn.className = 'floating-cart-btn';
    triggerBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="9" cy="21" r="1"></circle>
        <circle cx="20" cy="21" r="1"></circle>
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
      </svg>
      <span class="cart-badge" style="display:none;">0</span>
    `;

    // Drawer HTML
    const drawerEl = document.createElement('div');
    drawerEl.className = 'cart-drawer';
    drawerEl.innerHTML = `
      <div class="cart-drawer-header">
        <h3>
          <span class="lang-ar">سلة الطلبات</span>
          <span class="lang-en">Your Order Cart</span>
        </h3>
        <button class="cart-close-btn">&times;</button>
      </div>
      
      <div class="cart-items-list"></div>
      
      <div class="cart-drawer-footer">
        <div class="cart-subtotal">
          <span>
            <span class="lang-ar">المجموع الإجمالي:</span>
            <span class="lang-en">Subtotal:</span>
          </span>
          <strong class="subtotal-val">0 SAR</strong>
        </div>
        
        <form class="cart-order-form" onsubmit="handleCheckout(event)">
          <label for="table-room-num">
            <span class="lang-ar">رقم الغرفة أو الطاولة *</span>
            <span class="lang-en">Room or Table Number *</span>
          </label>
          <input type="text" id="table-room-num" placeholder="مثال: غرفة 102 أو طاولة 5" required>
          
          <button type="submit" class="btn-checkout">
            <span>💬</span>
            <span class="lang-ar">إرسال الطلب عبر الواتساب</span>
            <span class="lang-en">Send Order via WhatsApp</span>
          </button>
        </form>
      </div>
    `;

    const backdropEl = document.createElement('div');
    backdropEl.className = 'cart-backdrop';

    document.body.appendChild(triggerBtn);
    document.body.appendChild(drawerEl);
    document.body.appendChild(backdropEl);

    // Event Listeners for drawer
    const closeBtn = drawerEl.querySelector('.cart-close-btn');
    const toggleDrawer = (open) => {
      if (open) {
        drawerEl.classList.add('active');
        backdropEl.classList.add('active');
      } else {
        drawerEl.classList.remove('active');
        backdropEl.classList.remove('active');
      }
    };

    triggerBtn.addEventListener('click', () => toggleDrawer(true));
    closeBtn.addEventListener('click', () => toggleDrawer(false));
    backdropEl.addEventListener('click', () => toggleDrawer(false));
  };

  window.updateCartUI = () => {
    const lang = document.documentElement.lang || 'ar';
    const badge = document.querySelector('.cart-badge');
    const listContainer = document.querySelector('.cart-items-list');
    
    if (!badge || !listContainer) return;
    
    let totalCount = 0;
    let totalPrice = 0;
    
    listContainer.innerHTML = '';
    
    if (cart.length === 0) {
      listContainer.innerHTML = `
        <div class="cart-empty-msg">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="9" cy="21" r="1"></circle>
            <circle cx="20" cy="21" r="1"></circle>
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
          </svg>
          <p class="lang-ar">سلتك فارغة حالياً</p>
          <p class="lang-en">Your cart is currently empty</p>
        </div>
      `;
      badge.style.display = 'none';
    } else {
      cart.forEach(item => {
        totalCount += item.qty;
        totalPrice += item.price * item.qty;
        
        const itemRow = document.createElement('div');
        itemRow.className = 'cart-item-row';
        const nameText = lang === 'ar' ? item.nameAr : item.nameEn;
        const priceText = lang === 'ar' ? `${toArabicNum(item.price * item.qty)} ر.س` : `${item.price * item.qty} SAR`;
        
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
    if (!roomNum) {
      alert(document.documentElement.lang === 'ar' ? 'يرجى إدخال رقم الغرفة أو الطاولة' : 'Please enter your Room or Table number');
      roomInput.focus();
      return;
    }

    const lang = document.documentElement.lang || 'ar';
    const whatsappNum = window.cafeWhatsApp || '966550222986';
    
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
    const whatsappUrl = `https://wa.me/${whatsappNum}?text=${encodedText}`;
    
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

      const { cafe, categories, menuItems } = json.data;

      // 1. Update Contact & Opening Hours
      if (cafe) {
        document.querySelectorAll('.cafe-phone-val').forEach(el => el.textContent = cafe.phone);
        document.querySelectorAll('.cafe-hours-ar-val').forEach(el => el.textContent = cafe.opening_hours_ar);
        document.querySelectorAll('.cafe-hours-en-val').forEach(el => el.textContent = cafe.opening_hours_en);

        if (cafe.whatsapp) {
          window.cafeWhatsApp = cafe.whatsapp.replace(/[^0-9]/g, '');
        }
      }

      // 2. Render Dynamic Categories Filter Tabs on menu.html
      const menuTabsWrapper = document.querySelector('.menu-tabs');
      if (menuTabsWrapper && categories && Array.isArray(categories) && categories.length > 0) {
        menuTabsWrapper.innerHTML = `
          <button class="menu-tab active" data-filter="all">
            <span class="lang-ar">الكل</span>
            <span class="lang-en">All Categories</span>
          </button>
          ${categories.map(c => `
            <button class="menu-tab" data-filter="${c.slug}">
              <span class="menu-tab-icon">${c.icon || '☕'}</span>
              <span class="lang-ar">${c.name_ar}</span>
              <span class="lang-en">${c.name_en}</span>
            </button>
          `).join('')}
        `;
      }

      // 3. Dynamic Featured Menu Grid Renderer for index.html (#menu .menu-grid)
      const homeMenuGrid = document.querySelector('#menu .menu-grid');
      if (homeMenuGrid && menuItems && Array.isArray(menuItems) && menuItems.length > 0) {
        const featuredItems = menuItems.filter(i => i.is_featured === 1 || i.is_bestseller === 1).slice(0, 6);
        const displayList = featuredItems.length > 0 ? featuredItems : menuItems.slice(0, 6);

        homeMenuGrid.innerHTML = '';
        displayList.forEach(item => {
          const card = document.createElement('div');
          card.className = 'menu-card reveal active';
          const caloriesTextAr = item.calories ? `${toArabicNum(item.calories)} سعرة` : '';
          const caloriesTextEn = item.calories ? `${item.calories} kcal` : '';

          const hasCustomImg = hasCustomUploadedImage(item.image_url);

          const imgHeaderHtml = hasCustomImg ? `
            <div class="menu-card-img-wrapper">
              <img src="${item.image_url}" alt="${item.name_en}" class="menu-card-img">
              <span class="menu-card-badge">
                <span class="lang-ar">${item.category_name_ar || ''}</span>
                <span class="lang-en">${item.category_name_en || ''}</span>
              </span>
            </div>
          ` : `
            <div class="menu-card-placeholder-header">
              <span class="menu-card-placeholder-icon">☕</span>
              <span class="menu-card-badge">
                <span class="lang-ar">${item.category_name_ar || ''}</span>
                <span class="lang-en">${item.category_name_en || ''}</span>
              </span>
            </div>
          `;

          card.innerHTML = `
            ${imgHeaderHtml}
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
              <div class="menu-card-footer" style="margin-top: 1rem; border-top: 1px solid rgba(27,54,93,0.06); padding-top: 0.75rem;">
                <a href="menu" class="menu-card-cta">
                  <span class="lang-ar">عرض القائمة الكاملة</span>
                  <span class="lang-en">View Full Menu</span>
                  <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>
                </a>
              </div>
            </div>
          `;

          homeMenuGrid.appendChild(card);
        });
      }

      // 4. Dynamic Full Menu Grid Renderer for menu.html (.menu-page-grid)
      const menuGridContainer = document.querySelector('.menu-page-grid');
      if (menuGridContainer && menuItems && Array.isArray(menuItems) && menuItems.length > 0) {
        menuGridContainer.innerHTML = '';

        menuItems.forEach(item => {
          const itemEl = document.createElement('div');
          itemEl.className = 'menu-list-item reveal active';
          itemEl.setAttribute('data-category', item.category_slug || 'hot');

          const caloriesTextAr = item.calories ? `${toArabicNum(item.calories)} سعرة` : '';
          const caloriesTextEn = item.calories ? `${item.calories} kcal` : '';
          const hasCustomImg = hasCustomUploadedImage(item.image_url);

          const itemImgHtml = hasCustomImg ? `
            <div class="menu-list-thumb-wrapper">
              <img src="${item.image_url}" alt="${item.name_en}" class="menu-list-thumb">
            </div>
          ` : `
            <div class="menu-list-thumb-wrapper menu-list-thumb-placeholder">
              <span class="thumb-icon">☕</span>
            </div>
          `;

          itemEl.innerHTML = `
            ${itemImgHtml}
            <div class="menu-list-details">
              <div class="menu-list-top-row">
                <div class="menu-list-info-stack">
                  <h3>
                    <span class="lang-ar">${item.name_ar}</span>
                    <span class="lang-en">${item.name_en}</span>
                  </h3>
                  <div class="menu-card-price">
                    <span class="lang-ar">${toArabicNum(item.price)} ر.س</span>
                    <span class="lang-en">${item.price} SAR</span>
                  </div>
                </div>

                <div class="menu-list-meta-stack">
                  <span class="menu-list-tag">
                    <span class="lang-ar">${item.category_name_ar || ''}</span>
                    <span class="lang-en">${item.category_name_en || ''}</span>
                  </span>
                  ${item.calories ? `
                    <span class="menu-list-calories">
                      <span class="lang-ar">${caloriesTextAr}</span>
                      <span class="lang-en">${caloriesTextEn}</span>
                    </span>
                  ` : ''}
                </div>
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

      // Re-trigger reveal active state for all elements after dynamic DOM insert
      document.querySelectorAll('.reveal').forEach(el => el.classList.add('active'));

    } catch (err) {
      console.log('Backend sync active');
    }
  }

  syncBackendData();
});
