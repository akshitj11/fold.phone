const API_BASE = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

type AccessTokenGetter = () => Promise<string | null>;

let accessTokenGetter: AccessTokenGetter | null = null;

export function setAccessTokenGetter(getter: AccessTokenGetter | null) {
  accessTokenGetter = getter;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  image?: string | null; // Backend returns image, we map to avatar
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

async function getAccessToken(): Promise<string | null> {
  try {
    if (!accessTokenGetter) return null;
    return await accessTokenGetter();
  } catch {
    return null;
  }
}

/**
 * Make an authenticated API request to the backend
 */
export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ data: T | null; error: string | null }> {
  try {
    const token = await getAccessToken();

    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    };

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    const json = await response.json();

    if (!response.ok) {
      return {
        data: null,
        error: json.message || json.error || "Request failed",
      };
    }

    return {
      data: json.data ?? json,
      error: null,
    };
  } catch (error) {
    console.error("API request error:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

/**
 * Get current user profile
 */
export async function getProfile(): Promise<{
  data: User | null;
  error: string | null;
}> {
  // Add cache-busting to ensure fresh data
  return apiRequest<User>("/api/user/me", {
    headers: {
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
    },
  });
}

/**
 * Update user profile (name and/or avatar)
 */
export async function updateProfile(data: {
  name?: string;
  avatar?: string | null;
}): Promise<{ data: User | null; error: string | null }> {
  return apiRequest<User>("/api/user/me", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

/**
 * Upload a file (avatar) to the backend
 */
export async function uploadAvatar(
  uri: string,
  mimeType: string = "image/jpeg"
): Promise<{ data: { url: string; id: string } | null; error: string | null }> {
  try {
    const token = await getAccessToken();

    // Create form data
    const formData = new FormData();
    const filename = uri.split("/").pop() || "avatar.jpg";

    // Backend expects 'avatar' key, not 'file'
    formData.append("avatar", {
      uri,
      name: filename,
      type: mimeType,
    } as any);

    const response = await fetch(`${API_BASE}/api/upload/avatar`, {
      method: "POST",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });

    const json = await response.json();

    if (!response.ok) {
      return {
        data: null,
        error: json.message || json.error || "Upload failed",
      };
    }

    // Backend returns: { data: { id, url, thumbnails: { small, medium, large } } }
    // Use medium thumbnail for avatar, or fall back to main url
    const uploadData = json.data ?? json;
    const avatarUrl = uploadData.thumbnails?.medium || uploadData.url;

    return {
      data: {
        id: uploadData.id,
        url: avatarUrl,
      },
      error: null,
    };
  } catch (error) {
    console.error("Upload error:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Upload failed",
    };
  }
}

/**
 * Change password
 */
export async function changePassword(data: {
  currentPassword: string;
  newPassword: string;
}): Promise<{ success: boolean; error: string | null }> {
  const result = await apiRequest<{ message: string }>(
    "/api/user/change-password",
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  );

  return {
    success: result.error === null,
    error: result.error,
  };
}

/**
 * Delete account
 */
export async function deleteAccount(): Promise<{
  success: boolean;
  error: string | null;
}> {
  const result = await apiRequest<{ message: string }>("/api/user/me", {
    method: "DELETE",
  });

  return {
    success: result.error === null,
    error: result.error,
  };
}

// =============================================================================
// Timeline API
// =============================================================================

export interface MediaItem {
  id: string;
  uri: string;
  type: "image" | "video" | "audio";
  thumbnailUri?: string | null;
  duration: number | null;
  sortOrder: number;
}

export interface TimelineEntryResponse {
  id: string;
  userId: string;
  type: "text" | "audio" | "photo" | "video" | "story";
  createdAt: string;
  updatedAt: string;
  mood: string | null;
  location: string | null;
  caption: string | null;
  content: string | null;
  title: string | null;
  storyContent: string | null;
  pageCount: number | null;
  media: MediaItem[];
}

export interface CreateEntryPayload {
  type: "text" | "audio" | "photo" | "video" | "story";
  mood?: string | null;
  location?: string | null;
  caption?: string | null;
  content?: string | null;
  title?: string | null;
  storyContent?: string | null;
  pageCount?: number | null;
  media?: { uri: string; type: "image" | "video" | "audio"; thumbnailUri?: string | null; duration?: number | null }[];
}

/**
 * Create a new timeline entry
 */
export async function createTimelineEntry(
  payload: CreateEntryPayload
): Promise<{ data: TimelineEntryResponse | null; error: string | null }> {
  return apiRequest<TimelineEntryResponse>("/api/timeline", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Get paginated list of timeline entries
 */
export async function getTimelineEntries(
  limit: number = 20,
  offset: number = 0
): Promise<{ data: TimelineEntryResponse[] | null; error: string | null }> {
  const result = await apiRequest<{
    data: TimelineEntryResponse[];
    pagination: { limit: number; offset: number; count: number };
  }>(`/api/timeline?limit=${limit}&offset=${offset}`);

  if (result.error) return { data: null, error: result.error };

  // apiRequest unwraps .data, but backend returns { success, data, pagination }
  // apiRequest returns json.data ?? json, so result.data is the array OR the full object
  const entries = Array.isArray(result.data)
    ? result.data
    : (result.data as any)?.data ?? [];

  return { data: entries, error: null };
}

/**
 * Get a single timeline entry by ID
 */
export async function getTimelineEntry(
  id: string
): Promise<{ data: TimelineEntryResponse | null; error: string | null }> {
  return apiRequest<TimelineEntryResponse>(`/api/timeline/${id}`);
}

/**
 * Update a timeline entry
 */
export async function updateTimelineEntry(
  id: string,
  data: { mood?: string; location?: string | null; caption?: string | null; content?: string | null }
): Promise<{ data: TimelineEntryResponse | null; error: string | null }> {
  return apiRequest<TimelineEntryResponse>(`/api/timeline/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

/**
 * "On This Day" — entries from previous years matching today's month+day
 */
export interface OnThisDayGroup {
  year: number;
  entries: TimelineEntryResponse[];
}

export async function getOnThisDayEntries(): Promise<{
  data: OnThisDayGroup[] | null;
  error: string | null;
}> {
  const result = await apiRequest<OnThisDayGroup[]>("/api/timeline/on-this-day");

  if (result.error) return { data: null, error: result.error };

  // apiRequest unwraps json.data ?? json — result.data may be the array directly
  // or a wrapper object with a nested .data property
  const groups = Array.isArray(result.data)
    ? result.data
    : (result.data as any)?.data ?? [];

  return { data: groups, error: null };
}

/**
 * Get timeline entries for a specific calendar date (YYYY-MM-DD)
 */
export async function getTimelineEntriesByDate(
  date: string
): Promise<{ data: TimelineEntryResponse[] | null; error: string | null }> {
  const result = await apiRequest<TimelineEntryResponse[]>(
    `/api/timeline/by-date?date=${encodeURIComponent(date)}`
  );

  if (result.error) return { data: null, error: result.error };

  const entries = Array.isArray(result.data)
    ? result.data
    : (result.data as any)?.data ?? [];

  return { data: entries, error: null };
}

/**
 * Delete a timeline entry
 */
export async function deleteTimelineEntry(
  id: string
): Promise<{ success: boolean; error: string | null }> {
  const result = await apiRequest<{ message: string }>(`/api/timeline/${id}`, {
    method: "DELETE",
  });
  return {
    success: result.error === null,
    error: result.error,
  };
}

// =============================================================================
// Shares API
// =============================================================================

export interface ShareResponse {
  id: string;
  entryId: string;
  userId: string;
  token: string;
  status: "active" | "paused";
  viewCount: number;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  // Joined entry preview fields (from GET /api/shares list)
  entryType?: string;
  entryMood?: string | null;
  entryCaption?: string | null;
  entryContent?: string | null;
  entryTitle?: string | null;
  entryCreatedAt?: string;
}

const SHARE_BASE_URL = "https://link.fold.taohq.org";

/**
 * Create a share link for an entry. Returns existing share if one already exists.
 */
export async function createShare(
  entryId: string
): Promise<{ data: ShareResponse | null; error: string | null }> {
  return apiRequest<ShareResponse>("/api/shares", {
    method: "POST",
    body: JSON.stringify({ entryId }),
  });
}

/**
 * Get all shares for the current user (with entry preview data)
 */
export async function getShares(): Promise<{
  data: ShareResponse[] | null;
  error: string | null;
}> {
  const result = await apiRequest<ShareResponse[]>("/api/shares");
  if (result.error) return { data: null, error: result.error };
  const shares = Array.isArray(result.data)
    ? result.data
    : (result.data as any)?.data ?? [];
  return { data: shares, error: null };
}

/**
 * Update share status (active/paused)
 */
export async function updateShare(
  id: string,
  status: "active" | "paused"
): Promise<{ data: ShareResponse | null; error: string | null }> {
  return apiRequest<ShareResponse>(`/api/shares/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

/**
 * Delete a share permanently
 */
export async function deleteShare(
  id: string
): Promise<{ success: boolean; error: string | null }> {
  const result = await apiRequest<{ message: string }>(`/api/shares/${id}`, {
    method: "DELETE",
  });
  return {
    success: result.error === null,
    error: result.error,
  };
}

/**
 * Get the public share URL for a given token
 */
export function getShareUrl(token: string): string {
  return `${SHARE_BASE_URL}/${token}`;
}

/**
 * Public share entry response from the public endpoint
 */
export interface PublicShareEntry {
  entry: {
    type: string;
    mood: string | null;
    caption: string | null;
    content: string | null;
    title: string | null;
    storyContent: string | null;
    pageCount: number | null;
    createdAt: string;
    media: Array<{
      id: string;
      uri: string;
      type: string;
      thumbnailUri: string | null;
      duration: number | null;
      sortOrder: number;
    }>;
  };
  sharedAt: string;
  viewCount: number;
}

/**
 * Fetch a publicly shared entry by token (no auth required).
 * Uses the backend API endpoint directly.
 */
export async function getPublicShare(
  token: string
): Promise<{ data: PublicShareEntry | null; error: string | null }> {
  try {
    const res = await fetch(`${API_BASE}/api/shares/public/${token}`);
    const json = await res.json();
    if (!res.ok || !json.success) {
      return { data: null, error: json.error || "Failed to load shared entry" };
    }
    return { data: json.data, error: null };
  } catch (e) {
    return { data: null, error: "Network error" };
  }
}

// =============================================================================
// Connect API
// =============================================================================

export interface ConnectPartner {
  id: string;
  name: string;
  image: string | null;
}

export interface ConnectActiveConnection {
  id: string;
  status: string;
  acceptedAt: string | null;
  partner: ConnectPartner | null;
}

export interface ConnectPendingRequest {
  id: string;
  direction: "sent" | "received";
  requesterId: string;
  receiverId: string;
  requesterName: string;
  requesterImage: string | null;
  createdAt: string;
}

export interface ConnectStatus {
  active: ConnectActiveConnection | null;
  pending: ConnectPendingRequest[];
  cooldown: { until: string } | null;
}

export interface ConnectMemoryEntry {
  id: string;
  type: string;
  mood: string | null;
  caption: string | null;
  content: string | null;
  title: string | null;
  storyContent: string | null;
  pageCount: number | null;
  createdAt: string;
  media: Array<{
    id: string;
    uri: string;
    type: string;
    thumbnailUri: string | null;
    duration: number | null;
  }>;
}

export interface ConnectMemoryItem {
  id: string;
  side: "mine" | "theirs";
  sharedBy: string;
  sharedAt: string;
  user: { name: string; image: string | null };
  entry: ConnectMemoryEntry;
}

export interface ConnectMemoriesResponse {
  memories: ConnectMemoryItem[];
  nextCursor: string | null;
  partner: { id: string };
}

export interface ConnectSearchResult {
  id: string;
  name: string;
  image: string | null;
}

/**
 * Get current connection status (active, pending requests, cooldown)
 */
export async function getConnectStatus(): Promise<{
  data: ConnectStatus | null;
  error: string | null;
}> {
  return apiRequest<ConnectStatus>("/api/connect/status");
}

/**
 * Get or generate the current user's invite code
 */
export async function getConnectInviteCode(): Promise<{
  data: { inviteCode: string } | null;
  error: string | null;
}> {
  return apiRequest<{ inviteCode: string }>("/api/connect/code");
}

/**
 * Connect using an invite code (auto-accepts)
 */
export async function connectByCode(inviteCode: string): Promise<{
  data: any | null;
  error: string | null;
}> {
  return apiRequest("/api/connect/request/code", {
    method: "POST",
    body: JSON.stringify({ inviteCode }),
  });
}

/**
 * Send a direct connection request to a user (requires acceptance)
 */
export async function connectByUser(userId: string): Promise<{
  data: any | null;
  error: string | null;
}> {
  return apiRequest("/api/connect/request/user", {
    method: "POST",
    body: JSON.stringify({ userId }),
  });
}

/**
 * Accept a pending connection request
 */
export async function acceptConnectRequest(requestId: string): Promise<{
  data: any | null;
  error: string | null;
}> {
  return apiRequest(`/api/connect/accept/${requestId}`, {
    method: "POST",
  });
}

/**
 * Cancel a pending connection request that the current user sent
 */
export async function cancelConnectRequest(requestId: string): Promise<{
  data: any | null;
  error: string | null;
}> {
  return apiRequest(`/api/connect/cancel/${requestId}`, {
    method: "DELETE",
  });
}

/**
 * Decline a pending connection request
 */
export async function declineConnectRequest(requestId: string): Promise<{
  data: any | null;
  error: string | null;
}> {
  return apiRequest(`/api/connect/decline/${requestId}`, {
    method: "POST",
  });
}

/**
 * End the current active connection (triggers 30-day cooldown)
 */
export async function endConnection(): Promise<{
  data: { cooldownUntil: string } | null;
  error: string | null;
}> {
  return apiRequest<{ cooldownUntil: string }>("/api/connect/end", {
    method: "POST",
  });
}

/**
 * Search for users by name or email (for direct connection requests)
 */
export async function searchConnectUsers(query: string): Promise<{
  data: ConnectSearchResult[] | null;
  error: string | null;
}> {
  const result = await apiRequest<ConnectSearchResult[]>(
    `/api/connect/search?q=${encodeURIComponent(query)}`
  );
  if (result.error) return { data: null, error: result.error };
  const users = Array.isArray(result.data)
    ? result.data
    : (result.data as any)?.data ?? [];
  return { data: users, error: null };
}

/**
 * Share a timeline entry to the active connection
 */
export async function shareToConnect(entryId: string): Promise<{
  data: any | null;
  error: string | null;
}> {
  return apiRequest("/api/connect/memories", {
    method: "POST",
    body: JSON.stringify({ entryId }),
  });
}

/**
 * Remove a shared entry from the connection timeline
 */
export async function unshareFromConnect(entryId: string): Promise<{
  success: boolean;
  error: string | null;
}> {
  const result = await apiRequest(`/api/connect/memories/${entryId}`, {
    method: "DELETE",
  });
  return {
    success: result.error === null,
    error: result.error,
  };
}

/**
 * Get shared memories timeline (cursor-based pagination)
 */
export async function getConnectMemories(
  cursor?: string,
  limit: number = 20
): Promise<{
  data: ConnectMemoriesResponse | null;
  error: string | null;
}> {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  params.set("limit", String(limit));
  return apiRequest<ConnectMemoriesResponse>(
    `/api/connect/memories?${params.toString()}`
  );
}

// =============================================================================
// Settings API
// =============================================================================

export interface UserSettings {
  autoLocation: boolean;
  screenshotProtection: boolean;
}

/**
 * Get user settings from backend
 */
export async function getUserSettings(): Promise<{
  data: UserSettings | null;
  error: string | null;
}> {
  return apiRequest<UserSettings>("/api/user/settings");
}

/**
 * Update user settings (partial update)
 */
export async function updateUserSettings(
  settings: Partial<UserSettings>
): Promise<{ data: UserSettings | null; error: string | null }> {
  return apiRequest<UserSettings>("/api/user/settings", {
    method: "PATCH",
    body: JSON.stringify(settings),
  });
}

// =============================================================================
// App Config API
// =============================================================================

export interface AppConfig {
  cooldownDays: number;
}

/**
 * Get app config from backend (public endpoint, no auth required)
 */
export async function getAppConfig(): Promise<{
  data: AppConfig | null;
  error: string | null;
}> {
  return apiRequest<AppConfig>("/api/config/app");
}

// =============================================================================
// Profile Stats API
// =============================================================================

export interface ProfileStats {
  foldScore: number;
  currentStreak: number;
  longestStreak: number;
  totalEntries: number;
  totalAudioMinutes: number;
  isStreakActive: boolean;
  storyStats?: {
    totalStories: number;
    totalStoryWords: number;
    happyStoryCount: number;
  };
  badges: { type: string; earnedAt: string }[];
}

/**
 * Get profile stats from backend
 */
export async function getProfileStats(): Promise<{
  data: ProfileStats | null;
  error: string | null;
}> {
  return apiRequest<ProfileStats>("/api/profile/me");
}

/**
 * Upload a media file (photo, video, audio). Returns the remote URL.
 */
export async function uploadMedia(
  uri: string,
  mimeType: string = "image/jpeg"
): Promise<{ url: string | null; error: string | null }> {
  try {
    const token = await getAccessToken();
    const formData = new FormData();
    const filename = uri.split("/").pop() || "file";

    formData.append("file", {
      uri,
      name: filename,
      type: mimeType,
    } as any);

    // Timeout after 15s to prevent hanging on large files
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(`${API_BASE}/api/upload`, {
      method: "POST",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const json = await response.json();

    if (!response.ok) {
      return { url: null, error: json.message || json.error || "Upload failed" };
    }

    const uploadData = json.data ?? json;
    return { url: uploadData.url, error: null };
  } catch (error) {
    console.error("Upload media error:", error);
    return {
      url: null,
      error: error instanceof Error ? error.message : "Upload failed",
    };
  }
}
