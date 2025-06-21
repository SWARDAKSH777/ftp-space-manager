
-- Add RLS policy to allow all authenticated users to read active server configs
CREATE POLICY "Allow authenticated users to read active server configs" 
ON public.server_config 
FOR SELECT 
TO authenticated 
USING (is_active = true);

-- Add RLS policy to allow admins to manage all server configs
CREATE POLICY "Allow admins full access to server configs" 
ON public.server_config 
FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles 
    WHERE user_id = auth.uid() AND is_admin = true
  )
);

-- Add RLS policy for user_profiles to allow reading usernames for login
CREATE POLICY "Allow reading user profiles for authentication" 
ON public.user_profiles 
FOR SELECT 
TO authenticated 
USING (true);

-- Add RLS policy for file_permissions to allow users to read their own permissions
CREATE POLICY "Users can read their own file permissions" 
ON public.file_permissions 
FOR SELECT 
TO authenticated 
USING (user_id = auth.uid());

-- Add RLS policy for file_permissions to allow admins to manage all permissions
CREATE POLICY "Admins can manage all file permissions" 
ON public.file_permissions 
FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles 
    WHERE user_id = auth.uid() AND is_admin = true
  )
);
