import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Stethoscope, FlaskConical, Pill, Settings2, RefreshCw, 
  Activity, Users, ClipboardList, Clock, ShieldAlert, Heart,
  Search, ChevronRight, ClipboardEdit, LogOut, Key
} from "lucide-react";
import { ClinicDatabase, Role } from "./types";
import { fetchClinicDb, changeUserPassword } from "./utils/api";
import DoctorDashboard from "./components/DoctorDashboard";
import LabDashboard from "./components/LabDashboard";
import PharmacistDashboard from "./components/PharmacistDashboard";
import AdminDashboard from "./components/AdminDashboard";
import ReceptionistDashboard from "./components/ReceptionistDashboard";
import Login from "./components/Login";

export default function App() {
  // Authentication & session persistence
  const [currentUser, setCurrentUser] = useState<{ id: string; username: string; name: string; role: Role } | null>(() => {
    const saved = localStorage.getItem("medcore_session");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  // Current viewed dashboard for Admin. For other roles, effectiveRole is locked to their currentUser.role.
  const [activeRole, setActiveRole] = useState<Role>("Doctor");
  const [db, setDb] = useState<ClinicDatabase | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Global search and selection state
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  // Password change form states
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Sync activeRole with logged-in user role if not Admin
  useEffect(() => {
    if (currentUser && currentUser.role !== "Admin") {
      setActiveRole(currentUser.role);
    }
  }, [currentUser]);

  // Fetch full clinical database state
  const loadDatabase = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await fetchClinicDb();
      setDb(data);
      setError(null);
      // Auto-initialize selected patient if not set yet
      if (data && data.patients.length > 0) {
        setSelectedPatientId(prev => prev || data.patients[0].id);
      }
    } catch (err: any) {
      console.error(err);
      if (!silent || !db) {
        setError("Failed to connect to the clinic server database. Please check if your server is initialized.");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    loadDatabase();
  }, []);

  // Background polling to keep multiple roles in sync (every 4 seconds)
  useEffect(() => {
    const timer = setInterval(() => {
      loadDatabase(true); // Silent update in background
    }, 4000);

    return () => clearInterval(timer);
  }, [selectedPatientId]);

  // Outside click handler for search autocomplete dropdown
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("#global-search-container")) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, []);

  const handleManualSync = async () => {
    setIsSyncing(true);
    await loadDatabase(true);
    setTimeout(() => setIsSyncing(false), 600);
  };

  const handleLoginSuccess = (user: { id: string; username: string; name: string; role: string }) => {
    const sessionUser = {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role as Role
    };
    setCurrentUser(sessionUser);
    localStorage.setItem("medcore_session", JSON.stringify(sessionUser));
    
    // Default seen dashboard
    setActiveRole(sessionUser.role);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem("medcore_session");
  };

  const handlePasswordChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (!currentUser) return;
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("All fields are required.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }
    if (newPassword.length < 4) {
      setPasswordError("New password must be at least 4 characters.");
      return;
    }

    setPasswordLoading(true);
    try {
      await changeUserPassword({
        userId: currentUser.id,
        currentPassword,
        newPassword
      });
      setPasswordSuccess("Password updated successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => {
        setShowPasswordModal(false);
        setPasswordSuccess("");
      }, 1500);
    } catch (err: any) {
      setPasswordError(err.message || "Failed to update password.");
    } finally {
      setPasswordLoading(false);
    }
  };

  // Select patient and navigate (Admin only maps role; others stay on current workspace but select patient)
  const handleSelectPatientFromSearch = (patientId: string) => {
    setSelectedPatientId(patientId);
    setGlobalSearchQuery("");
    setShowSearchResults(false);

    if (!db || !currentUser) return;

    if (currentUser.role === "Admin") {
      // Admin gets context-aware automatic tab routing
      const pendingRxRecord = db.records.find(
        r => r.patientId === patientId && (r.prescriptionStatus === "pending" || r.prescriptionStatus === "partially_dispatched")
      );
      if (pendingRxRecord) {
        setActiveRole("Pharmacist");
        return;
      }

      const pendingLabRecord = db.records.find(
        r => r.patientId === patientId && r.labStatus === "pending"
      );
      if (pendingLabRecord) {
        setActiveRole("LabTech");
        return;
      }

      setActiveRole("Doctor");
    }
  };

  // Filter patients based on query
  const matchedPatients = db 
    ? db.patients.filter(p => 
        p.name.toLowerCase().includes(globalSearchQuery.toLowerCase()) ||
        p.id.toLowerCase().includes(globalSearchQuery.toLowerCase())
      )
    : [];

  // Determine which dashboard is rendered. Locked to currentUser.role unless they are Admin.
  const effectiveRole = currentUser?.role === "Admin" ? activeRole : currentUser?.role;

  // Render role-specific content
  const renderDashboardContent = () => {
    if (!db || !currentUser || !effectiveRole) return null;
    
    switch (effectiveRole) {
      case "Doctor":
        return (
          <DoctorDashboard 
            db={db} 
            currentUser={currentUser}
            onRefresh={() => loadDatabase(true)} 
            globalSearchQuery={globalSearchQuery}
            selectedPatientId={selectedPatientId}
            onSelectPatientId={setSelectedPatientId}
            onClearGlobalSearch={() => setGlobalSearchQuery("")}
          />
        );
      case "LabTech":
        return (
          <LabDashboard 
            db={db} 
            onRefresh={() => loadDatabase(true)} 
            globalSearchQuery={globalSearchQuery}
            selectedPatientId={selectedPatientId}
            onSelectPatientId={setSelectedPatientId}
            onClearGlobalSearch={() => setGlobalSearchQuery("")}
            currentUser={currentUser}
          />
        );
      case "Pharmacist":
        return (
          <PharmacistDashboard 
            db={db} 
            onRefresh={() => loadDatabase(true)} 
            globalSearchQuery={globalSearchQuery}
            selectedPatientId={selectedPatientId}
            onSelectPatientId={setSelectedPatientId}
            onClearGlobalSearch={() => setGlobalSearchQuery("")}
            currentUser={currentUser}
            onLogout={handleLogout}
          />
        );
      case "Receptionist":
        return (
          <ReceptionistDashboard 
            db={db} 
            onRefresh={() => loadDatabase(true)} 
            currentUser={currentUser}
            onLogout={handleLogout}
          />
        );
      case "Admin":
        return <AdminDashboard db={db} onRefresh={() => loadDatabase(true)} onLogout={handleLogout} currentUser={currentUser} />;
      default:
        return null;
    }
  };

  // If loading metadata/db
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center" id="app-loading-state">
        <div className="p-8 text-center space-y-4 animate-fade-in">
          <Activity className="w-12 h-12 text-purple-600 animate-pulse mx-auto" />
          <h1 className="font-sans font-bold text-slate-800 text-lg">Jul Medicare ERP</h1>
          <p className="text-slate-500 text-xs font-semibold">Accessing secure operations and records vault...</p>
        </div>
      </div>
    );
  }

  // If database connection fails
  if (error || !db) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center animate-fade-in" id="app-error-state">
        <div className="bg-white border border-rose-100 rounded-2xl p-8 max-w-md text-center shadow-md space-y-4">
          <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto" />
          <h2 className="font-bold text-slate-800 text-lg">Database Server Offline</h2>
          <p className="text-slate-500 text-xs font-medium">{error || "Could not retrieve clinic database entries."}</p>
          <button
            onClick={() => loadDatabase()}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 px-6 rounded-xl text-xs transition shadow-sm"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  // If not logged in, show multi-portal login gateway
  if (!currentUser) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  // Calculate live global notifications counters
  const pendingLabsCount = db.records.filter(r => r.labStatus === "pending").length;
  const pendingRxCount = db.records.filter(r => r.prescriptionStatus === "pending" || r.prescriptionStatus === "partially_dispatched").length;

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans antialiased text-slate-800 flex flex-col" id="app-viewport">
      
      {/* Clinic System Top Header Banner */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm" id="app-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          
          {/* Brand & Search Container */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 flex-1 w-full">
            {/* Practice Branding */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="w-8 h-8 bg-purple-600 rounded-xl flex items-center justify-center text-white font-bold shadow-md">
                +
              </div>
              <div className="text-left">
                <h1 className="text-sm font-extrabold text-slate-800 tracking-tight">Jul Medicare ERP</h1>
                <span className="text-[9px] text-purple-600 font-bold uppercase tracking-wider block -mt-0.5">Clinical Operations Hub</span>
              </div>
            </div>

            {/* Global Patient Search Bar (All authenticated staff can use this) */}
            <div className="relative flex-1 max-w-md w-full" id="global-search-container">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter or search patient by name or ID across departments..."
                  value={globalSearchQuery}
                  onChange={(e) => {
                    setGlobalSearchQuery(e.target.value);
                    setShowSearchResults(true);
                  }}
                  onFocus={() => setShowSearchResults(true)}
                  className="w-full pl-9 pr-8 py-1.5 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-xl text-xs placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:bg-white transition-all text-slate-800 font-semibold"
                />
                {globalSearchQuery && (
                  <button
                    onClick={() => {
                      setGlobalSearchQuery("");
                      setShowSearchResults(false);
                    }}
                    className="absolute right-3 top-2 text-slate-400 hover:text-slate-600 text-sm font-semibold transition"
                  >
                    ×
                  </button>
                )}
              </div>

              {/* Autocomplete Dropdown overlay */}
              {showSearchResults && globalSearchQuery.trim() !== "" && (
                <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg z-50 max-h-[300px] overflow-y-auto p-1.5 space-y-1">
                  <div className="text-[9px] text-slate-400 font-bold px-2.5 py-1 uppercase tracking-wider border-b border-slate-100/60 pb-1 mb-1">
                    Matched Patients ({matchedPatients.length})
                  </div>
                  {matchedPatients.length === 0 ? (
                    <div className="text-center py-5 text-slate-400 text-[11px]">
                      No patients matching "{globalSearchQuery}"
                    </div>
                  ) : (
                    matchedPatients.map(p => {
                      const hasPendingLab = db.records.some(r => r.patientId === p.id && r.labStatus === "pending");
                      const hasPendingRx = db.records.some(r => r.patientId === p.id && (r.prescriptionStatus === "pending" || r.prescriptionStatus === "partially_dispatched"));
                      const hasCompletedLab = db.records.some(r => r.patientId === p.id && r.labStatus === "completed" && r.prescriptionStatus === "none");

                      return (
                        <div
                          key={p.id}
                          className="p-2 hover:bg-purple-50/50 rounded-lg cursor-pointer transition flex items-center justify-between gap-2 border border-transparent hover:border-purple-100/30"
                          onClick={() => handleSelectPatientFromSearch(p.id)}
                        >
                          <div className="text-left">
                            <div className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                              {p.name}
                              <span className="font-mono text-[9px] bg-slate-100 text-slate-500 px-1 py-0.2 rounded font-bold">ID: {p.id}</span>
                            </div>
                            <div className="text-[10px] text-slate-400 font-semibold mt-0.5">
                              {p.age}y • {p.sex} • {p.phone}
                            </div>
                          </div>
                          
                          {/* Badges and switch indicators */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            {hasPendingRx && (
                              <span className="text-[8px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded-md uppercase tracking-wide">
                                Rx Pending
                              </span>
                            )}
                            {hasPendingLab && (
                              <span className="text-[8px] font-bold bg-purple-100 text-purple-800 border border-purple-200 px-1.5 py-0.5 rounded-md uppercase tracking-wide">
                                Lab Pending
                              </span>
                            )}
                            {hasCompletedLab && (
                              <span className="text-[8px] font-bold bg-amber-100 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded-md uppercase tracking-wide">
                                Lab Ready
                              </span>
                            )}
                            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Department Switcher & Connection */}
          <div className="flex flex-col sm:flex-row items-center gap-4 shrink-0 w-full lg:w-auto justify-end">
            
            {/* ONLY ADMIN CAN SWITCH DEPARTMENTS TO AUDIT EVERYTHING */}
            {currentUser.role === "Admin" ? (
              <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 p-1 rounded-xl text-xs font-bold" id="account-switcher-tool">
                <button
                  onClick={() => setActiveRole("Doctor")}
                  className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg transition-all ${
                    effectiveRole === "Doctor"
                      ? "bg-purple-600 text-white shadow-md font-bold"
                      : "text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                  }`}
                  title="View Doctor Dashboard"
                >
                  <Stethoscope className="w-3.5 h-3.5" />
                  <span className="hidden xl:inline">Doctor</span>
                </button>
                
                <button
                  onClick={() => setActiveRole("LabTech")}
                  className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg transition-all relative ${
                    effectiveRole === "LabTech"
                      ? "bg-purple-600 text-white shadow-md font-bold"
                      : "text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                  }`}
                  title="View Pathology Queue"
                >
                  <FlaskConical className="w-3.5 h-3.5" />
                  <span className="hidden xl:inline">Lab</span>
                  {pendingLabsCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-amber-500 text-slate-950 text-[8px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center ring-1 ring-white">
                      {pendingLabsCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setActiveRole("Pharmacist")}
                  className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg transition-all relative ${
                    effectiveRole === "Pharmacist"
                      ? "bg-purple-600 text-white shadow-md font-bold"
                      : "text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                  }`}
                  title="View Pharmacy Dispatch"
                >
                  <Pill className="w-3.5 h-3.5" />
                  <span className="hidden xl:inline">Pharmacy</span>
                  {pendingRxCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-amber-500 text-slate-950 text-[8px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center ring-1 ring-white">
                      {pendingRxCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setActiveRole("Receptionist")}
                  className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg transition-all ${
                    effectiveRole === "Receptionist"
                      ? "bg-purple-600 text-white shadow-md font-bold"
                      : "text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                  }`}
                  title="View Reception & Check-in"
                >
                  <ClipboardEdit className="w-3.5 h-3.5" />
                  <span className="hidden xl:inline">Reception</span>
                </button>

                <button
                  onClick={() => setActiveRole("Admin")}
                  className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg transition-all ${
                    effectiveRole === "Admin"
                      ? "bg-purple-600 text-white shadow-md font-bold"
                      : "text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                  }`}
                  title="View Admin Portal"
                >
                  <Settings2 className="w-3.5 h-3.5" />
                  <span>Admin</span>
                </button>
              </div>
            ) : (
              // Regular user welcome tag
              <div className="flex items-center gap-2 bg-purple-50 border border-purple-100 rounded-xl px-3 py-1.5 text-xs text-purple-900 font-bold shadow-xs">
                <Users className="w-3.5 h-3.5 text-purple-600 animate-pulse" />
                <span>Logged as: {currentUser.name} ({currentUser.role === "LabTech" ? "Pathologist" : currentUser.role})</span>
              </div>
            )}

            {/* Sync, Password and Logout controls */}
            <div className="flex items-center gap-2 self-end sm:self-center">
              <button
                onClick={handleManualSync}
                className="text-slate-500 hover:text-slate-800 bg-white border border-slate-200 hover:bg-slate-50 p-2 rounded-xl transition shadow-xs"
                title="Force Database Sync"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin text-purple-600" : ""}`} />
              </button>

              <button
                onClick={() => {
                  setPasswordError("");
                  setPasswordSuccess("");
                  setCurrentPassword("");
                  setNewPassword("");
                  setConfirmPassword("");
                  setShowPasswordModal(true);
                }}
                className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-2 rounded-xl transition border border-slate-200 shadow-xs"
                title="Change access password"
              >
                <Key className="w-3.5 h-3.5 text-slate-600" />
                <span className="hidden sm:inline">Password</span>
              </button>

              <button
                onClick={handleLogout}
                className="flex items-center gap-1 bg-rose-50 border border-rose-100 hover:bg-rose-100 text-rose-600 text-xs font-bold px-3 py-2 rounded-xl transition"
                title="Log out of clinical session"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>

        </div>
      </header>

      {/* Primary Dashboard Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* Dynamic transitions */}
        <AnimatePresence mode="wait">
          <motion.div
            key={effectiveRole}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15, ease: "easeInOut" }}
            className="w-full"
          >
            {renderDashboardContent()}
          </motion.div>
        </AnimatePresence>

      </main>

      {/* Footer Branding */}
      <footer className="bg-white border-t border-slate-100 py-4 mt-auto" id="app-footer">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between text-[11px] text-slate-400 font-bold tracking-tight uppercase gap-2">
          <span>Jul Medicare ERP • Secure Patient Vault Active</span>
          <span className="flex items-center gap-1 font-semibold normal-case">
            Formulated for clinical workflows & guidelines <Heart className="w-3 h-3 text-rose-500 fill-rose-500 animate-pulse" />
          </span>
        </div>
      </footer>

      {/* Password Change Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in" id="password-change-modal">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-sm w-full p-6 relative">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5 mb-2">
              <Key className="w-4.5 h-4.5 text-purple-600" />
              Change Access Password
            </h3>
            <p className="text-xs text-slate-500 mb-4 font-semibold">Please update your access credentials below. Ensure they are secure.</p>

            <form onSubmit={handlePasswordChangeSubmit} className="space-y-4">
              {passwordError && (
                <div className="p-2.5 bg-rose-50 border border-rose-100 rounded-lg text-rose-600 text-[11px] font-bold">
                  {passwordError}
                </div>
              )}
              {passwordSuccess && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-100 rounded-lg text-emerald-700 text-[11px] font-bold">
                  {passwordSuccess}
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full px-3 py-2 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-xl text-xs placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:bg-white transition font-medium"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full px-3 py-2 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-xl text-xs placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:bg-white transition font-medium"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="w-full px-3 py-2 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-xl text-xs placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:bg-white transition font-medium"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                  disabled={passwordLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl transition shadow-md"
                  disabled={passwordLoading}
                >
                  {passwordLoading ? "Updating..." : "Update Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
