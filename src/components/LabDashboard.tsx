import React, { useState, useEffect } from "react";
import { 
  FlaskConical, Plus, Trash2, CheckCircle, Clock, ListCollapse, 
  Dna, PlusCircle, Settings, Clipboard, Coins, Activity, ChevronRight, HelpCircle,
  Edit2, Save, XCircle
} from "lucide-react";
import { ClinicDatabase, ClinicRecord, PathologyCategory, PathologyUnit, PathologyParameter, PathologyTest } from "../types";
import { 
  addPathologyCategory, addPathologyUnit, addPathologyParameter, addPathologyTest, submitLabResults,
  updatePathologyCategory, deletePathologyCategory,
  updatePathologyUnit, deletePathologyUnit,
  updatePathologyParameter, deletePathologyParameter,
  updatePathologyTest, deletePathologyTest
} from "../utils/api";

interface LabDashboardProps {
  db: ClinicDatabase;
  onRefresh: () => void;
  globalSearchQuery?: string;
  selectedPatientId?: string | null;
  onSelectPatientId?: (id: string | null) => void;
  onClearGlobalSearch?: () => void;
  currentUser?: { role: string; name: string };
}

export default function LabDashboard({ 
  db, 
  onRefresh,
  globalSearchQuery = "",
  selectedPatientId,
  onSelectPatientId,
  onClearGlobalSearch,
  currentUser
}: LabDashboardProps) {
  const isLabTech = currentUser?.role === "LabTech";

  // Tabs: Live Queue vs Config Library
  const [activeTab, setActiveTab] = useState<'queue' | 'config'>('queue');
  
  // Selected pending lab record
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(
    db.records.find(r => r.labStatus === "pending")?.id || null
  );

  // Sync selection with global selectedPatientId
  useEffect(() => {
    if (selectedPatientId) {
      const record = db.records.find(
        r => r.patientId === selectedPatientId && r.labStatus === "pending"
      );
      if (record) {
        setSelectedRecordId(record.id);
      }
    }
  }, [selectedPatientId, db.records]);

  // Live Queue (records where labStatus is pending), filtered by globalSearchQuery if active
  const pendingRecords = db.records.filter(r => {
    if (r.labStatus !== "pending") return false;
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

  // Form states for actual lab testing
  const [testValues, setTestValues] = useState<Record<string, string>>({});
  const [labNotes, setLabNotes] = useState("");
  const [technicianId, setTechnicianId] = useState("TECH-ALPHA");

  // Form states for Pathology configurations
  const [activeConfigTab, setActiveConfigTab] = useState<'category' | 'unit' | 'parameter' | 'test'>('test');
  
  // Category Form
  const [catForm, setCatForm] = useState({ name: "", description: "" });
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editCatForm, setEditCatForm] = useState({ name: "", description: "" });
  // Unit Form
  const [unitForm, setUnitForm] = useState({ name: "", description: "" });
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [editUnitForm, setEditUnitForm] = useState({ name: "", description: "" });

  // Parameter Form
  const [paramForm, setParamForm] = useState({ name: "", unitId: "", categoryId: "", normalRange: "" });
  const [editingParamId, setEditingParamId] = useState<string | null>(null);
  const [editParamForm, setEditParamForm] = useState({ name: "", unitId: "", categoryId: "", normalRange: "" });

  // Test Form
  const [testForm, setTestForm] = useState({ name: "", categoryId: "", parameterIds: [] as string[], cost: "" });
  const [editingTestId, setEditingTestId] = useState<string | null>(null);
  const [editTestForm, setEditTestForm] = useState({ name: "", categoryId: "", parameterIds: [] as string[], cost: "" });

  // Handle lab test results submission
  const handleLabSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRecord || !activeRecord.labRequest) return;

    // Build the results payload
    const resultsPayload = [];
    
    // Find all parameters associated with requested tests
    const requestedTests = db.tests.filter(t => activeRecord.labRequest?.testIds.includes(t.id));
    const paramIds = Array.from(new Set(requestedTests.flatMap(t => t.parameterIds)));

    for (const pid of paramIds) {
      const parameter = db.parameters.find(p => p.id === pid);
      const unit = db.units.find(u => u.id === parameter?.unitId)?.name || "";
      const val = testValues[pid] || "";
      
      if (!val.trim()) {
        alert(`Please fill out the result for ${parameter?.name}`);
        return;
      }

      resultsPayload.push({
        parameterId: pid,
        parameterName: parameter?.name || pid,
        value: val,
        unit,
        normalRange: parameter?.normalRange || ""
      });
    }

    try {
      await submitLabResults(activeRecord.id, {
        results: resultsPayload,
        notes: labNotes,
        technicianId: technicianId
      });

      // Reset test input states
      setTestValues({});
      setLabNotes("");
      setSelectedRecordId(null);
      
      onRefresh();
      alert("Pathology lab test results submitted successfully to the doctor!");
    } catch (err: any) {
      alert(err.message || "Failed to submit lab results.");
    }
  };

  // Pathology Config Submissions
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catForm.name.trim()) return;
    try {
      await addPathologyCategory(catForm.name.trim(), catForm.description.trim());
      setCatForm({ name: "", description: "" });
      onRefresh();
      alert("Pathology Category added successfully!");
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleStartEditCategory = (c: PathologyCategory) => {
    setEditingCategoryId(c.id);
    setEditCatForm({ name: c.name, description: c.description || "" });
  };

  const handleSaveCategory = async (id: string) => {
    if (!editCatForm.name.trim()) return;
    try {
      await updatePathologyCategory(id, editCatForm.name.trim(), editCatForm.description.trim());
      setEditingCategoryId(null);
      onRefresh();
      alert("Pathology Category updated successfully!");
    } catch (err: any) {
      alert(err.message || "Failed to update category.");
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this pathology category? This may affect existing parameters that reference this category.")) {
      return;
    }
    try {
      await deletePathologyCategory(id);
      onRefresh();
      alert("Pathology Category deleted successfully!");
    } catch (err: any) {
      alert(err.message || "Failed to delete category.");
    }
  };

  const handleAddUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unitForm.name.trim()) return;
    try {
      await addPathologyUnit(unitForm.name.trim(), unitForm.description.trim());
      setUnitForm({ name: "", description: "" });
      onRefresh();
      alert("Measurement Unit added successfully!");
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleStartEditUnit = (u: PathologyUnit) => {
    setEditingUnitId(u.id);
    setEditUnitForm({ name: u.name, description: u.description || "" });
  };

  const handleSaveUnit = async (id: string) => {
    if (!editUnitForm.name.trim()) return;
    try {
      await updatePathologyUnit(id, editUnitForm.name.trim(), editUnitForm.description.trim());
      setEditingUnitId(null);
      onRefresh();
      alert("Measurement unit updated successfully!");
    } catch (err: any) {
      alert(err.message || "Failed to update measurement unit.");
    }
  };

  const handleDeleteUnit = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this measurement unit?")) return;
    try {
      await deletePathologyUnit(id);
      onRefresh();
      alert("Measurement unit deleted successfully!");
    } catch (err: any) {
      alert(err.message || "Failed to delete measurement unit.");
    }
  };

  const handleAddParameter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paramForm.name.trim() || !paramForm.unitId || !paramForm.categoryId || !paramForm.normalRange.trim()) {
      alert("All fields are required for a pathology parameter.");
      return;
    }
    try {
      await addPathologyParameter(paramForm);
      setParamForm({ name: "", unitId: "", categoryId: "", normalRange: "" });
      onRefresh();
      alert("Pathology test parameter added!");
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleStartEditParameter = (p: PathologyParameter) => {
    setEditingParamId(p.id);
    setEditParamForm({
      name: p.name,
      unitId: p.unitId,
      categoryId: p.categoryId,
      normalRange: p.normalRange
    });
  };

  const handleSaveParameter = async (id: string) => {
    if (!editParamForm.name.trim() || !editParamForm.unitId || !editParamForm.categoryId || !editParamForm.normalRange.trim()) {
      alert("All fields are required.");
      return;
    }
    try {
      await updatePathologyParameter(id, editParamForm);
      setEditingParamId(null);
      onRefresh();
      alert("Pathology parameter updated successfully!");
    } catch (err: any) {
      alert(err.message || "Failed to update parameter.");
    }
  };

  const handleDeleteParameter = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this pathology parameter?")) return;
    try {
      await deletePathologyParameter(id);
      onRefresh();
      alert("Pathology parameter deleted successfully!");
    } catch (err: any) {
      alert(err.message || "Failed to delete parameter.");
    }
  };

  const handleAddTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testForm.name.trim() || !testForm.categoryId || testForm.parameterIds.length === 0 || !testForm.cost) {
      alert("All fields including at least one parameter and pricing are required.");
      return;
    }
    try {
      await addPathologyTest({
        name: testForm.name.trim(),
        categoryId: testForm.categoryId,
        parameterIds: testForm.parameterIds,
        cost: Number(testForm.cost)
      });
      setTestForm({ name: "", categoryId: "", parameterIds: [], cost: "" });
      onRefresh();
      alert("Pathology Test Suite and costing added successfully!");
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleStartEditTest = (t: PathologyTest) => {
    setEditingTestId(t.id);
    setEditTestForm({
      name: t.name,
      categoryId: t.categoryId,
      parameterIds: [...t.parameterIds],
      cost: String(t.cost)
    });
  };

  const handleSaveTest = async (id: string) => {
    if (!editTestForm.name.trim() || !editTestForm.categoryId || editTestForm.parameterIds.length === 0 || !editTestForm.cost) {
      alert("All fields including at least one parameter and cost are required.");
      return;
    }
    try {
      await updatePathologyTest(id, {
        name: editTestForm.name.trim(),
        categoryId: editTestForm.categoryId,
        parameterIds: editTestForm.parameterIds,
        cost: Number(editTestForm.cost)
      });
      setEditingTestId(null);
      onRefresh();
      alert("Pathology test updated successfully!");
    } catch (err: any) {
      alert(err.message || "Failed to update pathology test.");
    }
  };

  const handleDeleteTest = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this pathology test suite?")) return;
    try {
      await deletePathologyTest(id);
      onRefresh();
      alert("Pathology test deleted successfully!");
    } catch (err: any) {
      alert(err.message || "Failed to delete test.");
    }
  };

  // Find parameters for selected test form category
  const filteredParamsForNewTest = db.parameters.filter(p => p.categoryId === testForm.categoryId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="pathology-dashboard">
      
      {/* Tab Switcher on Top */}
      <div className="lg:col-span-12 flex justify-between items-center border-b border-slate-200 bg-white p-3 rounded-xl border border-slate-100">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab("queue")}
            className={`flex items-center gap-2 py-2 px-4 rounded-lg text-xs font-semibold transition ${
              activeTab === "queue"
                ? "bg-purple-100 text-purple-800"
                : "hover:bg-slate-50 text-slate-600"
            }`}
          >
            <FlaskConical className="w-4 h-4" />
            Live Pathology Queue ({pendingRecords.length})
          </button>
          {!isLabTech && (
            <button
              onClick={() => setActiveTab("config")}
              className={`flex items-center gap-2 py-2 px-4 rounded-lg text-xs font-semibold transition ${
                activeTab === "config"
                  ? "bg-purple-100 text-purple-800"
                  : "hover:bg-slate-50 text-slate-600"
              }`}
            >
              <Settings className="w-4 h-4" />
              Pathology Laboratory Configuration
            </button>
          )}
        </div>
        <div className="text-[11px] font-mono text-purple-600 font-bold hidden sm:block">
          DEPT: PATHOLOGY LAB & BIOCHEMISTRY
        </div>
      </div>

      {/* TAB: LIVE QUEUE FLOW */}
      {activeTab === "queue" && (
        <>
          {/* Left panel: live pending queue */}
          <div className="lg:col-span-4 bg-white rounded-xl border border-slate-100 p-5 shadow-sm h-[650px] flex flex-col">
            <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4 text-purple-600" />
              Pending Lab Requests
            </h3>

            {globalSearchQuery && (
              <div className="mb-3 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 text-xs text-blue-800 flex items-center justify-between shrink-0">
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

            <div className="flex-1 overflow-y-auto space-y-2 pr-1" id="lab-queue-list">
              {pendingRecords.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-50" />
                  No patients in the laboratory queue.
                </div>
              ) : (
                pendingRecords.map(r => {
                  const patient = db.patients.find(p => p.id === r.patientId);
                  const requestedTestNames = db.tests
                    .filter(t => r.labRequest?.testIds.includes(t.id))
                    .map(t => t.name);

                  return (
                    <div
                      key={r.id}
                      onClick={() => {
                        setSelectedRecordId(r.id);
                        setTestValues({}); // Clear inputs on switch
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
                        <span className="text-[9px] bg-purple-100 text-purple-700 font-bold px-1.5 py-0.2 rounded-full">
                          #{r.id}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1">ID: {patient?.id} • Age: {patient?.age} • Blood: {patient?.bloodGroup}</div>
                      
                      <div className="border-t border-slate-100 mt-2.5 pt-2">
                        <span className="text-[9px] text-slate-400 font-bold uppercase block tracking-wider">Ordered Tests</span>
                        <p className="text-[11px] text-purple-950 font-semibold truncate mt-0.5">
                          {requestedTestNames.join(", ") || "General Pathology"}
                        </p>
                      </div>
                      <div className="text-[9px] text-slate-400 text-right mt-1.5">
                        Requested {new Date(r.labRequest?.requestedAt || "").toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right panel: testing work station */}
          <div className="lg:col-span-8 flex flex-col space-y-6">
            {activeRecord && activePatient ? (
              <form onSubmit={handleLabSubmit} className="bg-white border border-slate-100 rounded-xl p-6 shadow-sm text-left flex flex-col h-[650px]">
                <div className="border-b border-slate-100 pb-4 mb-4 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] bg-purple-100 text-purple-800 font-bold uppercase px-2 py-0.5 rounded-full">Testing Station</span>
                    <h2 className="text-lg font-extrabold text-slate-800 mt-1.5">{activePatient.name}</h2>
                    <p className="text-[11px] text-slate-500 mt-0.5">Patient ID: {activePatient.id} | Marital: {activePatient.maritalStatus} | Sex: {activePatient.sex}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-400 block font-medium">Record Ticket</span>
                    <span className="font-bold text-slate-800 text-sm">#{activeRecord.id}</span>
                  </div>
                </div>

                {/* Symptoms and Doctor observation notes */}
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-xs mb-4">
                  <span className="block text-[10px] text-slate-400 uppercase font-bold tracking-wider">Doctor Clinical Notes</span>
                  <p className="text-slate-700 italic mt-0.5">"{activeRecord.symptoms}"</p>
                  <div className="mt-1.5 text-[10px] text-purple-800 font-bold">
                    Suspected: {activeRecord.ailment}
                  </div>
                </div>

                {/* Parameters list inputs */}
                <div className="flex-1 overflow-y-auto pr-2 space-y-4 mb-4" id="lab-testing-parameters">
                  <h4 className="font-bold text-xs text-slate-800 border-b border-slate-100 pb-1 flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-purple-600" />
                    Enter Test Parameter Measurements
                  </h4>

                  <div className="space-y-3">
                    {/* Gather tests ordered */}
                    {db.tests
                      .filter(t => activeRecord.labRequest?.testIds.includes(t.id))
                      .map(testSuite => {
                        return (
                          <div key={testSuite.id} className="border border-slate-100 rounded-xl p-4 bg-purple-50/15">
                            <span className="text-[11px] font-bold text-purple-900 block border-b border-purple-100 pb-1 mb-3">
                              {testSuite.name} (Suite costing: Ksh {testSuite.cost})
                            </span>

                            <div className="space-y-3">
                              {testSuite.parameterIds.map(pid => {
                                const parameter = db.parameters.find(p => p.id === pid);
                                const unit = db.units.find(u => u.id === parameter?.unitId)?.name || "";
                                if (!parameter) return null;

                                return (
                                  <div key={pid} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                                    <div className="md:col-span-4 text-xs font-semibold text-slate-700">
                                      {parameter.name}
                                    </div>
                                    <div className="md:col-span-5 flex items-center gap-2">
                                      <input
                                        type="text"
                                        required
                                        placeholder="Enter value"
                                        value={testValues[pid] || ""}
                                        onChange={e => setTestValues({ ...testValues, [pid]: e.target.value })}
                                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-purple-500 font-semibold"
                                      />
                                      <span className="text-[11px] text-slate-500 font-mono w-14 shrink-0">{unit}</span>
                                    </div>
                                    <div className="md:col-span-3 text-[10px] text-slate-500">
                                      Normal: <strong className="text-slate-700">{parameter.normalRange}</strong>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* Lab tech summary notes */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 border-t border-slate-100 pt-4 text-xs">
                  <div className="md:col-span-4">
                    <label className="block text-[10px] text-slate-500 font-semibold mb-1">Technician signature ID</label>
                    <input
                      type="text"
                      required
                      value={technicianId}
                      onChange={e => setTechnicianId(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono font-bold text-slate-800"
                    />
                  </div>
                  <div className="md:col-span-8">
                    <label className="block text-[10px] text-slate-500 font-semibold mb-1">Pathologist Laboratory Remarks</label>
                    <input
                      type="text"
                      placeholder="Comment on findings, abnormal alerts, or physical smear observations..."
                      value={labNotes}
                      onChange={e => setLabNotes(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 rounded-xl shadow-xs mt-4 transition text-xs"
                >
                  Confirm and Dispatch Results to Doctor
                </button>
              </form>
            ) : (
              <div className="bg-white border border-slate-100 rounded-xl p-16 text-center text-slate-400 h-[650px] flex flex-col justify-center">
                <FlaskConical className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                Select a patient record from the Live Pathology Queue to record laboratory test parameter entries.
              </div>
            )}
          </div>
        </>
      )}

      {/* TAB: PATHOLOGY LIBRARY CONFIGURATION */}
      {activeTab === "config" && (
        <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-12 gap-6 text-left">
          
          {/* Subnavigation config menu */}
          <div className="md:col-span-3 bg-slate-50/80 rounded-xl p-4 border border-slate-100 flex flex-col space-y-1">
            <h4 className="font-bold text-xs text-slate-400 uppercase tracking-wider mb-2.5 pl-2">Config Blocks</h4>
            
            <button
              onClick={() => setActiveConfigTab("test")}
              className={`p-2.5 rounded-lg text-xs font-semibold text-left flex items-center justify-between ${
                activeConfigTab === "test" ? "bg-purple-600 text-white" : "hover:bg-slate-100 text-slate-700"
              }`}
            >
              <span>Pathology Tests & Costing</span>
              <span className="text-[10px] bg-black/15 px-2 py-0.2 rounded-full font-bold">{db.tests.length}</span>
            </button>
            
            <button
              onClick={() => setActiveConfigTab("parameter")}
              className={`p-2.5 rounded-lg text-xs font-semibold text-left flex items-center justify-between ${
                activeConfigTab === "parameter" ? "bg-purple-600 text-white" : "hover:bg-slate-100 text-slate-700"
              }`}
            >
              <span>Test Parameters</span>
              <span className="text-[10px] bg-black/15 px-2 py-0.2 rounded-full font-bold">{db.parameters.length}</span>
            </button>

            <button
              onClick={() => setActiveConfigTab("category")}
              className={`p-2.5 rounded-lg text-xs font-semibold text-left flex items-center justify-between ${
                activeConfigTab === "category" ? "bg-purple-600 text-white" : "hover:bg-slate-100 text-slate-700"
              }`}
            >
              <span>Pathology Categories</span>
              <span className="text-[10px] bg-black/15 px-2 py-0.2 rounded-full font-bold">{db.categories.length}</span>
            </button>

            <button
              onClick={() => setActiveConfigTab("unit")}
              className={`p-2.5 rounded-lg text-xs font-semibold text-left flex items-center justify-between ${
                activeConfigTab === "unit" ? "bg-purple-600 text-white" : "hover:bg-slate-100 text-slate-700"
              }`}
            >
              <span>Measurement Units</span>
              <span className="text-[10px] bg-black/15 px-2 py-0.2 rounded-full font-bold">{db.units.length}</span>
            </button>
          </div>

          {/* Form/Viewing workspace for config */}
          <div className="md:col-span-9 bg-white border border-slate-100 rounded-xl p-6 shadow-sm">
            
            {/* SUB-TAB: PATHOLOGY CATEGORIES */}
            {activeConfigTab === "category" && (
              <div className="space-y-6">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Pathology Departments / Categories</h3>
                  <p className="text-xs text-slate-500">Add high-level pathological classifications (Hematology, Endocrinology, biochemistry, etc.)</p>
                </div>

                <form onSubmit={handleAddCategory} className="bg-slate-50 p-4 rounded-xl border border-slate-100 grid grid-cols-1 md:grid-cols-12 gap-3 text-xs">
                  <div className="md:col-span-4">
                    <label className="block text-[10px] text-slate-500 font-bold mb-1">Category Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g., Blood Serology"
                      value={catForm.name}
                      onChange={e => setCatForm({ ...catForm, name: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800"
                    />
                  </div>
                  <div className="md:col-span-6">
                    <label className="block text-[10px] text-slate-500 font-bold mb-1">Description</label>
                    <input
                      type="text"
                      placeholder="Analytical profiles of immune response and blood antibodies"
                      value={catForm.description}
                      onChange={e => setCatForm({ ...catForm, description: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800"
                    />
                  </div>
                  <div className="md:col-span-2 flex items-end">
                    <button type="submit" className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold p-2 rounded-lg text-xs">
                      Add Category
                    </button>
                  </div>
                </form>

                <div className="border border-slate-100 rounded-xl overflow-hidden">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                        <th className="p-3">ID</th>
                        <th className="p-3">Category Name</th>
                        <th className="p-3">Description</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {db.categories.map(c => {
                        const isEditing = editingCategoryId === c.id;
                        return (
                          <tr key={c.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                            <td className="p-3 font-mono text-slate-500 text-[10px]">{c.id}</td>
                            
                            {isEditing ? (
                              <>
                                <td className="p-2">
                                  <input
                                    type="text"
                                    required
                                    value={editCatForm.name}
                                    onChange={e => setEditCatForm({ ...editCatForm, name: e.target.value })}
                                    className="w-full bg-white border border-slate-200 rounded p-1.5 font-bold text-slate-800 outline-none"
                                  />
                                </td>
                                <td className="p-2">
                                  <input
                                    type="text"
                                    value={editCatForm.description}
                                    onChange={e => setEditCatForm({ ...editCatForm, description: e.target.value })}
                                    className="w-full bg-white border border-slate-200 rounded p-1.5 text-slate-500 outline-none"
                                  />
                                </td>
                                <td className="p-2 flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleSaveCategory(c.id)}
                                    className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold p-1.5 rounded-lg border border-emerald-100 transition"
                                    title="Save Category"
                                  >
                                    <Save className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingCategoryId(null)}
                                    className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold p-1.5 rounded-lg border border-slate-200 transition"
                                    title="Cancel"
                                  >
                                    <XCircle className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="p-3 font-bold text-slate-800">{c.name}</td>
                                <td className="p-3 text-slate-500">{c.description || "—"}</td>
                                <td className="p-3 flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditCategory(c)}
                                    className="bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold p-1.5 rounded-lg border border-blue-100 transition"
                                    title="Edit Category"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCategory(c.id)}
                                    className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold p-1.5 rounded-lg border border-rose-100 transition"
                                    title="Delete Category"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SUB-TAB: MEASUREMENT UNITS */}
            {activeConfigTab === "unit" && (
              <div className="space-y-6">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Measurement Units</h3>
                  <p className="text-xs text-slate-500">Configure medical units (mmol/L, pg, cells/mcL) for lab diagnostics</p>
                </div>

                <form onSubmit={handleAddUnit} className="bg-slate-50 p-4 rounded-xl border border-slate-100 grid grid-cols-1 md:grid-cols-12 gap-3 text-xs">
                  <div className="md:col-span-4">
                    <label className="block text-[10px] text-slate-500 font-bold mb-1">Unit Symbol *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g., pg"
                      value={unitForm.name}
                      onChange={e => setUnitForm({ ...unitForm, name: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800"
                    />
                  </div>
                  <div className="md:col-span-6">
                    <label className="block text-[10px] text-slate-500 font-bold mb-1">Description</label>
                    <input
                      type="text"
                      placeholder="Picograms per cell"
                      value={unitForm.description}
                      onChange={e => setUnitForm({ ...unitForm, description: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800"
                    />
                  </div>
                  <div className="md:col-span-2 flex items-end">
                    <button type="submit" className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold p-2 rounded-lg text-xs">
                      Add Unit
                    </button>
                  </div>
                </form>

                <div className="border border-slate-100 rounded-xl overflow-hidden">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                        <th className="p-3">ID</th>
                        <th className="p-3">Symbol</th>
                        <th className="p-3">Description</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {db.units.map(u => {
                        const isEditing = editingUnitId === u.id;
                        return (
                          <tr key={u.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                            <td className="p-3 font-mono text-slate-500 text-[10px]">{u.id}</td>
                            {isEditing ? (
                              <>
                                <td className="p-2">
                                  <input
                                    type="text"
                                    required
                                    value={editUnitForm.name}
                                    onChange={e => setEditUnitForm({ ...editUnitForm, name: e.target.value })}
                                    className="w-full bg-white border border-slate-200 rounded p-1.5 font-bold text-slate-800 outline-none"
                                  />
                                </td>
                                <td className="p-2">
                                  <input
                                    type="text"
                                    value={editUnitForm.description}
                                    onChange={e => setEditUnitForm({ ...editUnitForm, description: e.target.value })}
                                    className="w-full bg-white border border-slate-200 rounded p-1.5 text-slate-500 outline-none"
                                  />
                                </td>
                                <td className="p-2 flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleSaveUnit(u.id)}
                                    className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold p-1.5 rounded-lg border border-emerald-100 transition"
                                    title="Save Unit"
                                  >
                                    <Save className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingUnitId(null)}
                                    className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold p-1.5 rounded-lg border border-slate-200 transition"
                                    title="Cancel"
                                  >
                                    <XCircle className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="p-3 font-bold text-slate-800">{u.name}</td>
                                <td className="p-3 text-slate-500">{u.description || "—"}</td>
                                <td className="p-3 flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditUnit(u)}
                                    className="bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold p-1.5 rounded-lg border border-blue-100 transition"
                                    title="Edit Unit"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteUnit(u.id)}
                                    className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold p-1.5 rounded-lg border border-rose-100 transition"
                                    title="Delete Unit"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SUB-TAB: TEST PARAMETERS */}
            {activeConfigTab === "parameter" && (
              <div className="space-y-6">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Clinical Pathology Parameters</h3>
                  <p className="text-xs text-slate-500">Configure individual test items with categories, measurement units, and reference range ranges</p>
                </div>

                <form onSubmit={handleAddParameter} className="bg-slate-50 p-4 rounded-xl border border-slate-100 grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs">
                  <div className="sm:col-span-3">
                    <label className="block text-[10px] text-slate-500 font-bold mb-1">Parameter Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Red Blood Cells"
                      value={paramForm.name}
                      onChange={e => setParamForm({ ...paramForm, name: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded p-2 text-slate-800"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-[10px] text-slate-500 font-bold mb-1">Category / Department *</label>
                    <select
                      value={paramForm.categoryId}
                      onChange={e => setParamForm({ ...paramForm, categoryId: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded p-2 text-slate-800"
                    >
                      <option value="">Select Category</option>
                      {db.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] text-slate-500 font-bold mb-1">Unit *</label>
                    <select
                      value={paramForm.unitId}
                      onChange={e => setParamForm({ ...paramForm, unitId: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded p-2 text-slate-800"
                    >
                      <option value="">Select Unit</option>
                      {db.units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] text-slate-500 font-bold mb-1">Normal Range *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 4.5 - 5.9"
                      value={paramForm.normalRange}
                      onChange={e => setParamForm({ ...paramForm, normalRange: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded p-2 text-slate-800"
                    />
                  </div>
                  <div className="sm:col-span-2 flex items-end">
                    <button type="submit" className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold p-2 rounded text-xs">
                      Add Parameter
                    </button>
                  </div>
                </form>

                <div className="border border-slate-100 rounded-xl overflow-hidden">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                        <th className="p-3">Parameter Name</th>
                        <th className="p-3">Category</th>
                        <th className="p-3 text-center">Unit</th>
                        <th className="p-3 text-center">Normal Range</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {db.parameters.map(p => {
                        const isEditing = editingParamId === p.id;
                        const cat = db.categories.find(c => c.id === p.categoryId)?.name || "—";
                        const unit = db.units.find(u => u.id === p.unitId)?.name || "—";

                        return (
                          <tr key={p.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                            {isEditing ? (
                              <>
                                <td className="p-2">
                                  <input
                                    type="text"
                                    required
                                    value={editParamForm.name}
                                    onChange={e => setEditParamForm({ ...editParamForm, name: e.target.value })}
                                    className="w-full bg-white border border-slate-200 rounded p-1.5 font-bold text-slate-800 outline-none"
                                  />
                                </td>
                                <td className="p-2">
                                  <select
                                    value={editParamForm.categoryId}
                                    onChange={e => setEditParamForm({ ...editParamForm, categoryId: e.target.value })}
                                    className="w-full bg-white border border-slate-200 rounded p-1.5 text-slate-800 outline-none"
                                  >
                                    {db.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                  </select>
                                </td>
                                <td className="p-2">
                                  <select
                                    value={editParamForm.unitId}
                                    onChange={e => setEditParamForm({ ...editParamForm, unitId: e.target.value })}
                                    className="w-full bg-white border border-slate-200 rounded p-1.5 text-slate-800 outline-none"
                                  >
                                    {db.units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                  </select>
                                </td>
                                <td className="p-2">
                                  <input
                                    type="text"
                                    required
                                    value={editParamForm.normalRange}
                                    onChange={e => setEditParamForm({ ...editParamForm, normalRange: e.target.value })}
                                    className="w-full bg-white border border-slate-200 rounded p-1.5 text-slate-800 outline-none"
                                  />
                                </td>
                                <td className="p-2 flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleSaveParameter(p.id)}
                                    className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold p-1.5 rounded-lg border border-emerald-100 transition"
                                    title="Save Parameter"
                                  >
                                    <Save className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingParamId(null)}
                                    className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold p-1.5 rounded-lg border border-slate-200 transition"
                                    title="Cancel"
                                  >
                                    <XCircle className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="p-3 font-bold text-slate-800">{p.name}</td>
                                <td className="p-3 text-slate-600">{cat}</td>
                                <td className="p-3 text-center font-mono text-slate-500">{unit}</td>
                                <td className="p-3 text-center font-semibold text-blue-800">{p.normalRange}</td>
                                <td className="p-3 flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditParameter(p)}
                                    className="bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold p-1.5 rounded-lg border border-blue-100 transition"
                                    title="Edit Parameter"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteParameter(p.id)}
                                    className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold p-1.5 rounded-lg border border-rose-100 transition"
                                    title="Delete Parameter"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SUB-TAB: PATHOLOGY TESTS & COSTING */}
            {activeConfigTab === "test" && (
              <div className="space-y-6">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Pathology Laboratory Tests & Pricing</h3>
                  <p className="text-xs text-slate-500">Combine configured parameters into complete clinical laboratory tests (Urinalysis, Hematology panel) and set test costings</p>
                </div>

                <form onSubmit={handleAddTest} className="bg-slate-50 p-5 rounded-xl border border-slate-100 space-y-4 text-xs">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                    <div className="md:col-span-5">
                      <label className="block text-[10px] text-slate-500 font-bold mb-1">Test Suite Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g., Liver Function Tests (LFT)"
                        value={testForm.name}
                        onChange={e => setTestForm({ ...testForm, name: e.target.value })}
                        className="w-full bg-white border border-slate-200 rounded p-2 text-slate-800"
                      />
                    </div>
                    <div className="md:col-span-4">
                      <label className="block text-[10px] text-slate-500 font-bold mb-1">Category / Department *</label>
                      <select
                        required
                        value={testForm.categoryId}
                        onChange={e => setTestForm({ ...testForm, categoryId: e.target.value, parameterIds: [] })}
                        className="w-full bg-white border border-slate-200 rounded p-2 text-slate-800"
                      >
                        <option value="">Select Category First</option>
                        {db.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div className="md:col-span-3">
                      <label className="block text-[10px] text-slate-500 font-bold mb-1">Test Cost (KES / Ksh) *</label>
                      <div className="relative">
                        <Coins className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2.5" />
                        <input
                          type="number"
                          step="0.01"
                          required
                          placeholder="35.00"
                          value={testForm.cost}
                          onChange={e => setTestForm({ ...testForm, cost: e.target.value })}
                          className="w-full bg-white border border-slate-200 rounded pl-7 pr-2 py-2 text-slate-800 font-bold"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Multi-parameter check selector based on category */}
                  {testForm.categoryId && (
                    <div className="border border-slate-200/60 bg-white p-3.5 rounded-lg space-y-2">
                      <span className="block text-[10px] text-slate-500 font-bold uppercase">Select parameters to include in this test:</span>
                      
                      {filteredParamsForNewTest.length === 0 ? (
                        <p className="text-slate-400 italic text-[11px]">No parameters configured under this category. Add parameters first.</p>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {filteredParamsForNewTest.map(p => (
                            <label key={p.id} className="flex items-center gap-1.5 p-1.5 hover:bg-slate-50 rounded cursor-pointer">
                              <input
                                type="checkbox"
                                checked={testForm.parameterIds.includes(p.id)}
                                onChange={e => {
                                  if (e.target.checked) {
                                    setTestForm({ ...testForm, parameterIds: [...testForm.parameterIds, p.id] });
                                  } else {
                                    setTestForm({ ...testForm, parameterIds: testForm.parameterIds.filter(id => id !== p.id) });
                                  }
                                }}
                                className="text-purple-600 rounded"
                              />
                              <span className="text-[11px] text-slate-700">{p.name}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <button type="submit" className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 rounded-lg text-xs transition">
                    Create Lab Test Suite & Costing
                  </button>
                </form>

                {/* Tests library table */}
                <div className="border border-slate-100 rounded-xl overflow-hidden">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                        <th className="p-3">Test Name</th>
                        <th className="p-3">Category</th>
                        <th className="p-3">Constituent Parameters</th>
                        <th className="p-3 text-right">Costing</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {db.tests.map(test => {
                        const isEditing = editingTestId === test.id;
                        const cat = db.categories.find(c => c.id === test.categoryId)?.name || "—";
                        const paramsList = test.parameterIds
                          .map(id => db.parameters.find(p => p.id === id)?.name)
                          .filter(Boolean)
                          .join(", ");

                        const editCatParams = db.parameters.filter(p => p.categoryId === editTestForm.categoryId);

                        return (
                          <React.Fragment key={test.id}>
                            <tr className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                              <td className="p-3 font-bold text-slate-800">{test.name}</td>
                              <td className="p-3 text-slate-600">{cat}</td>
                              <td className="p-3 text-slate-500 max-w-[280px] truncate" title={paramsList}>
                                {paramsList || "None"}
                              </td>
                              <td className="p-3 text-right font-extrabold text-purple-800">Ksh {test.cost.toLocaleString()}</td>
                              <td className="p-3 flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleStartEditTest(test)}
                                  className="bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold p-1.5 rounded-lg border border-blue-100 transition"
                                  title="Edit Test Suite"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteTest(test.id)}
                                  className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold p-1.5 rounded-lg border border-rose-100 transition"
                                  title="Delete Test Suite"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                            {isEditing && (
                              <tr className="bg-purple-50/40 border-b border-purple-100">
                                <td colSpan={5} className="p-4">
                                  <div className="space-y-3 bg-white p-4 rounded-lg border border-purple-200">
                                    <h4 className="font-bold text-slate-800 text-xs">Edit Test Suite: {test.name}</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                                      <div className="md:col-span-5">
                                        <label className="block text-[10px] text-slate-500 font-bold mb-1">Test Name *</label>
                                        <input
                                          type="text"
                                          required
                                          value={editTestForm.name}
                                          onChange={e => setEditTestForm({ ...editTestForm, name: e.target.value })}
                                          className="w-full bg-white border border-slate-200 rounded p-1.5 text-slate-800"
                                        />
                                      </div>
                                      <div className="md:col-span-4">
                                        <label className="block text-[10px] text-slate-500 font-bold mb-1">Category *</label>
                                        <select
                                          value={editTestForm.categoryId}
                                          onChange={e => setEditTestForm({ ...editTestForm, categoryId: e.target.value, parameterIds: [] })}
                                          className="w-full bg-white border border-slate-200 rounded p-1.5 text-slate-800"
                                        >
                                          {db.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                      </div>
                                      <div className="md:col-span-3">
                                        <label className="block text-[10px] text-slate-500 font-bold mb-1">Cost (KES) *</label>
                                        <input
                                          type="number"
                                          step="0.01"
                                          required
                                          value={editTestForm.cost}
                                          onChange={e => setEditTestForm({ ...editTestForm, cost: e.target.value })}
                                          className="w-full bg-white border border-slate-200 rounded p-1.5 text-slate-800 font-bold"
                                        />
                                      </div>
                                    </div>

                                    {/* Parameter selection */}
                                    <div className="border border-slate-200 p-2.5 rounded bg-slate-50">
                                      <span className="block text-[10px] text-slate-500 font-bold mb-1">Select Parameters:</span>
                                      {editCatParams.length === 0 ? (
                                        <p className="text-slate-400 italic text-[11px]">No parameters in this category.</p>
                                      ) : (
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                                          {editCatParams.map(p => (
                                            <label key={p.id} className="flex items-center gap-1.5 text-[11px] text-slate-700 cursor-pointer">
                                              <input
                                                type="checkbox"
                                                checked={editTestForm.parameterIds.includes(p.id)}
                                                onChange={e => {
                                                  if (e.target.checked) {
                                                    setEditTestForm({ ...editTestForm, parameterIds: [...editTestForm.parameterIds, p.id] });
                                                  } else {
                                                    setEditTestForm({ ...editTestForm, parameterIds: editTestForm.parameterIds.filter(id => id !== p.id) });
                                                  }
                                                }}
                                                className="text-purple-600 rounded"
                                              />
                                              <span>{p.name}</span>
                                            </label>
                                          ))}
                                        </div>
                                      )}
                                    </div>

                                    <div className="flex justify-end gap-2 pt-1">
                                      <button
                                        type="button"
                                        onClick={() => setEditingTestId(null)}
                                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-bold text-xs"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleSaveTest(test.id)}
                                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded font-bold text-xs"
                                      >
                                        Save Test Suite Changes
                                      </button>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
