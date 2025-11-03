import React from 'react';
import { useNavigate } from 'react-router-dom';
import './App.css';

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="home-container">
      <h1>Welcome to Secure Access Portal</h1>
      <div className="button-group">
        <button onClick={() => navigate('/login')}>Human User Login</button>
        <button onClick={() => navigate('/agent-login')}>AI Agent Login</button>
      </div>
    </div>
  );
}
