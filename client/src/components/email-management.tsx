import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Mail,
  Server,
  FileCode,
  Send,
  Radio,
  History,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Eye,
  RotateCcw,
  Key,
  ShieldCheck,
  Globe,
  Users,
  RefreshCw,
  ExternalLink,
} from "lucide-react";

interface SmtpSettings {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  passMasked: string;
  isConfigured: boolean;
  from: string;
  fromName: string;
  providerPreset: string;
}

interface EmailTemplate {
  subject: string;
  html: string;
  defaultSubject: string;
  defaultHtml: string;
}

interface EmailTemplatesResponse {
  templates: {
    verification: EmailTemplate;
    reset: EmailTemplate;
    welcome: EmailTemplate;
    custom: EmailTemplate;
    newsletter: EmailTemplate;
  };
}

interface EmailLog {
  id: string;
  to: string;
  subject: string;
  templateType: string;
  status: "sent" | "simulated" | "failed";
  timestamp: string;
  messageId?: string;
  error?: string;
}

const PROVIDER_PRESETS: Record<
  string,
  { name: string; host: string; port: number; secure: boolean; hint: string; docUrl: string }
> = {
  resend: {
    name: "Resend",
    host: "smtp.resend.com",
    port: 465,
    secure: true,
    hint: "Use 'resend' as username, and your API Key (re_...) as password.",
    docUrl: "https://resend.com/docs/dashboard/emails/smtp",
  },
  sendgrid: {
    name: "SendGrid",
    host: "smtp.sendgrid.net",
    port: 587,
    secure: false,
    hint: "Use 'apikey' as username, and your SendGrid API key as password.",
    docUrl: "https://docs.sendgrid.com/for-developers/sending-email/getting-started-smtp",
  },
  mailgun: {
    name: "Mailgun",
    host: "smtp.mailgun.org",
    port: 587,
    secure: false,
    hint: "Use your Mailgun SMTP login credentials (e.g. postmaster@yourdomain.com).",
    docUrl: "https://documentation.mailgun.com/en/latest/user_manual.html#smtp",
  },
  brevo: {
    name: "Brevo (Sendinblue)",
    host: "smtp-relay.brevo.com",
    port: 587,
    secure: false,
    hint: "Use your Brevo SMTP login and master API master key.",
    docUrl: "https://www.brevo.com/features/smtp/",
  },
  gmail: {
    name: "Gmail / Google Workspace",
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    hint: "Use your Google account email and a generated 16-character App Password.",
    docUrl: "https://support.google.com/accounts/answer/185833",
  },
  custom: {
    name: "Custom SMTP",
    host: "",
    port: 587,
    secure: false,
    hint: "Configure any standard RFC compliant SMTP server.",
    docUrl: "",
  },
};

export default function EmailManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Active sub-tab state
  const [activeTab, setActiveTab] = useState("smtp");

  // SMTP form state
  const [host, setHost] = useState("");
  const [port, setPort] = useState(587);
  const [secure, setSecure] = useState(false);
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [from, setFrom] = useState("");
  const [fromName, setFromName] = useState("CleanTraffic Cloak");
  const [providerPreset, setProviderPreset] = useState("custom");
  const [testRecipient, setTestRecipient] = useState("");

  // Template editor state
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<"verification" | "reset" | "welcome" | "custom" | "newsletter">("verification");
  const [templateSubject, setTemplateSubject] = useState("");
  const [templateHtml, setTemplateHtml] = useState("");
  const [previewSubject, setPreviewSubject] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");
  const [isPreviewActive, setIsPreviewActive] = useState(false);

  // Direct send state
  const [directRecipientEmail, setDirectRecipientEmail] = useState("");
  const [directRecipientName, setDirectRecipientName] = useState("");
  const [directSubject, setDirectSubject] = useState("");
  const [directMessage, setDirectMessage] = useState("");

  // Broadcast state
  const [broadcastAudience, setBroadcastAudience] = useState<"all" | "newsletter" | "active_trial" | "active_subscribers">("all");
  const [broadcastSubject, setBroadcastSubject] = useState("");
  const [broadcastMessage, setBroadcastMessage] = useState("");

  // Queries
  const { data: smtpSettings, isLoading: isLoadingSmtp } = useQuery<SmtpSettings>({
    queryKey: ["/api/interface/email/settings"],
  });

  const { data: templatesData, isLoading: isLoadingTemplates } = useQuery<EmailTemplatesResponse>({
    queryKey: ["/api/interface/email/templates"],
  });

  const { data: logsData, refetch: refetchLogs } = useQuery<{ logs: EmailLog[] }>({
    queryKey: ["/api/interface/email/logs"],
    refetchInterval: activeTab === "logs" ? 10000 : false,
  });

  const { data: clientUsersList } = useQuery<any[]>({
    queryKey: ["/api/interface/client-users"],
  });

  // Populate SMTP state on load
  useEffect(() => {
    if (smtpSettings) {
      setHost(smtpSettings.host || "");
      setPort(smtpSettings.port || 587);
      setSecure(smtpSettings.secure || false);
      setUser(smtpSettings.user || "");
      setPass(smtpSettings.passMasked ? "••••••••" : "");
      setFrom(smtpSettings.from || "");
      setFromName(smtpSettings.fromName || "CleanTraffic Cloak");
      setProviderPreset(smtpSettings.providerPreset || "custom");
    }
  }, [smtpSettings]);

  // Populate template state on template change
  useEffect(() => {
    if (templatesData?.templates && templatesData.templates[selectedTemplateKey]) {
      const tpl = templatesData.templates[selectedTemplateKey];
      setTemplateSubject(tpl.subject);
      setTemplateHtml(tpl.html);
      setIsPreviewActive(false);
    }
  }, [selectedTemplateKey, templatesData]);

  // Handle provider preset selection
  const handlePresetSelect = (presetKey: string) => {
    setProviderPreset(presetKey);
    const preset = PROVIDER_PRESETS[presetKey];
    if (preset && presetKey !== "custom") {
      setHost(preset.host);
      setPort(preset.port);
      setSecure(preset.secure);
      if (!from) setFrom(`notifications@yourdomain.com`);
    }
  };

  // Mutations
  const saveSmtpMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        host: host.trim(),
        port: Number(port),
        secure,
        user: user.trim(),
        from: from.trim(),
        fromName: fromName.trim(),
        providerPreset,
      };
      if (pass && pass !== "••••••••") {
        payload.pass = pass;
      }
      const res = await apiRequest("POST", "/api/interface/email/settings", payload);
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/interface/email/settings"] });
      toast({
        title: "SMTP Settings Saved",
        description: data.message || "Email server configuration updated and persisted to database.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Save Failed",
        description: err.message || "Failed to update SMTP settings.",
        variant: "destructive",
      });
    },
  });

  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        host: host.trim(),
        port: Number(port),
        secure,
        user: user.trim(),
        from: from.trim(),
        fromName: fromName.trim(),
        testRecipient: testRecipient.trim() || undefined,
      };
      if (pass && pass !== "••••••••") {
        payload.pass = pass;
      }
      const res = await apiRequest("POST", "/api/interface/email/test-connection", payload);
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "SMTP Connection Verified!",
        description: data.message || "Successfully connected to the SMTP server.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Connection Test Failed",
        description: err.message || "Could not authenticate with SMTP server. Please verify credentials.",
        variant: "destructive",
      });
    },
  });

  const saveTemplateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/interface/email/templates", {
        type: selectedTemplateKey,
        subject: templateSubject.trim(),
        html: templateHtml,
      });
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/interface/email/templates"] });
      toast({
        title: "Template Saved",
        description: data.message || "Email template updated successfully.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Failed to Save Template",
        description: err.message || "Error saving template.",
        variant: "destructive",
      });
    },
  });

  const previewTemplateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/interface/email/templates/preview", {
        subject: templateSubject,
        html: templateHtml,
      });
      return await res.json();
    },
    onSuccess: (data) => {
      setPreviewSubject(data.renderedSubject);
      setPreviewHtml(data.renderedHtml);
      setIsPreviewActive(true);
    },
    onError: (err: any) => {
      toast({
        title: "Preview Error",
        description: err.message || "Failed to render template preview.",
        variant: "destructive",
      });
    },
  });

  const sendToUserMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/interface/email/send-to-user", {
        email: directRecipientEmail.trim(),
        name: directRecipientName.trim() || undefined,
        subject: directSubject.trim(),
        message: directMessage.trim(),
      });
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/interface/email/logs"] });
      setDirectSubject("");
      setDirectMessage("");
      toast({
        title: "Email Sent",
        description: data.message || `Message dispatched to ${directRecipientEmail}.`,
      });
    },
    onError: (err: any) => {
      toast({
        title: "Delivery Failed",
        description: err.message || "Failed to send email to recipient.",
        variant: "destructive",
      });
    },
  });

  const broadcastMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/interface/email/broadcast", {
        audience: broadcastAudience,
        subject: broadcastSubject.trim(),
        message: broadcastMessage.trim(),
      });
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/interface/email/logs"] });
      setBroadcastSubject("");
      setBroadcastMessage("");
      toast({
        title: "Broadcast Complete",
        description: data.message || `Dispatched to ${data.sentCount} subscribers.`,
      });
    },
    onError: (err: any) => {
      toast({
        title: "Broadcast Failed",
        description: err.message || "Failed to send broadcast.",
        variant: "destructive",
      });
    },
  });

  const handleResetToDefault = () => {
    if (templatesData?.templates && templatesData.templates[selectedTemplateKey]) {
      const tpl = templatesData.templates[selectedTemplateKey];
      setTemplateSubject(tpl.defaultSubject);
      setTemplateHtml(tpl.defaultHtml);
      setIsPreviewActive(false);
      toast({
        title: "Template Reset",
        description: "Loaded standard CleanTraffic Cloak default template content.",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <Card className="border-border shadow bg-gradient-to-r from-card to-card/60">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="text-xl font-bold flex items-center gap-2.5">
                <Mail className="w-5 h-5 text-blue-500" />
                Email Services & SMTP Delivery Hub
              </CardTitle>
              <CardDescription>
                Configure live transactional SMTP delivery (Resend, SendGrid, Mailgun, Brevo), customize branded HTML templates, and dispatch direct user messages or newsletters.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              {smtpSettings?.isConfigured ? (
                <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 flex items-center gap-1.5 px-3 py-1 text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  SMTP Live Connected ({smtpSettings.host})
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 flex items-center gap-1.5 px-3 py-1 text-xs">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Simulation Logging Active (No SMTP Configured)
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Main Sub Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-2 md:grid-cols-5 w-full bg-muted/70 p-1 mb-6">
          <TabsTrigger value="smtp" className="flex items-center gap-2 text-xs md:text-sm">
            <Server className="w-4 h-4" />
            SMTP Settings
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2 text-xs md:text-sm">
            <FileCode className="w-4 h-4" />
            HTML Templates
          </TabsTrigger>
          <TabsTrigger value="direct" className="flex items-center gap-2 text-xs md:text-sm">
            <Send className="w-4 h-4" />
            Send to User
          </TabsTrigger>
          <TabsTrigger value="broadcast" className="flex items-center gap-2 text-xs md:text-sm">
            <Radio className="w-4 h-4" />
            Newsletter & Broadcast
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center gap-2 text-xs md:text-sm">
            <History className="w-4 h-4" />
            Delivery Logs
          </TabsTrigger>
        </TabsList>

        {/* 1. SMTP SETTINGS TAB */}
        <TabsContent value="smtp" className="space-y-6">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Server className="w-5 h-5 text-primary" />
                SMTP Server Configuration
              </CardTitle>
              <CardDescription>
                Enter your SMTP server credentials from Resend, SendGrid, Mailgun, Brevo, or any custom mail relay provider.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Provider Quick Presets */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Quick Provider Presets
                </Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
                  {Object.entries(PROVIDER_PRESETS).map(([key, p]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handlePresetSelect(key)}
                      className={`p-2.5 rounded-lg border text-left transition-all ${
                        providerPreset === key
                          ? "border-primary bg-primary/10 text-primary font-semibold shadow-sm"
                          : "border-border bg-card hover:bg-muted/50 text-foreground"
                      }`}
                    >
                      <div className="text-xs font-medium">{p.name}</div>
                      <div className="text-[10px] text-muted-foreground truncate">{p.host || "Manual Host"}</div>
                    </button>
                  ))}
                </div>
                {PROVIDER_PRESETS[providerPreset]?.hint && (
                  <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/40 p-2.5 rounded-lg border border-border/60">
                    <span>💡 {PROVIDER_PRESETS[providerPreset].hint}</span>
                    {PROVIDER_PRESETS[providerPreset].docUrl && (
                      <a
                        href={PROVIDER_PRESETS[providerPreset].docUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline inline-flex items-center gap-1 font-medium ml-2"
                      >
                        Docs <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* Form Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="smtp-host">SMTP Host / Server</Label>
                  <Input
                    id="smtp-host"
                    placeholder="smtp.resend.com or smtp.sendgrid.net"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="smtp-port">SMTP Port</Label>
                  <Input
                    id="smtp-port"
                    type="number"
                    placeholder="465 or 587"
                    value={port}
                    onChange={(e) => setPort(Number(e.target.value))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="smtp-user">SMTP Username / API Key Identifier</Label>
                  <Input
                    id="smtp-user"
                    placeholder="resend, apikey, or your username"
                    value={user}
                    onChange={(e) => setUser(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="smtp-pass">SMTP Password / API Key Secret</Label>
                  <Input
                    id="smtp-pass"
                    type="password"
                    placeholder={smtpSettings?.passMasked ? "Leave unchanged to keep current password" : "Enter API Secret"}
                    value={pass}
                    onChange={(e) => setPass(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="smtp-from">Default Sender Email Address (From)</Label>
                  <Input
                    id="smtp-from"
                    type="email"
                    placeholder="security@cleantraffic.io or verify@yourdomain.com"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="smtp-from-name">Sender Display Name</Label>
                  <Input
                    id="smtp-from-name"
                    placeholder="CleanTraffic Cloak Enterprise"
                    value={fromName}
                    onChange={(e) => setFromName(e.target.value)}
                  />
                </div>
              </div>

              {/* Secure SSL/TLS Toggle */}
              <div className="flex items-center justify-between p-4 bg-muted/40 rounded-lg border border-border/80">
                <div className="space-y-0.5">
                  <div className="text-sm font-medium">Use Direct SSL/TLS (Secure)</div>
                  <div className="text-xs text-muted-foreground">
                    Enable for Port 465 (SMTPS). Disable for Port 587 (STARTTLS).
                  </div>
                </div>
                <Switch checked={secure} onCheckedChange={setSecure} />
              </div>

              {/* Save & Test Action Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-border">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Input
                    type="email"
                    placeholder="Test recipient email (optional)"
                    value={testRecipient}
                    onChange={(e) => setTestRecipient(e.target.value)}
                    className="max-w-[260px] text-xs h-9"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => testConnectionMutation.mutate()}
                    disabled={testConnectionMutation.isPending || !host || !user}
                    className="h-9 text-xs flex items-center gap-1.5 flex-shrink-0"
                  >
                    {testConnectionMutation.isPending ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                    )}
                    Test Connection
                  </Button>
                </div>

                <Button
                  type="button"
                  onClick={() => saveSmtpMutation.mutate()}
                  disabled={saveSmtpMutation.isPending || !host || !user || !from}
                  className="w-full sm:w-auto h-9 font-medium text-xs bg-primary text-primary-foreground flex items-center gap-2"
                >
                  {saveSmtpMutation.isPending ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-3.5 h-3.5" />
                  )}
                  Save SMTP Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 2. HTML TEMPLATES TAB */}
        <TabsContent value="templates" className="space-y-6">
          <Card className="border-border">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileCode className="w-5 h-5 text-primary" />
                    Transactional Email Templates
                  </CardTitle>
                  <CardDescription>
                    Customize the responsive HTML email layouts for account verification, password resets, welcome messages, and alerts.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleResetToDefault}
                    className="text-xs h-8 flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset to Default
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => saveTemplateMutation.mutate()}
                    disabled={saveTemplateMutation.isPending}
                    className="text-xs h-8 flex items-center gap-1.5"
                  >
                    {saveTemplateMutation.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    Save Template
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Template Category Selector */}
              <div className="flex flex-wrap gap-2 pb-2 border-b border-border">
                {[
                  { key: "verification", label: "Email Verification (PIN + Link)", icon: Mail },
                  { key: "reset", label: "Password Recovery", icon: Key },
                  { key: "welcome", label: "Welcome / Onboarding", icon: Sparkles },
                  { key: "custom", label: "Direct Message Wrapper", icon: Send },
                  { key: "newsletter", label: "Broadcast / Newsletter", icon: Radio },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setSelectedTemplateKey(item.key as any)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                      selectedTemplateKey === item.key
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <item.icon className="w-3.5 h-3.5" />
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Subject Line Input */}
              <div className="space-y-2">
                <Label htmlFor="tpl-subject">Email Subject Line</Label>
                <Input
                  id="tpl-subject"
                  value={templateSubject}
                  onChange={(e) => setTemplateSubject(e.target.value)}
                  placeholder="e.g. Verify your CleanTraffic Cloak account (Code: {{code}})"
                />
              </div>

              {/* Dynamic Placeholders Reference Chips */}
              <div className="space-y-1.5 bg-muted/40 p-3 rounded-lg border border-border/70">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Available Dynamic Variables
                </div>
                <div className="flex flex-wrap gap-1.5 text-xs">
                  {["{{name}}", "{{username}}", "{{email}}", "{{code}}", "{{verification_link}}", "{{reset_link}}", "{{login_link}}", "{{api_key}}", "{{app_name}}", "{{current_year}}", "{{support_email}}", "{{custom_message}}"].map((variable) => (
                    <code
                      key={variable}
                      onClick={() => {
                        navigator.clipboard.writeText(variable);
                        toast({ title: "Copied to clipboard", description: variable });
                      }}
                      className="bg-muted px-2 py-0.5 rounded border border-border text-primary font-mono text-[11px] cursor-pointer hover:bg-primary/10 transition-colors"
                      title="Click to copy"
                    >
                      {variable}
                    </code>
                  ))}
                </div>
              </div>

              {/* Editor vs Preview Mode Toggle */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>HTML Source & Rendered Preview</Label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant={!isPreviewActive ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => setIsPreviewActive(false)}
                      className="text-xs h-7 px-3"
                    >
                      HTML Editor
                    </Button>
                    <Button
                      type="button"
                      variant={isPreviewActive ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => previewTemplateMutation.mutate()}
                      className="text-xs h-7 px-3 flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Live Preview
                    </Button>
                  </div>
                </div>

                {!isPreviewActive ? (
                  <textarea
                    rows={16}
                    value={templateHtml}
                    onChange={(e) => setTemplateHtml(e.target.value)}
                    className="w-full p-4 rounded-xl font-mono text-xs bg-slate-950 text-slate-100 border border-slate-800 focus:outline-none focus:ring-1 focus:ring-primary leading-relaxed"
                  />
                ) : (
                  <div className="border border-border rounded-xl p-4 bg-muted/20 space-y-3">
                    <div className="text-xs font-semibold text-muted-foreground pb-2 border-b border-border flex items-center justify-between">
                      <span>Subject: <strong className="text-foreground">{previewSubject || templateSubject}</strong></span>
                      <Badge variant="outline" className="text-[10px]">Sample Render</Badge>
                    </div>
                    <div
                      className="rounded-lg overflow-hidden border border-border/80 bg-white"
                      dangerouslySetInnerHTML={{ __html: previewHtml || templateHtml }}
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 3. SEND DIRECT EMAIL TAB */}
        <TabsContent value="direct" className="space-y-6">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Send className="w-5 h-5 text-primary" />
                Dispatch Direct Email to User
              </CardTitle>
              <CardDescription>
                Send an immediate transactional message or custom notice to a specific customer or registered administrator.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Quick Select Client User */}
              {clientUsersList && clientUsersList.length > 0 && (
                <div className="space-y-2">
                  <Label>Select From Registered Users (Optional Quick-Fill)</Label>
                  <select
                    className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm focus:ring-1 focus:ring-primary focus:outline-none"
                    onChange={(e) => {
                      const selected = clientUsersList.find((u) => u.email === e.target.value);
                      if (selected) {
                        setDirectRecipientEmail(selected.email);
                        setDirectRecipientName(selected.fullName || selected.username);
                      }
                    }}
                    defaultValue=""
                  >
                    <option value="" disabled>-- Select a registered client user --</option>
                    {clientUsersList.map((u) => (
                      <option key={u.id} value={u.email}>
                        {u.username} ({u.email}) - {u.status} [{u.subscriptionStatus}]
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="direct-email">Recipient Email Address *</Label>
                  <Input
                    id="direct-email"
                    type="email"
                    placeholder="user@example.com"
                    value={directRecipientEmail}
                    onChange={(e) => setDirectRecipientEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="direct-name">Recipient Name (Optional)</Label>
                  <Input
                    id="direct-name"
                    placeholder="John Doe"
                    value={directRecipientName}
                    onChange={(e) => setDirectRecipientName(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="direct-subj">Subject Line *</Label>
                <Input
                  id="direct-subj"
                  placeholder="Security Notice: API Key Rotated"
                  value={directSubject}
                  onChange={(e) => setDirectSubject(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="direct-body">Message Body (Plain text or HTML) *</Label>
                <textarea
                  id="direct-body"
                  rows={8}
                  placeholder="Type your message here. If plain text is entered, it will automatically be styled within the CleanTraffic branded template."
                  value={directMessage}
                  onChange={(e) => setDirectMessage(e.target.value)}
                  className="w-full p-3 rounded-lg border border-border bg-background text-sm focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="button"
                  onClick={() => sendToUserMutation.mutate()}
                  disabled={sendToUserMutation.isPending || !directRecipientEmail || !directSubject || !directMessage}
                  className="flex items-center gap-2"
                >
                  {sendToUserMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Dispatch Email
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 4. NEWSLETTER & BROADCAST TAB */}
        <TabsContent value="broadcast" className="space-y-6">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Radio className="w-5 h-5 text-primary" />
                Newsletter & Bulk User Broadcast
              </CardTitle>
              <CardDescription>
                Send announcements, feature updates, maintenance notices, or promotions to user segments.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label>Target Audience Segment</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { key: "all", label: "All Registered Users", desc: "Every verified & active account" },
                    { key: "newsletter", label: "Newsletter Subscribers", desc: "Users who opted into updates" },
                    { key: "active_trial", label: "Active Free Trials", desc: "Currently trialing accounts" },
                    { key: "active_subscribers", label: "Active Paid Subscribers", desc: "Paying pro/enterprise users" },
                  ].map((aud) => (
                    <button
                      key={aud.key}
                      type="button"
                      onClick={() => setBroadcastAudience(aud.key as any)}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        broadcastAudience === aud.key
                          ? "border-primary bg-primary/10 text-primary font-medium"
                          : "border-border bg-card hover:bg-muted/50 text-foreground"
                      }`}
                    >
                      <div className="text-sm font-semibold">{aud.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{aud.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="broadcast-subject">Broadcast Subject Line *</Label>
                <Input
                  id="broadcast-subject"
                  placeholder="🚀 CleanTraffic Update: Enhanced Cloaking Algorithms Live"
                  value={broadcastSubject}
                  onChange={(e) => setBroadcastSubject(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="broadcast-message">Newsletter Message Content *</Label>
                <textarea
                  id="broadcast-message"
                  rows={8}
                  placeholder="Write the announcement body. Paragraphs will automatically format into the branded CleanTraffic newsletter template."
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  className="w-full p-3 rounded-lg border border-border bg-background text-sm focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border">
                <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-blue-500" />
                  Total Registered Accounts: <strong>{clientUsersList?.length || 0}</strong>
                </div>

                <Button
                  type="button"
                  onClick={() => broadcastMutation.mutate()}
                  disabled={broadcastMutation.isPending || !broadcastSubject || !broadcastMessage}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white"
                >
                  {broadcastMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Radio className="w-4 h-4" />}
                  Send Broadcast Campaign
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 5. DELIVERY LOGS TAB */}
        <TabsContent value="logs" className="space-y-6">
          <Card className="border-border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <History className="w-5 h-5 text-primary" />
                    Outbound Email Dispatch Logs
                  </CardTitle>
                  <CardDescription>
                    Review real-time status and message identifiers for all verification, recovery, and notification emails.
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchLogs()}
                  className="text-xs h-8 flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Refresh Logs
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {logsData?.logs && logsData.logs.length > 0 ? (
                <div className="rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted text-muted-foreground uppercase font-semibold">
                      <tr>
                        <th className="px-4 py-3">Timestamp</th>
                        <th className="px-4 py-3">Recipient</th>
                        <th className="px-4 py-3">Subject</th>
                        <th className="px-4 py-3">Template</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {logsData.logs.map((log) => (
                        <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                            {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </td>
                          <td className="px-4 py-3 font-mono font-medium">{log.to}</td>
                          <td className="px-4 py-3 truncate max-w-[200px]">{log.subject}</td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className="text-[10px] uppercase">
                              {log.templateType}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            {log.status === "sent" ? (
                              <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30">
                                Delivered
                              </Badge>
                            ) : log.status === "simulated" ? (
                              <Badge variant="secondary" className="text-amber-500">
                                Simulated Log
                              </Badge>
                            ) : (
                              <Badge variant="destructive">
                                Failed
                              </Badge>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground truncate max-w-[160px]">
                            {log.messageId || log.error || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground text-sm space-y-2">
                  <Mail className="w-8 h-8 mx-auto text-muted-foreground/50" />
                  <p>No outbound emails recorded yet in this session.</p>
                  <p className="text-xs">Outbound emails sent via verification, password resets, or broadcasts will appear here in real-time.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
