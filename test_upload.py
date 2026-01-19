#!/usr/bin/env python3

import requests
import json

# Test the upload endpoint
API_URL = "http://localhost:8000"

def test_file_upload():
    """Test uploading a file"""
    print("Testing file upload...")
    
    # Create a test file
    test_content = "This is a test document for the outliner application."
    files = {
        'file': ('test_document.txt', test_content, 'text/plain')
    }
    data = {
        'user_id': 'test_user'
    }
    
    response = requests.post(f"{API_URL}/outliner/documents/upload", files=files, data=data)
    
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
    
    if response.status_code == 201:
        print("File upload successful!")
        return response.json()
    else:
        print("File upload failed!")
        return None

def test_content_upload():
    """Test uploading content directly"""
    print("\nTesting content upload...")
    
    data = {
        'content': 'This is a test document sent as form data.',
        'filename': 'content_document.txt',
        'user_id': 'test_user'
    }
    
    response = requests.post(f"{API_URL}/outliner/documents/upload", data=data)
    
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
    
    if response.status_code == 201:
        print("Content upload successful!")
        return response.json()
    else:
        print("Content upload failed!")
        return None

def test_empty_upload():
    """Test uploading with no file or content"""
    print("\nTesting empty upload...")
    
    data = {
        'user_id': 'test_user'
    }
    
    response = requests.post(f"{API_URL}/outliner/documents/upload", data=data)
    
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
    
    if response.status_code == 400:
        print("Empty upload correctly rejected!")
    else:
        print("Empty upload should have been rejected!")

if __name__ == "__main__":
    print("Testing Outliner Document Upload Endpoint")
    print("=" * 50)
    
    try:
        test_file_upload()
        test_content_upload()
        test_empty_upload()
    except requests.exceptions.ConnectionError:
        print("Could not connect to the API server. Make sure it's running on http://localhost:8000")
    except Exception as e:
        print(f"Error during testing: {e}")