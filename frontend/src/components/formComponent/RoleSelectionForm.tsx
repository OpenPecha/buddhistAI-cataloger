import { useRole } from '@/hooks/useEnum';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

function RoleSelectionForm({ role, setRole }: { role: string, setRole: (role: string) => void }) {
    const { data: ROLE_OPTIONS, isLoading: isLoadingRoleOptions } = useRole();
 
    return (
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger className="w-fit">
            <SelectValue placeholder="Select Role" />
          </SelectTrigger>
          <SelectContent>
            {!isLoadingRoleOptions && ROLE_OPTIONS?.map((roleOption: { name: string }) => (
              <SelectItem key={roleOption.name} value={roleOption.name} className="capitalize">
                {roleOption.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
  )
}

export default RoleSelectionForm
