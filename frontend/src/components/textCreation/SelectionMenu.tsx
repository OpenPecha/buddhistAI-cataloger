import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

interface SelectionMenuProps {
  position: { x: number; y: number };
  selectedText: string;
  textStart: number;
  textEnd: number;
  onSelect?: (type: "title" | "alt_title" | "colophon" | "incipit" | "alt_incipit" | "person") => void;
  onClose: () => void;
  isCreatingNewText?: boolean;
  hasIncipit?: boolean;
  hasTitle?: boolean;
  allowedTypes?: ("title" | "alt_title" | "colophon" | "incipit" | "alt_incipit" | "person")[];
}

const SelectionMenu = ({ position, selectedText, textStart, textEnd, onSelect, onClose, hasIncipit = false, hasTitle = false, allowedTypes }: SelectionMenuProps) => {
  const { t } = useTranslation();
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState(position);
  const [isVisible, setIsVisible] = useState(false);

  // Trigger fade-in animation
  useEffect(() => {
    setIsVisible(true);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  // Adjust position to keep menu within viewport
  useEffect(() => {
    if (menuRef.current) {
      const menuRect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const margin = 8;

      let x = position.x;
      let y = position.y;

      // 1. Prefer showing slightly below the cursor
      y = position.y + 12;

      // If it overflows bottom, flip above the cursor
      if (y + menuRect.height + margin > viewportHeight) {
        y = position.y - menuRect.height - 12;
      }

      // 2. Prefer showing aligned to the cursor on X
      x = position.x + 4;

      // If it overflows right, show to the left of the cursor
      if (x + menuRect.width + margin > viewportWidth) {
        x = position.x - menuRect.width - 4;
      }

      // 3. Final clamping so it's always fully inside viewport
      if (x < margin) x = margin;
      if (y < margin) y = margin;
      if (x + menuRect.width + margin > viewportWidth) {
        x = viewportWidth - menuRect.width - margin;
      }
      if (y + menuRect.height + margin > viewportHeight) {
        y = viewportHeight - menuRect.height - margin;
      }

      setAdjustedPosition({ x, y });
    }
  }, [position]);

  const handleMenuItemClick = (type: "title" | "alt_title" | "colophon" | "incipit" | "alt_incipit" | "person") => {
    // Annotation is now added directly in TextEditorView via CodeMirror effects
    // Just call the callback for form updates
    if (onSelect) {
      onSelect(type);
    }

    onClose();
  };

  const allMenuItems = [
    {
      type: "title" as const,
      label: t("selectionMenu.title"),
      icon: "📄",
      color: "from-yellow-50 to-yellow-100/50 hover:from-yellow-100 hover:to-yellow-200/50 border-yellow-300",
      textColor: "text-yellow-800",
      description: t("selectionMenu.titleDesc"),
    },
    {
      type: "alt_title" as const,
      label: t("selectionMenu.altTitle"),
      icon: "📑",
      color: "from-purple-50 to-purple-100/50 hover:from-purple-100 hover:to-purple-200/50 border-purple-300",
      textColor: "text-purple-800",
      description: t("selectionMenu.altTitleDesc"),
    },
    {
      type: "colophon" as const,
      label: t("selectionMenu.colophon"),
      icon: "✍️",
      color: "from-green-50 to-green-100/50 hover:from-green-100 hover:to-green-200/50 border-green-300",
      textColor: "text-green-800",
      description: t("selectionMenu.colophonDesc"),
    },
    {
      type: "incipit" as const,
      label: t("selectionMenu.incipit"),
      icon: "🔖",
      color: "from-blue-50 to-blue-100/50 hover:from-blue-100 hover:to-blue-200/50 border-blue-300",
      textColor: "text-blue-800",
      description: t("selectionMenu.incipitDesc"),
    },
    {
      type: "alt_incipit" as const,
      label: t("selectionMenu.altIncipit"),
      icon: "🏷️",
      color: "from-cyan-50 to-cyan-100/50 hover:from-cyan-100 hover:to-cyan-200/50 border-cyan-300",
      textColor: "text-cyan-800",
      description: t("selectionMenu.altIncipitDesc"),
    },
    {
      type: "person" as const,
      label: t("selectionMenu.person"),
      icon: "👤",
      color: "from-orange-50 to-orange-100/50 hover:from-orange-100 hover:to-orange-200/50 border-orange-300",
      textColor: "text-orange-800",
      description: t("selectionMenu.personDesc"),
    },
  ];

  // Filter menu items based on allowedTypes prop
  const filteredMenuItems = allowedTypes 
    ? allMenuItems.filter(item => allowedTypes.includes(item.type))
    : allMenuItems;

  return (
    <div
      ref={menuRef}
      className={`absolute z-50 rounded-xl shadow-2xl border border-gray-200/60 backdrop-blur-sm bg-white/95 p-1.5 min-w-[200px] transition-all duration-200 ${
        isVisible ? "opacity-100 scale-100" : "opacity-0 scale-95"
      }`}
      style={{
        left: `${adjustedPosition.x}px`,
        top: `${adjustedPosition.y}px`,
      }}
    >
      <div className="space-y-1">
        {filteredMenuItems.map((item, index) => {
          // Disable alt_incipit if there's no incipit title
          // Disable alt_title if there's no main title
          const isDisabled = 
            (item.type === "alt_incipit" && !hasIncipit) ||
            (item.type === "alt_title" && !hasTitle);
          
          const disabledMessage = 
            item.type === "alt_incipit" ? t("selectionMenu.addIncipitFirst") :
            item.type === "alt_title" ? t("selectionMenu.addTitleFirst") :
            item.description;
          
          return (
            <button
              key={item.type}
              onClick={() => !isDisabled && handleMenuItemClick(item.type)}
              disabled={isDisabled}
              className={`group w-full text-left px-3 py-2.5 text-sm font-medium transition-all duration-200 rounded-lg border-l-3 bg-gradient-to-r ${item.color} shadow-sm flex items-center gap-2.5 ${
                isDisabled
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:shadow-md hover:translate-x-0.5 active:scale-98"
              }`}
              title={isDisabled ? disabledMessage : item.description}
              style={{
                animationDelay: `${index * 30}ms`,
              }}
            >
              <span className={`text-base flex-shrink-0 transition-transform duration-200 ${!isDisabled && "group-hover:scale-110"}`}>
                {item.icon}
              </span>
              <span className={`${item.textColor} font-semibold flex-1`}>
                {item.label}
              </span>
              {!isDisabled && (
                <svg
                  className={`w-3.5 h-3.5 ${item.textColor} opacity-0 group-hover:opacity-100 transition-opacity duration-200`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              )}
              {isDisabled && (
                <svg
                  className={`w-3.5 h-3.5 ${item.textColor} opacity-30`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default SelectionMenu;
