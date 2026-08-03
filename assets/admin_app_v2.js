document.addEventListener('DOMContentLoaded', () => {

  const state = {
    user: null,
    lang: localStorage.getItem('oz_admin_lang') || 'ar',
    currentRoute: 'dashboard',
    categories: [],
    menuItems: [],
    pages: [],
    offers: [],
    blogPosts: [],
    mediaFiles: [],
    galleryItems: [],
    users: [],
    roles: []
  };

  const routePermissions = {
    'dashboard': 'view_dashboard',
    'pages': 'manage_pages',
    'menu': 'manage_menu',
    'offers': 'manage_offers',
    'blog': 'manage_blog',
    'seo': 'manage_seo',
    'media': 'manage_media',
    'gallery': 'manage_gallery',
    'users': 'manage_users',
    'settings': 'manage_settings',
    'activity': 'manage_users'
  };

  function hasPermission(permission) {
    if (!state.user || !state.user.permissions) return false;
    if (state.user.permissions.includes('*')) return true;
    return state.user.permissions.includes(permission);
  }

  // Helper API Fetcher
  async function api(endpoint, options = {}) {
    options.headers = options.headers || {};
    if (!(options.body instanceof FormData)) {
      options.headers['Content-Type'] = 'application/json';
    }

    try {
      const res = await fetch(`/api/v1${endpoint}`, options);
      const data = await res.json();

      if (res.status === 401 && endpoint !== '/auth/login') {
        showLoginView();
        throw new Error(state.lang === 'ar' ? 'انتهت الجلسة' : 'Session expired');
      }

      if (!res.ok) {
        throw new Error(data.error || (state.lang === 'ar' ? 'حدث خطأ في النظام' : 'Server error'));
      }

      return data;
    } catch (err) {
      console.error(`API Error [${endpoint}]:`, err);
      throw err;
    }
  }

  // Toast Notification System
  function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'error' ? 'toast-danger' : ''}`;
    toast.innerHTML = `
      <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg>
      <span>${message}</span>
    `;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // Modal Dialog System
  function openModal(title, bodyHtml, footerHtml = '') {
    const backdrop = document.getElementById('modal-backdrop');
    const card = document.getElementById('modal-card');

    card.innerHTML = `
      <div class="modal-header">
        <h3>${title}</h3>
        <button class="btn btn-outline btn-sm" id="close-modal-btn">&times;</button>
      </div>
      <div class="modal-body">${bodyHtml}</div>
      ${footerHtml ? `<div class="modal-footer">${footerHtml}</div>` : ''}
    `;

    backdrop.classList.add('active');
    document.getElementById('close-modal-btn').addEventListener('click', closeModal);
  }

  function closeModal() {
    document.getElementById('modal-backdrop').classList.remove('active');
  }

  window.closeModal = closeModal;

  // Language System Switcher
  function applyLanguage(lang) {
    state.lang = lang;
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    localStorage.setItem('oz_admin_lang', lang);
  }

  document.getElementById('admin-lang-switch').addEventListener('click', () => {
    applyLanguage(state.lang === 'ar' ? 'en' : 'ar');
    renderRoute(state.currentRoute);
  });

  // Auth Views
  function showLoginView() {
    document.getElementById('login-view').style.display = 'flex';
    document.getElementById('admin-app').style.display = 'none';
  }

  function showAdminApp() {
    document.getElementById('login-view').style.display = 'none';
    document.getElementById('admin-app').style.display = 'flex';

    if (state.user) {
      document.getElementById('user-display-name').textContent = state.user.name;
      document.getElementById('user-display-role').textContent = state.user.roleName;
      document.getElementById('user-avatar-text').textContent = state.user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

      // STRICT RBAC VISIBILITY ENFORCEMENT: Completely hide unauthorized modules from navigation
      document.querySelectorAll('.sidebar-menu a[data-route]').forEach(link => {
        const route = link.getAttribute('data-route');
        const perm = routePermissions[route];
        const li = link.closest('li');

        if (perm && !hasPermission(perm)) {
          if (li) li.style.display = 'none';
        } else {
          if (li) li.style.display = '';
        }
      });

      // Hide section labels if all items in section are hidden
      document.querySelectorAll('.sidebar-nav .nav-section-label').forEach(label => {
        const nextUl = label.nextElementSibling;
        if (nextUl && nextUl.tagName === 'UL') {
          const visibleItems = nextUl.querySelectorAll('li:not([style*="display: none"])');
          label.style.display = visibleItems.length === 0 ? 'none' : '';
        }
      });
    }
  }

  async function checkAuth() {
    try {
      const data = await api('/auth/me');
      if (data.success) {
        state.user = data.user;
        showAdminApp();
        handleHashRoute();
      } else {
        showLoginView();
      }
    } catch (e) {
      showLoginView();
    }
  }

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');
    errorEl.style.display = 'none';

    try {
      const data = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });

      if (data.success) {
        state.user = data.user;
        showAdminApp();
        showToast(state.lang === 'ar' ? 'تم تسجيل الدخول بنجاح' : 'Logged in successfully');

        // Redirect to first permitted route
        const firstRoute = Object.keys(routePermissions).find(r => hasPermission(routePermissions[r])) || 'dashboard';
        window.location.hash = `#/${firstRoute}`;
        handleHashRoute();
      }
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.style.display = 'block';
    }
  });

  document.getElementById('logout-btn').addEventListener('click', async () => {
    try { await api('/auth/logout', { method: 'POST' }); } catch (e) {}
    showLoginView();
  });

  document.getElementById('toggle-sidebar-btn').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });

  function handleHashRoute() {
    const hash = window.location.hash || '#/dashboard';
    const route = hash.replace('#/', '').split('/')[0] || 'dashboard';

    // Route Permission Check & Auto Redirect
    const requiredPerm = routePermissions[route];
    if (requiredPerm && !hasPermission(requiredPerm)) {
      const allowedRoute = Object.keys(routePermissions).find(r => hasPermission(routePermissions[r]));
      if (allowedRoute) {
        state.currentRoute = allowedRoute;
        window.location.hash = `#/${allowedRoute}`;
        renderRoute(allowedRoute);
        return;
      }
    }

    state.currentRoute = route;

    document.querySelectorAll('.sidebar-menu a').forEach(a => {
      a.classList.toggle('active', a.getAttribute('data-route') === route);
    });

    renderRoute(route);
  }

  window.addEventListener('hashchange', handleHashRoute);

  function renderRoute(route) {
    const viewport = document.getElementById('app-viewport');
    const requiredPerm = routePermissions[route];

    // Access Denied Protection
    if (requiredPerm && !hasPermission(requiredPerm)) {
      renderAccessDenied(viewport);
      return;
    }

    viewport.innerHTML = `<div style="padding: 3rem; text-align: center; color: var(--color-navy);">${state.lang === 'ar' ? 'جاري التحميل...' : 'Loading...'}</div>`;

    switch (route) {
      case 'dashboard': renderDashboard(viewport); break;
      case 'pages': renderPages(viewport); break;
      case 'menu': renderMenu(viewport); break;
      case 'offers': renderOffers(viewport); break;
      case 'blog': renderBlog(viewport); break;
      case 'seo': renderSeo(viewport); break;
      case 'media': renderMedia(viewport); break;
      case 'gallery': renderGallery(viewport); break;
      case 'users': renderUsers(viewport); break;
      case 'settings': renderSettings(viewport); break;
      case 'activity': renderActivity(viewport); break;
      default: renderDashboard(viewport);
    }
  }

  function renderAccessDenied(container) {
    const isAr = state.lang === 'ar';
    container.innerHTML = `
      <div class="panel-card" style="padding: 4rem 2rem; text-align: center; margin-top: 2rem;">
        <svg width="64" height="64" fill="none" stroke="var(--color-gold-dark)" stroke-width="1.5" viewBox="0 0 24 24" style="margin-bottom: 1rem;"><path d="M12 15v2m0-8v4m9 1a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        <h2 style="color: var(--color-navy); margin-bottom: 0.5rem;">${isAr ? 'تم رفض الوصول (غير مصرح)' : 'Access Denied (Unauthorized)'}</h2>
        <p style="color: var(--color-charcoal-light); font-size: 0.95rem; max-width: 480px; margin: 0 auto 1.5rem;">${isAr ? 'ليس لديك الصلاحية المطلوبة لعرض هذه الصفحة. تم تقييد الوصول حسب أدوار المستخدمين.' : 'You do not have the required permissions to view this section. Access is restricted based on user roles.'}</p>
        <button class="btn btn-navy" onclick="window.location.hash='#/${Object.keys(routePermissions).find(r => hasPermission(routePermissions[r])) || 'dashboard'}'">${isAr ? 'العودة للصفحة المسموحة' : 'Return to Permitted Section'}</button>
      </div>
    `;
  }

  // ==========================================================================
  // VIEW 1: MAIN DASHBOARD OVERVIEW
  // ==========================================================================
  async function renderDashboard(container) {
    try {
      const data = await api('/dashboard/stats');
      const stats = data.data;
      const isAr = state.lang === 'ar';

      container.innerHTML = `
        <div class="page-header">
          <div class="page-title">
            <h1>${isAr ? 'نظرة عامة على المقهى' : 'Café Dashboard Overview'}</h1>
            <p>${isAr ? 'إحصائيات مباشرة وأنشطة وتنبيهات أوز بارك كافيه' : 'Real-time performance metrics and café activities'}</p>
          </div>
          ${hasPermission('manage_menu') ? `
            <div class="header-actions">
              <button class="btn btn-gold" id="btn-quick-add-menu">
                <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4"/></svg>
                <span>${isAr ? 'إضافة صنف جديد' : 'Add Menu Item'}</span>
              </button>
            </div>
          ` : ''}
        </div>

        <div class="card-grid">
          <div class="stat-card">
            <div class="stat-info">
              <div class="number">${stats.menu.total}</div>
              <div class="label">${isAr ? 'إجمالي عناصر القائمة' : 'Total Menu Items'}</div>
            </div>
            <div class="stat-icon">☕</div>
          </div>
          <div class="stat-card">
            <div class="stat-info">
              <div class="number" style="color: #27ae60;">${stats.menu.active}</div>
              <div class="label">${isAr ? 'عناصر متوفرة' : 'Active Items'}</div>
            </div>
            <div class="stat-icon" style="background: rgba(46,204,113,0.15); color: #27ae60;">✓</div>
          </div>
          <div class="stat-card">
            <div class="stat-info">
              <div class="number" style="color: #e67e22;">${stats.menu.categories}</div>
              <div class="label">${isAr ? 'تصنيفات القائمة' : 'Categories'}</div>
            </div>
            <div class="stat-icon" style="background: rgba(230,126,34,0.15); color: #e67e22;">📂</div>
          </div>
          ${hasPermission('manage_seo') ? `
            <div class="stat-card">
              <div class="stat-info">
                <div class="number" style="color: ${stats.seoIssues.totalIssues > 0 ? '#e74c3c' : '#27ae60'};">${stats.seoIssues.totalIssues}</div>
                <div class="label">${isAr ? 'تنبيهات محركات البحث' : 'SEO Audit Alerts'}</div>
              </div>
              <div class="stat-icon" style="background: rgba(231,76,60,0.15); color: #e74c3c;">🔍</div>
            </div>
          ` : ''}
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 1.5rem;">
          ${hasPermission('manage_menu') ? `
            <div class="panel-card">
              <div class="panel-header">
                <h3>${isAr ? 'أحدث الأصناف بالقائمة' : 'Recent Menu Items'}</h3>
                <a href="#/menu" class="btn btn-outline btn-sm">${isAr ? 'عرض الكل' : 'View All'}</a>
              </div>
              <div class="panel-body" style="padding: 0;">
                <table class="admin-table">
                  <thead>
                    <tr>
                      <th>${isAr ? 'الصنف' : 'Item'}</th>
                      <th>${isAr ? 'التصنيف' : 'Category'}</th>
                      <th>${isAr ? 'السعر' : 'Price'}</th>
                      <th>${isAr ? 'الحالة' : 'Status'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${stats.recentMenuItems.map(m => `
                      <tr>
                        <td><strong>${isAr ? m.name_ar : m.name_en}</strong></td>
                        <td>${m.category_name || '-'}</td>
                        <td><strong>${m.price} ${isAr ? 'ر.س' : 'SAR'}</strong></td>
                        <td>
                          <span class="badge ${m.availability_status === 'available' ? 'badge-success' : 'badge-danger'}">
                            ${m.availability_status === 'available' ? (isAr ? 'متوفر' : 'Available') : (isAr ? 'غير متوفر' : 'Unavailable')}
                          </span>
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          ` : ''}

          ${hasPermission('manage_users') ? `
            <div class="panel-card">
              <div class="panel-header">
                <h3>${isAr ? 'سجل العمليات الأخير' : 'Recent Activity Log'}</h3>
                <a href="#/activity" class="btn btn-outline btn-sm">${isAr ? 'عرض سجل النشاط' : 'Full Log'}</a>
              </div>
              <div class="panel-body">
                <ul style="list-style: none; padding: 0;">
                  ${stats.recentActivity.map(a => `
                    <li style="padding: 0.6rem 0; border-bottom: 1px solid var(--color-cream-dark); font-size: 0.85rem;">
                      <div style="font-weight: 600; color: var(--color-navy);">${a.action}</div>
                      <div style="color: var(--color-charcoal-light);">${a.details || ''}</div>
                      <div style="font-size: 0.75rem; color: #95a5a6;">${a.user_email} • ${new Date(a.created_at).toLocaleString()}</div>
                    </li>
                  `).join('')}
                </ul>
              </div>
            </div>
          ` : ''}
        </div>
      `;

      if (hasPermission('manage_menu')) {
        const btnQuickAdd = document.getElementById('btn-quick-add-menu');
        if (btnQuickAdd) btnQuickAdd.addEventListener('click', () => window.location.hash = '#/menu');
      }

    } catch (e) {
      container.innerHTML = `<div class="badge badge-danger">${state.lang === 'ar' ? 'فشل تحميل إحصائيات الإدارة' : 'Failed to load stats'}</div>`;
    }
  }

  // ==========================================================================
  // VIEW 2: CMS PAGES & SECTIONS EDITOR
  // ==========================================================================
  async function renderPages(container) {
    try {
      const data = await api('/pages');
      state.pages = data.data;
      const isAr = state.lang === 'ar';

      container.innerHTML = `
        <div class="page-header">
          <div class="page-title">
            <h1>${isAr ? 'محرر صفحات الموقع (CMS)' : 'CMS Page & Section Editor'}</h1>
            <p>${isAr ? 'تعديل محتوى وتفاصيل ونصوص صفحات أوز بارك كافيه' : 'Edit titles, headings, and sections of existing pages'}</p>
          </div>
        </div>

        <div class="panel-card">
          <div class="panel-header">
            <h3>${isAr ? 'صفحات الموقع' : 'Website Pages'}</h3>
          </div>
          <div class="panel-body" style="padding: 0;">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>${isAr ? 'عنوان الصفحة' : 'Page Title'}</th>
                  <th>${isAr ? 'الرابط (Slug)' : 'URL Slug'}</th>
                  <th>${isAr ? 'الحالة' : 'Status'}</th>
                  <th>${isAr ? 'آخر تحديث' : 'Last Updated'}</th>
                  <th>${isAr ? 'إجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                ${state.pages.map(p => `
                  <tr>
                    <td><strong>${isAr ? p.title_ar : p.title_en}</strong></td>
                    <td><code>/${p.slug}</code></td>
                    <td><span class="badge ${p.status === 'published' ? 'badge-success' : 'badge-warning'}">${p.status}</span></td>
                    <td>${new Date(p.updated_at).toLocaleDateString()}</td>
                    <td>
                      <button class="btn btn-navy btn-sm edit-page-btn" data-slug="${p.slug}">
                        ${isAr ? 'تعديل الأقسام' : 'Edit Sections'}
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;

      container.querySelectorAll('.edit-page-btn').forEach(btn => {
        btn.addEventListener('click', () => openPageEditorModal(btn.getAttribute('data-slug')));
      });

    } catch (e) {
      container.innerHTML = `<div class="badge badge-danger">${state.lang === 'ar' ? 'فشل تحميل الصفحات' : 'Failed to load pages'}</div>`;
    }
  }

  async function openPageEditorModal(slug) {
    try {
      const data = await api(`/pages/${slug}`);
      const page = data.data;
      const isAr = state.lang === 'ar';

      const bodyHtml = `
        <form id="page-editor-form">
          <div class="form-group">
            <label>${isAr ? 'عنوان الصفحة (بالعربية)' : 'Page Title (Arabic)'}</label>
            <input type="text" id="edit-page-title-ar" class="form-control" value="${page.title_ar}">
          </div>
          <div class="form-group">
            <label>${isAr ? 'عنوان الصفحة (بالإنجليزية)' : 'Page Title (English)'}</label>
            <input type="text" id="edit-page-title-en" class="form-control" value="${page.title_en}">
          </div>

          <h4 style="margin: 1.5rem 0 1rem; color: var(--color-gold-dark);">${isAr ? 'أقسام الصفحة' : 'Page Sections'}</h4>
          ${page.sections.map(sec => `
            <div style="background: var(--color-cream); padding: 1rem; border-radius: 8px; margin-bottom: 1rem; border: 1px solid var(--color-cream-dark);">
              <h5 style="margin-bottom: 0.5rem; color: var(--color-navy);">${isAr ? 'قسم:' : 'Section:'} ${sec.section_key}</h5>
              <input type="hidden" class="sec-id" value="${sec.id}">
              <div class="form-group">
                <label>${isAr ? 'العنوان الرئيسي (بالعربية)' : 'Heading (Arabic)'}</label>
                <input type="text" class="form-control sec-title-ar" value="${sec.title_ar || ''}">
              </div>
              <div class="form-group">
                <label>${isAr ? 'العنوان الرئيسي (English)' : 'Heading (English)'}</label>
                <input type="text" class="form-control sec-title-en" value="${sec.title_en || ''}">
              </div>
              <div class="form-group">
                <label>${isAr ? 'النص والوصف (بالعربية)' : 'Content (Arabic)'}</label>
                <textarea class="form-control sec-content-ar">${sec.content_ar || ''}</textarea>
              </div>
              <div class="form-group">
                <label>${isAr ? 'النص والوصف (English)' : 'Content (English)'}</label>
                <textarea class="form-control sec-content-en">${sec.content_en || ''}</textarea>
              </div>
            </div>
          `).join('')}
        </form>
      `;

      const footerHtml = `
        <button class="btn btn-outline" onclick="closeModal()">${isAr ? 'إلغاء' : 'Cancel'}</button>
        <button class="btn btn-gold" id="save-page-sections-btn">${isAr ? 'حفظ التعديلات' : 'Save Changes'}</button>
      `;

      openModal(`${isAr ? 'تعديل صفحة:' : 'Edit Page:'} ${isAr ? page.title_ar : page.title_en}`, bodyHtml, footerHtml);

      document.getElementById('save-page-sections-btn').addEventListener('click', async () => {
        const sectionsData = [];
        document.querySelectorAll('#page-editor-form .sec-id').forEach(el => {
          const parent = el.closest('div');
          sectionsData.push({
            id: parseInt(el.value),
            title_ar: parent.querySelector('.sec-title-ar').value,
            title_en: parent.querySelector('.sec-title-en').value,
            content_ar: parent.querySelector('.sec-content-ar').value,
            content_en: parent.querySelector('.sec-content-en').value
          });
        });

        try {
          await api(`/pages/${slug}`, {
            method: 'PUT',
            body: JSON.stringify({
              title_ar: document.getElementById('edit-page-title-ar').value,
              title_en: document.getElementById('edit-page-title-en').value,
              sections: sectionsData
            })
          });
          showToast(isAr ? 'تم حفظ التعديلات بنجاح' : 'Page sections updated');
          closeModal();
          renderPages(document.getElementById('app-viewport'));
        } catch (err) {
          showToast(err.message, 'error');
        }
      });

    } catch (err) {
      showToast(state.lang === 'ar' ? 'فشل فتح محرر الصفحة' : 'Failed to open page editor', 'error');
    }
  }

  // ==========================================================================
  // VIEW 3: CAFÉ MENU MANAGEMENT (FULL PRODUCT IMAGE & CATEGORY MANAGEMENT)
  // ==========================================================================
  async function renderMenu(container) {
    try {
      const [catData, itemData] = await Promise.all([
        api('/menu/categories'),
        api('/menu/items')
      ]);

      state.categories = catData.data;
      state.menuItems = itemData.data;
      const isAr = state.lang === 'ar';

      container.innerHTML = `
        <div class="page-header">
          <div class="page-title">
            <h1>${isAr ? 'إدارة قائمة مشروبات وحلويات المقهى' : 'Café Menu Manager'}</h1>
            <p>${isAr ? 'إدارة الأصناف، تصفية بالتصنيفات، وتعديل وتصنيف المنتجات' : 'Filter by category, edit item details, upload photos, and manage categories'}</p>
          </div>
          <div class="header-actions" style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <button class="btn btn-navy" id="manage-categories-btn">
              <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 6h16M4 10h16M4 14h16M4 18h16"/></svg>
              <span>${isAr ? 'إدارة التصنيفات' : 'Manage Categories'}</span>
            </button>
            <button class="btn btn-gold" id="add-menu-item-btn">
              <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4"/></svg>
              <span>${isAr ? '+ إضافة صنف جديد' : '+ Add New Item'}</span>
            </button>
          </div>
        </div>

        <div class="panel-card">
          <div class="panel-header" style="flex-wrap: wrap; gap: 1rem; align-items: center;">
            <!-- SEARCH INPUT -->
            <div class="filter-bar" style="margin: 0; flex: 1; min-width: 200px;">
              <div class="search-box">
                <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                <input type="text" id="search-menu-input" class="form-control" placeholder="${isAr ? 'بحث عن صنف...' : 'Search items...'}">
              </div>
            </div>

            <!-- CATEGORY FILTER DROPDOWN IN TOOLBAR -->
            <div style="display: flex; align-items: center; gap: 0.5rem; min-width: 260px;">
              <label style="font-weight: 700; white-space: nowrap; color: var(--color-navy); margin: 0;">${isAr ? 'التصنيف:' : 'Category:'}</label>
              <select id="category-filter-select" class="form-control" style="font-weight: 600;">
                <option value="all">${isAr ? '📁 جميع التصنيفات (All)' : '📁 All Categories'}</option>
                ${state.categories.map(c => `<option value="${c.id}">${c.icon || '☕'} ${isAr ? c.name_ar : c.name_en} (${c.item_count || 0})</option>`).join('')}
              </select>
            </div>
          </div>

          <div class="panel-body" style="padding: 0;">
            <table class="admin-table" id="menu-items-table">
              <thead>
                <tr>
                  <th>${isAr ? 'الصنف والصورة' : 'Item & Image'}</th>
                  <th style="min-width: 220px;">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                      <span>${isAr ? 'التصنيف' : 'Category'}</span>
                      <select id="th-category-filter-select" class="form-control form-control-sm" style="font-size: 0.8rem; padding: 2px 6px; border: 1px solid var(--color-gold); font-weight: 600;">
                        <option value="all">${isAr ? 'الكل' : 'All'}</option>
                        ${state.categories.map(c => `<option value="${c.id}">${c.icon || '☕'} ${isAr ? c.name_ar : c.name_en}</option>`).join('')}
                      </select>
                    </div>
                  </th>
                  <th>${isAr ? 'السعر' : 'Price'}</th>
                  <th>${isAr ? 'السعرات' : 'Calories'}</th>
                  <th>${isAr ? 'التوفر' : 'Availability'}</th>
                  <th>${isAr ? 'إجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                ${state.menuItems.map(item => {
                  const hasCustomImg = item.image_url && (item.image_url.startsWith('/uploads/') || item.image_url.startsWith('uploads/') || item.image_url.startsWith('http'));
                  const imgBoxHtml = hasCustomImg ? `
                    <div style="position: relative; width: 46px; height: 46px;">
                      <img src="${item.image_url}" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';" style="width: 46px; height: 46px; border-radius: 8px; object-fit: cover; border: 1px solid var(--color-cream-dark);" alt="">
                      <div style="display: none; width: 46px; height: 46px; border-radius: 8px; background: var(--color-cream); align-items: center; justify-content: center; font-size: 1.25rem; border: 1px solid var(--color-cream-dark);">☕</div>
                    </div>
                  ` : `
                    <div style="width: 46px; height: 46px; border-radius: 8px; background: var(--color-cream); display: flex; align-items: center; justify-content: center; font-size: 1.25rem; border: 1px solid var(--color-cream-dark);">☕</div>
                  `;

                  return `
                    <tr data-name="${(item.name_ar + ' ' + item.name_en).toLowerCase()}" data-category-id="${item.category_id}">
                      <td>
                        <div style="display: flex; align-items: center; gap: 0.75rem;">
                          ${imgBoxHtml}
                          <div>
                            <div style="font-weight: 700; color: var(--color-navy);">${isAr ? item.name_ar : item.name_en}</div>
                            <div style="font-size: 0.75rem; color: var(--color-charcoal-light);">${isAr ? (item.description_ar || '') : (item.description_en || '')}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem;">
                          <span class="badge badge-info" style="font-size: 0.85rem;">${isAr ? (item.category_name_ar || 'غير مصنف') : (item.category_name_en || 'Uncategorized')}</span>
                          ${item.category_id ? `
                            <div style="display: flex; gap: 0.25rem;">
                              <button class="btn btn-navy btn-xs direct-edit-cat-btn" data-id="${item.category_id}" title="${isAr ? 'تعديل هذا التصنيف' : 'Edit this category'}">✏️</button>
                              <button class="btn btn-danger btn-xs direct-delete-cat-btn" data-id="${item.category_id}" title="${isAr ? 'حذف هذا التصنيف' : 'Delete this category'}">🗑️</button>
                            </div>
                          ` : ''}
                        </div>
                      </td>
                      <td><strong>${item.price} ${isAr ? 'ر.س' : 'SAR'}</strong></td>
                      <td>${item.calories ? item.calories + (isAr ? ' سعرة' : ' kcal') : '-'}</td>
                      <td>
                        <button class="btn btn-sm toggle-avail-btn ${item.availability_status === 'available' ? 'btn-gold' : 'btn-outline'}" data-id="${item.id}" data-status="${item.availability_status}">
                          ${item.availability_status === 'available' ? (isAr ? 'متوفر' : 'Available') : (isAr ? 'غير متوفر' : 'Unavailable')}
                        </button>
                      </td>
                      <td>
                        <button class="btn btn-navy btn-sm edit-item-btn" data-id="${item.id}">${isAr ? 'تعديل' : 'Edit'}</button>
                        <button class="btn btn-danger btn-sm delete-item-btn" data-id="${item.id}">${isAr ? 'حذف' : 'Delete'}</button>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;

      // Filter Logic Handler
      const filterItems = () => {
        const searchVal = document.getElementById('search-menu-input').value.toLowerCase();
        const selectedCat = document.getElementById('category-filter-select').value;

        document.querySelectorAll('#menu-items-table tbody tr').forEach(tr => {
          const nameText = tr.getAttribute('data-name');
          const catId = tr.getAttribute('data-category-id');

          const matchesSearch = nameText.includes(searchVal);
          const matchesCat = selectedCat === 'all' || catId === selectedCat;

          tr.style.display = (matchesSearch && matchesCat) ? '' : 'none';
        });
      };

      // Sync both category dropdowns
      const catSelect = document.getElementById('category-filter-select');
      const thCatSelect = document.getElementById('th-category-filter-select');

      catSelect.addEventListener('change', (e) => {
        thCatSelect.value = e.target.value;
        filterItems();
      });

      thCatSelect.addEventListener('change', (e) => {
        catSelect.value = e.target.value;
        filterItems();
      });

      document.getElementById('search-menu-input').addEventListener('input', filterItems);

      document.getElementById('add-menu-item-btn').addEventListener('click', () => openMenuItemModal());
      document.getElementById('manage-categories-btn').addEventListener('click', () => openManageCategoriesModal());

      // Direct Category Edit/Delete from row buttons
      container.querySelectorAll('.direct-edit-cat-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const catId = btn.getAttribute('data-id');
          const cat = state.categories.find(x => x.id == catId);
          if (cat) openCategoryModal(cat);
        });
      });

      container.querySelectorAll('.direct-delete-cat-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const catId = btn.getAttribute('data-id');
          const cat = state.categories.find(x => x.id == catId);
          if (cat) openDeleteCategoryModal(cat, cat.item_count || 0);
        });
      });

      // Item Actions
      container.querySelectorAll('.toggle-avail-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-id');
          const curr = btn.getAttribute('data-status');
          const nextStatus = curr === 'available' ? 'unavailable' : 'available';

          try {
            await api(`/menu/items/${id}/availability`, {
              method: 'PATCH',
              body: JSON.stringify({ status: nextStatus })
            });
            showToast(isAr ? 'تم تحديث توفر الصنف' : 'Availability status updated');
            renderMenu(container);
          } catch (err) {
            showToast(err.message, 'error');
          }
        });
      });

      container.querySelectorAll('.edit-item-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const item = state.menuItems.find(x => x.id == btn.getAttribute('data-id'));
          if (item) openMenuItemModal(item);
        });
      });

      container.querySelectorAll('.delete-item-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (confirm(isAr ? 'هل أنت تأكد من إزالة هذا الصنف من القائمة؟' : 'Are you sure you want to delete this menu item?')) {
            try {
              await api(`/menu/items/${btn.getAttribute('data-id')}`, { method: 'DELETE' });
              showToast(isAr ? 'تم حذف الصنف بنجاح' : 'Menu item deleted');
              renderMenu(container);
            } catch (err) {
              showToast(err.message, 'error');
            }
          }
        });
      });

    } catch (e) {
      container.innerHTML = `<div class="badge badge-danger">${state.lang === 'ar' ? 'فشل تحميل قائمة الأصناف' : 'Failed to load menu items'}</div>`;
    }
  }

  // ==========================================================================
  // REQUIREMENT 2: FULL CATEGORY MANAGEMENT MODALS & ACTIONS
  // ==========================================================================
  async function openManageCategoriesModal() {
    const isAr = state.lang === 'ar';

    try {
      const data = await api('/menu/categories');
      state.categories = data.data;

      const bodyHtml = `
        <div style="margin-bottom: 1.25rem; display: flex; justify-content: space-between; align-items: center;">
          <h4 style="color: var(--color-navy); margin: 0;">${isAr ? 'قائمة تصنيفات المقهى' : 'Café Categories List'}</h4>
          <button class="btn btn-gold btn-sm" id="btn-create-new-cat">${isAr ? '+ تصنيف جديد' : '+ Add New Category'}</button>
        </div>

        <div style="max-height: 400px; overflow-y: auto;">
          <table class="admin-table">
            <thead>
              <tr>
                <th>${isAr ? 'الأيقونة والتصنيف' : 'Icon & Name'}</th>
                <th>${isAr ? 'عدد الأصناف' : 'Items Count'}</th>
                <th>${isAr ? 'إجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              ${state.categories.map(c => `
                <tr>
                  <td>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                      <span style="font-size: 1.25rem;">${c.icon || '☕'}</span>
                      <div>
                        <strong>${isAr ? c.name_ar : c.name_en}</strong>
                        <div style="font-size: 0.75rem; color: var(--color-charcoal-light);">${isAr ? c.name_en : c.name_ar}</div>
                      </div>
                    </div>
                  </td>
                  <td><span class="badge badge-info">${c.item_count || 0} ${isAr ? 'صنف' : 'items'}</span></td>
                  <td>
                    <button class="btn btn-navy btn-sm edit-cat-btn" data-id="${c.id}">${isAr ? 'تعديل / إعادة تسمية' : 'Edit / Rename'}</button>
                    <button class="btn btn-danger btn-sm delete-cat-btn" data-id="${c.id}" data-count="${c.item_count || 0}">${isAr ? 'حذف' : 'Delete'}</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;

      const footerHtml = `<button class="btn btn-outline" onclick="closeModal()">${isAr ? 'إغلاق' : 'Close'}</button>`;

      openModal(isAr ? 'إدارة تصنيفات المأكولات والمشروبات' : 'Category Management', bodyHtml, footerHtml);

      document.getElementById('btn-create-new-cat').addEventListener('click', () => openCategoryModal());

      document.querySelectorAll('.edit-cat-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const cat = state.categories.find(x => x.id == btn.getAttribute('data-id'));
          if (cat) openCategoryModal(cat);
        });
      });

      document.querySelectorAll('.delete-cat-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const cat = state.categories.find(x => x.id == btn.getAttribute('data-id'));
          const count = parseInt(btn.getAttribute('data-count') || '0');
          if (cat) openDeleteCategoryModal(cat, count);
        });
      });

    } catch (err) {
      showToast(isAr ? 'فشل تحميل التصنيفات' : 'Failed to load categories', 'error');
    }
  }

  function openCategoryModal(category = null) {
    const isAr = state.lang === 'ar';
    const bodyHtml = `
      <div style="margin-bottom: 1.25rem; background: var(--color-cream); padding: 1rem; border-radius: 8px; border: 1px solid var(--color-cream-dark);">
        <label style="font-weight: 700; color: var(--color-navy); margin-bottom: 0.5rem; display: block;">
          ${isAr ? 'التصنيفات الحالية في المقهى (اضغط تعديل لتغيير الاسم أو حذف للحذف)' : 'Existing Café Categories (Click Edit to Rename or Delete)'}
        </label>
        <div style="max-height: 180px; overflow-y: auto;">
          <table class="admin-table" style="margin: 0; background: #fff;">
            <thead>
              <tr>
                <th>${isAr ? 'التصنيف' : 'Category'}</th>
                <th>${isAr ? 'الأصناف' : 'Items'}</th>
                <th>${isAr ? 'إجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              ${state.categories.map(c => `
                <tr style="${category && category.id === c.id ? 'background: #fff8e7;' : ''}">
                  <td>
                    <strong>${c.icon || '☕'} ${isAr ? c.name_ar : c.name_en}</strong>
                    <div style="font-size: 0.75rem; color: var(--color-charcoal-light);">${isAr ? c.name_en : c.name_ar}</div>
                  </td>
                  <td><span class="badge badge-info">${c.item_count || 0}</span></td>
                  <td>
                    <button type="button" class="btn btn-navy btn-xs modal-edit-cat-btn" data-id="${c.id}">${isAr ? 'تعديل / تغيير الاسم' : 'Edit / Rename'}</button>
                    <button type="button" class="btn btn-danger btn-xs modal-delete-cat-btn" data-id="${c.id}" data-count="${c.item_count || 0}">${isAr ? 'حذف' : 'Delete'}</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <form id="category-modal-form">
        <h5 style="color: var(--color-navy); margin-bottom: 0.75rem;" id="cat-form-title">
          ${category ? (isAr ? `تعديل التصنيف: ${category.name_ar}` : `Edit Category: ${category.name_en}`) : (isAr ? '+ إضافة تصنيف جديد' : '+ Add New Category')}
        </h5>

        <div class="form-group">
          <label>${isAr ? 'اسم التصنيف (بالعربية) *' : 'Category Name (Arabic) *'}</label>
          <input type="text" id="cat-name-ar" class="form-control" required value="${category ? category.name_ar : ''}" placeholder="مثال: مشروبات مثلجة">
        </div>
        <div class="form-group">
          <label>${isAr ? 'اسم التصنيف (English) *' : 'Category Name (English) *'}</label>
          <input type="text" id="cat-name-en" class="form-control" required value="${category ? category.name_en : ''}" placeholder="e.g. Blended Frappes">
        </div>
        <div class="form-group">
          <label>${isAr ? 'أيقونة التصنيف' : 'Category Icon'}</label>
          <input type="text" id="cat-icon" class="form-control" value="${category ? (category.icon || '☕') : '☕'}">
        </div>
        <div class="form-group">
          <label>${isAr ? 'ترتيب العرض' : 'Display Order'}</label>
          <input type="number" id="cat-order" class="form-control" value="${category ? category.display_order : '0'}">
        </div>
      </form>
    `;

    const footerHtml = `
      <button class="btn btn-outline" onclick="closeModal()">${isAr ? 'إلغاء' : 'Cancel'}</button>
      <button class="btn btn-gold" id="save-cat-btn">${category ? (isAr ? 'حفظ التعديلات' : 'Save Changes') : (isAr ? 'حفظ التصنيف' : 'Save Category')}</button>
    `;

    openModal(isAr ? 'إدارة وتعديل تصنيفات المأكولات والمشروبات' : 'Category Management & Editing', bodyHtml, footerHtml);

    // Bind Edit/Rename buttons inside modal
    document.querySelectorAll('.modal-edit-cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const catId = btn.getAttribute('data-id');
        const cat = state.categories.find(x => x.id == catId);
        if (cat) openCategoryModal(cat);
      });
    });

    // Bind Delete buttons inside modal
    document.querySelectorAll('.modal-delete-cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const catId = btn.getAttribute('data-id');
        const cat = state.categories.find(x => x.id == catId);
        const count = parseInt(btn.getAttribute('data-count') || '0');
        if (cat) openDeleteCategoryModal(cat, count);
      });
    });

    document.getElementById('save-cat-btn').addEventListener('click', async () => {
      const btn = document.getElementById('save-cat-btn');
      const name_ar = document.getElementById('cat-name-ar').value.trim();
      const name_en = document.getElementById('cat-name-en').value.trim();
      const icon = document.getElementById('cat-icon').value.trim();
      const display_order = parseInt(document.getElementById('cat-order').value) || 0;

      if (!name_ar || !name_en) {
        return showToast(isAr ? 'أدخل اسم التصنيف باللغتين' : 'Please fill category names in English and Arabic', 'error');
      }

      try {
        btn.disabled = true;
        btn.textContent = isAr ? 'جاري الحفظ...' : 'Saving...';

        if (category) {
          await api(`/menu/categories/${category.id}`, {
            method: 'PUT',
            body: JSON.stringify({ name_ar, name_en, icon, display_order })
          });
          showToast(isAr ? 'تم تعديل التصنيف بنجاح' : 'Category updated');
        } else {
          await api('/menu/categories', {
            method: 'POST',
            body: JSON.stringify({ name_ar, name_en, icon, display_order })
          });
          showToast(isAr ? 'تم إضافة التصنيف بنجاح' : 'Category added');
        }

        closeModal();
        renderMenu(document.getElementById('app-viewport'));
      } catch (err) {
        btn.disabled = false;
        btn.textContent = category ? (isAr ? 'حفظ التعديلات' : 'Save Changes') : (isAr ? 'حفظ التصنيف' : 'Save Category');
        showToast(err.message, 'error');
      }
    });
  }

  function openDeleteCategoryModal(category, itemsCount) {
    const isAr = state.lang === 'ar';
    const otherCategories = state.categories.filter(c => c.id !== category.id);

    let bodyHtml = '';

    if (itemsCount === 0) {
      bodyHtml = `
        <div style="text-align: center; padding: 1rem 0;">
          <svg width="48" height="48" fill="none" stroke="#e74c3c" stroke-width="2" viewBox="0 0 24 24" style="margin-bottom: 1rem;"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          <h4 style="color: var(--color-navy); margin-bottom: 0.5rem;">${isAr ? 'تأكيد حذف التصنيف' : 'Confirm Category Deletion'}</h4>
          <p style="color: var(--color-charcoal-light);">${isAr ? `هل أنت تأكد من حذف التصنيف "${category.name_ar}"؟ لا يمكن التراجع عن هذا الإجراء.` : `Are you sure you want to delete category "${category.name_en}"? This action cannot be undone.`}</p>
        </div>
      `;
    } else {
      bodyHtml = `
        <div style="padding: 0.5rem 0;">
          <div style="background: rgba(231, 76, 60, 0.1); border-left: 4px solid #e74c3c; padding: 1rem; border-radius: 6px; margin-bottom: 1.25rem;">
            <strong style="color: #c0392b; font-size: 0.95rem; display: block; margin-bottom: 0.25rem;">
              ⚠️ ${isAr ? 'التصنيف يحتوي على أصناف!' : 'Category Contains Products!'}
            </strong>
            <span style="font-size: 0.85rem; color: #7f8c8d;">
              ${isAr ? `التصنيف "${category.name_ar}" يحتوي حالياً على ${itemsCount} صنف. يرجى اختيار إجراء لهذه الأصناف قبل الحذف:` : `Category "${category.name_en}" contains ${itemsCount} active product(s). Please choose what to do with these products before deleting:`}
            </span>
          </div>

          <form id="delete-cat-action-form">
            <div class="form-group">
              <label>${isAr ? 'الإجراء المطلوب للأصناف *' : 'Action for existing products *'}</label>
              <select id="del-cat-action-select" class="form-control" style="font-weight: 600;">
                <option value="move">${isAr ? 'نقل جميع الأصناف إلى تصنيف آخر' : 'Move all products to another category'}</option>
                <option value="uncategorize">${isAr ? 'تعيين الأصناف كـ (غير مصنف)' : 'Mark products as Uncategorized'}</option>
              </select>
            </div>

            <div class="form-group" id="target-category-group">
              <label>${isAr ? 'اختر التصنيف المستهدف *' : 'Select Target Category *'}</label>
              <select id="del-cat-target-select" class="form-control">
                ${otherCategories.map(c => `<option value="${c.id}">${isAr ? c.name_ar : c.name_en}</option>`).join('')}
              </select>
            </div>
          </form>
        </div>
      `;
    }

    const footerHtml = `
      <button class="btn btn-outline" onclick="closeModal()">${isAr ? 'إلغاء' : 'Cancel'}</button>
      <button class="btn btn-danger" id="confirm-del-cat-btn">${isAr ? 'حذف التصنيف' : 'Delete Category'}</button>
    `;

    openModal(isAr ? 'حذف التصنيف' : 'Delete Category', bodyHtml, footerHtml);

    const actionSelect = document.getElementById('del-cat-action-select');
    if (actionSelect) {
      actionSelect.addEventListener('change', () => {
        const targetGroup = document.getElementById('target-category-group');
        if (targetGroup) targetGroup.style.display = actionSelect.value === 'move' ? 'block' : 'none';
      });
    }

    document.getElementById('confirm-del-cat-btn').addEventListener('click', async () => {
      const btn = document.getElementById('confirm-del-cat-btn');

      try {
        btn.disabled = true;
        btn.textContent = isAr ? 'جاري الحذف...' : 'Deleting...';

        let url = `/menu/categories/${category.id}`;
        if (itemsCount > 0) {
          const action = document.getElementById('del-cat-action-select').value;
          const targetId = document.getElementById('del-cat-target-select') ? document.getElementById('del-cat-target-select').value : null;
          url += `?action=${action}${action === 'move' ? `&target_category_id=${targetId}` : ''}`;
        }

        await api(url, { method: 'DELETE' });
        showToast(isAr ? 'تم حذف التصنيف بنجاح' : 'Category deleted successfully');
        closeModal();
        renderMenu(document.getElementById('app-viewport'));
      } catch (err) {
        btn.disabled = false;
        btn.textContent = isAr ? 'حذف التصنيف' : 'Delete Category';
        showToast(err.message, 'error');
      }
    });
  }

  // ==========================================================================
  // REQUIREMENT 1: PRODUCT IMAGE MANAGEMENT IN MENU MANAGER MODAL
  // ==========================================================================
  function openMenuItemModal(item = null) {
    const isAr = state.lang === 'ar';
    let currentImg = (item && item.image_url && (item.image_url.startsWith('/uploads/') || item.image_url.startsWith('uploads/') || item.image_url.startsWith('http'))) ? item.image_url : '';

    const bodyHtml = `
      <form id="menu-item-form">
        <div class="form-group">
          <label>${isAr ? 'اسم الصنف (بالعربية) *' : 'Item Name (Arabic) *'}</label>
          <input type="text" id="item-name-ar" class="form-control" required value="${item ? item.name_ar : ''}">
        </div>
        <div class="form-group">
          <label>${isAr ? 'اسم الصنف (English) *' : 'Item Name (English) *'}</label>
          <input type="text" id="item-name-en" class="form-control" required value="${item ? item.name_en : ''}">
        </div>
        <div class="form-group">
          <label>${isAr ? 'التصنيف (Category) *' : 'Category *'}</label>
          <select id="item-category-id" class="form-control" required>
            ${state.categories.map(c => `<option value="${c.id}" ${item && item.category_id === c.id ? 'selected' : ''}>${isAr ? c.name_ar : c.name_en}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>${isAr ? 'السعر (بالريال) *' : 'Price (in SAR) *'}</label>
          <input type="number" step="0.5" id="item-price" class="form-control" required value="${item ? item.price : '15'}">
        </div>
        <div class="form-group">
          <label>${isAr ? 'السعرات الحرارية' : 'Calories (kcal)'}</label>
          <input type="number" id="item-calories" class="form-control" value="${item && item.calories ? item.calories : ''}">
        </div>

        <!-- PRODUCT IMAGE MANAGEMENT CONTROL -->
        <div class="form-group" style="background: var(--color-cream); padding: 1.25rem; border-radius: 8px; border: 1px solid var(--color-cream-dark);">
          <label style="font-weight: 700; color: var(--color-navy); margin-bottom: 0.75rem; display: block;">
            ${isAr ? 'إدارة صورة المنتج (Product Image Management)' : 'Product Image Management'}
          </label>
          
          <input type="hidden" id="item-image-url" value="${currentImg}">
          <input type="file" id="item-image-file" style="display: none;" accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml">

          <div style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;">
            <div id="item-img-preview-box" style="${currentImg ? 'display: block;' : 'display: none;'} width: 72px; height: 72px; border-radius: 10px; overflow: hidden; border: 2px solid var(--color-gold); box-shadow: var(--shadow-sm); background: #f8f9fa; flex-shrink: 0;">
              <img id="item-img-preview" src="${currentImg || ''}" style="width: 100%; height: 100%; object-fit: cover;" alt="">
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 0.5rem; flex: 1;">
              <div style="font-size: 0.8rem; color: var(--color-charcoal-light);" id="item-img-status">
                ${currentImg ? (isAr ? 'الصورة المرفوقة الحالية للمنتج' : 'Current custom product image attached') : (isAr ? 'لا توجد صورة مخصصة مرفقة' : 'No custom image attached')}
              </div>

              <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                <button type="button" class="btn btn-gold btn-sm" id="btn-change-item-image">
                  <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                  <span>${isAr ? 'رفع / تغيير الصورة' : 'Upload / Change Image'}</span>
                </button>
                
                <button type="button" class="btn btn-danger btn-sm" id="btn-remove-item-image" style="${currentImg ? 'display: inline-flex;' : 'display: none;'}">
                  <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                  <span>${isAr ? 'إزالة الصورة' : 'Remove Image'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="form-group">
          <label>${isAr ? 'الوصف بالعربية' : 'Description (Arabic)'}</label>
          <textarea id="item-desc-ar" class="form-control">${item ? (item.description_ar || '') : ''}</textarea>
        </div>
        <div class="form-group">
          <label>${isAr ? 'الوصف بالإنجليزية' : 'Description (English)'}</label>
          <textarea id="item-desc-en" class="form-control">${item ? (item.description_en || '') : ''}</textarea>
        </div>
      </form>
    `;

    const footerHtml = `
      <button class="btn btn-outline" onclick="closeModal()">${isAr ? 'إلغاء' : 'Cancel'}</button>
      <button class="btn btn-gold" id="save-item-btn">${item ? (isAr ? 'حفظ التعديلات' : 'Save Changes') : (isAr ? 'حفظ الصنف' : 'Save Item')}</button>
    `;

    openModal(item ? (isAr ? 'تعديل صنف بالقائمة' : 'Edit Menu Item') : (isAr ? 'إضافة صنف جديد' : 'Add New Menu Item'), bodyHtml, footerHtml);

    // Bind Image Change trigger
    document.getElementById('btn-change-item-image').addEventListener('click', () => {
      document.getElementById('item-image-file').click();
    });

    // Handle File Selection, Validation & Upload
    document.getElementById('item-image-file').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      // File validation: Size max 10MB, mime type check
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
      if (!allowedTypes.includes(file.type)) {
        return showToast(isAr ? 'نوع الملف غير مدعوم. اختر صورة (JPG, PNG, WEBP, GIF, SVG)' : 'Unsupported image format. Select a valid image (JPG, PNG, WEBP, GIF, SVG)', 'error');
      }
      if (file.size > 10 * 1024 * 1024) {
        return showToast(isAr ? 'حجم الصورة كبير جداً (الأقصى 10 ميجابايت)' : 'Image file size too large (Maximum 10MB)', 'error');
      }

      const btnChange = document.getElementById('btn-change-item-image');
      const statusText = document.getElementById('item-img-status');

      try {
        btnChange.disabled = true;
        statusText.textContent = isAr ? 'جاري رفع الصورة الجديدة...' : 'Uploading new image...';

        const formData = new FormData();
        formData.append('files', file);

        const uploadRes = await api('/media/upload', { method: 'POST', body: formData });
        if (uploadRes.success && uploadRes.data.length > 0) {
          const uploadedPath = uploadRes.data[0].file_path;
          document.getElementById('item-image-url').value = uploadedPath;
          
          const previewImg = document.getElementById('item-img-preview');
          const previewBox = document.getElementById('item-img-preview-box');

          if (previewImg) {
            previewImg.onerror = null;
            previewImg.onload = function() {
              if (previewBox) previewBox.style.setProperty('display', 'block', 'important');
              statusText.textContent = isAr ? 'تم رفع وتغيير الصورة بنجاح!' : 'New image uploaded successfully!';
            };
            previewImg.onerror = function() {
              if (previewBox) previewBox.style.setProperty('display', 'none', 'important');
              statusText.textContent = isAr ? 'تم رفع وتغيير الصورة بنجاح!' : 'New image uploaded successfully!';
            };
            previewImg.src = uploadedPath;
          }

          if (previewBox) previewBox.style.setProperty('display', 'block', 'important');
          document.getElementById('btn-remove-item-image').style.display = 'inline-flex';
          statusText.textContent = isAr ? 'تم رفع وتغيير الصورة بنجاح!' : 'New image uploaded successfully!';
          showToast(isAr ? 'تم رفع الصورة بنجاح' : 'Image uploaded successfully');
        }
      } catch (err) {
        statusText.textContent = isAr ? 'فشل رفع الصورة' : 'Image upload failed';
        showToast(err.message || (isAr ? 'فشل رفع الصورة' : 'Image upload failed'), 'error');
      } finally {
        btnChange.disabled = false;
      }
    });

    // Handle Image Removal
    document.getElementById('btn-remove-item-image').addEventListener('click', async () => {
      if (item && item.id) {
        try {
          await api(`/menu/items/${item.id}/image`, { method: 'DELETE' });
        } catch (e) {}
      }
      document.getElementById('item-image-url').value = '';
      const previewBox = document.getElementById('item-img-preview-box');
      if (previewBox) previewBox.style.setProperty('display', 'none', 'important');
      const previewImg = document.getElementById('item-img-preview');
      if (previewImg) {
        previewImg.onerror = null;
        previewImg.onload = null;
        previewImg.src = '';
      }
      document.getElementById('btn-remove-item-image').style.display = 'none';
      statusText.textContent = isAr ? 'لا توجد صورة مخصصة مرفقة' : 'No custom image attached';
      showToast(isAr ? 'تمت إزالة الصورة بنجاح' : 'Image removed successfully');
    });

    document.getElementById('save-item-btn').addEventListener('click', async () => {
      const btnSave = document.getElementById('save-item-btn');
      const payload = {
        name_ar: document.getElementById('item-name-ar').value.trim(),
        name_en: document.getElementById('item-name-en').value.trim(),
        category_id: parseInt(document.getElementById('item-category-id').value),
        price: parseFloat(document.getElementById('item-price').value),
        calories: document.getElementById('item-calories').value,
        image_url: document.getElementById('item-image-url').value,
        description_ar: document.getElementById('item-desc-ar').value,
        description_en: document.getElementById('item-desc-en').value
      };

      if (!payload.name_ar || !payload.name_en || isNaN(payload.price) || !payload.category_id) {
        return showToast(isAr ? 'يرجى تعبئة كافة الحقول المطلوبة' : 'Please fill all required fields', 'error');
      }

      try {
        btnSave.disabled = true;
        btnSave.textContent = isAr ? 'جاري الحفظ...' : 'Saving...';

        if (item) {
          await api(`/menu/items/${item.id}`, { method: 'PUT', body: JSON.stringify(payload) });
        } else {
          await api('/menu/items', { method: 'POST', body: JSON.stringify(payload) });
        }
        showToast(isAr ? 'تم حفظ الصنف بنجاح' : 'Menu item saved successfully');
        closeModal();
        renderMenu(document.getElementById('app-viewport'));
      } catch (err) {
        btnSave.disabled = false;
        btnSave.textContent = item ? (isAr ? 'حفظ التعديلات' : 'Save Changes') : (isAr ? 'حفظ الصنف' : 'Save Item');
        showToast(err.message, 'error');
      }
    });
  }

  // ==========================================================================
  // VIEW 4: OFFERS & PROMOTIONS
  // ==========================================================================
  async function renderOffers(container) {
    try {
      const data = await api('/offers');
      state.offers = data.data;
      const isAr = state.lang === 'ar';

      container.innerHTML = `
        <div class="page-header">
          <div class="page-title">
            <h1>${isAr ? 'إدارة العروض والتخفيضات' : 'Offers & Promotions'}</h1>
            <p>${isAr ? 'إضافة وتعديل وجدولة عروض القهوة والحلويات' : 'Create, edit, and schedule café promotional packages'}</p>
          </div>
          <div class="header-actions">
            <button class="btn btn-gold" id="add-offer-btn">
              <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4"/></svg>
              <span>${isAr ? '+ إضافة عرض جديد' : '+ Add New Offer'}</span>
            </button>
          </div>
        </div>

        <div class="panel-card">
          <div class="panel-header">
            <h3>${isAr ? 'العروض الحالية' : 'Current Active Offers'}</h3>
          </div>
          <div class="panel-body" style="padding: 0;">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>${isAr ? 'عنوان العرض' : 'Offer Title'}</th>
                  <th>${isAr ? 'السعر الأصلي' : 'Original Price'}</th>
                  <th>${isAr ? 'سعر العرض' : 'Offer Price'}</th>
                  <th>${isAr ? 'الحالة' : 'Status'}</th>
                  <th>${isAr ? 'إجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                ${state.offers.map(o => `
                  <tr>
                    <td><strong>${isAr ? o.title_ar : o.title_en}</strong></td>
                    <td><s style="color: #95a5a6;">${o.original_price ? o.original_price + (isAr ? ' ر.س' : ' SAR') : '-'}</s></td>
                    <td><strong style="color: #27ae60;">${o.offer_price ? o.offer_price + (isAr ? ' ر.س' : ' SAR') : '-'}</strong></td>
                    <td><span class="badge badge-success">${o.status}</span></td>
                    <td>
                      <button class="btn btn-navy btn-sm edit-offer-btn" data-id="${o.id}">${isAr ? 'تعديل' : 'Edit'}</button>
                      <button class="btn btn-danger btn-sm delete-offer-btn" data-id="${o.id}">${isAr ? 'حذف' : 'Delete'}</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;

      document.getElementById('add-offer-btn').addEventListener('click', () => openOfferModal());

      container.querySelectorAll('.edit-offer-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const offer = state.offers.find(x => x.id == btn.getAttribute('data-id'));
          if (offer) openOfferModal(offer);
        });
      });

      container.querySelectorAll('.delete-offer-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (confirm(isAr ? 'هل أنت تأكد من حذف هذا العرض؟' : 'Are you sure you want to delete this offer?')) {
            try {
              await api(`/offers/${btn.getAttribute('data-id')}`, { method: 'DELETE' });
              showToast(isAr ? 'تم حذف العرض' : 'Offer deleted');
              renderOffers(container);
            } catch (err) {
              showToast(err.message, 'error');
            }
          }
        });
      });

    } catch (e) {
      container.innerHTML = `<div class="badge badge-danger">${state.lang === 'ar' ? 'فشل تحميل العروض' : 'Failed to load offers'}</div>`;
    }
  }

  function openOfferModal(offer = null) {
    const isAr = state.lang === 'ar';
    const currentImg = offer ? offer.image_url : 'assets/images/coffee.jpg';

    const bodyHtml = `
      <form id="offer-modal-form">
        <div class="form-group">
          <label>${isAr ? 'عنوان العرض (بالعربية) *' : 'Offer Title (Arabic) *'}</label>
          <input type="text" id="offer-title-ar" class="form-control" required value="${offer ? offer.title_ar : ''}">
        </div>
        <div class="form-group">
          <label>${isAr ? 'عنوان العرض (English) *' : 'Offer Title (English) *'}</label>
          <input type="text" id="offer-title-en" class="form-control" required value="${offer ? offer.title_en : ''}">
        </div>
        <div class="form-group">
          <label>${isAr ? 'السعر الأصلي (SAR)' : 'Original Price (SAR)'}</label>
          <input type="number" id="offer-orig-price" class="form-control" value="${offer && offer.original_price ? offer.original_price : ''}">
        </div>
        <div class="form-group">
          <label>${isAr ? 'سعر العرض المميز (SAR)' : 'Offer Price (SAR)'}</label>
          <input type="number" id="offer-price-val" class="form-control" value="${offer && offer.offer_price ? offer.offer_price : ''}">
        </div>

        <div class="form-group">
          <label>${isAr ? 'رفع صورة العرض (Upload Offer Image)' : 'Upload Offer Image'}</label>
          <input type="file" id="offer-image-file" class="form-control" accept="image/*">
          <input type="hidden" id="offer-image-url" value="${currentImg}">
          <div style="margin-top: 0.6rem; display: flex; align-items: center; gap: 0.75rem;">
            <img id="offer-img-preview" src="${currentImg}" style="width: 54px; height: 54px; border-radius: 8px; object-fit: cover;" alt="">
            <span style="font-size: 0.8rem; color: var(--color-charcoal-light);" id="offer-img-status">${isAr ? 'اختر صورة من جهازك' : 'Select an image file'}</span>
          </div>
        </div>

        <div class="form-group">
          <label>${isAr ? 'الوصف بالعربية' : 'Description (Arabic)'}</label>
          <textarea id="offer-desc-ar" class="form-control">${offer ? (offer.description_ar || '') : ''}</textarea>
        </div>
        <div class="form-group">
          <label>${isAr ? 'الوصف بالإنجليزية' : 'Description (English)'}</label>
          <textarea id="offer-desc-en" class="form-control">${offer ? (offer.description_en || '') : ''}</textarea>
        </div>
      </form>
    `;

    const footerHtml = `
      <button class="btn btn-outline" onclick="closeModal()">${isAr ? 'إلغاء' : 'Cancel'}</button>
      <button class="btn btn-gold" id="save-offer-btn">${isAr ? 'حفظ العرض' : 'Save Offer'}</button>
    `;

    openModal(offer ? (isAr ? 'تعديل العرض' : 'Edit Offer') : (isAr ? 'إضافة عرض جديد' : 'Add New Offer'), bodyHtml, footerHtml);

    document.getElementById('offer-image-file').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const formData = new FormData();
      formData.append('files', file);
      try {
        document.getElementById('offer-img-status').textContent = isAr ? 'جاري الرفع...' : 'Uploading...';
        const res = await api('/media/upload', { method: 'POST', body: formData });
        if (res.success && res.data.length > 0) {
          const path = res.data[0].file_path;
          document.getElementById('offer-image-url').value = path;
          document.getElementById('offer-img-preview').src = path;
          document.getElementById('offer-img-status').textContent = isAr ? 'تم الرفع!' : 'Uploaded!';
        }
      } catch (err) { showToast('Upload failed', 'error'); }
    });

    document.getElementById('save-offer-btn').addEventListener('click', async () => {
      const payload = {
        title_ar: document.getElementById('offer-title-ar').value,
        title_en: document.getElementById('offer-title-en').value,
        original_price: document.getElementById('offer-orig-price').value,
        offer_price: document.getElementById('offer-price-val').value,
        image_url: document.getElementById('offer-image-url').value,
        description_ar: document.getElementById('offer-desc-ar').value,
        description_en: document.getElementById('offer-desc-en').value
      };

      try {
        if (offer) {
          await api(`/offers/${offer.id}`, { method: 'PUT', body: JSON.stringify(payload) });
        } else {
          await api('/offers', { method: 'POST', body: JSON.stringify(payload) });
        }
        showToast(isAr ? 'تم حفظ العرض بنجاح' : 'Offer saved');
        closeModal();
        renderOffers(document.getElementById('app-viewport'));
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  // ==========================================================================
  // VIEW 5: BLOG MANAGEMENT
  // ==========================================================================
  async function renderBlog(container) {
    try {
      const data = await api('/blog/posts');
      state.blogPosts = data.data;
      const isAr = state.lang === 'ar';

      container.innerHTML = `
        <div class="page-header">
          <div class="page-title">
            <h1>${isAr ? 'إدارة مدونة وحكايات القهوة' : 'Blog & News Management'}</h1>
            <p>${isAr ? 'نشر وإدارة مقالات القهوة المختصة والأخبار' : 'Publish and manage coffee guides, news, and posts'}</p>
          </div>
          <div class="header-actions">
            <button class="btn btn-gold" id="add-post-btn">
              <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4"/></svg>
              <span>${isAr ? '+ كتابة مقال جديد' : '+ Add New Blog Post'}</span>
            </button>
          </div>
        </div>

        <div class="panel-card">
          <div class="panel-header">
            <h3>${isAr ? 'مقالات المدونة' : 'Blog Posts'}</h3>
          </div>
          <div class="panel-body" style="padding: 0;">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>${isAr ? 'عنوان المقال' : 'Post Title'}</th>
                  <th>${isAr ? 'التصنيف' : 'Category'}</th>
                  <th>${isAr ? 'تاريخ النشر' : 'Publish Date'}</th>
                  <th>${isAr ? 'الحالة' : 'Status'}</th>
                  <th>${isAr ? 'إجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                ${state.blogPosts.map(p => `
                  <tr>
                    <td><strong>${isAr ? p.title_ar : p.title_en}</strong></td>
                    <td>${p.category_name}</td>
                    <td>${new Date(p.publish_date).toLocaleDateString()}</td>
                    <td><span class="badge badge-success">${p.status}</span></td>
                    <td>
                      <button class="btn btn-navy btn-sm edit-post-btn" data-id="${p.id}">${isAr ? 'تعديل' : 'Edit'}</button>
                      <button class="btn btn-danger btn-sm delete-post-btn" data-id="${p.id}">${isAr ? 'حذف' : 'Delete'}</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;

      document.getElementById('add-post-btn').addEventListener('click', () => openBlogPostModal());

      container.querySelectorAll('.edit-post-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const post = state.blogPosts.find(x => x.id == btn.getAttribute('data-id'));
          if (post) openBlogPostModal(post);
        });
      });

      container.querySelectorAll('.delete-post-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (confirm(isAr ? 'هل أنت تأكد من حذف هذا المقال؟' : 'Are you sure you want to delete this blog post?')) {
            try {
              await api(`/blog/posts/${btn.getAttribute('data-id')}`, { method: 'DELETE' });
              showToast(isAr ? 'تم نقل المقال للسلة' : 'Post deleted');
              renderBlog(container);
            } catch (err) {
              showToast(err.message, 'error');
            }
          }
        });
      });

    } catch (e) {
      container.innerHTML = `<div class="badge badge-danger">${state.lang === 'ar' ? 'فشل تحميل المدونة' : 'Failed to load blog posts'}</div>`;
    }
  }

  function openBlogPostModal(post = null) {
    const isAr = state.lang === 'ar';
    const currentImg = post ? post.featured_image : 'assets/images/coffee.jpg';

    const bodyHtml = `
      <form id="blog-post-form">
        <div class="form-group">
          <label>${isAr ? 'عنوان المقال (بالعربية) *' : 'Post Title (Arabic) *'}</label>
          <input type="text" id="post-title-ar" class="form-control" required value="${post ? post.title_ar : ''}">
        </div>
        <div class="form-group">
          <label>${isAr ? 'عنوان المقال (English) *' : 'Post Title (English) *'}</label>
          <input type="text" id="post-title-en" class="form-control" required value="${post ? post.title_en : ''}">
        </div>
        <div class="form-group">
          <label>${isAr ? 'التصنيف' : 'Category'}</label>
          <input type="text" id="post-category" class="form-control" value="${post ? post.category_name : 'Coffee Craft'}">
        </div>

        <div class="form-group">
          <label>${isAr ? 'رفع الصورة البارزة (Upload Featured Image)' : 'Upload Featured Image'}</label>
          <input type="file" id="post-image-file" class="form-control" accept="image/*">
          <input type="hidden" id="post-image-url" value="${currentImg}">
          <div style="margin-top: 0.6rem; display: flex; align-items: center; gap: 0.75rem;">
            <img id="post-img-preview" src="${currentImg}" style="width: 54px; height: 54px; border-radius: 8px; object-fit: cover;" alt="">
            <span style="font-size: 0.8rem; color: var(--color-charcoal-light);" id="post-img-status">${isAr ? 'اختر صورة من جهازك' : 'Select an image file'}</span>
          </div>
        </div>

        <div class="form-group">
          <label>${isAr ? 'المقتطف بالعربية' : 'Excerpt (Arabic)'}</label>
          <textarea id="post-excerpt-ar" class="form-control">${post ? (post.excerpt_ar || '') : ''}</textarea>
        </div>
        <div class="form-group">
          <label>${isAr ? 'المقتطف بالإنجليزية' : 'Excerpt (English)'}</label>
          <textarea id="post-excerpt-en" class="form-control">${post ? (post.excerpt_en || '') : ''}</textarea>
        </div>
        <div class="form-group">
          <label>${isAr ? 'المحتوى الرئيسي بالعربية' : 'Main Content (Arabic)'}</label>
          <textarea id="post-content-ar" class="form-control" style="min-height: 120px;">${post ? (post.content_ar || '') : ''}</textarea>
        </div>
        <div class="form-group">
          <label>${isAr ? 'المحتوى الرئيسي بالإنجليزية' : 'Main Content (English)'}</label>
          <textarea id="post-content-en" class="form-control" style="min-height: 120px;">${post ? (post.content_en || '') : ''}</textarea>
        </div>
      </form>
    `;

    const footerHtml = `
      <button class="btn btn-outline" onclick="closeModal()">${isAr ? 'إلغاء' : 'Cancel'}</button>
      <button class="btn btn-gold" id="save-post-btn">${isAr ? 'حفظ ونشر المقال' : 'Save & Publish'}</button>
    `;

    openModal(post ? (isAr ? 'تعديل مقال' : 'Edit Post') : (isAr ? 'كتابة مقال جديد' : 'Write New Post'), bodyHtml, footerHtml);

    document.getElementById('post-image-file').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const formData = new FormData();
      formData.append('files', file);
      try {
        document.getElementById('post-img-status').textContent = isAr ? 'جاري الرفع...' : 'Uploading...';
        const res = await api('/media/upload', { method: 'POST', body: formData });
        if (res.success && res.data.length > 0) {
          const path = res.data[0].file_path;
          document.getElementById('post-image-url').value = path;
          document.getElementById('post-img-preview').src = path;
          document.getElementById('post-img-status').textContent = isAr ? 'تم الرفع!' : 'Uploaded!';
        }
      } catch (err) { showToast('Upload failed', 'error'); }
    });

    document.getElementById('save-post-btn').addEventListener('click', async () => {
      const payload = {
        title_ar: document.getElementById('post-title-ar').value,
        title_en: document.getElementById('post-title-en').value,
        category_name: document.getElementById('post-category').value,
        featured_image: document.getElementById('post-image-url').value,
        excerpt_ar: document.getElementById('post-excerpt-ar').value,
        excerpt_en: document.getElementById('post-excerpt-en').value,
        content_ar: document.getElementById('post-content-ar').value,
        content_en: document.getElementById('post-content-en').value,
        status: 'published'
      };

      try {
        if (post) {
          await api(`/blog/posts/${post.id}`, { method: 'PUT', body: JSON.stringify(payload) });
        } else {
          await api('/blog/posts', { method: 'POST', body: JSON.stringify(payload) });
        }
        showToast(isAr ? 'تم حفظ ونشر المقال بنجاح' : 'Blog post published');
        closeModal();
        renderBlog(document.getElementById('app-viewport'));
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  // ==========================================================================
  // VIEW 6: SEO PANEL
  // ==========================================================================
  async function renderSeo(container) {
    try {
      const [overviewData, metaData] = await Promise.all([
        api('/seo/overview'),
        api('/seo/metadata')
      ]);

      const overview = overviewData.data;
      const metadata = metaData.data;
      const isAr = state.lang === 'ar';

      container.innerHTML = `
        <div class="page-header">
          <div class="page-title">
            <h1>${isAr ? 'لوحة تحسين محركات البحث (SEO Panel)' : 'SEO Management Panel'}</h1>
            <p>${isAr ? 'فحص عناوين الميتا والوصف ومعاينة النتيجة في محرك البحث Google' : 'Audit meta titles, meta descriptions, and live Google search preview'}</p>
          </div>
        </div>

        <div class="card-grid">
          <div class="stat-card">
            <div class="stat-info">
              <div class="number" style="color: ${overview.summary.totalIssues > 0 ? '#e74c3c' : '#27ae60'};">${overview.summary.totalIssues}</div>
              <div class="label">${isAr ? 'تنبيهات وملاحظات الميتا' : 'SEO Audit Alerts'}</div>
            </div>
            <div class="stat-icon">🔍</div>
          </div>
        </div>

        <div class="panel-card">
          <div class="panel-header">
            <h3>${isAr ? 'محرر عناوين الميتا ومعاينة البحث Live Google Preview' : 'Metadata Editor & Search Snippet Preview'}</h3>
          </div>
          <div class="panel-body" style="padding: 0;">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>${isAr ? 'العنصر / الصفحة' : 'Page / Item'}</th>
                  <th>${isAr ? 'عنوان الميتا (Meta Title)' : 'Meta Title'}</th>
                  <th>${isAr ? 'وصف الميتا (Meta Description)' : 'Meta Description'}</th>
                  <th>${isAr ? 'إجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                ${metadata.map(m => `
                  <tr>
                    <td><strong>${isAr ? m.name_ar : m.name_en}</strong> <code>(${m.entity_type})</code></td>
                    <td>${(isAr ? m.seo_title_ar : m.seo_title_en) || '<span style="color:red">Missing</span>'}</td>
                    <td>${((isAr ? m.meta_desc_ar : m.meta_desc_en) || '<span style="color:red">Missing</span>').slice(0, 60)}...</td>
                    <td>
                      <button class="btn btn-navy btn-sm edit-seo-btn" data-type="${m.entity_type}" data-id="${m.id}">${isAr ? 'تعديل المعاينة' : 'Edit & Preview'}</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;

      container.querySelectorAll('.edit-seo-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const type = btn.getAttribute('data-type');
          const id = btn.getAttribute('data-id');
          const item = metadata.find(x => x.entity_type === type && x.id == id);
          if (item) openSeoModal(type, id, item);
        });
      });

    } catch (e) {
      container.innerHTML = `<div class="badge badge-danger">${state.lang === 'ar' ? 'فشل تحميل لوحة SEO' : 'Failed to load SEO panel'}</div>`;
    }
  }

  function openSeoModal(type, id, item) {
    const isAr = state.lang === 'ar';
    const titleVal = (isAr ? item.seo_title_ar : item.seo_title_en) || item.name_ar;
    const descVal = (isAr ? item.meta_desc_ar : item.meta_desc_en) || '';

    const bodyHtml = `
      <form id="seo-modal-form">
        <div class="form-group">
          <label>${isAr ? 'عنوان الميتا (Meta Title)' : 'Meta Title'}</label>
          <input type="text" id="seo-modal-title" class="form-control" value="${titleVal}">
        </div>
        <div class="form-group">
          <label>${isAr ? 'وصف الميتا (Meta Description)' : 'Meta Description'}</label>
          <textarea id="seo-modal-desc" class="form-control">${descVal}</textarea>
        </div>

        <h4 style="margin-top: 1.5rem; color: var(--color-navy);">${isAr ? 'معاينة مظهر النتيجة في محرك البحث Google:' : 'Live Google Search Preview:'}</h4>
        <div class="google-preview-box">
          <div class="google-preview-title" id="preview-google-title">${titleVal}</div>
          <div class="google-preview-url">https://ozparkcafe.com/${item.slug || ''}</div>
          <div class="google-preview-desc" id="preview-google-desc">${descVal || 'Snippet description preview'}</div>
        </div>
      </form>
    `;

    const footerHtml = `
      <button class="btn btn-outline" onclick="closeModal()">${isAr ? 'إلغاء' : 'Cancel'}</button>
      <button class="btn btn-gold" id="save-seo-modal-btn">${isAr ? 'حفظ بيانات SEO' : 'Save SEO Metadata'}</button>
    `;

    openModal(`${isAr ? 'تعديل SEO لـ:' : 'Edit SEO for:'} ${isAr ? item.name_ar : item.name_en}`, bodyHtml, footerHtml);

    const titleInput = document.getElementById('seo-modal-title');
    const descInput = document.getElementById('seo-modal-desc');

    titleInput.addEventListener('input', () => document.getElementById('preview-google-title').textContent = titleInput.value);
    descInput.addEventListener('input', () => document.getElementById('preview-google-desc').textContent = descInput.value);

    document.getElementById('save-seo-modal-btn').addEventListener('click', async () => {
      try {
        const payload = isAr ? { seo_title_ar: titleInput.value, meta_desc_ar: descInput.value } : { seo_title_en: titleInput.value, meta_desc_en: descInput.value };
        await api(`/seo/metadata/${type}/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
        showToast(isAr ? 'تم حفظ بيانات الميتا ومعاينة البحث' : 'SEO metadata saved');
        closeModal();
        renderSeo(document.getElementById('app-viewport'));
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  // ==========================================================================
  // VIEW 7: MEDIA LIBRARY
  // ==========================================================================
  async function renderMedia(container) {
    try {
      const data = await api('/media');
      state.mediaFiles = data.data;
      const isAr = state.lang === 'ar';

      container.innerHTML = `
        <div class="page-header">
          <div class="page-title">
            <h1>${isAr ? 'مكتبة الوسائط والملفات' : 'Media Library'}</h1>
            <p>${isAr ? 'رفع وإدارة صور القهوة والمشروبات والمخبوزات والملفات' : 'Upload and manage coffee images and brand assets'}</p>
          </div>
          <div class="header-actions">
            <label class="btn btn-gold" style="cursor: pointer;">
              <input type="file" id="media-upload-input" multiple style="display: none;" accept="image/*,video/*">
              <span>${isAr ? '+ رفع صور جديدة' : '+ Upload New Images'}</span>
            </label>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 1.25rem;">
          ${state.mediaFiles.map(m => `
            <div style="background: white; border-radius: 8px; padding: 0.5rem; box-shadow: var(--shadow-sm); border: 1px solid var(--color-cream-dark); position: relative;">
              <img src="${m.file_path}" style="width: 100%; height: 130px; object-fit: cover; border-radius: 6px;" alt="">
              <div style="font-size: 0.75rem; font-weight: 600; margin-top: 0.4rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${m.original_name}</div>
              <button class="btn btn-danger btn-sm delete-media-btn" data-id="${m.id}" style="margin-top: 0.4rem; width: 100%; font-size: 0.75rem;">${isAr ? 'حذف الصورة' : 'Delete File'}</button>
            </div>
          `).join('')}
        </div>
      `;

      document.getElementById('media-upload-input').addEventListener('change', async (e) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const formData = new FormData();
        for (let i = 0; i < files.length; i++) formData.append('files', files[i]);

        try {
          await api('/media/upload', { method: 'POST', body: formData });
          showToast(isAr ? 'تم رفع الصور بنجاح' : 'Images uploaded successfully');
          renderMedia(container);
        } catch (err) {
          showToast(err.message, 'error');
        }
      });

      container.querySelectorAll('.delete-media-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (confirm(isAr ? 'هل أنت تأكد من حذف هذه الصورة؟' : 'Are you sure you want to delete this file?')) {
            try {
              await api(`/media/${btn.getAttribute('data-id')}`, { method: 'DELETE' });
              showToast(isAr ? 'تم حذف الملف' : 'File deleted');
              renderMedia(container);
            } catch (err) {
              showToast(err.message, 'error');
            }
          }
        });
      });

    } catch (e) {
      container.innerHTML = `<div class="badge badge-danger">${state.lang === 'ar' ? 'فشل تحميل مكتبة الوسائط' : 'Failed to load media library'}</div>`;
    }
  }

  // ==========================================================================
  // VIEW 8: GALLERY MANAGEMENT
  // ==========================================================================
  async function renderGallery(container) {
    try {
      const data = await api('/gallery');
      state.galleryItems = data.data;
      const isAr = state.lang === 'ar';

      container.innerHTML = `
        <div class="page-header">
          <div class="page-title">
            <h1>${isAr ? 'إدارة معرض الصور' : 'Gallery Management'}</h1>
            <p>${isAr ? 'صور الجلسات البانورامية البحرية والمشروبات والحلويات' : 'Manage coastal lounge photos and drinks gallery'}</p>
          </div>
          <div class="header-actions">
            <button class="btn btn-gold" id="add-gallery-btn">
              <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4"/></svg>
              <span>${isAr ? '+ إضافة صورة للمعرض' : '+ Add Gallery Photo'}</span>
            </button>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1.25rem;">
          ${state.galleryItems.map(g => `
            <div style="background: white; border-radius: 8px; padding: 0.75rem; box-shadow: var(--shadow-sm); border: 1px solid var(--color-cream-dark);">
              <img src="${g.image_url}" style="width: 100%; height: 150px; object-fit: cover; border-radius: 6px;" alt="">
              <div style="font-weight: 700; color: var(--color-navy); margin-top: 0.5rem;">${(isAr ? g.title_ar : g.title_en) || (isAr ? 'بدون عنوان' : 'Untitled')}</div>
              <span class="badge badge-info">${g.category}</span>
              <div style="margin-top: 0.5rem; display: flex; gap: 0.4rem;">
                <button class="btn btn-danger btn-sm delete-gallery-btn" data-id="${g.id}" style="width: 100%; font-size: 0.75rem;">${isAr ? 'حذف' : 'Delete'}</button>
              </div>
            </div>
          `).join('')}
        </div>
      `;

      document.getElementById('add-gallery-btn').addEventListener('click', () => openGalleryModal());

      container.querySelectorAll('.delete-gallery-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (confirm(isAr ? 'هل أنت تأكد من حذف الصورة من المعرض؟' : 'Delete this gallery photo?')) {
            try {
              await api(`/gallery/${btn.getAttribute('data-id')}`, { method: 'DELETE' });
              showToast(isAr ? 'تم حذف الصورة من المعرض' : 'Gallery item deleted');
              renderGallery(container);
            } catch (err) {
              showToast(err.message, 'error');
            }
          }
        });
      });

    } catch (e) {
      container.innerHTML = `<div class="badge badge-danger">${state.lang === 'ar' ? 'فشل تحميل المعرض' : 'Failed to load gallery'}</div>`;
    }
  }

  function openGalleryModal() {
    const isAr = state.lang === 'ar';
    const currentImg = 'assets/images/hero-seaview.jpg';

    const bodyHtml = `
      <form id="gallery-modal-form">
        <div class="form-group">
          <label>${isAr ? 'عنوان الصورة (بالعربية)' : 'Photo Title (Arabic)'}</label>
          <input type="text" id="gal-title-ar" class="form-control" placeholder="جلسات شاطئية">
        </div>
        <div class="form-group">
          <label>${isAr ? 'عنوان الصورة (English)' : 'Photo Title (English)'}</label>
          <input type="text" id="gal-title-en" class="form-control" placeholder="Sea View Lounge">
        </div>
        <div class="form-group">
          <label>${isAr ? 'التصنيف (Category) *' : 'Category *'}</label>
          <select id="gal-category" class="form-control" required>
            <option value="Sea View">${isAr ? 'إطلالة بحرية (Sea View)' : 'Sea View'}</option>
            <option value="Coffee">${isAr ? 'القهوة (Coffee)' : 'Coffee'}</option>
            <option value="Drinks">${isAr ? 'المشروبات (Drinks)' : 'Drinks'}</option>
            <option value="Desserts">${isAr ? 'الحلويات (Desserts)' : 'Desserts'}</option>
            <option value="Interior">${isAr ? 'الجلسات الداخلية (Interior)' : 'Interior'}</option>
          </select>
        </div>

        <div class="form-group">
          <label>${isAr ? 'رفع صورة المعرض (Upload Photo)' : 'Upload Gallery Photo'}</label>
          <input type="file" id="gal-image-file" class="form-control" accept="image/*">
          <input type="hidden" id="gal-image-url" value="${currentImg}">
          <div style="margin-top: 0.6rem; display: flex; align-items: center; gap: 0.75rem;">
            <img id="gal-img-preview" src="${currentImg}" style="width: 54px; height: 54px; border-radius: 8px; object-fit: cover;" alt="">
            <span style="font-size: 0.8rem; color: var(--color-charcoal-light);" id="gal-img-status">${isAr ? 'اختر صورة من جهازك' : 'Select an image file'}</span>
          </div>
        </div>
      </form>
    `;

    const footerHtml = `
      <button class="btn btn-outline" onclick="closeModal()">${isAr ? 'إلغاء' : 'Cancel'}</button>
      <button class="btn btn-gold" id="save-gal-btn">${isAr ? 'إضافة الصورة' : 'Save Photo'}</button>
    `;

    openModal(isAr ? 'إضافة صورة للمعرض' : 'Add Photo to Gallery', bodyHtml, footerHtml);

    document.getElementById('gal-image-file').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const formData = new FormData();
      formData.append('files', file);
      try {
        document.getElementById('gal-img-status').textContent = isAr ? 'جاري الرفع...' : 'Uploading...';
        const res = await api('/media/upload', { method: 'POST', body: formData });
        if (res.success && res.data.length > 0) {
          const path = res.data[0].file_path;
          document.getElementById('gal-image-url').value = path;
          document.getElementById('gal-img-preview').src = path;
          document.getElementById('gal-img-status').textContent = isAr ? 'تم الرفع!' : 'Uploaded!';
        }
      } catch (err) { showToast('Upload failed', 'error'); }
    });

    document.getElementById('save-gal-btn').addEventListener('click', async () => {
      try {
        await api('/gallery', {
          method: 'POST',
          body: JSON.stringify({
            title_ar: document.getElementById('gal-title-ar').value,
            title_en: document.getElementById('gal-title-en').value,
            category: document.getElementById('gal-category').value,
            image_url: document.getElementById('gal-image-url').value
          })
        });
        showToast(isAr ? 'تم إدراج الصورة للمعرض' : 'Photo added to gallery');
        closeModal();
        renderGallery(document.getElementById('app-viewport'));
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  // ==========================================================================
  // REQUIREMENT 4: USERS & ROLES WITH USER DELETION CONTROLS
  // ==========================================================================
  async function renderUsers(container) {
    try {
      const [usersData, rolesData] = await Promise.all([
        api('/users'),
        api('/roles')
      ]);

      state.users = usersData.data;
      state.roles = rolesData.data;
      const isAr = state.lang === 'ar';

      container.innerHTML = `
        <div class="page-header">
          <div class="page-title">
            <h1>${isAr ? 'إدارة موظفي المقهى والصلاحيات' : 'Users & Permissions'}</h1>
            <p>${isAr ? 'إضافة وتعديل وحذف حسابات الموظفين وتعيين أدوار الإدارة' : 'Add, edit, delete, and assign roles for café staff accounts'}</p>
          </div>
          <div class="header-actions">
            <button class="btn btn-gold" id="add-user-btn">
              <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4"/></svg>
              <span>${isAr ? '+ إضافة موظف جديد' : '+ Add New Staff User'}</span>
            </button>
          </div>
        </div>

        <div class="panel-card">
          <div class="panel-header">
            <h3>${isAr ? 'حسابات الموظفين المسجلين' : 'Registered Staff Accounts'}</h3>
          </div>
          <div class="panel-body" style="padding: 0;">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>${isAr ? 'اسم الموظف' : 'Staff Name'}</th>
                  <th>${isAr ? 'البريد الإلكتروني' : 'Email Address'}</th>
                  <th>${isAr ? 'الدور والصلاحية' : 'Role'}</th>
                  <th>${isAr ? 'الحالة' : 'Status'}</th>
                  <th>${isAr ? 'إجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                ${state.users.map(u => `
                  <tr>
                    <td><strong>${u.full_name} ${u.id === state.user.id ? `<span class="badge badge-info" style="font-size:0.7rem;">${isAr ? 'أنت' : 'You'}</span>` : ''}</strong></td>
                    <td>${u.email}</td>
                    <td><span class="badge badge-info">${u.role_name}</span></td>
                    <td><span class="badge ${u.status === 'active' ? 'badge-success' : 'badge-danger'}">${u.status}</span></td>
                    <td>
                      <div style="display: flex; gap: 0.4rem; flex-wrap: wrap;">
                        <button class="btn btn-navy btn-sm edit-user-btn" data-id="${u.id}">${isAr ? 'تعديل' : 'Edit'}</button>
                        <button class="btn btn-sm toggle-user-status-btn ${u.status === 'active' ? 'btn-outline' : 'btn-gold'}" data-id="${u.id}" data-status="${u.status}" ${u.id === state.user.id ? 'disabled' : ''}>
                          ${u.status === 'active' ? (isAr ? 'تعطيل' : 'Deactivate') : (isAr ? 'تنشيط' : 'Activate')}
                        </button>
                        ${u.id !== state.user.id ? `
                          <button class="btn btn-danger btn-sm delete-user-btn" data-id="${u.id}">${isAr ? 'حذف المستخدم' : 'Delete User'}</button>
                        ` : ''}
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;

      document.getElementById('add-user-btn').addEventListener('click', () => openUserModal());

      container.querySelectorAll('.edit-user-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const u = state.users.find(x => x.id == btn.getAttribute('data-id'));
          if (u) openUserModal(u);
        });
      });

      container.querySelectorAll('.toggle-user-status-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-id');
          const curr = btn.getAttribute('data-status');
          const next = curr === 'active' ? 'inactive' : 'active';
          try {
            await api(`/users/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status: next }) });
            showToast(isAr ? 'تم تغيير حالة الحساب' : 'User status updated');
            renderUsers(container);
          } catch (err) {
            showToast(err.message, 'error');
          }
        });
      });

      container.querySelectorAll('.delete-user-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const u = state.users.find(x => x.id == btn.getAttribute('data-id'));
          if (u) openDeleteUserModal(u);
        });
      });

    } catch (e) {
      container.innerHTML = `<div class="badge badge-danger">${state.lang === 'ar' ? 'فشل تحميل الحسابات' : 'Failed to load users'}</div>`;
    }
  }

  function openUserModal(user = null) {
    const isAr = state.lang === 'ar';
    const bodyHtml = `
      <form id="user-modal-form">
        <div class="form-group">
          <label>${isAr ? 'الاسم الكامل *' : 'Full Name *'}</label>
          <input type="text" id="user-name" class="form-control" required value="${user ? user.full_name : ''}" placeholder="أحمد سعيد">
        </div>
        <div class="form-group">
          <label>${isAr ? 'البريد الإلكتروني *' : 'Email Address *'}</label>
          <input type="email" id="user-email" class="form-control" required value="${user ? user.email : ''}" placeholder="staff@ozparkcafe.com">
        </div>
        <div class="form-group">
          <label>${isAr ? `كلمة المرور ${user ? '(اتركها فارغة للتعديل دون تغيير)' : '*'}` : `Password ${user ? '(leave blank to keep current)' : '*'}`}</label>
          <input type="password" id="user-password" class="form-control" ${user ? '' : 'required'} placeholder="••••••••">
        </div>
        <div class="form-group">
          <label>${isAr ? 'الدور والصلاحيات *' : 'Assigned Role *'}</label>
          <select id="user-role-id" class="form-control" required>
            ${state.roles.map(r => `<option value="${r.id}" ${user && user.role_id === r.id ? 'selected' : ''}>${r.name} (${r.description})</option>`).join('')}
          </select>
        </div>
      </form>
    `;

    const footerHtml = `
      <button class="btn btn-outline" onclick="closeModal()">${isAr ? 'إلغاء' : 'Cancel'}</button>
      <button class="btn btn-gold" id="save-user-btn">${user ? (isAr ? 'حفظ التعديلات' : 'Save Changes') : (isAr ? 'إنشاء حساب الموظف' : 'Create User')}</button>
    `;

    openModal(user ? (isAr ? 'تعديل حساب موظف' : 'Edit Staff User Account') : (isAr ? 'إضافة حساب موظف جديد' : 'Add New Staff User'), bodyHtml, footerHtml);

    document.getElementById('save-user-btn').addEventListener('click', async () => {
      const btn = document.getElementById('save-user-btn');
      const payload = {
        full_name: document.getElementById('user-name').value.trim(),
        email: document.getElementById('user-email').value.trim(),
        password: document.getElementById('user-password').value,
        role_id: parseInt(document.getElementById('user-role-id').value)
      };

      if (!payload.full_name || !payload.email || (!user && !payload.password) || !payload.role_id) {
        return showToast(isAr ? 'يرجى تعبئة كافة الحقول المطلوبة' : 'Please fill all required fields', 'error');
      }

      try {
        btn.disabled = true;
        btn.textContent = isAr ? 'جاري الحفظ...' : 'Saving...';

        if (user) {
          await api(`/users/${user.id}`, { method: 'PUT', body: JSON.stringify(payload) });
          showToast(isAr ? 'تم تعديل بيانات الموظف بنجاح' : 'Staff user account updated');
        } else {
          await api('/users', { method: 'POST', body: JSON.stringify(payload) });
          showToast(isAr ? 'تم إنشاء حساب الموظف بنجاح' : 'Staff user created');
        }
        closeModal();
        renderUsers(document.getElementById('app-viewport'));
      } catch (err) {
        btn.disabled = false;
        btn.textContent = user ? (isAr ? 'حفظ التعديلات' : 'Save Changes') : (isAr ? 'إنشاء حساب الموظف' : 'Create User');
        showToast(err.message, 'error');
      }
    });
  }

  function openDeleteUserModal(user) {
    const isAr = state.lang === 'ar';
    const roleObj = state.roles.find(r => r.id === user.role_id) || { name: user.role_name, permissions: user.permissions || '[]' };
    const permsList = JSON.parse(roleObj.permissions || '[]');

    const bodyHtml = `
      <div style="padding: 0.5rem 0;">
        <div style="text-align: center; margin-bottom: 1.25rem;">
          <svg width="48" height="48" fill="none" stroke="#e74c3c" stroke-width="2" viewBox="0 0 24 24" style="margin-bottom: 0.5rem;"><path d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6"/></svg>
          <h4 style="color: var(--color-navy); margin: 0;">${isAr ? 'تأكيد حذف حساب الموظف' : 'Confirm User Account Deletion'}</h4>
        </div>

        <div style="background: var(--color-cream); padding: 1rem; border-radius: 8px; border: 1px solid var(--color-cream-dark); margin-bottom: 1.25rem;">
          <div style="margin-bottom: 0.4rem;"><strong>${isAr ? 'اسم الموظف:' : 'Name:'}</strong> ${user.full_name}</div>
          <div style="margin-bottom: 0.4rem;"><strong>${isAr ? 'البريد الإلكتروني:' : 'Email:'}</strong> <code>${user.email}</code></div>
          <div style="margin-bottom: 0.4rem;"><strong>${isAr ? 'الدور الموكل:' : 'Assigned Role:'}</strong> <span class="badge badge-info">${user.role_name}</span></div>
          <div style="margin-bottom: 0.4rem;"><strong>${isAr ? 'حالة الحساب:' : 'Status:'}</strong> <span class="badge ${user.status === 'active' ? 'badge-success' : 'badge-danger'}">${user.status}</span></div>
          <div><strong>${isAr ? 'الصلاحيات:' : 'Assigned Permissions:'}</strong> <code style="font-size:0.75rem;">${permsList.join(', ')}</code></div>
        </div>

        <p style="color: #c0392b; font-size: 0.88rem; text-align: center; margin: 0;">
          ⚠️ ${isAr ? 'سيتم إلغاء تفعيل كافة جلسات الدخول الفعالة لهذا المستخدم فوراً ومنعه من دخول النظام.' : 'All active login sessions for this user will be revoked immediately.'}
        </p>
      </div>
    `;

    const footerHtml = `
      <button class="btn btn-outline" onclick="closeModal()">${isAr ? 'إلغاء' : 'Cancel'}</button>
      <button class="btn btn-danger" id="confirm-del-user-btn">${isAr ? 'تأكيد حذف المستخدم' : 'Delete User Account'}</button>
    `;

    openModal(isAr ? 'حذف حساب موظف' : 'Delete Staff Account', bodyHtml, footerHtml);

    document.getElementById('confirm-del-user-btn').addEventListener('click', async () => {
      const btn = document.getElementById('confirm-del-user-btn');

      try {
        btn.disabled = true;
        btn.textContent = isAr ? 'جاري الحذف...' : 'Deleting...';

        await api(`/users/${user.id}`, { method: 'DELETE' });
        showToast(isAr ? 'تم حذف حساب الموظف بنجاح' : 'Staff user deleted successfully');
        closeModal();
        renderUsers(document.getElementById('app-viewport'));
      } catch (err) {
        btn.disabled = false;
        btn.textContent = isAr ? 'تأكيد حذف المستخدم' : 'Delete User Account';
        showToast(err.message, 'error');
      }
    });
  }

  // ==========================================================================
  // VIEW 10: CAFÉ & SITE SETTINGS
  // ==========================================================================
  async function renderSettings(container) {
    try {
      const cafeData = await api('/settings/cafe');
      const cafe = cafeData.data;
      const isAr = state.lang === 'ar';

      container.innerHTML = `
        <div class="page-header">
          <div class="page-title">
            <h1>${isAr ? 'إعدادات المقهى والموقع العام' : 'Café & Site Settings'}</h1>
            <p>${isAr ? 'تحديث رقم الاتصال، الواتساب، ساعات العمل، وموقع خرائط جوجل' : 'Update phone number, WhatsApp, opening hours, and Google Maps'}</p>
          </div>
        </div>

        <div class="panel-card">
          <div class="panel-header">
            <h3>${isAr ? 'معلومات وتواصل أوز بارك كافيه' : 'Café Contact & Business Information'}</h3>
          </div>
          <div class="panel-body">
            <form id="cafe-settings-form">
              <div class="form-group">
                <label>${isAr ? 'اسم المقهى (بالعربية)' : 'Café Name (Arabic)'}</label>
                <input type="text" id="set-name-ar" class="form-control" value="${cafe.name_ar}">
              </div>
              <div class="form-group">
                <label>${isAr ? 'اسم المقهى (English)' : 'Café Name (English)'}</label>
                <input type="text" id="set-name-en" class="form-control" value="${cafe.name_en}">
              </div>
              <div class="form-group">
                <label>${isAr ? 'رقم الهاتف للاتصال' : 'Phone Number'}</label>
                <input type="text" id="set-phone" class="form-control" value="${cafe.phone || ''}">
              </div>
              <div class="form-group">
                <label>${isAr ? 'رقم الواتساب (WhatsApp Number)' : 'WhatsApp Number'}</label>
                <input type="text" id="set-whatsapp" class="form-control" value="${cafe.whatsapp || ''}">
              </div>
              <div class="form-group">
                <label>${isAr ? 'ساعات العمل (بالعربية)' : 'Opening Hours (Arabic)'}</label>
                <input type="text" id="set-hours-ar" class="form-control" value="${cafe.opening_hours_ar || ''}">
              </div>
              <div class="form-group">
                <label>${isAr ? 'ساعات العمل (English)' : 'Opening Hours (English)'}</label>
                <input type="text" id="set-hours-en" class="form-control" value="${cafe.opening_hours_en || ''}">
              </div>
              <div class="form-group">
                <label>${isAr ? 'رابط خرائط جوجل' : 'Google Maps Link'}</label>
                <input type="text" id="set-maps-url" class="form-control" value="${cafe.google_maps_url || ''}">
              </div>

              <button type="submit" class="btn btn-gold" style="margin-top: 1rem;">${isAr ? 'حفظ إعدادات المقهى' : 'Save Café Info'}</button>
            </form>
          </div>
        </div>
      `;

      document.getElementById('cafe-settings-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          await api('/settings/cafe', {
            method: 'PUT',
            body: JSON.stringify({
              name_ar: document.getElementById('set-name-ar').value,
              name_en: document.getElementById('set-name-en').value,
              phone: document.getElementById('set-phone').value,
              whatsapp: document.getElementById('set-whatsapp').value,
              opening_hours_ar: document.getElementById('set-hours-ar').value,
              opening_hours_en: document.getElementById('set-hours-en').value,
              google_maps_url: document.getElementById('set-maps-url').value
            })
          });
          showToast(isAr ? 'تم تحديث معلومات المقهى بنجاح' : 'Café details updated');
        } catch (err) {
          showToast(err.message, 'error');
        }
      });

    } catch (e) {
      container.innerHTML = `<div class="badge badge-danger">${state.lang === 'ar' ? 'فشل تحميل الإعدادات' : 'Failed to load settings'}</div>`;
    }
  }

  // ==========================================================================
  // VIEW 11: AUDIT LOGS
  // ==========================================================================
  async function renderActivity(container) {
    try {
      const data = await api('/activity');
      const logs = data.data;
      const isAr = state.lang === 'ar';

      container.innerHTML = `
        <div class="page-header">
          <div class="page-title">
            <h1>${isAr ? 'سجل العمليات والأمان (Audit Log)' : 'Audit Activity Log'}</h1>
            <p>${isAr ? 'تتبع عمليات الدخول وتعديل الأصناف وتغييرات الأسعار وتغييرات المستخدمين' : 'Complete security and system audit trail'}</p>
          </div>
        </div>

        <div class="panel-card">
          <div class="panel-body" style="padding: 0;">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>${isAr ? 'الوقت والتاريخ' : 'Timestamp'}</th>
                  <th>${isAr ? 'المستخدم' : 'User'}</th>
                  <th>${isAr ? 'نوع الإجراء' : 'Action'}</th>
                  <th>${isAr ? 'التفاصيل' : 'Details'}</th>
                  <th>${isAr ? 'عنوان IP' : 'IP Address'}</th>
                </tr>
              </thead>
              <tbody>
                ${logs.map(l => `
                  <tr>
                    <td>${new Date(l.created_at).toLocaleString()}</td>
                    <td><strong>${l.user_email || 'System'}</strong></td>
                    <td><span class="badge badge-info">${l.action}</span></td>
                    <td>${l.details || ''}</td>
                    <td><code>${l.ip_address}</code></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } catch (e) {
      container.innerHTML = `<div class="badge badge-danger">${state.lang === 'ar' ? 'فشل تحميل سجل الأمان' : 'Failed to load audit log'}</div>`;
    }
  }

  // Run initial Auth Check
  applyLanguage(state.lang);
  checkAuth();

});
