-- Add materials list photo URL column to orders table
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS mat_list_photo_url TEXT;
