import { Routes, Route } from 'react-router-dom';
import TextCRUD from './pages/Text';
import PersonCRUD from './pages/Person';
import TextInstanceCRUD from './pages/TextInstances';
import Instance from './pages/Instance';
import Navigation from './components/Navigation';
import Index from './pages/Index';
import Create from './pages/Create';
import CreateTranslation from './pages/CreateTranslation';
import CreateCommentary from './pages/CreateCommentary';
import Login from './pages/Login';

function App() {
  return (
    <div className="h-screen overflow-auto font-monlam-2 text-xl">
      <Navigation/>
      <div className='container mx-auto py-16'>

        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Index />} />
          <Route path="/create" element={<Create />} />
          <Route path="/texts" element={
            <TextCRUD />
          } />
          <Route path="/persons" element={
              <PersonCRUD />
              } />
          <Route path="/texts/:text_id/instances" element={<TextInstanceCRUD />} />
          <Route path="/texts/:text_id/instances/:instance_id" element={<Instance />} />
          <Route path="/texts/:text_id/instances/:instance_id/translation" element={<CreateTranslation />} />
          <Route path="/texts/:text_id/instances/:instance_id/commentary" element={<CreateCommentary />} />
        </Routes>
        </div>
    </div>
  );
}

export default App;