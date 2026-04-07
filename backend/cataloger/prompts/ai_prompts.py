"""
AI prompt templates for text analysis and detection.
"""

def get_title_author_prompt(clipped_content: str) -> str:
    """
    Generate prompt for extracting/suggesting title and author from content.
    
    Args:
        clipped_content: The clipped text content (start + end)
        
    Returns:
        Formatted prompt string
    """
    return f"""Analyze the following text and provide both extracted and suggested values for title and author.
IMPORTANT: All responses (title, suggested_title, author, suggested_author) must be in the SAME LANGUAGE as the content itself.

Instructions:
1. Detect the language of the content
2. Extract title and author if they are explicitly mentioned in the text (keep them in their original language)
3. If title is not found, suggest an appropriate title based on the content's theme, subject matter, and context (in the same language as the content)
4. If author is not found, suggest an author name if there are clues (signatures, colophons, style indicators, etc.), otherwise use null (in the same language as the content)
5. It give priority to the title found at the beginning of a text
6. Prioritize Tibetan over Chinese/English/Hindi if multiple title or author are detected

Fields to provide:
- title: The extracted title if explicitly mentioned, otherwise null
- suggested_title: A suggested title if title is null, otherwise null (must be in the same language as content)
- author: The extracted author name if explicitly mentioned, otherwise null
- suggested_author: A suggested author name if author is null, otherwise null (must be in the same language as content)

Text to analyze:
{clipped_content}

Provide all four fields (title, suggested_title, author, suggested_author) in the same language as the content."""


def get_title_from_start_prompt(start_excerpt: str) -> str:
    """
    Prompt for title extraction/suggestion using only the opening of a segment.
    """
    return f"""You are given the BEGINNING of a text segment (first portion only). Infer or extract a title.
IMPORTANT: title and suggested_title must be in the SAME LANGUAGE as this excerpt.

Instructions:
1. Detect the language of the excerpt.
2. If a title appears explicitly at the start (headers, ༄༅-style lines, chapter lines), extract it (original language).
3. If no clear title, suggest a short descriptive title from what you see (same language).
4. Prefer Tibetan over Chinese/English/Hindi if multiple candidates appear.

Fields:
- title: extracted title if clearly present at the beginning, otherwise null
- suggested_title: if title is null, a concise suggested title; otherwise null

Excerpt (start of segment only):
{start_excerpt}

Respond with title and suggested_title only, in the content's language."""


def get_author_from_end_prompt(end_excerpt: str) -> str:
    """
    Prompt for author extraction/suggestion using only the closing of a segment.
    """
    return f"""You are given the END of a text segment (last portion only). Infer or extract an author.
IMPORTANT: author and suggested_author must be in the SAME LANGUAGE as this excerpt.

Instructions:
1. Detect the language of the excerpt.
2. Look for colophons, signatures, scribe names, བཀྲ་ཤིས-style closings, or explicit author attribution near the end.
3. If no author is indicated, suggest an author only if there are strong clues; otherwise null for both.
4. Prioritize Tibetan over Chinese/English/Hindi if multiple names appear.

Fields:
- author: extracted author if explicitly indicated, otherwise null
- suggested_author: if author is null and clues justify a guess, a suggested name; otherwise null

Excerpt (end of segment only):
{end_excerpt}

Respond with author and suggested_author only, in the content's language."""


def get_text_boundary_detection_prompt(content: str) -> str:
    """
    Generate prompt for detecting text boundaries in Tibetan texts.
    
    Args:
        content: The full text content to analyze
        
    Returns:
        Formatted prompt string
    """
    return f"""You are an expert scholar of Tibetan texts with deep experience in textual criticism, canon structure, and discourse analysis.

You are given a SINGLE continuous block of text.
This text MAY contain multiple DISTINCT Tibetan texts concatenated together.

IMPORTANT:  
Your task is NOT to segment sentences or paragraphs.

Your task is ONLY to identify boundaries where a COMPLETELY DIFFERENT TEXT begins.
- most of the text normally start with "༄༅༅། །"
A new text boundary should be marked ONLY if there is a clear and strong CONTEXTUAL SHIFT, such as:
- Change of genre (e.g., prayer → commentary, verse → prose)
- Change of speaker or authorial voice
- Change of purpose (e.g., invocation → philosophical exposition)
- Change of doctrinal scope or topic that indicates a new standalone text
- Change in register that clearly signals a separate composition

DO NOT mark boundaries for:
- Sentence endings
- Paragraph breaks
- Line breaks
- Punctuation
- Minor topic shifts within the same text
- Structural markers that still belong to the same work

RULES FOR OUTPUT:
1. Return ONLY starting character positions (0-indexed) where a NEW text begins
2. Always include 0 as the first starting position
3. Only include additional positions if you are confident a DIFFERENT TEXT starts there
4. Be conservative — if unsure, DO NOT add a boundary
5. Count characters precisely, including spaces and newlines

TEXT:
{content}

OUTPUT FORMAT (JSON ONLY):
{{
  "starting_positions": [0, 456, 1823]
}}

If the entire content is a single coherent text, return:
{{
  "starting_positions": [0]
}}"""


def get_toc_parse_prompt(text: str) -> str:
    """
    Prompt: decide if the passage is a table of contents and list entries if so.
    """
    return f"""Task: Check if the text is a TOC; if yes, return the list of TOC entries from it.

Then apply this more precisely: decide if the following text is a table of contents (TOC)—a structured list of titles,
sections, chapters, folio references, or similar navigational lines typical of a TOC.

If it IS a TOC, set is_toc to true and return entries as a list of strings — one string per TOC line or item
(preserve each entry's wording; trim only outer whitespace on each line).

If it is NOT a TOC (e.g. ordinary prose, a single title only, or unrelated content), set is_toc to false
and return an empty entries array.
rule: 
1.check the content dont return number and non relevant text. 
2.check the title of each entry is not a number and not a non relevant text and has proper title sense.
Text:
{text}

"""
