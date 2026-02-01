import { Suspense, useEffect } from "react";
import { useRoutes, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth-context";
import LandingPage from "./components/LandingPage";
import Home from "./components/home";
import UserApp from "./components/UserApp";
import AdvertiserDashboard from "./components/AdvertiserDashboard";
import PublisherDemo from "./components/PublisherDemo";
import AdminDashboard from "./components/AdminDashboard";
import routes from "tempo-routes";

// Protected Route Component with RBAC
function ProtectedRoute({ 
  children, 
  allowedRoles 
}: { 
  children: React.ReactNode; 
  allowedRoles?: Array<'user' | 'advertiser' | 'publisher' | 'admin'>;
}) {
  const { isAuthenticated, user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check role-based access
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">🚫</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-6">
            You don't have permission to access this page. Your role: <span className="font-semibold">{user.role}</span>
          </p>
          <button
            onClick={() => window.location.href = '/'}
            className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function TempoRoutes() {
  return useRoutes(routes);
}

function AppContent() {
  const { user, isAuthenticated, isLoading, login, register, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Redirect authenticated users away from login page
  useEffect(() => {
    if (isAuthenticated && location.pathname === '/login') {
      const from = (location.state as any)?.from?.pathname || getRoleDashboard(user?.role);
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, location, navigate, user]);

  // Get dashboard route based on user role
  const getRoleDashboard = (role?: string) => {
    switch (role) {
      case 'user':
        return '/user';
      case 'advertiser':
        return '/advertiser';
      case 'publisher':
        return '/publisher';
      case 'admin':
        return '/admin';
      default:
        return '/login'; // Redirect to login if role is unknown
    }
  };

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-900 via-purple-900 to-indigo-900">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-2"></div>
          <p>Loading...</p>
        </div>
      </div>
    }>
      <>
        <Routes>
          {/* Explicit Public Routes */}
          <Route 
            path="/login" 
            element={
              isAuthenticated ? (
                <Navigate to={getRoleDashboard(user?.role)} replace />
              ) : (
                <LandingPage 
                  onLogin={async (credentials) => {
                    try {
                      console.log('Attempting login for:', credentials.email);
                      await login(credentials.email, credentials.password);
                      console.log('Login call completed for:', credentials.email);
                    } catch (error: any) {
                      console.error('App.tsx login error:', error);
                      throw error;
                    }
                  }}
                  onRegister={async (userData) => {
                    try {
                      console.log('Attempting registration for:', userData.email);
                      await register(userData.email, userData.password, userData.name, userData.role as any);
                      console.log('Registration call completed for:', userData.email);
                    } catch (error: any) {
                      console.error('App.tsx registration error:', error);
                      throw error;
                    }
                  }}
                />
              )
            } 
          />

          {/* Protected Routes with RBAC */}
          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                {user?.role ? <Navigate to={getRoleDashboard(user.role)} replace /> : <Home />}
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/home" 
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/user" 
            element={
              <ProtectedRoute allowedRoles={['user']}>
                <UserApp />
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/advertiser" 
            element={
              <ProtectedRoute allowedRoles={['advertiser', 'admin']}>
                <AdvertiserDashboard />
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/publisher" 
            element={
              <ProtectedRoute allowedRoles={['publisher', 'admin']}>
                <PublisherDemo />
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/admin" 
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/logout" 
            element={
              <LogoutPage onLogout={logout} />
            } 
          />

          {/* Catch all - redirect to login or dashboard */}
          <Route 
            path="*" 
            element={
              isAuthenticated ? (
                <Navigate to={getRoleDashboard(user?.role)} replace />
              ) : (
                <Navigate to="/login" replace />
              )
            } 
          />
        </Routes>
        {import.meta.env.VITE_TEMPO === "true" && (
          <Suspense fallback={null}>
            <TempoRoutes />
          </Suspense>
        )}
      </>
    </Suspense>
  );
}

// Logout Page Component
function LogoutPage({ onLogout }: { onLogout: () => Promise<void> }) {
  const navigate = useNavigate();

  useEffect(() => {
    const performLogout = async () => {
      try {
        await onLogout();
      } catch (error) {
        console.error('Logout error:', error);
      }
      navigate('/login', { replace: true });
    };
    performLogout();
  }, [onLogout, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-gray-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-4"></div>
        <h2 className="text-2xl font-bold mb-2">Logging out...</h2>
        <p className="text-gray-600">Please wait</p>
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;