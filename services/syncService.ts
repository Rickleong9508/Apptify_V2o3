
import { supabase } from './supabaseClient';
import { Session } from '@supabase/supabase-js';

// Debounce helper to prevent flooding API
const debounce = (func: Function, wait: number) => {
    let timeout: NodeJS.Timeout;
    return (...args: any[]) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
};

export const syncService = {
    // Save data to Supabase (Upsert)
    save: async (key: string, data: any) => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return; // No user, no sync

        try {
            const { error } = await supabase
                .from('user_data')
                .upsert({
                    user_id: session.user.id,
                    key: key,
                    data: data,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id, key' });

            if (error) {
                if (error.code === 'PGRST205') {
                    console.warn(`Sync Warning: 'user_data' table missing. Data saved locally only.`);
                } else {
                    console.error(`Sync Save Error [${key}]:`, error);
                }
            } else {
                // console.log(`Sync Saved [${key}]`);
            }
        } catch (err) {
            console.error("Sync Exception:", err);
        }
    },

    // Load data from Supabase
    load: async (key: string) => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return null;

        try {
            const { data, error } = await supabase
                .from('user_data')
                .select('data')
                .eq('user_id', session.user.id)
                .eq('key', key)
                .single();

            if (error) {
                if (error.code === 'PGRST116') { // Row not found
                    // Normal case for new user
                } else if (error.code === 'PGRST205') { // Table not found
                    console.warn(`Sync Warning: 'user_data' table missing. Sync disabled.`);
                } else {
                    console.error(`Sync Load Error [${key}]:`, error);
                }
                return null;
            }
            return data?.data || null;
        } catch (err) {
            console.error("Sync Load Exception:", err);
            return null;
        }
    },

    // Create a debounced saver
    createDebouncedSaver: (key: string, wait = 2000) => {
        return debounce((data: any) => syncService.save(key, data), wait);
    }
};
