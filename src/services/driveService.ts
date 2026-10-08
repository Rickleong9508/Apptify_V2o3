// Google Drive Service (Client-Side Bring-Your-Own-Storage)

export const CLOUD_FILENAME = 'Apptify_Cloud_Data.json';
export const LEGACY_FILENAME = 'MyWealth_Backup.json';

// LocalStorage Keys
export const STORAGE_KEYS = {
    TOKEN: 'app_google_drive_token',
    EXPIRY: 'app_google_drive_expiry',
    PROFILE: 'app_google_drive_profile',
    CLIENT_ID: 'app_google_client_id',
    LAST_SYNC: 'app_google_last_synced',
    ACCOUNT_LINKED: 'app_google_account_linked'
};

export interface GoogleUserProfile {
    id: string;
    email: string;
    name: string;
    picture?: string;
}

export interface DriveFileInfo {
    id: string;
    name: string;
    modifiedTime: string;
}

// 1. Google Client ID Resolver
export const getGoogleClientId = (): string => {
    const userConfigured = localStorage.getItem(STORAGE_KEYS.CLIENT_ID);
    if (userConfigured && userConfigured.trim()) {
        return userConfigured.trim();
    }
    // Default fallback from Vite env or fallback placeholder
    const envClientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID;
    if (envClientId && envClientId.trim()) {
        return envClientId.trim();
    }
    return '';
};

export const setGoogleClientId = (clientId: string) => {
    if (clientId && clientId.trim()) {
        localStorage.setItem(STORAGE_KEYS.CLIENT_ID, clientId.trim());
    } else {
        localStorage.removeItem(STORAGE_KEYS.CLIENT_ID);
    }
};

// 2. Token helpers
export const getStoredToken = (checkExpiry: boolean = true): string | null => {
    const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
    const expiryStr = localStorage.getItem(STORAGE_KEYS.EXPIRY);
    if (!token) return null;

    if (checkExpiry && expiryStr) {
        const expiry = parseInt(expiryStr, 10);
        // 60s buffer for safety
        if (Date.now() >= expiry - 60000) {
            return null;
        }
    }
    return token;
};

export const isTokenValid = (): boolean => {
    return !!getStoredToken(true);
};

export const getStoredProfile = (): GoogleUserProfile | null => {
    const raw = localStorage.getItem(STORAGE_KEYS.PROFILE);
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
};

// Returns whether the user has linked a Google Drive account.
// Persists across browser sessions even if short-lived access token needs refreshing.
export const isDriveConnected = (): boolean => {
    return !!getStoredProfile();
};

// 3. Ensure Google Identity Services (GIS) Script is Loaded
export const ensureGsiLoaded = (): Promise<void> => {
    return new Promise((resolve, reject) => {
        if ((window as any).google?.accounts?.oauth2) {
            return resolve();
        }
        const existingScript = document.getElementById('gsi-client-script');
        if (existingScript) {
            existingScript.addEventListener('load', () => resolve());
            existingScript.addEventListener('error', (e) => reject(e));
            return;
        }

        const script = document.createElement('script');
        script.id = 'gsi-client-script';
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Google Identity Services SDK'));
        document.head.appendChild(script);
    });
};

// 4. Token request handler with silent refresh support
let activeTokenRefreshPromise: Promise<{ token: string; profile: GoogleUserProfile }> | null = null;

export const requestGoogleToken = async (options: {
    interactive?: boolean;
    customClientId?: string;
    hint?: string;
} = {}): Promise<{ token: string; profile: GoogleUserProfile }> => {
    await ensureGsiLoaded();

    const clientId = options.customClientId || getGoogleClientId();
    if (!clientId) {
        throw new Error("MISSING_CLIENT_ID");
    }

    return new Promise((resolve, reject) => {
        try {
            let settled = false;
            const timeoutMs = options.interactive ? 120000 : 15000;
            const timer = setTimeout(() => {
                if (!settled) {
                    settled = true;
                    reject(new Error(options.interactive ? 'Google OAuth Popup Timeout' : 'SILENT_REFRESH_TIMEOUT'));
                }
            }, timeoutMs);

            const client = (window as any).google.accounts.oauth2.initTokenClient({
                client_id: clientId,
                scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
                callback: async (tokenResponse: any) => {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timer);

                    if (tokenResponse.error) {
                        return reject(new Error(tokenResponse.error_description || tokenResponse.error));
                    }

                    const token = tokenResponse.access_token;
                    const expiresIn = parseInt(tokenResponse.expires_in, 10) || 3599;
                    const expiry = Date.now() + expiresIn * 1000;

                    let profile = getStoredProfile();
                    try {
                        const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                            headers: { Authorization: `Bearer ${token}` }
                        });
                        if (userRes.ok) {
                            const userInfo = await userRes.json();
                            profile = {
                                id: userInfo.sub || userInfo.email,
                                email: userInfo.email,
                                name: userInfo.name || userInfo.email.split('@')[0],
                                picture: userInfo.picture
                            };
                        }
                    } catch (userErr) {
                        console.warn("Userinfo fetch error during token refresh (reusing stored profile):", userErr);
                    }

                    if (!profile) {
                        return reject(new Error("Failed to retrieve Google profile."));
                    }

                    // Store in localStorage
                    localStorage.setItem(STORAGE_KEYS.TOKEN, token);
                    localStorage.setItem(STORAGE_KEYS.EXPIRY, expiry.toString());
                    localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
                    localStorage.setItem(STORAGE_KEYS.ACCOUNT_LINKED, 'true');

                    window.dispatchEvent(new CustomEvent('apptify_drive_auth_changed', { 
                        detail: { connected: true, profile, tokenValid: true } 
                    }));

                    resolve({ token, profile });
                },
                error_callback: (err: any) => {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timer);
                    reject(new Error(err?.message || (options.interactive ? 'Google OAuth Popup Error' : 'SILENT_REFRESH_FAILED')));
                }
            });

            if (options.interactive) {
                // Interactive login (popup)
                client.requestAccessToken({ prompt: '' });
            } else {
                // Silent refresh: prompt='' and hint with user's email so Google knows which account
                const requestOpts: any = { prompt: '' };
                if (options.hint) {
                    requestOpts.hint = options.hint;
                }
                client.requestAccessToken(requestOpts);
            }
        } catch (err: any) {
            reject(err);
        }
    });
};

// Interactive Google Login popup
export const requestGoogleLogin = async (customClientId?: string): Promise<{ token: string; profile: GoogleUserProfile }> => {
    return requestGoogleToken({ interactive: true, customClientId });
};

// Ensure a valid, non-expired access token. Automatically performs silent refresh if needed.
export const getValidToken = async (forceRefresh: boolean = false): Promise<string> => {
    if (!forceRefresh) {
        const token = getStoredToken(true);
        if (token) return token;
    }

    const profile = getStoredProfile();
    if (!profile) {
        throw new Error("NOT_AUTHENTICATED");
    }

    if (activeTokenRefreshPromise) {
        const res = await activeTokenRefreshPromise;
        return res.token;
    }

    activeTokenRefreshPromise = requestGoogleToken({
        interactive: false,
        hint: profile.email
    });

    try {
        const res = await activeTokenRefreshPromise;
        return res.token;
    } catch (err) {
        console.warn("Silent token refresh failed:", err);
        throw err;
    } finally {
        activeTokenRefreshPromise = null;
    }
};

// Safe Authenticated Fetch with auto-refresh on 401
export const fetchWithAuth = async (url: string, options: RequestInit = {}): Promise<Response> => {
    let token: string;
    try {
        token = await getValidToken(false);
    } catch (err) {
        throw new Error("NOT_AUTHENTICATED");
    }

    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${token}`);

    let res = await fetch(url, { ...options, headers });

    // If 401 Unauthorized, token might be expired on Google's side
    if (res.status === 401) {
        console.log("Token expired during API call (401). Retrying with silent refresh...");
        localStorage.removeItem(STORAGE_KEYS.TOKEN);
        try {
            const freshToken = await getValidToken(true);
            headers.set('Authorization', `Bearer ${freshToken}`);
            res = await fetch(url, { ...options, headers });
        } catch (refreshErr) {
            console.warn("Silent token refresh on 401 failed:", refreshErr);
            throw new Error("TOKEN_EXPIRED");
        }
    }

    return res;
};

// Clear all user-specific data from browser storage on explicit wipe
export const clearAllUserData = () => {
    // 1. MyWealth data
    localStorage.removeItem('mw_data_main');
    // 2. KnowledgeVault data
    localStorage.removeItem('apptify_notes');
    localStorage.removeItem('apptify_tasks');
    localStorage.removeItem('gn_notes');
    localStorage.removeItem('gn_todos');
    localStorage.removeItem('gn_meta');
    localStorage.removeItem('app_notes_embeddings');
    // 3. Sync metadata
    localStorage.removeItem(STORAGE_KEYS.LAST_SYNC);

    // 4. Notify all components to reset their in-memory states immediately
    window.dispatchEvent(new CustomEvent('apptify_data_changed'));
    window.dispatchEvent(new CustomEvent('apptify_notes_changed'));
    window.dispatchEvent(new CustomEvent('apptify_tasks_changed'));
};

// 5. Explicit Logout / Disconnect (User initiated)
export const disconnectGoogleDrive = (wipeLocalData: boolean = false) => {
    const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
    if (token && (window as any).google?.accounts?.oauth2?.revoke) {
        try {
            (window as any).google.accounts.oauth2.revoke(token, () => {});
        } catch {
            // Ignore revoke error
        }
    }

    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    localStorage.removeItem(STORAGE_KEYS.EXPIRY);
    localStorage.removeItem(STORAGE_KEYS.PROFILE);
    localStorage.removeItem(STORAGE_KEYS.LAST_SYNC);
    localStorage.removeItem(STORAGE_KEYS.ACCOUNT_LINKED);

    if (wipeLocalData) {
        clearAllUserData();
    }

    window.dispatchEvent(new CustomEvent('apptify_drive_auth_changed', { detail: { connected: false, profile: null, tokenValid: false } }));
};

// 6. Find Cloud File Helper
const findDriveFile = async (filename = CLOUD_FILENAME): Promise<DriveFileInfo | null> => {
    const q = `name = '${filename}' and trashed = false`;
    const fields = "files(id, name, modifiedTime)";

    const response = await fetchWithAuth(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=${encodeURIComponent(fields)}`);

    if (!response.ok) {
        if (response.status === 401) {
            throw new Error("TOKEN_EXPIRED");
        }
        throw new Error(`Drive search failed (${response.status})`);
    }

    const data = await response.json();
    if (data.files && data.files.length > 0) {
        return data.files[0];
    }

    // Fallback to legacy file name if searching for primary
    if (filename === CLOUD_FILENAME) {
        return await findDriveFile(LEGACY_FILENAME);
    }

    return null;
};

// 7. Check Cloud Metadata (Modified Time)
export const checkCloudMetadata = async (): Promise<DriveFileInfo | null> => {
    if (!isDriveConnected()) return null;
    try {
        return await findDriveFile(CLOUD_FILENAME);
    } catch (err: any) {
        console.warn("Check cloud metadata notice:", err?.message || err);
        return null;
    }
};

// 8. Upload / Save All App Data to Google Drive
export const saveAllDataToDrive = async (customPayload?: any): Promise<{ fileId: string; modifiedTime: string }> => {
    if (!isDriveConnected()) {
        throw new Error("NOT_AUTHENTICATED");
    }

    // Find existing file
    let existingFile: DriveFileInfo | null = null;
    try {
        existingFile = await findDriveFile(CLOUD_FILENAME);
    } catch (e: any) {
        console.warn("Could not find existing drive file:", e?.message || e);
    }

    // Build Payload Bundle
    const nowIso = new Date().toISOString();
    let payload = customPayload;

    if (!payload) {
        let mwData: any = null;
        try {
            const rawMw = localStorage.getItem('mw_data_main');
            if (rawMw) mwData = JSON.parse(rawMw);
        } catch {}

        let notesData: any = [];
        try {
            const rawNotes = localStorage.getItem('apptify_notes');
            if (rawNotes) notesData = JSON.parse(rawNotes);
        } catch {}

        let tasksData: any = [];
        try {
            const rawTasks = localStorage.getItem('apptify_tasks');
            if (rawTasks) tasksData = JSON.parse(rawTasks);
        } catch {}

        payload = {
            version: 2,
            appName: 'Apptify',
            lastUpdated: nowIso,
            mywealth: mwData,
            notes: notesData,
            tasks: tasksData
        };
    } else {
        payload.lastUpdated = payload.lastUpdated || nowIso;
    }

    const metadata = {
        name: CLOUD_FILENAME,
        mimeType: 'application/json',
    };

    const fileContent = JSON.stringify(payload, null, 2);

    // Multipart Request
    const boundary = 'apptify_bound_' + Date.now().toString();
    const delimiter = "\r\n--" + boundary + "\r\n";
    const closeDelim = "\r\n--" + boundary + "--";

    const body = delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        fileContent +
        closeDelim;

    const url = existingFile
        ? `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=multipart&fields=id,modifiedTime`
        : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,modifiedTime`;
    const method = existingFile ? 'PATCH' : 'POST';

    const res = await fetchWithAuth(url, {
        method,
        headers: {
            'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body
    });

    if (!res.ok) {
        let detail = '';
        try {
            const errData = await res.json();
            detail = errData.error?.message || JSON.stringify(errData);
        } catch {}

        if (res.status === 401) {
            throw new Error("TOKEN_EXPIRED");
        }
        if (res.status === 403) {
            throw new Error(`权限受限 (403): 请确保已在 Google Cloud Console 中启用了 "Google Drive API"服务。${detail ? ' (' + detail + ')' : ''}`);
        }
        throw new Error(`同步网盘文件失败 (${res.status}): ${detail}`);
    }

    const resultJson = await res.json();

    localStorage.setItem(STORAGE_KEYS.LAST_SYNC, resultJson.modifiedTime || nowIso);
    window.dispatchEvent(new CustomEvent('apptify_drive_synced', { detail: { lastUpdated: resultJson.modifiedTime || nowIso } }));

    return {
        fileId: resultJson.id,
        modifiedTime: resultJson.modifiedTime || nowIso
    };
};

// 9. Load All App Data from Google Drive
export const loadAllDataFromDrive = async (): Promise<any> => {
    if (!isDriveConnected()) {
        throw new Error("NOT_AUTHENTICATED");
    }

    const file = await findDriveFile(CLOUD_FILENAME);
    if (!file) {
        return null; // First time user without remote data
    }

    const response = await fetchWithAuth(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`);

    if (!response.ok) {
        if (response.status === 401) {
            throw new Error("TOKEN_EXPIRED");
        }
        throw new Error(`Failed to download Drive file (${response.status})`);
    }

    const cloudData = await response.json();

    // Restore to LocalStorage
    let hasUpdated = false;

    // Handle MyWealth data
    const mwContent = cloudData.mywealth || (cloudData.accounts ? cloudData : null);
    if (mwContent) {
        localStorage.setItem('mw_data_main', JSON.stringify(mwContent));
        hasUpdated = true;
    }

    // Handle Notes & Tasks
    if (Array.isArray(cloudData.notes)) {
        localStorage.setItem('apptify_notes', JSON.stringify(cloudData.notes));
        hasUpdated = true;
    }
    if (Array.isArray(cloudData.tasks)) {
        localStorage.setItem('apptify_tasks', JSON.stringify(cloudData.tasks));
        hasUpdated = true;
    }

    const syncTime = file.modifiedTime || cloudData.lastUpdated || new Date().toISOString();
    localStorage.setItem(STORAGE_KEYS.LAST_SYNC, syncTime);

    if (hasUpdated) {
        window.dispatchEvent(new CustomEvent('apptify_data_changed'));
        window.dispatchEvent(new CustomEvent('apptify_notes_changed'));
        window.dispatchEvent(new CustomEvent('apptify_tasks_changed'));
    }

    window.dispatchEvent(new CustomEvent('apptify_drive_synced', { detail: { lastUpdated: syncTime } }));

    return cloudData;
};

