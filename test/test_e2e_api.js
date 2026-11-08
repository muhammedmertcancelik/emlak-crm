/**
 * ============================================================================
 * EMLAK TAKİP CRM - UÇTAN UCA (E2E) MULTI-TENANT API VE ENTEGRASYON TESTİ
 * ============================================================================
 */

const http = require('http');
const assert = require('assert');

const TEST_PORT = 3099;
process.env.PORT = TEST_PORT;

// Sunucu sürecini require ile başlat
require('../server/index.js');

function apiRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    if (options.token) {
      defaultHeaders['Authorization'] = `Bearer ${options.token}`;
    }
    if (options.companyId) {
      defaultHeaders['X-Company-Id'] = options.companyId;
    }

    const reqOptions = {
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: path,
      method: options.method || 'GET',
      headers: { ...defaultHeaders, ...options.headers }
    };

    const req = http.request(reqOptions, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (e) {
          json = data;
        }
        resolve({ status: res.statusCode, headers: res.headers, data: json });
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const e2eResults = [];

function recordTest(name, method, expected, actual, passed) {
  e2eResults.push({ name, method, expected, actual, status: passed ? 'PASS' : 'FAIL' });
  console.log(`[${passed ? 'PASS' : 'FAIL'}] ${name}`);
  console.log(`   Yöntem: ${method}`);
  console.log(`   Beklenen: ${expected}`);
  console.log(`   Gerçek: ${actual}\n`);
  assert.ok(passed, `${name} başarısız oldu!`);
}

async function runE2ETests() {
  console.log('================================================================');
  console.log(`🚀 UÇTAN UCA (E2E) ÇOK ŞİRKETLİ API ENTEGRASYON TESTLERİ (PORT: ${TEST_PORT})`);
  console.log('================================================================\n');

  // Sunucunun ayağa kalkması için kısa bir bekleme
  await wait(1000);

  try {
    const timestamp = Date.now();

    // 1. Şirket 1 (Anadolu Emlak) Kaydı
    const comp1Reg = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: {
        email: `anadolu_${timestamp}@test.com`,
        password: 'Password123!',
        fullName: 'Ahmet Anadolu',
        companyName: 'Anadolu Emlak Ltd.',
        city: 'İstanbul'
      }
    });
    recordTest(
      'E2E TEST 1: Yeni Şirket ve Sahip Kaydı (Şirket 1)',
      'POST /api/auth/register çağrıldı.',
      'Status: 201 ve JWT token üretilmeli',
      `Status: ${comp1Reg.status}, Token var mı: ${Boolean(comp1Reg.data && comp1Reg.data.token)}`,
      comp1Reg.status === 201 && Boolean(comp1Reg.data.token)
    );
    const token1 = comp1Reg.data.token;
    const comp1Id = comp1Reg.data.company.id;

    // 2. Şirket 2 (Boğaziçi Gayrimenkul) Kaydı
    const comp2Reg = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: {
        email: `bogazici_${timestamp}@test.com`,
        password: 'Password123!',
        fullName: 'Banu Boğaziçi',
        companyName: 'Boğaziçi Gayrimenkul A.Ş.',
        city: 'İstanbul'
      }
    });
    recordTest(
      'E2E TEST 2: İkinci Bağımsız Şirket Kaydı (Şirket 2)',
      'POST /api/auth/register ile ikinci şirket kuruldu.',
      'Status: 201 ve farklı şirket ID oluşmalı',
      `Status: ${comp2Reg.status}, Farklı ID: ${comp2Reg.data.company.id !== comp1Id}`,
      comp2Reg.status === 201 && comp2Reg.data.company.id !== comp1Id
    );
    const token2 = comp2Reg.data.token;
    const comp2Id = comp2Reg.data.company.id;

    // 3. Şirket 1 Özel İlan ve Özel Müşteri Ekler
    const createPropRes = await apiRequest('/api/properties', {
      method: 'POST',
      token: token1,
      body: {
        title: 'Anadolu Emlak Özel Boğaz Manzaralı Villa',
        price: 45000000,
        type: 'villa',
        status: 'satilik',
        rooms: '5+2',
        city: 'İstanbul',
        district: 'Sarıyer'
      }
    });
    const prop1 = createPropRes.data;

    const createCustRes = await apiRequest('/api/customers', {
      method: 'POST',
      token: token1,
      body: {
        name: 'Kemal Güven',
        phone: '0532 111 2233',
        email: 'kemal.guven@gizli.com',
        totalBudget: 50000000,
        preferredRooms: ['5+2'],
        preferredDistricts: ['Sarıyer'],
        purpose: 'oturum'
      }
    });
    const cust1 = createCustRes.data;

    recordTest(
      'E2E TEST 3: Şirket 1 Özel İlan ve Müşteri Oluşturma',
      'POST /api/properties ve POST /api/customers ile özel kayıtlar eklendi.',
      'Kayıtlar varsayılan olarak shareStatus="private" olmalı',
      `İlan Paylaşım: ${prop1.shareStatus}, Müşteri Paylaşım: ${cust1.shareStatus}`,
      createPropRes.status === 201 && prop1.shareStatus === 'private' && cust1.shareStatus === 'private'
    );

    // 4. Şirket 2 İzolasyon Testi (Şirket 1'in Özel Kayıtlarını Görememeli)
    const comp2PropsList = await apiRequest('/api/properties', { token: token2 });
    const comp2SeesProp1 = comp2PropsList.data.some(p => p.id === prop1.id);

    const comp2DirectGetProp = await apiRequest(`/api/properties/${prop1.id}`, { token: token2 });
    const comp2DirectGetCust = await apiRequest(`/api/customers/${cust1.id}`, { token: token2 });

    recordTest(
      'E2E TEST 4: Şirketler Arası BOLA/IDOR İzolasyon Doğrulaması',
      'Şirket 2 tokenı ile Şirket 1 özel kayıtlarına GET isteği atıldı.',
      'Listede görünmemeli ve doğrudan ID isteğinde 404 dönmeli',
      `Listede var mı: ${comp2SeesProp1}, Doğrudan İlan HTTP: ${comp2DirectGetProp.status}, Müşteri HTTP: ${comp2DirectGetCust.status}`,
      comp2SeesProp1 === false && comp2DirectGetProp.status === 404 && comp2DirectGetCust.status === 404
    );

    // 5. Şirket 1 İlanını ve Müşterisini Ortak Havuzda Paylaşır
    const sharePropRes = await apiRequest(`/api/properties/${prop1.id}/share`, {
      method: 'POST',
      token: token1,
      body: { action: 'share', targetType: 'all_members', commissionSplit: '50-50' }
    });

    const shareCustRes = await apiRequest(`/api/customers/${cust1.id}/share`, {
      method: 'POST',
      token: token1,
      body: { action: 'share', legalBasisNote: 'KVKK Onaylı B2B Talep Paylaşımı' }
    });

    recordTest(
      'E2E TEST 5: B2B Ortak Havuzda Paylaşım Başlatma',
      'POST /api/properties/:id/share ve POST /api/customers/:id/share çağrıldı.',
      'Status: 200 ve shareStatus: shared_pool olmalı',
      `İlan Paylaşım: ${sharePropRes.data.shareStatus}, Müşteri Paylaşım: ${shareCustRes.data.shareStatus}`,
      sharePropRes.status === 200 && sharePropRes.data.shareStatus === 'shared_pool' && shareCustRes.data.shareStatus === 'shared_pool'
    );

    // 6. Şirket 2 Ortak Havuzu Sorgular (KVKK Maskeleme Denetimi)
    const poolPropsRes = await apiRequest('/api/properties?scope=pool', { token: token2 });
    const poolCustsRes = await apiRequest('/api/customers?scope=pool', { token: token2 });

    const sharedPropInPool = poolPropsRes.data.find(p => p.id === prop1.id);
    const sharedCustInPool = poolCustsRes.data.find(c => c.id === cust1.id);

    const isCustPhoneHidden = sharedCustInPool && sharedCustInPool.phone === null;
    const isCustEmailHidden = sharedCustInPool && sharedCustInPool.email === null;
    const isCustNameMasked = sharedCustInPool && sharedCustInPool.name.includes('*');

    recordTest(
      'E2E TEST 6: B2B Havuz Görünürlüğü ve KVKK Maskeleme Güvencesi',
      'Şirket 2 havuzdan paylaşılan mülk ve müşteriyi listeledi.',
      'İlan görünmeli; Müşterinin telefonu null, e-postası null ve adı maskeli ("K**** G****") olmalı',
      `İlan Havuzda: ${Boolean(sharedPropInPool)}, Tel: ${sharedCustInPool ? sharedCustInPool.phone : 'yok'}, Ad: ${sharedCustInPool ? sharedCustInPool.name : 'yok'}`,
      Boolean(sharedPropInPool) && isCustPhoneHidden && isCustEmailHidden && isCustNameMasked
    );

    // 7. Şirket 1 Paylaşımı İptal Eder (Instant Revocation)
    const revokePropRes = await apiRequest(`/api/properties/${prop1.id}/share`, {
      method: 'POST',
      token: token1,
      body: { action: 'revoke' }
    });

    const poolPropsAfterRevoke = await apiRequest('/api/properties?scope=pool', { token: token2 });
    const stillInPool = poolPropsAfterRevoke.data.some(p => p.id === prop1.id);

    recordTest(
      'E2E TEST 7: Paylaşımın Anında İptal Edilmesi (Instant Revocation)',
      'Şirket 1 paylaşımı iptal etti, Şirket 2 havuzu tekrar sorguladı.',
      'İlan havuzdan anında kaybolmalı (stillInPool=false)',
      `İptal Status: ${revokePropRes.status}, Havuzda hala var mı: ${stillInPool}`,
      revokePropRes.status === 200 && stillInPool === false
    );

    // 8. Şirket 1 Güvenli ve Yalıtılmış Yedekleme (Scoped Backup)
    const backupRes = await apiRequest('/api/backup', { token: token1 });
    const backupData = backupRes.data.data;
    const hasOnlyCompany1Props = backupData.properties.every(p => p.companyId === comp1Id);

    recordTest(
      'E2E TEST 8: Yalıtılmış Şirket Yedeği (Scoped Backup)',
      'GET /api/backup ile alınan yedek incelendi.',
      'Yalnızca Şirket 1 verileri yer almalı, yabancı şirket verisi sızmamalı',
      `Şirket ID: ${backupRes.data.companyId}, Yalnızca Şirket 1 Verisi: ${hasOnlyCompany1Props}`,
      backupRes.status === 200 && backupRes.data.companyId === comp1Id && hasOnlyCompany1Props
    );

    console.log('================================================================');
    console.log(`🎉 TÜM UÇTAN UCA (E2E) TESTLER BAŞARIYLA GEÇTİ! (${e2eResults.length}/${e2eResults.length} PASS)`);
    console.log('================================================================\n');

    process.exit(0);

  } catch (err) {
    console.error('❌ E2E TEST BAŞARISIZ:', err);
    process.exit(1);
  }
}

runE2ETests();
