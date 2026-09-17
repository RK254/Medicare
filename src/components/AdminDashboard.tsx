import React, { useState, useEffect } from "react";
import { 
  Settings2, Coins, PlusCircle, RefreshCw, Activity, ShieldAlert,
  Users, FileSpreadsheet, FlaskConical, Pill, ClipboardCheck, UserCheck, Key, LogOut,
  Printer, Calendar, TrendingUp, BarChart3, Download, Upload, Pencil, X,
  Database, HardDrive, Clock, RotateCcw, Trash2, CheckCircle2, ShieldCheck,
  FileJson, FileUp, AlertCircle, ArrowRight
} from "lucide-react";
import { ClinicDatabase, User } from "../types";
import { 
  addExtraService, resetDatabase, registerUser, deregisterUser, importDatabase, 
  updateUser, fetchBackups, createBackupSnapshot, restoreBackupSnapshot, 
  deleteBackupSnapshot, uploadBackupSnapshot, BackupSnapshotMeta 
} from "../utils/api";
import { printFinanceReport } from "../utils/print";

interface AdminDashboardProps {
  db: ClinicDatabase;
  onRefresh: () => void;
  onLogout: () => void;
  currentUser: { name: string };
}

export default function AdminDashboard({ db, onRefresh, onLogout, currentUser }: AdminDashboardProps) {
  // Extra Services Form State
  const [srvForm, setSrvForm] = useState({ name: "", cost: "", description: "" });
  
  // User Registration & Edit State
  const [userForm, setUserForm] = useState({ username: "", password: "", name: "", role: "Doctor" });
  const [regError, setRegError] = useState<string | null>(null);
  const [regSuccess, setRegSuccess] = useState<string | null>(null);

  // Edit User Modal State
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ name: "", username: "", role: "Doctor", password: "" });
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState<string | null>(null);

  const startEditUser = (usr: User) => {
    setEditingUser(usr);
    setEditForm({
      name: usr.name,
      username: usr.username,
      role: usr.role,
      password: ""
    });
    setEditError(null);
    setEditSuccess(null);
  };

  const handleSaveEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditError(null);
    setEditSuccess(null);

    try {
      setLoading(true);
      await updateUser(editingUser.id, {
        name: editForm.name.trim(),
        username: editForm.username.trim(),
        role: editForm.role as any,
        password: editForm.password ? editForm.password : undefined
      });

      onRefresh();
      setEditSuccess("User details updated successfully!");
      setTimeout(() => {
        setEditingUser(null);
        setEditSuccess(null);
      }, 1500);
    } catch (err: any) {
      setEditError(err.message || "Failed to update user details.");
    } finally {
      setLoading(false);
    }
  };
  
  const [loading, setLoading] = useState(false);

  // Backups & Snapshots state
  const [snapshots, setSnapshots] = useState<BackupSnapshotMeta[]>([]);
  const [loadingSnapshots, setLoadingSnapshots] = useState(false);
  const [backupActionMsg, setBackupActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Upload DB Backup Modal State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadParsed, setUploadParsed] = useState<any | null>(null);
  const [uploadStats, setUploadStats] = useState<{
    patientCount: number;
    recordCount: number;
    userCount: number;
    testCount: number;
    srvCount: number;
    type: string;
    filename: string;
    sizeKb: string;
  } | null>(null);
  const [uploadMode, setUploadMode] = useState<'replace' | 'merge' | 'archive_only'>('replace');
  const [uploadProcessing, setUploadProcessing] = useState(false);
  const [uploadModalError, setUploadModalError] = useState<string | null>(null);
  const [uploadModalSuccess, setUploadModalSuccess] = useState<string | null>(null);

  const processBackupFile = async (file: File) => {
    setUploadFile(file);
    setUploadModalError(null);
    setUploadModalSuccess(null);
    setUploadParsed(null);
    setUploadStats(null);

    if (!file.name.toLowerCase().endsWith(".json")) {
      setUploadModalError("Please select a valid .json backup file.");
      return;
    }

    try {
      const text = await file.text();
      let parsed: any;
      try {
        parsed = JSON.parse(text);
      } catch (e) {
        setUploadModalError("File content is not valid JSON. Please ensure the file is uncorrupted.");
        return;
      }

      if (!parsed || typeof parsed !== "object") {
        setUploadModalError("Invalid JSON structure. Root element is empty or not an object.");
        return;
      }

      // Extract wrapped target
      let target = parsed;
      let detectedType = "Standard Database Export";
      if (parsed.database && typeof parsed.database === "object" && !Array.isArray(parsed.database)) {
        target = parsed.database;
        detectedType = parsed.meta?.type ? `${parsed.meta.type.toUpperCase()} Snapshot Archive` : "Database Snapshot Archive";
      } else if (parsed.db && typeof parsed.db === "object" && !Array.isArray(parsed.db)) {
        target = parsed.db;
        detectedType = "Clinic DB Wrapper";
      } else if (parsed.data && typeof parsed.data === "object" && !Array.isArray(parsed.data)) {
        target = parsed.data;
        detectedType = "Data Wrapper";
      } else if (parsed.clinic && typeof parsed.clinic === "object" && !Array.isArray(parsed.clinic)) {
        target = parsed.clinic;
      } else if (Array.isArray(parsed)) {
        detectedType = "Patients Array";
        target = { patients: parsed };
      }

      const patientCount = Array.isArray(target.patients) ? target.patients.length : 0;
      const recordCount = Array.isArray(target.records) ? target.records.length : 0;
      const userCount = Array.isArray(target.users) ? target.users.length : 0;
      const testCount = Array.isArray(target.tests) ? target.tests.length : 0;
      const srvCount = Array.isArray(target.extraServices) ? target.extraServices.length : 0;

      if (patientCount === 0 && recordCount === 0 && userCount === 0 && testCount === 0) {
        setUploadModalError("No clinical patients, consultation records, or staff users found in this JSON file.");
        return;
      }

      setUploadParsed(parsed);
      setUploadStats({
        patientCount,
        recordCount,
        userCount,
        testCount,
        srvCount,
        type: detectedType,
        filename: file.name,
        sizeKb: (file.size / 1024).toFixed(1)
      });
      setIsUploadModalOpen(true);
    } catch (err: any) {
      setUploadModalError(err.message || "Failed to process backup file.");
    }
  };

  const handleExecuteImport = async () => {
    if (!uploadParsed) return;
    setUploadProcessing(true);
    setUploadModalError(null);
    setUploadModalSuccess(null);

    try {
      if (uploadMode === 'archive_only') {
        const res = await uploadBackupSnapshot(uploadParsed);
        await loadSnapshots();
        setUploadModalSuccess(res.message || `Backup saved to Snapshots list successfully! (${res.filename})`);
      } else {
        const res = await importDatabase(uploadParsed, uploadMode);
        await onRefresh();
        await loadSnapshots();
        setUploadModalSuccess(res.message || "Database imported and restored successfully!");
      }

      setTimeout(() => {
        setIsUploadModalOpen(false);
        setUploadFile(null);
        setUploadParsed(null);
        setUploadStats(null);
        setUploadModalSuccess(null);
      }, 2000);
    } catch (err: any) {
      setUploadModalError(err.message || "Failed to import database.");
    } finally {
      setUploadProcessing(false);
    }
  };

  const loadSnapshots = async () => {
    try {
      setLoadingSnapshots(true);
      const data = await fetchBackups();
      setSnapshots(data);
    } catch (err: any) {
      console.error("Failed to load snapshots", err);
    } finally {
      setLoadingSnapshots(false);
    }
  };

  useEffect(() => {
    loadSnapshots();
  }, []);

  const handleCreateSnapshot = async () => {
    try {
      setLoading(true);
      setBackupActionMsg(null);
      await createBackupSnapshot();
      await loadSnapshots();
      setBackupActionMsg({ type: 'success', text: 'Backup snapshot created successfully!' });
      setTimeout(() => setBackupActionMsg(null), 3000);
    } catch (err: any) {
      setBackupActionMsg({ type: 'error', text: err.message || 'Failed to create snapshot.' });
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreSnapshot = async (filename: string) => {
    if (!window.confirm(`Are you sure you want to restore the database state from snapshot "${filename}"?\n\nAn automatic pre-restore safety backup of your current database will be saved first.`)) {
      return;
    }

    try {
      setLoading(true);
      setBackupActionMsg(null);
      const res = await restoreBackupSnapshot(filename);
      await onRefresh();
      await loadSnapshots();
      setBackupActionMsg({ type: 'success', text: res.message || `Database restored from ${filename} successfully!` });
      setTimeout(() => setBackupActionMsg(null), 4000);
    } catch (err: any) {
      setBackupActionMsg({ type: 'error', text: err.message || 'Failed to restore snapshot.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSnapshot = async (filename: string) => {
    if (!window.confirm(`Delete snapshot file "${filename}" permanently?`)) return;

    try {
      setLoading(true);
      setBackupActionMsg(null);
      await deleteBackupSnapshot(filename);
      await loadSnapshots();
      setBackupActionMsg({ type: 'success', text: `Snapshot ${filename} deleted.` });
      setTimeout(() => setBackupActionMsg(null), 3000);
    } catch (err: any) {
      setBackupActionMsg({ type: 'error', text: err.message || 'Failed to delete snapshot.' });
    } finally {
      setLoading(false);
    }
  };

  // Financial Reporting Period state
  const [reportPeriod, setReportPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom'>('monthly');
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  useEffect(() => {
    const today = new Date();
    const end = today.toISOString().split('T')[0];
    let start = "";

    if (reportPeriod === 'daily') {
      start = end;
    } else if (reportPeriod === 'weekly') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      start = d.toISOString().split('T')[0];
    } else if (reportPeriod === 'monthly') {
      const d = new Date();
      d.setMonth(d.getMonth() - 1);
      start = d.toISOString().split('T')[0];
    } else if (reportPeriod === 'yearly') {
      const d = new Date();
      d.setFullYear(d.getFullYear() - 1);
      start = d.toISOString().split('T')[0];
    }

    if (start) {
      setStartDate(start);
      setEndDate(end);
    }
  }, [reportPeriod]);

  // Aggregated data calculation
  const startMs = startDate ? new Date(startDate + "T00:00:00").getTime() : 0;
  const endMs = endDate ? new Date(endDate + "T23:59:59").getTime() : Infinity;

  // Filter records in date range
  const filteredRecords = db.records.filter(r => {
    const recordMs = new Date(r.date).getTime();
    return recordMs >= startMs && recordMs <= endMs;
  });

  // Calculate stats for filtered records
  let filteredLabCount = 0;
  let filteredLabRevenue = 0;
  let filteredSrvCount = 0;
  let filteredSrvRevenue = 0;

  const labRevenueByTest: Record<string, { count: number; revenue: number }> = {};
  const srvRevenueByType: Record<string, { count: number; revenue: number }> = {};
  const revenueByStaff: Record<string, { count: number; revenue: number }> = {};

  filteredRecords.forEach(rec => {
    // 1. Lab Request
    if (rec.labRequest) {
      rec.labRequest.testIds.forEach(testId => {
        const testObj = db.tests.find(t => t.id === testId);
        if (testObj) {
          filteredLabCount++;
          filteredLabRevenue += testObj.cost;

          if (!labRevenueByTest[testObj.name]) {
            labRevenueByTest[testObj.name] = { count: 0, revenue: 0 };
          }
          labRevenueByTest[testObj.name].count++;
          labRevenueByTest[testObj.name].revenue += testObj.cost;

          // Lab performed by labTech
          const staffId = rec.labRequest?.technicianId || "Unknown Lab Clinician";
          const staffUser = db.users.find(u => u.id === staffId || u.username === staffId);
          const staff = staffUser ? staffUser.name : staffId;
          if (!revenueByStaff[staff]) {
            revenueByStaff[staff] = { count: 0, revenue: 0 };
          }
          revenueByStaff[staff].count++;
          revenueByStaff[staff].revenue += testObj.cost;
        }
      });
    }

    // 2. Extra Services / Nursing
    if (rec.extraServices) {
      rec.extraServices.forEach(s => {
        filteredSrvCount++;
        filteredSrvRevenue += s.cost;

        if (!srvRevenueByType[s.name]) {
          srvRevenueByType[s.name] = { count: 0, revenue: 0 };
        }
        srvRevenueByType[s.name].count++;
        srvRevenueByType[s.name].revenue += s.cost;

        // Nursing performed by staffMember
        const staff = rec.staffMember || "Unknown Nursing Staff";
        if (!revenueByStaff[staff]) {
          revenueByStaff[staff] = { count: 0, revenue: 0 };
        }
        revenueByStaff[staff].count++;
        revenueByStaff[staff].revenue += s.cost;
      });
    }
  });

  const totalFilteredRevenue = filteredLabRevenue + filteredSrvRevenue;

  // Submit extra service addition
  const handleAddSrv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!srvForm.name.trim()) {
      alert("Please fill out Service Name.");
      return;
    }

    try {
      setLoading(true);
      await addExtraService({
        name: srvForm.name.trim(),
        cost: srvForm.cost ? Number(srvForm.cost) : 0,
        description: srvForm.description.trim()
      });
      setSrvForm({ name: "", cost: "", description: "" });
      onRefresh();
      alert("Extra clinical service registered successfully!");
    } catch (err: any) {
      alert(err.message || "Failed to add service.");
    } finally {
      setLoading(false);
    }
  };

  // Submit user registration
  const handleRegisterUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);
    setRegSuccess(null);

    if (!userForm.username || !userForm.password || !userForm.name || !userForm.role) {
      setRegError("Please fill in all staff details.");
      return;
    }

    try {
      setLoading(true);
      await registerUser({
        username: userForm.username.trim(),
        password: userForm.password,
        name: userForm.name.trim(),
        role: userForm.role
      });
      setRegSuccess(`Successfully registered ${userForm.name} as a ${userForm.role}!`);
      setUserForm({ username: "", password: "", name: "", role: "Doctor" });
      onRefresh();
    } catch (err: any) {
      setRegError(err.message || "Staff registration failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeregisterUser = async (userId: string, name: string) => {
    if (userId === "u_adm") {
      alert("Cannot deregister the default administrator.");
      return;
    }
    if (!window.confirm(`Are you sure you want to deregister ${name} from the clinical staff roster? This action is irreversible.`)) {
      return;
    }

    try {
      setLoading(true);
      await deregisterUser(userId);
      onRefresh();
      alert(`${name} has been deregistered successfully.`);
    } catch (err: any) {
      alert(err.message || "Failed to deregister staff user.");
    } finally {
      setLoading(false);
    }
  };

  // Reset/Reseed Database
  const handleResetDb = async () => {
    if (!window.confirm("WARNING: This will erase all newly added patients, consultations, and test entries and restore the clinic to its standard demo dataset. Are you sure you want to proceed?")) {
      return;
    }

    try {
      setLoading(true);
      await resetDatabase();
      onRefresh();
      alert("Database has been reset and reseeded with default profiles successfully!");
    } catch (err: any) {
      alert(err.message || "Failed to reset database.");
    } finally {
      setLoading(false);
    }
  };

  // Export DB Backup
  const handleExportDb = () => {
    try {
      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(db, null, 2)
      )}`;
      const downloadAnchor = document.createElement("a");
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      downloadAnchor.setAttribute("href", jsonString);
      downloadAnchor.setAttribute("download", `clinic_db_backup_${timestamp}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err: any) {
      alert("Failed to export database: " + err.message);
    }
  };

  // Import DB Backup - triggers modal with file inspection
  const handleImportDb = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processBackupFile(file);
    e.target.value = "";
  };

  // Quick statistics calculation
  const totalPatients = db.patients.length;
  const totalRecords = db.records.length;
  const pendingLabs = db.records.filter(r => r.labStatus === "pending").length;
  const completedLabs = db.records.filter(r => r.labStatus === "completed").length;
  const pendingRx = db.records.filter(r => r.prescriptionStatus === "pending").length;
  const completedRx = db.records.filter(r => r.prescriptionStatus === "fully_dispatched").length;

  // Calculate gross clinic billing/revenue in KES
  let totalServiceRevenue = 0;
  let totalLabRevenue = 0;

  db.records.forEach(rec => {
    // Add extra services costs
    rec.extraServices?.forEach(s => {
      totalServiceRevenue += s.cost;
    });

    // Add lab tests costs
    if (rec.labRequest) {
      rec.labRequest.testIds.forEach(testId => {
        const testObj = db.tests.find(t => t.id === testId);
        if (testObj) totalLabRevenue += testObj.cost;
      });
    }
  });

  return (
    <div className="space-y-6 text-left" id="admin-dashboard">
      
      {/* Top Welcome Title */}
      <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-slate-800" />
            Clinic Operations & ERP Control Center
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Manage clinical staff rosters, configure nursing treatments, and analyze Kenian Shillings billing metrics.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportDb}
            disabled={loading}
            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold py-2 px-3.5 rounded-xl border border-emerald-100 flex items-center gap-1.5 transition shadow-xs"
            title="Download JSON Database Backup"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Back up DB</span>
          </button>

          <label className="bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-semibold py-2 px-3.5 rounded-xl border border-blue-100 flex items-center gap-1.5 cursor-pointer transition shadow-xs">
            <Upload className="w-3.5 h-3.5" />
            <span>Upload DB File</span>
            <input
              type="file"
              accept=".json"
              onChange={handleImportDb}
              className="hidden"
            />
          </label>

          <button
            onClick={handleResetDb}
            disabled={loading}
            className="bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold py-2 px-3.5 rounded-xl border border-rose-100 flex items-center gap-1.5 transition"
            title="Reset to initial default dataset"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Reset Demo DB</span>
          </button>
          
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3 py-2 text-xs text-rose-600 bg-rose-50 border border-rose-100 hover:bg-rose-100 rounded-xl transition font-semibold"
            title="Logout"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Practice Analytics Bento Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4" id="practice-analytics">
        
        {/* Metric 1 */}
        <div className="bg-white border border-slate-100 p-4 rounded-xl shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider">Total Patients</span>
            <strong className="text-lg font-bold text-slate-800">{totalPatients}</strong>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white border border-slate-100 p-4 rounded-xl shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider">Consultations</span>
            <strong className="text-lg font-bold text-slate-800">{totalRecords}</strong>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white border border-slate-100 p-4 rounded-xl shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600">
            <FlaskConical className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider">Lab Tests Queue</span>
            <strong className="text-lg font-bold text-slate-800">{pendingLabs} Pending</strong>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-white border border-slate-100 p-4 rounded-xl shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
            <Pill className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider">Pharmacy Rx Queue</span>
            <strong className="text-lg font-bold text-slate-800">{pendingRx} Pending</strong>
          </div>
        </div>
      </div>

      {/* Enhanced Practice Revenue Reports Dashboard */}
      <div className="bg-slate-900 text-slate-100 rounded-2xl p-6 shadow-md border border-slate-800 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-400" />
              <h3 className="font-extrabold text-base text-slate-100">Revenue Reports & Financial Auditing</h3>
            </div>
            <p className="text-xs text-slate-400 mt-1">Daily, weekly, monthly, and yearly clinical ledger calculations for Julius Medicare.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Period Toggles */}
            <div className="bg-slate-800 p-1 rounded-xl flex items-center border border-slate-700">
              {(['daily', 'weekly', 'monthly', 'yearly', 'custom'] as const).map((period) => (
                <button
                  key={period}
                  onClick={() => setReportPeriod(period)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition ${
                    reportPeriod === period
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {period}
                </button>
              ))}
            </div>

            {/* Print trigger */}
            <button
              onClick={() => {
                const serviceBreakdown = [
                  ...Object.keys(labRevenueByTest).map(name => ({
                    name: `Pathology: ${name}`,
                    cost: labRevenueByTest[name].revenue,
                    count: labRevenueByTest[name].count
                  })),
                  ...Object.keys(srvRevenueByType).map(name => ({
                    name: `Nursing: ${name}`,
                    cost: srvRevenueByType[name].revenue,
                    count: srvRevenueByType[name].count
                  }))
                ];
                const staffBreakdown = Object.keys(revenueByStaff).map(name => ({
                  name,
                  cost: revenueByStaff[name].revenue,
                  count: revenueByStaff[name].count
                }));
                printFinanceReport(
                  'combined',
                  reportPeriod,
                  totalFilteredRevenue,
                  filteredLabCount + filteredSrvCount,
                  serviceBreakdown,
                  staffBreakdown,
                  startDate,
                  endDate
                );
              }}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 text-xs shadow-xs"
            >
              <Printer className="w-4 h-4" />
              <span>Print Financial Report</span>
            </button>
          </div>
        </div>

        {/* Date Filters Row for Custom Selection */}
        {reportPeriod === 'custom' && (
          <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/60 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-400 block">Report Start Date</label>
              <div className="relative">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-100 outline-none focus:border-indigo-500"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-400 block">Report End Date</label>
              <div className="relative">
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-100 outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Aggregate Stats Summary row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-indigo-950/40 to-slate-900 border border-indigo-500/35 p-4 rounded-xl relative overflow-hidden">
            <div className="absolute right-3 top-3 opacity-15">
              <TrendingUp className="w-12 h-12 text-indigo-400" />
            </div>
            <span className="text-[10px] text-indigo-300 font-extrabold uppercase tracking-wider">Gross Filtered Revenue</span>
            <p className="text-2xl font-black text-white mt-1.5">KES {totalFilteredRevenue.toLocaleString()}</p>
            <p className="text-[10px] text-slate-400 mt-1">Roster Range: {new Date(startDate).toLocaleDateString()} - {new Date(endDate).toLocaleDateString()}</p>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl flex justify-between items-center">
            <div>
              <span className="text-[10px] text-blue-400 font-bold uppercase block tracking-wider">Lab Investigation Billing</span>
              <p className="text-lg font-bold text-slate-100 mt-1">KES {filteredLabRevenue.toLocaleString()}</p>
              <span className="text-[9px] text-slate-500 mt-0.5 block">{filteredLabCount} tests completed</span>
            </div>
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <FlaskConical className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl flex justify-between items-center">
            <div>
              <span className="text-[10px] text-purple-400 font-bold uppercase block tracking-wider">Nursing Procedures Billing</span>
              <p className="text-lg font-bold text-slate-100 mt-1">KES {filteredSrvRevenue.toLocaleString()}</p>
              <span className="text-[9px] text-slate-500 mt-0.5 block">{filteredSrvCount} procedures performed</span>
            </div>
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <Activity className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Breakdown details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Lab Breakdown */}
          <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800 flex flex-col h-80">
            <div className="flex items-center gap-1.5 mb-3 border-b border-slate-800 pb-2">
              <FlaskConical className="w-4 h-4 text-blue-400" />
              <h4 className="text-xs font-bold text-slate-200 uppercase">Pathology Investigations</h4>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
              {Object.keys(labRevenueByTest).length === 0 ? (
                <p className="text-slate-500 text-center py-16 italic text-[11px]">No lab test records logged in this interval.</p>
              ) : (
                Object.keys(labRevenueByTest).map((testName) => {
                  const { count, revenue } = labRevenueByTest[testName];
                  const pct = Math.min(100, Math.round((revenue / (filteredLabRevenue || 1)) * 100));
                  return (
                    <div key={testName} className="space-y-1">
                      <div className="flex justify-between font-semibold text-slate-300 text-[11px]">
                        <span className="truncate pr-2">{testName} ({count}x)</span>
                        <span className="font-mono text-blue-400 shrink-0 font-bold">KES {revenue.toLocaleString()}</span>
                      </div>
                      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-blue-500 h-full rounded-full" style={{ width: `${pct}%` }}></div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Nursing Breakdown */}
          <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800 flex flex-col h-80">
            <div className="flex items-center gap-1.5 mb-3 border-b border-slate-800 pb-2">
              <Activity className="w-4 h-4 text-purple-400" />
              <h4 className="text-xs font-bold text-slate-200 uppercase">Clinical Procedures</h4>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
              {Object.keys(srvRevenueByType).length === 0 ? (
                <p className="text-slate-500 text-center py-16 italic text-[11px]">No nursing services performed in this interval.</p>
              ) : (
                Object.keys(srvRevenueByType).map((srvName) => {
                  const { count, revenue } = srvRevenueByType[srvName];
                  const pct = Math.min(100, Math.round((revenue / (filteredSrvRevenue || 1)) * 100));
                  return (
                    <div key={srvName} className="space-y-1">
                      <div className="flex justify-between font-semibold text-slate-300 text-[11px]">
                        <span className="truncate pr-2">{srvName} ({count}x)</span>
                        <span className="font-mono text-purple-400 shrink-0 font-bold">KES {revenue.toLocaleString()}</span>
                      </div>
                      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-purple-500 h-full rounded-full" style={{ width: `${pct}%` }}></div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Staff Performance Breakdown */}
          <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800 flex flex-col h-80">
            <div className="flex items-center gap-1.5 mb-3 border-b border-slate-800 pb-2">
              <Users className="w-4 h-4 text-emerald-400" />
              <h4 className="text-xs font-bold text-slate-200 uppercase">Healthcare Provider Revenue</h4>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
              {Object.keys(revenueByStaff).length === 0 ? (
                <p className="text-slate-500 text-center py-16 italic text-[11px]">No clinical performances registered.</p>
              ) : (
                Object.keys(revenueByStaff).map((staffName) => {
                  const { count, revenue } = revenueByStaff[staffName];
                  const pct = Math.min(100, Math.round((revenue / (totalFilteredRevenue || 1)) * 100));
                  return (
                    <div key={staffName} className="space-y-1">
                      <div className="flex justify-between font-semibold text-slate-300 text-[11px]">
                        <span className="truncate pr-2">{staffName} ({count} assignments)</span>
                        <span className="font-mono text-emerald-400 shrink-0 font-bold">KES {revenue.toLocaleString()}</span>
                      </div>
                      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${pct}%` }}></div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Roster & User Management Section */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6" id="roster-setup-section">
        
        {/* Register Staff Panel */}
        <div className="md:col-span-5 bg-white border border-slate-100 p-5 rounded-xl shadow-sm">
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5 mb-2">
            <UserCheck className="w-4.5 h-4.5 text-slate-800" />
            Register Clinical Staff
          </h3>
          <p className="text-xs text-slate-500 mb-4">Add Doctor, Lab Tech (Pathologist), Pharmacist, or Receptionist accounts to the clinical system.</p>

          <form onSubmit={handleRegisterUser} className="space-y-4 text-xs">
            {regError && (
              <div className="p-2.5 bg-rose-50 border border-rose-100 text-rose-700 rounded-lg font-medium">
                {regError}
              </div>
            )}
            {regSuccess && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-lg font-medium">
                {regSuccess}
              </div>
            )}

            <div>
              <label className="block text-[10px] text-slate-500 font-bold mb-1">Staff Roster Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Dr. Jane Nduta"
                value={userForm.name}
                onChange={e => setUserForm({ ...userForm, name: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 outline-none focus:bg-white focus:ring-1 focus:ring-slate-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-slate-500 font-bold mb-1">Username *</label>
                <input
                  type="text"
                  required
                  placeholder="janenduta"
                  value={userForm.username}
                  onChange={e => setUserForm({ ...userForm, username: e.target.value.toLowerCase().trim() })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 outline-none focus:bg-white focus:ring-1 focus:ring-slate-400"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 font-bold mb-1">Assigned Portal Role *</label>
                <select
                  value={userForm.role}
                  onChange={e => setUserForm({ ...userForm, role: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 outline-none focus:bg-white focus:ring-1 focus:ring-slate-400 font-medium"
                >
                  <option value="Doctor">Doctor Portal</option>
                  <option value="LabTech">Lab Tech Portal</option>
                  <option value="Pharmacist">Pharmacist Portal</option>
                  <option value="Receptionist">Receptionist Portal</option>
                  <option value="Admin">System Administrator</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] text-slate-500 font-bold mb-1">Access Password *</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={userForm.password}
                onChange={e => setUserForm({ ...userForm, password: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 outline-none focus:bg-white focus:ring-1 focus:ring-slate-400"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 rounded-lg transition text-xs shadow-sm"
            >
              Save & Register Staff User
            </button>
          </form>
        </div>

        {/* Registered Staff Accounts */}
        <div className="md:col-span-7 bg-white border border-slate-100 p-5 rounded-xl shadow-sm flex flex-col h-[340px]">
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5 mb-2">
            <Users className="w-4.5 h-4.5 text-slate-800" />
            Registered Staff Roster Directory ({db.users?.length || 0})
          </h3>
          <p className="text-xs text-slate-500 mb-4">The following credentials are actively certified to enter their respective clinic gateways.</p>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1" id="staff-roster-list">
            {!db.users || db.users.length === 0 ? (
              <p className="text-slate-400 text-xs italic text-center py-12">No staff accounts registered.</p>
            ) : (
              db.users.map(usr => (
                <div key={usr.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex justify-between items-center text-xs">
                  <div>
                    <span className="font-bold text-slate-800">{usr.name}</span>
                    <p className="text-slate-400 text-[10px] font-semibold mt-0.5 font-mono">ID: {usr.id} • Username: @{usr.username}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md border ${
                      usr.role === "Doctor" ? "bg-blue-50 text-blue-700 border-blue-100" :
                      usr.role === "LabTech" ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                      usr.role === "Pharmacist" ? "bg-purple-50 text-purple-700 border-purple-100" :
                      usr.role === "Receptionist" ? "bg-amber-50 text-amber-700 border-amber-100" :
                      "bg-slate-800 text-white border-slate-900"
                    }`}>
                      {usr.role === "LabTech" ? "Lab Tech / Pathologist" : usr.role}
                    </span>
                    <button
                      onClick={() => startEditUser(usr)}
                      className="text-[10px] font-bold text-blue-600 hover:text-white bg-blue-50 hover:bg-blue-600 border border-blue-100 hover:border-blue-600 px-2 py-0.5 rounded transition flex items-center gap-1"
                      title="Edit User Details"
                    >
                      <Pencil className="w-3 h-3" />
                      <span>Edit</span>
                    </button>
                    {usr.id !== "u_adm" && (
                      <button
                        onClick={() => handleDeregisterUser(usr.id, usr.name)}
                        className="text-[10px] font-bold text-rose-600 hover:text-white bg-rose-50 hover:bg-rose-600 border border-rose-100 hover:border-rose-600 px-2 py-0.5 rounded transition"
                      >
                        Deregister
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* EDIT USER MODAL */}
      {editingUser && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md p-5 space-y-4 animate-fade-in">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Pencil className="w-4 h-4 text-slate-800" />
                <h3 className="font-bold text-slate-800 text-sm">Edit Staff User Record</h3>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editError && (
              <div className="p-2.5 bg-rose-50 border border-rose-100 text-rose-800 text-xs rounded-lg font-medium">
                {editError}
              </div>
            )}
            {editSuccess && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs rounded-lg font-medium">
                {editSuccess}
              </div>
            )}

            <form onSubmit={handleSaveEditUser} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] text-slate-500 font-bold mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs outline-none focus:bg-white focus:ring-1 focus:ring-slate-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-500 font-bold mb-1">Username *</label>
                  <input
                    type="text"
                    required
                    value={editForm.username}
                    onChange={e => setEditForm({ ...editForm, username: e.target.value.toLowerCase().trim() })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs outline-none focus:bg-white focus:ring-1 focus:ring-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 font-bold mb-1">Role *</label>
                  <select
                    value={editForm.role}
                    onChange={e => setEditForm({ ...editForm, role: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs outline-none focus:bg-white focus:ring-1 focus:ring-slate-400 font-medium"
                  >
                    <option value="Doctor">Doctor Portal</option>
                    <option value="LabTech">Lab Tech Portal</option>
                    <option value="Pharmacist">Pharmacist Portal</option>
                    <option value="Receptionist">Receptionist Portal</option>
                    <option value="Admin">System Administrator</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 font-bold mb-1">
                  New Password <span className="font-normal text-slate-400">(Leave blank to keep current)</span>
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={editForm.password}
                  onChange={e => setEditForm({ ...editForm, password: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs outline-none focus:bg-white focus:ring-1 focus:ring-slate-400"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 rounded-lg transition text-xs shadow-sm"
                >
                  Save Changes
                </button>
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 rounded-lg transition text-xs"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Daily Auto Backups & Snapshots Manager */}
      <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-800 text-sm">Database Snapshots & Daily Auto Backups</h3>
                <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Auto-Backup Active
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">Automated daily snapshots generated every 24 hours. Manage, restore, or download historical database snapshots anytime.</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setUploadFile(null);
                setUploadParsed(null);
                setUploadStats(null);
                setUploadModalError(null);
                setUploadModalSuccess(null);
                setIsUploadModalOpen(true);
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2 px-3.5 rounded-xl transition flex items-center gap-1.5 shadow-sm"
              title="Upload a backup JSON file from your computer"
            >
              <FileUp className="w-3.5 h-3.5" />
              <span>Upload Backup</span>
            </button>
            <button
              onClick={handleCreateSnapshot}
              disabled={loading}
              className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold py-2 px-3.5 rounded-xl transition flex items-center gap-1.5 shadow-sm"
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span>Create Snapshot</span>
            </button>
            <button
              onClick={loadSnapshots}
              disabled={loadingSnapshots}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold py-2 px-3.5 rounded-xl transition flex items-center gap-1"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingSnapshots ? "animate-spin" : ""}`} />
              <span>Refresh List</span>
            </button>
          </div>
        </div>

        {backupActionMsg && (
          <div className={`p-3 rounded-xl text-xs font-medium ${
            backupActionMsg.type === 'success' ? 'bg-emerald-50 border border-emerald-100 text-emerald-800' : 'bg-rose-50 border border-rose-100 text-rose-800'
          }`}>
            {backupActionMsg.text}
          </div>
        )}

        {/* Snapshots Grid */}
        <div className="space-y-2">
          {snapshots.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
              {loadingSnapshots ? "Loading snapshots..." : "No backup snapshots found yet. Click 'Create Snapshot' to take an instant backup."}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {snapshots.map(snap => {
                const isAuto = snap.type === 'auto';
                const isSafety = snap.type === 'safety';
                const dateStr = new Date(snap.createdAt).toLocaleString(undefined, {
                  dateStyle: 'medium',
                  timeStyle: 'short'
                });

                return (
                  <div key={snap.filename} className="bg-slate-50 hover:bg-slate-50/80 border border-slate-200/80 rounded-xl p-3.5 flex flex-col justify-between space-y-3 transition">
                    <div>
                      <div className="flex justify-between items-start mb-1.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                          isAuto ? 'bg-blue-100/80 text-blue-800' : isSafety ? 'bg-purple-100/80 text-purple-800' : 'bg-emerald-100/80 text-emerald-800'
                        }`}>
                          <Clock className="w-3 h-3" />
                          {isAuto ? 'Daily Auto-Backup' : isSafety ? 'Pre-Restore Safety' : 'Manual Snapshot'}
                        </span>
                        {snap.sizeBytes && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            {(snap.sizeBytes / 1024).toFixed(1)} KB
                          </span>
                        )}
                      </div>

                      <h4 className="font-mono text-xs font-bold text-slate-800 truncate" title={snap.filename}>
                        {snap.filename}
                      </h4>
                      <p className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <span>{dateStr}</span>
                      </p>

                      <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center gap-3 text-[10px] text-slate-600 font-medium">
                        <span>👥 <strong>{snap.patientCount ?? 0}</strong> Patients</span>
                        <span>📋 <strong>{snap.recordCount ?? 0}</strong> Consultations</span>
                      </div>
                    </div>

                    <div className="flex gap-1.5 pt-2 border-t border-slate-200/60">
                      <button
                        onClick={() => handleRestoreSnapshot(snap.filename)}
                        disabled={loading}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-1.5 px-2 rounded-lg text-[11px] transition flex items-center justify-center gap-1 shadow-xs"
                        title="Restore database to this state"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Restore</span>
                      </button>

                      <a
                        href={`/api/backups/${encodeURIComponent(snap.filename)}/download`}
                        download={snap.filename}
                        className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-1.5 px-2.5 rounded-lg text-[11px] transition flex items-center justify-center"
                        title="Download snapshot JSON file"
                      >
                        <Download className="w-3 h-3" />
                      </a>

                      <button
                        onClick={() => handleDeleteSnapshot(snap.filename)}
                        disabled={loading}
                        className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold py-1.5 px-2.5 rounded-lg text-[11px] transition flex items-center justify-center"
                        title="Delete snapshot"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Extra Services Cost Setup & Library */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Form panel to add Extra Services */}
        <div className="md:col-span-5 bg-white border border-slate-100 p-5 rounded-xl shadow-sm">
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5 mb-2">
            <PlusCircle className="w-4.5 h-4.5 text-slate-800" />
            Configure Extra Clinical Service
          </h3>
          <p className="text-xs text-slate-500 mb-4">Add treatment, minor surgery, or auxiliary nursing services with dynamic, variable pricing.</p>

          <form onSubmit={handleAddSrv} className="space-y-4 text-xs">
            <div>
              <label className="block text-[10px] text-slate-500 font-bold mb-1">Service Name *</label>
              <input
                type="text"
                required
                placeholder="e.g., Minor Suturing / Stitching"
                value={srvForm.name}
                onChange={e => setSrvForm({ ...srvForm, name: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 outline-none focus:bg-white focus:ring-1 focus:ring-slate-400"
              />
            </div>

            <div>
              <label className="block text-[10px] text-slate-500 font-bold mb-1">Default Base Fee (KES) (Optional)</label>
              <input
                type="number"
                min="0"
                placeholder="e.g. 500 (Leave blank for variable pricing)"
                value={srvForm.cost}
                onChange={e => setSrvForm({ ...srvForm, cost: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 outline-none focus:bg-white focus:ring-1 focus:ring-slate-400"
              />
            </div>

            <div>
              <label className="block text-[10px] text-slate-500 font-bold mb-1">Clinical Description / Protocol</label>
              <textarea
                rows={3}
                placeholder="Describe sterilization protocol, nurse supplies required..."
                value={srvForm.description}
                onChange={e => setSrvForm({ ...srvForm, description: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 outline-none focus:bg-white focus:ring-1 focus:ring-slate-400"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 rounded-lg transition"
            >
              Add Service to Catalogue
            </button>
          </form>
        </div>

        {/* Catalog library listing */}
        <div className="md:col-span-7 bg-white border border-slate-100 p-5 rounded-xl shadow-sm flex flex-col h-[400px]">
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5 mb-2">
            <ClipboardCheck className="w-4.5 h-4.5 text-slate-800" />
            Active Nursing & Treatment Catalogue
          </h3>
          <p className="text-xs text-slate-500 mb-4">These services are instantly available for Doctors or Pharmacists to order during consultations with custom variable pricing.</p>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1" id="extra-services-catalogue-list">
            {db.extraServices.length === 0 ? (
              <p className="text-slate-400 text-xs italic text-center py-12">No extra clinical services configured.</p>
            ) : (
              db.extraServices.map(srv => (
                <div key={srv.id} className="p-3 bg-slate-50 border border-slate-150/40 rounded-lg flex justify-between items-center text-xs">
                  <div>
                    <span className="font-bold text-slate-800 text-sm">{srv.name}</span>
                    <p className="text-slate-500 text-[10px] mt-0.5">{srv.description || "No description provided."}</p>
                    <span className="text-[10px] font-mono text-slate-400 uppercase mt-1 block">ID: {srv.id}</span>
                  </div>
                  <strong className="text-slate-500 text-xs font-semibold shrink-0 ml-4 bg-slate-200/50 px-2.5 py-1 rounded-full uppercase tracking-wider">Variable Price</strong>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Upload & Restore Database Backup Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
                  <FileUp className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-800">Upload & Restore Database Backup</h3>
                  <p className="text-[11px] text-slate-500">Restore clinical records, patients, and staff rosters from a JSON backup file.</p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (!uploadProcessing) {
                    setIsUploadModalOpen(false);
                    setUploadFile(null);
                    setUploadParsed(null);
                    setUploadStats(null);
                    setUploadModalError(null);
                    setUploadModalSuccess(null);
                  }
                }}
                disabled={uploadProcessing}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 space-y-4 overflow-y-auto text-xs">
              
              {/* File Dropzone / Selector */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1.5">Select Backup File (.json) *</label>
                <div className="relative border-2 border-dashed border-slate-200 hover:border-blue-400 bg-slate-50 rounded-xl p-5 text-center transition cursor-pointer">
                  <input
                    type="file"
                    accept=".json"
                    disabled={uploadProcessing}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) processBackupFile(f);
                      e.target.value = "";
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <FileJson className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                  {uploadFile ? (
                    <div>
                      <p className="font-bold text-slate-800 text-xs">{uploadFile.name}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{(uploadFile.size / 1024).toFixed(1)} KB — Click or drop another file to change</p>
                    </div>
                  ) : (
                    <div>
                      <p className="font-semibold text-slate-700 text-xs">Click to browse or drag and drop a backup file</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Accepts exported clinic database files (.json) and snapshot backups</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Inspection Preview Stats */}
              {uploadStats && (
                <div className="bg-blue-50/70 border border-blue-100 rounded-xl p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-blue-900 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                      Backup Inspected Successfully
                    </span>
                    <span className="text-[10px] font-mono bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-bold">
                      {uploadStats.type}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="bg-white/80 rounded-lg p-2 border border-blue-100/60 flex items-center gap-2">
                      <span className="text-slate-600">👥 <strong>{uploadStats.patientCount}</strong> Patients</span>
                    </div>
                    <div className="bg-white/80 rounded-lg p-2 border border-blue-100/60 flex items-center gap-2">
                      <span className="text-slate-600">📋 <strong>{uploadStats.recordCount}</strong> Consultations</span>
                    </div>
                    <div className="bg-white/80 rounded-lg p-2 border border-blue-100/60 flex items-center gap-2">
                      <span className="text-slate-600">👨‍⚕️ <strong>{uploadStats.userCount}</strong> Staff Users</span>
                    </div>
                    <div className="bg-white/80 rounded-lg p-2 border border-blue-100/60 flex items-center gap-2">
                      <span className="text-slate-600">🧪 <strong>{uploadStats.testCount}</strong> Lab Tests</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Mode Selection */}
              {uploadStats && (
                <div className="space-y-2">
                  <label className="block text-[11px] font-bold text-slate-700">Choose Restore / Import Action:</label>
                  
                  {/* Option 1: Full Restore */}
                  <label className={`block p-3 rounded-xl border transition cursor-pointer ${
                    uploadMode === 'replace' ? 'bg-blue-50/50 border-blue-400 ring-1 ring-blue-400' : 'bg-slate-50 border-slate-200 hover:bg-slate-100/60'
                  }`}>
                    <div className="flex items-start gap-2.5">
                      <input
                        type="radio"
                        name="importMode"
                        checked={uploadMode === 'replace'}
                        onChange={() => setUploadMode('replace')}
                        className="mt-0.5 text-blue-600"
                      />
                      <div>
                        <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                          <span>Full Restore (Replace Database)</span>
                          <span className="bg-blue-100 text-blue-700 text-[9px] font-extrabold px-1.5 py-0.5 rounded">Recommended</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">Completely restores the active clinic database to the exact state inside this backup file.</p>
                        <p className="text-[10px] text-emerald-700 font-medium mt-1 flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3 text-emerald-600" />
                          A pre-restore safety backup of your current database will automatically be saved.
                        </p>
                      </div>
                    </div>
                  </label>

                  {/* Option 2: Smart Merge */}
                  <label className={`block p-3 rounded-xl border transition cursor-pointer ${
                    uploadMode === 'merge' ? 'bg-blue-50/50 border-blue-400 ring-1 ring-blue-400' : 'bg-slate-50 border-slate-200 hover:bg-slate-100/60'
                  }`}>
                    <div className="flex items-start gap-2.5">
                      <input
                        type="radio"
                        name="importMode"
                        checked={uploadMode === 'merge'}
                        onChange={() => setUploadMode('merge')}
                        className="mt-0.5 text-blue-600"
                      />
                      <div>
                        <div className="font-bold text-slate-800 text-xs">Smart Merge (Non-Destructive)</div>
                        <p className="text-[11px] text-slate-500 mt-0.5">Appends missing patients and consultations from this file without deleting existing records.</p>
                      </div>
                    </div>
                  </label>

                  {/* Option 3: Save to Snapshots Only */}
                  <label className={`block p-3 rounded-xl border transition cursor-pointer ${
                    uploadMode === 'archive_only' ? 'bg-blue-50/50 border-blue-400 ring-1 ring-blue-400' : 'bg-slate-50 border-slate-200 hover:bg-slate-100/60'
                  }`}>
                    <div className="flex items-start gap-2.5">
                      <input
                        type="radio"
                        name="importMode"
                        checked={uploadMode === 'archive_only'}
                        onChange={() => setUploadMode('archive_only')}
                        className="mt-0.5 text-blue-600"
                      />
                      <div>
                        <div className="font-bold text-slate-800 text-xs">Archive in Snapshots List Only</div>
                        <p className="text-[11px] text-slate-500 mt-0.5">Saves this backup in your historical snapshot archive without activating or restoring it right now.</p>
                      </div>
                    </div>
                  </label>
                </div>
              )}

              {/* Error Alert */}
              {uploadModalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-start gap-2 text-xs">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{uploadModalError}</span>
                </div>
              )}

              {/* Success Alert */}
              {uploadModalSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-start gap-2 text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{uploadModalSuccess}</span>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsUploadModalOpen(false);
                  setUploadFile(null);
                  setUploadParsed(null);
                  setUploadStats(null);
                }}
                disabled={uploadProcessing}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/70 rounded-xl transition"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleExecuteImport}
                disabled={!uploadParsed || uploadProcessing}
                className={`px-4 py-2 text-xs font-bold text-white rounded-xl transition flex items-center gap-1.5 shadow-sm ${
                  !uploadParsed || uploadProcessing ? 'bg-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {uploadProcessing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Processing Backup...</span>
                  </>
                ) : uploadMode === 'archive_only' ? (
                  <>
                    <HardDrive className="w-3.5 h-3.5" />
                    <span>Save to Snapshots</span>
                  </>
                ) : uploadMode === 'merge' ? (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Merge Database Now</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restore Database Now</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
