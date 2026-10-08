import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
    getStoredProfile,
    isDriveConnected,
    isTokenValid,
    getValidToken,
    requestGoogleLogin,
    disconnectGoogleDrive,
    clearAllUserData,
    saveAllDataToDrive,
    loadAllDataFromDrive,
    checkCloudMetadata,
    getGoogleClientId,
    setGoogleClientId,
    GoogleUserProfile,
    STORAGE_KEYS
} from '../services/driveService';

export interface AppUser {
    id: string;
    email: string;
    name: string;
    picture?: string;
}

interface AuthContextType {
    session: { user: AppUser } | null;
    user: AppUser | null;
    isConnected: boolean;
    isSyncing: boolean;
    lastSyncedTime: string | null;
    loading: boolean;
    needsReauth: boolean;
    googleClientId: string;
    connectGoogleDrive: (customClientId?: string) => Promise<GoogleUserProfile>;
    disconnectGoogleDrive: () => void;
    signOut: () => Promise<void>;
    syncNow: () => Promise<void>;
    updateClientId: (newId: string) => void;
}

const AuthContext = createContext<AuthContextType>({
    session: null,
    user: null,
    isConnected: false,
    isSyncing: false,
    lastSyncedTime: null,
    loading: false,
    needsReauth: false,
    googleClientId: '',
    connectGoogleDrive: async () => { throw new Error('Not initialized'); },
    disconnectGoogleDrive: () => {},
    signOut: async () => {},
    syncNow: async () => {},
    updateClientId: () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<AppUser | null>(() => getStoredProfile());
    const [isConnected, setIsConnected] = useState<boolean>(() => isDriveConnected());
    const [isSyncing, setIsSyncing] = useState<boolean>(false);
    const [lastSyncedTime, setLastSyncedTime] = useState<string | null>(() => localStorage.getItem(STORAGE_KEYS.LAST_SYNC));
    const [loading, setLoading] = useState<boolean>(false);
    const [needsReauth, setNeedsReauth] = useState<boolean>(false);
    const [googleClientId, setGoogleClientIdState] = useState<string>(() => getGoogleClientId());

    // Sync state listener
    useEffect(() => {
        const handleAuthChanged = (e: any) => {
            const connected = e.detail?.connected ?? isDriveConnected();
            const profile = e.detail?.profile ?? getStoredProfile();
            setIsConnected(connected);
            setUser(profile);
            if (e.detail?.tokenValid) {
                setNeedsReauth(false);
            }
        };

        const handleSyncEvent = (e: any) => {
            const time = e.detail?.lastUpdated || new Date().toISOString();
            setLastSyncedTime(time);
        };

        window.addEventListener('apptify_drive_auth_changed', handleAuthChanged);
        window.addEventListener('apptify_drive_synced', handleSyncEvent);

        return () => {
            window.removeEventListener('apptify_drive_auth_changed', handleAuthChanged);
            window.removeEventListener('apptify_drive_synced', handleSyncEvent);
        };
    }, []);

    // Proactive background silent refresh & Auto-sync on app open or tab visibility
    useEffect(() => {
        if (!isConnected) return;

        const syncWithCloudIfNewer = async () => {
            try {
                // Ensure token is fresh silently without popping windows
                await getValidToken(false).catch((e) => {
                    console.warn("Background silent token check note:", e?.message);
                    if (e?.message === 'TOKEN_EXPIRED' || e?.message === 'SILENT_REFRESH_FAILED') {
                        setNeedsReauth(true);
                    }
                });

                const remoteMeta = await checkCloudMetadata();
                if (!remoteMeta) return;

                setNeedsReauth(false);
                const remoteTime = new Date(remoteMeta.modifiedTime).getTime();
                const lastLocalSync = lastSyncedTime ? new Date(lastSyncedTime).getTime() : 0;

                // If remote is strictly newer than our last synced time
                if (remoteTime > lastLocalSync) {
                    setIsSyncing(true);
                    await loadAllDataFromDrive();
                    setLastSyncedTime(remoteMeta.modifiedTime);
                }
            } catch (err: any) {
                console.warn("Cloud sync check error:", err);
            } finally {
                setIsSyncing(false);
            }
        };

        syncWithCloudIfNewer();

        // Keep-alive timer: check token freshness every 20 minutes
        const keepAliveTimer = setInterval(() => {
            if (isDriveConnected()) {
                getValidToken(false).then(() => setNeedsReauth(false)).catch((err) => {
                    console.warn("Keep-alive silent refresh note:", err?.message);
                });
            }
        }, 20 * 60 * 1000);

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && isDriveConnected()) {
                syncWithCloudIfNewer();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            clearInterval(keepAliveTimer);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [isConnected, lastSyncedTime]);

    // Centralized Debounced Auto-Sync: Listen to any app changes (Notes, Tasks, MyWealth)
    useEffect(() => {
        if (!isConnected) return;

        let debounceTimer: any = null;
        let isIncomingSync = false;

        const handleDriveSynced = () => {
            isIncomingSync = true;
            setTimeout(() => { isIncomingSync = false; }, 800);
        };

        const handleDataChanged = () => {
            if (isIncomingSync) return;
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(async () => {
                if (!isDriveConnected()) return;
                try {
                    await saveAllDataToDrive();
                    setNeedsReauth(false);
                } catch (e: any) {
                    console.warn("Global background auto-sync skipped/failed:", e);
                    if (e?.message === 'TOKEN_EXPIRED') {
                        setNeedsReauth(true);
                    }
                }
            }, 2000);
        };

        window.addEventListener('apptify_data_changed', handleDataChanged);
        window.addEventListener('apptify_drive_synced', handleDriveSynced);

        return () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            window.removeEventListener('apptify_data_changed', handleDataChanged);
            window.removeEventListener('apptify_drive_synced', handleDriveSynced);
        };
    }, [isConnected]);

    // Connect Action (Interactive login)
    const connectGoogleDrive = useCallback(async (customClientId?: string) => {
        setIsSyncing(true);
        try {
            // When connecting a new account explicitly, start fresh for that account
            const existingProfile = getStoredProfile();
            const { profile } = await requestGoogleLogin(customClientId);
            
            // If it's a completely different account, clean stale local data
            if (existingProfile && existingProfile.email !== profile.email) {
                clearAllUserData();
            }

            setUser(profile);
            setIsConnected(true);
            setNeedsReauth(false);

            // Immediately attempt initial pull from Drive
            try {
                const cloudData = await loadAllDataFromDrive();
                if (!cloudData) {
                    console.log("No existing cloud backup for this account. Clean start / initial save.");
                    await saveAllDataToDrive();
                }
            } catch (loadErr) {
                console.warn("No existing cloud backup found for this account:", loadErr);
            }

            return profile;
        } finally {
            setIsSyncing(false);
        }
    }, []);

    // Disconnect Action (User initiated)
    const disconnect = useCallback(() => {
        disconnectGoogleDrive(false);
        setUser(null);
        setIsConnected(false);
        setNeedsReauth(false);
        setLastSyncedTime(null);
    }, []);

    // Manual Sync Now
    const syncNow = useCallback(async () => {
        if (!isDriveConnected()) return;
        setIsSyncing(true);
        try {
            await saveAllDataToDrive();
            setNeedsReauth(false);
            const now = new Date().toISOString();
            setLastSyncedTime(now);
        } catch (err: any) {
            console.error("Manual sync failed:", err);
            if (err?.message === 'TOKEN_EXPIRED' || err?.message === 'SILENT_REFRESH_FAILED') {
                setNeedsReauth(true);
            }
            throw err;
        } finally {
            setIsSyncing(false);
        }
    }, []);

    const updateClientId = useCallback((newId: string) => {
        setGoogleClientId(newId);
        setGoogleClientIdState(newId.trim());
    }, []);

    const session = user ? { user } : null;

    return (
        <AuthContext.Provider
            value={{
                session,
                user,
                isConnected,
                isSyncing,
                lastSyncedTime,
                loading,
                needsReauth,
                googleClientId,
                connectGoogleDrive,
                disconnectGoogleDrive: disconnect,
                signOut: async () => disconnect(),
                syncNow,
                updateClientId
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);

