import { Suspense, useEffect } from "react";
import { useRoutes, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth-context";
import LandingPage from "./components/LandingPage";
import Home from "./components/home";
import UserApp from "./components/UserApp";
import AdvertiserDashboard from "./components/AdvertiserDashboard";
import PublisherDemo from "./components/PublisherDemo";
import AdminDashboard from "./components/AdminDashboard";
import OnboardingPage from "./components/OnboardingPage";
import UserSettings from "./components/settings/UserSettings";
import routes from "tempo-routes";

const roleDashboardMap: Record<string, string> = {
  user: '/user',
  advertiser: '/advertiser',
  publisher: '/publisher',
  admin: '/admin'
};

// Get dashboard route based on user role
const getRoleDashboard = (role?: string) => {
  if (role && roleDashboardMap[role]) {
    return roleDashboardMap[role];
  }
  return '/';
};

function FullScreenLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-900 via-purple-900 to-indigo-900">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-white text-lg">Loading...</p>
      </div>
    </div>
  );
}

// Root Route Component - Handles logic for /
function RootRoute() {
  const { isAuthenticated, profile, isLoading, login, register } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <FullScreenLoader />;
  }

  if (!isAuthenticated) {
    // Check if we have an "initialStep" state passed from redirect
    const initialStep = (location.state as any)?.initialStep;

    return (
      <LandingPage
        initialStep={initialStep}
        onLogin={async (credentials) => {
          try {
            await login(credentials.email, credentials.password);
          } catch (error: any) {
            console.error('App.tsx login error:', error);
            throw error;
          }
        }}
        onRegister={async (userData) => {
          try {
            await register(userData.email, userData.password, userData.name, userData.role as any);
          } catch (error: any) {
            console.error('App.tsx registration error:', error);
            throw error;
          }
        }}
      />
    );
  }

  // Authenticated: Check onboarding status
  if (profile?.onboarding_status !== 'completed') {
    return <Navigate to="/onboarding" replace />;
  }

  // Completed: Redirect to dashboard
  return <Navigate to={getRoleDashboard(profile?.role)} replace />;
}

// Onboarding Route Component - Handles logic for /onboarding
function OnboardingRoute() {
  const { isAuthenticated, profile, isLoading } = useAuth();

  if (isLoading) {
    return <FullScreenLoader />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (profile?.onboarding_status === 'completed') {
    return <Navigate to={getRoleDashboard(profile.role)} replace />;
  }

  return <OnboardingPage />;
}

// Dashboard Route Component - Handles role-based dashboards
function DashboardRoute({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles?: Array<'user' | 'advertiser' | 'publisher' | 'admin'>;
}) {
  const { isAuthenticated, profile, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <FullScreenLoader />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  // Check onboarding status - Force redirect if not completed
  if (profile?.onboarding_status !== 'completed') {
      return <Navigate to="/onboarding" replace />;
  }

  // Check role-based access
  if (allowedRoles && profile?.role && !allowedRoles.includes(profile.role)) {
    // Redirect to correct dashboard
    return <Navigate to={getRoleDashboard(profile.role)} replace />;
  }

  return <>{children}</>;
}

// Protected Route Component with RBAC
function ProtectedRoute({ 
  children, 
  allowedRoles,
}: { 
  children: React.ReactNode; 
  allowedRoles?: Array<'user' | 'advertiser' | 'publisher' | 'admin'>;
}) {
  const { isAuthenticated, user, profile, isLoading } = useAuth();
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
    // Redirect to landing page (/) instead of /login
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  // Check onboarding status
  if (profile?.onboarding_status !== 'completed') {
      return <Navigate to="/onboarding" replace />;
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
  const { isLoading, logout } = useAuth();

  if (isLoading) {
    return <FullScreenLoader />;
  }

  return (
    <Suspense fallback={<FullScreenLoader />}>
      <>
        <Routes>
          {/* Root Route (/) - Unconditional match */}
          <Route 
            path="/"
            element={<RootRoute />}
          />

          {/* Onboarding Route - Unconditional match */}
          <Route
             path="/onboarding"
             element={<OnboardingRoute />}
          />

          {/* Protected Routes with RBAC */}
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
              <DashboardRoute allowedRoles={['user']}>
                <UserApp />
              </DashboardRoute>
            } 
          />

          <Route 
            path="/advertiser" 
            element={
              <DashboardRoute allowedRoles={['advertiser', 'admin']}>
                <AdvertiserDashboard />
              </DashboardRoute>
            } 
          />

          <Route 
            path="/publisher" 
            element={
              <DashboardRoute allowedRoles={['publisher', 'admin']}>
                <PublisherDemo />
              </DashboardRoute>
            } 
          />

          <Route 
            path="/admin" 
            element={
              <DashboardRoute allowedRoles={['admin']}>
                <AdminDashboard />
              </DashboardRoute>
            } 
          />

          <Route
             path="/settings"
             element={
                 <ProtectedRoute>
                     <UserSettings />
                 </ProtectedRoute>
             }
          />

          <Route 
            path="/logout" 
            element={
              <LogoutPage onLogout={logout} />
            } 
          />

          {/* Explicit Login Route for deep linking / direct access */}
           <Route
            path="/login"
            element={<Navigate to="/" state={{ initialStep: 'login' }} replace />}
          />
           <Route
            path="/register"
            element={<Navigate to="/" state={{ initialStep: 'register' }} replace />}
          />

          <Route 
            path="*" 
            element={
              <Navigate to="/" replace />
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
      navigate('/', { replace: true });
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
