import { useUser } from "@/hooks/useUser";
import { Link, useLocation } from "react-router-dom";

const OutlinerAdminLayout = ({children}: {children: React.ReactNode}) => {
    const location = useLocation();
    const { user } = useUser();
    const isAdmin = user?.role === 'admin';
    const adminLinks: { to: string; label: string; exact?: boolean }[] = [
      { to: "/outliner-admin", label: "Overview", exact: true },
      { to: "/outliner-admin/documents", label: "Documents" },
      { to: "/outliner-admin/users", label: "Users" },
      { to: "/outliner-admin/bdrc", label: "BDRC" },
    ];

    const linkIsActive = (to: string, exact?: boolean) => {
      const { pathname } = location;
      if (exact) return pathname === to;
      return pathname === to || pathname.startsWith(`${to}/`);
    };

    return (
      <div className="flex h-[calc(100vh-4rem)] min-h-0 w-full">
        <aside className="flex w-56 shrink-0 flex-col border-r border-gray-200 bg-white">
          <nav className="flex flex-col gap-0.5 p-3" aria-label="Outliner admin">
            {adminLinks.map(({ to, label, exact }) => {
              if (!isAdmin && label === "Users") return null;
              const active = linkIsActive(to, exact);

              return (
                <Link
                  key={to}
                  to={to}
                  className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-gray-100 text-gray-900"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-gray-50 p-6">
          {children}
        </div>
      </div>
    );
  };

  export default OutlinerAdminLayout;