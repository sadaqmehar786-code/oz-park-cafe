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
        throw new Error(data.error || 'Server error');
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
        window.location.hash = '#/dashboard';
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
    state.currentRoute = route;

    document.querySelectorAll('.sidebar-menu a').forEach(a => {
      a.classList.toggle('active', a.getAttribute('data-route') === route);
    });

    renderRoute(route);
  }

  window.addEventListener('hashchange', handleHashRoute);

  function renderRoute(route) {
    const viewport = document.getElementById('app-viewport');
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
          <div class="header-actions">
            <button class="btn btn-gold" id="btn-quick-add-menu">
              <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4"/></svg>
              <span>${isAr ? 'إضافة صنف جديد' : 'Add Menu Item'}</span>
            </button>
          </div>
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
          <div class="stat-card">
            <div class="stat-info">
              <div class="number" style="color: ${stats.seoIssues.totalIssues > 0 ? '#e74c3c' : '#27ae60'};">${stats.seoIssues.totalIssues}</div>
              <div class="label">${isAr ? 'تنبيهات محركات البحث' : 'SEO Audit Alerts'}</div>
            </div>
            <div class="stat-icon" style="background: rgba(231,76,60,0.15); color: #e74c3c;">🔍</div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 1.5rem;">
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
        </div>
      `;

      document.getElementById('btn-quick-add-menu').addEventListener('click', () => window.location.hash = '#/menu');

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
  // VIEW 3: CAFÉ MENU MANAGEMENT
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
            <p>${isAr ? 'إضافة وتعديل وحذف المشروبات الساخنة والباردة والحلويات والأسعار' : 'Add, edit, and delete coffee, juices, desserts, prices, and availability'}</p>
          </div>
          <div class="header-actions" style="display: flex; gap: 0.5rem;">
            <button class="btn btn-navy" id="add-category-btn">
              <span>${isAr ? '+ تصنيف جديد' : '+ New Category'}</span>
            </button>
            <button class="btn btn-gold" id="add-menu-item-btn">
              <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4"/></svg>
              <span>${isAr ? '+ إضافة صنف جديد' : '+ Add New Item'}</span>
            </button>
          </div>
        </div>

        <div class="panel-card">
          <div class="panel-header">
            <div class="filter-bar" style="margin: 0; width: 100%;">
              <div class="search-box">
                <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                <input type="text" id="search-menu-input" class="form-control" placeholder="${isAr ? 'بحث عن صنف...' : 'Search items...'}">
              </div>
            </div>
          </div>
          <div class="panel-body" style="padding: 0;">
            <table class="admin-table" id="menu-items-table">
              <thead>
                <tr>
                  <th>${isAr ? 'الصنف والصورة' : 'Item & Image'}</th>
                  <th>${isAr ? 'التصنيف' : 'Category'}</th>
                  <th>${isAr ? 'السعر' : 'Price'}</th>
                  <th>${isAr ? 'السعرات' : 'Calories'}</th>
                  <th>${isAr ? 'التوفر' : 'Availability'}</th>
                  <th>${isAr ? 'إجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                ${state.menuItems.map(item => `
                  <tr data-name="${(item.name_ar + ' ' + item.name_en).toLowerCase()}">
                    <td>
                      <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <img src="${item.image_url}" style="width: 44px; height: 44px; border-radius: 8px; object-fit: cover;" alt="">
                        <div>
                          <div style="font-weight: 700; color: var(--color-navy);">${isAr ? item.name_ar : item.name_en}</div>
                          <div style="font-size: 0.75rem; color: var(--color-charcoal-light);">${isAr ? (item.description_ar || '') : (item.description_en || '')}</div>
                        </div>
                      </div>
                    </td>
                    <td><strong>${isAr ? item.category_name_ar : item.category_name_en}</strong></td>
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
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;

      document.getElementById('search-menu-input').addEventListener('input', (e) => {
        const val = e.target.value.toLowerCase();
        document.querySelectorAll('#menu-items-table tbody tr').forEach(tr => {
          const text = tr.getAttribute('data-name');
          tr.style.display = text.includes(val) ? '' : 'none';
        });
      });

      document.getElementById('add-menu-item-btn').addEventListener('click', () => openMenuItemModal());
      document.getElementById('add-category-btn').addEventListener('click', () => openCategoryModal());

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
              showToast(isAr ? 'تم حذف الصنف' : 'Menu item deleted');
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

  function openCategoryModal() {
    const isAr = state.lang === 'ar';
    const bodyHtml = `
      <form id="category-modal-form">
        <div class="form-group">
          <label>${isAr ? 'اسم التصنيف (بالعربية) *' : 'Category Name (Arabic) *'}</label>
          <input type="text" id="cat-name-ar" class="form-control" required placeholder="مثال: مشروبات مثلجة">
        </div>
        <div class="form-group">
          <label>${isAr ? 'اسم التصنيف (English) *' : 'Category Name (English) *'}</label>
          <input type="text" id="cat-name-en" class="form-control" required placeholder="e.g. Blended Frappes">
        </div>
        <div class="form-group">
          <label>${isAr ? 'أيقونة التصنيف' : 'Category Icon'}</label>
          <input type="text" id="cat-icon" class="form-control" value="☕">
        </div>
      </form>
    `;

    const footerHtml = `
      <button class="btn btn-outline" onclick="closeModal()">${isAr ? 'إلغاء' : 'Cancel'}</button>
      <button class="btn btn-gold" id="save-cat-btn">${isAr ? 'حفظ التصنيف' : 'Save Category'}</button>
    `;

    openModal(isAr ? 'إضافة تصنيف جديد' : 'Add New Category', bodyHtml, footerHtml);

    document.getElementById('save-cat-btn').addEventListener('click', async () => {
      const name_ar = document.getElementById('cat-name-ar').value;
      const name_en = document.getElementById('cat-name-en').value;
      const icon = document.getElementById('cat-icon').value;

      if (!name_ar || !name_en) return showToast(isAr ? 'أدخل الأسماء المطلوبة' : 'Fill required names', 'error');

      try {
        await api('/menu/categories', {
          method: 'POST',
          body: JSON.stringify({ name_ar, name_en, icon })
        });
        showToast(isAr ? 'تم إضافة التصنيف' : 'Category added');
        closeModal();
        renderMenu(document.getElementById('app-viewport'));
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  // ITEM MODAL WITH FILE UPLOADER INSTEAD OF IMAGE URL INPUT
  function openMenuItemModal(item = null) {
    const isAr = state.lang === 'ar';
    const currentImg = item ? item.image_url : 'assets/images/coffee.jpg';

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

        <!-- UPLOAD IMAGE CONTROL -->
        <div class="form-group">
          <label>${isAr ? 'رفع صورة الصنف (Upload Item Image) *' : 'Upload Item Image *'}</label>
          <input type="file" id="item-image-file" class="form-control" accept="image/*">
          <input type="hidden" id="item-image-url" value="${currentImg}">
          <div style="margin-top: 0.75rem; display: flex; align-items: center; gap: 0.75rem; background: var(--color-cream); padding: 0.6rem; border-radius: 8px;">
            <img id="item-img-preview" src="${currentImg}" style="width: 54px; height: 54px; border-radius: 8px; object-fit: cover; border: 1px solid var(--color-cream-dark);" alt="">
            <span style="font-size: 0.8rem; color: var(--color-charcoal-light);" id="item-img-status">
              ${isAr ? 'اختر ملف صورة من جهازك لتحديث الصورة فوراً' : 'Select an image file from your device to upload'}
            </span>
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
      <button class="btn btn-gold" id="save-item-btn">${isAr ? 'حفظ الصنف' : 'Save Item'}</button>
    `;

    openModal(item ? (isAr ? 'تعديل صنف بالقائمة' : 'Edit Menu Item') : (isAr ? 'إضافة صنف جديد' : 'Add New Menu Item'), bodyHtml, footerHtml);

    // Bind Instant Image Upload Event
    document.getElementById('item-image-file').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const formData = new FormData();
      formData.append('files', file);

      try {
        document.getElementById('item-img-status').textContent = isAr ? 'جاري رفع الصورة...' : 'Uploading image...';
        const uploadRes = await api('/media/upload', { method: 'POST', body: formData });
        if (uploadRes.success && uploadRes.data.length > 0) {
          const uploadedPath = uploadRes.data[0].file_path;
          document.getElementById('item-image-url').value = uploadedPath;
          document.getElementById('item-img-preview').src = uploadedPath;
          document.getElementById('item-img-status').textContent = isAr ? 'تم رفع الصورة بنجاح!' : 'Image uploaded successfully!';
        }
      } catch (err) {
        showToast(isAr ? 'فشل رفع الصورة' : 'Image upload failed', 'error');
      }
    });

    document.getElementById('save-item-btn').addEventListener('click', async () => {
      const payload = {
        name_ar: document.getElementById('item-name-ar').value,
        name_en: document.getElementById('item-name-en').value,
        category_id: parseInt(document.getElementById('item-category-id').value),
        price: parseFloat(document.getElementById('item-price').value),
        calories: document.getElementById('item-calories').value,
        image_url: document.getElementById('item-image-url').value,
        description_ar: document.getElementById('item-desc-ar').value,
        description_en: document.getElementById('item-desc-en').value
      };

      try {
        if (item) {
          await api(`/menu/items/${item.id}`, { method: 'PUT', body: JSON.stringify(payload) });
        } else {
          await api('/menu/items', { method: 'POST', body: JSON.stringify(payload) });
        }
        showToast(isAr ? 'تم حفظ الصنف بنجاح' : 'Menu item saved');
        closeModal();
        renderMenu(document.getElementById('app-viewport'));
      } catch (err) {
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
  // VIEW 9: USERS & ROLES
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
            <p>${isAr ? 'إضافة وتعديل حسابات الموظفين ومنح وتحديد أدوار الإدارة' : 'Add, edit, and assign roles for café staff accounts'}</p>
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
                    <td><strong>${u.full_name}</strong></td>
                    <td>${u.email}</td>
                    <td><span class="badge badge-info">${u.role_name}</span></td>
                    <td><span class="badge ${u.status === 'active' ? 'badge-success' : 'badge-danger'}">${u.status}</span></td>
                    <td>
                      <button class="btn btn-navy btn-sm toggle-user-status-btn" data-id="${u.id}" data-status="${u.status}">
                        ${u.status === 'active' ? (isAr ? 'تعطيل الحساب' : 'Deactivate') : (isAr ? 'تنشيط الحساب' : 'Activate')}
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;

      document.getElementById('add-user-btn').addEventListener('click', () => openUserModal());

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

    } catch (e) {
      container.innerHTML = `<div class="badge badge-danger">${state.lang === 'ar' ? 'فشل تحميل الحسابات' : 'Failed to load users'}</div>`;
    }
  }

  function openUserModal() {
    const isAr = state.lang === 'ar';
    const bodyHtml = `
      <form id="user-modal-form">
        <div class="form-group">
          <label>${isAr ? 'الاسم الكامل *' : 'Full Name *'}</label>
          <input type="text" id="user-name" class="form-control" required placeholder="أحمد سعيد">
        </div>
        <div class="form-group">
          <label>${isAr ? 'البريد الإلكتروني *' : 'Email Address *'}</label>
          <input type="email" id="user-email" class="form-control" required placeholder="staff@ozparkcafe.com">
        </div>
        <div class="form-group">
          <label>${isAr ? 'كلمة المرور *' : 'Password *'}</label>
          <input type="password" id="user-password" class="form-control" required placeholder="••••••••">
        </div>
        <div class="form-group">
          <label>${isAr ? 'الدور والصلاحيات *' : 'Assigned Role *'}</label>
          <select id="user-role-id" class="form-control" required>
            ${state.roles.map(r => `<option value="${r.id}">${r.name} (${r.description})</option>`).join('')}
          </select>
        </div>
      </form>
    `;

    const footerHtml = `
      <button class="btn btn-outline" onclick="closeModal()">${isAr ? 'إلغاء' : 'Cancel'}</button>
      <button class="btn btn-gold" id="save-user-btn">${isAr ? 'إنشاء حساب الموظف' : 'Create User'}</button>
    `;

    openModal(isAr ? 'إضافة حساب موظف جديد' : 'Add New Staff User', bodyHtml, footerHtml);

    document.getElementById('save-user-btn').addEventListener('click', async () => {
      try {
        await api('/users', {
          method: 'POST',
          body: JSON.stringify({
            full_name: document.getElementById('user-name').value,
            email: document.getElementById('user-email').value,
            password: document.getElementById('user-password').value,
            role_id: parseInt(document.getElementById('user-role-id').value)
          })
        });
        showToast(isAr ? 'تم إنشاء حساب الموظف بنجاح' : 'Staff user created');
        closeModal();
        renderUsers(document.getElementById('app-viewport'));
      } catch (err) {
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
            <p>${isAr ? 'تتبع عمليات الدخول وتعديل الأصناف وتغييرات الأسعار' : 'Complete security and system audit trail'}</p>
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
