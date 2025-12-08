import { Routes, Route, useLocation } from 'react-router-dom';
import TextCRUD from './pages/Text';
import PersonCRUD from './pages/Person';
import TextInstanceCRUD from './pages/TextInstances';
import Instance from './pages/Instance';
import Navigation from './components/Navigation';
import Index from './pages/Index';
import Create from './pages/Create';
import CreateTranslation from './pages/CreateTranslation';
import CreateCommentary from './pages/CreateCommentary';
import UpdateAnnotation from './pages/UpdateAnnotation';
import LoginPage from './pages/LoginPage';
import ProtectedRoute from './components/ProtectedRoute';
import AlignmentWorkstation from './components/Aligner/components/AlignmentWorkstation';

function App() {
  const location = useLocation();
  const isLoginPage = location.pathname === '/login';

  return (
    <div className="h-screen overflow-auto  text-xl bg-gradient-to-br from-blue-50 to-indigo-100">
      {!isLoginPage && <Navigation/>}
      <div className={isLoginPage ? '' : ''}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
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
              <TextCRUD />
            </ProtectedRoute>
          } />
          <Route path="/persons" element={
            <ProtectedRoute>
              <PersonCRUD />
            </ProtectedRoute>
          } />
          <Route path="/texts/:text_id/instances" element={
            <ProtectedRoute>
              <TextInstanceCRUD />
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
        </Routes>
        </div>
    </div>
  );
}

export default App;