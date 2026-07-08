import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useCreateCampaign, useUploadContacts } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Upload, Send, ArrowRight, FileText, Hash, X, CheckCircle } from "lucide-react";

type ContactMode = "text" | "file";

export default function NewCampaign() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const createCampaign = useCreateCampaign();
  const uploadContacts = useUploadContacts();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [step, setStep] = useState<1 | 2>(1);
  const [createdId, setCreatedId] = useState<number | null>(null);

  // Contact input state
  const [mode, setMode] = useState<ContactMode>("text");
  const [rawText, setRawText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileContents, setFileContents] = useState<string | null>(null);
  const [preview, setPreview] = useState<string[]>([]);

  // ── Step 1: Create campaign ────────────────────────────────────────────────
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await createCampaign.mutateAsync({ data: { name, message } });
      setCreatedId(res.id);
      setStep(2);
      toast({ title: "Campaign created", description: "Now add target phone numbers." });
    } catch {
      toast({ title: "Failed to create campaign", variant: "destructive" });
    }
  };

  // ── Parse numbers from text ────────────────────────────────────────────────
  const parseNumbers = (text: string): string[] => {
    const lines = text.split(/[\n,;]+/);
    const nums: string[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      // Take the first token that looks like a phone number
      const tokens = trimmed.split(/\s+/);
      const num = tokens.find(t => /^\+?\d[\d\s\-().]{5,}$/.test(t)) ?? tokens[0];
      // Must have at least 7 digits
      if (num && (num.match(/\d/g)?.length ?? 0) >= 7) {
        nums.push(num.replace(/[\s\-()]/g, ""));
      }
    }
    return [...new Set(nums)];
  };

  const handleTextChange = (val: string) => {
    setRawText(val);
    setPreview(parseNumbers(val).slice(0, 5));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      setFileContents(text);
      setPreview(parseNumbers(text).slice(0, 5));
    };
    reader.readAsText(file);
  };

  const clearFile = () => {
    setFileName(null);
    setFileContents(null);
    setPreview([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── Step 2: Upload contacts ────────────────────────────────────────────────
  const handleUpload = async () => {
    if (!createdId) return;
    const sourceText = mode === "file" ? fileContents : rawText;
    if (!sourceText?.trim()) {
      toast({ title: "No numbers provided", variant: "destructive" });
      return;
    }

    const numbers = parseNumbers(sourceText);
    if (numbers.length === 0) {
      toast({ title: "No valid phone numbers found", description: "Enter one number per line, e.g. +1234567890", variant: "destructive" });
      return;
    }

    try {
      const res = await uploadContacts.mutateAsync({
        id: createdId,
        data: { numbers: sourceText } as any,
      });
      toast({
        title: `${res.imported} contacts loaded`,
        description: res.skipped > 0 ? `${res.skipped} duplicates skipped` : "All contacts imported.",
      });
      setLocation(`/campaigns/${createdId}`);
    } catch (err) {
      toast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const numberCount = parseNumbers(mode === "file" ? (fileContents ?? "") : rawText).length;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-mono font-bold tracking-tight">NEW <span className="text-primary">CAMPAIGN</span></h1>
        <p className="text-muted-foreground font-mono text-sm mt-1">Configure distribution payload</p>
      </div>

      {/* Step indicator */}
      <div className="flex gap-4 mb-8 font-mono text-sm">
        {[["1", "Payload"], ["2", "Targets"]].map(([num, label], i) => (
          <div key={num} className="flex items-center gap-2">
            {i > 0 && <div className="w-12 border-t border-border flex items-center mt-3" />}
            <div className={`flex items-center gap-2 ${step >= parseInt(num) ? 'text-primary' : 'text-muted-foreground'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center border text-xs ${step >= parseInt(num) ? 'border-primary bg-primary/20' : 'border-muted-foreground'}`}>{num}</div>
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* Step 1 — Campaign details */}
      {step === 1 && (
        <Card className="bg-card border-card-border shadow-lg">
          <CardHeader>
            <CardTitle className="font-mono">Message Payload</CardTitle>
            <CardDescription className="font-mono">Define the SMS text to be sent to all targets.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Campaign Name</label>
                <Input
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. PROMO_BATCH_01"
                  className="font-mono bg-black/50 border-primary/20 focus-visible:ring-primary/50"
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Message Body</label>
                  <span className={`text-xs font-mono ${message.length > 160 ? 'text-yellow-500' : 'text-muted-foreground'}`}>
                    {message.length} chars {message.length > 160 && '(multipart SMS)'}
                  </span>
                </div>
                <Textarea
                  required
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Enter your SMS message..."
                  className="font-mono min-h-[150px] bg-black/50 border-primary/20 focus-visible:ring-primary/50 resize-y"
                />
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={createCampaign.isPending} className="font-mono bg-primary hover:bg-primary/90">
                  Continue <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Step 2 — Contacts */}
      {step === 2 && (
        <Card className="bg-card border-card-border shadow-lg">
          <CardHeader>
            <CardTitle className="font-mono">Target Phone Numbers</CardTitle>
            <CardDescription className="font-mono">
              Paste numbers or upload a TXT/CSV file. One number per line, or comma-separated.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">

            {/* Mode toggle */}
            <div className="flex gap-2">
              <Button
                variant={mode === "text" ? "default" : "outline"}
                size="sm"
                className="font-mono text-xs"
                onClick={() => setMode("text")}
              >
                <Hash className="w-3 h-3 mr-1.5" /> Paste Numbers
              </Button>
              <Button
                variant={mode === "file" ? "default" : "outline"}
                size="sm"
                className="font-mono text-xs"
                onClick={() => setMode("file")}
              >
                <FileText className="w-3 h-3 mr-1.5" /> Upload File
              </Button>
            </div>

            {/* Text mode */}
            {mode === "text" && (
              <div className="space-y-2">
                <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                  Phone Numbers (one per line or comma-separated)
                </label>
                <Textarea
                  value={rawText}
                  onChange={e => handleTextChange(e.target.value)}
                  placeholder={`+1234567890\n+0987654321\n+447911123456, John\n+12025550142`}
                  className="font-mono text-sm bg-black border-border min-h-[220px] resize-y"
                />
                <p className="text-xs font-mono text-muted-foreground">
                  Accepted formats: +1234567890 · 00441234567890 · with name: +1234567890 John
                </p>
              </div>
            )}

            {/* File mode */}
            {mode === "file" && (
              <div className="space-y-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.csv,.tsv,text/plain"
                  className="hidden"
                  onChange={handleFileChange}
                />
                {fileName ? (
                  <div className="flex items-center gap-3 p-4 bg-primary/10 border border-primary/30 rounded font-mono text-sm">
                    <FileText className="w-5 h-5 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-foreground font-bold truncate">{fileName}</div>
                      <div className="text-muted-foreground text-xs">{numberCount} numbers found</div>
                    </div>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" onClick={clearFile}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-border hover:border-primary/50 transition-colors rounded-lg p-10 text-center"
                  >
                    <Upload className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
                    <div className="font-mono text-sm text-muted-foreground">
                      Click to upload TXT or CSV file
                    </div>
                    <div className="font-mono text-xs text-muted-foreground/60 mt-1">
                      One phone number per line, or comma-separated
                    </div>
                  </button>
                )}
              </div>
            )}

            {/* Preview */}
            {preview.length > 0 && (
              <div className="p-3 bg-black/50 border border-border rounded">
                <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
                  <CheckCircle className="w-3 h-3 text-green-500" />
                  Preview — {numberCount} number{numberCount !== 1 ? 's' : ''} detected
                </div>
                <div className="space-y-1">
                  {preview.map((num, i) => (
                    <div key={i} className="font-mono text-sm text-foreground">{num}</div>
                  ))}
                  {numberCount > 5 && (
                    <div className="font-mono text-xs text-muted-foreground">… and {numberCount - 5} more</div>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(1)} className="font-mono">Back</Button>
              <Button
                onClick={handleUpload}
                disabled={uploadContacts.isPending || numberCount === 0}
                className="font-mono bg-primary hover:bg-primary/90"
              >
                <Send className="w-4 h-4 mr-2" />
                {uploadContacts.isPending ? "Uploading…" : `Load ${numberCount > 0 ? numberCount + ' Numbers' : 'Numbers'}`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
