import { useState } from "react";
import { useLocation } from "wouter";
import { useCreateCampaign, useUploadContacts } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { FileJson, Send, ArrowRight } from "lucide-react";

export default function NewCampaign() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const createCampaign = useCreateCampaign();
  const uploadContacts = useUploadContacts();

  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [contactsJson, setContactsJson] = useState("[\n  { \"phoneNumber\": \"+1234567890\", \"name\": \"John Doe\" }\n]");
  const [step, setStep] = useState<1 | 2>(1);
  const [createdId, setCreatedId] = useState<number | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await createCampaign.mutateAsync({ data: { name, message } });
      setCreatedId(res.id);
      setStep(2);
      toast({ title: "Campaign Initialized", description: "Now attach target contacts." });
    } catch (err) {
      toast({ title: "Failed to create", variant: "destructive" });
    }
  };

  const handleUpload = async () => {
    if (!createdId) return;
    try {
      const parsed = JSON.parse(contactsJson);
      if (!Array.isArray(parsed)) throw new Error("Must be an array");
      
      const res = await uploadContacts.mutateAsync({ 
        id: createdId, 
        data: { contacts: parsed } 
      });
      
      toast({ 
        title: "Contacts Attached", 
        description: `Imported: ${res.imported}, Skipped: ${res.skipped}` 
      });
      setLocation(`/campaigns/${createdId}`);
    } catch (err) {
      toast({ 
        title: "Invalid JSON or Upload Failed", 
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive" 
      });
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-mono font-bold tracking-tight">NEW <span className="text-primary">CAMPAIGN</span></h1>
        <p className="text-muted-foreground font-mono text-sm mt-1">Configure distribution payload</p>
      </div>

      <div className="flex gap-4 mb-8 font-mono text-sm">
        <div className={`flex items-center gap-2 ${step >= 1 ? 'text-primary' : 'text-muted-foreground'}`}>
          <div className={`w-6 h-6 rounded-full flex items-center justify-center border ${step >= 1 ? 'border-primary bg-primary/20 glow-primary' : 'border-muted-foreground'}`}>1</div>
          Payload
        </div>
        <div className="w-12 border-t border-border flex items-center mt-3"></div>
        <div className={`flex items-center gap-2 ${step >= 2 ? 'text-primary' : 'text-muted-foreground'}`}>
          <div className={`w-6 h-6 rounded-full flex items-center justify-center border ${step >= 2 ? 'border-primary bg-primary/20 glow-primary' : 'border-muted-foreground'}`}>2</div>
          Targets
        </div>
      </div>

      {step === 1 ? (
        <Card className="bg-card border-card-border shadow-lg">
          <CardHeader>
            <CardTitle className="font-mono">Message Payload</CardTitle>
            <CardDescription className="font-mono">Define the SMS content to be distributed.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Campaign Name</label>
                <Input 
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g., PROMO_BATCH_01"
                  className="font-mono bg-black/50 border-primary/20 focus-visible:ring-primary/50"
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Message Body</label>
                  <span className={`text-xs font-mono ${message.length > 160 ? 'text-yellow-500' : 'text-muted-foreground'}`}>
                    {message.length} chars {message.length > 160 && '(Multiple SMS)'}
                  </span>
                </div>
                <Textarea 
                  required
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Enter message content..."
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
      ) : (
        <Card className="bg-card border-card-border shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <FileJson className="w-32 h-32" />
          </div>
          <CardHeader>
            <CardTitle className="font-mono">Target Matrix</CardTitle>
            <CardDescription className="font-mono">Provide JSON array of recipients.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 relative z-10">
            <div className="space-y-2">
              <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                JSON Input
                <Button variant="ghost" size="sm" className="h-6 text-[10px] text-primary" onClick={() => setContactsJson("[\n  { \"phoneNumber\": \"+1234567890\" }\n]")}>
                  Load Template
                </Button>
              </label>
              <Textarea 
                value={contactsJson}
                onChange={e => setContactsJson(e.target.value)}
                className="font-mono text-sm bg-black border-border min-h-[300px]"
                style={{ fontFamily: 'var(--app-font-mono)' }}
              />
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)} className="font-mono">Back</Button>
              <Button onClick={handleUpload} disabled={uploadContacts.isPending} className="font-mono bg-primary hover:bg-primary/90 glow-primary">
                <Send className="w-4 h-4 mr-2" />
                Attach & Initialize
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
