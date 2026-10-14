import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  ChevronRight,
  Clock,
  Mail,
  ShieldCheck,
  FileSpreadsheet,
  MapPin,
  Landmark,
  Save,
  CheckCircle2,
  AlertCircle,
  Navigation,
  RefreshCw,
  FileText
} from 'lucide-react';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import API_URL from '../../config';

const SettingsScreen = () => {
  // Navigation Tabs
  const [activeTab, setActiveTab] = useState('COMPANY_BILLING'); // 'COMPANY_BILLING' | 'ATTENDANCE'

  // Company GST & Billing Details
  const [companyName, setCompanyName] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  const [billingEmail, setBillingEmail] = useState('');
  const [billingPhone, setBillingPhone] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [bankBranch, setBankBranch] = useState('');

  // Attendance & Geofencing
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [radius, setRadius] = useState('200');
  const [inTime, setInTime] = useState('10:00');
  const [outTime, setOutTime] = useState('19:00');
  const [lateBuffer, setLateBuffer] = useState('10');

  // Loading States
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingCompany, setIsSavingCompany] = useState(false);
  const [isSavingAttendance, setIsSavingAttendance] = useState(false);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setIsLoading(true);
      const res = await axios.get(`${API_URL}/settings`);
      const data = res.data?.data;

      if (data?.company_details) {
        setCompanyName(data.company_details.name || '');
        setGstNumber(data.company_details.gst_number || '');
        setPanNumber(data.company_details.pan_number || '');
        setAddress(data.company_details.address || '');
        setCity(data.company_details.city || '');
        setState(data.company_details.state || '');
        setPincode(data.company_details.pincode || '');
        setBillingEmail(data.company_details.email || '');
        setBillingPhone(data.company_details.phone || '');
        setBankName(data.company_details.bank_name || '');
        setAccountNumber(data.company_details.account_number || '');
        setIfscCode(data.company_details.ifsc_code || '');
        setBankBranch(data.company_details.bank_branch || '');
      }

      if (data?.office_location) {
        setLatitude(data.office_location.lat !== undefined ? String(data.office_location.lat) : '');
        setLongitude(data.office_location.lng !== undefined ? String(data.office_location.lng) : '');
        setRadius(data.office_location.radius !== undefined ? String(data.office_location.radius) : '200');
      }

      if (data?.office_timings) {
        setInTime(data.office_timings.in_time || '10:00');
        setOutTime(data.office_timings.out_time || '19:00');
        setLateBuffer(data.office_timings.late_buffer !== undefined ? String(data.office_timings.late_buffer) : '10');
      }
    } catch (error) {
      console.error('Failed to fetch settings', error);
      toast.error('Failed to load settings from server');
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-fill PAN from GSTIN if 15 chars (chars 3 to 12)
  const handleGstChange = (val) => {
    const upper = val.toUpperCase().trim();
    setGstNumber(upper);
    if (upper.length === 15 && !panNumber) {
      const extractedPan = upper.substring(2, 12);
      setPanNumber(extractedPan);
    }
  };

  // Save Company GST & Billing Details
  const handleSaveCompany = async (e) => {
    e.preventDefault();
    if (!companyName.trim()) {
      toast.error('Company legal name is required');
      return;
    }

    try {
      setIsSavingCompany(true);
      const payload = {
        company_details: {
          name: companyName.trim(),
          gst_number: gstNumber.trim().toUpperCase(),
          pan_number: panNumber.trim().toUpperCase(),
          address: address.trim(),
          city: city.trim(),
          state: state.trim(),
          pincode: pincode.trim(),
          email: billingEmail.trim(),
          phone: billingPhone.trim(),
          bank_name: bankName.trim(),
          account_number: accountNumber.trim(),
          ifsc_code: ifscCode.trim().toUpperCase(),
          bank_branch: bankBranch.trim(),
        },
      };

      await axios.put(`${API_URL}/settings`, payload);
      toast.success('Company GST & Billing details saved successfully! Invoices will now display these details.');
    } catch (error) {
      console.error('Failed to save company settings', error);
      toast.error(error.response?.data?.message || 'Failed to update company details');
    } finally {
      setIsSavingCompany(false);
    }
  };

  // Save Attendance & Office Timings
  const handleSaveAttendance = async (e) => {
    e.preventDefault();
    try {
      setIsSavingAttendance(true);
      const payload = {
        office_location: {
          lat: parseFloat(latitude),
          lng: parseFloat(longitude),
          radius: parseFloat(radius),
        },
        office_timings: {
          in_time: inTime,
          out_time: outTime,
          late_buffer: parseInt(lateBuffer, 10),
        },
      };

      await axios.put(`${API_URL}/settings`, payload);
      toast.success('Attendance rules and office location saved successfully!');
    } catch (error) {
      console.error('Failed to save attendance settings', error);
      toast.error(error.response?.data?.message || 'Failed to update attendance settings');
    } finally {
      setIsSavingAttendance(false);
    }
  };

  // Detect Current GPS Location
  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }
    setIsDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude.toFixed(6));
        setLongitude(pos.coords.longitude.toFixed(6));
        setIsDetectingLocation(false);
        toast.success(`Current GPS coordinates captured: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);
      },
      (err) => {
        console.error('Geolocation error', err);
        setIsDetectingLocation(false);
        toast.error('Failed to detect GPS location. Please allow location permissions in browser.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <ToastContainer position="top-right" autoClose={3500} />

      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">System Settings</h1>
          <p className="text-sm text-gray-600 mt-1">
            Configure company legal &amp; GST billing information for invoices, plus employee attendance controls.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchSettings}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition shadow-sm"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Link
          to="/company"
          className="p-4 rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 shadow-sm hover:shadow-md transition-all text-decoration-none group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-700 text-white flex items-center justify-center shadow">
              <Building2 size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-gray-900 group-hover:text-emerald-800 truncate">
                Company Profile
              </h3>
              <p className="text-xs text-gray-600 truncate">Seats, branches &amp; plan</p>
            </div>
            <ChevronRight size={16} className="text-emerald-700" />
          </div>
        </Link>

        <Link
          to="/role-permissions"
          className="p-4 rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 shadow-sm hover:shadow-md transition-all text-decoration-none group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow">
              <ShieldCheck size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-gray-900 group-hover:text-blue-800 truncate">
                Role Permissions
              </h3>
              <p className="text-xs text-gray-600 truncate">Access &amp; financial privacy</p>
            </div>
            <ChevronRight size={16} className="text-blue-700" />
          </div>
        </Link>

        <Link
          to="/email-templates"
          className="p-4 rounded-xl border border-purple-200 bg-gradient-to-r from-purple-50 to-fuchsia-50 shadow-sm hover:shadow-md transition-all text-decoration-none group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-600 text-white flex items-center justify-center shadow">
              <Mail size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-gray-900 group-hover:text-purple-800 truncate">
                SMTP Email Setup
              </h3>
              <p className="text-xs text-gray-600 truncate">Sender address &amp; app pass</p>
            </div>
            <ChevronRight size={16} className="text-purple-700" />
          </div>
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 mb-6 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('COMPANY_BILLING')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-all ${
            activeTab === 'COMPANY_BILLING'
              ? 'bg-emerald-700 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          <Building2 size={16} />
          Company GST &amp; Billing Details
          {gstNumber ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-900 text-emerald-100 font-semibold ml-1">
              Configured
            </span>
          ) : (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500 text-white font-semibold ml-1">
              Required
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ATTENDANCE')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-all ${
            activeTab === 'ATTENDANCE'
              ? 'bg-emerald-700 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          <Clock size={16} />
          Attendance &amp; Office Timings
        </button>
      </div>

      {/* TAB 1: COMPANY GST & BILLING DETAILS */}
      {activeTab === 'COMPANY_BILLING' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="border-b border-gray-100 pb-4 mb-6 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <FileSpreadsheet size={20} className="text-emerald-700" />
                Company GST, Address &amp; Invoice Billing Details
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Ye details aapke Bank Tax Invoices aur Connector Payout Vouchers ke header aur remittance section me print hongi.
              </p>
            </div>
            {gstNumber ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 size={13} /> GST Active ({gstNumber})
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                <AlertCircle size={13} /> GSTIN Not Set
              </span>
            )}
          </div>

          <form onSubmit={handleSaveCompany} className="space-y-6">
            {/* Section A: Company Legal Identity */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-1.5">
                <FileText size={14} className="text-gray-400" /> 1. Legal Entity &amp; Tax Identification
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Company Legal Name * <span className="text-gray-400 font-normal">(Printed on Invoice Header)</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full border border-gray-300 px-3.5 py-2 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="e.g. CapitalCare Financial Services Pvt. Ltd."
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    GST Number (GSTIN) * <span className="text-emerald-700 font-normal">(15 Characters)</span>
                  </label>
                  <input
                    type="text"
                    maxLength={15}
                    value={gstNumber}
                    onChange={(e) => handleGstChange(e.target.value)}
                    className="w-full border border-gray-300 px-3.5 py-2 rounded-lg text-sm font-mono uppercase focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="e.g. 08AABCT1234F1Z5"
                  />
                  <p className="text-[11px] text-gray-500 mt-1">
                    Format: 2 state digits + 10 PAN chars + 1 entity num + Z + 1 checksum char.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Company PAN Number <span className="text-gray-400 font-normal">(10 Characters)</span>
                  </label>
                  <input
                    type="text"
                    maxLength={10}
                    value={panNumber}
                    onChange={(e) => setPanNumber(e.target.value.toUpperCase().trim())}
                    className="w-full border border-gray-300 px-3.5 py-2 rounded-lg text-sm font-mono uppercase focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="e.g. AABCT1234F"
                  />
                  <p className="text-[11px] text-gray-500 mt-1">
                    Auto-extracted from GSTIN, used for TDS declarations.
                  </p>
                </div>
              </div>
            </div>

            {/* Section B: Registered Office Address */}
            <div className="pt-2 border-t border-gray-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-1.5">
                <MapPin size={14} className="text-gray-400" /> 2. Registered Office &amp; Billing Address
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Office Street Address * <span className="text-gray-400 font-normal">(Building, Street, Landmark)</span>
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full border border-gray-300 px-3.5 py-2 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="e.g. Plot No. 120, Financial District, Near MG Road"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">City</label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full border border-gray-300 px-3.5 py-2 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      placeholder="e.g. Jaipur"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">State</label>
                    <input
                      type="text"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      className="w-full border border-gray-300 px-3.5 py-2 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      placeholder="e.g. Rajasthan"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">PIN Code</label>
                    <input
                      type="text"
                      maxLength={10}
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value)}
                      className="w-full border border-gray-300 px-3.5 py-2 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      placeholder="e.g. 302001"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Billing / Official Email</label>
                    <input
                      type="email"
                      value={billingEmail}
                      onChange={(e) => setBillingEmail(e.target.value)}
                      className="w-full border border-gray-300 px-3.5 py-2 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      placeholder="e.g. billing@company.com"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Billing / Contact Phone</label>
                    <input
                      type="tel"
                      value={billingPhone}
                      onChange={(e) => setBillingPhone(e.target.value)}
                      className="w-full border border-gray-300 px-3.5 py-2 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      placeholder="e.g. +91 98765 43210"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section C: Remittance Bank Account Details */}
            <div className="pt-2 border-t border-gray-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-1.5">
                <Landmark size={14} className="text-gray-400" /> 3. Remittance Bank Account Details (For Commission Credit)
              </h3>
              <p className="text-xs text-gray-500 mb-3">
                In details ko Bank Tax Invoice ke "Remittance Account Details" box me print kiya jata hai jisse bank direct aapke is account me commission pay kare.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Company Bank Name</label>
                  <input
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full border border-gray-300 px-3.5 py-2 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="e.g. HDFC Bank Ltd."
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Account Number</label>
                  <input
                    type="text"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    className="w-full border border-gray-300 px-3.5 py-2 rounded-lg text-sm font-mono focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="e.g. 50200012345678"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">IFSC Code</label>
                  <input
                    type="text"
                    value={ifscCode}
                    onChange={(e) => setIfscCode(e.target.value.toUpperCase().trim())}
                    className="w-full border border-gray-300 px-3.5 py-2 rounded-lg text-sm font-mono uppercase focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="e.g. HDFC0001234"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Branch Name</label>
                  <input
                    type="text"
                    value={bankBranch}
                    onChange={(e) => setBankBranch(e.target.value)}
                    className="w-full border border-gray-300 px-3.5 py-2 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="e.g. Ashok Nagar, Jaipur"
                  />
                </div>
              </div>
            </div>

            {/* Live Invoice Preview Box */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Live Tax Invoice Header Preview
              </span>
              <div className="text-sm font-bold text-slate-800">{companyName || 'Your Company Legal Name'}</div>
              <div className="text-xs text-slate-600 mt-0.5">
                {[address, city, state ? `${state}${pincode ? ` - ${pincode}` : ''}` : ''].filter(Boolean).join(', ') || 'Your Registered Office Address'}
              </div>
              <div className="text-xs text-slate-700 mt-1 font-mono font-medium">
                GSTIN: <strong className="text-emerald-700">{gstNumber || 'NOT SET'}</strong> | PAN: <strong>{panNumber || (gstNumber ? gstNumber.substring(2, 12) : '—')}</strong>
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                Email: {billingEmail || 'billing@company.com'} | Phone: {billingPhone || '—'}
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={isSavingCompany}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-white font-semibold text-sm bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 transition shadow disabled:opacity-50"
              >
                <Save size={16} />
                {isSavingCompany ? 'Saving Details...' : 'Save Company GST & Billing Details'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: ATTENDANCE & OFFICE TIMINGS */}
      {activeTab === 'ATTENDANCE' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="border-b border-gray-100 pb-4 mb-6">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Clock size={20} className="text-emerald-700" />
              Office Location, Geofencing &amp; Timings
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Staff is radius ke andar aakar hi mobile ya web par attendance mark kar sakega.
            </p>
          </div>

          <form onSubmit={handleSaveAttendance} className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500">
                  Office GPS Coordinates
                </label>
                <button
                  type="button"
                  onClick={handleDetectLocation}
                  disabled={isDetectingLocation}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition"
                >
                  <Navigation size={13} className={isDetectingLocation ? 'animate-spin' : ''} />
                  {isDetectingLocation ? 'Detecting GPS...' : 'Auto-Detect Current GPS'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Office Latitude</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                    className="w-full border border-gray-300 px-3.5 py-2 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="e.g. 28.583967"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Office Longitude</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                    className="w-full border border-gray-300 px-3.5 py-2 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="e.g. 77.313246"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Allowed Radius (Meters)</label>
              <input
                type="number"
                required
                min="10"
                value={radius}
                onChange={(e) => setRadius(e.target.value)}
                className="w-full border border-gray-300 px-3.5 py-2 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="e.g. 200"
              />
              <p className="text-xs text-gray-500 mt-1">
                Employees must be within this radius (in meters) to mark attendance.
              </p>
            </div>

            <div className="pt-2 border-t border-gray-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
                Working Hours &amp; Late Buffer
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">In Time</label>
                  <input
                    type="time"
                    required
                    value={inTime}
                    onChange={(e) => setInTime(e.target.value)}
                    className="w-full border border-gray-300 px-3.5 py-2 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Out Time</label>
                  <input
                    type="time"
                    required
                    value={outTime}
                    onChange={(e) => setOutTime(e.target.value)}
                    className="w-full border border-gray-300 px-3.5 py-2 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Late Buffer (Minutes)</label>
              <input
                type="number"
                required
                min="0"
                value={lateBuffer}
                onChange={(e) => setLateBuffer(e.target.value)}
                className="w-full border border-gray-300 px-3.5 py-2 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="e.g. 10"
              />
              <p className="text-xs text-gray-500 mt-1">
                Employees are marked late if they arrive this many minutes after In Time.
              </p>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={isSavingAttendance}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-white font-semibold text-sm bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 transition shadow disabled:opacity-50"
              >
                <Save size={16} />
                {isSavingAttendance ? 'Saving Attendance...' : 'Save Attendance Settings'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default SettingsScreen;
