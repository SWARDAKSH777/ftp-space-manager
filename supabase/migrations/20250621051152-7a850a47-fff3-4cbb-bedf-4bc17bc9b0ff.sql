
-- Create function to get user email by user ID for username login
CREATE OR REPLACE FUNCTION public.get_user_email(user_uuid uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT email FROM auth.users WHERE id = user_uuid;
$$;
