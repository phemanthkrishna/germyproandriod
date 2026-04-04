-- Worker notification + auto-timeout columns
ALTER TABLE workers
  ADD COLUMN IF NOT EXISTS fcm_token              text,
  ADD COLUMN IF NOT EXISTS last_active_at         timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS went_offline_at        timestamptz,
  ADD COLUMN IF NOT EXISTS offline_warning_sent_at timestamptz;

-- Schedule the auto-timeout function every 30 minutes via pg_cron
-- Run this after enabling the pg_cron extension in Supabase (Database → Extensions → pg_cron)
SELECT cron.schedule(
  'worker-auto-timeout',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://czhffuzqxkhxfmvjucee.supabase.co/functions/v1/worker-auto-timeout',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6aGZmdXpxeGtoeGZtdmp1Y2VlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1NjMwMjAsImV4cCI6MjA4OTEzOTAyMH0.7pJkYZQDsnRiYR2a-2CXcdHvVP6TbaNGqH0R6ceIbic'
    ),
    body    := '{}'::jsonb
  ) AS request_id;
  $$
);
