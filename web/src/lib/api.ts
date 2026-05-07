let memoryToken: string | null = null;

export const getAuthToken = () => memoryToken || localStorage.getItem('swacn_token');
export const setAuthToken = (token: string) => {
  memoryToken = token;
  try {
    localStorage.setItem('swacn_token', token);
  } catch (e) {
    // Silently fail if localStorage is blocked (common in iframes)
  }
};
export const logout = () => {
  memoryToken = null;
  localStorage.removeItem('swacn_token');
};

export async function fetchMe() {
  const token = getAuthToken();
  if (!token) throw new Error("Not authenticated");

  const res = await fetch('/api/v1/users/me', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (res.status === 401) {
    logout();
    throw new Error("Session expired. Please sign in again.");
  }
  
  if (!res.ok) throw new Error("Failed to fetch user profile");
  return res.json();
}


export async function fetchCasts() {
  const token = getAuthToken();
  if (!token) throw new Error("Not authenticated");

  const res = await fetch('/api/v1/casts', {
    headers: { 
      'Authorization': `Bearer ${token}`,
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    }
  });
  
  if (res.status === 401) {
    logout();
    throw new Error("Session expired. Please sign in again.");
  }
  
  if (!res.ok) throw new Error("Failed to fetch casts");
  return res.json();
}

export async function fetchCastDetails(id: string) {
  const token = getAuthToken();
  const headers: any = {
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`/api/v1/casts/${id}`, { headers });
  if (res.status === 401) {
    logout();
    throw new Error("Session expired. Please sign in again.");
  }
  if (!res.ok) {
    const err = new Error("Failed to fetch cast details") as any;
    err.status = res.status;
    throw err;
  }
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

export async function updateCastUpload(id: string, formData: FormData) {
  const token = getAuthToken();
  if (!token) throw new Error("Not authenticated");

  const res = await fetch(`/api/v1/casts/${id}/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });
  
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to update project files");
  return data;
}

export async function createCheckoutSession(): Promise<{ checkout_url: string }> {
  const token = getAuthToken();
  if (!token) throw new Error("Not authenticated");

  const res = await fetch('/api/v1/payments/checkout', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to create checkout session");
  return data;
}