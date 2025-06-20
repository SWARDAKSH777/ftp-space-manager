
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';

interface UserPermissions {
  can_read: boolean;
  can_write: boolean;
  can_delete: boolean;
}

export const useUserPermissions = () => {
  const { user, userProfile } = useAuth();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(false);
  }, [userProfile]);

  const getFilePermissions = async (path: string): Promise<UserPermissions> => {
    if (!user || userProfile?.is_admin) {
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
    isAdmin: userProfile?.is_admin || false,
    userProfile,
    loading,
    getFilePermissions,
    refreshProfile: () => {} // Not needed anymore as it's handled by AuthProvider
  };
};
