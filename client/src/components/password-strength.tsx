import React from "react";
import { Check, X, Shield, ShieldCheck, ShieldAlert } from "lucide-react";

export interface PasswordRule {
  id: string;
  label: string;
  test: (password: string) => boolean;
  required?: boolean;
}

export const PASSWORD_RULES: PasswordRule[] = [
  {
    id: "length",
    label: "At least 8 characters",
    test: (p) => p.length >= 8,
    required: true,
  },
  {
    id: "lowercase",
    label: "One lowercase letter (a-z)",
    test: (p) => /[a-z]/.test(p),
    required: true,
  },
  {
    id: "uppercase",
    label: "One uppercase letter (A-Z)",
    test: (p) => /[A-Z]/.test(p),
    required: true,
  },
  {
    id: "number",
    label: "One number (0-9)",
    test: (p) => /[0-9]/.test(p),
    required: true,
  },
  {
    id: "special",
    label: "One special character (!@#$%...)",
    test: (p) => /[^A-Za-z0-9]/.test(p),
    required: false,
  },
];

export function evaluatePassword(password: string) {
  const lengthValid = password.length >= 8;
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  // Mandatory requirements: length >= 8, uppercase, lowercase, and (number OR special)
  const isSatisfied = lengthValid && hasLower && hasUpper && (hasNumber || hasSpecial);

  let passedCount = 0;
  if (password.length >= 8) passedCount++;
  if (password.length >= 12) passedCount++;
  if (hasLower) passedCount++;
  if (hasUpper) passedCount++;
  if (hasNumber) passedCount++;
  if (hasSpecial) passedCount++;

  let level: "empty" | "weak" | "fair" | "good" | "strong" = "empty";
  let label = "Enter password";
  let color = "bg-slate-300";
  let textColor = "text-slate-500";
  let percent = 0;

  if (password.length === 0) {
    level = "empty";
    label = "Password strength";
    color = "bg-slate-200";
    textColor = "text-slate-400";
    percent = 0;
  } else if (passedCount <= 2 || !lengthValid) {
    level = "weak";
    label = "Weak password";
    color = "bg-rose-500";
    textColor = "text-rose-600";
    percent = 25;
  } else if (passedCount <= 3) {
    level = "fair";
    label = "Fair password";
    color = "bg-amber-500";
    textColor = "text-amber-700";
    percent = 50;
  } else if (passedCount <= 5) {
    level = "good";
    label = "Good password";
    color = "bg-emerald-500";
    textColor = "text-emerald-700";
    percent = 75;
  } else {
    level = "strong";
    label = "Strong password";
    color = "bg-emerald-600";
    textColor = "text-emerald-800";
    percent = 100;
  }

  return {
    isSatisfied,
    level,
    label,
    color,
    textColor,
    percent,
    passedCount,
    hasLower,
    hasUpper,
    hasNumber,
    hasSpecial,
    lengthValid,
  };
}

interface PasswordStrengthProps {
  password: string;
  showRequirements?: boolean;
}

export function PasswordStrengthIndicator({
  password,
  showRequirements = true,
}: PasswordStrengthProps) {
  if (!password) {
    return null;
  }

  const { isSatisfied, label, color, textColor, percent, lengthValid, hasLower, hasUpper, hasNumber, hasSpecial } =
    evaluatePassword(password);

  const checks = [
    { label: "8+ characters", passed: lengthValid, required: true },
    { label: "Lowercase letter (a-z)", passed: hasLower, required: true },
    { label: "Uppercase letter (A-Z)", passed: hasUpper, required: true },
    { label: "Number (0-9)", passed: hasNumber, required: true },
    { label: "Special symbol (!@#$...)", passed: hasSpecial, required: false },
  ];

  return (
    <div className="mt-2.5 space-y-2.5 rounded-xl bg-slate-50 border border-slate-200/90 p-3.5 text-xs">
      {/* Header bar with visual indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-medium">
          {isSatisfied ? (
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          ) : (
            <ShieldAlert className="w-4 h-4 text-amber-600" />
          )}
          <span className={textColor}>{label}</span>
        </div>
        <span className="text-[11px] text-slate-500 font-medium">{percent}% strong</span>
      </div>

      {/* Multi-segment strength bar */}
      <div className="grid grid-cols-4 gap-1.5 h-1.5 w-full bg-slate-200 rounded-full overflow-hidden p-0.5">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            percent >= 25 ? color : "bg-slate-200"
          }`}
        />
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            percent >= 50 ? color : "bg-slate-200"
          }`}
        />
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            percent >= 75 ? color : "bg-slate-200"
          }`}
        />
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            percent >= 100 ? color : "bg-slate-200"
          }`}
        />
      </div>

      {/* Detailed checklist */}
      {showRequirements && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-2 border-t border-slate-200/80">
          {checks.map((check, idx) => (
            <div
              key={idx}
              className={`flex items-center gap-1.5 text-[11px] transition-colors ${
                check.passed ? "text-emerald-800 font-medium" : "text-slate-500"
              }`}
            >
              <div
                className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 text-[10px] ${
                  check.passed
                    ? "bg-emerald-100 text-emerald-700 border border-emerald-300"
                    : "bg-slate-100 text-slate-400 border border-slate-200"
                }`}
              >
                {check.passed ? <Check className="w-2.5 h-2.5" /> : <X className="w-2.5 h-2.5" />}
              </div>
              <span>
                {check.label}
                {check.required && <span className="text-slate-400 ml-0.5">*</span>}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
