import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Stethoscope, FlaskConical, Pill, ShieldAlert, KeyRound, 
  User, Eye, EyeOff, CheckCircle2, AlertCircle, Heart, ClipboardEdit
} from "lucide-react";
import { loginUser } from "../utils/api";

interface LoginProps {
  onLoginSuccess: (user: { id: string; username: string; name: string; role: string }) => void;
}

type LoginRole = "Doctor" | "LabTech" | "Pharmacist" | "Receptionist" | "Admin";

export default function Login({ onLoginSuccess }: LoginProps) {
  const [activeRole, setActiveRole] = useState<LoginRole>("Doctor");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roleConfigs = {
    Doctor: {
      title: "MedCore Doctor Portal",
      subtitle: "Secure access for physicians & clinicians",
      icon: Stethoscope,
      bg: "from-blue-500 to-sky-600",
      accent: "text-blue-600",
      border: "border-blue-100",
      btnBg: "bg-blue-600 hover:bg-blue-700 focus:ring-blue-500"
    },
    LabTech: {
      title: "Pathology Lab Portal",
      subtitle: "Secure entry for Pathologists & Lab Technicians",
      icon: FlaskConical,
      bg: "from-emerald-500 to-teal-600",
      accent: "text-emerald-600",
      border: "border-emerald-100",
      btnBg: "bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500"
    },
    Pharmacist: {
      title: "Pharmacy Dispensation Hub",
      subtitle: "Secure access for registered pharmacists",
      icon: Pill,
      bg: "from-purple-500 to-indigo-600",
      accent: "text-purple-600",
      border: "border-purple-100",
      btnBg: "bg-purple-600 hover:bg-purple-700 focus:ring-purple-500"
    },
    Receptionist: {
      title: "Reception & Triage Center",
      subtitle: "Secure registration & patient check-in",
      icon: ClipboardEdit,
      bg: "from-amber-500 to-orange-600",
      accent: "text-amber-600",
      border: "border-amber-100",
      btnBg: "bg-amber-600 hover:bg-amber-700 focus:ring-amber-500"
    },
    Admin: {
      title: "ERP System Administration",
      subtitle: "Full clinic dashboard and configuration access",
      icon: ShieldAlert,
      bg: "from-slate-700 to-slate-900",
      accent: "text-slate-800",
      border: "border-slate-300",
      btnBg: "bg-slate-800 hover:bg-slate-900 focus:ring-slate-700"
    }
  };

  const activeConfig = roleConfigs[activeRole];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const user = await loginUser({ username, password, role: activeRole });
      onLoginSuccess(user);
    } catch (err: any) {
      setError(err.message || "Invalid username or password for the selected portal.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8" id="login-container">
      
      {/* Clinic Header Brand */}
      <div className="mb-8 text-center" id="clinic-logo-header">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-slate-100 shadow-sm text-xs font-semibold text-slate-700">
          <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500 animate-pulse" />
          <span>Jul Medicare ERP</span>
        </div>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Clinical Operations Gateway
        </h1>
        <p className="mt-1 text-xs text-slate-500 font-medium">
          Integrated Med-ERP • Republic of Kenya Standard of Care
        </p>
      </div>

      {/* Main Login Card */}
      <div className="w-full max-w-4xl bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden flex flex-col md:flex-row min-h-[500px]" id="login-card">
        
        {/* Left Interactive Sidebar: Separate Portals Selection */}
        <div className="w-full md:w-80 bg-slate-50 border-r border-slate-100 p-6 flex flex-col justify-between" id="portal-selector-sidebar">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">
              Select User Portal
            </h3>
            <div className="space-y-2">
              {(Object.keys(roleConfigs) as LoginRole[]).map((role) => {
                const conf = roleConfigs[role];
                const Icon = conf.icon;
                const isSelected = activeRole === role;
                return (
                  <button
                    key={role}
                    onClick={() => {
                      setActiveRole(role);
                      setError(null);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition font-medium text-xs border ${
                      isSelected 
                        ? "bg-white text-slate-900 shadow-sm font-semibold " + conf.border
                        : "bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 border-transparent"
                    }`}
                  >
                    <div className={`p-1.5 rounded-lg ${isSelected ? "bg-slate-50 text-slate-900" : "bg-slate-100/80 text-slate-500"}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span>{role === "LabTech" ? "Lab Tech Portal" : role + " Portal"}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-200/60 text-[10px] text-slate-400 font-semibold flex flex-col gap-1">
            <span>• Biometric SSO ready</span>
            <span>• Session logging active</span>
            <span>• IP: Restricted access</span>
          </div>
        </div>

        {/* Right Themed Login Screen */}
        <div className="flex-1 p-8 flex flex-col justify-center" id="portal-login-screen">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeRole}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* Dynamic Header */}
              <div>
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${activeConfig.bg} text-white flex items-center justify-center shadow-md mb-4`}>
                  {React.createElement(activeConfig.icon, { className: "w-6 h-6" })}
                </div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                  {activeConfig.title}
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  {activeConfig.subtitle}
                </p>
              </div>

              {/* Login Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-2 text-xs text-red-700" id="login-error-alert">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span className="font-medium">{error}</span>
                  </div>
                )}

                {/* Username */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1" htmlFor="username">
                    Username / ID No
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      id="username"
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder={`Enter ${activeRole.toLowerCase()} username`}
                      className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl text-xs placeholder-slate-400 bg-slate-50/50 hover:bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1" htmlFor="password">
                    Secure Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <KeyRound className="w-4 h-4" />
                    </div>
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="block w-full pl-10 pr-10 py-2.5 border border-slate-200 rounded-xl text-xs placeholder-slate-400 bg-slate-50/50 hover:bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-white font-bold text-xs shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 ${activeConfig.btnBg} ${
                    loading ? "opacity-75 cursor-not-allowed" : ""
                  }`}
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span>Log In to Account</span>
                  )}
                </button>
              </form>

            </motion.div>
          </AnimatePresence>
        </div>

      </div>

      {/* Trust & Regulations */}
      <div className="mt-8 text-center text-[10px] text-slate-400 font-medium max-w-md" id="login-footer">
        This portal accesses Jul Medicare ERP medical records network. Unauthorised access is prohibited under the Health Act, Laws of Kenya. All transactions are logged with digital signatures.
      </div>

    </div>
  );
}
