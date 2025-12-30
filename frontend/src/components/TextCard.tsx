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

interface TextCardProps {
  title: string;
  language: string;
  type: string;
  isAnnotationAvailable?: boolean;
  instanceId: string;
  sourceInstanceId: string;
}

const TextCard = ({
  title,
  language,
  type,
  isAnnotationAvailable,
  instanceId,
  sourceInstanceId,
}: TextCardProps) => {
  const { data: permission,isFetching:isFetchingPermission } = usePermission();
  const isAdmin=permission?.role === "admin";
  const navigate = useNavigate();

  return (
    <TableRow className="cursor-pointer group hover:bg-muted/50">
      {/* Title Column */}
      <TableCell className="">
        <div className="flex items-start gap-2 truncate">
          <Book className="w-4 h-4 text-muted-foreground group-hover:text-blue-500 transition-smooth mt-1 shrink-0" />
          <div className="flex-1">
            <div style={{
              fontSize: '16px',
              lineHeight: 'normal',
            }} className=" text-2xl font-monlam group-hover:text-blue-500 transition-smooth">
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

      {/* Annotation Status Column */}
      <TableCell>
        {isAnnotationAvailable ? (
          <CheckCircleIcon className="w-5 h-5 text-green-500" />
        ) : (
          <CircleXIcon className="w-5 h-5 text-red-500" />
        )}
      </TableCell>

      {/* Action Column */}
      <TableCell className="text-right">
        <Button 
          disabled={!isAdmin}
          variant={!isAnnotationAvailable ? "destructive" : "outline"} 
          className={`w-fit cursor-pointer 
          ${!isAnnotationAvailable ? "bg-[#025388] hover:bg-[#025388]/90 text-white" : ""}
          pointer-events-auto`} 
          onClick={(e)=>{
            e.preventDefault()
            e.stopPropagation()
            navigate(`/align/${sourceInstanceId}/${instanceId}`)
          }}
        >
          <PermissionButton isLoading={isFetchingPermission} icon={null} text={!isAnnotationAvailable ? "Align Text" : "update Alignment"} />
        </Button>
      </TableCell>
    </TableRow>
  );
};

export default TextCard;
