# Outliner API Restructure Summary

This document summarizes the proposed cleanup of the Outliner API so it becomes easier to understand, extend, and maintain while preserving all current functionality.

---

## Goal

Refactor the Outliner API from a function-based endpoint structure into a **resource-first API design**.

### Current problem

The current API mixes:
- resource endpoints
- action/verb endpoints
- workflow endpoints
- admin/reporting endpoints
- special update endpoints like `/content` and `/status`

This makes the API feel inconsistent and harder to reason about.

### Target outcome

Move to a cleaner structure where:
- core entities are modeled as resources
- CRUD follows REST-like conventions
- domain workflows remain as explicit action endpoints only when appropriate
- related functionality is grouped together
- write payloads are sent in request bodies, not query params

---

## Main design principles

1. **Use resources as the foundation**
   - `documents`
   - `segments`
   - `comments`
   - `assignments`
   - `submissions`
   - `reviews`

2. **Use standard HTTP methods for normal operations**
   - `GET` for reads
   - `POST` for creation / explicit actions
   - `PATCH` for partial updates
   - `DELETE` for deletion

3. **Use action endpoints only for real domain actions**
   Examples:
   - split
   - merge
   - approve
   - reject
   - claim-next
   - submit

4. **Keep ownership clear**
   - segments belong to documents
   - comments belong to segments
   - review actions belong to documents or segments

5. **Do not create separate update endpoints for every field group**
   Instead of:
   - `/documents/{id}/content`
   - `/documents/{id}/status`
   - `/segments/{id}/status`

   prefer:
   - `PATCH /documents/{id}`
   - `PATCH /segments/{id}`

---

## Proposed base path

```txt
/api/v1/outliner
```

---

## Proposed top-level grouping

```txt
/api/v1/outliner/documents
/api/v1/outliner/segments
/api/v1/outliner/reviews
/api/v1/outliner/assignments
/api/v1/outliner/submissions
/api/v1/outliner/admin
```

---

## 1) Documents

Documents should be the main root resource.

### Proposed routes

```http
GET    /api/v1/outliner/documents
POST   /api/v1/outliner/documents

GET    /api/v1/outliner/documents/{document_id}
PATCH  /api/v1/outliner/documents/{document_id}
DELETE /api/v1/outliner/documents/{document_id}

GET    /api/v1/outliner/documents/{document_id}/workspace
GET    /api/v1/outliner/documents/{document_id}/toc
GET    /api/v1/outliner/documents/{document_id}/stats
```

### Notes

- `PATCH /documents/{document_id}` should handle updates to content, status, filename, and similar mutable fields.
- `workspace`, `toc`, and `stats` are acceptable read-only projections of the document.
- `stats` can replace the current dedicated progress endpoint.

### Example patch payload

```json
{
  "content": "full updated text",
  "status": "completed",
  "filename": "I1KG12345.txt",
  "is_supplied_title": true
}
```

---

## 2) Segments under documents

The segment collection should live under the document.

### Proposed routes

```http
GET    /api/v1/outliner/documents/{document_id}/segments
POST   /api/v1/outliner/documents/{document_id}/segments
DELETE /api/v1/outliner/documents/{document_id}/segments
POST   /api/v1/outliner/documents/{document_id}/segments/batch
```

### Notes

- `GET` lists segments for the document
- `POST` creates one segment
- `DELETE` resets/removes all segments for the document
- `POST /batch` handles transactional bulk create/update/delete

### Example batch payload

```json
{
  "create": [
    {
      "segment_index": 1,
      "span_start": 0,
      "span_end": 120,
      "text": "..."
    }
  ],
  "update": [
    {
      "id": "seg_123",
      "title": "New title",
      "author": "New author"
    }
  ],
  "delete": ["seg_456", "seg_789"]
}
```

---

## 3) Individual segments

Single segment operations should remain directly addressable.

### Proposed routes

```http
GET    /api/v1/outliner/segments/{segment_id}
PATCH  /api/v1/outliner/segments/{segment_id}
DELETE /api/v1/outliner/segments/{segment_id}

POST   /api/v1/outliner/segments/{segment_id}/split
POST   /api/v1/outliner/segments/merge
```

### Notes

- `PATCH /segments/{segment_id}` should cover common edits such as:
  - text
  - title
  - author
  - BDRC ids
  - label
  - status
  - parent relationship
  - attachment flag
- `split` and `merge` are explicit domain actions and should stay action-based

### Example segment patch payload

```json
{
  "text": "updated segment text",
  "title": "Segment title",
  "author": "Author name",
  "title_bdrc_id": "W1234",
  "author_bdrc_id": "P5678",
  "parent_segment_id": "seg_parent",
  "status": "checked",
  "label": "chapter_title",
  "is_attached": true
}
```

---

## 4) Comments

Comments should be modeled as a nested segment resource.

### Proposed routes

```http
GET    /api/v1/outliner/segments/{segment_id}/comments
POST   /api/v1/outliner/segments/{segment_id}/comments
PATCH  /api/v1/outliner/segments/{segment_id}/comments/{comment_id}
DELETE /api/v1/outliner/segments/{segment_id}/comments/{comment_id}
```

### Recommendation

Avoid using `comment_index` as the primary identifier if possible.
Use a real `comment_id` so edits and deletes stay stable even when comment ordering changes.

---

## 5) Reviews

Review actions should be grouped as review operations, not mixed into segment/document CRUD.

### Proposed routes

```http
POST /api/v1/outliner/documents/{document_id}/reviews/approve
POST /api/v1/outliner/segments/{segment_id}/reviews/reject
POST /api/v1/outliner/reviews/rejections/batch
```

### Notes

- approval is a document-level workflow action
- rejection is a segment-level workflow action
- bulk rejection should have its own grouped route

### Example reject payload

```json
{
  "reviewer_id": "user_123",
  "comment": "Title and author are misidentified."
}
```

---

## 6) AI actions

AI behavior should be attached to the document it operates on.

### Proposed routes

```http
POST /api/v1/outliner/documents/{document_id}/ai/outline
GET  /api/v1/outliner/documents/{document_id}/toc
```

### Notes

- `POST /ai/outline` replaces the current global AI outline endpoint with a document-scoped action
- `GET /toc` provides the AI/stored TOC result as a document projection

---

## 7) Assignments / work queue

Volume assignment is a workflow concern, not a document CRUD concern.

### Proposed routes

```http
POST /api/v1/outliner/assignments/claim-next
POST /api/v1/outliner/assignments/release
GET  /api/v1/outliner/assignments?user_id=...
```

### Example payload

```json
{
  "user_id": "user_123"
}
```

### Why this is better

This communicates queue ownership and assignment intent much more clearly than `/assign_volume`.

---

## 8) Submissions / BDRC sync

BDRC submission is a workflow area and should be grouped accordingly.

### Proposed routes

```http
POST /api/v1/outliner/documents/{document_id}/submissions/bdrc
POST /api/v1/outliner/submissions/bdrc/batch
```

### Notes

- single-document submission stays scoped to the document
- bulk sync gets its own batch submission route

### Example payload

```json
{
  "target_status": "in_review"
}
```

### Batch payload example

```json
{
  "document_ids": ["doc_1", "doc_2"]
}
```

---

## 9) Admin / dashboard

Admin-only reporting should live under an admin namespace.

### Proposed route

```http
GET /api/v1/outliner/admin/stats
```

---

## Full proposed route set

```txt
/api/v1/outliner/documents
/api/v1/outliner/documents/{document_id}
/api/v1/outliner/documents/{document_id}/workspace
/api/v1/outliner/documents/{document_id}/toc
/api/v1/outliner/documents/{document_id}/stats
/api/v1/outliner/documents/{document_id}/segments
/api/v1/outliner/documents/{document_id}/segments/batch
/api/v1/outliner/documents/{document_id}/reviews/approve
/api/v1/outliner/documents/{document_id}/ai/outline
/api/v1/outliner/documents/{document_id}/submissions/bdrc

/api/v1/outliner/segments/{segment_id}
/api/v1/outliner/segments/{segment_id}/split
/api/v1/outliner/segments/merge
/api/v1/outliner/segments/{segment_id}/comments
/api/v1/outliner/segments/{segment_id}/comments/{comment_id}
/api/v1/outliner/segments/{segment_id}/reviews/reject

/api/v1/outliner/reviews/rejections/batch

/api/v1/outliner/assignments/claim-next
/api/v1/outliner/assignments/release
/api/v1/outliner/assignments

/api/v1/outliner/submissions/bdrc/batch

/api/v1/outliner/admin/stats
```

---

## Old to new mapping

```txt
PUT    /outliner/documents/{id}/content
PATCH  /api/v1/outliner/documents/{id}

PUT    /outliner/documents/{id}/status
PATCH  /api/v1/outliner/documents/{id}

GET    /outliner/documents/{id}/progress
GET    /api/v1/outliner/documents/{id}/stats

POST   /outliner/ai-outline?document_id=...
POST   /api/v1/outliner/documents/{id}/ai/outline

POST   /outliner/assign_volume?user_id=...
POST   /api/v1/outliner/assignments/claim-next

PUT    /outliner/segments/{id}/status
PATCH  /api/v1/outliner/segments/{id}

PUT    /outliner/segments/{id}/reject
POST   /api/v1/outliner/segments/{id}/reviews/reject

PUT    /outliner/segments/bulk-reject
POST   /api/v1/outliner/reviews/rejections/batch

POST   /outliner/documents/{id}/submit-bdrc-in-review
POST   /api/v1/outliner/documents/{id}/submissions/bdrc

POST   /outliner/documents/{id}/approve
POST   /api/v1/outliner/documents/{id}/reviews/approve
```

---

## Suggested backend router structure

Suggested FastAPI organization:

```txt
routers/
  outliner/
    documents.py
    segments.py
    comments.py
    reviews.py
    assignments.py
    submissions.py
    admin.py
    schemas.py
```

---

## Recommended implementation rules for Cursor

Ask Cursor to follow these rules while refactoring:

1. Introduce new routes under `/api/v1/outliner/...`
2. Keep old routes temporarily as compatibility aliases where possible
3. Move document updates into `PATCH /documents/{document_id}`
4. Move segment updates into `PATCH /segments/{segment_id}`
5. Move content/status updates out of query parameters and into JSON request bodies
6. Keep `split`, `merge`, `approve`, `reject`, `claim-next`, and `submit` as explicit action endpoints
7. Group review, assignment, and submission workflows into their own routers
8. Keep response models stable where practical to avoid unnecessary frontend breakage
9. Add deprecation comments for old endpoints
10. Update frontend callers gradually to the new routes

---

## Recommended migration strategy

### Phase 1
- Add new `/api/v1/outliner/...` routes
- Keep old routes functional
- Internally reuse the same service layer

### Phase 2
- Update frontend to call new endpoints
- Remove duplicated update logic from older routes
- Keep old routes as thin wrappers or aliases

### Phase 3
- Mark old routes deprecated in OpenAPI/docs
- Remove old routes after frontend migration is complete

---

## Short prompt you can give Cursor

```md
Refactor the Outliner API into a resource-first structure under `/api/v1/outliner`.

Requirements:
- Use resource-based endpoints for documents, segments, comments, reviews, assignments, submissions, and admin stats.
- Replace separate `/content` and `/status` update routes with `PATCH` on the parent resource.
- Keep explicit action endpoints only for domain workflows like split, merge, approve, reject, claim-next, and submit.
- Keep current functionality intact.
- Preserve existing schemas as much as possible to avoid frontend breakage.
- Add compatibility aliases for old routes during migration.
- Organize routers into:
  - documents.py
  - segments.py
  - comments.py
  - reviews.py
  - assignments.py
  - submissions.py
  - admin.py

Target routes:
- `/api/v1/outliner/documents`
- `/api/v1/outliner/documents/{document_id}`
- `/api/v1/outliner/documents/{document_id}/workspace`
- `/api/v1/outliner/documents/{document_id}/toc`
- `/api/v1/outliner/documents/{document_id}/stats`
- `/api/v1/outliner/documents/{document_id}/segments`
- `/api/v1/outliner/documents/{document_id}/segments/batch`
- `/api/v1/outliner/documents/{document_id}/reviews/approve`
- `/api/v1/outliner/documents/{document_id}/ai/outline`
- `/api/v1/outliner/documents/{document_id}/submissions/bdrc`
- `/api/v1/outliner/segments/{segment_id}`
- `/api/v1/outliner/segments/{segment_id}/split`
- `/api/v1/outliner/segments/merge`
- `/api/v1/outliner/segments/{segment_id}/comments`
- `/api/v1/outliner/segments/{segment_id}/comments/{comment_id}`
- `/api/v1/outliner/segments/{segment_id}/reviews/reject`
- `/api/v1/outliner/reviews/rejections/batch`
- `/api/v1/outliner/assignments/claim-next`
- `/api/v1/outliner/assignments/release`
- `/api/v1/outliner/assignments`
- `/api/v1/outliner/submissions/bdrc/batch`
- `/api/v1/outliner/admin/stats`

Also include an old-to-new route mapping and keep old endpoints working temporarily as wrappers.
```

---

## Final recommendation

Do **not** try to force everything into pure CRUD.

Use this balance:
- CRUD for real resources
- action endpoints for real workflows
- grouped namespaces for admin, review, assignment, and submission concerns

That will make the API much cleaner without fighting the actual domain model.
