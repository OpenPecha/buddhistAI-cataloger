# Outliner Feature Documentation

## Overview

The Outliner is a comprehensive document annotation and segmentation system designed for organizing, annotating, and managing text documents. It allows users to upload documents, split them into segments, annotate segments with titles and authors, add comments, and track progress through various status states.

## Architecture

### Backend Architecture

#### Models (`backend/models/outliner.py`)

**OutlinerDocument**
- Stores full text content and metadata for documents
- Fields:
  - `id`: Unique identifier (UUID)
  - `content`: Full text content (Text field)
  - `filename`: Original filename if uploaded
  - `user_id`: Owner of the document
  - `order`: Display order
  - `category`: Document category (default: 'uncategorized')
  - `total_segments`: Total number of segments
  - `annotated_segments`: Number of segments with title/author annotations
  - `progress_percentage`: Completion percentage (0-100)
  - `status`: Document status (active, completed, deleted, approved, rejected)
  - `created_at`, `updated_at`: Timestamps
- Relationships: One-to-many with `OutlinerSegment`

**OutlinerSegment**
- Stores individual text segments with annotations
- Fields:
  - `id`: Unique identifier (UUID)
  - `document_id`: Foreign key to OutlinerDocument
  - `text`: Segment text content
  - `segment_index`: Order in document
  - `span_start`, `span_end`: Character positions in full document
  - `title`: Annotated title
  - `author`: Annotated author
  - `title_bdrc_id`: BDRC ID for title
  - `author_bdrc_id`: BDRC ID for author
  - `parent_segment_id`: Parent segment for hierarchical structure
  - `status`: Segment status (checked, unchecked, approved)
  - `is_annotated`: Boolean flag indicating if segment has title/author
  - `is_attached`: Boolean flag for attachment to parent
  - `comment`: JSON field storing array of comments
  - `created_at`, `updated_at`: Timestamps
- Indexes: Optimized for document_id + segment_index and span queries

#### Controllers (`backend/controller/outliner.py`)

Business logic layer handling:
- Document CRUD operations
- Segment CRUD operations
- Bulk operations (create, update, delete multiple segments)
- Segment splitting and merging
- Comment management
- Progress tracking with incremental updates
- Status management

**Key Functions:**
- `create_document()`: Create new document with content
- `upload_document()`: Upload file or text content
- `list_documents()`: List documents with filtering and pagination
- `get_document()`: Get document with segments (uses caching)
- `update_document_content()`: Update full text content
- `delete_document()`: Delete document and all segments
- `update_document_status()`: Update document status with ownership validation
- `create_segment()`: Create single segment
- `create_segments_bulk()`: Create multiple segments
- `update_segment()`: Update segment (performance optimized)
- `split_segment()`: Split segment at position
- `merge_segments()`: Merge multiple segments
- `bulk_segment_operations()`: Batch operations in single transaction
- Comment CRUD operations

#### Routers (`backend/routers/outliner.py`)

FastAPI endpoints organized by resource:

**Document Endpoints:**
- `POST /outliner/documents` - Create document
- `POST /outliner/documents/upload` - Upload file or text
- `GET /outliner/documents` - List documents (with pagination, filtering)
- `GET /outliner/documents/{document_id}` - Get document with segments
- `PUT /outliner/documents/{document_id}/content` - Update content
- `DELETE /outliner/documents/{document_id}` - Delete document
- `PUT /outliner/documents/{document_id}/status` - Update status
- `GET /outliner/documents/{document_id}/progress` - Get progress stats
- `DELETE /outliner/documents/{document_id}/segments/reset` - Reset all segments

**Segment Endpoints:**
- `POST /outliner/documents/{document_id}/segments` - Create segment
- `POST /outliner/documents/{document_id}/segments/bulk` - Create multiple segments
- `GET /outliner/documents/{document_id}/segments` - List segments
- `GET /outliner/segments/{segment_id}` - Get single segment
- `PUT /outliner/segments/{segment_id}` - Update segment
- `PUT /outliner/segments/bulk` - Update multiple segments
- `POST /outliner/segments/{segment_id}/split` - Split segment
- `POST /outliner/segments/merge` - Merge segments
- `DELETE /outliner/segments/{segment_id}` - Delete segment
- `PUT /outliner/segments/{segment_id}/status` - Update segment status
- `POST /outliner/documents/{document_id}/segments/bulk-operations` - Bulk operations

**Comment Endpoints:**
- `GET /outliner/segments/{segment_id}/comment` - Get comments
- `POST /outliner/segments/{segment_id}/comment` - Add comment
- `PUT /outliner/segments/{segment_id}/comment/{comment_index}` - Update comment
- `DELETE /outliner/segments/{segment_id}/comment/{comment_index}` - Delete comment

#### Utilities (`backend/utils/outliner_utils.py`)

Helper functions for:
- **Caching**: Redis-based document content caching
  - `get_document_with_cache()`: Get document with cache lookup
  - `set_document_content_in_cache()`: Cache document content
  - `invalidate_document_content_cache()`: Clear cache
- **Progress Tracking**:
  - `update_document_progress()`: Full recalculation (deprecated)
  - `incremental_update_document_progress()`: Optimized incremental updates
  - `get_annotation_status_delta()`: Calculate annotation change delta
- **Text Processing**:
  - `remove_escape_chars_except_newline()`: Clean text content
- **Comments**:
  - `get_comments_list()`: Extract comments from JSON field

### Frontend Architecture

#### Components (`frontend/src/components/outliner/`)

**Core Components:**
- `Workspace.tsx`: Main workspace component with virtualized segment list
- `WorkspaceHeader.tsx`: Header with progress, segment count, AI actions
- `SegmentItem.tsx`: Individual segment display component
- `ContentDisplay.tsx`: Text content display area
- `SegmentTextContent.tsx`: Editable segment text content
- `AnnotationSidebar.tsx`: Sidebar for editing segment annotations
- `OutlinerFileUploadZone.tsx`: File upload component

**Annotation Components:**
- `TitleField.tsx`: Title input field with BDRC integration
- `AuthorField.tsx`: Author input field with BDRC integration
- `AISuggestionsBox.tsx`: AI-powered title/author suggestions

**Comment Components:**
- `comment/CommentView.tsx`: Display comments
- `comment/Comment.tsx`: Individual comment component
- `comment/CommentForm.tsx`: Comment input form

**UI Components:**
- `BubbleMenu.tsx`: Context menu for text selection
- `SplitMenu.tsx`: Menu for splitting segments
- `ExpandAllButton.tsx`: Expand/collapse all segments

**Context Providers:**
- `OutlinerContext.tsx`: Main context provider
- `contexts/DocumentContext.tsx`: Document state management
- `contexts/SelectionContext.tsx`: Text selection handling
- `contexts/CursorContext.tsx`: Cursor position tracking
- `contexts/ActionsContext.tsx`: Action handlers

#### Hooks (`frontend/src/hooks/`)

- `useOutlinerDocument.ts`: Main hook for document operations
  - Document loading, uploading, creating
  - Segment CRUD operations
  - Bulk operations
  - Optimistic updates
  - Query invalidation
- `useOutlinerData.ts`: Data fetching utilities
- `useDocumentActions.ts`: Document action handlers
- `useSegmentActions.ts`: Segment action handlers

#### API Client (`frontend/src/api/outliner.ts`)

Type-safe API client with:
- TypeScript interfaces for all data structures
- Helper functions for API calls
- Error handling
- Response parsing
- Utility functions for data transformation

## Key Features

### 1. Document Management

**Upload & Creation:**
- Upload text files (.txt, etc.)
- Create documents from direct text input
- Support for large documents
- Automatic content caching for performance

**Document Operations:**
- List documents with pagination
- Filter by user ID
- Filter by deletion status
- Update document content
- Delete documents (cascades to segments)
- Status management (active, completed, deleted, approved, rejected)
- Document restoration (with ownership validation)

**Progress Tracking:**
- Total segments count
- Annotated segments count
- Progress percentage calculation
- Checked/unchecked segments tracking
- Real-time progress updates

### 2. Segment Management

**Segment Creation:**
- Manual segment creation with span addresses
- Bulk segment creation
- Automatic text extraction from document using span addresses
- Segment indexing for ordering

**Segment Operations:**
- Update segment text, title, author
- Bulk update multiple segments
- Split segments at cursor position
- Merge multiple segments
- Delete segments with automatic index reordering
- Attach segments to parent segments (hierarchical structure)

**Segment Status:**
- Checked/unchecked status
- Approved status
- Status filtering and counting
- Visual indicators in UI

### 3. Annotation Features

**Title & Author Annotation:**
- Title field with BDRC ID support
- Author field with BDRC ID support
- Annotation status tracking (`is_annotated` flag)
- Automatic progress calculation based on annotations

**BDRC Integration:**
- `title_bdrc_id`: Link to BDRC title database
- `author_bdrc_id`: Link to BDRC author database
- Support for external reference IDs

**AI-Powered Suggestions:**
- AI-generated title suggestions
- AI-generated author suggestions
- Integration with AI endpoints for content analysis

### 4. Comment System

**Comment Features:**
- Multiple comments per segment
- Comment metadata (content, username, timestamp)
- Add, update, delete comments
- Comment indexing for updates/deletes
- JSON storage format (array of comment objects)

**Comment Operations:**
- Add comment with username
- Update comment by index
- Delete comment by index
- List all comments for segment

### 5. Text Selection & Editing

**Selection Features:**
- Click-to-select text in document
- Visual selection highlighting
- Cursor position tracking
- Bubble menu for quick actions
- Split menu for segment splitting

**Editing Features:**
- Inline text editing
- Preserve whitespace and newlines
- Span address management
- Real-time updates

### 6. Bulk Operations

**Bulk Segment Operations:**
- Create multiple segments in single transaction
- Update multiple segments atomically
- Delete multiple segments with index reordering
- Combined operations (create + update + delete)
- Optimized for performance

**Benefits:**
- Reduced API calls
- Atomic transactions
- Better performance for large operations
- Consistent state management

### 7. Performance Optimizations

**Backend Optimizations:**
- **Redis Caching**: Document content cached in Redis
  - Reduces database load
  - Faster document retrieval
  - Cache invalidation on updates
- **Incremental Progress Updates**: 
  - Avoids expensive COUNT queries
  - Updates progress counters atomically
  - Tracks annotation status deltas
- **Optimized Queries**:
  - Selective field loading for segments
  - Indexed queries for document_id + segment_index
  - Span-based indexing for text position queries
- **Bulk Operations**: Single transaction for multiple operations

**Frontend Optimizations:**
- **Virtualization**: React-window for large segment lists
- **Optimistic Updates**: Immediate UI feedback
- **Query Caching**: React Query for data caching
- **Debounced Updates**: Reduced API calls
- **Selective Re-rendering**: Memoized components

### 8. Status Management

**Document Status:**
- `active`: Document is being worked on
- `completed`: Document work is finished
- `deleted`: Document is soft-deleted
- `approved`: Document is approved
- `rejected`: Document is rejected

**Segment Status:**
- `checked`: Segment is verified/checked
- `unchecked`: Segment is not yet checked
- `approved`: Segment is approved

**Status Features:**
- Status filtering in document list
- Status-based progress tracking
- Ownership validation for restoration
- Status change history (via timestamps)

### 9. Hierarchical Structure

**Parent-Child Relationships:**
- Segments can have parent segments
- `parent_segment_id` foreign key
- `is_attached` flag for attachment status
- Support for nested segment structures
- Tree-like organization

### 10. AI Integration

**AI Features:**
- **Text Ending Detection**: AI-powered automatic segment splitting
  - Detects natural text endings
  - Creates segments automatically
  - Can be stopped/cancelled
  - Undo support
- **Title/Author Generation**: AI suggestions for annotations
  - Context-aware suggestions
  - Integration with AI endpoints
  - Loading states and error handling

## Database Schema

### Migration History

Key migrations:
- `e0f2ace4a63b_add_outline.py`: Initial outline tables
- `55df6f2a3a0b_add_comment_as_json.py`: JSON comment support
- `9164e64b8695_add_is_annotated.py`: Annotation status flag
- `23264f32c6b1_add_is_category_and_order.py`: Category and ordering
- `d86ee901fac7_default_status_to_active.py`: Status defaults

### Tables

**outliner_documents:**
```sql
- id (PK, UUID)
- content (TEXT)
- filename (VARCHAR, nullable)
- user_id (VARCHAR, FK to users.id, nullable)
- order (INTEGER, nullable)
- category (VARCHAR, nullable, default: 'uncategorized')
- total_segments (INTEGER, default: 0)
- annotated_segments (INTEGER, default: 0)
- progress_percentage (FLOAT, default: 0.0)
- status (VARCHAR, nullable, default: 'active')
- created_at (DATETIME)
- updated_at (DATETIME)
```

**outliner_segments:**
```sql
- id (PK, UUID)
- document_id (FK to outliner_documents.id, CASCADE delete)
- text (TEXT)
- segment_index (INTEGER)
- span_start (INTEGER)
- span_end (INTEGER)
- title (VARCHAR, nullable)
- author (VARCHAR, nullable)
- title_bdrc_id (VARCHAR, nullable)
- author_bdrc_id (VARCHAR, nullable)
- parent_segment_id (FK to outliner_segments.id, SET NULL)
- status (VARCHAR, nullable)
- is_annotated (BOOLEAN, default: False)
- is_attached (BOOLEAN, nullable)
- comment (JSON, nullable)
- created_at (DATETIME)
- updated_at (DATETIME)

Indexes:
- ix_outliner_segments_document_index (document_id, segment_index)
- ix_outliner_segments_span (document_id, span_start, span_end)
```

## API Endpoints Summary

### Document Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/outliner/documents` | Create document |
| POST | `/outliner/documents/upload` | Upload file/text |
| GET | `/outliner/documents` | List documents |
| GET | `/outliner/documents/{id}` | Get document |
| PUT | `/outliner/documents/{id}/content` | Update content |
| DELETE | `/outliner/documents/{id}` | Delete document |
| PUT | `/outliner/documents/{id}/status` | Update status |
| GET | `/outliner/documents/{id}/progress` | Get progress |
| DELETE | `/outliner/documents/{id}/segments/reset` | Reset segments |

### Segment Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/outliner/documents/{id}/segments` | Create segment |
| POST | `/outliner/documents/{id}/segments/bulk` | Create multiple |
| GET | `/outliner/documents/{id}/segments` | List segments |
| GET | `/outliner/segments/{id}` | Get segment |
| PUT | `/outliner/segments/{id}` | Update segment |
| PUT | `/outliner/segments/bulk` | Update multiple |
| POST | `/outliner/segments/{id}/split` | Split segment |
| POST | `/outliner/segments/merge` | Merge segments |
| DELETE | `/outliner/segments/{id}` | Delete segment |
| PUT | `/outliner/segments/{id}/status` | Update status |
| POST | `/outliner/documents/{id}/segments/bulk-operations` | Bulk ops |

### Comment Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/outliner/segments/{id}/comment` | Get comments |
| POST | `/outliner/segments/{id}/comment` | Add comment |
| PUT | `/outliner/segments/{id}/comment/{index}` | Update comment |
| DELETE | `/outliner/segments/{id}/comment/{index}` | Delete comment |

## UI Features

### Workspace Interface

**Main Workspace:**
- Virtualized segment list for performance
- Click-to-select text
- Visual segment highlighting
- Active segment indication
- Scroll position preservation

**Workspace Header:**
- Segment count display
- Progress bar (checked segments percentage)
- AI text ending detection button
- Reset segments button
- Undo AI detection button

**Annotation Sidebar:**
- Title field with BDRC integration
- Author field with BDRC integration
- AI suggestions box
- Save/Reset buttons
- Comments section
- Segment preview

**Segment Display:**
- Editable text content
- Status indicators (checked/unchecked)
- Expand/collapse functionality
- Split/merge controls
- Comment indicators

### File Upload

**Upload Methods:**
- Drag-and-drop file upload
- Click to browse files
- Direct text input
- File validation
- Loading states

### Document List

**Features:**
- Pagination support
- User filtering
- Deleted documents toggle
- Progress indicators
- Status badges
- Last updated timestamps
- Quick navigation to documents

## Data Flow

### Document Loading Flow
1. User navigates to document
2. Frontend calls `GET /outliner/documents/{id}`
3. Backend checks Redis cache for content
4. If cached, fetch metadata from DB and use cached content
5. If not cached, fetch from DB and cache content
6. Load segments with selective fields
7. Return document with segments
8. Frontend renders in Workspace component

### Segment Update Flow
1. User edits segment annotation
2. Frontend calls `PUT /outliner/segments/{id}`
3. Backend performs incremental progress update
4. Update segment in database
5. Return updated segment
6. Frontend updates UI optimistically
7. Invalidate queries for fresh data

### Bulk Operations Flow
1. User performs bulk action (e.g., split multiple segments)
2. Frontend prepares bulk operation request
3. Call `POST /outliner/documents/{id}/segments/bulk-operations`
4. Backend processes in single transaction:
   - Process deletions (with index reordering)
   - Process updates
   - Process creates
   - Update document progress
5. Commit transaction
6. Return updated segments
7. Frontend updates UI

## Error Handling

**Backend:**
- HTTPException for API errors
- Validation errors with detailed messages
- 404 for not found resources
- 400 for invalid requests
- 403 for authorization failures
- Database transaction rollback on errors

**Frontend:**
- Try-catch blocks for API calls
- Toast notifications for errors
- Loading states for async operations
- Error boundaries for component errors
- Graceful degradation

## Security Features

- User ownership validation
- Document restoration requires ownership verification
- Input validation and sanitization
- SQL injection prevention (SQLAlchemy ORM)
- XSS prevention (React escaping)
- CORS configuration
- Authentication integration (user_id tracking)

## Future Enhancements

Potential improvements:
- Real-time collaboration
- Version history
- Export functionality
- Advanced search
- Batch import/export
- Custom annotation fields
- Workflow management
- Review/approval workflows
- Analytics and reporting

## Dependencies

**Backend:**
- FastAPI: Web framework
- SQLAlchemy: ORM
- Redis: Caching
- Alembic: Database migrations
- Pydantic: Data validation

**Frontend:**
- React: UI framework
- React Router: Navigation
- React Query: Data fetching and caching
- React Window: Virtualization
- Tailwind CSS: Styling
- Sonner: Toast notifications

## Performance Considerations

- Redis caching reduces database queries
- Incremental progress updates avoid COUNT queries
- Virtualized lists handle large segment counts
- Bulk operations reduce API round trips
- Optimistic updates improve perceived performance
- Selective field loading reduces data transfer
- Indexed database queries for fast lookups
