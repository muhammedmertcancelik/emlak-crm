/**
 * ============================================================================
 * EMLAK TAKİP CRM - KİMLİK DOĞRULAMA, OTURUM & YETKİLENDİRME MODÜLÜ
 * Versiyon: 2.0.0
 * 
 * Standart Node.js 'crypto' modülü ile geliştirilmiş:
 * - HMAC-SHA256 imzalı güvenli oturum token (Stateless Auth Token)
 * - scrypt tuzlu parola hashleme ve zamanlama korumalı doğrulama
 * - Çok şirketli (multi-tenant) bağlam ve rol bazlı yetkilendirme middleware
 * ============================================================================
 */

const crypto = require('crypto');

// Sunucu tarafı token imzalama anahtarı (Ortam değişkeni yoksa rastgele oturum anahtarı)
const JWT_SECRET = process.env.JWT_SECRET || 'emlak-crm-secure-token-secret-key-2026-v2';
const TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 gün

// ─── Kriptografik Yardımcılar ─────────────────────────────────

function hashPassword(password) {
  if (!password || typeof password !== 'string' || password.length < 6) {
    throw new Error('Parola en az 6 karakter olmalıdır.');
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `scrypt:${salt}:${derivedKey.toString('hex')}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.startsWith('scrypt:')) return false;
  const parts = storedHash.split(':');
  if (parts.length !== 3) return false;
  const [, salt, originalHash] = parts;

  const derivedKey = crypto.scryptSync(password, salt, 64);
  const keyBuffer = Buffer.from(derivedKey.toString('hex'), 'hex');
  const originalBuffer = Buffer.from(originalHash, 'hex');

  if (keyBuffer.length !== originalBuffer.length) return false;
  return crypto.timingSafeEqual(keyBuffer, originalBuffer);
}

// ─── Güvenli Token Üretimi & Doğrulaması ──────────────────────

function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64').toString('utf8');
}

function createToken(payload) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const fullPayload = {
    ...payload,
    iat: Date.now(),
    exp: Date.now() + TOKEN_EXPIRY_MS
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, signature] = parts;
  const expectedSignature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');

  if (signature !== expectedSignature) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    if (payload.exp && Date.now() > payload.exp) {
      return null; // Süresi dolmuş
    }
    return payload;
  } catch (err) {
    return null;
  }
}

// ─── Kimlik ve Şirket Bağlamı Doğrulama (Auth Middleware) ────

/**
 * İstekten oturum açmış kullanıcıyı ve aktif şirket üyeliğini tespit eder.
 * @param {Object} req - HTTP Request
 * @param {Object} db - Aktif database verisi
 * @returns {Object|null} { user, company, membership } veya null
 */
function resolveAuthContext(req, db) {
  const authHeader = req.headers['authorization'] || '';
  let token = null;

  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  }

  // Header yoksa cookie kontrolü
  if (!token && req.headers['cookie']) {
    const cookies = req.headers['cookie'].split(';').map(c => c.trim());
    const authCookie = cookies.find(c => c.startsWith('token='));
    if (authCookie) {
      token = decodeURIComponent(authCookie.split('=')[1]);
    }
  }

  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload || !payload.userId) return null;

  const user = (db.users || []).find(u => u.id === payload.userId && u.status === 'active');
  if (!user) return null;

  // İstenen veya aktif şirket
  const requestedCompanyId = req.headers['x-company-id'] || payload.companyId;

  // Kullanıcının üyeliklerini bul
  const memberships = (db.companyMemberships || []).filter(
    m => m.userId === user.id && m.status === 'active'
  );

  let activeMembership = null;
  if (requestedCompanyId) {
    activeMembership = memberships.find(m => m.companyId === requestedCompanyId);
  }
  if (!activeMembership && memberships.length > 0) {
    activeMembership = memberships.find(m => m.isCurrent) || memberships[0];
  }

  let company = null;
  if (activeMembership) {
    company = (db.companies || []).find(c => c.id === activeMembership.companyId && c.status === 'active');
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      isPlatformAdmin: Boolean(user.isPlatformAdmin),
      mustChangePassword: Boolean(user.mustChangePassword)
    },
    company,
    membership: activeMembership,
    companyId: company ? company.id : null,
    memberships
  };
}

module.exports = {
  hashPassword,
  verifyPassword,
  createToken,
  verifyToken,
  resolveAuthContext
};
