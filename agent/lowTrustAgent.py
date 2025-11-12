#!/usr/bin/env python3

import os, re, argparse
from io import BytesIO
from time import sleep
from typing import Optional, Tuple, List
from dataclasses import dataclass
from PIL import Image
from time import sleep

from dotenv import load_dotenv
import helium
from helium import Link, Text, click, scroll_down
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

from smolagents import CodeAgent, tool, TransformersModel
from smolagents.agents import ActionStep
from smolagents import Model

from transformers import AutoModelForCausalLM, AutoTokenizer
import torch

from urllib.parse import urlparse, parse_qs
import subprocess, shlex, json, base64, os, re

load_dotenv()

temp_dir = f"~/data/tmp/helium_data_{os.getpid()}"
firefox_options = webdriver.FirefoxOptions()
firefox_options.add_argument("--force-device-scale-factor=1")
firefox_options.add_argument("--window-size=1200,1400")
firefox_options.add_argument("--window-position=0,0")
firefox_options.set_preference("intl.accept_languages", "en-US, en")

driver = helium.start_firefox(headless=False, options=firefox_options)

CONFIG_PATH = 'configs/net1/lowTrustAgent.config'

HEX32 = re.compile(r"\b[a-fA-F0-9]{32}\b")

# -------------------------
# get session key

def _abs(p: str) -> str:
    return os.path.abspath(os.path.expanduser(p))

def _parse_last_json_line(stdout: str) -> dict:
    for line in reversed(stdout.strip().splitlines()):
        line = line.strip()
        if line.startswith("{") and line.endswith("}"):
            return json.loads(line)
    raise ValueError("No JSON line found in Node output")

def fetch_session_keys(config_path: str, key_id: int):
    agent_dir = _abs(os.path.join(here, '../../../iotauth/entity/node/example_entities'))
    cmd = f'node agent.js {shlex.quote(config_path)} keyId {int(key_id)}'
    p = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=30, cwd=agent_dir)
    if p.returncode != 0:
        raise RuntimeError(p.stderr.strip() or p.stdout.strip() or "node error")

    data = _parse_last_json_line(p.stdout)
    print(data)
    session_key_value = []
    for k in data.get("session_keys", []):
        session_key_value.append({
            "id": int(k["id"]), 
            "cipherKey": (k["cipherKey_b64"]),  
            "macKey": base64.b64decode(k["macKey_b64"]),       
            "absValidity": k.get("absValidity"),
            "relValidity": k.get("relValidity"),
        })
    if not session_key_value:
        raise ValueError("Empty session_keys in JSON")
    return session_key_value

def get_session_key(key_id: int):
    session_key_value = fetch_session_keys(CONFIG_PATH, int(key_id))
    session_key = session_key_value[0]["cipherKey"]
    return session_key


# ex) _exists(By.ID, "ap_email")
def _exists(by: By, val: str) -> bool:  
    try:
        driver.find_element(by, val)
        return True
    except Exception:
        return False
    
def _text_or_value(el):
    try:
        v = el.get_attribute("value")
        if v: return v.strip()
    except Exception:
        pass
    try:
        t = el.text
        if t: return t.strip()
    except Exception:
        pass
    return ""

def go_to(url: str) -> str:
    driver.get(url)
    return f"Navigated to {url}"

def finish_session() -> str:
    sleep(5)
    driver.quit()
    return "Browser closed"


def get_nonce() -> str:
    try:
        for sel in [
            (By.ID, "nonceHex"),
        ]:
            els = driver.find_elements(*sel)
    except Exception:
        pass
    val = _text_or_value(els)
    m = HEX32.search(val or "")
    if m:
        return m.group(0)
    
    try:
        texts = helium.find_all(Text)
        for t in texts:
            v = str(t.web_element.text).strip()
            m = HEX32.search(v)
            if m:
                return m.group(0)
    except Exception:
        pass

    raise RuntimeError("Nonce (32 hex) not found on page")

def login(hmac_hex: str) -> str:
    hmac_input = None
    selectors = [
        (By.ID, "hmac"),
        (By.NAME, "hmac"),
        (By.CSS_SELECTOR, "input[placeholder*='HMAC']"),
        (By.CSS_SELECTOR, "input[aria-label*='HMAC']"),
    ]
    for sel in selectors:
        try:
            el = WebDriverWait(driver, 3).until(
                EC.presence_of_element_located(sel)
            )
            if el:
                hmac_input = el
                break
        except Exception:
            pass

    if hmac_input is None:
        try:
            helium.write(hmac_hex, into="HMAC-SHA256 (64-hex)")
        except Exception:
            raise RuntimeError("HMAC input not found")
    else:
        hmac_input.clear()
        hmac_input.send_keys(hmac_hex)    

    clicked = False
    try:
        helium.click("Verify")
        clicked = True
    except Exception:
        pass
    
    if not clicked:
        try:
            btn = WebDriverWait(driver, 2).until(
                EC.element_to_be_clickable((By.CSS_SELECTOR, "button[type='submit'], button.primary"))
            )
            btn.click()
            clicked = True
        except Exception:
            pass

    if not clicked:
        raise RuntimeError("Submit button not found")

    sleep(1.0)
    return "Login submitted"


AGENT_SYSTEM_PROMPT = """
Always call the registered tools functions directly.
Print each steps' description.
Do NOT invent or assume any functions that are not in the registered tool list.

Use get_nonce() to read the 32-hex nonce from the page.

Compute HMAC-SHA256 where:
 - key is the base64 session_key
 - message is the hexadecimal nonce
Login with login(HMAC) using computed hmac.

Click each bars to get desired items using clickItems().

"""

def build_agent():
    model_id = "meta-llama/Llama-3.1-8B-Instruct" # "meta-llama/Llama-3.1-8B-Instruct"

    model = TransformersModel(model_id=model_id)

    agent = CodeAgent(
        tools=[
            go_to, finish_session, get_session_key, get_nonce,
        ],
        model=model,
        max_steps=5,
        verbosity_level=2,
         additional_authorized_imports=["helium", "re", "hmac", "hashlib", "base64", "binascii"]
    )
    agent.python_executor("from helium import *")
    return agent

def parse_args():
    ap = argparse.ArgumentParser(description="Interact with website on behalf of users")
    ap.add_argument("--keyId", required=True, type=int, help="Session Key Id from user")
    ap.add_argument("--items", required=True, help="")
    return ap.parse_args()

def main():
    args = parse_args()
    agent = build_agent()

    task = f"""
        Go to https://localhost:3000/agent-login.
        Use get_nonce() to read the 32-hex nonce from the page.
        Use get_session_key({args.keyId}) to get the base64 session key.
        Compute HMAC and then login with login(<hmac_hex>).
        After login, navigate to https://localhost:3000/dashboard.
        Get {args.items} from the website. 
        """
    out = agent.run(task + AGENT_SYSTEM_PROMPT)
    print("\n=== FINAL OUTPUT ===")
    print(out)

if __name__ == "__main__":
    try:
        main()
    finally:
        pass

