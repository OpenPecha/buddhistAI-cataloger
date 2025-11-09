import { useEffect, useRef, useState } from "react";
import { useBibliography } from "@/contexts/BibliographyContext";

interface SelectionMenuProps {
  position: { x: number; y: number };
  selectedText: string;
  textStart: number;
  textEnd: number;
  onSelect?: (type: "title" | "colophon" | "incipit" | "person") => void;
  onClose: () => void;
}

const SelectionMenu = ({ position, selectedText, textStart, textEnd, onSelect, onClose }: SelectionMenuProps) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState(position);
  const { addAnnotation } = useBibliography();

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

      let { x, y } = position;

      // Check if menu goes off the right edge
      if (x + menuRect.width > viewportWidth) {
        x = position.x - menuRect.width - 20; // Position to the left of selection
      }

      // Check if menu goes off the bottom edge
      if (y + menuRect.height > viewportHeight) {
        y = viewportHeight - menuRect.height - 10;
      }

      // Check if menu goes off the top edge
      if (y < 10) {
        y = 10;
      }

      // Check if menu goes off the left edge
      if (x < 10) {
        x = 10;
      }

      setAdjustedPosition({ x, y });
    }
  }, [position]);

  const handleMenuItemClick = (type: "title" | "colophon" | "incipit" | "person") => {
    // Add to bibliography annotations
    addAnnotation({
      span: {
        start: textStart,
        end: textEnd,
      },
      biblography_type: type,
      text: selectedText,
    });

    // Call optional callback
    if (onSelect) {
      onSelect(type);
    }

    onClose();
  };

  const menuItems = [
    {
      type: "title" as const,
      label: "Title",
      color: "bg-yellow-50 hover:bg-yellow-100 border-yellow-200",
      description: "Mark as document title",
    },
    {
      type: "colophon" as const,
      label: "Colophon Text",
      color: "bg-green-50 hover:bg-green-100 border-green-200",
      description: "Mark as colophon",
    },
    {
      type: "incipit" as const,
      label: "Incipit Title",
      color: "bg-blue-50 hover:bg-blue-100 border-blue-200",
      description: "Mark as incipit title",
    },
    {
      type: "person" as const,
      label: "Person",
      color: "bg-orange-50 hover:bg-orange-100 border-orange-200",
      description: "Mark as person name",
    },
  ];

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white rounded-md shadow-lg border border-gray-200 py-0.5 w-fit min-w-[120px]"
      style={{
        left: `${adjustedPosition.x}px`,
        top: `${adjustedPosition.y}px`,
      }}
    >
      {menuItems.map((item) => (
        <button
          key={item.type}
          onClick={() => handleMenuItemClick(item.type)}
          className={`w-full text-left px-3 py-2 text-xs font-medium transition-colors border-l-2 ${item.color} hover:scale-[1.02]`}
          title={item.description}
        >
          <div className="flex flex-col">
            <span className="font-semibold">{item.label}</span>
            <span className="text-xs opacity-70 mt-0.5">{selectedText.length > 20 ? selectedText.substring(0, 20) + '...' : selectedText}</span>
          </div>
        </button>
      ))}
    </div>
  );
};

export default SelectionMenu;
