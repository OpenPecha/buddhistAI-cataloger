import { ReactNode, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface ProtectedRouteProps {
  children: ReactNode;
}

function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth0();
  const {i18n}= useTranslation();
  const isTibetan = i18n.language === 'bo';
  const location = useLocation();

  useEffect(()=>{
    if(!isAuthenticated){
      toast.error('You must be logged in to access this page');   
    }
  },[isAuthenticated])

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
  
  
  if (!isAuthenticated) return <Navigate to="/" state={{ returnTo: location.pathname }} replace />;  

  return <div className={`relative ${isTibetan ? 'font-monlam' : ''}`}>{children}</div>;
}

export default ProtectedRoute;



export const ServerMaintenance = () => {
  const { logout } = useAuth0();

  return (
    <div className="min-h-screen font-monlam flex flex-col items-center justify-center bg-gradient-to-tr from-indigo-100 to-slate-100 px-4">
      <div className="bg-white rounded-2xl shadow-xl px-10 py-8 flex flex-col items-center max-w-md w-full border border-indigo-50">
        <div className="flex flex-col items-center mb-6">
          <div className="relative mb-4">
            <div className="w-16 h-16 rounded-full border-4 border-indigo-100 border-t-indigo-500 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-5 h-5 rounded-full bg-indigo-400 animate-pulse" />
            </div>
          </div>

          <h2 className="text-2xl font-bold mb-1 text-gray-800 text-center">
            Website is loading
            <span className="block text-lg font-normal tracking-normal text-indigo-800 mt-1 leading-tight">
              དྲ་ཚིགས་འདི་<wbr />
              སྒོ་འབྱེད་<wbr />
              བཞིན་<wbr />
              ཡོད།
            </span>
          </h2>
        </div>

        <div className="mb-5 w-full">
          <div className="text-gray-700 text-center leading-snug text-base font-medium">
            <span className="block text-indigo-900 font-normal text-sm mb-2 tracking-wide">
              དྲ་ཚིགས་འདི་<wbr />
              ད་ལྟ་<wbr />
              ཚ་བསྐྱེད་<wbr />
              དང་<wbr />
              སྒོ་འབྱེད་<wbr />
              བཞིན་<wbr />
              ཡོད།
            </span>

            <span className="block text-base text-gray-700 font-semibold mb-1">
              The website is loading and warming up.
            </span>

            <span className="block text-gray-600 text-sm">
              This may take a moment. Please wait and try again shortly.
            </span>
          </div>
        </div>

        <div className="w-full flex items-center justify-center gap-2 mb-5 text-sm text-indigo-700">
          <span className="inline-block w-2 h-2 rounded-full bg-indigo-500 animate-bounce" />
          <span
            className="inline-block w-2 h-2 rounded-full bg-indigo-400 animate-bounce"
            style={{ animationDelay: "0.15s" }}
          />
          <span
            className="inline-block w-2 h-2 rounded-full bg-indigo-300 animate-bounce"
            style={{ animationDelay: "0.3s" }}
          />
        </div>

        <div className="text-xs text-gray-400 border-t pt-3 w-full text-center font-normal mb-4">
          <span className="block mb-1 text-indigo-800">
            གལ་ཏེ་<wbr />
            འདི་<wbr />
            རྒྱུན་རིང་<wbr />
            འགོར་ན་<wbr />
            རོགས་སྐུལ་<wbr />
            ལ་<wbr />
            འབྲེལ་བ་<wbr />
            གནང་རོགས།
          </span>
          <span className="block text-gray-400">
            If this takes too long, please contact support.
          </span>
        </div>

        <Button
          onClick={() => {
            logout({
              logoutParams: {
                returnTo: window.location.origin + "/login",
              },
            });
          }}
        >
          Logout
        </Button>
      </div>
    </div>
  );
};