import React, { useState, useEffect } from "react";
import { 
  Search, UserPlus, FileText, CheckCircle, Clock, Plus, Trash2, 
  AlertCircle, Thermometer, Heart, Droplet, Layers, HelpCircle, 
  Activity, ChevronRight, Calendar, Clipboard, CheckSquare, Settings2, Info,
  Printer, ShieldCheck
} from "lucide-react";
import { Patient, ClinicRecord, Triage, PathologyTest, ExtraService, ClinicDatabase, User } from "../types";
import { createClinicRecord, registerPatient, updateRecordTriage, submitReportPrescription, pharmacistAdministerService, updateDoctorNotes } from "../utils/api";
import { printMedicalReport } from "../utils/print";

interface DoctorDashboardProps {
  db: ClinicDatabase;
  currentUser?: User;
  onRefresh: () => void;
  globalSearchQuery?: string;
  selectedPatientId?: string | null;
  onSelectPatientId?: (id: string | null) => void;
  onClearGlobalSearch?: () => void;
}

export default function DoctorDashboard({ 
  db, 
  currentUser,
  onRefresh,
  globalSearchQuery = "",
  selectedPatientId: propSelectedPatientId,
  onSelectPatientId,
  onClearGlobalSearch
}: DoctorDashboardProps) {
  // State for search and active patient selection
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(db.patients[0]?.id || null);

  // Sync with propSelectedPatientId
  useEffect(() => {
    if (propSelectedPatientId) {
      setSelectedPatientId(propSelectedPatientId);
    }
  }, [propSelectedPatientId]);

  const handleSelectPatient = (id: string | null) => {
    setSelectedPatientId(id);
    if (onSelectPatientId) {
      onSelectPatientId(id);
    }
  };

  
  // Tab control within Doctor panel
  const [activeTab, setActiveTab] = useState<'consult' | 'history' | 'queue' | 'extra_service'>('consult');
  
  // Registration form state
  const [isRegistering, setIsRegistering] = useState(false);
  const [regError, setRegError] = useState("");
  const [newPatient, setNewPatient] = useState({
    id: "",
    name: "",
    phone: "",
    sex: "Male" as Patient["sex"],
    maritalStatus: "Single" as Patient["maritalStatus"],
    age: "",
    bloodGroup: "Unspecified",
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
      bloodGroup: "Unspecified",
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

  // Triage state for active consultation
  const [hasTriage, setHasTriage] = useState(false);
  const [triage, setTriage] = useState<Triage>({
    temperature: 36.8,
    systolicBP: 120,
    diastolicBP: 80,
    pulseRate: 75,
    oxygenSaturation: 98,
    weight: 70,
    height: 170,
    recordedAt: "",
  });

  // Consultation state
  const [symptoms, setSymptoms] = useState("");
  const [ailment, setAilment] = useState("");
  const [selectedExtraServices, setSelectedExtraServices] = useState<string[]>([]);
  const [selectedLabTestIds, setSelectedLabTestIds] = useState<string[]>([]);
  
  // Prescriptions being written
  const [prescriptions, setPrescriptions] = useState<Array<{ name: string; dosage: string; qtyRequested: number }>>([]);
  const [newMed, setNewMed] = useState({ name: "", dosage: "", qtyRequested: 10 });
  const [prescriptionDoctorNotes, setPrescriptionDoctorNotes] = useState("");

  // Post-Lab report state
  const [reviewingRecord, setReviewingRecord] = useState<ClinicRecord | null>(null);
  const [postLabAilment, setPostLabAilment] = useState("");
  const [postLabSymptoms, setPostLabSymptoms] = useState("");
  const [postLabPrescriptions, setPostLabPrescriptions] = useState<Array<{ name: string; dosage: string; qtyRequested: number }>>([]);
  const [postLabMed, setPostLabMed] = useState({ name: "", dosage: "", qtyRequested: 10 });
  const [postLabPrescriptionDoctorNotes, setPostLabPrescriptionDoctorNotes] = useState("");
  const [postLabExtraServices, setPostLabExtraServices] = useState<string[]>([]);
  const [extraServiceFees, setExtraServiceFees] = useState<Record<string, number>>({});
  const [postLabServiceFees, setPostLabServiceFees] = useState<Record<string, number>>({});

  // Administer Nursing Service state
  const [docSelectedServiceId, setDocSelectedServiceId] = useState<string | null>(null);
  const [docCustomServiceCost, setDocCustomServiceCost] = useState<number>(0);
  const [docCustomStaffMember, setDocCustomStaffMember] = useState<string>("");
  const [docClinicalNotes, setDocClinicalNotes] = useState<string>("");
  const [docSubmittingSrv, setDocSubmittingSrv] = useState(false);
  const [docServiceError, setDocServiceError] = useState<string | null>(null);
  const [docServiceSuccess, setDocServiceSuccess] = useState<string | null>(null);

  // Past Clinical History notes editing state
  const [editingNotesRecordId, setEditingNotesRecordId] = useState<string | null>(null);
  const [tempDoctorNotes, setTempDoctorNotes] = useState("");
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  useEffect(() => {
    if (currentUser?.name) {
      setDocCustomStaffMember(currentUser.name);
    } else {
      setDocCustomStaffMember("Dr. Julius");
    }
  }, [currentUser]);

  const activeSearchTerm = globalSearchQuery || searchTerm;

  // Filtering patients
  const filteredPatients = db.patients.filter(p => 
    p.name.toLowerCase().includes(activeSearchTerm.toLowerCase()) ||
    p.id.toLowerCase().includes(activeSearchTerm.toLowerCase()) ||
    p.phone.includes(activeSearchTerm)
  );

  const activePatient = db.patients.find(p => p.id === selectedPatientId);
  
  // Patient's record history
  const patientRecords = db.records.filter(r => r.patientId === selectedPatientId);

  // Active records requiring review or lab reports
  const pendingLabReviewRecords = db.records.filter(r => 
    r.patientId === selectedPatientId && 
    r.labStatus === "completed" && 
    r.prescriptionStatus === "none"
  );

  // Handle register submission
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError("");
    
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
      setRegError(newPatient.isUnderage ? "Parent/Guardian phone number is required." : "Phone number is required.");
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
        bloodGroup: newPatient.bloodGroup || "Unspecified",
        dob: newPatient.dob || undefined,
        isUnderage: newPatient.isUnderage,
        parentName: newPatient.parentName ? newPatient.parentName.trim() : undefined,
        parentPhone: newPatient.parentPhone ? newPatient.parentPhone.trim() : undefined,
      });

      await onRefresh();
      handleSelectPatient(saved.id);
      setIsRegistering(false);
      resetRegisterForm();
    } catch (err: any) {
      setRegError(err.message || "Registration failed.");
    }
  };

  // Add a medication to the prescription builder
  const addMedication = () => {
    if (!newMed.name.trim() || !newMed.dosage.trim()) return;
    setPrescriptions([...prescriptions, { ...newMed }]);
    setNewMed({ name: "", dosage: "", qtyRequested: 10 });
  };

  // Remove a medication
  const removeMedication = (index: number) => {
    setPrescriptions(prescriptions.filter((_, i) => i !== index));
  };

  // Submit main consultation
  const handleConsultSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId) return;

    try {
      await createClinicRecord({
        patientId: selectedPatientId,
        triage: hasTriage ? triage : undefined,
        symptoms: symptoms || "Routine wellness examination",
        ailment: ailment || "Investigation ongoing",
        extraServices: selectedExtraServices.map(id => ({
          serviceId: id,
          cost: extraServiceFees[id] || 0
        })),
        labTestIds: selectedLabTestIds,
        prescriptionMedications: prescriptions,
        prescriptionDoctorNotes: prescriptionDoctorNotes,
      });

      // Clear form
      setSymptoms("");
      setAilment("");
      setSelectedExtraServices([]);
      setExtraServiceFees({});
      setSelectedLabTestIds([]);
      setPrescriptions([]);
      setPrescriptionDoctorNotes("");
      setHasTriage(false);
      
      onRefresh();
      setActiveTab("history");
      alert("Consultation recorded successfully!");
    } catch (err: any) {
      alert(err.message || "Failed to submit consultation.");
    }
  };

  // Submit post-lab report
  const handlePostLabSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingRecord) return;

    try {
      await submitReportPrescription(reviewingRecord.id, {
        ailment: postLabAilment || reviewingRecord.ailment,
        symptoms: postLabSymptoms || reviewingRecord.symptoms,
        prescriptionMedications: postLabPrescriptions,
        prescriptionDoctorNotes: postLabPrescriptionDoctorNotes,
        extraServices: postLabExtraServices.map(id => ({
          serviceId: id,
          cost: postLabServiceFees[id] || 0
        }))
      });

      setReviewingRecord(null);
      setPostLabAilment("");
      setPostLabSymptoms("");
      setPostLabPrescriptions([]);
      setPostLabPrescriptionDoctorNotes("");
      setPostLabExtraServices([]);
      setPostLabServiceFees({});
      
      onRefresh();
      setActiveTab("history");
      alert("Diagnostic report and prescriptions submitted to pharmacist!");
    } catch (err: any) {
      alert(err.message || "Failed to submit post-lab report.");
    }
  };

  const handleSaveDoctorNotes = async (recordId: string) => {
    try {
      setIsSavingNotes(true);
      await updateDoctorNotes(recordId, tempDoctorNotes);
      setEditingNotesRecordId(null);
      onRefresh();
    } catch (err: any) {
      alert(err.message || "Failed to save remarks.");
    } finally {
      setIsSavingNotes(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="doctor-dashboard">
      {/* Left Sidebar - Patient List */}
      <div className="lg:col-span-4 bg-white rounded-xl border border-slate-100 p-5 shadow-sm flex flex-col h-[700px]" id="patient-explorer-card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-800 text-lg flex items-center gap-2">
            <Clipboard className="w-5 h-5 text-blue-600" />
            Patients Registry
          </h2>
          <button
            onClick={() => setIsRegistering(!isRegistering)}
            className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium py-1.5 px-3 rounded-lg flex items-center gap-1 transition"
          >
            <UserPlus className="w-3.5 h-3.5" />
            New Patient
          </button>
        </div>

        {/* Patient Register Modal / Inline Panel */}
        {isRegistering ? (
          <form onSubmit={handleRegister} className="bg-blue-50/50 p-4 rounded-xl border border-blue-100/80 mb-4 text-xs space-y-3">
            <div className="flex justify-between items-center border-b border-blue-200/50 pb-1.5">
              <span className="font-bold text-blue-900">Register New Patient</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={resetRegisterForm}
                  className="text-[10px] text-blue-700 hover:text-blue-900 bg-blue-100/60 hover:bg-blue-200 px-2 py-0.5 rounded font-semibold transition"
                  title="Clear / Empty All Form Fields"
                >
                  Clear Form
                </button>
                <button type="button" onClick={() => setIsRegistering(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
              </div>
            </div>
            
            {regError && <div className="text-red-600 font-semibold text-[11px] bg-red-50 p-2 rounded-lg border border-red-100">{regError}</div>}
            
            {/* Underage Toggle Checkbox */}
            <div className="bg-white/80 p-2 rounded-lg border border-blue-200/60 flex items-center gap-2">
              <input
                type="checkbox"
                id="doc-underage-checkbox"
                checked={newPatient.isUnderage}
                onChange={e => setNewPatient({ ...newPatient, isUnderage: e.target.checked })}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
              />
              <label htmlFor="doc-underage-checkbox" className="text-xs font-bold text-slate-700 cursor-pointer">
                Register as Underage / Child (Linked to Parent)
              </label>
            </div>

            {/* Underage Parent Details */}
            {newPatient.isUnderage && (
              <div className="grid grid-cols-2 gap-2 bg-blue-100/40 p-2 rounded-lg border border-blue-200">
                <div>
                  <label className="block text-[10px] font-bold text-blue-900 mb-0.5">Parent / Guardian Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Mary Wanjiku"
                    value={newPatient.parentName}
                    onChange={e => setNewPatient({ ...newPatient, parentName: e.target.value })}
                    className="w-full border border-slate-200 bg-white rounded-lg p-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-blue-900 mb-0.5">Parent Phone Number *</label>
                  <input
                    type="text"
                    required={newPatient.isUnderage}
                    placeholder="e.g. +254712345678"
                    value={newPatient.parentPhone}
                    onChange={e => setNewPatient({ ...newPatient, parentPhone: e.target.value, phone: newPatient.phone || e.target.value })}
                    className="w-full border border-slate-200 bg-white rounded-lg p-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-slate-500 font-bold mb-0.5">National ID / Passport <span className="font-normal text-slate-400">(Optional)</span></label>
                <input
                  type="text"
                  placeholder="Optional (Auto-generated)"
                  value={newPatient.id}
                  onChange={e => setNewPatient({ ...newPatient, id: e.target.value })}
                  className="w-full border border-slate-200 bg-white rounded-lg p-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 font-bold mb-0.5">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Peter Njoroge"
                  value={newPatient.name}
                  onChange={e => setNewPatient({ ...newPatient, name: e.target.value })}
                  className="w-full border border-slate-200 bg-white rounded-lg p-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-slate-500 font-bold mb-0.5">Phone Number {newPatient.isUnderage && "(Child/Parent)"} *</label>
                <input
                  type="text"
                  required={!newPatient.isUnderage}
                  placeholder="e.g. +254712345678"
                  value={newPatient.phone}
                  onChange={e => setNewPatient({ ...newPatient, phone: e.target.value })}
                  className="w-full border border-slate-200 bg-white rounded-lg p-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 font-bold mb-0.5">Date of Birth <span className="font-normal text-slate-400">(Optional)</span></label>
                <input
                  type="date"
                  value={newPatient.dob}
                  onChange={e => handleDobChange(e.target.value)}
                  className="w-full border border-slate-200 bg-white rounded-lg p-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] text-slate-500 font-bold mb-0.5">Age (Years) *</label>
                <input
                  type="number"
                  required
                  placeholder="Years"
                  value={newPatient.age}
                  onChange={e => setNewPatient({ ...newPatient, age: e.target.value })}
                  className="w-full border border-slate-200 bg-white rounded-lg p-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 font-bold mb-0.5">Sex *</label>
                <select
                  value={newPatient.sex}
                  onChange={e => setNewPatient({ ...newPatient, sex: e.target.value as Patient["sex"] })}
                  className="w-full border border-slate-200 bg-white rounded-lg p-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 font-bold mb-0.5">Marital Status</label>
                <select
                  value={newPatient.maritalStatus}
                  onChange={e => setNewPatient({ ...newPatient, maritalStatus: e.target.value as Patient["maritalStatus"] })}
                  className="w-full border border-slate-200 bg-white rounded-lg p-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
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
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg tracking-wide transition shadow-sm"
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
        ) : (
          <div className="relative mb-3">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by ID, name, or phone..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none text-slate-800 transition"
            />
          </div>
        )}

        {globalSearchQuery && (
          <div className="mb-3 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 text-xs text-blue-800 flex items-center justify-between">
            <span className="truncate font-medium">Filtered by header: "{globalSearchQuery}"</span>
            <button
              onClick={onClearGlobalSearch}
              className="text-blue-600 hover:text-blue-800 font-bold ml-1.5 shrink-0 text-[11px] underline"
              title="Clear Global Filter"
            >
              Clear
            </button>
          </div>
        )}

        {/* Patient Scroll List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1" id="patient-scroll-list">
          {filteredPatients.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">No registered patients found.</div>
          ) : (
            filteredPatients.map(p => {
              const recordsCount = db.records.filter(r => r.patientId === p.id).length;
              const hasActiveLab = db.records.some(r => r.patientId === p.id && r.labStatus === "completed" && r.prescriptionStatus === "none");
              
              return (
                <div
                  key={p.id}
                  onClick={() => {
                    handleSelectPatient(p.id);
                    setReviewingRecord(null); // Clear previous reviewing record
                  }}
                  className={`p-3 rounded-xl border transition cursor-pointer text-left flex items-center justify-between ${
                    selectedPatientId === p.id
                      ? "bg-blue-50/70 border-blue-200 ring-1 ring-blue-200"
                      : "bg-white hover:bg-slate-50 border-slate-100"
                  }`}
                >
                  <div>
                    <div className="font-semibold text-slate-800 text-sm flex items-center gap-1.5">
                      {p.name}
                      {hasActiveLab && (
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" title="Lab Results Ready" />
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-1">
                      <span>ID: {p.id}</span>
                      <span>•</span>
                      <span>Age: {p.age}</span>
                      <span>•</span>
                      <span>Blood: {p.bloodGroup}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                      {recordsCount} {recordsCount === 1 ? "visit" : "visits"}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 mt-1 ml-auto" />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Content Pane - Triage & Consultations */}
      <div className="lg:col-span-8 flex flex-col space-y-6" id="consultation-workbench">
        {activePatient ? (
          <>
            {/* Active Patient Summary Banner */}
            <div className="bg-slate-900 text-white rounded-xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="text-blue-400 text-xs font-semibold uppercase tracking-wider">Active Patient File</span>
                <h1 className="text-xl font-bold mt-1 text-slate-100">{activePatient.name}</h1>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300 mt-2">
                  <span>Phone: <strong className="text-white">{activePatient.phone}</strong></span>
                  <span>|</span>
                  <span>Sex: <strong className="text-white">{activePatient.sex}</strong></span>
                  <span>|</span>
                  <span>Age: <strong className="text-white">{activePatient.age} yrs</strong></span>
                  <span>|</span>
                  <span>Marital Status: <strong className="text-white">{activePatient.maritalStatus}</strong></span>
                  <span>|</span>
                  <span>Blood Type: <strong className="text-rose-400 font-bold">{activePatient.bloodGroup}</strong></span>
                </div>
              </div>

              {/* Lab notifications banner inside patient banner */}
              {pendingLabReviewRecords.length > 0 && (
                <div className="bg-amber-500/25 border border-amber-500/45 p-3 rounded-xl flex items-start gap-2.5 max-w-sm">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-left">
                    <div className="text-xs font-bold text-amber-300">Lab Results Ready</div>
                    <p className="text-[10px] text-slate-300 mt-0.5">Lab completed {pendingLabReviewRecords.length} test(s) for this patient.</p>
                    <button
                      onClick={() => {
                        setReviewingRecord(pendingLabReviewRecords[0]);
                        setPostLabAilment(pendingLabReviewRecords[0].ailment || "");
                        setPostLabSymptoms(pendingLabReviewRecords[0].symptoms || "");
                        setActiveTab("consult");
                      }}
                      className="mt-1.5 text-[10px] font-semibold bg-amber-500 hover:bg-amber-600 text-slate-950 px-2.5 py-1 rounded"
                    >
                      Review Results
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Mode Tabs */}
            <div className="flex border-b border-slate-200">
              <button
                onClick={() => { setActiveTab("consult"); setReviewingRecord(null); }}
                className={`py-3 px-6 font-medium text-xs border-b-2 transition ${
                  activeTab === "consult" && !reviewingRecord
                    ? "border-blue-600 text-blue-700"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                New Consultation & Triage
              </button>
              {reviewingRecord && (
                <button
                  className="py-3 px-6 font-semibold text-xs border-b-2 border-amber-500 text-amber-700"
                >
                  Reviewing Lab Record #{reviewingRecord.id}
                </button>
              )}
              <button
                onClick={() => { setActiveTab("extra_service"); setReviewingRecord(null); }}
                className={`py-3 px-6 font-medium text-xs border-b-2 transition ${
                  activeTab === "extra_service"
                    ? "border-blue-600 text-blue-700"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                Administer Nursing Service
              </button>
              <button
                onClick={() => { setActiveTab("history"); setReviewingRecord(null); }}
                className={`py-3 px-6 font-medium text-xs border-b-2 transition ${
                  activeTab === "history"
                    ? "border-blue-600 text-blue-700"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                Clinical History ({patientRecords.length})
              </button>
            </div>

            {/* TAB: Clinical History */}
            {activeTab === "history" && (
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1 text-left" id="clinical-history-timeline">
                {patientRecords.length === 0 ? (
                  <div className="bg-white border border-slate-100 rounded-xl p-8 text-center text-slate-400 text-xs">
                    No clinical logs found for this patient yet. Use the Consultation tab to write their first record.
                  </div>
                ) : (
                  patientRecords.map((record, index) => (
                    <div key={record.id} className="bg-white border border-slate-100 rounded-xl p-5 shadow-xs relative">
                      <div className="absolute top-5 right-5 flex items-center gap-2">
                        {/* Lab Status Badge */}
                        {record.labStatus === "pending" && (
                          <span className="text-[10px] bg-amber-50 text-amber-700 font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Clock className="w-3 h-3 animate-spin" /> Lab: Pending
                          </span>
                        )}
                        {record.labStatus === "completed" && (
                          <span className="text-[10px] bg-emerald-50 text-emerald-700 font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> Lab: Ready
                          </span>
                        )}
                        
                        {/* Prescription Status Badge */}
                        {record.prescriptionStatus === "pending" && (
                          <span className="text-[10px] bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Rx: Pending Dispense
                          </span>
                        )}
                        {record.prescriptionStatus === "fully_dispatched" && (
                          <span className="text-[10px] bg-emerald-50 text-emerald-700 font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> Rx: Dispatched
                          </span>
                        )}
                      </div>

                      {/* Header */}
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 font-bold text-sm">
                          #{patientRecords.length - index}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-bold text-slate-800 text-sm">Clinical Interaction #{record.id}</h4>
                            <button
                              type="button"
                              onClick={() => printMedicalReport(record, activePatient, currentUser?.name)}
                              className="bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-md border border-blue-100 transition flex items-center gap-1 text-[9px] hover:shadow-xs"
                              title="Print Official Patient Medical Record"
                            >
                              <Printer className="w-3 h-3 text-blue-600" />
                              <span>Print Record</span>
                            </button>
                          </div>
                          <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <Calendar className="w-3 h-3" /> {new Date(record.date).toLocaleDateString()} at {new Date(record.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 border-t border-slate-100 pt-4 text-xs">
                        {/* Triage summary */}
                        {record.triage && (
                          <div className="md:col-span-3 bg-slate-50/55 p-3 rounded-xl border border-slate-100 space-y-1.5">
                            <h5 className="font-bold text-[11px] text-slate-700 flex items-center gap-1">
                              <Activity className="w-3.5 h-3.5 text-blue-600" />
                              Triage Vitals
                            </h5>
                            <div className="space-y-1 text-slate-600 text-[11px]">
                              <div>Temp: <strong className="text-slate-800">{record.triage.temperature}°C</strong></div>
                              <div>BP: <strong className="text-slate-800">{record.triage.systolicBP}/{record.triage.diastolicBP}</strong></div>
                              <div>Pulse: <strong className="text-slate-800">{record.triage.pulseRate} bpm</strong></div>
                              <div>SpO2: <strong className="text-slate-800">{record.triage.oxygenSaturation}%</strong></div>
                              <div>Weight: <strong className="text-slate-800">{record.triage.weight} kg</strong></div>
                              <div>Height: <strong className="text-slate-800">{record.triage.height} cm</strong></div>
                            </div>
                          </div>
                        )}

                        <div className={`${record.triage ? "md:col-span-9" : "md:col-span-12"} space-y-3`}>
                          {/* Symptoms and Diagnosis */}
                          <div>
                            <span className="block text-[10px] text-slate-400 uppercase font-bold tracking-wider">Presenting Symptoms</span>
                            <p className="text-slate-700 font-medium">{record.symptoms}</p>
                          </div>
                          <div>
                            <span className="block text-[10px] text-slate-400 uppercase font-bold tracking-wider">Ailment / Diagnosis</span>
                            <p className="text-blue-900 font-bold bg-blue-50/60 inline-block px-2.5 py-0.5 rounded border border-blue-100">{record.ailment}</p>
                          </div>

                          {/* Extra Services Offered */}
                          {record.extraServices.length > 0 && (
                            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                              <span className="block text-[10px] text-slate-500 uppercase font-bold mb-1">Services Done</span>
                              <div className="flex flex-wrap gap-2">
                                {record.extraServices.map(s => (
                                  <span key={s.serviceId} className="bg-white border border-slate-200 text-slate-700 px-2 py-0.5 rounded text-[11px] font-medium shadow-xs">
                                    {s.name} (Ksh {s.cost.toLocaleString()})
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Lab test results */}
                          {record.labRequest && (
                            <div className="border border-slate-100 rounded-lg p-3 bg-slate-50/20">
                              <span className="block text-[10px] text-slate-500 uppercase font-bold mb-2">Laboratory Pathology Report</span>
                              
                              {record.labStatus === "pending" ? (
                                <p className="text-slate-400 italic text-[11px] flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5 animate-pulse text-amber-500" />
                                  Lab tests are in progress (Sent to Laboratory)
                                </p>
                              ) : (
                                <div className="space-y-2">
                                  <table className="w-full text-left text-[11px] border-collapse bg-white border border-slate-100 rounded">
                                    <thead>
                                      <tr className="bg-slate-50 text-slate-500">
                                        <th className="p-1.5 border-b border-slate-100">Parameter</th>
                                        <th className="p-1.5 border-b border-slate-100">Value</th>
                                        <th className="p-1.5 border-b border-slate-100">Ref Range</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {record.labRequest.results?.map(r => {
                                        // Calculate abnormal flags if numeric
                                        const values = r.normalRange.split("-").map(Number);
                                        const numVal = Number(r.value);
                                        const isAbnormal = values.length === 2 && !isNaN(numVal) && (numVal < values[0] || numVal > values[1]);
                                        
                                        return (
                                          <tr key={r.parameterId} className="border-b border-slate-100 hover:bg-slate-50">
                                            <td className="p-1.5 font-medium text-slate-700">{r.parameterName}</td>
                                            <td className={`p-1.5 font-bold ${isAbnormal ? "text-rose-600 bg-rose-50" : "text-slate-800"}`}>
                                              {r.value} {r.unit} {isAbnormal && "⚠️"}
                                            </td>
                                            <td className="p-1.5 text-slate-500">{r.normalRange} {r.unit}</td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                  {record.labRequest.notes && (
                                    <div className="text-[10px] bg-slate-100 p-1.5 rounded text-slate-600">
                                      <strong>Technician Notes:</strong> {record.labRequest.notes}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Prescription details */}
                          {record.prescription && (
                            <div className="border border-blue-50 bg-blue-50/10 rounded-lg p-3">
                              <span className="block text-[10px] text-blue-800 uppercase font-bold mb-1.5">Pharmacy Rx Order</span>
                              <div className="space-y-1">
                                {record.prescription.medications.map(m => (
                                  <div key={m.name} className="flex justify-between text-[11px] py-1 border-b border-slate-100 last:border-0">
                                    <div>
                                      <span className="font-bold text-slate-800">{m.name}</span>
                                      <span className="text-slate-500 ml-2">({m.dosage})</span>
                                    </div>
                                    <div className="font-medium text-slate-700">
                                      Dispensed: {m.qtyDispatched} / {m.qtyRequested}
                                      {m.qtyDispatched === m.qtyRequested ? (
                                        <span className="text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded ml-2 text-[9px] font-bold">Complete</span>
                                      ) : m.qtyDispatched > 0 ? (
                                        <span className="text-amber-600 bg-amber-50 px-1.5 py-0.2 rounded ml-2 text-[9px] font-bold">Partial</span>
                                      ) : (
                                        <span className="text-blue-600 bg-blue-50 px-1.5 py-0.2 rounded ml-2 text-[9px] font-bold">Ordered</span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                              {record.prescription.pharmacistNotes && (
                                <div className="text-[10px] bg-slate-100 p-1.5 rounded text-slate-600 mt-2">
                                  <strong>Dispensing Pharmacist Notes:</strong> {record.prescription.pharmacistNotes}
                                </div>
                              )}

                              {/* Doctor's Dispensing Remarks */}
                              <div className="mt-2.5 pt-2 border-t border-slate-100">
                                <span className="block text-[10px] text-blue-800 uppercase font-bold mb-1.5 flex items-center justify-between">
                                  <span>Doctor's Dispensing Remarks / Notes</span>
                                  {editingNotesRecordId !== record.id && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingNotesRecordId(record.id);
                                        setTempDoctorNotes(record.prescription?.doctorNotes || "");
                                      }}
                                      className="text-[10px] text-blue-600 hover:text-blue-800 font-bold hover:underline"
                                    >
                                      Edit / Update
                                    </button>
                                  )}
                                </span>
                                {editingNotesRecordId === record.id ? (
                                  <div className="space-y-1.5 mt-1">
                                    <textarea
                                      rows={2}
                                      value={tempDoctorNotes}
                                      onChange={e => setTempDoctorNotes(e.target.value)}
                                      className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 outline-none resize-none"
                                      placeholder="Add specific instructions for the pharmacist, e.g. allergies, half dosage allowed..."
                                    />
                                    <div className="flex justify-end gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => setEditingNotesRecordId(null)}
                                        className="text-[10px] font-semibold text-slate-500 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleSaveDoctorNotes(record.id)}
                                        disabled={isSavingNotes}
                                        className="text-[10px] font-semibold text-white bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded flex items-center gap-1 disabled:opacity-50"
                                      >
                                        {isSavingNotes ? "Saving..." : "Save"}
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-slate-700 italic text-[11px] font-semibold bg-blue-50/40 border border-blue-100/50 p-2 rounded-lg">
                                    {record.prescription.doctorNotes ? record.prescription.doctorNotes : <span className="text-slate-400 font-normal">No dispensing remarks provided.</span>}
                                  </p>
                                )}
                              </div>

                              {record.prescription.dispenseHistory && record.prescription.dispenseHistory.length > 0 && (
                                <div className="mt-2.5 pt-2 border-t border-slate-200/60">
                                  <span className="block text-[9px] text-slate-500 uppercase font-bold mb-1">Dispensing Session History:</span>
                                  <div className="space-y-1 max-h-32 overflow-y-auto">
                                    {record.prescription.dispenseHistory.map((item, idx) => (
                                      <div key={idx} className="flex justify-between items-center text-[10px] bg-slate-50 border border-slate-100 p-1.5 rounded-lg">
                                        <div className="text-slate-600">
                                          <span className="font-semibold text-slate-800">{item.medicationName}</span>: Dispensed <strong className="text-slate-800 font-extrabold">{item.qtyDispensed}</strong> (Bal: {item.remainingBalance})
                                        </div>
                                        <div className="text-[9px] text-slate-400 text-right">
                                          <div>By {item.pharmacistName}</div>
                                          <div>{new Date(item.date).toLocaleDateString()} {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* TAB: New Consultation Form (Review Post-Lab vs Standard) */}
            {activeTab === "consult" && (
              reviewingRecord ? (
                // POST-LAB REPORT FORM
                <form onSubmit={handlePostLabSubmit} className="bg-white border border-amber-200 rounded-xl p-6 shadow-xs text-left space-y-6">
                  <div className="flex items-center justify-between border-b border-amber-100 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center font-bold">✓</div>
                      <div>
                        <h3 className="font-bold text-slate-800 text-sm">Post-Laboratory Diagnostic Report</h3>
                        <p className="text-[10px] text-slate-500">Completing Record #{reviewingRecord.id}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReviewingRecord(null)}
                      className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 py-1 px-2.5 rounded"
                    >
                      Cancel Post-Lab
                    </button>
                  </div>

                  {/* Read Only Pathology Results inside consultation builder */}
                  <div className="bg-amber-50/30 border border-amber-100 p-4 rounded-xl space-y-3">
                    <div className="font-bold text-xs text-slate-800 flex items-center gap-1">
                      <Layers className="w-4 h-4 text-amber-600" />
                      Laboratory Results Received:
                    </div>
                    <table className="w-full text-[11px] text-left border-collapse bg-white rounded border border-slate-100">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 font-semibold">
                          <th className="p-2 border-b border-slate-100">Test Parameter</th>
                          <th className="p-2 border-b border-slate-100">Recorded Value</th>
                          <th className="p-2 border-b border-slate-100">Reference Range</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reviewingRecord.labRequest?.results?.map(r => {
                          const ranges = r.normalRange.split("-").map(Number);
                          const val = Number(r.value);
                          const isAbnormal = ranges.length === 2 && !isNaN(val) && (val < ranges[0] || val > ranges[1]);
                          return (
                            <tr key={r.parameterId} className="border-b border-slate-100 hover:bg-slate-50">
                              <td className="p-2 font-medium text-slate-700">{r.parameterName}</td>
                              <td className={`p-2 font-bold ${isAbnormal ? "text-rose-600 bg-rose-50" : "text-slate-800"}`}>
                                {r.value} {r.unit} {isAbnormal && "⚠️ (Abnormal)"}
                              </td>
                              <td className="p-2 text-slate-500">{r.normalRange} {r.unit}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {reviewingRecord.labRequest?.notes && (
                      <p className="text-[11px] text-slate-600 bg-white p-2 rounded border border-slate-100">
                        <strong>Technician Notes:</strong> {reviewingRecord.labRequest.notes}
                      </p>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Doctor's Clinical Observations / Updated Symptoms</label>
                      <textarea
                        rows={2}
                        value={postLabSymptoms}
                        onChange={e => setPostLabSymptoms(e.target.value)}
                        className="w-full border border-slate-200 rounded-lg p-2.5 text-xs outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Note down secondary symptoms or physical observation findings..."
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Final Diagnostic Outcome / Ailment *</label>
                      <input
                        type="text"
                        required
                        value={postLabAilment}
                        onChange={e => setPostLabAilment(e.target.value)}
                        className="w-full border border-slate-200 rounded-lg p-2.5 text-xs outline-none focus:ring-1 focus:ring-blue-500 font-semibold"
                        placeholder="e.g., Severe Malaria diagnosed, Bacterial Urinary Tract Infection"
                      />
                    </div>

                    {/* Prescription Builder for Post-Lab */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
                      <span className="block text-xs font-bold text-slate-700 flex items-center gap-1">
                        <Plus className="w-4 h-4 text-blue-600" /> Write Pharmacy Prescription
                      </span>
                      
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                        <div className="md:col-span-5">
                          <input
                            type="text"
                            placeholder="Medicine Name (e.g. Amoxicillin)"
                            value={postLabMed.name}
                            onChange={e => setPostLabMed({ ...postLabMed, name: e.target.value })}
                            className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-xs"
                          />
                        </div>
                        <div className="md:col-span-4">
                          <input
                            type="text"
                            placeholder="Dosage (e.g. 500mg TDS for 5 days)"
                            value={postLabMed.dosage}
                            onChange={e => setPostLabMed({ ...postLabMed, dosage: e.target.value })}
                            className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-xs"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <input
                            type="number"
                            placeholder="Qty"
                            value={postLabMed.qtyRequested}
                            onChange={e => setPostLabMed({ ...postLabMed, qtyRequested: Number(e.target.value) })}
                            className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-xs"
                          />
                        </div>
                        <div className="md:col-span-1">
                          <button
                            type="button"
                            onClick={() => {
                              if (!postLabMed.name.trim() || !postLabMed.dosage.trim()) return;
                              setPostLabPrescriptions([...postLabPrescriptions, { ...postLabMed }]);
                              setPostLabMed({ name: "", dosage: "", qtyRequested: 10 });
                            }}
                            className="w-full bg-slate-800 text-white py-1.5 rounded text-xs font-bold hover:bg-slate-900"
                          >
                            Add
                          </button>
                        </div>
                      </div>

                      {postLabPrescriptions.length > 0 && (
                        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                                <th className="p-2">Medication</th>
                                <th className="p-2">Dosage Instructions</th>
                                <th className="p-2 text-center">Req Qty</th>
                                <th className="p-2 text-center">Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {postLabPrescriptions.map((m, idx) => (
                                <tr key={idx} className="border-b border-slate-100 last:border-0">
                                  <td className="p-2 font-bold text-slate-800">{m.name}</td>
                                  <td className="p-2 text-slate-600">{m.dosage}</td>
                                  <td className="p-2 text-center text-slate-700">{m.qtyRequested}</td>
                                  <td className="p-2 text-center">
                                    <button
                                      type="button"
                                      onClick={() => setPostLabPrescriptions(postLabPrescriptions.filter((_, i) => i !== idx))}
                                      className="text-rose-500 hover:text-rose-700 p-1"
                                    >
                                      <Trash2 className="w-4 h-4 mx-auto" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      <div className="pt-2">
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Doctor's Dispensing Remarks / Notes</label>
                        <textarea
                          rows={2}
                          value={postLabPrescriptionDoctorNotes}
                          onChange={e => setPostLabPrescriptionDoctorNotes(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 outline-none resize-none"
                          placeholder="Add specific instructions for the pharmacist, e.g. allergies, half dosage allowed..."
                        />
                      </div>
                    </div>

                    {/* Extra services ordering during diagnostic finalization */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Add Extra Services Rendered (Optional)</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {db.extraServices.map(srv => {
                          const isSelected = postLabExtraServices.includes(srv.id);
                          return (
                            <div key={srv.id} className={`p-3 border rounded-xl flex flex-col justify-between transition ${isSelected ? 'bg-slate-50 border-slate-400 shadow-xs' : 'bg-white border-slate-200'}`}>
                              <label className="flex items-start gap-2.5 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={e => {
                                      if (e.target.checked) {
                                        setPostLabExtraServices([...postLabExtraServices, srv.id]);
                                        // Initialize fee input with 0 or dynamic preset if any
                                        setPostLabServiceFees(prev => ({ ...prev, [srv.id]: 0 }));
                                      } else {
                                        setPostLabExtraServices(postLabExtraServices.filter(id => id !== srv.id));
                                        setPostLabServiceFees(prev => {
                                          const next = { ...prev };
                                          delete next[srv.id];
                                          return next;
                                        });
                                      }
                                  }}
                                  className="text-slate-800 focus:ring-slate-500 w-4 h-4 rounded border-slate-300 mt-0.5"
                                />
                                <div className="text-left text-slate-700 text-xs">
                                  <span className="font-bold text-slate-800 block">{srv.name}</span>
                                  <span className="text-slate-400 text-[10px] block mt-0.5">{srv.description || "No description."}</span>
                                </div>
                              </label>

                              {isSelected && (
                                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 animate-fade-in">
                                  <span className="text-[10px] font-bold text-slate-500 shrink-0">Enter Fee (KES):</span>
                                  <input
                                    type="number"
                                    required
                                    min="0"
                                    placeholder="KES Fee"
                                    value={postLabServiceFees[srv.id] !== undefined ? postLabServiceFees[srv.id] : ""}
                                    onChange={e => {
                                      const val = e.target.value === "" ? 0 : Number(e.target.value);
                                      setPostLabServiceFees(prev => ({ ...prev, [srv.id]: val }));
                                    }}
                                    className="w-28 bg-white border border-slate-200 rounded-lg px-2 py-1 outline-none text-right font-bold text-slate-800 text-xs focus:border-slate-400"
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-2.5 rounded-xl shadow-xs text-xs transition"
                  >
                    Finalize Diagnostic Report & Dispatch Prescriptions
                  </button>
                </form>
              ) : (
                // STANDARD CONSULTATION & TRIAGE BUILDER
                <form onSubmit={handleConsultSubmit} className="bg-white border border-slate-100 rounded-xl p-6 shadow-xs text-left space-y-6">
                  {/* Triage Section Toggle */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Activity className="w-5 h-5 text-blue-600 animate-pulse" />
                        <div>
                          <span className="text-xs font-bold text-slate-800 block">Triage Station Vitals</span>
                          <span className="text-[10px] text-slate-400 block">Record patient's clinical baseline vitals</span>
                        </div>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={hasTriage}
                          onChange={e => setHasTriage(e.target.checked)}
                          className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                        />
                        <span className="text-xs font-semibold text-slate-700">Record Vitals</span>
                      </label>
                    </div>

                    {hasTriage && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs">
                        <div>
                          <label className="block text-[10px] text-slate-500 font-semibold mb-1">Temperature (°C)</label>
                          <input
                            type="number"
                            step="0.1"
                            value={triage.temperature}
                            onChange={e => setTriage({ ...triage, temperature: Number(e.target.value) })}
                            className="w-full bg-white border border-slate-200 rounded p-1.5"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 font-semibold mb-1">Blood Pressure (Systolic)</label>
                          <input
                            type="number"
                            value={triage.systolicBP}
                            onChange={e => setTriage({ ...triage, systolicBP: Number(e.target.value) })}
                            className="w-full bg-white border border-slate-200 rounded p-1.5 text-slate-800"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 font-semibold mb-1">Blood Pressure (Diastolic)</label>
                          <input
                            type="number"
                            value={triage.diastolicBP}
                            onChange={e => setTriage({ ...triage, diastolicBP: Number(e.target.value) })}
                            className="w-full bg-white border border-slate-200 rounded p-1.5 text-slate-800"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 font-semibold mb-1">Oxygen Sat (SpO2 %)</label>
                          <input
                            type="number"
                            value={triage.oxygenSaturation}
                            onChange={e => setTriage({ ...triage, oxygenSaturation: Number(e.target.value) })}
                            className="w-full bg-white border border-slate-200 rounded p-1.5 text-slate-800"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 font-semibold mb-1">Pulse Rate (bpm)</label>
                          <input
                            type="number"
                            value={triage.pulseRate}
                            onChange={e => setTriage({ ...triage, pulseRate: Number(e.target.value) })}
                            className="w-full bg-white border border-slate-200 rounded p-1.5 text-slate-800"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 font-semibold mb-1">Weight (kg)</label>
                          <input
                            type="number"
                            value={triage.weight}
                            onChange={e => setTriage({ ...triage, weight: Number(e.target.value) })}
                            className="w-full bg-white border border-slate-200 rounded p-1.5 text-slate-800"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 font-semibold mb-1">Height (cm)</label>
                          <input
                            type="number"
                            value={triage.height}
                            onChange={e => setTriage({ ...triage, height: Number(e.target.value) })}
                            className="w-full bg-white border border-slate-200 rounded p-1.5 text-slate-800"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Presenting Symptoms */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Patient Presenting Symptoms *</label>
                    <textarea
                      rows={3}
                      required
                      value={symptoms}
                      onChange={e => setSymptoms(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg p-2.5 text-xs outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Note down symptoms narrated by the patient, onset duration, severity..."
                    />
                  </div>

                  {/* Suspected Diagnosis */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Suspected Ailment / Presenting Problem</label>
                    <input
                      type="text"
                      value={ailment}
                      onChange={e => setAilment(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg p-2.5 text-xs outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="e.g. Acute Tonsillitis, Suspected Malaria, Soft Tissue Injury"
                    />
                  </div>

                  {/* Pathological Tests Ordered */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-semibold text-slate-700">Order Laboratory Tests (Pathology)</label>
                      <span className="text-[10px] text-slate-500">Sends patient details to Lab Tech queue</span>
                    </div>
                    {db.tests.length === 0 ? (
                      <p className="text-slate-400 text-xs italic">No laboratory tests configured. Add tests in the Pathology or Admin department.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {db.tests.map(test => (
                          <label key={test.id} className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-100 rounded-lg cursor-pointer hover:bg-slate-100">
                            <input
                              type="checkbox"
                              checked={selectedLabTestIds.includes(test.id)}
                              onChange={e => {
                                if (e.target.checked) {
                                  setSelectedLabTestIds([...selectedLabTestIds, test.id]);
                                } else {
                                  setSelectedLabTestIds(selectedLabTestIds.filter(id => id !== test.id));
                                }
                              }}
                              className="text-blue-600 rounded focus:ring-blue-500"
                            />
                            <div className="text-left flex-1">
                              <span className="font-bold text-slate-700 block text-[11px]">{test.name}</span>
                              <div className="flex justify-between items-center text-[10px] text-slate-500 mt-0.5">
                                <span>Category: {db.categories.find(c => c.id === test.categoryId)?.name || "General"}</span>
                                <span className="font-bold text-blue-700">Ksh {test.cost.toLocaleString()}</span>
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Extra Services Offered */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-2">Order Extra Nursing Services (Dressing, stitching, etc.)</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      {db.extraServices.map(srv => {
                        const isSelected = selectedExtraServices.includes(srv.id);
                        return (
                          <div key={srv.id} className={`p-3 border rounded-xl flex flex-col justify-between transition ${isSelected ? 'bg-slate-50 border-slate-400 shadow-xs' : 'bg-white border-slate-200'}`}>
                            <label className="flex items-start gap-2.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={e => {
                                  if (e.target.checked) {
                                    setSelectedExtraServices([...selectedExtraServices, srv.id]);
                                    setExtraServiceFees(prev => ({ ...prev, [srv.id]: 0 }));
                                  } else {
                                    setSelectedExtraServices(selectedExtraServices.filter(id => id !== srv.id));
                                    setExtraServiceFees(prev => {
                                      const next = { ...prev };
                                      delete next[srv.id];
                                      return next;
                                    });
                                  }
                                }}
                                className="text-slate-800 focus:ring-slate-500 w-4 h-4 rounded border-slate-300 mt-0.5"
                              />
                              <div className="text-left text-slate-700 flex-1">
                                <span className="font-bold text-slate-800 block text-[11px]">{srv.name}</span>
                                <span className="text-slate-400 text-[10px] block mt-0.5">{srv.description || "No description."}</span>
                              </div>
                            </label>

                            {isSelected && (
                              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 animate-fade-in">
                                <span className="text-[10px] font-bold text-slate-500 shrink-0">Enter Fee (KES):</span>
                                <input
                                  type="number"
                                  required
                                  min="0"
                                  placeholder="KES Fee"
                                  value={extraServiceFees[srv.id] !== undefined ? extraServiceFees[srv.id] : ""}
                                  onChange={e => {
                                    const val = e.target.value === "" ? 0 : Number(e.target.value);
                                    setExtraServiceFees(prev => ({ ...prev, [srv.id]: val }));
                                  }}
                                  className="w-28 bg-white border border-slate-200 rounded-lg px-2 py-1 outline-none text-right font-bold text-slate-800 text-xs focus:border-slate-400"
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Prescription Builder */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
                    <div>
                      <span className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Plus className="w-4 h-4 text-blue-600" /> Dispense Direct Prescriptions
                      </span>
                      <span className="block text-[10px] text-slate-500 mt-0.5">Skip laboratory results and prescribe medicine directly to the pharmacist</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                      <div className="md:col-span-5">
                        <input
                          type="text"
                          placeholder="Medicine Name (e.g. Paracetamol 500mg)"
                          value={newMed.name}
                          onChange={e => setNewMed({ ...newMed, name: e.target.value })}
                          className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                      </div>
                      <div className="md:col-span-4">
                        <input
                          type="text"
                          placeholder="Dosage (e.g. 1 tab BD for 3 days)"
                          value={newMed.dosage}
                          onChange={e => setNewMed({ ...newMed, dosage: e.target.value })}
                          className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          placeholder="Qty"
                          value={newMed.qtyRequested}
                          onChange={e => setNewMed({ ...newMed, qtyRequested: Number(e.target.value) })}
                          className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                      </div>
                      <div className="md:col-span-1">
                        <button
                          type="button"
                          onClick={addMedication}
                          className="w-full bg-slate-800 text-white py-1.5 rounded text-xs font-bold hover:bg-slate-900"
                        >
                          Add
                        </button>
                      </div>
                    </div>

                    {prescriptions.length > 0 && (
                      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                              <th className="p-2">Medication Ordered</th>
                              <th className="p-2">Dosage instructions</th>
                              <th className="p-2 text-center">Req Qty</th>
                              <th className="p-2 text-center">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {prescriptions.map((p, idx) => (
                              <tr key={idx} className="border-b border-slate-100 last:border-0">
                                <td className="p-2 font-bold text-slate-800">{p.name}</td>
                                <td className="p-2 text-slate-600">{p.dosage}</td>
                                <td className="p-2 text-center text-slate-700">{p.qtyRequested}</td>
                                <td className="p-2 text-center">
                                  <button
                                    type="button"
                                    onClick={() => removeMedication(idx)}
                                    className="text-rose-500 hover:text-rose-700 p-1"
                                  >
                                    <Trash2 className="w-4 h-4 mx-auto" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    <div className="pt-2">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Doctor's Dispensing Remarks / Notes</label>
                      <textarea
                        rows={2}
                        value={prescriptionDoctorNotes}
                        onChange={e => setPrescriptionDoctorNotes(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 outline-none resize-none"
                        placeholder="Add specific instructions for the pharmacist, e.g. allergies, half dosage allowed..."
                      />
                    </div>
                  </div>

                  {/* Submission triggers */}
                  <button
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl shadow-xs text-xs transition"
                  >
                    Submit Consultation & Dispatch Orders
                  </button>
                </form>
              )
            )}

            {activeTab === "extra_service" && (
              <form 
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!docSelectedServiceId) {
                    setDocServiceError("Please select a clinical service to administer.");
                    return;
                  }
                  setDocSubmittingSrv(true);
                  setDocServiceError(null);
                  setDocServiceSuccess(null);
                  try {
                    await pharmacistAdministerService({
                      patientId: activePatient.id,
                      serviceId: docSelectedServiceId,
                      notes: docClinicalNotes,
                      cost: docCustomServiceCost,
                      staffMember: docCustomStaffMember
                    });
                    setDocServiceSuccess(`Successfully administered service "${db.extraServices.find(s => s.id === docSelectedServiceId)?.name}" to patient ${activePatient.name}.`);
                    setDocClinicalNotes("");
                    setDocSelectedServiceId(null);
                    setDocCustomServiceCost(0);
                    onRefresh();
                  } catch (err: any) {
                    setDocServiceError(err.message || "An error occurred.");
                  } finally {
                    setDocSubmittingSrv(false);
                  }
                }} 
                className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex flex-col space-y-5 text-left"
              >
                <div className="border-b border-slate-100 pb-3 flex justify-between items-start">
                  <div>
                    <span className="text-[9px] bg-blue-50 text-blue-700 border border-blue-100 font-bold uppercase px-2 py-0.5 rounded-md">Service Administration</span>
                    <h2 className="text-base font-extrabold text-slate-800 mt-1">{activePatient.name}</h2>
                    <p className="text-[10px] text-slate-400 font-semibold font-mono">ID No: {activePatient.id} • Age: {activePatient.age} yrs • Sex: {activePatient.sex} • Blood: {activePatient.bloodGroup}</p>
                  </div>
                  <div className="bg-blue-50 p-2 rounded-xl text-blue-800 text-xs font-semibold flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                    Jul Medicare Nursing
                  </div>
                </div>

                {docServiceError && (
                  <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 text-xs rounded-xl font-medium">
                    {docServiceError}
                  </div>
                )}

                {docServiceSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs rounded-xl flex items-center gap-1.5 font-medium">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span>{docServiceSuccess}</span>
                  </div>
                )}

                {/* Service Selector */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700">Select Clinical Service / Injection *</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-48 overflow-y-auto pr-1">
                    {db.extraServices.map(srv => {
                      const isChosen = docSelectedServiceId === srv.id;
                      return (
                        <div
                          key={srv.id}
                          onClick={() => {
                            setDocSelectedServiceId(srv.id);
                            setDocCustomServiceCost(srv.cost || 0);
                          }}
                          className={`p-3 rounded-xl border text-left cursor-pointer transition flex flex-col justify-between ${
                            isChosen 
                              ? "bg-blue-50/70 border-blue-400 ring-1 ring-blue-400 text-blue-950" 
                              : "bg-white border-slate-100 hover:bg-slate-50 text-slate-700"
                          }`}
                        >
                          <div>
                            <h4 className="font-extrabold text-[11px]">{srv.name}</h4>
                            <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">{srv.description || "No description."}</p>
                          </div>
                          <span className="font-mono text-[10px] text-blue-700 font-extrabold mt-2 block">
                            {srv.cost ? `KES ${srv.cost.toLocaleString()}` : "Variable Pricing"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {docSelectedServiceId && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
                    {/* Custom Cost */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-600 block">Procedure Fee (KES) *</label>
                      <input
                        type="number"
                        required
                        min="0"
                        placeholder="e.g. 500"
                        value={docCustomServiceCost}
                        onChange={e => setDocCustomServiceCost(Number(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-400"
                      />
                    </div>

                    {/* Staff Member */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-600 block">Performing Healthcare Provider *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Dr. Jane"
                        value={docCustomStaffMember}
                        onChange={e => setDocCustomStaffMember(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-400"
                      />
                    </div>
                  </div>
                )}

                {/* Clinical Notes */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-600 block">Clinical Execution & Treatment Notes</label>
                  <textarea
                    rows={3}
                    placeholder="Document clinical observations, medication dosage/site of injection, wound status, stitching detail..."
                    value={docClinicalNotes}
                    onChange={e => setDocClinicalNotes(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs outline-none focus:bg-white focus:border-blue-400"
                  />
                </div>

                <button
                  type="submit"
                  disabled={docSubmittingSrv}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl shadow-md transition text-xs flex items-center justify-center gap-1.5"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>{docSubmittingSrv ? "Logging Service..." : "Administer & Save Service Log"}</span>
                </button>
              </form>
            )}
          </>
        ) : (
          <div className="bg-white border border-slate-100 rounded-xl p-12 text-center text-slate-400">
            Please register or select a patient from the left panel to begin.
          </div>
        )}
      </div>
    </div>
  );
}
