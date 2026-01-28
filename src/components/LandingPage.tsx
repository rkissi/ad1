import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Shield, 
  Coins, 
  BarChart3, 
  Users, 
  Megaphone, 
  Globe, 
  Zap, 
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  CheckCircle,
  Sparkles,
  Wallet,
  TrendingUp,
  AlertCircle
} from 'lucide-react';

interface LandingPageProps {
  onLogin?: (credentials: { email: string; password: string; role: string }) => Promise<void>;
  onRegister?: (userData: { email: string; password: string; role: string; name: string }) => Promise<void>;
}

function LandingPage({ onLogin, onRegister }: LandingPageProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: 'user'
  });

  const handleSubmit = async (type: 'login' | 'register') => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    // Validation
    if (!formData.email || !formData.password) {
      setError('Please fill in all required fields');
      setIsLoading(false);
      return;
    }

    if (type === 'register' && !formData.name) {
      setError('Please enter your full name');
      setIsLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      setIsLoading(false);
      return;
    }

    try {
      if (type === 'login' && onLogin) {
        await onLogin({ 
          email: formData.email, 
          password: formData.password, 
          role: formData.role 
        });
        setSuccess('Login successful! Redirecting to your dashboard...');
      } else if (type === 'register' && onRegister) {
        await onRegister({ 
          email: formData.email, 
          password: formData.password, 
          role: formData.role,
          name: formData.name 
        });
        setSuccess('Account created successfully! Redirecting to your dashboard...');
      }
    } catch (error: any) {
      console.error('Authentication error:', error);
      setError(error.message || `${type === 'login' ? 'Login' : 'Registration'} failed. Please try again.`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-900 via-purple-900 to-indigo-900 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0">
        <div className="absolute top-20 left-20 w-72 h-72 bg-blue-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute top-40 right-32 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute bottom-32 left-1/3 w-80 h-80 bg-pink-500/20 rounded-full blur-3xl animate-pulse delay-2000"></div>
        <div className="absolute bottom-20 right-20 w-64 h-64 bg-cyan-500/20 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      {/* Grid Pattern Overlay */}
      <div 
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Ccircle cx='30' cy='30' r='1'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }}
      ></div>

      <div className="relative z-10 min-h-screen flex">
        {/* Left Side - Brand & Features */}
        <div className="flex-1 flex flex-col justify-center px-8 lg:px-16 xl:px-24">
          {/* Logo & Brand */}
          <div className="mb-12">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-r from-cyan-400 to-purple-500 rounded-xl flex items-center justify-center backdrop-blur-sm">
                <Zap className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Metaverse Ads</h1>
                <p className="text-purple-200 text-sm">Privacy-First Advertising</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <h2 className="text-5xl lg:text-6xl font-bold text-white leading-tight">
                Own Your Data,
                <br />
                <span className="bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                  Earn Rewards
                </span>
              </h2>
              <p className="text-xl text-purple-100 max-w-lg leading-relaxed">
                The first decentralized advertising platform where users control their privacy, 
                advertisers reach engaged audiences, and publishers maximize revenue through smart contracts.
              </p>
            </div>
          </div>

          {/* Key Features */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-400 to-cyan-400 rounded-xl flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-white font-semibold text-lg mb-2">Privacy First</h3>
              <p className="text-purple-200 text-sm">Complete control over your data with pseudonymous DIDs and verifiable consent.</p>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
              <div className="w-12 h-12 bg-gradient-to-r from-green-400 to-emerald-400 rounded-xl flex items-center justify-center mb-4">
                <Coins className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-white font-semibold text-lg mb-2">Earn Rewards</h3>
              <p className="text-purple-200 text-sm">Get paid for your attention with transparent, automated payouts via smart contracts.</p>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-400 to-pink-400 rounded-xl flex items-center justify-center mb-4">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-white font-semibold text-lg mb-2">Real Analytics</h3>
              <p className="text-purple-200 text-sm">Comprehensive metrics and performance tracking for all stakeholders.</p>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
              <div className="w-12 h-12 bg-gradient-to-r from-orange-400 to-red-400 rounded-xl flex items-center justify-center mb-4">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-white font-semibold text-lg mb-2">Smart Matching</h3>
              <p className="text-purple-200 text-sm">AI-powered ad matching that respects privacy while maximizing relevance.</p>
            </div>
          </div>

          {/* Stats */}
          <div className="flex space-x-8">
            <div className="text-center">
              <div className="text-3xl font-bold text-white mb-1">100%</div>
              <div className="text-purple-200 text-sm">Privacy Protected</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-white mb-1">0%</div>
              <div className="text-purple-200 text-sm">Data Sold</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-white mb-1">24/7</div>
              <div className="text-purple-200 text-sm">Earnings</div>
            </div>
          </div>
        </div>

        {/* Right Side - Authentication */}
        <div className="w-full max-w-md flex flex-col justify-center px-8 lg:px-12">
          <Card className="bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl">
            <CardHeader className="text-center pb-4">
              <div className="w-16 h-16 bg-gradient-to-r from-cyan-400 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-2xl text-white">Join the Revolution</CardTitle>
              <CardDescription className="text-purple-200">
                Start earning from your data today
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              {/* Success/Error Messages */}
              {success && (
                <Alert className="mb-4 bg-green-500/20 border-green-500/50 text-white">
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>{success}</AlertDescription>
                </Alert>
              )}

              {error && (
                <Alert className="mb-4 bg-red-500/20 border-red-500/50 text-white">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Tabs defaultValue="register" className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-white/10 backdrop-blur-sm">
                  <TabsTrigger value="register" className="text-white data-[state=active]:bg-white/20">
                    Sign Up
                  </TabsTrigger>
                  <TabsTrigger value="login" className="text-white data-[state=active]:bg-white/20">
                    Sign In
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="register" className="space-y-4 mt-6">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-white">Full Name *</Label>
                    <Input
                      id="name"
                      placeholder="Enter your full name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="bg-white/10 border-white/20 text-white placeholder:text-purple-200 backdrop-blur-sm"
                      disabled={isLoading}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-white">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="Enter your email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="bg-white/10 border-white/20 text-white placeholder:text-purple-200 backdrop-blur-sm"
                      disabled={isLoading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-white">Password *</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Create a password (min 6 characters)"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="bg-white/10 border-white/20 text-white placeholder:text-purple-200 backdrop-blur-sm pr-10"
                        disabled={isLoading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-purple-200 hover:text-white"
                        disabled={isLoading}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="role" className="text-white">I am a... *</Label>
                    <select
                      id="role"
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-md text-white backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                      disabled={isLoading}
                    >
                      <option value="user" className="bg-purple-900">User (Earn from ads)</option>
                      <option value="advertiser" className="bg-purple-900">Advertiser (Create campaigns)</option>
                      <option value="publisher" className="bg-purple-900">Publisher (Monetize content)</option>
                    </select>
                  </div>

                  <Button
                    onClick={() => handleSubmit('register')}
                    disabled={isLoading}
                    className="w-full bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white font-semibold py-3 rounded-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  >
                    {isLoading ? (
                      <div className="flex items-center space-x-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        <span>Creating Account...</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <span>Create Account</span>
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    )}
                  </Button>

                  <div className="flex items-center space-x-2 text-xs text-purple-200">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <span>Your data stays private and secure</span>
                  </div>
                </TabsContent>

                <TabsContent value="login" className="space-y-4 mt-6">
                  <div className="space-y-2">
                    <Label htmlFor="login-email" className="text-white">Email *</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="Enter your email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="bg-white/10 border-white/20 text-white placeholder:text-purple-200 backdrop-blur-sm"
                      disabled={isLoading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="login-password" className="text-white">Password *</Label>
                    <div className="relative">
                      <Input
                        id="login-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="bg-white/10 border-white/20 text-white placeholder:text-purple-200 backdrop-blur-sm pr-10"
                        disabled={isLoading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-purple-200 hover:text-white"
                        disabled={isLoading}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="login-role" className="text-white">Account Type *</Label>
                    <select
                      id="login-role"
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-md text-white backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                      disabled={isLoading}
                    >
                      <option value="user" className="bg-purple-900">User</option>
                      <option value="advertiser" className="bg-purple-900">Advertiser</option>
                      <option value="publisher" className="bg-purple-900">Publisher</option>
                    </select>
                  </div>

                  <Button
                    onClick={() => handleSubmit('login')}
                    disabled={isLoading}
                    className="w-full bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white font-semibold py-3 rounded-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  >
                    {isLoading ? (
                      <div className="flex items-center space-x-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        <span>Signing In...</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <span>Sign In</span>
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    )}
                  </Button>

                  <div className="text-center">
                    <button className="text-purple-200 hover:text-white text-sm underline" disabled={isLoading}>
                      Forgot your password?
                    </button>
                  </div>
                </TabsContent>
              </Tabs>

              {/* Role-specific benefits */}
              <div className="mt-6 p-4 bg-white/5 rounded-lg border border-white/10">
                <div className="flex items-center space-x-2 mb-2">
                  {formData.role === 'user' && <Users className="w-4 h-4 text-cyan-400" />}
                  {formData.role === 'advertiser' && <Megaphone className="w-4 h-4 text-purple-400" />}
                  {formData.role === 'publisher' && <Globe className="w-4 h-4 text-green-400" />}
                  <span className="text-white text-sm font-medium">
                    {formData.role === 'user' && 'User Benefits'}
                    {formData.role === 'advertiser' && 'Advertiser Benefits'}
                    {formData.role === 'publisher' && 'Publisher Benefits'}
                  </span>
                </div>
                <ul className="text-xs text-purple-200 space-y-1">
                  {formData.role === 'user' && (
                    <>
                      <li>• Earn tokens for viewing relevant ads</li>
                      <li>• Complete control over your data</li>
                      <li>• Transparent reward tracking</li>
                    </>
                  )}
                  {formData.role === 'advertiser' && (
                    <>
                      <li>• Reach engaged, consenting audiences</li>
                      <li>• Transparent performance metrics</li>
                      <li>• Smart contract-based payments</li>
                    </>
                  )}
                  {formData.role === 'publisher' && (
                    <>
                      <li>• Maximize ad revenue with fair pricing</li>
                      <li>• Easy SDK integration</li>
                      <li>• Real-time analytics dashboard</li>
                    </>
                  )}
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Trust indicators */}
          <div className="mt-6 flex justify-center space-x-6 text-purple-200">
            <div className="flex items-center space-x-1 text-xs">
              <Lock className="w-3 h-3" />
              <span>256-bit Encryption</span>
            </div>
            <div className="flex items-center space-x-1 text-xs">
              <Shield className="w-3 h-3" />
              <span>GDPR Compliant</span>
            </div>
            <div className="flex items-center space-x-1 text-xs">
              <Wallet className="w-3 h-3" />
              <span>Blockchain Secured</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LandingPage;