import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { BookOpen, Loader2, PersonStanding, Plus } from "lucide-react";
import { usePermission } from "@/hooks/usePermission";
import PermissionButton from "@/components/PermissionButton";

const Index = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [editedContent, setEditedContent] = useLocalStorage(
    "editedContent",
    ""
  );
  const { data: permission,isFetching:isFetchingPermission } = usePermission();
  const isAdmin=permission?.role === "admin";
  return (
    <div className="container mx-auto py-16  px-4  space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl  font-bold ">
          {t("header.title")}
        </h1>
        <Button
          onClick={() => {
            setEditedContent("");
            navigate("/create");
          }}
          disabled={!isAdmin}
          variant="default"
          className="bg-[var(--color-primary)]  hover:bg-[var(--color-primary)]/90 text-white px-6 py-3 text-lg shadow-lg"
        >
          <PermissionButton isLoading={isFetchingPermission} icon={<Plus className="w-4 h-4" />} text={t("common.create")} />
        </Button>
      </div>

      {/* Content */}
      <div className="space-y-6">
        <div className=" rounded-lg  pt-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8 ">
            <Link to="/texts">
              <div className=" flex gap-3 items-center  border bg-white border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow min-h-[140px]">
                  <BookOpen className="w-16 h-16 text-[var(--color-primary)] flex-shrink-0" />
                <div className="flex flex-col gap-2 ml-2">
                  <h3 className="text-3xl flex items-center gap-3 font-semibold ">
                    {t("text.texts")}
                  </h3>
                  <p className="text-gray-500 font-semibold">
                    {t("home.description")}
                  </p>
                </div>
              </div>
            </Link>
            <Link to="/persons">
              <div className=" flex gap-3 items-center  border bg-white border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow min-h-[140px]">
                <PersonStanding className="w-16 h-16 text-[var(--color-secondary)] flex-shrink-0" />
                <div className="flex flex-col gap-2">
                  <h3 className="text-3xl flex items-center gap-3 font-semibold ">
                    {t("person.persons")}
                  </h3> 
                  <p className="text-gray-500 font-semibold">
                    {t("home.description")}
                  </p>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
