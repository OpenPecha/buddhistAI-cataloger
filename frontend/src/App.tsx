import { Routes, Route } from 'react-router-dom';
import TextCRUD from './pages/Text';
import PersonCRUD from './pages/Person';
import TextInstanceCRUD from './pages/TextInstances';
import Instance from './pages/Instance';
import Headers from './components/layout/Header';
import Index from './pages/Index';
import Create from './pages/Create';

function App() {
  return (
    <div className="min-h-screen font-monlam-2 text-xl">
      <Headers/>
      <div className='container mx-auto py-16'>

        <Routes>
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
        </Routes>
        </div>
    </div>
  );
}

export default App;