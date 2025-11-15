import { useState, useRef, useEffect } from 'react';
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { EditorView } from '@codemirror/view';
import SelectionMenu from './SelectionMenu';
import FormattedTextDisplay from '../FormattedTextDisplay';
import { BibliographyAnnotationsList } from '../BibliographyAnnotationsList';
import { annotationsField, annotationPlugin, annotationTheme, addAnnotationEffect } from '@/editor/textAnnotations';
import { useTranslation } from 'react-i18next';
import { useBibliography } from '@/contexts/BibliographyContext';

interface TextEditorViewProps {
  content: string;
  filename?: string;
  onChange?: (value: string) => void;
  editable?: boolean;
  onTextSelect?: (text: string, type: 'title' | 'alt_title' | 'colophon' | 'incipit' | 'alt_incipit' | 'person') => void;
  isCreatingNewText?: boolean;
  hasIncipit?: boolean;
  hasTitle?: boolean;
  allowedTypes?: ("title" | "alt_title" | "colophon" | "incipit" | "alt_incipit" | "person")[];
}

const TextEditorView = ({ content, onChange, editable = false, onTextSelect, isCreatingNewText = true, hasIncipit = false, hasTitle = false, allowedTypes }: TextEditorViewProps) => {
  const { t } = useTranslation();
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [selectedText, setSelectedText] = useState('');
  const [textStart, setTextStart] = useState(0);
  const [textEnd, setTextEnd] = useState(0);
  const [activeTab, setActiveTab] = useState<'content' | 'preview' | 'bibliography'>('content');
  const editorRef = useRef<HTMLDivElement>(null);
  const cmRef = useRef<ReactCodeMirrorRef>(null);
  const [editorView, setEditorView] = useState<EditorView | null>(null);
  const { clearAnnotations, addAnnotation } = useBibliography();

  // Track editorView when CodeMirror initializes
  useEffect(() => {
    const checkView = () => {
      if (cmRef.current?.view) {
        setEditorView(cmRef.current.view);
      }
    };
    
    // Check immediately
    checkView();
    
    // Also check periodically in case CodeMirror initializes later
    const interval = setInterval(checkView, 100);
    
    return () => clearInterval(interval);
  }, []);

  // Sync annotations from CodeMirror state to BibliographyContext for API access
  useEffect(() => {
    const view = editorView || cmRef.current?.view;
    if (!view) return;

    const syncAnnotations = () => {
      try {
        const cmAnnotations = view.state.field(annotationsField);
        
        // Clear context and re-add all annotations from CodeMirror
        // This ensures context stays in sync with CodeMirror state
        clearAnnotations();
        for (const ann of cmAnnotations) {
          // Add annotation to context (it will generate a new ID, but that's okay for API purposes)
          addAnnotation({
            span: ann.span,
            type: ann.type,
            text: ann.text,
          });
        }
      } catch (e) {
        console.warn('Failed to sync annotations from CodeMirror to context:', e);
      }
    };

    // Sync immediately
    syncAnnotations();

    // Sync periodically to catch changes (when user edits text, annotations update)
    const interval = setInterval(syncAnnotations, 500);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorView]);

  // Get annotations count from CodeMirror state for display
  const getAnnotationsCount = () => {
    const view = editorView || cmRef.current?.view;
    if (!view) return 0;
    try {
      return view.state.field(annotationsField).length;
    } catch {
      return 0;
    }
  };

  const handleMouseUp = (event: React.MouseEvent) => {
    // Only show selection menu when in the content (CodeMirror) tab
    if (activeTab !== 'content') {
      return;
    }

    // Get selection from CodeMirror view instead of DOM
    const view = cmRef.current?.view;
    if (!view) {
      return;
    }

    const selection = view.state.selection.main;
    const selectedText = view.state.sliceDoc(selection.from, selection.to).trim();
    
    if (selectedText && selectedText.length > 0) {
      // Use CodeMirror's selection range directly
      setTextStart(selection.from);
      setTextEnd(selection.to);
      
      // Calculate position relative to the editor container
      if (editorRef.current) {
        const rect = editorRef.current.getBoundingClientRect();
        const menuWidth = 180; // Increased for better layout
        const menuHeight = 160; // Increased for descriptions
        
        // Calculate initial position
        let x = event.clientX - rect.left + 10;
        let y = event.clientY - rect.top + 20;
        
        // Adjust horizontal position if menu would overflow
        if (x + menuWidth > rect.width) {
          // Show on left side of cursor
          x = event.clientX - rect.left - menuWidth - 10;
        }
        
        // Ensure menu doesn't go off left edge
        if (x < 0) {
          x = 10;
        }
        
        // Adjust vertical position if menu would overflow
        if (y + menuHeight > rect.height) {
          y = event.clientY - rect.top - menuHeight - 10;
        }
        
        // Ensure menu doesn't go off top edge
        if (y < 0) {
          y = 10;
        }
        
        setSelectedText(selectedText);
        setMenuPosition({ x, y });
        setShowMenu(true);
      }
    }
  };

  const handleMenuSelect = (type: 'title' | 'alt_title' | 'colophon' | 'incipit' | 'alt_incipit' | 'person') => {
    const view = cmRef.current?.view;
    if (!view) {
      setShowMenu(false);
      return;
    }

    // Add annotation directly to CodeMirror state using the stored range
    if (selectedText && textStart !== undefined && textEnd !== undefined) {
      view.dispatch({
        effects: addAnnotationEffect.of({
          span: {
            start: textStart,
            end: textEnd,
          },
          type: type,
          text: selectedText,
        })
      });
    }

    // Call optional callback for form updates
    if (selectedText && onTextSelect) {
      onTextSelect(selectedText, type);
    }
    
    setShowMenu(false);
    setSelectedText('');
  };
  return (
    <div className="h-full flex flex-col">
      {/* Selection Menu */}
      {showMenu && (
        <SelectionMenu
          position={menuPosition}
          selectedText={selectedText}
          textStart={textStart}
          textEnd={textEnd}
          onSelect={handleMenuSelect}
          onClose={() => setShowMenu(false)}
          isCreatingNewText={isCreatingNewText}
          hasIncipit={hasIncipit}
          hasTitle={hasTitle}
          allowedTypes={allowedTypes}
        />
      )}
      
      {/* Header */}
      <div className="bg-gray-100 border-b border-gray-300">
       

        {/* Tabs */}
        <div className="flex items-center px-4">
          <button
            onClick={() => setActiveTab('content')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'content'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            {t('editor.content')}
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'preview'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            {t('editor.preview')}
          </button>
          <button
            onClick={() => setActiveTab('bibliography')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors relative ${
              activeTab === 'bibliography'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            {t('editor.bibliography')}
            {getAnnotationsCount() > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                {getAnnotationsCount()}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Content Area - Conditional Rendering */}
      <div className="flex-1 overflow-hidden" ref={editorRef} onMouseUp={handleMouseUp}>
        {/* Keep CodeMirror mounted but hidden when not on content tab to preserve state */}
        <div style={{ display: activeTab === 'content' ? 'block' : 'none', height: '100%' }}>
          <CodeMirror
            ref={cmRef}
            value={content}
            height="100%"
            extensions={[
              markdown(),
              EditorView.lineWrapping,
              annotationsField,
              annotationPlugin,
              annotationTheme,
            ]}
            id='editor_div'
            editable={editable}
            onChange={onChange}
            basicSetup={{
              lineNumbers: true,
              highlightActiveLineGutter: editable,
              highlightActiveLine: editable,
              foldGutter: true,
            }}
            theme="light"
            className="text-base h-full font-monlam-2"
          />
        </div>
        
        {activeTab === 'preview' && (
          /* Preview - Formatted Text Display */
          <FormattedTextDisplay content={content} />
        )}
        
        {activeTab === 'bibliography' && (
          /* Bibliography - Annotations List */
          <div className="h-full overflow-y-auto p-6 bg-gray-50">
            <BibliographyAnnotationsList 
              className="bg-white rounded-lg shadow-sm" 
              editorView={editorView || cmRef.current?.view || null}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default TextEditorView;
