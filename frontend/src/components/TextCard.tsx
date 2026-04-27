import {
  Book,
  CheckCircleIcon,
  CircleXIcon,
} from "lucide-react";
import { TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getLanguageLabel } from "@/utils/getLanguageLabel";
import { useNavigate } from "react-router-dom";
import { Button } from "./ui/button";
import { usePermission } from "@/hooks/usePermission";
import PermissionButton from "./PermissionButton";
import { alignmentLink } from "@/utils/links";

interface TextCardProps {
  title: string;
  language: string;
  type: string;
  instanceId: string;
  sourceInstanceId: string;
}

const TextCard = ({
  title,
  language,
  type,
  instanceId,
  sourceInstanceId,
}: TextCardProps) => {
  const { data: permission,isFetching:isFetchingPermission } = usePermission();
  const isAdmin=permission?.role === "admin";
  const navigate = useNavigate();

 

  const navigateToAlignment = (e) => {
      e.preventDefault()
      e.stopPropagation()
      const source=sourceInstanceId
      const target= instanceId
      let url;
      if(type == "source"){
        url= alignmentLink(target,source)
      }else{
        url= alignmentLink(source,target)
      }
      navigate(url)
    }


  return (
    <TableRow className="cursor-pointer group hover:bg-muted/50">
      {/* Title Column */}
      <TableCell className="">
        <div className="flex items-start gap-2 truncate">
          <Book className="w-4 h-4 text-muted-foreground group-hover:text-blue-500 transition-smooth mt-1 shrink-0" />
          <div className="flex-1">
            <div style={{
              fontSize: '18px',
              lineHeight: 'normal',
            }} className="  flex gap-2 font-monlam group-hover:text-blue-500 transition-smooth">
              {title}

      
            </div>
          
          </div>
        </div>
      </TableCell>

      {/* Language Column */}
      <TableCell>
        <Badge className="bg-green-100 text-green-800 capitalize">
          {getLanguageLabel(language)}
        </Badge>
      </TableCell>

      {/* Type Column */}
      <TableCell>
        <Badge variant="outline" className="capitalize">
          {type}
        </Badge>
      </TableCell>

    

      {/* Action Column */}
      <TableCell className="text-right">
        <Button 
          disabled={!isAdmin}
          variant="outline"
          className={`w-fit cursor-pointer 
          pointer-events-auto`} 
          onClick={navigateToAlignment}
        >
          <PermissionButton isLoading={isFetchingPermission} icon={null} text={"Check Alignments"} />
        </Button>
      </TableCell>
    </TableRow>
  );
};

export default TextCard;
