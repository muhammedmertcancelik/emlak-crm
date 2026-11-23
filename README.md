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


## Üç panel ve broker işlemleri

Broker paneli mevcut owner ve admin rollerini kullanır. Danışman agent, sekreter secretary rolündedir. Broker bütün ofis kayıtlarını görür ve atar. Danışman kendisine atanmış kayıtları görür ve düzenler. Sekreter ofis kayıtlarını görüntüler, kendi kayıtlarını ve görevlerini oluşturur. Muhasebe, satış, personel oluşturma ve ağ anahtarları broker yetkisi gerektirir.

Şirket ve ekip ekranındaki Danışman oluştur formunda kullanıcı adı, en az 12 karakterli parola, rol ve departman seçilir. Aynı danışman tek departmana bağlıdır. Departmanı eksik eski aktif çalışanlar sonraki veri kaydında Genel danışmanlık departmanına alınır. Broker departman ürün, işlem, oda ve bölge kriterlerini seçer. Kayıt ataması bu kriterlerle sunucuda kontrol edilir.

Satış bitirme tek formda portföy, müşteri, satışı bitiren danışman, alınan ücret, alınacak ücret, otomatik toplam ücret ve kredili işlem seçimini kaydeder. Alınan ücret, ofise fiilen giren net komisyondur. Toplam, alınan ve alınacak ücretin toplamıdır; sunucuda kuruş cinsinden hesaplanır. Satış bitirme muhasebe ekranında yer almaz.

Muhasebe, tahsil edilen net komisyonu esas alır. İşlemi bitiren danışmana %25, müşteri ve portföyü bulan danışmanlara ayrı ayrı %10, şirkete %40, işlemi bitiren departman dışındaki dört dağıtım departmanına %2'şer, Elanur ERİPEK'e %3 ve işletme rezervine %4 ayrılır. Müşteri veya portföy Emlak kaynaklıysa o katkı %5 olarak şirkete yazılır. Aynı danışmanın katkıları kullanıcı kimliği üzerinden birleştirilir. Müşteri kaynağı Talep kaynağı, portföy kaynağı Portföy kaynağı alanından gelir. Dağıtım departmanları ve sorumluları muhasebe organizasyonunda gösterilir; mevcut danışman hesaplarıyla işlem yapılır. Kayıtlı departmanın adı eşleşmiyorsa broker beş dağıtım departmanından işlemi tamamlayanı seçer.

Metindeki oranlar danışman kaynaklı işlemde %100, tek şirket kaynağında %95, iki şirket kaynağında %90 eder. Belirtilmeyen %5/%10 otomatik olarak kimseye aktarılmaz; dağıtılmamış olarak gösterilir ve dağıtım taslak kalır. %100 ve gerekli kaynak bilgileri tamamlanınca broker dağıtımı kesinleştirebilir. Kesinleşmiş dağıtımlar kaynak, oran, hak sahibi ve tutarları sabit bir kayıt olarak saklar; sonradan müşteri değişikliği eski hak edişi değiştirmez. Bir isteğin tekrarı mükerrer hak ediş oluşturmaz. Kuruş farkları en büyük kesir yöntemine göre dağıtılır; toplam hak ediş ve dağıtılmamış tutar net tahsilata eşittir. Hak ediş, ödeme yapıldığı anlamına gelmez. Eski işlemlerde net tahsilat bilinmiyorsa brüt gelir tahsilat kabul edilmez. Yeni kayıtların tahsilatı ve kesinleşen şirket payı muhasebede ayrı izlenir.

Fotoğraflar JPEG, PNG veya WebP, videolar MP4 ve ek belgeler PDF olabilir. Portföy başına 15 fotoğraf, dosya başına 50 MB sınırı uygulanır. Dosyalar data/uploads altında saklanır ve oturum/yetki kontrolüyle sunulur. Dosya yedeği alınırken bu klasör de dahil edilmelidir.

İl, ilçe ve mahalle seçenekleri TürkiyeAPI 2025 veri setinin yerel kopyasından gelir. Kaynak https://api.turkiyeapi.dev/v2/datasets/ ve https://github.com/ubeydeozdmr/turkiye-api. Bu kopya 22 Kasım 2026 tarihinde alınmıştır. Sahibinden ile canlı filtre veya ilan bağlantısı kurulmamıştır.

## Sunucular arası ortak ağ

Broker Ortak ağ API ekranından başka ofise özel anahtar üretir. Diğer ofis, anahtarı üreten sunucunun herkese açık HTTPS adresini ve anahtarı kaydeder. Her iki kurulumda bu uygulama sürümü çalışmalıdır. Bağlantı ekranı açıldığında paylaşılan aktif portföyler merkeze gönderilir ve ağ listesi alınır. Yalnızca shared_pool portföyleri yayınlanır. Mülk sahibi iletişimi, özel notlar ve dosyalar gönderilmez. Paylaşıma açılmış ve izinleri kayıtlı müşteri talepleri, isim ve kişisel iletişim bilgileri kaldırılarak bütçe ve tercih alanlarıyla iletilir.

Anahtarlar merkezde hash olarak saklanır ve broker tarafından iptal edilebilir. İstemci bağlantı anahtarı diskte AES-GCM ile şifrelenir. Kurulum anahtarı data/.network-key dosyasındadır ve Git dışında tutulur. Kurulum taşınırken bu dosya da korunmalıdır. Uzak ofislerin 24 saatten eski gönderileri gösterilmez, yenilenmeleri için bağlantı ekranı tekrar açılmalıdır. Gerçek HTTPS sunucuları arasında yayın testi ayrıca yapılmalıdır.
