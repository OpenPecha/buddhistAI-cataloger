import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

const Index = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-blue-800">
          {t("header.title")}
        </h1>
        <Button
          onClick={() => navigate("/create")}
          variant="default"
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 text-lg font-semibold shadow-lg"
        >
          + {t("common.create")}
        </Button>
      </div>

      {/* Content */}
      <div className="space-y-6">
        <div className=" rounded-lg  p-8">
        

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
            <div className="border bg-white border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow">
              <div className="text-blue-600 mb-3">
                <svg
                  className="w-12 h-12"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">{t("text.texts")}</h3>
              <p className="text-gray-600 mb-4">
                {t("home.description")}
              </p>
              <a
                href="/texts"
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                {t("text.texts")}
              </a>
            </div>

            <div className="border bg-white border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow">
              <div className="text-purple-600 mb-3">
                <svg
                  className="w-12 h-12"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">{t("person.persons")}</h3>
              <p className="text-gray-600 mb-4">
                {t("home.description")}
              </p>
              <a
                href="/persons"
                className="text-purple-600 hover:text-purple-800 font-medium"
              >
                {t("person.persons")}
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
