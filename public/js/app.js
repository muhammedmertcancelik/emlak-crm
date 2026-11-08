// ============================================================
// EMLAK TAKİP CRM - CORE APPLICATION CONTROLLER
// ============================================================

const App = {
  activeTab: 'dashboard',
  currentUser: null,
  currentCompany: null,
  currentRole: 'agent',
  memberships: [],
  poolProperties: [],
  poolCustomers: [],
  poolSubTab: 'properties',
  poolMyShareFilter: 'all',
  myPoolProperties: [],
  myPoolCustomers: [],
  profileSubTab: 'properties',
  profilePropSearch: '',
  profileCustSearch: '',
  profilePropStatus: '',
  stats: null,
  properties: [],
  customers: [],
  followUps: [],
  departments: [],
  companyMembers: [],
  isOwnerOrAdmin() {
    const role = this.currentRole || (this.currentUser && this.currentUser.role) || (this.memberships && this.memberships[0] && this.memberships[0].role);
    return role === 'owner' || role === 'admin' || Boolean(this.currentUser && (this.currentUser.isPlatformAdmin || this.currentUser.role === 'owner' || this.currentUser.role === 'admin'));
  },
  filterState: {
    onlyMine: false,
    customerOnlyMine: false,
    type: '',
    status: '',
    city: '',
    district: '',
    neighborhood: '',
    siteName: '',
    currency: 'TRY',
    rooms: '',
    customRooms: [],
    customFeatures: [],
    minPrice: '',
    maxPrice: '',
    minGrossArea: '',
    maxGrossArea: '',
    minArea: '',
    maxArea: '',
    buildingAge: '',
    minAge: '',
    maxAge: '',
    floorType: '',
    floor: '',
    totalFloors: '',
    heating: '',
    bathrooms: '',
    hasBalcony: '',
    hasElevator: false,
    hasParking: false,
    siteOnly: false,
    isSite: '',
    furnishedStatus: '',
    tenantStatus: '',
    creditEligible: false,
    deedStatus: '',
    isSwap: false,
    priceClass: '',
    favoritesOnly: false,
    search: '',
    sortBy: 'newest',
    customerClass: '',
    customerStatus: '',
    customerLeadSource: '',
    customerPurpose: '',
    customerSearch: '',
    customerDepartment: '',
    department: '',
    followupFilter: 'all'
  },
  _filterInputTimer: null,

  async init() {
    if (typeof window !== 'undefined' && window.location && window.location.protocol === 'file:') {
      const banner = document.getElementById('file-protocol-banner');
      if (banner) banner.style.display = 'block';
    }

    try {
      this.bindNavigation();
      this.bindSearch();
      this.bindModals();
      this.initLocationSelectors();
      this.initPWA();
      this.initAuthEvents();
    } catch (e) {
      console.warn('Init setup warning:', e);
    }

    // Davet Bağlantısı Kontrolü (?inviteToken=... veya ?invite=...)
    let inviteToken = null;
    try {
      if (typeof window !== 'undefined' && window.location && window.location.search) {
        const urlParams = new URLSearchParams(window.location.search);
        inviteToken = urlParams.get('inviteToken') || urlParams.get('invite');
      }
    } catch (e) {
      console.warn('Invite check warning:', e);
    }

    if (inviteToken) {
      this.showLandingScreen();
      this.openAcceptInvitationModal(inviteToken);
      return;
    }

    const isAuthenticated = await this.checkAuthSession();
    if (isAuthenticated) {
      try {
        await this.refreshAllData();
        this.showTab('dashboard');
        this.checkNetworkInfo();
      } catch (err) {
        console.error('Data load error:', err);
      }
    } else {
      this.showLandingScreen();
    }
  },

  initLocationSelectors() {
    if (typeof Locations !== 'undefined') {
      const citySelect = document.getElementById('prop-city');
      if (citySelect) {
        Locations.populateCitySelect(citySelect, 'Van', false);
      }
    }
  },

  initPWA() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  },

  checkNetworkInfo() {
    const badge = document.getElementById('network-status-badge');
    if (badge) {
      badge.style.display = 'inline-flex';
    }
  },

  // ─── Oturum & Landing Ekranı Yönetimi ───────────────────────
  initAuthEvents() {
    window.addEventListener('auth:required', () => {
      this.currentUser = null;
      this.currentCompany = null;
      this.memberships = [];
      this.showLandingScreen();
      this.showToast('Oturum süreniz doldu, lütfen tekrar giriş yapın.', 'error');
    });

    // Landing sayfasında hash değişimi (örn: #section-features)
    window.addEventListener('hashchange', () => {
      const hash = window.location.hash;
      if (hash && document.querySelector(hash)) {
        document.querySelector(hash).scrollIntoView({ behavior: 'smooth' });
      }
    });
  },

  async checkAuthSession() {
    const token = API.getToken();
    if (!token) {
      this.showLandingScreen();
      return false;
    }

    try {
      const data = await API.getMe();
      if (data && data.user) {
        this.currentUser = data.user;
        this.currentCompany = data.company;
        this.memberships = data.memberships || [];
        this.currentRole = data.role || (data.memberships?.[0]?.role) || 'agent';
        this.updateAuthUI();
        this.showAppScreen();
        return true;
      } else {
        throw new Error('Geçersiz oturum verisi');
      }
    } catch (err) {
      console.warn('Oturum doğrulanamadı:', err.message);
      API.setToken(null);
      API.setActiveCompanyId(null);
      this.currentUser = null;
      this.currentCompany = null;
      this.currentRole = 'agent';
      this.memberships = [];
      this.showLandingScreen();
      return false;
    }
  },

  showLandingScreen() {
    const landing = document.getElementById('landing-screen');
    const app = document.getElementById('app-container');
    if (landing) landing.style.display = 'block';
    if (app) app.style.display = 'none';
    document.title = 'Emlak Takip CRM — Çok Şirketli Emlak & Portföy SaaS Platformu';
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
  },

  showAppScreen() {
    const landing = document.getElementById('landing-screen');
    const app = document.getElementById('app-container');
    if (landing) landing.style.display = 'none';
    if (app) {
      app.style.display = 'flex';
      app.style.visibility = 'visible';
    }
    document.title = `${this.currentCompany ? this.currentCompany.name : 'Emlak Takip'} — CRM Dashboard`;
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
  },

  updateAuthUI() {
    const compNameEl = document.getElementById('topbar-company-name');
    const userNameEl = document.getElementById('topbar-user-name');
    const userAvatarEl = document.getElementById('topbar-user-avatar');
    const roleBadgeEl = document.getElementById('topbar-user-role-badge');

    if (compNameEl && this.currentCompany) {
      compNameEl.innerText = this.currentCompany.name;
    }
    if (userNameEl && this.currentUser) {
      userNameEl.innerText = this.currentUser.fullName || this.currentUser.email;
    }
    if (userAvatarEl && this.currentUser) {
      const initials = (this.currentUser.fullName || 'U')
        .split(' ')
        .filter(Boolean)
        .map(n => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
      userAvatarEl.innerText = initials || '👤';
    }

    if (roleBadgeEl) {
      if (this.currentRole === 'owner') {
        roleBadgeEl.className = 'badge badge-role-owner';
        roleBadgeEl.innerText = '👑 ŞİRKET SAHİBİ';
        roleBadgeEl.title = 'Şirket Kurucusu / Tam Yetkili';
      } else if (this.currentRole === 'admin') {
        roleBadgeEl.className = 'badge badge-role-admin';
        roleBadgeEl.innerText = '🛡️ YÖNETİCİ';
        roleBadgeEl.title = 'Şirket Yöneticisi';
      } else {
        roleBadgeEl.className = 'badge badge-role-agent';
        roleBadgeEl.innerText = '👔 DANIŞMAN';
        roleBadgeEl.title = 'Gayrimenkul Danışmanı (Saha Satış & Portföy)';
      }
    }
  },

  openUserProfileModal() {
    const modal = document.getElementById('user-profile-modal');
    const body = document.getElementById('user-profile-modal-body');
    if (!modal || !body) return;

    if (!this.currentUser) {
      this.showLandingScreen();
      this.focusAuthPortal('login');
      return;
    }

    const role = this.currentRole;
    const isOwner = role === 'owner';
    const isAdmin = role === 'admin';
    const isAgent = !isOwner && !isAdmin;

    const roleLabel = isOwner ? '👑 Şirket Sahibi (Kurucu)' : (isAdmin ? '🛡️ Şirket Yöneticisi' : '👔 Gayrimenkul Danışmanı');
    const roleBadgeClass = isOwner ? 'badge-role-owner' : (isAdmin ? 'badge-role-admin' : 'badge-role-agent');

    body.innerHTML = `
      <div style="display:flex; align-items:center; gap:16px; padding:16px; background:var(--bg-card); border-radius:var(--radius-lg); border:1px solid var(--border-color); margin-bottom:18px;">
        <div style="width:52px; height:52px; border-radius:50%; background:var(--gradient-primary); display:flex; align-items:center; justify-content:center; font-size:20px; font-weight:800; color:white; flex-shrink:0;">
          ${(this.currentUser.fullName || 'U').charAt(0).toUpperCase()}
        </div>
        <div style="flex:1; min-width:0;">
          <div style="font-size:16px; font-weight:800; color:var(--text-primary);">${this.currentUser.fullName || 'Kullanıcı'}</div>
          <div style="font-size:12px; color:var(--text-muted);">${this.currentUser.email} ${this.currentUser.phone ? '• ' + this.currentUser.phone : ''}</div>
          <div style="margin-top:6px;">
            <span class="badge ${roleBadgeClass}" style="font-size:11px; padding:3px 10px; font-weight:800;">${roleLabel}</span>
          </div>
        </div>
      </div>

      <div style="background:var(--bg-tertiary); border:1px solid var(--border-color); border-radius:var(--radius-md); padding:16px; margin-bottom:18px;">
        <h4 style="font-size:13px; font-weight:700; color:var(--text-primary); margin-bottom:6px; display:flex; align-items:center; gap:6px;">
          🏢 Bağlı Ofis: <span style="color:var(--accent-emerald);">${this.currentCompany ? this.currentCompany.name : '—'}</span>
        </h4>
        <div style="font-size:12px; color:var(--text-secondary); line-height:1.6;">
          ${this.currentCompany?.city ? `📍 ${this.currentCompany.city} ` : ''}
          ${this.currentCompany?.phone ? `• 📞 ${this.currentCompany.phone} ` : ''}
        </div>
      </div>

      <div style="margin-bottom:18px;">
        <h4 style="font-size:13px; font-weight:700; color:var(--text-primary); margin-bottom:8px;">
          🔑 ${roleLabel} Yetki Kapsamı
        </h4>
        <div style="display:flex; flex-direction:column; gap:8px; font-size:12px;">
          <div style="display:flex; align-items:center; gap:8px; color:var(--accent-emerald);">
            <span>✓</span> <span>Kendi portföy ilanlarını ekleme, düzenleme ve silme</span>
          </div>
          <div style="display:flex; align-items:center; gap:8px; color:var(--accent-emerald);">
            <span>✓</span> <span>Müşteri CRM kayıtları oluşturma ve bütçe takibi</span>
          </div>
          <div style="display:flex; align-items:center; gap:8px; color:var(--accent-emerald);">
            <span>✓</span> <span>Yapay zeka akıllı portföy & müşteri eşleştirme motoru</span>
          </div>
          <div style="display:flex; align-items:center; gap:8px; color:var(--accent-emerald);">
            <span>✓</span> <span>Randevu, yer gösterme ve ziyaret ajandası</span>
          </div>
          <div style="display:flex; align-items:center; gap:8px; color:${isOwner || isAdmin ? 'var(--accent-emerald)' : 'var(--text-muted)'};">
            <span>${isOwner || isAdmin ? '✓' : '🔒'}</span> 
            <span>Şirket profili, resmi unvan ve vergi bilgileri (${isOwner || isAdmin ? 'Yetkili' : 'Sadece Şirket Sahibi'})</span>
          </div>
          <div style="display:flex; align-items:center; gap:8px; color:${isOwner || isAdmin ? 'var(--accent-emerald)' : 'var(--text-muted)'};">
            <span>${isOwner || isAdmin ? '✓' : '🔒'}</span> 
            <span>Ofise yeni danışman/çalışan davet etme (${isOwner || isAdmin ? 'Yetkili' : 'Sadece Yönetici / Sahip'})</span>
          </div>
          <div style="display:flex; align-items:center; gap:8px; color:${isOwner ? 'var(--accent-emerald)' : 'var(--text-muted)'};">
            <span>${isOwner ? '✓' : '🔒'}</span> 
            <span>Tüm veritabanı yedeğini alma ve geri yükleme (${isOwner ? 'Yetkili' : 'Sadece Şirket Sahibi'})</span>
          </div>
          <div style="display:flex; align-items:center; gap:8px; color:${isOwner || isAdmin ? 'var(--accent-emerald)' : 'var(--text-muted)'};">
            <span>${isOwner || isAdmin ? '✓' : '🔒'}</span> 
            <span>B2B Ortak Havuz'da şirket portföyünü açma/kapatma (${isOwner || isAdmin ? 'Yetkili' : 'Ofis Onayına Tabi'})</span>
          </div>
        </div>
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border-color); padding-top:14px;">
        <button type="button" class="btn btn-secondary btn-sm" onclick="App.openChangePasswordModal()">
          🔒 Şifremi Değiştir
        </button>
        <button type="button" class="btn btn-danger btn-sm" onclick="App.handleLogout()">
          🚪 Güvenli Çıkış Yap
        </button>
      </div>
    `;

    modal.classList.add('open');
  },

  focusAuthPortal(tab = 'login') {
    this.switchAuthPortalTab(tab);
    const card = document.getElementById('auth-portal-card');
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const targetInput = tab === 'login'
        ? document.getElementById('p-login-email')
        : document.getElementById('p-reg-fullname');
      if (targetInput) setTimeout(() => targetInput.focus(), 400);
    }
  },

  switchAuthPortalTab(tab) {
    const loginTab = document.getElementById('portal-tab-login');
    const regTab = document.getElementById('portal-tab-register');
    const loginForm = document.getElementById('portal-login-form');
    const regForm = document.getElementById('portal-register-form');

    if (tab === 'login') {
      if (loginTab) loginTab.classList.add('active');
      if (regTab) regTab.classList.remove('active');
      if (loginForm) loginForm.style.display = 'block';
      if (regForm) regForm.style.display = 'none';
    } else {
      if (loginTab) loginTab.classList.remove('active');
      if (regTab) regTab.classList.add('active');
      if (loginForm) loginForm.style.display = 'none';
      if (regForm) regForm.style.display = 'block';
    }
  },

  togglePasswordVisibility(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    if (input.type === 'password') {
      input.type = 'text';
      if (btn) btn.innerText = '🙈';
    } else {
      input.type = 'password';
      if (btn) btn.innerText = '👁️';
    }
  },

  checkPasswordStrength(pwd) {
    const fill = document.getElementById('pwd-strength-fill');
    const label = document.getElementById('pwd-strength-label');
    const reqLen = document.getElementById('req-len');
    const reqMix = document.getElementById('req-mix');

    const hasLen = Boolean(pwd && pwd.length >= 6);
    const hasMix = Boolean(pwd && /[A-Za-z]/.test(pwd) && /\d/.test(pwd));
    const hasSpecial = Boolean(pwd && /[^A-Za-z0-9]/.test(pwd));

    if (reqLen) reqLen.classList.toggle('valid', hasLen);
    if (reqMix) reqMix.classList.toggle('valid', hasMix);

    let score = 0;
    if (pwd && pwd.length > 0) score += 1;
    if (hasLen) score += 1;
    if (hasMix) score += 1;
    if (pwd && pwd.length >= 10 && hasSpecial) score += 1;

    if (!fill || !label) return;

    if (score <= 1) {
      fill.style.width = '25%';
      fill.style.backgroundColor = 'var(--accent-rose)';
      label.innerText = 'Şifre Gücü: Zayıf';
      label.style.color = 'var(--accent-rose)';
    } else if (score === 2 || score === 3) {
      fill.style.width = '65%';
      fill.style.backgroundColor = 'var(--accent-gold)';
      label.innerText = 'Şifre Gücü: Orta';
      label.style.color = 'var(--accent-gold)';
    } else {
      fill.style.width = '100%';
      fill.style.backgroundColor = 'var(--accent-emerald)';
      label.innerText = 'Şifre Gücü: Güçlü ✨';
      label.style.color = 'var(--accent-emerald)';
    }
  },

  checkPasswordMatch() {
    const p1 = document.getElementById('p-reg-password');
    const p2 = document.getElementById('p-reg-password-confirm');
    const msg = document.getElementById('pwd-match-msg');
    if (!p1 || !p2 || !msg) return;

    if (!p2.value) {
      msg.style.display = 'none';
      return;
    }

    msg.style.display = 'block';
    if (p1.value === p2.value) {
      msg.style.color = 'var(--accent-emerald)';
      msg.innerText = '✓ Parolalar eşleşiyor';
    } else {
      msg.style.color = 'var(--accent-rose)';
      msg.innerText = '✕ Parolalar uyuşmuyor';
    }
  },

  async handleLandingLogin(e) {
    e.preventDefault();
    const email = document.getElementById('p-login-email').value.trim();
    const password = document.getElementById('p-login-password').value;
    const btn = document.getElementById('btn-portal-login');

    if (!email || !password) {
      this.showToast('Lütfen e-posta ve parolanızı girin.', 'error');
      return;
    }

    try {
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span>Giriş Yapılıyor...</span>';
      }

      const res = await API.login(email, password);
      this.showToast(`Hoş geldiniz, ${res.user.fullName || res.user.email}! 🎉`);

      if (res && res.user) {
        this.currentUser = res.user;
        this.currentCompany = res.company;
        this.currentRole = res.role || 'agent';
        this.memberships = res.memberships || [];
        this.updateAuthUI();
        this.showAppScreen();
      } else {
        await this.checkAuthSession();
      }

      await this.refreshAllData();
      this.showTab('dashboard');
      this.checkNetworkInfo();
    } catch (err) {
      this.showToast('Giriş başarısız: ' + err.message, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span>Giriş Yap</span><span class="btn-arrow">➔</span>';
      }
    }
  },

  fillDemoCredentials() {
    const email = document.getElementById('p-login-email');
    const pwd = document.getElementById('p-login-password');
    if (email) email.value = 'admin@emlaktakip.com';
    if (pwd) pwd.value = 'admin123';
    this.showToast('Demo bilgileri yazıldı: admin@emlaktakip.com / admin123');
  },

  async handleDemoLogin(companyId = null, btnElement = null) {
    let originalHtml = '';
    if (btnElement) {
      originalHtml = btnElement.innerHTML;
      btnElement.disabled = true;
      btnElement.style.opacity = '0.7';
    }
    try {
      this.showToast('⚡ Demo oturumu hazırlanıyor...');
      const res = await API.demoLogin(companyId);
      const compName = res.company ? res.company.name : 'Örnek Emlak Gayrimenkul A.Ş.';
      this.showToast(`${compName} ile bağlandınız! 🎉`);

      if (res && res.user) {
        this.currentUser = res.user;
        this.currentCompany = res.company;
        this.currentRole = res.role || 'agent';
        this.memberships = res.memberships || [];
        this.updateAuthUI();
        this.showAppScreen();
      } else {
        await this.checkAuthSession();
      }

      await this.refreshAllData();
      this.showTab('dashboard');
      this.checkNetworkInfo();
    } catch (err) {
      console.error('Demo login error:', err);
      this.showToast('Demo girişi başarısız: ' + err.message, 'error');
    } finally {
      if (btnElement && originalHtml) {
        btnElement.disabled = false;
        btnElement.style.opacity = '1';
        btnElement.innerHTML = originalHtml;
      }
    }
  },

  async handleLandingRegister(e) {
    e.preventDefault();
    const fullName = document.getElementById('p-reg-fullname').value.trim();
    const companyName = document.getElementById('p-reg-company').value.trim();
    const email = document.getElementById('p-reg-email').value.trim();
    const phone = document.getElementById('p-reg-phone').value.trim();
    const city = document.getElementById('p-reg-city').value;
    const password = document.getElementById('p-reg-password').value;
    const confirm = document.getElementById('p-reg-password-confirm').value;
    const terms = document.getElementById('p-reg-terms').checked;
    const kvkk = document.getElementById('p-reg-kvkk').checked;
    const btn = document.getElementById('btn-portal-register');

    if (!terms || !kvkk) {
      this.showToast('Lütfen Kullanıcı Sözleşmesi ve KVKK metnini onaylayın.', 'error');
      return;
    }

    if (password !== confirm) {
      this.showToast('Girdiğiniz parolalar birbiriyle eşleşmiyor!', 'error');
      return;
    }

    if (password.length < 6) {
      this.showToast('Parola en az 6 karakter olmalıdır.', 'error');
      return;
    }

    try {
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span>Şirketiniz Kuruluyor...</span>';
      }

      const res = await API.register({
        fullName,
        companyName,
        email,
        phone,
        city,
        password
      });

      this.showToast(`Şirketiniz oluşturuldu! Hoş geldiniz, ${res.user.fullName}! 🎉`);

      await this.checkAuthSession();
      await this.refreshAllData();
      this.showTab('dashboard');
      this.checkNetworkInfo();
    } catch (err) {
      this.showToast('Kayıt başarısız: ' + err.message, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span>Şirketimi Oluştur ve Başla</span><span class="btn-arrow">➔</span>';
      }
    }
  },

  handleLogout() {
    API.logout();
    this.currentUser = null;
    this.currentCompany = null;
    this.memberships = [];
    this.showToast('Oturum kapatıldı. Görüşmek üzere!');
    this.showLandingScreen();
  },

  openTermsModal() {
    const m = document.getElementById('terms-modal');
    if (m) m.classList.add('open');
  },

  openKVKKModal() {
    const m = document.getElementById('kvkk-modal');
    if (m) m.classList.add('open');
  },

  openForgotPassModal() {
    const m = document.getElementById('forgot-password-modal');
    if (m) m.classList.add('open');
  },

  handleForgotPassword(e) {
    e.preventDefault();
    const email = document.getElementById('forgot-email')?.value.trim();
    if (!email) return;
    document.getElementById('forgot-password-modal')?.classList.remove('open');
    this.showToast(`Şifre sıfırlama talebiniz alındı (${email}). Destek ekibimiz sizinle iletişime geçecektir.`, 'success');
  },

  openUserAuthModal() {
    if (this.currentUser) {
      this.showToast(`Oturum: ${this.currentUser.fullName || this.currentUser.email} (${this.currentCompany ? this.currentCompany.name : ''})`);
    } else {
      this.showLandingScreen();
      this.focusAuthPortal('login');
    }
  },

  openCompanySwitcherModal() {
    const modal = document.getElementById('company-switcher-modal');
    const list = document.getElementById('company-switcher-list');
    if (!modal) return;

    if (list) {
      if (!this.memberships || this.memberships.length === 0) {
        list.innerHTML = `
          <div style="font-size:13px; color:var(--text-muted); text-align:center; padding:12px;">
            Şu anda kayıtlı olduğunuz şirket: <strong>${this.currentCompany ? this.currentCompany.name : '—'}</strong>
          </div>
        `;
      } else {
        list.innerHTML = this.memberships.map(m => {
          const isCurr = this.currentCompany && m.companyId === this.currentCompany.id;
          return `
            <div class="selector-item ${isCurr ? 'active' : ''}" onclick="App.handleSwitchCompany('${m.companyId}')">
              <div class="selector-avatar">${(m.companyName || 'Ş')[0].toUpperCase()}</div>
              <div class="selector-info">
                <div class="selector-title">${m.companyName}</div>
                <div class="selector-sub">Rol: ${m.role === 'owner' ? 'Şirket Kurucusu' : (m.role === 'admin' ? 'Yönetici' : 'Danışman')} ${isCurr ? '• (Aktif)' : ''}</div>
              </div>
              ${isCurr ? '<span style="color:var(--accent-emerald); font-weight:800;">✓</span>' : '<button class="btn btn-secondary btn-sm">Seç</button>'}
            </div>
          `;
        }).join('');
      }
    }

    modal.classList.add('open');
  },

  async handleSwitchCompany(targetCompanyId) {
    if (!targetCompanyId) return;
    try {
      this.showToast('Şirket değiştiriliyor...');
      await API.switchCompany(targetCompanyId);
      document.getElementById('company-switcher-modal')?.classList.remove('open');
      await this.checkAuthSession();
      await this.refreshAllData();
      this.showTab(this.activeTab);
      this.showToast('Aktif şirket değiştirildi! ✓');
    } catch (err) {
      this.showToast('Şirket değiştirilemedi: ' + err.message, 'error');
    }
  },


  openSharePropertyModal(propertyId) {
    const prop = this.properties.find(p => p.id === propertyId);
    if (!prop) return;
    document.getElementById('share-prop-id').value = prop.id;
    document.getElementById('share-prop-title-text').innerText = `${prop.title} (${this.formatPrice(prop.price, prop.currency)})`;
    document.getElementById('share-property-modal')?.classList.add('open');
  },

  async handleConfirmShareProperty(e) {
    e.preventDefault();
    const propId = document.getElementById('share-prop-id')?.value;
    const split = document.getElementById('share-prop-split')?.value;
    if (!propId) return;

    try {
      await API.shareProperty(propId, { targetType: 'all_members', commissionSplit: split });
      this.showToast('İlan B2B Ortak Havuzda başarıyla paylaşıldı! 🌐');
      document.getElementById('share-property-modal')?.classList.remove('open');
      await this.refreshAllData();
      if (this.activeTab === 'properties') this.renderProperties();
      if (this.activeTab === 'pool') this.renderPool();
    } catch (err) {
      this.showToast('Paylaşım hatası: ' + err.message, 'error');
    }
  },

  async handleUnshareProperty(propId) {
    if (!confirm('Bu ilanın B2B ortak havuzdaki paylaşımını kaldırmak istiyor musunuz?')) return;
    try {
      await API.unshareProperty(propId);
      this.showToast('İlanın B2B ortak havuz paylaşımı kaldırıldı.');
      await this.refreshAllData();
      if (this.activeTab === 'properties') this.renderProperties();
      if (this.activeTab === 'pool') this.renderPool();
    } catch (err) {
      this.showToast('İptal hatası: ' + err.message, 'error');
    }
  },

  openShareCustomerModal(customerId) {
    const cust = this.customers.find(c => c.id === customerId);
    if (!cust) return;
    document.getElementById('share-cust-id').value = cust.id;
    document.getElementById('share-cust-name-text').innerText = `${cust.fullName} (Bütçe: ${this.formatPrice(cust.totalBudget, cust.currency)})`;
    document.getElementById('share-customer-modal')?.classList.add('open');
  },

  async handleConfirmShareCustomer(e) {
    e.preventDefault();
    const custId = document.getElementById('share-cust-id')?.value;
    const note = document.getElementById('share-cust-legal-note')?.value;
    if (!custId) return;

    try {
      await API.shareCustomer(custId, { targetType: 'all_members', legalBasisNote: note });
      this.showToast('Müşteri talebi KVKK maskelemesiyle B2B havuza eklendi! 🔒');
      document.getElementById('share-customer-modal')?.classList.remove('open');
      await this.refreshAllData();
      if (this.activeTab === 'customers') this.renderCustomers();
      if (this.activeTab === 'pool') this.renderPool();
    } catch (err) {
      this.showToast('Paylaşım hatası: ' + err.message, 'error');
    }
  },

  async handleUnshareCustomer(custId) {
    if (!confirm('Bu müşteri talebinin ortak havuzdaki paylaşımını iptal etmek istiyor musunuz?')) return;
    try {
      await API.unshareCustomer(custId);
      this.showToast('Talep B2B havuzdan kaldırıldı.');
      await this.refreshAllData();
      if (this.activeTab === 'customers') this.renderCustomers();
      if (this.activeTab === 'pool') this.renderPool();
    } catch (err) {
      this.showToast('İptal hatası: ' + err.message, 'error');
    }
  },

  // ─── Format Yardımcıları ────────────────────────────────────
  formatPrice(num, currency = 'TRY') {
    if (num == null) return '—';
    const sym = currency === 'USD' ? '$' : (currency === 'EUR' ? '€' : '₺');
    if (num >= 1000000000) return `${sym}${(num / 1000000000).toFixed(2)} Milyar`;
    if (num >= 1000000) return `${sym}${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${sym}${(num / 1000).toFixed(0)}K`;
    return `${sym}${Number(num).toLocaleString('tr-TR')}`;
  },

  formatFullPrice(num, currency = 'TRY') {
    if (num == null) return '—';
    const sym = currency === 'USD' ? '$' : (currency === 'EUR' ? '€' : '₺');
    return `${sym}${Number(num).toLocaleString('tr-TR')}`;
  },

  formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  },

  // ─── Toast Bildirimi ────────────────────────────────────────
  showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span>${type === 'success' ? '✓' : '✕'}</span>
      <span>${message}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  },

  // ─── Navigasyon & Tab Yönetimi ──────────────────────────────
  bindNavigation() {
    // Tüm navigasyon butonları: Topbar hapları, Sayfalar Launcher kartları, eski menüler ve Mobil Nav
    const allNavItems = document.querySelectorAll('.nav-item, .topbar-nav-link, .launcher-card, .mobile-nav-item');
    allNavItems.forEach(item => {
      item.addEventListener('click', (e) => {
        const tab = e.currentTarget.dataset.tab;
        if (tab) {
          this.showTab(tab);
          this.closeNavLauncher();
        }
      });
    });

    const mobileFab = document.getElementById('mobile-fab-btn');
    if (mobileFab) {
      mobileFab.addEventListener('click', () => {
        this.openQuickAddModal();
      });
    }

    // Global klavye kısayolu (Esc: Sayfalar ve Filtre panelini kapat, M: Sayfalar Menüsünü Aç/Kapat)
    if (!this._hasBoundGlobalKeys) {
      this._hasBoundGlobalKeys = true;
      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          this.closeNavLauncher();
          this.closeFilterSidebar();
        } else if ((e.key === 'm' || e.key === 'M') && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
          if (!document.querySelector('.modal-backdrop.open:not(#modal-page-launcher)')) {
            e.preventDefault();
            this.toggleNavLauncher();
          }
        }
      });
    }
  },

  // ─── Microsoft / Apple Stili Sayfalar Launcher Popup Yönetimi ───
  toggleNavLauncher() {
    const modal = document.getElementById('modal-page-launcher');
    if (!modal) return;
    const isOpen = modal.classList.toggle('open');
    if (isOpen) {
      const input = document.getElementById('launcher-filter-input');
      if (input) {
        input.value = '';
        this.filterLauncherGrid('');
        setTimeout(() => input.focus(), 60);
      }
    }
  },

  closeNavLauncher() {
    const modal = document.getElementById('modal-page-launcher');
    if (modal) modal.classList.remove('open');
  },

  filterLauncherGrid(query) {
    const q = (query || '').toLowerCase().trim();
    const cards = document.querySelectorAll('#launcher-cards-grid .launcher-card');
    cards.forEach(card => {
      const text = card.textContent.toLowerCase();
      if (!q || text.includes(q)) {
        card.style.display = 'flex';
      } else {
        card.style.display = 'none';
      }
    });
  },

  // ─── Detaylı Filtreleme Çekmecesi (Drawer Overlay) ────────────
  toggleFilterSidebar() {
    const sidebar = document.getElementById('portal-filter-sidebar');
    const backdrop = document.getElementById('filter-drawer-backdrop');
    if (!sidebar) return;
    const isOpen = sidebar.classList.toggle('open');
    if (backdrop) backdrop.classList.toggle('open', isOpen);
  },

  closeFilterSidebar() {
    const sidebar = document.getElementById('portal-filter-sidebar');
    const backdrop = document.getElementById('filter-drawer-backdrop');
    if (sidebar) sidebar.classList.remove('open', 'mobile-open');
    if (backdrop) backdrop.classList.remove('open');
  },

  bindSearch() {
    const searchInput = document.getElementById('global-search-input');
    if (!searchInput) return;

    let searchTimer = null;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        const query = e.target.value.trim();
        this.filterState.search = query;

        const advKeyword = document.getElementById('adv-filter-keyword');
        if (advKeyword) advKeyword.value = query;

        if (this.activeTab !== 'properties') {
          this.showTab('properties');
        } else {
          this.renderProperties();
        }
      }, 300);
    });
  },

  showTab(tabName) {
    this.activeTab = tabName;
    this.closeNavLauncher();
    this.closeFilterSidebar();

    document.querySelectorAll('.nav-item, .mobile-nav-item, .topbar-nav-link, .launcher-card').forEach(el => {
      el.classList.toggle('active', el.dataset.tab === tabName);
    });

    document.querySelectorAll('.tab-content').forEach(el => {
      el.style.display = el.id === `tab-${tabName}` ? 'block' : 'none';
    });

    const titleMap = {
      dashboard: { title: 'Genel Bakış & Dashboard', sub: 'Portföy, Müşteri ve Günlük Takip Durumu' },
      profile: { title: 'Danışman Çalışma Masası & Profilim', sub: 'Kişisel portföyünüz, müşterileriniz, B2B havuz paylaşımlarınız ve ajandanız' },
      properties: { title: 'Portföy & İlanlar', sub: 'Detaylı Filtreleme ve Gayrimenkul Listesi' },
      customers: { title: 'Müşteriler & Talep CRM', sub: 'Kayıtlı Alıcı ve Yatırımcı Havuzu' },
      pool: { title: 'Ortak Portföy & Müşteri Havuzu (B2B Pazar)', sub: 'Diğer emlak şirketlerinin paylaştığı gayrimenkuller ve alıcı talepleri' },
      matching: { title: 'Akıllı Eşleştirme Motoru', sub: 'Oda Tipi ve Bütçeye Göre Müşteri-Portföy Eşleştirmesi' },
      followups: { title: 'Takip & Randevu Ajandası', sub: 'Geri Arama, Ziyaret ve Yer Gösterme Görevleri' },
      company: { title: 'Şirket & Ekip Yönetimi', sub: 'Ofis profili, danışman yetkileri ve çalışan davetleri' },
      settings: { title: 'Sistem & Senkronizasyon', sub: 'Ağ Bağlantısı, Yedekleme ve Mobil Erişim' }
    };

    const header = titleMap[tabName] || { title: 'Emlak Takip CRM', sub: '' };
    const titleEl = document.getElementById('page-title');
    const subEl = document.getElementById('page-subtitle');
    if (titleEl) titleEl.innerText = header.title;
    if (subEl) subEl.innerText = header.sub;

    if (tabName === 'dashboard') {
      this.renderDashboard();
    } else if (tabName === 'profile') {
      this.renderProfile();
    } else if (tabName === 'properties') {
      this.renderProperties();
    } else if (tabName === 'customers') {
      this.renderCustomers();
    } else if (tabName === 'pool') {
      this.renderPool();
    } else if (tabName === 'matching') {
      MatchingEngine.init();
      MatchingEngine.loadSelectorList();
    } else if (tabName === 'followups') {
      this.renderFollowUps();
    } else if (tabName === 'company') {
      this.renderCompany();
    } else if (tabName === 'settings') {
      this.renderSettings();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  // ─── Veri Çekme ─────────────────────────────────────────────
  async refreshAllData() {
    try {
      const [statsRes, propsRes, custsRes, followUpsRes, deptsRes] = await Promise.allSettled([
        API.getStats(),
        API.getProperties(),
        API.getCustomers(),
        API.getFollowUps(),
        API.getDepartments()
      ]);

      if (statsRes.status === 'fulfilled' && statsRes.value && !statsRes.value.error) {
        this.stats = statsRes.value;
      }
      if (propsRes.status === 'fulfilled' && Array.isArray(propsRes.value)) {
        this.properties = propsRes.value;
      }
      if (custsRes.status === 'fulfilled' && Array.isArray(custsRes.value)) {
        this.customers = custsRes.value;
      }
      if (followUpsRes.status === 'fulfilled' && Array.isArray(followUpsRes.value)) {
        this.followUps = followUpsRes.value;
      }
      if (deptsRes && deptsRes.status === 'fulfilled' && Array.isArray(deptsRes.value)) {
        this.departments = deptsRes.value;
        this.populateDepartmentSelectors();
      }

      this.updateBadges();
    } catch (err) {
      console.error('Veri yenileme hatası:', err);
    }
  },

  updateBadges() {
    const propBadge = document.getElementById('badge-prop-count');
    const custBadge = document.getElementById('badge-cust-count');
    const fuBadge = document.getElementById('badge-followup-count');
    const poolBadge = document.getElementById('badge-pool-count');
    const myPortBadge = document.getElementById('badge-my-portfolio-count');

    if (propBadge) propBadge.innerText = this.properties.length;
    if (custBadge) custBadge.innerText = this.customers.length;
    if (fuBadge) {
      const pendingCount = this.followUps.filter(f => !f.isCompleted).length;
      fuBadge.innerText = pendingCount;
    }
    if (poolBadge && this.stats) {
      poolBadge.innerText = (this.stats.poolPropertiesCount || 0) + (this.stats.poolCustomersCount || 0);
    }
    if (myPortBadge && this.currentUser) {
      const myCount = this.properties.filter(p => p.createdById === this.currentUser.id).length;
      myPortBadge.innerText = myCount;
    }
  },

  // ─── DANIŞMAN PROFİLİ & ÇALIŞMA MASASI ───────────────────────
  async renderProfile() {
    await this.refreshAllData();

    if (!this.currentUser) return;

    // Profil Hero Bilgileri
    const nameEl = document.getElementById('profile-card-name');
    const emailEl = document.getElementById('profile-card-email');
    const phoneEl = document.getElementById('profile-card-phone');
    const compEl = document.getElementById('profile-card-company');
    const cityEl = document.getElementById('profile-card-city');
    const roleBadgeEl = document.getElementById('profile-card-role-badge');
    const avatarEl = document.getElementById('profile-card-avatar');

    const displayName = this.currentUser.fullName || this.currentUser.name || 'Danışman';
    if (nameEl) nameEl.innerText = displayName;
    if (emailEl) emailEl.innerText = this.currentUser.email || '—';
    if (phoneEl) phoneEl.innerText = this.currentUser.phone || (this.currentCompany ? this.currentCompany.phone : '—') || '—';
    if (compEl) compEl.innerText = this.currentCompany ? this.currentCompany.name : 'Bağımsız Danışman';
    if (cityEl) cityEl.innerText = (this.currentCompany && this.currentCompany.city) ? `${this.currentCompany.city} / Türkiye` : 'Van / Türkiye';

    if (roleBadgeEl) {
      if (this.currentRole === 'owner') {
        roleBadgeEl.className = 'badge badge-role-owner';
        roleBadgeEl.innerHTML = '👑 ŞİRKET SAHİBİ';
      } else if (this.currentRole === 'admin') {
        roleBadgeEl.className = 'badge badge-role-admin';
        roleBadgeEl.innerHTML = '🛡️ YÖNETİCİ';
      } else {
        roleBadgeEl.className = 'badge badge-role-agent';
        roleBadgeEl.innerHTML = '👔 DANIŞMAN';
      }
    }

    if (avatarEl) {
      const initials = displayName.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().substring(0, 2);
      avatarEl.innerText = initials || '👤';
    }

    const deptBadgeEl = document.getElementById('profile-card-department-badge');
    if (deptBadgeEl) {
      const myDept = this.departments.find(d => Array.isArray(d.assignedUserIds) && d.assignedUserIds.includes(this.currentUser.id));
      if (myDept) {
        deptBadgeEl.style.display = 'inline-flex';
        deptBadgeEl.style.background = `${myDept.color || '#10b981'}25`;
        deptBadgeEl.style.color = myDept.color || '#10b981';
        deptBadgeEl.style.border = `1px solid ${myDept.color || '#10b981'}50`;
        deptBadgeEl.innerHTML = `${myDept.icon || '🏛️'} ${myDept.name}`;
      } else {
        deptBadgeEl.style.display = 'inline-flex';
        deptBadgeEl.style.background = 'var(--bg-tertiary)';
        deptBadgeEl.style.color = 'var(--text-muted)';
        deptBadgeEl.style.border = '1px solid var(--border-color)';
        deptBadgeEl.innerHTML = '🏛️ Genel Portföy';
      }
    }

    // Kişisel portföy ve müşteri verileri
    const myProps = this.properties.filter(p => p.createdById === this.currentUser.id);
    const myCusts = this.customers.filter(c => c.createdById === this.currentUser.id);
    const mySharedProps = myProps.filter(p => p.shareStatus === 'shared_pool');
    const mySharedCusts = myCusts.filter(c => c.shareStatus === 'shared_pool');
    const myFollowUps = this.followUps.filter(f => f.assignedToUserId === this.currentUser.id || f.createdById === this.currentUser.id);
    const myPendingFollowUps = myFollowUps.filter(f => !f.isCompleted);

    // Alt sekme rozetleri
    const propCountEl = document.getElementById('profile-prop-count');
    const custCountEl = document.getElementById('profile-cust-count');
    const poolCountEl = document.getElementById('profile-pool-count');
    const fuCountEl = document.getElementById('profile-followup-count');

    if (propCountEl) propCountEl.innerText = myProps.length;
    if (custCountEl) custCountEl.innerText = myCusts.length;
    if (poolCountEl) poolCountEl.innerText = mySharedProps.length + mySharedCusts.length;
    if (fuCountEl) fuCountEl.innerText = myFollowUps.length;

    // Profil KPI Grid Kartları
    const statsGrid = document.getElementById('profile-stats-grid');
    if (statsGrid) {
      const satilikCount = myProps.filter(p => p.status === 'satilik').length;
      const kiralikCount = myProps.filter(p => p.status === 'kiralik').length;
      const myPortfolioVal = myProps.reduce((sum, p) => sum + (Number(p.price) || 0), 0);

      statsGrid.innerHTML = `
        <div class="stat-card" style="--card-accent: var(--accent-emerald); cursor:pointer;" onclick="App.setProfileSubTab('properties')">
          <div class="stat-header">
            <span class="stat-title">Kendi Portföyüm</span>
            <div class="stat-icon">🏠</div>
          </div>
          <div class="stat-value">${myProps.length} İlan</div>
          <div class="stat-subtitle">${satilikCount} Satılık • ${kiralikCount} Kiralık • ${this.formatPrice(myPortfolioVal)}</div>
        </div>

        <div class="stat-card" style="--card-accent: var(--accent-cyan); cursor:pointer;" onclick="App.setProfileSubTab('customers')">
          <div class="stat-header">
            <span class="stat-title">Kendi Müşterilerim</span>
            <div class="stat-icon">👥</div>
          </div>
          <div class="stat-value">${myCusts.length} Müşteri</div>
          <div class="stat-subtitle">Doğrudan yönettiğiniz alıcı ve yatırımcı havuzu</div>
        </div>

        <div class="stat-card" style="--card-accent: #a855f7; cursor:pointer;" onclick="App.setProfileSubTab('pool')">
          <div class="stat-header">
            <span class="stat-title">B2B Havuz Katkım</span>
            <div class="stat-icon">🌐</div>
          </div>
          <div class="stat-value">${mySharedProps.length + mySharedCusts.length} Paylaşım</div>
          <div class="stat-subtitle">${mySharedProps.length} Havuz İlanı • ${mySharedCusts.length} Alıcı Talebi</div>
        </div>

        <div class="stat-card" style="--card-accent: var(--accent-amber); cursor:pointer;" onclick="App.setProfileSubTab('followups')">
          <div class="stat-header">
            <span class="stat-title">Bekleyen Takiplerim</span>
            <div class="stat-icon">⏰</div>
          </div>
          <div class="stat-value">${myPendingFollowUps.length} Görev</div>
          <div class="stat-subtitle">${myFollowUps.length - myPendingFollowUps.length} Tamamlandı / ${myFollowUps.length} Toplam Randevu</div>
        </div>
      `;
    }

    this.loadProfileSubTabData();
  },

  setProfileSubTab(subTab) {
    this.profileSubTab = subTab;

    document.querySelectorAll('.profile-subtab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.subtab === subTab);
    });

    const views = {
      properties: document.getElementById('profile-properties-view'),
      customers: document.getElementById('profile-customers-view'),
      pool: document.getElementById('profile-pool-view'),
      followups: document.getElementById('profile-followups-view')
    };

    Object.keys(views).forEach(k => {
      if (views[k]) views[k].style.display = k === subTab ? 'block' : 'none';
    });

    this.loadProfileSubTabData();
  },

  loadProfileSubTabData() {
    if (!this.currentUser) return;
    const currentUserId = this.currentUser.id;

    if (this.profileSubTab === 'properties') {
      const grid = document.getElementById('profile-properties-grid');
      if (!grid) return;

      let list = this.properties.filter(p => p.createdById === currentUserId);

      if (this.profilePropStatus) {
        list = list.filter(p => p.status === this.profilePropStatus);
      }

      if (this.profilePropSearch) {
        const q = this.profilePropSearch.toLowerCase().trim();
        list = list.filter(p =>
          (p.title && p.title.toLowerCase().includes(q)) ||
          (p.district && p.district.toLowerCase().includes(q)) ||
          (p.portfolioCode && p.portfolioCode.toLowerCase().includes(q))
        );
      }

      if (list.length === 0) {
        grid.innerHTML = `
          <div style="grid-column:1/-1; text-align:center; padding:50px 20px; background:var(--bg-card); border-radius:var(--radius-xl); border:1px solid var(--border-color);">
            <div style="font-size:36px; margin-bottom:8px;">🏠</div>
            <h4 style="font-size:16px; font-weight:700;">Henüz adınıza kayıtlı ilan bulunmuyor</h4>
            <p style="color:var(--text-muted); font-size:12px; margin-bottom:16px;">Eklediğiniz gayrimenkul portföyleri burada listelenir ve doğrudan yönetebilirsiniz.</p>
            <button class="btn btn-primary" onclick="App.openCreatePropertyModal()">+ İlk İlanınızı Ekleyin</button>
          </div>
        `;
        return;
      }

      grid.innerHTML = list.map(p => this.renderPropertyCard(p)).join('');
    } else if (this.profileSubTab === 'customers') {
      const grid = document.getElementById('profile-customers-grid');
      if (!grid) return;

      let list = this.customers.filter(c => c.createdById === currentUserId);

      if (this.profileCustSearch) {
        const q = this.profileCustSearch.toLowerCase().trim();
        list = list.filter(c =>
          (c.name && c.name.toLowerCase().includes(q)) ||
          (c.phone && c.phone.includes(q)) ||
          (c.email && c.email.toLowerCase().includes(q)) ||
          (c.notes && c.notes.toLowerCase().includes(q))
        );
      }

      if (list.length === 0) {
        grid.innerHTML = `
          <div style="grid-column:1/-1; text-align:center; padding:50px 20px; background:var(--bg-card); border-radius:var(--radius-xl); border:1px solid var(--border-color);">
            <div style="font-size:36px; margin-bottom:8px;">👥</div>
            <h4 style="font-size:16px; font-weight:700;">Henüz adınıza kayıtlı müşteri bulunmuyor</h4>
            <p style="color:var(--text-muted); font-size:12px; margin-bottom:16px;">Kendi müşteri portföyünüzü ekleyerek bütçe ve talep takibi yapabilirsiniz.</p>
            <button class="btn btn-primary" onclick="App.openCreateCustomerModal()">+ Yeni Müşteri Ekleyin</button>
          </div>
        `;
        return;
      }

      grid.innerHTML = list.map(c => this.renderCustomerCard(c)).join('');
    } else if (this.profileSubTab === 'pool') {
      const grid = document.getElementById('profile-pool-grid');
      if (!grid) return;

      const mySharedProps = this.properties.filter(p => p.createdById === currentUserId && p.shareStatus === 'shared_pool');
      const mySharedCusts = this.customers.filter(c => c.createdById === currentUserId && c.shareStatus === 'shared_pool');

      if (mySharedProps.length === 0 && mySharedCusts.length === 0) {
        grid.innerHTML = `
          <div style="grid-column:1/-1; text-align:center; padding:50px 20px; background:var(--bg-card); border-radius:var(--radius-xl); border:1px solid var(--border-color);">
            <div style="font-size:36px; margin-bottom:8px;">🌐</div>
            <h4 style="font-size:16px; font-weight:700;">Henüz B2B Ortak Havuzda Paylaşımınız Yok</h4>
            <p style="color:var(--text-muted); font-size:12px; margin-bottom:16px;">İlanlarınızın ve müşterilerinizin üzerindeki "🌐 Paylaş" butonuna tıklayarak havuza açabilir ve diğer emlak ofisleriyle komisyon paylaşımlı iş birliği yapabilirsiniz.</p>
            <button class="btn btn-secondary" onclick="App.setProfileSubTab('properties')">İlanlarımdan Paylaş ➔</button>
          </div>
        `;
        return;
      }

      let html = '';
      mySharedProps.forEach(p => {
        html += `
          <div class="pool-my-share-card">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
              <span class="pool-my-share-badge badge-sale">🏠 İLAN PAYLAŞIMI</span>
              <span class="badge badge-shared-pool">🌐 B2B AKTİF</span>
            </div>
            <div style="font-weight:700; font-size:15px; margin-bottom:4px;">${p.title}</div>
            <div style="font-size:12px; color:var(--text-muted); margin-bottom:8px;">
              📍 ${p.district || ''} / ${p.city || ''} • 💰 <strong style="color:var(--accent-emerald);">${this.formatPrice(p.price)}</strong>
            </div>
            <div style="font-size:11.5px; background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:var(--radius-sm); padding:6px 10px; margin-bottom:12px; color:var(--text-primary);">
              🤝 <strong>Komisyon Paylaşımı:</strong> ${p.commissionSplit || '50/50'}
            </div>
            <div style="display:flex; gap:8px;">
              <button class="btn btn-secondary btn-sm" style="flex:1;" onclick="App.openSharePropertyModal('${p.id}')">
                ✏️ Paylaşımı Düzenle
              </button>
              <button class="btn btn-danger btn-sm" onclick="App.handleQuickRevokeProperty('${p.id}')" title="Havuzdan Kaldır">
                🚫 Havuzdan Çıkar
              </button>
            </div>
          </div>
        `;
      });

      mySharedCusts.forEach(c => {
        html += `
          <div class="pool-my-share-card">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
              <span class="pool-my-share-badge badge-rent">👥 ALICI TALEBİ PAYLAŞIMI</span>
              <span class="badge badge-shared-pool">🌐 B2B AKTİF</span>
            </div>
            <div style="font-weight:700; font-size:15px; margin-bottom:4px;">${c.name}</div>
            <div style="font-size:12px; color:var(--text-muted); margin-bottom:8px;">
              🎯 Bütçe: <strong>${this.formatPrice(c.totalBudget)}</strong> • ${c.purpose === 'yatirim' ? 'Yatırım' : 'Oturum'}
            </div>
            <div style="font-size:11.5px; background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:var(--radius-sm); padding:6px 10px; margin-bottom:12px; color:var(--text-secondary);">
              🔒 <strong>KVKK Korumalı:</strong> Telefon ve notlar dışarıya gizlenmiştir.
            </div>
            <div style="display:flex; gap:8px;">
              <button class="btn btn-secondary btn-sm" style="flex:1;" onclick="App.openShareCustomerModal('${c.id}')">
                ✏️ Notu Düzenle
              </button>
              <button class="btn btn-danger btn-sm" onclick="App.handleQuickRevokeCustomer('${c.id}')" title="Havuzdan Kaldır">
                🚫 Havuzdan Çıkar
              </button>
            </div>
          </div>
        `;
      });

      grid.innerHTML = html;
    } else if (this.profileSubTab === 'followups') {
      const listContainer = document.getElementById('profile-followups-list');
      if (!listContainer) return;

      const myTasks = this.followUps.filter(f => f.assignedToUserId === currentUserId || f.createdById === currentUserId);

      if (myTasks.length === 0) {
        listContainer.innerHTML = `
          <div style="text-align:center; padding:40px 20px; background:var(--bg-card); border-radius:var(--radius-xl); border:1px solid var(--border-color);">
            <div style="font-size:36px; margin-bottom:8px;">⏰</div>
            <h4 style="font-size:16px; font-weight:700;">Bekleyen göreviniz bulunmuyor</h4>
            <p style="color:var(--text-muted); font-size:12px; margin-bottom:16px;">Müşteri araması, yer gösterme ve randevularınızı buradan planlayabilirsiniz.</p>
            <button class="btn btn-primary" onclick="App.openCreateFollowUpModal()">+ Yeni Takip Planla</button>
          </div>
        `;
        return;
      }

      listContainer.innerHTML = myTasks.map(f => this.renderFollowUpItem(f)).join('');
    }
  },

  onProfileSearch(type, val) {
    if (type === 'prop') {
      this.profilePropSearch = val;
    } else {
      this.profileCustSearch = val;
    }
    clearTimeout(this._profileSearchTimer);
    this._profileSearchTimer = setTimeout(() => {
      this.loadProfileSubTabData();
    }, 250);
  },

  onProfileFilterStatus(val) {
    this.profilePropStatus = val;
    this.loadProfileSubTabData();
  },

  openChangePasswordModal() {
    const modal = document.getElementById('modal-change-password');
    if (modal) {
      const form = document.getElementById('change-password-form');
      if (form) form.reset();
      modal.classList.add('open');
    }
  },

  async handleConfirmChangePassword(e) {
    e.preventDefault();
    const currentPass = document.getElementById('cp-current-password').value;
    const newPass = document.getElementById('cp-new-password').value;
    const confirmPass = document.getElementById('cp-new-password-confirm').value;

    if (newPass !== confirmPass) {
      this.showToast('Yeni parola ve parola tekrarı eşleşmiyor.', 'error');
      return;
    }
    if (newPass.length < 6) {
      this.showToast('Yeni parola en az 6 karakter olmalıdır.', 'error');
      return;
    }

    try {
      const res = await API.changePassword(currentPass, newPass);
      this.showToast(res.message || 'Parolanız başarıyla güncellendi.');
      const modal = document.getElementById('modal-change-password');
      if (modal) modal.classList.remove('open');
    } catch (err) {
      this.showToast(err.message || 'Parola güncellenemedi.', 'error');
    }
  },

  async handleQuickRevokeProperty(id) {
    if (!confirm('Bu ilanı B2B Ortak Havuzdan kaldırmak istediğinize emin misiniz? (Kendi portföyünüzde kalmaya devam eder)')) return;
    try {
      await API.shareProperty(id, { action: 'revoke' });
      this.showToast('İlan başarıyla ortak havuzdan çıkarıldı ve özel yapıldı.');
      await this.refreshAllData();
      if (this.activeTab === 'profile') this.renderProfile();
      if (this.activeTab === 'pool') this.loadPoolData();
      if (this.activeTab === 'properties') this.renderProperties();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  async handleQuickRevokeCustomer(id) {
    if (!confirm('Bu müşteri talebini B2B Ortak Havuzdan kaldırmak istediğinize emin misiniz? (Kendi müşteri listenizde kalmaya devam eder)')) return;
    try {
      await API.shareCustomer(id, { action: 'revoke' });
      this.showToast('Müşteri talebi ortak havuzdan çıkarıldı.');
      await this.refreshAllData();
      if (this.activeTab === 'profile') this.renderProfile();
      if (this.activeTab === 'pool') this.loadPoolData();
      if (this.activeTab === 'customers') this.renderCustomers();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  // ─── Dashboard Render ───────────────────────────────────────
  async renderDashboard() {
    await this.refreshAllData();

    const statCardsContainer = document.getElementById('dashboard-stats-grid');
    if (statCardsContainer && this.stats) {
      const isAgent = !this.isOwnerOrAdmin();
      if (isAgent) {
        statCardsContainer.innerHTML = `
          <div class="stat-card" style="--card-accent: var(--accent-emerald);">
            <div class="stat-header">
              <span class="stat-title">Portföyüm</span>
              <div class="stat-icon">🏠</div>
            </div>
            <div class="stat-value">${this.stats.myPropertiesCount || 0} İlanım</div>
            <div class="stat-subtitle">Ofis Toplamı: ${this.stats.totalProperties} İlan</div>
          </div>

          <div class="stat-card" style="--card-accent: var(--accent-gold);">
            <div class="stat-header">
              <span class="stat-title">Ofis Portföy Değeri</span>
              <div class="stat-icon">💰</div>
            </div>
            <div class="stat-value">${this.formatPrice(this.stats.totalPortfolioValue)}</div>
            <div class="stat-subtitle">Toplam Gayrimenkul Hacmi</div>
          </div>

          <div class="stat-card" style="--card-accent: var(--accent-cyan);">
            <div class="stat-header">
              <span class="stat-title">Müşterilerim</span>
              <div class="stat-icon">👥</div>
            </div>
            <div class="stat-value">${this.stats.myCustomersCount || 0} Müşterim</div>
            <div class="stat-subtitle">Ofis Toplamı: ${this.stats.totalCustomers} Müşteri</div>
          </div>

          <div class="stat-card" style="--card-accent: var(--accent-rose);">
            <div class="stat-header">
              <span class="stat-title">Bugünkü Takiplerim</span>
              <div class="stat-icon">⏰</div>
            </div>
            <div class="stat-value">${this.stats.myTodayFollowUpsCount || 0} Randevum</div>
            <div class="stat-subtitle">Ofis Bekleyen: ${this.stats.pendingFollowUpsCount} Görev</div>
          </div>
        `;
      } else {
        statCardsContainer.innerHTML = `
          <div class="stat-card" style="--card-accent: var(--accent-emerald);">
            <div class="stat-header">
              <span class="stat-title">Toplam Portföy</span>
              <div class="stat-icon">🏠</div>
            </div>
            <div class="stat-value">${this.stats.totalProperties} İlan</div>
            <div class="stat-subtitle">Satılık & Kiralık Aktif</div>
          </div>

          <div class="stat-card" style="--card-accent: var(--accent-gold);">
            <div class="stat-header">
              <span class="stat-title">Portföy Değeri</span>
              <div class="stat-icon">💰</div>
            </div>
            <div class="stat-value">${this.formatPrice(this.stats.totalPortfolioValue)}</div>
            <div class="stat-subtitle">Toplam Gayrimenkul Hacmi</div>
          </div>

          <div class="stat-card" style="--card-accent: var(--accent-cyan);">
            <div class="stat-header">
              <span class="stat-title">Kayıtlı Müşteri</span>
              <div class="stat-icon">👥</div>
            </div>
            <div class="stat-value">${this.stats.totalCustomers} Müşteri</div>
            <div class="stat-subtitle">CRM Talep Havuzunda</div>
          </div>

          <div class="stat-card" style="--card-accent: var(--accent-rose);">
            <div class="stat-header">
              <span class="stat-title">Bugünkü Takipler</span>
              <div class="stat-icon">⏰</div>
            </div>
            <div class="stat-value">${this.stats.todayFollowUpsCount} Randevu</div>
            <div class="stat-subtitle">${this.stats.pendingFollowUpsCount} Bekleyen Görev</div>
          </div>
        `;
      }

      // Payidar Haftalık Performans Paneli (Cuma Toplantısı Göstergeleri)
      const payidarKpiContainer = document.getElementById('dashboard-payidar-kpis');
      if (payidarKpiContainer) {
        const newCusts = this.stats.newCustomersThisWeek || 0;
        const newProps = this.stats.newPropertiesThisWeek || 0;
        const showings = this.stats.weeklyShowings || 0;
        const offers = this.stats.customersInOfferStage || 0;
        const overdue = this.stats.overdueTasksCount || 0;
        const qAvg = this.stats.readinessAvg || '5.0';
        const classCounts = this.stats.customerClassCounts || { A: 0, B: 0, C: 0, D: 0 };

        payidarKpiContainer.innerHTML = `
          <div style="background:#FFFFFF; border:1px solid var(--border-color); border-radius:var(--radius-md); padding:20px; box-shadow:var(--shadow-sm);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:10px;">
              <div style="display:flex; align-items:center; gap:10px;">
                <span style="font-size:22px;">🏛️</span>
                <div>
                  <h4 style="font-size:15px; font-weight:700; color:var(--heading-color); margin:0;">
                    Payidar Emlak — Haftalık Departman & Performans Paneli
                  </h4>
                  <div style="font-size:12px; color:var(--text-secondary); margin-top:2px;">
                    Cuma Değerlendirme Toplantısı 5 Temel Hedef Göstergesi
                  </div>
                </div>
              </div>
              <div style="display:flex; gap:6px; flex-wrap:wrap;">
                <span class="badge" style="background:#FEF2F2; color:#DC2626; border:1px solid #FECACA;">🔥 A Sınıfı: ${classCounts.A || 0}</span>
                <span class="badge" style="background:#FFFBEB; color:#D97706; border:1px solid #FDE68A;">⚡ B Sınıfı: ${classCounts.B || 0}</span>
                <span class="badge" style="background:#F3F4F6; color:#4B5563; border:1px solid #E5E7EB;">🌱 C Sınıfı: ${classCounts.C || 0}</span>
                <span class="badge" style="background:#F8FAFC; color:#64748B; border:1px solid #E2E8F0;">⏳ D Sınıfı: ${classCounts.D || 0}</span>
              </div>
            </div>

            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(170px, 1fr)); gap:12px;">
              <div style="background:var(--bg-secondary); padding:14px; border-radius:var(--radius-sm); border:1px solid var(--border-color);">
                <div style="font-size:11px; color:var(--text-secondary); font-weight:600;">1. YENİ NİTELİKLİ ALICI</div>
                <div style="font-size:22px; font-weight:800; color:var(--heading-color); margin:4px 0;">${newCusts} <span style="font-size:12px; color:var(--text-secondary); font-weight:500;">/ 10 Hedef</span></div>
                <div style="height:3px; border-radius:2px; background:var(--border-color); overflow:hidden;">
                  <div style="height:100%; width:${Math.min(100, (newCusts / 10) * 100)}%; background:var(--btn-primary-bg);"></div>
                </div>
              </div>

              <div style="background:var(--bg-secondary); padding:14px; border-radius:var(--radius-sm); border:1px solid var(--border-color);">
                <div style="font-size:11px; color:var(--text-secondary); font-weight:600;">2. YENİ YETKİLİ PORTFÖY</div>
                <div style="font-size:22px; font-weight:800; color:var(--heading-color); margin:4px 0;">${newProps} <span style="font-size:12px; color:var(--text-secondary); font-weight:500;">/ 3 Hedef</span></div>
                <div style="height:3px; border-radius:2px; background:var(--border-color); overflow:hidden;">
                  <div style="height:100%; width:${Math.min(100, (newProps / 3) * 100)}%; background:var(--accent-emerald);"></div>
                </div>
              </div>

              <div style="background:var(--bg-secondary); padding:14px; border-radius:var(--radius-sm); border:1px solid var(--border-color);">
                <div style="font-size:11px; color:var(--text-secondary); font-weight:600;">3. YER GÖSTERİMİ</div>
                <div style="font-size:22px; font-weight:800; color:var(--heading-color); margin:4px 0;">${showings} <span style="font-size:12px; color:var(--text-secondary); font-weight:500;">/ 8 Hedef</span></div>
                <div style="height:3px; border-radius:2px; background:var(--border-color); overflow:hidden;">
                  <div style="height:100%; width:${Math.min(100, (showings / 8) * 100)}%; background:var(--btn-primary-bg);"></div>
                </div>
              </div>

              <div style="background:var(--bg-secondary); padding:14px; border-radius:var(--radius-sm); border:1px solid var(--border-color);">
                <div style="font-size:11px; color:var(--text-secondary); font-weight:600;">4. TEKLİF & PAZARLIK</div>
                <div style="font-size:22px; font-weight:800; color:var(--heading-color); margin:4px 0;">${offers} <span style="font-size:12px; color:var(--text-secondary); font-weight:500;">/ 2 Hedef</span></div>
                <div style="height:3px; border-radius:2px; background:var(--border-color); overflow:hidden;">
                  <div style="height:100%; width:${Math.min(100, (offers / 2) * 100)}%; background:var(--accent-gold);"></div>
                </div>
              </div>

              <div style="background:var(--bg-secondary); padding:14px; border-radius:var(--radius-sm); border:1px solid ${overdue > 0 ? '#FECACA' : 'var(--border-color)'};">
                <div style="font-size:11px; color:${overdue > 0 ? '#DC2626' : 'var(--text-secondary)'}; font-weight:600;">5. GECİKEN TAKİP</div>
                <div style="font-size:22px; font-weight:800; color:${overdue > 0 ? '#DC2626' : '#16A085'}; margin:4px 0;">
                  ${overdue > 0 ? `⚠️ ${overdue}` : '0 (Zamanında)'}
                </div>
                <div style="font-size:11px; color:var(--text-secondary);">
                  ${overdue > 0 ? 'Acil temas bekleniyor' : 'Tüm takipler güncel ✓'}
                </div>
              </div>

              <div style="background:var(--bg-secondary); padding:14px; border-radius:var(--radius-sm); border:1px solid var(--border-color);">
                <div style="font-size:11px; color:var(--text-secondary); font-weight:600;">PORTFÖY KALİTE ORT.</div>
                <div style="font-size:22px; font-weight:800; color:var(--heading-color); margin:4px 0;">★ ${qAvg} <span style="font-size:12px; color:var(--text-secondary); font-weight:500;">/ 5.0</span></div>
                <div style="font-size:11px; color:var(--text-secondary);">Payidar 5 kriter ortalaması</div>
              </div>
            </div>
          </div>
        `;
      }
    }

    const todayContainer = document.getElementById('dashboard-today-followups');
    const todayList = this.followUps.filter(f => {
      const todayStr = new Date().toISOString().slice(0, 10);
      const isToday = !f.isCompleted && f.dueDate && f.dueDate.slice(0, 10) === todayStr;
      if (!isToday) return false;
      if (!this.isOwnerOrAdmin()) {
        return f.isAssignedToMe || f.assignedToUserId === this.currentUser?.id;
      }
      return true;
    });

    if (todayContainer) {
      if (todayList.length === 0) {
        todayContainer.innerHTML = `
          <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--radius-md); padding:18px; text-align:center; color:var(--text-muted); font-size:13px;">
            🎉 Bugün için bekleyen acil takip veya randevu bulunmuyor.
          </div>
        `;
      } else {
        todayContainer.innerHTML = todayList.map(item => this.renderFollowUpItem(item)).join('');
      }
    }

    const recentContainer = document.getElementById('dashboard-recent-properties');
    if (recentContainer) {
      const recentProps = this.properties.slice(0, 4);
      if (recentProps.length === 0) {
        recentContainer.innerHTML = `
          <div style="grid-column:1/-1; text-align:center; padding:40px; background:var(--bg-card); border-radius:var(--radius-lg); border:1px solid var(--border-color);">
            Henüz portföy ilanı eklenmedi.
          </div>
        `;
      } else {
        recentContainer.innerHTML = recentProps.map(p => this.renderPropertyCard(p)).join('');
      }
    }
  },

  // ─── Properties & Advanced Sahibinden Filtering ─────────────
  async renderProperties() {
    const container = document.getElementById('properties-grid');
    if (!container) return;

    container.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:30px; color:var(--text-muted);">İlanlar filtreleniyor...</div>';

    try {
      const props = await API.getProperties(this.filterState);
      this.properties = props;

      const countEl = document.getElementById('portal-results-counter');
      if (countEl) countEl.innerText = `${props.length} İlan`;

      const legacyCountEl = document.getElementById('filter-result-count');
      if (legacyCountEl) legacyCountEl.innerText = `${props.length} ilan bulundu`;

      this.updateActiveFilterTags();

      if (props.length === 0) {
        container.innerHTML = `
          <div style="grid-column:1/-1; text-align:center; padding:60px 20px; background:var(--bg-card); border-radius:var(--radius-xl); border:1px solid var(--border-color);">
            <div style="font-size:42px; margin-bottom:12px;">🏠</div>
            <h3 style="font-size:18px; font-weight:700; margin-bottom:6px;">Aradığınız kriterde ilan bulunamadı</h3>
            <p style="color:var(--text-muted); font-size:13px; margin-bottom:20px;">Filtreleri sıfırlayabilir veya kriterlerinizi genişletebilirsiniz.</p>
            <div style="display:flex; justify-content:center; gap:10px;">
              <button class="btn btn-secondary" onclick="App.resetAdvancedFilters()">Filtreleri Sıfırla</button>
              <button class="btn btn-primary" onclick="App.openCreatePropertyModal()">+ Yeni İlan Ekle</button>
            </div>
          </div>
        `;
        return;
      }

      container.innerHTML = props.map(p => this.renderPropertyCard(p)).join('');
    } catch (err) {
      container.innerHTML = `<div style="grid-column:1/-1; color:var(--accent-rose); padding:20px;">Hata: ${err.message}</div>`;
    }
  },

  renderPropertyCard(prop) {
    const defaultImg = 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80';
    const imgUrl = (prop.images && prop.images.length > 0) ? prop.images[0] : defaultImg;
    const isRent = prop.status === 'kiralik';
    const isSold = prop.status === 'satildi' || prop.status === 'kiralandi';

    // Durum Etiketi Haritası
    const statusMap = {
      'hazirlaniyor': '<span class="badge" style="background:#8b5cf622; color:#8b5cf6; border:1px solid #8b5cf644;">📝 HAZIRLIK</span>',
      'satilik': '<span class="badge badge-sale">SATILIK</span>',
      'kiralik': '<span class="badge badge-rent">KİRALIK</span>',
      'gorusmede': '<span class="badge" style="background:#f59e0b22; color:#f59e0b; border:1px solid #f59e0b44; font-weight:700;">🤝 GÖRÜŞMEDE</span>',
      'kapora': '<span class="badge" style="background:#06b6d422; color:#06b6d4; border:1px solid #06b6d444; font-weight:700;">📑 KAPORA</span>',
      'satildi': '<span class="badge badge-sold">SATILDI</span>',
      'kiralandi': '<span class="badge badge-sold">KİRALANDI</span>',
      'pasif': '<span class="badge" style="background:#64748b22; color:#64748b;">PASİF</span>'
    };
    const statusBadge = statusMap[prop.status] || `<span class="badge badge-sale">${(prop.status || 'SATILIK').toUpperCase()}</span>`;

    // Payidar Kalite Skoru (5 Kriter)
    const qScore = prop.readinessScore != null ? prop.readinessScore : 5;
    const qBadge = qScore === 5 
      ? '<span class="badge" style="background:#E8F8F5; color:#16A085; border:1px solid #A3E4D7;">✓ 5/5 KALİTE</span>' 
      : (qScore >= 3 
        ? `<span class="badge" style="background:#FFFBEB; color:#D97706; border:1px solid #FDE68A;">⚠️ ${qScore}/5 KALİTE</span>` 
        : `<span class="badge" style="background:#FEF2F2; color:#DC2626; border:1px solid #FECACA;">❌ ${qScore}/5 EKSİK</span>`);

    // Oda sayısı (1+1, 2+1, 3+1 vs formatı)
    const roomText = prop.rooms ? String(prop.rooms) : '—';

    let roiHtml = '';
    if (!isRent && prop.estimatedRent && prop.price > 0) {
      const grossYield = ((prop.estimatedRent * 12 / prop.price) * 100).toFixed(1);
      const amort = Math.round(prop.price / (prop.estimatedRent * 12));
      roiHtml = `
        <div class="prop-roi-strip">
          <span>📈 Brüt Getiri: <strong>%${grossYield}</strong></span>
          <span>⏳ Amortisman: <strong>~${amort} Yıl</strong></span>
        </div>
      `;
    }

    const sqmPrice = prop.netArea > 0 ? Math.round(prop.price / prop.netArea) : 0;
    const isMine = Boolean(prop.isCreatedByMe);
    const canManage = prop.canEditOrDelete !== false;

    return `
      <div class="prop-card" data-id="${prop.id}">
        <div class="prop-image-wrap">
          <img src="${imgUrl}" alt="${prop.title}" class="prop-image" loading="lazy" onerror="this.src='${defaultImg}'" />
          <div class="prop-badges">
            ${statusBadge}
            <span class="badge badge-rooms">
              ${roomText}
            </span>
            ${qBadge}
            ${prop.priceClass === 'A' ? '<span class="badge badge-class-a">A SINIFI</span>' : ''}
            ${prop.isSite ? '<span class="badge badge-rooms">SİTE İÇİ</span>' : ''}
            ${prop.shareStatus === 'shared_pool' ? '<span class="badge badge-shared-pool">🌐 HAVUZDA</span>' : '<span class="badge badge-private">🔒 ÖZEL</span>'}
          </div>
          <button class="prop-fav-btn ${prop.isFavorite ? 'active' : ''}" onclick="event.stopPropagation(); App.toggleFavorite('${prop.id}')" title="Favorilere Ekle">
            ${prop.isFavorite ? '❤️' : '🤍'}
          </button>
        </div>

        <div class="prop-body">
          <!-- Danışman & Mülkiyet Rozeti -->
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; font-size:11px; padding:4px 8px; border-radius:6px; background:var(--bg-tertiary); border:1px solid var(--border-color);">
            <div style="display:flex; align-items:center; gap:5px; color:var(--text-secondary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
              <span>${isMine ? '🟢' : '👤'}</span>
              <span>Danışman: <strong style="color:var(--text-primary);">${isMine ? 'Siz' : (prop.createdByName || 'Ofis Danışmanı')}</strong></span>
              ${prop.departmentName ? `
                <span class="badge" style="background:${prop.departmentColor || '#10b981'}22; color:${prop.departmentColor || '#10b981'}; border:1px solid ${prop.departmentColor || '#10b981'}55; font-size:10px; padding:1px 5px; margin-left:4px;">
                  ${prop.departmentIcon || '🏛️'} ${prop.departmentName}
                </span>
              ` : ''}
            </div>
            ${canManage ? '<span title="Düzenleme ve Silme Yetkiniz Var" style="color:var(--accent-emerald); font-weight:700; flex-shrink:0;">✓ Yetkili</span>' : '<span title="Bu ilan başka bir danışmana aittir" style="color:var(--text-muted); flex-shrink:0;">🔒 Salt Okunur</span>'}
          </div>

          <div class="prop-price-row">
            <div class="prop-price">${this.formatPrice(prop.price, prop.currency)}</div>
            ${sqmPrice > 0 ? `<div class="prop-sqm-price">${this.formatPrice(sqmPrice)}/m²</div>` : ''}
          </div>

          <h4 class="prop-title" title="${prop.title}">${prop.title}</h4>

          <div class="prop-location">
            <span>📍</span>
            <span>${[prop.neighborhood, prop.district, prop.city].filter(Boolean).join(', ')}</span>
          </div>

          <div class="prop-specs">
            <div class="prop-spec-item">
              <span class="prop-spec-label">ODA SAYISI</span>
              <span class="prop-spec-val" style="color:#38bdf8; font-weight:700;">${roomText}</span>
            </div>
            <div class="prop-spec-item">
              <span class="prop-spec-label">NET ALAN</span>
              <span class="prop-spec-val">${prop.netArea} m²</span>
            </div>
            <div class="prop-spec-item">
              <span class="prop-spec-label">BİNA YAŞI</span>
              <span class="prop-spec-val">${prop.buildingAge != null ? (prop.buildingAge === 0 ? 'Sıfır' : prop.buildingAge + ' Yıl') : 'Sıfır'}</span>
            </div>
          </div>

          ${roiHtml}

          <!-- Gayrimenkul Özellikleri / Features Chips -->
          <div class="prop-feature-chips">
            ${(prop.features || []).slice(0, 3).map(f => `<span class="prop-feature-chip">✓ ${f}</span>`).join('')}
            ${prop.hasBalcony && (!prop.features || !prop.features.some(f => f.toLowerCase().includes('balkon'))) ? '<span class="prop-feature-chip">🌿 Balkon</span>' : ''}
            ${prop.hasParking && (!prop.features || !prop.features.some(f => f.toLowerCase().includes('otopark'))) ? '<span class="prop-feature-chip">🚗 Otopark</span>' : ''}
            ${prop.hasElevator && (!prop.features || !prop.features.some(f => f.toLowerCase().includes('asansör'))) ? '<span class="prop-feature-chip">🛗 Asansör</span>' : ''}
            ${prop.isSite ? '<span class="prop-feature-chip">🏰 Site İçi</span>' : ''}
            ${prop.creditEligible ? '<span class="prop-feature-chip">🏦 Krediye Uygun</span>' : ''}
            ${prop.furnishedStatus === 'esyali' ? '<span class="prop-feature-chip">🛋️ Eşyalı</span>' : ''}
            ${(prop.features && prop.features.length > 3) ? `<span class="prop-feature-chip more">+${prop.features.length - 3}</span>` : ''}
          </div>

          <div class="prop-actions" style="display:flex; gap:6px; flex-wrap:wrap;">
            <button class="btn btn-secondary btn-sm" onclick="App.openPropertyDetail('${prop.id}')" style="flex:1;">
              Detay
            </button>
            <button class="btn btn-primary btn-sm" onclick="App.matchForProperty('${prop.id}')" title="Bu ilana uyan müşterileri bul">
              ✨ Eşleştir
            </button>
            ${prop.isOwnListing !== false ? `
              ${canManage ? `
                <button class="btn btn-secondary btn-sm" onclick="App.openSharePropertyModal('${prop.id}')" title="Ortak Havuzda Paylaş veya İptal Et">
                  ${prop.shareStatus === 'shared_pool' ? '🌐 Düzenle' : '🌐 Paylaş'}
                </button>
              ` : ''}
            ` : `
              <div class="pool-partner-badge" style="width:100%; justify-content:center; margin-top:4px;">
                🏢 ${prop.ownerCompanyName || 'Ortak Portföy'} ${prop.ownerCompanyPhone ? `• <a href="https://wa.me/9${prop.ownerCompanyPhone.replace(/[^0-9]/g, '')}" target="_blank" style="color:inherit; text-decoration:underline;">WhatsApp</a>` : ''}
              </div>
            `}
          </div>
        </div>
      </div>
    `;
  },

  // ─── Sahibinden Tarzı Filtreleme Olayları & Kontrolleri ─────────
  isLiveFilterActive() {
    const el = document.getElementById('live-filter-toggle');
    return el ? el.checked : true;
  },

  onLiveToggleChange() {
    if (this.isLiveFilterActive()) {
      this.onFilterChange();
    }
  },

  onFilterChange() {
    this.syncFilterInputsToState();
    if (this.isLiveFilterActive()) {
      this.renderProperties();
    } else {
      this.updateActiveFilterTags();
    }
  },

  onFilterInput() {
    clearTimeout(this._filterInputTimer);
    this._filterInputTimer = setTimeout(() => {
      this.onFilterChange();
    }, 280);
  },

  syncFilterInputsToState() {
    const getVal = (id) => {
      const el = document.getElementById(id);
      return el ? el.value.trim() : '';
    };

    const getChecked = (id) => {
      const el = document.getElementById(id);
      return el ? el.checked : false;
    };

    this.filterState.city = getVal('adv-filter-city');
    this.filterState.district = getVal('adv-filter-district');
    this.filterState.neighborhood = getVal('adv-filter-neighborhood');

    // Gayrimenkul Tipi: Manuel input görünürse onu al, yoksa select
    const customTypeEl = document.getElementById('adv-filter-custom-type');
    if (customTypeEl && customTypeEl.style.display !== 'none' && customTypeEl.value.trim()) {
      this.filterState.type = customTypeEl.value.trim();
    } else {
      this.filterState.type = getVal('adv-filter-type');
    }

    // Site / Proje Adı (Manuel Serbest)
    this.filterState.siteName = getVal('adv-filter-site-name');

    this.filterState.minPrice = getVal('adv-filter-min-price');
    this.filterState.maxPrice = getVal('adv-filter-max-price');
    this.filterState.minGrossArea = getVal('adv-filter-min-gross');
    this.filterState.maxGrossArea = getVal('adv-filter-max-gross');
    this.filterState.minArea = getVal('adv-filter-min-area');
    this.filterState.maxArea = getVal('adv-filter-max-area');
    this.filterState.buildingAge = getVal('adv-filter-building-age');
    this.filterState.minAge = getVal('adv-filter-min-age');
    this.filterState.maxAge = getVal('adv-filter-max-age');

    // Bulunduğu Kat: Manuel input görünürse onu al, yoksa select
    const customFloorEl = document.getElementById('adv-filter-custom-floor');
    if (customFloorEl && customFloorEl.style.display !== 'none' && customFloorEl.value.trim()) {
      this.filterState.floorType = customFloorEl.value.trim();
    } else {
      this.filterState.floorType = getVal('adv-filter-floor-type');
    }

    // Isıtma: Manuel input görünürse onu al, yoksa select
    const customHeatEl = document.getElementById('adv-filter-custom-heating');
    if (customHeatEl && customHeatEl.style.display !== 'none' && customHeatEl.value.trim()) {
      this.filterState.heating = customHeatEl.value.trim();
    } else {
      this.filterState.heating = getVal('adv-filter-heating');
    }

    this.filterState.bathrooms = getVal('adv-filter-bathrooms');
    this.filterState.hasBalcony = getChecked('adv-filter-balcony') ? 'true' : '';
    this.filterState.hasElevator = getChecked('adv-filter-elevator');
    this.filterState.hasParking = getChecked('adv-filter-parking');
    this.filterState.isSite = getChecked('adv-filter-site') ? 'true' : '';
    this.filterState.siteOnly = getChecked('adv-filter-site');
    this.filterState.furnishedStatus = getChecked('adv-filter-furnished') ? 'esyali' : '';
    this.filterState.creditEligible = getChecked('adv-filter-credit');
    this.filterState.isSwap = getChecked('adv-filter-swap');
    this.filterState.tenantStatus = getVal('adv-filter-tenant-status');
    this.filterState.deedStatus = getVal('adv-filter-deed-status');
    this.filterState.search = getVal('adv-filter-keyword');
    this.filterState.department = getVal('adv-filter-department');

    // Çoklu Oda Sayısı: Standart checkboxlar + Eklenen manuel oda tipleri
    const checkedRoomEls = document.querySelectorAll('input[name="filter_rooms"]:checked');
    const checkedRooms = Array.from(checkedRoomEls).map(el => el.value);
    const combinedRooms = [...new Set([...checkedRooms, ...(this.filterState.customRooms || [])])];
    this.filterState.rooms = combinedRooms.join(',');
  },

  syncStateToFilterInputs() {
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val || '';
    };

    const setChecked = (id, bool) => {
      const el = document.getElementById(id);
      if (el) el.checked = Boolean(bool);
    };

    setVal('adv-filter-department', this.filterState.department || '');
    setVal('adv-filter-city', this.filterState.city);
    const filterDistEl = document.getElementById('adv-filter-district');
    if (filterDistEl && typeof Locations !== 'undefined') {
      Locations.populateDistrictSelect(filterDistEl, this.filterState.city || '', this.filterState.district || '', true, 'İlçe (Tümü)');
    }
    setVal('adv-filter-district', this.filterState.district);
    setVal('adv-filter-neighborhood', this.filterState.neighborhood);
    this.updateFilterNeighborhoodSuggestions();

    // Gayrimenkul Tipi
    const customTypeEl = document.getElementById('adv-filter-custom-type');
    const typeSelectEl = document.getElementById('adv-filter-type');
    const typeToggleBtn = document.getElementById('adv-filter-type-toggle-btn');
    if (this.filterState.type) {
      const hasType = Array.from(typeSelectEl ? typeSelectEl.options : []).some(o => o.value.toLowerCase() === this.filterState.type.toLowerCase());
      if (hasType) {
        setVal('adv-filter-type', this.filterState.type);
        if (customTypeEl) customTypeEl.style.display = 'none';
        if (typeSelectEl) typeSelectEl.style.display = 'block';
        if (typeToggleBtn) typeToggleBtn.innerText = '✏️ Manuel Yaz';
      } else {
        if (customTypeEl) {
          customTypeEl.style.display = 'block';
          customTypeEl.value = this.filterState.type;
        }
        if (typeSelectEl) typeSelectEl.style.display = 'none';
        if (typeToggleBtn) typeToggleBtn.innerText = '📋 Listeden Seç';
      }
    } else {
      setVal('adv-filter-type', '');
      if (customTypeEl) { customTypeEl.style.display = 'none'; customTypeEl.value = ''; }
      if (typeSelectEl) typeSelectEl.style.display = 'block';
      if (typeToggleBtn) typeToggleBtn.innerText = '✏️ Manuel Yaz';
    }

    setVal('adv-filter-site-name', this.filterState.siteName || '');
    setVal('adv-filter-min-price', this.filterState.minPrice);
    setVal('adv-filter-max-price', this.filterState.maxPrice);
    setVal('adv-filter-min-gross', this.filterState.minGrossArea);
    setVal('adv-filter-max-gross', this.filterState.maxGrossArea);
    setVal('adv-filter-min-area', this.filterState.minArea);
    setVal('adv-filter-max-area', this.filterState.maxArea);
    setVal('adv-filter-building-age', this.filterState.buildingAge);
    setVal('adv-filter-min-age', this.filterState.minAge || '');
    setVal('adv-filter-max-age', this.filterState.maxAge || '');

    // Kat
    const customFloorEl = document.getElementById('adv-filter-custom-floor');
    const floorSelectEl = document.getElementById('adv-filter-floor-type');
    const floorToggleBtn = document.getElementById('adv-filter-floor-toggle-btn');
    if (this.filterState.floorType) {
      const hasFloor = Array.from(floorSelectEl ? floorSelectEl.options : []).some(o => o.value.toLowerCase() === this.filterState.floorType.toLowerCase());
      if (hasFloor) {
        setVal('adv-filter-floor-type', this.filterState.floorType);
        if (customFloorEl) customFloorEl.style.display = 'none';
        if (floorSelectEl) floorSelectEl.style.display = 'block';
        if (floorToggleBtn) floorToggleBtn.innerText = '✏️ Manuel Yaz';
      } else {
        if (customFloorEl) { customFloorEl.style.display = 'block'; customFloorEl.value = this.filterState.floorType; }
        if (floorSelectEl) floorSelectEl.style.display = 'none';
        if (floorToggleBtn) floorToggleBtn.innerText = '📋 Listeden Seç';
      }
    } else {
      setVal('adv-filter-floor-type', '');
      if (customFloorEl) { customFloorEl.style.display = 'none'; customFloorEl.value = ''; }
      if (floorSelectEl) floorSelectEl.style.display = 'block';
      if (floorToggleBtn) floorToggleBtn.innerText = '✏️ Manuel Yaz';
    }

    // Isıtma
    const customHeatEl = document.getElementById('adv-filter-custom-heating');
    const heatSelectEl = document.getElementById('adv-filter-heating');
    const heatToggleBtn = document.getElementById('adv-filter-heating-toggle-btn');
    if (this.filterState.heating) {
      const hasHeat = Array.from(heatSelectEl ? heatSelectEl.options : []).some(o => o.value.toLowerCase() === this.filterState.heating.toLowerCase());
      if (hasHeat) {
        setVal('adv-filter-heating', this.filterState.heating);
        if (customHeatEl) customHeatEl.style.display = 'none';
        if (heatSelectEl) heatSelectEl.style.display = 'block';
        if (heatToggleBtn) heatToggleBtn.innerText = '✏️ Manuel Yaz';
      } else {
        if (customHeatEl) { customHeatEl.style.display = 'block'; customHeatEl.value = this.filterState.heating; }
        if (heatSelectEl) heatSelectEl.style.display = 'none';
        if (heatToggleBtn) heatToggleBtn.innerText = '📋 Listeden Seç';
      }
    } else {
      setVal('adv-filter-heating', '');
      if (customHeatEl) { customHeatEl.style.display = 'none'; customHeatEl.value = ''; }
      if (heatSelectEl) heatSelectEl.style.display = 'block';
      if (heatToggleBtn) heatToggleBtn.innerText = '✏️ Manuel Yaz';
    }

    setVal('adv-filter-bathrooms', this.filterState.bathrooms);
    setChecked('adv-filter-balcony', this.filterState.hasBalcony === 'true');
    setChecked('adv-filter-elevator', this.filterState.hasElevator);
    setChecked('adv-filter-parking', this.filterState.hasParking);
    setChecked('adv-filter-site', this.filterState.isSite === 'true' || this.filterState.siteOnly);
    setChecked('adv-filter-furnished', this.filterState.furnishedStatus === 'esyali');
    setChecked('adv-filter-credit', this.filterState.creditEligible);
    setChecked('adv-filter-swap', this.filterState.isSwap);
    setVal('adv-filter-tenant-status', this.filterState.tenantStatus);
    setVal('adv-filter-deed-status', this.filterState.deedStatus);
    setVal('adv-filter-keyword', this.filterState.search);

    // Standart Checkboxlar
    const activeRooms = (this.filterState.rooms || '').split(',').map(r => r.trim()).filter(Boolean);
    document.querySelectorAll('input[name="filter_rooms"]').forEach(el => {
      el.checked = activeRooms.includes(el.value);
    });

    this.renderCustomRoomsChips();
    this.renderCustomFeaturesChips();

    // Durum Butonları (Tümü / Satılık / Kiralık)
    document.querySelectorAll('.btn-status-pill').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.status === (this.filterState.status || ''));
    });

    // Para Birimi Butonları
    document.querySelectorAll('.currency-btn[data-curr]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.curr === (this.filterState.currency || 'TRY'));
    });
  },

  setFilterStatus(status, btn) {
    document.querySelectorAll('.btn-status-pill').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    this.filterState.status = status;
    this.onFilterChange();
  },

  setFilterCurrency(currency, btn) {
    document.querySelectorAll('.currency-btn[data-curr]').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    this.filterState.currency = currency;
    this.onFilterChange();
  },

  clearFilterRooms() {
    document.querySelectorAll('input[name="filter_rooms"]').forEach(el => el.checked = false);
    this.onFilterChange();
  },

  // ─── Manuel Özel Filtre Yönetim Metotları ──────────────────
  addCustomRoomFilter(val) {
    const input = document.getElementById('adv-filter-custom-room-input');
    const room = (val || (input ? input.value : '')).trim();
    if (!room) return;
    if (!this.filterState.customRooms) this.filterState.customRooms = [];
    if (!this.filterState.customRooms.includes(room)) {
      this.filterState.customRooms.push(room);
    }
    if (input) input.value = '';
    this.renderCustomRoomsChips();
    this.onFilterChange();
  },

  removeCustomRoomFilter(room) {
    if (!this.filterState.customRooms) return;
    this.filterState.customRooms = this.filterState.customRooms.filter(r => r !== room);
    this.renderCustomRoomsChips();
    this.onFilterChange();
  },

  renderCustomRoomsChips() {
    const container = document.getElementById('adv-filter-custom-rooms-container');
    if (!container) return;
    const rooms = this.filterState.customRooms || [];
    container.innerHTML = rooms.map(r => `
      <span class="filter-custom-chip">
        ${r}
        <span class="remove-btn" onclick="App.removeCustomRoomFilter('${r}')">&times;</span>
      </span>
    `).join('');
  },

  toggleCustomTypeFilter() {
    const customEl = document.getElementById('adv-filter-custom-type');
    const selectEl = document.getElementById('adv-filter-type');
    const toggleBtn = document.getElementById('adv-filter-type-toggle-btn');
    if (!customEl || !selectEl) return;

    if (customEl.style.display === 'none') {
      customEl.style.display = 'block';
      selectEl.style.display = 'none';
      customEl.focus();
      if (toggleBtn) toggleBtn.innerText = '📋 Listeden Seç';
    } else {
      customEl.style.display = 'none';
      selectEl.style.display = 'block';
      customEl.value = '';
      if (toggleBtn) toggleBtn.innerText = '✏️ Manuel Yaz';
      this.onFilterChange();
    }
  },

  setManualType(typeVal) {
    const customEl = document.getElementById('adv-filter-custom-type');
    const selectEl = document.getElementById('adv-filter-type');
    const toggleBtn = document.getElementById('adv-filter-type-toggle-btn');
    if (customEl && selectEl) {
      customEl.style.display = 'block';
      selectEl.style.display = 'none';
      customEl.value = typeVal;
      if (toggleBtn) toggleBtn.innerText = '📋 Listeden Seç';
      this.onFilterChange();
    }
  },

  toggleCustomFloorFilter() {
    const customEl = document.getElementById('adv-filter-custom-floor');
    const selectEl = document.getElementById('adv-filter-floor-type');
    const toggleBtn = document.getElementById('adv-filter-floor-toggle-btn');
    if (!customEl || !selectEl) return;

    if (customEl.style.display === 'none') {
      customEl.style.display = 'block';
      selectEl.style.display = 'none';
      customEl.focus();
      if (toggleBtn) toggleBtn.innerText = '📋 Listeden Seç';
    } else {
      customEl.style.display = 'none';
      selectEl.style.display = 'block';
      customEl.value = '';
      if (toggleBtn) toggleBtn.innerText = '✏️ Manuel Yaz';
      this.onFilterChange();
    }
  },

  toggleCustomHeatingFilter() {
    const customEl = document.getElementById('adv-filter-custom-heating');
    const selectEl = document.getElementById('adv-filter-heating');
    const toggleBtn = document.getElementById('adv-filter-heating-toggle-btn');
    if (!customEl || !selectEl) return;

    if (customEl.style.display === 'none') {
      customEl.style.display = 'block';
      selectEl.style.display = 'none';
      customEl.focus();
      if (toggleBtn) toggleBtn.innerText = '📋 Listeden Seç';
    } else {
      customEl.style.display = 'none';
      selectEl.style.display = 'block';
      customEl.value = '';
      if (toggleBtn) toggleBtn.innerText = '✏️ Manuel Yaz';
      this.onFilterChange();
    }
  },

  setManualHeating(heatingVal) {
    const customEl = document.getElementById('adv-filter-custom-heating');
    const selectEl = document.getElementById('adv-filter-heating');
    const toggleBtn = document.getElementById('adv-filter-heating-toggle-btn');
    if (customEl && selectEl) {
      customEl.style.display = 'block';
      selectEl.style.display = 'none';
      customEl.value = heatingVal;
      if (toggleBtn) toggleBtn.innerText = '📋 Listeden Seç';
      this.onFilterChange();
    }
  },

  addCustomFeatureFilter(val) {
    const input = document.getElementById('adv-filter-custom-feature-input');
    const feat = (val || (input ? input.value : '')).trim();
    if (!feat) return;
    if (!this.filterState.customFeatures) this.filterState.customFeatures = [];
    if (!this.filterState.customFeatures.includes(feat)) {
      this.filterState.customFeatures.push(feat);
    }
    if (input) input.value = '';
    this.renderCustomFeaturesChips();
    this.onFilterChange();
  },

  quickAddCustomFeature(val) {
    this.addCustomFeatureFilter(val);
  },

  removeCustomFeatureFilter(feat) {
    if (!this.filterState.customFeatures) return;
    this.filterState.customFeatures = this.filterState.customFeatures.filter(f => f !== feat);
    this.renderCustomFeaturesChips();
    this.onFilterChange();
  },

  renderCustomFeaturesChips() {
    const container = document.getElementById('adv-filter-custom-features-chips');
    if (!container) return;
    const feats = this.filterState.customFeatures || [];
    container.innerHTML = feats.map(f => `
      <span class="filter-custom-chip">
        ✨ ${f}
        <span class="remove-btn" onclick="App.removeCustomFeatureFilter('${f}')">&times;</span>
      </span>
    `).join('');
  },

  toggleMobileSidebar() {
    this.toggleFilterSidebar();
  },

  applyAdvancedFilters() {
    this.syncFilterInputsToState();
    this.renderProperties();
    this.closeFilterSidebar();
    this.showToast('Filtreler uygulandı');
  },

  resetAdvancedFilters() {
    this.filterState = {
      ...this.filterState,
      type: '',
      status: '',
      city: '',
      district: '',
      neighborhood: '',
      siteName: '',
      currency: 'TRY',
      rooms: '',
      customRooms: [],
      customFeatures: [],
      minPrice: '',
      maxPrice: '',
      minGrossArea: '',
      maxGrossArea: '',
      minArea: '',
      maxArea: '',
      buildingAge: '',
      minAge: '',
      maxAge: '',
      floorType: '',
      floor: '',
      heating: '',
      bathrooms: '',
      hasBalcony: '',
      hasElevator: false,
      hasParking: false,
      siteOnly: false,
      isSite: '',
      furnishedStatus: '',
      tenantStatus: '',
      creditEligible: false,
      deedStatus: '',
      isSwap: false,
      priceClass: '',
      favoritesOnly: false,
      search: '',
      department: ''
    };

    this.syncStateToFilterInputs();

    // Üstteki Hızlı Filtre Haplarını 'Tümü' yap
    document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
    const allPill = document.querySelector('.filter-pill[data-pill-type="all"]');
    if (allPill) allPill.classList.add('active');

    this.renderProperties();
    this.showToast('Tüm filtreler temizlendi');
  },

  updateActiveFilterTags() {
    const container = document.getElementById('active-filter-tags-container');
    if (!container) return;

    const tags = [];

    if (this.filterState.city) tags.push({ key: 'city', label: `İl: ${this.filterState.city}` });
    if (this.filterState.district) tags.push({ key: 'district', label: `İlçe: ${this.filterState.district}` });
    if (this.filterState.neighborhood) tags.push({ key: 'neighborhood', label: `Semt: ${this.filterState.neighborhood}` });
    if (this.filterState.siteName) tags.push({ key: 'siteName', label: `Site: ${this.filterState.siteName}` });
    if (this.filterState.status) tags.push({ key: 'status', label: `Durum: ${this.filterState.status.toUpperCase()}` });
    if (this.filterState.type) tags.push({ key: 'type', label: `Tip: ${this.filterState.type}` });

    // Standart Oda
    const stdRooms = (this.filterState.rooms || '').split(',').map(r => r.trim()).filter(r => r && !(this.filterState.customRooms || []).includes(r));
    if (stdRooms.length > 0) tags.push({ key: 'rooms', label: `Oda: ${stdRooms.join(', ')}` });

    // Manuel Eklenen Odalar
    (this.filterState.customRooms || []).forEach(r => {
      tags.push({ key: 'customRoom_' + r, label: `+ Özel Oda: ${r}` });
    });

    // Manuel Eklenen Nitelikler
    (this.filterState.customFeatures || []).forEach(f => {
      tags.push({ key: 'customFeature_' + f, label: `✨ ${f}` });
    });

    if (this.filterState.minAge || this.filterState.maxAge) {
      tags.push({ key: 'ageRange', label: `Yaş: ${this.filterState.minAge || '0'} - ${this.filterState.maxAge || '∞'}` });
    }

    if (this.filterState.minPrice || this.filterState.maxPrice) {
      const minP = this.filterState.minPrice ? this.formatPrice(this.filterState.minPrice, this.filterState.currency) : '0';
      const maxP = this.filterState.maxPrice ? this.formatPrice(this.filterState.maxPrice, this.filterState.currency) : '∞';
      tags.push({ key: 'price', label: `Fiyat: ${minP} - ${maxP}` });
    }

    if (this.filterState.minArea || this.filterState.maxArea) {
      const minA = this.filterState.minArea || '0';
      const maxA = this.filterState.maxArea || '∞';
      tags.push({ key: 'netArea', label: `Net: ${minA} - ${maxA} m²` });
    }

    if (this.filterState.buildingAge) {
      tags.push({ key: 'buildingAge', label: `Yaş: ${this.filterState.buildingAge === '0' ? 'Sıfır' : this.filterState.buildingAge + ' Yıl'}` });
    }

    if (this.filterState.floorType) tags.push({ key: 'floorType', label: `Kat: ${this.filterState.floorType}` });
    if (this.filterState.heating) tags.push({ key: 'heating', label: `Isıtma: ${this.filterState.heating}` });
    if (this.filterState.bathrooms) tags.push({ key: 'bathrooms', label: `Banyo: ${this.filterState.bathrooms}+` });
    if (this.filterState.hasBalcony === 'true') tags.push({ key: 'hasBalcony', label: 'Balkonlu' });
    if (this.filterState.hasElevator) tags.push({ key: 'hasElevator', label: 'Asansörlü' });
    if (this.filterState.hasParking) tags.push({ key: 'hasParking', label: 'Otoparklı' });
    if (this.filterState.isSite === 'true' || this.filterState.siteOnly) tags.push({ key: 'isSite', label: 'Site İçi' });
    if (this.filterState.furnishedStatus === 'esyali') tags.push({ key: 'furnishedStatus', label: 'Eşyalı' });
    if (this.filterState.creditEligible) tags.push({ key: 'creditEligible', label: 'Krediye Uygun' });
    if (this.filterState.isSwap) tags.push({ key: 'isSwap', label: 'Takaslı' });
    if (this.filterState.tenantStatus) tags.push({ key: 'tenantStatus', label: `Kullanım: ${this.filterState.tenantStatus}` });
    if (this.filterState.search) tags.push({ key: 'search', label: `Kelime: "${this.filterState.search}"` });
    if (this.filterState.priceClass) tags.push({ key: 'priceClass', label: `${this.filterState.priceClass} Sınıfı` });
    if (this.filterState.favoritesOnly) tags.push({ key: 'favoritesOnly', label: 'Favoriler' });

    // Mobil rozet sayısı
    const mobileBadge = document.getElementById('mobile-filter-badge');
    if (mobileBadge) {
      if (tags.length > 0) {
        mobileBadge.innerText = tags.length;
        mobileBadge.style.display = 'inline-block';
      } else {
        mobileBadge.style.display = 'none';
      }
    }

    if (tags.length === 0) {
      container.style.display = 'none';
      container.innerHTML = '';
      return;
    }

    container.style.display = 'flex';
    container.innerHTML = `
      <span style="font-size:11px; color:var(--text-muted); font-weight:600;">Aktif Filtreler:</span>
      ${tags.map(t => `
        <div class="filter-tag-chip">
          <span>${t.label}</span>
          <span class="remove" onclick="App.removeFilter('${t.key}')" title="Bu filtreyi kaldır">&times;</span>
        </div>
      `).join('')}
      <button type="button" class="filter-clear-link" style="font-size:11px; margin-left:6px;" onclick="App.resetAdvancedFilters()">Tümünü Temizle</button>
    `;
  },

  removeFilter(key) {
    if (key === 'city') {
      this.filterState.city = '';
      this.filterState.district = '';
      this.onCityFilterChange();
      return;
    } else if (key === 'district') {
      this.filterState.district = '';
      this.onDistrictFilterChange();
      return;
    } else if (key === 'neighborhood') {
      this.filterState.neighborhood = '';
      const nhEl = document.getElementById('adv-filter-neighborhood');
      if (nhEl) nhEl.value = '';
      this.onFilterChange();
      return;
    } else if (key === 'siteName') {
      this.filterState.siteName = '';
      const snEl = document.getElementById('adv-filter-site-name');
      if (snEl) snEl.value = '';
      this.onFilterChange();
      return;
    } else if (key.startsWith('customRoom_')) {
      const room = key.replace('customRoom_', '');
      this.removeCustomRoomFilter(room);
      return;
    } else if (key.startsWith('customFeature_')) {
      const feat = key.replace('customFeature_', '');
      this.removeCustomFeatureFilter(feat);
      return;
    } else if (key === 'ageRange') {
      this.filterState.minAge = '';
      this.filterState.maxAge = '';
      const minA = document.getElementById('adv-filter-min-age');
      const maxA = document.getElementById('adv-filter-max-age');
      if (minA) minA.value = '';
      if (maxA) maxA.value = '';
      this.onFilterChange();
      return;
    } else if (key === 'status') this.filterState.status = '';
    else if (key === 'type') {
      this.filterState.type = '';
      const ctEl = document.getElementById('adv-filter-custom-type');
      if (ctEl) ctEl.value = '';
      const stEl = document.getElementById('adv-filter-type');
      if (stEl) stEl.value = '';
    } else if (key === 'rooms') {
      this.filterState.rooms = '';
      document.querySelectorAll('input[name="filter_rooms"]').forEach(el => el.checked = false);
    } else if (key === 'price') { this.filterState.minPrice = ''; this.filterState.maxPrice = ''; }
    else if (key === 'netArea') { this.filterState.minArea = ''; this.filterState.maxArea = ''; }
    else if (key === 'buildingAge') this.filterState.buildingAge = '';
    else if (key === 'floorType') {
      this.filterState.floorType = '';
      const cfEl = document.getElementById('adv-filter-custom-floor');
      if (cfEl) cfEl.value = '';
      const sfEl = document.getElementById('adv-filter-floor-type');
      if (sfEl) sfEl.value = '';
    } else if (key === 'heating') {
      this.filterState.heating = '';
      const chEl = document.getElementById('adv-filter-custom-heating');
      if (chEl) chEl.value = '';
      const shEl = document.getElementById('adv-filter-heating');
      if (shEl) shEl.value = '';
    }
    else if (key === 'bathrooms') this.filterState.bathrooms = '';
    else if (key === 'hasBalcony') this.filterState.hasBalcony = '';
    else if (key === 'hasElevator') this.filterState.hasElevator = false;
    else if (key === 'hasParking') this.filterState.hasParking = false;
    else if (key === 'isSite') { this.filterState.isSite = ''; this.filterState.siteOnly = false; }
    else if (key === 'furnishedStatus') this.filterState.furnishedStatus = '';
    else if (key === 'creditEligible') this.filterState.creditEligible = false;
    else if (key === 'isSwap') this.filterState.isSwap = false;
    else if (key === 'tenantStatus') this.filterState.tenantStatus = '';
    else if (key === 'search') this.filterState.search = '';
    else if (key === 'priceClass') this.filterState.priceClass = '';
    else if (key === 'favoritesOnly') this.filterState.favoritesOnly = false;

    this.syncStateToFilterInputs();
    this.renderProperties();
  },

  applyQuickFilter(type, el, val = '') {
    if (type === 'onlyMine') {
      const wasActive = this.filterState.onlyMine;
      document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
      if (!wasActive) {
        this.filterState.onlyMine = true;
        el.classList.add('active');
        this.showToast('🎯 Yalnızca sizin portföyünüz listeleniyor');
      } else {
        this.filterState.onlyMine = false;
        const allPill = document.querySelector('.filter-pill[data-pill-type="all"]');
        if (allPill) allPill.classList.add('active');
        this.showToast('Tüm ofis portföyü listeleniyor');
      }
      this.renderProperties();
      return;
    }

    document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
    el.classList.add('active');
    this.filterState.onlyMine = false;

    if (type === 'all') {
      this.resetAdvancedFilters();
      return;
    } else if (type === 'status') {
      this.filterState.status = val;
    } else if (type === 'rooms') {
      this.filterState.rooms = val;
    } else if (type === 'class') {
      this.filterState.priceClass = val;
    } else if (type === 'site') {
      this.filterState.siteOnly = true;
      this.filterState.isSite = 'true';
    } else if (type === 'fav') {
      this.filterState.favoritesOnly = true;
    }

    this.syncStateToFilterInputs();
    this.renderProperties();
  },

  applyCustomerClassFilter(cls, btn) {
    this.filterState.customerClass = cls;
    if (btn) {
      const container = btn.parentElement;
      if (container) {
        container.querySelectorAll('.filter-pill').forEach(p => {
          if (p.id !== 'btn-cust-only-mine') p.classList.remove('active');
        });
      }
      btn.classList.add('active');
    }
    this.renderCustomers();
  },

  toggleCustomerOnlyMine() {
    this.filterState.customerOnlyMine = !this.filterState.customerOnlyMine;
    const btn = document.getElementById('btn-cust-only-mine');
    if (btn) {
      if (this.filterState.customerOnlyMine) {
        btn.classList.add('active');
        btn.innerHTML = '🎯 Sadece Benim (Aktif)';
        this.showToast('🎯 Yalnızca sizin müşterileriniz listeleniyor');
      } else {
        btn.classList.remove('active');
        btn.innerHTML = '🎯 Sadece Benim';
        this.showToast('Tüm ofis müşterileri listeleniyor');
      }
    }
    this.renderCustomers();
  },

  // ─── Customers Render ───────────────────────────────────────
  async renderCustomers() {
    const container = document.getElementById('customers-grid');
    if (!container) return;

    container.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:30px; color:var(--text-muted);">Müşteriler listeleniyor...</div>';

    try {
      const customers = await API.getCustomers({
        onlyMine: this.filterState.customerOnlyMine,
        status: this.filterState.customerStatus,
        customerClass: this.filterState.customerClass,
        leadSource: this.filterState.customerLeadSource,
        purpose: this.filterState.customerPurpose,
        search: this.filterState.customerSearch,
        department: this.filterState.customerDepartment
      });
      this.customers = customers;

      if (customers.length === 0) {
        container.innerHTML = `
          <div style="grid-column:1/-1; text-align:center; padding:60px 20px; background:var(--bg-card); border-radius:var(--radius-xl); border:1px solid var(--border-color);">
            <div style="font-size:42px; margin-bottom:12px;">👥</div>
            <h3 style="font-size:18px; font-weight:700; margin-bottom:6px;">Kayıtlı müşteri bulunamadı</h3>
            <p style="color:var(--text-muted); font-size:13px; margin-bottom:20px;">Yeni alıcı veya yatırımcı ekleyerek portföyünüzle eşleştirin.</p>
            <button class="btn btn-primary" onclick="App.openCreateCustomerModal()">+ Yeni Müşteri Ekle</button>
          </div>
        `;
        return;
      }

      container.innerHTML = customers.map(c => this.renderCustomerCard(c)).join('');
    } catch (err) {
      container.innerHTML = `<div style="grid-column:1/-1; color:var(--accent-rose); padding:20px;">Hata: ${err.message}</div>`;
    }
  },

  renderCustomerCard(c) {
    const cleanPhone = c.phone ? c.phone.replace(/[^0-9]/g, '') : '';
    const waPhone = cleanPhone.startsWith('0') ? '9' + cleanPhone : cleanPhone;
    const waText = encodeURIComponent(`Merhaba ${c.name}, Payidar Emlak'tan arıyorum. Gayrimenkul talebiniz ile ilgili portföyümüzdeki en yeni seçenekleri paylaşmak isteriz.`);
    const isMine = Boolean(c.isCreatedByMe);
    const canManage = c.canEditOrDelete !== false;

    // Sınıf Rozeti & Renkleri (A / B / C / D)
    const cls = (c.customerClass || 'B').toUpperCase();
    const classBadgeMap = {
      'A': '<span class="badge" style="background:#FEF2F2; color:#DC2626; border:1px solid #FECACA; font-weight:700;">🔥 A – ÇOK SICAK (30 GÜN)</span>',
      'B': '<span class="badge" style="background:#FFFBEB; color:#D97706; border:1px solid #FDE68A; font-weight:700;">⚡ B – SICAK (1-3 AY)</span>',
      'C': '<span class="badge" style="background:#F3F4F6; color:#4B5563; border:1px solid #E5E7EB; font-weight:600;">🌱 C – POTANSİYEL (3-6 AY)</span>',
      'D': '<span class="badge" style="background:#F8FAFC; color:#64748B; border:1px solid #E2E8F0;">⏳ D – UZUN VADELİ</span>'
    };
    const classBadge = classBadgeMap[cls] || classBadgeMap['B'];

    // Süreç / Pipeline Rozeti
    const pStatus = c.pipelineStatus || c.status || 'aktif';
    const pipelineMap = {
      'yeni': '<span class="badge" style="background:#F3F4F6; color:#374151; border:1px solid var(--border-color);">🆕 Yeni Talep</span>',
      'aktif': '<span class="badge" style="background:#E8F8F5; color:#16A085; border:1px solid #A3E4D7;">🔄 İletişimde</span>',
      'gosterim': '<span class="badge" style="background:#F3F4F6; color:#374151; border:1px solid var(--border-color);">🏠 Yer Gösterimi</span>',
      'teklif': '<span class="badge" style="background:#FFFBEB; color:#D97706; border:1px solid #FDE68A; font-weight:700;">🤝 Teklif / Pazarlık</span>',
      'kapandi_basarili': '<span class="badge" style="background:#E8F8F5; color:#16A085; border:1px solid #A3E4D7; font-weight:700;">🎉 Satış Başarılı</span>',
      'kaybedildi': '<span class="badge" style="background:#FEF2F2; color:#DC2626; border:1px solid #FECACA;">❌ Kaybedildi</span>',
      'pasif': '<span class="badge" style="background:#F8FAFC; color:#64748B; border:1px solid var(--border-color);">⏸️ Pasif</span>'
    };
    const pipelineBadge = pipelineMap[pStatus] || `<span class="badge">${pStatus}</span>`;

    // Kaynak Rozeti
    const leadMap = {
      'telefon': '📞 Telefon',
      'ilan': '🌐 İlan Portalı',
      'whatsapp': '💬 WhatsApp',
      'ofis': '🏢 Ofis Ziyareti',
      'tavsiye': '👥 Referans',
      'sosyal_medya': '📱 Sosyal Medya',
      'diger': '📋 Diğer'
    };
    const sourceLabel = leadMap[c.leadSource] || '📞 Telefon';

    // Bütçe formatı (Min - Maks veya tek tutar)
    let budgetDisplay = this.formatPrice(c.totalBudget || c.maxBudget);
    if (c.minBudget && (c.maxBudget || c.totalBudget)) {
      budgetDisplay = `${this.formatPrice(c.minBudget)} – ${this.formatPrice(c.maxBudget || c.totalBudget)}`;
    }

    return `
      <div class="cust-card">
        <div class="cust-header">
          <div style="display:flex; align-items:center;">
            <div class="cust-avatar">${c.name.charAt(0)}</div>
            <div class="cust-title-wrap">
              <div class="cust-name">${c.name}</div>
              <div class="cust-timeline">⏱️ ${c.purchaseTimeline ? c.purchaseTimeline.toUpperCase() : 'Zaman belirtilmedi'} • <span style="color:var(--text-muted);">${sourceLabel}</span></div>
            </div>
          </div>
          <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap; justify-content:flex-end;">
            ${pipelineBadge}
            ${c.shareStatus === 'shared_pool' ? '<span class="badge badge-shared-pool">🌐 HAVUZDA</span>' : '<span class="badge badge-private">🔒 ÖZEL</span>'}
            ${classBadge}
          </div>
        </div>

        <!-- Danışman / Temsilci Rozeti -->
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; font-size:11px; padding:4px 8px; border-radius:6px; background:var(--bg-tertiary); border:1px solid var(--border-color);">
          <div style="display:flex; align-items:center; gap:5px; color:var(--text-secondary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
            <span>${isMine ? '🟢' : '👤'}</span>
            <span>Danışman: <strong style="color:var(--text-primary);">${isMine ? 'Siz' : (c.createdByName || 'Ofis Danışmanı')}</strong></span>
            ${c.departmentName ? `
              <span class="badge" style="background:${c.departmentColor || '#10b981'}22; color:${c.departmentColor || '#10b981'}; border:1px solid ${c.departmentColor || '#10b981'}55; font-size:10px; padding:1px 5px; margin-left:4px;">
                ${c.departmentIcon || '🏛️'} ${c.departmentName}
              </span>
            ` : ''}
          </div>
          ${canManage ? '<span title="Düzenleme Yetkiniz Var" style="color:var(--accent-emerald); font-weight:700; flex-shrink:0;">✓ Yetkili</span>' : '<span title="Başka danışmana ait müşteri kaydı" style="color:var(--text-muted); flex-shrink:0;">🔒 Salt Okunur</span>'}
        </div>

        <div class="cust-budget-box">
          <div class="cust-budget-row">
            <span class="cust-budget-label">Bütçe Aralığı</span>
            <span class="cust-budget-val">${budgetDisplay}</span>
          </div>
          ${c.downPayment ? `
            <div class="cust-budget-row" style="margin-top:4px;">
              <span class="cust-budget-label">Peşinat / Finansman</span>
              <span style="font-size:12px; color:var(--text-secondary);">${this.formatPrice(c.downPayment)} (${c.usesCredit ? 'Kredili' : 'Nakit'})</span>
            </div>
          ` : ''}
        </div>

        <div class="cust-tags">
          <span class="cust-tag">🎯 ${c.purpose === 'yatirim' ? 'Yatırım' : 'Oturum'}</span>
          ${c.preferredRooms && c.preferredRooms.length > 0 ? `
            <span class="cust-tag room-tag">🏠 ${c.preferredRooms.join(', ')}</span>
          ` : ''}
          ${c.minNetArea ? `<span class="cust-tag">📐 Min ${c.minNetArea} m²</span>` : ''}
          ${c.maxBuildingAge ? `<span class="cust-tag">🏢 Maks ${c.maxBuildingAge} Yıl</span>` : ''}
          ${c.preferredDistricts && c.preferredDistricts.length > 0 ? `
            <span class="cust-tag">📍 ${c.preferredDistricts.slice(0, 2).join(', ')}${c.preferredDistricts.length > 2 ? ' +' + (c.preferredDistricts.length - 2) : ''}</span>
          ` : ''}
        </div>

        ${c.notes ? `<p style="font-size:12px; color:var(--text-muted); margin-bottom:14px; line-height:1.4;">${c.notes}</p>` : ''}

        <div class="cust-actions">
          ${c.phone ? `
            <a href="https://wa.me/${waPhone}?text=${waText}" target="_blank" class="btn btn-secondary btn-sm" style="color:#25D366;" title="WhatsApp">
              💬 WhatsApp
            </a>
            <a href="tel:${cleanPhone}" class="btn btn-secondary btn-sm" title="Telefonla Ara">
              📞 Ara
            </a>
          ` : ''}
          <button class="btn btn-primary btn-sm" onclick="App.matchForCustomer('${c.id}')" title="Bu müşteriye uyan ilanları bul">
            ✨ İlan Eşleştir
          </button>
          <button class="btn btn-secondary btn-sm" onclick="App.openCreateFollowUpModal(null, '${c.id}')" title="Bu müşteriye randevu/görev planla">
            📅 Takip Ekle
          </button>
          ${canManage ? `
            <button class="btn btn-secondary btn-sm" onclick="App.openShareCustomerModal('${c.id}')" title="Ortak Havuzda Paylaş">
              ${c.shareStatus === 'shared_pool' ? '🌐 Düzenle' : '🌐 Paylaş'}
            </button>
            <button class="btn btn-icon btn-sm" onclick="App.openEditCustomerModal('${c.id}')" title="Düzenle">
              ✏️
            </button>
          ` : `
            <span title="Başka danışmana ait müşteri (Salt Okunur)" style="font-size:12px; color:var(--text-muted); padding:4px 8px;">🔒 Korumalı</span>
          `}
        </div>
      </div>
    `;
  },

  // ─── Follow-ups Render ──────────────────────────────────────
  async renderFollowUps() {
    const container = document.getElementById('followups-list-container');
    if (!container) return;

    container.innerHTML = '<div style="text-align:center; padding:30px; color:var(--text-muted);">Görevler yükleniyor...</div>';

    try {
      let list = await API.getFollowUps();
      this.followUps = list;

      if (this.filterState.followupFilter === 'pending') {
        list = list.filter(f => !f.isCompleted);
      } else if (this.filterState.followupFilter === 'completed') {
        list = list.filter(f => f.isCompleted);
      } else if (this.filterState.followupFilter === 'today') {
        const todayStr = new Date().toISOString().slice(0, 10);
        list = list.filter(f => f.dueDate && f.dueDate.slice(0, 10) === todayStr);
      }

      if (list.length === 0) {
        container.innerHTML = `
          <div style="text-align:center; padding:50px 20px; background:var(--bg-card); border-radius:var(--radius-lg); border:1px solid var(--border-color);">
            <div style="font-size:36px; margin-bottom:10px;">📋</div>
            <h4 style="font-size:16px; margin-bottom:6px;">Kayıtlı görev bulunamadı</h4>
            <p style="color:var(--text-muted); font-size:13px; margin-bottom:16px;">Müşteri takibi, geri arama veya yer gösterme randevusu oluşturun.</p>
            <button class="btn btn-primary btn-sm" onclick="App.openCreateFollowUpModal()">+ Yeni Takip Planla</button>
          </div>
        `;
        return;
      }

      container.innerHTML = list.map(item => this.renderFollowUpItem(item)).join('');
    } catch (err) {
      container.innerHTML = `<div style="color:var(--accent-rose); padding:20px;">Hata: ${err.message}</div>`;
    }
  },

  renderFollowUpItem(item) {
    const now = new Date();
    const due = new Date(item.dueDate);
    const isOverdue = !item.isCompleted && due < now;
    const isToday = !item.isCompleted && due.toISOString().slice(0, 10) === now.toISOString().slice(0, 10);

    const typeIcons = {
      'geri-arama': '📞',
      'gorusme': '🤝',
      'ziyaret': '🏠',
      'yapilacak': '✅',
      'diger': '📋'
    };

    const typeLabels = {
      'geri-arama': 'Geri Arama',
      'gorusme': 'Görüşme',
      'ziyaret': 'Yer Gösterme / Ziyaret',
      'yapilacak': 'Yapılacak İş',
      'diger': 'Diğer'
    };

    let statusClass = '';
    if (item.isCompleted) statusClass = 'completed';
    else if (isOverdue) statusClass = 'overdue';
    else if (isToday) statusClass = 'today';

    return `
      <div class="followup-card ${statusClass}" data-id="${item.id}">
        <button class="followup-check-btn" onclick="App.toggleCompleteFollowUp('${item.id}')" title="${item.isCompleted ? 'Geri Al' : 'Tamamlandı Olarak İşaretle'}">
          ✓
        </button>

        <div class="followup-icon">${typeIcons[item.type] || '📋'}</div>

        <div class="followup-info">
          <div class="followup-title" style="${item.isCompleted ? 'text-decoration: line-through; opacity: 0.7;' : ''}">${item.title}</div>
          <div class="followup-meta">
            <span>📅 ${this.formatDate(item.dueDate)}</span>
            <span>• ${typeLabels[item.type] || item.type}</span>
            ${isOverdue ? '<span style="color:var(--accent-rose); font-weight:700;">Gecikmiş</span>' : ''}
            ${isToday ? '<span style="color:var(--accent-gold); font-weight:700;">Bugün</span>' : ''}
          </div>
          ${item.notes ? `<div style="font-size:12px; color:var(--text-muted); margin-top:4px;">${item.notes}</div>` : ''}
        </div>

        <div style="display:flex; gap:6px;">
          <button class="btn btn-icon btn-sm" onclick="App.deleteFollowUp('${item.id}')" title="Sil">
            🗑️
          </button>
        </div>
      </div>
    `;
  },

  async toggleCompleteFollowUp(id) {
    try {
      await API.completeFollowUp(id);
      this.showToast('Takip durumu güncellendi');
      await this.refreshAllData();
      if (this.activeTab === 'dashboard') this.renderDashboard();
      if (this.activeTab === 'followups') this.renderFollowUps();
    } catch (err) {
      this.showToast('Hata: ' + err.message, 'error');
    }
  },

  async deleteFollowUp(id) {
    if (!confirm('Bu takip görevini silmek istediğinize emin misiniz?')) return;
    try {
      await API.deleteFollowUp(id);
      this.showToast('Görev silindi');
      await this.refreshAllData();
      this.renderFollowUps();
    } catch (err) {
      this.showToast('Hata: ' + err.message, 'error');
    }
  },

  // ─── Akıllı Eşleştirme Kısayolları ──────────────────────────
  matchForCustomer(customerId) {
    this.showTab('matching');
    MatchingEngine.currentMode = 'customer';
    document.querySelectorAll('.match-mode-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.mode === 'customer');
    });
    MatchingEngine.loadSelectorList(customerId);
  },

  matchForProperty(propertyId) {
    this.showTab('matching');
    MatchingEngine.currentMode = 'property';
    document.querySelectorAll('.match-mode-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.mode === 'property');
    });
    MatchingEngine.loadSelectorList(propertyId);
  },

  async toggleFavorite(propertyId) {
    try {
      const res = await API.toggleFavorite(propertyId);
      this.showToast(res.isFavorite ? 'İlan favorilere eklendi ❤️' : 'Favorilerden çıkarıldı');
      await this.refreshAllData();
      if (this.activeTab === 'properties') this.renderProperties();
      if (this.activeTab === 'dashboard') this.renderDashboard();
    } catch (err) {
      this.showToast('Hata: ' + err.message, 'error');
    }
  },

  // ─── Arama Bağlantıları ────────────────────────────────────
  bindSearch() {
    const globalSearch = document.getElementById('global-search-input');
    if (globalSearch) {
      globalSearch.addEventListener('input', (e) => {
        const val = e.target.value.trim();
        if (this.activeTab === 'properties') {
          this.filterState.search = val;
          this.renderProperties();
        } else if (this.activeTab === 'customers') {
          this.filterState.customerSearch = val;
          this.renderCustomers();
        }
      });
    }
  },

  // ─── Detay ve Form Modalları ────────────────────────────────
  bindModals() {
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          backdrop.classList.remove('open');
        }
      });
    });

    document.querySelectorAll('.modal-close-btn, .modal-cancel-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const backdrop = e.target.closest('.modal-backdrop');
        if (backdrop) backdrop.classList.remove('open');
      });
    });
  },

  openQuickAddModal() {
    const modal = document.getElementById('quick-add-modal');
    if (modal) modal.classList.add('open');
  },

  openCreatePropertyModal() {
    document.querySelectorAll('.modal-backdrop').forEach(b => b.classList.remove('open'));
    const modal = document.getElementById('property-form-modal');
    const form = document.getElementById('property-form');
    if (form) form.reset();
    document.getElementById('property-form-id').value = '';
    document.getElementById('property-modal-title').innerText = 'Yeni Gayrimenkul İlanı Ekle';

    // Van varsayılan olarak başlat ve 13 ilçesini yükle
    if (typeof Locations !== 'undefined') {
      const cityEl = document.getElementById('prop-city');
      if (cityEl) Locations.populateCitySelect(cityEl, 'Van', false);
      this.populatePropDistricts('Van', 'İpekyolu');
    }

    const customDistEl = document.getElementById('prop-district-custom');
    if (customDistEl) {
      customDistEl.style.display = 'none';
      customDistEl.value = '';
    }
    const distEl = document.getElementById('prop-district');
    if (distEl) distEl.style.display = 'block';

    const toggleBtn = document.getElementById('prop-district-toggle-btn');
    if (toggleBtn) toggleBtn.innerText = '✏️ Manuel Yaz';

    // Manuel Tip Sıfırlama
    const customType = document.getElementById('prop-type-custom');
    const selectType = document.getElementById('prop-type');
    const toggleTypeBtn = document.getElementById('prop-type-toggle-btn');
    if (customType) { customType.style.display = 'none'; customType.value = ''; }
    if (selectType) selectType.style.display = 'block';
    if (toggleTypeBtn) toggleTypeBtn.innerText = '✏️ Manuel Yaz';

    // Manuel Oda Sıfırlama
    const customRooms = document.getElementById('prop-rooms-custom');
    const selectRooms = document.getElementById('prop-rooms');
    const toggleRoomsBtn = document.getElementById('prop-rooms-toggle-btn');
    if (customRooms) { customRooms.style.display = 'none'; customRooms.value = ''; }
    if (selectRooms) selectRooms.style.display = 'block';
    if (toggleRoomsBtn) toggleRoomsBtn.innerText = '✏️ Manuel Yaz';

    // Manuel Isıtma Sıfırlama
    const customHeat = document.getElementById('prop-heating-custom');
    const selectHeat = document.getElementById('prop-heating');
    const toggleHeatBtn = document.getElementById('prop-heating-toggle-btn');
    if (customHeat) { customHeat.style.display = 'none'; customHeat.value = ''; }
    if (selectHeat) selectHeat.style.display = 'block';
    if (toggleHeatBtn) toggleHeatBtn.innerText = '✏️ Manuel Yaz';

    // Kat ve Donanım Çipleri Sıfırlama
    const customFloor = document.getElementById('prop-floor-custom');
    const numFloor = document.getElementById('prop-floor');
    const toggleFloorBtn = document.getElementById('prop-floor-toggle-btn');
    if (customFloor) { customFloor.style.display = 'none'; customFloor.value = ''; }
    if (numFloor) numFloor.style.display = 'block';
    if (toggleFloorBtn) toggleFloorBtn.innerText = '✏️ Özel Kat Yaz';

    // Payidar Kalite Kontrolü & Takyidat Başlangıç Değerleri
    if (document.getElementById('prop-chk-owner')) document.getElementById('prop-chk-owner').checked = true;
    if (document.getElementById('prop-chk-pricing')) document.getElementById('prop-chk-pricing').checked = true;
    if (document.getElementById('prop-chk-deed')) document.getElementById('prop-chk-deed').checked = true;
    if (document.getElementById('prop-chk-media')) document.getElementById('prop-chk-media').checked = false;
    if (document.getElementById('prop-chk-advisor')) document.getElementById('prop-chk-advisor').checked = true;
    if (document.getElementById('prop-legal-encumbrance')) document.getElementById('prop-legal-encumbrance').value = 'Temiz Tapu (Şerh/İpotek Yok)';
    const priceChangeWrap = document.getElementById('prop-price-change-wrap');
    if (priceChangeWrap) priceChangeWrap.style.display = 'none';

    this.currentPropFeatures = ['Geniş Balkon / Teras', 'Kapalı Otopark', 'Asansör', 'Krediye Uygun'];
    this.renderPropFeaturesChips();

    const parkingEl = document.getElementById('prop-parking'); if (parkingEl) parkingEl.checked = true;
    const elevatorEl = document.getElementById('prop-elevator'); if (elevatorEl) elevatorEl.checked = true;
    const balconyEl = document.getElementById('prop-balcony'); if (balconyEl) balconyEl.checked = true;
    const creditEl = document.getElementById('prop-credit'); if (creditEl) creditEl.checked = true;
    const swapEl = document.getElementById('prop-swap'); if (swapEl) swapEl.checked = false;
    const furnEl = document.getElementById('prop-furnished'); if (furnEl) furnEl.checked = false;

    if (modal) modal.classList.add('open');
  },

  async openPropertyDetail(id) {
    try {
      const prop = await API.getProperty(id);
      const modal = document.getElementById('property-detail-modal');
      const body = document.getElementById('property-detail-body');

      const isRent = prop.status === 'kiralik';
      const defaultImg = 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1000&q=80';
      const img = (prop.images && prop.images[0]) || defaultImg;
      const roomText = prop.rooms ? String(prop.rooms) : '—';

      let roiSection = '';
      if (!isRent && prop.estimatedRent && prop.price > 0) {
        const annualRent = prop.estimatedRent * 12;
        const grossYield = ((annualRent / prop.price) * 100).toFixed(2);
        const amort = (prop.price / annualRent).toFixed(1);
        const annualExpenses = ((prop.monthlyDues || 0) + (prop.monthlyExpenses || 0)) * 12;
        const netYield = (((annualRent - annualExpenses) / prop.price) * 100).toFixed(2);

        roiSection = `
          <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--radius-lg); padding:18px; margin:20px 0;">
            <h4 style="font-size:15px; font-weight:700; color:var(--accent-emerald); margin-bottom:12px; display:flex; align-items:center; gap:8px;">
              📊 Yatırım & Getiri Analizi
            </h4>
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:12px;">
              <div>
                <div style="font-size:11px; color:var(--text-muted);">TAHMİNİ AYLIK KİRA</div>
                <div style="font-size:16px; font-weight:800; color:var(--text-primary);">${this.formatPrice(prop.estimatedRent)}</div>
              </div>
              <div>
                <div style="font-size:11px; color:var(--text-muted);">BRÜT KİRA GETİRİSİ</div>
                <div style="font-size:16px; font-weight:800; color:var(--accent-emerald);">%${grossYield}</div>
              </div>
              <div>
                <div style="font-size:11px; color:var(--text-muted);">NET GETİRİ (AİDAT DÜŞÜLMÜŞ)</div>
                <div style="font-size:16px; font-weight:800; color:var(--accent-cyan);">%${netYield}</div>
              </div>
              <div>
                <div style="font-size:11px; color:var(--text-muted);">AMORTİSMAN SÜRESİ</div>
                <div style="font-size:16px; font-weight:800; color:var(--accent-gold);">${amort} Yıl</div>
              </div>
            </div>
          </div>
        `;
      }

      body.innerHTML = `
        <div style="position:relative; height:240px; border-radius:var(--radius-lg); overflow:hidden; margin-bottom:20px;">
          <img src="${img}" style="width:100%; height:100%; object-fit:cover;" onerror="this.src='${defaultImg}'" />
          <div style="position:absolute; bottom:16px; left:16px; display:flex; gap:8px; flex-wrap:wrap;">
            <span class="badge ${isRent ? 'badge-rent' : 'badge-sale'}">${prop.status.toUpperCase()}</span>
            <span class="badge badge-rooms">${roomText}</span>
            ${prop.priceClass === 'A' ? '<span class="badge badge-class-a">A SINIFI PORTFÖY</span>' : ''}
            ${prop.portfolioCode ? `<span class="badge" style="background:var(--btn-primary-bg); color:white;">KOD: ${prop.portfolioCode}</span>` : ''}
          </div>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
          <div>
            <h3 style="font-size:22px; font-weight:800; margin-bottom:4px; color:var(--heading-color);">${prop.title}</h3>
            <div style="font-size:13px; color:var(--text-secondary);">📍 ${[prop.neighborhood, prop.district, prop.city, prop.siteName].filter(Boolean).join(', ')}</div>
          </div>
          <div style="font-size:24px; font-weight:800; color:var(--heading-color);">${this.formatPrice(prop.price, prop.currency)}</div>
        </div>

        ${roiSection}

        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:12px; margin-bottom:20px; background:var(--bg-secondary); padding:16px; border-radius:var(--radius-sm); border:1px solid var(--border-color);">
          <div><span style="font-size:11px; color:var(--text-secondary);">ODA & BANYO</span><br><strong style="color:var(--heading-color); font-size:14px;">${roomText} (${prop.bathrooms || 1} Banyo)</strong></div>
          <div><span style="font-size:11px; color:var(--text-secondary);">NET / BRÜT ALAN</span><br><strong style="color:var(--heading-color);">${prop.netArea} m² / ${prop.grossArea || '—'} m²</strong></div>
          <div><span style="font-size:11px; color:var(--text-secondary);">KAT / TOPLAM</span><br><strong style="color:var(--heading-color);">${prop.floor != null ? prop.floor + '. Kat (Top. ' + (prop.totalFloors || '—') + ')' : '—'}</strong></div>
          <div><span style="font-size:11px; color:var(--text-secondary);">ISITMA</span><br><strong style="color:var(--heading-color);">${prop.heating || 'Belirtilmedi'}</strong></div>
          <div><span style="font-size:11px; color:var(--text-secondary);">OTOPARK / ASANSÖR</span><br><strong style="color:var(--heading-color);">${prop.hasParking ? '✓ Otopark' : '✕ Yok'} • ${prop.hasElevator ? '✓ Asansör' : '✕ Yok'}</strong></div>
          <div><span style="font-size:11px; color:var(--text-secondary);">TAPU & DURUM</span><br><strong style="color:var(--heading-color);">${prop.deedStatus || '—'} (${prop.tenantStatus || 'Boş'})</strong></div>
        </div>

        <!-- Detaylı Özellikler & Donanım -->
        <div style="margin-bottom:20px;">
          <h4 style="font-size:14px; font-weight:700; color:var(--heading-color); margin-bottom:10px; display:flex; align-items:center; gap:6px;">
            <span>✨</span> <span>Gayrimenkul Özellikleri & Donanım</span>
          </h4>
          <div style="display:flex; flex-wrap:wrap; gap:8px;">
            ${(prop.features || []).map(f => `<span class="detail-feature-pill">✓ ${f}</span>`).join('')}
            ${prop.hasBalcony ? '<span class="detail-feature-pill">🌿 Geniş Balkon</span>' : ''}
            ${prop.hasElevator ? '<span class="detail-feature-pill">🛗 Asansör</span>' : ''}
            ${prop.hasParking ? '<span class="detail-feature-pill">🚗 Otopark</span>' : ''}
            ${prop.isSite ? '<span class="detail-feature-pill">🏰 Site İçerisinde</span>' : ''}
            ${prop.creditEligible ? '<span class="detail-feature-pill">🏦 Krediye Uygun</span>' : ''}
            ${prop.isSwap ? '<span class="detail-feature-pill">🔄 Takasa Açık</span>' : ''}
            ${prop.furnishedStatus === 'esyali' ? '<span class="detail-feature-pill">🛋️ Eşyalı</span>' : ''}
            ${prop.tenantStatus === 'bos' ? '<span class="detail-feature-pill">🔑 Boş / Hemen Taşınmaya Hazır</span>' : (prop.tenantStatus === 'kiracili' ? '<span class="detail-feature-pill">💼 Kiracılı</span>' : '')}
            ${prop.deedStatus ? `<span class="detail-feature-pill">📜 ${prop.deedStatus === 'kat-mulkiyeti' ? 'Kat Mülkiyetli' : (prop.deedStatus === 'kat-irtifaki' ? 'Kat İrtifaklı' : prop.deedStatus)}</span>` : ''}
          </div>
        </div>

        <!-- 📋 Payidar Kalite Kontrolü & Hazırlık İlerlemesi -->
        <div style="background:#FFFFFF; border:1px solid var(--border-color); border-radius:var(--radius-md); padding:16px; margin:16px 0; box-shadow:var(--shadow-sm);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:8px;">
            <h4 style="font-size:14px; font-weight:700; color:var(--heading-color); display:flex; align-items:center; gap:6px; margin:0;">
              📋 Payidar Portföy Kalite Kontrolü
            </h4>
            <span class="badge" style="background:${(prop.readinessScore || 5) === 5 ? '#E8F8F5' : '#FFFBEB'}; color:${(prop.readinessScore || 5) === 5 ? '#16A085' : '#D97706'}; border:1px solid ${(prop.readinessScore || 5) === 5 ? '#A3E4D7' : '#FDE68A'}; font-weight:700;">
              ${prop.readinessScore != null ? prop.readinessScore : 5}/5 Kriter (%${prop.readinessPercentage != null ? prop.readinessPercentage : 100} Hazır)
            </span>
          </div>
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:6px; font-size:12px;">
            <div>${prop.readinessChecklist?.ownerAuthorized !== false ? '✅' : '❌'} Mülk Sahibi & Yetki Belgesi</div>
            <div>${prop.readinessChecklist?.pricingTermsAgreed !== false ? '✅' : '❌'} Fiyat & Pazarlık Şartları</div>
            <div>${prop.readinessChecklist?.deedVerified !== false ? '✅' : '❌'} Tapu & Takyidat Bilgisi</div>
            <div>${prop.readinessChecklist?.mediaPrepared ? '✅' : '❌'} Fotoğraflar & İlan Metni</div>
            <div>${prop.readinessChecklist?.advisorTaskSet !== false ? '✅' : '❌'} Sorumlu Danışman & Sonraki Görev</div>
          </div>
          <div style="margin-top:10px; font-size:12px; color:var(--text-secondary); padding-top:8px; border-top:1px dashed var(--border-color);">
            🏛️ <strong>Tapu Takyidat Durumu:</strong> <span style="color:var(--text-primary); font-weight:600;">${prop.legalEncumbrance || 'Temiz Tapu (Şerh/İpotek Yok)'}</span>
          </div>
        </div>

        <!-- 📉 Fiyat Değişim Geçmişi -->
        ${Array.isArray(prop.priceHistory) && prop.priceHistory.length > 0 ? `
          <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--radius-lg); padding:16px; margin:16px 0;">
            <h4 style="font-size:14px; font-weight:700; color:var(--text-primary); margin-bottom:10px;">
              📉 Tarihli Fiyat Değişim Geçmişi (${prop.priceHistory.length} Kayıt)
            </h4>
            <div style="display:flex; flex-direction:column; gap:8px;">
              ${prop.priceHistory.map(h => `
                <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-tertiary); padding:8px 12px; border-radius:var(--radius-sm); font-size:12px;">
                  <div>
                    <strong style="color:var(--accent-emerald); font-size:13px;">${this.formatPrice(h.price, h.currency)}</strong>
                    <span style="color:var(--text-muted); margin-left:8px;">${h.note || 'Fiyat güncellemesi'}</span>
                  </div>
                  <div style="color:var(--text-muted); font-size:11px;">${new Date(h.date).toLocaleDateString('tr-TR')}</div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        ${prop.description ? `
          <div style="margin-bottom:20px;">
            <h4 style="font-size:14px; font-weight:700; margin-bottom:6px;">Açıklama</h4>
            <p style="font-size:13px; color:var(--text-secondary); line-height:1.6;">${prop.description}</p>
          </div>
        ` : ''}

        ${prop.contactName ? `
          <div style="background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:var(--radius-sm); padding:14px; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div style="font-size:11px; color:var(--text-secondary); font-weight:700;">PORTFÖY YETKİLİSİ & SATICI</div>
              <div style="font-weight:700; font-size:14px;">${prop.contactName} (${prop.contactPhone || 'Tel yok'})</div>
            </div>
            ${prop.contactPhone ? `
              <a href="tel:${prop.contactPhone}" class="btn btn-primary btn-sm">📞 Satıcıyı Ara</a>
            ` : ''}
          </div>
        ` : ''}

        <!-- Danışman & Mülkiyet Bilgisi -->
        <div style="display:flex; align-items:center; justify-content:space-between; padding:12px 16px; background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:var(--radius-sm); margin-top:16px;">
          <div style="display:flex; align-items:center; gap:10px;">
            <span style="font-size:20px;">${prop.isCreatedByMe ? '🟢' : '👤'}</span>
            <div>
              <div style="font-size:11px; color:var(--text-secondary); font-weight:700;">PORTFÖY DANIŞMANI</div>
              <div style="font-size:13px; font-weight:800; color:var(--heading-color);">${prop.isCreatedByMe ? 'Siz (' + (this.currentUser?.fullName || 'Ben') + ')' : (prop.createdByName || 'Ofis Danışmanı')}</div>
            </div>
          </div>
          ${prop.canEditOrDelete !== false ? '<span class="badge badge-sale" style="font-size:11px; padding:4px 10px;">✓ Düzenleme & Silme Yetkiniz Var</span>' : '<span class="badge badge-sold" style="font-size:11px; padding:4px 10px;">🔒 Salt Okunur (Başka Danışmana Ait)</span>'}
        </div>

        <!-- Detay Modal Alt Butonları -->
        <div style="display:flex; gap:10px; margin-top:20px; padding-top:16px; border-top:1px solid var(--border-color); flex-wrap:wrap; align-items:center;">
          ${prop.canEditOrDelete !== false ? `
            <button class="btn btn-secondary" onclick="App.openEditPropertyModal('${prop.id}')">✏️ İlanı Düzenle</button>
          ` : `
            <button class="btn btn-secondary" disabled title="Bu ilan başka bir danışmana aittir, yalnızca şirket sahibi veya ekleyen danışman düzenleyebilir" style="opacity:0.6; cursor:not-allowed;">🔒 Düzenleme Kilitli</button>
          `}
          <button class="btn btn-primary" onclick="App.matchForProperty('${prop.id}')">✨ Uyan Müşterileri Eşleştir</button>
          ${prop.canEditOrDelete !== false ? `
            <button class="btn btn-danger" style="margin-left:auto;" onclick="App.deleteProperty('${prop.id}')">🗑️ İlanı Sil</button>
          ` : ''}
        </div>
      `;

      modal.classList.add('open');
    } catch (err) {
      this.showToast('Hata: ' + err.message, 'error');
    }
  },

  async openEditPropertyModal(id) {
    document.querySelectorAll('.modal-backdrop').forEach(b => b.classList.remove('open'));
    try {
      const p = await API.getProperty(id);
      if (p.canEditOrDelete === false) {
        this.showToast('Bu ilan başka bir danışmana aittir. Yalnızca ilanı ekleyen danışman veya şirket sahibi düzenleyebilir.', 'error');
        return;
      }
      const modal = document.getElementById('property-form-modal');
      const form = document.getElementById('property-form');
      if (form) form.reset();

      document.getElementById('property-form-id').value = p.id;
      document.getElementById('property-modal-title').innerText = 'İlanı Düzenle';

      document.getElementById('prop-title').value = p.title || '';
      
      // Gayrimenkul Türü (Manuel desteği)
      const propType = p.type || 'daire';
      const typeSelect = document.getElementById('prop-type');
      const customType = document.getElementById('prop-type-custom');
      const toggleTypeBtn = document.getElementById('prop-type-toggle-btn');
      const hasTypeOption = Array.from(typeSelect ? typeSelect.options : []).some(o => o.value.toLowerCase() === propType.toLowerCase());
      if (hasTypeOption) {
        if (typeSelect) { typeSelect.value = propType; typeSelect.style.display = 'block'; }
        if (customType) { customType.style.display = 'none'; customType.value = ''; }
        if (toggleTypeBtn) toggleTypeBtn.innerText = '✏️ Manuel Yaz';
      } else {
        if (customType) { customType.style.display = 'block'; customType.value = propType; }
        if (typeSelect) typeSelect.style.display = 'none';
        if (toggleTypeBtn) toggleTypeBtn.innerText = '📋 Listeden Seç';
      }

      document.getElementById('prop-status').value = p.status || 'satilik';
      document.getElementById('prop-price').value = p.price || '';
      document.getElementById('prop-currency').value = p.currency || 'TRY';

      // Oda Sayısı (Manuel desteği)
      const propRooms = p.rooms || '2+1';
      const roomsSelect = document.getElementById('prop-rooms');
      const customRooms = document.getElementById('prop-rooms-custom');
      const toggleRoomsBtn = document.getElementById('prop-rooms-toggle-btn');
      const hasRoomsOption = Array.from(roomsSelect ? roomsSelect.options : []).some(o => o.value.toLowerCase() === propRooms.toLowerCase());
      if (hasRoomsOption) {
        if (roomsSelect) { roomsSelect.value = propRooms; roomsSelect.style.display = 'block'; }
        if (customRooms) { customRooms.style.display = 'none'; customRooms.value = ''; }
        if (toggleRoomsBtn) toggleRoomsBtn.innerText = '✏️ Manuel Yaz';
      } else {
        if (customRooms) { customRooms.style.display = 'block'; customRooms.value = propRooms; }
        if (roomsSelect) roomsSelect.style.display = 'none';
        if (toggleRoomsBtn) toggleRoomsBtn.innerText = '📋 Listeden Seç';
      }

      // Isıtma (Manuel desteği)
      const propHeat = p.heating || '';
      const heatSelect = document.getElementById('prop-heating');
      const customHeat = document.getElementById('prop-heating-custom');
      const toggleHeatBtn = document.getElementById('prop-heating-toggle-btn');
      const hasHeatOption = Array.from(heatSelect ? heatSelect.options : []).some(o => o.value.toLowerCase() === propHeat.toLowerCase());
      if (hasHeatOption && propHeat) {
        if (heatSelect) { heatSelect.value = propHeat; heatSelect.style.display = 'block'; }
        if (customHeat) { customHeat.style.display = 'none'; customHeat.value = ''; }
        if (toggleHeatBtn) toggleHeatBtn.innerText = '✏️ Manuel Yaz';
      } else if (propHeat) {
        if (customHeat) { customHeat.style.display = 'block'; customHeat.value = propHeat; }
        if (heatSelect) heatSelect.style.display = 'none';
        if (toggleHeatBtn) toggleHeatBtn.innerText = '📋 Listeden Seç';
      } else {
        if (heatSelect) { heatSelect.value = 'dogalgaz'; heatSelect.style.display = 'block'; }
        if (customHeat) { customHeat.style.display = 'none'; customHeat.value = ''; }
        if (toggleHeatBtn) toggleHeatBtn.innerText = '✏️ Manuel Yaz';
      }

      document.getElementById('prop-bathrooms').value = p.bathrooms || 1;
      document.getElementById('prop-net-area').value = p.netArea || '';
      document.getElementById('prop-gross-area').value = p.grossArea || '';

      // İl, İlçe ve Manuel Mahalle Yönetimi
      const city = p.city || 'Van';
      const cityEl = document.getElementById('prop-city');
      if (cityEl && typeof Locations !== 'undefined') {
        Locations.populateCitySelect(cityEl, city, false);
      }

      this.populatePropDistricts(city, p.district || '');

      // İlçe listede yoksa manuel giriş moduna al
      const distEl = document.getElementById('prop-district');
      const customDistEl = document.getElementById('prop-district-custom');
      const toggleBtn = document.getElementById('prop-district-toggle-btn');
      const hasOption = Array.from(distEl.options).some(o => o.value.toLowerCase() === (p.district || '').toLowerCase());

      if (!hasOption && p.district) {
        if (customDistEl) {
          customDistEl.style.display = 'block';
          customDistEl.value = p.district;
        }
        if (distEl) distEl.style.display = 'none';
        if (toggleBtn) toggleBtn.innerText = '📋 Listeden Seç';
      } else {
        if (customDistEl) customDistEl.style.display = 'none';
        if (distEl) distEl.style.display = 'block';
        if (toggleBtn) toggleBtn.innerText = '✏️ Manuel Yaz';
      }

      // Mahalle (Manuel giriş serbest)
      document.getElementById('prop-neighborhood').value = p.neighborhood || '';
      this.updatePropNeighborhoodSuggestions(city, p.district || '');

      document.getElementById('prop-site').value = p.siteName || '';
      document.getElementById('prop-age').value = p.buildingAge != null ? p.buildingAge : '';
      document.getElementById('prop-floor').value = p.floor != null ? p.floor : '';
      document.getElementById('prop-price-class').value = p.priceClass || 'B';
      document.getElementById('prop-rent').value = p.estimatedRent || '';
      document.getElementById('prop-dues').value = p.monthlyDues || '';
      document.getElementById('prop-contact-name').value = p.contactName || '';
      document.getElementById('prop-contact-phone').value = p.contactPhone || '';
      document.getElementById('prop-image-url').value = (p.images && p.images[0]) || '';
      document.getElementById('prop-parking').checked = Boolean(p.hasParking);
      document.getElementById('prop-elevator').checked = Boolean(p.hasElevator);
      document.getElementById('prop-desc').value = p.description || '';

      // Kat Seçimi (Manuel / Sayısal)
      const customFloor = document.getElementById('prop-floor-custom');
      const numFloor = document.getElementById('prop-floor');
      const toggleFloorBtn = document.getElementById('prop-floor-toggle-btn');
      if (p.floorType && isNaN(Number(p.floorType)) && p.floorType !== 'ara_kat') {
        if (customFloor) { customFloor.style.display = 'block'; customFloor.value = p.floorType; }
        if (numFloor) numFloor.style.display = 'none';
        if (toggleFloorBtn) toggleFloorBtn.innerText = '🔢 Kat Numarası';
      } else {
        if (numFloor) { numFloor.style.display = 'block'; numFloor.value = p.floor != null ? p.floor : ''; }
        if (customFloor) { customFloor.style.display = 'none'; customFloor.value = ''; }
        if (toggleFloorBtn) toggleFloorBtn.innerText = '✏️ Özel Kat Yaz';
      }

      // Donanım & Nitelikler
      this.currentPropFeatures = Array.isArray(p.features) ? [...p.features] : [];
      this.renderPropFeaturesChips();

      // Ek Alanlar
      const tenantEl = document.getElementById('prop-tenant-status'); if (tenantEl) tenantEl.value = p.tenantStatus || 'bos';
      const deedEl = document.getElementById('prop-deed-status'); if (deedEl) deedEl.value = p.deedStatus || 'kat-mulkiyeti';
      const balconyEl = document.getElementById('prop-balcony'); if (balconyEl) balconyEl.checked = p.hasBalcony !== false;
      const creditEl = document.getElementById('prop-credit'); if (creditEl) creditEl.checked = p.creditEligible !== false;
      const swapEl = document.getElementById('prop-swap'); if (swapEl) swapEl.checked = Boolean(p.isSwap);
      const furnEl = document.getElementById('prop-furnished'); if (furnEl) furnEl.checked = p.furnishedStatus === 'esyali';

      // Payidar Kalite Kontrolü & Takyidat Doldurma
      const checklist = p.readinessChecklist || {};
      if (document.getElementById('prop-chk-owner')) document.getElementById('prop-chk-owner').checked = checklist.ownerAuthorized !== undefined ? checklist.ownerAuthorized : true;
      if (document.getElementById('prop-chk-pricing')) document.getElementById('prop-chk-pricing').checked = checklist.pricingTermsAgreed !== undefined ? checklist.pricingTermsAgreed : true;
      if (document.getElementById('prop-chk-deed')) document.getElementById('prop-chk-deed').checked = checklist.deedVerified !== undefined ? checklist.deedVerified : true;
      if (document.getElementById('prop-chk-media')) document.getElementById('prop-chk-media').checked = checklist.mediaPrepared !== undefined ? checklist.mediaPrepared : Boolean(p.images && p.images.length > 0);
      if (document.getElementById('prop-chk-advisor')) document.getElementById('prop-chk-advisor').checked = checklist.advisorTaskSet !== undefined ? checklist.advisorTaskSet : true;
      if (document.getElementById('prop-legal-encumbrance')) document.getElementById('prop-legal-encumbrance').value = p.legalEncumbrance || 'Temiz Tapu (Şerh/İpotek Yok)';
      const priceChangeWrap = document.getElementById('prop-price-change-wrap');
      if (priceChangeWrap) {
        priceChangeWrap.style.display = 'block';
        const noteInput = document.getElementById('prop-price-change-note');
        if (noteInput) noteInput.value = '';
      }

      if (modal) modal.classList.add('open');
    } catch (err) {
      this.showToast('İlan bilgisi alınamadı: ' + err.message, 'error');
    }
  },

  async deleteProperty(id) {
    const p = this.properties.find(x => x.id === id);
    if (p && p.canEditOrDelete === false) {
      this.showToast('Bu ilanı silme yetkiniz bulunmamaktadır. Yalnızca şirket sahibi veya ilanı ekleyen danışman silebilir.', 'error');
      return;
    }
    if (!confirm('Bu gayrimenkul ilanını silmek istediğinize emin misiniz?')) return;
    try {
      await API.deleteProperty(id);
      this.showToast('İlan başarıyla silindi 🗑️');
      document.querySelectorAll('.modal-backdrop').forEach(b => b.classList.remove('open'));
      await this.refreshAllData();
      this.renderProperties();
      this.renderDashboard();
    } catch (err) {
      this.showToast('Silme hatası: ' + err.message, 'error');
    }
  },

  // ─── İl, İlçe ve Mahalle Kontrol & Öneri Metotları (Van Odaklı) ────
  initLocationSelectors() {
    if (typeof Locations === 'undefined') return;

    // 1. Sol Filtre İl Seçimi
    const filterCityEl = document.getElementById('adv-filter-city');
    if (filterCityEl) {
      Locations.populateCitySelect(filterCityEl, this.filterState.city || '', true, 'İl (Tümü)');
    }

    // 2. Sol Filtre İlçe Seçimi (Van veya seçili il)
    const filterDistEl = document.getElementById('adv-filter-district');
    if (filterDistEl) {
      Locations.populateDistrictSelect(filterDistEl, this.filterState.city || '', this.filterState.district || '', true, 'İlçe (Tümü)');
    }

    // 3. Sol Filtre Mahalle Önerileri & Manuel Giriş
    this.updateFilterNeighborhoodSuggestions();

    // 4. İlan Ekleme Formu Konum Başlatma
    const propCityEl = document.getElementById('prop-city');
    if (propCityEl) {
      Locations.populateCitySelect(propCityEl, 'Van', false);
      this.populatePropDistricts('Van', 'İpekyolu');
    }
  },

  onCityFilterChange() {
    const cityEl = document.getElementById('adv-filter-city');
    const selectedCity = cityEl ? cityEl.value : '';
    this.filterState.city = selectedCity;
    this.filterState.district = ''; // İl değiştiğinde ilçe filtresini sıfırla

    const distEl = document.getElementById('adv-filter-district');
    if (distEl) {
      Locations.populateDistrictSelect(distEl, selectedCity, '', true, 'İlçe (Tümü)');
    }

    this.updateFilterNeighborhoodSuggestions();
    this.onFilterChange();
  },

  onDistrictFilterChange() {
    const distEl = document.getElementById('adv-filter-district');
    const selectedDistrict = distEl ? distEl.value : '';
    this.filterState.district = (selectedDistrict === '__custom__') ? '' : selectedDistrict;

    this.updateFilterNeighborhoodSuggestions();
    this.onFilterChange();
  },

  updateFilterNeighborhoodSuggestions() {
    if (typeof Locations === 'undefined') return;
    const city = this.filterState.city || '';
    const district = this.filterState.district || '';
    const datalist = document.getElementById('adv-filter-neighborhood-datalist');
    const chipsContainer = document.getElementById('adv-filter-neighborhood-chips');
    const inputEl = document.getElementById('adv-filter-neighborhood');

    if (datalist) {
      Locations.populateNeighborhoodDatalist(datalist, city, district);
    }

    if (chipsContainer && inputEl && (city.toLowerCase() === 'van' || district)) {
      Locations.renderQuickChips(chipsContainer, inputEl, city, district);
    } else if (chipsContainer) {
      chipsContainer.innerHTML = '';
    }
  },

  populatePropDistricts(city, selectedDistrict = '') {
    const distEl = document.getElementById('prop-district');
    const customDistEl = document.getElementById('prop-district-custom');
    if (!distEl) return;

    Locations.populateDistrictSelect(distEl, city, selectedDistrict, false);
    if (customDistEl) {
      customDistEl.style.display = 'none';
      customDistEl.value = '';
    }
    distEl.style.display = 'block';

    const currentDist = selectedDistrict || distEl.value;
    this.updatePropNeighborhoodSuggestions(city, currentDist);
  },

  onPropCityChange() {
    const cityEl = document.getElementById('prop-city');
    const city = cityEl ? cityEl.value : 'Van';
    this.populatePropDistricts(city);
  },

  onPropDistrictChange() {
    const cityEl = document.getElementById('prop-city');
    const distEl = document.getElementById('prop-district');
    const customDistEl = document.getElementById('prop-district-custom');
    const city = cityEl ? cityEl.value : 'Van';
    const dist = distEl ? distEl.value : '';

    if (dist === '__custom__') {
      if (customDistEl) {
        customDistEl.style.display = 'block';
        customDistEl.focus();
      }
    } else {
      if (customDistEl) customDistEl.style.display = 'none';
      this.updatePropNeighborhoodSuggestions(city, dist);
    }
  },

  togglePropDistrictManual() {
    const distEl = document.getElementById('prop-district');
    const customDistEl = document.getElementById('prop-district-custom');
    const toggleBtn = document.getElementById('prop-district-toggle-btn');
    if (!distEl || !customDistEl) return;

    if (customDistEl.style.display === 'none') {
      customDistEl.style.display = 'block';
      distEl.style.display = 'none';
      customDistEl.focus();
      if (toggleBtn) toggleBtn.innerText = '📋 Listeden Seç';
    } else {
      customDistEl.style.display = 'none';
      distEl.style.display = 'block';
      if (toggleBtn) toggleBtn.innerText = '✏️ Manuel Yaz';
    }
  },

  togglePropTypeManual() {
    const selectEl = document.getElementById('prop-type');
    const customEl = document.getElementById('prop-type-custom');
    const toggleBtn = document.getElementById('prop-type-toggle-btn');
    if (!selectEl || !customEl) return;

    if (customEl.style.display === 'none') {
      customEl.style.display = 'block';
      selectEl.style.display = 'none';
      customEl.focus();
      if (toggleBtn) toggleBtn.innerText = '📋 Listeden Seç';
    } else {
      customEl.style.display = 'none';
      selectEl.style.display = 'block';
      if (toggleBtn) toggleBtn.innerText = '✏️ Manuel Yaz';
    }
  },

  setPropType(val) {
    const selectEl = document.getElementById('prop-type');
    const customEl = document.getElementById('prop-type-custom');
    const toggleBtn = document.getElementById('prop-type-toggle-btn');
    if (!selectEl || !customEl) return;
    const hasOption = Array.from(selectEl.options).some(o => o.value.toLowerCase() === val.toLowerCase());
    if (hasOption) {
      selectEl.value = val.toLowerCase();
      selectEl.style.display = 'block';
      customEl.style.display = 'none';
      if (toggleBtn) toggleBtn.innerText = '✏️ Manuel Yaz';
    } else {
      customEl.value = val;
      customEl.style.display = 'block';
      selectEl.style.display = 'none';
      if (toggleBtn) toggleBtn.innerText = '📋 Listeden Seç';
    }
  },

  setPropRooms(val) {
    const selectEl = document.getElementById('prop-rooms');
    const customEl = document.getElementById('prop-rooms-custom');
    const toggleBtn = document.getElementById('prop-rooms-toggle-btn');
    if (!selectEl || !customEl) return;
    const hasOption = Array.from(selectEl.options).some(o => o.value.toLowerCase() === val.toLowerCase());
    if (hasOption) {
      selectEl.value = val;
      selectEl.style.display = 'block';
      customEl.style.display = 'none';
      if (toggleBtn) toggleBtn.innerText = '✏️ Manuel Yaz';
    } else {
      customEl.value = val;
      customEl.style.display = 'block';
      selectEl.style.display = 'none';
      if (toggleBtn) toggleBtn.innerText = '📋 Listeden Seç';
    }
  },

  setPropHeating(val) {
    const selectEl = document.getElementById('prop-heating');
    const customEl = document.getElementById('prop-heating-custom');
    const toggleBtn = document.getElementById('prop-heating-toggle-btn');
    if (!selectEl || !customEl) return;
    const hasOption = Array.from(selectEl.options).some(o => o.value.toLowerCase() === val.toLowerCase());
    if (hasOption) {
      selectEl.value = val.toLowerCase();
      selectEl.style.display = 'block';
      customEl.style.display = 'none';
      if (toggleBtn) toggleBtn.innerText = '✏️ Manuel Yaz';
    } else {
      customEl.value = val;
      customEl.style.display = 'block';
      selectEl.style.display = 'none';
      if (toggleBtn) toggleBtn.innerText = '📋 Listeden Seç';
    }
  },

  togglePropFloorManual() {
    const numEl = document.getElementById('prop-floor');
    const customEl = document.getElementById('prop-floor-custom');
    const toggleBtn = document.getElementById('prop-floor-toggle-btn');
    if (!numEl || !customEl) return;

    if (customEl.style.display === 'none') {
      customEl.style.display = 'block';
      numEl.style.display = 'none';
      customEl.focus();
      if (toggleBtn) toggleBtn.innerText = '🔢 Kat Numarası';
    } else {
      customEl.style.display = 'none';
      numEl.style.display = 'block';
      if (toggleBtn) toggleBtn.innerText = '✏️ Özel Kat Yaz';
    }
  },

  setPropFloor(val) {
    const numEl = document.getElementById('prop-floor');
    const customEl = document.getElementById('prop-floor-custom');
    const toggleBtn = document.getElementById('prop-floor-toggle-btn');
    const num = Number(val);
    if (!isNaN(num) && Number.isInteger(num)) {
      if (numEl) {
        numEl.value = num;
        numEl.style.display = 'block';
      }
      if (customEl) customEl.style.display = 'none';
      if (toggleBtn) toggleBtn.innerText = '✏️ Özel Kat Yaz';
    } else {
      if (customEl) {
        customEl.value = val;
        customEl.style.display = 'block';
      }
      if (numEl) numEl.style.display = 'none';
      if (toggleBtn) toggleBtn.innerText = '🔢 Kat Numarası';
    }
  },

  // ─── İlan Ekleme/Düzenleme Formu Donanım Etiketleri ────────────
  currentPropFeatures: [],

  addPropFeatureTag(val) {
    const input = document.getElementById('prop-feature-input');
    const feat = (val || (input ? input.value : '')).trim();
    if (!feat) return;
    if (!this.currentPropFeatures) this.currentPropFeatures = [];
    if (!this.currentPropFeatures.includes(feat)) {
      this.currentPropFeatures.push(feat);
    }
    if (input) input.value = '';
    this.renderPropFeaturesChips();
  },

  quickAddPropFeature(val) {
    this.addPropFeatureTag(val);
  },

  removePropFeatureTag(feat) {
    if (!this.currentPropFeatures) return;
    this.currentPropFeatures = this.currentPropFeatures.filter(f => f !== feat);
    this.renderPropFeaturesChips();
  },

  renderPropFeaturesChips() {
    const container = document.getElementById('prop-features-chips-container');
    if (!container) return;
    const feats = this.currentPropFeatures || [];
    if (feats.length === 0) {
      container.innerHTML = '<span style="font-size:12px; color:var(--text-muted); padding:4px 0;">Henüz özel donanım eklenmedi. Yukarıdan yazabilir veya aşağıdaki butonlara tıklayabilirsiniz.</span>';
      return;
    }
    container.innerHTML = feats.map(f => `
      <span class="filter-custom-chip" style="font-size:12px; padding:3px 10px;">
        ✨ ${f}
        <span class="remove-btn" onclick="App.removePropFeatureTag('${f}')">&times;</span>
      </span>
    `).join('');
  },

  togglePropRoomsManual() {
    const selectEl = document.getElementById('prop-rooms');
    const customEl = document.getElementById('prop-rooms-custom');
    const toggleBtn = document.getElementById('prop-rooms-toggle-btn');
    if (!selectEl || !customEl) return;

    if (customEl.style.display === 'none') {
      customEl.style.display = 'block';
      selectEl.style.display = 'none';
      customEl.focus();
      if (toggleBtn) toggleBtn.innerText = '📋 Listeden Seç';
    } else {
      customEl.style.display = 'none';
      selectEl.style.display = 'block';
      if (toggleBtn) toggleBtn.innerText = '✏️ Manuel Yaz';
    }
  },

  togglePropHeatingManual() {
    const selectEl = document.getElementById('prop-heating');
    const customEl = document.getElementById('prop-heating-custom');
    const toggleBtn = document.getElementById('prop-heating-toggle-btn');
    if (!selectEl || !customEl) return;

    if (customEl.style.display === 'none') {
      customEl.style.display = 'block';
      selectEl.style.display = 'none';
      customEl.focus();
      if (toggleBtn) toggleBtn.innerText = '📋 Listeden Seç';
    } else {
      customEl.style.display = 'none';
      selectEl.style.display = 'block';
      if (toggleBtn) toggleBtn.innerText = '✏️ Manuel Yaz';
    }
  },

  updatePropNeighborhoodSuggestions(city, district) {
    if (typeof Locations === 'undefined') return;
    const datalist = document.getElementById('prop-neighborhood-datalist');
    const chipsContainer = document.getElementById('prop-neighborhood-chips');
    const inputEl = document.getElementById('prop-neighborhood');

    if (datalist) {
      Locations.populateNeighborhoodDatalist(datalist, city, district);
    }

    if (chipsContainer && inputEl) {
      Locations.renderQuickChips(chipsContainer, inputEl, city, district);
    }
  },

  addDistrictToCustomer(districtName) {
    const input = document.getElementById('cust-districts');
    if (!input) return;
    const current = input.value.split(',').map(s => s.trim()).filter(Boolean);
    if (!current.includes(districtName)) {
      current.push(districtName);
      input.value = current.join(', ');
    }
    input.focus();
  },

  openCreateCustomerModal() {
    document.querySelectorAll('.modal-backdrop').forEach(b => b.classList.remove('open'));
    const modal = document.getElementById('customer-form-modal');
    const form = document.getElementById('customer-form');
    if (form) form.reset();
    document.getElementById('customer-form-id').value = '';
    document.getElementById('customer-modal-title').innerText = 'Yeni Müşteri Ekle (Payidar Müşteri Kartı)';
    if (document.getElementById('cust-class')) document.getElementById('cust-class').value = 'B';
    if (document.getElementById('cust-pipeline-status')) document.getElementById('cust-pipeline-status').value = 'aktif';
    if (document.getElementById('cust-lead-source')) document.getElementById('cust-lead-source').value = 'telefon';
    if (document.getElementById('cust-min-budget')) document.getElementById('cust-min-budget').value = '';
    if (document.getElementById('cust-kvkk')) document.getElementById('cust-kvkk').checked = true;
    if (document.getElementById('cust-contact-perm')) document.getElementById('cust-contact-perm').checked = true;
    if (modal) modal.classList.add('open');
  },

  async openEditCustomerModal(id) {
    try {
      const c = await API.getCustomer(id);
      if (c.canEditOrDelete === false) {
        this.showToast('Bu müşteri kaydı başka bir danışmana aittir. Yalnızca müşteri temsilcisi veya şirket sahibi düzenleyebilir.', 'error');
        return;
      }
      const modal = document.getElementById('customer-form-modal');
      document.getElementById('customer-modal-title').innerText = 'Müşteri Düzenle (Payidar Müşteri Kartı)';
      document.getElementById('customer-form-id').value = c.id;
      document.getElementById('cust-name').value = c.name || '';
      document.getElementById('cust-phone').value = c.phone || '';
      document.getElementById('cust-email').value = c.email || '';
      if (document.getElementById('cust-class')) document.getElementById('cust-class').value = c.customerClass || 'B';
      if (document.getElementById('cust-pipeline-status')) document.getElementById('cust-pipeline-status').value = c.pipelineStatus || c.status || 'aktif';
      if (document.getElementById('cust-lead-source')) document.getElementById('cust-lead-source').value = c.leadSource || 'telefon';
      if (document.getElementById('cust-min-budget')) document.getElementById('cust-min-budget').value = c.minBudget || '';
      document.getElementById('cust-budget').value = c.maxBudget || c.totalBudget || '';
      document.getElementById('cust-rooms').value = (c.preferredRooms || []).join(', ');
      document.getElementById('cust-downpayment').value = c.downPayment || '';
      document.getElementById('cust-timeline').value = c.purchaseTimeline || '1-3-ay';
      document.getElementById('cust-purpose').value = c.purpose || 'oturum';
      document.getElementById('cust-districts').value = (c.preferredDistricts || []).join(', ');
      document.getElementById('cust-min-area').value = c.minNetArea || '';
      document.getElementById('cust-max-age').value = c.maxBuildingAge || '';
      document.getElementById('cust-notes').value = c.notes || '';
      if (document.getElementById('cust-kvkk')) document.getElementById('cust-kvkk').checked = c.kvkkConsent !== false;
      if (document.getElementById('cust-contact-perm')) document.getElementById('cust-contact-perm').checked = c.contactPermission !== false;
      modal.classList.add('open');
    } catch (err) {
      this.showToast('Müşteri açılamadı: ' + err.message, 'error');
    }
  },

  openCreateFollowUpModal(propertyId = null, customerId = null) {
    document.querySelectorAll('.modal-backdrop').forEach(b => b.classList.remove('open'));
    const modal = document.getElementById('followup-form-modal');
    const form = document.getElementById('followup-form');
    if (form) form.reset();

    const d = new Date();
    d.setHours(d.getHours() + 2);
    d.setMinutes(0);
    const dateInput = document.getElementById('fu-date');
    if (dateInput) {
      dateInput.value = d.toISOString().slice(0, 16);
    }

    if (propertyId) document.getElementById('fu-prop-id').value = propertyId;
    if (customerId) document.getElementById('fu-cust-id').value = customerId;

    if (modal) modal.classList.add('open');
  },

  async checkNetworkInfo() {
    try {
      const info = await API.getNetworkInfo();
      const badge = document.getElementById('network-status-badge');
      if (badge && info.localIPs && info.localIPs.length > 0) {
        badge.innerHTML = `<span class="status-dot"></span><span>Çevrimiçi (${info.localIPs[0]})</span>`;
        badge.onclick = () => this.openNetworkModal(info);
      }
    } catch (_) {}
  },

  openNetworkModal(info) {
    const modal = document.getElementById('network-modal');
    const body = document.getElementById('network-modal-body');
    if (!modal || !body) return;

    const urls = info.urls || [];
    body.innerHTML = `
      <div style="text-align:center; padding:10px 0 20px;">
        <div style="width:70px; height:70px; border-radius:20px; background:var(--gradient-primary); margin:0 auto 16px; display:flex; align-items:center; justify-content:center; font-size:32px; color:white;">
          📱
        </div>
        <h4 style="font-size:18px; font-weight:700; margin-bottom:8px;">Telefon & Tabletten Bağlanın</h4>
        <p style="color:var(--text-secondary); font-size:13px; line-height:1.5;">
          Aynı Wi-Fi / yerel ağdaki telefonunuzun kamerasını açın veya tarayıcınıza aşağıdaki adresi yazın. Hiçbir kurulum gerekmez!
        </p>
      </div>

      <div style="background:var(--bg-tertiary); border:1px solid var(--border-color); border-radius:var(--radius-lg); padding:16px; margin-bottom:16px;">
        <div style="font-size:12px; color:var(--text-muted); margin-bottom:6px;">TELEFON TARAYICISINA YAZILACAK ADRES:</div>
        ${urls.map(u => `
          <div style="display:flex; align-items:center; justify-content:space-between; background:var(--bg-secondary); padding:10px 14px; border-radius:var(--radius-md); margin-bottom:6px; font-family:monospace; font-size:14px; color:var(--accent-emerald);">
            <span>${u}</span>
            <button class="btn btn-secondary btn-sm" onclick="navigator.clipboard.writeText('${u}'); App.showToast('Adres kopyalandı');">Kopyala</button>
          </div>
        `).join('')}
      </div>

      <div style="background:#E8F8F5; border:1px solid #A3E4D7; border-radius:var(--radius-sm); padding:12px; font-size:12px; color:var(--accent-emerald);">
        💡 <strong>İpucu:</strong> Safari veya Chrome'da açtıktan sonra <strong>"Ana Ekrana Ekle"</strong> derseniz, tıpkı App Store / Google Play'den indirilmiş gibi tam ekran mobil uygulama olarak çalışır.
      </div>
    `;

    modal.classList.add('open');
  },

  async renderSettings() {
    const container = document.getElementById('settings-content-wrap');
    if (!container) return;

    const isOwner = this.currentRole === 'owner';

    try {
      const net = await API.getNetworkInfo();
      container.innerHTML = `
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:20px;">
          <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--radius-lg); padding:24px;">
            <h4 style="font-size:16px; font-weight:700; margin-bottom:12px; color:var(--heading-color);">
              🌐 Çoklu Cihaz & Mobil Erişim
            </h4>
            <p style="font-size:13px; color:var(--text-secondary); margin-bottom:16px;">
              Uygulamanız şu an yerel ağda (Wi-Fi) yayındadır. Telefon veya ofisinizdeki diğer bilgisayarlardan aynı anda veri girebilirsiniz.
            </p>
            <button class="btn btn-primary" onclick="App.openNetworkModal(${JSON.stringify(net).replace(/"/g, '&quot;')})">
              📱 Mobil Bağlantı Bilgilerini Gör
            </button>
          </div>

          <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--radius-lg); padding:24px;">
            <h4 style="font-size:16px; font-weight:700; margin-bottom:12px; color:var(--heading-color);">
              💾 Yedekleme & Güvenlik
            </h4>
            ${isOwner ? `
              <p style="font-size:13px; color:var(--text-secondary); margin-bottom:16px;">
                Tüm şirket portföy ilanlarını, müşteri CRM kayıtlarını ve takip ajandanızı tek tıkla JSON olarak bilgisayarınıza indirin.
              </p>
              <div style="display:flex; gap:10px; flex-wrap:wrap;">
                <button class="btn btn-secondary" onclick="App.exportBackup()">
                  📥 Veritabanını İndir
                </button>
                <label class="btn btn-secondary" style="cursor:pointer;">
                  📤 Yedek Yükle
                  <input type="file" accept=".json" style="display:none;" onchange="App.importBackup(event)" />
                </label>
              </div>
            ` : `
              <div style="background:#FFFBEB; border:1px solid #FDE68A; border-radius:var(--radius-sm); padding:16px; margin-bottom:12px;">
                <div style="font-size:13px; font-weight:700; color:var(--accent-gold); margin-bottom:4px;">
                  🔒 Şirket Sahibi Koruması
                </div>
                <div style="font-size:12px; color:var(--text-secondary); line-height:1.5;">
                  Tüm ofis veritabanının yedeğini alma ve geri yükleme yetkisi KVKK ve şirket gizlilik standartları gereğince yalnızca <strong>Şirket Sahibi</strong> hesabına aittir.
                </div>
              </div>
              <button class="btn btn-secondary" disabled style="opacity:0.5; cursor:not-allowed;">
                🔒 Yedekleme Kilitli (Yetki Yok)
              </button>
            `}
          </div>
        </div>
      `;
    } catch (_) {}
  },

  async exportBackup() {
    if (this.currentRole !== 'owner') {
      this.showToast('Yedek alma yetkisi yalnızca Şirket Sahibine aittir.', 'error');
      return;
    }
    try {
      const backup = await API.getBackup();
      const str = JSON.stringify(backup.data, null, 2);
      const blob = new Blob([str], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `emlak-takip-yedek-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      this.showToast('Yedek dosyası indirildi');
    } catch (err) {
      this.showToast('Yedek alınamadı: ' + err.message, 'error');
    }
  },

  async importBackup(e) {
    if (this.currentRole !== 'owner') {
      this.showToast('Yedek geri yükleme yetkisi yalnızca Şirket Sahibine aittir.', 'error');
      return;
    }
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const json = JSON.parse(text);
      await API.restoreBackup(json);
      this.showToast('Veriler başarıyla yüklendi!');
      await this.refreshAllData();
      this.renderDashboard();
    } catch (err) {
      this.showToast('Yükleme hatası: ' + err.message, 'error');
    }
  },

  initPWA() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(err => {
          console.log('SW kayıt hatası:', err);
        });
      });
    }
  },

  // ─── SAAS KİMLİK DOĞRULAMA & OTURUM ────────────────────────
  initAuthEvents() {
    window.addEventListener('auth:required', () => {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('inviteToken') || urlParams.get('invite')) return;
      this.openUserAuthModal('login');
    });
  },

  updateTopbarUser() {
    const compNameEl = document.getElementById('topbar-company-name');
    const userNameEl = document.getElementById('topbar-user-name');
    const avatarEl = document.getElementById('topbar-user-avatar');

    if (this.currentCompany && compNameEl) {
      compNameEl.innerText = this.currentCompany.name;
    } else if (compNameEl) {
      compNameEl.innerText = 'Şirket Seçin';
    }

    if (this.currentUser && userNameEl) {
      userNameEl.innerText = this.currentUser.fullName || this.currentUser.email;
      if (avatarEl) avatarEl.innerText = (this.currentUser.fullName || 'U').charAt(0).toUpperCase();
    } else if (userNameEl) {
      userNameEl.innerText = 'Giriş Yap';
      if (avatarEl) avatarEl.innerText = '👤';
    }
  },

  openUserAuthModal(tab = 'login') {
    const modal = document.getElementById('auth-modal');
    if (!modal) return;
    this.setAuthTab(tab);
    modal.classList.add('open');
  },

  setAuthTab(tab) {
    const loginForm = document.getElementById('login-form');
    const regForm = document.getElementById('register-form');
    const tabLoginBtn = document.getElementById('auth-tab-login');
    const tabRegBtn = document.getElementById('auth-tab-register');
    const titleEl = document.getElementById('auth-modal-title');

    if (tab === 'login') {
      if (loginForm) loginForm.style.display = 'block';
      if (regForm) regForm.style.display = 'none';
      if (tabLoginBtn) {
        tabLoginBtn.classList.add('active');
        tabLoginBtn.style.borderBottom = '2px solid var(--accent-emerald)';
      }
      if (tabRegBtn) {
        tabRegBtn.classList.remove('active');
        tabRegBtn.style.borderBottom = 'none';
      }
      if (titleEl) titleEl.innerText = 'Giriş Yap';
    } else {
      if (loginForm) loginForm.style.display = 'none';
      if (regForm) regForm.style.display = 'block';
      if (tabLoginBtn) {
        tabLoginBtn.classList.remove('active');
        tabLoginBtn.style.borderBottom = 'none';
      }
      if (tabRegBtn) {
        tabRegBtn.classList.add('active');
        tabRegBtn.style.borderBottom = '2px solid var(--accent-emerald)';
      }
      if (titleEl) titleEl.innerText = 'Yeni Emlak Şirketi Kaydı';
    }
  },

  async handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
      const res = await API.login(email, password);
      this.showToast('Giriş başarılı, hoş geldiniz! 👋');
      document.getElementById('auth-modal').classList.remove('open');
      await this.checkAuthSession();
      await this.refreshAllData();
      this.showTab('dashboard');
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  async handleRegister(e) {
    e.preventDefault();
    const fullName = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const companyName = document.getElementById('reg-company-name').value;
    const city = document.getElementById('reg-city').value;

    try {
      await API.register({ fullName, email, password, companyName, city });
      this.showToast('Şirketiniz ve hesabınız başarıyla oluşturuldu! 🎉');
      document.getElementById('auth-modal').classList.remove('open');
      await this.checkAuthSession();
      await this.refreshAllData();
      this.showTab('dashboard');
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  openCompanySwitcherModal() {
    if (!this.currentUser) {
      this.openUserAuthModal('login');
      return;
    }
    const modal = document.getElementById('company-switcher-modal');
    const listEl = document.getElementById('company-switcher-list');
    if (!modal || !listEl) return;

    listEl.innerHTML = this.memberships.map(m => `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; background:var(--bg-tertiary); border-radius:var(--radius-md); border:${m.isCurrent ? '1px solid var(--accent-emerald)' : '1px solid var(--border-color)'};">
        <div>
          <div style="font-weight:700; font-size:13px;">${m.companyName}</div>
          <div style="font-size:11px; color:var(--text-muted);">${m.role.toUpperCase()}</div>
        </div>
        ${m.isCurrent ? '<span class="badge badge-sale">AKTİF</span>' : `<button class="btn btn-secondary btn-sm" onclick="App.handleSwitchCompany('${m.companyId}')">Geçiş Yap</button>`}
      </div>
    `).join('');

    modal.classList.add('open');
  },

  async handleSwitchCompany(targetCompanyId) {
    try {
      await API.switchCompany(targetCompanyId);
      this.showToast('Şirket değiştirildi 🔄');
      document.getElementById('company-switcher-modal').classList.remove('open');
      await this.checkAuthSession();
      await this.refreshAllData();
      this.showTab('dashboard');
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  // ─── B2B ORTAK HAVUZ (B2B POOL) ─────────────────────────────
  setPoolSubTab(tab) {
    this.poolSubTab = tab;
    document.querySelectorAll('.pool-subtab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.poolSub === tab);
    });

    const propCont = document.getElementById('pool-properties-container');
    const custCont = document.getElementById('pool-customers-container');
    const mySharesCont = document.getElementById('pool-my-shares-container');

    if (propCont) propCont.style.display = tab === 'properties' ? 'block' : 'none';
    if (custCont) custCont.style.display = tab === 'customers' ? 'block' : 'none';
    if (mySharesCont) mySharesCont.style.display = tab === 'my_shares' ? 'block' : 'none';

    this.loadPoolData();
  },

  async renderPool() {
    await this.loadPoolData();
  },

  async loadPoolData() {
    const propGrid = document.getElementById('pool-properties-grid');
    const custGrid = document.getElementById('pool-customers-grid');
    const propSubCount = document.getElementById('pool-prop-sub-count');
    const custSubCount = document.getElementById('pool-cust-sub-count');
    const mySharesSubCount = document.getElementById('pool-my-shares-sub-count');

    try {
      if (this.poolSubTab === 'properties') {
        if (propGrid) propGrid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:30px; color:var(--text-muted);">Ortak portföy taranıyor...</div>';
        const poolProps = await API.getProperties({ scope: 'pool' });
        this.poolProperties = poolProps;
        if (propSubCount) propSubCount.innerText = poolProps.length;

        if (!propGrid) return;
        if (poolProps.length === 0) {
          propGrid.innerHTML = `
            <div style="grid-column:1/-1; text-align:center; padding:50px 20px; background:var(--bg-card); border-radius:var(--radius-xl); border:1px solid var(--border-color);">
              <div style="font-size:36px; margin-bottom:8px;">🌐</div>
              <h4 style="font-size:16px; font-weight:700;">Henüz ortak havuza açılmış başka ilan bulunmuyor</h4>
              <p style="color:var(--text-muted); font-size:12px;">Portföyünüzdeki gayrimenkulleri havuza açarak diğer emlak şirketleriyle iş birliği başlatabilirsiniz.</p>
            </div>
          `;
          return;
        }

        propGrid.innerHTML = poolProps.map(p => this.renderPropertyCard(p)).join('');
      } else if (this.poolSubTab === 'customers') {
        if (custGrid) custGrid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:30px; color:var(--text-muted);">Ortak alıcı talepleri taranıyor...</div>';
        const poolCusts = await API.getCustomers({ scope: 'pool' });
        this.poolCustomers = poolCusts;
        if (custSubCount) custSubCount.innerText = poolCusts.length;

        if (!custGrid) return;
        if (poolCusts.length === 0) {
          custGrid.innerHTML = `
            <div style="grid-column:1/-1; text-align:center; padding:50px 20px; background:var(--bg-card); border-radius:var(--radius-xl); border:1px solid var(--border-color);">
              <div style="font-size:36px; margin-bottom:8px;">🔒</div>
              <h4 style="font-size:16px; font-weight:700;">Havuzda aktif alıcı talebi bulunmuyor</h4>
              <p style="color:var(--text-muted); font-size:12px;">Müşterilerinizin talep kriterlerini (kişisel verilerini gizleyerek) havuza açabilirsiniz.</p>
            </div>
          `;
          return;
        }

        custGrid.innerHTML = poolCusts.map(c => `
          <div class="cust-card" style="border-left:3px solid var(--accent-emerald);">
            <div class="cust-header">
              <div style="display:flex; align-items:center;">
                <div class="cust-avatar">🔒</div>
                <div class="cust-title-wrap">
                  <div class="cust-name">${c.name} <span style="font-size:10px; color:var(--text-muted); font-weight:normal;">(KVKK Maskeli)</span></div>
                  <div class="cust-timeline">🏢 ${c.ownerCompany ? c.ownerCompany.name : 'Ortak Şirket'}</div>
                </div>
              </div>
              <span class="badge badge-sale">B2B ALICI</span>
            </div>

            <div class="cust-budget-box">
              <div class="cust-budget-row">
                <span class="cust-budget-label">Aranan Bütçe</span>
                <span class="cust-budget-val">${this.formatPrice(c.totalBudget)}</span>
              </div>
            </div>

            <div class="cust-tags">
              <span class="cust-tag">🎯 ${c.purpose === 'yatirim' ? 'Yatırım' : 'Oturum'}</span>
              ${c.preferredRooms && c.preferredRooms.length > 0 ? `<span class="cust-tag room-tag">🏠 ${c.preferredRooms.join(', ')}</span>` : ''}
              ${c.preferredDistricts && c.preferredDistricts.length > 0 ? `<span class="cust-tag">📍 ${c.preferredDistricts.join(', ')}</span>` : ''}
            </div>

            <div class="cust-actions" style="margin-top:14px;">
              ${c.ownerCompany && c.ownerCompany.phone ? `
                <a href="https://wa.me/9${c.ownerCompany.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Merhaba ${c.ownerCompany.name}, Emlak Takip CRM ortak havuzundaki alıcı talebiniz için uygun portföyümüz bulunmaktadır. Görüşmek isteriz.`)}" target="_blank" class="btn btn-primary btn-sm" style="flex:1; justify-content:center;">
                  💬 Temsilci Şirketle WhatsApp'tan Görüş
                </a>
              ` : '<span style="font-size:11px; color:var(--text-muted);">İletişim bilgisi şirket profilinde</span>'}
            </div>
          </div>
        `).join('');
      } else if (this.poolSubTab === 'my_shares') {
        const mySharesGrid = document.getElementById('pool-my-shares-grid');
        if (mySharesGrid) mySharesGrid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:30px; color:var(--text-muted);">Havuza açılan kayıtlarınız yükleniyor...</div>';

        const [myProps, myCusts] = await Promise.all([
          API.getProperties({ scope: 'my_pool' }),
          API.getCustomers({ scope: 'my_pool' })
        ]);

        this.myPoolProperties = Array.isArray(myProps) ? myProps : [];
        this.myPoolCustomers = Array.isArray(myCusts) ? myCusts : [];

        if (mySharesSubCount) {
          mySharesSubCount.innerText = this.myPoolProperties.length + this.myPoolCustomers.length;
        }

        this.renderPoolMyShares();
      }
    } catch (err) {
      console.error('Havuz verisi yükleme hatası:', err);
    }
  },

  filterPoolMyShares(filter, btn) {
    this.poolMyShareFilter = filter;
    document.querySelectorAll('.pool-myshare-filter-btn').forEach(b => {
      b.classList.toggle('active', b === btn);
    });
    this.renderPoolMyShares();
  },

  renderPoolMyShares() {
    const grid = document.getElementById('pool-my-shares-grid');
    const summaryEl = document.getElementById('pool-my-shares-summary-text');
    if (!grid) return;

    const currentUserId = this.currentUser ? this.currentUser.id : null;
    let props = this.myPoolProperties || [];
    let custs = this.myPoolCustomers || [];

    if (this.poolMyShareFilter === 'onlyMine') {
      props = props.filter(p => p.createdById === currentUserId);
      custs = custs.filter(c => c.createdById === currentUserId);
    } else if (this.poolMyShareFilter === 'props') {
      custs = [];
    } else if (this.poolMyShareFilter === 'custs') {
      props = [];
    }

    const totalCount = props.length + custs.length;
    if (summaryEl) {
      summaryEl.innerText = `${props.length} Aktif İlan, ${custs.length} Alıcı Talebi B2B Pazarında Yayında`;
    }

    if (totalCount === 0) {
      grid.innerHTML = `
        <div style="grid-column:1/-1; text-align:center; padding:50px 20px; background:var(--bg-card); border-radius:var(--radius-xl); border:1px solid var(--border-color);">
          <div style="font-size:36px; margin-bottom:8px;">⭐</div>
          <h4 style="font-size:16px; font-weight:700;">Bu filtreye uygun havuz paylaşımı bulunamadı</h4>
          <p style="color:var(--text-muted); font-size:12px; margin-bottom:16px;">Kendi portföyünüzdeki veya şirketinizdeki ilanları '🌐 Paylaş' butonu ile havuza açabilirsiniz.</p>
          <button class="btn btn-primary" onclick="App.showTab('profile')">Profilim & Masama Git ➔</button>
        </div>
      `;
      return;
    }

    let html = '';

    // Render properties
    props.forEach(p => {
      const isMyOwn = p.createdById === currentUserId;
      const canEdit = this.isOwnerOrAdmin() || isMyOwn;
      html += `
        <div class="pool-my-share-card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <span class="pool-my-share-badge badge-sale">🏠 İLAN PAYLAŞIMI</span>
            <span class="badge ${isMyOwn ? 'badge-role-agent' : 'badge-role-admin'}" style="font-size:10px;">
              ${isMyOwn ? '👤 Sizin İlanınız' : '👥 Ekip İlanı'}
            </span>
          </div>

          <div style="font-weight:700; font-size:15px; margin-bottom:4px; line-height:1.3;">${p.title}</div>
          <div style="font-size:12px; color:var(--text-muted); margin-bottom:8px;">
            📍 ${p.district || ''} / ${p.city || ''} • 💰 <strong style="color:var(--accent-emerald);">${this.formatPrice(p.price)}</strong>
          </div>

          <div style="font-size:11.5px; background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:var(--radius-sm); padding:6px 10px; margin-bottom:12px; color:var(--text-primary);">
            🤝 <strong>Komisyon Paylaşımı:</strong> ${p.commissionSplit || '50/50'}
            <div style="font-size:10px; opacity:0.8; margin-top:2px;">Danışman: ${p.createdByName || 'Ofis Danışmanı'}</div>
          </div>

          <div style="display:flex; gap:8px;">
            ${canEdit ? `
              <button class="btn btn-secondary btn-sm" style="flex:1;" onclick="App.openSharePropertyModal('${p.id}')">
                ✏️ Komisyonu Düzenle
              </button>
              <button class="btn btn-danger btn-sm" onclick="App.handleQuickRevokeProperty('${p.id}')" title="Havuzdan Kaldır">
                🚫 Çıkar
              </button>
            ` : `
              <span style="font-size:11px; color:var(--text-muted); padding:6px;">Yalnızca ilan sahibi veya şirket yöneticisi yönetebilir</span>
            `}
          </div>
        </div>
      `;
    });

    // Render customers
    custs.forEach(c => {
      const isMyOwn = c.createdById === currentUserId;
      const canEdit = this.isOwnerOrAdmin() || isMyOwn;
      html += `
        <div class="pool-my-share-card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <span class="pool-my-share-badge badge-rent">👥 ALICI TALEBİ</span>
            <span class="badge ${isMyOwn ? 'badge-role-agent' : 'badge-role-admin'}" style="font-size:10px;">
              ${isMyOwn ? '👤 Sizin Müşteriniz' : '👥 Ekip Müşterisi'}
            </span>
          </div>

          <div style="font-weight:700; font-size:15px; margin-bottom:4px; line-height:1.3;">${c.name}</div>
          <div style="font-size:12px; color:var(--text-muted); margin-bottom:8px;">
            🎯 Bütçe: <strong style="color:var(--accent-emerald);">${this.formatPrice(c.totalBudget)}</strong> • ${c.purpose === 'yatirim' ? 'Yatırım' : 'Oturum'}
          </div>

          <div style="font-size:11.5px; background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:var(--radius-sm); padding:6px 10px; margin-bottom:12px; color:var(--text-secondary);">
            🔒 <strong>KVKK Koruma Notu:</strong> ${c.legalBasisNote || 'Platform geneline anonim açık'}
            <div style="font-size:10px; opacity:0.8; margin-top:2px;">Danışman: ${c.createdByName || 'Ofis Danışmanı'}</div>
          </div>

          <div style="display:flex; gap:8px;">
            ${canEdit ? `
              <button class="btn btn-secondary btn-sm" style="flex:1;" onclick="App.openShareCustomerModal('${c.id}')">
                ✏️ Notu Düzenle
              </button>
              <button class="btn btn-danger btn-sm" onclick="App.handleQuickRevokeCustomer('${c.id}')" title="Havuzdan Kaldır">
                🚫 Çıkar
              </button>
            ` : `
              <span style="font-size:11px; color:var(--text-muted); padding:6px;">Yalnızca müşteri temsilcisi veya şirket yöneticisi yönetebilir</span>
            `}
          </div>
        </div>
      `;
    });

    grid.innerHTML = html;
  },

  // ─── ŞİRKET & EKİP YÖNETİMİ TABI ────────────────────────────
  async renderCompany() {
    try {
      const isOwnerOrAdmin = this.isOwnerOrAdmin();
      const roleNotice = document.getElementById('company-role-notice');
      const profileLockText = document.getElementById('company-profile-lock-text');
      const saveProfileBtn = document.getElementById('btn-save-company-profile');
      const openInviteBtn = document.getElementById('btn-open-invite-modal');
      const createDeptBtn = document.getElementById('btn-create-department');
      const deptRoleNotice = document.getElementById('department-role-notice');

      if (roleNotice) {
        roleNotice.style.display = isOwnerOrAdmin ? 'none' : 'block';
      }
      if (profileLockText) {
        profileLockText.style.display = isOwnerOrAdmin ? 'none' : 'block';
      }
      if (saveProfileBtn) {
        saveProfileBtn.style.display = isOwnerOrAdmin ? 'inline-block' : 'none';
      }
      if (createDeptBtn) {
        createDeptBtn.style.display = isOwnerOrAdmin ? 'inline-flex' : 'none';
      }
      if (deptRoleNotice) {
        deptRoleNotice.style.display = isOwnerOrAdmin ? 'none' : 'block';
      }
      if (openInviteBtn) {
        if (!isOwnerOrAdmin) {
          openInviteBtn.disabled = true;
          openInviteBtn.style.opacity = '0.5';
          openInviteBtn.style.cursor = 'not-allowed';
          openInviteBtn.title = 'Yalnızca Şirket Sahibi ve Yöneticiler yeni personel davet edebilir';
        } else {
          openInviteBtn.disabled = false;
          openInviteBtn.style.opacity = '1';
          openInviteBtn.style.cursor = 'pointer';
          openInviteBtn.title = '';
        }
      }

      // Inputları yetkiye göre kilitle veya aç
      const compInputs = [
        'comp-name-input', 'comp-phone-input', 'comp-email-input',
        'comp-city-input', 'comp-tax-input', 'comp-address-input'
      ];
      compInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          el.disabled = !isOwnerOrAdmin;
          el.style.backgroundColor = !isOwnerOrAdmin ? 'var(--bg-secondary)' : '';
          el.style.cursor = !isOwnerOrAdmin ? 'not-allowed' : '';
        }
      });

      const [comp, members, invites, departments] = await Promise.all([
        API.getCurrentCompany(),
        API.getMembers(),
        API.getInvitations(),
        API.getDepartments()
      ]);

      this.companyMembers = members || [];
      this.departments = departments || [];
      this.populateDepartmentSelectors();

      if (comp) {
        document.getElementById('comp-name-input').value = comp.name || '';
        document.getElementById('comp-phone-input').value = comp.phone || '';
        document.getElementById('comp-email-input').value = comp.email || '';
        document.getElementById('comp-city-input').value = comp.city || '';
        document.getElementById('comp-tax-input').value = comp.taxNumber || '';
        document.getElementById('comp-address-input').value = comp.address || '';
      }

      // ─── Departmanlar Grid ──────────────────────────────────
      const deptGrid = document.getElementById('company-departments-grid');
      const deptCountEl = document.getElementById('company-department-count');
      if (deptCountEl) deptCountEl.innerText = this.departments.length;

      if (deptGrid) {
        if (!this.departments || this.departments.length === 0) {
          deptGrid.innerHTML = `
            <div style="grid-column:1/-1; text-align:center; padding:36px 20px; background:var(--bg-tertiary); border:1px dashed var(--border-color); border-radius:var(--radius-lg);">
              <div style="font-size:36px; margin-bottom:8px;">🏛️</div>
              <h4 style="font-size:15px; font-weight:700; margin-bottom:6px;">Henüz Departman Oluşturulmamış</h4>
              <p style="font-size:12px; color:var(--text-muted); max-width:480px; margin:0 auto 16px;">
                Şirketinizin ihtiyaçlarına göre özelleştirilebilir çalışma grupları (ör. Lüks Konut, Ticari Portföy, Arsa Yatırımları) oluşturabilir, hedefler belirleyip danışmanlarınızı görevlendirebilirsiniz.
              </p>
              ${isOwnerOrAdmin ? `
                <button type="button" class="btn btn-primary btn-sm" onclick="App.openCreateDepartmentModal()">
                  + İlk Departmanı Oluştur
                </button>
              ` : '<div style="font-size:11px; color:var(--text-muted);">Yöneticiniz yeni departmanlar oluşturduğunda burada listelenecektir.</div>'}
            </div>
          `;
        } else {
          deptGrid.innerHTML = this.departments.map(d => {
            const crit = d.customCriteria || {};
            const themeColor = d.color || '#10b981';
            const memberCount = d.memberCount || (d.assignedUserIds ? d.assignedUserIds.length : 0);
            const memberList = d.members || [];

            return `
              <div class="department-card" style="border-top: 3px solid ${themeColor};">
                <div class="department-header">
                  <div style="display:flex; align-items:center; gap:10px;">
                    <div class="department-icon-wrap" style="background:${themeColor}22; border-color:${themeColor}55;">
                      ${d.icon || '🏛️'}
                    </div>
                    <div>
                      <h4 class="department-title">${d.name}</h4>
                      <div style="display:flex; align-items:center; gap:6px; margin-top:2px;">
                        <span class="badge" style="font-size:10px; background:var(--bg-secondary); border:1px solid var(--border-color); color:var(--text-secondary);">
                          👥 ${memberCount} Danışman
                        </span>
                        ${d.leader ? `
                          <span class="department-leader-badge" title="Departman Sorumlusu">
                            👑 ${d.leader.fullName}
                          </span>
                        ` : ''}
                      </div>
                    </div>
                  </div>
                </div>

                ${d.description ? `<p class="department-desc">${d.description}</p>` : ''}

                <!-- Özelleştirilmiş Departman Kriterleri -->
                <div class="department-criteria-box">
                  ${crit.focusType ? `
                    <div class="department-criteria-row">
                      <span class="department-criteria-label">🎯 Odak Alanı:</span>
                      <strong class="department-criteria-val">${crit.focusType}</strong>
                    </div>
                  ` : ''}
                  ${crit.region ? `
                    <div class="department-criteria-row">
                      <span class="department-criteria-label">📍 Hedef Bölge:</span>
                      <strong class="department-criteria-val">${crit.region}</strong>
                    </div>
                  ` : ''}
                  ${crit.targetMonthlyVolume ? `
                    <div class="department-criteria-row">
                      <span class="department-criteria-label">📈 Ciro / Hedef:</span>
                      <strong class="department-criteria-val" style="color:${themeColor};">${crit.targetMonthlyVolume}</strong>
                    </div>
                  ` : ''}
                  ${crit.defaultSplit ? `
                    <div class="department-criteria-row">
                      <span class="department-criteria-label">🤝 Komisyon Payı:</span>
                      <strong class="department-criteria-val">${crit.defaultSplit}</strong>
                    </div>
                  ` : ''}
                  <div class="department-criteria-row" style="margin-top:4px; padding-top:4px; border-top:1px dashed var(--border-color);">
                    <span class="department-criteria-label">📊 Departman Hacmi:</span>
                    <span style="font-size:11px; font-weight:700; color:var(--heading-color);">
                      🏠 ${d.propertiesCount || 0} İlan • 👥 ${d.customersCount || 0} Müşteri
                    </span>
                  </div>
                </div>

                <!-- Görevli Danışmanlar -->
                <div style="margin-bottom:12px;">
                  <div style="font-size:11px; color:var(--text-secondary); margin-bottom:6px; font-weight:600;">
                    GÖREVLİ DANIŞMANLAR (${memberCount})
                  </div>
                  <div class="department-members-chips">
                    ${memberList.length > 0 ? memberList.map(m => `
                      <span class="department-member-chip" title="${m.email}">
                        👤 ${m.fullName}
                      </span>
                    `).join('') : '<span style="font-size:11px; color:var(--text-muted); font-style:italic;">Henüz atanmış danışman yok</span>'}
                  </div>
                </div>

                <!-- Departman Aksiyonları -->
                <div class="department-actions">
                  ${isOwnerOrAdmin ? `
                    <button type="button" class="btn btn-secondary btn-sm" onclick="App.openAssignDeptMembersModal('${d.id}')" style="font-size:11.5px; padding:5px 9px;">
                      👥 Danışman Ata
                    </button>
                    <button type="button" class="btn btn-secondary btn-sm" onclick="App.openEditDepartmentModal('${d.id}')" style="font-size:11.5px; padding:5px 9px;">
                      ✏️ Düzenle
                    </button>
                    <button type="button" class="btn btn-danger btn-sm" onclick="App.handleDeleteDepartment('${d.id}')" style="font-size:11.5px; padding:5px 9px;">
                      🗑️ Sil
                    </button>
                  ` : `
                    <div style="font-size:11px; color:var(--text-muted); display:flex; align-items:center; gap:4px; padding:4px 0;">
                      <span>🔒</span> <span>Yalnızca Yöneticiler Düzenleyebilir</span>
                    </div>
                  `}
                </div>
              </div>
            `;
          }).join('');
        }
      }

      // ─── Üyeler Listesi ─────────────────────────────────────
      const memListEl = document.getElementById('company-members-list');
      const memCountEl = document.getElementById('company-member-count');
      if (memCountEl) memCountEl.innerText = members.length;

      if (memListEl) {
        memListEl.innerHTML = members.map(m => {
          const isThisUser = this.currentUser && this.currentUser.id === m.id;
          const memberDept = m.departmentName ? {
            name: m.departmentName,
            icon: m.departmentIcon || '🏛️',
            color: m.departmentColor || '#10b981'
          } : null;

          return `
          <div class="member-item-row" style="${isThisUser ? 'background:var(--bg-secondary); border:1px solid #D1D5DB;' : ''}">
            <div style="display:flex; flex-direction:column; gap:3px;">
              <div style="font-weight:700; font-size:13px; display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                <span>${m.fullName}</span>
                ${isThisUser ? '<span class="badge" style="background:var(--btn-primary-bg); color:#FFFFFF; font-size:10px; padding:1px 6px;">SİZ</span>' : ''}
                ${memberDept ? `
                  <span class="badge" style="background:${memberDept.color}22; color:${memberDept.color}; border:1px solid ${memberDept.color}55; font-size:10.5px; padding:2px 7px;">
                    ${memberDept.icon} ${memberDept.name}
                  </span>
                ` : `
                  <span class="badge" style="background:var(--bg-card); color:var(--text-muted); border:1px dashed var(--border-color); font-size:10.5px; padding:2px 7px;">
                    Departmansız
                  </span>
                `}
              </div>
              <div style="font-size:11px; color:var(--text-muted);">${m.email} ${m.phone ? '• ' + m.phone : ''}</div>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="badge ${m.role === 'owner' ? 'badge-role-owner' : (m.role === 'admin' ? 'badge-role-admin' : 'badge-role-agent')}">
                ${m.role === 'owner' ? '👑 ŞİRKET SAHİBİ' : (m.role === 'admin' ? '🛡️ YÖNETİCİ' : '👔 DANIŞMAN')}
              </span>
              ${isOwnerOrAdmin ? `
                <button type="button" class="btn btn-secondary btn-sm" onclick="App.openQuickMemberDeptModal('${m.id}', '${m.fullName.replace(/'/g, "\\'")}')" style="font-size:11px; padding:4px 8px;">
                  🏛️ Departman Ata
                </button>
              ` : ''}
            </div>
          </div>
          `;
        }).join('');
      }

      // Davetler
      const invListEl = document.getElementById('company-invitations-list');
      if (invListEl) {
        if (!invites || invites.length === 0) {
          invListEl.innerHTML = '<div style="font-size:12px; color:var(--text-muted); padding:10px;">Bekleyen çalışan daveti bulunmuyor.</div>';
        } else {
          invListEl.innerHTML = invites.map(i => {
            const rawToken = i.token || '';
            const inviteUrl = rawToken ? `${window.location.origin}/?inviteToken=${rawToken}` : '';
            return `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:var(--radius-sm); margin-bottom:8px; gap:12px; flex-wrap:wrap;">
              <div style="min-width:180px;">
                <div style="font-size:13px; font-weight:700; color:var(--text-primary);">${i.email}</div>
                <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">
                  Rol: <strong style="color:var(--accent-emerald);">${i.role === 'admin' ? 'Yönetici' : 'Danışman'}</strong> • 
                  Bitiş: ${new Date(i.expiresAt).toLocaleDateString('tr-TR')}
                </div>
              </div>
              <div style="display:flex; align-items:center; gap:8px;">
                ${inviteUrl && isOwnerOrAdmin ? `
                  <button type="button" class="btn btn-secondary btn-sm" onclick="App.copyInviteUrl('${inviteUrl}')" style="font-size:11px; padding:5px 10px;">
                    📋 Linki Kopyala
                  </button>
                  <button type="button" class="btn btn-primary btn-sm" onclick="window.open('${inviteUrl}', '_blank'); App.showToast('Yeni sekmede açıldı!');" style="font-size:11px; padding:5px 10px;">
                    🚀 Aç & Katıl
                  </button>
                ` : ''}
                ${isOwnerOrAdmin ? `
                  <button type="button" class="btn btn-danger btn-sm" onclick="App.handleRevokeInvitation('${i.id}')" style="font-size:11px; padding:5px 10px;">
                    İptal Et
                  </button>
                ` : '<span style="font-size:11px; color:var(--text-muted);">🔒 Yönetici Yetkisi Gerekir</span>'}
              </div>
            </div>
            `;
          }).join('');
        }
      }
    } catch (err) {
      console.error('Şirket verisi yükleme hatası:', err);
    }
  },

  async handleSaveCompanyProfile(e) {
    e.preventDefault();
    if (!this.isOwnerOrAdmin()) {
      this.showToast('Şirket profilini güncelleme yetkisi yalnızca Şirket Sahibi ve Yöneticilere aittir.', 'error');
      return;
    }
    const data = {
      name: document.getElementById('comp-name-input').value,
      phone: document.getElementById('comp-phone-input').value,
      email: document.getElementById('comp-email-input').value,
      city: document.getElementById('comp-city-input').value,
      taxNumber: document.getElementById('comp-tax-input').value,
      address: document.getElementById('comp-address-input').value
    };

    try {
      await API.updateCurrentCompany(data);
      this.showToast('Şirket bilgileri güncellendi ✓');
      await this.checkAuthSession();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  copyInviteUrl(url) {
    if (!url) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(() => {
          this.showToast('📋 Davet bağlantısı panoya kopyalandı! Arkadaşınıza iletebilirsiniz.');
        }).catch(() => {
          this.legacyCopyText(url);
        });
      } else {
        this.legacyCopyText(url);
      }
    } catch (_) {
      this.legacyCopyText(url);
    }
  },

  legacyCopyText(text) {
    const el = document.createElement('textarea');
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    this.showToast('📋 Davet bağlantısı kopyalandı!');
  },

  openInviteMemberModal() {
    const modal = document.getElementById('invite-member-modal');
    if (!modal) return;
    const resultArea = document.getElementById('invite-result-area');
    const formFields = document.getElementById('invite-form-fields');
    const btn = document.getElementById('btn-create-invite');
    if (resultArea) resultArea.style.display = 'none';
    if (formFields) formFields.style.display = 'block';
    if (btn) {
      btn.style.display = 'inline-block';
      btn.disabled = false;
      btn.innerHTML = 'Davet Bağlantısı Oluştur';
    }
    const emailInput = document.getElementById('invite-email');
    if (emailInput) emailInput.value = '';
    modal.classList.add('open');
  },

  async handleSendInvitation(e) {
    e.preventDefault();
    const email = document.getElementById('invite-email')?.value.trim();
    const role = document.getElementById('invite-role')?.value || 'agent';
    const btn = document.getElementById('btn-create-invite');

    if (!email) {
      this.showToast('Lütfen personelin e-posta adresini girin.', 'error');
      return;
    }

    try {
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span>Bağlantı Hazırlanıyor...</span>';
      }

      const res = await API.inviteMember(email, role);
      this.showToast('🎉 Davet bağlantısı başarıyla oluşturuldu!', 'success');

      const fullLink = `${window.location.origin}/?inviteToken=${res.inviteToken || res.invitation?.token || ''}`;

      this.copyInviteUrl(fullLink);

      const resultArea = document.getElementById('invite-result-area');
      const formFields = document.getElementById('invite-form-fields');
      const linkInput = document.getElementById('invite-generated-link');
      const descEl = document.getElementById('invite-result-desc');

      if (descEl) {
        descEl.innerHTML = `<strong style="color:var(--text-primary);">${email}</strong> için 7 gün geçerli davet oluşturuldu.`;
      }

      if (linkInput) {
        linkInput.value = fullLink;
      }

      if (formFields) formFields.style.display = 'none';
      if (resultArea) resultArea.style.display = 'block';
      if (btn) btn.style.display = 'none';

      await this.renderCompany();
    } catch (err) {
      console.error('Invite error:', err);
      this.showToast('Davet oluşturulamadı: ' + err.message, 'error');
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = 'Davet Bağlantısı Oluştur';
      }
    }
  },

  async handleRevokeInvitation(id) {
    if (!confirm('Bu daveti iptal etmek istediğinize emin misiniz?')) return;
    try {
      await API.revokeInvitation(id);
      this.showToast('Davet iptal edildi');
      this.renderCompany();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  async openAcceptInvitationModal(token) {
    if (!token) return;
    const modal = document.getElementById('accept-invite-modal');
    if (!modal) return;

    // Diğer tüm açık modalları kapat
    document.querySelectorAll('.modal-backdrop.open').forEach(m => {
      if (m.id !== 'accept-invite-modal') m.classList.remove('open');
    });

    const tokenInput = document.getElementById('accept-invite-token');
    if (tokenInput) tokenInput.value = token;

    modal.classList.add('open');
    this.showToast('🏢 Ekip davet bağlantısı algılandı, lütfen hesabınızı oluşturun.', 'success');

    // Davet ayrıntılarını sunucudan sorgula
    try {
      const info = await API.getInvitationInfo(token);
      if (info && info.success) {
        const titleEl = document.getElementById('accept-invite-company-title');
        const subEl = document.getElementById('accept-invite-subtitle');
        const boxComp = document.getElementById('accept-invite-box-company');
        const boxEmail = document.getElementById('accept-invite-box-email');
        const roleLabel = info.role === 'admin' ? 'Şirket Yöneticisi' : 'Gayrimenkul Danışmanı';

        if (titleEl) titleEl.innerText = `${info.companyName} Ekibine Katılın`;
        if (subEl) subEl.innerText = `${info.companyCity ? info.companyCity + ' • ' : ''}Atanan Rol: ${roleLabel}`;
        if (boxComp) boxComp.innerHTML = `🎉 <strong>${info.companyName}</strong> ekibine davet edildiniz!`;
        if (boxEmail) boxEmail.innerHTML = `Davet edilen e-posta: <strong style="color:var(--text-primary);">${info.email}</strong><br>Rolünüz: <strong>${roleLabel}</strong>. Hesabınızı oluşturup hemen çalışmaya başlayın.`;
      }
    } catch (err) {
      console.warn('Davet bilgisi alınamadı:', err);
      const boxComp = document.getElementById('accept-invite-box-company');
      const boxEmail = document.getElementById('accept-invite-box-email');
      const infoBox = document.getElementById('accept-invite-info-box');
      if (infoBox) {
        infoBox.style.background = '#FEF2F2';
        infoBox.style.borderColor = '#FECACA';
      }
      if (boxComp) {
        boxComp.style.color = 'var(--accent-rose)';
        boxComp.innerText = 'Geçersiz veya Süresi Dolmuş Davet';
      }
      if (boxEmail) {
        boxEmail.innerText = err.message || 'Bu davet bağlantısı geçersiz veya daha önce kullanılmış.';
      }
    }
  },

  async handleAcceptInvitationSubmit(e) {
    e.preventDefault();
    const token = document.getElementById('accept-invite-token').value;
    const fullName = document.getElementById('accept-invite-fullname').value.trim();
    const phone = document.getElementById('accept-invite-phone').value.trim();
    const password = document.getElementById('accept-invite-password').value;
    const btn = document.getElementById('btn-submit-accept-invite');

    if (!token || !fullName || !password) {
      this.showToast('Lütfen tüm zorunlu alanları doldurun.', 'error');
      return;
    }

    try {
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span>Hesap Kuruluyor...</span>';
      }

      const res = await API.acceptInvitation(token, fullName, password, phone);
      this.showToast(`Tebrikler! ${res.company ? res.company.name : 'Şirket'} ekibine katıldınız! 🎉`);
      document.getElementById('accept-invite-modal')?.classList.remove('open');

      // URL'deki inviteToken parametresini temizle
      if (typeof window !== 'undefined' && window.history && window.history.replaceState) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      if (res && res.user) {
        this.currentUser = res.user;
        this.currentCompany = res.company;
        this.memberships = res.memberships || [];
        this.updateAuthUI();
        this.showAppScreen();
      }

      await this.refreshAllData();
      this.showTab('dashboard');
    } catch (err) {
      console.error('Accept invite error:', err);
      this.showToast('Davet kabul edilemedi: ' + err.message, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span>Hesabımı Oluştur ve Katıl</span><span class="btn-arrow">➔</span>';
      }
    }
  },

  // ─── PAYLAŞIM MODALLARI ─────────────────────────────────────
  openSharePropertyModal(id) {
    const prop = this.properties.find(p => p.id === id);
    if (!prop) return;

    if (!this.isOwnerOrAdmin() && prop.canEditOrDelete === false) {
      this.showToast('Bu ilanın havuz paylaşımını yönetme yetkiniz bulunmuyor. Yalnızca şirket sahibi veya ilanı ekleyen danışman yönetebilir.', 'error');
      return;
    }

    document.getElementById('share-prop-id').value = id;
    document.getElementById('share-prop-title-text').innerText = `İlan: ${prop.title} (${this.formatPrice(prop.price)})`;

    const confirmBtn = document.getElementById('btn-confirm-share-prop');
    if (prop.shareStatus === 'shared_pool') {
      confirmBtn.innerText = 'Paylaşımı İptal Et (Özel Yap)';
      confirmBtn.className = 'btn btn-secondary';
    } else {
      confirmBtn.innerText = 'Ortak Havuzda Paylaş';
      confirmBtn.className = 'btn btn-primary';
    }

    document.getElementById('share-property-modal').classList.add('open');
  },

  async handleConfirmShareProperty(e) {
    e.preventDefault();
    const id = document.getElementById('share-prop-id').value;
    const prop = this.properties.find(p => p.id === id);
    if (!prop) return;

    const action = prop.shareStatus === 'shared_pool' ? 'revoke' : 'share';
    const split = document.getElementById('share-prop-split').value;

    try {
      const res = await API.shareProperty(id, { action, commissionSplit: split });
      this.showToast(res.message || 'İşlem tamamlandı');
      document.getElementById('share-property-modal').classList.remove('open');
      await this.refreshAllData();
      if (this.activeTab === 'properties') this.renderProperties();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  openShareCustomerModal(id) {
    const cust = this.customers.find(c => c.id === id);
    if (!cust) return;

    if (!this.isOwnerOrAdmin() && cust.canEditOrDelete === false) {
      this.showToast('Bu müşteri talebini havuza açma/kapatma yetkiniz bulunmuyor.', 'error');
      return;
    }

    document.getElementById('share-cust-id').value = id;
    document.getElementById('share-cust-name-text').innerText = `Müşteri: ${cust.name} (Bütçe: ${this.formatPrice(cust.totalBudget)})`;
    document.getElementById('share-customer-modal').classList.add('open');
  },

  async handleConfirmShareCustomer(e) {
    e.preventDefault();
    const id = document.getElementById('share-cust-id').value;
    const cust = this.customers.find(c => c.id === id);
    if (!cust) return;

    const action = cust.shareStatus === 'shared_pool' ? 'revoke' : 'share';
    const note = document.getElementById('share-cust-legal-note').value;

    try {
      const res = await API.shareCustomer(id, { action, legalBasisNote: note });
      this.showToast(res.message || 'İşlem tamamlandı');
      document.getElementById('share-customer-modal').classList.remove('open');
      await this.refreshAllData();
      if (this.activeTab === 'customers') this.renderCustomers();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  // ─── DEPARTMANLAR & ÇALIŞMA GRUPLARI YÖNETİMİ ───────────────
  populateDepartmentSelectors() {
    const advFilter = document.getElementById('adv-filter-department');
    if (advFilter) {
      const cur = this.filterState.department || '';
      advFilter.innerHTML = '<option value="">Tüm Departmanlar</option>' +
        this.departments.map(d => `<option value="${d.id}" ${cur === d.id ? 'selected' : ''}>${d.icon || '🏛️'} ${d.name}</option>`).join('');
    }

    const custFilter = document.getElementById('filter-cust-department');
    if (custFilter) {
      const cur = this.filterState.customerDepartment || '';
      custFilter.innerHTML = '<option value="">Tüm Departmanlar</option>' +
        this.departments.map(d => `<option value="${d.id}" ${cur === d.id ? 'selected' : ''}>${d.icon || '🏛️'} ${d.name}</option>`).join('');
    }

    const leaderSel = document.getElementById('dept-leader-select');
    if (leaderSel) {
      const cur = leaderSel.value || '';
      leaderSel.innerHTML = '<option value="">Lider Atanmadı (Opsiyonel)</option>' +
        (this.companyMembers || []).map(m => `<option value="${m.id}" ${cur === m.id ? 'selected' : ''}>${m.fullName} (${m.role === 'owner' ? 'Şirket Sahibi' : (m.role === 'admin' ? 'Yönetici' : 'Danışman')})</option>`).join('');
    }

    const quickDeptSel = document.getElementById('quick-dept-select');
    if (quickDeptSel) {
      const cur = quickDeptSel.value || '';
      quickDeptSel.innerHTML = '<option value="">Departmansız (Genel Portföy)</option>' +
        this.departments.map(d => `<option value="${d.id}" ${cur === d.id ? 'selected' : ''}>${d.icon || '🏛️'} ${d.name}</option>`).join('');
    }
  },

  openCreateDepartmentModal() {
    if (!this.isOwnerOrAdmin()) {
      this.showToast('Departman oluşturma yetkisi yalnızca Şirket Sahibi ve Yöneticilere aittir.', 'error');
      return;
    }
    const modal = document.getElementById('modal-department');
    if (!modal) return;
    document.querySelectorAll('.modal-backdrop').forEach(b => b.classList.remove('open'));

    document.getElementById('modal-department-title').innerHTML = '<span>🏛️</span> Yeni Departman Oluştur';
    document.getElementById('dept-edit-id').value = '';
    document.getElementById('dept-name-input').value = '';
    document.getElementById('dept-icon-input').value = '🏛️';
    document.getElementById('dept-color-input').value = '#10b981';
    document.getElementById('dept-color-picker').value = '#10b981';
    document.getElementById('dept-desc-input').value = '';
    document.getElementById('dept-crit-focustype').value = '';
    document.getElementById('dept-crit-region').value = '';
    document.getElementById('dept-crit-target').value = '';
    document.getElementById('dept-crit-split').value = '50/50';

    this.populateDepartmentSelectors();
    const leaderSel = document.getElementById('dept-leader-select');
    if (leaderSel) leaderSel.value = '';

    modal.classList.add('open');
  },

  openEditDepartmentModal(id) {
    if (!this.isOwnerOrAdmin()) {
      this.showToast('Departman düzenleme yetkisi yalnızca Şirket Sahibi ve Yöneticilere aittir.', 'error');
      return;
    }
    const dept = this.departments.find(d => d.id === id);
    if (!dept) return;

    const modal = document.getElementById('modal-department');
    if (!modal) return;
    document.querySelectorAll('.modal-backdrop').forEach(b => b.classList.remove('open'));

    this.populateDepartmentSelectors();

    document.getElementById('modal-department-title').innerHTML = `<span>✏️</span> Departman Düzenle: ${dept.name}`;
    document.getElementById('dept-edit-id').value = dept.id;
    document.getElementById('dept-name-input').value = dept.name || '';
    document.getElementById('dept-icon-input').value = dept.icon || '🏛️';
    document.getElementById('dept-color-input').value = dept.color || '#10b981';
    document.getElementById('dept-color-picker').value = dept.color || '#10b981';
    document.getElementById('dept-desc-input').value = dept.description || '';

    const crit = dept.customCriteria || {};
    document.getElementById('dept-crit-focustype').value = crit.focusType || '';
    document.getElementById('dept-crit-region').value = crit.region || '';
    document.getElementById('dept-crit-target').value = crit.targetMonthlyVolume || '';
    document.getElementById('dept-crit-split').value = crit.defaultSplit || '50/50';

    const leaderSel = document.getElementById('dept-leader-select');
    if (leaderSel) {
      leaderSel.value = dept.leaderUserId || (dept.leader ? dept.leader.id : '');
    }

    modal.classList.add('open');
  },

  setDeptIcon(icon) {
    const input = document.getElementById('dept-icon-input');
    if (input) input.value = icon;
  },

  setDeptColor(color) {
    const pick = document.getElementById('dept-color-picker');
    const input = document.getElementById('dept-color-input');
    if (pick) pick.value = color;
    if (input) input.value = color;
  },

  async handleSaveDepartment(e) {
    e.preventDefault();
    if (!this.isOwnerOrAdmin()) {
      this.showToast('Bu işlemi gerçekleştirme yetkiniz bulunmuyor.', 'error');
      return;
    }

    const editId = document.getElementById('dept-edit-id').value;
    const name = document.getElementById('dept-name-input').value.trim();
    const icon = document.getElementById('dept-icon-input').value.trim() || '🏛️';
    const color = document.getElementById('dept-color-input').value || '#10b981';
    const leaderUserId = document.getElementById('dept-leader-select').value || null;
    const description = document.getElementById('dept-desc-input').value.trim();

    const customCriteria = {
      focusType: document.getElementById('dept-crit-focustype').value.trim(),
      region: document.getElementById('dept-crit-region').value.trim(),
      targetMonthlyVolume: document.getElementById('dept-crit-target').value.trim(),
      defaultSplit: document.getElementById('dept-crit-split').value.trim()
    };

    if (!name) {
      this.showToast('Lütfen departman adını girin.', 'error');
      return;
    }

    const payload = {
      name,
      icon,
      color,
      leaderUserId,
      description,
      customCriteria
    };

    try {
      if (editId) {
        await API.updateDepartment(editId, payload);
        this.showToast(`"${name}" departmanı başarıyla güncellendi ✓`);
      } else {
        await API.createDepartment(payload);
        this.showToast(`🎉 "${name}" departmanı başarıyla oluşturuldu!`);
      }
      document.getElementById('modal-department')?.classList.remove('open');
      await this.refreshAllData();
      await this.renderCompany();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  async handleDeleteDepartment(id) {
    if (!this.isOwnerOrAdmin()) {
      this.showToast('Departman silme yetkisi yalnızca Şirket Sahibi ve Yöneticilere aittir.', 'error');
      return;
    }
    const dept = this.departments.find(d => d.id === id);
    const deptName = dept ? dept.name : 'Bu departmanı';
    if (!confirm(`"${deptName}" departmanını silmek istediğinize emin misiniz? Atanmış danışmanların departman bağı kaldırılacaktır.`)) {
      return;
    }

    try {
      await API.deleteDepartment(id);
      this.showToast('Departman başarıyla silindi.');
      await this.refreshAllData();
      await this.renderCompany();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  openAssignDeptMembersModal(deptId) {
    if (!this.isOwnerOrAdmin()) {
      this.showToast('Danışman atama yetkisi yalnızca yöneticilere aittir.', 'error');
      return;
    }
    const dept = this.departments.find(d => d.id === deptId);
    if (!dept) return;

    const modal = document.getElementById('modal-assign-dept-members');
    if (!modal) return;
    document.querySelectorAll('.modal-backdrop').forEach(b => b.classList.remove('open'));

    document.getElementById('assign-dept-target-id').value = dept.id;
    document.getElementById('modal-assign-dept-title').innerHTML = `<span>👥</span> ${dept.icon || '🏛️'} ${dept.name} - Danışman Görevlendir`;
    document.getElementById('assign-dept-desc-text').innerText =
      `Bu departmana dahil etmek istediğiniz danışmanları işaretleyin. Seçilen personellerin portföy ve müşterileri bu departman çatısı altında takip edilecektir.`;

    const checklistEl = document.getElementById('assign-dept-members-checklist');
    const assignedSet = new Set(dept.assignedUserIds || []);

    const renderChecklist = (members) => {
      if (members && members.length > 0) {
        checklistEl.innerHTML = members.map(m => {
          const uId = m.userId || m.id;
          const isChecked = assignedSet.has(uId) || assignedSet.has(m.id) || m.departmentId === dept.id;
          const currentOtherDept = (m.departmentId && m.departmentId !== dept.id) ? this.departments.find(d => d.id === m.departmentId) : null;
          return `
            <label style="display:flex; align-items:center; justify-content:space-between; padding:10px 12px; background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:var(--radius-md); cursor:pointer;">
              <div style="display:flex; align-items:center; gap:10px;">
                <input type="checkbox" name="assign_dept_member" value="${uId}" ${isChecked ? 'checked' : ''} style="width:16px; height:16px; cursor:pointer;" />
                <div>
                  <div style="font-weight:700; font-size:13px; color:var(--text-primary);">${m.fullName}</div>
                  <div style="font-size:11px; color:var(--text-muted);">${m.email} • ${m.role === 'owner' ? 'Şirket Sahibi' : (m.role === 'admin' ? 'Yönetici' : 'Danışman')}</div>
                </div>
              </div>
              ${currentOtherDept ? `
                <span class="badge" style="font-size:10px; background:${currentOtherDept.color || '#0ea5e9'}22; color:${currentOtherDept.color || '#0ea5e9'}; border:1px solid ${currentOtherDept.color || '#0ea5e9'}44;">
                  ${currentOtherDept.icon || '🏛️'} ${currentOtherDept.name}
                </span>
              ` : ''}
            </label>
          `;
        }).join('');
      } else {
        checklistEl.innerHTML = '<div style="color:var(--text-muted); font-size:12px;">Şirkette kayıtlı üye bulunamadı.</div>';
      }
    };

    if (!this.companyMembers || this.companyMembers.length === 0) {
      API.getMembers().then(m => {
        this.companyMembers = m || [];
        renderChecklist(this.companyMembers);
      }).catch(() => renderChecklist([]));
    } else {
      renderChecklist(this.companyMembers);
    }

    modal.classList.add('open');
  },

  async handleSaveAssignDeptMembers(e) {
    e.preventDefault();
    if (!this.isOwnerOrAdmin()) {
      this.showToast('Bu işlemi gerçekleştirme yetkiniz bulunmuyor.', 'error');
      return;
    }
    const deptId = document.getElementById('assign-dept-target-id').value;
    const checkedBoxes = document.querySelectorAll('input[name="assign_dept_member"]:checked');
    const userIds = Array.from(checkedBoxes).map(cb => cb.value);

    try {
      await API.assignDepartmentMembers(deptId, userIds);
      this.showToast('Departman danışman atamaları başarıyla kaydedildi ✓');
      document.getElementById('modal-assign-dept-members')?.classList.remove('open');
      await this.refreshAllData();
      await this.renderCompany();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  openQuickMemberDeptModal(userId, memberName) {
    if (!this.isOwnerOrAdmin()) {
      this.showToast('Danışman departmanını değiştirme yetkisi yalnızca yöneticilere aittir.', 'error');
      return;
    }
    const modal = document.getElementById('modal-member-quick-dept');
    if (!modal) return;
    document.querySelectorAll('.modal-backdrop').forEach(b => b.classList.remove('open'));

    this.populateDepartmentSelectors();

    document.getElementById('quick-dept-member-id').value = userId;
    document.getElementById('quick-dept-member-name').innerHTML = `<span>👤</span> Danışman: <span style="color:var(--accent-cyan);">${memberName}</span>`;

    const member = (this.companyMembers || []).find(m => m.id === userId || m.userId === userId);
    const select = document.getElementById('quick-dept-select');
    if (select && member) {
      select.value = member.departmentId || '';
    }

    modal.classList.add('open');
  },

  async handleSaveMemberQuickDept(e) {
    e.preventDefault();
    if (!this.isOwnerOrAdmin()) {
      this.showToast('Bu işlemi gerçekleştirme yetkiniz bulunmuyor.', 'error');
      return;
    }
    const userId = document.getElementById('quick-dept-member-id').value;
    const deptId = document.getElementById('quick-dept-select').value;

    try {
      await API.updateMemberDepartment(userId, deptId);
      this.showToast('Danışmanın departmanı güncellendi ✓');
      document.getElementById('modal-member-quick-dept')?.classList.remove('open');
      await this.refreshAllData();
      await this.renderCompany();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }
};

window.App = App;

function bootApp() {
  App.init();

  // Demo buttons are handled cleanly via their inline onclick handlers with element feedback

  // Property Form Submit (Oda Sayısı: 1+1, 2+1, 3+1 vs.)
  const propForm = document.getElementById('property-form');
  if (propForm) {
    propForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('property-form-id').value;
      const data = {
        title: document.getElementById('prop-title').value,
        type: (() => {
          const custom = document.getElementById('prop-type-custom');
          const dist = document.getElementById('prop-type');
          if (custom && custom.style.display !== 'none' && custom.value.trim()) return custom.value.trim();
          return dist ? dist.value : 'daire';
        })(),
        status: document.getElementById('prop-status').value,
        price: Number(document.getElementById('prop-price').value),
        currency: document.getElementById('prop-currency').value,
        rooms: (() => {
          const custom = document.getElementById('prop-rooms-custom');
          const dist = document.getElementById('prop-rooms');
          if (custom && custom.style.display !== 'none' && custom.value.trim()) return custom.value.trim();
          return dist ? dist.value : '2+1';
        })(),
        heating: (() => {
          const custom = document.getElementById('prop-heating-custom');
          const dist = document.getElementById('prop-heating');
          if (custom && custom.style.display !== 'none' && custom.value.trim()) return custom.value.trim();
          return dist ? dist.value : '';
        })(),
        bathrooms: Number(document.getElementById('prop-bathrooms').value) || 1,
        netArea: Number(document.getElementById('prop-net-area').value),
        grossArea: Number(document.getElementById('prop-gross-area').value) || null,
        city: document.getElementById('prop-city').value || 'Van',
        district: (() => {
          const custom = document.getElementById('prop-district-custom');
          const dist = document.getElementById('prop-district');
          if (custom && custom.style.display !== 'none' && custom.value.trim()) return custom.value.trim();
          if (dist && dist.value === '__custom__' && custom && custom.value.trim()) return custom.value.trim();
          return dist ? dist.value : '';
        })(),
        neighborhood: (document.getElementById('prop-neighborhood').value || '').trim(),
        siteName: document.getElementById('prop-site').value,
        buildingAge: document.getElementById('prop-age').value ? Number(document.getElementById('prop-age').value) : null,
        floor: (() => {
          const custom = document.getElementById('prop-floor-custom');
          const numEl = document.getElementById('prop-floor');
          if (custom && custom.style.display !== 'none' && custom.value.trim()) {
            const parsed = parseInt(custom.value.trim());
            return isNaN(parsed) ? null : parsed;
          }
          return numEl && numEl.value ? Number(numEl.value) : null;
        })(),
        floorType: (() => {
          const custom = document.getElementById('prop-floor-custom');
          if (custom && custom.style.display !== 'none' && custom.value.trim()) {
            return custom.value.trim();
          }
          const numEl = document.getElementById('prop-floor');
          return numEl && numEl.value ? `${numEl.value}. Kat` : 'ara_kat';
        })(),
        tenantStatus: document.getElementById('prop-tenant-status')?.value || 'bos',
        deedStatus: document.getElementById('prop-deed-status')?.value || 'kat-mulkiyeti',
        estimatedRent: document.getElementById('prop-rent').value ? Number(document.getElementById('prop-rent').value) : null,
        monthlyDues: document.getElementById('prop-dues').value ? Number(document.getElementById('prop-dues').value) : null,
        contactName: document.getElementById('prop-contact-name').value,
        contactPhone: document.getElementById('prop-contact-phone').value,
        description: document.getElementById('prop-desc').value,
        hasParking: document.getElementById('prop-parking')?.checked ?? true,
        hasElevator: document.getElementById('prop-elevator')?.checked ?? true,
        hasBalcony: document.getElementById('prop-balcony')?.checked ?? true,
        creditEligible: document.getElementById('prop-credit')?.checked ?? true,
        isSwap: document.getElementById('prop-swap')?.checked ?? false,
        furnishedStatus: document.getElementById('prop-furnished')?.checked ? 'esyali' : 'esyasiz',
        features: Array.isArray(App.currentPropFeatures) ? [...App.currentPropFeatures] : [],
        priceClass: document.getElementById('prop-price-class').value,
        legalEncumbrance: document.getElementById('prop-legal-encumbrance')?.value || 'Temiz Tapu (Şerh/İpotek Yok)',
        priceChangeNote: document.getElementById('prop-price-change-note')?.value || '',
        readinessChecklist: {
          ownerAuthorized: Boolean(document.getElementById('prop-chk-owner')?.checked),
          pricingTermsAgreed: Boolean(document.getElementById('prop-chk-pricing')?.checked),
          deedVerified: Boolean(document.getElementById('prop-chk-deed')?.checked),
          mediaPrepared: Boolean(document.getElementById('prop-chk-media')?.checked),
          advisorTaskSet: Boolean(document.getElementById('prop-chk-advisor')?.checked)
        },
        images: document.getElementById('prop-image-url').value ? [document.getElementById('prop-image-url').value] : []
      };

      try {
        if (id) {
          await API.updateProperty(id, data);
          App.showToast('İlan güncellendi');
        } else {
          await API.createProperty(data);
          App.showToast('Yeni ilan başarıyla eklendi 🎉');
        }
        document.getElementById('property-form-modal').classList.remove('open');
        await App.refreshAllData();
        App.renderProperties();
      } catch (err) {
        App.showToast('Hata: ' + err.message, 'error');
      }
    });
  }

  // Customer Form Submit (Payidar CRM Müşteri Kartı)
  const custForm = document.getElementById('customer-form');
  if (custForm) {
    custForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('customer-form-id').value;
      const maxBud = Number(document.getElementById('cust-budget').value) || null;
      const minBud = document.getElementById('cust-min-budget')?.value ? Number(document.getElementById('cust-min-budget').value) : null;

      const data = {
        name: document.getElementById('cust-name').value,
        phone: document.getElementById('cust-phone').value,
        email: document.getElementById('cust-email').value,
        customerClass: document.getElementById('cust-class')?.value || 'B',
        pipelineStatus: document.getElementById('cust-pipeline-status')?.value || 'aktif',
        status: document.getElementById('cust-pipeline-status')?.value || 'aktif',
        leadSource: document.getElementById('cust-lead-source')?.value || 'telefon',
        minBudget: minBud,
        maxBudget: maxBud,
        totalBudget: maxBud,
        preferredRooms: document.getElementById('cust-rooms').value.split(',').map(s => s.trim()).filter(Boolean),
        downPayment: Number(document.getElementById('cust-downpayment').value) || null,
        purchaseTimeline: document.getElementById('cust-timeline').value,
        purpose: document.getElementById('cust-purpose').value,
        preferredDistricts: document.getElementById('cust-districts').value.split(',').map(s => s.trim()).filter(Boolean),
        minNetArea: Number(document.getElementById('cust-min-area').value) || null,
        maxBuildingAge: document.getElementById('cust-max-age').value ? Number(document.getElementById('cust-max-age').value) : null,
        kvkkConsent: document.getElementById('cust-kvkk')?.checked ?? true,
        contactPermission: document.getElementById('cust-contact-perm')?.checked ?? true,
        notes: document.getElementById('cust-notes').value
      };

      try {
        if (id) {
          await API.updateCustomer(id, data);
          App.showToast('Müşteri kaydı güncellendi');
        } else {
          await API.createCustomer(data);
          App.showToast('Yeni müşteri CRM sistemine eklendi 🎉');
        }
        document.getElementById('customer-form-modal').classList.remove('open');
        await App.refreshAllData();
        App.renderCustomers();
      } catch (err) {
        App.showToast('Hata: ' + err.message, 'error');
      }
    });
  }

  // Follow-up Form Submit
  const fuForm = document.getElementById('followup-form');
  if (fuForm) {
    fuForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {
        title: document.getElementById('fu-title').value,
        type: document.getElementById('fu-type').value,
        dueDate: new Date(document.getElementById('fu-date').value).toISOString(),
        notes: document.getElementById('fu-notes').value,
        relatedPropertyId: document.getElementById('fu-prop-id').value || null,
        relatedCustomerId: document.getElementById('fu-cust-id').value || null
      };

      try {
        await API.createFollowUp(data);
        App.showToast('Takip görevi başarıyla planlandı 🗓️');
        document.getElementById('followup-form-modal').classList.remove('open');
        await App.refreshAllData();
        if (App.activeTab === 'dashboard') App.renderDashboard();
        if (App.activeTab === 'followups') App.renderFollowUps();
      } catch (err) {
        App.showToast('Hata: ' + err.message, 'error');
      }
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootApp);
} else {
  bootApp();
}
