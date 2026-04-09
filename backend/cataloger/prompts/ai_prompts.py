def get_title_author_prompt(clipped_content: str) -> str:
  
    return f"""Analyze the following text and provide both extracted and suggested values for title and author.

Instructions:
1. Detect the language of the content
2. Extract title and author if they are explicitly mentioned in the text (keep them in their original language)
3. If title is not found, suggest an appropriate title based on the content's theme, subject matter, and context (in the same language as the content)
4. If author is not found, suggest an author name if there are clues (signatures, colophons, style indicators, etc.), otherwise use null (in the same language as the content)
5. It give priority to the title found at the beginning of a text
6. Prioritize Tibetan over Chinese/English/Hindi if multiple title or author are detected 
7. ((ཤེས|ཅེས)་བྱ་བ)?་བཞུགས་སོ། strip these characters and add a ། or ་། at the end of the title or author

Fields to provide:
- title: The extracted title if explicitly mentioned, otherwise null
- suggested_title: A suggested title if title is null, otherwise null (must be in the same language as content)
- author: The extracted author name if explicitly mentioned, otherwise null
- suggested_author: A suggested author name if author is null, otherwise null (must be in the same language as content)

Text to analyze:
{clipped_content}

Provide all four fields (title, suggested_title, author, suggested_author) in the same language as the content."""


def get_title_from_start_prompt(start_excerpt: str) -> str:

    return f"""You are given the BEGINNING of a text segment (first portion only). Infer or extract a title.
IMPORTANT: title and suggested_title must be in the SAME LANGUAGE as this excerpt.

Instructions:
1. Detect the language of the excerpt.
2. If a title appears explicitly at the start (headers, ༄༅-style lines, chapter lines), extract it (original language).
3. If no clear title, suggest a short descriptive title from what you see (same language).
4. Prefer Tibetan over Chinese/English/Hindi if multiple candidates appear.
5. ((ཤེས|ཅེས)་བྱ་བ)?་བཞུགས་སོ། strip these characters and add a ། or ་། at the end of the title or author
Fields:
- title: extracted title if clearly present at the beginning, otherwise null
- suggested_title: if title is null, a concise suggested title; otherwise null

Excerpt (start of segment only):
{start_excerpt}

Respond with title and suggested_title only, in the content's language."""


def get_author_from_end_prompt(end_excerpt: str) -> str:

    return f"""You are given the END of a text segment (last portion only). Infer or extract an author.
IMPORTANT: author and suggested_author must be in the SAME LANGUAGE as this excerpt.

Instructions:
1. Detect the language of the excerpt.
2. Look for colophons, signatures, scribe names, བཀྲ་ཤིས-style closings, or explicit author attribution near the end.
3. If no author is indicated, suggest an author only if there are strong clues; otherwise null for both.
4. Prioritize Tibetan over Chinese/English/Hindi if multiple names appear.
5. ((ཤེས|ཅེས)་བྱ་བ)?་བཞུགས་སོ། strip these characters and add a ། or ་། at the end of the title or author
Fields:
- author: extracted author if explicitly indicated, otherwise null
- suggested_author: if author is null and clues justify a guess, a suggested name; otherwise null

Excerpt (end of segment only):
{end_excerpt}

Respond with author and suggested_author only, in the content's language."""

