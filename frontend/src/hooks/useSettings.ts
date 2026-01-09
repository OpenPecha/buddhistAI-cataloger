import { getTenantByDomain } from "@/api/settings";
import { useQuery } from "@tanstack/react-query";

export const useGetSettingsByDomain = (domain: string) => {
    return useQuery({
        queryKey: ['settings', domain],
        queryFn: async () => {
            const result = await getTenantByDomain(domain);
            if (!result) {
                throw new Error('Tenant not found');
            }
            return result;
        },
        enabled: !!domain && domain !== '',
        retry: false,
    });
};

