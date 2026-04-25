export const getAuthToken = () => localStorage.getItem('swacn_token');
export const setAuthToken = (token: string) => localStorage.setItem('swacn_token', token);
export const logout = () => localStorage.removeItem('swacn_token');

export async function fetchCasts() {
  const token = getAuthToken();
  if (!token) throw new Error("Not authenticated");

  const res = await fetch('/api/v1/casts', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (!res.ok) throw new Error("Failed to fetch casts");
  return res.json();
}

export async function fetchCastDetails(id: string) {
  const res = await fetch(`/api/v1/casts/${id}`);
  if (!res.ok) throw new Error("Failed to fetch cast details");
  return res.json();
}

export async function updateCastSettings(id: string, settings: { theme: string, show_keystrokes: boolean, allow_fs_download: boolean, embed_theme: string }) {
  const token = getAuthToken();
  if (!token) throw new Error("Not authenticated");

  const res = await fetch(`/api/v1/casts/${id}/settings`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(settings)
  });
  
  if (!res.ok) throw new Error("Failed to update cast settings");
  return res.json();
}

export async function deleteCast(id: string) {
  const token = getAuthToken();
  if (!token) throw new Error("Not authenticated");

  const res = await fetch(`/api/v1/casts/${id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (!res.ok) throw new Error("Failed to delete cast");
  return res.json();
}