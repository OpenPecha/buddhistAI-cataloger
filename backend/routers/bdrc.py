import asyncio
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import httpx
import json
import logging
from rdflib import Graph, Namespace, Literal
from rdflib.namespace import SKOS
import os
from dotenv import load_dotenv
import pyewts

from routers.person import get_person, Person
load_dotenv(override=True)

router = APIRouter()
converter = pyewts.pyewts()
BDRC_ENDPOINT = os.getenv("BDRC_SEARCH_ENDPOINT")

# Async HTTP client with connection pooling (reused across requests)
_http_client: Optional[httpx.AsyncClient] = None

async def get_http_client() -> httpx.AsyncClient:
    """Get or create shared async HTTP client with connection pooling"""
    global _http_client
    if _http_client is None:
        _http_client = httpx.AsyncClient(
            timeout=httpx.Timeout(10.0),
            limits=httpx.Limits(max_keepalive_connections=20, max_connections=100),
            follow_redirects=True
        )
    return _http_client

# In-memory cache for TTL data and parsed RDF graphs
# Using simple dict with LRU-like behavior (can be replaced with Redis)
_ttl_cache: Dict[str, str] = {}
_parsed_graph_cache: Dict[str, Graph] = {}
_cache_max_size = 1000

def _get_cached_ttl(resource_id: str) -> Optional[str]:
    """Get cached TTL data"""
    return _ttl_cache.get(resource_id)

def _set_cached_ttl(resource_id: str, ttl_data: str):
    """Cache TTL data with size limit"""
    if len(_ttl_cache) >= _cache_max_size:
        # Remove oldest entry (simple FIFO)
        oldest_key = next(iter(_ttl_cache))
        del _ttl_cache[oldest_key]
        if oldest_key in _parsed_graph_cache:
            del _parsed_graph_cache[oldest_key]
    _ttl_cache[resource_id] = ttl_data

def _get_cached_graph(resource_id: str) -> Optional[Graph]:
    """Get cached parsed RDF graph"""
    return _parsed_graph_cache.get(resource_id)

def _set_cached_graph(resource_id: str, graph: Graph):
    """Cache parsed RDF graph"""
    if len(_parsed_graph_cache) >= _cache_max_size:
        oldest_key = next(iter(_parsed_graph_cache))
        del _parsed_graph_cache[oldest_key]
    _parsed_graph_cache[resource_id] = graph

# Constants moved outside route handler (built once, reused)
DEFAULT_AGGS = {
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
    "workIsAbout": {"terms": {"field": "workIsAbout", "size": 1000}}
}

HIGHLIGHT_CONFIG = {
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

SEARCH_FIELDS = [
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

# RDF namespaces (defined once)
BDO = Namespace("http://purl.bdrc.io/ontology/core/")
BDR = Namespace("http://purl.bdrc.io/resource/")
HTTP_PREFIX = "http://"
URI_SEPARATOR = ":"


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
            "aggs": DEFAULT_AGGS,
            "highlight": HIGHLIGHT_CONFIG,
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
                                        "fields": SEARCH_FIELDS
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
        client = await get_http_client()
        response = await client.post(BDRC_ENDPOINT, content=payload, headers=headers)
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
                    instance_id = hit.get("_id")
                    merged = source.get("merged")
                    if merged and instance_id:
                        # If merged is a list, create pairs for each work ID
                        if isinstance(merged, list):
                            for work_id in merged:
                                work_instance_pairs.append((work_id, instance_id))
                        else:
                            # If merged is a single item, create one pair
                            work_instance_pairs.append((merged, instance_id))
            
            # Fetch work details if we have work-instance pairs
            work_details = []
            if work_instance_pairs:
                # Limit to first pair (matching current behavior)
                limited_pairs = work_instance_pairs[:1]
                work_details = await fetch_work_details(limited_pairs)
            
            # Return only work details for Instance searches
            return work_details
        
        # For Person searches, return simplified format with Unicode conversion
        elif request.type == "Person":
            formatted_results = []
            if "responses" in search_results and len(search_results["responses"]) > 0:
                hits = search_results["responses"][0].get("hits", {}).get("hits", [])
                # Limit to maximum 10 results
                for hit in hits[:10]:
                    source = hit.get("_source", {})
                    
                    # Get prefLabel_bo_x_ewts and convert to Unicode
                    pref_label_ewts = source.get("prefLabel_bo_x_ewts", [])
                    name = ""
                    
                    if pref_label_ewts:
                        # Get the first label if it's a list
                        label = pref_label_ewts[0] if isinstance(pref_label_ewts, list) else pref_label_ewts
                        if label:
                            name = converter.toUnicode(label)
                    
                    person_data = {
                        "bdrc_id": hit.get("_id"),
                        "name": name
                    }
                    formatted_results.append(person_data)
            return formatted_results
        
        # For other types, return original response
        return search_results
        
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Request to BDRC API timed out")
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"Error connecting to BDRC API: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/work/{work_id}/instances/{instance_id}")
async def get_work_instance(work_id: str, instance_id: str):
    work_details = await fetch_work_details([(work_id, instance_id)])
    return work_details[0] if work_details else None


class Creator(BaseModel):
    creator: Optional[str] = None  # Creator entity ID like CR7FBB8DAF61E7BE24
    agent: Optional[str] = None  # Person ID like P1KG4922
    agentName: Optional[str] = None  # Person name from BDRC
    role: Optional[str] = None  # Role ID like R0ER0019
    roleName: Optional[str] = None  # Role name from BDRC


class WorkDetail(BaseModel):
    workId: str
    instanceId: str  # BDRC instance ID from search results
    title: Optional[str] = None
    catalogInfo: Optional[str] = None
    contributors: List[Creator] = []  # List of creators with their roles
    language: Optional[str] = None
    entityScore: Optional[int] = None


class EnhancedSearchResponse(BaseModel):
    search_results: Dict[str, Any]
    work_details: List[WorkDetail] = []


class BdrcPersonSearchRequest(BaseModel):
    search_query: str
    from_: int = Field(default=0, alias="from")
    size: int = 20


async def fetch_ttl_async(resource_id: str, resource_type: str = "resource") -> Optional[str]:
    """Fetch TTL data from BDRC with caching"""
    # Check cache first
    cached_ttl = _get_cached_ttl(resource_id)
    if cached_ttl is not None:
        return cached_ttl
    
    try:
        url = f"https://ldspdi.bdrc.io/{resource_type}/{resource_id}.ttl"
        client = await get_http_client()
        response = await client.get(url)
        
        if response.status_code != 200:
            logging.warning(f"Failed to fetch {resource_type} {resource_id}: HTTP {response.status_code}")
            return None
        
        ttl_data = response.text
        _set_cached_ttl(resource_id, ttl_data)
        return ttl_data
        
    except Exception as e:
        logging.error(f"Error fetching {resource_type} {resource_id}: {str(e)}")
        return None


async def parse_rdf_graph(resource_id: str, ttl_data: str) -> Optional[Graph]:
    """Parse RDF TTL data with caching"""
    # Check cache first
    cached_graph = _get_cached_graph(resource_id)
    if cached_graph is not None:
        return cached_graph
    
    try:
        g = Graph()
        g.parse(data=ttl_data, format="turtle")
        _set_cached_graph(resource_id, g)
        return g
    except Exception as e:
        logging.error(f"Error parsing RDF for {resource_id}: {str(e)}")
        return None


async def get_person_from_bdrc(person_id: str) -> Optional[str]:
    """Fetch person details from BDRC RDF endpoint and return prefLabel"""
    if not person_id:
        return None
    
    ttl_data = await fetch_ttl_async(person_id, "resource")
    if not ttl_data:
        return None
    
    graph = await parse_rdf_graph(person_id, ttl_data)
    if not graph:
        return None
    
    # Find the person subject (bdr:{person_id})
    person_subject = BDR[person_id]
    
    # Get prefLabel (skos:prefLabel) for this person - can have language tags
    for obj in graph.objects(subject=person_subject, predicate=SKOS.prefLabel):
        # Check if it's a Literal with language tag
        if isinstance(obj, Literal) and obj.language:
            lang = obj.language.lower()
            name = str(obj)
            
            # If English, return as is
            if lang == "en":
                return name
            # If Tibetan (bo or bo-x-ewts), convert to Unicode
            elif lang.startswith("bo"):
                return converter.toUnicode(name)
            # For other languages, return as is
            else:
                return name
        else:
            # No language tag, return as is
            return str(obj)
    
    return None


async def get_role_from_bdrc(role_id: str) -> Optional[str]:
    """Fetch role details from BDRC RDF endpoint and return prefLabel"""
    if not role_id:
        return None
    
    ttl_data = await fetch_ttl_async(role_id, "resource")
    if not ttl_data:
        return None
    
    graph = await parse_rdf_graph(role_id, ttl_data)
    if not graph:
        return None
    
    # Find the role subject (bdr:{role_id})
    role_subject = BDR[role_id]
    
    # Collect all prefLabels with their language tags
    pref_labels = []
    for obj in graph.objects(subject=role_subject, predicate=SKOS.prefLabel):
        if isinstance(obj, Literal) and obj.language:
            lang = obj.language.lower()
            name = str(obj)
            pref_labels.append((lang, name))
        else:
            # No language tag, add as fallback
            pref_labels.append(("", str(obj)))
    
    if not pref_labels:
        return None
    
    # Prioritize: English first, then Tibetan (converted), then others
    # First, try to find English
    for lang, name in pref_labels:
        if lang == "en":
            return name
    
    # If no English, try Tibetan (convert to Unicode)
    for lang, name in pref_labels:
        if lang.startswith("bo"):
            return converter.toUnicode(name)
    
    # Otherwise, return the first available label
    return pref_labels[0][1]


def extract_id_from_uri(uri: str) -> str:
    """Extract resource ID from URI (handles both full URI and prefixed forms)"""
    if uri.startswith(HTTP_PREFIX):
        return uri.split("/")[-1]
    elif URI_SEPARATOR in uri:
        return uri.split(URI_SEPARATOR)[-1]
    else:
        return uri


async def fetch_work_details(work_instance_pairs: List[tuple]) -> List[WorkDetail]:
    """Fetch work details from BDRC RDF endpoints with optimized batching"""
    if not work_instance_pairs:
        return []
    
    # Step 1: Fetch all work TTLs concurrently
    work_ids = [work_id for work_id, _ in work_instance_pairs]
    # Schedule all fetch_ttl_async calls concurrently for true parallelism
    work_ttl_tasks = [asyncio.create_task(fetch_ttl_async(work_id, "resource")) for work_id in work_ids]
    work_ttls = await asyncio.gather(*work_ttl_tasks, return_exceptions=True)
    
    # Step 2: Parse all work graphs concurrently
    async def parse_work_graph(work_id: str, ttl_data: Any) -> Optional[Graph]:
        if isinstance(ttl_data, Exception) or not ttl_data:
            return None
        return await parse_rdf_graph(work_id, ttl_data)
    
    work_graph_tasks = [
        parse_work_graph(work_id, ttl_data) 
        for work_id, ttl_data in zip(work_ids, work_ttls)
    ]
    work_graphs = await asyncio.gather(*work_graph_tasks, return_exceptions=True)
    work_graphs = [g if not isinstance(g, Exception) else None for g in work_graphs]
    
    # Step 3: Extract creator IDs from all works and collect unique IDs
    all_creator_ids = set()
    all_agent_ids = set()
    all_role_ids = set()
    work_creators_map = {}  # Maps work_id -> list of creator info dicts
    
    for work_id, graph in zip(work_ids, work_graphs):
        if not graph:
            work_creators_map[work_id] = {
                "pref_label": None,
                "catalog_info": None,
                "language": None,
                "creators": []
            }
            continue
        
        creators_list = []
        
        # Get prefLabel, catalogInfo, language from work graph
        # Using subject=None to match original behavior (queries all subjects)
        pref_label = None
        catalog_info = None
        language = None
        
        for obj in graph.objects(subject=None, predicate=SKOS.prefLabel):
            pref_label = str(obj)
            break
        
        for obj in graph.objects(subject=None, predicate=BDO.catalogInfo):
            catalog_info = str(obj)
            break
        
        for obj in graph.objects(subject=None, predicate=BDO.language):
            language_uri = str(obj)
            language_code = language_uri.split("/")[-1]
            if language_code.startswith("Lang"):
                language = language_code[4:].lower()
            else:
                language = language_code.lower()
            break
        
        # Get all creators (bdo:creator)
        for obj in graph.objects(subject=None, predicate=BDO.creator):
            creator_uri = str(obj)
            creator_id = extract_id_from_uri(creator_uri)
            if creator_id:
                all_creator_ids.add(creator_id)
                creators_list.append({"creator_id": creator_id})
        
        work_creators_map[work_id] = {
            "pref_label": pref_label,
            "catalog_info": catalog_info,
            "language": language,
            "creators": creators_list
        }
    
    # Step 4: Fetch all creator TTLs concurrently
    creator_ttl_tasks = [fetch_ttl_async(creator_id, "resource") for creator_id in all_creator_ids]
    creator_ttls = await asyncio.gather(*creator_ttl_tasks, return_exceptions=True)
    
    # Step 5: Parse all creator graphs concurrently and extract agent/role IDs
    async def parse_creator_graph(creator_id: str, ttl_data: Any) -> Optional[Dict[str, Optional[str]]]:
        if isinstance(ttl_data, Exception) or not ttl_data:
            return None
        
        graph = await parse_rdf_graph(creator_id, ttl_data)
        if not graph:
            return None
        
        creator_subject = BDR[creator_id]
        agent_id = None
        role_id = None
        
        # Get agent (bdo:agent)
        for agent_obj in graph.objects(subject=creator_subject, predicate=BDO.agent):
            agent_uri = str(agent_obj)
            agent_id = extract_id_from_uri(agent_uri)
            break
        
        # Get role (bdo:role)
        for role_obj in graph.objects(subject=creator_subject, predicate=BDO.role):
            role_uri = str(role_obj)
            role_id = extract_id_from_uri(role_uri)
            break
        
        return {
            "agent_id": agent_id,
            "role_id": role_id
        }
    
    creator_graph_tasks = [
        parse_creator_graph(creator_id, ttl_data)
        for creator_id, ttl_data in zip(all_creator_ids, creator_ttls)
    ]
    creator_results = await asyncio.gather(*creator_graph_tasks, return_exceptions=True)
    
    creator_agent_role_map = {}  # Maps creator_id -> {agent_id, role_id}
    for creator_id, result in zip(all_creator_ids, creator_results):
        if isinstance(result, Exception) or not result:
            continue
        
        agent_id = result.get("agent_id")
        role_id = result.get("role_id")
        
        if agent_id:
            all_agent_ids.add(agent_id)
        if role_id:
            all_role_ids.add(role_id)
        
        creator_agent_role_map[creator_id] = result
    
    # Step 6: Update work creators with agent/role IDs
    for work_id, work_data in work_creators_map.items():
        for creator_info in work_data["creators"]:
            creator_id = creator_info["creator_id"]
            if creator_id in creator_agent_role_map:
                creator_info.update(creator_agent_role_map[creator_id])
    
    # Step 7: Fetch all person and role names concurrently
    person_tasks = [get_person_from_bdrc(agent_id) for agent_id in all_agent_ids]
    role_tasks = [get_role_from_bdrc(role_id) for role_id in all_role_ids]
    
    person_results = await asyncio.gather(*person_tasks, return_exceptions=True)
    role_results = await asyncio.gather(*role_tasks, return_exceptions=True)
    
    # Step 8: Build lookup maps
    person_map = {
        agent_id: result if not isinstance(result, Exception) else None
        for agent_id, result in zip(all_agent_ids, person_results)
    }
    role_map = {
        role_id: result if not isinstance(result, Exception) else None
        for role_id, result in zip(all_role_ids, role_results)
    }
    
    # Step 9: Build final work details
    work_details = []
    for (work_id, instance_id), work_data in zip(work_instance_pairs, [work_creators_map.get(wid, {}) for wid in work_ids]):
        if not work_data:
            continue
        
        creators_objects = []
        for creator_info in work_data.get("creators", []):
            agent_id = creator_info.get("agent_id")
            role_id = creator_info.get("role_id")
            
            creators_objects.append(Creator(
                creator=creator_info.get("creator_id"),
                agent=agent_id,
                agentName=person_map.get(agent_id) if agent_id else None,
                role=role_id,
                roleName=role_map.get(role_id) if role_id else None
            ))
        
        pref_label = work_data.get("pref_label")
        work_details.append(WorkDetail(
            workId=work_id,
            instanceId=instance_id,
            title=converter.toUnicode(pref_label) if pref_label else None,
            catalogInfo=work_data.get("catalog_info"),
            contributors=creators_objects,
            language=work_data.get("language"),
        ))
    
    return work_details
