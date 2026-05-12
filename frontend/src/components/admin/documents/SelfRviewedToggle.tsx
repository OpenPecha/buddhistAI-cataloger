import { Switch } from '@/components/ui/switch'
import { useUser } from '@/hooks/useUser'
import React, { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

function SelfRviewedToggle() {
    const [params, setParams] = useSearchParams()
    const { user: currentUser } = useUser()
    const reviewer = params.get('reviewer')
    const setReviewer = (reviewer: string) => {
        params.set('reviewer', reviewer)
        setParams(params)
    }
    useEffect(()=>{
        if(currentUser?.id && reviewer !== currentUser?.id) {
            setReviewer(currentUser?.id)
        }
    }, [])
  return (
    <div>
       <label htmlFor="admin-my-reviews" className="flex items-center gap-2 text-sm text-gray-700">
            <Switch
              id="admin-my-reviews"
              checked={reviewer === currentUser?.id}
              onCheckedChange={(checked) => setReviewer(checked === true ? currentUser?.id : '')}
              disabled={!currentUser?.id}
            />
            My Reviews
          </label>
    </div>
  )
}

export default SelfRviewedToggle
