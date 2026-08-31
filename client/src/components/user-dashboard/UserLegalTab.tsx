import { Shield, AlertTriangle, Lock, FileCheck } from "lucide-react";

export function UserLegalTab() {
  return (
    <div className="space-y-6">
      <div className="bg-[#101726] border border-[#1c2638] rounded-2xl p-6 shadow-sm space-y-6">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
            <Shield className="h-5 w-5 text-blue-500" />
            Legal, Terms & Privacy Architecture
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Understanding privacy commitments and user responsibility
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-[#141d2e] border border-[#212e45] p-5 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
              <AlertTriangle className="h-4 w-4" />
              User Liability & Responsibility
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              You are solely responsible for how you configure routing targets and verify compliance with local advertising networks, privacy frameworks (GDPR, CCPA), and consumer protection regulations in your jurisdiction.
            </p>
          </div>

          <div className="bg-[#141d2e] border border-[#212e45] p-5 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
              <Lock className="h-4 w-4" />
              Zero-PII Privacy Protection
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              We do not persist visitor personal identities or email addresses in database logs. Logs retain aggregated ASN classification and country metrics only, maintaining high data minimization standards.
            </p>
          </div>
        </div>

        <div className="bg-[#0e1422] border border-[#1a2333] p-4 rounded-xl text-xs text-slate-400">
          <div className="font-semibold text-slate-200 mb-1 flex items-center gap-1.5">
            <FileCheck className="h-4 w-4 text-blue-400" />
            Legitimate Defense Purpose
          </div>
          This infrastructure is provided exclusively for defending web applications and campaigns from malicious automated scrapers, click-fraud farms, server exhaustion attacks, and unauthorized bots.
        </div>
      </div>
    </div>
  );
}
