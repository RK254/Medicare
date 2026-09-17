import { ClinicDatabase, Patient, ClinicRecord, Triage } from "../types";

export async function fetchClinicDb(): Promise<ClinicDatabase> {
  const res = await fetch("/api/database");
  if (!res.ok) {
    throw new Error("Failed to fetch clinic database state.");
  }
  return res.json();
}

export async function registerPatient(patient: Omit<Patient, "createdAt">): Promise<Patient> {
  const res = await fetch("/api/patients", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patient),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to register patient.");
  }
  return res.json();
}

export async function createClinicRecord(recordData: {
  patientId: string;
  triage?: Triage;
  symptoms: string;
  ailment?: string;
  extraServices?: Array<string | { serviceId: string; cost: number }>;
  labTestIds?: string[];
  prescriptionMedications?: Array<{ name: string; dosage: string; qtyRequested: number }>;
  prescriptionDoctorNotes?: string;
}): Promise<ClinicRecord> {
  const res = await fetch("/api/records", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(recordData),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to create consultation record.");
  }
  return res.json();
}

export async function updateRecordTriage(recordId: string, triage: Triage): Promise<ClinicRecord> {
  const res = await fetch(`/api/records/${recordId}/triage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(triage),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to update triage details.");
  }
  return res.json();
}

export async function submitLabResults(
  recordId: string,
  data: {
    results: Array<{ parameterId: string; parameterName: string; value: string; unit: string; normalRange: string }>;
    notes?: string;
    technicianId?: string;
  }
): Promise<ClinicRecord> {
  const res = await fetch(`/api/records/${recordId}/lab-result`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to submit lab results.");
  }
  return res.json();
}

export async function submitReportPrescription(
  recordId: string,
  data: {
    ailment: string;
    symptoms?: string;
    prescriptionMedications?: Array<{ name: string; dosage: string; qtyRequested: number }>;
    extraServices?: Array<string | { serviceId: string; cost: number }>;
    prescriptionDoctorNotes?: string;
  }
): Promise<ClinicRecord> {
  const res = await fetch(`/api/records/${recordId}/report-prescription`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to submit diagnostic report.");
  }
  return res.json();
}

export async function dispensePrescription(
  recordId: string,
  data: {
    medications: Array<{ name: string; qtyDispatched?: number; qtyDispensedNow?: number }>;
    pharmacistNotes?: string;
    pharmacistName?: string;
  }
): Promise<ClinicRecord> {
  const res = await fetch(`/api/records/${recordId}/dispense`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to update dispensing status.");
  }
  return res.json();
}

export async function updateDoctorNotes(
  recordId: string,
  doctorNotes: string
): Promise<ClinicRecord> {
  const res = await fetch(`/api/records/${recordId}/doctor-notes`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ doctorNotes }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to update doctor remarks.");
  }
  return res.json();
}

export async function addPathologyCategory(name: string, description: string): Promise<any> {
  const res = await fetch("/api/config/category", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, description }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to add category.");
  }
  return res.json();
}

export async function updatePathologyCategory(id: string, name: string, description: string): Promise<any> {
  const res = await fetch(`/api/config/category/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, description }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to update category.");
  }
  return res.json();
}

export async function deletePathologyCategory(id: string): Promise<any> {
  const res = await fetch(`/api/config/category/${id}`, {
    method: "DELETE"
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to delete category.");
  }
  return res.json();
}

export async function addPathologyUnit(name: string, description: string): Promise<any> {
  const res = await fetch("/api/config/unit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, description }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to add unit.");
  }
  return res.json();
}

export async function updatePathologyUnit(id: string, name: string, description: string): Promise<any> {
  const res = await fetch(`/api/config/unit/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, description }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to update unit.");
  }
  return res.json();
}

export async function deletePathologyUnit(id: string): Promise<any> {
  const res = await fetch(`/api/config/unit/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to delete unit.");
  }
  return res.json();
}

export async function addPathologyParameter(param: {
  name: string;
  unitId: string;
  categoryId: string;
  normalRange: string;
}): Promise<any> {
  const res = await fetch("/api/config/parameter", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(param),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to add parameter.");
  }
  return res.json();
}

export async function updatePathologyParameter(id: string, param: {
  name: string;
  unitId: string;
  categoryId: string;
  normalRange: string;
}): Promise<any> {
  const res = await fetch(`/api/config/parameter/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(param),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to update parameter.");
  }
  return res.json();
}

export async function deletePathologyParameter(id: string): Promise<any> {
  const res = await fetch(`/api/config/parameter/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to delete parameter.");
  }
  return res.json();
}

export async function addPathologyTest(test: {
  name: string;
  categoryId: string;
  parameterIds: string[];
  cost: number;
}): Promise<any> {
  const res = await fetch("/api/config/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(test),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to add pathology test.");
  }
  return res.json();
}

export async function updatePathologyTest(id: string, test: {
  name: string;
  categoryId: string;
  parameterIds: string[];
  cost: number;
}): Promise<any> {
  const res = await fetch(`/api/config/test/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(test),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to update pathology test.");
  }
  return res.json();
}

export async function deletePathologyTest(id: string): Promise<any> {
  const res = await fetch(`/api/config/test/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to delete pathology test.");
  }
  return res.json();
}

export async function importDatabase(databaseData: any, mode: 'replace' | 'merge' = 'replace'): Promise<any> {
  const payload = {
    ...((typeof databaseData === "object" && !Array.isArray(databaseData)) ? databaseData : { data: databaseData }),
    mode
  };
  const res = await fetch("/api/admin/import-db", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: "Failed to import database." }));
    throw new Error(data.error || "Failed to import database.");
  }
  return res.json();
}

export async function uploadBackupSnapshot(databaseData: any): Promise<any> {
  const res = await fetch("/api/backups/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(databaseData),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: "Failed to upload backup snapshot." }));
    throw new Error(data.error || "Failed to upload backup snapshot.");
  }
  return res.json();
}

export async function addExtraService(srv: {
  name: string;
  cost?: number;
  description: string;
}): Promise<any> {
  const res = await fetch("/api/config/extra-service", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(srv),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to add extra service.");
  }
  return res.json();
}

export async function resetDatabase(): Promise<any> {
  const res = await fetch("/api/reset", { method: "POST" });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to reset database.");
  }
  return res.json();
}

export async function loginUser(credentials: { username: string; password: string; role: string }): Promise<any> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Login failed.");
  }
  return res.json();
}

export async function fetchUsers(): Promise<any[]> {
  const res = await fetch("/api/users");
  if (!res.ok) {
    throw new Error("Failed to fetch registered staff.");
  }
  return res.json();
}

export async function registerUser(userData: { username: string; password: string; name: string; role: string }): Promise<any> {
  const res = await fetch("/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(userData),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to register staff user.");
  }
  return res.json();
}

export async function updateUser(userId: string, userData: { name?: string; username?: string; role?: string; password?: string }): Promise<any> {
  const res = await fetch(`/api/users/${userId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(userData),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to update staff user.");
  }
  return res.json();
}

export async function deregisterUser(userId: string): Promise<any> {
  const res = await fetch(`/api/users/${userId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to deregister staff user.");
  }
  return res.json();
}

export async function changeUserPassword(data: { userId: string; currentPassword: string; newPassword: string }): Promise<any> {
  const res = await fetch("/api/auth/change-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to change password.");
  }
  return res.json();
}

export async function pharmacistAdministerService(data: { 
  patientId: string; 
  serviceId: string; 
  notes?: string; 
  cost?: number; 
  staffMember?: string; 
}): Promise<ClinicRecord> {
  const res = await fetch("/api/records/pharmacist-service", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to log pharmacist clinical service.");
  }
  return res.json();
}

export async function updateServiceStatus(
  recordId: string,
  serviceId: string,
  status: 'pending' | 'completed' = 'completed',
  administeredBy?: string,
  notes?: string
): Promise<ClinicRecord> {
  const res = await fetch(`/api/records/${recordId}/service-status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ serviceId, status, administeredBy, notes }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to update service administration status.");
  }
  return res.json();
}

export interface BackupSnapshotMeta {
  id: string;
  filename: string;
  type: 'auto' | 'manual' | 'safety';
  createdAt: string;
  sizeBytes?: number;
  patientCount?: number;
  recordCount?: number;
  userCount?: number;
}

export async function fetchBackups(): Promise<BackupSnapshotMeta[]> {
  const res = await fetch("/api/backups");
  if (!res.ok) {
    throw new Error("Failed to fetch backup snapshots.");
  }
  return res.json();
}

export async function createBackupSnapshot(): Promise<any> {
  const res = await fetch("/api/backups/create", { method: "POST" });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to create snapshot.");
  }
  return res.json();
}

export async function restoreBackupSnapshot(filename: string): Promise<any> {
  const res = await fetch(`/api/backups/${encodeURIComponent(filename)}/restore`, { method: "POST" });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to restore snapshot.");
  }
  return res.json();
}

export async function deleteBackupSnapshot(filename: string): Promise<any> {
  const res = await fetch(`/api/backups/${encodeURIComponent(filename)}`, { method: "DELETE" });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to delete backup snapshot.");
  }
  return res.json();
}
