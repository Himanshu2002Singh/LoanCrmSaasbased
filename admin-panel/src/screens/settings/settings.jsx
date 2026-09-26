import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Building2, ChevronRight, Clock, Mail, ShieldCheck } from 'lucide-react';
import axios from 'axios';
import API_URL from '../../config';

const SettingsScreen = () => {
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [radius, setRadius] = useState('');
  const [inTime, setInTime] = useState('10:00');
  const [outTime, setOutTime] = useState('19:00');
  const [lateBuffer, setLateBuffer] = useState('10');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setIsLoading(true);
      const res = await axios.get(`${API_URL}/settings`);
      const data = res.data.data;
      if (data.office_location) {
        setLatitude(data.office_location.lat || '');
        setLongitude(data.office_location.lng || '');
        setRadius(data.office_location.radius || '');
      }
      if (data.office_timings) {
        setInTime(data.office_timings.in_time || '10:00');
        setOutTime(data.office_timings.out_time || '19:00');
        setLateBuffer(data.office_timings.late_buffer || '10');
      }
    } catch (error) {
      console.error('Failed to fetch settings', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      setMessage('');
      
      const payload = {
        office_location: {
          lat: parseFloat(latitude),
          lng: parseFloat(longitude),
          radius: parseFloat(radius),
        },
        office_timings: {
          in_time: inTime,
          out_time: outTime,
          late_buffer: parseInt(lateBuffer),
        }
      };

      await axios.put(`${API_URL}/settings`, payload);
      setMessage('Settings saved successfully!');
    } catch (error) {
      console.error('Failed to save settings', error);
      setMessage('Failed to save settings. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">System Settings</h1>

      {/* Company Profile & Subscription Link Card */}
      <Link
        to="/company"
        className="block mb-4 p-5 rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 shadow-sm hover:shadow-md transition-all text-decoration-none group"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-700 text-white flex items-center justify-center shadow">
              <Building2 size={24} />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 group-hover:text-emerald-800 flex items-center gap-2">
                Company Profile & Subscription Plan
              </h3>
              <p className="text-xs text-gray-600 mt-0.5">
                View your company details, active subscription tier, seat limits, and team distribution.
              </p>
            </div>
          </div>
          <div className="flex items-center text-emerald-700 font-semibold text-xs gap-1">
            <span>View Details</span>
            <ChevronRight size={16} />
          </div>
        </div>
      </Link>

      {/* Role & Feature Permissions Link Card */}
      <Link
        to="/role-permissions"
        className="block mb-6 p-5 rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 shadow-sm hover:shadow-md transition-all text-decoration-none group"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow">
              <ShieldCheck size={24} />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 group-hover:text-blue-800 flex items-center gap-2">
                Role Permissions & Confidential Data Control
              </h3>
              <p className="text-xs text-gray-600 mt-0.5">
                Manage page access and protect confidential financial data (Payouts, Connectors, Expenses) for Managers, Ops, and Sales.
              </p>
            </div>
          </div>
          <div className="flex items-center text-blue-700 font-semibold text-xs gap-1">
            <span>Manage Roles</span>
            <ChevronRight size={16} />
          </div>
        </div>
      </Link>

      {/* Outgoing Email & Gmail (SMTP) Configuration Link Card */}
      <Link
        to="/email-templates"
        className="block mb-6 p-5 rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 shadow-sm hover:shadow-md transition-all text-decoration-none group"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow">
              <Mail size={24} />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 group-hover:text-emerald-800 flex items-center gap-2">
                Outgoing Email & Gmail (SMTP) Credentials
              </h3>
              <p className="text-xs text-gray-600 mt-0.5">
                Set company sender email and Google 16-digit App Password so bankers, lenders, and partners receive all loan files from your address.
              </p>
            </div>
          </div>
          <div className="flex items-center text-emerald-700 font-semibold text-xs gap-1">
            <span>Configure Email</span>
            <ChevronRight size={16} />
          </div>
        </div>
      </Link>
      
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-700 mb-4 border-b pb-2 flex items-center gap-2">
          <Clock size={20} className="text-emerald-700" />
          Attendance Configuration
        </h2>
        
        {message && (
          <div className={`p-3 mb-4 rounded ${message.includes('success') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {message}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Office Latitude</label>
              <input
                type="number"
                step="any"
                required
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                className="w-full border px-4 py-2 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g. 28.583967"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Office Longitude</label>
              <input
                type="number"
                step="any"
                required
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                className="w-full border px-4 py-2 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g. 77.313246"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Allowed Radius (Meters)</label>
            <input
              type="number"
              required
              value={radius}
              onChange={(e) => setRadius(e.target.value)}
              className="w-full border px-4 py-2 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g. 20"
            />
            <p className="text-xs text-gray-500 mt-1">Employees must be within this radius to mark attendance.</p>
          </div>

          <h2 className="text-xl font-semibold text-gray-700 mt-8 mb-4 border-b pb-2">Office Timings</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">In Time</label>
              <input
                type="time"
                required
                value={inTime}
                onChange={(e) => setInTime(e.target.value)}
                className="w-full border px-4 py-2 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Out Time</label>
              <input
                type="time"
                required
                value={outTime}
                onChange={(e) => setOutTime(e.target.value)}
                className="w-full border px-4 py-2 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Late Buffer (Minutes)</label>
            <input
              type="number"
              required
              value={lateBuffer}
              onChange={(e) => setLateBuffer(e.target.value)}
              className="w-full border px-4 py-2 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g. 10"
            />
            <p className="text-xs text-gray-500 mt-1">Employees are marked late if they arrive this many minutes after In Time.</p>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-2 px-4 rounded-md text-white font-medium ${isLoading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
              {isLoading ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SettingsScreen;
