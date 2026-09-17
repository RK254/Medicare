export interface Patient {
  id: string; // Unique National ID or registration number (optional/auto-generated if omitted)
  name: string;
  phone: string;
  sex: 'Male' | 'Female' | 'Other';
  maritalStatus: 'Single' | 'Married' | 'Divorced' | 'Widowed' | 'Others';
  age: number;
  bloodGroup?: string;
  dob?: string;
  isUnderage?: boolean;
  parentName?: string;
  parentPhone?: string;
  createdAt: string;
}

export interface Triage {
  temperature: number; // in °C
  systolicBP: number; // mmHg
  diastolicBP: number; // mmHg
  pulseRate: number; // bpm
  oxygenSaturation: number; // SpO2 %
  weight: number; // kg
  height: number; // cm
  recordedAt: string;
}

export interface PathologyCategory {
  id: string;
  name: string;
  description: string;
}

export interface PathologyUnit {
  id: string;
  name: string; // e.g. g/dL, mg/dL
  description: string;
}

export interface PathologyParameter {
  id: string;
  name: string;
  unitId: string;
  categoryId: string;
  normalRange: string; // e.g. 12.0 - 16.0
}

export interface PathologyTest {
  id: string;
  name: string;
  categoryId: string;
  parameterIds: string[]; // parameters included in this test
  cost: number;
}

export interface ExtraService {
  id: string;
  name: string;
  cost?: number;
  description: string;
}

export interface LabTestResult {
  parameterId: string;
  parameterName: string;
  value: string;
  unit: string;
  normalRange: string;
}

export interface ClinicRecord {
  id: string; // Unique consultation or interaction ID
  patientId: string; // Linked patient
  date: string;
  triage?: Triage;
  symptoms: string;
  ailment: string;
  staffMember?: string; // name of staff who performed/logged the service
  notes?: string; // custom notes or logs for this record
  
  // Extra services offered
  extraServices: Array<{
    serviceId: string;
    name: string;
    cost: number;
    status?: 'pending' | 'completed';
    administeredBy?: string;
    administeredAt?: string;
    notes?: string;
  }>;

  // Lab section
  labStatus: 'none' | 'pending' | 'completed';
  labRequest?: {
    testIds: string[]; // PathologyTest IDs requested
    requestedAt: string;
    completedAt?: string;
    results?: LabTestResult[];
    notes?: string;
    technicianId?: string;
  };

  // Prescription section
  prescriptionStatus: 'none' | 'pending' | 'partially_dispatched' | 'fully_dispatched';
  prescription?: {
    medications: Array<{
      name: string;
      dosage: string;
      qtyRequested: number;
      qtyDispatched: number; // Pharmacist updates this
    }>;
    prescribedAt: string;
    dispatchedAt?: string;
    pharmacistNotes?: string;
    doctorNotes?: string;
    dispenseHistory?: Array<{
      date: string;
      medicationName: string;
      qtyDispensed: number;
      remainingBalance: number;
      pharmacistName: string;
    }>;
  };
}

export interface User {
  id: string; // unique ID
  username: string;
  name: string;
  role: 'Doctor' | 'LabTech' | 'Pharmacist' | 'Receptionist' | 'Admin';
  password?: string;
  createdAt: string;
}

export type Role = 'Doctor' | 'LabTech' | 'Pharmacist' | 'Receptionist' | 'Admin';

export interface ClinicDatabase {
  patients: Patient[];
  records: ClinicRecord[];
  categories: PathologyCategory[];
  units: PathologyUnit[];
  parameters: PathologyParameter[];
  tests: PathologyTest[];
  extraServices: ExtraService[];
  users: User[];
}
