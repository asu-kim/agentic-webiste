import React, { useState } from 'react';
import { useNavigate } from "react-router-dom";
import axios from "axios";
import './App.css';

export default function Login(){
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  const login = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post("http://localhost:5001/login", {
        username:username, password:password
      });
      if (res.data.success) {
        localStorage.setItem("token", res.data.token);
        localStorage.setItem("username", username);
        setMessage("Login success");
        navigate("/dashboard"); 
      } else {
        setMessage("Login fail " + res.data.message);
      }
    }
    catch (err) {
      setMessage("Cannot log in " + err);
    }
  }

  const register = async (e) => {
    e.preventDefault();

    try{
      const res = await axios.post("http://localhost:5001/register", {
        username: username, password: password
      });

      if (res.data.success){
        setMessage("Registered. Auto log-in");
        const res = await axios.post("http://localhost:5001/login", {
          username:username, password:password
        });
        if (res.data.success) {
          localStorage.setItem("token", res.data.token);
          localStorage.setItem("username", username);
          setMessage("Login success");
          navigate("/dashboard");
        } else {
          setMessage("Login fail " + res.data.message);
        }
      } else {
        setMessage("Register failed: " + res.data.message);
      }
    } catch (err) {
        setMessage("Cannot registered " + err);
    }
    
  }

  return (
    <div className='style'>
      <h2 className='margin'>Log in</h2>
      <form className='margin'>
        <input
          type='text'
          placeholder='ID'
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <br />
        <input
          type='password'
          placeholder='Password'
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <br />
        <button onClick={register}>Register</button>
        <button onClick={login}>Log in</button>
      </form>
      <p className='margin'>{message}</p>
    </div>
  )
}

