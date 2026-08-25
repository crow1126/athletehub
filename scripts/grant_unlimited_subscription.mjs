import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  const teamId = '99801a63-c7ba-474d-a664-86de133ff054';

  const subData = {
    plan: 'captain',
    status: 'active',
    athlete_limit: 999999,
    staff_limit: 99999,
    current_period_start: new Date().toISOString(),
    current_period_end: '2099-12-31T23:59:59.000Z',
    trial_ends_at: null,
    notes: 'Unlimited VIP / Testing Access',
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('subscriptions')
    .update(subData)
    .eq('team_id', teamId)
    .select();

  if (error) {
    console.error('Error updating subscription:', error);
  } else {
    console.log('Subscription updated successfully:', data);
  }
}

main();
