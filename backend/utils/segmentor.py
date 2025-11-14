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
    """
    Create segmentation annotation for an instance based on its content and language.
    
    Args:
        instance_id: The ID of the instance to create annotation for
        content: The text content to segment
        language: The language of the content
        
    Returns:
        tuple: (text_id, instance_id, annotation_response_id) or None if error occurs
    """
    try:
        spans, segments = get_segmented_text(content, language)
        
        annotation = []
        for span in spans:
            start = span.get("start")
            end = span.get("end")
            segment = segments.get(start)
            if segment:
                annotation.append({
                    "type": "search_segmentation",
                    "span": {
                        "start": start,
                        "end": end
                    }
                })
        
        if not API_ENDPOINT:
            print("Warning: OPENPECHA_ENDPOINT not set, skipping annotation creation")
            return None
        
        annotation_payload = {
            "type": "segmentation",
            "annotation": [
                {
                    "span": {
                        "start": item["span"]["start"],
                        "end": item["span"]["end"]
                    }
                }
                for item in annotation
            ]
        }
        
        annotation_response = requests.post(
            f"{API_ENDPOINT}/annotations/{instance_id}/annotation",
            json=annotation_payload
        )
        
        if annotation_response.status_code != 201:
            print(f"Failed to create annotation: {annotation_response.text}")
            return None
        
        annotation_response_id = annotation_response.json().get("id")
        return annotation_response_id
        
    except Exception as e:
        print(f"Error creating segmentation annotation: {e}")
        return None

