import { Decoration,type DecorationSet, EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { StateField, StateEffect } from "@codemirror/state";
import type { BibliographyAnnotation } from "@/context/BibliographyContext";
import i18n from "@/i18n/config";
import { useTokenizer } from "@/hooks/useTokenizer";

// Define effects for managing annotations
export const addAnnotationEffect = StateEffect.define<Omit<BibliographyAnnotation, 'id' | 'timestamp'>>();
export const removeAnnotationEffect = StateEffect.define<string>(); // annotation id
export const syncAnnotationsCallback = new Map<EditorView, (annotations: BibliographyAnnotation[]) => void>();

// Color schemes for different annotation types (colors only)
const annotationColors: Record<string, { color: string; bgColor: string }> = {
  title: { color: "#854d0e", bgColor: "#fef3c7" },
  alt_title: { color: "#6b21a8", bgColor: "#f3e8ff" },
  colophon: { color: "#166534", bgColor: "#dcfce7" },
  incipit: { color: "#1e40af", bgColor: "#dbeafe" },
  alt_incipit: { color: "#0e7490", bgColor: "#cffafe" },
  person: { color: "#c2410c", bgColor: "#fed7aa" },
};

// Function to get translated label for annotation type
function getAnnotationLabel(type: string): string {
  const labelMap: Record<string, string> = {
    title: i18n.t("selectionMenu.title"),
    alt_title: i18n.t("selectionMenu.altTitle"),
    colophon: i18n.t("selectionMenu.colophon"),
    incipit: i18n.t("selectionMenu.incipit"),
    alt_incipit: i18n.t("selectionMenu.altIncipit"),
    person: i18n.t("selectionMenu.person"),
  };
  return labelMap[type] || type;
}

// Function to get annotation style with translated label
function getAnnotationStyle(type: string) {
  const colors = annotationColors[type] || annotationColors.title;
  return {
    ...colors,
    label: getAnnotationLabel(type),
  };
}

// Create the state field to store annotations in CodeMirror state
export const annotationsField = StateField.define<BibliographyAnnotation[]>({
  create() {
    return [];
  },
  update(annotations, tr) {
    let updated = annotations;
    
    // Handle text changes - map ranges through changes to adjust positions
    if (tr.docChanged && tr.changes) {
      updated = annotations.map(ann => {
        try {
          // Map the start and end positions through the changes
          const newStart = tr.changes.mapPos(ann.span.start, 1); // 1 = map to after insertions
          const newEnd = tr.changes.mapPos(ann.span.end, -1); // -1 = map to before deletions
          
          // Get the new text content
          const newText = tr.state.doc.sliceString(newStart, newEnd);
          
          // Only keep if range is still valid
          if (newStart >= 0 && newEnd <= tr.state.doc.length && newStart < newEnd) {
            return { 
              ...ann, 
              span: { start: newStart, end: newEnd },
              text: newText 
            };
          }
          return null;
        } catch (e) {
          return null;
        }
      }).filter((ann): ann is BibliographyAnnotation => ann !== null);
    }
    
    // Handle adding annotations
    for (let effect of tr.effects) {
      if (effect.is(addAnnotationEffect)) {
        const newAnnotation: BibliographyAnnotation = {
          ...effect.value,
          id: `bib-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: Date.now(),
        };
        updated = [...updated, newAnnotation];
      }
      
      // Handle removing annotations
      if (effect.is(removeAnnotationEffect)) {
        updated = updated.filter(ann => ann.id !== effect.value);
      }
    }
    
    return updated;
  },
});

// Function to create decoration for an annotation
function createAnnotationDecoration(annotation: BibliographyAnnotation): Decoration {
  const style = getAnnotationStyle(annotation.type);
  
  return Decoration.mark({
    class: `cm-annotation cm-annotation-${annotation.type}`,
    attributes: {
      "data-annotation-id": annotation.id,
      "data-annotation-type": annotation.type,
      "data-annotation-label": style.label,
      style: `
        background-color: ${style.bgColor};
        border-bottom: 2px solid ${style.color};
        border-radius: 2px;
        position: relative;
        padding: 0 2px;
      `
    },
  });
}

// View plugin to manage decorations
export const annotationPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = this.buildDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged || update.state.field(annotationsField) !== update.startState.field(annotationsField)) {
        this.decorations = this.buildDecorations(update.view);
      }
    }

    buildDecorations(view: EditorView): DecorationSet {
      const annotations = view.state.field(annotationsField);
      const decorations: any[] = [];

      for (const annotation of annotations) {
        try {
          // Use the annotation's span directly - CodeMirror handles range adjustments
          const docLength = view.state.doc.length;
          const start = Math.max(0, Math.min(annotation.span.start, docLength));
          const end = Math.max(start, Math.min(annotation.span.end, docLength));

          if (start < end && start < docLength) {
            decorations.push(
              createAnnotationDecoration(annotation).range(start, end)
            );
          }
        } catch (e) {
          console.warn("Failed to create decoration for annotation:", annotation, e);
        }
      }

      return Decoration.set(decorations, true);
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);

// Base theme for annotations
export const annotationTheme = EditorView.baseTheme({
  ".cm-annotation": {
    position: "relative",
    cursor: "pointer",
    paddingTop: "18px", // Make room for the label
    display: "inline-block",
    "&::before": {
      content: "attr(data-annotation-label)",
      position: "absolute",
      bottom: "100%",
      left: "0",
      fontSize: "10px",
      fontWeight: "600",
      padding: "2px 6px",
      borderRadius: "4px 4px 0 0",
      whiteSpace: "nowrap",
      opacity: "1", // Always visible
      transition: "all 0.2s",
      pointerEvents: "none",
      zIndex: "10",
      marginBottom: "-2px",
    },
    "&:hover::before": {
      transform: "scale(1.05)",
      boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
    },
  },
  ".cm-annotation-title::before": {
    backgroundColor: annotationColors.title.bgColor,
    color: annotationColors.title.color,
    border: `1px solid ${annotationColors.title.color}`,
    borderBottom: "none",
  },
  ".cm-annotation-alt_title::before": {
    backgroundColor: annotationColors.alt_title.bgColor,
    color: annotationColors.alt_title.color,
    border: `1px solid ${annotationColors.alt_title.color}`,
    borderBottom: "none",
  },
  ".cm-annotation-colophon::before": {
    backgroundColor: annotationColors.colophon.bgColor,
    color: annotationColors.colophon.color,
    border: `1px solid ${annotationColors.colophon.color}`,
    borderBottom: "none",
  },
  ".cm-annotation-incipit::before": {
    backgroundColor: annotationColors.incipit.bgColor,
    color: annotationColors.incipit.color,
    border: `1px solid ${annotationColors.incipit.color}`,
    borderBottom: "none",
  },
  ".cm-annotation-alt_incipit::before": {
    backgroundColor: annotationColors.alt_incipit.bgColor,
    color: annotationColors.alt_incipit.color,
    border: `1px solid ${annotationColors.alt_incipit.color}`,
    borderBottom: "none",
  },
  ".cm-annotation-person::before": {
    backgroundColor: annotationColors.person.bgColor,
    color: annotationColors.person.color,
    border: `1px solid ${annotationColors.person.color}`,
    borderBottom: "none",
  },
});

export const pasteTransformExtension: Extension = EditorView.domEventHandlers({
  paste(event, view) {
    event.preventDefault();
    // Check if current URL contains '/commentary' and handle accordingly
    if (window.location.pathname.includes('/commentary')) {
      // Special handling for commentary pages
      

      // Add any commentary-specific paste logic here
    }

    // Get pasted text
    const pasted = event.clipboardData?.getData("text/plain") ?? "";

    // 🔥 TRANSFORM IT HERE
    const transformed = cleanText(pasted);

    // Insert transformed text into CM
    view.dispatch({
      changes: {
        from: view.state.selection.main.from,
        to: view.state.selection.main.to,
        insert: transformed,
      },
    });
  }
});
function cleanText(text: string) {
  return text
    .replace(/\r/g, "")          // Remove carriage returns
    .replace(/\t/g, "  ")        // Convert tabs
    .trim();                     // Trim
}