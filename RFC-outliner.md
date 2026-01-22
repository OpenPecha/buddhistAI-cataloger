# RFC: Outliner Application Section

**Status:** Active  
**Version:** 1.0  
**Date:** 2025-01-21  
**Author:** Development Team

---

## Table of Contents

1. [Overview](#overview)
2. [Goals and Non-Goals](#goals-and-non-goals)
3. [Architecture](#architecture)
4. [Data Model](#data-model)
5. [Core Features](#core-features)
6. [API Specification](#api-specification)
7. [Frontend Architecture](#frontend-architecture)
8. [User Interactions](#user-interactions)
9. [AI Integration](#ai-integration)
10. [State Management](#state-management)
11. [Performance Considerations](#performance-considerations)
12. [Future Enhancements](#future-enhancements)

---

## Overview

The Outliner application is a specialized text segmentation and annotation tool designed for scholarly work with Tibetan texts. It enables users to:

- Upload and manage text documents
- Automatically or manually segment documents into discrete text units
- Annotate segments with metadata (title, author, BDRC IDs)
- Organize and navigate through segmented content
- Track annotation progress

The application serves as a critical component for cataloging and organizing textual materials, particularly in academic and research contexts.

---

## Goals and Non-Goals

### Goals

1. **Text Segmentation**: Provide both AI-powered and manual segmentation capabilities
2. **Annotation Management**: Enable efficient annotation of segments with metadata
3. **Progress Tracking**: Track annotation progress at both document and segment levels
4. **User Experience**: Provide an intuitive interface for navigating and editing segments
5. **Data Persistence**: Maintain document and segment state in a relational database
6. **Performance**: Handle large documents efficiently with virtualized rendering

### Non-Goals

1. **Text Editing**: The application does not support direct text editing within segments
2. **Version Control**: No built-in versioning or history tracking
3. **Collaboration**: No real-time collaborative editing features
4. **Export Formats**: Export functionality is not part of this RFC (may be added later)

---

## Architecture

### System Overview

The Outliner application follows a client-server architecture:

```
┌─────────────────┐         ┌──────────────────┐         ┌──────────────┐
│   Frontend      │◄───────►│   Backend API    │◄───────►│  Database    │
│   (React)       │  HTTP   │   (FastAPI)      │  SQL    │  (PostgreSQL)│
└─────────────────┘         └──────────────────┘         └──────────────┘
       │                              │
       │                              │
       ▼                              ▼
┌─────────────────┐         ┌──────────────────┐
│  React Query    │         │   AI Service     │
│  (State Mgmt)   │         │   (Gemini API)   │
└─────────────────┘         └──────────────────┘
```

### Technology Stack

**Frontend:**
- React 18+ with TypeScript
- React Router for navigation
- React Query (TanStack Query) for server state management
- Tailwind CSS for styling
- Radix UI / Shadcn UI components

**Backend:**
- FastAPI (Python)
- SQLAlchemy ORM
- PostgreSQL database
- Google Gemini API for AI features

---

## Data Model

### Database Schema

#### `outliner_documents` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | String (UUID) | Primary key |
| `content` | Text | Full text content of the document |
| `filename` | String (nullable) | Original filename if uploaded |
| `user_id` | String (nullable) | Foreign key to users table |
| `order` | Integer | Display order |
| `category` | String (nullable) | Document category |
| `total_segments` | Integer | Total number of segments |
| `annotated_segments` | Integer | Count of annotated segments |
| `progress_percentage` | Float | Progress (0-100) |
| `status` | String (nullable) | Document status (active, completed, deleted, approved, rejected) |
| `created_at` | DateTime | Creation timestamp |
| `updated_at` | DateTime | Last update timestamp |

#### `outliner_segments` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | String (UUID) | Primary key |
| `document_id` | String | Foreign key to outliner_documents |
| `text` | Text | Segment text content |
| `segment_index` | Integer | Order within document |
| `span_start` | Integer | Start character position in document |
| `span_end` | Integer | End character position in document |
| `title` | String (nullable) | Segment title |
| `author` | String (nullable) | Segment author |
| `title_bdrc_id` | String (nullable) | BDRC ID for title |
| `author_bdrc_id` | String (nullable) | BDRC ID for author |
| `parent_segment_id` | String (nullable) | Foreign key to parent segment |
| `is_annotated` | Boolean | Whether segment has annotations |
| `is_attached` | Boolean (nullable) | Whether attached to parent |
| `status` | String (nullable) | Segment status (checked, unchecked) |
| `comment` | String (nullable) | User comment |
| `created_at` | DateTime | Creation timestamp |
| `updated_at` | DateTime | Last update timestamp |

### Relationships

- One `OutlinerDocument` has many `OutlinerSegment` (one-to-many)
- One `OutlinerSegment` can have one parent `OutlinerSegment` (self-referential, optional)
- One `OutlinerDocument` belongs to one `User` (optional, nullable)

### Indexes

- `ix_outliner_segments_document_index`: Composite index on `(document_id, segment_index)`
- `ix_outliner_segments_span`: Composite index on `(document_id, span_start, span_end)`
- Index on `document_id` in segments table
- Index on `user_id` in documents table

---

## Core Features

### 1. Document Management

#### Upload
- **File Upload**: Users can upload text files via drag-and-drop or file picker
- **Text Input**: Users can paste or type text directly
- **Backend Storage**: Documents are stored in the database with full text content

#### Document List
- View all documents with metadata (filename, progress, status)
- Filter by user, status, category
- Pagination support

#### Document Operations
- View document details
- Update document content
- Delete documents
- Update document status

### 2. Segmentation

#### Manual Segmentation
- **Split at Cursor**: Users can place cursor and split segment
- **Merge Segments**: Merge a segment with its previous segment
- **Bulk Operations**: Create multiple segments at once

#### AI-Powered Segmentation
- **Text Ending Detection**: Uses Google Gemini API to detect text boundaries
- **Rule-Based Detection**: Falls back to regex patterns for common markers
- **Active Segment Detection**: Can detect endings for a specific segment or entire document

#### Segmentation Features
- Preserves whitespace and newlines exactly
- Maintains span addresses (start/end positions) in original document
- Updates segment indices automatically
- Tracks segment count and progress

### 3. Annotation

#### Segment Metadata
- **Title**: Text title for the segment
- **Author**: Author name
- **BDRC IDs**: External identifiers for title and author
- **Parent Segment**: Link to parent segment (hierarchical structure)
- **Status**: Checked/unchecked status
- **Comment**: User comments

#### Annotation Sidebar
- Displays active segment details
- Editable fields for title, author, BDRC IDs
- AI suggestions for title/author generation
- Status toggle (checked/unchecked)
- Attach parent functionality

#### Bubble Menu
- Appears on text selection
- Quick actions: Set as Title, Set as Author
- Automatically activates segment and populates sidebar

### 4. Navigation

#### Segment Navigation
- Click segment to activate
- URL-based active segment (`?segmentId=xxx`)
- Collapse/expand segments
- Collapse all / expand all

#### Workspace Features
- Virtual scrolling for large segment lists (prepared but not active)
- Scroll position preservation during splits
- Active segment highlighting
- Loading states per segment

### 5. Progress Tracking

#### Document-Level Progress
- Total segments count
- Annotated segments count
- Progress percentage (0-100)
- Status tracking

#### Segment-Level Progress
- Individual segment annotation status
- Checked/unchecked status
- Loading states during operations

---

## API Specification

### Base URL
```
/api/outliner
```

### Document Endpoints

#### Create Document
```
POST /documents
Body: {
  content: string
  filename?: string
  user_id?: string
}
Response: OutlinerDocument
```

#### Upload Document
```
POST /documents/upload
Body: FormData {
  file: File
  user_id?: string
}
Response: OutlinerDocument
```

#### Get Document
```
GET /documents/{document_id}?include_segments=true
Response: OutlinerDocument
```

#### List Documents
```
GET /documents?user_id={user_id}&skip=0&limit=100&include_deleted=false
Response: OutlinerDocumentListItem[]
```

#### Update Document Content
```
PUT /documents/{document_id}/content
Body: { content: string }
Response: { message: string, document_id: string }
```

#### Update Document Status
```
PUT /documents/{document_id}/status?user_id={user_id}
Body: { status: string }
Response: { message: string, document_id: string, status: string }
```

#### Delete Document
```
DELETE /documents/{document_id}
Response: void
```

#### Get Document Progress
```
GET /documents/{document_id}/progress
Response: DocumentProgress
```

### Segment Endpoints

#### Create Segment
```
POST /documents/{document_id}/segments
Body: SegmentCreateRequest
Response: OutlinerSegment
```

#### Create Segments (Bulk)
```
POST /documents/{document_id}/segments/bulk
Body: SegmentCreateRequest[]
Response: OutlinerSegment[]
```

#### Get Segments
```
GET /documents/{document_id}/segments
Response: OutlinerSegment[]
```

#### Get Segment
```
GET /segments/{segment_id}
Response: OutlinerSegment
```

#### Update Segment
```
PUT /segments/{segment_id}
Body: SegmentUpdateRequest
Response: OutlinerSegment
```

#### Update Segments (Bulk)
```
PUT /segments/bulk
Body: {
  segments: SegmentUpdateRequest[]
  segment_ids: string[]
}
Response: OutlinerSegment[]
```

#### Split Segment
```
POST /segments/{segment_id}/split
Body: {
  segment_id: string
  split_position: number
  document_id?: string
}
Response: OutlinerSegment[]
```

#### Merge Segments
```
POST /segments/merge
Body: { segment_ids: string[] }
Response: OutlinerSegment
```

#### Update Segment Status
```
PUT /segments/{segment_id}/status
Body: { status: 'checked' | 'unchecked' }
Response: { message: string, segment_id: string, status: string }
```

#### Delete Segment
```
DELETE /segments/{segment_id}
Response: void
```

#### Bulk Segment Operations
```
POST /documents/{document_id}/segments/bulk-operations
Body: {
  create?: SegmentCreateRequest[]
  update?: Array<{ id: string } & Partial<SegmentUpdateRequest>>
  delete?: string[]
}
Response: OutlinerSegment[]
```

#### Reset Segments
```
DELETE /documents/{document_id}/segments/reset
Response: void
```

### AI Endpoints

#### Detect Text Endings
```
POST /ai/detect-text-endings
Body: {
  document_id: string
  content: string
}
Response: {
  starting_positions: number[]
  total_segments: number
}
```

#### Generate Title/Author
```
POST /ai/generate-title-author
Body: {
  content: string
  document_id: string
}
Response: {
  title?: string
  suggested_title?: string
  author?: string
  suggested_author?: string
}
```

---

## Frontend Architecture

### Component Hierarchy

```
OutlinerWorkspace (Page Component)
├── OutlinerProvider (Context)
│   ├── AnnotationSidebar
│   │   ├── TitleField
│   │   ├── AuthorField
│   │   └── AISuggestionsBox
│   └── Workspace
│       ├── WorkspaceHeader
│       ├── ContentDisplay (when no segments)
│       └── SegmentItem[] (when segments exist)
│           ├── SegmentTextContent
│           ├── BubbleMenu (on text selection)
│           └── SplitMenu (on cursor position)
```

### Key Components

#### `OutlinerWorkspace`
- Main page component
- Manages URL state (active segment)
- Coordinates between sidebar and workspace
- Handles document loading and error states

#### `OutlinerProvider`
- React Context provider
- Centralizes state and handlers
- Provides data to child components

#### `Workspace`
- Main content area
- Renders segments or full text
- Handles scroll position
- Manages collapse/expand state

#### `AnnotationSidebar`
- Right-side panel
- Displays active segment details
- Editable annotation fields
- AI suggestions integration

#### `SegmentItem`
- Individual segment display
- Handles click events
- Shows collapse/expand controls
- Displays segment metadata

#### `BubbleMenu`
- Context menu on text selection
- Quick actions (Set Title, Set Author)
- Positioned relative to selection

#### `SplitMenu`
- Context menu on cursor position
- Split segment action
- Positioned relative to cursor

### Hooks

#### `useOutlinerDocument`
- Manages document state and operations
- React Query integration
- Optimistic updates for splits
- Loading state tracking per segment

#### `useAITextEndings`
- AI text ending detection
- Abort controller support
- Error handling

### State Management

#### Server State (React Query)
- Document data
- Segments data
- Query invalidation on mutations
- Optimistic updates for splits

#### Client State (React State)
- Active segment ID (URL-based)
- Bubble menu state
- Cursor position
- Collapse/expand state
- Loading states per segment

#### Context State
- Shared state via `OutlinerContext`
- Handlers for user interactions
- Derived state (active segment, etc.)

---

## User Interactions

### Text Selection Flow

1. User selects text in a segment
2. `handleTextSelection` detects selection
3. Calculates menu position relative to segment container
4. Shows `BubbleMenu` with "Set as Title" / "Set as Author"
5. User clicks action
6. Segment becomes active (URL updates)
7. Sidebar populates with selected text
8. User can edit or confirm

### Cursor Position Flow

1. User places cursor in segment text
2. `handleCursorChange` detects cursor position
3. Calculates character offset
4. Shows `SplitMenu` at cursor position
5. User clicks "Split Here"
6. Segment splits at cursor position
7. New segments created in backend
8. UI updates with optimistic update
9. First new segment becomes active

### Segment Activation Flow

1. User clicks segment
2. `handleSegmentClick` updates URL with `segmentId`
3. `useSearchParams` updates active segment
4. Sidebar updates to show active segment
5. Workspace scrolls to active segment (if needed)
6. Collapse state updates (active segment expands)

### Split Operation Flow

1. User places cursor and clicks split
2. `handleSplitSegment` called
3. If no segments exist:
   - Creates two segments from full text
   - Uses bulk create endpoint
4. If segment exists:
   - Calls split endpoint with segment ID and offset
   - Backend creates two segments
   - Updates span addresses
   - Recalculates segment indices
5. Optimistic update shows split immediately
6. Backend confirms with actual data
7. Query invalidation refetches document

### Merge Operation Flow

1. User clicks merge button on segment
2. `handleMergeWithPrevious` called
3. Validates segment is not first
4. Calls merge endpoint with segment IDs
5. Backend merges text and metadata
6. Updates span addresses
7. Recalculates segment indices
8. Query invalidation updates UI

### AI Detection Flow

1. User clicks "AI Detect Text Endings"
2. `handleAIDetectTextEndings` called
3. Determines content (active segment or full document)
4. Calls AI endpoint with content
5. Shows loading state
6. Backend:
   - Tries rule-based detection first
   - Falls back to Gemini API if needed
   - Creates segments in database
7. Returns starting positions
8. Query invalidation refetches document
9. Segments appear in UI

---

## AI Integration

### Text Ending Detection

#### Rule-Based Detection
The system first attempts rule-based detection using regex patterns:

- Tibetan markers: `༄༅༅། །`, `༄༅༅`
- Chinese chapter markers: `第[一二三四五六七八九十百千万]+[章节卷篇回]`
- English chapter markers: `Chapter \d+`, `Section \d+`
- Sanskrit/Tibetan boundaries: `\n\s*[ༀ-༿]+\s*\n`

If patterns are found, segments are created immediately without AI.

#### AI-Based Detection
If no patterns are found, the system uses Google Gemini API:

- **Model**: `gemini-2.5-flash-lite`
- **Prompt**: Expert Tibetan text scholar prompt
- **Task**: Identify boundaries where completely different texts begin
- **Output**: JSON with `starting_positions` array
- **Validation**: Ensures positions are valid, includes 0, sorted

#### Segment Creation
After detection (rule-based or AI):
- Creates segment records in database
- Extracts text using span addresses
- Updates document statistics
- Returns starting positions to frontend

### Title/Author Generation

#### Endpoint
```
POST /ai/generate-title-author
```

#### Process
1. Sends segment content to Gemini API
2. Model analyzes text for:
   - Explicitly mentioned title/author
   - Suggested title/author based on content
3. Returns four fields:
   - `title`: Extracted title (if found)
   - `suggested_title`: Suggested title (if not found)
   - `author`: Extracted author (if found)
   - `suggested_author`: Suggested author (if not found)
4. All responses in same language as content

#### Usage
- Triggered from annotation sidebar
- Shows suggestions in `AISuggestionsBox`
- User can accept or modify suggestions

---

## State Management

### React Query Configuration

#### Document Query
```typescript
queryKey: ['outliner-document', documentId]
staleTime: 0 // Always refetch
refetchInterval: false
refetchOnWindowFocus: false
```

#### Mutations
- **Update Segment**: No optimistic updates, invalidate on success
- **Split Segment**: Optimistic update with rollback on error
- **Merge Segments**: Invalidate on success
- **Bulk Operations**: Invalidate on success
- **Create Segments**: Optimistic update with temporary IDs

### Loading States

#### Per-Segment Loading
- Tracked in `Map<string, boolean>`
- Set during mutation `onMutate`
- Cleared on success/error
- Used to show loading indicators

#### Document Loading
- `isLoadingDocument`: Initial load or upload
- `isSaving`: Any save operation in progress

### Optimistic Updates

#### Split Segment
1. Cancel outgoing queries
2. Snapshot previous document
3. Create optimistic segments (temporary IDs)
4. Update query cache
5. On success: Invalidate and refetch
6. On error: Rollback to snapshot

#### Create Segments Bulk
1. Cancel outgoing queries
2. Snapshot previous document
3. Create optimistic segments with temporary IDs
4. Update query cache
5. On success: Invalidate (server IDs replace temp IDs)
6. On error: Rollback to snapshot

### Error Handling

#### API Errors
- Caught in mutation `onError`
- Toast notification shown
- State rolled back if optimistic update
- User-friendly error messages

#### Network Errors
- AbortController for cancellable requests
- Graceful degradation
- Retry logic (via React Query)

---

## Performance Considerations

### Virtualization

#### Prepared but Not Active
- `react-window` integration prepared
- Currently using direct rendering
- Can enable for >100 segments if needed

#### Current Approach
- Direct rendering for all segments
- Acceptable for moderate document sizes
- Collapse/expand reduces visible segments

### Scroll Position Management

#### During Splits
- Save scroll position before split
- Restore after DOM updates
- Uses `requestAnimationFrame` for timing
- Debounced restoration

### Query Optimization

#### Selective Refetching
- Invalidate only affected queries
- Use `queryKey` scoping
- Avoid unnecessary refetches

#### Bulk Operations
- Use bulk endpoints when possible
- Reduce number of API calls
- Batch updates

### Database Optimization

#### Indexes
- Composite indexes on common queries
- Span-based queries optimized
- Segment index queries optimized

#### Query Patterns
- Eager loading of segments when needed
- Lazy loading for large documents (future)

---

## Future Enhancements

### Planned Features

1. **Undo/Redo**: History tracking for segment operations
2. **Export**: Export annotated documents to various formats
3. **Search**: Full-text search across documents and segments
4. **Filters**: Filter segments by annotation status, metadata
5. **Batch Operations**: Select multiple segments for bulk actions
6. **Keyboard Shortcuts**: Power user shortcuts for common actions
7. **Real-time Collaboration**: Multi-user editing (if needed)
8. **Version History**: Track changes over time

### Technical Improvements

1. **Virtualization**: Enable for large documents
2. **Incremental Loading**: Load segments on demand
3. **Caching Strategy**: More aggressive caching
4. **Offline Support**: Service worker for offline access
5. **Performance Monitoring**: Track render times, API latency

### AI Enhancements

1. **Custom Models**: Support for custom AI models
2. **Batch Detection**: Detect endings for multiple documents
3. **Confidence Scores**: Show AI confidence for detections
4. **Learning**: Improve detection based on user corrections

---

## Appendix

### Type Definitions

#### Frontend Types

```typescript
interface TextSegment {
  id: string
  text: string
  title?: string
  author?: string
  title_bdrc_id?: string
  author_bdrc_id?: string
  parentSegmentId?: string
  is_attached?: boolean
  status?: 'checked' | 'unchecked'
}

interface BubbleMenuState {
  segmentId: string
  position: { x: number; y: number }
  selectedText: string
  selectionRange: Range
}

interface CursorPosition {
  segmentId: string
  offset: number
  menuPosition: { x: number; y: number }
}
```

#### Backend Types

```python
class OutlinerDocument(Base):
    id: str
    content: str
    filename: Optional[str]
    user_id: Optional[str]
    total_segments: int
    annotated_segments: int
    progress_percentage: float
    status: Optional[str]
    # ... timestamps

class OutlinerSegment(Base):
    id: str
    document_id: str
    text: str
    segment_index: int
    span_start: int
    span_end: int
    title: Optional[str]
    author: Optional[str]
    # ... other fields
```

### File Structure

```
frontend/src/
├── pages/
│   └── OutlinerWorkspace.tsx
├── components/outliner/
│   ├── Workspace.tsx
│   ├── WorkspaceHeader.tsx
│   ├── AnnotationSidebar.tsx
│   ├── SegmentItem.tsx
│   ├── BubbleMenu.tsx
│   ├── SplitMenu.tsx
│   ├── ContentDisplay.tsx
│   ├── OutlinerContext.tsx
│   └── types.ts
├── hooks/
│   ├── useOutlinerDocument.ts
│   └── useAITextEndings.ts
└── api/
    └── outliner.ts

backend/
├── routers/
│   ├── outliner.py
│   └── ai.py
├── models/
│   └── outliner.py
└── alembic/versions/
    └── [migration files]
```

---

## References

- React Query Documentation: https://tanstack.com/query
- FastAPI Documentation: https://fastapi.tiangolo.com
- Google Gemini API: https://ai.google.dev
- React Window: https://github.com/bvaughn/react-window

---

**End of RFC**
