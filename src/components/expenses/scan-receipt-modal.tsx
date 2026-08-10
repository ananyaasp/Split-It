"use client";

import { useState, useRef, useCallback } from "react";

interface ScanResult {
  merchant: string | null;
  items: { name: string; amount: number }[];
  tax: number;
  total: number;
  scansRemaining: number;
}

interface ScanReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onItemsExtracted: (items: { name: string; amount: number }[], tax?: number, merchant?: string | null) => void;
  currency: string;
}

export function ScanReceiptModal({
  isOpen,
  onClose,
  onItemsExtracted,
  currency,
}: ScanReceiptModalProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>("image/jpeg");
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file (JPG, PNG, or WebP).");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("Image must be smaller than 10MB.");
      return;
    }

    setError("");
    setResult(null);
    setMimeType(file.type);

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setPreview(dataUrl);
      // Extract base64 data (remove data:image/...;base64, prefix)
      const base64 = dataUrl.split(",")[1];
      setImageBase64(base64);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleScan = async () => {
    if (!imageBase64) return;
    setScanning(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/ai/scan-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, mimeType }),
      });

      let data: any;
      try {
        data = await res.json();
      } catch {
        throw new Error("Server error. Please try again.");
      }

      if (!res.ok) throw new Error(data.error || "Scan failed");

      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setScanning(false);
    }
  };

  const handleDemo = async () => {
    setScanning(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/ai/scan-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ demo: true }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Demo failed");
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setScanning(false);
    }
  };

  const handleUseItems = () => {
    if (!result) return;
    onItemsExtracted(result.items, result.tax || 0, result.merchant);
    handleReset();
    onClose();
  };

  const handleReset = () => {
    setPreview(null);
    setImageBase64(null);
    setError("");
    setResult(null);
    setScanning(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
              📷 Scan Receipt with AI
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Upload a photo of your bill to auto-extract line items
            </p>
          </div>
          <button
            onClick={() => {
              handleReset();
              onClose();
            }}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Error */}
          {error && (
            <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300 border border-red-200 dark:border-red-900 space-y-3">
              <div className="font-semibold flex items-center gap-2">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
              <div className="pt-2 border-t border-red-200/60 dark:border-red-900/60 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleDemo}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 transition-colors shadow-sm"
                >
                  ⚡ Try Demo Mode (Instant Test)
                </button>
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-red-300 dark:border-red-800 px-3 py-1.5 text-xs font-medium text-red-800 dark:text-red-200 hover:bg-red-100/50 dark:hover:bg-red-900/40 transition-colors"
                >
                  🔑 Get Free Gemini Key
                </a>
              </div>
            </div>
          )}

          {/* Upload Area */}
          {!preview && !result && (
            <div className="space-y-3">
              <div
                onDrop={handleDrop}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onClick={() => fileInputRef.current?.click()}
                className={`cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-all ${
                  isDragOver
                    ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20"
                    : "border-zinc-300 bg-zinc-50/50 hover:border-emerald-400 hover:bg-emerald-50/30 dark:border-zinc-700 dark:bg-zinc-800/30 dark:hover:border-emerald-600"
                }`}
              >
                <div className="text-4xl mb-3">📸</div>
                <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                  Drop your receipt image here
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                  or click to browse files (JPG, PNG, WebP · Max 10MB)
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFile(file);
                  }}
                  className="hidden"
                />
              </div>

              <div className="flex items-center gap-3 my-2">
                <div className="h-px bg-zinc-200 dark:bg-zinc-800 flex-1" />
                <span className="text-xs font-semibold text-zinc-400 uppercase">OR</span>
                <div className="h-px bg-zinc-200 dark:bg-zinc-800 flex-1" />
              </div>

              <button
                type="button"
                onClick={handleDemo}
                disabled={scanning}
                className="w-full rounded-xl border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 p-3 text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100/60 dark:hover:bg-emerald-900/40 transition-colors flex items-center justify-center gap-2"
              >
                ⚡ Try Demo Receipt Parser (Instant Test)
              </button>
            </div>
          )}

          {/* Image Preview */}
          {preview && !result && (
            <div className="space-y-4">
              <div className="relative rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800">
                <img
                  src={preview}
                  alt="Receipt preview"
                  className="w-full max-h-72 object-contain"
                />
                <button
                  onClick={handleReset}
                  className="absolute top-2 right-2 rounded-lg bg-black/50 px-2 py-1 text-xs text-white hover:bg-black/70"
                >
                  ✕ Remove
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleScan}
                  disabled={scanning}
                  className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition-all hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {scanning ? (
                    <>
                      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Scanning Receipt...
                    </>
                  ) : (
                    <>🤖 Extract Line Items</>
                  )}
                </button>
                <button
                  onClick={handleDemo}
                  disabled={scanning}
                  title="Use sample data if API fails"
                  className="rounded-xl border border-zinc-300 dark:border-zinc-700 px-3 py-3 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  ⚡ Demo Mode
                </button>
              </div>
            </div>
          )}

          {/* Scan Results */}
          {result && (
            <div className="space-y-4">
              {/* Merchant */}
              {result.merchant && (
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 px-4 py-3">
                  <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                    Merchant Detected
                  </p>
                  <p className="font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">
                    {result.merchant}
                  </p>
                </div>
              )}

              {/* Items Table */}
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                <div className="bg-zinc-50 dark:bg-zinc-800/50 px-4 py-2.5 border-b border-zinc-200 dark:border-zinc-800">
                  <p className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wide">
                    Extracted Items ({result.items.length})
                  </p>
                </div>
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {result.items.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between px-4 py-3"
                    >
                      <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {item.name}
                      </span>
                      <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                        {currency}
                        {item.amount.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
                {(result.tax > 0 || result.total > 0) && (
                  <div className="bg-zinc-50 dark:bg-zinc-800/50 px-4 py-2.5 border-t border-zinc-200 dark:border-zinc-800 space-y-1">
                    {result.tax > 0 && (
                      <div className="flex justify-between text-xs text-zinc-500">
                        <span>Tax / Service Charge</span>
                        <span>
                          {currency}
                          {result.tax.toLocaleString()}
                        </span>
                      </div>
                    )}
                    {result.total > 0 && (
                      <div className="flex justify-between text-sm font-bold text-zinc-900 dark:text-zinc-100">
                        <span>Total</span>
                        <span>
                          {currency}
                          {result.total.toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Scans Remaining */}
              <p className="text-[11px] text-zinc-400 text-center">
                {result.scansRemaining} AI scans remaining today
              </p>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleReset}
                  className="flex-1 rounded-xl border border-zinc-300 dark:border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  Scan Another
                </button>
                <button
                  onClick={handleUseItems}
                  className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-500 transition-colors"
                >
                  ✓ Use These Items
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
