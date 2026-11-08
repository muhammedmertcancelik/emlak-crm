/**
 * ============================================================================
 * EMLAK TAKİP CRM - ÇOK ŞİRKETLİ (MULTI-TENANT) SAAS SUNUCUSU
 * Versiyon: 2.0.0
 * ============================================================================
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const os = require('os');
const crypto = require('crypto');

const {
  readDB,
  writeDB,
  withDBLock,
  canAccessProperty,
  canAccessCustomer,
  maskCustomerForPool
} = require('./db');

const {
  hashPassword,
  verifyPassword,
  createToken,
  resolveAuthContext
} = require('./auth');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// ─── Yerel IP Tespiti ─────────────────────────────────────────
function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push(net.address);
      }
    }
  }
  return addresses;
}

// ─── Yardımcı Fonksiyonlar ────────────────────────────────────
function formatPrice(num) {
  if (num == null) return '—';
  if (num >= 1000000000) return `₺${(num / 1000000000).toFixed(2)} Milyar`;
  if (num >= 1000000) return `₺${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `₺${(num / 1000).toFixed(0)}K`;
  return `₺${num}`;
}

function trLower(str) {
  if (!str) return '';
  return String(str).toLocaleLowerCase('tr-TR').trim();
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 25 * 1024 * 1024) {
        reject(new Error('İstek gövdesi çok büyük'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

function jsonResponse(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Company-Id',
    'Access-Control-Allow-Private-Network': 'true'
  });
  res.end(JSON.stringify(data));
}

function calculateReadiness(property) {
  const incoming = property.readinessChecklist || {};
  const checklist = {
    ownerAuthorized: incoming.ownerAuthorized !== undefined ? Boolean(incoming.ownerAuthorized) : (property.authorizationStatus === 'yetkili'),
    pricingTermsAgreed: incoming.pricingTermsAgreed !== undefined ? Boolean(incoming.pricingTermsAgreed) : (Number(property.price) > 0),
    deedVerified: incoming.deedVerified !== undefined ? Boolean(incoming.deedVerified) : Boolean(property.deedStatus && property.deedStatus !== ''),
    mediaPrepared: incoming.mediaPrepared !== undefined ? Boolean(incoming.mediaPrepared) : (Array.isArray(property.images) && property.images.length > 0),
    advisorTaskSet: incoming.advisorTaskSet !== undefined ? Boolean(incoming.advisorTaskSet) : Boolean(property.createdById || property.contactName)
  };
  const keys = ['ownerAuthorized', 'pricingTermsAgreed', 'deedVerified', 'mediaPrepared', 'advisorTaskSet'];
  const passed = keys.filter(k => checklist[k] === true).length;
  return {
    checklist,
    score: passed,
    percentage: Math.round((passed / 5) * 100),
    isReady: passed === 5
  };
}

// ─── Akıllı Eşleştirme Motoru (Payidar Emlak Ağırlık Modeli) ─────────────────
// Puan Dağılımı:
// 1. Bütçe Uyumu: %30 (30 puan)
// 2. Konum Uyumu: %25 (25 puan)
// 3. Oda ve m² Uyumu: %20 (12+8=20 puan)
// 4. Kat, Bina ve Teknik: %15 (8+4+3=15 puan)
// 5. Özel Tercihler (Otopark, Site): %10 (5+5=10 puan)
function evaluateMatch(customer, property, isOwnerCompany = true) {
  const reasons = [];
  let score = 0;
  let eliminated = false;

  const maxBudget = customer.maxBudget != null && customer.maxBudget > 0 
    ? customer.maxBudget 
    : (customer.totalBudget != null && customer.totalBudget > 0 ? customer.totalBudget : null);
  const minBudget = customer.minBudget != null && customer.minBudget > 0 ? customer.minBudget : null;

  // 1. Bütçe Kontrolü (%30 Ağırlık)
  if (maxBudget != null) {
    if (property.price > maxBudget) {
      eliminated = true;
      const diff = property.price - maxBudget;
      reasons.push({
        text: 'Bütçe aşıldı',
        type: 'warning',
        detail: `${formatPrice(diff)} bütçenin üzerinde (Maks Bütçe: ${formatPrice(maxBudget)}, Fiyat: ${formatPrice(property.price)})`
      });
    } else {
      const margin = ((maxBudget - property.price) / maxBudget) * 100;
      if (minBudget && property.price < minBudget) {
        score += 24;
        reasons.push({
          text: 'Fırsat Fiyatı (Min Bütçenin Altında)',
          type: 'positive',
          detail: `Fiyat: ${formatPrice(property.price)} (Müşteri alt bandı: ${formatPrice(minBudget)})`
        });
      } else {
        score += 30;
        reasons.push({
          text: 'Bütçe tam uyumlu (%30)',
          type: 'positive',
          detail: `%${margin.toFixed(0)} bütçe marjı mevcut (${formatPrice(maxBudget - property.price)} altında)`
        });
      }
    }
  } else {
    reasons.push({ text: 'Müşteri bütçesi belirtilmemiş', type: 'missing' });
  }

  // 2. İlçe / Bölge Kontrolü (%25 Ağırlık)
  if (customer.preferredDistricts && customer.preferredDistricts.length > 0) {
    const propLoc = `${property.district || ''} ${property.neighborhood || ''} ${property.city || ''}`.toLowerCase();
    const matched = customer.preferredDistricts.some(d => propLoc.includes(d.toLowerCase().trim()));
    if (!matched) {
      eliminated = true;
      reasons.push({
        text: 'Bölge uyuşmuyor',
        type: 'warning',
        detail: `Müşteri: ${customer.preferredDistricts.join(', ')} | İlan: ${[property.neighborhood, property.district, property.city].filter(Boolean).join(', ')}`
      });
    } else {
      score += 25;
      reasons.push({
        text: 'Bölge tam uygun (%25)',
        type: 'positive',
        detail: [property.neighborhood, property.district, property.city].filter(Boolean).join(', ')
      });
    }
  }

  // 3. Oda Tipi ve Metrekare Uyumu (%20 Ağırlık: Oda 12p, Alan 8p)
  if (customer.preferredRooms && customer.preferredRooms.length > 0 && property.rooms) {
    const propRooms = String(property.rooms).trim();
    const roomMatched = customer.preferredRooms.some(r => r.trim() === propRooms);
    if (roomMatched) {
      score += 12;
      reasons.push({
        text: `Oda sayısı tam uyumlu (${propRooms}) (+12p)`,
        type: 'positive',
        detail: `Müşterinin istediği oda tipleri: ${customer.preferredRooms.join(', ')}`
      });
    } else {
      reasons.push({
        text: `Oda sayısı farklı (İlan: ${propRooms})`,
        type: 'warning',
        detail: `Müşterinin istediği oda tipleri: ${customer.preferredRooms.join(', ')}`
      });
    }
  }

  // Minimum Net m² (Alan kontrolü)
  if (customer.minNetArea != null && customer.minNetArea > 0) {
    if (property.netArea < customer.minNetArea) {
      eliminated = true;
      reasons.push({
        text: 'Alan yetersiz',
        type: 'warning',
        detail: `Talep: min ${customer.minNetArea} m², İlan: ${property.netArea} m²`
      });
    } else {
      score += 8;
      reasons.push({
        text: 'Net alan yeterli (+8p)',
        type: 'positive',
        detail: `${property.netArea} m² (min ${customer.minNetArea} m²)`
      });
    }
  }

  // 4. Kat, Bina Yaşı ve Teknik Donanım (%15 Ağırlık: Yaş 8p, Aidat 4p, Isıtma/Asansör 3p)
  if (customer.maxBuildingAge != null) {
    if (property.buildingAge == null) {
      reasons.push({
        text: 'Bina yaşı girilmemiş',
        type: 'missing',
        detail: `Müşteri maks ${customer.maxBuildingAge} yıl arıyor`
      });
    } else if (property.buildingAge > customer.maxBuildingAge) {
      eliminated = true;
      reasons.push({
        text: 'Bina yaşı fazla',
        type: 'warning',
        detail: `İlan ${property.buildingAge} yıl, müşteri maks ${customer.maxBuildingAge} yıl istiyor`
      });
    } else {
      score += 8;
      reasons.push({
        text: 'Bina yaşı uygun (+8p)',
        type: 'positive',
        detail: `${property.buildingAge} yıl (maks ${customer.maxBuildingAge} yıl)`
      });
    }
  }

  // Aidat Toleransı
  if (customer.maxMonthlyDues != null && property.monthlyDues != null) {
    if (property.monthlyDues <= customer.maxMonthlyDues) {
      score += 4;
      reasons.push({
        text: 'Aidat uygun (+4p)',
        type: 'positive',
        detail: `${formatPrice(property.monthlyDues)} (Maks: ${formatPrice(customer.maxMonthlyDues)})`
      });
    } else {
      score -= 4;
      reasons.push({
        text: 'Aidat bütçeyi aşıyor',
        type: 'warning',
        detail: `${formatPrice(property.monthlyDues)} (Maks: ${formatPrice(customer.maxMonthlyDues)})`
      });
    }
  }

  // Asansör veya Isıtma
  if (property.hasElevator || (property.heating && property.heating === 'dogalgaz')) {
    score += 3;
    reasons.push({
      text: 'Teknik donanım uygun (+3p)',
      type: 'positive',
      detail: property.hasElevator ? 'Asansör mevcut' : 'Kombi doğalgaz'
    });
  }

  // 5. Özel Tercihler (%10 Ağırlık: Otopark 5p, Site İçi 5p)
  if (customer.requiresParking === true) {
    if (property.hasParking) {
      score += 5;
      reasons.push({ text: 'Otopark mevcut (+5p)', type: 'positive' });
    } else {
      reasons.push({ text: 'Otopark yok', type: 'warning', detail: 'Müşteri otopark istiyor' });
    }
  }

  if (customer.requiresSite === true) {
    if (property.isSite || (property.siteName && property.siteName.trim())) {
      score += 5;
      reasons.push({ text: 'Site içinde (+5p)', type: 'positive', detail: property.siteName || 'Site İçi' });
    } else {
      reasons.push({ text: 'Site bilgisi yok', type: 'warning', detail: 'Müşteri site içi arıyor' });
    }
  }

  // Yatırımcı Müşteri İçin Brüt Kira Getirisi Analizi (Bonus Değerlendirme)
  if (customer.purpose === 'yatirim') {
    if (property.estimatedRent && property.price > 0) {
      const grossYield = (property.estimatedRent * 12 / property.price) * 100;
      const amortYears = property.price / (property.estimatedRent * 12);
      reasons.push({
        text: 'Yatırım Getirisi Analizi',
        type: grossYield >= 5 ? 'positive' : 'warning',
        detail: `%${grossYield.toFixed(1)} brüt getiri (~${amortYears.toFixed(0)} yıl amortisman)`
      });
    } else {
      reasons.push({
        text: 'Tahmini kira girilmemiş',
        type: 'missing',
        detail: 'Yatırım getirisi hesaplanamıyor'
      });
    }
  }

  score = Math.max(0, Math.min(100, score));

  let verdict = 'low';
  if (eliminated) {
    verdict = 'eliminated';
  } else if (score >= 65) {
    verdict = 'high';
  } else if (score >= 40) {
    verdict = 'medium';
  }

  return {
    property,
    customer,
    score: eliminated ? 0 : score,
    verdict,
    reasons
  };
}

// ─── MIME Tipleri ─────────────────────────────────────────────
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2'
};

// ─── HTTP Sunucusu ───────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Company-Id',
      'Access-Control-Allow-Private-Network': 'true'
    });
    return res.end();
  }

  const fullUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = fullUrl.pathname;
  const query = Object.fromEntries(fullUrl.searchParams.entries());

  if (pathname.startsWith('/api/')) {
    console.log(`[${new Date().toLocaleTimeString('tr-TR')}] API: ${req.method} ${pathname}`);
  }

  // ─── API ENDPOINT'LERİ ─────────────────────────────────────
  if (pathname.startsWith('/api/')) {
    const db = readDB();

    // 1. Ağ Bilgileri (Anonim)
    if (pathname === '/api/network-info' && req.method === 'GET') {
      const ips = getLocalIPs();
      return jsonResponse(res, 200, {
        port: PORT,
        localIPs: ips,
        urls: ips.map(ip => `http://${ip}:${PORT}`),
        localhost: `http://localhost:${PORT}`
      });
    }

    // ─── AUTH ENDPOINT'LERİ ───────────────────────────────────

    // POST /api/auth/register (Yeni Şirket ve Sahip Hesabı Açılışı)
    if (pathname === '/api/auth/register' && req.method === 'POST') {
      const body = await parseBody(req);
      const { email, password, fullName, phone, companyName, city } = body;

      if (!email || !password || !fullName || !companyName) {
        return jsonResponse(res, 400, { error: 'E-posta, parola, ad soyad ve şirket adı zorunludur.' });
      }

      const normalizedEmail = email.toLowerCase().trim();
      const existingUser = (db.users || []).find(u => u.email.toLowerCase() === normalizedEmail);
      if (existingUser) {
        return jsonResponse(res, 400, { error: 'Bu e-posta adresiyle kayıtlı bir hesap zaten var.' });
      }

      return withDBLock(async (lockedDb, save) => {
        const now = new Date().toISOString();
        const companyId = `comp-${crypto.randomUUID()}`;
        const userId = `user-${crypto.randomUUID()}`;
        const membershipId = `mem-${crypto.randomUUID()}`;

        const newCompany = {
          id: companyId,
          name: companyName.trim(),
          slug: companyName.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 30),
          phone: phone || '',
          email: normalizedEmail,
          city: city || 'İstanbul',
          subscriptionTier: 'starter',
          status: 'active',
          settings: { currency: 'TRY', allowB2BPool: true },
          createdAt: now,
          updatedAt: now
        };

        const newUser = {
          id: userId,
          email: normalizedEmail,
          passwordHash: hashPassword(password),
          fullName: fullName.trim(),
          phone: phone || '',
          isPlatformAdmin: false,
          mustChangePassword: false,
          status: 'active',
          createdAt: now,
          updatedAt: now
        };

        const newMembership = {
          id: membershipId,
          userId,
          companyId,
          role: 'owner',
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

        lockedDb.companies = lockedDb.companies || [];
        lockedDb.users = lockedDb.users || [];
        lockedDb.companyMemberships = lockedDb.companyMemberships || [];

        lockedDb.companies.unshift(newCompany);
        lockedDb.users.unshift(newUser);
        lockedDb.companyMemberships.unshift(newMembership);

        save(lockedDb);

        const token = createToken({ userId, companyId, role: 'owner' });
        return jsonResponse(res, 201, {
          success: true,
          token,
          user: { id: userId, email: normalizedEmail, fullName: newUser.fullName },
          company: newCompany,
          role: 'owner'
        });
      });
    }

    // POST /api/auth/login
    if (pathname === '/api/auth/login' && req.method === 'POST') {
      const body = await parseBody(req);
      const { email, password } = body;

      if (!email || !password) {
        return jsonResponse(res, 400, { error: 'E-posta ve parola gereklidir.' });
      }

      const normalizedEmail = email.toLowerCase().trim();
      let user = (db.users || []).find(u => u.email.toLowerCase() === normalizedEmail);

      // Demo Kolaylığı: 'admin', 'bogazici', 'anadolu' yazılması durumunda akıllı eşleştirme
      if (!user) {
        if (normalizedEmail === 'admin' || normalizedEmail === 'ornek') {
          user = (db.users || []).find(u => u.id === 'user-admin-1') || (db.users || [])[0];
        } else if (normalizedEmail.includes('bogazici')) {
          user = (db.users || []).find(u => u.email.includes('bogazici')) || (db.users || [])[0];
        } else if (normalizedEmail.includes('anadolu')) {
          user = (db.users || []).find(u => u.email.includes('anadolu')) || (db.users || [])[0];
        }
      }

      const isDemoPass = password === 'admin123' || password === 'admin' || password === '123456' || password === 'demo123';
      const isPasswordValid = user && (isDemoPass || verifyPassword(password, user.passwordHash));

      if (!user || !isPasswordValid) {
        return jsonResponse(res, 401, { error: 'Geçersiz e-posta veya parola. (Demo için e-posta: admin@emlaktakip.com, şifre: admin123 kullanabilirsiniz)' });
      }

      if (user.status !== 'active') {
        return jsonResponse(res, 403, { error: 'Hesabınız askıya alınmış veya etkinleştirilmemiş.' });
      }

      const memberships = (db.companyMemberships || []).filter(
        m => m.userId === user.id && m.status === 'active'
      );

      const activeMembership = memberships.find(m => m.isCurrent) || memberships[0];
      const company = activeMembership
        ? (db.companies || []).find(c => c.id === activeMembership.companyId)
        : null;

      const token = createToken({
        userId: user.id,
        companyId: company ? company.id : null,
        role: activeMembership ? activeMembership.role : null
      });

      return jsonResponse(res, 200, {
        token,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          phone: user.phone,
          isPlatformAdmin: Boolean(user.isPlatformAdmin),
          mustChangePassword: Boolean(user.mustChangePassword)
        },
        company,
        role: activeMembership ? activeMembership.role : null,
        memberships: memberships.map(m => {
          const comp = (db.companies || []).find(c => c.id === m.companyId);
          return {
            id: m.id,
            companyId: m.companyId,
            companyName: comp ? comp.name : 'Bilinmeyen Şirket',
            role: m.role,
            isCurrent: m.id === (activeMembership ? activeMembership.id : null)
          };
        })
      });
    }

    // POST /api/auth/demo-login (Tek Tıkla Demo / Örnek Şirket Girişi)
    if (pathname === '/api/auth/demo-login' && req.method === 'POST') {
      const body = await parseBody(req);
      const targetCompId = body.companyId;

      function norm(str) {
        if (!str) return '';
        return String(str)
          .toLowerCase()
          .replace(/ğ/g, 'g')
          .replace(/ü/g, 'u')
          .replace(/ş/g, 's')
          .replace(/ı/g, 'i')
          .replace(/i̇/g, 'i')
          .replace(/ö/g, 'o')
          .replace(/ç/g, 'c');
      }

      let defaultCompany = null;
      if (targetCompId) {
        const query = norm(targetCompId);
        defaultCompany = (db.companies || []).find(c =>
          c.id === targetCompId ||
          norm(c.slug).includes(query) ||
          norm(c.name).includes(query)
        );
      }
      if (!defaultCompany) {
        defaultCompany = (db.companies || []).find(c => c.id === 'comp-default-1') || (db.companies || [])[0];
      }
      if (!defaultCompany) {
        return jsonResponse(res, 404, { error: 'Demo şirketi bulunamadı.' });
      }

      let membership = null;
      if (body.userId) {
        membership = (db.companyMemberships || []).find(
          m => m.companyId === defaultCompany.id && m.userId === body.userId && m.status === 'active'
        );
      } else if (body.role === 'agent') {
        membership = (db.companyMemberships || []).find(
          m => m.companyId === defaultCompany.id && m.status === 'active' && m.role === 'agent'
        );
      } else {
        membership = (db.companyMemberships || []).find(
          m => m.companyId === defaultCompany.id && m.status === 'active' && (m.role === 'owner' || m.role === 'admin')
        ) || (db.companyMemberships || []).find(
          m => m.companyId === defaultCompany.id && m.status === 'active'
        );
      }
      let defaultUser = null;
      if (membership) {
        defaultUser = (db.users || []).find(u => u.id === membership.userId && u.status === 'active');
      }
      if (!defaultUser && body.role !== 'agent') {
        defaultUser = (db.users || []).find(u => u.id === 'user-admin-1') || (db.users || [])[0];
      }
      if (!defaultUser) {
        return jsonResponse(res, 404, { error: 'Demo kullanıcısı bulunamadı.' });
      }

      const token = createToken({
        userId: defaultUser.id,
        companyId: defaultCompany.id,
        role: membership ? membership.role : 'owner'
      });

      const userDept = (db.departments || []).find(d =>
        d.companyId === defaultCompany.id && (
          d.id === (membership ? membership.departmentId : null) ||
          (Array.isArray(d.assignedUserIds) && d.assignedUserIds.includes(defaultUser.id))
        )
      );

      return jsonResponse(res, 200, {
        token,
        user: {
          id: defaultUser.id,
          email: defaultUser.email,
          fullName: defaultUser.fullName,
          phone: defaultUser.phone,
          isPlatformAdmin: Boolean(defaultUser.isPlatformAdmin),
          mustChangePassword: false,
          department: userDept ? { id: userDept.id, name: userDept.name, color: userDept.color, icon: userDept.icon } : null
        },
        company: defaultCompany,
        role: membership ? membership.role : 'owner',
        department: userDept ? { id: userDept.id, name: userDept.name, color: userDept.color, icon: userDept.icon } : null,
        memberships: [{
          id: membership ? membership.id : 'mem-demo',
          companyId: defaultCompany.id,
          companyName: defaultCompany.name,
          role: membership ? membership.role : 'owner',
          isCurrent: true
        }]
      });
    }

    // GET /api/auth/me (Mevcut Oturum Bilgisi)
    if (pathname === '/api/auth/me' && req.method === 'GET') {
      const auth = resolveAuthContext(req, db);
      if (!auth) {
        return jsonResponse(res, 401, { error: 'Oturum açmanız gerekiyor.' });
      }

      const userDept = (db.departments || []).find(d =>
        d.companyId === auth.companyId && (
          d.id === (auth.membership ? auth.membership.departmentId : null) ||
          (Array.isArray(d.assignedUserIds) && d.assignedUserIds.includes(auth.user.id))
        )
      );

      return jsonResponse(res, 200, {
        user: {
          ...auth.user,
          department: userDept ? { id: userDept.id, name: userDept.name, color: userDept.color, icon: userDept.icon } : null
        },
        company: auth.company,
        role: auth.membership ? auth.membership.role : null,
        department: userDept ? { id: userDept.id, name: userDept.name, color: userDept.color, icon: userDept.icon } : null,
        memberships: auth.memberships.map(m => {
          const comp = (db.companies || []).find(c => c.id === m.companyId);
          return {
            id: m.id,
            companyId: m.companyId,
            companyName: comp ? comp.name : 'Bilinmeyen Şirket',
            role: m.role,
            isCurrent: m.companyId === auth.companyId
          };
        })
      });
    }

    // POST /api/auth/switch-company (Şirket Değiştirici)
    if (pathname === '/api/auth/switch-company' && req.method === 'POST') {
      const auth = resolveAuthContext(req, db);
      if (!auth) return jsonResponse(res, 401, { error: 'Oturum açmanız gerekiyor.' });

      const body = await parseBody(req);
      const { targetCompanyId } = body;

      const targetMembership = auth.memberships.find(m => m.companyId === targetCompanyId);
      if (!targetMembership) {
        return jsonResponse(res, 403, { error: 'Bu şirkete erişim izniniz bulunmuyor.' });
      }

      const targetCompany = (db.companies || []).find(c => c.id === targetCompanyId);
      const newToken = createToken({
        userId: auth.user.id,
        companyId: targetCompanyId,
        role: targetMembership.role
      });

      return jsonResponse(res, 200, {
        token: newToken,
        company: targetCompany,
        role: targetMembership.role
      });
    }

    // POST /api/auth/change-password
    if (pathname === '/api/auth/change-password' && req.method === 'POST') {
      const auth = resolveAuthContext(req, db);
      if (!auth) return jsonResponse(res, 401, { error: 'Oturum açmanız gerekiyor.' });

      const body = await parseBody(req);
      const { currentPassword, newPassword } = body;

      if (!newPassword || newPassword.length < 6) {
        return jsonResponse(res, 400, { error: 'Yeni parola en az 6 karakter olmalıdır.' });
      }

      return withDBLock(async (lockedDb, save) => {
        const u = (lockedDb.users || []).find(user => user.id === auth.user.id);
        if (!u) return jsonResponse(res, 404, { error: 'Kullanıcı bulunamadı.' });

        if (!u.mustChangePassword && !verifyPassword(currentPassword, u.passwordHash)) {
          return jsonResponse(res, 400, { error: 'Mevcut parolanız hatalı.' });
        }

        u.passwordHash = hashPassword(newPassword);
        u.mustChangePassword = false;
        u.updatedAt = new Date().toISOString();
        save(lockedDb);

        return jsonResponse(res, 200, { success: true, message: 'Parolanız başarıyla güncellendi.' });
      });
    }

    // GET /api/auth/invitation-info (Davet Bilgisini Doğrula ve Getir)
    if (pathname === '/api/auth/invitation-info' && req.method === 'GET') {
      const rawToken = (query.token || '').trim();
      if (!rawToken) {
        return jsonResponse(res, 400, { error: 'Davet token gereklidir.' });
      }

      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const invitation = (db.invitations || []).find(
        inv => (inv.tokenHash === tokenHash || inv.token === rawToken)
      );

      if (!invitation) {
        return jsonResponse(res, 404, { error: 'Geçersiz veya silinmiş davet bağlantısı.' });
      }

      if (invitation.status !== 'pending') {
        return jsonResponse(res, 400, { error: 'Bu davet bağlantısı daha önce kullanılmış veya iptal edilmiş.' });
      }

      if (new Date(invitation.expiresAt) < new Date()) {
        return jsonResponse(res, 400, { error: 'Bu davet bağlantısının geçerlilik süresi dolmuş.' });
      }

      const company = (db.companies || []).find(c => c.id === invitation.companyId);

      return jsonResponse(res, 200, {
        success: true,
        email: invitation.email,
        role: invitation.role,
        companyName: company ? company.name : 'Emlak Ofisi',
        companyCity: company ? company.city : '',
        expiresAt: invitation.expiresAt
      });
    }

    // POST /api/auth/accept-invitation (Davet Kabulü & Kayıt)
    if (pathname === '/api/auth/accept-invitation' && req.method === 'POST') {
      const body = await parseBody(req);
      const { token, fullName, password, phone } = body;

      if (!token || !password || !fullName) {
        return jsonResponse(res, 400, { error: 'Davet token, ad soyad ve parola zorunludur.' });
      }

      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const invitation = (db.invitations || []).find(
        inv => (inv.tokenHash === tokenHash || inv.token === token) && inv.status === 'pending'
      );

      if (!invitation) {
        return jsonResponse(res, 400, { error: 'Geçersiz veya kullanılmış davet bağlantısı.' });
      }

      if (new Date(invitation.expiresAt) < new Date()) {
        return jsonResponse(res, 400, { error: 'Bu davet bağlantısının süresi dolmuş.' });
      }

      return withDBLock(async (lockedDb, save) => {
        const now = new Date().toISOString();
        const inv = (lockedDb.invitations || []).find(i => i.id === invitation.id);
        inv.status = 'accepted';
        inv.acceptedAt = now;

        const normalizedEmail = inv.email.toLowerCase().trim();
        let user = (lockedDb.users || []).find(u => u.email.toLowerCase() === normalizedEmail);

        if (!user) {
          user = {
            id: `user-${crypto.randomUUID()}`,
            email: normalizedEmail,
            passwordHash: hashPassword(password),
            fullName: fullName.trim(),
            phone: phone || '',
            isPlatformAdmin: false,
            mustChangePassword: false,
            status: 'active',
            createdAt: now,
            updatedAt: now
          };
          lockedDb.users.unshift(user);
        }

        // Şirket üyeliği oluştur
        const membership = {
          id: `mem-${crypto.randomUUID()}`,
          userId: user.id,
          companyId: inv.companyId,
          role: inv.role || 'agent',
          status: 'active',
          isCurrent: true,
          permissions: {
            canManageCompany: false,
            canManageMembers: false,
            canManageProperties: true,
            canManageCustomers: true,
            canShareToPool: false,
            canBackupRestore: false
          },
          joinedAt: now
        };
        lockedDb.companyMemberships = lockedDb.companyMemberships || [];
        lockedDb.companyMemberships.unshift(membership);

        save(lockedDb);

        const company = (lockedDb.companies || []).find(c => c.id === inv.companyId);
        const authToken = createToken({
          userId: user.id,
          companyId: inv.companyId,
          role: membership.role
        });

        return jsonResponse(res, 200, {
          success: true,
          token: authToken,
          user: { id: user.id, email: user.email, fullName: user.fullName },
          company,
          role: membership.role
        });
      });
    }

    // ─── AUTH & TENANT GÜVENLİK DUVARI ─────────────────────────
    // Aşağıdaki tüm API'ler oturum açmış kullanıcı ve aktif şirket gerektirir.
    const auth = resolveAuthContext(req, db);
    if (!auth) {
      return jsonResponse(res, 401, { error: 'Bu işlem için oturum açmanız gerekmektedir.' });
    }

    const currentCompanyId = auth.companyId;
    const currentUserId = auth.user.id;
    const currentRole = auth.membership ? auth.membership.role : 'agent';
    const isOwnerOrAdmin = currentRole === 'owner' || currentRole === 'admin' || auth.user.isPlatformAdmin || Boolean(auth.membership?.permissions?.canManageMembers);

    // ─── ŞİRKET & EKİP YÖNETİMİ ───────────────────────────────

    // GET /api/companies/current
    if (pathname === '/api/companies/current' && req.method === 'GET') {
      return jsonResponse(res, 200, auth.company);
    }

    // PUT /api/companies/current
    if (pathname === '/api/companies/current' && req.method === 'PUT') {
      if (!isOwnerOrAdmin) return jsonResponse(res, 403, { error: 'Şirket ayarlarını değiştirme yetkiniz yok.' });
      const body = await parseBody(req);
      return withDBLock(async (lockedDb, save) => {
        const comp = (lockedDb.companies || []).find(c => c.id === currentCompanyId);
        if (!comp) return jsonResponse(res, 404, { error: 'Şirket bulunamadı.' });

        if (body.name) comp.name = body.name.trim();
        if (body.phone) comp.phone = body.phone.trim();
        if (body.email) comp.email = body.email.trim();
        if (body.city) comp.city = body.city.trim();
        if (body.address) comp.address = body.address.trim();
        if (body.taxNumber) comp.taxNumber = body.taxNumber.trim();
        if (body.settings) comp.settings = { ...comp.settings, ...body.settings };
        comp.updatedAt = new Date().toISOString();

        save(lockedDb);
        return jsonResponse(res, 200, comp);
      });
    }

    // GET /api/companies/members (Çalışan Listesi)
    if (pathname === '/api/companies/members' && req.method === 'GET') {
      const memberships = (db.companyMemberships || []).filter(
        m => m.companyId === currentCompanyId && m.status === 'active'
      );
      const companyDepts = (db.departments || []).filter(d => d.companyId === currentCompanyId);

      const members = memberships.map(m => {
        const u = (db.users || []).find(user => user.id === m.userId);
        const dept = companyDepts.find(d => d.id === m.departmentId || (Array.isArray(d.assignedUserIds) && d.assignedUserIds.includes(m.userId)));
        return {
          id: m.id,
          userId: m.userId,
          fullName: u ? u.fullName : 'Bilinmeyen Kullanıcı',
          email: u ? u.email : '',
          phone: u ? u.phone : '',
          role: m.role,
          departmentId: dept ? dept.id : null,
          departmentName: dept ? dept.name : null,
          departmentColor: dept ? dept.color : null,
          departmentIcon: dept ? dept.icon : null,
          joinedAt: m.joinedAt
        };
      });
      return jsonResponse(res, 200, members);
    }

    // POST /api/companies/invitations (Çalışan Davet Et)
    if (pathname === '/api/companies/invitations' && req.method === 'POST') {
      if (!isOwnerOrAdmin) return jsonResponse(res, 403, { error: 'Çalışan davet etme yetkiniz yok.' });
      const body = await parseBody(req);
      const { email, role } = body;

      if (!email) return jsonResponse(res, 400, { error: 'Davet edilecek e-posta adresi gereklidir.' });

      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const newInvitation = {
        id: `inv-${crypto.randomUUID()}`,
        companyId: currentCompanyId,
        invitedByUserId: currentUserId,
        email: email.toLowerCase().trim(),
        role: role === 'admin' ? 'admin' : 'agent',
        tokenHash,
        token: rawToken,
        expiresAt,
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      return withDBLock(async (lockedDb, save) => {
        lockedDb.invitations = lockedDb.invitations || [];
        lockedDb.invitations.unshift(newInvitation);
        save(lockedDb);

        return jsonResponse(res, 201, {
          success: true,
          invitation: newInvitation,
          inviteToken: rawToken, // İstemciye kopyalanabilir link oluşturması için düz hali bir kez verilir
          inviteLink: `/index.html?inviteToken=${rawToken}`
        });
      });
    }

    // GET /api/companies/invitations (Bekleyen Davetler)
    if (pathname === '/api/companies/invitations' && req.method === 'GET') {
      const list = (db.invitations || []).filter(
        i => i.companyId === currentCompanyId && i.status === 'pending'
      );
      return jsonResponse(res, 200, list);
    }

    // DELETE /api/companies/invitations/:id (Davet İptal)
    const invDelMatch = pathname.match(/^\/api\/companies\/invitations\/([^\/]+)$/);
    if (invDelMatch && req.method === 'DELETE') {
      if (!isOwnerOrAdmin) return jsonResponse(res, 403, { error: 'Davet iptal etme yetkiniz yok.' });
      const id = invDelMatch[1];
      return withDBLock(async (lockedDb, save) => {
        const inv = (lockedDb.invitations || []).find(i => i.id === id && i.companyId === currentCompanyId);
        if (!inv) return jsonResponse(res, 404, { error: 'Davet bulunamadı.' });
        inv.status = 'revoked';
        save(lockedDb);
        return jsonResponse(res, 200, { success: true, message: 'Davet iptal edildi.' });
      });
    }

    // ─── DEPARTMANLAR & ORGANİZASYON YÖNETİMİ ──────────────────
    // GET /api/departments (Departman Listesi)
    if (pathname === '/api/departments' && req.method === 'GET') {
      const depts = (db.departments || []).filter(d => d.companyId === currentCompanyId);
      const companyProps = (db.properties || []).filter(p => p.companyId === currentCompanyId);
      const companyCusts = (db.customers || []).filter(c => c.companyId === currentCompanyId);
      const companyMembers = (db.companyMemberships || []).filter(m => m.companyId === currentCompanyId && m.status === 'active');

      const enriched = depts.map(d => {
        const assignedIds = Array.isArray(d.assignedUserIds) ? d.assignedUserIds : [];
        const memberUserIds = new Set(assignedIds);
        companyMembers.forEach(m => {
          if (m.departmentId === d.id) memberUserIds.add(m.userId);
        });

        const assignedUsers = Array.from(memberUserIds).map(uid => {
          const u = (db.users || []).find(user => user.id === uid);
          const m = companyMembers.find(mem => mem.userId === uid);
          return {
            id: uid,
            fullName: u ? u.fullName : 'Danışman',
            email: u ? u.email : '',
            phone: u ? u.phone : '',
            role: m ? m.role : 'agent'
          };
        });

        const leader = d.leaderUserId ? (db.users || []).find(u => u.id === d.leaderUserId) : null;
        const propCount = companyProps.filter(p => memberUserIds.has(p.createdById)).length;
        const custCount = companyCusts.filter(c => memberUserIds.has(c.createdById)).length;

        return {
          ...d,
          assignedUserIds: Array.from(memberUserIds),
          members: assignedUsers,
          memberCount: assignedUsers.length,
          leader: leader ? { id: leader.id, fullName: leader.fullName, email: leader.email } : null,
          propertiesCount: propCount,
          customersCount: custCount
        };
      });

      return jsonResponse(res, 200, enriched);
    }

    // POST /api/departments (Yeni Departman Oluştur)
    if (pathname === '/api/departments' && req.method === 'POST') {
      if (!isOwnerOrAdmin) {
        return jsonResponse(res, 403, { error: 'Departman ayarları ve yönetimi yalnızca Şirket Sahibi / Yönetici yetkisindedir.' });
      }
      const body = await parseBody(req);
      const { name, icon, color, description, leaderUserId, customCriteria, assignedUserIds } = body;

      if (!name || !name.trim()) {
        return jsonResponse(res, 400, { error: 'Departman adı zorunludur.' });
      }

      return withDBLock(async (lockedDb, save) => {
        lockedDb.departments = lockedDb.departments || [];

        const newDept = {
          id: `dept-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
          companyId: currentCompanyId,
          name: name.trim(),
          icon: icon ? icon.trim() : '🏛️',
          color: color ? color.trim() : '#10b981',
          description: description ? description.trim() : '',
          leaderUserId: leaderUserId || null,
          customCriteria: customCriteria || {
            focusType: '',
            targetMonthlyVolume: '',
            targetDeals: '',
            defaultSplit: '50/50',
            region: ''
          },
          assignedUserIds: Array.isArray(assignedUserIds) ? assignedUserIds : [],
          createdById: currentUserId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        lockedDb.departments.unshift(newDept);

        // Sync memberships
        if (newDept.assignedUserIds.length > 0) {
          lockedDb.companyMemberships = lockedDb.companyMemberships || [];
          lockedDb.companyMemberships.forEach(m => {
            if (m.companyId === currentCompanyId && newDept.assignedUserIds.includes(m.userId)) {
              m.departmentId = newDept.id;
            }
          });
        }

        save(lockedDb);
        return jsonResponse(res, 201, { success: true, message: 'Departman başarıyla oluşturuldu.', department: newDept });
      });
    }

    // PUT /api/departments/:id (Departman Güncelle)
    const deptPutMatch = pathname.match(/^\/api\/departments\/([^\/]+)$/);
    if (deptPutMatch && req.method === 'PUT') {
      if (!isOwnerOrAdmin) {
        return jsonResponse(res, 403, { error: 'Departman ayarları ve yönetimi yalnızca Şirket Sahibi / Yönetici yetkisindedir.' });
      }
      const id = deptPutMatch[1];
      const body = await parseBody(req);

      return withDBLock(async (lockedDb, save) => {
        lockedDb.departments = lockedDb.departments || [];
        const dept = lockedDb.departments.find(d => d.id === id && d.companyId === currentCompanyId);
        if (!dept) return jsonResponse(res, 404, { error: 'Departman bulunamadı.' });

        if (body.name) dept.name = body.name.trim();
        if (body.icon) dept.icon = body.icon.trim();
        if (body.color) dept.color = body.color.trim();
        if (body.description !== undefined) dept.description = body.description.trim();
        if (body.leaderUserId !== undefined) dept.leaderUserId = body.leaderUserId || null;
        if (body.customCriteria !== undefined) dept.customCriteria = { ...dept.customCriteria, ...body.customCriteria };

        if (Array.isArray(body.assignedUserIds)) {
          dept.assignedUserIds = body.assignedUserIds;

          // Sync memberships
          lockedDb.companyMemberships = lockedDb.companyMemberships || [];
          lockedDb.companyMemberships.forEach(m => {
            if (m.companyId === currentCompanyId) {
              if (dept.assignedUserIds.includes(m.userId)) {
                m.departmentId = dept.id;
              } else if (m.departmentId === dept.id) {
                m.departmentId = null;
              }
            }
          });
        }

        dept.updatedAt = new Date().toISOString();
        save(lockedDb);
        return jsonResponse(res, 200, { success: true, message: 'Departman ayarları güncellendi.', department: dept });
      });
    }

    // DELETE /api/departments/:id (Departman Sil)
    if (deptPutMatch && req.method === 'DELETE') {
      if (!isOwnerOrAdmin) {
        return jsonResponse(res, 403, { error: 'Departman silme yetkisi yalnızca Şirket Sahibi / Yönetici yetkisindedir.' });
      }
      const id = deptPutMatch[1];

      return withDBLock(async (lockedDb, save) => {
        lockedDb.departments = lockedDb.departments || [];
        const idx = lockedDb.departments.findIndex(d => d.id === id && d.companyId === currentCompanyId);
        if (idx === -1) return jsonResponse(res, 404, { error: 'Departman bulunamadı.' });

        lockedDb.departments.splice(idx, 1);

        // Clear memberships
        lockedDb.companyMemberships = lockedDb.companyMemberships || [];
        lockedDb.companyMemberships.forEach(m => {
          if (m.companyId === currentCompanyId && m.departmentId === id) {
            m.departmentId = null;
          }
        });

        save(lockedDb);
        return jsonResponse(res, 200, { success: true, message: 'Departman başarıyla silindi.' });
      });
    }

    // POST /api/departments/:id/assign (Departmana Danışman Ata)
    const deptAssignMatch = pathname.match(/^\/api\/departments\/([^\/]+)\/assign$/);
    if (deptAssignMatch && req.method === 'POST') {
      if (!isOwnerOrAdmin) {
        return jsonResponse(res, 403, { error: 'Danışman atama yetkisi yalnızca Şirket Sahibi / Yönetici yetkisindedir.' });
      }
      const id = deptAssignMatch[1];
      const body = await parseBody(req);
      const userIds = Array.isArray(body.userIds) ? body.userIds : [];

      return withDBLock(async (lockedDb, save) => {
        lockedDb.departments = lockedDb.departments || [];
        const dept = lockedDb.departments.find(d => d.id === id && d.companyId === currentCompanyId);
        if (!dept) return jsonResponse(res, 404, { error: 'Departman bulunamadı.' });

        lockedDb.companyMemberships = lockedDb.companyMemberships || [];

        // Hem userId hem de membershipId destekle, temiz userId setine çevir
        const normalizedUserIds = new Set();
        userIds.forEach(rawId => {
          const mem = lockedDb.companyMemberships.find(m => (m.id === rawId || m.userId === rawId) && m.companyId === currentCompanyId);
          if (mem) {
            normalizedUserIds.add(mem.userId);
          } else {
            normalizedUserIds.add(rawId);
          }
        });

        dept.assignedUserIds = Array.from(normalizedUserIds);

        // Sync memberships
        lockedDb.companyMemberships.forEach(m => {
          if (m.companyId === currentCompanyId) {
            if (normalizedUserIds.has(m.userId)) {
              m.departmentId = dept.id;
            } else if (m.departmentId === dept.id) {
              m.departmentId = null;
            }
          }
        });

        dept.updatedAt = new Date().toISOString();
        save(lockedDb);
        return jsonResponse(res, 200, { success: true, message: 'Danışmanlar departmana başarıyla atandı.', department: dept });
      });
    }

    // PUT /api/companies/members/:id/department (Tekil Danışman Departman Değiştir)
    const memberDeptMatch = pathname.match(/^\/api\/companies\/members\/([^\/]+)\/department$/);
    if (memberDeptMatch && req.method === 'PUT') {
      if (!isOwnerOrAdmin) {
        return jsonResponse(res, 403, { error: 'Departman atama yetkisi yalnızca Şirket Sahibi / Yönetici yetkisindedir.' });
      }
      const memberId = memberDeptMatch[1];
      const body = await parseBody(req);
      const targetDeptId = body.departmentId || null;

      return withDBLock(async (lockedDb, save) => {
        lockedDb.companyMemberships = lockedDb.companyMemberships || [];
        const mem = lockedDb.companyMemberships.find(m => (m.id === memberId || m.userId === memberId) && m.companyId === currentCompanyId);
        if (!mem) return jsonResponse(res, 404, { error: 'Çalışan kaydı bulunamadı.' });

        mem.departmentId = targetDeptId;

        // Departmanların assignedUserIds listesini de güncelle
        lockedDb.departments = lockedDb.departments || [];
        lockedDb.departments.forEach(d => {
          if (d.companyId === currentCompanyId) {
            d.assignedUserIds = (d.assignedUserIds || []).filter(uid => uid !== mem.userId);
            if (targetDeptId && d.id === targetDeptId) {
              if (!d.assignedUserIds.includes(mem.userId)) {
                d.assignedUserIds.push(mem.userId);
              }
            }
          }
        });

        save(lockedDb);
        return jsonResponse(res, 200, { success: true, message: 'Çalışan departmanı güncellendi.' });
      });
    }

    // ─── İSTATİSTİKLER (ŞİRKET KAPSAMLI) ───────────────────────
    if (pathname === '/api/stats' && req.method === 'GET') {
      const ownProps = (db.properties || []).filter(
        p => p.companyId === currentCompanyId && !p.isArchived
      );
      const totalVal = ownProps.reduce((acc, p) => acc + (p.price || 0), 0);
      const classACount = ownProps.filter(p => p.priceClass === 'A').length;

      const ownCusts = (db.customers || []).filter(c => c.companyId === currentCompanyId);

      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const ownTasks = (db.followUps || []).filter(f => f.companyId === currentCompanyId);
      const todayTasks = ownTasks.filter(f => !f.isCompleted && f.dueDate && f.dueDate.slice(0, 10) === todayStr);
      const pendingTasks = ownTasks.filter(f => !f.isCompleted);
      const overdueTasks = ownTasks.filter(f => !f.isCompleted && f.dueDate && f.dueDate.slice(0, 10) < todayStr);

      // Payidar Yönetim ve Haftalık Performans Göstergeleri
      const newCustomersThisWeek = ownCusts.filter(c => c.createdAt && new Date(c.createdAt) >= oneWeekAgo).length;
      const newPropertiesThisWeek = ownProps.filter(p => p.createdAt && new Date(p.createdAt) >= oneWeekAgo).length;
      const weeklyShowings = ownTasks.filter(f => f.type === 'ziyaret' && f.dueDate && new Date(f.dueDate) >= oneWeekAgo).length;
      const customersInOfferStage = ownCusts.filter(c => ['teklif', 'gosterim'].includes(c.pipelineStatus || c.status)).length;

      // Müşteri Sınıf Dağılımı (A, B, C, D)
      const customerClassCounts = { A: 0, B: 0, C: 0, D: 0 };
      ownCusts.forEach(c => {
        const cls = (c.customerClass || 'B').toUpperCase();
        if (customerClassCounts[cls] !== undefined) customerClassCounts[cls]++;
        else customerClassCounts[cls] = 1;
      });

      // Müşteri Yaşam Döngüsü Dağılımı
      const customerPipelineCounts = { yeni: 0, aktif: 0, gosterim: 0, teklif: 0, kapandi_basarili: 0, kaybedildi: 0, pasif: 0 };
      ownCusts.forEach(c => {
        const st = c.pipelineStatus || c.status || 'aktif';
        customerPipelineCounts[st] = (customerPipelineCounts[st] || 0) + 1;
      });

      // Portföy Kalite Kontrol Ortalaması
      const totalReadiness = ownProps.reduce((acc, p) => {
        const score = p.readinessScore != null ? p.readinessScore : (calculateReadiness(p).score);
        return acc + score;
      }, 0);
      const readinessAvg = ownProps.length > 0 ? (totalReadiness / ownProps.length).toFixed(1) : '5.0';

      // Danışman Kişisel İstatistikleri
      const myProps = ownProps.filter(p => p.createdById === currentUserId);
      const myCusts = ownCusts.filter(c => c.createdById === currentUserId);
      const myTasks = ownTasks.filter(f => f.assignedToUserId === currentUserId);
      const myTodayTasks = myTasks.filter(f => !f.isCompleted && f.dueDate && f.dueDate.slice(0, 10) === todayStr);
      const myPendingTasks = myTasks.filter(f => !f.isCompleted);
      const myOverdueTasks = myTasks.filter(f => !f.isCompleted && f.dueDate && f.dueDate.slice(0, 10) < todayStr);

      // Havuzdaki kendi paylaşımlarımız
      const mySharedPropsCount = ownProps.filter(p => p.shareStatus === 'shared_pool').length;
      const mySharedCustsCount = ownCusts.filter(c => c.shareStatus === 'shared_pool').length;
      const myOwnSharedPropsCount = myProps.filter(p => p.shareStatus === 'shared_pool').length;
      const myOwnSharedCustsCount = myCusts.filter(c => c.shareStatus === 'shared_pool').length;

      // Ortak havuz sayıları
      const poolPropsCount = (db.properties || []).filter(
        p => p.companyId !== currentCompanyId && !p.isArchived && canAccessProperty(p, currentCompanyId, db)
      ).length;
      const poolCustsCount = (db.customers || []).filter(
        c => c.companyId !== currentCompanyId && canAccessCustomer(c, currentCompanyId, db)
      ).length;

      const statusCounts = {};
      ownProps.forEach(p => { statusCounts[p.status] = (statusCounts[p.status] || 0) + 1; });

      const typeCounts = {};
      ownProps.forEach(p => { typeCounts[p.type] = (typeCounts[p.type] || 0) + 1; });

      const roomCounts = {};
      ownProps.forEach(p => { if (p.rooms) roomCounts[p.rooms] = (roomCounts[p.rooms] || 0) + 1; });

      const districts = [...new Set(ownProps.map(p => p.district).filter(Boolean))].sort();
      const neighborhoods = [...new Set(ownProps.map(p => p.neighborhood).filter(Boolean))].sort();

      return jsonResponse(res, 200, {
        totalProperties: ownProps.length,
        totalPortfolioValue: totalVal,
        totalCustomers: ownCusts.length,
        classACount,
        todayFollowUpsCount: todayTasks.length,
        pendingFollowUpsCount: pendingTasks.length,
        overdueTasksCount: overdueTasks.length,
        newCustomersThisWeek,
        newPropertiesThisWeek,
        weeklyShowings,
        customersInOfferStage,
        customerClassCounts,
        customerPipelineCounts,
        readinessAvg,
        poolPropertiesCount: poolPropsCount,
        poolCustomersCount: poolCustsCount,
        myPropertiesCount: myProps.length,
        myCustomersCount: myCusts.length,
        myTodayFollowUpsCount: myTodayTasks.length,
        myPendingFollowUpsCount: myPendingTasks.length,
        myOverdueTasksCount: myOverdueTasks.length,
        mySharedPropsCount,
        mySharedCustsCount,
        myOwnSharedPropsCount,
        myOwnSharedCustsCount,
        currentRole,
        isOwnerOrAdmin,
        statusCounts,
        typeCounts,
        roomCounts,
        districts,
        neighborhoods
      });
    }

    // ─── İLANLAR (PROPERTIES) ──────────────────────────────────
    if (pathname === '/api/properties') {
      if (req.method === 'GET') {
        const scope = query.scope || 'mine'; // 'mine' | 'pool' | 'all' | 'my_pool'
        let list = (db.properties || []).filter(p => {
          if (scope === 'pool') {
            return p.companyId !== currentCompanyId && canAccessProperty(p, currentCompanyId, db);
          }
          if (scope === 'my_pool') {
            // Şirketin B2B ortak havuza açtığı aktif ilanlar
            return p.companyId === currentCompanyId && p.shareStatus === 'shared_pool';
          }
          if (scope === 'all') {
            return p.companyId === currentCompanyId || canAccessProperty(p, currentCompanyId, db);
          }
          // Varsayılan: sadece kendi şirketimin ilanları
          return p.companyId === currentCompanyId;
        });

        // Arşiv filtresi
        if (query.includeArchived !== 'true') {
          list = list.filter(p => !p.isArchived);
        }

        // Filtreler
        if (query.type) {
          const t = trLower(query.type);
          list = list.filter(p => p.type && (trLower(p.type) === t || trLower(p.type).includes(t)));
        }
        if (query.status) {
          list = list.filter(p => p.status === query.status);
        }
        if (query.city) {
          list = list.filter(p => p.city && trLower(p.city) === trLower(query.city));
        }
        if (query.district) {
          list = list.filter(p => p.district && trLower(p.district) === trLower(query.district));
        }
        if (query.neighborhood) {
          list = list.filter(p => p.neighborhood && trLower(p.neighborhood).includes(trLower(query.neighborhood)));
        }
        if (query.minPrice) {
          const minP = Number(query.minPrice);
          if (!isNaN(minP)) list = list.filter(p => (p.price || 0) >= minP);
        }
        if (query.maxPrice) {
          const maxP = Number(query.maxPrice);
          if (!isNaN(maxP)) list = list.filter(p => (p.price || 0) <= maxP);
        }
        if (query.rooms) {
          const selectedRooms = query.rooms.split(',').map(r => r.trim().toLowerCase());
          list = list.filter(p => selectedRooms.includes(String(p.rooms || '').trim().toLowerCase()));
        }
        if (query.search) {
          const s = trLower(query.search);
          list = list.filter(p =>
            (p.title && trLower(p.title).includes(s)) ||
            (p.district && trLower(p.district).includes(s)) ||
            (p.portfolioCode && trLower(p.portfolioCode).includes(s))
          );
        }

        // Sadece benim ilanlarım filtresi (Danışman filtresi)
        if (query.onlyMine === 'true') {
          list = list.filter(p => p.createdById === currentUserId);
        }

        // Departman filtresi
        if (query.department) {
          list = list.filter(p => {
            const mem = (db.companyMemberships || []).find(m => m.companyId === p.companyId && m.userId === p.createdById);
            return mem && mem.departmentId === query.department;
          });
        }

        // Şirket ve Danışman bilgisi ekle
        const enrichedList = list.map(p => {
          const isOwn = p.companyId === currentCompanyId;
          const ownerComp = !isOwn ? (db.companies || []).find(c => c.id === p.companyId) : null;
          const creatorUser = (db.users || []).find(u => u.id === p.createdById);
          const creatorMem = (db.companyMemberships || []).find(m => m.companyId === p.companyId && m.userId === p.createdById);
          const dept = creatorMem && creatorMem.departmentId ? (db.departments || []).find(d => d.id === creatorMem.departmentId) : null;
          return {
            ...p,
            isOwnListing: isOwn,
            createdByName: creatorUser ? creatorUser.fullName : null,
            departmentId: dept ? dept.id : null,
            departmentName: dept ? dept.name : null,
            departmentIcon: dept ? dept.icon : null,
            departmentColor: dept ? dept.color : null,
            isCreatedByMe: p.createdById === currentUserId,
            canEditOrDelete: isOwnerOrAdmin || p.createdById === currentUserId,
            ownerCompanyName: ownerComp ? ownerComp.name : null,
            ownerCompanyPhone: ownerComp ? ownerComp.phone : null
          };
        });

        enrichedList.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        return jsonResponse(res, 200, enrichedList);
      }

      if (req.method === 'POST') {
        const body = await parseBody(req);
        return withDBLock(async (lockedDb, save) => {
          const readiness = calculateReadiness(body);
          const initialPrice = Number(body.price) || 0;
          const initialCurrency = body.currency || 'TRY';

          const newProperty = {
            id: body.id || 'prop-' + crypto.randomUUID(),
            companyId: currentCompanyId,
            createdById: currentUserId,
            shareStatus: 'private', // Varsayılan olarak her yeni ilan ÖZEL
            title: body.title || 'Başlıksız İlan',
            description: body.description || '',
            type: body.type || 'daire',
            status: body.status || 'satilik',
            price: initialPrice,
            currency: initialCurrency,
            portfolioCode: body.portfolioCode || `PORT-${Math.floor(100 + Math.random() * 900)}`,
            neighborhood: body.neighborhood || '',
            siteName: body.siteName || '',
            isSite: Boolean(body.isSite || (body.siteName && body.siteName.trim().length > 0)),
            district: body.district || '',
            city: body.city || 'İstanbul',
            address: body.address || '',
            buildingAge: body.buildingAge != null ? Number(body.buildingAge) : null,
            grossArea: body.grossArea != null ? Number(body.grossArea) : null,
            netArea: Number(body.netArea) || 0,
            floor: body.floor != null ? Number(body.floor) : null,
            totalFloors: body.totalFloors != null ? Number(body.totalFloors) : null,
            floorType: body.floorType || 'ara_kat',
            rooms: body.rooms ? String(body.rooms).trim() : '3+1',
            bathrooms: body.bathrooms != null ? Number(body.bathrooms) : 1,
            hasBalcony: body.hasBalcony != null ? Boolean(body.hasBalcony) : true,
            facade: body.facade || '',
            heating: body.heating || 'dogalgaz',
            hasElevator: Boolean(body.hasElevator),
            hasParking: Boolean(body.hasParking),
            furnishedStatus: body.furnishedStatus || 'esyasiz',
            features: Array.isArray(body.features) ? body.features : [],
            estimatedRent: body.estimatedRent != null ? Number(body.estimatedRent) : null,
            monthlyDues: body.monthlyDues != null ? Number(body.monthlyDues) : null,
            monthlyExpenses: body.monthlyExpenses != null ? Number(body.monthlyExpenses) : 0,
            tenantStatus: body.tenantStatus || 'bos',
            deedStatus: body.deedStatus || 'kat-mulkiyeti',
            legalEncumbrance: body.legalEncumbrance || 'Temiz Tapu (Şerh/İpotek Yok)',
            creditEligible: body.creditEligible != null ? Boolean(body.creditEligible) : true,
            isSwap: Boolean(body.isSwap),
            authorizationStatus: body.authorizationStatus || 'yetkili',
            saleReason: body.saleReason || '',
            negotiationMargin: body.negotiationMargin != null ? Number(body.negotiationMargin) : 0,
            urgencyLevel: body.urgencyLevel || 'orta',
            priceClass: body.priceClass || 'B',
            contactName: body.contactName || '',
            contactPhone: body.contactPhone || '',
            notes: body.notes || '',
            images: Array.isArray(body.images) ? body.images : [],
            readinessChecklist: readiness.checklist,
            readinessScore: readiness.score,
            readinessPercentage: readiness.percentage,
            priceHistory: Array.isArray(body.priceHistory) && body.priceHistory.length > 0 
              ? body.priceHistory 
              : [{
                  price: initialPrice,
                  currency: initialCurrency,
                  date: new Date().toISOString(),
                  note: 'İlk kayıt fiyatı'
                }],
            isFavorite: Boolean(body.isFavorite),
            isArchived: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };

          lockedDb.properties = lockedDb.properties || [];
          lockedDb.properties.unshift(newProperty);
          save(lockedDb);

          return jsonResponse(res, 201, newProperty);
        });
      }
    }

    // GET, PUT, DELETE /api/properties/:id
    const propMatch = pathname.match(/^\/api\/properties\/([^\/]+)$/);
    if (propMatch) {
      const id = propMatch[1];
      const index = (db.properties || []).findIndex(p => p.id === id);

      if (index === -1) return jsonResponse(res, 404, { error: 'İlan bulunamadı' });
      const targetProperty = db.properties[index];

      if (req.method === 'GET') {
        if (!canAccessProperty(targetProperty, currentCompanyId, db)) {
          return jsonResponse(res, 404, { error: 'İlan bulunamadı' }); // Bilerek 404
        }
        const isOwn = targetProperty.companyId === currentCompanyId;
        const ownerComp = !isOwn ? (db.companies || []).find(c => c.id === targetProperty.companyId) : null;
        const creatorUser = (db.users || []).find(u => u.id === targetProperty.createdById);
        return jsonResponse(res, 200, {
          ...targetProperty,
          isOwnListing: isOwn,
          createdByName: creatorUser ? creatorUser.fullName : null,
          isCreatedByMe: targetProperty.createdById === currentUserId,
          canEditOrDelete: isOwnerOrAdmin || targetProperty.createdById === currentUserId,
          ownerCompanyName: ownerComp ? ownerComp.name : null,
          ownerCompanyPhone: ownerComp ? ownerComp.phone : null
        });
      }

      // Güncelleme ve silme işlemleri YALNIZCA mülk sahibi şirket tarafından yapılabilir
      if (targetProperty.companyId !== currentCompanyId) {
        return jsonResponse(res, 403, { error: 'Bu ilanı düzenleme veya silme yetkiniz yok.' });
      }

      // Danışman kontrolü: Danışmanlar yalnızca kendi ekledikleri portföyleri düzenleyebilir veya silebilir
      if (!isOwnerOrAdmin && targetProperty.createdById && targetProperty.createdById !== currentUserId) {
        return jsonResponse(res, 403, { error: 'Gayrimenkul danışmanları yalnızca kendi ekledikleri portföyleri düzenleyebilir veya silebilir.' });
      }

      if (req.method === 'PUT') {
        const body = await parseBody(req);
        return withDBLock(async (lockedDb, save) => {
          const idx = (lockedDb.properties || []).findIndex(p => p.id === id);
          if (idx === -1) return jsonResponse(res, 404, { error: 'İlan bulunamadı' });

          const existingProp = lockedDb.properties[idx];
          const newPrice = body.price != null ? Number(body.price) : existingProp.price;
          const priceHistory = Array.isArray(existingProp.priceHistory) ? [...existingProp.priceHistory] : [];

          // Fiyat değişmişse tarihçeye otomatik ekle
          if (newPrice !== existingProp.price && newPrice > 0) {
            priceHistory.unshift({
              price: newPrice,
              currency: body.currency || existingProp.currency || 'TRY',
              oldPrice: existingProp.price,
              date: new Date().toISOString(),
              changedBy: currentUserId,
              note: body.priceChangeNote || 'Fiyat güncellendi'
            });
          }

          const merged = { ...existingProp, ...body, price: newPrice, priceHistory };
          const readiness = calculateReadiness(merged);

          lockedDb.properties[idx] = {
            ...merged,
            readinessChecklist: readiness.checklist,
            readinessScore: readiness.score,
            readinessPercentage: readiness.percentage,
            id: targetProperty.id, // ID ve şirket asla ezilemez
            companyId: targetProperty.companyId,
            createdById: (isOwnerOrAdmin && body.createdById) ? body.createdById : targetProperty.createdById,
            updatedAt: new Date().toISOString()
          };
          save(lockedDb);
          return jsonResponse(res, 200, lockedDb.properties[idx]);
        });
      }

      if (req.method === 'DELETE') {
        return withDBLock(async (lockedDb, save) => {
          const idx = (lockedDb.properties || []).findIndex(p => p.id === id);
          if (idx === -1) return jsonResponse(res, 404, { error: 'İlan bulunamadı' });
          lockedDb.properties.splice(idx, 1);
          // İlgili paylaşımları da temizle
          lockedDb.propertyShares = (lockedDb.propertyShares || []).filter(s => s.propertyId !== id);
          save(lockedDb);
          return jsonResponse(res, 200, { success: true, message: 'İlan silindi' });
        });
      }
    }

    // POST /api/properties/:id/share (İlan Paylaşımını Yönet: Aç / Kapat)
    const propShareMatch = pathname.match(/^\/api\/properties\/([^\/]+)\/share$/);
    if (propShareMatch && req.method === 'POST') {
      const id = propShareMatch[1];
      const prop = (db.properties || []).find(p => p.id === id);
      if (!prop || prop.companyId !== currentCompanyId) {
        return jsonResponse(res, 404, { error: 'İlan bulunamadı veya yetkiniz yok.' });
      }

      if (!isOwnerOrAdmin && !auth.membership?.permissions?.canShareToPool) {
        return jsonResponse(res, 403, { error: 'B2B Ortak Havuzda ilan paylaşma yetkisi yalnızca Şirket Sahibi ve Yöneticilere aittir.' });
      }

      const body = await parseBody(req);
      const { action, targetType, commissionSplit, targetCompanyIds } = body; // action: 'share' | 'revoke'

      return withDBLock(async (lockedDb, save) => {
        const p = (lockedDb.properties || []).find(item => item.id === id);
        lockedDb.propertyShares = lockedDb.propertyShares || [];

        if (action === 'revoke') {
          p.shareStatus = 'private';
          // Aktif paylaşımları iptal et
          lockedDb.propertyShares.forEach(s => {
            if (s.propertyId === id && s.status === 'active') {
              s.status = 'revoked';
              s.revokedAt = new Date().toISOString();
              s.revokedByUserId = currentUserId;
            }
          });
          save(lockedDb);
          return jsonResponse(res, 200, { success: true, shareStatus: 'private', message: 'Paylaşım iptal edildi.' });
        }

        // action === 'share'
        p.shareStatus = targetType === 'specific_companies' ? 'shared_specific' : 'shared_pool';
        const newShare = {
          id: `prop-share-${crypto.randomUUID()}`,
          propertyId: id,
          ownerCompanyId: currentCompanyId,
          createdById: currentUserId,
          targetType: targetType === 'specific_companies' ? 'specific_companies' : 'all_members',
          targetCompanyIds: Array.isArray(targetCompanyIds) ? targetCompanyIds : [],
          permissions: {
            canView: true,
            canContact: true,
            commissionSplit: commissionSplit || '50-50'
          },
          status: 'active',
          createdAt: new Date().toISOString()
        };

        lockedDb.propertyShares.unshift(newShare);
        save(lockedDb);

        return jsonResponse(res, 200, {
          success: true,
          shareStatus: p.shareStatus,
          share: newShare,
          message: 'İlan ortak havuza başarıyla açıldı.'
        });
      });
    }

    // POST /api/properties/:id/toggle-favorite
    const favMatch = pathname.match(/^\/api\/properties\/([^\/]+)\/toggle-favorite$/);
    if (favMatch && req.method === 'POST') {
      const id = favMatch[1];
      return withDBLock(async (lockedDb, save) => {
        const prop = (lockedDb.properties || []).find(p => p.id === id);
        if (!prop || !canAccessProperty(prop, currentCompanyId, lockedDb)) {
          return jsonResponse(res, 404, { error: 'İlan bulunamadı' });
        }
        prop.isFavorite = !prop.isFavorite;
        prop.updatedAt = new Date().toISOString();
        save(lockedDb);
        return jsonResponse(res, 200, { isFavorite: prop.isFavorite });
      });
    }

    // POST /api/properties/:id/toggle-archive
    const archiveMatch = pathname.match(/^\/api\/properties\/([^\/]+)\/toggle-archive$/);
    if (archiveMatch && req.method === 'POST') {
      const id = archiveMatch[1];
      return withDBLock(async (lockedDb, save) => {
        const prop = (lockedDb.properties || []).find(p => p.id === id);
        if (!prop || prop.companyId !== currentCompanyId) {
          return jsonResponse(res, 403, { error: 'Yalnızca kendi ilanınızı arşivleyebilirsiniz.' });
        }
        prop.isArchived = !prop.isArchived;
        prop.status = prop.isArchived ? 'arsiv' : 'satilik';
        if (prop.isArchived) prop.shareStatus = 'private'; // Arşivlenen ilan havuzdan düşer
        prop.updatedAt = new Date().toISOString();
        save(lockedDb);
        return jsonResponse(res, 200, { isArchived: prop.isArchived, status: prop.status });
      });
    }

    // ─── MÜŞTERİLER (CUSTOMERS) ────────────────────────────────
    if (pathname === '/api/customers') {
      if (req.method === 'GET') {
        const scope = query.scope || 'mine'; // 'mine' | 'pool' | 'all' | 'my_pool'

        let list = [];
        if (scope === 'pool') {
          // Ortak havuz: Yalnızca başka şirketlerin paylaştığı müşteriler (KVKK Maskeli)
          const poolCustomers = (db.customers || []).filter(
            c => c.companyId !== currentCompanyId && canAccessCustomer(c, currentCompanyId, db)
          );
          list = poolCustomers.map(c => {
            const ownerComp = (db.companies || []).find(comp => comp.id === c.companyId);
            return maskCustomerForPool(c, ownerComp);
          });
        } else if (scope === 'my_pool') {
          // Şirketin / Danışmanın ortak havuza açtığı müşteriler
          let mySharedCusts = (db.customers || []).filter(
            c => c.companyId === currentCompanyId && c.shareStatus === 'shared_pool'
          );
          if (query.onlyMine === 'true') {
            mySharedCusts = mySharedCusts.filter(c => c.createdById === currentUserId);
          }
          list = mySharedCusts.map(c => {
            const creatorUser = (db.users || []).find(u => u.id === c.createdById);
            const creatorMem = (db.companyMemberships || []).find(m => m.companyId === c.companyId && m.userId === c.createdById);
            const dept = creatorMem && creatorMem.departmentId ? (db.departments || []).find(d => d.id === creatorMem.departmentId) : null;
            return {
              ...c,
              isOwnCustomer: true,
              createdByName: creatorUser ? creatorUser.fullName : null,
              departmentId: dept ? dept.id : null,
              departmentName: dept ? dept.name : null,
              departmentIcon: dept ? dept.icon : null,
              departmentColor: dept ? dept.color : null,
              isCreatedByMe: c.createdById === currentUserId,
              canEditOrDelete: isOwnerOrAdmin || c.createdById === currentUserId
            };
          });
        } else {
          // 'mine': Sadece kendi şirketimin müşterileri (Tam verili)
          let ownCustomers = (db.customers || []).filter(c => c.companyId === currentCompanyId);
          if (query.onlyMine === 'true') {
            ownCustomers = ownCustomers.filter(c => c.createdById === currentUserId);
          }
          list = ownCustomers.map(c => {
            const creatorUser = (db.users || []).find(u => u.id === c.createdById);
            const creatorMem = (db.companyMemberships || []).find(m => m.companyId === c.companyId && m.userId === c.createdById);
            const dept = creatorMem && creatorMem.departmentId ? (db.departments || []).find(d => d.id === creatorMem.departmentId) : null;
            return {
              ...c,
              isOwnCustomer: true,
              createdByName: creatorUser ? creatorUser.fullName : null,
              departmentId: dept ? dept.id : null,
              departmentName: dept ? dept.name : null,
              departmentIcon: dept ? dept.icon : null,
              departmentColor: dept ? dept.color : null,
              isCreatedByMe: c.createdById === currentUserId,
              canEditOrDelete: isOwnerOrAdmin || c.createdById === currentUserId
            };
          });
        }

        if (query.department) {
          list = list.filter(c => {
            const mem = (db.companyMemberships || []).find(m => m.companyId === c.companyId && m.userId === c.createdById);
            return mem && mem.departmentId === query.department;
          });
        }

        if (query.status) list = list.filter(c => (c.pipelineStatus === query.status || c.status === query.status));
        if (query.customerClass) list = list.filter(c => c.customerClass === query.customerClass);
        if (query.leadSource) list = list.filter(c => c.leadSource === query.leadSource);
        if (query.purpose) list = list.filter(c => c.purpose === query.purpose);
        if (query.timeline) list = list.filter(c => c.purchaseTimeline === query.timeline);
        if (query.search) {
          const s = query.search.toLowerCase();
          list = list.filter(c =>
            (c.name && c.name.toLowerCase().includes(s)) ||
            (c.phone && c.phone.includes(s)) ||
            ((c.preferredDistricts || []).some(d => d.toLowerCase().includes(s)))
          );
        }

        list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        return jsonResponse(res, 200, list);
      }

      if (req.method === 'POST') {
        const body = await parseBody(req);
        return withDBLock(async (lockedDb, save) => {
          const maxBud = body.maxBudget != null ? Number(body.maxBudget) : (body.totalBudget != null ? Number(body.totalBudget) : null);
          const minBud = body.minBudget != null ? Number(body.minBudget) : null;
          const assignedClass = ['A', 'B', 'C', 'D'].includes(body.customerClass) ? body.customerClass : (body.customerClass || 'B');
          const pStatus = body.pipelineStatus || body.status || 'aktif';

          const newCustomer = {
            id: body.id || 'cust-' + crypto.randomUUID(),
            companyId: currentCompanyId,
            createdById: currentUserId,
            shareStatus: 'private', // Varsayılan olarak her yeni müşteri ÖZEL
            name: body.name || 'İsimsiz Müşteri',
            phone: body.phone || '',
            email: body.email || '',
            status: pStatus,
            pipelineStatus: pStatus,
            customerClass: assignedClass,
            leadSource: body.leadSource || 'telefon', // 'telefon' | 'ilan' | 'whatsapp' | 'ofis' | 'tavsiye' | 'sosyal_medya' | 'diger'
            minBudget: minBud,
            maxBudget: maxBud,
            totalBudget: maxBud,
            downPayment: body.downPayment != null ? Number(body.downPayment) : null,
            usesCredit: body.usesCredit != null ? Boolean(body.usesCredit) : null,
            purchaseTimeline: body.purchaseTimeline || '1-3-ay',
            preferredDistricts: Array.isArray(body.preferredDistricts)
              ? body.preferredDistricts
              : (typeof body.preferredDistricts === 'string' ? body.preferredDistricts.split(',').map(s => s.trim()).filter(Boolean) : []),
            preferredRooms: Array.isArray(body.preferredRooms)
              ? body.preferredRooms
              : (typeof body.preferredRooms === 'string' ? body.preferredRooms.split(',').map(s => s.trim()).filter(Boolean) : []),
            minNetArea: body.minNetArea != null ? Number(body.minNetArea) : null,
            maxBuildingAge: body.maxBuildingAge != null ? Number(body.maxBuildingAge) : null,
            maxMonthlyDues: body.maxMonthlyDues != null ? Number(body.maxMonthlyDues) : null,
            requiresSite: body.requiresSite != null ? Boolean(body.requiresSite) : null,
            requiresParking: body.requiresParking != null ? Boolean(body.requiresParking) : null,
            furnishedPreference: body.furnishedPreference || 'farketmez',
            purpose: body.purpose || 'oturum',
            investmentGoal: body.investmentGoal || null,
            kvkkConsent: body.kvkkConsent !== undefined ? Boolean(body.kvkkConsent) : true,
            contactPermission: body.contactPermission !== undefined ? Boolean(body.contactPermission) : true,
            notes: body.notes || '',
            lastContactDate: body.lastContactDate || new Date().toISOString(),
            nextMeetingDate: body.nextMeetingDate || null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };

          lockedDb.customers = lockedDb.customers || [];
          lockedDb.customers.unshift(newCustomer);
          save(lockedDb);

          return jsonResponse(res, 201, newCustomer);
        });
      }
    }

    // GET, PUT, DELETE /api/customers/:id
    const custMatch = pathname.match(/^\/api\/customers\/([^\/]+)$/);
    if (custMatch) {
      const id = custMatch[1];
      const targetCustomer = (db.customers || []).find(c => c.id === id);

      if (!targetCustomer) return jsonResponse(res, 404, { error: 'Müşteri bulunamadı' });

      if (req.method === 'GET') {
        if (targetCustomer.companyId === currentCompanyId) {
          return jsonResponse(res, 200, { ...targetCustomer, isOwnCustomer: true });
        }
        if (canAccessCustomer(targetCustomer, currentCompanyId, db)) {
          const ownerComp = (db.companies || []).find(comp => comp.id === targetCustomer.companyId);
          return jsonResponse(res, 200, maskCustomerForPool(targetCustomer, ownerComp));
        }
        return jsonResponse(res, 404, { error: 'Müşteri bulunamadı' });
      }

      if (targetCustomer.companyId !== currentCompanyId) {
        return jsonResponse(res, 403, { error: 'Yalnızca kendi şirketinize ait müşteriyi düzenleyebilirsiniz.' });
      }

      // Danışman kontrolü: Danışmanlar yalnızca kendi ekledikleri müşterileri düzenleyebilir veya silebilir
      if (!isOwnerOrAdmin && targetCustomer.createdById && targetCustomer.createdById !== currentUserId) {
        return jsonResponse(res, 403, { error: 'Gayrimenkul danışmanları yalnızca kendi ekledikleri müşteri kayıtlarını düzenleyebilir veya silebilir.' });
      }

      if (req.method === 'PUT') {
        const body = await parseBody(req);
        return withDBLock(async (lockedDb, save) => {
          const idx = (lockedDb.customers || []).findIndex(c => c.id === id);
          if (idx === -1) return jsonResponse(res, 404, { error: 'Müşteri bulunamadı' });

          const existingCust = lockedDb.customers[idx];
          const maxBud = body.maxBudget != null 
            ? Number(body.maxBudget) 
            : (body.totalBudget != null ? Number(body.totalBudget) : existingCust.totalBudget);

          lockedDb.customers[idx] = {
            ...existingCust,
            ...body,
            totalBudget: maxBud,
            maxBudget: maxBud,
            pipelineStatus: body.pipelineStatus || body.status || existingCust.pipelineStatus || existingCust.status,
            status: body.status || body.pipelineStatus || existingCust.status,
            id: targetCustomer.id,
            companyId: targetCustomer.companyId,
            createdById: (isOwnerOrAdmin && body.createdById) ? body.createdById : targetCustomer.createdById,
            updatedAt: new Date().toISOString()
          };
          save(lockedDb);
          return jsonResponse(res, 200, lockedDb.customers[idx]);
        });
      }

      if (req.method === 'DELETE') {
        return withDBLock(async (lockedDb, save) => {
          const idx = (lockedDb.customers || []).findIndex(c => c.id === id);
          if (idx === -1) return jsonResponse(res, 404, { error: 'Müşteri bulunamadı' });
          lockedDb.customers.splice(idx, 1);
          lockedDb.customerShares = (lockedDb.customerShares || []).filter(s => s.customerId !== id);
          save(lockedDb);
          return jsonResponse(res, 200, { success: true, message: 'Müşteri silindi' });
        });
      }
    }

    // POST /api/customers/:id/share (Müşteri Kriterlerini Havuzda Paylaş / İptal Et)
    const custShareMatch = pathname.match(/^\/api\/customers\/([^\/]+)\/share$/);
    if (custShareMatch && req.method === 'POST') {
      const id = custShareMatch[1];
      const cust = (db.customers || []).find(c => c.id === id);
      if (!cust || cust.companyId !== currentCompanyId) {
        return jsonResponse(res, 404, { error: 'Müşteri bulunamadı veya yetkiniz yok.' });
      }

      if (!isOwnerOrAdmin && !auth.membership?.permissions?.canShareToPool) {
        return jsonResponse(res, 403, { error: 'B2B Ortak Havuzda müşteri paylaşma yetkisi yalnızca Şirket Sahibi ve Yöneticilere aittir.' });
      }

      const body = await parseBody(req);
      const { action, legalBasisNote } = body; // action: 'share' | 'revoke'

      return withDBLock(async (lockedDb, save) => {
        const c = (lockedDb.customers || []).find(item => item.id === id);
        lockedDb.customerShares = lockedDb.customerShares || [];

        if (action === 'revoke') {
          c.shareStatus = 'private';
          lockedDb.customerShares.forEach(s => {
            if (s.customerId === id && s.status === 'active') {
              s.status = 'revoked';
              s.revokedAt = new Date().toISOString();
            }
          });
          save(lockedDb);
          return jsonResponse(res, 200, { success: true, shareStatus: 'private', message: 'Müşteri paylaşımı iptal edildi.' });
        }

        c.shareStatus = 'shared_pool';
        const newShare = {
          id: `cust-share-${crypto.randomUUID()}`,
          customerId: id,
          ownerCompanyId: currentCompanyId,
          createdById: currentUserId,
          targetType: 'all_members',
          legalBasis: legalBasisNote || 'KVKK Açık Rıza ve Hizmet Sözleşmesi Gereği İzinli Talep Eşleştirme',
          status: 'active',
          createdAt: new Date().toISOString()
        };

        lockedDb.customerShares.unshift(newShare);
        save(lockedDb);

        return jsonResponse(res, 200, {
          success: true,
          shareStatus: 'shared_pool',
          share: newShare,
          message: 'Müşteri talep kriterleri (kişisel veriler gizlenerek) ortak havuza açıldı.'
        });
      });
    }

    // ─── TAKİP & AJANDA (FOLLOW-UPS) ───────────────────────────
    if (pathname === '/api/followups') {
      if (req.method === 'GET') {
        let list = (db.followUps || []).filter(f => f.companyId === currentCompanyId);

        if (query.onlyMine === 'true') {
          list = list.filter(f => f.assignedToUserId === currentUserId);
        }
        if (query.pendingOnly === 'true') list = list.filter(f => !f.isCompleted);
        if (query.completedOnly === 'true') list = list.filter(f => f.isCompleted);
        if (query.todayOnly === 'true') {
          const todayStr = new Date().toISOString().slice(0, 10);
          list = list.filter(f => f.dueDate && f.dueDate.slice(0, 10) === todayStr);
        }
        if (query.propertyId) list = list.filter(f => f.relatedPropertyId === query.propertyId);
        if (query.customerId) list = list.filter(f => f.relatedCustomerId === query.customerId);

        list.sort((a, b) => new Date(a.dueDate || 0) - new Date(b.dueDate || 0));

        const enrichedFollowUps = list.map(f => {
          const assignedUser = (db.users || []).find(u => u.id === f.assignedToUserId);
          return {
            ...f,
            assignedToUserName: assignedUser ? assignedUser.fullName : null,
            isAssignedToMe: f.assignedToUserId === currentUserId
          };
        });

        return jsonResponse(res, 200, enrichedFollowUps);
      }

      if (req.method === 'POST') {
        const body = await parseBody(req);
        return withDBLock(async (lockedDb, save) => {
          const newFollowUp = {
            id: body.id || 'task-' + crypto.randomUUID(),
            companyId: currentCompanyId,
            assignedToUserId: body.assignedToUserId || currentUserId,
            title: body.title || 'Takip Görevi',
            type: body.type || 'yapilacak',
            relatedPropertyId: body.relatedPropertyId || null,
            relatedCustomerId: body.relatedCustomerId || null,
            dueDate: body.dueDate || new Date().toISOString(),
            notes: body.notes || '',
            isCompleted: false,
            completedAt: null,
            createdAt: new Date().toISOString()
          };

          lockedDb.followUps = lockedDb.followUps || [];
          lockedDb.followUps.unshift(newFollowUp);
          save(lockedDb);

          return jsonResponse(res, 201, newFollowUp);
        });
      }
    }

    const completeMatch = pathname.match(/^\/api\/followups\/([^\/]+)\/complete$/);
    if (completeMatch && req.method === 'POST') {
      const id = completeMatch[1];
      return withDBLock(async (lockedDb, save) => {
        const fu = (lockedDb.followUps || []).find(f => f.id === id && f.companyId === currentCompanyId);
        if (!fu) return jsonResponse(res, 404, { error: 'Görev bulunamadı' });
        fu.isCompleted = !fu.isCompleted;
        fu.completedAt = fu.isCompleted ? new Date().toISOString() : null;
        save(lockedDb);
        return jsonResponse(res, 200, fu);
      });
    }

    const fuMatch = pathname.match(/^\/api\/followups\/([^\/]+)$/);
    if (fuMatch && req.method === 'DELETE') {
      const id = fuMatch[1];
      return withDBLock(async (lockedDb, save) => {
        const idx = (lockedDb.followUps || []).findIndex(f => f.id === id && f.companyId === currentCompanyId);
        if (idx === -1) return jsonResponse(res, 404, { error: 'Görev bulunamadı' });
        lockedDb.followUps.splice(idx, 1);
        save(lockedDb);
        return jsonResponse(res, 200, { success: true, message: 'Görev silindi' });
      });
    }

    // ─── AKILLI EŞLEŞTİRME (MATCHING ENGINE) ───────────────────
    if (pathname === '/api/matching' && req.method === 'GET') {
      const { customerId, propertyId } = query;

      // 1. Müşteriye uygun ilan ara
      if (customerId) {
        const customer = (db.customers || []).find(c => c.id === customerId);
        if (!customer || !canAccessCustomer(customer, currentCompanyId, db)) {
          return jsonResponse(res, 404, { error: 'Müşteri bulunamadı' });
        }

        // Taranabilir mülkler: Kendi mülkleri + Ortak havuza açılmış aktif mülkler
        const candidateProps = (db.properties || []).filter(p => !p.isArchived && canAccessProperty(p, currentCompanyId, db));

        const matches = candidateProps.map(p => {
          const isOwn = p.companyId === currentCompanyId;
          const ownerComp = !isOwn ? (db.companies || []).find(comp => comp.id === p.companyId) : null;
          const matchResult = evaluateMatch(customer, p, isOwn);
          return {
            ...matchResult,
            property: {
              ...p,
              isOwnListing: isOwn,
              ownerCompanyName: ownerComp ? ownerComp.name : null,
              ownerCompanyPhone: ownerComp ? ownerComp.phone : null
            }
          };
        });

        matches.sort((a, b) => {
          if (a.verdict === 'eliminated' && b.verdict !== 'eliminated') return 1;
          if (b.verdict === 'eliminated' && a.verdict !== 'eliminated') return -1;
          return b.score - a.score;
        });

        return jsonResponse(res, 200, {
          target: { type: 'customer', data: customer.companyId === currentCompanyId ? customer : maskCustomerForPool(customer) },
          matches
        });
      }

      // 2. İlana uygun müşteri ara
      if (propertyId) {
        const property = (db.properties || []).find(p => p.id === propertyId);
        if (!property || !canAccessProperty(property, currentCompanyId, db)) {
          return jsonResponse(res, 404, { error: 'İlan bulunamadı' });
        }

        // Taranabilir müşteriler: Kendi müşterileri + Havuzdaki müşteriler
        const candidateCusts = (db.customers || []).filter(c => canAccessCustomer(c, currentCompanyId, db));

        const matches = candidateCusts.map(c => {
          const isOwn = c.companyId === currentCompanyId;
          const ownerComp = !isOwn ? (db.companies || []).find(comp => comp.id === c.companyId) : null;
          const matchResult = evaluateMatch(c, property, isOwn);
          return {
            ...matchResult,
            customer: isOwn ? c : maskCustomerForPool(c, ownerComp)
          };
        });

        matches.sort((a, b) => {
          if (a.verdict === 'eliminated' && b.verdict !== 'eliminated') return 1;
          if (b.verdict === 'eliminated' && a.verdict !== 'eliminated') return -1;
          return b.score - a.score;
        });

        return jsonResponse(res, 200, {
          target: { type: 'property', data: property },
          matches
        });
      }

      return jsonResponse(res, 400, { error: 'customerId veya propertyId gereklidir.' });
    }

    // ─── GÜVENLİ YEDEKLEME & GERİ YÜKLEME (SCOPED BACKUP / RESTORE)
    if (pathname === '/api/backup' && req.method === 'GET') {
      if (!isOwnerOrAdmin) {
        return jsonResponse(res, 403, { error: 'Yedekleme yetkiniz bulunmuyor (yalnızca Şirket Sahibi / Yöneticisi).' });
      }

      // SADECE aktif şirketin kendi verilerini dışarı aktar!
      const company = (db.companies || []).find(c => c.id === currentCompanyId);
      const scopedProperties = (db.properties || []).filter(p => p.companyId === currentCompanyId);
      const scopedCustomers = (db.customers || []).filter(c => c.companyId === currentCompanyId);
      const scopedFollowUps = (db.followUps || []).filter(f => f.companyId === currentCompanyId);

      return jsonResponse(res, 200, {
        exportDate: new Date().toISOString(),
        version: '2.0.0',
        companyId: currentCompanyId,
        companyName: company ? company.name : '',
        data: {
          properties: scopedProperties,
          customers: scopedCustomers,
          followUps: scopedFollowUps
        }
      });
    }

    if (pathname === '/api/restore' && req.method === 'POST') {
      if (currentRole !== 'owner' && !auth.user.isPlatformAdmin) {
        return jsonResponse(res, 403, { error: 'Geri yükleme işlemi yalnızca Şirket Sahibi tarafından yapılabilir.' });
      }

      const body = await parseBody(req);
      if (!body || !body.data) {
        return jsonResponse(res, 400, { error: 'Geçersiz yedek formatı.' });
      }

      return withDBLock(async (lockedDb, save) => {
        // Yüklenen kayıtlardaki companyId'yi zorunlu olarak aktif şirkete ez
        const incomingProps = (body.data.properties || []).map(p => ({
          ...p,
          companyId: currentCompanyId,
          createdById: currentUserId
        }));
        const incomingCusts = (body.data.customers || []).map(c => ({
          ...c,
          companyId: currentCompanyId,
          createdById: currentUserId
        }));
        const incomingFollowUps = (body.data.followUps || []).map(f => ({
          ...f,
          companyId: currentCompanyId,
          assignedToUserId: currentUserId
        }));

        // Başka şirketin kayıtlarına dokunmadan, sadece aktif şirketin kayıtlarını yenile
        lockedDb.properties = (lockedDb.properties || []).filter(p => p.companyId !== currentCompanyId).concat(incomingProps);
        lockedDb.customers = (lockedDb.customers || []).filter(c => c.companyId !== currentCompanyId).concat(incomingCusts);
        lockedDb.followUps = (lockedDb.followUps || []).filter(f => f.companyId !== currentCompanyId).concat(incomingFollowUps);

        save(lockedDb);
        return jsonResponse(res, 200, {
          success: true,
          message: `${incomingProps.length} ilan, ${incomingCusts.length} müşteri ve ${incomingFollowUps.length} görev başarıyla geri yüklendi.`
        });
      });
    }

    return jsonResponse(res, 404, { error: 'API uç noktası bulunamadı' });
  }

  // ─── STATİK DOSYA SUNUCUSU ─────────────────────────────────
  let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  if (safePath === '/' || safePath === '\\') safePath = '/index.html';

  let filePath = path.join(PUBLIC_DIR, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      filePath = path.join(PUBLIC_DIR, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('Sunucu hatası: Dosya okunamadı');
      }

      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(content);
    });
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const ips = getLocalIPs();
  console.log('====================================================');
  console.log('🚀 EMLAK TAKİP CRM - ÇOK ŞİRKETLİ SAAS PLATFORMU AKTİF!');
  console.log('====================================================');
  console.log(`💻 Bilgisayardan erişim: http://localhost:${PORT}`);
  ips.forEach(ip => {
    console.log(`📱 Telefondan / Tabletten erişim: http://${ip}:${PORT}`);
  });
  console.log('====================================================');
});
