import React, { useState, useEffect, useRef } from "react";
import { 
  Pill, Clock, CheckCircle, AlertCircle, ShoppingBag, 
  Coins, Syringe, Clipboard, Activity, Heart, Search, ChevronRight, LogOut, CheckCircle2,
  UserPlus, History, FileText, Calendar, ShieldCheck, Printer, Check
} from "lucide-react";
import { ClinicDatabase, ClinicRecord, Patient, ExtraService } from "../types";
import { dispensePrescription, pharmacistAdministerService, registerPatient, updateServiceStatus } from "../utils/api";
import { printDispensingReport } from "../utils/print";

interface PharmacistDashboardProps {
  db: ClinicDatabase;
  onRefresh: () => void;
  onLogout: () => void;
  currentUser: { name: string };
  globalSearchQuery?: string;
  selectedPatientId?: string | null;
  onSelectPatientId?: (id: string | null) => void;
  onClearGlobalSearch?: () => void;
}

export default function PharmacistDashboard({ 
  db, 
  onRefresh,
  onLogout,
  currentUser,
  globalSearchQuery = "",
  selectedPatientId,
  onSelectPatientId,
  onClearGlobalSearch
}: PharmacistDashboardProps) {
  
  // Dashboard Tabs
  const [activeTab, setActiveTab] = useState<'dispensing' | 'clinical_services'>('dispensing');
  const [sidebarFilter, setSidebarFilter] = useState<'pending' | 'history'>('pending');

  // SELECTIVE DISPENSING TABS STATE
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(
    db.records.find(r => r.prescriptionStatus === "pending" || r.prescriptionStatus === "partially_dispatched")?.id || null
  );

  // States for active dispensing session
  const [patientDetailTab, setPatientDetailTab] = useState<'dispense' | 'history' | 'lab'>('dispense');
  const [dispenseNowValues, setDispenseNowValues] = useState<Record<string, number | string>>({});
  const [pharmacistNotes, setPharmacistNotes] = useState("");
  const [lastLoadedRecordId, setLastLoadedRecordId] = useState<string | null>(null);

  // INJECTIONS & EXTRA CLINICAL SERVICE STATE
  const [servicePatientSearch, setServicePatientSearch] = useState("");
  const [serviceSelectedPatientId, setServiceSelectedPatientId] = useState<string | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");
  const [clinicalNotes, setClinicalNotes] = useState("");
  const [submittingSrv, setSubmittingSrv] = useState(false);
  const [serviceSuccess, setServiceSuccess] = useState<string | null>(null);
  const [serviceError, setServiceError] = useState<string | null>(null);

  // New Walk-in Patient & Service Configuration States
  const [serviceTab, setServiceTab] = useState<'directory' | 'walkin'>('directory');
  const [procedureHistoryTab, setProcedureHistoryTab] = useState<'pending' | 'completed'>('pending');
  const [walkinForm, setWalkinForm] = useState({ name: "", phone: "", age: "", sex: "Male" as "Male" | "Female" | "Other", bloodGroup: "O+" });
  const [customServiceCost, setCustomServiceCost] = useState<number>(0);
  const [customStaffMember, setCustomStaffMember] = useState<string>(currentUser.name);

  const prevSelectedPatientIdRef = useRef<string | null | undefined>(selectedPatientId);

  // Sync selection with global selectedPatientId only when selectedPatientId actually changes
  useEffect(() => {
    if (selectedPatientId && selectedPatientId !== prevSelectedPatientIdRef.current) {
      prevSelectedPatientIdRef.current = selectedPatientId;
      if (activeTab === "dispensing") {
        const record = db.records.find(
          r => r.patientId === selectedPatientId && (r.prescriptionStatus === "pending" || r.prescriptionStatus === "partially_dispatched")
        );
        if (record) {
          setSelectedRecordId(record.id);
        }
      } else if (activeTab === "clinical_services") {
        setServiceSelectedPatientId(selectedPatientId);
        setServiceTab("directory");
      }
    }
  }, [selectedPatientId, db.records, activeTab]);

  // Filter clinical records that have a pending or partially dispatched prescription
  const pendingRxRecords = db.records.filter(r => {
    return r.prescriptionStatus === "pending" || r.prescriptionStatus === "partially_dispatched";
  });

  const filteredRxRecords = db.records.filter(r => {
    if (!r.prescription) return false;
    
    if (sidebarFilter === 'pending') {
      if (r.prescriptionStatus !== "pending" && r.prescriptionStatus !== "partially_dispatched") return false;
    } else {
      // Completed includes fully or partially dispatched history
      if (r.prescriptionStatus !== "fully_dispatched" && r.prescriptionStatus !== "partially_dispatched") return false;
    }

    if (!globalSearchQuery) return true;
    const patient = db.patients.find(p => p.id === r.patientId);
    if (!patient) return false;
    return (
      patient.name.toLowerCase().includes(globalSearchQuery.toLowerCase()) ||
      patient.id.toLowerCase().includes(globalSearchQuery.toLowerCase())
    );
  });

  const activeRecord = db.records.find(r => r.id === selectedRecordId);
  const activePatient = activeRecord ? db.patients.find(p => p.id === activeRecord.patientId) : null;
  const patientRecords = activePatient ? db.records.filter(r => r.patientId === activePatient.id) : [];
  const patientLabRecords = activePatient ? db.records.filter(r => r.patientId === activePatient.id && r.labRequest && r.labRequest.results && r.labRequest.results.length > 0) : [];

  // Initialize dispense values with remaining balances when active record changes
  useEffect(() => {
    if (activeRecord?.prescription) {
      if (selectedRecordId !== lastLoadedRecordId) {
        const initialVals: Record<string, number | string> = {};
        activeRecord.prescription.medications.forEach(m => {
          const remaining = m.qtyRequested - (m.qtyDispatched || 0);
          initialVals[m.name] = remaining > 0 ? remaining : 0;
        });
        setDispenseNowValues(initialVals);
        setPharmacistNotes(activeRecord.prescription.pharmacistNotes || "");
        setLastLoadedRecordId(selectedRecordId);
      }
    } else {
      if (selectedRecordId !== lastLoadedRecordId) {
        setDispenseNowValues({});
        setPharmacistNotes("");
        setLastLoadedRecordId(selectedRecordId);
      }
    }
  }, [selectedRecordId, activeRecord, lastLoadedRecordId]);

  const handleMarkServiceDone = async (recordId: string, serviceId: string) => {
    try {
      await updateServiceStatus(recordId, serviceId, 'completed', currentUser.name);
      onRefresh();
      alert("Clinical procedure status updated: Marked as Administered & Done!");
    } catch (err: any) {
      alert(err.message || "Failed to update clinical procedure status.");
    }
  };

  const handleDispenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRecord) return;

    // Compile medications dispatched array with incremental quantities
    const medicationsPayload = Object.keys(dispenseNowValues).map(name => ({
      name,
      qtyDispensedNow: Number(dispenseNowValues[name]) || 0
    }));

    try {
      const updated = await dispensePrescription(activeRecord.id, {
        medications: medicationsPayload,
        pharmacistNotes,
        pharmacistName: currentUser.name
      });

      setLastLoadedRecordId(null); // Force re-initialization of dispense values on next render
      onRefresh();
      alert(`Prescription #${activeRecord.id} dispatch updated! Status: ${updated.prescriptionStatus === "fully_dispatched" ? "Fully Dispatched" : "Partially Dispatched"}. You can now print the dispensing report.`);
    } catch (err: any) {
      alert(err.message || "Failed to update dispensing status.");
    }
  };

  const handleAdministerService = async (e: React.FormEvent) => {
    e.preventDefault();
    setServiceError(null);
    setServiceSuccess(null);

    if (!serviceSelectedPatientId) {
      setServiceError("Please select a patient first.");
      return;
    }
    if (!selectedServiceId) {
      setServiceError("Please choose a clinical service or injection to administer.");
      return;
    }

    try {
      setSubmittingSrv(true);
      const chosenSrv = db.extraServices.find(s => s.id === selectedServiceId);
      
      await pharmacistAdministerService({
        patientId: serviceSelectedPatientId,
        serviceId: selectedServiceId,
        notes: clinicalNotes.trim() || `Administered ${chosenSrv?.name || "Service"} by duty clinician.`,
        cost: customServiceCost,
        staffMember: customStaffMember || currentUser.name
      });

      setServiceSuccess(`Successfully administered and logged "${chosenSrv?.name || "Service"}" for KES ${customServiceCost}!`);
      setClinicalNotes("");
      setSelectedServiceId("");
      setCustomServiceCost(0);
      onRefresh();
    } catch (err: any) {
      setServiceError(err.message || "Failed to administer clinical service.");
    } finally {
      setSubmittingSrv(false);
    }
  };

  const handleCreateWalkin = async (e: React.FormEvent) => {
    e.preventDefault();
    setServiceError(null);
    setServiceSuccess(null);

    if (!walkinForm.name.trim() || !walkinForm.phone.trim() || !walkinForm.age.trim()) {
      setServiceError("Please fill in walk-in patient Name, Phone, and Age.");
      return;
    }

    try {
      setSubmittingSrv(true);
      const walkinId = `WALK-${Math.floor(1000 + Math.random() * 9000)}`;
      const newPatient = await registerPatient({
        id: walkinId,
        name: walkinForm.name.trim(),
        phone: walkinForm.phone.trim(),
        age: Number(walkinForm.age),
        sex: walkinForm.sex,
        maritalStatus: "Single",
        bloodGroup: walkinForm.bloodGroup
      });

      setServiceSelectedPatientId(newPatient.id);
      setWalkinForm({ name: "", phone: "", age: "", sex: "Male", bloodGroup: "O+" });
      setServiceTab("directory");
      setServiceSuccess(`Registered walk-in patient "${newPatient.name}" successfully!`);
      onRefresh();
    } catch (err: any) {
      setServiceError(err.message || "Failed to register walk-in patient.");
    } finally {
      setSubmittingSrv(false);
    }
  };

  // Service patient selection filter
  const filteredServicePatients = db.patients.filter(p => 
    p.name.toLowerCase().includes(servicePatientSearch.toLowerCase()) ||
    p.id.toLowerCase().includes(servicePatientSearch.toLowerCase())
  );

  const selectedServicePatient = db.patients.find(p => p.id === serviceSelectedPatientId);

  return (
    <div className="space-y-6" id="pharmacy-dashboard-container">
      
      {/* Tab Select & Header bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 bg-white p-4 rounded-2xl border">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("dispensing")}
            className={`flex items-center gap-2 py-2 px-4 rounded-xl text-xs font-bold transition ${
              activeTab === "dispensing"
                ? "bg-purple-600 text-white shadow-md"
                : "bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200"
            }`}
          >
            <Pill className="w-4 h-4" />
            Prescription Dispensing Hub ({pendingRxRecords.length})
          </button>
          
          <button
            onClick={() => setActiveTab("clinical_services")}
            className={`flex items-center gap-2 py-2 px-4 rounded-xl text-xs font-bold transition ${
              activeTab === "clinical_services"
                ? "bg-purple-600 text-white shadow-md"
                : "bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200"
            }`}
          >
            <Syringe className="w-4 h-4" />
            Pharmacist Injections & Clinical Services
          </button>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex flex-col text-right">
            <span className="text-xs font-bold text-slate-700">{currentUser.name}</span>
            <span className="text-[9px] text-purple-600 font-bold bg-purple-50 px-2 py-0.5 rounded-md border border-purple-100 self-end uppercase">PHARMACIST</span>
          </div>
          
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-rose-600 bg-rose-50 border border-rose-100 hover:bg-rose-100 rounded-xl transition font-semibold"
            title="Logout"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {activeTab === "dispensing" ? (
        /* DISPENSING HUB TAB */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-left" id="pharmacy-dispensing-workspace">
          
          {/* Pharmacy Queue Side rail */}
          <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-100 p-5 shadow-sm h-[650px] flex flex-col">
            <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
              <h3 className="font-bold text-slate-800 text-xs flex items-center gap-1.5 uppercase tracking-wider text-slate-400">
                <Clock className="w-4 h-4 text-purple-600" />
                Prescription Hub
              </h3>
              <span className="bg-purple-50 text-purple-700 text-[10px] font-bold px-2 py-0.5 rounded-md border border-purple-100">
                {pendingRxRecords.length} pending
              </span>
            </div>

            {/* Sidebar filter tabs */}
            <div className="flex border-b border-slate-100 mb-4 text-xs font-bold shrink-0">
              <button
                type="button"
                onClick={() => setSidebarFilter('pending')}
                className={`flex-1 pb-2 border-b-2 text-center transition ${sidebarFilter === 'pending' ? 'border-purple-600 text-purple-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
              >
                Queue ({pendingRxRecords.length})
              </button>
              <button
                type="button"
                onClick={() => setSidebarFilter('history')}
                className={`flex-1 pb-2 border-b-2 text-center transition ${sidebarFilter === 'history' ? 'border-purple-600 text-purple-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
              >
                Dispensed Logs
              </button>
            </div>

            {globalSearchQuery && (
              <div className="mb-3 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 text-xs text-blue-800 flex items-center justify-between shrink-0 animate-fade-in">
                <span className="truncate font-medium">Filtered: "{globalSearchQuery}"</span>
                <button
                  onClick={onClearGlobalSearch}
                  className="text-blue-600 hover:text-blue-800 font-bold ml-1.5 shrink-0 text-[11px] underline"
                >
                  Clear
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-2 pr-1" id="pharmacy-queue-list">
              {filteredRxRecords.length === 0 ? (
                <div className="text-center py-16 text-slate-400 text-xs flex flex-col items-center justify-center">
                  <CheckCircle className="w-9 h-9 text-emerald-500 mb-2 opacity-50" />
                  {sidebarFilter === 'pending' ? 'All prescriptions are fully dispatched. No pending drug orders!' : 'No dispensation logs found.'}
                </div>
              ) : (
                filteredRxRecords.map(r => {
                  const patient = db.patients.find(p => p.id === r.patientId);
                  const drugNames = r.prescription?.medications.map(m => m.name) || [];

                  return (
                    <div
                      key={r.id}
                      onClick={() => {
                        setSelectedRecordId(r.id);
                        if (onSelectPatientId) {
                          onSelectPatientId(r.patientId);
                        }
                      }}
                      className={`p-3.5 rounded-xl border text-left cursor-pointer transition ${
                        selectedRecordId === r.id
                          ? "bg-purple-50/70 border-purple-200 ring-1 ring-purple-200"
                          : "bg-white hover:bg-slate-50 border-slate-100"
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <span className="font-bold text-slate-800 text-xs">{patient?.name || "Unknown Patient"}</span>
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-[9px] bg-slate-100 text-slate-600 font-bold px-1.5 py-0.2 rounded font-mono">
                            #{r.id}
                          </span>
                          {r.prescriptionStatus === "partially_dispatched" ? (
                            <span className="text-[8px] bg-amber-50 text-amber-600 border border-amber-200 px-1 py-0.2 rounded font-bold">
                              PARTIAL
                            </span>
                          ) : r.prescriptionStatus === "fully_dispatched" ? (
                            <span className="text-[8px] bg-emerald-50 text-emerald-600 border border-emerald-200 px-1 py-0.2 rounded font-bold">
                              DISPATCHED
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="text-[10px] text-slate-400 font-semibold mt-1">ID: {patient?.id} • Age: {patient?.age} • Blood: {patient?.bloodGroup}</div>
                      
                      <div className="border-t border-slate-100 mt-2.5 pt-2">
                        <span className="text-[9px] text-slate-400 font-bold uppercase block tracking-wider">Prescribed Items</span>
                        <p className="text-[11px] text-purple-950 font-semibold truncate mt-0.5">
                          {drugNames.join(", ")}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Pharmacy Dispensing Station */}
          <div className="lg:col-span-8 flex flex-col space-y-6">
            {activeRecord && activePatient ? (
              <form onSubmit={handleDispenseSubmit} className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex flex-col h-[650px]">
                <div className="border-b border-slate-100 pb-3 mb-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] bg-purple-50 text-purple-700 font-bold border border-purple-100 uppercase px-2 py-0.5 rounded-md">Pharmacy Gateway</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2.5 mt-1.5">
                      <h2 className="text-lg font-extrabold text-slate-800 leading-none">{activePatient.name}</h2>
                      <button
                        type="button"
                        onClick={() => printDispensingReport(activeRecord, activePatient, currentUser.name)}
                        className="bg-purple-50 hover:bg-purple-100 text-purple-800 font-bold px-2.5 py-0.5 rounded-md border border-purple-100 transition flex items-center gap-1 text-[10px]"
                        title="Print Official Medication Dispensing Report"
                      >
                        <Printer className="w-3 h-3 text-purple-600" />
                        <span>Print Dispensing Slip</span>
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">Patient ID: {activePatient.id} | Phone: {activePatient.phone} | Age: {activePatient.age} yrs</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-400 block font-medium">Prescription Order</span>
                    <span className="font-extrabold text-purple-800 text-sm font-mono">#{activeRecord.id}</span>
                  </div>
                </div>

                {/* Sub-Tabs for Pharmacist */}
                <div className="flex border-b border-slate-200 mb-4 gap-1 text-xs font-bold shrink-0">
                  <button
                    type="button"
                    onClick={() => setPatientDetailTab('dispense')}
                    className={`pb-2 px-3 border-b-2 transition flex items-center gap-1.5 ${patientDetailTab === 'dispense' ? 'border-purple-600 text-purple-700' : 'border-transparent text-slate-400 hover:text-slate-700'}`}
                  >
                    <Pill className="w-3.5 h-3.5" />
                    <span>Dispense Prescription</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPatientDetailTab('history')}
                    className={`pb-2 px-3 border-b-2 transition flex items-center gap-1.5 ${patientDetailTab === 'history' ? 'border-purple-600 text-purple-700' : 'border-transparent text-slate-400 hover:text-slate-700'}`}
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>Clinic History ({patientRecords.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPatientDetailTab('lab')}
                    className={`pb-2 px-3 border-b-2 transition flex items-center gap-1.5 ${patientDetailTab === 'lab' ? 'border-purple-600 text-purple-700' : 'border-transparent text-slate-400 hover:text-slate-700'}`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Lab Pathology Reports ({patientLabRecords.length})</span>
                  </button>
                </div>

                {/* Diagnosis summary for clinical review */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs mb-4 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <span className="block text-[10px] text-slate-400 uppercase font-bold tracking-wider">Symptoms</span>
                      <p className="text-slate-700 italic mt-0.5">"{activeRecord.symptoms}"</p>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-400 uppercase font-bold tracking-wider">Ailment / Diagnosis</span>
                      <p className="text-purple-900 font-bold bg-purple-50 px-2 py-0.5 rounded border border-purple-100 mt-0.5 inline-block">{activeRecord.ailment}</p>
                    </div>
                  </div>
                  {activeRecord.prescription?.doctorNotes && (
                    <div className="border-t border-slate-200/60 pt-2.5">
                      <span className="block text-[10px] text-blue-700 uppercase font-bold tracking-wider">Doctor's Remarks / Instructions</span>
                      <p className="text-slate-800 font-semibold mt-1 bg-blue-50/40 border border-blue-100/50 p-2 rounded-lg">
                        {activeRecord.prescription.doctorNotes}
                      </p>
                    </div>
                  )}
                </div>

                {/* VIEW: CLINIC HISTORY */}
                {patientDetailTab === 'history' && (
                  <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-left">
                    {patientRecords.length === 0 ? (
                      <div className="bg-slate-50 border border-slate-100 rounded-xl p-8 text-center text-slate-400 text-xs">
                        No clinical logs found for this patient.
                      </div>
                    ) : (
                      patientRecords.map((rec, index) => (
                        <div key={rec.id} className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-4 shadow-xs text-xs space-y-2">
                          <div className="flex justify-between items-center border-b border-slate-200/60 pb-2">
                            <div>
                              <span className="font-bold text-slate-800">Record #{rec.id}</span>
                              <span className="text-[10px] text-slate-400 ml-2">
                                {new Date(rec.date).toLocaleDateString()} {new Date(rec.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <span className="text-[10px] font-semibold bg-purple-100 text-purple-800 px-2 py-0.5 rounded">
                              {rec.staffMember || "Attending Physician"}
                            </span>
                          </div>

                          {rec.triage && (
                            <div className="bg-white p-2 rounded-lg border border-slate-100 text-[11px] grid grid-cols-3 gap-2">
                              <div>Temp: <strong>{rec.triage.temperature}°C</strong></div>
                              <div>BP: <strong>{rec.triage.systolicBP}/{rec.triage.diastolicBP}</strong></div>
                              <div>Pulse: <strong>{rec.triage.pulseRate} bpm</strong></div>
                            </div>
                          )}

                          <div>
                            <span className="block text-[10px] text-slate-400 uppercase font-bold">Symptoms</span>
                            <p className="text-slate-800 font-medium">{rec.symptoms}</p>
                          </div>

                          <div>
                            <span className="block text-[10px] text-slate-400 uppercase font-bold">Ailment / Diagnosis</span>
                            <p className="text-purple-900 font-bold bg-purple-50 inline-block px-2 py-0.5 rounded border border-purple-100 mt-0.5">
                              {rec.ailment}
                            </p>
                          </div>

                          {rec.prescription && rec.prescription.medications.length > 0 && (
                            <div className="bg-white p-2.5 rounded-lg border border-slate-100">
                              <span className="block text-[10px] text-purple-800 uppercase font-bold mb-1">Prescribed Drugs</span>
                              <ul className="space-y-1 text-[11px]">
                                {rec.prescription.medications.map(m => (
                                  <li key={m.name} className="flex justify-between">
                                    <span><strong>{m.name}</strong> ({m.dosage})</span>
                                    <span className="text-slate-500">Dispensed: {m.qtyDispatched}/{m.qtyRequested}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* VIEW: LAB PATHOLOGY REPORTS */}
                {patientDetailTab === 'lab' && (
                  <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-left">
                    {patientLabRecords.length === 0 ? (
                      <div className="bg-slate-50 border border-slate-100 rounded-xl p-8 text-center text-slate-400 text-xs">
                        No laboratory pathology test reports registered for this patient.
                      </div>
                    ) : (
                      patientLabRecords.map((rec) => (
                        <div key={rec.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs text-xs space-y-3">
                          <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                            <div>
                              <span className="font-bold text-slate-800">Lab Request #{rec.id}</span>
                              <span className="text-[10px] text-slate-400 ml-2">
                                Requested: {new Date(rec.labRequest?.requestedAt || rec.date).toLocaleDateString()}
                              </span>
                            </div>
                            <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-100">
                              Completed Lab Report
                            </span>
                          </div>

                          <table className="w-full text-left text-[11px] border-collapse bg-slate-50/50 border border-slate-200 rounded-lg">
                            <thead>
                              <tr className="bg-slate-100 text-slate-600 font-bold">
                                <th className="p-2 border-b border-slate-200">Parameter</th>
                                <th className="p-2 border-b border-slate-200">Result Value</th>
                                <th className="p-2 border-b border-slate-200">Ref Range</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rec.labRequest?.results?.map((res, i) => {
                                const values = res.normalRange.split("-").map(Number);
                                const numVal = Number(res.value);
                                const isAbnormal = values.length === 2 && !isNaN(numVal) && (numVal < values[0] || numVal > values[1]);

                                return (
                                  <tr key={i} className="border-b border-slate-100 hover:bg-white">
                                    <td className="p-2 font-medium text-slate-800">{res.parameterName}</td>
                                    <td className={`p-2 font-bold ${isAbnormal ? "text-rose-600 bg-rose-50" : "text-slate-800"}`}>
                                      {res.value} {res.unit} {isAbnormal && "⚠️"}
                                    </td>
                                    <td className="p-2 text-slate-500">{res.normalRange} {res.unit}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>

                          {rec.labRequest?.notes && (
                            <div className="text-[11px] bg-amber-50/60 p-2 rounded-lg border border-amber-100 text-amber-900">
                              <strong>Technician Remarks:</strong> {rec.labRequest.notes}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* VIEW: DISPENSING WORKAREA */}
                {patientDetailTab === 'dispense' && (
                  <>
                    {/* Prescription Form Workarea */}
                    <div className="flex-1 overflow-y-auto pr-2 space-y-4 mb-4" id="dispensing-medications">
                      <h4 className="font-bold text-xs text-slate-800 border-b border-slate-100 pb-1.5 flex items-center gap-1.5">
                        <Pill className="w-4 h-4 text-purple-600" />
                        Prescription Dispatch Check & Dosage Reconciliation
                      </h4>

                      <div className="space-y-3">
                        {activeRecord.prescription?.medications.map(med => {
                          const alreadyDispensed = med.qtyDispatched || 0;
                          const remaining = med.qtyRequested - alreadyDispensed;
                          const val = dispenseNowValues[med.name] !== undefined ? dispenseNowValues[med.name] : remaining;
                          const isComplete = alreadyDispensed >= med.qtyRequested;
                          
                          return (
                            <div key={med.name} className="border border-slate-100 rounded-xl p-4 bg-purple-50/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                              <div className="flex-1">
                                <span className="text-xs font-bold text-slate-800 block">{med.name}</span>
                                <div className="flex flex-wrap items-center gap-2.5 text-[10px] text-slate-500 mt-1">
                                  <span>Dosage: <strong className="text-slate-700">{med.dosage}</strong></span>
                                  <span>•</span>
                                  <span>Req Qty: <strong className="text-slate-800">{med.qtyRequested}</strong></span>
                                  <span>•</span>
                                  <span>Dispensed So Far: <strong className="text-emerald-700 font-bold">{alreadyDispensed}</strong></span>
                                  <span>•</span>
                                  <span>Remaining Bal: <strong className="text-amber-700 font-bold">{remaining}</strong></span>
                                </div>
                              </div>

                              <div className="flex items-center gap-4">
                                <div className="text-right">
                                  <label className="block text-[9px] text-slate-400 uppercase font-bold mb-1">Dispense Now</label>
                                  <input
                                    type="number"
                                    step="any"
                                    min="0"
                                    max={remaining}
                                    disabled={isComplete}
                                    value={val}
                                    onChange={e => {
                                      const rawVal = e.target.value;
                                      const num = Number(rawVal);
                                      if (rawVal === "") {
                                        setDispenseNowValues({
                                          ...dispenseNowValues,
                                          [med.name]: ""
                                        });
                                      } else if (!isNaN(num)) {
                                        if (num > remaining) {
                                          setDispenseNowValues({
                                            ...dispenseNowValues,
                                            [med.name]: remaining
                                          });
                                        } else {
                                          setDispenseNowValues({
                                            ...dispenseNowValues,
                                            [med.name]: rawVal
                                          });
                                        }
                                      }
                                    }}
                                    className="w-20 bg-white border border-slate-200 rounded-lg p-1.5 text-center text-xs font-bold text-slate-800 focus:ring-1 focus:ring-purple-500 outline-none disabled:bg-slate-100 disabled:text-slate-400"
                                  />
                                </div>

                                {/* Multi-session Status Indicator */}
                                <div className="w-36 text-center shrink-0">
                                  {isComplete ? (
                                    <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold px-2 py-1 rounded-lg block">
                                      ✓ Fully Dispensed
                                    </span>
                                  ) : alreadyDispensed > 0 ? (
                                    <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 font-bold px-2 py-1 rounded-lg block">
                                      ⚠️ Partial ({alreadyDispensed}/{med.qtyRequested})
                                    </span>
                                  ) : (
                                    <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 font-bold px-2 py-1 rounded-lg block">
                                      ⏳ Pending Dispensation
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Dispense Session History Log */}
                      {activeRecord.prescription?.dispenseHistory && activeRecord.prescription.dispenseHistory.length > 0 && (
                        <div className="pt-4 border-t border-slate-100">
                          <h5 className="font-bold text-[10px] text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                            <History className="w-3.5 h-3.5 text-slate-400" />
                            Session Dispensation Log
                          </h5>
                          <div className="space-y-1.5 max-h-32 overflow-y-auto">
                            {activeRecord.prescription.dispenseHistory.map((item, idx) => (
                              <div key={idx} className="flex justify-between items-center text-[10px] bg-slate-50 border border-slate-100 p-2 rounded-lg">
                                <div className="text-slate-600">
                                  <span className="font-semibold text-slate-800">{item.medicationName}</span>: Dispensed <strong className="text-slate-800 font-bold">{item.qtyDispensed}</strong> (Remaining: {item.remainingBalance})
                                </div>
                                <div className="text-[9px] text-slate-400 text-right">
                                  <div>Logged by {item.pharmacistName}</div>
                                  <div>{new Date(item.date).toLocaleDateString()} {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Pharmacist Dispensing Remarks */}
                    <div className="border-t border-slate-100 pt-4 text-xs shrink-0">
                      <label className="block text-[10px] text-slate-500 font-semibold mb-1">Pharmacist Dispensing Remarks & Counselling Log</label>
                      <textarea
                        rows={2}
                        placeholder="Write patient dosage counselling remarks..."
                        value={pharmacistNotes}
                        onChange={e => setPharmacistNotes(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 outline-none focus:bg-white focus:ring-1 focus:ring-purple-500"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 rounded-xl shadow-md mt-4 transition text-xs shrink-0"
                    >
                      Confirm Dispensation Check & Update Log
                    </button>
                  </>
                )}
              </form>
            ) : (
              <div className="bg-white border border-slate-100 rounded-2xl p-16 text-center text-slate-400 h-[650px] flex flex-col justify-center shadow-sm">
                <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                Select a pending drug prescription ticket from the live queue rail to begin verification and dosage dispensing.
              </div>
            )}
          </div>
        </div>
      ) : (
        /* INJECTIONS & EXTRA CLINICAL SERVICES TAB */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-left" id="pharmacy-services-workspace">
          
          {/* Patient Directory / Walk-in Sidebar */}
          <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-100 p-5 shadow-sm h-[680px] flex flex-col">
            <div className="flex border-b border-slate-150 mb-4 text-xs font-bold gap-1 shrink-0 p-1 bg-slate-50 rounded-xl">
              <button
                type="button"
                onClick={() => setServiceTab("directory")}
                className={`flex-1 py-2 text-center rounded-lg transition ${serviceTab === "directory" ? "bg-white text-purple-700 shadow-xs" : "text-slate-500 hover:bg-slate-100"}`}
              >
                Registered Patient
              </button>
              <button
                type="button"
                onClick={() => setServiceTab("walkin")}
                className={`flex-1 py-2 text-center rounded-lg transition ${serviceTab === "walkin" ? "bg-white text-purple-700 shadow-xs" : "text-slate-500 hover:bg-slate-100"}`}
              >
                + Walk-in Patient
              </button>
            </div>

            {serviceTab === "directory" ? (
              <>
                <h3 className="font-bold text-[10px] text-slate-400 uppercase tracking-wider mb-3">
                  Search Registered Patient List
                </h3>

                <div className="relative mb-3 shrink-0">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search name, ID, phone..."
                    value={servicePatientSearch}
                    onChange={e => setServicePatientSearch(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition"
                  />
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                  {filteredServicePatients.length === 0 ? (
                    <div className="text-center py-10 text-slate-400 text-xs">No registered patients found.</div>
                  ) : (
                    filteredServicePatients.map(p => {
                      const isSelected = p.id === serviceSelectedPatientId;
                      const isWalkin = p.id.startsWith("WALK-");
                      return (
                        <div
                          key={p.id}
                          onClick={() => {
                            setServiceSelectedPatientId(p.id);
                            setServiceError(null);
                            setServiceSuccess(null);
                            if (onSelectPatientId) {
                              onSelectPatientId(p.id);
                            }
                          }}
                          className={`p-3 rounded-xl border transition cursor-pointer text-left flex justify-between items-center ${
                            isSelected 
                              ? "bg-purple-50 border-purple-300 text-purple-950" 
                              : "bg-white border-slate-100 hover:bg-slate-50 text-slate-700"
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h4 className="font-bold text-xs">{p.name}</h4>
                              {isWalkin && (
                                <span className="text-[8px] bg-amber-50 text-amber-700 font-bold border border-amber-200 px-1 py-0.2 rounded">Walk-in</span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-400 font-semibold font-mono">ID: {p.id} • {p.age} yrs • {p.sex}</p>
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            ) : (
              <form onSubmit={handleCreateWalkin} className="flex-1 flex flex-col justify-between overflow-y-auto">
                <div className="space-y-4">
                  <h3 className="font-bold text-[10px] text-slate-400 uppercase tracking-wider">
                    Quick Register Walk-in Patient
                  </h3>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 block">Full Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Jane Doe"
                      value={walkinForm.name}
                      onChange={e => setWalkinForm({ ...walkinForm, name: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-purple-400"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 block">Phone Number *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 0712345678"
                      value={walkinForm.phone}
                      onChange={e => setWalkinForm({ ...walkinForm, phone: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-purple-400"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-600 block">Age (Years) *</label>
                      <input
                        type="number"
                        required
                        min="0"
                        placeholder="e.g. 28"
                        value={walkinForm.age}
                        onChange={e => setWalkinForm({ ...walkinForm, age: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-purple-400"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-600 block">Sex *</label>
                      <select
                        value={walkinForm.sex}
                        onChange={e => setWalkinForm({ ...walkinForm, sex: e.target.value as any })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 text-xs focus:outline-none focus:border-purple-400"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 block">Blood Group</label>
                    <select
                      value={walkinForm.bloodGroup}
                      onChange={e => setWalkinForm({ ...walkinForm, bloodGroup: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 text-xs focus:outline-none focus:border-purple-400"
                    >
                      <option value="O+">O+</option>
                      <option value="O-">O-</option>
                      <option value="A+">A+</option>
                      <option value="A-">A-</option>
                      <option value="B+">B+</option>
                      <option value="B-">B-</option>
                      <option value="AB+">AB+</option>
                      <option value="AB-">AB-</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submittingSrv}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 rounded-xl shadow-md transition text-xs flex items-center justify-center gap-1.5 mt-4"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Register & Select Patient</span>
                </button>
              </form>
            )}
          </div>

          {/* Service delivery form panel */}
          <div className="lg:col-span-8 flex flex-col space-y-6">
            {selectedServicePatient ? (
              <div className="grid grid-cols-1 gap-6 animate-fade-in">
                
                {/* Form component */}
                <form onSubmit={handleAdministerService} className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex flex-col space-y-5">
                  <div className="border-b border-slate-100 pb-3 flex justify-between items-start">
                    <div>
                      <span className="text-[9px] bg-purple-50 text-purple-700 border border-purple-100 font-bold uppercase px-2 py-0.5 rounded-md">Service Administration</span>
                      <h2 className="text-base font-extrabold text-slate-800 mt-1">{selectedServicePatient.name}</h2>
                      <p className="text-[10px] text-slate-400 font-semibold font-mono">ID No: {selectedServicePatient.id} • Age: {selectedServicePatient.age} yrs • Sex: {selectedServicePatient.sex} • Blood: {selectedServicePatient.bloodGroup}</p>
                    </div>
                    <div className="bg-purple-50 p-2 rounded-xl text-purple-800 text-xs font-semibold flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                      Jul Medicare Nursing
                    </div>
                  </div>

                  {serviceError && (
                    <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 text-xs rounded-xl font-medium">
                      {serviceError}
                    </div>
                  )}

                  {serviceSuccess && (
                    <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs rounded-xl flex items-center gap-1.5 font-medium">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>{serviceSuccess}</span>
                    </div>
                  )}

                  {/* Service Selector */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-700">Select Clinical Service / Injection *</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-48 overflow-y-auto pr-1">
                      {db.extraServices.map(srv => {
                        const isChosen = selectedServiceId === srv.id;
                        return (
                          <div
                            key={srv.id}
                            onClick={() => {
                              setSelectedServiceId(srv.id);
                              setCustomServiceCost(srv.cost || 0);
                            }}
                            className={`p-3 rounded-xl border text-left cursor-pointer transition flex flex-col justify-between ${
                              isChosen 
                                ? "bg-purple-50/70 border-purple-400 ring-1 ring-purple-400 text-purple-950" 
                                : "bg-slate-50 border-slate-100 hover:bg-slate-100/70 text-slate-700"
                            }`}
                          >
                            <div>
                              <strong className="text-xs font-bold block">{srv.name}</strong>
                              <p className="text-[9px] text-slate-400 line-clamp-1 mt-0.5">{srv.description || "No description."}</p>
                            </div>
                            <div className="flex items-center justify-between border-t border-slate-200/40 pt-1.5 mt-2">
                              <span className="text-[8px] font-mono uppercase tracking-wider text-slate-400">Code: {srv.id}</span>
                              <strong className="text-purple-700 text-xs font-bold">Ksh {srv.cost ? srv.cost.toLocaleString() : "Variable Price"}</strong>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Customizable cost & staff input fields */}
                  {selectedServiceId && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100 animate-fade-in">
                      <div className="space-y-1">
                        <label className="block text-xs font-bold text-slate-700">Service Fee (KES / Ksh) *</label>
                        <input
                          type="number"
                          required
                          min="0"
                          value={customServiceCost}
                          onChange={e => setCustomServiceCost(Number(e.target.value))}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 font-mono font-bold text-slate-800 text-xs focus:border-purple-400 outline-none"
                        />
                        <span className="text-[10px] text-slate-400">Adjust the procedure fee as needed for this case.</span>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-xs font-bold text-slate-700">Performing Clinician / Staff *</label>
                        <input
                          type="text"
                          required
                          value={customStaffMember}
                          onChange={e => setCustomStaffMember(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 text-xs focus:border-purple-400 outline-none"
                        />
                        <span className="text-[10px] text-slate-400">Name of staff performing this clinical service.</span>
                      </div>
                    </div>
                  )}

                  {/* Clinical execution notes */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">Clinical Execution Notes / Nursing Log</label>
                    <textarea
                      rows={3}
                      placeholder="e.g. Cleansed suture site with normal saline, applied sterile dressing, patient tolerated procedure well with no complaints..."
                      value={clinicalNotes}
                      onChange={e => setClinicalNotes(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 outline-none focus:bg-white focus:ring-1 focus:ring-purple-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submittingSrv}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 rounded-xl shadow-md transition text-xs flex items-center justify-center gap-2"
                  >
                    {submittingSrv ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Syringe className="w-4 h-4" />
                        <span>Log & Document Clinical Visit</span>
                      </>
                    )}
                  </button>
                </form>

                {/* Patient's Past Clinical Service History Logs & Doctor Orders */}
                <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3 mb-4">
                    <h3 className="font-bold text-slate-800 text-xs flex items-center gap-2 uppercase tracking-wider text-slate-450">
                      <History className="w-4 h-4 text-purple-600" />
                      Clinical Procedure Visit History
                    </h3>

                    {/* Tabs for Doctor-Sent Pending vs Administered Done */}
                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs">
                      <button
                        type="button"
                        onClick={() => setProcedureHistoryTab('pending')}
                        className={`px-3 py-1 rounded-lg font-bold transition flex items-center gap-1.5 ${
                          procedureHistoryTab === 'pending'
                            ? "bg-white text-purple-700 shadow-sm"
                            : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        <Clock className="w-3.5 h-3.5 text-amber-500" />
                        <span>Doctor Orders (Pending)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setProcedureHistoryTab('completed')}
                        className={`px-3 py-1 rounded-lg font-bold transition flex items-center gap-1.5 ${
                          procedureHistoryTab === 'completed'
                            ? "bg-white text-purple-700 shadow-sm"
                            : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Administered / Done</span>
                      </button>
                    </div>
                  </div>
                  
                  {(() => {
                    const patientRecs = db.records.filter(r => r.patientId === selectedServicePatient.id);
                    const pendingList: Array<{
                      recordId: string;
                      serviceId: string;
                      date: string;
                      serviceName: string;
                      cost: number;
                      symptoms: string;
                      status: string;
                    }> = [];

                    const completedList: Array<{
                      recordId: string;
                      serviceId: string;
                      date: string;
                      serviceName: string;
                      staffMember: string;
                      cost: number;
                      notes: string;
                      administeredAt?: string;
                    }> = [];

                    patientRecs.forEach(rec => {
                      if (rec.extraServices && rec.extraServices.length > 0) {
                        rec.extraServices.forEach(s => {
                          const isDone = s.status === "completed";
                          if (!isDone) {
                            pendingList.push({
                              recordId: rec.id,
                              serviceId: s.serviceId || (s as any).id,
                              date: rec.date,
                              serviceName: s.name,
                              cost: s.cost || 0,
                              symptoms: rec.symptoms || "Prescribed during doctor consultation.",
                              status: "pending"
                            });
                          } else {
                            completedList.push({
                              recordId: rec.id,
                              serviceId: s.serviceId || (s as any).id,
                              date: rec.date,
                              serviceName: s.name,
                              staffMember: s.administeredBy || rec.staffMember || "Duty Clinician",
                              cost: s.cost || 0,
                              notes: s.notes || rec.notes || "Administered during visit.",
                              administeredAt: s.administeredAt
                            });
                          }
                        });
                      }
                    });

                    // Sort newest first
                    pendingList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                    completedList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                    if (procedureHistoryTab === 'pending') {
                      if (pendingList.length === 0) {
                        return (
                          <div className="text-center py-8 text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
                            <Clock className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
                            No pending clinical procedures ordered by doctor for this patient.
                          </div>
                        );
                      }

                      return (
                        <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                          {pendingList.map((srv, idx) => (
                            <div key={idx} className="border border-amber-200/80 bg-amber-50/40 rounded-xl p-3.5 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-800 text-xs">{srv.serviceName}</span>
                                  <span className="text-[9px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200">
                                    Ordered by Doctor
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-500 font-medium">
                                  Notes: {srv.symptoms}
                                </p>
                                <span className="text-[9px] text-slate-400 font-mono block">
                                  Ordered: {new Date(srv.date).toLocaleDateString()} {new Date(srv.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              </div>

                              <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0 border-t sm:border-t-0 border-amber-100 pt-2 sm:pt-0">
                                <span className="text-purple-700 font-extrabold text-xs">KES {srv.cost.toLocaleString()}</span>
                                <button
                                  type="button"
                                  onClick={() => handleMarkServiceDone(srv.recordId, srv.serviceId)}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition shadow-sm flex items-center gap-1.5"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Mark as Done</span>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    } else {
                      if (completedList.length === 0) {
                        return (
                          <div className="text-center py-8 text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
                            <CheckCircle2 className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
                            No completed clinical procedures recorded for this patient.
                          </div>
                        );
                      }

                      return (
                        <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                          {completedList.map((srv, idx) => (
                            <div key={idx} className="border border-slate-100 bg-slate-50/50 rounded-xl p-3.5 text-xs">
                              <div className="flex justify-between items-start gap-2 mb-1.5">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-slate-800 text-xs">{srv.serviceName}</span>
                                    <span className="text-[9px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-100 flex items-center gap-1">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                      Administered
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-slate-400 block font-medium mt-0.5">
                                    Administered by: <strong className="text-slate-600 font-semibold">{srv.staffMember}</strong>
                                  </span>
                                </div>
                                <div className="text-right shrink-0">
                                  <span className="text-purple-700 font-extrabold text-[11px] block">KES {srv.cost.toLocaleString()}</span>
                                  <span className="text-[9px] text-slate-400 font-mono mt-0.5 block">
                                    {srv.administeredAt ? new Date(srv.administeredAt).toLocaleDateString() : new Date(srv.date).toLocaleDateString()}
                                  </span>
                                </div>
                              </div>
                              <div className="bg-white border border-slate-100 p-2 rounded-lg text-slate-600 font-medium text-[11px] mt-2 italic">
                                "{srv.notes}"
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    }
                  })()}
                </div>

              </div>
            ) : (
              <div className="bg-white border border-slate-100 rounded-2xl p-16 text-center text-slate-400 h-[680px] flex flex-col justify-center shadow-sm">
                <Syringe className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <h4 className="font-bold text-slate-700 text-xs">No Patient Selected for Clinical Services</h4>
                <p className="text-[10px] text-slate-400 max-w-sm mx-auto mt-1">Select a registered patient from the directory or create a quick walk-in patient from the sidebar on the left to document procedures, injections, or wound treatments.</p>
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
}
