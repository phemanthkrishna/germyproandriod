-- Add FCM token to profiles so customers can receive push notifications
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS fcm_token text;
