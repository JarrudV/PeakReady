import { useState, useRef } from "react";
import {
  Upload,
  Download,
  RotateCcw,
  FileText,
  Check,
  X,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Props {
  sessionCount: number;
}

export function PlanManager({ sessionCount }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [csvPreview, setCsvPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleLoadDefault = async () => {
    setIsLoading(true);
    try {
      const res = await apiRequest("POST", "/api/plan/load-default");
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      toast({ title: `Loaded ${data.count} sessions` });
      setConfirmReset(false);
    } catch {
      toast({ title: "Failed to load plan", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setCsvPreview(text);
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleUploadCsv = async () => {
    if (!csvPreview) return;
    setIsLoading(true);
    try {
      const res = await apiRequest("POST", "/api/plan/upload-csv", { csv: csvPreview });
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      toast({ title: `Uploaded ${data.count} sessions from CSV` });
      setCsvPreview(null);
    } catch (err: any) {
      toast({
        title: "CSV upload failed",
        description: err.message || "Check CSV format",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadTemplate = () => {
    const csvContent = `week,day,type,description,minutes,zone,elevation,details
1,Mon,Strength,Core & Stability,30,,,
1,Tue,Ride,Endurance Ride,50,Z2,,
1,Thu,Ride,Tempo Ride,45,Z3,,
1,Sat,Long Ride,Weekend Long Ride,105,Z2,700m,
2,Mon,Strength,Core & Stability,30,,,
2,Tue,Ride,Endurance Ride,55,Z2,,
2,Thu,Ride,Tempo Ride,50,Z3,,
2,Sat,Long Ride,Weekend Long Ride,120,Z2,800m,`;

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "peakready-plan-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mb-4" data-testid="plan-manager">
      <button
        onClick={() => {
          const next = !isOpen;
          setIsOpen(next);
          if (!next) {
            setConfirmReset(false);
            setCsvPreview(null);
          }
        }}
        className="w-full flex items-center justify-between glass-panel p-3 text-xs font-bold uppercase tracking-widest text-brand-muted hover:text-brand-text transition-colors"
        data-testid="button-toggle-plan-manager"
      >
        <span className="flex items-center gap-2">
          <FileText size={14} className="text-brand-primary" />
          Manage Training Plan
          {sessionCount > 0 && (
            <span className="text-brand-primary font-mono">({sessionCount} sessions)</span>
          )}
        </span>
        {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {isOpen && (
        <div className="glass-panel mt-2 p-5 space-y-5 border-brand-primary/20 shadow-[0_0_15px_rgba(65,209,255,0.05)]" data-testid="plan-manager-content">
          <div>
            <h4 className="text-sm font-bold text-brand-text mb-3 flex items-center gap-2">
              <RotateCcw size={16} className="text-brand-primary" />
              Load Pre-built Plan
            </h4>
            <div className="glass-panel p-4 border-brand-border/50">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h5 className="font-bold text-brand-text text-sm">12-Week MTB Race Prep</h5>
                  <p className="text-xs text-brand-muted mt-1 leading-relaxed">
                    Progressive training plan with base building, intensity blocks, peak week,
                    and taper. Includes strength sessions, interval work, and long endurance rides.
                    Each session has detailed workout instructions.
                  </p>
                </div>
              </div>
              {!confirmReset ? (
                <button
                  onClick={() => setConfirmReset(true)}
                  disabled={isLoading}
                  className="mt-3 w-full py-2.5 bg-gradient-primary text-brand-bg font-bold text-xs uppercase tracking-widest rounded-lg disabled:opacity-50 shadow-[0_0_10px_rgba(65,209,255,0.3)]"
                  data-testid="button-load-default"
                >
                  Load This Plan
                </button>
              ) : (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2 text-brand-warning text-xs py-2 px-3 bg-brand-warning/10 rounded-lg border border-brand-warning/20">
                    <AlertTriangle size={14} />
                    <span className="font-medium">This will replace your current training plan.</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmReset(false)}
                      className="flex-1 py-2.5 border border-brand-border text-brand-text font-bold text-xs uppercase tracking-widest rounded-lg"
                      data-testid="button-cancel-load"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleLoadDefault}
                      disabled={isLoading}
                      className="flex-1 py-2.5 bg-gradient-primary text-brand-bg font-bold text-xs uppercase tracking-widest rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
                      data-testid="button-confirm-load"
                    >
                      {isLoading ? "Loading..." : <>
                        <Check size={14} /> Confirm
                      </>}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-brand-border pt-5">
            <h4 className="text-sm font-bold text-brand-text mb-3 flex items-center gap-2">
              <Upload size={16} className="text-brand-secondary" />
              Upload CSV Plan
            </h4>
            <p className="text-xs text-brand-muted mb-3 leading-relaxed">
              Upload a CSV file with columns: <span className="font-mono text-brand-text">week, day, type, description, minutes</span>.
              Optional: <span className="font-mono text-brand-text">zone, elevation, details</span>.
            </p>

            {!csvPreview && (
              <div className="flex gap-2">
                <label
                  className="flex-1 py-3 border border-dashed border-brand-border rounded-lg text-center cursor-pointer hover:border-brand-primary/50 transition-colors flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest text-brand-muted hover:text-brand-text"
                  data-testid="button-select-csv"
                >
                  <Upload size={14} />
                  Choose CSV File
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleFileSelect}
                    className="hidden"
                    data-testid="input-csv-file"
                  />
                </label>
                <button
                  onClick={handleDownloadTemplate}
                  className="py-3 px-4 border border-brand-border rounded-lg text-xs font-bold uppercase tracking-widest text-brand-muted hover:text-brand-text transition-colors flex items-center gap-2"
                  data-testid="button-download-template"
                >
                  <Download size={14} />
                  Template
                </button>
              </div>
            )}

            {csvPreview && (
              <div className="space-y-3">
                <div className="bg-brand-bg rounded-lg p-3 border border-brand-border max-h-40 overflow-y-auto">
                  <pre className="text-xs text-brand-muted font-mono whitespace-pre-wrap break-all" data-testid="text-csv-preview">
                    {csvPreview.slice(0, 500)}
                    {csvPreview.length > 500 && "\n..."}
                  </pre>
                </div>
                <div className="flex items-center gap-2 text-brand-warning text-xs py-2 px-3 bg-brand-warning/10 rounded-lg border border-brand-warning/20">
                  <AlertTriangle size={14} />
                  <span className="font-medium">This will replace your current training plan.</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCsvPreview(null)}
                    className="flex-1 py-2.5 border border-brand-border text-brand-text font-bold text-xs uppercase tracking-widest rounded-lg flex items-center justify-center gap-2"
                    data-testid="button-cancel-csv"
                  >
                    <X size={14} /> Cancel
                  </button>
                  <button
                    onClick={handleUploadCsv}
                    disabled={isLoading}
                    className="flex-1 py-2.5 bg-gradient-secondary text-brand-bg font-bold text-xs uppercase tracking-widest rounded-lg disabled:opacity-50 shadow-[0_0_10px_rgba(255,168,0,0.3)] flex items-center justify-center gap-2"
                    data-testid="button-upload-csv"
                  >
                    {isLoading ? "Uploading..." : <>
                      <Upload size={14} /> Upload Plan
                    </>}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
