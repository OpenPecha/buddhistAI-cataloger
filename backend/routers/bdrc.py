from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import requests
import json
import logging
from rdflib import Graph, Namespace
from rdflib.namespace import SKOS

router = APIRouter()

BDRC_ENDPOINT = "https://autocomplete.bdrc.io/msearch"


class IndexQuery(BaseModel):
    index: str = "bdrc_prod"


class RangeItem(BaseModel):
    from_: int = Field(alias="from")
    to: int


class TermsAgg(BaseModel):
    field: str
    size: int = 1000


class RangeAgg(BaseModel):
    field: str
    ranges: List[RangeItem]


class Aggregations(BaseModel):
    associatedCentury: Optional[Dict[str, TermsAgg]] = None
    associatedTradition: Optional[Dict[str, TermsAgg]] = None
    author: Optional[Dict[str, TermsAgg]] = None
    etext_access: Optional[Dict[str, TermsAgg]] = None
    etext_quality: Optional[Dict[str, RangeAgg]] = None
    etext_search: Optional[Dict[str, TermsAgg]] = None
    exclude_etexts: Optional[Dict[str, TermsAgg]] = None
    inCollection: Optional[Dict[str, TermsAgg]] = None
    language: Optional[Dict[str, TermsAgg]] = None
    nocomm_search: Optional[Dict[str, TermsAgg]] = None
    personGender: Optional[Dict[str, TermsAgg]] = None
    placeType: Optional[Dict[str, TermsAgg]] = None
    printMethod: Optional[Dict[str, TermsAgg]] = None
    scans_access: Optional[Dict[str, TermsAgg]] = None
    script: Optional[Dict[str, TermsAgg]] = None
    translator: Optional[Dict[str, TermsAgg]] = None
    type: Optional[Dict[str, TermsAgg]] = None
    workGenre: Optional[Dict[str, TermsAgg]] = None
    workIsAbout: Optional[Dict[str, TermsAgg]] = None


class HighlightFields(BaseModel):
    associated_res: Optional[Dict] = {}
    graphs: Optional[Dict] = {}
    other_id: Optional[Dict] = {}
    inRootInstance: Optional[Dict] = {}
    type: Optional[Dict] = {}
    inCollection: Optional[Dict] = {}
    associatedTradition: Optional[Dict] = {}
    personGender: Optional[Dict] = {}
    hasSourcePrintery: Optional[Dict] = {}
    printMethod: Optional[Dict] = {}
    script: Optional[Dict] = {}
    language: Optional[Dict] = {}
    partOf: Optional[Dict] = {}
    partType: Optional[Dict] = {}
    issueName: Optional[Dict] = {}
    workGenre: Optional[Dict] = {}
    workIsAbout: Optional[Dict] = {}
    author: Optional[Dict] = {}
    translator: Optional[Dict] = {}
    seriesName_res: Optional[Dict] = {}
    seriesName_en: Optional[Dict] = {}
    seriesName_bo_x_ewts: Optional[Dict] = {}
    seriesName_iast: Optional[Dict] = {}
    seriesName_hani: Optional[Dict] = {}
    seriesName_khmr: Optional[Dict] = {}
    summary_en: Optional[Dict] = {}
    summary_bo_x_ewts: Optional[Dict] = {}
    summary_iast: Optional[Dict] = {}
    summary_hani: Optional[Dict] = {}
    summary_khmr: Optional[Dict] = {}
    authorName_en: Optional[Dict] = {}
    authorName_bo_x_ewts: Optional[Dict] = {}
    authorName_iast: Optional[Dict] = {}
    authorName_hani: Optional[Dict] = {}
    authorName_khmr: Optional[Dict] = {}
    authorshipStatement_en: Optional[Dict] = {}
    authorshipStatement_bo_x_ewts: Optional[Dict] = {}
    authorshipStatement_iast: Optional[Dict] = {}
    authorshipStatement_hani: Optional[Dict] = {}
    authorshipStatement_khmr: Optional[Dict] = {}
    publisherName_en: Optional[Dict] = {}
    publisherName_bo_x_ewts: Optional[Dict] = {}
    publisherName_iast: Optional[Dict] = {}
    publisherName_hani: Optional[Dict] = {}
    publisherName_khmr: Optional[Dict] = {}
    publisherLocation_en: Optional[Dict] = {}
    publisherLocation_bo_x_ewts: Optional[Dict] = {}
    publisherLocation_iast: Optional[Dict] = {}
    publisherLocation_hani: Optional[Dict] = {}
    publisherLocation_khmr: Optional[Dict] = {}
    prefLabel_en: Optional[Dict] = {"fragment_size": 500}
    prefLabel_bo_x_ewts: Optional[Dict] = {"fragment_size": 500}
    prefLabel_iast: Optional[Dict] = {"fragment_size": 500}
    prefLabel_hani: Optional[Dict] = {"fragment_size": 500}
    prefLabel_khmr: Optional[Dict] = {"fragment_size": 500}
    comment_en: Optional[Dict] = {}
    comment_bo_x_ewts: Optional[Dict] = {}
    comment_iast: Optional[Dict] = {}
    comment_hani: Optional[Dict] = {}
    comment_khmr: Optional[Dict] = {}
    altLabel_en: Optional[Dict] = {"fragment_size": 500}
    altLabel_bo_x_ewts: Optional[Dict] = {"fragment_size": 500}
    altLabel_iast: Optional[Dict] = {"fragment_size": 500}
    altLabel_hani: Optional[Dict] = {"fragment_size": 500}
    altLabel_khmr: Optional[Dict] = {"fragment_size": 500}


class Highlight(BaseModel):
    fields: HighlightFields


class MultiMatch(BaseModel):
    type: str = "phrase"
    query: str
    fields: List[str]


class BoolQuery(BaseModel):
    filter: List[Any] = []
    must: List[Dict[str, MultiMatch]]


class Script(BaseModel):
    id: str = "bdrc-score"


class ScriptScore(BaseModel):
    script: Script


class FunctionScore(BaseModel):
    script_score: ScriptScore
    query: Dict[str, BoolQuery]


class Query(BaseModel):
    function_score: FunctionScore


class SearchQuery(BaseModel):
    from_: int = Field(default=0, alias="from")
    size: int = 20
    aggs: Optional[Aggregations] = None
    highlight: Optional[Highlight] = None
    query: Query


class BdrcSearchRequest(BaseModel):
    search_query: str
    from_: int = Field(default=0, alias="from")
    size: int = 20
    filter: List[Any] = []
    type: str = "Instance"  # Can be "Instance", "Text", "Volume", "Person"


@router.post("/search")
async def bdrc_search(request: BdrcSearchRequest):
    """Search BDRC database using multi-search"""
    
    # Create the default aggregations
    default_aggs = {
        "associatedCentury": {"terms": {"field": "associatedCentury", "size": 1000}},
        "associatedTradition": {"terms": {"field": "associatedTradition", "size": 1000}},
        "author": {"terms": {"field": "author", "size": 1000}},
        "etext_access": {"terms": {"field": "etext_access", "size": 1000}},
        "etext_quality": {
            "range": {
                "field": "etext_quality",
                "ranges": [
                    {"from": 0, "to": 0.95},
                    {"from": 0.95, "to": 1.01},
                    {"from": 1.99, "to": 4.01}
                ]
            }
        },
        "etext_search": {"terms": {"field": "etext_search", "size": 1000}},
        "exclude_etexts": {"terms": {"field": "exclude_etexts", "size": 1000}},
        "inCollection": {"terms": {"field": "inCollection", "size": 1000}},
        "language": {"terms": {"field": "language", "size": 1000}},
        "nocomm_search": {"terms": {"field": "nocomm_search", "size": 1000}},
        "personGender": {"terms": {"field": "personGender", "size": 1000}},
        "placeType": {"terms": {"field": "placeType", "size": 1000}},
        "printMethod": {"terms": {"field": "printMethod", "size": 1000}},
        "scans_access": {"terms": {"field": "scans_access", "size": 1000}},
        "script": {"terms": {"field": "script", "size": 1000}},
        "translator": {"terms": {"field": "translator", "size": 1000}},
        "type": {"terms": {"field": "type", "size": 1000}},
        "workGenre": {"terms": {"field": "workGenre", "size": 1000}},
        "workIsAbout": {"terms": {"field": "workIsAbout", "size": 1000}}
    }
    
    # Create the highlight configuration
    highlight_config = {
        "fields": {
            "associated_res": {},
            "graphs": {},
            "other_id": {},
            "inRootInstance": {},
            "type": {},
            "inCollection": {},
            "associatedTradition": {},
            "personGender": {},
            "hasSourcePrintery": {},
            "printMethod": {},
            "script": {},
            "language": {},
            "partOf": {},
            "partType": {},
            "issueName": {},
            "workGenre": {},
            "workIsAbout": {},
            "author": {},
            "translator": {},
            "seriesName_res": {},
            "seriesName_en": {},
            "seriesName_bo_x_ewts": {},
            "seriesName_iast": {},
            "seriesName_hani": {},
            "seriesName_khmr": {},
            "summary_en": {},
            "summary_bo_x_ewts": {},
            "summary_iast": {},
            "summary_hani": {},
            "summary_khmr": {},
            "authorName_en": {},
            "authorName_bo_x_ewts": {},
            "authorName_iast": {},
            "authorName_hani": {},
            "authorName_khmr": {},
            "authorshipStatement_en": {},
            "authorshipStatement_bo_x_ewts": {},
            "authorshipStatement_iast": {},
            "authorshipStatement_hani": {},
            "authorshipStatement_khmr": {},
            "publisherName_en": {},
            "publisherName_bo_x_ewts": {},
            "publisherName_iast": {},
            "publisherName_hani": {},
            "publisherName_khmr": {},
            "publisherLocation_en": {},
            "publisherLocation_bo_x_ewts": {},
            "publisherLocation_iast": {},
            "publisherLocation_hani": {},
            "publisherLocation_khmr": {},
            "prefLabel_en": {"fragment_size": 500},
            "prefLabel_bo_x_ewts": {"fragment_size": 500},
            "prefLabel_iast": {"fragment_size": 500},
            "prefLabel_hani": {"fragment_size": 500},
            "prefLabel_khmr": {"fragment_size": 500},
            "comment_en": {},
            "comment_bo_x_ewts": {},
            "comment_iast": {},
            "comment_hani": {},
            "comment_khmr": {},
            "altLabel_en": {"fragment_size": 500},
            "altLabel_bo_x_ewts": {"fragment_size": 500},
            "altLabel_iast": {"fragment_size": 500},
            "altLabel_hani": {"fragment_size": 500},
            "altLabel_khmr": {"fragment_size": 500}
        }
    }
    
    # Build the search payload
    search_fields = [
        "seriesName_bo_x_ewts^0.1",
        "seriesName_en^0.1",
        "authorshipStatement_bo_x_ewts^0.005",
        "authorshipStatement_en^0.005",
        "publisherName_bo_x_ewts^0.01",
        "publisherLocation_bo_x_ewts^0.01",
        "publisherName_en^0.01",
        "publisherLocation_en^0.01",
        "prefLabel_bo_x_ewts^1",
        "prefLabel_en^1",
        "comment_bo_x_ewts^0.0001",
        "comment_en^0.0001",
        "altLabel_bo_x_ewts^0.6",
        "altLabel_en^0.6"
    ]
    
    # Build the filter list
    filters = list(request.filter) if request.filter else []
    
    # Add type filter if specified
    if request.type:
        filters.append({"term": {"type": request.type}})
    
    payload_lines = [
        json.dumps({"index": "bdrc_prod"}),
        json.dumps({
            "from": request.from_,
            "size": request.size,
            "aggs": default_aggs,
            "highlight": highlight_config,
            "query": {
                "function_score": {
                    "script_score": {
                        "script": {
                            "id": "bdrc-score"
                        }
                    },
                    "query": {
                        "bool": {
                            "filter": filters,
                            "must": [
                                {
                                    "multi_match": {
                                        "type": "phrase",
                                        "query": request.search_query,
                                        "fields": search_fields
                                    }
                                }
                            ]
                        }
                    }
                }
            }
        })
    ]
    
    # Join with newlines as required by the multi-search format
    payload = '\n'.join(payload_lines) + '\n'
    
    headers = {
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Content-Type': 'application/json'
    }
    
    try:
        response = requests.post(BDRC_ENDPOINT, data=payload, headers=headers, timeout=30)
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=response.text)
        
        search_results = response.json()
        
        # If type is Instance, enhance with work details
        if request.type == "Instance":
            work_instance_pairs = []
            
            # Extract merged field values and instance IDs from search results
            if "responses" in search_results and len(search_results["responses"]) > 0:
                hits = search_results["responses"][0].get("hits", {}).get("hits", [])
                for hit in hits:
                    source = hit.get("_source", {})
                    instance_id = hit.get("_id")  # Get the instance ID from the hit
                    merged = source.get("merged")
                    if merged and instance_id:
                        # If merged is a list, create pairs for each work ID
                        if isinstance(merged, list):
                            for work_id in merged:
                                work_instance_pairs.append((work_id, instance_id))
                        else:
                            # If merged is a single item, create one pair
                            work_instance_pairs.append((merged, instance_id))
            
            # Fetch work details if we have work-instance pairs (limit to first 5)
            work_details = []
            if work_instance_pairs:
                limited_pairs = work_instance_pairs[:5]  # Only take first 5 pairs
                work_details = await fetch_work_details(limited_pairs)
            
            # Return only work details for Instance searches
            return work_details
        
        # For Person or other types, return original response
        return search_results
        
    except requests.exceptions.Timeout:
        raise HTTPException(status_code=504, detail="Request to BDRC API timed out")
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=502, detail=f"Error connecting to BDRC API: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class WorkDetail(BaseModel):
    workId: str
    instanceId: str  # BDRC instance ID from search results
    prefLabel: Optional[str] = None
    catalogInfo: Optional[str] = None
    creator: Optional[str] = None
    language: Optional[str] = None
    workGenre: Optional[str] = None
    workHasInstance: List[str] = []
    entityScore: Optional[int] = None


class EnhancedSearchResponse(BaseModel):
    search_results: Dict[str, Any]
    work_details: List[WorkDetail] = []


class BdrcPersonSearchRequest(BaseModel):
    search_query: str
    from_: int = Field(default=0, alias="from")
    size: int = 20


async def fetch_work_details(work_instance_pairs: List[tuple]) -> List[WorkDetail]:
    """Fetch work details from BDRC RDF endpoints"""
    work_details = []
    
    # Define RDF namespaces
    BDO = Namespace("http://purl.bdrc.io/ontology/core/")
    TMP = Namespace("http://purl.bdrc.io/ontology/tmp/")
    
    for work_id, instance_id in work_instance_pairs:
        try:
            # Fetch RDF data from BDRC
            url = f"https://ldspdi.bdrc.io/resource/{work_id}.ttl"
            response = requests.get(url, timeout=10)
            
            if response.status_code != 200:
                logging.warning(f"Failed to fetch work {work_id}: HTTP {response.status_code}")
                continue
                
            # Parse RDF/Turtle data
            g = Graph()
            g.parse(data=response.text, format="turtle")
            
            # Extract all required fields
            pref_label = None
            catalog_info = None
            creator = None
            language = None
            work_genre = None
            work_has_instance = []
            entity_score = None
            
            # Get prefLabel (skos:prefLabel)
            for obj in g.objects(subject=None, predicate=SKOS.prefLabel):
                pref_label = str(obj)
                break
                
            # Get catalogInfo (bdo:catalogInfo)
            for obj in g.objects(subject=None, predicate=BDO.catalogInfo):
                catalog_info = str(obj)
                break
                
            # Get creator (bdo:creator)
            for obj in g.objects(subject=None, predicate=BDO.creator):
                creator = str(obj)
                break
                
            # Get language (bdo:language)
            for obj in g.objects(subject=None, predicate=BDO.language):
                language = str(obj)
                break
                
            # Get workGenre (bdo:workGenre)
            for obj in g.objects(subject=None, predicate=BDO.workGenre):
                work_genre = str(obj)
                break
                
            # Get workHasInstance (bdo:workHasInstance) - can be multiple
            for obj in g.objects(subject=None, predicate=BDO.workHasInstance):
                work_has_instance.append(str(obj))
                
            # Get entityScore (tmp:entityScore)
            for obj in g.objects(subject=None, predicate=TMP.entityScore):
                try:
                    entity_score = int(str(obj))
                except ValueError:
                    entity_score = None
                break
            
            work_details.append(WorkDetail(
                workId=work_id,
                instanceId=instance_id,
                prefLabel=pref_label,
                catalogInfo=catalog_info,
                creator=creator,
                language=language,
                workGenre=work_genre,
                workHasInstance=work_has_instance,
                entityScore=entity_score
            ))
            
        except Exception as e:
            logging.error(f"Error fetching work details for {work_id}: {str(e)}")
            continue
    
    return work_details


@router.post("/search/person")
async def bdrc_person_search(request: BdrcPersonSearchRequest):
    """Search BDRC database for persons/authors"""
    
    # Create the default aggregations
    default_aggs = {
        "associatedCentury": {"terms": {"field": "associatedCentury", "size": 1000}},
        "associatedTradition": {"terms": {"field": "associatedTradition", "size": 1000}},
        "personGender": {"terms": {"field": "personGender", "size": 1000}},
        "type": {"terms": {"field": "type", "size": 1000}}
    }
    
    # Create the highlight configuration for person fields
    highlight_config = {
        "fields": {
            "type": {},
            "associatedTradition": {},
            "personGender": {},
            "prefLabel_en": {"fragment_size": 500},
            "prefLabel_bo_x_ewts": {"fragment_size": 500},
            "prefLabel_iast": {"fragment_size": 500},
            "prefLabel_hani": {"fragment_size": 500},
            "prefLabel_khmr": {"fragment_size": 500},
            "comment_en": {},
            "comment_bo_x_ewts": {},
            "comment_iast": {},
            "comment_hani": {},
            "comment_khmr": {},
            "altLabel_en": {"fragment_size": 500},
            "altLabel_bo_x_ewts": {"fragment_size": 500},
            "altLabel_iast": {"fragment_size": 500},
            "altLabel_hani": {"fragment_size": 500},
            "altLabel_khmr": {"fragment_size": 500}
        }
    }
    
    # Build the search payload with Person type filter
    search_fields = [
        "prefLabel_bo_x_ewts^1",
        "prefLabel_en^1",
        "comment_bo_x_ewts^0.0001",
        "comment_en^0.0001",
        "altLabel_bo_x_ewts^0.6",
        "altLabel_en^0.6"
    ]
    
    payload_lines = [
        json.dumps({"index": "bdrc_prod"}),
        json.dumps({
            "from": request.from_,
            "size": request.size,
            "aggs": default_aggs,
            "highlight": highlight_config,
            "query": {
                "function_score": {
                    "script_score": {
                        "script": {
                            "id": "bdrc-score"
                        }
                    },
                    "query": {
                        "bool": {
                            "filter": [
                                {"term": {"type": "Person"}}
                            ],
                            "must": [
                                {
                                    "multi_match": {
                                        "type": "phrase",
                                        "query": request.search_query,
                                        "fields": search_fields
                                    }
                                }
                            ]
                        }
                    }
                }
            }
        })
    ]
    
    # Join with newlines as required by the multi-search format
    payload = '\n'.join(payload_lines) + '\n'
    
    headers = {
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Content-Type': 'application/json'
    }
    
    try:
        response = requests.post(BDRC_ENDPOINT, data=payload, headers=headers, timeout=30)
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=response.text)
        return response.json()
    except requests.exceptions.Timeout:
        raise HTTPException(status_code=504, detail="Request to BDRC API timed out")
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=502, detail=f"Error connecting to BDRC API: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

