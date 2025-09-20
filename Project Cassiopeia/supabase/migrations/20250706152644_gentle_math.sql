/*
  # Create memories table for Gemma's memory system

  1. New Tables
    - `memories`
      - `id` (uuid, primary key)
      - `user_uuid` (text, not null) - User's Google ID from authentication
      - `name` (text, not null) - Short descriptive key for the memory
      - `memory` (text, not null) - The actual memory content
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())

  2. Security
    - Enable RLS on `memories` table
    - Add policy for users to manage their own memories only

  3. Indexes
    - Add index on user_uuid for faster queries
    - Add unique constraint on user_uuid + name to prevent duplicate memory keys
*/

CREATE TABLE IF NOT EXISTS memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_uuid text NOT NULL,
  name text NOT NULL,
  memory text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_uuid, name)
);

-- Enable Row Level Security
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;

-- Create policy for users to access only their own memories
CREATE POLICY "Users can manage their own memories"
  ON memories
  FOR ALL
  TO authenticated
  USING (user_uuid = auth.jwt() ->> 'sub');

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_memories_user_uuid ON memories(user_uuid);
CREATE INDEX IF NOT EXISTS idx_memories_user_name ON memories(user_uuid, name);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_memories_updated_at
  BEFORE UPDATE ON memories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();