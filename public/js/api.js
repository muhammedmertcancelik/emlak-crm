// ============================================================
// EMLAK TAKİP CRM - CLIENT API WRAPPER (ÇOK ŞİRKETLİ SAAS)
// ============================================================

const API = {
  baseUrl: (function() {
    if (typeof window !== 'undefined' && window.location && window.location.origin) {
      const o = window.location.origin;
      if (o && o !== 'null' && (o.startsWith('http:') || o.startsWith('https:'))) {
        return o;
      }
    }
    return 'http://localhost:3000';
  })(),

  getToken() {
    return localStorage.getItem('emlak_crm_token') || '';
  },

  setToken(token) {
    if (token) {
      localStorage.setItem('emlak_crm_token', token);
    } else {
      localStorage.removeItem('emlak_crm_token');
    }
  },

  getActiveCompanyId() {
    return localStorage.getItem('emlak_crm_active_comp_id') || '';
  },

  setActiveCompanyId(compVal) {
    if (compVal) {
      localStorage.setItem('emlak_crm_active_comp_id', compVal);
    } else {
      localStorage.removeItem('emlak_crm_active_comp_id');
    }
  },

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    const token = this.getToken();
    if (token) {
      defaultHeaders['Authorization'] = `Bearer ${token}`;
    }

    const compId = this.getActiveCompanyId();
    if (compId) {
      defaultHeaders['X-Company-Id'] = compId;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...defaultHeaders,
          ...options.headers
        }
      });

      if (response.status === 401 && !endpoint.startsWith('/api/auth/login')) {
        // Oturum süresi dolmuş veya geçersiz
        window.dispatchEvent(new CustomEvent('auth:required'));
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (err) {
      console.error(`API Error [${endpoint}]:`, err);
      throw err;
    }
  },

  // ─── Kimlik Doğrulama & Oturum (Auth) ───────────────────────
  async login(email, password) {
    this.setToken(null);
    this.setActiveCompanyId(null);
    const res = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    if (res.token) {
      this.setToken(res.token);
      if (res.company && res.company.id) {
        this.setActiveCompanyId(res.company.id);
      }
    }
    return res;
  },

  async demoLogin(companyId = null) {
    this.setToken(null);
    this.setActiveCompanyId(null);
    const res = await this.request('/api/auth/demo-login', {
      method: 'POST',
      body: JSON.stringify(companyId ? { companyId } : {})
    });
    if (res.token) {
      this.setToken(res.token);
      if (res.company && res.company.id) {
        this.setActiveCompanyId(res.company.id);
      }
    }
    return res;
  },

  async register(data) {
    const res = await this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    if (res.token) {
      this.setToken(res.token);
      if (res.company && res.company.id) {
        this.setActiveCompanyId(res.company.id);
      }
    }
    return res;
  },

  async getMe() {
    return this.request('/api/auth/me');
  },

  async switchCompany(targetCompanyId) {
    const res = await this.request('/api/auth/switch-company', {
      method: 'POST',
      body: JSON.stringify({ targetCompanyId })
    });
    if (res.token) {
      this.setToken(res.token);
      this.setActiveCompanyId(targetCompanyId);
    }
    return res;
  },

  async changePassword(currentPassword, newPassword) {
    return this.request('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword })
    });
  },

  async getInvitationInfo(token) {
    return this.request(`/api/auth/invitation-info?token=${encodeURIComponent(token)}`);
  },

  async acceptInvitation(token, fullName, password, phone) {
    const res = await this.request('/api/auth/accept-invitation', {
      method: 'POST',
      body: JSON.stringify({ token, fullName, password, phone })
    });
    if (res.token) {
      this.setToken(res.token);
      if (res.company) this.setActiveCompanyId(res.company.id);
    }
    return res;
  },

  logout() {
    this.setToken(null);
    this.setActiveCompanyId(null);
    window.location.reload();
  },

  // ─── Şirket & Ekip Yönetimi ─────────────────────────────────
  async getCurrentCompany() {
    return this.request('/api/companies/current');
  },

  async updateCurrentCompany(data) {
    return this.request('/api/companies/current', {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async getMembers() {
    return this.request('/api/companies/members');
  },

  async inviteMember(email, role = 'agent') {
    return this.request('/api/companies/invitations', {
      method: 'POST',
      body: JSON.stringify({ email, role })
    });
  },

  async createInvitation(email, role = 'agent') {
    return this.inviteMember(email, role);
  },

  async getInvitations() {
    return this.request('/api/companies/invitations');
  },

  async revokeInvitation(id) {
    return this.request(`/api/companies/invitations/${id}`, {
      method: 'DELETE'
    });
  },

  // ─── Departman Yönetimi (Departments) ───────────────────────
  async getDepartments() {
    return this.request('/api/departments');
  },

  async createDepartment(data) {
    return this.request('/api/departments', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateDepartment(id, data) {
    return this.request(`/api/departments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async deleteDepartment(id) {
    return this.request(`/api/departments/${id}`, {
      method: 'DELETE'
    });
  },

  async assignDepartmentMembers(id, userIds) {
    return this.request(`/api/departments/${id}/assign`, {
      method: 'POST',
      body: JSON.stringify({ userIds })
    });
  },

  async updateMemberDepartment(memberId, departmentId) {
    return this.request(`/api/companies/members/${memberId}/department`, {
      method: 'PUT',
      body: JSON.stringify({ departmentId })
    });
  },

  // ─── Network & Stats ─────────────────────────────────────────
  async getNetworkInfo() {
    return this.request('/api/network-info');
  },

  async getStats() {
    return this.request('/api/stats');
  },

  // ─── Properties (İlanlar) — Kendi & Ortak Havuz ───────────────
  async getProperties(params = {}) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '' && value !== false) {
        query.append(key, String(value));
      }
    }
    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.request(`/api/properties${qs}`);
  },

  async getProperty(id) {
    return this.request(`/api/properties/${id}`);
  },

  async createProperty(data) {
    return this.request('/api/properties', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateProperty(id, data) {
    return this.request(`/api/properties/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async deleteProperty(id) {
    return this.request(`/api/properties/${id}`, {
      method: 'DELETE'
    });
  },

  async toggleFavorite(id) {
    return this.request(`/api/properties/${id}/toggle-favorite`, {
      method: 'POST'
    });
  },

  async toggleArchive(id) {
    return this.request(`/api/properties/${id}/toggle-archive`, {
      method: 'POST'
    });
  },

  async shareProperty(id, { action = 'share', targetType = 'all_members', commissionSplit = '50-50' } = {}) {
    return this.request(`/api/properties/${id}/share`, {
      method: 'POST',
      body: JSON.stringify({ action, targetType, commissionSplit })
    });
  },

  // ─── Customers (Müşteriler CRM) ─────────────────────────────
  async getCustomers(params = {}) {
    const query = new URLSearchParams();
    if (params.onlyMine) query.append('onlyMine', 'true');
    if (params.scope) query.append('scope', params.scope);
    if (params.status) query.append('status', params.status);
    if (params.customerClass) query.append('customerClass', params.customerClass);
    if (params.leadSource) query.append('leadSource', params.leadSource);
    if (params.department) query.append('department', params.department);
    if (params.purpose) query.append('purpose', params.purpose);
    if (params.timeline) query.append('timeline', params.timeline);
    if (params.search) query.append('search', params.search);

    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.request(`/api/customers${qs}`);
  },

  async getCustomer(id) {
    return this.request(`/api/customers/${id}`);
  },

  async createCustomer(data) {
    return this.request('/api/customers', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateCustomer(id, data) {
    return this.request(`/api/customers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async deleteCustomer(id) {
    return this.request(`/api/customers/${id}`, {
      method: 'DELETE'
    });
  },

  async shareCustomer(id, { action = 'share', legalBasisNote = '' } = {}) {
    return this.request(`/api/customers/${id}/share`, {
      method: 'POST',
      body: JSON.stringify({ action, legalBasisNote })
    });
  },

  // ─── Follow-ups (Takip & Ajanda) ────────────────────────────
  async getFollowUps(params = {}) {
    const query = new URLSearchParams();
    if (params.onlyMine) query.append('onlyMine', 'true');
    if (params.pendingOnly) query.append('pendingOnly', 'true');
    if (params.completedOnly) query.append('completedOnly', 'true');
    if (params.todayOnly) query.append('todayOnly', 'true');
    if (params.propertyId) query.append('propertyId', params.propertyId);
    if (params.customerId) query.append('customerId', params.customerId);

    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.request(`/api/followups${qs}`);
  },

  async createFollowUp(data) {
    return this.request('/api/followups', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async completeFollowUp(id) {
    return this.request(`/api/followups/${id}/complete`, {
      method: 'POST'
    });
  },

  async deleteFollowUp(id) {
    return this.request(`/api/followups/${id}`, {
      method: 'DELETE'
    });
  },

  // ─── Akıllı Eşleştirme Motoru ────────────────────────────────
  async getMatching(params) {
    const query = new URLSearchParams();
    if (params.customerId) query.append('customerId', params.customerId);
    if (params.propertyId) query.append('propertyId', params.propertyId);
    return this.request(`/api/matching?${query.toString()}`);
  },

  // ─── Şirket İçi Güvenli Yedekleme & Geri Yükleme ─────────────
  async getBackup() {
    return this.request('/api/backup');
  },

  async restoreBackup(data) {
    return this.request('/api/restore', {
      method: 'POST',
      body: JSON.stringify({ data })
    });
  }
};

window.API = API;
