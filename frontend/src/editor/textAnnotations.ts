import { Decoration,type DecorationSet, EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { StateField, StateEffect } from "@codemirror/state";
import type { BibliographyAnnotation } from "@/contexts/BibliographyContext";

// Define the effect for updating annotations
export const updateAnnotationsEffect = StateEffect.define<BibliographyAnnotation[]>();

// Color schemes for different annotation types
const annotationStyles: Record<string, { color: string; label: string; bgColor: string }> = {
  title: { color: "#854d0e", label: "Title", bgColor: "#fef3c7" },
  alt_title: { color: "#6b21a8", label: "Alt Title", bgColor: "#f3e8ff" },
  colophon: { color: "#166534", label: "Colophon", bgColor: "#dcfce7" },
  incipit: { color: "#1e40af", label: "Incipit", bgColor: "#dbeafe" },
  alt_incipit: { color: "#0e7490", label: "Alt Incipit", bgColor: "#cffafe" },
  person: { color: "#c2410c", label: "Person", bgColor: "#fed7aa" },
};

// Create the state field to store annotations
export const annotationsField = StateField.define<BibliographyAnnotation[]>({
  create() {
    return [];
  },
  update(annotations, tr) {
    for (let effect of tr.effects) {
      if (effect.is(updateAnnotationsEffect)) {
        return effect.value;
      }
    }
    return annotations;
  },
});

// Function to create decoration for an annotation
function createAnnotationDecoration(annotation: BibliographyAnnotation): Decoration {
  const style = annotationStyles[annotation.type] || annotationStyles.title;
  
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
          // Ensure positions are within document bounds
          const docLength = view.state.doc.length;
          const start = Math.max(0, Math.min(annotation.span.start, docLength));
          const end = Math.max(start, Math.min(annotation.span.end, docLength));

          if (start < end) {
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
    backgroundColor: annotationStyles.title.bgColor,
    color: annotationStyles.title.color,
    border: `1px solid ${annotationStyles.title.color}`,
    borderBottom: "none",
  },
  ".cm-annotation-alt_title::before": {
    backgroundColor: annotationStyles.alt_title.bgColor,
    color: annotationStyles.alt_title.color,
    border: `1px solid ${annotationStyles.alt_title.color}`,
    borderBottom: "none",
  },
  ".cm-annotation-colophon::before": {
    backgroundColor: annotationStyles.colophon.bgColor,
    color: annotationStyles.colophon.color,
    border: `1px solid ${annotationStyles.colophon.color}`,
    borderBottom: "none",
  },
  ".cm-annotation-incipit::before": {
    backgroundColor: annotationStyles.incipit.bgColor,
    color: annotationStyles.incipit.color,
    border: `1px solid ${annotationStyles.incipit.color}`,
    borderBottom: "none",
  },
  ".cm-annotation-alt_incipit::before": {
    backgroundColor: annotationStyles.alt_incipit.bgColor,
    color: annotationStyles.alt_incipit.color,
    border: `1px solid ${annotationStyles.alt_incipit.color}`,
    borderBottom: "none",
  },
  ".cm-annotation-person::before": {
    backgroundColor: annotationStyles.person.bgColor,
    color: annotationStyles.person.color,
    border: `1px solid ${annotationStyles.person.color}`,
    borderBottom: "none",
  },
});

