import { Shield, AlertTriangle, Lock, FileCheck, ShieldCheck } from "lucide-react";

export function UserLegalTab() {
  return (
    <div className="space-y-6 w-full max-w-5xl">
      <div className="bg-white border border-[#E5EAE7] rounded-xl p-6 shadow-xs space-y-6">
        <div>
          <h2 className="text-xl font-bold text-[#0F172A] flex items-center gap-2.5 tracking-tight">
            <div className="w-8 h-8 rounded-lg bg-[#E6F2ED] border border-[#CCE5DB] flex items-center justify-center text-[#0A5C48]">
              <Shield className="h-4 w-4" />
            </div>
            Legal, Terms & Privacy Architecture
          </h2>
          <p className="text-xs text-[#64748B] mt-1">
            Understanding privacy commitments and user responsibility
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-[#F7FAF8] border border-[#E0E9E4] p-5 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-amber-700 font-bold text-xs">
              <AlertTriangle className="h-4 w-4" />
              User Liability & Responsibility
            </div>
            <p className="text-xs text-[#64748B] leading-relaxed">
              You are solely responsible for how you configure routing targets and verify compliance with local advertising networks, privacy frameworks (GDPR, CCPA), and consumer protection regulations in your jurisdiction.
            </p>
          </div>

          <div className="bg-[#F7FAF8] border border-[#E0E9E4] p-5 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-[#0A5C48] font-bold text-xs">
              <Lock className="h-4 w-4" />
              Zero-PII Privacy Protection
            </div>
            <p className="text-xs text-[#64748B] leading-relaxed">
              We do not persist visitor personal identities or email addresses in database logs. Logs retain aggregated ASN classification and country metrics only, maintaining high data minimization standards.
            </p>
          </div>
        </div>

        <div className="bg-[#F7FAF8] border border-[#E0E9E4] p-4 rounded-xl text-xs text-[#64748B]">
          <div className="font-bold text-[#0F172A] mb-1 flex items-center gap-1.5">
            <FileCheck className="h-4 w-4 text-[#0A5C48]" />
            Legitimate Defense Purpose
          </div>
          This infrastructure is provided exclusively for defending web applications and campaigns from malicious automated scrapers, click-fraud farms, server exhaustion attacks, and unauthorized bots.
        </div>
      </div>
    </div>
  );
}
