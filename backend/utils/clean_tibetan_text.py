def normalise_tibetan_text(text: str) -> str:
    """
    Normalize Tibetan title or author strings according to the following rules:

    1. Remove trailing Tibetan punctuation: ་།, །, ་
    2. Inspect the final character (after above removals):
        - If it ends with ག, ཤ, ཞ, or ཀ: do not add any punctuation.
        - If it ends with ང: add ་། to the end.
        - Otherwise: add ། to the end.
    """
    if not isinstance(text, str):
        return text

    s = text.strip()

    # Remove Tibetan trailing punctuation in order: ་།, །, ་
    endings_to_remove = ["་།", "།", "་"]
    done = False
    while not done:
        done = True
        for ending in endings_to_remove:
            if s.endswith(ending):
                s = s[: -len(ending)]
                done = False
                break

    s = s.strip()
    # Return early if empty after stripping
    if not s:
        return s

    final_char = s[-1]
    if final_char in {"ག", "ཤ", "ཞ", "ཀ"}:
        return s
    elif final_char == "ང":
        return s + "་།"
    else:
        return s + "།"