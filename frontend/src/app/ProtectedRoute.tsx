import { ReactNode } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { Navigate, useLocation } from 'react-router-dom';
import { useUser } from '@/hooks/useUser';
import { useTranslation } from 'react-i18next';

interface ProtectedRouteProps {
  children: ReactNode;
}

function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth0();
  const {i18n}= useTranslation();
  const isTibetan = i18n.language === 'bo';
  const { user } = useUser();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" state={{ returnTo: location.pathname }} replace />;
  
  if (!user) return <ServerMaintenance/>
  

  return <div className={`relative ${isTibetan ? 'font-monlam' : ''}`}>{children}</div>;
}

export default ProtectedRoute;



export const ServerMaintenance=()=>{
  return <div className="min-h-screen font-monlam flex flex-col items-center justify-center bg-gradient-to-tr from-indigo-100 to-slate-100">
  <div className="bg-white rounded-2xl shadow-xl px-10 py-8 flex flex-col items-center max-w-md w-full border border-indigo-50">
    <div className="flex flex-col items-center mb-6">
      <svg className="w-16 h-16 mb-4 text-indigo-400 animate-pulse drop-shadow" fill="none" stroke="currentColor" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r="20" strokeWidth="3" className="opacity-20" />
        <path d="M16 24h16M24 16v16" strokeWidth="3" strokeLinecap="round" className="opacity-70"/>
      </svg>
      <h2 className="text-2xl font-bold mb-1 text-gray-800 text-center">
        Server Maintenance
        <span className="block text-lg font-normal tracking-normal text-indigo-800 mt-0.5 leading-tight">
          སིར་བར་རིན་<wbr/>ལེན་<wbr/>བྱེད་<wbr/>བསྒོམ་<wbr/>འབད་<wbr/>དོ།
        </span>
      </h2>
    </div>
    <div className="mb-4 w-full">
      <div className="text-gray-700 mb-2 text-center leading-snug text-base font-medium">
        <span className="block text-indigo-900 font-normal text-sm mb-1 tracking-wide">
          ངེད་ཚོའི་ཞབས་ཞུའི་ཆས་ལ་<br/>
          ད་ལྟ་སྤྱིར་འཇུག་མི་བྱུང་།<br />
          སྐར་མ་ཞིག་ཤུགས་སུ་ཡང་བསྐྱར་དུ་ཚོད་ལྟ་རོགས།
        </span>
        <span className="block text-base text-gray-700 font-semibold mb-1">
          Our service is temporarily unavailable.
        </span>
        <span className="block text-gray-600 text-sm">
          Please try again in a minute.
        </span>
      </div>
    </div>
    <div className="text-xs text-gray-400 border-t pt-3 w-full text-center font-normal">
      <span className="block mb-1 text-indigo-800">
        འདི་བསྐྱར་བསྐྱར་ལྟོས་པས་ཡང་<wbr/>ངེས་པར་མི་བྱུང་ན་<wbr/>རོགས་སྐུལ་ལ་འབྲེལ་ལམ་བཏང་རོགས།
      </span>
      <span className="block text-gray-400">If this issue persists, please contact support.</span>
    </div>
  </div>
</div>
}