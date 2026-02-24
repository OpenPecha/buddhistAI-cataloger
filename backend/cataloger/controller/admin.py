import json
import requests
from fastapi import HTTPException

URL = "https://script.googleusercontent.com/macros/echo?user_content_key=AehSKLg989QChyu2WyE8WNwr1JNEU1gFBh_TQq83ijH9Cc6xb4UdCTWSCFHzvmLXvJdzMyROCIqaeQaMiRmVeC8-adr04xFrZqLsz8GbPAzE_3F3Ecm0KH5jlAO0_tY4gLAhz2e4Jx0ZhfUd7FyJKphl0KS2A91sZjcYan1cTpIcb3mv6ExoiBDyBPNW0xvB-8V6xFsQinagbTsAlVe_RqS2yyTNoNE2Kr0-Waayqk5xOIQVDArboFlG7AbVbHcCb1n3mDEM1uPJ4VcRUT1_ZpFE_MNEKACqeg&lib=MmHielNiLvH2jcwLZoFtv8BN9oEKIRyVd"

def get_permission(email: str):
        response = requests.get(URL)
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=response.text)

        users_data = response.json()
        data_list = users_data.get('data', [])

        user = next((user for user in data_list if user.get('email') == email), None)
        if user:
            return user
        else:
            raise HTTPException(status_code=401, detail="user not found")
  