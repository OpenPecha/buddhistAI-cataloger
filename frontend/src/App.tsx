import { Routes, Route, useLocation } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { Navigation, ProtectedRoute } from '@app';
import { getUserByEmail, createUser } from './api/settings';
import OutlinerAdminLayout from './features/outliner/components/OutlinerAdminLayout';
import { UpdateTextForm } from './features/cataloger/components/UpdateTextForm';
import CreateEdition from './pages/CreateEdition';

// Lazy load page components
const TextsPage = lazy(() => import('./pages/Text'));
const PersonsPage = lazy(() => import('./pages/Person'));
const TextEditions = lazy(() => import('./pages/TextEditions'));
const Edition = lazy(() => import('./pages/Edition'));
const Index = lazy(() => import('./pages/Index'));
const Create = lazy(() => import('./pages/Create'));
const CreateTranslation = lazy(() => import('./pages/CreateTranslation'));
const CreateCommentary = lazy(() => import('./pages/CreateCommentary'));
const UpdateAnnotation = lazy(() => import('./pages/UpdateAnnotation'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const Profile = lazy(() => import('./pages/Profile'));
const Settings = lazy(() => import('./pages/Settings'));
const AlignmentWorkstationLazy = lazy(() =>
  import('@/features/aligner').then((m) => ({ default: m.AlignmentWorkstation }))
);
const OutlineDashboardLazy = lazy(() => import('@/features/outliner').then((m) => ({ default: m.Dashboard })));
const OutlinerWorkspaceLazy = lazy(() => import('@/features/outliner').then((m) => ({ default: m.Workspace })));
const OutlinerAdminDashboardLazy = lazy(() => import('@/features/outliner').then((m) => ({ default: m.AdminDashboard })));
const OutlinerAdminDocumentLazy = lazy(() => import('@/features/outliner').then((m) => ({ default: m.AdminDocument })));
const OutlinerAdminSegmentLazy = lazy(() => import('@/features/outliner').then((m) => ({ default: m.AdminSegment })));
const OutlinerAdminUsersLazy = lazy(() => import('@/features/outliner').then((m) => ({ default: m.AdminUsers })));
const OutlinerAdminBDRCWorksLazy = lazy(() => import('@/features/outliner').then((m) => ({ default: m.AdminBDRCWorks })));
const OutlinerAdminBDRCPersonsLazy = lazy(() => import('@/features/outliner').then((m) => ({ default: m.AdminBDRCPersons })));





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
   

  <div
    className="absolute inset-0 -z-10"
    style={{
      backgroundImage: `
        linear-gradient(to right, #e2e8f0 1px, transparent 1px),
        linear-gradient(to bottom, #e2e8f0 1px, transparent 1px)
      `,
      backgroundSize: "20px 30px",
      WebkitMaskImage:
        "radial-gradient(ellipse 70% 60% at 50% 100%, #000 60%, transparent 100%)",
      maskImage:
        "radial-gradient(ellipse 70% 60% at 50% 100%, #000 60%, transparent 100%)",
    }}
  />


    <div className="h-screen overflow-auto  text-xl z-10"
      >

        
      {!isLoginPage && <Navigation/>}
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
              <AlignmentWorkstationLazy />
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
          <Route path="/texts/:text_id/editions" element={
            <ProtectedRoute>
              <TextEditions />
            </ProtectedRoute>
          } />
          <Route path="/texts/:text_id/update" element={
            <ProtectedRoute>
              <UpdateTextForm />
            </ProtectedRoute>
          } />
           <Route path="/texts/:text_id/create" element={
            <ProtectedRoute>
              <CreateEdition />
            </ProtectedRoute>
          } />
          <Route path="/texts/:text_id/editions/:edition_id" element={
            <ProtectedRoute>
              <Edition />
            </ProtectedRoute>
          } />
          <Route path="/texts/:text_id/editions/:edition_id/translation" element={
            <ProtectedRoute>
              <CreateTranslation />
            </ProtectedRoute>
          } />
          <Route path="/texts/:text_id/editions/:edition_id/commentary" element={
            <ProtectedRoute>
              <CreateCommentary />
            </ProtectedRoute>
          } />
          <Route path="/texts/:text_id/editions/:edition_id/edit" element={
            <ProtectedRoute>
              <UpdateAnnotation />
            </ProtectedRoute>
          } />
          <Route path="/outliner" element={
            <ProtectedRoute>
              <OutlineDashboardLazy />
            </ProtectedRoute>
          } />
          <Route path="/outliner/:documentId" element={
            <ProtectedRoute>
              <OutlinerWorkspaceLazy />
            </ProtectedRoute>
          } />
          <Route path="/outliner-admin" element={
            <ProtectedRoute>
              <OutlinerAdminLayout >
                <OutlinerAdminDashboardLazy />
              </OutlinerAdminLayout>
            </ProtectedRoute>
          } />
          <Route path="/outliner-admin/documents" element={
            <ProtectedRoute>
              <OutlinerAdminLayout >
                <OutlinerAdminDocumentLazy />
              </OutlinerAdminLayout>
            </ProtectedRoute>
          } />
          <Route path="/outliner-admin/documents/:documentId" element={
            <ProtectedRoute>
              <OutlinerAdminLayout >
                <OutlinerAdminSegmentLazy />
              </OutlinerAdminLayout>
            </ProtectedRoute>
          } />
          <Route path="/outliner-admin/users" element={
            <ProtectedRoute>
              <OutlinerAdminLayout >
                <OutlinerAdminUsersLazy />
              </OutlinerAdminLayout>
            </ProtectedRoute>
          } />
           <Route path="/outliner-admin/bdrc-library/works" element={
            <ProtectedRoute>
              <OutlinerAdminLayout >
                <OutlinerAdminBDRCWorksLazy />
              </OutlinerAdminLayout>
            </ProtectedRoute>
          } />
          <Route path="/outliner-admin/bdrc-library/persons" element={
            <ProtectedRoute>
              <OutlinerAdminLayout >
                <OutlinerAdminBDRCPersonsLazy />
              </OutlinerAdminLayout>
            </ProtectedRoute>
          } />
        </Routes>
        </Suspense>
    </div>
    
   
  </div>

  );
}





export default App;