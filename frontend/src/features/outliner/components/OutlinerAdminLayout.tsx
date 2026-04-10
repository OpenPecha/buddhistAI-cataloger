import { useUser } from "@/hooks/useUser";
import { ChevronDown, ChevronRight, FileIcon, HomeIcon, UsersIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

type AdminNavSubItem = { to: string; label: string; exact?: boolean };
type AdminNavItem = {
  to: string;
  label: string;
  exact?: boolean;
  sub?: AdminNavSubItem[];
  icon?: React.ReactNode;
};

const ADMIN_LINKS: AdminNavItem[] = [
  { to: "/outliner-admin", label: "Overview", exact: true ,icon: <HomeIcon className="w-4 h-4" />},
  { to: "/outliner-admin/documents", label: "Documents" ,icon: <FileIcon className="w-4 h-4" />},
  { to: "/outliner-admin/users", label: "Users" ,icon: <UsersIcon className="w-4 h-4" />},
  {
    to: "/outliner-admin/bdrc-library",
    label: "BDRC Library",
    sub: [
      { to: "/outliner-admin/bdrc-library/works", label: "Works" },
      { to: "/outliner-admin/bdrc-library/persons", label: "Persons" },
    ],
  },
];

function navPathActive(pathname: string, to: string, exact?: boolean) {
  if (exact) return pathname === to;
  return pathname === to || pathname.startsWith(`${to}/`);
}

const linkBase =
  "rounded-md px-3 py-2 text-sm font-medium transition-colors flex items-center gap-2";
const linkInactive = "text-gray-600 hover:bg-gray-50 hover:text-gray-900";
const linkActive = "bg-gray-100 text-gray-900";

const OutlinerAdminLayout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const { user } = useUser();
  const isAdmin = user?.role === "admin";

  const linkIsActive = (to: string, exact?: boolean) =>
    navPathActive(location.pathname, to, exact);

  const [openSections, setOpenSections] = useState<Record<string, boolean>>(
    () => {
      const initial: Record<string, boolean> = {};
      for (const item of ADMIN_LINKS) {
        if (
          item.sub &&
          navPathActive(location.pathname, item.to, item.exact)
        ) {
          initial[item.to] = true;
        }
      }
      return initial;
    },
  );

  useEffect(() => {
    const pathname = location.pathname;
    setOpenSections((prev) => {
      let next = prev;
      for (const item of ADMIN_LINKS) {
        if (
          item.sub &&
          navPathActive(pathname, item.to, item.exact) &&
          !prev[item.to]
        ) {
          if (next === prev) next = { ...prev };
          next[item.to] = true;
        }
      }
      return next;
    });
  }, [location.pathname]);

  const toggleSection = (path: string) => {
    setOpenSections((s) => ({ ...s, [path]: !s[path] }));
  };
  const ADMIN_LABELS=new Set<string>(["Users","BDRC Library","Works","Persons"]);
  return (
    <div className="flex h-[calc(100vh-4rem)] min-h-0 w-full">
      <aside className="flex w-56 shrink-0 flex-col border-r border-gray-200 bg-white">
        <nav className="flex flex-col gap-0.5 p-3" aria-label="Outliner admin">
          {ADMIN_LINKS.map((item) => {
            const { to, label, exact, sub, icon } = item;
            if (!isAdmin && ADMIN_LABELS.has(label)) return null;

            if (sub?.length) {
              const sectionOpen = openSections[to] ?? false;
              const parentActive = linkIsActive(to, exact);

              return (
                <div key={to} className="flex flex-col gap-0.5">
                  <div className="flex items-stretch gap-0.5 rounded-md">
                    <button
                      type="button"
                      onClick={() => toggleSection(to)}
                      className={`flex w-8 shrink-0 items-center justify-center rounded-md border border-transparent text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900 ${parentActive ? "text-gray-900" : ""}`}
                      aria-expanded={sectionOpen}
                      aria-controls={`nav-sub-${to.replaceAll("/", "-")}`}
                      aria-label={
                        sectionOpen
                          ? `Collapse ${label} submenu`
                          : `Expand ${label} submenu`
                      }
                    >
                      {sectionOpen ? (
                        <ChevronDown className="h-4 w-4" aria-hidden />
                      ) : (
                        <ChevronRight className="h-4 w-4" aria-hidden />
                      )}
                    </button>
                    <Link
                       to="#"
                      className={`${linkBase} flex min-w-0 flex-1 items-center ${parentActive ? linkActive : linkInactive}`}
                    >
                      {label}
                    </Link>
                  </div>
                  {sectionOpen && (
                    <ul
                      id={`nav-sub-${to.replaceAll("/", "-")}`}
                      className="ml-4 flex list-none flex-col gap-0.5 border-l border-gray-200 pl-2"
                      aria-label={`${label} pages`}
                    >
                      {sub.map((s) => {
                        const subActive = linkIsActive(s.to, s.exact);
                        return (
                          <li key={s.to}>
                            <Link
                              to={s.to}
                              className={`${linkBase} block pl-2 ${subActive ? linkActive : linkInactive}`}
                            >
                              {s.label}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            }

            const active = linkIsActive(to, exact);
            return (
              <Link
                key={to}
                to={to}
                className={`${linkBase} ${active ? linkActive : linkInactive}`}
              >
                {icon} {label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-gray-50 ">
        {children}
      </div>
    </div>
  );
};

export default OutlinerAdminLayout;
