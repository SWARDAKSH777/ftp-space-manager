
-- First, let's clean up the teams-related tables
DROP TABLE IF EXISTS team_members CASCADE;
DROP TABLE IF EXISTS teams CASCADE;

-- Remove the shared_with_team column from ftp_servers
ALTER TABLE ftp_servers DROP COLUMN IF EXISTS shared_with_team;

-- Remove shared_ftp_servers table as we'll use a different approach
DROP TABLE IF EXISTS shared_ftp_servers CASCADE;

-- Create admin users table
CREATE TABLE IF NOT EXISTS admin_users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid REFERENCES auth.users(id),
    UNIQUE(user_id)
);

-- Update user_profiles to include display_name for family members
ALTER TABLE user_profiles 
    ADD COLUMN IF NOT EXISTS full_name text,
    ADD COLUMN IF NOT EXISTS phone text,
    ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;

-- Create file permissions table for granular access control
CREATE TABLE IF NOT EXISTS file_permissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    path text NOT NULL,
    can_read boolean DEFAULT true,
    can_write boolean DEFAULT false,
    can_delete boolean DEFAULT false,
    granted_by uuid REFERENCES auth.users(id) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Create a single server configuration table (only one server allowed)
CREATE TABLE IF NOT EXISTS server_config (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL DEFAULT 'Family Server',
    host text NOT NULL,
    port integer DEFAULT 21,
    username text NOT NULL,
    password text NOT NULL,
    protocol text DEFAULT 'ftp',
    passive_mode boolean DEFAULT true,
    is_active boolean DEFAULT true,
    created_by uuid REFERENCES auth.users(id) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    -- Ensure only one server config exists
    CONSTRAINT single_server_only CHECK (id IS NOT NULL)
);

-- Create unique index to enforce single server
CREATE UNIQUE INDEX IF NOT EXISTS single_server_config ON server_config ((true));

-- Enable RLS on all tables
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE server_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies for admin_users (only admins can manage)
CREATE POLICY "Admins can manage admin users" ON admin_users
    FOR ALL USING (EXISTS (
        SELECT 1 FROM admin_users au WHERE au.user_id = auth.uid()
    ));

-- RLS Policies for file_permissions (admins can manage, users can view their own)
CREATE POLICY "Users can view their own permissions" ON file_permissions
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all permissions" ON file_permissions
    FOR ALL USING (EXISTS (
        SELECT 1 FROM admin_users au WHERE au.user_id = auth.uid()
    ));

-- RLS Policies for server_config (only admins can access)
CREATE POLICY "Only admins can access server config" ON server_config
    FOR ALL USING (EXISTS (
        SELECT 1 FROM admin_users au WHERE au.user_id = auth.uid()
    ));

-- Update existing policies for user_profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
CREATE POLICY "Users can view profiles" ON user_profiles
    FOR SELECT USING (
        user_id = auth.uid() OR 
        EXISTS (SELECT 1 FROM admin_users au WHERE au.user_id = auth.uid())
    );

CREATE POLICY "Users can update their own profile" ON user_profiles
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all profiles" ON user_profiles
    FOR ALL USING (EXISTS (
        SELECT 1 FROM admin_users au WHERE au.user_id = auth.uid()
    ));

-- Update ftp_servers policies (only admins can manage)
DROP POLICY IF EXISTS "Users can manage their servers" ON ftp_servers;
CREATE POLICY "Only admins can manage servers" ON ftp_servers
    FOR ALL USING (EXISTS (
        SELECT 1 FROM admin_users au WHERE au.user_id = auth.uid()
    ));

-- Create function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin(user_uuid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM admin_users 
        WHERE user_id = user_uuid
    );
$$;

-- Create function to get user permissions for a path
CREATE OR REPLACE FUNCTION get_user_permissions(user_uuid uuid, file_path text)
RETURNS table(can_read boolean, can_write boolean, can_delete boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT 
        COALESCE(fp.can_read, false) as can_read,
        COALESCE(fp.can_write, false) as can_write,
        COALESCE(fp.can_delete, false) as can_delete
    FROM file_permissions fp
    WHERE fp.user_id = user_uuid 
    AND (file_path LIKE fp.path || '%' OR fp.path = '/')
    ORDER BY length(fp.path) DESC
    LIMIT 1;
$$;

-- Update the handle_new_user function to support admin creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.user_profiles (user_id, username, display_name, role, full_name)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
        'user',
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
    );
    
    -- If this is the first user, make them admin
    IF (SELECT COUNT(*) FROM auth.users) = 1 THEN
        INSERT INTO public.admin_users (user_id, created_by)
        VALUES (NEW.id, NEW.id);
        
        UPDATE public.user_profiles 
        SET is_admin = true 
        WHERE user_id = NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$;
