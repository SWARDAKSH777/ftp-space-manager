
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { HardDrive, UserCheck } from 'lucide-react';

const InitialSetup = () => {
  const [setupData, setSetupData] = useState({
    username: 'admin',
    full_name: 'System Administrator'
  });
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    checkForExistingAdmin();
  }, []);

  const checkForExistingAdmin = async () => {
    try {
      const { data: currentUser } = await supabase.auth.getUser();
      
      if (currentUser.user) {
        // Check if this user already has a profile
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', currentUser.user.id)
          .single();

        if (profile) {
          // Profile exists, redirect will happen in parent component
          return;
        }
      }
    } catch (error) {
      console.log('No existing user found, setup needed');
    } finally {
      setChecking(false);
    }
  };

  const setupAdminAccount = async () => {
    setLoading(true);
    try {
      const { data: currentUser } = await supabase.auth.getUser();
      
      if (!currentUser.user) {
        throw new Error('No authenticated user found');
      }

      // Create the admin profile
      const { error: profileError } = await supabase
        .from('user_profiles')
        .insert({
          user_id: currentUser.user.id,
          username: setupData.username,
          full_name: setupData.full_name,
          is_admin: true,
          created_by: currentUser.user.id
        });

      if (profileError) throw profileError;

      // Add to admin_users table
      const { error: adminError } = await supabase
        .from('admin_users')
        .insert({
          user_id: currentUser.user.id,
          created_by: currentUser.user.id
        });

      if (adminError) throw adminError;

      toast({
        title: "Setup complete!",
        description: "Your admin account has been configured successfully."
      });

      // Refresh the page to load the new user state
      window.location.reload();
    } catch (error: any) {
      toast({
        title: "Setup failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Checking system setup...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <UserCheck className="h-12 w-12 text-blue-600" />
          </div>
          <CardTitle className="text-2xl font-bold">Complete Setup</CardTitle>
          <CardDescription className="text-gray-600">
            Configure your admin account to get started
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="username">Admin Username</Label>
            <Input
              id="username"
              value={setupData.username}
              onChange={(e) => setSetupData(prev => ({ ...prev, username: e.target.value }))}
              placeholder="Enter admin username"
              required
            />
          </div>
          <div>
            <Label htmlFor="full_name">Full Name</Label>
            <Input
              id="full_name"
              value={setupData.full_name}
              onChange={(e) => setSetupData(prev => ({ ...prev, full_name: e.target.value }))}
              placeholder="Enter your full name"
              required
            />
          </div>
          <Button 
            onClick={setupAdminAccount} 
            disabled={loading || !setupData.username || !setupData.full_name}
            className="w-full"
          >
            {loading ? "Setting up..." : "Complete Setup"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default InitialSetup;
