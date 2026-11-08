// ============================================================
// EMLAK TAKİP CRM - TÜRKİYE İL, İLÇE VE SEMT/MAHALLE VERİ BANKASI
// Özellikle Van İl ve 13 İlçesinin Tamamı + Mahalle Önerileri
// ============================================================

const LOCATION_DATA = {
  // Öne Çıkan İl: VAN (Tüm 13 İlçesi ve Popüler Mahalleleri)
  'Van': {
    districts: {
      'İpekyolu': [
        'Bahçıvan Mahallesi (Cumhuriyet / Maraş Cad.)',
        'Şerefiye Mahallesi',
        'Alipaşa Mahallesi',
        'Hafiziye Mahallesi',
        'Vali Mithat Bey Mahallesi',
        'Seyit Fehim Arvasi Mahallesi',
        'Halilağa Mahallesi',
        'Serhat Mahallesi',
        'Selimbey Mahallesi',
        'Buzhane Mahallesi',
        'Hacıbekir Mahallesi',
        'Karşıyaka Mahallesi',
        'Bostaniçi Mahallesi',
        'Esenler Mahallesi',
        'Yalı Mahallesi'
      ],
      'Tuşba': [
        'İskele Mahallesi (Sahil / Feribot)',
        'Akköprü Mahallesi',
        'Abdurrahman Gazi Mahallesi',
        'Altıntepe Mahallesi',
        'Kalecik Mahallesi (TOKİ)',
        'Beyüzümü Mahallesi',
        'Şemsibey Mahallesi',
        'Seyrantepe Mahallesi',
        'Yüzüncü Yıl Üniversitesi / Kampüs',
        'Bardakçı Mahallesi'
      ],
      'Edremit': [
        'Eminpaşa Mahallesi',
        'Süphan Mahallesi',
        'Eski Cami Mahallesi (Göl Kıyısı)',
        'Yeni Cami Mahallesi',
        'Şabaniye Mahallesi',
        'Erenkent Mahallesi (Yeni TOKİ)',
        'Esentepe Mahallesi',
        'Sahil Caddesi Kıyı Bandı',
        'Çiçekli Mahallesi',
        'Mülk Mahallesi'
      ],
      'Erciş': [
        'Vanyolu Mahallesi',
        'Camikebir Mahallesi',
        'Kışla Mahallesi',
        'Sahilkent Mahallesi',
        'Alkanat Mahallesi',
        'Latifiye Mahallesi',
        'Gölağzı Mahallesi',
        'Beyazıt Mahallesi',
        'Çelebibağı Mahallesi'
      ],
      'Başkale': [
        'Hafiziye Mahallesi',
        'Tepebaşı Mahallesi',
        'Yeni Mahalle',
        'Samandöken Mahallesi'
      ],
      'Çaldıran': [
        'Kışla Mahallesi',
        'Beyazıt Mahallesi',
        'Recep Tayyip Erdoğan Mahallesi'
      ],
      'Çatak': [
        'Cumhuriyet Mahallesi',
        'Adnan Menderes Mahallesi',
        'Bahçelievler Mahallesi'
      ],
      'Gevaş': [
        'Hişet Mahallesi',
        'Karşıyaka Mahallesi',
        'Pınarbaşı Mahallesi',
        'Akdamar İskelesi & Sahil',
        'Orta Mahalle'
      ],
      'Gürpınar': [
        'Koyunyatağı Mahallesi',
        'Değirmendüzü Mahallesi',
        'Çavuştepe Bölgesi'
      ],
      'Muradiye': [
        'Yavuzselim Mahallesi',
        'Fevzi Çakmak Mahallesi',
        'Kandahar Mahallesi',
        'Muradiye Şelalesi Çevresi'
      ],
      'Özalp': [
        'Cumhuriyet Mahallesi',
        'İstasyon Mahallesi',
        'Mahmudiye Mahallesi'
      ],
      'Saray': [
        'Atatürk Mahallesi',
        'Yamanyurt Mahallesi',
        'Kazımpaşa Mahallesi'
      ],
      'Bahçesaray': [
        'İslam Mahallesi',
        'Cevizlibelen Mahallesi',
        'Bağcılar Mahallesi'
      ]
    }
  },

  'İstanbul': {
    districts: {
      'Kadıköy': ['Caddebostan', 'Fenerbahçe', 'Suadiye', 'Moda / Caferağa', 'Göztepe', 'Bostancı', 'Kozyatağı', 'Acıbadem'],
      'Beşiktaş': ['Bebek', 'Etiler', 'Levent', 'Sinanpaşa', 'Ulus', 'Ortaköy', 'Abbasağa', 'Gayrettepe'],
      'Ataşehir': ['Batı Ataşehir', 'Barbaros', 'Atatürk Mah.', 'İçerenköy', 'Küçükbakkalköy', 'Brandium Bölgesi'],
      'Eyüpsultan': ['Göktürk', 'Kemerburgaz', 'Alibeyköy', 'Merkez', 'Yeşilpınar'],
      'Sarıyer': ['Tarabya', 'İstinye', 'Yeniköy', 'Maslak', 'Zekeriyaköy', 'Büyükdere'],
      'Şişli': ['Nişantaşı', 'Teşvikiye', 'Mecidiyeköy', 'Fulya', 'Bomonti', 'Halaskargazi'],
      'Üsküdar': ['Beylerbeyi', 'Kuzguncuk', 'Çengelköy', 'Kandilli', 'Altunizade'],
      'Bakırköy': ['Yeşilköy', 'Florya', 'Ataköy', 'Zuhuratbaba', 'Yeşilyurt'],
      'Maltepe': ['Bağlarbaşı', 'İdealtepe', 'Küçükyalı', 'Cevizli', 'Dragos Sahil'],
      'Beylikdüzü': ['Barış Mah.', 'Cumhuriyet', 'Yakuplu (Marina)', 'Adnan Kahveci'],
      'Başakşehir': ['Bahçeşehir 1. Kısım', 'Bahçeşehir 2. Kısım', 'Kayabaşı', 'Ziya Gökalp']
    }
  },

  'Ankara': {
    districts: {
      'Çankaya': ['Kızılay', 'Tunalı / Kavaklıdere', 'Gaziosmanpaşa', 'Ümitköy', 'Çayyolu', 'Bilkent', 'Oran', 'Yıldız'],
      'Keçiören': ['Etlik', 'Bağlum', 'Subayevleri', 'Kalaba', 'Aktepe'],
      'Yenimahalle': ['Batıkent', 'Demetevler', 'Çayyolu Bağlantısı', 'İvedik'],
      'Gölbaşı': ['İncek', 'Mogan Sahil', 'Hacılar', 'Karşıyaka'],
      'Etimesgut': ['Eryaman', 'Bağlıca', 'Elvankent', 'Göksu']
    }
  },

  'İzmir': {
    districts: {
      'Konak': ['Alsancak', 'Göztepe', 'Güzelyalı', 'Kordon', 'Kahramanlar'],
      'Karşıyaka': ['Bostanlı', 'Mavişehir', 'Alaybey', 'Aksoy', 'Bahçelievler'],
      'Bornova': ['Kazımdirik', 'Özkanlar', 'Evka-3', 'Erzene', 'Yeşilova'],
      'Urla': ['İskele', 'Kalabak', 'Zeytinalanı', 'Kekliktepe', 'Merkez'],
      'Çeşme': ['Alaçatı', 'Ilıca', 'Dalyan', 'Ayayorgi', 'Çiftlikköy']
    }
  },

  'Bursa': {
    districts: {
      'Nilüfer': ['Özlüce', 'Görükle', 'Ataevler', 'İhsaniye', 'Balat', 'Ertuğrul'],
      'Osmangazi': ['Çekirge', 'Heykel', 'Kükürtlü', 'Demirtaş', 'Panayır'],
      'Mudanya': ['Güzelyalı', 'Bademli', 'Burgaz', 'Kumyaka']
    }
  },

  'Antalya': {
    districts: {
      'Muratpaşa': ['Lara', 'Şirinyalı', 'Fener', 'Kaleiçi', 'Meltem'],
      'Konyaaltı': ['Liman', 'Hurma', 'Gürsu', 'Altınkum', 'Toros'],
      'Alanya': ['Mahmutlar', 'Oba', 'Tosmur', 'Kestel', 'Avsallar']
    }
  },

  'Diyarbakır': {
    districts: {
      'Kayapınar': ['Diclekent', '75 Metrelik Yol', 'Gaziler', 'Peyas'],
      'Yenişehir': ['Ofis', 'Sanayi', 'Kooperatifler'],
      'Bağlar': ['Bağcılar', 'Şeyh Şamil'],
      'Sur': ['Cevatpaşa', 'Dabanoğlu']
    }
  },

  'Gaziantep': {
    districts: {
      'Şehitkamil': ['İbrahimli', 'Batıkent', 'Güvenevler', 'Atatürk'],
      'Şahinbey': ['Karataş', 'Akkent', 'Yeditepe', 'Binbaşı Dündar Taşer']
    }
  },

  'Erzurum': {
    districts: {
      'Yakutiye': ['Cumhuriyet', 'Muratpaşa', 'Lalapaşa', 'Üniversite'],
      'Palandöken': ['Yenişehir', 'Yıldızkent', 'Harput'],
      'Aziziye': ['Ilıca', 'Dadaşkent']
    }
  },

  'Trabzon': {
    districts: {
      'Ortahisar': ['Meydan', 'Boztepe', 'Yalıncak', 'Beşirli', 'Kalkınma'],
      'Akçaabat': ['Söğütlü', 'Yıldızlı', 'Yaylacık'],
      'Yomra': ['Kaşüstü', 'Sancak']
    }
  }
};

// Tüm 81 İl Listesi (Alfabetik, Van En Başta)
const ALL_TURKEY_CITIES = [
  'Van',
  'İstanbul',
  'Ankara',
  'İzmir',
  'Bursa',
  'Antalya',
  'Adana',
  'Adıyaman',
  'Afyonkarahisar',
  'Ağrı',
  'Aksaray',
  'Amasya',
  'Ardahan',
  'Artvin',
  'Aydın',
  'Balıkesir',
  'Bartın',
  'Batman',
  'Bayburt',
  'Bilecik',
  'Bingöl',
  'Bitlis',
  'Bolu',
  'Burdur',
  'Çanakkale',
  'Çankırı',
  'Çorum',
  'Denizli',
  'Diyarbakır',
  'Düzce',
  'Edirne',
  'Elazığ',
  'Erzincan',
  'Erzurum',
  'Eskişehir',
  'Gaziantep',
  'Giresun',
  'Gümüşhane',
  'Hakkari',
  'Hatay',
  'Iğdır',
  'Isparta',
  'Kahramanmaraş',
  'Karabük',
  'Karaman',
  'Kars',
  'Kastamonu',
  'Kayseri',
  'Kırıkkale',
  'Kırklareli',
  'Kırşehir',
  'Kilis',
  'Kocaeli',
  'Konya',
  'Kütahya',
  'Malatya',
  'Manisa',
  'Mardin',
  'Mersin',
  'Muğla',
  'Muş',
  'Nevşehir',
  'Niğde',
  'Ordu',
  'Osmaniye',
  'Rize',
  'Sakarya',
  'Samsun',
  'Siirt',
  'Sinop',
  'Sivas',
  'Şanlıurfa',
  'Şırnak',
  'Tekirdağ',
  'Tokat',
  'Trabzon',
  'Tunceli',
  'Uşak',
  'Yalova',
  'Yozgat',
  'Zonguldak'
];

// ─── Yardımcı Fonksiyonlar ───────────────────────────────────
const Locations = {
  // Tüm şehirleri getir (Van en başta)
  getCities() {
    return ALL_TURKEY_CITIES;
  },

  // Seçilen ile göre ilçeleri getir
  getDistricts(cityName) {
    if (!cityName) return [];
    const city = String(cityName).trim();
    // Case-insensitive eşleşme
    const key = Object.keys(LOCATION_DATA).find(k => k.toLowerCase() === city.toLowerCase());
    if (key && LOCATION_DATA[key].districts) {
      return Object.keys(LOCATION_DATA[key].districts);
    }
    // Van kontrolü özel
    if (city.toLowerCase() === 'van') {
      return Object.keys(LOCATION_DATA['Van'].districts);
    }
    return [];
  },

  // Seçilen il ve ilçeye göre önerilen mahalleleri getir (Manuel girişi engellemez, öneri sunar)
  getNeighborhoods(cityName, districtName) {
    if (!cityName || !districtName) return [];
    const cityKey = Object.keys(LOCATION_DATA).find(k => k.toLowerCase() === String(cityName).trim().toLowerCase());
    if (!cityKey) return [];

    const districts = LOCATION_DATA[cityKey].districts;
    const distKey = Object.keys(districts).find(d => d.toLowerCase() === String(districtName).trim().toLowerCase());
    if (!distKey) return [];

    return districts[distKey] || [];
  },

  // İl Seçim Dropdown'ını doldur
  populateCitySelect(selectEl, selectedCity = '', includeAllOption = true, allLabel = 'İl (Tümü)') {
    if (!selectEl) return;
    let html = '';
    if (includeAllOption) {
      html += `<option value="">${allLabel}</option>`;
    }
    
    // Van en başta özel rozetle
    const isVanSelected = selectedCity && selectedCity.toLowerCase() === 'van';
    html += `<option value="Van" ${isVanSelected ? 'selected' : ''}>⭐ Van (Tüm İlçeler)</option>`;

    // Diğer popüler ve alfabetik iller
    ALL_TURKEY_CITIES.forEach(c => {
      if (c === 'Van') return;
      const isSel = selectedCity && selectedCity.toLowerCase() === c.toLowerCase();
      html += `<option value="${c}" ${isSel ? 'selected' : ''}>${c}</option>`;
    });

    selectEl.innerHTML = html;
  },

  // İlçe Seçim Dropdown'ını seçilen ile göre doldur
  populateDistrictSelect(selectEl, cityName, selectedDistrict = '', includeAllOption = true, allLabel = 'İlçe (Tümü)') {
    if (!selectEl) return;
    const districts = this.getDistricts(cityName);

    let html = '';
    if (includeAllOption) {
      html += `<option value="">${allLabel}</option>`;
    }

    if (districts.length > 0) {
      districts.forEach(d => {
        const isSel = selectedDistrict && selectedDistrict.toLowerCase() === d.toLowerCase();
        html += `<option value="${d}" ${isSel ? 'selected' : ''}>${d}</option>`;
      });
      html += `<option value="__custom__">✏️ Diğer (Manuel İlçe)...</option>`;
    } else {
      if (!includeAllOption) {
        html += `<option value="">İlçe Seçin veya Manuel Yazın</option>`;
      }
      html += `<option value="__custom__">✏️ Manuel İlçe Yaz...</option>`;
    }

    selectEl.innerHTML = html;
  },

  // Mahalle Datalist'ini doldur (Kullanıcı manuel yazabilir, datalist otomatik tamamlama sunar)
  populateNeighborhoodDatalist(datalistEl, cityName, districtName) {
    if (!datalistEl) return;
    const hoods = this.getNeighborhoods(cityName, districtName);
    datalistEl.innerHTML = hoods.map(h => `<option value="${h}"></option>`).join('');
  },

  // Hızlı Mahalle Rozetleri (Chips) Oluştur - Tıklayınca manuel alana otomatik doldurur
  renderQuickChips(containerEl, targetInputEl, cityName, districtName) {
    if (!containerEl || !targetInputEl) return;
    const hoods = this.getNeighborhoods(cityName, districtName);

    if (hoods.length === 0) {
      containerEl.innerHTML = `
        <span style="font-size:11px; color:var(--text-muted); font-style:italic;">
          ✍️ Bu ilçe için serbestçe mahalle / cadde / sokak adını manuel yazabilirsiniz.
        </span>
      `;
      return;
    }

    containerEl.innerHTML = `
      <div style="width:100%; font-size:11px; color:var(--text-muted); margin-bottom:4px; display:flex; justify-content:space-between; align-items:center;">
        <span>💡 Hızlı Öneriler (Tıkla ve Ekle veya Kendin Manuel Yaz):</span>
        <span style="color:var(--accent-emerald); font-weight:600;">Manuel Giriş Açık ✓</span>
      </div>
      <div style="display:flex; flex-wrap:wrap; gap:4px; max-height:90px; overflow-y:auto; padding:2px;">
        ${hoods.slice(0, 10).map(h => {
          // Temiz isim
          const cleanName = h.split('(')[0].trim();
          return `
            <button type="button" class="neighborhood-quick-chip" 
              onclick="Locations.applyQuickNeighborhood('${targetInputEl.id}', '${cleanName.replace(/'/g, "\\'")}')" 
              title="Mahalle alanına ekle: ${cleanName}">
              + ${cleanName}
            </button>
          `;
        }).join('')}
      </div>
    `;
  },

  applyQuickNeighborhood(inputId, val) {
    const el = document.getElementById(inputId);
    if (!el) return;
    el.value = val;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.focus();
  }
};

window.Locations = Locations;
