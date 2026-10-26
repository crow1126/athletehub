// Check if profiles.updated_at exists using pg_attribute system table via Supabase RPC
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
  // Try to select updated_at from a single profiles row to see if it exists
  const { data, error } = await db
    .from('profiles')
    .select('updated_at')
    .limit(1);

  if (!error) {
    console.log('✅ profiles.updated_at already exists — no migration needed.');
    return;
  }

  if (error.message.includes('updated_at') || error.message.includes('column')) {
    console.log('❌ Column is missing:', error.message);
    console.log('\n📋 MANUAL STEP REQUIRED:');
    console.log('Run this SQL in your Supabase SQL Editor (https://supabase.com/dashboard):');
    console.log('');
    console.log('ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();');
    console.log('');
    console.log('Or apply the migration file: supabase/migrations/20261026133000_add_updated_at_to_profiles.sql');
  } else {
    console.log('Unexpected error:', error.message);
  }
}

run().catch(console.error);
