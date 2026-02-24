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

Fields to provide:
- title: The extracted title if explicitly mentioned, otherwise null
- suggested_title: A suggested title if title is null, otherwise null (must be in the same language as content)
- author: The extracted author name if explicitly mentioned, otherwise null
- suggested_author: A suggested author name if author is null, otherwise null (must be in the same language as content)

Text to analyze:
{clipped_content}

Provide all four fields (title, suggested_title, author, suggested_author) in the same language as the content."""


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
