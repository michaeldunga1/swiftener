import { api, ApiError } from './api.js';

let currentUser = null;

export function getUser() {
  return currentUser;
}

export async function refreshUser() {
  try {
    const data = await api.get('/users/me');
    currentUser = data.user;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) currentUser = null;
    else throw err;
  }
  return currentUser;
}

export function clearUser() {
  currentUser = null;
}
