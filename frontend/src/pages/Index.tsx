import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { BookOpen, PersonStanding } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [editedContent, setEditedContent] = useLocalStorage(
    "editedContent",
    ""
  );
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
          variant="default"
          className="bg-blue-600  hover:bg-blue-700 text-white px-6 py-3 text-lg shadow-lg"
        >
          + {t("common.create")}
        </Button>
      </div>

      {/* Content */}
      <div className="space-y-6">
        <div className=" rounded-lg  pt-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8 ">
            <Link to="/texts">
              <div className=" flex gap-3 items-center  border bg-white border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow min-h-[140px]">
                  <BookOpen className="w-16 h-16 text-blue-600 flex-shrink-0" />
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
                <PersonStanding className="w-16 h-16 text-purple-600 flex-shrink-0" />
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
