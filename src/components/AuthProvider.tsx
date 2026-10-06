import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
    getStoredProfile,
    isDriveConnected,
    requestGoogleLogin,
    disconnectGoogleDrive,
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
    loading: true,
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
    const [googleClientId, setGoogleClientIdState] = useState<string>(() => getGoogleClientId());

    // Sync state listener
    useEffect(() => {
        const handleAuthChanged = (e: any) => {
            const connected = e.detail?.connected ?? isDriveConnected();
            const profile = e.detail?.profile ?? getStoredProfile();
            setIsConnected(connected);
            setUser(profile);
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

    // Auto-check remote updates when app opens or becomes visible
    useEffect(() => {
        if (!isConnected) return;

        const syncWithCloudIfNewer = async () => {
            try {
                const remoteMeta = await checkCloudMetadata();
                if (!remoteMeta) return;

                const remoteTime = new Date(remoteMeta.modifiedTime).getTime();
                const lastLocalSync = lastSyncedTime ? new Date(lastSyncedTime).getTime() : 0;

                // If remote is strictly newer than our last synced time
                if (remoteTime > lastLocalSync) {
                    setIsSyncing(true);
                    await loadAllDataFromDrive();
                    setLastSyncedTime(remoteMeta.modifiedTime);
                }
            } catch (err) {
                console.warn("Cloud check error:", err);
            } finally {
                setIsSyncing(false);
            }
        };

        syncWithCloudIfNewer();

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && isDriveConnected()) {
                syncWithCloudIfNewer();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [isConnected, lastSyncedTime]);

    // Connect Action
    const connectGoogleDrive = useCallback(async (customClientId?: string) => {
        setIsSyncing(true);
        try {
            const { profile } = await requestGoogleLogin(customClientId);
            setUser(profile);
            setIsConnected(true);

            // Immediately attempt initial pull from Drive
            try {
                await loadAllDataFromDrive();
            } catch (loadErr) {
                console.warn("No existing cloud backup found or first load, pushing initial local data...", loadErr);
                // If cloud had nothing, push initial local data
                await saveAllDataToDrive();
            }

            return profile;
        } finally {
            setIsSyncing(false);
        }
    }, []);

    // Disconnect Action
    const disconnect = useCallback(() => {
        disconnectGoogleDrive();
        setUser(null);
        setIsConnected(false);
        setLastSyncedTime(null);
    }, []);

    // Manual Sync Now
    const syncNow = useCallback(async () => {
        if (!isDriveConnected()) return;
        setIsSyncing(true);
        try {
            await saveAllDataToDrive();
            const now = new Date().toISOString();
            setLastSyncedTime(now);
        } catch (err: any) {
            console.error("Manual sync failed:", err);
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
