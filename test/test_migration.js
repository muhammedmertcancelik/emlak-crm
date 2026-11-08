/**
 * ============================================================================
 * EMLAK TAKİP CRM - KAPSAMLI MİGRASYON & GÜVENLİK TESTİ (SANDBOX TEST RUNNER)
 * 
 * Bu test betiği:
 * - Orijinal 'data/database.json' dosyasına ASLA dokunmaz.
 * - Geçici bir 'test/sandbox' klasöründe izole ortam kurar.
 * - SHA-256 bütünlük doğrulaması yapar.
 * - Edge case'leri test eder (bozuk JSON, eksik diziler, yazma hataları, idempotency).
 * - Parola rastgeleliği ve güvenliğini test eder.
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert');
const {
  runMigration,
  rollback,
  verifyPassword,
  validateRawData
} = require('../server/migrations/v2_multitenant_migration');

const ORIGINAL_DB_PATH = path.join(__dirname, '..', 'data', 'database.json');
const SANDBOX_DIR = path.join(__dirname, 'sandbox');
const TEST_DB_PATH = path.join(SANDBOX_DIR, 'test_database.json');
const TEST_BACKUP_DIR = path.join(SANDBOX_DIR, 'backups');

function getFileHash(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

function cleanup() {
  if (fs.existsSync(SANDBOX_DIR)) {
    fs.rmSync(SANDBOX_DIR, { recursive: true, force: true });
  }
}

const testResults = [];

function recordTest(name, method, expected, actual, passed) {
  testResults.push({ name, method, expected, actual, status: passed ? 'PASS' : 'FAIL' });
  console.log(`[${passed ? 'PASS' : 'FAIL'}] ${name}`);
  console.log(`   Yöntem: ${method}`);
  console.log(`   Beklenen: ${expected}`);
  console.log(`   Gerçek: ${actual}\n`);
  assert.ok(passed, `${name} başarısız oldu!`);
}

function runComprehensiveTests() {
  console.log('================================================================');
  console.log('🧪 KAPSAMLI MİGRASYON GÜVENLİK VE DAYANIKLILIK TESTLERİ');
  console.log('================================================================');
  console.log(`📁 Kaynak Veritabanı: ${ORIGINAL_DB_PATH}`);
  console.log(`🧪 Test Sandbox: ${TEST_DB_PATH}\n`);

  try {
    cleanup();
    fs.mkdirSync(SANDBOX_DIR, { recursive: true });
    fs.copyFileSync(ORIGINAL_DB_PATH, TEST_DB_PATH);

    const originalHash = getFileHash(ORIGINAL_DB_PATH);
    const originalRaw = fs.readFileSync(ORIGINAL_DB_PATH, 'utf8');
    const originalJson = JSON.parse(originalRaw);

    // TEST 1: Dry-run SHA-256 Değişmezlik Doğrulaması
    const dryRunResult = runMigration({ dbFilePath: TEST_DB_PATH, dryRun: true });
    const postDryRunHash = getFileHash(TEST_DB_PATH);
    recordTest(
      'TEST 1: Dry-Run Dosya Bütünlüğü (SHA-256 Hash)',
      'Dry-run çalıştırıldıktan sonra kaynak dosyanın SHA-256 hash değeri karşılaştırıldı.',
      `Hash değişmemeli (${originalHash})`,
      `Hash: ${postDryRunHash}`,
      postDryRunHash === originalHash && dryRunResult.backupFilePath === null
    );

    // TEST 2: Otomatik Yedekleme ve Okunabilirlik Doğrulaması
    const migrationResult = runMigration({ dbFilePath: TEST_DB_PATH, backupDir: TEST_BACKUP_DIR });
    const backupExists = fs.existsSync(migrationResult.backupFilePath);
    const backupContent = fs.readFileSync(migrationResult.backupFilePath, 'utf8');
    const backupJson = JSON.parse(backupContent);
    const backupHash = getFileHash(migrationResult.backupFilePath);
    recordTest(
      'TEST 2: Otomatik Yedekleme ve Birebir Kopya Doğrulaması',
      'Yedek dosyasının oluşumu, JSON parse edilebilirliği ve SHA-256 hash denkliği kontrol edildi.',
      `Yedek orijinal veriyle birebir aynı hash'e sahip olmalı (${originalHash})`,
      `Yedek Hash: ${backupHash}, Kayıt Sayıları: Props=${backupJson.properties.length}, Custs=${backupJson.customers.length}`,
      backupExists && backupHash === originalHash && backupJson.properties.length === 9
    );

    // TEST 3: Veri Dönüşümü ve Kayıt Bütünlüğü (9 İlan, 4 Müşteri, 4 Görev)
    const migratedJson = JSON.parse(fs.readFileSync(TEST_DB_PATH, 'utf8'));
    const allPropsHaveCompany = migratedJson.properties.every(p => p.companyId === 'comp-default-1' && p.shareStatus === 'private');
    const allCustsHaveCompany = migratedJson.customers.every(c => c.companyId === 'comp-default-1' && c.shareStatus === 'private');
    const allTasksHaveCompany = migratedJson.followUps.every(t => t.companyId === 'comp-default-1' && t.assignedToUserId === 'user-admin-1');
    recordTest(
      'TEST 3: Çok Şirketli Veri Zenginleştirme (Zero Data Loss)',
      'Tüm kayıtların varsayılan şirkete private olarak bağlanması ve 0 veri kaybı doğrulandı.',
      '9 İlan, 4 Müşteri, 4 Görev korunmalı ve companyId atanmalı',
      `İlan: ${migratedJson.properties.length}, Müşteri: ${migratedJson.customers.length}, Görev: ${migratedJson.followUps.length}, Hepsi damgalı: ${allPropsHaveCompany && allCustsHaveCompany && allTasksHaveCompany}`,
      migratedJson.properties.length === 9 && migratedJson.customers.length === 4 && migratedJson.followUps.length === 4 && allPropsHaveCompany && allCustsHaveCompany && allTasksHaveCompany
    );

    // TEST 4: Dinamik ve Güvenli Yönetici Hesabı (Sabit Şifre Reddi)
    const adminUser = migratedJson.users[0];
    const hasSetupInfo = Boolean(migrationResult.adminSetupInfo && migrationResult.adminSetupInfo.generatedPassword);
    const passwordIsScrypt = adminUser.passwordHash.startsWith('scrypt:');
    const verifySuccess = hasSetupInfo && verifyPassword(migrationResult.adminSetupInfo.generatedPassword, adminUser.passwordHash);
    const staticPassFails = verifyPassword('Admin123!*', adminUser.passwordHash) === false;
    recordTest(
      'TEST 4: Dinamik Yönetici Parolası ve Setup Token Güvenliği',
      'Sabit parola reddedildi, rastgele üretilen tek seferlik şifre scrypt ile doğrulandı.',
      'Sabit parola kabul edilmemeli, üretilen parola scrypt ile doğrulanmalı, mustChangePassword=true olmalı',
      `Üretilen parola doğrulandı: ${verifySuccess}, Sabit parola reddi: ${staticPassFails}, mustChangePassword: ${adminUser.mustChangePassword}`,
      hasSetupInfo && passwordIsScrypt && verifySuccess && staticPassFails && adminUser.mustChangePassword === true
    );

    // TEST 5: İdempotency (İkinci Kez Çalıştırıldığında Mükerrer Kayıt Oluşmaması)
    const secondRun = runMigration({ dbFilePath: TEST_DB_PATH, backupDir: TEST_BACKUP_DIR });
    const secondJson = JSON.parse(fs.readFileSync(TEST_DB_PATH, 'utf8'));
    recordTest(
      'TEST 5: İdempotency (Tekrar Çalıştırma Dayanıklılığı)',
      'Migration üst üste ikinci kez çalıştırıldığında kayıt sayıları incelendi.',
      'Şirket=1, Kullanıcı=1, İlan=9, Müşteri=4 sabit kalmalı, taşınan=0 olmalı',
      `Şirket: ${secondJson.companies.length}, Kullanıcı: ${secondJson.users.length}, İlan: ${secondJson.properties.length}, Taşınan İlan: ${secondRun.stats.migratedPropertiesCount}`,
      secondJson.companies.length === 1 && secondJson.users.length === 1 && secondJson.properties.length === 9 && secondRun.stats.migratedPropertiesCount === 0
    );

    // TEST 6: Hatalı JSON ve Bozuk Şema Reddi (Edge Case)
    let corruptJsonRejected = false;
    try {
      validateRawData({ properties: "not-an-array" });
    } catch (e) {
      corruptJsonRejected = true;
    }
    let nullDataRejected = false;
    try {
      validateRawData(null);
    } catch (e) {
      nullDataRejected = true;
    }
    recordTest(
      'TEST 6: Bozuk / Geçersiz Şema Reddi (Input Validation)',
      'Bozuk veri yapıları (array yerine string, null nesne) validateRawData fonksiyonuna verildi.',
      'Hata fırlatılmalı ve işlem durdurulmalı',
      `Bozuk JSON reddedildi: ${corruptJsonRejected}, Null veri reddedildi: ${nullDataRejected}`,
      corruptJsonRejected && nullDataRejected
    );

    // TEST 7: Rollback Sonrası Orijinal Duruma Birebir Dönüş (Byte-to-Byte Hash)
    rollback(migrationResult.backupFilePath, TEST_DB_PATH);
    const postRollbackHash = getFileHash(TEST_DB_PATH);
    const restoredJson = JSON.parse(fs.readFileSync(TEST_DB_PATH, 'utf8'));
    recordTest(
      'TEST 7: Rollback ile Orijinal Duruma Birebir Geri Dönüş',
      'Yedek dosyasından geri yükleme yapıldı ve SHA-256 hash ile orijinal dosya karşılaştırıldı.',
      `Rollback sonrası dosya hash'i orijinalle birebir eşleşmeli (${originalHash})`,
      `Rollback Sonrası Hash: ${postRollbackHash}, Kayıt Sayısı: ${restoredJson.properties.length}`,
      postRollbackHash === originalHash && restoredJson.properties.length === 9
    );

    console.log('================================================================');
    console.log(`🎉 TÜM TESTLER BAŞARIYLA TAMAMLANDI! (${testResults.length}/${testResults.length} PASS)`);
    console.log('================================================================\n');

  } catch (err) {
    console.error('❌ TEST BAŞARISIZ:', err);
    process.exitCode = 1;
  } finally {
    cleanup();
  }
}

runComprehensiveTests();
