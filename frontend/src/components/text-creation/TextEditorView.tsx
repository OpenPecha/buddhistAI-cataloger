import { useState, useRef, useEffect } from 'react';
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { EditorView } from '@codemirror/view';
import SelectionMenu from './SelectionMenu';
import FormattedTextDisplay from '../FormattedTextDisplay';
import { useBibliography } from '@/contexts/BibliographyContext';
import { BibliographyAnnotationsList } from '../BibliographyAnnotationsList';
import { annotationsField, annotationPlugin, annotationTheme, updateAnnotationsEffect } from '@/editor/textAnnotations';
import { useTranslation } from 'react-i18next';

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
  const { t, i18n } = useTranslation();
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [selectedText, setSelectedText] = useState('');
  const [textStart, setTextStart] = useState(0);
  const [textEnd, setTextEnd] = useState(0);
  const [activeTab, setActiveTab] = useState<'content' | 'preview' | 'bibliography'>('content');
  const editorRef = useRef<HTMLDivElement>(null);
  const cmRef = useRef<ReactCodeMirrorRef>(null);
  const { annotations } = useBibliography();

  // Update CodeMirror decorations when annotations change, language changes, or when switching back to content tab
  useEffect(() => {
    if (activeTab === 'content') {
      // Small delay to ensure the editor is fully rendered
      const timeoutId = setTimeout(() => {
        if (cmRef.current?.view) {
          const view = cmRef.current.view;
          view.dispatch({
            effects: updateAnnotationsEffect.of(annotations)
          });
        }
      }, 100);
      
      return () => clearTimeout(timeoutId);
    }
  }, [annotations, activeTab, i18n.language]);

  const handleMouseUp = (event: React.MouseEvent) => {
    // Only show selection menu when in the content (CodeMirror) tab
    if (activeTab !== 'content') {
      return;
    }

    const selection = window.getSelection();
    const text = selection?.toString().trim();
    
    if (text && text.length > 0) {
      // Calculate text position in content
      const range = selection?.getRangeAt(0);
      if (range) {
        // Get the text content before the selection to calculate start position
        const preSelectionRange = range.cloneRange();
        preSelectionRange.selectNodeContents(range.startContainer.parentNode || range.startContainer);
        preSelectionRange.setEnd(range.startContainer, range.startOffset);
        
        // Calculate start position by finding the selected text in the content
        const selectedTextIndex = content.indexOf(text);
        const start = selectedTextIndex >= 0 ? selectedTextIndex : 0;
        const end = start + text.length;
        
        setTextStart(start);
        setTextEnd(end);
      }
      
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
        
        setSelectedText(text);
        setMenuPosition({ x, y });
        setShowMenu(true);
      }
    }
  };

  const handleMenuSelect = (type: 'title' | 'alt_title' | 'colophon' | 'incipit' | 'alt_incipit' | 'person') => {
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
            {annotations.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                {annotations.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Content Area - Conditional Rendering */}
      <div className="flex-1 overflow-hidden" ref={editorRef} onMouseUp={handleMouseUp}>
        {activeTab === 'content' ? (
          /* CodeMirror Editor */
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
        ) : activeTab === 'preview' ? (
          /* Preview - Formatted Text Display */
          <FormattedTextDisplay content={content} />
        ) : (
          /* Bibliography - Annotations List */
          <div className="h-full overflow-y-auto p-6 bg-gray-50">
            <BibliographyAnnotationsList className="bg-white rounded-lg shadow-sm" />
          </div>
        )}
      </div>
    </div>
  );
};

export default TextEditorView;
