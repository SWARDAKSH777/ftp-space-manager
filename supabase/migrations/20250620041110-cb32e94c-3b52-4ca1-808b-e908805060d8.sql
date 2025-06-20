
-- Complete database reset and new schema
-- Drop all existing tables and start fresh
DROP TABLE IF EXISTS activity_log CASCADE;
DROP TABLE IF EXISTS admin_settings CASCADE;
DROP TABLE IF EXISTS admin_users CASCADE;
DROP TABLE IF EXISTS file_cache CASCADE;
DROP TABLE IF EXISTS file_permissions CASCADE;
DROP TABLE IF EXISTS ftp_servers CASCADE;
DROP TABLE IF EXISTS server_config CASCADE;
DROP TABLE IF EXISTS server_statistics CASCADE;
DROP TABLE IF EXISTS upload_history CASCADE;
DROP TABLE IF EXISTS upload_schedules CASCADE;
DROP TABLE IF EXISTS user_permissions CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;

-- Drop existing functions
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.is_admin(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_permissions(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;

-- Drop existing types
DROP TYPE IF EXISTS file_type CASCADE;
DROP TYPE IF EXISTS connection_status CASCADE;
DROP TYPE IF EXISTS upload_status CASCADE;

-- Create new types
CREATE TYPE file_type AS ENUM ('file', 'directory');
CREATE TYPE connection_status AS ENUM ('active', 'inactive', 'error');
CREATE TYPE upload_status AS ENUM ('pending', 'in_progress', 'completed', 'failed');

-- Create user_profiles table (main user management)
CREATE TABLE public.user_profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    username text NOT NULL UNIQUE,
    full_name text NOT NULL,
    is_admin boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid REFERENCES auth.users(id)
);

-- Create admin_users table for admin management
CREATE TABLE public.admin_users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid REFERENCES auth.users(id)
);

-- Create file_permissions table
CREATE TABLE public.file_permissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    path text NOT NULL,
    can_read boolean DEFAULT true NOT NULL,
    can_write boolean DEFAULT false NOT NULL,
    can_delete boolean DEFAULT false NOT NULL,
    granted_by uuid REFERENCES auth.users(id) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Create server_config table (single family server)
CREATE TABLE public.server_config (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL DEFAULT 'Family Server',
    host text NOT NULL,
    port integer DEFAULT 21 NOT NULL,
    username text NOT NULL,
    password text NOT NULL,
    protocol text DEFAULT 'ftp' NOT NULL CHECK (protocol IN ('ftp', 'ftps', 'sftp')),
    passive_mode boolean DEFAULT true NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid REFERENCES auth.users(id) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Create file_cache table
CREATE TABLE public.file_cache (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id uuid REFERENCES public.server_config(id) ON DELETE CASCADE NOT NULL,
    path text NOT NULL,
    name text NOT NULL,
    size bigint DEFAULT 0,
    type file_type NOT NULL,
    mime_type text,
    modified_at timestamp with time zone,
    cached_at timestamp with time zone DEFAULT now() NOT NULL,
    thumbnail_url text,
    preview_available boolean DEFAULT false,
    UNIQUE(server_id, path)
);

-- Create activity_log table
CREATE TABLE public.activity_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    action text NOT NULL,
    details jsonb,
    ip_address inet,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS on all tables
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.server_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user_profiles
CREATE POLICY "Users can view their own profile" ON public.user_profiles
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can view all profiles" ON public.user_profiles
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can update their own profile" ON public.user_profiles
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all profiles" ON public.user_profiles
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
    );

-- Create RLS policies for admin_users
CREATE POLICY "Admins can manage admin users" ON public.admin_users
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
    );

-- Create RLS policies for file_permissions
CREATE POLICY "Users can view their own permissions" ON public.file_permissions
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all permissions" ON public.file_permissions
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
    );

-- Create RLS policies for server_config
CREATE POLICY "Admins can manage server config" ON public.server_config
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
    );

-- Create RLS policies for file_cache
CREATE POLICY "Users can view file cache" ON public.file_cache
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()) OR
        EXISTS (
            SELECT 1 FROM public.file_permissions fp 
            WHERE fp.user_id = auth.uid() 
            AND fp.can_read = true 
            AND file_cache.path LIKE fp.path || '%'
        )
    );

CREATE POLICY "Admins can manage file cache" ON public.file_cache
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
    );

-- Create RLS policies for activity_log
CREATE POLICY "Users can view their own activity" ON public.activity_log
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can view all activity" ON public.activity_log
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
    );

CREATE POLICY "System can insert activity logs" ON public.activity_log
    FOR INSERT WITH CHECK (true);

-- Create utility functions
CREATE OR REPLACE FUNCTION public.is_admin(user_uuid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.admin_users 
        WHERE user_id = user_uuid
    );
$$;

CREATE OR REPLACE FUNCTION public.get_user_permissions(user_uuid uuid, file_path text)
RETURNS table(can_read boolean, can_write boolean, can_delete boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT 
        COALESCE(fp.can_read, false) as can_read,
        COALESCE(fp.can_write, false) as can_write,
        COALESCE(fp.can_delete, false) as can_delete
    FROM public.file_permissions fp
    WHERE fp.user_id = user_uuid 
    AND (file_path LIKE fp.path || '%' OR fp.path = '/')
    ORDER BY length(fp.path) DESC
    LIMIT 1;
$$;

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Create triggers for updated_at
CREATE TRIGGER update_user_profiles_updated_at 
    BEFORE UPDATE ON public.user_profiles 
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_file_permissions_updated_at 
    BEFORE UPDATE ON public.file_permissions 
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_server_config_updated_at 
    BEFORE UPDATE ON public.server_config 
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user registration (only for admin-created accounts)
CREATE OR REPLACE FUNCTION public.handle_admin_created_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Only create profile if user was created with metadata indicating admin creation
    IF NEW.raw_user_meta_data->>'created_by_admin' = 'true' THEN
        INSERT INTO public.user_profiles (
            user_id, 
            username, 
            full_name, 
            is_admin,
            created_by
        )
        VALUES (
            NEW.id,
            NEW.raw_user_meta_data->>'username',
            NEW.raw_user_meta_data->>'full_name',
            COALESCE((NEW.raw_user_meta_data->>'is_admin')::boolean, false),
            (NEW.raw_user_meta_data->>'created_by')::uuid
        );
        
        -- If this user is marked as admin, add to admin_users table
        IF COALESCE((NEW.raw_user_meta_data->>'is_admin')::boolean, false) THEN
            INSERT INTO public.admin_users (user_id, created_by)
            VALUES (NEW.id, (NEW.raw_user_meta_data->>'created_by')::uuid);
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger for new user handling
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_admin_created_user();

-- Create the initial admin user (hackerdaksh777@gmail.com)
-- First ensure the user exists in auth.users (this will be the admin account)
-- Note: The actual user creation needs to be done through Supabase Auth
-- This part will be handled in the application code

-- Create indexes for better performance
CREATE INDEX idx_user_profiles_user_id ON public.user_profiles(user_id);
CREATE INDEX idx_user_profiles_username ON public.user_profiles(username);
CREATE INDEX idx_admin_users_user_id ON public.admin_users(user_id);
CREATE INDEX idx_file_permissions_user_id ON public.file_permissions(user_id);
CREATE INDEX idx_file_permissions_path ON public.file_permissions(path);
CREATE INDEX idx_file_cache_server_id ON public.file_cache(server_id);
CREATE INDEX idx_file_cache_path ON public.file_cache(server_id, path);
CREATE INDEX idx_activity_log_user_id ON public.activity_log(user_id);
CREATE INDEX idx_activity_log_created_at ON public.activity_log(created_at);
