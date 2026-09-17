import express from "express";
import path from "path";
import fs from "fs";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";
import { ClinicDatabase, Patient, ClinicRecord, PathologyCategory, PathologyUnit, PathologyParameter, PathologyTest, ExtraService, User } from "./src/types.js";

// Database storage setup
const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "database.json");

// Helper to seed default medical data if database doesn't exist
function getInitialDatabase(): ClinicDatabase {
  const categories: PathologyCategory[] = [
    { id: "cat_hem", name: "Hematology", description: "Blood cell counts and coagulation parameters" },
    { id: "cat_bio", name: "Biochemistry", description: "Metabolic and organ-function chemical testing" },
    { id: "cat_uri", name: "Urinalysis", description: "Chemical and microscopic analysis of urine" }
  ];

  const units: PathologyUnit[] = [
    { id: "u_gd", name: "g/dL", description: "Grams per deciliter" },
    { id: "u_mgd", name: "mg/dL", description: "Milligrams per deciliter" },
    { id: "u_mmol", name: "mmol/L", description: "Millimoles per liter" },
    { id: "u_cells", name: "10^9/L", description: "Billion cells per liter" },
    { id: "u_pct", name: "%", description: "Percentage" },
    { id: "u_ph", name: "pH", description: "Potential of Hydrogen scale" }
  ];

  const parameters: PathologyParameter[] = [
    { id: "param_hb", name: "Hemoglobin (Hb)", unitId: "u_gd", categoryId: "cat_hem", normalRange: "12.0 - 16.0" },
    { id: "param_wbc", name: "White Blood Cells (WBC)", unitId: "u_cells", categoryId: "cat_hem", normalRange: "4.0 - 11.0" },
    { id: "param_plt", name: "Platelet Count (PLT)", unitId: "u_cells", categoryId: "cat_hem", normalRange: "150 - 450" },
    { id: "param_fbs", name: "Fasting Blood Sugar", unitId: "u_mgd", categoryId: "cat_bio", normalRange: "70 - 100" },
    { id: "param_creat", name: "Serum Creatinine", unitId: "u_mgd", categoryId: "cat_bio", normalRange: "0.6 - 1.2" },
    { id: "param_uph", name: "Urine pH", unitId: "u_ph", categoryId: "cat_uri", normalRange: "4.5 - 8.0" }
  ];

  const tests: PathologyTest[] = [
    { id: "test_fbc", name: "Full Blood Count (FBC)", categoryId: "cat_hem", parameterIds: ["param_hb", "param_wbc", "param_plt"], cost: 1500.0 },
    { id: "test_fbs", name: "Fasting Blood Sugar (FBS)", categoryId: "cat_bio", parameterIds: ["param_fbs"], cost: 800.0 },
    { id: "test_renal", name: "Kidney Function Test (Creatinine)", categoryId: "cat_bio", parameterIds: ["param_creat"], cost: 1200.0 },
    { id: "test_urinalysis", name: "Routine Urinalysis", categoryId: "cat_uri", parameterIds: ["param_uph"], cost: 600.0 }
  ];

  const extraServices: ExtraService[] = [
    { id: "srv_dressing", name: "Wound Dressing & Cleaning", cost: 500.0, description: "Cleaning, antiseptic application, and sterile dressing of open wounds" },
    { id: "srv_stitching", name: "Minor Suturing (Stitching)", cost: 2500.0, description: "Local anesthesia administration and stitching of minor lacerations" },
    { id: "srv_nebulization", name: "Asthma Nebulization", cost: 1200.0, description: "Administration of bronchodilator mist therapy" },
    { id: "srv_injection", name: "Intramuscular Injection", cost: 400.0, description: "Administration of prescribed IM injection by clinical nurse" }
  ];

  const patients: Patient[] = [];

  const records: ClinicRecord[] = [];

  const users: User[] = [
    { id: "u_adm", username: "admin", name: "System Administrator (Admin)", role: "Admin", password: "admin@#254", createdAt: new Date("2026-07-19T00:00:00Z").toISOString() }
  ];

  return {
    patients,
    records,
    categories,
    units,
    parameters,
    tests,
    extraServices,
    users
  };
}

// Firebase Firestore setup for persistent cloud storage
let cachedDb: ClinicDatabase | null = null;

let firebaseConfig = {
  projectId: "igneous-album-thxn9",
  appId: "1:59945109138:web:199e5c51cd895479d4884b",
  apiKey: "AIzaSyBXto1OS_pmDrRAOIYleKYeIJEv2jPWqVY",
  authDomain: "igneous-album-thxn9.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-pharmacyandclini-8d312b64-5a3b-4086-aef9-157dad4ebecd",
  storageBucket: "igneous-album-thxn9.firebasestorage.app",
  messagingSenderId: "59945109138"
};

const configPath = path.join(process.cwd(), "firebase-applet-config.json");
if (fs.existsSync(configPath)) {
  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw);
    firebaseConfig = { ...firebaseConfig, ...parsed };
  } catch (e) {
    console.error("Failed to load firebase-applet-config.json", e);
  }
}

const firebaseApp = initializeApp({
  apiKey: firebaseConfig.apiKey,
  authDomain: firebaseConfig.authDomain,
  projectId: firebaseConfig.projectId,
  storageBucket: firebaseConfig.storageBucket,
  messagingSenderId: firebaseConfig.messagingSenderId,
  appId: firebaseConfig.appId
});

const firestore = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
const docRef = doc(firestore, "clinic", "main_state");
const backupsDocRef = doc(firestore, "clinic", "backups_store");

async function syncBackupsFromFirestore() {
  try {
    ensureBackupDir();
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Backups sync timeout")), 8000)
    );
    const snap = await Promise.race([getDoc(backupsDocRef), timeoutPromise]);
    if (snap.exists()) {
      const store = snap.data() || {};
      for (const [filename, payload] of Object.entries(store)) {
        if (typeof filename === "string" && payload) {
          const filePath = path.join(BACKUP_DIR, filename);
          if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf-8");
            console.log(`[Backups Sync] Restored backup snapshot from Cloud Firestore: ${filename}`);
          }
        }
      }
    }
  } catch (err) {
    console.error("Notice: Could not sync backup snapshots from Cloud Firestore:", err);
  }
}

async function persistBackupToFirestore(filename: string, payload: any) {
  try {
    const snap = await getDoc(backupsDocRef);
    const current = snap.exists() ? snap.data() : {};
    current[filename] = payload;
    await setDoc(backupsDocRef, current);
    console.log(`[Backups Sync] Saved ${filename} to Cloud Firestore.`);
  } catch (err) {
    console.error("Failed to persist backup snapshot to Cloud Firestore:", err);
  }
}

async function removeBackupFromFirestore(filename: string) {
  try {
    const snap = await getDoc(backupsDocRef);
    if (snap.exists()) {
      const current = snap.data() || {};
      delete current[filename];
      await setDoc(backupsDocRef, current);
      console.log(`[Backups Sync] Removed ${filename} from Cloud Firestore.`);
    }
  } catch (err) {
    console.error("Failed to remove backup snapshot from Cloud Firestore:", err);
  }
}

function mergeDatabases(base: ClinicDatabase, incoming?: Partial<ClinicDatabase> | null): ClinicDatabase {
  if (!incoming) return base;
  const merged: ClinicDatabase = {
    patients: [...(base.patients || [])],
    records: [...(base.records || [])],
    users: [...(base.users || [])],
    categories: [...(base.categories || [])],
    units: [...(base.units || [])],
    parameters: [...(base.parameters || [])],
    tests: [...(base.tests || [])],
    extraServices: [...(base.extraServices || [])]
  };

  function mergeList<T extends { id: string }>(target: T[], incomingList?: T[]) {
    if (!Array.isArray(incomingList)) return;
    const map = new Map<string, T>();
    for (const item of target) {
      if (item && item.id !== undefined) map.set(String(item.id), item);
    }
    for (const item of incomingList) {
      if (item && item.id !== undefined) {
        const id = String(item.id);
        const existing = map.get(id);
        if (!existing) {
          map.set(id, item);
        } else {
          // Merge properties non-destructively
          map.set(id, { ...existing, ...item });
        }
      }
    }
    target.length = 0;
    target.push(...Array.from(map.values()));
  }

  mergeList(merged.patients, incoming.patients);
  mergeList(merged.records, incoming.records);
  mergeList(merged.users, incoming.users);
  mergeList(merged.categories, incoming.categories);
  mergeList(merged.units, incoming.units);
  mergeList(merged.parameters, incoming.parameters);
  mergeList(merged.tests, incoming.tests);
  mergeList(merged.extraServices, incoming.extraServices);

  return sanitizeClinicMedicalData(merged);
}

function sanitizeClinicMedicalData(db: ClinicDatabase): ClinicDatabase {
  if (!db) return db;

  // 1. Identify urinalysis category and parameter IDs related to Ketone/urinalysis
  let uriCat = db.categories?.find(c => c.name.toLowerCase().includes("urinalysis") || c.id === "cat_880" || c.id === "cat_uri");
  const ketoneParamIds = new Set<string>();

  if (Array.isArray(db.parameters)) {
    db.parameters.forEach(p => {
      if (p.id === "param_337" || p.name.toLowerCase().includes("ketone") || p.name.toLowerCase().includes("kelotone")) {
        ketoneParamIds.add(p.id);
        // Correct parameter name to Ketone and urinalysis category assignment
        p.name = "Ketone";
        if (uriCat) {
          p.categoryId = uriCat.id;
        }
      }
    });
  }

  // 2. Ensure Full Blood Count (FBC) tests DO NOT include any Ketone parameters or urinalysis parameters
  if (Array.isArray(db.tests)) {
    db.tests.forEach(test => {
      const isFbc = test.id === "test_fbc" || 
        test.name.toLowerCase().includes("full blood count") || 
        test.name.toLowerCase().includes("(fbc)");

      if (isFbc && Array.isArray(test.parameterIds)) {
        // Remove param_337 and any parameter that is a ketone or belongs to Urinalysis
        test.parameterIds = test.parameterIds.filter(pid => {
          if (pid === "param_337" || ketoneParamIds.has(pid)) return false;
          const param = db.parameters?.find(p => p.id === pid);
          if (param && (param.name.toLowerCase().includes("ketone") || param.name.toLowerCase().includes("kelotone"))) {
            return false;
          }
          return true;
        });
      }

      const isUrinalysis = test.id === "test_481" || 
        test.id === "test_urinalysis" || 
        test.name.toLowerCase().includes("urinalysis");

      if (isUrinalysis && Array.isArray(test.parameterIds)) {
        // Ensure param_337 is present under Urinalysis if it exists
        if (db.parameters?.some(p => p.id === "param_337") && !test.parameterIds.includes("param_337")) {
          test.parameterIds.unshift("param_337");
        }
      }
    });
  }

  return db;
}

async function loadDbFromFirestore(): Promise<ClinicDatabase> {
  console.log("Connecting to Cloud Firestore to retrieve clinic state...");
  const timeoutMs = 12000;
  
  let docSnap = null;
  let fetchFailed = false;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Firestore connection timeout (attempt ${attempt})`)), timeoutMs)
      );
      docSnap = await Promise.race([getDoc(docRef), timeoutPromise]);
      fetchFailed = false;
      break;
    } catch (err) {
      fetchFailed = true;
      console.error(`Firestore fetch attempt ${attempt} failed:`, err);
      if (attempt < 2) await new Promise(r => setTimeout(r, 1000));
    }
  }

  // Read local database cache if present
  let localData: ClinicDatabase | null = null;
  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed && (Array.isArray(parsed.patients) || Array.isArray(parsed.users))) {
        localData = parsed;
      }
    } catch (e) {
      console.error("Notice: Could not parse local DB_FILE cache:", e);
    }
  }

  let finalDb: ClinicDatabase = getInitialDatabase();

  if (!fetchFailed && docSnap && docSnap.exists()) {
    const firestoreData = docSnap.data() as ClinicDatabase;
    console.log(`Loaded Firestore state with ${firestoreData.patients?.length || 0} patients, ${firestoreData.records?.length || 0} records.`);
    
    // Non-destructively union merge Firestore data with local data so NO record is ever lost
    finalDb = mergeDatabases(finalDb, firestoreData);
    if (localData) {
      finalDb = mergeDatabases(finalDb, localData);
    }

    finalDb = sanitizeClinicMedicalData(finalDb);
    cachedDb = finalDb;
    try {
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(DB_FILE, JSON.stringify(finalDb, null, 2), "utf-8");
    } catch (e) {}

    // Synchronize sanitized state back to Firestore
    setDoc(docRef, finalDb).catch(err => console.error("Background Firestore sync on sanitize error:", err));

    await syncBackupsFromFirestore();
    return finalDb;
  }

  if (!fetchFailed && docSnap && !docSnap.exists()) {
    console.log("No existing database document in Cloud Firestore. Merging local cache or seeding default state...");
    if (localData && (localData.patients?.length || 0) > 0) {
      finalDb = mergeDatabases(finalDb, localData);
    }
    finalDb = sanitizeClinicMedicalData(finalDb);
    cachedDb = finalDb;
    try {
      await setDoc(docRef, finalDb);
      console.log("Initialized Cloud Firestore with clinic database.");
    } catch (err) {
      console.error("Failed to write initial state to Firestore:", err);
    }
    return finalDb;
  }

  // If fetching failed (timeout/network error), operate with local data and merge
  console.warn("Notice: Operating in local cache mode (Firestore unavailable on cold boot).");
  if (localData) {
    finalDb = mergeDatabases(finalDb, localData);
  }
  finalDb = sanitizeClinicMedicalData(finalDb);
  cachedDb = finalDb;
  return cachedDb;
}

function readDb(): ClinicDatabase {
  if (cachedDb) return cachedDb;

  if (fs.existsSync(DB_FILE)) {
    try {
      cachedDb = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
      return cachedDb!;
    } catch (e) {}
  }

  cachedDb = getInitialDatabase();
  return cachedDb;
}

function writeDb(data: ClinicDatabase) {
  // Sanitize data to strip any undefined values and prevent Firestore serialization errors
  const cleanData = sanitizeClinicMedicalData(JSON.parse(JSON.stringify(data)));
  cachedDb = cleanData;

  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DB_FILE, JSON.stringify(cleanData, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed writing to local file cache", err);
  }

  setDoc(docRef, cleanData)
    .then(() => {
      console.log("Persisted updated clinic state to Cloud Firestore.");
    })
    .catch((err) => {
      console.error("Failed persisting to Cloud Firestore:", err);
    });
}

const BACKUP_DIR = path.join(process.cwd(), "backups");

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

async function runDailyAutoBackup() {
  try {
    ensureBackupDir();
    const db = readDb();
    const todayStr = new Date().toISOString().split("T")[0];
    const files = fs.readdirSync(BACKUP_DIR);
    const existingToday = files.find(f => f.startsWith(`auto-backup-${todayStr}`));
    if (!existingToday) {
      const nowIso = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `auto-backup-${todayStr}_${nowIso}.json`;
      const filePath = path.join(BACKUP_DIR, filename);
      const backupPayload = {
        meta: {
          id: `bk_${Date.now()}`,
          filename,
          type: "auto",
          createdAt: new Date().toISOString(),
          patientCount: db.patients?.length || 0,
          recordCount: db.records?.length || 0,
          userCount: db.users?.length || 0,
        },
        database: db
      };
      fs.writeFileSync(filePath, JSON.stringify(backupPayload, null, 2), "utf-8");
      console.log(`[Auto Backup] Generated daily backup snapshot: ${filename}`);
      await persistBackupToFirestore(filename, backupPayload);
    }
  } catch (err) {
    console.error("[Auto Backup] Error generating daily backup:", err);
  }
}

async function startServer() {
  // Pre-load local database cache synchronously so API endpoints are immediately responsive
  readDb();

  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // Log API requests
  app.use((req, res, next) => {
    console.log(`[API Request]: ${req.method} ${req.url}`);
    next();
  });

  // REST API Routes

  // Backups & Snapshots API
  app.get("/api/backups", (req, res) => {
    try {
      ensureBackupDir();
      const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith(".json"));
      const snapshots = files.map(filename => {
        const filePath = path.join(BACKUP_DIR, filename);
        const stats = fs.statSync(filePath);
        let meta: any = {
          id: filename,
          filename,
          type: filename.startsWith("auto-backup") ? "auto" : filename.startsWith("pre-restore") || filename.startsWith("pre-reset") ? "safety" : "manual",
          createdAt: stats.mtime.toISOString(),
          sizeBytes: stats.size,
          patientCount: 0,
          recordCount: 0,
          userCount: 0
        };
        try {
          const content = JSON.parse(fs.readFileSync(filePath, "utf-8"));
          if (content.meta) {
            meta = { ...meta, ...content.meta };
          } else if (content.database) {
            meta.patientCount = content.database.patients?.length || 0;
            meta.recordCount = content.database.records?.length || 0;
            meta.userCount = content.database.users?.length || 0;
          } else if (content.patients) {
            meta.patientCount = content.patients.length || 0;
            meta.recordCount = content.records?.length || 0;
            meta.userCount = content.users?.length || 0;
          }
        } catch (e) {}
        return meta;
      });

      snapshots.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      res.json(snapshots);
    } catch (err) {
      res.status(500).json({ error: "Failed to list backups." });
    }
  });

  // Upload a backup snapshot to the archive
  app.post("/api/backups/upload", async (req, res) => {
    try {
      ensureBackupDir();
      const rawData = req.body;
      if (!rawData || typeof rawData !== "object") {
        return res.status(400).json({ error: "Invalid backup file: Empty or invalid JSON." });
      }

      let target = rawData;
      if (rawData.database && typeof rawData.database === "object" && !Array.isArray(rawData.database)) target = rawData.database;
      else if (rawData.db && typeof rawData.db === "object" && !Array.isArray(rawData.db)) target = rawData.db;
      else if (rawData.data && typeof rawData.data === "object" && !Array.isArray(rawData.data)) target = rawData.data;
      else if (rawData.clinic && typeof rawData.clinic === "object" && !Array.isArray(rawData.clinic)) target = rawData.clinic;
      else if (rawData.main_state && typeof rawData.main_state === "object" && !Array.isArray(rawData.main_state)) target = rawData.main_state;

      const nowIso = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `uploaded-backup-${nowIso}.json`;
      const filePath = path.join(BACKUP_DIR, filename);

      const patientCount = Array.isArray(target.patients) ? target.patients.length : 0;
      const recordCount = Array.isArray(target.records) ? target.records.length : 0;
      const userCount = Array.isArray(target.users) ? target.users.length : 0;

      const backupPayload = {
        meta: {
          id: `bk_upload_${Date.now()}`,
          filename,
          type: "manual",
          createdAt: new Date().toISOString(),
          patientCount,
          recordCount,
          userCount
        },
        database: target
      };

      fs.writeFileSync(filePath, JSON.stringify(backupPayload, null, 2), "utf-8");
      await persistBackupToFirestore(filename, backupPayload);

      res.json({
        success: true,
        filename,
        meta: backupPayload.meta,
        message: `Backup snapshot "${filename}" saved with ${patientCount} patients and ${recordCount} records.`
      });
    } catch (err: any) {
      console.error("Error uploading backup snapshot:", err);
      res.status(500).json({ error: err.message || "Failed to upload backup snapshot." });
    }
  });

  app.post("/api/backups/create", async (req, res) => {
    try {
      ensureBackupDir();
      const db = readDb();
      const nowIso = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `manual-snapshot-${nowIso}.json`;
      const filePath = path.join(BACKUP_DIR, filename);
      const backupPayload = {
        meta: {
          id: `bk_${Date.now()}`,
          filename,
          type: "manual",
          createdAt: new Date().toISOString(),
          patientCount: db.patients?.length || 0,
          recordCount: db.records?.length || 0,
          userCount: db.users?.length || 0
        },
        database: db
      };
      fs.writeFileSync(filePath, JSON.stringify(backupPayload, null, 2), "utf-8");
      await persistBackupToFirestore(filename, backupPayload);
      res.json({ success: true, filename, meta: backupPayload.meta });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to create snapshot." });
    }
  });

  app.post("/api/backups/:filename/restore", async (req, res) => {
    try {
      const { filename } = req.params;
      const filePath = path.join(BACKUP_DIR, filename);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "Backup file not found." });
      }

      ensureBackupDir();
      const dbBefore = readDb();
      const nowIso = new Date().toISOString().replace(/[:.]/g, "-");
      const safetyFilename = `pre-restore-safety-${nowIso}.json`;
      const safetyPayload = {
        meta: {
          id: `bk_safety_${Date.now()}`,
          filename: safetyFilename,
          type: "safety",
          createdAt: new Date().toISOString(),
          patientCount: dbBefore.patients?.length || 0,
          recordCount: dbBefore.records?.length || 0
        },
        database: dbBefore
      };
      fs.writeFileSync(path.join(BACKUP_DIR, safetyFilename), JSON.stringify(safetyPayload, null, 2), "utf-8");
      await persistBackupToFirestore(safetyFilename, safetyPayload);

      const raw = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(raw);
      const restoredData: ClinicDatabase = parsed.database ? parsed.database : parsed;

      if (!restoredData || !Array.isArray(restoredData.users)) {
        return res.status(400).json({ error: "Invalid backup file structure." });
      }

      writeDb(restoredData);
      res.json({ success: true, message: `Database restored from ${filename}! Pre-restore safety backup created.` });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to restore backup snapshot." });
    }
  });

  app.delete("/api/backups/:filename", async (req, res) => {
    try {
      const { filename } = req.params;
      const filePath = path.join(BACKUP_DIR, filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      await removeBackupFromFirestore(filename);
      res.json({ success: true, filename });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to delete snapshot." });
    }
  });

  app.get("/api/backups/:filename/download", (req, res) => {
    try {
      const { filename } = req.params;
      const filePath = path.join(BACKUP_DIR, filename);
      if (!fs.existsSync(filePath)) {
        return res.status(404).send("Backup file not found.");
      }
      res.download(filePath, filename);
    } catch (err) {
      res.status(500).send("Error downloading file.");
    }
  });
  
  // 1. Get complete clinic database (to fetch config, patients, records)
  app.get("/api/database", (req, res) => {
    try {
      const db = readDb();
      res.json(db);
    } catch (err) {
      res.status(500).json({ error: "Failed to read database state." });
    }
  });

  // Auth: Log in a user
  app.post("/api/auth/login", (req, res) => {
    try {
      const { username, password, role } = req.body;
      if (!username || !password || !role) {
        return res.status(400).json({ error: "Username, password, and role are required." });
      }

      const db = readDb();
      const user = db.users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.role === role);
      if (!user) {
        return res.status(401).json({ error: `Invalid credentials for role ${role}.` });
      }

      if (user.password !== password) {
        return res.status(401).json({ error: "Incorrect password." });
      }

      // Return user details upon success
      res.json({
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role
      });
    } catch (err) {
      res.status(500).json({ error: "Authentication failed." });
    }
  });

  // Get users
  app.get("/api/users", (req, res) => {
    try {
      const db = readDb();
      res.json(db.users.map(u => ({ id: u.id, username: u.username, name: u.name, role: u.role, createdAt: u.createdAt })));
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch users." });
    }
  });

  // Register user
  app.post("/api/users", (req, res) => {
    try {
      const { username, password, name, role } = req.body;
      if (!username || !password || !name || !role) {
        return res.status(400).json({ error: "Username, password, name, and role are required." });
      }

      const db = readDb();
      const exists = db.users.some(u => u.username.toLowerCase() === username.toLowerCase());
      if (exists) {
        return res.status(400).json({ error: `User with username '${username}' already exists.` });
      }

      const newUser = {
        id: `u_${Math.floor(1000 + Math.random() * 9000)}`,
        username,
        password,
        name,
        role,
        createdAt: new Date().toISOString()
      };

      db.users.push(newUser);
      writeDb(db);

      res.status(201).json({
        id: newUser.id,
        username: newUser.username,
        name: newUser.name,
        role: newUser.role,
        createdAt: newUser.createdAt
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to register user." });
    }
  });

  // Update user
  app.put("/api/users/:userId", (req, res) => {
    try {
      const { userId } = req.params;
      const { name, username, role, password } = req.body;

      const db = readDb();
      const user = db.users.find(u => u.id === userId);
      if (!user) {
        return res.status(404).json({ error: "Staff member not found." });
      }

      if (username && username.toLowerCase() !== user.username.toLowerCase()) {
        const usernameExists = db.users.some(u => u.id !== userId && u.username.toLowerCase() === username.toLowerCase());
        if (usernameExists) {
          return res.status(400).json({ error: `Username '${username}' is already in use.` });
        }
        user.username = username;
      }

      if (name) user.name = name;
      if (role) user.role = role;
      if (password && password.trim()) user.password = password;

      writeDb(db);
      res.json({
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to update staff user." });
    }
  });

  // Deregister staff
  app.delete("/api/users/:userId", (req, res) => {
    try {
      const { userId } = req.params;
      const db = readDb();
      const index = db.users.findIndex(u => u.id === userId);
      if (index === -1) {
        return res.status(404).json({ error: "Staff member not found." });
      }
      const user = db.users[index];
      if (user.username === "admin" && user.role === "Admin") {
        return res.status(400).json({ error: "Cannot deregister the default administrator." });
      }
      db.users.splice(index, 1);
      writeDb(db);
      res.json({ success: true, message: "Staff member successfully deregistered." });
    } catch (err) {
      res.status(500).json({ error: "Failed to deregister staff." });
    }
  });

  // Change password for a user
  app.post("/api/auth/change-password", (req, res) => {
    try {
      const { userId, currentPassword, newPassword } = req.body;
      if (!userId || !currentPassword || !newPassword) {
        return res.status(400).json({ error: "User ID, current password, and new password are required." });
      }
      const db = readDb();
      const user = db.users.find(u => u.id === userId);
      if (!user) {
        return res.status(404).json({ error: "User not found." });
      }
      if (user.password !== currentPassword) {
        return res.status(400).json({ error: "Incorrect current password." });
      }
      user.password = newPassword;
      writeDb(db);
      res.json({ success: true, message: "Password updated successfully." });
    } catch (err) {
      res.status(500).json({ error: "Failed to update password." });
    }
  });

  // Pharmacist Extra Clinical Service or Injection
  app.post("/api/records/pharmacist-service", (req, res) => {
    try {
      const { patientId, serviceId, notes, cost, staffMember } = req.body;
      if (!patientId || !serviceId) {
        return res.status(400).json({ error: "Patient ID and Service ID are required." });
      }

      const db = readDb();
      const patient = db.patients.find(p => p.id === patientId);
      if (!patient) {
        return res.status(404).json({ error: "Patient not found." });
      }

      const matchingSrv = db.extraServices.find(s => s.id === serviceId);
      if (!matchingSrv) {
        return res.status(404).json({ error: "Selected service not found." });
      }

      const recordId = `REC-${Math.floor(1000 + Math.random() * 9000)}`;
      const newRecord: ClinicRecord = {
        id: recordId,
        patientId,
        date: new Date().toISOString(),
        symptoms: `Clinical Service: ${matchingSrv.name}`,
        ailment: matchingSrv.name,
        notes: notes || "",
        staffMember: staffMember || "Pharmacist",
        extraServices: [
          {
            serviceId,
            name: matchingSrv.name,
            cost: cost !== undefined && cost !== null && cost !== "" ? Number(cost) : (matchingSrv.cost || 0),
            status: "completed",
            administeredBy: staffMember || "Pharmacist",
            administeredAt: new Date().toISOString(),
            notes: notes || ""
          }
        ],
        labStatus: "none",
        prescriptionStatus: "none"
      };

      db.records.unshift(newRecord);
      writeDb(db);
      res.status(201).json(newRecord);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to save clinical service." });
    }
  });

  // Update status of a clinical service within a record (e.g. mark doctor-ordered service as completed)
  app.post("/api/records/:recordId/service-status", (req, res) => {
    try {
      const { recordId } = req.params;
      const { serviceId, status, administeredBy, notes } = req.body;

      const db = readDb();
      const recIndex = db.records.findIndex(r => r.id === recordId);
      if (recIndex === -1) {
        return res.status(404).json({ error: "Clinical record not found." });
      }

      const record = db.records[recIndex];
      if (!record.extraServices || record.extraServices.length === 0) {
        return res.status(404).json({ error: "No clinical services found for this record." });
      }

      const srvIndex = record.extraServices.findIndex(s => s.serviceId === serviceId || (s as any).id === serviceId);
      if (srvIndex !== -1) {
        record.extraServices[srvIndex] = {
          ...record.extraServices[srvIndex],
          status: status || "completed",
          administeredBy: administeredBy || "Pharmacist",
          administeredAt: new Date().toISOString(),
          notes: notes || record.extraServices[srvIndex].notes || ""
        };
      } else {
        // If not matched by ID, update the first pending service
        const pendingSrv = record.extraServices.find(s => s.status !== "completed");
        if (pendingSrv) {
          pendingSrv.status = status || "completed";
          pendingSrv.administeredBy = administeredBy || "Pharmacist";
          pendingSrv.administeredAt = new Date().toISOString();
          if (notes) pendingSrv.notes = notes;
        }
      }

      writeDb(db);
      res.json(record);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to update service administration status." });
    }
  });

  // 2. Register a new Patient
  app.post("/api/patients", (req, res) => {
    try {
      const { id, name, phone, sex, maritalStatus, age, bloodGroup, dob, isUnderage, parentName, parentPhone } = req.body;
      
      const effectivePhone = phone || parentPhone;
      if (!name || !effectivePhone || !sex || age === undefined || age === null || age === "") {
        return res.status(400).json({ error: "Patient name, phone number, sex, and age are required." });
      }

      const db = readDb();

      // If patient ID is omitted or blank, auto-generate a unique patient ID
      let finalId = id ? String(id).trim() : "";
      if (!finalId) {
        finalId = `P-${Math.floor(100000 + Math.random() * 900000)}`;
      } else {
        const exists = db.patients.some(p => p.id === finalId);
        if (exists) {
          return res.status(400).json({ error: `Patient with ID '${finalId}' already exists.` });
        }
      }

      const newPatient: Patient = {
        id: finalId,
        name: name.trim(),
        phone: effectivePhone.trim(),
        sex,
        maritalStatus: maritalStatus || "Single",
        age: Number(age),
        bloodGroup: bloodGroup || "Unspecified",
        dob: dob || undefined,
        isUnderage: Boolean(isUnderage),
        parentName: parentName ? parentName.trim() : undefined,
        parentPhone: parentPhone ? parentPhone.trim() : undefined,
        createdAt: new Date().toISOString()
      };

      db.patients.unshift(newPatient); // Add newest first
      writeDb(db);

      res.status(201).json(newPatient);
    } catch (err) {
      res.status(500).json({ error: "Failed to register patient." });
    }
  });

  // Update existing patient details
  app.put("/api/patients/:patientId", (req, res) => {
    try {
      const { patientId } = req.params;
      const { name, phone, sex, maritalStatus, age, bloodGroup, dob, isUnderage, parentName, parentPhone } = req.body;

      const db = readDb();
      const patient = db.patients.find(p => p.id === patientId);
      if (!patient) {
        return res.status(404).json({ error: "Patient record not found." });
      }

      if (name) patient.name = name.trim();
      const effectivePhone = phone || parentPhone;
      if (effectivePhone) patient.phone = effectivePhone.trim();
      if (sex) patient.sex = sex;
      if (maritalStatus) patient.maritalStatus = maritalStatus;
      if (age !== undefined && age !== null && age !== "") patient.age = Number(age);
      if (bloodGroup !== undefined) patient.bloodGroup = bloodGroup;
      if (dob !== undefined) patient.dob = dob || undefined;
      if (isUnderage !== undefined) patient.isUnderage = Boolean(isUnderage);
      if (parentName !== undefined) patient.parentName = parentName ? parentName.trim() : undefined;
      if (parentPhone !== undefined) patient.parentPhone = parentPhone ? parentPhone.trim() : undefined;

      writeDb(db);
      res.json(patient);
    } catch (err) {
      res.status(500).json({ error: "Failed to update patient details." });
    }
  });

  // Delete patient record
  app.delete("/api/patients/:patientId", (req, res) => {
    try {
      const { patientId } = req.params;
      const db = readDb();
      const index = db.patients.findIndex(p => p.id === patientId);
      if (index === -1) {
        return res.status(404).json({ error: "Patient record not found." });
      }
      db.patients.splice(index, 1);
      // Clean up records associated with deleted patient or keep for archive?
      db.records = db.records.filter(r => r.patientId !== patientId);
      writeDb(db);
      res.json({ message: "Patient record removed successfully." });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete patient record." });
    }
  });

  // 3. Create a consultation record (starts as doctor consult, possibly with triage info)
  app.post("/api/records", (req, res) => {
    try {
      const { patientId, triage, symptoms, ailment, extraServices, labTestIds, prescriptionMedications, prescriptionDoctorNotes } = req.body;
      
      if (!patientId) {
        return res.status(400).json({ error: "Patient ID is required." });
      }

      const db = readDb();
      const patientExists = db.patients.some(p => p.id === patientId);
      if (!patientExists) {
        return res.status(404).json({ error: "Patient not found." });
      }

      const recordId = `REC-${Math.floor(1000 + Math.random() * 9000)}`;
      
      // Map extra services
      const formattedServices = Array.isArray(extraServices) ? extraServices.map((item: any) => {
        const isObj = typeof item === "object" && item !== null;
        const id = isObj ? item.serviceId : item;
        const enteredCost = isObj && typeof item.cost !== "undefined" ? Number(item.cost) : undefined;
        
        const matchingSrv = db.extraServices.find(s => s.id === id);
        return {
          serviceId: id,
          name: matchingSrv ? matchingSrv.name : id,
          cost: enteredCost !== undefined ? enteredCost : ((matchingSrv && typeof matchingSrv.cost !== "undefined") ? matchingSrv.cost : 0)
        };
      }) : [];

      // Determine lab status
      const hasLab = Array.isArray(labTestIds) && labTestIds.length > 0;
      const labStatus = hasLab ? "pending" : "none";
      const labRequest = hasLab ? {
        testIds: labTestIds,
        requestedAt: new Date().toISOString()
      } : undefined;

      // Determine prescription status
      const hasPrescription = Array.isArray(prescriptionMedications) && prescriptionMedications.length > 0;
      const prescriptionStatus = hasPrescription ? "pending" : "none";
      const prescription = hasPrescription ? {
        medications: prescriptionMedications.map((m: any) => ({
          name: m.name,
          dosage: m.dosage,
          qtyRequested: Number(m.qtyRequested),
          qtyDispatched: 0
        })),
        prescribedAt: new Date().toISOString(),
        doctorNotes: prescriptionDoctorNotes || ""
      } : undefined;

      const newRecord: ClinicRecord = {
        id: recordId,
        patientId,
        date: new Date().toISOString(),
        triage: triage ? {
          ...triage,
          recordedAt: new Date().toISOString()
        } : undefined,
        symptoms: symptoms || "Routine checkup/consultation requested",
        ailment: ailment || "Under investigation",
        extraServices: formattedServices,
        labStatus,
        labRequest,
        prescriptionStatus,
        prescription
      };

      db.records.unshift(newRecord); // Store new clinical record
      writeDb(db);

      res.status(201).json(newRecord);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to create consultation record." });
    }
  });

  // 4. Update Triage details on an existing record
  app.post("/api/records/:recordId/triage", (req, res) => {
    try {
      const { recordId } = req.params;
      const triageData = req.body;

      const db = readDb();
      const recIndex = db.records.findIndex(r => r.id === recordId);
      if (recIndex === -1) {
        return res.status(404).json({ error: "Consultation record not found." });
      }

      db.records[recIndex].triage = {
        temperature: Number(triageData.temperature),
        systolicBP: Number(triageData.systolicBP),
        diastolicBP: Number(triageData.diastolicBP),
        pulseRate: Number(triageData.pulseRate),
        oxygenSaturation: Number(triageData.oxygenSaturation),
        weight: Number(triageData.weight),
        height: Number(triageData.height),
        recordedAt: new Date().toISOString()
      };

      writeDb(db);
      res.json(db.records[recIndex]);
    } catch (err) {
      res.status(500).json({ error: "Failed to save triage details." });
    }
  });

  // 5. Pathology Lab updates: Upload results for a pending request
  app.post("/api/records/:recordId/lab-result", (req, res) => {
    try {
      const { recordId } = req.params;
      const { results, notes, technicianId } = req.body;

      if (!Array.isArray(results)) {
        return res.status(400).json({ error: "Valid results array is required." });
      }

      const db = readDb();
      const recIndex = db.records.findIndex(r => r.id === recordId);
      if (recIndex === -1) {
        return res.status(404).json({ error: "Clinical record not found." });
      }

      const record = db.records[recIndex];
      if (!record.labRequest) {
        return res.status(400).json({ error: "No laboratory request exists for this record." });
      }

      record.labStatus = "completed";
      record.labRequest.completedAt = new Date().toISOString();
      record.labRequest.results = results.map(r => ({
        parameterId: r.parameterId,
        parameterName: r.parameterName,
        value: String(r.value),
        unit: r.unit,
        normalRange: r.normalRange
      }));
      record.labRequest.notes = notes || "";
      record.labRequest.technicianId = technicianId || "LAB-TECH";

      writeDb(db);
      res.json(record);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to submit lab results." });
    }
  });

  // 6. Doctor Consultation update: Writes report & prescription after lab results
  app.post("/api/records/:recordId/report-prescription", (req, res) => {
    try {
      const { recordId } = req.params;
      const { ailment, symptoms, prescriptionMedications, extraServices, prescriptionDoctorNotes } = req.body;

      const db = readDb();
      const recIndex = db.records.findIndex(r => r.id === recordId);
      if (recIndex === -1) {
        return res.status(404).json({ error: "Clinical record not found." });
      }

      const record = db.records[recIndex];
      
      // Update ailment & doctor report
      if (ailment) record.ailment = ailment;
      if (symptoms) record.symptoms = symptoms;

      // Update extra services if selected after lab
      if (Array.isArray(extraServices)) {
        record.extraServices = extraServices.map((item: any) => {
          const isObj = typeof item === "object" && item !== null;
          const id = isObj ? item.serviceId : item;
          const enteredCost = isObj && typeof item.cost !== "undefined" ? Number(item.cost) : undefined;

          const matchingSrv = db.extraServices.find(s => s.id === id);
          return {
            serviceId: id,
            name: matchingSrv ? matchingSrv.name : id,
            cost: enteredCost !== undefined ? enteredCost : ((matchingSrv && typeof matchingSrv.cost !== "undefined") ? matchingSrv.cost : 0)
          };
        });
      }

      // Add prescription
      if (Array.isArray(prescriptionMedications) && prescriptionMedications.length > 0) {
        record.prescriptionStatus = "pending";
        record.prescription = {
          medications: prescriptionMedications.map((m: any) => ({
            name: m.name,
            dosage: m.dosage,
            qtyRequested: Number(m.qtyRequested),
            qtyDispatched: 0
          })),
          prescribedAt: new Date().toISOString(),
          doctorNotes: prescriptionDoctorNotes || ""
        };
      }

      writeDb(db);
      res.json(record);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to finalize report/prescription." });
    }
  });

  // 6.5 Doctor Dispensing Notes Update: Updates doctor dispensing remarks on past clinical history
  app.put("/api/records/:recordId/doctor-notes", (req, res) => {
    try {
      const { recordId } = req.params;
      const { doctorNotes } = req.body;

      const db = readDb();
      const recIndex = db.records.findIndex(r => r.id === recordId);
      if (recIndex === -1) {
        return res.status(404).json({ error: "Clinical record not found." });
      }

      const record = db.records[recIndex];
      if (!record.prescription) {
        record.prescription = {
          medications: [],
          prescribedAt: new Date().toISOString(),
          doctorNotes: doctorNotes || ""
        };
      } else {
        record.prescription.doctorNotes = doctorNotes || "";
      }

      writeDb(db);
      res.json(record);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to update doctor dispensing remarks." });
    }
  });

  // 7. Pharmacist Dispensing Update
  app.post("/api/records/:recordId/dispense", (req, res) => {
    try {
      const { recordId } = req.params;
      const { medications, pharmacistNotes, pharmacistName } = req.body;

      if (!Array.isArray(medications)) {
        return res.status(400).json({ error: "Medications array is required." });
      }

      const db = readDb();
      const recIndex = db.records.findIndex(r => r.id === recordId);
      if (recIndex === -1) {
        return res.status(404).json({ error: "Clinical record not found." });
      }

      const record = db.records[recIndex];
      if (!record.prescription) {
        return res.status(400).json({ error: "No prescription exists for this record." });
      }

      // Initialize dispenseHistory array if it doesn't exist
      if (!record.prescription.dispenseHistory) {
        record.prescription.dispenseHistory = [];
      }

      // Update each medication's dispatched amount
      let allFullyDispatched = true;
      let anyDispatched = false;
      
      record.prescription.medications = record.prescription.medications.map(origMed => {
        const updateMed = medications.find(m => m.name === origMed.name);
        
        // Supports both legacy full-replace payload and new incremental payload:
        let qtyDispensedNow = 0;
        if (updateMed) {
          if (typeof updateMed.qtyDispensedNow !== "undefined") {
            qtyDispensedNow = Number(updateMed.qtyDispensedNow);
          } else if (typeof updateMed.qtyDispatched !== "undefined") {
            // fallback for legacy
            qtyDispensedNow = Number(updateMed.qtyDispatched) - (origMed.qtyDispatched || 0);
          }
        }

        const prevDispatched = origMed.qtyDispatched || 0;
        const newDispatched = Math.min(origMed.qtyRequested, prevDispatched + qtyDispensedNow);

        if (qtyDispensedNow > 0) {
          anyDispatched = true;
          // Record history session
          record.prescription.dispenseHistory!.push({
            date: new Date().toISOString(),
            medicationName: origMed.name,
            qtyDispensed: qtyDispensedNow,
            remainingBalance: origMed.qtyRequested - newDispatched,
            pharmacistName: pharmacistName || "Pharmacist"
          });
        }

        if (newDispatched > 0) {
          anyDispatched = true;
        }

        if (newDispatched < origMed.qtyRequested) {
          allFullyDispatched = false;
        }

        return {
          ...origMed,
          qtyDispatched: newDispatched
        };
      });

      record.prescriptionStatus = allFullyDispatched ? "fully_dispatched" : (anyDispatched ? "partially_dispatched" : "pending");
      record.prescription.dispatchedAt = new Date().toISOString();
      record.prescription.pharmacistNotes = pharmacistNotes || "";

      writeDb(db);
      res.json(record);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to complete dispensing process." });
    }
  });

  // 8. Configuration paths
  
  // Add Pathology Category
  app.post("/api/config/category", (req, res) => {
    try {
      const { name, description } = req.body;
      if (!name) return res.status(400).json({ error: "Category name is required." });

      const db = readDb();
      const id = `cat_${Math.floor(100 + Math.random() * 900)}`;
      const newCat: PathologyCategory = { id, name, description: description || "" };

      db.categories.push(newCat);
      writeDb(db);
      res.status(201).json(newCat);
    } catch (err) {
      res.status(500).json({ error: "Failed to create category." });
    }
  });

  // Edit Pathology Category
  app.put("/api/config/category/:id", (req, res) => {
    try {
      const { id } = req.params;
      const { name, description } = req.body;
      if (!name) return res.status(400).json({ error: "Category name is required." });

      const db = readDb();
      const index = db.categories.findIndex(c => c.id === id);
      if (index === -1) return res.status(404).json({ error: "Category not found." });

      db.categories[index] = {
        ...db.categories[index],
        name,
        description: description || ""
      };

      writeDb(db);
      res.json(db.categories[index]);
    } catch (err) {
      res.status(500).json({ error: "Failed to update category." });
    }
  });

  // Delete Pathology Category
  app.delete("/api/config/category/:id", (req, res) => {
    try {
      const { id } = req.params;
      const db = readDb();
      const index = db.categories.findIndex(c => c.id === id);
      if (index === -1) return res.status(404).json({ error: "Category not found." });

      // Safety check: is it referenced by parameters or tests?
      const isReferenced = db.parameters.some(p => p.categoryId === id) || db.tests.some(t => t.categoryId === id);
      if (isReferenced) {
        return res.status(400).json({ error: "Cannot delete category. It is currently referenced by some pathology parameters or tests." });
      }

      db.categories.splice(index, 1);
      writeDb(db);
      res.json({ success: true, message: "Category deleted successfully." });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete category." });
    }
  });

  // Add Pathology Unit
  app.post("/api/config/unit", (req, res) => {
    try {
      const { name, description } = req.body;
      if (!name) return res.status(400).json({ error: "Unit name is required." });

      const db = readDb();
      const id = `u_${Math.floor(100 + Math.random() * 900)}`;
      const newUnit: PathologyUnit = { id, name, description: description || "" };

      db.units.push(newUnit);
      writeDb(db);
      res.status(201).json(newUnit);
    } catch (err) {
      res.status(500).json({ error: "Failed to create unit." });
    }
  });

  // Edit Pathology Unit
  app.put("/api/config/unit/:id", (req, res) => {
    try {
      const { id } = req.params;
      const { name, description } = req.body;
      if (!name) return res.status(400).json({ error: "Unit name is required." });

      const db = readDb();
      const index = db.units.findIndex(u => u.id === id);
      if (index === -1) return res.status(404).json({ error: "Unit not found." });

      db.units[index] = {
        ...db.units[index],
        name,
        description: description || ""
      };

      writeDb(db);
      res.json(db.units[index]);
    } catch (err) {
      res.status(500).json({ error: "Failed to update unit." });
    }
  });

  // Delete Pathology Unit
  app.delete("/api/config/unit/:id", (req, res) => {
    try {
      const { id } = req.params;
      const db = readDb();
      const index = db.units.findIndex(u => u.id === id);
      if (index === -1) return res.status(404).json({ error: "Unit not found." });

      const isReferenced = db.parameters.some(p => p.unitId === id);
      if (isReferenced) {
        return res.status(400).json({ error: "Cannot delete unit. It is currently referenced by one or more pathology parameters." });
      }

      db.units.splice(index, 1);
      writeDb(db);
      res.json({ success: true, message: "Measurement unit deleted successfully." });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete unit." });
    }
  });

  // Add Pathology Parameter
  app.post("/api/config/parameter", (req, res) => {
    try {
      const { name, unitId, categoryId, normalRange } = req.body;
      if (!name || !unitId || !categoryId || !normalRange) {
        return res.status(400).json({ error: "Name, unitId, categoryId, and normalRange are required." });
      }

      const db = readDb();
      const id = `param_${Math.floor(100 + Math.random() * 900)}`;
      const newParam: PathologyParameter = { id, name, unitId, categoryId, normalRange };

      db.parameters.push(newParam);
      writeDb(db);
      res.status(201).json(newParam);
    } catch (err) {
      res.status(500).json({ error: "Failed to create parameter." });
    }
  });

  // Edit Pathology Parameter
  app.put("/api/config/parameter/:id", (req, res) => {
    try {
      const { id } = req.params;
      const { name, unitId, categoryId, normalRange } = req.body;
      if (!name || !unitId || !categoryId) {
        return res.status(400).json({ error: "Name, unit, and category are required." });
      }

      const db = readDb();
      const index = db.parameters.findIndex(p => p.id === id);
      if (index === -1) return res.status(404).json({ error: "Parameter not found." });

      db.parameters[index] = {
        id,
        name,
        unitId,
        categoryId,
        normalRange: normalRange || ""
      };

      writeDb(db);
      res.json(db.parameters[index]);
    } catch (err) {
      res.status(500).json({ error: "Failed to update parameter." });
    }
  });

  // Delete Pathology Parameter
  app.delete("/api/config/parameter/:id", (req, res) => {
    try {
      const { id } = req.params;
      const db = readDb();
      const index = db.parameters.findIndex(p => p.id === id);
      if (index === -1) return res.status(404).json({ error: "Parameter not found." });

      const isReferenced = db.tests.some(t => t.parameterIds.includes(id));
      if (isReferenced) {
        return res.status(400).json({ error: "Cannot delete parameter. It is included in one or more pathology test suites." });
      }

      db.parameters.splice(index, 1);
      writeDb(db);
      res.json({ success: true, message: "Pathology parameter deleted successfully." });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete parameter." });
    }
  });

  // Add Pathology Test with costing
  app.post("/api/config/test", (req, res) => {
    try {
      const { name, categoryId, parameterIds, cost } = req.body;
      if (!name || !categoryId) {
        return res.status(400).json({ error: "Test name and category are required." });
      }

      const db = readDb();
      const id = `test_${Math.floor(100 + Math.random() * 900)}`;
      const parsedCost = cost !== undefined && cost !== null && cost !== "" ? Number(cost) : 0;
      const newTest: PathologyTest = { 
        id, 
        name, 
        categoryId, 
        parameterIds: Array.isArray(parameterIds) ? parameterIds : [], 
        cost: parsedCost 
      };

      db.tests.push(newTest);
      writeDb(db);
      res.status(201).json(newTest);
    } catch (err) {
      res.status(500).json({ error: "Failed to create pathology test." });
    }
  });

  // Edit Pathology Test
  app.put("/api/config/test/:id", (req, res) => {
    try {
      const { id } = req.params;
      const { name, categoryId, parameterIds, cost } = req.body;
      if (!name || !categoryId) {
        return res.status(400).json({ error: "Test name and category are required." });
      }

      const db = readDb();
      const index = db.tests.findIndex(t => t.id === id);
      if (index === -1) return res.status(404).json({ error: "Pathology test not found." });

      const parsedCost = cost !== undefined && cost !== null && cost !== "" ? Number(cost) : 0;
      db.tests[index] = {
        id,
        name,
        categoryId,
        parameterIds: Array.isArray(parameterIds) ? parameterIds : [],
        cost: parsedCost
      };

      writeDb(db);
      res.json(db.tests[index]);
    } catch (err) {
      res.status(500).json({ error: "Failed to update pathology test." });
    }
  });

  // Delete Pathology Test
  app.delete("/api/config/test/:id", (req, res) => {
    try {
      const { id } = req.params;
      const db = readDb();
      const index = db.tests.findIndex(t => t.id === id);
      if (index === -1) return res.status(404).json({ error: "Pathology test not found." });

      db.tests.splice(index, 1);
      writeDb(db);
      res.json({ success: true, message: "Pathology test deleted successfully." });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete pathology test." });
    }
  });

  // Export / Backup Database
  app.get("/api/admin/export-db", (req, res) => {
    try {
      const db = readDb();
      const filename = `clinic_database_backup_${new Date().toISOString().split("T")[0]}.json`;
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(JSON.stringify(db, null, 2));
    } catch (err) {
      res.status(500).json({ error: "Failed to export database." });
    }
  });

  // Import / Restore Database
  app.post("/api/admin/import-db", async (req, res) => {
    try {
      const rawData = req.body;
      if (!rawData || typeof rawData !== "object") {
        return res.status(400).json({ error: "Invalid backup file: Payload is empty or not a valid JSON object." });
      }

      // Automatically create a pre-restore backup copy before modifying database state
      const currentDb = readDb();
      const nowIso = new Date().toISOString().replace(/[:.]/g, "-");
      const safetyFilename = `pre-restore-safety-${nowIso}.json`;
      
      try {
        ensureBackupDir();
        const safetyPayload = {
          meta: {
            id: `bk_safety_${Date.now()}`,
            filename: safetyFilename,
            type: "safety",
            createdAt: new Date().toISOString(),
            patientCount: currentDb.patients?.length || 0,
            recordCount: currentDb.records?.length || 0,
            userCount: currentDb.users?.length || 0
          },
          database: currentDb
        };
        fs.writeFileSync(path.join(BACKUP_DIR, safetyFilename), JSON.stringify(safetyPayload, null, 2), "utf-8");
        await persistBackupToFirestore(safetyFilename, safetyPayload);
        console.log(`[Safety Backup Created]: ${safetyFilename}`);
      } catch (backupErr) {
        console.error("Failed to write pre-restore safety backup snapshot", backupErr);
      }

      // Extract nested wrapper if present (e.g. { database: ... }, { db: ... }, { data: ... }, { clinic: ... }, { main_state: ... })
      let target: any = rawData;
      if (rawData.database && typeof rawData.database === "object" && !Array.isArray(rawData.database)) target = rawData.database;
      else if (rawData.db && typeof rawData.db === "object" && !Array.isArray(rawData.db)) target = rawData.db;
      else if (rawData.data && typeof rawData.data === "object" && !Array.isArray(rawData.data)) target = rawData.data;
      else if (rawData.clinic && typeof rawData.clinic === "object" && !Array.isArray(rawData.clinic)) target = rawData.clinic;
      else if (rawData.main_state && typeof rawData.main_state === "object" && !Array.isArray(rawData.main_state)) target = rawData.main_state;
      else if (Array.isArray(rawData)) {
        if (rawData.length > 0 && (rawData[0].phone !== undefined || rawData[0].age !== undefined || rawData[0].sex !== undefined)) {
          target = { patients: rawData };
        } else if (rawData.length > 0 && (rawData[0].patientId !== undefined || rawData[0].symptoms !== undefined || rawData[0].diagnosis !== undefined)) {
          target = { records: rawData };
        }
      }

      const initial = getInitialDatabase();
      const mode = rawData.mode === "merge" ? "merge" : "replace"; // Default to replace/restore full DB state unless explicit merge

      let finalPatients: Patient[] = Array.isArray(target.patients) ? target.patients : (mode === "merge" ? currentDb.patients : []);
      let finalRecords: ClinicRecord[] = Array.isArray(target.records) ? target.records : (mode === "merge" ? currentDb.records : []);

      if (mode === "merge") {
        // Smart merge: keep existing patients, append or update with imported ones
        const patientMap = new Map<string, Patient>();
        currentDb.patients.forEach(p => patientMap.set(p.id, p));
        if (Array.isArray(target.patients)) {
          target.patients.forEach((p: Patient) => {
            patientMap.set(p.id, { ...(patientMap.get(p.id) || {}), ...p });
          });
        }
        finalPatients = Array.from(patientMap.values());

        // Smart merge: keep existing records, append missing imported ones
        const recordMap = new Map<string, ClinicRecord>();
        currentDb.records.forEach(r => recordMap.set(r.id, r));
        if (Array.isArray(target.records)) {
          target.records.forEach((r: ClinicRecord) => {
            recordMap.set(r.id, { ...(recordMap.get(r.id) || {}), ...r });
          });
        }
        finalRecords = Array.from(recordMap.values());
      }

      // Handle users: ensure admin account exists
      let finalUsers: User[] = currentDb.users || initial.users;
      if (Array.isArray(target.users) && target.users.length > 0) {
        if (mode === "replace") {
          finalUsers = target.users;
        } else {
          const userMap = new Map<string, User>();
          currentDb.users.forEach(u => userMap.set(u.username, u));
          target.users.forEach((u: User) => userMap.set(u.username, u));
          finalUsers = Array.from(userMap.values());
        }
      }
      // Guarantee at least one admin exists
      if (!finalUsers.some(u => u.role === "Admin" || (u.role as string).toLowerCase() === "admin")) {
        const defaultAdmin = initial.users.find(u => u.role === "Admin");
        if (defaultAdmin) finalUsers.push(defaultAdmin);
      }

      const newDb: ClinicDatabase = {
        patients: finalPatients,
        records: finalRecords,
        categories: Array.isArray(target.categories) ? target.categories : (Array.isArray(target.testCategories) ? target.testCategories : (currentDb.categories || initial.categories)),
        units: Array.isArray(target.units) ? target.units : (Array.isArray(target.testUnits) ? target.testUnits : (currentDb.units || initial.units)),
        parameters: Array.isArray(target.parameters) ? target.parameters : (Array.isArray(target.testParameters) ? target.testParameters : (currentDb.parameters || initial.parameters)),
        tests: Array.isArray(target.tests) ? target.tests : (currentDb.tests || initial.tests),
        extraServices: Array.isArray(target.extraServices) ? target.extraServices : (currentDb.extraServices || initial.extraServices),
        users: finalUsers,
      };

      writeDb(newDb);

      // Also archive the uploaded snapshot in the backups list
      try {
        const uploadedFilename = `uploaded-backup-${nowIso}.json`;
        const uploadedPayload = {
          meta: {
            id: `bk_upload_${Date.now()}`,
            filename: uploadedFilename,
            type: "manual",
            createdAt: new Date().toISOString(),
            patientCount: newDb.patients.length,
            recordCount: newDb.records.length,
            userCount: newDb.users.length
          },
          database: newDb
        };
        fs.writeFileSync(path.join(BACKUP_DIR, uploadedFilename), JSON.stringify(uploadedPayload, null, 2), "utf-8");
        await persistBackupToFirestore(uploadedFilename, uploadedPayload);
      } catch (err) {
        console.error("Failed archiving uploaded snapshot into backup directory", err);
      }

      res.json({ 
        success: true, 
        message: mode === "merge" ? "Database merged with imported file successfully." : "Database restored and replaced successfully.",
        totalPatients: newDb.patients.length,
        totalRecords: newDb.records.length,
        totalUsers: newDb.users.length,
        safetyBackup: safetyFilename
      });
    } catch (err: any) {
      console.error("Error importing DB:", err);
      res.status(500).json({ error: err.message || "Failed to import database file." });
    }
  });

  // Add Extra Service (e.g. stitching, dressing) with costing
  app.post("/api/config/extra-service", (req, res) => {
    try {
      const { name, cost, description } = req.body;
      if (!name) {
        return res.status(400).json({ error: "Service name is required." });
      }

      const db = readDb();
      const id = `srv_${Math.floor(100 + Math.random() * 900)}`;
      const parsedCost = cost !== undefined && cost !== null && cost !== "" ? Number(cost) : 0;
      const newSrv: ExtraService = { id, name, cost: parsedCost, description: description || "" };

      db.extraServices.push(newSrv);
      writeDb(db);
      res.status(201).json(newSrv);
    } catch (err) {
      res.status(500).json({ error: "Failed to add service." });
    }
  });

  // 9. Reset and reseed database
  app.post("/api/reset", async (req, res) => {
    try {
      ensureBackupDir();
      const currentDb = readDb();
      const nowIso = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `pre-reset-safety-${nowIso}.json`;
      const filePath = path.join(BACKUP_DIR, filename);
      const backupPayload = {
        meta: {
          id: `safety_${Date.now()}`,
          filename,
          type: "safety",
          createdAt: new Date().toISOString(),
          patientCount: currentDb.patients?.length || 0,
          recordCount: currentDb.records?.length || 0,
          userCount: currentDb.users?.length || 0,
        },
        database: currentDb
      };
      fs.writeFileSync(filePath, JSON.stringify(backupPayload, null, 2), "utf-8");
      await persistBackupToFirestore(filename, backupPayload);

      const initial = getInitialDatabase();
      writeDb(initial);
      res.json({ status: "success", message: "Database reseeded to default demo state successfully. A safety snapshot was archived in Backups." });
    } catch (err) {
      res.status(500).json({ error: "Failed to reseed database." });
    }
  });

  // Vite development middleware vs Static serve
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Clinic Server running on http://localhost:${PORT}`);
    
    // Background cloud synchronization
    loadDbFromFirestore()
      .then(() => {
        // Run daily auto backup check once Firestore sync finishes
        return runDailyAutoBackup();
      })
      .catch((err) => {
        console.error("Background Firestore sync error:", err);
      });

    // Hourly backup check timer
    setInterval(() => {
      runDailyAutoBackup().catch((err) => {
        console.error("[Auto Backup Timer] Error:", err);
      });
    }, 60 * 60 * 1000);
  });
}

startServer();
