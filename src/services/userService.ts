import api from './api';

export interface UserDTO {
  id: number;
  name: string;
  email: string;
  phone?: string;
  countryCode?: string;
  roleId: number;
  role: string;
  department?: string;
  active?: boolean;
  companyId?: number;
  companyName?: string;
  createdBy?: number;
  avatar?: string;
}

export interface UserRequest {
  name: string;
  email: string;
  phone?: string;
  countryCode?: string;
  roleId: number;
  department?: string;
  active?: boolean;
  password?: string;
  companyId?: number;
}

export interface RoleDTO {
  id: number;
  roleName: string;
}

export const userService = {
  async getAll(): Promise<UserDTO[]> {
    const response = await api.get('/api/users');
    return response.data;
  },

  async getById(id: number): Promise<UserDTO> {
    const response = await api.get(`/api/users/${id}`);
    return response.data;
  },

  async create(user: UserRequest): Promise<UserDTO> {
    const response = await api.post('/api/users', user);
    return response.data;
  },

  async update(id: number, user: UserRequest): Promise<UserDTO> {
    const response = await api.put(`/api/users/${id}`, user);
    return response.data;
  },

  async delete(id: number): Promise<void> {
    await api.delete(`/api/users/${id}`);
  },

  async getRoles(): Promise<RoleDTO[]> {
    const response = await api.get('/api/roles');
    return response.data;
  },

  async resetPassword(userId: number, newPassword: string): Promise<void> {
    await api.put(`/api/users/${userId}/reset-password`, { newPassword });
  },
};
