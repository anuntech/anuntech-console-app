-- "support" and "finance" collapse into a single "member" role. Only
-- "manager" (Administrador) keeps access beyond the shared/support area now.
UPDATE console_memberships SET role = 'member' WHERE role IN ('support', 'finance');
