const BASE_URL = '/api';

class ApiClient {
  constructor() {
    this.token = localStorage.getItem('nexus_token') || null;
    this.currentUserId = localStorage.getItem('nexus_user_id') || null;
    this.currentTenantId = localStorage.getItem('nexus_tenant_id') || null;
    this.currentOrgId = localStorage.getItem('nexus_org_id') || null;
  }

  setAuth(token, userId) {
    this.token = token;
    this.currentUserId = userId;
    if (token) localStorage.setItem('nexus_token', token);
    else localStorage.removeItem('nexus_token');
    if (userId) localStorage.setItem('nexus_user_id', userId);
    else localStorage.removeItem('nexus_user_id');
  }

  setTenant(tenantId, orgId) {
    this.currentTenantId = tenantId;
    this.currentOrgId = orgId;
    if (tenantId) localStorage.setItem('nexus_tenant_id', tenantId);
    else localStorage.removeItem('nexus_tenant_id');
    if (orgId) localStorage.setItem('nexus_org_id', orgId);
    else localStorage.removeItem('nexus_org_id');
  }

  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    if (this.currentUserId) {
      headers['X-User-ID'] = this.currentUserId;
    }
    if (this.currentTenantId) {
      headers['X-Tenant-ID'] = this.currentTenantId;
    }
    if (this.currentOrgId) {
      headers['X-Organization-ID'] = this.currentOrgId;
    }

    const response = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const error = new Error(data?.message || data?.error || 'Network request failed');
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  }

  // Auth & Evaluator Switcher
  getUsers() {
    return this.request('/auth/users');
  }

  switchUser(userId) {
    return this.request('/auth/switch-user', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  }

  getMe() {
    return this.request('/auth/me');
  }

  // Organizations & Tenants
  getOrganizations() {
    return this.request('/organizations');
  }

  getTenants(orgId) {
    return this.request(`/organizations/${orgId}/tenants`);
  }

  // Boards
  getBoards() {
    return this.request('/boards');
  }

  getBoard(boardId) {
    return this.request(`/boards/${boardId}`);
  }

  createBoard(title, description) {
    return this.request('/boards', {
      method: 'POST',
      body: JSON.stringify({ title, description }),
    });
  }

  // Columns
  createColumn(boardId, title, color) {
    return this.request(`/boards/${boardId}/columns`, {
      method: 'POST',
      body: JSON.stringify({ title, color }),
    });
  }

  updateColumn(columnId, title, color) {
    return this.request(`/columns/${columnId}`, {
      method: 'PUT',
      body: JSON.stringify({ title, color }),
    });
  }

  deleteColumn(columnId) {
    return this.request(`/columns/${columnId}`, {
      method: 'DELETE',
    });
  }

  // Tasks with OCC & Fractional Reordering
  createTask(boardId, taskData) {
    return this.request(`/boards/${boardId}/tasks`, {
      method: 'POST',
      body: JSON.stringify(taskData),
    });
  }

  updateTask(taskId, taskData) {
    return this.request(`/tasks/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify(taskData),
    });
  }

  moveTask(taskId, moveData) {
    return this.request(`/tasks/${taskId}/move`, {
      method: 'PATCH',
      body: JSON.stringify(moveData),
    });
  }

  deleteTask(taskId) {
    return this.request(`/tasks/${taskId}`, {
      method: 'DELETE',
    });
  }

  // Activity Logs
  getActivities(boardId) {
    const query = boardId ? `?boardId=${boardId}` : '';
    return this.request(`/activities${query}`);
  }
}

export const api = new ApiClient();
