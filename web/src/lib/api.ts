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