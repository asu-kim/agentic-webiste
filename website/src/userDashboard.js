import React, { useEffect, useState} from "react";
import './App.css';

export default function UserDashboard(){
  const [user, setUser] = useState("Guest");

  useEffect(() => {
    setUser(localStorage.getItem("username") || "Guest");
  }, []);

  return (
    <div className="access-wrap">
        <h1 className="title">User Dashboard</h1>
        <p className="subtle">Hello, <span className="mono">{user}</span></p>

        <div className="bar">
        <a className="btn primary" href="/access-control">Open Agent Access Control</a>
        </div>

        <p className="margin">
            Define which agent trust levels (High/Medium/Low) may access specific data scopes (email, address, card number, phone).
            Your selections are saved per-user in the browser and can optionally be synced to the server.
        </p>
    </div>
  );
}