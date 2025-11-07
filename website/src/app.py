import base64
import os
import sqlite3
import hashlib, hmac, binascii, os
import json
from cryptography.fernet import Fernet
from flask import Flask, request, jsonify, g, make_response
from datetime import datetime, timezone
from flask_cors import CORS
from utils.getSessionKey import fetch_session_keys

app = Flask(__name__)
CORS(app, origins=["http://localhost:3000"])
# app.secret_key = os.environ.get("SECRET_KEY", os.urandom(24))  

fernet_key = Fernet.generate_key()
fernet = Fernet(fernet_key)

here = os.path.dirname(__file__)

def _abs(p: str) -> str:
    return os.path.abspath(os.path.expanduser(p))

DATABASE = "users.db"
CONFIG_PATH = 'configs/net1/website.config'

def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DATABASE)
        g.db.row_factory = sqlite3.Row
    return g.db


"""TOKENS = {
    "token_demo_1": os.urandom(32).hex(),  
    "token_demo_2": os.urandom(32).hex(),
} """

def hmac_sha256_hex(key_bytes: bytes, msg_bytes: bytes) -> str:
    return hmac.new(key_bytes, msg_bytes, hashlib.sha256).hexdigest()

@app.post("/api/agent/verify")
def agent_verify():
    data = request.get_json(silent=True) or {}
    token_id = data.get("token_id", "")
    nonce_hex = data.get("nonce_hex", "")
    user_hmac_hex = (data.get("user_hmac_hex", "") or "").lower()

    if not token_id or not nonce_hex or not user_hmac_hex:
        return jsonify(error="missing fields"), 400
    if not (len(nonce_hex) == 32 and all(c in "0123456789abcdefABCDEF" for c in nonce_hex)):
        return jsonify(error="invalid nonce format"), 400
    if not (len(user_hmac_hex) == 64 and all(c in "0123456789abcdef" for c in user_hmac_hex)):
        return jsonify(error="invalid hmac format"), 400

    print('token id: ', token_id)
    # get token with session key ID 
    session_key = fetch_session_keys(CONFIG_PATH, int(token_id))
    print(session_key)
    if not session_key:
        return jsonify(error="Cannot get the session Key"), 401

    try:
        key_bytes = base64.b64decode(session_key)
        nonce_bytes = binascii.unhexlify(nonce_hex)
    except binascii.Error:
        return jsonify(error="bad hex"), 400

    server_hmac_hex = hmac_sha256_hex(key_bytes, nonce_bytes)  # website's calcuation result
    print(server_hmac_hex)

    ok = hmac.compare_digest(server_hmac_hex, user_hmac_hex)
    if not ok:
        return jsonify(error="verification failed"), 401

    resp = make_response(jsonify(ok=True))     # Success
    # resp.set_cookie("session", session_token, httponly=True, secure=True, samesite="Strict")
    return resp, 200



@app.teardown_appcontext
def close_db(error):
    db = g.pop("db", None)
    if db is not None:
        db.close()

def init_db():
    db = get_db()
    db.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    """)
    db.commit()

def hash_password(password: str, salt: str = None):
    if not salt:
        salt = os.urandom(16).hex()
    salted = salt + password
    hashed = hashlib.sha256(salted.encode()).hexdigest()
    return f"{salt}${hashed}"

def verify_password(stored_hash: str, password: str):
    try:
        salt, stored = stored_hash.split("$")
        check = hashlib.sha256((salt + password).encode()).hexdigest()
        return stored == check
    except Exception:
        return False

@app.route("/register", methods=["POST"])
def register():
    data = request.json
    username = data.get("username", "").strip()
    password = data.get("password", "")

    if not username or not password:
        return jsonify({"success": False, "message": "Username or password is missing"}), 400

    db = get_db()
    existing = db.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
    if existing:
        return jsonify({"success": False, "message": "Duplicated user"}), 400

    hashed_pw = hash_password(password)
    db.execute(
        "INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)",
        (username, hashed_pw, datetime.now(timezone.utc).isoformat())
    )
    db.commit()
    return jsonify({"success": True, "message": "Register success"}), 201

@app.route("/login", methods=["POST"])
def login():
    data = request.json
    print(data)
    username = data.get("username", "")
    password = data.get("password", "")

    db = get_db()
    user = db.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()

    if user and verify_password(user["password_hash"], password):
        payload = {
            "user_id": user["id"],
            "username": user["username"],
            "last_seen": datetime.now(timezone.utc).isoformat()
        }
        token = fernet.encrypt(json.dumps(payload).encode()).decode()
        return jsonify({"success": True, "token": token}), 200
    else:
        return jsonify({"success": False, "message": "Log in failed"}), 401

@app.route("/verify-token", methods=["POST"])
def verify_token():
    data = request.json
    token = data.get("token")
    try:
        decrypted = fernet.decrypt(token.encode()).decode()
        return jsonify({"valid": True, "data": json.loads(decrypted)}), 200
    except Exception:
        return jsonify({"valid": False}), 401

if __name__ == "__main__":
    with app.app_context():
        init_db()
    app.run(port=5000, debug=True)
