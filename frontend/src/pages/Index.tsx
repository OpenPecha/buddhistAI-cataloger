import { Link, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { useTranslation } from "react-i18next"
import { useLocalStorage } from "@/hooks/useLocalStorage"
import {
  BookOpen,
  PersonStanding,
  Plus,
  Library,
  Users,
  Code2,
} from "lucide-react"
import { usePermission } from "@/hooks/usePermission"
import PermissionButton from "@/components/PermissionButton"

const Index = () => {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [, setEditedContent] = useLocalStorage("editedContent", "")
  const { data: permission, isFetching: isFetchingPermission } = usePermission()
  const isAdmin = permission?.role === "admin"

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col gap-12">
      {/* Header: headline + tagline + Create (no gradient) */}
      <section className="container mx-auto px-4 pt-10 pb-8 sm:pt-14 sm:pb-10">
        <div className=" mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              {t("home.heroHeadline")}
            </h1>
            <p className="mt-3 text-gray-600 sm:text-lg max-w-2xl">
              {t("home.heroTagline")}
            </p>
          </div>
          {isAdmin && (
            <Button
              size="lg"
              onClick={() => {
                setEditedContent("")
                navigate("/create")
              }}
              disabled={!isAdmin}
              className="shrink-0 bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-white cursor-pointer"
            >
              <PermissionButton
                isLoading={isFetchingPermission}
                icon={<Plus className="w-5 h-5" />}
                text={t("common.create")}
              />
            </Button>
          )}
        </div>
      </section>

      {/* Feature descriptions (informational only, no links) */}
      <section className="container mx-auto px-4 flex-1">
        <div className="max-w-4xl h-max  grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <Link
              to="/texts"
            >

          <div className="flex h-full items-start gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all duration-200 hover:border-[var(--color-primary)]/50 hover:shadow-md">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5 text-[var(--color-primary)]">
              <BookOpen className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-semibold text-gray-900">
                {t("home.featureTextsTitle")}
              </h3>
              <p className="mt-1 text-sm text-gray-600">
                {t("home.featureTextsDescription")}
              </p>
            </div>
          </div>
          </Link>

          <Link
              to="/persons"
            >
          <div className="flex h-full items-start gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all duration-200 hover:border-[var(--color-secondary)]/50 hover:shadow-md">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-[var(--color-secondary)]/30 bg-[var(--color-secondary)]/10 text-[var(--color-secondary)]">
              <PersonStanding className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-semibold text-gray-900">
                {t("home.featurePersonsTitle")}
              </h3>
              <p className="mt-1 text-sm text-gray-600">
                {t("home.featurePersonsDescription")}
              </p>
            </div>
          </div>
          </Link>
        </div>
      </section>

      {/* Footer: stats attached to bottom */}
      <footer className="mt-auto border-t border-gray-200 bg-gray-50/80">
        <section className="container mx-auto px-4 py-6 sm:py-8">
          <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 text-center">
          <div className="rounded-xl border border-gray-200 bg-white px-6 py-8 shadow-sm">
            <Library className="mx-auto h-10 w-10 text-[var(--color-primary)]" />
            <p className="mt-3 text-xl font-bold text-gray-900">
              {t("home.statsCatalog")}
            </p>
            <p className="mt-1 text-sm text-gray-600">{t("home.description")}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white px-6 py-8 shadow-sm">
            <Users className="mx-auto h-10 w-10 text-[var(--color-secondary)]" />
            <p className="mt-3 text-xl font-bold text-gray-900">
              {t("home.statsPersons")}
            </p>
            <p className="mt-1 text-sm text-gray-600">{t("person.persons")}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white px-6 py-8 shadow-sm">
            <Code2 className="mx-auto h-10 w-10 text-gray-600" />
            <p className="mt-3 text-xl font-bold text-gray-900">
              {t("home.statsOpen")}
            </p>
            <p className="mt-1 text-sm text-gray-600">OpenPecha</p>
          </div>
        </div>
        </section>
      </footer>
    </div>
  )
}

export default Index
