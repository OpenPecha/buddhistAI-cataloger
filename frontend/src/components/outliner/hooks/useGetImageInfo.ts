import React, { useEffect, useState } from 'react'

function useGetImageInfo({volId, pname}: {volId: string, pname: string}) {
    const [imageInfo, setImageInfo] = useState<any>(null)
    useEffect(() => {
        const fetchImageInfo = async () => {
            const url = `https://iiif.bdrc.io/bdr:${volId}::${pname}/info.json`
            const response = await fetch(url)
            const data = await response.json()
            setImageInfo(data)
            return data
        }
        fetchImageInfo()
    }, [volId, pname])
  return imageInfo
}

export default useGetImageInfo
