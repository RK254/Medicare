import React, { useState } from "react";
import { motion } from "motion/react";
import { 
  Search, UserPlus, ClipboardEdit, CheckCircle, Clock, Plus, Trash2, 
  Thermometer, Heart, Droplet, ClipboardList, RefreshCw, LogOut, UserCheck
} from "lucide-react";
import { ClinicDatabase, Patient, Triage } from "../types";
import { registerPatient, createClinicRecord } from "../utils/api";

interface ReceptionistDashboardProps {
  db: ClinicDatabase;
  onRefresh: () => void;
  onLogout: () => void;
  currentUser: { name: string };
}

export default function ReceptionistDashboard({ db, onRefresh, onLogout, currentUser }: ReceptionistDashboardProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(db.patients[0]?.id || null);

  // Registration Form State
  const [isRegistering, setIsRegistering] = useState(false);
  const [regError, setRegError] = useState("");
  const [regSuccess, setRegSuccess] = useState(false);
  const [newPatient, setNewPatient] = useState({
    id: "",
    name: "",
    phone: "",
    sex: "Male" as const,
    maritalStatus: "Single" as const,
    age: "",
    dob: "",
    isUnderage: false,
    parentName: "",
    parentPhone: "",
  });

  const resetRegisterForm = () => {
    setNewPatient({
      id: "",
      name: "",
      phone: "",
      sex: "Male",
      maritalStatus: "Single",
      age: "",
      dob: "",
      isUnderage: false,
      parentName: "",
      parentPhone: "",
    });
    setRegError("");
  };

  const handleDobChange = (dobVal: string) => {
    let calculatedAge = newPatient.age;
    if (dobVal) {
      const birthDate = new Date(dobVal);
      const today = new Date();
      if (!isNaN(birthDate.getTime())) {
        let years = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          years--;
        }
        if (years >= 0) calculatedAge = String(years);
      }
    }
    setNewPatient(prev => ({ ...prev, dob: dobVal, age: calculatedAge }));
  };

  // Triage / Check-in State
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [symptoms, setSymptoms] = useState("");
  const [triage, setTriage] = useState<Triage>({
    temperature: 37.0,
    systolicBP: 120,
    diastolicBP: 80,
    pulseRate: 72,
    oxygenSaturation: 98,
    weight: 70,
    height: 170,
    recordedAt: ""
  });
  const [checkInError, setCheckInError] = useState("");
  const [checkInSuccess, setCheckInSuccess] = useState(false);

  // Sync / Refresh
  const [isRefreshing, setIsRefreshing] = useState(false);
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await onRefresh();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Filter Patients
  const filteredPatients = db.patients.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.phone.includes(searchTerm)
  );

  const activePatient = db.patients.find(p => p.id === selectedPatientId);

  // Active checked-in patients (records created today or active queues)
  const activeQueue = db.records.filter(r => {
    // Show records with pending lab, pending prescription, or completed lab
    return r.labStatus === "pending" || r.prescriptionStatus === "pending" || (r.ailment === "Under investigation" || r.ailment === "Investigation ongoing");
  });

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError("");
    setRegSuccess(false);

    if (!newPatient.name.trim()) {
      setRegError("Patient full name is required.");
      return;
    }

    if (newPatient.age === "" || newPatient.age === undefined || newPatient.age === null) {
      setRegError("Patient age is required.");
      return;
    }

    const effectivePhone = newPatient.phone.trim() || newPatient.parentPhone.trim();
    if (!effectivePhone) {
      setRegError(newPatient.isUnderage ? "Parent/Guardian phone number is required for underage registration." : "Phone number is required.");
      return;
    }

    try {
      const saved = await registerPatient({
        id: newPatient.id.trim(),
        name: newPatient.name.trim(),
        phone: effectivePhone,
        sex: newPatient.sex,
        maritalStatus: newPatient.maritalStatus,
        age: Number(newPatient.age),
        dob: newPatient.dob || undefined,
        isUnderage: newPatient.isUnderage,
        parentName: newPatient.parentName ? newPatient.parentName.trim() : undefined,
        parentPhone: newPatient.parentPhone ? newPatient.parentPhone.trim() : undefined,
      });

      await onRefresh();
      setSelectedPatientId(saved.id);
      setIsRegistering(false);
      setRegSuccess(true);
      resetRegisterForm();
      setTimeout(() => setRegSuccess(false), 3000);
    } catch (err: any) {
      setRegError(err.message || "Registration failed.");
    }
  };

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setCheckInError("");
    setCheckInSuccess(false);

    if (!selectedPatientId) return;

    try {
      await createClinicRecord({
        patientId: selectedPatientId,
        triage: triage,
        symptoms: symptoms.trim() || "Patient check-in & triage conducted",
        ailment: "Under investigation",
        extraServices: [],
        labTestIds: [],
        prescriptionMedications: []
      });

      onRefresh();
      setIsCheckingIn(false);
      setSymptoms("");
      setCheckInSuccess(true);
      setTimeout(() => setCheckInSuccess(false), 3000);
    } catch (err: any) {
      setCheckInError(err.message || "Failed to check-in patient.");
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 font-sans" id="receptionist-dashboard">
      
      {/* Top Banner Bar */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-10 px-4 py-3 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-amber-500 rounded-xl text-white flex items-center justify-center font-bold">
            <ClipboardList className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-800 tracking-tight">Jul Medicare</h1>
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Reception & Patient Registration Portal</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex flex-col text-right">
            <span className="text-xs font-bold text-slate-700">{currentUser.name}</span>
            <span className="text-[9px] text-amber-600 font-semibold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100 self-end">RECEPTIONIST</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-50 border border-slate-200 rounded-lg transition"
              title="Sync Records"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-amber-600" : ""}`} />
            </button>
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-rose-600 bg-rose-50 border border-rose-100 hover:bg-rose-100 rounded-lg transition font-semibold"
              title="Logout"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Log Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Grid Content */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Patient List (4 cols) */}
        <section className="lg:col-span-4 bg-white rounded-2xl border border-slate-100 p-4 flex flex-col h-[calc(100vh-160px)] shadow-sm" id="patient-list-section">
          
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Patient Directory</h2>
            <button
              onClick={() => {
                setIsRegistering(!isRegistering);
                setIsCheckingIn(false);
              }}
              className="text-xs bg-amber-500 hover:bg-amber-600 text-white font-bold py-1.5 px-3 rounded-lg flex items-center gap-1 transition shadow-sm"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>New Patient</span>
            </button>
          </div>

          {/* Directory Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search Name, National ID or Phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
            />
          </div>

          {regSuccess && (
            <div className="p-2.5 mb-3 bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs rounded-xl flex items-center gap-1.5 font-medium animate-fade-in">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Registered successfully!</span>
            </div>
          )}

          {checkInSuccess && (
            <div className="p-2.5 mb-3 bg-blue-50 border border-blue-100 text-blue-800 text-xs rounded-xl flex items-center gap-1.5 font-medium animate-fade-in">
              <UserCheck className="w-3.5 h-3.5" />
              <span>Checked in & sent to triage!</span>
            </div>
          )}

          {/* Registration Form (Inline) */}
          {isRegistering ? (
            <form onSubmit={handleRegister} className="bg-amber-50/50 p-4 rounded-xl border border-amber-100/60 mb-3 text-xs space-y-3">
              <div className="flex justify-between items-center border-b border-amber-200/50 pb-1.5">
                <span className="font-bold text-amber-800">Register New Patient</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={resetRegisterForm}
                    className="text-[10px] text-amber-700 hover:text-amber-900 bg-amber-100/60 hover:bg-amber-200 px-2 py-0.5 rounded font-semibold transition"
                    title="Clear / Empty All Form Fields"
                  >
                    Clear Form
                  </button>
                  <button type="button" onClick={() => setIsRegistering(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
                </div>
              </div>

              {regError && <div className="text-[10px] text-rose-600 font-semibold">{regError}</div>}

              {/* Underage Toggle Checkbox */}
              <div className="bg-white/80 p-2 rounded-lg border border-amber-200/60 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="underage-checkbox"
                  checked={newPatient.isUnderage}
                  onChange={e => setNewPatient({ ...newPatient, isUnderage: e.target.checked })}
                  className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                />
                <label htmlFor="underage-checkbox" className="text-xs font-bold text-slate-700 cursor-pointer">
                  Register as Underage / Child (Linked to Parent/Guardian)
                </label>
              </div>

              {/* Underage Parent Details */}
              {newPatient.isUnderage && (
                <div className="grid grid-cols-2 gap-2 bg-amber-100/40 p-2 rounded-lg border border-amber-200">
                  <div>
                    <label className="block text-[10px] font-bold text-amber-900 mb-0.5">Parent / Guardian Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Mary Wanjiku"
                      value={newPatient.parentName}
                      onChange={e => setNewPatient({ ...newPatient, parentName: e.target.value })}
                      className="w-full border border-slate-200 bg-white rounded-lg p-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-amber-900 mb-0.5">Parent Phone Number *</label>
                    <input
                      type="text"
                      required={newPatient.isUnderage}
                      placeholder="e.g. +254712345678"
                      value={newPatient.parentPhone}
                      onChange={e => setNewPatient({ ...newPatient, parentPhone: e.target.value, phone: newPatient.phone || e.target.value })}
                      className="w-full border border-slate-200 bg-white rounded-lg p-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">National ID / Passport No <span className="font-normal text-slate-400">(Optional)</span></label>
                  <input
                    type="text"
                    placeholder="e.g. 30291032 (Optional)"
                    value={newPatient.id}
                    onChange={e => setNewPatient({ ...newPatient, id: e.target.value })}
                    className="w-full border border-slate-200 bg-white rounded-lg p-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Peter Njoroge"
                    value={newPatient.name}
                    onChange={e => setNewPatient({ ...newPatient, name: e.target.value })}
                    className="w-full border border-slate-200 bg-white rounded-lg p-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Phone Number {newPatient.isUnderage && "(Child/Parent)"} *</label>
                  <input
                    type="text"
                    required={!newPatient.isUnderage}
                    placeholder="e.g. +254712345678"
                    value={newPatient.phone}
                    onChange={e => setNewPatient({ ...newPatient, phone: e.target.value })}
                    className="w-full border border-slate-200 bg-white rounded-lg p-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Date of Birth <span className="font-normal text-slate-400">(Optional)</span></label>
                  <input
                    type="date"
                    value={newPatient.dob}
                    onChange={e => handleDobChange(e.target.value)}
                    className="w-full border border-slate-200 bg-white rounded-lg p-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Age (Years) *</label>
                  <input
                    type="number"
                    required
                    placeholder="Years"
                    value={newPatient.age}
                    onChange={e => setNewPatient({ ...newPatient, age: e.target.value })}
                    className="w-full border border-slate-200 bg-white rounded-lg p-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Sex *</label>
                  <select
                    value={newPatient.sex}
                    onChange={e => setNewPatient({ ...newPatient, sex: e.target.value as any })}
                    className="w-full border border-slate-200 bg-white rounded-lg p-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Marital Status</label>
                  <select
                    value={newPatient.maritalStatus}
                    onChange={e => setNewPatient({ ...newPatient, maritalStatus: e.target.value as any })}
                    className="w-full border border-slate-200 bg-white rounded-lg p-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  >
                    <option value="Single">Single</option>
                    <option value="Married">Married</option>
                    <option value="Divorced">Divorced</option>
                    <option value="Widowed">Widowed</option>
                    <option value="Others">Others</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold py-2 rounded-lg tracking-wide transition shadow-sm"
                >
                  Register & Save Patient
                </button>
                <button
                  type="button"
                  onClick={resetRegisterForm}
                  className="px-3 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-2 rounded-lg transition"
                >
                  Reset
                </button>
              </div>
            </form>
          ) : null}

          {/* Patients scroll list */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1" id="receptionist-patient-scroll-list">
            {filteredPatients.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">No registered patients found.</div>
            ) : (
              filteredPatients.map(p => {
                const isSelected = p.id === selectedPatientId;
                return (
                  <div
                    key={p.id}
                    onClick={() => {
                      setSelectedPatientId(p.id);
                      setIsCheckingIn(false);
                    }}
                    className={`p-3 rounded-xl border transition cursor-pointer text-left flex items-center justify-between ${
                      isSelected 
                        ? "bg-amber-50 border-amber-300 text-amber-900" 
                        : "bg-white border-slate-100 hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <div>
                      <h4 className="font-bold text-xs">{p.name}</h4>
                      <p className="text-[10px] text-slate-400 font-semibold font-mono">ID: {p.id} • {p.age} yrs • {p.sex}</p>
                    </div>
                    <span className="text-[10px] bg-white border font-bold px-2 py-0.5 rounded-md text-slate-500 shadow-sm">{p.bloodGroup}</span>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Right Column: Work Area (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          
          {/* Work Card: Patient Summary & Check-in / Triage */}
          {activePatient ? (
            <section className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm" id="patient-workcard">
              <div className="border-b border-slate-100 pb-4 mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100">SELECTED PATIENT</span>
                  : <h2 className="text-lg font-bold text-slate-800 tracking-tight mt-1">{activePatient.name}</h2>
                  <p className="text-xs text-slate-400 font-semibold mt-0.5">
                    Phone: {activePatient.phone} | Marital: {activePatient.maritalStatus} | Registered on {new Date(activePatient.createdAt).toLocaleDateString()}
                  </p>
                </div>

                {!isCheckingIn && (
                  <button
                    onClick={() => setIsCheckingIn(true)}
                    className="bg-amber-500 hover:bg-amber-600 text-white font-bold py-2 px-4 rounded-xl text-xs flex items-center gap-1.5 transition shadow-sm"
                  >
                    <ClipboardEdit className="w-4 h-4" />
                    <span>Check-in & Record Vitals</span>
                  </button>
                )}
              </div>

              {isCheckingIn ? (
                <form onSubmit={handleCheckIn} className="space-y-4">
                  <div className="flex justify-between items-center bg-slate-50 p-2 rounded-xl border border-slate-100">
                    <span className="text-xs font-bold text-slate-700">Check-In Triaging Vitals Form</span>
                    <button type="button" onClick={() => setIsCheckingIn(false)} className="text-slate-400 hover:text-slate-600 font-bold text-xs">Cancel</button>
                  </div>

                  {checkInError && <div className="p-2.5 bg-rose-50 border border-rose-100 text-rose-700 text-xs rounded-xl font-medium">{checkInError}</div>}

                  {/* Vitals Form Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 flex items-center gap-1">
                        <Thermometer className="w-3.5 h-3.5 text-rose-500" />
                        <span>Temperature (°C)</span>
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        required
                        value={triage.temperature}
                        onChange={e => setTriage({ ...triage, temperature: Number(e.target.value) })}
                        className="w-full border border-slate-200 rounded-xl p-2 text-xs focus:ring-amber-500/20 focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 flex items-center gap-1">
                        <Heart className="w-3.5 h-3.5 text-rose-500" />
                        <span>BP Systolic (mmHg)</span>
                      </label>
                      <input
                        type="number"
                        required
                        value={triage.systolicBP}
                        onChange={e => setTriage({ ...triage, systolicBP: Number(e.target.value) })}
                        className="w-full border border-slate-200 rounded-xl p-2 text-xs focus:ring-amber-500/20 focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 flex items-center gap-1">
                        <Heart className="w-3.5 h-3.5 text-rose-500" />
                        <span>BP Diastolic (mmHg)</span>
                      </label>
                      <input
                        type="number"
                        required
                        value={triage.diastolicBP}
                        onChange={e => setTriage({ ...triage, diastolicBP: Number(e.target.value) })}
                        className="w-full border border-slate-200 rounded-xl p-2 text-xs focus:ring-amber-500/20 focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 flex items-center gap-1">
                        <Droplet className="w-3.5 h-3.5 text-sky-500" />
                        <span>SpO2 Oxygen (%)</span>
                      </label>
                      <input
                        type="number"
                        required
                        min="0"
                        max="100"
                        value={triage.oxygenSaturation}
                        onChange={e => setTriage({ ...triage, oxygenSaturation: Number(e.target.value) })}
                        className="w-full border border-slate-200 rounded-xl p-2 text-xs focus:ring-amber-500/20 focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Pulse Rate (bpm)</label>
                      <input
                        type="number"
                        required
                        value={triage.pulseRate}
                        onChange={e => setTriage({ ...triage, pulseRate: Number(e.target.value) })}
                        className="w-full border border-slate-200 rounded-xl p-2 text-xs focus:ring-amber-500/20 focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Weight (kg)</label>
                      <input
                        type="number"
                        required
                        value={triage.weight}
                        onChange={e => setTriage({ ...triage, weight: Number(e.target.value) })}
                        className="w-full border border-slate-200 rounded-xl p-2 text-xs focus:ring-amber-500/20 focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Height (cm)</label>
                      <input
                        type="number"
                        required
                        value={triage.height}
                        onChange={e => setTriage({ ...triage, height: Number(e.target.value) })}
                        className="w-full border border-slate-200 rounded-xl p-2 text-xs focus:ring-amber-500/20 focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">Primary Symptoms / Patient Complaints</label>
                    <textarea
                      required
                      placeholder="e.g. Complains of chronic headaches, high body temperatures since yesterday, cough..."
                      value={symptoms}
                      onChange={e => setSymptoms(e.target.value)}
                      rows={3}
                      className="w-full border border-slate-200 rounded-xl p-3 text-xs bg-slate-50 focus:bg-white focus:ring-amber-500/20 focus:border-amber-500 transition focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-2.5 rounded-xl tracking-wide transition shadow-sm text-xs flex items-center justify-center gap-2"
                  >
                    <ClipboardEdit className="w-4 h-4" />
                    <span>Send to Doctor's Consultation Queue</span>
                  </button>
                </form>
              ) : (
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex flex-col justify-center items-center py-10 text-center text-slate-500" id="triage-placeholder">
                  <ClipboardList className="w-10 h-10 text-amber-500 mb-2" />
                  <h4 className="font-bold text-xs text-slate-700">Patient Triaging Empty</h4>
                  <p className="text-[10px] text-slate-400 max-w-sm mt-1">
                    This patient is currently checked in the registry. Click the check-in button above to record vitals and transfer them to the Doctor's clinic queue.
                  </p>
                </div>
              )}
            </section>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 p-8 flex flex-col justify-center items-center h-[260px] text-slate-400 text-center shadow-sm">
              <ClipboardList className="w-12 h-12 text-slate-300 mb-3" />
              <h3 className="font-bold text-sm text-slate-700">No Patient Selected</h3>
              <p className="text-xs max-w-sm mt-1">Select an existing patient from the sidebar directory or click "New Patient" to register a new entry.</p>
            </div>
          )}

          {/* Consultation & Check-in Active Tracker */}
          <section className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm flex-1 flex flex-col min-h-[300px]" id="active-queue-tracker">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Live Active Clinic Queue ({activeQueue.length})</h3>
            
            <div className="flex-1 overflow-y-auto space-y-2" id="receptionist-queue-list">
              {activeQueue.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">No patients are currently waiting in consultation or triage queues.</div>
              ) : (
                activeQueue.map(record => {
                  const patient = db.patients.find(p => p.id === record.patientId);
                  if (!patient) return null;
                  return (
                    <div key={record.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <strong className="text-slate-800 font-bold">{patient.name}</strong>
                          <span className="text-[9px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-md font-bold uppercase">{record.id}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1 truncate max-w-md">Symptoms: "{record.symptoms}"</p>
                      </div>

                      <div className="flex items-center gap-2 text-right">
                        <div className="text-[10px] font-semibold">
                          {record.labStatus === "pending" && (
                            <span className="text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                              <Clock className="w-3 h-3" /> Waiting Lab
                            </span>
                          )}
                          {record.prescriptionStatus === "pending" && (
                            <span className="text-purple-600 bg-purple-50 border border-purple-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                              <Clock className="w-3 h-3" /> Waiting Dispensation
                            </span>
                          )}
                          {record.labStatus === "none" && record.prescriptionStatus === "none" && (
                            <span className="text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                              <Clock className="w-3 h-3" /> Waiting Consultation
                            </span>
                          )}
                        </div>
                        <span className="text-[9px] text-slate-400 font-mono font-semibold">{new Date(record.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

        </div>

      </div>

    </div>
  );
}
