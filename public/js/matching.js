// ============================================================
// EMLAK TAKİP CRM - AKILLI EŞLEŞTİRME MOTORU MODÜLÜ
// ============================================================

const MatchingEngine = {
  currentMode: 'customer', // 'customer' veya 'property'
  selectedId: null,

  init() {
    this.bindEvents();
  },

  bindEvents() {
    const modeTabs = document.querySelectorAll('.match-mode-tab');
    modeTabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        modeTabs.forEach(t => t.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.currentMode = e.currentTarget.dataset.mode;
        this.selectedId = null;
        this.loadSelectorList();
      });
    });

    const searchInput = document.getElementById('match-selector-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.filterSelectorList(e.target.value.toLowerCase());
      });
    }
  },

  async loadSelectorList(preselectId = null) {
    const listContainer = document.getElementById('match-selector-items');
    if (!listContainer) return;

    listContainer.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted);">Yükleniyor...</div>';

    try {
      if (this.currentMode === 'customer') {
        const customers = await API.getCustomers();
        if (customers.length === 0) {
          listContainer.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted); font-size:13px;">Kayıtlı müşteri bulunamadı. Lütfen önce müşteri ekleyin.</div>';
          return;
        }

        listContainer.innerHTML = customers.map(c => `
          <div class="selector-item ${preselectId === c.id ? 'active' : ''}" data-id="${c.id}" onclick="MatchingEngine.selectTarget('${c.id}')">
            <div class="selector-avatar">${c.name.charAt(0)}</div>
            <div class="selector-info">
              <div class="selector-title">${c.name}</div>
              <div class="selector-sub">Bütçe: ${App.formatPrice(c.totalBudget)} • ${c.preferredRooms && c.preferredRooms.length > 0 ? c.preferredRooms.join(', ') : (c.purpose === 'yatirim' ? 'Yatırım' : 'Oturum')}</div>
            </div>
            <span class="badge" style="${c.customerClass === 'A' ? 'background:#FEF2F2; color:#DC2626; border:1px solid #FECACA;' : (c.customerClass === 'C' ? 'background:#F3F4F6; color:#4B5563; border:1px solid #E5E7EB;' : (c.customerClass === 'D' ? 'background:#F8FAFC; color:#64748B; border:1px solid #E2E8F0;' : 'background:#FFFBEB; color:#D97706; border:1px solid #FDE68A;'))} font-weight:700;">${c.customerClass || 'B'}</span>
          </div>
        `).join('');

        const targetId = preselectId || customers[0].id;
        this.selectTarget(targetId);
      } else {
        const properties = await API.getProperties();
        if (properties.length === 0) {
          listContainer.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted); font-size:13px;">Portföyde ilan bulunamadı.</div>';
          return;
        }

        listContainer.innerHTML = properties.map(p => `
          <div class="selector-item ${preselectId === p.id ? 'active' : ''}" data-id="${p.id}" onclick="MatchingEngine.selectTarget('${p.id}')">
            <div class="selector-avatar">🏠</div>
            <div class="selector-info">
              <div class="selector-title">${p.title}</div>
              <div class="selector-sub">${p.district} • <strong style="color:var(--heading-color);">${p.rooms || '—'}</strong> • ${App.formatPrice(p.price)}</div>
            </div>
            <span class="badge ${p.status === 'satilik' ? 'badge-sale' : 'badge-rent'}">${p.status.toUpperCase()}</span>
          </div>
        `).join('');

        const targetId = preselectId || properties[0].id;
        this.selectTarget(targetId);
      }
    } catch (err) {
      listContainer.innerHTML = `<div style="color:var(--accent-rose); padding:10px;">Hata: ${err.message}</div>`;
    }
  },

  filterSelectorList(query) {
    const items = document.querySelectorAll('.selector-item');
    items.forEach(item => {
      const text = item.innerText.toLowerCase();
      item.style.display = text.includes(query) ? 'flex' : 'none';
    });
  },

  async selectTarget(id) {
    this.selectedId = id;

    document.querySelectorAll('.selector-item').forEach(el => {
      el.classList.toggle('active', el.dataset.id === id);
    });

    const resultsContainer = document.getElementById('match-results-container');
    if (!resultsContainer) return;

    resultsContainer.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);">Akıllı eşleştirme analiz ediliyor...</div>';

    try {
      const params = this.currentMode === 'customer' ? { customerId: id } : { propertyId: id };
      const response = await API.getMatching(params);

      this.renderResults(response);
    } catch (err) {
      resultsContainer.innerHTML = `<div style="color:var(--accent-rose); padding:20px;">Eşleştirme yapılamadı: ${err.message}</div>`;
    }
  },

  renderResults(data) {
    const container = document.getElementById('match-results-container');
    if (!container) return;

    const { target, matches } = data;
    const isCustomerTarget = target.type === 'customer';

    if (!matches || matches.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding:50px; background:var(--bg-card); border-radius:var(--radius-lg); border:1px solid var(--border-color);">
          <div style="font-size:36px; margin-bottom:12px;">🔍</div>
          <h4 style="font-size:16px; margin-bottom:6px;">Eşleşen sonuç bulunamadı</h4>
          <p style="color:var(--text-muted); font-size:13px;">Kriterlere uyan ilan veya müşteri portföyde mevcut değil.</p>
        </div>
      `;
      return;
    }

    const highMatches = matches.filter(m => m.verdict === 'high');
    const mediumMatches = matches.filter(m => m.verdict === 'medium');
    const eliminatedMatches = matches.filter(m => m.verdict === 'eliminated');

    let html = `
      <div style="background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:var(--radius-lg); padding:16px 20px; margin-bottom:16px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px;">
        <div>
          <div style="font-size:12px; color:var(--text-muted); text-transform:uppercase; font-weight:700;">Seçili ${isCustomerTarget ? 'Müşteri' : 'Portföy İlanı'}</div>
          <div style="font-size:17px; font-weight:800; color:var(--text-primary);">${target.data.name || target.data.title}</div>
        </div>
        <div style="display:flex; gap:12px; flex-wrap:wrap;">
          <span style="font-size:12px; color:var(--accent-emerald); font-weight:700;">🟢 ${highMatches.length} Yüksek Uyum</span>
          <span style="font-size:12px; color:var(--accent-gold); font-weight:700;">🟡 ${mediumMatches.length} Orta Uyum</span>
          <span style="font-size:12px; color:var(--accent-rose); font-weight:700;">🔴 ${eliminatedMatches.length} Elenen</span>
        </div>
      </div>
    `;

    html += matches.map(match => {
      const prop = match.property;
      const cust = match.customer;
      const score = match.score;
      const verdict = match.verdict;

      let scoreColor = 'var(--accent-emerald)';
      let verdictLabel = 'YÜKSEK UYUM';
      let badgeBg = '#E8F8F5';
      let badgeColor = '#16A085';
      let badgeBorder = '#A3E4D7';

      if (verdict === 'eliminated') {
        scoreColor = '#DC2626';
        verdictLabel = 'KRİTER DIŞI (ELENDİ)';
        badgeBg = '#FEF2F2';
        badgeColor = '#DC2626';
        badgeBorder = '#FECACA';
      } else if (verdict === 'medium') {
        scoreColor = '#D97706';
        verdictLabel = 'ORTA UYUM';
        badgeBg = '#FFFBEB';
        badgeColor = '#D97706';
        badgeBorder = '#FDE68A';
      } else if (verdict === 'low') {
        scoreColor = '#737B87';
        verdictLabel = 'DÜŞÜK UYUM';
        badgeBg = '#F3F4F6';
        badgeColor = '#4B5563';
        badgeBorder = '#E5E7EB';
      }

      const phone = isCustomerTarget ? cust.phone : cust.phone;
      const cleanPhone = phone ? phone.replace(/[^0-9]/g, '') : '';
      const waPhone = cleanPhone.startsWith('0') ? '9' + cleanPhone : cleanPhone;
      const roomInfo = prop.rooms ? `${prop.rooms}` : '';
      const waText = encodeURIComponent(
        `Merhaba ${cust.name}, aradığınız kriterlere son derece uygun bir portföyümüz bulunmaktadır: "${prop.title}" (${roomInfo}, ${prop.district}, ${App.formatPrice(prop.price)}). İlan detaylarını incelemek ve randevu oluşturmak ister misiniz?`
      );

      return `
        <div class="match-card" style="border-left: 3px solid ${scoreColor};">
          <div class="match-score-badge" style="--score-color: ${scoreColor};">
            <span class="match-score-num">${verdict === 'eliminated' ? '—' : score}</span>
            <span class="match-score-label">${verdict === 'eliminated' ? 'ELENDİ' : 'PUAN'}</span>
          </div>

          <div class="match-card-content">
            <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:6px; flex-wrap:wrap;">
              <h4 class="match-card-title">${isCustomerTarget ? prop.title : cust.name}</h4>
              <span class="badge" style="background:${badgeBg}; color:${badgeColor}; border:1px solid ${badgeBorder};">
                ${verdictLabel}
              </span>
            </div>

            <div style="font-size:13px; color:var(--text-secondary); margin-bottom:10px; display:flex; gap:16px; flex-wrap:wrap;">
              ${isCustomerTarget ? `
                <span>📍 ${prop.district}, ${prop.neighborhood || ''}</span>
                <span style="color:var(--heading-color); font-weight:700;">💰 ${App.formatPrice(prop.price)}</span>
                <span style="color:var(--heading-color); font-weight:700;">🛏️ ${prop.rooms || '—'}</span>
                <span>📐 ${prop.netArea} m² (${prop.bathrooms || 1} Banyo)</span>
              ` : `
                <span>📞 ${cust.phone || 'Telefon yok'}</span>
                <span style="color:var(--heading-color); font-weight:700;">Bütçe: ${App.formatPrice(cust.totalBudget)}</span>
                <span>İstenen Oda: <strong style="color:var(--heading-color);">${cust.preferredRooms && cust.preferredRooms.length > 0 ? cust.preferredRooms.join(', ') : 'Farketmez'}</strong></span>
                <span>Zaman: ${cust.purchaseTimeline || '—'}</span>
              `}
            </div>

            <div class="match-reasons-list">
              ${match.reasons.map(r => `
                <div class="match-reason ${r.type}">
                  <span>${r.type === 'positive' ? '✓' : (r.type === 'warning' ? '✕' : 'ℹ')}</span>
                  <strong>${r.text}</strong>
                  ${r.detail ? `<span style="opacity:0.8;">— ${r.detail}</span>` : ''}
                </div>
              `).join('')}
            </div>

            <div style="display:flex; gap:8px; margin-top:14px; flex-wrap:wrap;">
              ${phone ? `
                <a href="https://wa.me/${waPhone}?text=${waText}" target="_blank" class="btn btn-primary btn-sm" style="background:#25D366; color:white;">
                  💬 WhatsApp ile İletişime Geç
                </a>
                <a href="tel:${cleanPhone}" class="btn btn-secondary btn-sm">
                  📞 Ara
                </a>
              ` : ''}
              <button class="btn btn-secondary btn-sm" onclick="App.openCreateFollowUpModal('${prop.id}', '${cust.id}')">
                🗓️ Randevu / Takip Kur
              </button>
              ${isCustomerTarget ? `
                <button class="btn btn-secondary btn-sm" onclick="App.openPropertyDetail('${prop.id}')">
                  İlan Detayı ➔
                </button>
              ` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = html;
  }
};
