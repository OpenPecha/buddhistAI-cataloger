import { useState, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { EditorView } from '@codemirror/view';
import SelectionMenu from './SelectionMenu';
import FormattedTextDisplay from '../FormattedTextDisplay';

interface TextEditorViewProps {
  content: string;
  filename?: string;
  onChange?: (value: string) => void;
  editable?: boolean;
  onTextSelect?: (text: string, type: 'title' | 'colophon' | 'incipit' | 'person') => void;
}

const TextEditorView = ({ content, filename, onChange, editable = false, onTextSelect }: TextEditorViewProps) => {
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [selectedText, setSelectedText] = useState('');
  const [activeTab, setActiveTab] = useState<'content' | 'preview'>('content');
  const editorRef = useRef<HTMLDivElement>(null);

  const handleMouseUp = (event: React.MouseEvent) => {
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    
    if (text && text.length > 0) {
      // Calculate position relative to the editor container
      if (editorRef.current) {
        const rect = editorRef.current.getBoundingClientRect();
        const menuWidth = 140; // Approximate menu width (compact)
        const menuHeight = 120; // Approximate menu height (compact)
        
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

  const handleMenuSelect = (type: 'title' | 'colophon' | 'incipit' | 'person') => {
    if (selectedText && onTextSelect) {
      onTextSelect(selectedText, type);
    }
    setShowMenu(false);
    setSelectedText('');
  };
  return (
    <div className="h-full flex flex-col" ref={editorRef} onMouseUp={handleMouseUp}>
      {/* Selection Menu */}
      {showMenu && (
        <SelectionMenu
          position={menuPosition}
          onSelect={handleMenuSelect}
          onClose={() => setShowMenu(false)}
        />
      )}
      
      {/* Header */}
      <div className="bg-gray-100 border-b border-gray-300">
        {/* Top Bar - Filename and Info */}
        <div className="px-4 py-2 flex items-center justify-between border-b border-gray-300">
          <div className="flex items-center space-x-2">
            <svg
              className="w-5 h-5 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <span className="text-sm font-medium text-gray-700">
              {filename || 'Document Text'}
            </span>
          </div>
          <div className="flex items-center space-x-3">
            {editable && (
              <span className="text-xs text-blue-600 font-medium">Editable</span>
            )}
            <span className="text-xs text-gray-500">
              {content.length} characters
            </span>
          </div>
        </div>

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
            Content
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'preview'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Preview
          </button>
        </div>
      </div>

      {/* Content Area - Conditional Rendering */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'content' ? (
          /* CodeMirror Editor */
          <CodeMirror
            value={content}
            height="100%"
            extensions={[
              markdown(),
              EditorView.lineWrapping,
            ]}
            editable={editable}
            onChange={onChange}
            basicSetup={{
              lineNumbers: true,
              highlightActiveLineGutter: editable,
              highlightActiveLine: editable,
              foldGutter: true,
            }}
            theme="light"
            className="text-base h-full"
          />
        ) : (
          /* Preview - Formatted Text Display */
          <FormattedTextDisplay content={content} />
        )}
      </div>
    </div>
  );
};

export default TextEditorView;
