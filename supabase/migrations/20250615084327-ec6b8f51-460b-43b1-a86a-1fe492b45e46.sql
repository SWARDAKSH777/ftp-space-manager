
-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum for file types
CREATE TYPE file_type AS ENUM ('file', 'directory');

-- Create enum for connection status
CREATE TYPE connection_status AS ENUM ('active', 'inactive', 'error');

-- Create enum for upload status
CREATE TYPE upload_status AS ENUM ('pending', 'in_progress', 'completed', 'failed');

-- Create FTP servers table
CREATE TABLE public.ftp_servers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    host TEXT NOT NULL,
    port INTEGER DEFAULT 21,
    username TEXT NOT NULL,
    password TEXT NOT NULL, -- In production, this should be encrypted
    protocol TEXT DEFAULT 'ftp' CHECK (protocol IN ('ftp', 'ftps', 'sftp')),
    passive_mode BOOLEAN DEFAULT true,
    status connection_status DEFAULT 'inactive',
    last_connected TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create file cache table for better performance
CREATE TABLE public.file_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id UUID REFERENCES public.ftp_servers(id) ON DELETE CASCADE NOT NULL,
    path TEXT NOT NULL,
    name TEXT NOT NULL,
    size BIGINT DEFAULT 0,
    type file_type NOT NULL,
    mime_type TEXT,
    modified_at TIMESTAMP WITH TIME ZONE,
    cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    thumbnail_url TEXT,
    preview_available BOOLEAN DEFAULT false,
    UNIQUE(server_id, path)
);

-- Create upload schedules table
CREATE TABLE public.upload_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    server_id UUID REFERENCES public.ftp_servers(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    local_path TEXT NOT NULL,
    remote_path TEXT NOT NULL,
    schedule_cron TEXT NOT NULL, -- Cron expression
    is_active BOOLEAN DEFAULT true,
    last_run TIMESTAMP WITH TIME ZONE,
    next_run TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create upload history table
CREATE TABLE public.upload_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID REFERENCES public.upload_schedules(id) ON DELETE CASCADE,
    server_id UUID REFERENCES public.ftp_servers(id) ON DELETE CASCADE NOT NULL,
    file_name TEXT NOT NULL,
    file_size BIGINT,
    local_path TEXT,
    remote_path TEXT NOT NULL,
    status upload_status DEFAULT 'pending',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT
);

-- Create statistics table
CREATE TABLE public.server_statistics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id UUID REFERENCES public.ftp_servers(id) ON DELETE CASCADE NOT NULL,
    total_files INTEGER DEFAULT 0,
    total_directories INTEGER DEFAULT 0,
    total_size BIGINT DEFAULT 0,
    last_scan TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    file_types JSONB DEFAULT '{}', -- Store file type counts
    size_distribution JSONB DEFAULT '{}' -- Store size distribution data
);

-- Create user activity log
CREATE TABLE public.activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    server_id UUID REFERENCES public.ftp_servers(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    details JSONB,
    ip_address INET,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.ftp_servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upload_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upload_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.server_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for ftp_servers
CREATE POLICY "Users can manage their own FTP servers" ON public.ftp_servers
    FOR ALL USING (auth.uid() = user_id);

-- Create RLS policies for file_cache
CREATE POLICY "Users can access file cache for their servers" ON public.file_cache
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.ftp_servers 
            WHERE id = file_cache.server_id AND user_id = auth.uid()
        )
    );

-- Create RLS policies for upload_schedules
CREATE POLICY "Users can manage their own upload schedules" ON public.upload_schedules
    FOR ALL USING (auth.uid() = user_id);

-- Create RLS policies for upload_history
CREATE POLICY "Users can view their own upload history" ON public.upload_history
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.ftp_servers 
            WHERE id = upload_history.server_id AND user_id = auth.uid()
        )
    );

-- Create RLS policies for server_statistics
CREATE POLICY "Users can view statistics for their servers" ON public.server_statistics
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.ftp_servers 
            WHERE id = server_statistics.server_id AND user_id = auth.uid()
        )
    );

-- Create RLS policies for activity_log
CREATE POLICY "Users can view their own activity" ON public.activity_log
    FOR ALL USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX idx_ftp_servers_user_id ON public.ftp_servers(user_id);
CREATE INDEX idx_file_cache_server_id ON public.file_cache(server_id);
CREATE INDEX idx_file_cache_path ON public.file_cache(server_id, path);
CREATE INDEX idx_upload_schedules_user_id ON public.upload_schedules(user_id);
CREATE INDEX idx_upload_schedules_next_run ON public.upload_schedules(next_run) WHERE is_active = true;
CREATE INDEX idx_upload_history_server_id ON public.upload_history(server_id);
CREATE INDEX idx_upload_history_status ON public.upload_history(status);
CREATE INDEX idx_server_statistics_server_id ON public.server_statistics(server_id);
CREATE INDEX idx_activity_log_user_id ON public.activity_log(user_id);
CREATE INDEX idx_activity_log_created_at ON public.activity_log(created_at);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for ftp_servers
CREATE TRIGGER update_ftp_servers_updated_at 
    BEFORE UPDATE ON public.ftp_servers 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
