import React, { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { User, Lock, Bell, Shield, Download, Trash2, Save, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function UserSettings() {
  const { user, profile, updateProfile, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Local state for form fields
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');

  // Password change state
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      await updateProfile({
        display_name: displayName,
        bio: bio,
        avatar_url: avatarUrl
      });
      setSuccessMessage('Profile updated successfully');
    } catch (error: any) {
      console.error('Update error:', error);
      setErrorMessage(error.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setErrorMessage("Passwords don't match");
      return;
    }
    if (password.length < 6) {
      setErrorMessage("Password must be at least 6 characters");
      return;
    }

    setIsSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const { error } = await supabase.auth.updateUser({ password: password });
      if (error) throw error;
      setSuccessMessage('Password updated successfully');
      setPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to update password');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadData = () => {
    // Mock download for now - in production this would trigger a backend export job
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(profile, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "my_data.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    setSuccessMessage('Data export started');
  };

  if (authLoading) {
      return <div className="p-8 text-center">Loading settings...</div>;
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8 text-gray-900">Account Settings</h1>

      {successMessage && (
        <Alert className="mb-6 bg-green-50 border-green-200 text-green-800">
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      )}

      {errorMessage && (
        <Alert className="mb-6 bg-red-50 border-red-200 text-red-800">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-8">
          <TabsTrigger value="profile" className="flex items-center space-x-2">
            <User className="w-4 h-4" />
            <span className="hidden sm:inline">Profile</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center space-x-2">
            <Lock className="w-4 h-4" />
            <span className="hidden sm:inline">Security</span>
          </TabsTrigger>
          <TabsTrigger value="privacy" className="flex items-center space-x-2">
            <Shield className="w-4 h-4" />
            <span className="hidden sm:inline">Privacy & Data</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center space-x-2">
            <Bell className="w-4 h-4" />
            <span className="hidden sm:inline">Notifications</span>
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Public Profile</CardTitle>
              <CardDescription>
                Manage how you appear to others on the platform.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleProfileUpdate} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" value={user?.email || ''} disabled className="bg-gray-100" />
                  <p className="text-xs text-gray-500">Email cannot be changed directly.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="displayName">Display Name</Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your display name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
                  <textarea
                    id="bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="Tell us a bit about yourself"
                  />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="avatar">Avatar URL</Label>
                    <Input
                        id="avatar"
                        value={avatarUrl}
                        onChange={(e) => setAvatarUrl(e.target.value)}
                        placeholder="https://example.com/avatar.jpg"
                    />
                </div>

                <div className="flex justify-end">
                    <Button type="submit" disabled={isSaving} className="flex items-center space-x-2">
                        {isSaving ? (
                            <><span>Saving...</span></>
                        ) : (
                            <><Save className="w-4 h-4" /><span>Save Changes</span></>
                        )}
                    </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <CardDescription>
                Manage your password and security preferences.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordChange} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
                 <div className="flex justify-end">
                    <Button type="submit" disabled={isSaving || !password} className="flex items-center space-x-2">
                        {isSaving ? (
                            <><span>Updating...</span></>
                        ) : (
                            <><Lock className="w-4 h-4" /><span>Update Password</span></>
                        )}
                    </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Privacy Tab */}
        <TabsContent value="privacy">
          <Card>
            <CardHeader>
              <CardTitle>Privacy & Data</CardTitle>
              <CardDescription>
                Control your data and privacy settings.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
               <div className="flex items-center justify-between p-4 border rounded-lg bg-gray-50">
                   <div>
                       <h3 className="font-medium">Download Your Data</h3>
                       <p className="text-sm text-gray-500">Get a copy of your personal data stored on our platform.</p>
                   </div>
                   <Button variant="outline" onClick={handleDownloadData} className="flex items-center space-x-2">
                       <Download className="w-4 h-4" />
                       <span>Download JSON</span>
                   </Button>
               </div>

               <div className="flex items-center justify-between p-4 border border-red-200 rounded-lg bg-red-50">
                   <div>
                       <h3 className="font-medium text-red-800">Delete Account</h3>
                       <p className="text-sm text-red-600">Permanently delete your account and all associated data.</p>
                   </div>
                   <Button variant="destructive" onClick={() => alert('Please contact support to delete your account.')} className="flex items-center space-x-2">
                       <Trash2 className="w-4 h-4" />
                       <span>Delete Account</span>
                   </Button>
               </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications">
            <Card>
                <CardHeader>
                    <CardTitle>Notification Preferences</CardTitle>
                    <CardDescription>Manage how we communicate with you.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="marketing-emails" className="flex flex-col space-y-1">
                                <span>Marketing Emails</span>
                                <span className="font-normal text-xs text-gray-500">Receive updates about new features and promotions.</span>
                            </Label>
                            <Input type="checkbox" id="marketing-emails" className="w-4 h-4" />
                        </div>
                         <div className="flex items-center justify-between">
                            <Label htmlFor="security-alerts" className="flex flex-col space-y-1">
                                <span>Security Alerts</span>
                                <span className="font-normal text-xs text-gray-500">Receive alerts about suspicious activity (Recommended).</span>
                            </Label>
                             <Input type="checkbox" id="security-alerts" className="w-4 h-4" defaultChecked />
                        </div>
                    </div>
                    <div className="mt-6 flex justify-end">
                        <Button variant="secondary" disabled>Save Preferences (Coming Soon)</Button>
                    </div>
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
