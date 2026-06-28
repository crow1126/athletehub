-- Migration: 20260628181000_mask_phone_in_metadata.sql
-- Masks phone numbers stored in plain text inside pay_payroll_items.metadata.
-- Full phone numbers in the `phone` column are kept (needed for Moolre API).
-- The phone in metadata JSON (used in pay_transactions.metadata) is masked
-- to last-4-digits for privacy in logs and audit trails.
--
-- Note: The `phone` column in pay_payroll_items remains unencrypted for now
-- so that Moolre API calls continue to work. If pgcrypto column-level
-- encryption is needed, run a separate migration with Supabase Vault.

begin;

-- Mask phone numbers stored in pay_transactions.metadata
-- (set by the disburse route as metadata.phone)
update public.pay_transactions
set metadata = jsonb_set(
  metadata,
  '{phone}',
  to_jsonb('****' || right(metadata->>'phone', 4))
)
where
  metadata is not null
  and metadata ? 'phone'
  and length(metadata->>'phone') > 4
  and metadata->>'phone' not like '****%';

-- Add a comment to remind devs about the privacy requirement
comment on column public.pay_payroll_items.phone is
  'Recipient phone number (full, required for Moolre API). Do not expose in logs — use masked version for display.';

comment on column public.pay_transactions.metadata is
  'Audit metadata. Phone numbers must be masked (last 4 digits only) before storage here.';

commit;
