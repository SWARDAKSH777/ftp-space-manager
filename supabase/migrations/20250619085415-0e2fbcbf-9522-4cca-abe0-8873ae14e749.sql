
-- Make hackerdaksh777@gmail.com an admin (corrected version)
DO $$
DECLARE
    user_uuid uuid;
BEGIN
    -- Get the user ID for the email
    SELECT id INTO user_uuid 
    FROM auth.users 
    WHERE email = 'hackerdaksh777@gmail.com';
    
    IF user_uuid IS NOT NULL THEN
        -- Insert into admin_users table (ignore if already exists)
        INSERT INTO public.admin_users (user_id)
        VALUES (user_uuid)
        ON CONFLICT (user_id) DO NOTHING;
        
        -- Update user_profiles to mark as admin
        UPDATE public.user_profiles 
        SET is_admin = true 
        WHERE user_id = user_uuid;
        
        RAISE NOTICE 'User hackerdaksh777@gmail.com has been made admin with ID: %', user_uuid;
    ELSE
        RAISE NOTICE 'User hackerdaksh777@gmail.com not found';
    END IF;
END $$;
