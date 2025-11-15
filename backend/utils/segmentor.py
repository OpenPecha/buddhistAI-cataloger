from milvus_segment_generator import segment_text, segment_text_to_json, list_supported_languages
import requests
import os
from dotenv import load_dotenv

load_dotenv(override=True)

API_ENDPOINT = os.getenv("OPENPECHA_ENDPOINT")

segment_size = 1990

def get_segmented_text(text: str, lang: str):
    spans, segments = segment_text(text, lang, segment_size)
    return spans, segments


def create_segmentation_annotation(instance_id: str, content: str, language: str):
    # If language is English, ensure content ends with a period
    if language == "en" and content and not content.rstrip().endswith('.'):
        content = content.rstrip() + '.'
    elif language == "bo" and content and not content.rstrip().endswith('།'):
        content = content.rstrip() + '།'
    
    try:
        spans, _ = get_segmented_text(content, language)
        annotation = spans
        
        if not API_ENDPOINT:
            print("Warning: OPENPECHA_ENDPOINT not set, skipping annotation creation")
            return None
        
        annotation_payload = {
            "type": "search_segmentation",
            "annotation": annotation
        }
        
        annotation_response = requests.post(
            f"{API_ENDPOINT}/annotations/{instance_id}/annotation",
            json=annotation_payload
        )
        
        if annotation_response.status_code != 201:
            print(f"Failed to create annotation: {annotation_response.text}")
            return None
        
        annotation_response_id = annotation_response.json().get("annotation_id")
        return annotation_response_id
        
    except Exception as e:
        print(f"Error   : {e}")
        return None

