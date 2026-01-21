import { Routes, Route, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import TextsPage from './pages/Text';
import PersonsPage from './pages/Person';
import TextInstances from './pages/TextInstances';
import Instance from './pages/Instance';
import Navigation from './components/Navigation';
import Index from './pages/Index';
import Create from './pages/Create';
import CreateTranslation from './pages/CreateTranslation';
import CreateCommentary from './pages/CreateCommentary';
import UpdateAnnotation from './pages/UpdateAnnotation';
import LoginPage from './pages/LoginPage';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import ProtectedRoute from './components/ProtectedRoute';
import AlignmentWorkstation from './components/Aligner/components/AlignmentWorkstation';
import OutlinerUpload from './pages/OutlinerUpload';
import OutlinerWorkspace from './pages/OutlinerWorkspace';
import { getUserByEmail, createUser } from './api/settings';
import OutlinerAdmin from './pages/Outliner-admin';

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
              <OutlinerUpload />
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
        </Routes>
        </div>
    </div>
    
   
  </div>

  );
}


export default App;