/**
 * ============================================================================
 * EMLAK TAKİP CRM - VERİTABANI ERİŞİM & İZOLASYON KATMANI (DB LAYER)
 * Versiyon: 2.0.0
 * 
 * Özellikler:
 * - Atomik yazma ve fsync disk senkronizasyonu
 * - Eşzamanlı istekler için Memory Mutex (Race condition önleyici kuyruk)
 * - Çok şirketli (multi-tenant) veri erişim ve paylaşım denetçileri
 * - KVKK Veri Minimizasyonu: Ortak havuz müşteri maskeleme fonksiyonu
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_FILE = path.join(__dirname, '..', 'data', 'database.json');

// Eşzamanlı yazma isteklerini sıraya dizen işlem kuyruğu (Mutex)
let dbLockQueue = Promise.resolve();

function readDB() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return {
        version: '2.0.0',
        companies: [],
        users: [],
        companyMemberships: [],
        invitations: [],
        properties: [],
        customers: [],
        followUps: [],
        propertyShares: [],
        customerShares: [],
        auditLogs: [],
        subscriptions: []
      };
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Veritabanı okuma hatası:', err);
    throw err;
  }
}

function writeDB(data) {
  const dir = path.dirname(DATA_FILE);
  fs.mkdirSync(dir, { recursive: true });

  const tempFilePath = `${DATA_FILE}.tmp.${Date.now()}.${crypto.randomBytes(4).toString('hex')}`;
  const serialized = JSON.stringify(data, null, 2);

  const fd = fs.openSync(tempFilePath, 'w');
  try {
    fs.writeSync(fd, serialized, 0, 'utf8');
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }

  fs.renameSync(tempFilePath, DATA_FILE);
  return true;
}

/**
 * Eşzamanlı yarış durumlarını (Race Condition) önlemek için veritabanı işlemlerini kilit kuyruğunda çalıştırır.
 */
function withDBLock(operationFn) {
  const nextLock = dbLockQueue.then(async () => {
    const db = readDB();
    let isModified = false;
    const save = (newDb) => {
      isModified = true;
      writeDB(newDb);
    };
    return await operationFn(db, save);
  });
  dbLockQueue = nextLock.catch(() => {});
  return nextLock;
}

// ─── Çok Şirketli Paylaşım ve Erişim Kontrolcüleri ───────────

/**
 * Bir ilanın verilen şirkete ait olup olmadığını veya havuza paylaşılıp paylaşılmadığını doğrular.
 */
function canAccessProperty(property, companyId, db) {
  if (!property) return false;
  // 1. Şirketin kendi özel mülkü ise tam erişim
  if (property.companyId === companyId) return true;

  // 2. Arşivli mülkler dışarı paylaşılamaz
  if (property.isArchived) return false;

  // 3. Ortak havuza açılmış mı?
  if (property.shareStatus === 'shared_pool') return true;

  // 4. Belirli şirketlere özel paylaşılmış mı?
  const shares = (db.propertyShares || []).filter(
    s => s.propertyId === property.id && s.status === 'active'
  );
  for (const s of shares) {
    if (s.targetType === 'all_members') return true;
    if (s.targetType === 'specific_companies' && (s.targetCompanyIds || []).includes(companyId)) {
      return true;
    }
  }

  return false;
}

/**
 * Bir müşterinin verilen şirkete ait olup olmadığını veya havuza paylaşılıp paylaşılmadığını doğrular.
 */
function canAccessCustomer(customer, companyId, db) {
  if (!customer) return false;
  // 1. Kendi şirketi
  if (customer.companyId === companyId) return true;

  // 2. Havuz paylaşımı
  if (customer.shareStatus === 'shared_pool') return true;

  const shares = (db.customerShares || []).filter(
    s => s.customerId === customer.id && s.status === 'active'
  );
  for (const s of shares) {
    if (s.targetType === 'all_members') return true;
    if (s.targetType === 'specific_companies' && (s.targetCompanyIds || []).includes(companyId)) {
      return true;
    }
  }

  return false;
}

/**
 * KVKK Veri Minimizasyonu: Başka bir şirkete paylaşılan müşterinin
 * adını maskeler ("M*** E***"), telefon, e-posta ve özel notlarını gizler.
 */
function maskCustomerForPool(customer, ownerCompany = null) {
  if (!customer) return null;

  // İsmi maskele: "Murat Erdem" -> "M**** E****"
  const parts = (customer.name || 'Müşteri').split(' ').filter(Boolean);
  const maskedName = parts
    .map(p => p.charAt(0) + '*'.repeat(Math.max(1, p.length - 1)))
    .join(' ');

  return {
    id: customer.id,
    companyId: customer.companyId,
    name: maskedName,
    phone: null, // Asla paylaşılmaz
    email: null, // Asla paylaşılmaz
    notes: null, // Gizli iç notlar paylaşılmaz
    isSharedPool: true,
    shareStatus: customer.shareStatus,
    customerClass: customer.customerClass,
    status: customer.status,
    totalBudget: customer.totalBudget,
    downPayment: customer.downPayment,
    usesCredit: customer.usesCredit,
    purchaseTimeline: customer.purchaseTimeline,
    preferredDistricts: customer.preferredDistricts || [],
    preferredRooms: customer.preferredRooms || [],
    minNetArea: customer.minNetArea,
    maxBuildingAge: customer.maxBuildingAge,
    maxMonthlyDues: customer.maxMonthlyDues,
    requiresSite: customer.requiresSite,
    requiresParking: customer.requiresParking,
    purpose: customer.purpose,
    ownerCompany: ownerCompany ? {
      id: ownerCompany.id,
      name: ownerCompany.name,
      phone: ownerCompany.phone,
      city: ownerCompany.city
    } : null,
    createdAt: customer.createdAt
  };
}

module.exports = {
  DATA_FILE,
  readDB,
  writeDB,
  withDBLock,
  canAccessProperty,
  canAccessCustomer,
  maskCustomerForPool
};
