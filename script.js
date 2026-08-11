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
              <div class="menu-list-head">
                <h3>
                  <span class="lang-ar">${item.name_ar}</span>
                  <span class="lang-en">${item.name_en}</span>
                </h3>
                <span class="menu-list-tag">
                  <span class="lang-ar">${item.category_name_ar || ''}</span>
                  <span class="lang-en">${item.category_name_en || ''}</span>
                </span>
              </div>
              <p class="lang-ar menu-desc-text">${item.description_ar || ''}</p>
              <p class="lang-en menu-desc-text">${item.description_en || ''}</p>
              
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
