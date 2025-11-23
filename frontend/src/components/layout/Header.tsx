import { Link, useLocation } from "react-router-dom";
import { Book, Users, Home, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "../formComponent/LanguageSelector";

const Navigation = () => {
  const location = useLocation();
  const { t } = useTranslation();
  
  const navItems = [
    { path: "/texts", icon: Book, label: t("header.texts") },
    { path: "/persons", icon: Users, label: t("header.persons") },
  ];

  return (
    <nav className="bg-card border-b border-border sticky top-0 z-50 shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-3 group">
              <img src="/icon.png" alt="OpenPecha" className="w-10 h-10" />
            <div>
              <h1 className="">{t("header.title")}</h1>
            </div>
          </Link>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname.includes(item.path);
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg transition-smooth",
                    isActive
                      ? " text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden md:inline font-medium">{item.label}</span>
                </Link>
              );
            })}
            </div>
            <LanguageSwitcher />
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
