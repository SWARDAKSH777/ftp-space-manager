
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface UserPermissions {
  can_read: boolean;
  can_write: boolean;
  can_delete: boolean;
}

interface UserProfile {
  is_admin: boolean;
  full_name: string;
  username: string;
}

export const useUserPermissions = () => {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchUserProfile();
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchUserProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('is_admin, full_name, username')
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;
      
      setUserProfile(data);
      setIsAdmin(data?.is_admin || false);
    } catch (error) {
      console.error('Error fetching user profile:', error);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  const getFilePermissions = async (path: string): Promise<UserPermissions> => {
    if (!user || isAdmin) {
      return { can_read: true, can_write: true, can_delete: true };
    }

    try {
      const { data, error } = await supabase.rpc('get_user_permissions', {
        user_uuid: user.id,
        file_path: path
      });

      if (error) throw error;
      
      return data?.[0] || { can_read: false, can_write: false, can_delete: false };
    } catch (error) {
      console.error('Error fetching permissions:', error);
      return { can_read: false, can_write: false, can_delete: false };
    }
  };

  return {
    isAdmin,
    userProfile,
    loading,
    getFilePermissions,
    refreshProfile: fetchUserProfile
  };
};
