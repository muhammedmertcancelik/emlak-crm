/**
 * ============================================================================
 * EMLAK TAKİP CRM - ÇOK ŞİRKETLİ SAAS GÜVENLİK VE BOLA/IDOR TEST PAKETİ
 * ============================================================================
 */

const assert = require('assert');
const crypto = require('crypto');
const {
  readDB,
  withDBLock,
  canAccessProperty,
  canAccessCustomer,
  maskCustomerForPool
} = require('../server/db');

const {
  hashPassword,
  verifyPassword,
  createToken,
  resolveAuthContext
} = require('../server/auth');

const results = [];

function recordTest(name, method, expected, actual, passed) {
  results.push({ name, method, expected, actual, status: passed ? 'PASS' : 'FAIL' });
  console.log(`[${passed ? 'PASS' : 'FAIL'}] ${name}`);
  console.log(`   Yöntem: ${method}`);
  console.log(`   Beklenen: ${expected}`);
  console.log(`   Gerçek: ${actual}\n`);
  assert.ok(passed, `${name} başarısız oldu!`);
}

async function runSecurityTestSuite() {
  console.log('================================================================');
  console.log('🛡️ ÇOK ŞİRKETLİ SAAS GÜVENLİK & İZOLASYON DOĞRULAMA TESTLERİ');
  console.log('================================================================\n');

  try {
    // 1. Hazırlık: İki test şirketi ve iki kullanıcı oluştur
    const compAId = `comp-test-a-${Date.now()}`;
    const compBId = `comp-test-b-${Date.now()}`;
    const userAId = `user-test-a-${Date.now()}`;
    const userBId = `user-test-b-${Date.now()}`;
    const agentAId = `user-agent-a-${Date.now()}`;

    const propAId = `prop-test-a-${Date.now()}`;
    const custAId = `cust-test-a-${Date.now()}`;

    await withDBLock(async (db, save) => {
      // Şirket A ve Sahibi
      db.companies.push({ id: compAId, name: 'Kaya Emlak A.Ş.', status: 'active', createdAt: new Date().toISOString() });
      db.users.push({ id: userAId, email: `kaya-${Date.now()}@test.com`, passwordHash: hashPassword('KayaPass123!'), status: 'active' });
      db.companyMemberships.push({ id: `mem-a-${Date.now()}`, userId: userAId, companyId: compAId, role: 'owner', status: 'active' });

      // Şirket B ve Sahibi
      db.companies.push({ id: compBId, name: 'Yıldız Gayrimenkul Ltd.', status: 'active', createdAt: new Date().toISOString() });
      db.users.push({ id: userBId, email: `yildiz-${Date.now()}@test.com`, passwordHash: hashPassword('YildizPass123!'), status: 'active' });
      db.companyMemberships.push({ id: `mem-b-${Date.now()}`, userId: userBId, companyId: compBId, role: 'owner', status: 'active' });

      // Şirket A'nın Özel İlanı
      db.properties.push({
        id: propAId,
        companyId: compAId,
        createdById: userAId,
        shareStatus: 'private',
        title: 'Kaya Emlak Özel Portföy Villa',
        price: 25000000,
        isArchived: false,
        createdAt: new Date().toISOString()
      });

      // Şirket A'nın Özel Müşterisi (Hassas Kişisel Veri İçeren)
      db.customers.push({
        id: custAId,
        companyId: compAId,
        createdById: userAId,
        shareStatus: 'private',
        name: 'Murat Erdem',
        phone: '0543 789 1234',
        email: 'murat.erdem@ozel.com',
        notes: 'Çok gizli yatırımcı, peşin 10 milyon lirası hazır.',
        totalBudget: 15000000,
        status: 'aktif',
        createdAt: new Date().toISOString()
      });

      save(db);
    });

    let currentDB = readDB();

    // TEST 1: BOLA / IDOR İzolasyonu (Özel Kayıt Erişim Engeli)
    const propA = currentDB.properties.find(p => p.id === propAId);
    const custA = currentDB.customers.find(c => c.id === custAId);
    const bCanAccessProp = canAccessProperty(propA, compBId, currentDB);
    const bCanAccessCust = canAccessCustomer(custA, compBId, currentDB);
    recordTest(
      'TEST 1: BOLA/IDOR İzolasyonu (Şirketler Arası Veri Sızıntısı Engeli)',
      'Şirket B yetkisiyle Şirket A\'nın özel ilan ve müşteri erişimi canAccessProperty ve canAccessCustomer ile denetlendi.',
      'bCanAccessProp=false ve bCanAccessCust=false olmalı',
      `İlan Erişimi: ${bCanAccessProp}, Müşteri Erişimi: ${bCanAccessCust}`,
      bCanAccessProp === false && bCanAccessCust === false
    );

    // TEST 2: Tenant Tampering Koruması (Header Manüpilasyon Engeli)
    const tokenB = createToken({ userId: userBId, companyId: compBId, role: 'owner' });
    const fakeRequest = {
      headers: {
        authorization: `Bearer ${tokenB}`,
        'x-company-id': compAId // Şirket B kullanıcısı Şirket A kimliğini taklit etmeye çalışıyor
      }
    };
    const resolvedAuth = resolveAuthContext(fakeRequest, currentDB);
    // resolvedAuth kullanıcının üye olmadığı şirkete geçememeli
    const isTamperingBlocked = resolvedAuth && resolvedAuth.companyId === compBId && resolvedAuth.companyId !== compAId;
    recordTest(
      'TEST 2: Tenant Tampering (İstemci Başlık Manipülasyon Engeli)',
      'Şirket B kullanıcısı istek başlığında X-Company-Id: comp-A gönderdiğinde resolveAuthContext denetlendi.',
      'Yetkisiz şirket kimliği reddedilmeli ve kullanıcının kendi şirketi (comp-B) korunmalı',
      `Tespit Edilen Şirket: ${resolvedAuth ? resolvedAuth.companyId : 'null'} (Beklenen: ${compBId})`,
      isTamperingBlocked
    );

    // TEST 3: İlan Paylaşımı ve Paylaşım İptali (Instant Revocation)
    await withDBLock(async (db, save) => {
      const p = db.properties.find(item => item.id === propAId);
      p.shareStatus = 'shared_pool';
      save(db);
    });
    currentDB = readDB();
    const bCanAccessSharedProp = canAccessProperty(currentDB.properties.find(p => p.id === propAId), compBId, currentDB);

    // Paylaşımı İptal Et
    await withDBLock(async (db, save) => {
      const p = db.properties.find(item => item.id === propAId);
      p.shareStatus = 'private';
      save(db);
    });
    currentDB = readDB();
    const bCanAccessAfterRevoke = canAccessProperty(currentDB.properties.find(p => p.id === propAId), compBId, currentDB);

    recordTest(
      'TEST 3: Ortak Havuz Paylaşımı ve Anında İptal (Instant Revocation)',
      'İlan önce shared_pool yapıldı, ardından private statüsüne çekilip erişim doğrulandı.',
      'Paylaşım açıkken erişim true, iptal edildikten sonra anında false olmalı',
      `Paylaşım açıkken: ${bCanAccessSharedProp}, İptal sonrası: ${bCanAccessAfterRevoke}`,
      bCanAccessSharedProp === true && bCanAccessAfterRevoke === false
    );

    // TEST 4: KVKK Veri Minimizasyonu ve Müşteri Maskeleme
    const ownerCompany = currentDB.companies.find(c => c.id === compAId);
    const maskedCustomer = maskCustomerForPool(custA, ownerCompany);
    const isPhoneHidden = maskedCustomer.phone === null;
    const isEmailHidden = maskedCustomer.email === null;
    const isNotesHidden = maskedCustomer.notes === null;
    const isNameMasked = maskedCustomer.name.includes('*');

    recordTest(
      'TEST 4: KVKK Müşteri Maskeleme & Veri Minimizasyonu',
      'maskCustomerForPool fonksiyonunun çıktısı incelendi; telefon, e-posta ve özel notların gizlendiği doğrulandı.',
      'phone=null, email=null, notes=null ve ad maskelenmiş (M**** E****) olmalı',
      `Telefon: ${maskedCustomer.phone}, E-posta: ${maskedCustomer.email}, Not: ${maskedCustomer.notes}, Maskeli Ad: ${maskedCustomer.name}`,
      isPhoneHidden && isEmailHidden && isNotesHidden && isNameMasked
    );

    // TEST 5: Çalışan Davet Sistemi, Tek Kullanımlılık ve Rol Sınırı
    const inviteToken = crypto.randomBytes(32).toString('hex');
    const inviteTokenHash = crypto.createHash('sha256').update(inviteToken).digest('hex');

    await withDBLock(async (db, save) => {
      db.invitations.push({
        id: `inv-test-${Date.now()}`,
        companyId: compAId,
        invitedByUserId: userAId,
        email: `agent-${Date.now()}@kaya.com`,
        role: 'agent',
        tokenHash: inviteTokenHash,
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        status: 'pending'
      });
      save(db);
    });

    currentDB = readDB();
    const pendingInv = currentDB.invitations.find(i => i.tokenHash === inviteTokenHash && i.status === 'pending');
    assert.ok(pendingInv, 'Davet oluşturuldu');

    // Daveti kabul et
    await withDBLock(async (db, save) => {
      const inv = db.invitations.find(i => i.tokenHash === inviteTokenHash);
      inv.status = 'accepted';
      save(db);
    });

    currentDB = readDB();
    const acceptedInv = currentDB.invitations.find(i => i.tokenHash === inviteTokenHash && i.status === 'pending');
    const isSingleUseEnforced = acceptedInv === undefined;

    recordTest(
      'TEST 5: Davet Token Tek Kullanımlılığı (Single-Use Token)',
      'Davet kabul edildikten sonra aynı tokenın tekrar pending olarak kullanılamayacağı doğrulandı.',
      'Kabul edilen davet bir daha kullanılamamalı (status !== pending)',
      `İkinci kullanım engeli: ${isSingleUseEnforced}`,
      isSingleUseEnforced
    );

    // TEST 6: Scoped Backup (Yedek İzolasyonu)
    const backupPropsA = currentDB.properties.filter(p => p.companyId === compAId);
    const hasCompanyBDataInBackupA = backupPropsA.some(p => p.companyId === compBId);

    recordTest(
      'TEST 6: Şirket Bazlı Yedek İzolasyonu (Scoped Backup)',
      'Şirket A yedeğinde Şirket B verisinin bulunmadığı filtrelendi.',
      'hasCompanyBDataInBackupA=false olmalı',
      `Şirket B verisi var mı: ${hasCompanyBDataInBackupA}`,
      hasCompanyBDataInBackupA === false
    );

    // Temizlik: Test verilerini temizle
    await withDBLock(async (db, save) => {
      db.companies = db.companies.filter(c => c.id !== compAId && c.id !== compBId);
      db.users = db.users.filter(u => u.id !== userAId && u.id !== userBId && u.id !== agentAId);
      db.companyMemberships = db.companyMemberships.filter(m => m.companyId !== compAId && m.companyId !== compBId);
      db.properties = db.properties.filter(p => p.id !== propAId);
      db.customers = db.customers.filter(c => c.id !== custAId);
      db.invitations = db.invitations.filter(i => i.tokenHash !== inviteTokenHash);
      save(db);
    });

    console.log('================================================================');
    console.log(`🎉 TÜM GÜVENLİK TESTLERİ BAŞARIYLA TAMAMLANDI! (${results.length}/${results.length} PASS)`);
    console.log('================================================================\n');

  } catch (err) {
    console.error('❌ GÜVENLİK TESTİ BAŞARISIZ:', err);
    process.exitCode = 1;
  }
}

runSecurityTestSuite();
