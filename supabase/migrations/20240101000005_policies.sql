DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can manage all campaigns" ON campaigns;
DROP POLICY IF EXISTS "Admins can view all advertisers" ON advertisers;
DROP POLICY IF EXISTS "Admins can manage settings" ON platform_settings;
DROP POLICY IF EXISTS "Admins can view consent audit log" ON consent_audit_log;
DROP POLICY IF EXISTS "Admins can view all trust scores" ON publisher_trust_scores;
DROP POLICY IF EXISTS "Only admins can manage emergency controls" ON emergency_controls;

CREATE POLICY profiles_admin_select
ON profiles
FOR SELECT
USING (
  auth.jwt() ->> 'role' = 'admin'
  OR id = auth.uid()
);

CREATE POLICY campaigns_admin_all
ON campaigns
FOR ALL
USING (
  auth.jwt() ->> 'role' = 'admin'
);

CREATE POLICY advertisers_admin_select
ON advertisers
FOR SELECT
USING (
  auth.jwt() ->> 'role' = 'admin'
);

CREATE POLICY platform_settings_admin_all
ON platform_settings
FOR ALL
USING (
  auth.jwt() ->> 'role' = 'admin'
);

CREATE POLICY consent_audit_log_admin_select
ON consent_audit_log
FOR SELECT
USING (
  auth.jwt() ->> 'role' = 'admin'
);

CREATE POLICY publisher_trust_scores_admin_select
ON publisher_trust_scores
FOR SELECT
USING (
  auth.jwt() ->> 'role' = 'admin'
);

CREATE POLICY emergency_controls_admin_all
ON emergency_controls
FOR ALL
USING (
  auth.jwt() ->> 'role' = 'admin'
);
