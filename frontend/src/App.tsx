import { Routes, Route, useLocation } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import Navigation from './components/Navigation';
import ProtectedRoute from './components/ProtectedRoute';
import { getUserByEmail, createUser } from './api/settings';

// Lazy load page components
const TextsPage = lazy(() => import('./pages/Text'));
const PersonsPage = lazy(() => import('./pages/Person'));
const TextInstances = lazy(() => import('./pages/TextInstances'));
const Instance = lazy(() => import('./pages/Instance'));
const Index = lazy(() => import('./pages/Index'));
const Create = lazy(() => import('./pages/Create'));
const CreateTranslation = lazy(() => import('./pages/CreateTranslation'));
const CreateCommentary = lazy(() => import('./pages/CreateCommentary'));
const UpdateAnnotation = lazy(() => import('./pages/UpdateAnnotation'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const Profile = lazy(() => import('./pages/Profile'));
const Settings = lazy(() => import('./pages/Settings'));
const AlignmentWorkstation = lazy(() => import('./components/Aligner/components/AlignmentWorkstation'));
const OutlineDashboard = lazy(() => import('./pages/Dashboard'));
const OutlinerWorkspace = lazy(() => import('./pages/OutlinerWorkspace'));
const OutlinerAdmin = lazy(() => import('./pages/Outliner-admin'));






function App() {
  const location = useLocation();
  const isLoginPage = location.pathname === '/login';
  const { isAuthenticated, user, isLoading } = useAuth0();

  useEffect(() => {
    const ensureUserExists = async () => {
      if (isAuthenticated && user?.email && !isLoading) {
        try {
          // Check if user exists in database
          const existingUser = await getUserByEmail(user.email);
          
          // If user doesn't exist, create them
          if (!existingUser && user.sub) {
            await createUser({
              id: user.sub,
              email: user.email,
              name: user.name || null,
              picture: user.picture || null,
            });
          }
        } catch (error) {
          console.error('Error ensuring user exists:', error);
        }
      }
    };

    ensureUserExists();
  }, [isAuthenticated, user, isLoading]);
  

  return (

    <div className="min-h-screen w-full  relative text-gray-900">
    {/* Diagonal Grid with Light */}
    
      <div
    className="absolute inset-0 pointer-events-none -z-10"
    style={{
      backgroundImage: `
        linear-gradient(45deg, transparent 49%, #e5e7eb 49%, #e5e7eb 51%, transparent 51%),
        linear-gradient(-45deg, transparent 49%, #e5e7eb 49%, #e5e7eb 51%, transparent 51%)
      `,
      backgroundSize: "40px 40px",
       WebkitMaskImage:
            "radial-gradient(ellipse 100% 80% at 50% 100%, #000 50%, transparent 90%)",
          maskImage:
            "radial-gradient(ellipse 100% 80% at 50% 100%, #000 50%, transparent 90%)",
    }}
  />
    <div className="h-screen overflow-auto  text-xl z-10"
      >

        
      {!isLoginPage && <Navigation/>}
      <div>
        <Suspense fallback={
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-gray-600">Loading...</div>
          </div>
        }>
          <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/profile" element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          } />
          <Route path="/settings" element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          } />
          <Route path="/" element={
            <ProtectedRoute>
              <Index />
            </ProtectedRoute>
          } />
          <Route path="/create" element={
            <ProtectedRoute>
              <Create />
            </ProtectedRoute>
          }  />
          <Route path="/align/:sourceInstanceId/:targetInstanceId" element={
            <ProtectedRoute>
            <AlignmentWorkstation/>
            </ProtectedRoute>
          } />
          <Route path="/texts" element={
            <ProtectedRoute>
              <TextsPage />
            </ProtectedRoute>
          } />
          <Route path="/persons" element={
            <ProtectedRoute>
              <PersonsPage />
            </ProtectedRoute>
          } />
          <Route path="/texts/:text_id/instances" element={
            <ProtectedRoute>
              <TextInstances />
            </ProtectedRoute>
          } />
          <Route path="/texts/:text_id/instances/:instance_id" element={
            <ProtectedRoute>
              <Instance />
            </ProtectedRoute>
          } />
          <Route path="/texts/:text_id/instances/:instance_id/translation" element={
            <ProtectedRoute>
              <CreateTranslation />
            </ProtectedRoute>
          } />
          <Route path="/texts/:text_id/instances/:instance_id/commentary" element={
            <ProtectedRoute>
              <CreateCommentary />
            </ProtectedRoute>
          } />
          <Route path="/texts/:text_id/instances/:instance_id/edit" element={
            <ProtectedRoute>
              <UpdateAnnotation />
            </ProtectedRoute>
          } />
          <Route path="/outliner" element={
            <ProtectedRoute>
              <OutlineDashboard />
            </ProtectedRoute>
          } />
          <Route path="/outliner/:documentId" element={
            <ProtectedRoute>
              <OutlinerWorkspace />
            </ProtectedRoute>
          } />
          <Route path="/outliner-admin" element={
            <ProtectedRoute>
              <OutlinerAdmin />
            </ProtectedRoute>
          } />
          <Route path="/outliner-admin/documents" element={
            <ProtectedRoute>
              <OutlinerAdmin />
            </ProtectedRoute>
          } />
          <Route path="/outliner-admin/segments" element={
            <ProtectedRoute>
              <OutlinerAdmin />
            </ProtectedRoute>
          } />
        </Routes>
        </Suspense>
        </div>
    </div>
    
   
  </div>

  );
}


export default App;