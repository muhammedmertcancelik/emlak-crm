# Payidar CRM

Gayrimenkul ofisleri için portföy, müşteri, ajanda, eşleştirme ve ekip yönetimi. Arayüz Türkçe, mobil ekranlara uyarlanmış ve harici CDN kullanmadan çalışır.

## Çalıştırma

Node.js 22 veya üzeri gerekir. Uygulamanın üretim bağımlılığı yoktur.

```powershell
npm start
```

Adres: http://localhost:3000. Windows'ta `start.bat` da kullanılabilir. Geliştirme sırasında otomatik sunucu yeniden başlatma için `npm run dev`.

Mevcut kullanıcılar kayıtlı e-posta ve gerçek parolalarıyla giriş yapar. Yeni ofis için giriş ekranındaki **Hesap oluşturun** kullanılır. Demo hesabına otomatik giriş ve tüm hesaplarda çalışan demo parola geçişleri kaldırıldı. Yeni parolalar en az 12 karakterdir. Eski hesapların gerçek parolaları değiştirilmedi. Bilinen örnek hesap parolalarını gerçek kullanım öncesinde **Hesap ve veriler → Parolayı değiştir** bölümünden yenileyin.

## Kullanım

1. **Genel bakış:** portföy, müşteri, günlük görevler ve satış aşamalarını görün.
2. **Portföy:** kayıt ekleyin; temel bilgileri doldurup isteğe bağlı özellikleri açılır bölümlerden ekleyin. Detaydan düzenleyin, favoriye alın, arşivleyin veya eşleştirme başlatın.
3. **Müşteriler:** iletişim, bütçe ve tercihleri kaydedin. Görüşme ilerledikçe aşamayı değiştirin. Veri işleme ve iletişim izinleri varsayılan olarak işaretlenmez.
4. **Ajanda:** tarih, sorumlu, müşteri ve portföy bağlantılarıyla görev oluşturun. Tamamlanan işleri kutucuğundan işaretleyin. Tarihler İstanbul saatine göredir.
5. **Eşleştirme:** müşteri veya portföy seçerek puanları ve gerekçelerini inceleyin. Dövizli portföyler TL bütçeyle kur dönüşümü yapılmadan puanlanmaz.
6. **Ortak ağ:** yöneticiler kayıt detayından paylaşım açar veya kapatır. Diğer ofisler müşteri telefonunu, e-postasını ve özel notlarını; portföy sahibinin iletişim bilgilerini ve açık adresini göremez.
7. **Şirket ve ekip:** üyeleri görüntüleyin, departmanları düzenleyin, yeni üye davet bağlantısı oluşturun. E-posta gönderimi yoktur; bağlantıyı kopyalayıp kendiniz paylaşın.
8. **Hesap ve veriler:** parola değiştirin ve yedek indirin. Geri yükleme yalnızca şirket sahibi içindir; önce otomatik sunucu yedeği alınır, ilişkiler yeni kimliklere taşınır ve paylaşımlar kapatılır.

Ekranın üstünden tüm kayıtlarda arayabilirsiniz. `/` kısayolu arama alanını açar. Uygulamadaki **Kullanım rehberi** aynı akışı kısa adımlarla anlatır.

## Yetkiler

| İşlem                               | Şirket sahibi | Yönetici | Danışman                       |
| ----------------------------------- | ------------- | -------- | ------------------------------ |
| Şirket kayıtlarını görüntüleme      | Evet          | Evet     | Evet                           |
| Portföy ve müşteri düzenleme        | Tümü          | Tümü     | Kendi ekledikleri              |
| Görev tamamlama / silme             | Tümü          | Tümü     | Kendisine atanan               |
| Şirket, departman ve davet yönetimi | Evet          | Evet     | Hayır                          |
| Ortak ağa paylaşım                  | Evet          | Evet     | Yetki verilmişse API üzerinden |
| Yedek indirme                       | Evet          | Evet     | Hayır                          |
| Yedeği geri yükleme                 | Evet          | Hayır    | Hayır                          |

## Teknik yapı

- `server/index.js`: HTTP uç noktaları ve iş kuralları.
- `server/auth.js`: scrypt parola doğrulama, imzalı oturumlar, çıkış ve parola değişiminde iptal.
- `server/security.js`: JSON doğrulama, istek sınırı, güvenlik başlıkları, kaynak kontrolü ve paylaşımda veri azaltma.
- `server/db.js`: atomik dosya yazımı, yazma kuyruğu ve şirket izolasyonu.
- `public/js/core.js`: ortak durum, güvenli gösterim yardımcıları ve API istemcisi.
- `public/js/views.js`: sayfa görünümleri.
- `public/js/forms.js`: kayıt ve detay pencereleri.
- `public/js/app.js`: olaylar ve gezinme.
- `public/css/style.css`: tasarım sistemi ve ekran boyutu uyarlamaları.

Önceki tekrarlı arayüz, kullanılmayan istemci modülleri ve sunucunun kullanmadığı Express, Multer, UUID, QRCode, CORS bağımlılıkları kaldırıldı. Çalışan kodda satır içi JavaScript kullanılmaz. Güvenlik başlıkları satır içi betikleri engeller. Oturum anahtarı tarayıcı depolamasında tutulmaz; HttpOnly ve SameSite=Strict çerez kullanılır. API yanıtları önbelleğe alınmaz.

## Veriler ve işletim sınırları

Mevcut kayıtlar `data/database.json` içindedir; yenileme bunları silmez veya örnek kayıtlarla değiştirmez. JSON depolama **tek Node.js süreci** içindir. Çok süreçli veya yüksek trafikli yayın öncesinde veritabanı, merkezi oturum iptali ve dağıtık hız sınırı gerekir. Mevcut sürüm bağımsız sızma testi ya da mevzuat uygunluk sertifikası değildir.

Varsayılan sunucu yalnızca `127.0.0.1` üzerinde dinler. Yerel ağ paylaşımı gerektiğinde `HOST=0.0.0.0` açıkça tanımlanmalıdır. İnternet yayını için HTTPS ters vekil, `NODE_ENV=production` ve en az 32 karakterlik rastgele `JWT_SECRET` gerekir. Üretim modunda çerezler Secure olur; HTTP üzerinde giriş çalışmaz. Anahtarı kaynak koduna veya depoya yazmayın. Geliştirmede anahtar her açılışta rastgele üretilir, önceki oturumlar kapanır.

| Değişken        | Varsayılan            | Açıklama                                |
| --------------- | --------------------- | --------------------------------------- |
| `PORT`          | `3000`                | HTTP portu                              |
| `HOST`          | `127.0.0.1`           | Dinleme adresi                          |
| `CRM_DATA_FILE` | `data/database.json`  | Ayrı veri dosyası; test izolasyonu için |
| `JWT_SECRET`    | Geliştirmede rastgele | Üretimde zorunlu, en az 32 karakter     |
| `NODE_ENV`      | Tanımsız              | Üretimde `production`                   |

Oturum süresi 8 saattir. Kimlik doğrulama uç noktalarında IP ve işlem başına 15 dakikada 30 istek sınırı vardır. JSON gövde sınırı 2 MB'dır. Geri yükleme öncesi kopyalar veri dosyasının yanındaki `backups/` klasöründe saklanır. Disk yedeklerinin erişim ve saklama sorumluluğu sunucu yöneticisindedir.

## Testler

```powershell
npm ci
npm test
```

Testler işletim sisteminin geçici klasöründe ayrı veri dosyaları kullanır. Ana veritabanının değişmediği ayrıca kontrol edilir. Paket; şirket izolasyonu, API iş akışları, oturum iptali, CSRF, parola atlatma, davet yarışı, alan yetkileri, ortak ağ veri maskelemesi, geri yükleme ve 12 DOM kullanıcı akışını kapsar. DOM testleri gerçek tarayıcıdaki piksel yerleşimini doğrulamaz.

Güvenlik yaklaşımı için: [OWASP oturum yönetimi](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) ve [REST güvenliği](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html).
