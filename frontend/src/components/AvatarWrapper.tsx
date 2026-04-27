import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar'


interface AvatarWrapperProps {
 readonly src: string;
 readonly alt: string;
}

function AvatarWrapper({src,alt}:AvatarWrapperProps) {
  return (
    <Avatar>
    <AvatarImage src={src} alt={alt}/>
    <AvatarFallback>
      {alt?.charAt(0)}
    </AvatarFallback>
  </Avatar>
  )
}

export default AvatarWrapper
