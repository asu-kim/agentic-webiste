import os
import sqlite3
import hashlib
import json
from cryptography.fernet import Fernet
from flask import Flask, request, jsonify, g
from datetime import datetime, timezone
from flask_cors import CORS

app = Flask(__name__)
CORS(app, origins=["http://localhost:3000"])
# app.secret_key = os.environ.get("SECRET_KEY", os.urandom(24))  

fernet_key = Fernet.generate_key()
fernet = Fernet(fernet_key)

DATABASE = "users.db"

def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DATABASE)
        g.db.row_factory = sqlite3.Row
    return g.db

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
    app.run(host="0.0.0.0", port=5001, debug=True)
