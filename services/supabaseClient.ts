
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bbuaztboozqxajrbvsec.supabase.co';
const supabaseKey = 'sb_publishable_-UexQsGMFi4nTrKEiXr-0w_JpFQVN23';

export const supabase = createClient(supabaseUrl, supabaseKey);
