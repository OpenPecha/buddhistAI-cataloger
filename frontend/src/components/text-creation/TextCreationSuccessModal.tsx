import React, { useEffect, useRef } from "react";
import { FileText, X, CheckCircle2, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";

interface TextCreationSuccessModalProps {
  message: string;
  onClose: () => void;
  instanceId?: string | null; // Current instance ID (from API response)
  parentInstanceId?: string | null; // Parent instance ID (from URL params)
}

// Utility: join class names
function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const TextCreationSuccessModal = ({ message, onClose, instanceId, parentInstanceId }: TextCreationSuccessModalProps) => {
  const { t } = useTranslation();
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  // Focus close button on mount (basic a11y)
  useEffect(() => {
    closeBtnRef.current?.focus();
  }, []);

  // Handler for Formatter card click
  const handleFormatterClick = () => {
    if (instanceId) {
      // Use environment variable if set, otherwise use default localhost
      const baseUrl = import.meta.env.VITE_FORMATTER_URL || 'http://localhost:5000';
      const formatterUrl = `${baseUrl}/formatter/${instanceId}`;
      window.open(formatterUrl, '_blank', 'noopener,noreferrer');
    }
  };

  // Handler for Aligner card click
  const handleAlignerClick = () => {
    if (parentInstanceId && instanceId) {
      // Use environment variable if set, otherwise use default localhost
      const baseUrl = import.meta.env.VITE_FORMATTER_URL || 'http://localhost:5000';
      const alignerUrl = `${baseUrl}/aligner/${parentInstanceId}/${instanceId}`;
      window.open(alignerUrl, '_blank', 'noopener,noreferrer');
    }
  };

  // Close on ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Prevent background scroll while open
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  return (
    <AnimatePresence>
      <div
        aria-modal
        role="dialog"
        aria-labelledby="success-title"
        aria-describedby="success-desc"
        className="fixed inset-0 z-50 h-screen w-screen"
      >
        {/* Soft gradient + blur overlay */}
        <motion.div
          className="absolute inset-0 h-full w-full bg-gradient-to-br from-emerald-500/20 via-sky-500/20 to-fuchsia-500/20 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        />

        {/* Decorative floating blobs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <motion.div
            className="absolute -top-20 -left-20 h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl"
            animate={{ x: [0, 20, -10, 0], y: [0, 10, -10, 0] }}
            transition={{ repeat: Infinity, duration: 12, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-indigo-400/20 blur-3xl"
            animate={{ x: [0, -15, 10, 0], y: [0, -10, 15, 0] }}
            transition={{ repeat: Infinity, duration: 14, ease: "easeInOut" }}
          />
        </div>

        {/* Modal card */}
        <div className="relative flex min-h-full items-center justify-center p-4 sm:p-8">
          <motion.div
            initial={{ y: 20, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 10, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 220, damping: 22 }}
            className={cn(
              "relative w-full max-w-3xl",
              "rounded-3xl border border-white/20 bg-white/80 dark:bg-gray-900/70 backdrop-blur-xl",
              "shadow-[0_10px_40px_-12px_rgba(0,0,0,0.35)]"
            )}
          >
            {/* Gradient ring */}
            <div className="pointer-events-none absolute -inset-[1px] rounded-3xl bg-gradient-to-br from-white/70 via-emerald-300/40 to-transparent opacity-70 [mask:linear-gradient(#000,transparent_60%)]" />

            {/* Top bar with close */}
            <div className="relative px-6 py-4 sm:px-8 sm:py-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 ring-1 ring-emerald-500/40">
                  <CheckCircle2 className="text-emerald-600" size={20} />
                </div>
                <h2 id="success-title" className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100">
                  {t('successModal.textCreatedSuccessfully')}
                </h2>
              </div>

              <button
                ref={closeBtnRef}
                onClick={onClose}
                className={cn(
                  "group inline-flex items-center justify-center rounded-full p-2.5",
                  "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200",
                  "ring-1 ring-black/5 hover:ring-black/10 transition"
                )}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="relative px-6 pb-6 sm:px-8 sm:pb-8">
              {/* Success banner */}
              <div className="mb-6 overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-900/20 dark:to-gray-900">
                <div className="relative px-6 py-5 sm:px-8 sm:py-6">
                  <p id="success-desc" className="text-base sm:text-lg font-medium text-gray-800 dark:text-gray-100 text-center">
                    {message}
                  </p>
                </div>
              </div>

              {/* Tool grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                {/* Aligner Card */}
                <ActionCard
                  title="Aligner"
                  subtitle={t('successModal.alignerSubtitle')}
                  icon={
                    <div className="bg-blue-500 rounded-xl p-2 ring-1 ring-white/40">
                      <FileText className="text-white" size={22} />
                    </div>
                  }
                  onClick={handleAlignerClick}
                />

              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  );
};

export default TextCreationSuccessModal;

// --- Subcomponents ---
interface ActionCardProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  onClick?: () => void;
}

function ActionCard({ title, subtitle, icon, onClick }: ActionCardProps) {
  const { t } = useTranslation();
  
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ y: 6, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.04 }}
      className={cn(
        "group relative flex w-full flex-col justify-between overflow-hidden",
        "rounded-2xl border border-white/15 bg-gray-900/80 px-5 py-5 text-left",
        "ring-1 ring-black/5 hover:ring-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
        "dark:bg-gray-800/80"
      )}
    >
      <div className="flex items-center gap-3">
        {icon}
        <h3 className="text-white font-semibold text-base sm:text-lg">{title}</h3>
      </div>

      <p className="mt-3 text-sm text-gray-400 min-h-[2.5rem]">{subtitle}</p>

      <div className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-white/90">
        <span className="opacity-90">{t('successModal.accessTool')}</span>
        <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
      </div>

      {/* subtle gradient shine */}
      <span className="pointer-events-none absolute inset-x-0 -top-1 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
      <span className="pointer-events-none absolute inset-x-0 -bottom-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      {/* hover glow */}
      <div className="pointer-events-none absolute -inset-[1px] rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{
        background: "radial-gradient(120px 80px at var(--x,50%) var(--y,50%), rgba(16,185,129,0.14), transparent 60%)"
      }} />
    </motion.button>
  );
}