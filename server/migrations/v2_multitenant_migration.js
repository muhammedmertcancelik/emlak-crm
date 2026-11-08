/**
 * ============================================================================
 * EMLAK TAKİP CRM - ÇOK ŞİRKETLİ (MULTI-TENANT) VERİ TABANI MİGRASYON BETİĞİ
 * Versiyon: 2.0.0
 * 
 * Güvenlik ve Bütünlük Kuralları:
 * 1. Orijinal veritabanını değiştirmeden önce otomatik tarihli yedek alır (.bak).
 * 2. İdempotent: Birden fazla kez çalıştırıldığında mükerrer kayıt üretmez.
 * 3. Atomik Yazma: Geçici dosyaya (.tmp) yazıp rename ile uygular (0 bozulma riski).
 * 4. Şifre Güvenliği: Standart crypto scryptSync ile tuzlu (salt) hashleme yapar.
 * 5. Parametrik Dosya Desteği: Test amacıyla istenen JSON kopyası üzerinde çalıştırılabilir.
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ─── Güvenlik & Kriptografi Yardımcıları ───────────────────────

/**
 * Parolayı tuzlu scrypt algoritması ile hashler.
 * Format: scrypt:<salt_hex>:<hash_hex>
 */
function hashPassword(plainPassword) {
  if (!plainPassword || typeof plainPassword !== 'string') {
    throw new Error('Geçersiz parola');
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(plainPassword, salt, 64);
  return `scrypt:${salt}:${derivedKey.toString('hex')}`;
}

/**
 * Verilen parola ile saklanan hash'i doğrular (zamanlama saldırılarına karşı güvenli).
 */
function verifyPassword(plainPassword, storedHash) {
  if (!storedHash || !storedHash.startsWith('scrypt:')) {
    return false;
  }
  const [, salt, originalHash] = storedHash.split(':');
  if (!salt || !originalHash) return false;

  const derivedKey = crypto.scryptSync(plainPassword, salt, 64);
  const keyBuffer = Buffer.from(derivedKey.toString('hex'), 'hex');
  const originalBuffer = Buffer.from(originalHash, 'hex');

  if (keyBuffer.length !== originalBuffer.length) return false;
  return crypto.timingSafeEqual(keyBuffer, originalBuffer);
}

/**
 * Güvenli benzersiz kimlik (UUID v4) üretir.
 */
function generateId(prefix = '') {
  const uuid = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
  return prefix ? `${prefix}-${uuid}` : uuid;
}

// ─── Yedekleme ve Atomik Yazma Yardımcıları ──────────────────

/**
 * Veritabanının tam kopyasını tarihli yedek dosyasına kaydeder.
 */
function createBackup(sourcePath, backupDir = null) {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Yedeklenecek kaynak dosya bulunamadı: ${sourcePath}`);
  }

  const targetDir = backupDir || path.join(path.dirname(sourcePath), 'backups');
  fs.mkdirSync(targetDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFileName = `database_v1_backup_${timestamp}.json`;
  const backupFilePath = path.join(targetDir, backupFileName);

  fs.copyFileSync(sourcePath, backupFilePath);

  // Doğrulama
  const srcStat = fs.statSync(sourcePath);
  const bakStat = fs.statSync(backupFilePath);
  if (srcStat.size !== bakStat.size) {
    throw new Error('Yedekleme boyutu kaynak dosyayla uyuşmuyor!');
  }

  return backupFilePath;
}

/**
 * Dosyayı atomik olarak diske yazar ve fs.fsyncSync ile işletim sistemi
 * arabelleğinden fiziksel diske yazılmasını garanti eder (kesinti koruması).
 */
function writeAtomic(filePath, dataObj) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });

  const tempFilePath = `${filePath}.tmp.${Date.now()}.${crypto.randomBytes(4).toString('hex')}`;
  const serialized = JSON.stringify(dataObj, null, 2);

  // 1. Geçici dosyayı yaz
  const fd = fs.openSync(tempFilePath, 'w');
  try {
    fs.writeSync(fd, serialized, 0, 'utf8');
    // 2. Fiziksel diske flush et (OS write cache bypass)
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }

  // 3. Atomik rename ile asıl dosyanın üzerine taşı
  fs.renameSync(tempFilePath, filePath);
  return true;
}

// ─── Şema Doğrulama (Validation) ──────────────────────────────

function validateRawData(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('Geçersiz veritabanı içeriği: Veri bir JSON nesnesi olmalıdır.');
  }
  if (!Array.isArray(data.properties)) {
    throw new Error('properties bir dizi (array) olmalıdır.');
  }
  if (!Array.isArray(data.customers)) {
    throw new Error('customers bir dizi (array) olmalıdır.');
  }
  if (!Array.isArray(data.followUps)) {
    throw new Error('followUps bir dizi (array) olmalıdır.');
  }
  return true;
}

// ─── Çok Şirketli Dönüşüm (Pure Migration Transformation) ──────

/**
 * Mevcut verileri yeni çok şirket/kullanıcı modeline dönüştüren saf fonksiyon.
 * Orijinal nesneyi bozmaz, yeni zenginleştirilmiş nesne döndürür.
 */
function migrateData(rawSourceData, options = {}) {
  validateRawData(rawSourceData);

  // Derin kopya ile çalış
  const data = JSON.parse(JSON.stringify(rawSourceData));

  const now = new Date().toISOString();
  const defaultCompanyId = options.defaultCompanyId || 'comp-default-1';
  const defaultCompanyName = options.defaultCompanyName || 'Örnek Emlak Gayrimenkul A.Ş.';
  const defaultAdminId = options.defaultAdminId || 'user-admin-1';
  const defaultAdminEmail = (options.defaultAdminEmail || 'admin@emlaktakip.com').toLowerCase().trim();

  // Sabit şifre KULLANILMAZ: Eğer options ile verilmemişse kriptografik rastgele güvenli parola üretilir.
  let generatedAdminPassword = null;
  let adminPasswordToUse = options.defaultAdminPassword;
  if (!adminPasswordToUse) {
    generatedAdminPassword = crypto.randomBytes(12).toString('base64url') + '!A9';
    adminPasswordToUse = generatedAdminPassword;
  }
  const setupToken = crypto.randomBytes(24).toString('hex');
  const setupTokenHash = crypto.createHash('sha256').update(setupToken).digest('hex');

  // 1. İdempotency & Yeni Tabloların Başlatılması
  const result = {
    version: '2.0.0',
    migratedAt: data.migratedAt || now,
    companies: Array.isArray(data.companies) ? data.companies : [],
    users: Array.isArray(data.users) ? data.users : [],
    companyMemberships: Array.isArray(data.companyMemberships) ? data.companyMemberships : [],
    invitations: Array.isArray(data.invitations) ? data.invitations : [],
    properties: Array.isArray(data.properties) ? data.properties : [],
    customers: Array.isArray(data.customers) ? data.customers : [],
    followUps: Array.isArray(data.followUps) ? data.followUps : [],
    propertyShares: Array.isArray(data.propertyShares) ? data.propertyShares : [],
    customerShares: Array.isArray(data.customerShares) ? data.customerShares : [],
    auditLogs: Array.isArray(data.auditLogs) ? data.auditLogs : [],
    subscriptions: Array.isArray(data.subscriptions) ? data.subscriptions : []
  };

  // 2. Varsayılan Şirketin Oluşturulması / Korunması
  let defaultCompany = result.companies.find(c => c.id === defaultCompanyId);
  if (!defaultCompany) {
    defaultCompany = {
      id: defaultCompanyId,
      name: defaultCompanyName,
      slug: 'ornek-emlak',
      phone: '0850 123 45 67',
      email: defaultAdminEmail,
      city: 'İstanbul',
      address: 'Merkez Mah. Emlak Cad. No: 1 Kat: 3',
      taxNumber: '1234567890',
      subscriptionTier: 'pro',
      status: 'active',
      settings: {
        currency: 'TRY',
        allowB2BPool: true,
        autoMatchThreshold: 60
      },
      createdAt: now,
      updatedAt: now
    };
    result.companies.unshift(defaultCompany);
  }

  // 3. Varsayılan Şirket Sahibi / Yönetici Hesabının Oluşturulması
  let defaultUser = result.users.find(u => u.email.toLowerCase() === defaultAdminEmail);
  let isNewUserCreated = false;
  if (!defaultUser) {
    isNewUserCreated = true;
    defaultUser = {
      id: defaultAdminId,
      email: defaultAdminEmail,
      passwordHash: hashPassword(adminPasswordToUse),
      fullName: 'Sistem Yöneticisi',
      phone: '0555 123 4567',
      isPlatformAdmin: true,
      mustChangePassword: true,
      setupTokenHash: setupTokenHash,
      isSetupCompleted: false,
      status: 'active',
      createdAt: now,
      updatedAt: now
    };
    result.users.unshift(defaultUser);
  }

  // 4. Şirket Üyeliğinin (Membership) Oluşturulması
  let membership = result.companyMemberships.find(
    m => m.userId === defaultUser.id && m.companyId === defaultCompany.id
  );
  if (!membership) {
    membership = {
      id: 'mem-admin-1',
      userId: defaultUser.id,
      companyId: defaultCompany.id,
      role: 'owner', // owner | admin | agent
      status: 'active',
      isCurrent: true,
      permissions: {
        canManageCompany: true,
        canManageMembers: true,
        canManageProperties: true,
        canManageCustomers: true,
        canShareToPool: true,
        canBackupRestore: true
      },
      joinedAt: now
    };
    result.companyMemberships.unshift(membership);
  }

  // 5. Mevcut İlanların (Properties) Çok Şirketli Modele Bağlanması
  let migratedPropertiesCount = 0;
  result.properties = result.properties.map(p => {
    // Zaten companyId varsa dokunma (idempotent)
    if (p.companyId) {
      return p;
    }
    migratedPropertiesCount++;
    return {
      ...p,
      companyId: defaultCompany.id,
      createdById: defaultUser.id,
      shareStatus: p.shareStatus || 'private', // 'private' | 'shared_pool' | 'shared_specific'
      isArchived: Boolean(p.isArchived),
      createdAt: p.createdAt || now,
      updatedAt: p.updatedAt || now
    };
  });

  // 6. Mevcut Müşterilerin (Customers) Çok Şirketli Modele Bağlanması
  let migratedCustomersCount = 0;
  result.customers = result.customers.map(c => {
    if (c.companyId) {
      return c;
    }
    migratedCustomersCount++;
    return {
      ...c,
      companyId: defaultCompany.id,
      createdById: defaultUser.id,
      shareStatus: c.shareStatus || 'private', // 'private' | 'shared_pool' | 'shared_specific'
      createdAt: c.createdAt || now,
      updatedAt: c.updatedAt || now
    };
  });

  // 7. Mevcut Takip Görevlerinin (Follow-ups) Bağlanması
  let migratedFollowUpsCount = 0;
  result.followUps = result.followUps.map(f => {
    if (f.companyId) {
      return f;
    }
    migratedFollowUpsCount++;
    return {
      ...f,
      companyId: defaultCompany.id,
      assignedToUserId: f.assignedToUserId || defaultUser.id,
      createdAt: f.createdAt || now
    };
  });

  // 8. Migration Denetim İzi (Audit Log) Ekle
  result.auditLogs.unshift({
    id: generateId('audit'),
    companyId: defaultCompany.id,
    userId: defaultUser.id,
    action: 'MIGRATION_V2_APPLIED',
    targetType: 'system',
    targetId: 'database',
    details: {
      migratedProperties: migratedPropertiesCount,
      migratedCustomers: migratedCustomersCount,
      migratedFollowUps: migratedFollowUpsCount,
      timestamp: now
    },
    ipAddress: '127.0.0.1',
    timestamp: now
  });

  return {
    data: result,
    adminSetupInfo: isNewUserCreated ? {
      email: defaultAdminEmail,
      generatedPassword: generatedAdminPassword,
      setupToken: setupToken
    } : null,
    stats: {
      totalProperties: result.properties.length,
      migratedPropertiesCount,
      totalCustomers: result.customers.length,
      migratedCustomersCount,
      totalFollowUps: result.followUps.length,
      migratedFollowUpsCount,
      totalCompanies: result.companies.length,
      totalUsers: result.users.length,
      totalMemberships: result.companyMemberships.length
    }
  };
}

// ─── Ana Yürütücü Fonksiyon ───────────────────────────────────

/**
 * Migration betiğini çalıştırır.
 * 
 * @param {Object} options
 * @param {string} options.dbFilePath - Hedef veritabanı JSON dosya yolu
 * @param {boolean} options.dryRun - True ise dosyaya yazmaz, sadece simülasyon yapar
 * @param {string} options.backupDir - Yedek dizini
 */
function runMigration(options = {}) {
  const dbFilePath = options.dbFilePath || path.join(__dirname, '..', '..', 'data', 'database.json');
  const dryRun = Boolean(options.dryRun);

  if (!fs.existsSync(dbFilePath)) {
    throw new Error(`Hedef veritabanı bulunamadı: ${dbFilePath}`);
  }

  const raw = fs.readFileSync(dbFilePath, 'utf8');
  const originalData = JSON.parse(raw);

  let backupFilePath = null;
  if (!dryRun) {
    backupFilePath = createBackup(dbFilePath, options.backupDir);
  }

  const { data: migratedData, stats, adminSetupInfo } = migrateData(originalData, options);

  if (!dryRun) {
    writeAtomic(dbFilePath, migratedData);
  }

  return {
    success: true,
    dryRun,
    dbFilePath,
    backupFilePath,
    stats,
    adminSetupInfo
  };
}

/**
 * Geri alma (Rollback) fonksiyonu: Yedeği hedefe geri yükler.
 */
function rollback(backupFilePath, targetDbFilePath) {
  if (!fs.existsSync(backupFilePath)) {
    throw new Error(`Geri yüklenecek yedek dosyası bulunamadı: ${backupFilePath}`);
  }
  // Yedeğin geçerli JSON olduğunu doğrula
  const raw = fs.readFileSync(backupFilePath, 'utf8');
  JSON.parse(raw);

  // Atomik olarak asıl dosyanın üzerine kopyala (byte-to-byte tam koruma)
  const dir = path.dirname(targetDbFilePath);
  fs.mkdirSync(dir, { recursive: true });
  const tempFilePath = `${targetDbFilePath}.tmp.rollback.${Date.now()}`;
  fs.copyFileSync(backupFilePath, tempFilePath);
  fs.renameSync(tempFilePath, targetDbFilePath);

  return {
    success: true,
    restoredFrom: backupFilePath,
    target: targetDbFilePath
  };
}

module.exports = {
  hashPassword,
  verifyPassword,
  generateId,
  createBackup,
  writeAtomic,
  validateRawData,
  migrateData,
  runMigration,
  rollback
};
