import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  Building2,
  Clock,
  Crosshair,
  MapPin,
  Pencil,
  Plus,
  Radio,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";
import API_URL from "../../config";

const emptyBranch = () => ({
  name: "",
  city: "",
  state: "",
  address: "",
  officeLat: "",
  officeLng: "",
  geoRadiusMeters: 300,
  workStartTime: "",
  workEndTime: "",
  lateBufferMinutes: "",
  halfDayHours: "",
});

export default function BranchesRedesign() {
  const [branches, setBranches] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);
  const [form, setForm] = useState(emptyBranch);
  const [submitting, setSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);

  const fetchBranches = useCallback(async () => {
    try {
      setLoading(true);
      const [branchRes, userRes] = await Promise.all([
        axios.get(`${API_URL}/branches`, { params: { limit: 100 } }),
        axios.get(`${API_URL}/users`, { params: { limit: 200 } }),
      ]);
      setBranches(branchRes.data?.data || branchRes.data?.rows || []);
      setEmployees(userRes.data?.data || userRes.data?.rows || []);
    } catch (error) {
      console.error("Error fetching branches:", error);
      toast.error(error.response?.data?.message || "Failed to load branches");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  const employeesByBranch = useMemo(() => {
    const counts = {};
    for (const emp of employees) {
      const bId = emp.branchId || emp.branch_id;
      if (bId) {
        counts[bId] = (counts[bId] || 0) + 1;
      }
    }
    return counts;
  }, [employees]);

  const filteredBranches = useMemo(() => {
    if (!searchTerm.trim()) return branches;
    const q = searchTerm.toLowerCase();
    return branches.filter(
      (b) =>
        b.name?.toLowerCase().includes(q) ||
        b.city?.toLowerCase().includes(q) ||
        b.state?.toLowerCase().includes(q) ||
        b.address?.toLowerCase().includes(q)
    );
  }, [branches, searchTerm]);

  const openAddModal = () => {
    setEditingBranch(null);
    setForm(emptyBranch());
    setModalOpen(true);
  };

  const openEditModal = (branch) => {
    setEditingBranch(branch);
    setForm({
      name: branch.name || "",
      city: branch.city || "",
      state: branch.state || "",
      address: branch.address || "",
      officeLat: branch.officeLat ?? branch.office_lat ?? "",
      officeLng: branch.officeLng ?? branch.office_lng ?? "",
      geoRadiusMeters: branch.geoRadiusMeters ?? branch.geo_radius_meters ?? 300,
      workStartTime: branch.workStartTime ?? branch.work_start_time ?? "",
      workEndTime: branch.workEndTime ?? branch.work_end_time ?? "",
      lateBufferMinutes: branch.lateBufferMinutes ?? branch.late_buffer_minutes ?? "",
      halfDayHours: branch.halfDayHours ?? branch.half_day_hours ?? "",
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingBranch(null);
    setForm(emptyBranch());
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((prev) => ({
          ...prev,
          officeLat: Number(pos.coords.latitude.toFixed(6)),
          officeLng: Number(pos.coords.longitude.toFixed(6)),
        }));
        toast.success("Current GPS coordinates captured!");
        setLocating(false);
      },
      (err) => {
        console.error(err);
        toast.error("Could not retrieve GPS location: " + err.message);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Branch name is required");
      return;
    }

    const payload = {
      name: form.name.trim(),
      city: form.city.trim() || null,
      state: form.state.trim() || null,
      address: form.address.trim() || null,
      officeLat: form.officeLat !== "" ? Number(form.officeLat) : null,
      officeLng: form.officeLng !== "" ? Number(form.officeLng) : null,
      geoRadiusMeters: Number(form.geoRadiusMeters) || 300,
      workStartTime: form.workStartTime ? form.workStartTime : null,
      workEndTime: form.workEndTime ? form.workEndTime : null,
      lateBufferMinutes: form.lateBufferMinutes !== "" && form.lateBufferMinutes !== null ? Number(form.lateBufferMinutes) : null,
      halfDayHours: form.halfDayHours !== "" && form.halfDayHours !== null ? Number(form.halfDayHours) : null,
    };

    setSubmitting(true);
    try {
      if (editingBranch) {
        await axios.put(`${API_URL}/branches/${editingBranch.id}`, payload);
        toast.success("Branch updated successfully");
      } else {
        await axios.post(`${API_URL}/branches`, payload);
        toast.success("Branch created successfully");
      }
      closeModal();
      fetchBranches();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save branch");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (branch) => {
    const staffCount = employeesByBranch[branch.id] || 0;
    if (staffCount > 0) {
      toast.warning(`Cannot delete branch: ${staffCount} employee(s) are assigned to it.`);
      return;
    }

    if (!window.confirm(`Are you sure you want to delete branch "${branch.name}"?`)) {
      return;
    }

    try {
      await axios.delete(`${API_URL}/branches/${branch.id}`);
      toast.success("Branch deleted");
      fetchBranches();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete branch");
    }
  };

  return (
    <div className="cc-branches-page">
      <ToastContainer position="top-right" autoClose={3000} />
      <style>{styles}</style>

      <div className="cc-page-head">
        <div>
          <h1 className="cc-page-title">Branch Offices & Timings</h1>
          <p className="cc-page-sub">
            Manage corporate regional branches, customized check-in/out working hours, late buffer, and GPS geofencing.
          </p>
        </div>
        <button type="button" className="cc-btn cc-btn-primary" onClick={openAddModal}>
          <Plus size={16} /> Add Branch
        </button>
      </div>

      <div className="cc-branches-bar">
        <label className="cc-search-wrap">
          <Search size={17} />
          <input
            type="search"
            placeholder="Search branches by name, city, or address..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </label>
        <div className="cc-branches-count">
          <strong>{filteredBranches.length}</strong> branch{filteredBranches.length === 1 ? "" : "es"} found
        </div>
      </div>

      {loading ? (
        <div className="cc-loading-state">Loading branch network...</div>
      ) : filteredBranches.length === 0 ? (
        <div className="cc-empty-state">
          <Building2 size={42} strokeWidth={1.5} />
          <h3>No branches found</h3>
          <p>Create your first regional branch office or adjust your search filter.</p>
          <button type="button" className="cc-btn cc-btn-primary" onClick={openAddModal}>
            <Plus size={16} /> Add Branch
          </button>
        </div>
      ) : (
        <div className="cc-branches-grid">
          {filteredBranches.map((branch) => {
            const staffCount = employeesByBranch[branch.id] || 0;
            const lat = branch.officeLat ?? branch.office_lat;
            const lng = branch.officeLng ?? branch.office_lng;
            const radius = branch.geoRadiusMeters ?? branch.geo_radius_meters ?? 200;
            const hasGps = lat && lng;
            const startTime = branch.workStartTime ?? branch.work_start_time;
            const endTime = branch.workEndTime ?? branch.work_end_time;
            const lateBuffer = branch.lateBufferMinutes ?? branch.late_buffer_minutes;
            const hasCustomTimings = Boolean(startTime && endTime);

            return (
              <div key={branch.id} className="cc-branch-card">
                <div className="cc-branch-card-header">
                  <div className="cc-branch-icon">
                    <Building2 size={22} />
                  </div>
                  <div className="cc-branch-title-wrap">
                    <h3>{branch.name}</h3>
                    {(branch.city || branch.state) && (
                      <span className="cc-branch-city">
                        <MapPin size={13} />
                        {[branch.city, branch.state].filter(Boolean).join(", ")}
                      </span>
                    )}
                  </div>
                  <div className="cc-branch-card-actions">
                    <button
                      type="button"
                      className="cc-action-icon edit"
                      title="Edit Branch"
                      onClick={() => openEditModal(branch)}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      className="cc-action-icon delete"
                      title="Delete Branch"
                      onClick={() => handleDelete(branch)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {branch.address && <p className="cc-branch-address">{branch.address}</p>}

                <div className="cc-branch-stats-strip">
                  <div className="cc-stat-pill staff">
                    <Users size={14} />
                    <span>{staffCount} Staff</span>
                  </div>
                  <div className={`cc-stat-pill ${hasCustomTimings ? "timing-custom" : "timing-default"}`}>
                    <Clock size={14} />
                    <span>
                      {hasCustomTimings
                        ? `${startTime} - ${endTime} (${lateBuffer ?? 10}m grace)`
                        : "Default: 10:00 - 19:00 (10m grace)"}
                    </span>
                  </div>
                  <div className={`cc-stat-pill ${hasGps ? "gps-active" : "gps-inactive"}`}>
                    <Radio size={14} />
                    <span>{hasGps ? `Geofence: ${radius}m` : "No GPS Configured"}</span>
                  </div>
                </div>

                {hasGps && (
                  <div className="cc-branch-gps-box">
                    <div className="cc-gps-coords">
                      <span>Lat: <strong>{Number(lat).toFixed(4)}</strong></span>
                      <span>Lng: <strong>{Number(lng).toFixed(4)}</strong></span>
                    </div>
                    <a
                      href={`https://maps.google.com/?q=${lat},${lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="cc-map-link"
                    >
                      View on Map ↗
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <div className="cc-modal-overlay" onClick={closeModal}>
          <div className="cc-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="cc-modal-head">
              <div>
                <p>{editingBranch ? "Edit Branch" : "New Branch"}</p>
                <h3>{editingBranch ? `Update ${editingBranch.name}` : "Create Regional Office"}</h3>
              </div>
              <button type="button" onClick={closeModal} title="Close">
                <X size={17} />
              </button>
            </div>

            <form className="cc-modal-form" onSubmit={handleSubmit}>
              <label className="cc-field">
                <span>Branch Name *</span>
                <input
                  type="text"
                  required
                  placeholder="e.g. Headquarters - Jaipur (Tonk Road)"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </label>

              <div className="cc-form-row">
                <label className="cc-field">
                  <span>City</span>
                  <input
                    type="text"
                    placeholder="e.g. Jaipur"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                  />
                </label>
                <label className="cc-field">
                  <span>State</span>
                  <input
                    type="text"
                    placeholder="e.g. Rajasthan"
                    value={form.state}
                    onChange={(e) => setForm({ ...form, state: e.target.value })}
                  />
                </label>
              </div>

              <label className="cc-field">
                <span>Office Address</span>
                <textarea
                  rows={2}
                  placeholder="Full street address or commercial building..."
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </label>

              {/* BRANCH WORKING TIMINGS (OPTIONAL) */}
              <div className="cc-timings-section">
                <div className="cc-section-header">
                  <div className="cc-section-icon"><Clock size={16} /></div>
                  <div>
                    <strong>Branch Work Timings & Buffer (Optional)</strong>
                    <small>Leave blank to inherit global company timings (10:00 AM - 07:00 PM, 10 min grace buffer)</small>
                  </div>
                </div>

                <div className="cc-form-row">
                  <label className="cc-field">
                    <span>Check-In Time</span>
                    <input
                      type="time"
                      value={form.workStartTime}
                      onChange={(e) => setForm({ ...form, workStartTime: e.target.value })}
                    />
                    <small className="cc-field-hint">e.g. 09:30 (Default: 10:00)</small>
                  </label>
                  <label className="cc-field">
                    <span>Check-Out Time</span>
                    <input
                      type="time"
                      value={form.workEndTime}
                      onChange={(e) => setForm({ ...form, workEndTime: e.target.value })}
                    />
                    <small className="cc-field-hint">e.g. 18:30 (Default: 19:00)</small>
                  </label>
                </div>

                <div className="cc-form-row">
                  <label className="cc-field">
                    <span>Late Grace Buffer (Minutes)</span>
                    <input
                      type="number"
                      min="0"
                      max="120"
                      placeholder="e.g. 15 (Default: 10)"
                      value={form.lateBufferMinutes}
                      onChange={(e) => setForm({ ...form, lateBufferMinutes: e.target.value })}
                    />
                    <small className="cc-field-hint">Grace period before mark as Late</small>
                  </label>
                  <label className="cc-field">
                    <span>Half-Day Threshold (Hours)</span>
                    <input
                      type="number"
                      step="0.5"
                      min="1"
                      max="12"
                      placeholder="e.g. 4.0 (Default: 4.0)"
                      value={form.halfDayHours}
                      onChange={(e) => setForm({ ...form, halfDayHours: e.target.value })}
                    />
                    <small className="cc-field-hint">Minimum working hours for full day</small>
                  </label>
                </div>
              </div>

              {/* GPS GEOFENCING */}
              <div className="cc-geo-section">
                <div className="cc-geo-header">
                  <div>
                    <strong>GPS Geofencing for Attendance</strong>
                    <small>Allowed boundary radius for mobile check-in verification</small>
                  </div>
                  <button
                    type="button"
                    className="cc-btn cc-btn-sm cc-btn-outline"
                    onClick={handleGetCurrentLocation}
                    disabled={locating}
                  >
                    <Crosshair size={14} />
                    {locating ? "Locating..." : "Use Current GPS"}
                  </button>
                </div>

                <div className="cc-form-row">
                  <label className="cc-field">
                    <span>Office Latitude</span>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 26.8912"
                      value={form.officeLat}
                      onChange={(e) => setForm({ ...form, officeLat: e.target.value })}
                    />
                  </label>
                  <label className="cc-field">
                    <span>Office Longitude</span>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 75.8054"
                      value={form.officeLng}
                      onChange={(e) => setForm({ ...form, officeLng: e.target.value })}
                    />
                  </label>
                </div>

                <label className="cc-field">
                  <span>Geofence Radius: <strong>{form.geoRadiusMeters} meters</strong></span>
                  <input
                    type="range"
                    min={50}
                    max={1000}
                    step={25}
                    value={form.geoRadiusMeters}
                    onChange={(e) => setForm({ ...form, geoRadiusMeters: Number(e.target.value) })}
                  />
                  <div className="cc-slider-labels">
                    <span>50m (Strict)</span>
                    <span>300m (Standard)</span>
                    <span>1000m (Wide Campus)</span>
                  </div>
                </label>
              </div>

              <div className="cc-modal-actions">
                <button type="button" className="cc-btn cc-btn-ghost" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="cc-btn cc-btn-primary" disabled={submitting}>
                  {submitting ? "Saving..." : editingBranch ? "Save Changes" : "Create Branch"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = `
  .cc-branches-page { padding: 24px 32px; max-width: 1400px; margin: 0 auto; }
  .cc-page-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; gap: 16px; flex-wrap: wrap; }
  .cc-page-title { font-size: 24px; font-weight: 800; color: #0f172a; margin: 0 0 6px 0; letter-spacing: -0.02em; }
  .cc-page-sub { font-size: 13.5px; color: #64748b; margin: 0; }

  .cc-branches-bar { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }
  .cc-search-wrap { display: flex; align-items: center; gap: 10px; background: #fff; border: 1px solid #cbd5e1; border-radius: 12px; padding: 10px 14px; width: 100%; max-width: 420px; box-shadow: 0 1px 2px rgba(0,0,0,0.03); }
  .cc-search-wrap input { border: 0; outline: none; width: 100%; font-size: 13.5px; color: #0f172a; }
  .cc-branches-count { font-size: 13px; color: #64748b; }

  .cc-branches-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 20px; }
  .cc-branch-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; box-shadow: 0 2px 6px rgba(15,23,42,0.04); display: flex; flex-direction: column; gap: 14px; transition: transform 0.15s ease, box-shadow 0.15s ease; }
  .cc-branch-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(15,23,42,0.08); border-color: #cbd5e1; }
  
  .cc-branch-card-header { display: flex; align-items: flex-start; gap: 12px; }
  .cc-branch-icon { width: 44px; height: 44px; border-radius: 12px; background: linear-gradient(135deg, #eef7f2, #dcfce7); color: #047857; display: grid; place-items: center; flex-shrink: 0; }
  .cc-branch-title-wrap { flex: 1; min-width: 0; }
  .cc-branch-title-wrap h3 { font-size: 16px; font-weight: 700; color: #0f172a; margin: 0 0 4px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .cc-branch-city { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: #64748b; font-weight: 500; }

  .cc-branch-card-actions { display: flex; align-items: center; gap: 4px; }
  .cc-action-icon { width: 30px; height: 30px; border-radius: 8px; border: 0; background: transparent; cursor: pointer; display: grid; place-items: center; color: #64748b; transition: all 0.15s; }
  .cc-action-icon.edit:hover { background: #e0f2fe; color: #0284c7; }
  .cc-action-icon.delete:hover { background: #fee2e2; color: #dc2626; }

  .cc-branch-address { font-size: 13px; color: #475569; line-height: 1.45; margin: 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

  .cc-branch-stats-strip { display: flex; flex-direction: column; gap: 6px; margin-top: auto; padding-top: 10px; border-top: 1px solid #f1f5f9; }
  .cc-stat-pill { display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; border-radius: 8px; font-size: 11.5px; font-weight: 600; width: fit-content; }
  .cc-stat-pill.staff { background: #f1f5f9; color: #334155; }
  .cc-stat-pill.timing-custom { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; }
  .cc-stat-pill.timing-default { background: #f8fafc; color: #64748b; border: 1px solid #e2e8f0; }
  .cc-stat-pill.gps-active { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
  .cc-stat-pill.gps-inactive { background: #fef2f2; color: #991b1b; }

  .cc-branch-gps-box { background: #f8fafc; border-radius: 10px; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; font-size: 11.5px; color: #64748b; border: 1px solid #eef2f6; }
  .cc-gps-coords { display: flex; gap: 10px; }
  .cc-gps-coords strong { color: #0f172a; }
  .cc-map-link { color: #047857; text-decoration: none; font-weight: 600; }
  .cc-map-link:hover { text-decoration: underline; }

  .cc-loading-state, .cc-empty-state { padding: 60px 20px; text-align: center; background: #fff; border-radius: 16px; border: 1px dashed #cbd5e1; color: #64748b; display: flex; flex-direction: column; align-items: center; gap: 12px; }
  .cc-empty-state h3 { color: #0f172a; font-size: 18px; margin: 0; }
  .cc-empty-state p { font-size: 13.5px; max-width: 400px; margin: 0 0 8px 0; }

  /* Buttons */
  .cc-btn { display: inline-flex; align-items: center; gap: 7px; padding: 9px 16px; border-radius: 10px; font-size: 13.5px; font-weight: 600; border: 1px solid transparent; cursor: pointer; transition: all 0.15s ease; }
  .cc-btn-primary { background: #047857; color: #fff; }
  .cc-btn-primary:hover:not(:disabled) { background: #065f46; }
  .cc-btn-ghost { background: #f1f5f9; color: #334155; }
  .cc-btn-ghost:hover { background: #e2e8f0; }
  .cc-btn-outline { background: #fff; border-color: #cbd5e1; color: #334155; }
  .cc-btn-outline:hover:not(:disabled) { border-color: #047857; color: #047857; background: #ecfdf5; }
  .cc-btn-sm { padding: 6px 12px; font-size: 12px; }
  .cc-btn:disabled { opacity: 0.6; cursor: not-allowed; }

  /* Modal */
  .cc-modal-overlay { position: fixed; inset: 0; background: rgba(15,23,42,0.65); backdrop-filter: blur(3px); z-index: 120; display: grid; place-items: center; padding: 16px; }
  .cc-modal-card { width: 100%; max-width: 560px; background: #fff; border-radius: 18px; padding: 24px; display: flex; flex-direction: column; gap: 16px; box-shadow: 0 20px 60px rgba(15,23,42,0.3); max-height: 92vh; overflow-y: auto; }
  .cc-modal-head { display: flex; justify-content: space-between; align-items: flex-start; }
  .cc-modal-head p { margin: 0; font-size: 11px; text-transform: uppercase; font-weight: 700; color: #047857; letter-spacing: 0.05em; }
  .cc-modal-head h3 { margin: 2px 0 0 0; font-size: 19px; color: #0f172a; font-weight: 700; }
  .cc-modal-head button { width: 32px; height: 32px; border-radius: 8px; border: 0; background: #f1f5f9; color: #64748b; cursor: pointer; display: grid; place-items: center; }
  .cc-modal-head button:hover { background: #e2e8f0; color: #0f172a; }

  .cc-modal-form { display: flex; flex-direction: column; gap: 14px; }
  .cc-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .cc-field { display: flex; flex-direction: column; gap: 6px; font-size: 12.5px; font-weight: 600; color: #334155; }
  .cc-field input, .cc-field textarea, .cc-field select { padding: 9px 12px; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 13.5px; color: #0f172a; background: #fff; font-family: inherit; }
  .cc-field input:focus, .cc-field textarea:focus { border-color: #047857; outline: none; box-shadow: 0 0 0 3px rgba(4,120,87,0.12); }
  .cc-field input[type="range"] { padding: 0; }
  .cc-field-hint { font-size: 11px; color: #64748b; font-weight: 400; margin-top: 1px; }

  .cc-timings-section, .cc-geo-section { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 12px; }
  .cc-timings-section { border-color: #e2e8f0; background: #fafbfc; }
  .cc-section-header, .cc-geo-header { display: flex; align-items: flex-start; gap: 10px; }
  .cc-section-icon { width: 32px; height: 32px; border-radius: 8px; background: #ecfdf5; color: #047857; display: grid; place-items: center; flex-shrink: 0; }
  .cc-section-header strong, .cc-geo-header strong { font-size: 13px; color: #0f172a; display: block; }
  .cc-section-header small, .cc-geo-header small { font-size: 11px; color: #64748b; line-height: 1.35; display: block; }
  .cc-slider-labels { display: flex; justify-content: space-between; font-size: 10.5px; color: #94a3b8; font-weight: 500; }

  .cc-modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 8px; }
`;
