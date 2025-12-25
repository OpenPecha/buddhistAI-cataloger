import { Loader2 } from 'lucide-react'
import React from 'react'

interface PermissionButtonProps {
  readonly isLoading: boolean;
  readonly icon: React.ReactNode;
  readonly text: string;
}

function PermissionButton({isLoading,icon,text}:PermissionButtonProps) {
  return (
    <>
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span className="flex items-center gap-2"><span>{icon}</span> <span>{text}</span></span>}
    </>
  )
}

export default PermissionButton
