import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom'; // to redirect
import API_URL from '../../config';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await axios.post(`${API_URL}/login`, {
        username,
        password,
      });

      const { emp_id, ename, email, role, canAccessAdminPanel } = response.data.employee;

      if (!canAccessAdminPanel || role === "calling") {
        localStorage.clear();
        alert("Sales Managers cannot access the admin panel.");
        return;
      }

      // Save data to localStorage
      localStorage.setItem("isLogin", "true");
      localStorage.setItem("name", ename);
      localStorage.setItem("email", email);
      localStorage.setItem("employeeId", emp_id);
      localStorage.setItem("employeeRole", role);
      localStorage.setItem("token", response.data.token);

      console.log("Login successful");
      navigate(role === "operations" ? "/operations" : "/");

    } catch (error) {
      console.error("Login failed", error);
      alert("Invalid credentials");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8">
        <h2 className="text-2xl font-bold text-center mb-6 text-gray-700">Login</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Username</label>
            <input
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Password</label>
            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg transition"
          >
            Login
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;
