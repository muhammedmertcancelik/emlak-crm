# 🏠 Payidar Emlak Takip CRM v2.0 (Çok Şirketli SaaS & B2B Havuz)

> **PC, Tablet ve Mobil Cihazlardan Kesintisiz Çevrimiçi (Online) Çok Şirketli Gayrimenkul, Müşteri CRM, B2B Ortak Ağ ve Ekip Yönetim Platformu**
> *Tasarım Konsepti: PURE WHITE – MINIMAL CORPORATE (Apple, Linear ve Microsoft Fluent 365 Tasarım Dili)*

---

## 🌟 Öne Çıkan Sistem Yetenekleri

### 1. 🎨 Pure White – Minimal Corporate Tasarım Sistemi & Sayfalar Popup Launcher
* **Minimalist & Profesyonel Light UI:** Beyaz arka plan (`#FFFFFF`), hafif gri zemin (`#F7F8FA`), 1px hairlines kenarlıklar (`#E8EAED`), Inter font ailesi ve 6-8px köşe yuvarlaklığı.
* **Apple & Microsoft Fluent 365 Stili Sayfalar Launcher:** Ekranı daraltan sabit sol menü kaldırıldı; üst barda tek tıkla veya klavyeden `M` tuşu ile açılan şık **Sayfalar & Modüller Popup Vitrini** entegre edildi.
* **Filtre Çekmecesi (Slide-Over Drawer):** Çift kenar çubuğu karmaşası ortadan kaldırılarak ilan filtre paneli modern bir çekmeceye dönüştürüldü; gayrimenkul vitrini 3-4 sütunlu geniş ve ferah bir düzene kavuştu.

### 2. 🏢 Çok Şirketli (Multi-Tenant) SaaS Mimarisi
* **İzole Şirket Alanları:** Her emlak ofisi kendi bağımsız portföyü, danışmanları, müşteri kayıtları ve ajandasıyla tam veri izolasyonu (BOLA / IDOR korumalı) altında çalışır.
* **Şirket & Ofis Yönetimi:** Ofis logosu, ticaret unvanı, vergi no, yetkili iletişim bilgileri ve ofis ayarları.
* **Çoklu Şirket Değiştirici (Company Switcher):** Birden fazla ofiste veya şubede ortaklığı olan kullanıcılar tek tıkla şirketler arasında yetkileriyle geçiş yapabilir.

### 3. 🌐 Kurumsal Karşılama (Landing Page) & Giriş Portalı
* **Vitrin ve Tanıtım Ekranı:** Platformun tüm özelliklerini, B2B ortak ağ mantığını ve KVKK altyapısını tanıtan modern, sade kurumsal tanıtım arayüzü.
* **Kurumsal Kayıt & Giriş Portalı:** Yeni emlak ofisleri için anında şirket kurulumu ve parola korumalı giriş.
* **1-Tıkla Demo Girişleri:** Sistemi anında test edebilmeniz için hazır örnek emlak ofisleri:
  * 🏢 **Boğaziçi Gayrimenkul A.Ş.** (İstanbul - Sarıyer / Beşiktaş)
  * 🏢 **Anadolu Emlak Ltd.** (Ankara - Çankaya)
  * 🏢 **Örnek Emlak Gayrimenkul**

### 4. 👥 Personel & Danışman Davet Sistemi (Onboarding)
* **Kriptografik Tek Kullanımlık Bağlantı (Single-Use Token):** 32-byte rastgele SHA-256 hashli güvenli davet bağlantıları.
* **Rol Bazlı Yetkilendirme:** 
  * **Gayrimenkul Danışmanı:** Sadece kendi portföyünü, müşterilerini ve ortak havuzu yönetir.
  * **Şirket Yöneticisi:** Tüm şirket portföyünü, maliyetleri ve personel davetlerini yönetir.
* **Anında Test ve Pano Entegrasyonu:** Tek tıkla davet linki kopyalama ve yeni sekmede doğrudan test etme.
* **Şık Karşılama Ekranı (`?inviteToken=...`):** Davet edilen personelin hangi şirkete, hangi role ve hangi e-posta ile davet edildiğini doğrulayan özel katılım modalı.
* **Yönetici Denetimi:** Bekleyen davetleri anlık takip etme ve istenildiğinde tek tıkla iptal etme.

### 5. 🤝 B2B Ortak Portföy & Talep Havuzu (Inter-Agency MLS)
* **İlan Paylaşımı:** Ofisler kendi portföylerindeki gayrimenkulleri dilediklerinde platformdaki diğer emlak şirketleriyle ortak satışa açabilir (`%50-%50`, `%60-%40` komisyon paylaşımı seçeneği).
* **Anında Geri Çekme (Instant Revocation):** Ortak havuza açılan bir ilan tek tıkla özel (`private`) statüye alınarak diğer ofislerin erişiminden derhal çıkarılır.
* **KVKK Uyumlu Müşteri Maskelemesi:** Müşteri talep kriterleri B2B havuza açıldığında ad-soyad (örn: `A**** Y****`), telefon, e-posta ve özel notlar **sıfır veri sızıntısıyla otomatik maskelenir**.

### 6. 🔍 Detaylı Filtreleme & Portal Düzeni
* **Adres Hiyerarşisi:** İl, İlçe, Mahalle / Semt (Van ve Türkiye genel illerine tam konum desteği).
* **Fiyat & Para Birimi:** TL (₺), USD ($), EUR (€), GBP (£) + Min / Maks fiyat aralıkları.
* **Türk Emlak Standardı Oda Seçimi:** `1+0 (Stüdyo)`, `1+1`, `2+0`, `2+1`, `2+2`, `3+1`, `3+2`, `4+1`, `4+2`, `5+1`, `6+` çoklu seçim kutucukları.
* **Detaylı Kriterler:** Kat, bina yaşı, otopark, asansör, balkon, site içi, krediye uygunluk, tapu durumu ve takas seçenekleri.
* **Canlı Filtreleme:** Sayfa yenilenmeden anında sonuç güncelleme ve aktif filtre etiketleri (Chips).

### 7. ✨ Akıllı Portföy & Müşteri Eşleştirme Motoru (AI Matching)
* **Müşteriye Göre Eşleştirme:** Alıcının bütçesi, bölge tercihi ve kriterlerine en uygun ilanları 0-100 puan aralığında listeler.
* **İlana Göre Eşleştirme:** Yeni eklenen bir gayrimenkul için hazır alıcıları anında bulur.
* **1-Tıkla WhatsApp Mesajı:** Eşleşen portföyü müşteriye WhatsApp şablonuyla anında gönderme.

### 8. 📊 Yatırım & Finansal Getiri Analizörü
* Brüt Kira Getirisi (%)
* Net m² Satış Fiyatı (₺/m²)
* Basit Amortisman Süresi (Yıl)
* Aidat ve giderler düşülmüş Net Getiri Projeksiyonu

### 9. 🗓️ Takip & Randevu Ajandası (Follow-ups)
* Ziyaret / Yer Gösterme, Geri Arama, Portföy Çekimi ve Sözleşme Görüşmeleri.
* Gecikmiş görev alarmları ve bugünün randevuları.
* Görev tamamlama ve tarih bazlı filtreleme.

### 10. 📱 PC, Tablet ve Mobil Tam Uyum (Responsive & PWA)
* Bilgisayarda tam genişlikte ferah dashboard ve veri kartları görünümü.
* Mobilde parmak dostu alt navigasyon çubuğu (Bottom Navigation Bar) ve Sayfalar Popup Launcher butonu (▦).
* Mobil tarayıcıdan **"Ana Ekrana Ekle"** seçildiğinde yerel uygulama (PWA) deneyimi.

---

## 🚀 Başlatma ve Çalıştırma

### 1. Windows'ta Tek Tıkla Başlatma:
Klasördeki **`start.bat`** dosyasına çift tıklayın!

### 2. Terminalden Başlatma:
```bash
node server/index.js
```

### 3. Tarayıcınızda Açın:
* **Bilgisayardan:** [http://localhost:3000](http://localhost:3000)
* **Telefondan / Tabletten (Aynı Wi-Fi):** `http://<YEREL_IP_ADRESINIZ>:3000` *(Örn: http://192.168.0.140:3000)*

---

## 🛡️ Otomatik Güvenlik ve E2E Testleri

SaaS izolasyonu, KVKK maskelemesi, token güvenliği ve API entegrasyonu otomatik test paketleriyle doğrulanmıştır:
```bash
# Çok Şirketli SaaS Güvenlik ve İzolasyon Testleri (6/6 PASS)
npm test

# Uçtan Uca (E2E) Çok Şirketli API Entegrasyon Testleri (8/8 PASS)
node test/test_e2e_api.js
```

---

## 📡 REST API Uç Noktaları

| Metot | Uç Nokta | Yetki | Açıklama |
|---|---|---|---|
| `GET` | `/api/network-info` | Herkese Açık | Yerel IP ve mobil erişim adresleri |
| `POST` | `/api/auth/register` | Herkese Açık | Yeni emlak şirketi ve sahip hesabı oluşturur |
| `POST` | `/api/auth/login` | Herkese Açık | E-posta ve parola ile oturum açar |
| `POST` | `/api/auth/demo-login` | Herkese Açık | Test amaçlı örnek şirket oturumu açar |
| `GET` | `/api/auth/me` | Oturum | Mevcut oturum ve aktif şirket bilgilerini döner |
| `POST` | `/api/auth/switch-company` | Oturum | Kullanıcının şirketleri arasında geçiş yapar |
| `GET` | `/api/auth/invitation-info` | Herkese Açık | Davet bağlantısı geçerliliğini ve şirket adını doğrular |
| `POST` | `/api/auth/accept-invitation` | Herkese Açık | Davet bağlantısıyla personele hesap açar ve ekibe bağlar |
| `GET` | `/api/companies/current` | Oturum | Aktif şirketin profil detaylarını getirir |
| `PUT` | `/api/companies/current` | Yönetici | Şirket profil bilgilerini günceller |
| `GET` | `/api/companies/members` | Oturum | Şirketin kayıtlı personel listesini döner |
| `POST` | `/api/companies/invitations` | Yönetici | Yeni personele davet bağlantısı oluşturur |
| `GET` | `/api/companies/invitations` | Yönetici | Bekleyen davetleri listeler |
| `DELETE`| `/api/companies/invitations/:id`| Yönetici | Bekleyen davet bağlantısını iptal eder |
| `GET` | `/api/properties` | Oturum | İlanları filtreler (Kendi ofisi veya `?scope=pool`) |
| `POST` | `/api/properties` | Oturum | Yeni gayrimenkul ilanı kaydeder |
| `POST` | `/api/properties/:id/share` | Oturum | İlanı B2B ortak havuza açar veya geri çeker |
| `GET` | `/api/customers` | Oturum | Müşteri CRM kayıtlarını listeler |
| `POST` | `/api/customers` | Oturum | Yeni alıcı / yatırımcı kaydeder |
| `POST` | `/api/customers/:id/share` | Oturum | Alıcı talebini KVKK maskelemesiyle havuza açar |
| `GET` | `/api/matching` | Oturum | Müşteri veya ilan bazlı akıllı puanlama motoru |
| `GET` | `/api/followups` | Oturum | Ajanda ve randevu görevlerini listeler |
| `POST` | `/api/followups/:id/complete`| Oturum | Görevi tamamlandı olarak işaretler |
| `GET` | `/api/backup` | Yönetici | Şirkete ait tüm verileri JSON yedeği olarak indirir |
| `POST` | `/api/restore` | Yönetici | JSON yedeğini şirkete geri yükler |
