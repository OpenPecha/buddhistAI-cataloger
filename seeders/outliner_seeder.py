#!/usr/bin/env python3
"""
Outliner seeder - populates the outliner with ~30 fake documents for development.

Run from project root:
    python seeders/outliner_seeder.py

Requires: DATABASE_URL in .env (or environment)
"""
import os
import sys
import random
from pathlib import Path

# Add project root and backend to path
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
BACKEND_DIR = PROJECT_ROOT / "backend"
sys.path.insert(0, str(BACKEND_DIR))
sys.path.insert(0, str(PROJECT_ROOT))

# Load .env from project root
from dotenv import load_dotenv
load_dotenv(PROJECT_ROOT / ".env")

# Import all models so SQLAlchemy metadata/FK resolution works (same as alembic env.py)
from core.database import Base, SessionLocal  # noqa: F401
from settings.models.tenant import Tenant  # noqa: F401
from user.models.user import User  # noqa: F401
from settings.models.tenant_settings import TenantSettings  # noqa: F401
from settings.models.membership import TenantMembership  # noqa: F401
from settings.models.role import Role  # noqa: F401
from settings.models.permission import Permission  # noqa: F401
from outliner.models.outliner import OutlinerDocument, OutlinerSegment, SegmentRejection  # noqa: F401
from outliner.controller.outliner import create_document, create_segments_bulk

# Fake Tibetan/Buddhist text samples for segments
FAKE_CONTENTS = [
    """རྒྱ་གར་གྱི་མཁས་པ་ཆེན་པོ་དགེ་འདུན་འབྱུང་གནས་ཀྱིས་མཛད་པའི་འཕགས་པ་སྤྱོད་པ་པ་འབུམ་པའི་རྩ་བའི་འགྲེལ་པ་ལག་ལེན་བཀོད་པ་ཞེས་བྱ་བ་བཞུགས་སོ།།
སྟོན་པའི་གསུང་རབ་མང་པོའི་ནང་ནས། འཕགས་པ་སྤྱོད་པ་པ་འབུམ་པའི་མདོ་འདི་ནི་སྔགས་ཀྱི་འཁོར་ལོའི་གཞིར་གྱུར་པ་ཡིན།""",
    """འདིར་བསྟན་པའི་དོན་ནི། སེམས་ཅན་ཐམས་ཅད་སྐྱེ་བ་མེད་པར་མྱ་ངན་ལས་འདའ་བའི་ཐར་པ་ཐོབ་པར་གྱུར་ཅིག
དེའི་ཕྱིར་སྟོན་པས་གསུངས་པའི་ཆོས་ཀྱི་སྒོ་འདི་ལ་གཟིགས་པར་ཞུ།""",
    """དཔལ་ལྡན་འདས་མ་འཕགས་མ་སྒྲོལ་མའི་གཏེར་མདོ།
ཕྱག་འཚལ་ལོ། ཐུགས་རྗེ་ཆེན་པོའི་དབུས་ན་གནས། སྐལ་ལྡན་འགྲོ་བའི་དོན་དུ་འགྱུར།""",
    """མདོ་སྡེ་དགོངས་པ་ངེས་འགྲེལ་ལས།
འདུས་མ་བྱས་པའི་དངོས་པོའི་རང་བཞིན་གྱིས་སྟོང་པ་ཉིད་དུ་རྟོགས་པའི་སྟོང་པ་ཉིད་ཀྱི་ལྟ་བ་འདིས་འཇིག་རྟེན་པའི་རྟོག་གེའི་མུན་པ་སེལ་བར་གྱུར་ཅིག།""",
    """བདེན་པ་བཞིའི་མདོ།
འདུས་བྱས་ཐམས་ཅད་མི་རྟག་པ། འདུས་མ་བྱས་ཐམས་ཅད་སྡུག་བསྔལ། བདག་མེད་པའི་ཆོས་རྣམས་སྟོང་པ། མྱ་ངན་ལས་འདའ་བའི་ཞི་བ་མཆོག།""",
    """སྔགས་ཀྱི་རྩ་བའི་མདོ།
ཨོཾ་སྭསྟི། སྟོན་པའི་གསུང་རབ་ཀུན་གྱི་སྙིང་པོ་འདི་ལ། བདེན་པའི་དབང་ཕྱུག་ཉིད་ཀྱིས་གཟིགས།""",
    """མངོན་རྟོགས་རྒྱན་གྱི་འགྲེལ་པ།
ཡོན་ཏན་ཐམས་ཅད་ཀྱི་འབྱུང་གནས་རྣམ་པར་སྣང་མཛད་ལ་ཕྱག་འཚལ་ལོ། མཁས་པའི་དབང་པོ་ཆེན་པོས་མཛད་པའི་མངོན་པར་རྟོགས་པའི་རྒྱན་འདིར་འགྲེལ་པར་བྱ།""",
    """བསྐལ་པ་བཟང་པོའི་མདོའི་འགྲེལ་པ།
བསྐལ་པ་བཟང་པོའི་མདོ་འདི་ནི་ཐེག་པ་ཆེན་པོའི་སྒོ་ནས་བསྟན་པའི་མདོ་སྡེ་ཆེན་པོ་ཞིག་སྟེ། སངས་རྒྱས་ཀྱི་སྔོན་གྱི་སྨོན་ལམ་དང་། འཕགས་པའི་སྤྱོད་པའི་རྣམ་ཐར་ལས་བརྗོད་པའོ།""",
    """བྱང་ཆུབ་སེམས་དཔའི་སྤྱོད་པ་ལ་འཇུག་པ།
བྱང་ཆུབ་ཆེན་པོའི་སེམས་བསྐྱེད་པའི་ཚུལ་ནི། སྟོན་པའི་གསུང་རབ་ཀྱི་སྙིང་པོའི་གཞི་ཡིན། འདིར་རྣམ་པར་དག་པའི་སྤྱོད་པའི་རིམ་པ་བསྟན་པར་བྱ།""",
    """དབུ་མ་རྩ་བའི་ཚིག་ལེའུར་བྱས་པ།
རྟག་ཏུ་མི་རྟག་པའི་མཚན་ཉིད་དང་། བདག་མེད་པའི་རང་བཞིན། རྟེན་འབྱུང་གི་སྒོ་ནས་འགྲེལ་པར་བྱ།""",
]

# Fake titles and authors for annotations (Tibetan Buddhist works)
FAKE_TITLES = [
    "འཕགས་པ་སྤྱོད་པ་པ་འབུམ་པ",
    "བདེན་པ་བཞིའི་མདོ",
    "མངོན་རྟོགས་རྒྱན",
    "བྱང་ཆུབ་སེམས་དཔའི་སྤྱོད་པ་ལ་འཇུག་པ",
    "དབུ་མ་རྩ་བ",
    "མདོ་སྡེ་དགོངས་པ་ངེས་འགྲེལ",
    "སྔགས་ཀྱི་རྩ་བའི་མདོ",
    "བསྐལ་པ་བཟང་པོའི་མདོ",
]

FAKE_AUTHORS = [
    "དགེ་འདུན་འབྱུང་གནས",
    "ནཱ་གཱརྫུ་ན",
    "མཱའུ་ལ་ཤྲཱི་གུཔྟ",
    "ཀམལ་ཤཱི་ལ",
    "ཛྙཱ་ན་གརྦྷ",
    "ཤཱནྟི་དེ་ཝ",
]



def split_into_segments(content: str, num_segments: int) -> list[tuple[int, int, str]]:
    """Split content into roughly equal segments. Returns [(span_start, span_end, text), ...]"""
    length = len(content)
    if num_segments <= 0 or length == 0:
        return [(0, length, content)] if length > 0 else []
    if num_segments > length:
        num_segments = length
    segment_len = length // num_segments
    result = []
    start = 0
    for i in range(num_segments):
        end = length if i == num_segments - 1 else start + segment_len
        # Try to break at newline for cleaner splits
        if i < num_segments - 1 and end < length:
            nl = content.find("\n", end - 50, end + 50)
            if nl > start:
                end = nl + 1
        result.append((start, end, content[start:end]))
        start = end
    return result


def run_seeder(count: int = 30) -> None:
    """Seed the outliner with approximately `count` fake documents."""
    db = SessionLocal()
    try:
        created = 0
        for i in range(count):
            content = random.choice(FAKE_CONTENTS)
            num_segments = random.randint(1, 5)
            segments_spec = split_into_segments(content, num_segments)

            filename = f"fake_doc_{i + 1:03d}.txt"
            doc = create_document(
                db=db,
                content=content,
                filename=filename,
                user_id=None,
            )
            doc_id = doc.id

            segments_data = []
            for idx, (span_start, span_end, _text) in enumerate(segments_spec):
                seg_data = {
                    "segment_index": idx,
                    "span_start": span_start,
                    "span_end": span_end,
                }
                # Annotate ~40% of segments with title/author
                if random.random() < 0.4:
                    seg_data["title"] = random.choice(FAKE_TITLES)
                    seg_data["author"] = random.choice(FAKE_AUTHORS)
                segments_data.append(seg_data)

            create_segments_bulk(db=db, document_id=doc_id, segments_data=segments_data)
            created += 1
            print(f"  Created document {created}/{count}: {filename} ({num_segments} segments)")

        print(f"\nDone. Seeded {created} outliner documents.")
    except Exception as e:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Seed outliner with fake documents for development")
    parser.add_argument("-n", "--count", type=int, default=30, help="Number of documents to create (default: 30)")
    args = parser.parse_args()

    if not os.getenv("DATABASE_URL"):
        print("Error: DATABASE_URL not set. Set it in .env or environment.")
        sys.exit(1)

    print(f"Seeding outliner with ~{args.count} fake documents...")
    run_seeder(count=args.count)
