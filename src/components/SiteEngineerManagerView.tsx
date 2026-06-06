/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Calendar, Trash2, Pencil, Sparkles, Loader2, Download, Search, 
  CloudUpload, HardHat, FileSpreadsheet, Plus, X, ArrowUpRight, ArrowDownLeft 
} from 'lucide-react';
import { Employee, Transaction, Project } from '../types';
import { bulkDeleteDocuments } from '../lib/db';

interface SiteEngineerProps {
  siteEngineers: Employee[];
  transactions: Transaction[];
  currentProjectId: string | null;
  availableProjects: Project[];
  activeProject?: Project | null;
  onSave: (collection: string, id: string | null, data: any) => Promise<string>;
  onDelete: (collection: string, id: string) => Promise<void>;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export const SiteEngineerManagerView: React.FC<SiteEngineerProps> = ({
  siteEngineers,
  transactions,
  currentProjectId,
  availableProjects,
  activeProject,
  onSave,
  onDelete,
  showToast
}) => {
  // Form input states
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0]);
  const [txType, setTxType] = useState<'ထုတ်ပေးငွေ (Issued)' | 'ကားခ (Transport)' | 'အထွေထွေ (Utility)'>('ထုတ်ပေးငွေ (Issued)');
  const [txProjectId, setTxProjectId] = useState(currentProjectId || 'global');
  const [txEngineerName, setTxEngineerName] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [remark, setRemark] = useState('');
  
  // App navigation-related states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterName, setFilterName] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [localConfirm, setLocalConfirm] = useState<{
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
  } | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisReport, setAnalysisReport] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  // Default dropdown selection synchronization
  useEffect(() => {
    if (currentProjectId) {
      setTxProjectId(currentProjectId);
    }
  }, [currentProjectId]);

  useEffect(() => {
    if (siteEngineers.length > 0 && !txEngineerName) {
      setTxEngineerName(siteEngineers[0].name);
    }
  }, [siteEngineers, txEngineerName]);

  // Pre-fill Name check on active projects or fallback names if list is empty
  const engineerOptions = useMemo(() => {
    const list = new Set<string>();
    // Default demo names from screenshot
    list.add("Ingyin");
    list.add("Ko Win Naing (Site Lead)");
    list.add("Maung Maung Oo");
    siteEngineers.forEach(e => {
      if (e.name) list.add(e.name);
    });
    return Array.from(list);
  }, [siteEngineers]);

  useEffect(() => {
    if (!txEngineerName && engineerOptions.length > 0) {
      setTxEngineerName(engineerOptions[0]);
    }
  }, [engineerOptions, txEngineerName]);

  // Filter site engineer transactions specifically
  const siteEngineerTransactions = useMemo(() => {
    // Collect transactions that belong to 'Site Engineer' category
    let list = transactions.filter(t => t.category === 'Site Engineer');

    // Filter by project
    if (currentProjectId && currentProjectId !== 'global') {
      list = list.filter(t => t.projectId === currentProjectId);
    }

    // Filter by personal name
    if (filterName !== 'All') {
      list = list.filter(t => t.name === filterName);
    }

    // Filter by search query (checks item name, description/item, or remarks)
    if (searchQuery) {
      const lower = searchQuery.toLowerCase();
      list = list.filter(t => 
        (t.item || '').toLowerCase().includes(lower) || 
        (t.name || '').toLowerCase().includes(lower) || 
        (t.remark || '').toLowerCase().includes(lower)
      );
    }

    // Sort chronologically newest first
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, currentProjectId, filterName, searchQuery]);

  // Sync edit mode fields
  const handleEdit = (tx: Transaction) => {
    setEditingId(tx.id);
    setTxDate(tx.date);
    
    // Reverse-map entry type correctly
    if (tx.entry_type === 'ကားခ (Transport)' || tx.entry_type === 'Transport') {
      setTxType('ကားခ (Transport)');
    } else if (tx.entry_type === 'အထွေထွေ (Utility)' || tx.entry_type === 'Utility') {
      setTxType('အထွေထွေ (Utility)');
    } else {
      setTxType('ထုတ်ပေးငွေ (Issued)');
    }

    setTxProjectId(tx.projectId || currentProjectId || 'global');
    setTxEngineerName(tx.name || engineerOptions[0] || '');
    setDescription(tx.item || '');
    setAmount(String(Math.abs(tx.amount || 0)));
    setRemark(tx.remark || '');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setDescription('');
    setAmount('');
    setRemark('');
  };

  // Calculations for specific categories in Burmese
  const totals = useMemo(() => {
    let totalIssued = 0;
    let totalTransport = 0;
    let totalUtility = 0;

    siteEngineerTransactions.forEach(t => {
      const amt = Number(t.amount) || 0;
      const type = t.entry_type || '';

      if (type === 'ထုတ်ပေးငွေ (Issued)' || type === 'Issued' || amt > 0) {
        totalIssued += Math.abs(amt);
      } else if (type === 'ကားခ (Transport)' || type === 'Transport') {
        totalTransport += Math.abs(amt);
      } else if (type === 'အထွေထွေ (Utility)' || type === 'Utility') {
        totalUtility += Math.abs(amt);
      }
    });

    const balance = totalIssued - totalTransport - totalUtility;

    return {
      issued: totalIssued,
      transport: totalTransport,
      utility: totalUtility,
      balance: balance
    };
  }, [siteEngineerTransactions]);

  // Form submit callback
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txEngineerName) {
      showToast("ကျေးဇူးပြု၍ ဆိုက်အင်ဂျင်နီယာအမည် ရွေးချယ်ပါ *", "error");
      return;
    }
    if (!amount) {
      showToast("ကျေးဇူးပြု၍ ငွေပမာဏ ဖြည့်သွင်းပါ *", "error");
      return;
    }

    const numericAmount = Number(amount) || 0;
    // Positive if Issued, negative if expense
    const finalAmount = txType === 'ထုတ်ပေးငွေ (Issued)' ? Math.abs(numericAmount) : -Math.abs(numericAmount);

    const payload = {
      date: txDate,
      particular: description || txType,
      item: description || txType,
      entry_type: txType,
      name: txEngineerName,
      amount: finalAmount,
      remark: remark,
      projectId: txProjectId,
      category: 'Site Engineer',
      flow_type: txType === 'ထုတ်ပေးငွေ (Issued)' ? 'IN' : 'OUT',
      timestamp: new Date().toISOString()
    };

    try {
      await onSave('transactions', editingId, payload);
      showToast(editingId ? "ပြင်ဆင်သိမ်းဆည်းပြီးပါပြီ။" : "အသစ်ထည့်သွင်းခြင်း အောင်မြင်ပါသည်။", "success");
      
      // Reset form
      setEditingId(null);
      setDescription('');
      setAmount('');
      setRemark('');
    } catch (err) {
      console.error(err);
      showToast("သိမ်းဆည်းရာတွင် အမှားအယွင်းရှိပါသည်။", "error");
    }
  };

  // OCR scan doc using Gemini AI
  const handleVoucherScan = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    showToast("Voucher ကို AI စနစ်ဖြင့် ဖတ်ရှုနေပါသည်...", "success");

    const reader = new FileReader();
    reader.onload = async (event) => {
      const bData = (event.target?.result as string).split(',')[1];
      try {
        const prompt = `Task: Extract ledger detail from this site expense voucher:
        1. Description (The expense item like 'Taxi fare', 'Generator Diesel', 'Water bottle')
        2. Amount (raw number without commas)
        3. Simple categorization (Choose either 'Transport' or 'Utility')
        Return ONLY valid JSON like: {"description": "Diesel fuel", "amount": 25000, "category": "Utility"}`;

        const response = await fetch("/api/gemini/scan-doc", {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileData: bData, mimeType: file.type || "image/jpeg", prompt })
        });

        if (!response.ok) throw new Error("API scan failure");
        const res = await response.json();
        
        const cleanJSONText = res.text?.replace(/```json/gi, '').replace(/```/g, '').trim();
        const data = JSON.parse(cleanJSONText);

        if (data.description) setDescription(data.description);
        if (data.amount) setAmount(String(data.amount));
        if (data.category) {
          if (data.category.toLowerCase().includes('transport') || data.category.toLowerCase().includes('ကားခ')) {
            setTxType('ကားခ (Transport)');
          } else {
            setTxType('အထွေထွေ (Utility)');
          }
        }

        showToast("Voucher ဖတ်ရှုပြီးစီးပါပြီ။ ဖောင်တွင် အလိုအလျောက် ဖြည့်သွင်းပေးထားပါသည်။", "success");
      } catch (err) {
        console.error(err);
        showToast("AI Extraction တွင် အမှားအယွင်း ရှိခဲ့သည်", "error");
      } finally {
        setIsScanning(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // AI Ledger Analysis in Burmese
  const handleAnalyzeSiteLedger = async () => {
    if (siteEngineerTransactions.length === 0) {
      return showToast("Analyze ပြုလုပ်ရန် စာရင်းဒေတာ သိမ်းဆည်းထားခြင်းမရှိသေးပါ။", "error");
    }
    setIsAnalyzing(true);
    setAnalysisReport(null);
    showToast("ဆိုက်အင်ဂျင်နီယာ သုံးစွဲမှု စာရင်းဇယားကို AI (Gemini) အသုံးပြု၍ စစ်ဆေးနေပါသည်...", "success");

    try {
      const response = await fetch('/api/gemini/analyze-ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tabType: "Site Engineer Cash Ledger and Petty Cash Distribution",
          data: siteEngineerTransactions
        })
      });

      if (!response.ok) throw new Error("Failed to call analysis API");
      const res = await response.json();
      setAnalysisReport(res.text || "စစ်ဆေးချက် အစီရင်ခံစာ ထွက်ပေါ်မလာပါ။");
    } catch (err) {
      console.error(err);
      showToast("AI စစ်ဆေးခြင်းမအောင်မြင်ပါ", "error");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Export ledger to spreadsheet using dynamic SheetJS library
  const handleExport = () => {
    if (siteEngineerTransactions.length === 0) {
      return showToast("ဒေတာမရှိသဖြင့် Export ထုတ်၍မရပါ", "error");
    }
    try {
      const XLSX = (window as any).XLSX;
      if (!XLSX) {
        throw new Error("XLSX is not loaded");
      }

      const headers = ["အညွှန်း No.", "ရက်စွဲ (Date)", "အင်ဂျင်နီယာ (Engineer)", "အမျိုးအစား (Category)", "အကြောင်းအရာ (Description)", "ငွေပမာဏ (Amount MMK)", "မှတ်ချက် (Remark)"];
      const rows = siteEngineerTransactions.map((t, idx) => [
        siteEngineerTransactions.length - idx,
        t.date,
        t.name,
        t.entry_type || 'ထုတ်ပေးငွေ (Issued)',
        t.item || t.particular || '',
        t.amount,
        t.remark || ''
      ]);

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      XLSX.utils.book_append_sheet(wb, ws, "Site Engineer Ledger");
      
      const projNameClean = (activeProject?.projectName || currentProjectId || 'Global').replace(/[^a-zA-Z0-9]/g, '_');
      XLSX.writeFile(wb, `SiteEngineerLedger_${projNameClean}.xlsx`);
      showToast("Excel ဖိုင် ထုတ်ယူခြင်း အောင်မြင်ပါသည်။", "success");
    } catch (err) {
      console.error(err);
      showToast("Excel ထုတ်ယူခြင်း မအောင်မြင်ပါ", "error");
    }
  };

  // Helper to extract values from dynamic Excel sheet object columns case-insensitively
  const getRowVal = (row: any, candidateKeys: string[]): any => {
    if (!row || typeof row !== 'object') return undefined;
    const rowKeys = Object.keys(row);
    // Exact match block
    for (const key of rowKeys) {
      const kClean = key.trim().toLowerCase();
      for (const cand of candidateKeys) {
        if (kClean === cand.toLowerCase()) {
          return row[key];
        }
      }
    }
    // Substring or includes match block
    for (const key of rowKeys) {
      const kClean = key.trim().toLowerCase();
      for (const cand of candidateKeys) {
        if (kClean.includes(cand.toLowerCase()) || cand.toLowerCase().includes(kClean)) {
          return row[key];
        }
      }
    }
    return undefined;
  };

  // Import from Excel callback
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const XLSX = (window as any).XLSX;
        if (!XLSX) return showToast("Excel parser options are currently offline", "error");

        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const parsedRows: any[] = XLSX.utils.sheet_to_json(sheet);

        let count = 0;
        for (const row of parsedRows) {
          // 1. Get raw date and parse it safely (supports strings & Excel serial date numbers)
          const rawDate = getRowVal(row, ["date", "ရက်စွဲ"]);
          let finalDate = String(rawDate || '').trim();
          if (!finalDate) {
            finalDate = new Date().toISOString().split('T')[0];
          } else if (!isNaN(Number(finalDate)) && Number(finalDate) > 30000 && Number(finalDate) < 60000) {
            // Excel serial date format
            const excelEpoch = new Date(Date.UTC(1899, 11, 30));
            const days = Number(finalDate);
            excelEpoch.setUTCDate(excelEpoch.getUTCDate() + days);
            finalDate = excelEpoch.toISOString().split('T')[0];
          } else if (finalDate.includes('/')) {
            try {
              const d = new Date(finalDate);
              if (!isNaN(d.getTime())) {
                finalDate = d.toISOString().split('T')[0];
              }
            } catch (e) {}
          }

          // 2. Map project name to actual project ID if possible
          const rawProject = getRowVal(row, ["project", "ပရော့ဂျက်"]);
          let parsedProjectId = currentProjectId || 'global';
          if (rawProject) {
            const projStr = String(rawProject).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
            const matched = availableProjects.find(p => {
              const pIdNorm = p.id.toLowerCase().replace(/[^a-z0-9]/g, '');
              const pNameNorm = p.projectName.toLowerCase().replace(/[^a-z0-9]/g, '');
              return pIdNorm === projStr || pNameNorm === projStr || pNameNorm.includes(projStr) || projStr.includes(pNameNorm);
            });
            if (matched) {
              parsedProjectId = matched.id;
            }
          }

          // 3. Engineer name (supports Person, Engineer, name, etc.)
          const rawName = getRowVal(row, ["person", "engineer", "name", "အင်ဂျင်နီယာ", "အမည်", "staff"]);
          const finalName = String(rawName || '').trim() || engineerOptions[0] || "Unknown";

          // 4. Entry Type & flow mapper (spent_utility, spent_transport, issued)
          const rawCategory = getRowVal(row, ["entry type", "entry_type", "category", "type", "အမျိုးအစား"]);
          const typeStr = String(rawCategory || '').toLowerCase().trim();
          
          let finalEntryType: 'ထုတ်ပေးငွေ (Issued)' | 'ကားခ (Transport)' | 'အထွေထွေ (Utility)' = 'ထုတ်ပေးငွေ (Issued)';
          let finalFlowType: 'IN' | 'OUT' = 'IN';

          if (typeStr.includes('spent_utility') || typeStr.includes('utility') || typeStr.includes('spent utility') || typeStr.includes('အထွေထွေ')) {
            finalEntryType = 'အထွေထွေ (Utility)';
            finalFlowType = 'OUT';
          } else if (typeStr.includes('spent_transport') || typeStr.includes('transport') || typeStr.includes('spent transport') || typeStr.includes('ကားခ')) {
            finalEntryType = 'ကားခ (Transport)';
            finalFlowType = 'OUT';
          } else if (typeStr.includes('issued') || typeStr.includes('allotment') || typeStr.includes('ထုတ်ပေးငွေ')) {
            finalEntryType = 'ထုတ်ပေးငွေ (Issued)';
            finalFlowType = 'IN';
          }

          // 5. Amount parsing (handles commas, currency signs, and maps negative sign for expense, positive for allotment)
          const rawAmount = getRowVal(row, ["final amount", "final_amount", "amount", "ငွေပမာဏ", "original_amount"]);
          const cleanAmtStr = String(rawAmount || '').replace(/[^0-9.-]/g, '');
          const absAmount = Math.abs(parseFloat(cleanAmtStr) || 0);
          const finalAmount = finalFlowType === 'IN' ? absAmount : -absAmount;

          // 6. Description extraction (handles item/des, item, description, and falls back to stage/job type)
          const rawDesc = getRowVal(row, ["item / des", "item_des", "item/des", "item", "description", "particular", "stage", "job type", "အကြောင်းအရာ"]);
          let finalDesc = String(rawDesc || '').trim();
          if (!finalDesc || finalDesc === '-') {
            const rawStage = getRowVal(row, ["stage"]);
            const rawJobType = getRowVal(row, ["job type", "job_type"]);
            const parts = [];
            if (rawStage && String(rawStage).trim() !== '-') parts.push(String(rawStage).trim());
            if (rawJobType && String(rawJobType).trim() !== '-') parts.push(String(rawJobType).trim());
            if (parts.length > 0) {
              finalDesc = parts.join(' - ');
            } else {
              finalDesc = finalEntryType;
            }
          }

          // 7. Remark extraction
          const rawRemark = getRowVal(row, ["remark", "မှတ်ချက်"]);
          const finalRemark = String(rawRemark || '').trim() === '-' ? '' : String(rawRemark || '').trim();

          const payload = {
            date: finalDate,
            particular: finalDesc,
            item: finalDesc,
            entry_type: finalEntryType,
            name: finalName,
            amount: finalAmount,
            remark: finalRemark,
            projectId: parsedProjectId,
            category: 'Site Engineer',
            flow_type: finalFlowType,
            timestamp: new Date().toISOString()
          };

          await onSave('transactions', null, payload);
          count++;
        }

        showToast(`အောင်မြင်စွာ စာရင်းသွင်းသွင်းပြီးပါပြီ။ (မူရင်းလိုင်းအရေအတွက်: ${count})`, "success");
      } catch (err) {
        console.error(err);
        showToast("ဖိုင်ဖတ်ရှုရာတွင် အမှားအယွင်းရှိပါသည်", "error");
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleDeleteAll = () => {
    const list = siteEngineerTransactions;
    if (list.length === 0) return;

    setLocalConfirm({
      title: "စာရင်းအားလုံးဖျက်ရန် သေချာပါသလား?",
      message: `လက်ရှိ Site Engineer Transactions စာရင်းအားလုံး (${list.length} ခု) ကို ဖျက်ရန် သေချာပါသလား?\n\nဤလုပ်ဆောင်ချက်သည် ပြန်ပြင်၍မရနိုင်ပါ။`,
      onConfirm: async () => {
        showToast("စာရင်းအားလုံးကို ဖျက်ဆီးနေပါသည်...", "success");
        try {
          await bulkDeleteDocuments('transactions', list.map(t => t.id));
          showToast("စာရင်းအားလုံး ဖျက်ဆီးပြီးပါပြီ။", "success");
        } catch (err) {
          console.error("Bulk delete site engineer tx failures", err);
          showToast("ဖျက်သိမ်းခြင်း မအောင်မြင်ပါ။", "error");
        }
      }
    });
  };

  const getProjectName = (projId: string) => {
    if (projId === 'global') return 'Office / General (ရုံး)';
    const found = availableProjects.find(p => p.id === projId);
    return found ? found.projectName : projId;
  };

  return (
    <div className="space-y-6">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <h2 className="text-xl font-black text-white uppercase tracking-tight">Site Engineer</h2>
          <p className="text-xs text-slate-500 mt-1 font-sans">
            Project: {activeProject?.projectName || getProjectName(currentProjectId || 'global')} • {siteEngineerTransactions.length} Transactions
          </p>
        </div>

        {/* AI Action Header Pill */}
        <button 
          onClick={handleAnalyzeSiteLedger} 
          disabled={isAnalyzing} 
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-black px-5 py-2.5 rounded-full text-xs shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2 self-start md:self-auto uppercase tracking-wider select-none active:scale-95"
        >
          {isAnalyzing ? (
            <Loader2 className="animate-spin text-white" size={14} />
          ) : (
            <Sparkles className="text-yellow-300 animate-pulse" size={14} />
          )}
          <span>AI ဖြင့် စစ်ဆေးမည်</span>
        </button>
      </div>

      {/* AI Analysis Result Notice */}
      {analysisReport && (
        <div className="bg-indigo-950/20 border border-indigo-500/30 p-5 rounded-2xl md:rounded-3xl relative animate-in fade-in duration-200">
          <button 
            onClick={() => setAnalysisReport(null)} 
            className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="text-yellow-300" size={18} />
            <h4 className="font-extrabold text-sm text-indigo-300 uppercase tracking-wide">AI စစ်ဆေးချက် အလိုအလျောက် သုံးသပ်ချက်</h4>
          </div>
          <div className="text-slate-300 text-xs md:text-sm whitespace-pre-wrap leading-relaxed font-sans font-medium">
            {analysisReport}
          </div>
        </div>
      )}

      {/* ADD NEW RECORD Input Panel */}
      <div className="bg-[#0b1329] border border-slate-800/80 p-5 md:p-8 rounded-2xl md:rounded-3xl shadow-xl relative overflow-hidden">
        
        {/* Pane Toolbar Row */}
        <div className="flex justify-between items-center mb-6 border-b border-slate-800/60 pb-3">
          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
            {editingId ? 'Edit Record (ပြင်ဆင်ရန်)' : 'ADD NEW RECORD'}
          </h4>
          
          <div className="flex items-center gap-3">
            {/* Real OCR scan buttons */}
            <input 
              type="file" 
              ref={fileInputRef} 
              accept="image/*" 
              onChange={handleVoucherScan} 
              className="hidden" 
            />
            <button 
              type="button" 
              onClick={() => fileInputRef.current?.click()} 
              className="border border-emerald-500/50 hover:bg-emerald-500/10 text-emerald-400 px-4 py-2 rounded-full text-[10px] font-black tracking-widest transition-all select-none flex items-center gap-1.5 hover:scale-105 active:scale-95"
            >
              <Sparkles size={12} className="text-emerald-400 animate-pulse" /> SCAN VOUCHER
            </button>
            {editingId && (
              <button 
                type="button" 
                onClick={handleCancelEdit} 
                className="text-[10px] font-extrabold text-rose-500 hover:underline px-3 py-1.5 border border-rose-500/20 rounded-full bg-rose-500/5"
              >
                Cancel Edit
              </button>
            )}
          </div>
        </div>

        {isScanning && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center text-emerald-400 font-sans">
            <Loader2 size={32} className="animate-spin mb-3 text-emerald-400" />
            <p className="font-bold text-sm tracking-widest uppercase">Extracting Details from Voucher via Gemini AI...</p>
          </div>
        )}

        {/* Input Form Fields */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Flexbox Form Row 1: compact styling */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Date field */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest font-sans">Date</label>
              <input 
                type="date" 
                required 
                value={txDate} 
                onChange={e => setTxDate(e.target.value)} 
                className="bg-slate-950/80 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-white text-xs outline-none w-full font-bold font-mono" 
              />
            </div>

            {/* Type Selector Dropdown */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest font-sans">Transaction Type / Category</label>
              <select 
                value={txType} 
                onChange={e => setTxType(e.target.value as any)} 
                className="bg-slate-950/80 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-white text-xs outline-none w-full font-bold cursor-pointer"
              >
                <option value="ထုတ်ပေးငွေ (Issued)">ထုတ်ပေးငွေ (Issued)</option>
                <option value="ကားခ (Transport)">ကားခ (Transport)</option>
                <option value="အထွေထွေ (Utility)">အထွေထွေ (Utility)</option>
              </select>
            </div>

            {/* Project Dropdown Selector */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest font-sans">Project</label>
              <select 
                value={txProjectId} 
                onChange={e => setTxProjectId(e.target.value)} 
                className="bg-slate-950/80 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-white text-xs outline-none w-full font-bold cursor-pointer"
              >
                <option value="global">Office / General (ရုံး)</option>
                {availableProjects.map(p => (
                  <option key={p.id} value={p.id}>{p.projectName}</option>
                ))}
              </select>
            </div>

            {/* Name / Engineer Dropdown Selector */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest font-sans">အမည်ရွေးပါ *</label>
              <select 
                value={txEngineerName}
                onChange={e => setTxEngineerName(e.target.value)} 
                className="bg-slate-950/80 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-white text-xs outline-none w-full font-bold cursor-pointer"
              >
                {engineerOptions.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>

          </div>

          {/* Flexbox Form Row 2: remaining inputs aligned with SAVE buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end pt-1">
            
            {/* Description Details Input */}
            <div className="flex flex-col gap-1 sm:col-span-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest font-sans">Description (အကြောင်းအရာ)</label>
              <input 
                type="text" 
                placeholder="ဥပမာ။ ခရီးစရိတ်၊ ဒီဇယ်ဆီ" 
                value={description} 
                onChange={e => setDescription(e.target.value)} 
                className="bg-slate-950/80 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-white text-xs outline-none w-full font-bold" 
              />
            </div>

            {/* Amount Input */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest font-sans">Amount (MMK)*</label>
              <input 
                type="text" 
                placeholder="MMK အမောင့်ထည့်ရန်" 
                required
                value={amount} 
                onChange={e => setAmount(e.target.value)} 
                className="bg-slate-950/80 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-emerald-400 font-mono text-xs font-bold outline-none w-full text-right pr-4" 
              />
            </div>

            {/* Remark Input */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest font-sans">Remark (မှတ်ချက် - မဖြစ်မနေမဟုတ်ပါ)</label>
              <input 
                type="text" 
                placeholder="မှတ်ချက်ဖြည့်သွင်းရန်" 
                value={remark} 
                onChange={e => setRemark(e.target.value)} 
                className="bg-slate-950/80 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-white text-xs outline-none w-full font-bold" 
              />
            </div>

            {/* SAVE Pill Green Button */}
            <div className="flex">
              <button 
                type="submit" 
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold px-5 py-3 rounded-xl text-xs shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:scale-[1.02] active:scale-95 transition-all uppercase tracking-wider leading-none w-full flex items-center justify-center text-center"
              >
                SAVE
              </button>
            </div>

          </div>

        </form>
      </div>

      {/* Ledger Filter & Search Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        
        {/* Toolbar Header Controls */}
        <div className="p-4 bg-slate-950/50 border-b border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          
          <div className="flex items-center gap-3 flex-wrap">
            {/* Engineer Name Dropdown Selector */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest select-none">NAME:</span>
              <select 
                value={filterName} 
                onChange={e => setFilterName(e.target.value)} 
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-white text-xs outline-none font-bold cursor-pointer"
              >
                <option value="All">All Engineers</option>
                {engineerOptions.map(name => (
                  <option key={`filter-${name}`} value={name}>{name}</option>
                ))}
              </select>
            </div>

            {/* Inline search box */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={13} />
              <input 
                placeholder="ရှာဖွေရန်..." 
                value={searchQuery} 
                onChange={e => setSearchQuery(e.target.value)} 
                className="bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-4 py-1.5 text-xs text-white outline-none focus:border-indigo-500 font-sans" 
              />
            </div>
          </div>

          <div className="flex gap-2 items-center justify-end">
            {/* Import Button */}
            <input 
              type="file" 
              ref={importInputRef} 
              accept=".xlsx, .xls, .csv" 
              onChange={handleImport} 
              className="hidden" 
            />
            <button 
              onClick={() => importInputRef.current?.click()} 
              className="bg-slate-850 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 select-none hover:scale-105 active:scale-95"
            >
              <CloudUpload size={13} /> <span>Import</span>
            </button>
            {/* Export Button */}
            <button 
              onClick={handleExport} 
              className="bg-slate-850 hover:bg-slate-800 text-emerald-400 hover:text-white border border-slate-800 px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 select-none hover:scale-105 active:scale-95"
            >
              <Download size={13} /> <span>Export</span>
            </button>
            {/* Delete All Button */}
            {siteEngineerTransactions.length > 0 && (
              <button 
                onClick={handleDeleteAll}
                className="bg-rose-950/40 hover:bg-rose-900 border border-rose-800/80 text-rose-400 hover:text-rose-200 px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 select-none hover:scale-105 active:scale-95 cursor-pointer"
                title="လုပ်ငန်းမှ မှတ်တမ်းအားလုံးကို ဖျက်ဆီးမည်"
              >
                <Trash2 size={13} /> <span>Delete All ({siteEngineerTransactions.length})</span>
              </button>
            )}
          </div>

        </div>

        {/* Dynamic Ledger Transactions Table */}
        <div className="overflow-x-auto overflow-y-auto max-h-[50vh] custom-scrollbar relative">
          <table className="w-full text-left whitespace-nowrap min-w-[900px]">
            <thead className="bg-[#0b1f2e] text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-800 sticky top-0 z-10 select-none">
              <tr>
                <th className="px-5 py-4 w-16 text-center">NO.</th>
                <th className="px-5 py-4 w-32">DATE</th>
                <th className="px-5 py-4">DETAILS</th>
                <th className="px-5 py-4 text-right">AMOUNT (MMK)</th>
                <th className="px-5 py-4 text-center w-24">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {siteEngineerTransactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-slate-600 italic text-sm">
                    No site engineer transactions recorded for this context.
                  </td>
                </tr>
              ) : (
                siteEngineerTransactions.map((t, idx) => {
                  const absoluteNo = siteEngineerTransactions.length - idx;
                  const amtVal = Number(t.amount) || 0;
                  const isExpense = amtVal < 0;

                  return (
                    <tr key={t.id} className="hover:bg-slate-800/20 transition-all font-sans text-xs">
                      
                      {/* NO. */}
                      <td className="px-5 py-4 text-center text-slate-500 font-mono font-bold">
                        {absoluteNo}
                      </td>

                      {/* DATE */}
                      <td className="px-5 py-4 text-slate-400 font-mono">
                        <span className="inline-flex items-center gap-1.5">
                          <Calendar size={13} className="text-slate-500 shrink-0" />
                          <span>{t.date}</span>
                        </span>
                      </td>

                      {/* DETAILS */}
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-1">
                          <span className="font-bold text-indigo-400 text-sm hover:underline hover:cursor-pointer">
                            {t.name || 'Unknown Engineer'}
                          </span>
                          <span className="text-[9px] font-black bg-yellow-500/5 border border-yellow-500/15 text-yellow-500 px-1.5 py-0.5 rounded uppercase tracking-widest w-max select-none">
                            PROJECT: {getProjectName(t.projectId || 'global')}
                          </span>
                          {(t.item || t.particular) && (
                            <span className="text-slate-450 mt-0.5 font-sans font-medium text-[11px]">
                              Desc: {t.item || t.particular} {t.remark ? `(${t.remark})` : ''}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* AMOUNT (MMK) & Burmese Category Label */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex flex-col gap-0.5">
                          <span className={`font-mono text-sm font-black ${
                            isExpense ? 'text-rose-400' : 'text-emerald-400'
                          }`}>
                            {isExpense ? '' : '+'}{amtVal.toLocaleString()}
                          </span>
                          <span className="text-[10px] font-bold text-slate-500 font-sans tracking-wide">
                            {t.entry_type || 'ထုတ်ပေးငွေ (Issued)'}
                          </span>
                        </div>
                      </td>

                      {/* ACTION CONTROLS */}
                      <td className="px-5 py-4 text-center">
                        <div className="inline-flex gap-1.5 justify-center">
                          <button 
                            onClick={() => handleEdit(t)} 
                            className="p-1.5 text-slate-400 hover:text-indigo-400 bg-slate-800/40 rounded-lg border border-slate-700/35 transition-all hover:scale-105"
                          >
                            <Pencil size={11} />
                          </button>
                          <button 
                            onClick={() => onDelete('transactions', t.id)} 
                            className="p-1.5 text-slate-400 hover:text-rose-500 bg-slate-800/40 rounded-lg border border-slate-700/35 transition-all hover:scale-105"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Polished Budget Calculations Summary Footer (Single box attached, matching screenshot) */}
        <div className="p-5 md:p-8 bg-[#070b13] border-t border-slate-800 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 select-none font-sans">
          
          <div className="bg-slate-900/30 p-4 border border-slate-800/60 rounded-xl flex flex-col justify-between">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-0.5">
              စုစုပေါင်း ထုတ်ပေးငွေ (TOTAL ISSUED)
            </span>
            <div className="font-mono text-base font-extrabold text-blue-400 text-right mt-1.5">
              {totals.issued.toLocaleString()} Ks
            </div>
          </div>

          <div className="bg-slate-900/30 p-4 border border-slate-800/60 rounded-xl flex flex-col justify-between">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-0.5">
              ကားခ (Transport) Total Spent
            </span>
            <div className="font-mono text-base font-extrabold text-rose-400 text-right mt-1.5">
              - {totals.transport.toLocaleString()} Ks
            </div>
          </div>

          <div className="bg-slate-900/30 p-4 border border-slate-800/60 rounded-xl flex flex-col justify-between">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-0.5">
              အထွေထွေ (Utility) Total Spent
            </span>
            <div className="font-mono text-base font-extrabold text-rose-400 text-right mt-1.5">
              - {totals.utility.toLocaleString()} Ks
            </div>
          </div>

          <div className="bg-indigo-950/25 p-4 border border-indigo-500/15 rounded-xl flex flex-col justify-between">
            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest pl-0.5">
              လက်ကျန်ငွေ (BALANCE)
            </span>
            <div className="font-mono text-base font-black text-yellow-500 text-right mt-1.5">
              {totals.balance < 0 ? '-' : ''}{Math.abs(totals.balance).toLocaleString()} Ks
            </div>
          </div>

        </div>

       {localConfirm && (
         <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] animate-in fade-in duration-200">
           <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl relative space-y-4 animate-in zoom-in-95 duration-200">
             <div>
               <h4 className="font-bold text-white text-base font-display">{localConfirm.title}</h4>
             </div>
             <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-line font-sans">{localConfirm.message}</p>
             <div className="flex gap-3 justify-end pt-2">
               <button
                 onClick={() => setLocalConfirm(null)}
                 className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
               >
                 မဖျက်တော့ပါ
               </button>
               <button
                 onClick={async () => {
                   await localConfirm.onConfirm();
                   setLocalConfirm(null);
                 }}
                 className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg cursor-pointer"
               >
                 သေချာပေါက် ဖျက်မည်
               </button>
             </div>
           </div>
         </div>
       )}
      </div>

    </div>
  );
};
