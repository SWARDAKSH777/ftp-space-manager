
import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, HardDrive, User, Lock } from 'lucide-react';

const SignInPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Check if input is an email (contains @)
      if (username.includes('@')) {
        // Direct email login
        const { error } = await supabase.auth.signInWithPassword({
          email: username,
          password
        });

        if (error) throw error;
      } else {
        // Username-based login - query user_profiles table directly
        const { data: profileData, error: profileError } = await supabase
          .from('user_profiles')
          .select('user_id')
          .eq('username', username)
          .maybeSingle();

        if (profileError) {
          console.error('Profile query error:', profileError);
          throw new Error('Invalid username or password');
        }

        if (!profileData) {
          throw new Error('Invalid username or password');
        }

        // Get the user's email from auth.users using the user_id
        // Since we can't directly query auth.users, we need to get the email differently
        // For now, we'll use a workaround by attempting to sign in with different email formats
        
        // Try common email formats based on username
        const possibleEmails = [
          `${username}@gmail.com`,
          `${username}@email.com`,
          username // in case the username is actually an email without @
        ];

        let signInSuccess = false;
        for (const email of possibleEmails) {
          try {
            const { data, error } = await supabase.auth.signInWithPassword({
              email: email,
              password
            });

            if (!error && data.user && data.user.id === profileData.user_id) {
              signInSuccess = true;
              break;
            }
          } catch (e) {
            // Continue to next email format
            continue;
          }
        }

        if (!signInSuccess) {
          throw new Error('Invalid username or password');
        }
      }

      toast({
        title: "Welcome back!",
        description: "You have been successfully signed in."
      });
    } catch (error: any) {
      console.error('Sign in error:', error);
      toast({
        title: "Sign in failed",
        description: error.message === 'Invalid login credentials' ? 'Invalid username/email or password' : error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <HardDrive className="h-12 w-12 text-blue-600" />
          </div>
          <CardTitle className="text-2xl font-bold">Family Files</CardTitle>
          <CardDescription>
            Sign in with your username/email and password
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username or Email</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  placeholder="Enter username or email"
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Enter your password"
                  className="pl-10 pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default SignInPage;
