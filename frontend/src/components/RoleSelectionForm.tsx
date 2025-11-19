import { useRole } from '@/hooks/useEnum';
import { useTranslation } from 'react-i18next';

function RoleSelectionForm({ role, setRole }: { role: string, setRole: (role: string) => void }) {
    const { t } = useTranslation();
    const { data: ROLE_OPTIONS, isLoading: isLoadingRoleOptions } = useRole();
 
    return (
        <select
        value={role}
        onChange={(e) => setRole(e.target.value as any)}
        className="w-fit px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">Select Role</option>
        {!isLoadingRoleOptions && ROLE_OPTIONS && ROLE_OPTIONS.map((role: RoleOption) => (
          <option key={role.name} value={role.name} className="capitalize">
            {role.name}
          </option>
        ))}
      </select>
  )
}

export default RoleSelectionForm
