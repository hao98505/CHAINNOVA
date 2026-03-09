import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useChainNova } from "@/hooks/useChainNova";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useLanguage } from "@/contexts/LanguageContext";
import { Bot, Upload, Cpu, DollarSign, FileText, Sparkles, CheckCircle, RotateCcw } from "lucide-react";

interface CreateAgentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = "details" | "metadata" | "confirm" | "success";

export function CreateAgentModal({ open, onOpenChange }: CreateAgentModalProps) {
  const { connected } = useWallet();
  const { setVisible } = useWalletModal();
  const { mintAgent, isLoading } = useChainNova();
  const { toast } = useToast();
  const { t } = useLanguage();

  const [step, setStep] = useState<Step>("details");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tflops, setTflops] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("Research");
  const [metadataFile, setMetadataFile] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);

  const categories = ["Research", "Security", "Creative", "Finance", "Oracle", "Governance"];

  const resetForm = () => {
    setStep("details");
    setName("");
    setDescription("");
    setTflops("");
    setPrice("");
    setCategory("Research");
    setMetadataFile(null);
    setTxSignature(null);
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(resetForm, 300);
  };

  const handleMint = async () => {
    if (!connected) {
      setVisible(true);
      onOpenChange(false);
      return;
    }
    try {
      const result = await mintAgent({
        name,
        description,
        tflops: parseFloat(tflops) || 100,
        price: parseFloat(price) || 500,
      });
      setTxSignature(result.signature);
      setStep("success");
      toast({ title: t.createAgent.agentMinted, description: `${name} ${t.createAgent.agentMintedDesc}` });
    } catch {
      toast({ title: t.createAgent.mintFailed, description: t.createAgent.mintFailedDesc, variant: "destructive" });
    }
  };

  const simulateFileUpload = () => {
    setMetadataFile("agent_metadata_" + Date.now() + ".json");
  };

  const stepLabels = [t.createAgent.step1, t.createAgent.step2, t.createAgent.step3];
  const stepKeys: Step[] = ["details", "metadata", "confirm"];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="glass-card border-primary/30 max-w-lg overflow-hidden p-0">
        <div className="p-6 border-b border-primary/20 bg-primary/5">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-primary/20 border border-primary/40 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              <DialogTitle className="font-orbitron text-sm font-bold tracking-wider uppercase text-foreground">
                {t.createAgent.title}
              </DialogTitle>
            </div>
          </DialogHeader>

          <div className="flex items-center gap-2 mt-4">
            {stepKeys.map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center font-orbitron text-[9px] font-bold transition-all ${
                    step === s || (step === "success" && i < 3)
                      ? "bg-primary text-primary-foreground"
                      : stepKeys.indexOf(step) > i
                      ? "bg-primary/40 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {stepKeys.indexOf(step) > i || step === "success" ? "✓" : i + 1}
                </div>
                <span className={`font-orbitron text-[8px] uppercase tracking-wider ${step === s ? "text-primary" : "text-muted-foreground/50"}`}>
                  {stepLabels[i]}
                </span>
                {i < 2 && <div className="w-6 h-px bg-border/50 mx-1" />}
              </div>
            ))}
          </div>
        </div>

        <div className="p-6">
          <AnimatePresence mode="wait">
            {step === "details" && (
              <motion.div
                key="details"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div>
                  <Label className="font-orbitron text-[9px] uppercase tracking-widest text-muted-foreground/70 mb-2 block">
                    {t.createAgent.nameLabel}
                  </Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t.createAgent.namePlaceholder}
                    className="cyber-input font-orbitron text-sm tracking-wider"
                    data-testid="input-agent-name"
                  />
                </div>

                <div>
                  <Label className="font-orbitron text-[9px] uppercase tracking-widest text-muted-foreground/70 mb-2 block">
                    {t.createAgent.descLabel}
                  </Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={t.createAgent.descPlaceholder}
                    className="cyber-input font-sans text-sm resize-none"
                    rows={3}
                    data-testid="input-agent-description"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="font-orbitron text-[9px] uppercase tracking-widest text-muted-foreground/70 mb-2 block">
                      <Cpu className="w-3 h-3 inline mr-1" />{t.createAgent.tflopsLabel}
                    </Label>
                    <Input
                      type="number"
                      value={tflops}
                      onChange={(e) => setTflops(e.target.value)}
                      placeholder="100"
                      className="cyber-input font-orbitron text-sm"
                      data-testid="input-agent-tflops"
                    />
                  </div>
                  <div>
                    <Label className="font-orbitron text-[9px] uppercase tracking-widest text-muted-foreground/70 mb-2 block">
                      <DollarSign className="w-3 h-3 inline mr-1" />{t.createAgent.priceLabel}
                    </Label>
                    <Input
                      type="number"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="500"
                      className="cyber-input font-orbitron text-sm"
                      data-testid="input-agent-price"
                    />
                  </div>
                </div>

                <div>
                  <Label className="font-orbitron text-[9px] uppercase tracking-widest text-muted-foreground/70 mb-2 block">
                    {t.createAgent.categoryLabel}
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setCategory(cat)}
                        data-testid={`button-category-${cat.toLowerCase()}`}
                        className={`px-3 py-1 rounded border font-orbitron text-[9px] tracking-wider uppercase transition-all ${
                          category === cat
                            ? "bg-primary/30 border-primary/60 text-primary"
                            : "border-border/50 text-muted-foreground"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <Button
                  className="w-full font-orbitron text-[10px] tracking-wider uppercase"
                  onClick={() => setStep("metadata")}
                  disabled={!name || !description}
                  data-testid="button-next-metadata"
                  style={{ background: "linear-gradient(135deg, #6B46C1, #4C1D95)" }}
                >
                  {t.createAgent.nextMetadata}
                </Button>
              </motion.div>
            )}

            {step === "metadata" && (
              <motion.div
                key="metadata"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div>
                  <Label className="font-orbitron text-[9px] uppercase tracking-widest text-muted-foreground/70 mb-2 block">
                    <FileText className="w-3 h-3 inline mr-1" />{t.createAgent.uploadLabel}
                  </Label>
                  <div
                    className="border-2 border-dashed border-primary/30 rounded-md p-6 text-center cursor-pointer transition-all"
                    onClick={simulateFileUpload}
                    data-testid="button-upload-metadata"
                  >
                    {metadataFile ? (
                      <div className="space-y-2">
                        <CheckCircle className="w-8 h-8 text-green-400 mx-auto" />
                        <div className="font-orbitron text-[10px] text-green-400 tracking-wider">{metadataFile}</div>
                        <div className="text-[10px] text-muted-foreground">{t.createAgent.fileUploaded}</div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Upload className="w-8 h-8 text-muted-foreground/40 mx-auto" />
                        <div className="font-orbitron text-[10px] text-muted-foreground tracking-wider uppercase">
                          {t.createAgent.uploadText}
                        </div>
                        <div className="text-[9px] text-muted-foreground/50">{t.createAgent.uploadSub}</div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-3 rounded-md bg-primary/5 border border-primary/15 space-y-2">
                  <div className="font-orbitron text-[9px] text-muted-foreground/70 uppercase tracking-widest mb-2">
                    {t.createAgent.metadataPreview}
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground space-y-1">
                    <div><span className="text-primary/70">"name":</span> <span className="text-green-300">"{name}"</span></div>
                    <div><span className="text-primary/70">"category":</span> <span className="text-green-300">"{category}"</span></div>
                    <div><span className="text-primary/70">"tflops":</span> <span className="text-yellow-300">{tflops || "100"}</span></div>
                    <div><span className="text-primary/70">"price":</span> <span className="text-yellow-300">{price || "500"}</span></div>
                    <div><span className="text-primary/70">"network":</span> <span className="text-green-300">"solana-devnet"</span></div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 font-orbitron text-[9px] tracking-wider uppercase" onClick={() => setStep("details")}>
                    {t.createAgent.back}
                  </Button>
                  <Button
                    className="flex-1 font-orbitron text-[9px] tracking-wider uppercase"
                    onClick={() => setStep("confirm")}
                    data-testid="button-next-confirm"
                    style={{ background: "linear-gradient(135deg, #6B46C1, #4C1D95)" }}
                  >
                    {t.createAgent.reviewMint}
                  </Button>
                </div>
              </motion.div>
            )}

            {step === "confirm" && (
              <motion.div
                key="confirm"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="p-4 rounded-md bg-primary/5 border border-primary/20 space-y-3">
                  <div className="font-orbitron text-[9px] text-muted-foreground/60 uppercase tracking-widest">
                    {t.createAgent.deploymentSummary}
                  </div>
                  {[
                    { label: t.createAgent.name, value: name },
                    { label: t.createAgent.category, value: category },
                    { label: t.createAgent.tflops, value: `${tflops || "100"} TFLOPS` },
                    { label: t.createAgent.listingPrice, value: `${price || "500"} $CNOVA` },
                    { label: t.createAgent.programID, value: "CNovAGENT...1111" },
                    { label: t.createAgent.network, value: "Solana Devnet" },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between items-center">
                      <span className="font-orbitron text-[9px] text-muted-foreground/60 uppercase tracking-wider">{label}</span>
                      <span className="font-orbitron text-[10px] text-foreground font-semibold">{value}</span>
                    </div>
                  ))}
                </div>

                <div className="p-3 rounded-md bg-yellow-500/5 border border-yellow-500/20">
                  <div className="font-orbitron text-[9px] text-yellow-400 uppercase tracking-widest">
                    Gas Estimate: ~0.000005 SOL
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 font-orbitron text-[9px] tracking-wider uppercase" onClick={() => setStep("metadata")}>
                    {t.createAgent.back}
                  </Button>
                  <Button
                    className="flex-1 font-orbitron text-[9px] tracking-wider uppercase"
                    onClick={handleMint}
                    disabled={isLoading}
                    data-testid="button-mint-agent"
                    style={{ background: "linear-gradient(135deg, #6B46C1, #4C1D95)" }}
                  >
                    {isLoading ? (
                      <><RotateCcw className="w-3 h-3 mr-1 animate-spin" />{t.createAgent.minting}</>
                    ) : (
                      <><Sparkles className="w-3 h-3 mr-1" />{t.createAgent.mint}</>
                    )}
                  </Button>
                </div>
              </motion.div>
            )}

            {step === "success" && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-4 space-y-4"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", delay: 0.2 }}
                  className="w-16 h-16 rounded-full bg-green-400/20 border border-green-400/40 flex items-center justify-center mx-auto"
                >
                  <CheckCircle className="w-8 h-8 text-green-400" />
                </motion.div>
                <div>
                  <div className="font-orbitron text-lg font-bold text-foreground uppercase tracking-wider mb-1">
                    {t.createAgent.agentDeployed}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {name} {t.createAgent.agentDeployedDesc}
                  </div>
                </div>
                {txSignature && (
                  <div className="p-3 rounded-md bg-primary/5 border border-primary/15">
                    <div className="font-orbitron text-[8px] text-muted-foreground/60 uppercase tracking-widest mb-1">
                      {t.createAgent.transaction}
                    </div>
                    <div className="font-mono text-[9px] text-primary break-all">{txSignature}</div>
                  </div>
                )}
                <Button
                  className="w-full font-orbitron text-[10px] tracking-wider uppercase"
                  onClick={handleClose}
                  data-testid="button-close-success"
                  style={{ background: "linear-gradient(135deg, #6B46C1, #4C1D95)" }}
                >
                  {t.createAgent.viewMyAgents}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
