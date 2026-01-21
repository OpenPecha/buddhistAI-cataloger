interface CommentInputProps {
  value: string;
  onChange: (value: string) => void;
  isPending: boolean;
  isSaved: boolean;
}

function CommentInput({ value, onChange, isPending, isSaved }: CommentInputProps) {
  return (
    <div className="relative">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`text-sm border rounded px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          isPending
            ? 'border-yellow-400 bg-yellow-50'
            : isSaved
            ? 'border-green-400 bg-green-50'
            : 'border-gray-300'
        }`}
        placeholder="Add comment"
        rows={2}
      />
      {isPending && (
        <div className="absolute top-1 right-1">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-3 w-3 border border-yellow-500 border-t-transparent"></div>
            <span className="text-xs text-yellow-600 ml-1">Saving...</span>
          </div>
        </div>
      )}
      {isSaved && !isPending && (
        <div className="absolute top-1 right-1">
          <div className="flex items-center">
            <div className="text-xs text-green-600 ml-1">✓ Saved</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CommentInput;