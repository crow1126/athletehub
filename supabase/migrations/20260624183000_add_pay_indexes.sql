-- CREATE INDEXES ON APEX PAY TABLES FOR PERFORMANCE & SPEED
CREATE INDEX IF NOT EXISTS idx_pay_wallets_team_id ON public.pay_wallets(team_id);
CREATE INDEX IF NOT EXISTS idx_pay_transactions_team_id ON public.pay_transactions(team_id);
CREATE INDEX IF NOT EXISTS idx_pay_transactions_reference ON public.pay_transactions(reference);
CREATE INDEX IF NOT EXISTS idx_pay_payroll_runs_team_id ON public.pay_payroll_runs(team_id);
CREATE INDEX IF NOT EXISTS idx_pay_payroll_items_run_id ON public.pay_payroll_items(payroll_run_id);
