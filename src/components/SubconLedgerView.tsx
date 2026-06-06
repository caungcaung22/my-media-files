/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef } from 'react';
import { 
  Pencil, Trash2, Database, Sparkles, Upload, Download, 
  Plus, Calendar, AlertCircle, CheckCircle2, ChevronRight, X, Eye
} from 'lucide-react';
import { Employee, Transaction } from '../types';

interface SubconLedgerProps {
  employees: Employee[];
  transactions: Transaction[];
  projects: any[];
  currentProjectId: string | null;
  onSaveSubcon: (collectionName: string, id: string | null, data: any) => Promise<string>;
  onDeleteSubcon: (collectionName: string, id: string) => Promise<void>;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export const SubconLedgerView: React.FC<SubconLedgerProps> = ({
  employees,
  transactions,
  projects,
  currentProjectId,
  onSaveSubcon,
  onDeleteSubcon,
  showToast
}) => {
  // Tabs State
  const [activeTab, setActiveTab] = useState<'payments' | 'contra' | 'return' | 'quotations'>('payments');

  // Subcontractor profiling states
  const [subName, setSubName] = useState('');
  const [subPosition, setSubPosition] = useState('');
  const [subContractAmount, setSubContractAmount] = useState('');
  const [subRemark, setSubRemark] = useState('');
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [localConfirm, setLocalConfirm] = useState<{
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
  } | null>(null);

  // Manage Extras / Addons states
  const [selectedAddonSubId, setSelectedAddonSubId] = useState<string | null>(null);
  const [addonName, setAddonName] = useState('');
  const [addonAmount, setAddonAmount] = useState('');

  // Transaction form states
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0]);
  const [txType, setTxType] = useState('1st Payment');
  const [customPaymentType, setCustomPaymentType] = useState('');
  const [selectedSubconId, setSelectedSubconId] = useState('');
  const [txJobType, setTxJobType] = useState('');
  const [txDescription, setTxDescription] = useState('');
  const [txAmount, setTxAmount] = useState('');
  const [txRemark, setTxRemark] = useState('');
  const [editingTxId, setEditingTxId] = useState<string | null>(null);

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSubconId, setFilterSubconId] = useState('All');

  // Import / Export files reference
  const fileInputRefForScan = useRef<HTMLInputElement>(null);
  const fileImportRef = useRef<HTMLInputElement>(null);

  // AI states
  const [isScanning, setIsScanning] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [showAiModal, setShowAiModal] = useState(false);

  // Quotation Worksheet states
  const [selectedQuoSubId, setSelectedQuoSubId] = useState('');
  const [quoItems, setQuoItems] = useState<any[]>([]);
  const [newQuoDesc, setNewQuoDesc] = useState('');
  const [newQuoQty, setNewQuoQty] = useState('');
  const [newQuoPrice, setNewQuoPrice] = useState('');
  const [newQuoDiscount, setNewQuoDiscount] = useState('');
  const [newQuoWorkType, setNewQuoWorkType] = useState('');

  const formatMoney = (val: any) => {
    if (val === undefined || val === null || val === '') return '';
    const clean = String(val).replace(/,/g, '');
    return Number(clean).toLocaleString('en-US');
  };

  const parseMoney = (val: any) => {
    return String(val).replace(/,/g, '');
  };

  // Active project data
  const activeProjName = useMemo(() => {
    return projects.find(p => p.id === currentProjectId)?.projectName || 'General / Global';
  }, [projects, currentProjectId]);

  // Registered Subcontractors specifically bound to this project
  const currentSubcontractors = useMemo(() => {
    return employees.filter(e => e.projectId === currentProjectId);
  }, [employees, currentProjectId]);

  // Subcontractor specific transactions
  const subconTransactions = useMemo(() => {
    return transactions.filter(t => {
      if (t.projectId !== currentProjectId) return false;
      
      // We align transactions that are explicitly associated with subcon payments or subcon tabs
      if (activeTab === 'payments') {
        return t.category === 'Subcon Payment';
      } else if (activeTab === 'contra') {
        return t.category === 'Subcon Contra';
      } else if (activeTab === 'return') {
        return t.category === 'Subcon Return';
      }
      return false;
    });
  }, [transactions, currentProjectId, activeTab]);

  // Grouped and sorted transactions
  const filteredTransactions = useMemo(() => {
    return subconTransactions.filter(t => {
      const matchSearch = 
        (t.particular || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.job_type || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.remark || '').toLowerCase().includes(searchQuery.toLowerCase());
      
      if (filterSubconId === 'All') return matchSearch;
      
      const subconRef = currentSubcontractors.find(s => s.id === filterSubconId);
      const matchesSubcon = subconRef && (t.subcon_name_ref === subconRef.name || t.particular?.includes(subconRef.name));
      return matchesSubcon && matchSearch;
    }).sort((a,b) => b.date.localeCompare(a.date));
  }, [subconTransactions, searchQuery, filterSubconId, currentSubcontractors]);

  // Aggregate stats helper
  const stats = useMemo(() => {
    const baseContract = currentSubcontractors.reduce((sum, s) => sum + (Number(s.contractAmount) || 0), 0);
    const additionalWorks = currentSubcontractors.reduce((sum, s) => {
      const worksSum = (s.additionalWorks || []).reduce((ws, w) => ws + (Number(w.amount) || 0), 0);
      return sum + worksSum;
    }, 0);
    const totalContract = baseContract + additionalWorks;

    // Direct payments total (derived from Payment Records tab)
    const directPayments = transactions
      .filter(t => t.projectId === currentProjectId && t.category === 'Subcon Payment')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    return {
      baseContract,
      additionalWorks,
      totalContract,
      totalPaid: directPayments,
      remaining: totalContract - directPayments
    };
  }, [currentSubcontractors, transactions, currentProjectId]);

  // Save/Edit/Delete Registered Subcontractor
  const handleRegisterSubconSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subName) return;

    try {
      const payload = {
        name: subName.trim(),
        position: subPosition.trim() || 'Subcontractor',
        contractAmount: Number(parseMoney(subContractAmount)) || 0,
        projectId: currentProjectId || 'global',
        additionalWorks: editingSubId ? (employees.find(e => e.id === editingSubId)?.additionalWorks || []) : [],
        quotationItems: editingSubId ? (employees.find(e => e.id === editingSubId)?.quotationItems || []) : [],
        remark: subRemark.trim()
      };

      await onSaveSubcon('subcon_names', editingSubId, payload);
      setSubName('');
      setSubPosition('');
      setSubContractAmount('');
      setSubRemark('');
      setEditingSubId(null);
      showToast(editingSubId ? "Subcontractor profile updated!" : "Subcontractor registered successfully Myanmar!", "success");
    } catch (err) {
      showToast("Error registering subcontractor profile", "error");
    }
  };

  const startEditSubcon = (sub: Employee) => {
    setEditingSubId(sub.id);
    setSubName(sub.name);
    setSubPosition(sub.position || '');
    setSubContractAmount(String(sub.contractAmount || ''));
    setSubRemark(sub.remark || '');
    setSelectedAddonSubId(null);
  };

  const handleDeleteSubcon = async (subId: string) => {
    setLocalConfirm({
      title: "ဆပ်ကွန်အချက်အလက်ကို ဖျက်မည်",
      message: "ဘတ်ဂျက်နှင့် ဆပ်ကွန်အချက်အလက်ကို ဖျက်ရန် သေချာပါသလား?",
      onConfirm: async () => {
        try {
          await onDeleteSubcon('subcon_names', subId);
          showToast("Subcontractor deleted successfully", "success");
        } catch (err) {
          showToast("Error deleting subcontractor", "error");
        }
      }
    });
  };

  // Log Extras / Addons
  const handleAddWorkOrder = async () => {
    if (!selectedAddonSubId || !addonName || !addonAmount) return;
    const sub = currentSubcontractors.find(s => s.id === selectedAddonSubId);
    if (!sub) return;

    try {
      const newAddon = {
        id: Math.random().toString(36).substring(2, 9),
        date: new Date().toISOString().split('T')[0],
        name: addonName.trim(),
        amount: Number(parseMoney(addonAmount)) || 0
      };

      const updatedWorks = [...(sub.additionalWorks || []), newAddon];
      const payload = {
        ...sub,
        additionalWorks: updatedWorks
      };

      await onSaveSubcon('subcon_names', sub.id, payload);
      setAddonName('');
      setAddonAmount('');
      showToast("Contract Extras log succeeded!", "success");
    } catch (err) {
      showToast("Error logging contract addon", "error");
    }
  };

  const handleDeleteAddon = async (sub: Employee, addonId: string) => {
    try {
      const updatedWorks = (sub.additionalWorks || []).filter(w => w.id !== addonId);
      const payload = {
        ...sub,
        additionalWorks: updatedWorks
      };
      await onSaveSubcon('subcon_names', sub.id, payload);
      showToast("Contract extra work order removed!", "success");
    } catch (err) {
      showToast("Error removing contractual work order", "error");
    }
  };

  // Save/Update Transaction Logs (Payments, Contra, Return Material)
  const handleSaveTxSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubconId || !txAmount) {
      showToast("ကျေးဇူးပြု၍ လိုအပ်သောအချက်အလက်များ ဖြည့်စွက်ပါ", "error");
      return;
    }

    const sub = currentSubcontractors.find(s => s.id === selectedSubconId);
    if (!sub) return;

    const actualPayoutType = txType === 'Custom Pips...' ? customPaymentType : txType;

    let transactionCategory = 'Subcon Payment';
    let flowType = 'OUT';
    if (activeTab === 'contra') {
      transactionCategory = 'Subcon Contra';
    } else if (activeTab === 'return') {
      transactionCategory = 'Subcon Return';
      flowType = 'IN';
    }

    try {
      const payload = {
        date: txDate,
        amount: Number(parseMoney(txAmount)) || 0,
        category: transactionCategory,
        flow_type: flowType,
        job_type: txJobType || sub.position || 'N/A',
        particular: `${sub.name} ${actualPayoutType}`.trim(),
        subcon_name_ref: sub.name,
        remark: txRemark.trim() || '-',
        projectId: currentProjectId || 'global'
      };

      await onSaveSubcon('transactions', editingTxId, payload);
      
      // Clean up fields
      setTxDate(new Date().toISOString().split('T')[0]);
      setTxType('1st Payment');
      setCustomPaymentType('');
      setSelectedSubconId('');
      setTxJobType('');
      setTxDescription('');
      setTxAmount('');
      setTxRemark('');
      setEditingTxId(null);
      showToast(editingTxId ? "စာရင်းပြင်ဆင်မှု ပြီးမြောက်ပါသည်" : "စာရင်းအသစ် သိမ်းဆည်းပြီးပါပြီ", "success");
    } catch (err) {
      showToast("စာရင်းသိမ်းဆည်းမှု မအောင်မြင်ပါ", "error");
    }
  };

  const startEditTx = (tx: Transaction) => {
    setEditingTxId(tx.id);
    setTxDate(tx.date);
    setTxAmount(String(tx.amount));
    setTxRemark(tx.remark || '');
    setTxJobType(tx.job_type || '');
    
    // Find subcontractor ref
    const subRef = currentSubcontractors.find(s => s.name === tx.subcon_name_ref || tx.particular?.includes(s.name));
    if (subRef) {
      setSelectedSubconId(subRef.id);
    }

    // Parse payment type from particular
    const plainPart = tx.particular || '';
    const cleanSubName = subRef ? subRef.name : '';
    const typePart = plainPart.replace(cleanSubName, '').trim();

    const standardTypes = ['1st Payment', '2nd Payment', '3rd Payment', '4th Payment', '5th Payment', '6th Payment', '7th Payment', 'Final Payment'];
    if (standardTypes.includes(typePart)) {
      setTxType(typePart);
      setCustomPaymentType('');
    } else if (typePart) {
      setTxType('Custom Pips...');
      setCustomPaymentType(typePart);
    } else {
      setTxType('1st Payment');
      setCustomPaymentType('');
    }
  };

  const handleDeleteTx = async (txId: string) => {
    setLocalConfirm({
      title: "စာရင်းမှတ်တမ်းကို ဖျက်မည်",
      message: "စာရင်းမှတ်တမ်းကို ဖျက်ရန် သေချာပါသလား?",
      onConfirm: async () => {
        try {
          await onDeleteSubcon('transactions', txId);
          showToast("စာရင်းဖျက်သိမ်းပြီးပါပြီ", "success");
        } catch (err) {
          showToast("Error deleting transaction log", "error");
        }
      }
    });
  };

  // Perform AI Ledger Audit Suggestions
  const handleAiAnalyze = async () => {
    setIsAnalyzing(true);
    setAiReport(null);
    setShowAiModal(true);
    try {
      const activeTextTab = 
        activeTab === 'payments' ? 'Payment Records & Contracts' : 
        activeTab === 'contra' ? 'Contra Purchase Ledger Deductions' : 
        activeTab === 'return' ? 'Materials Refund Return Inventory' : 'Bid Quotation List';

      const response = await fetch('/api/gemini/analyze-ledger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tabType: activeTextTab,
          data: filteredTransactions.map((t, i) => ({
            num: i+1,
            date: t.date,
            subcontractor: t.subcon_name_ref,
            particular: t.particular,
            amount: t.amount,
            job_type: t.job_type,
            remark: t.remark
          })),
          referencePrices: currentSubcontractors.map(s => ({
            name: s.name,
            trade: s.position,
            basePrice: s.contractAmount,
            extras: s.additionalWorks
          }))
        })
      });

      const parsed = await response.json();
      if (parsed?.text) {
        setAiReport(parsed.text);
      } else {
        setAiReport("Audit analytics report couldn't be evaluated currently.");
      }
    } catch (e: any) {
      setAiReport(`AI Error: ${e.message || 'Verification pipeline unavailable'}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // SCAN RECEIPT Slip for auto fill
  const handleScanReceiptFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    showToast("Receipt scanning initiated via Gemini AI...", "success");

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => {
          const raw = reader.result as string;
          resolve(raw.split(',')[1]);
        };
        reader.readAsDataURL(file);
      });

      const base64Data = await base64Promise;

      const triggerAnalysis = await fetch('/api/gemini/scan-doc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileData: base64Data,
          mimeType: file.type,
          prompt: `You are scanning a subcontractor ledger payment invoice or receipt slip.
Extract the following information as clean JSON:
- date: formatted format "YYYY-MM-DD"
- subcontractor: approximate match with one of these names: [${currentSubcontractors.map(s => `"${s.name}"`).join(', ')}] or extract raw name
- amount: integer value (parsed amount MMK)
- description: payment description (explain which payment, e.g. final or mobilization)
- trade: job type / position
- remark: comment or notebook text
Return ONLY a valid JSON object. Do not wrap in markdown or backticks.
Schema:
{
  "date": "YYYY-MM-DD",
  "subcontractor": "Name",
  "amount": 100000,
  "description": "Payment desc",
  "trade": "trade",
  "remark": "remark"
}`
        })
      });

      const parsedText = await triggerAnalysis.json();
      let extracted: any = {};
      try {
        const cleanJsonText = parsedText.text.replace(/```json/gi, '').replace(/```/g, '').trim();
        extracted = JSON.parse(cleanJsonText);
      } catch {
        extracted = {};
      }

      if (extracted.amount || extracted.subcontractor) {
        setTxDate(extracted.date || new Date().toISOString().split('T')[0]);
        setTxAmount(String(extracted.amount || ''));
        setTxRemark(extracted.remark || 'Scanned receipts file');
        setTxJobType(extracted.trade || '');
        
        // Match subcontractor name
        const match = currentSubcontractors.find(s => 
          s.name.toLowerCase().includes(String(extracted.subcontractor || '').toLowerCase()) ||
          String(extracted.subcontractor || '').toLowerCase().includes(s.name.toLowerCase())
        );
        if (match) setSelectedSubconId(match.id);

        if (extracted.description) {
          const standardTypes = ['1st Payment', '2nd Payment', '3rd Payment', '4th Payment', '5th Payment', '6th Payment', '7th Payment', 'Final Payment'];
          const matchedStandard = standardTypes.find(t => extracted.description.toLowerCase().includes(t.toLowerCase()));
          if (matchedStandard) {
            setTxType(matchedStandard);
          } else {
            setTxType('Custom Pips...');
            setCustomPaymentType(extracted.description);
          }
        }
        showToast("AI scanning successful! Form populated.", "success");
      } else {
        showToast("Could not recognize ledger data fields clearly. Please fill manually.", "error");
      }
    } catch (e) {
      showToast("Scanning failed. Standard service downtime limit.", "error");
    } finally {
      setIsScanning(false);
    }
  };

  // Import CSV / XLSX File Data
  const handleImportCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const XLSX = (window as any).XLSX;
        if (!XLSX) {
          showToast("Excel/CSV parser is currently offline.", "error");
          return;
        }
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        
        if (!rows || rows.length < 2) {
          showToast("ဝင်လာသောဖိုင်တွင် ဒေတာအလုံအလောက်မရှိပါ။", "error");
          return;
        }

        showToast("ဒေတာများကို ကူးယူထည့်သွင်းနေပါသည်...", "success");

        for (let i = 1; i < rows.length; i++) {
          const columns = rows[i];
          if (!columns || columns.length < 1) continue; 

          // Clean up the index values
          const date = String(columns[0] || '').trim() || new Date().toISOString().split('T')[0];
          const nameRef = String(columns[1] || '').trim();
          if (!nameRef) continue; 
          
          const detailPart = String(columns[2] || '').trim() || 'Imported payout';
          const amount = Number(columns[3]) || 0;
          const remarkCol = String(columns[4] || '').trim() || '-';
          const jobCol = String(columns[5] || '').trim() || 'Subcontractor';

          await onSaveSubcon('transactions', null, {
            date,
            amount,
            category: activeTab === 'payments' ? 'Subcon Payment' : activeTab === 'contra' ? 'Subcon Contra' : 'Subcon Return',
            flow_type: activeTab === 'return' ? 'IN' : 'OUT',
            particular: `${nameRef} ${detailPart}`.trim(),
            subcon_name_ref: nameRef,
            remark: remarkCol,
            job_type: jobCol,
            projectId: currentProjectId || 'global'
          });
        }
        showToast("ဖိုင်တွဲထည့်သွင်းခြင်း အောင်မြင်ပါသည်။", "success");
      } catch (err) {
        console.error("Import error:", err);
        showToast("ဖိုင်တွဲထည့်သွင်းရာတွင် အမှားအယွင်းရှိပါသည်။", "error");
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  // Export to Excel Sheet (.xlsx)
  const handleExportCsv = () => {
    if (filteredTransactions.length === 0) {
      showToast("စုဆောင်းထားသော ဒေတာမရှိသေးသဖြင့် Export လုပ်၍မရပါ", "error");
      return;
    }

    const XLSX = (window as any).XLSX;
    if (!XLSX) {
      showToast("Excel exporter is currently offline.", "error");
      return;
    }

    const headers = ["Date", "Subcontractor", "Details", "Amount (MMK)", "Remark", "Job Class"];
    const rows = filteredTransactions.map(t => [
      t.date,
      t.subcon_name_ref || 'N/A',
      t.particular || '',
      t.amount,
      t.remark || '-',
      t.job_type || ''
    ]);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    XLSX.utils.book_append_sheet(wb, ws, `${activeTab.toUpperCase()}`);
    XLSX.writeFile(wb, `SubconLedger_${activeTab}_Export.xlsx`);
    showToast("Excel (.xlsx) ဖိုင်အဖြစ် အောင်မြင်စွာ ထုတ်ယူပြီးပါပြီ။", "success");
  };

  // Quotation Spreadsheet Worksheets management
  const selectedQuoSubconDetails = useMemo(() => {
    return currentSubcontractors.find(s => s.id === selectedQuoSubId);
  }, [currentSubcontractors, selectedQuoSubId]);

  const loadQuotationHandler = (subconId: string) => {
    setSelectedQuoSubId(subconId);
    const s = currentSubcontractors.find(sc => sc.id === subconId);
    if (s) {
      setQuoItems(s.quotationItems || []);
    } else {
      setQuoItems([]);
    }
  };

  const handleAddQuoItem = async () => {
    if (!selectedQuoSubId || !newQuoDesc || !newQuoPrice) return;
    const s = currentSubcontractors.find(sc => sc.id === selectedQuoSubId);
    if (!s) return;

    try {
      const qtyVal = Number(newQuoQty) || 1;
      const priceVal = Number(parseMoney(newQuoPrice)) || 0;
      const discVal = Number(parseMoney(newQuoDiscount)) || 0;
      const subTotal = (qtyVal * priceVal) - discVal;

      const newItem = {
        id: Math.random().toString(36).substring(2, 9),
        item: newQuoDesc.trim(),
        qty: qtyVal,
        unit_price: priceVal,
        discount: discVal,
        amount: subTotal,
        original_amount: qtyVal * priceVal,
        work_type: newQuoWorkType.trim() || 'Core Scope'
      };

      const updatedQuos = [...quoItems, newItem];
      const payload = {
        ...s,
        quotationItems: updatedQuos
      };

      await onSaveSubcon('subcon_names', s.id, payload);
      setQuoItems(updatedQuos);
      setNewQuoDesc('');
      setNewQuoQty('');
      setNewQuoPrice('');
      setNewQuoDiscount('');
      setNewQuoWorkType('');
      showToast("Quotation bid item appended!", "success");
    } catch {
      showToast("Error appending quotation item", "error");
    }
  };

  const handleDeleteQuoItem = async (itemId: string) => {
    if (!selectedQuoSubId) return;
    const s = currentSubcontractors.find(sc => sc.id === selectedQuoSubId);
    if (!s) return;

    try {
      const updatedQuos = quoItems.filter(item => item.id !== itemId);
      const payload = { ...s, quotationItems: updatedQuos };
      await onSaveSubcon('subcon_names', s.id, payload);
      setQuoItems(updatedQuos);
      showToast("Quotation item removed successfully", "success");
    } catch {
      showToast("Failed removing quotation item", "error");
    }
  };

  const totalQuotationValue = useMemo(() => {
    return quoItems.reduce((acc, item) => acc + (Number(item.amount) || 0), 0);
  }, [quoItems]);

  return (
    <div className="space-y-6">
      
      {/* 1. Page Header with metadata & Active Analytics Button */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800/80 pb-4">
        <div>
          <h2 className="text-xl font-black text-white uppercase tracking-tight">Subcon Ledger</h2>
          <p className="text-xs text-slate-500 mt-1 font-sans">
            Project: <span className="text-slate-300 font-bold">{activeProjName}</span> • {subconTransactions.length} Transactions
          </p>
        </div>
        <button 
          onClick={handleAiAnalyze}
          disabled={isAnalyzing}
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[11px] py-2.5 px-4 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-all uppercase tracking-widest active:scale-95 disabled:opacity-50 mt-3 md:mt-0"
        >
          <Sparkles size={13} className="text-purple-300 animate-pulse" />
          {isAnalyzing ? "AI ဖြင့် စစ်ဆေးနေပါသည်..." : "AI ဖြင့် စစ်ဆေးမည်"}
        </button>
      </div>

      {/* 2. Subcontractor Card Profiling Creation Row */}
      <div className="bg-[#111c2a]/40 border border-slate-800/80 p-5 rounded-2xl shadow-lg">
        <h4 className="text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest">
          {editingSubId ? "Edit / Update Subcon card Profile (ဆပ်ကွန် ပြင်ဆင်ရန်)" : "Register Project Subcontractor (ဆပ်ကွန်လုပ်ငန်းရှင် အသစ်သွင်းရန်)"}
        </h4>
        
        <form onSubmit={handleRegisterSubconSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div className="flex flex-col gap-1 md:col-span-1">
            <input 
              placeholder="Subcon အမည်..." 
              required 
              value={subName} 
              onChange={e => setSubName(e.target.value)} 
              className="bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-indigo-500 placeholder-slate-500 h-10 w-full" 
            />
          </div>
          <div className="flex flex-col gap-1">
            <input 
              placeholder="ရာထူး (Position)" 
              required 
              value={subPosition} 
              onChange={e => setSubPosition(e.target.value)} 
              className="bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-indigo-500 placeholder-slate-500 h-10 w-full" 
            />
          </div>
          <div className="flex flex-col gap-1">
            <input 
              placeholder="Base Contract Amount (MMK)" 
              required 
              value={formatMoney(subContractAmount)} 
              onChange={e => {
                const raw = parseMoney(e.target.value);
                if (/^\d*$/.test(raw)) setSubContractAmount(raw);
              }} 
              className="bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-indigo-500 font-mono text-right placeholder-slate-500 h-10 w-full" 
            />
          </div>
          <div className="flex gap-2">
            <button 
              type="submit" 
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2.5 rounded-xl uppercase tracking-wider transition-all cursor-pointer h-10"
            >
              {editingSubId ? 'Update' : 'Register'}
            </button>
            {editingSubId && (
              <button 
                type="button" 
                onClick={() => {
                  setEditingSubId(null);
                  setSubName('');
                  setSubPosition('');
                  setSubContractAmount('');
                  setSubRemark('');
                }}
                className="bg-slate-800 text-slate-350 hover:bg-slate-705 px-3 rounded-xl text-xs transition-all h-10"
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        {/* Horizontal scroll of registered subcontractor profiling cards */}
        <div className="flex gap-3 pb-2 overflow-x-auto select-none mt-4 border-t border-slate-800/40 pt-4 scrollbar-thin scrollbar-thumb-slate-800">
          {currentSubcontractors.length === 0 ? (
            <div className="text-xs text-slate-500 italic py-1">ဆပ်ကွန်အဖွဲ့ဝင်များ စာရင်းမရှိသေးပါ။</div>
          ) : (
            currentSubcontractors.map((sub) => {
              const extrasSum = (sub.additionalWorks || []).reduce((sum, ad) => sum + (Number(ad.amount) || 0), 0);
              return (
                <div 
                  key={sub.id} 
                  className={`flex-shrink-0 bg-slate-950/60 border ${selectedAddonSubId === sub.id ? 'border-indigo-500' : 'border-slate-800/90'} rounded-xl px-4 py-3 flex items-center justify-between gap-5 transition-all text-xs max-w-sm`}
                >
                  <div className="min-w-0 pr-1 flex flex-col">
                    <span className="font-bold text-slate-200 truncate">{sub.name}</span>
                    <span className="text-[9px] text-slate-500 font-semibold uppercase font-mono tracking-wider mt-0.5">{sub.position} (Base Contract: {Number(sub.contractAmount || 0).toLocaleString()} MMK)</span>
                    {extrasSum > 0 && (
                      <span className="text-[10px] text-emerald-400 font-bold mt-1">+{formatMoney(extrasSum)} MMK (Extras)</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button 
                      onClick={() => setSelectedAddonSubId(selectedAddonSubId === sub.id ? null : sub.id)} 
                      className="px-3 py-1 bg-slate-800/90 border border-slate-700 hover:border-indigo-500 text-[10px] font-bold text-slate-300 hover:text-white rounded-lg transition-all cursor-pointer"
                    >
                      Contract Extras
                    </button>
                    <button 
                      onClick={() => startEditSubcon(sub)} 
                      className="p-1.5 bg-slate-900 border border-slate-800 hover:border-indigo-500 text-slate-400 hover:text-white rounded-lg transition-all cursor-pointer active:scale-90"
                    >
                      <Pencil size={11} />
                    </button>
                    <button 
                      onClick={() => handleDeleteSubcon(sub.id)} 
                      className="p-1.5 bg-slate-900 border border-slate-800 hover:border-rose-500 text-slate-400 hover:text-rose-500 rounded-lg transition-all cursor-pointer active:scale-90"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 3. Subcon Addon Additional Work Order (Inline Details Drawer) */}
      {selectedAddonSubId && (
        <div className="bg-[#111c2a]/90 border border-indigo-500/30 p-5 rounded-2xl shadow-xl animate-in slide-in-from-top duration-300">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <div>
              <h4 className="text-xs font-black text-indigo-400 uppercase tracking-widest flex items-center gap-1">
                Contract Extras (ထပ်တိုးလုပ်ငန်းများ) - 
                <span className="text-white ml-2 font-black">{currentSubcontractors.find(s => s.id === selectedAddonSubId)?.name}</span>
              </h4>
            </div>
            <button 
              onClick={() => setSelectedAddonSubId(null)}
              className="text-slate-400 hover:text-white p-1 hover:bg-slate-850 rounded-lg cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* List current addons */}
            <div className="md:col-span-2 space-y-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Logged Extras</span>
              {(() => {
                const sub = currentSubcontractors.find(s => s.id === selectedAddonSubId);
                const addons = sub?.additionalWorks || [];
                if (addons.length === 0) {
                  return <p className="text-xs text-slate-500 italic py-3">မရှိသေးပါ။ ထပ်တိုးလုပ်ငန်းမှတ်တမ်း လော့ဂ်မသွင်းရသေးပါ။</p>;
                }
                return addons.map((ad) => (
                  <div key={ad.id} className="flex justify-between items-center bg-slate-950/60 border border-slate-850 p-2 text-xs rounded-xl">
                    <div>
                      <p className="font-bold text-slate-300">{ad.name}</p>
                      <p className="text-[9px] text-slate-500 font-mono mt-0.5">{ad.date}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-black text-emerald-400 font-mono">+{Number(ad.amount || 0).toLocaleString()} Ks</span>
                      <button 
                        onClick={() => handleDeleteAddon(sub!, ad.id)}
                        className="p-1 hover:bg-slate-800 text-slate-500 hover:text-rose-500 rounded cursor-pointer"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ));
              })()}
            </div>

            {/* Form to log new addon */}
            <div className="bg-slate-950/50 border border-slate-800 p-4 rounded-xl space-y-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Add Contract Extra</span>
              <div className="space-y-2">
                <input 
                  type="text" 
                  placeholder="ကန်ထရိုက်အပြင်ထပ်တိုးလုပ်ငန်းအမည်..." 
                  value={addonName} 
                  onChange={e => setAddonName(e.target.value)} 
                  className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-indigo-500 w-full"
                />
                <input 
                  type="text" 
                  placeholder="ထပ်တိုးတန်ဖိုး (MMK)..." 
                  value={formatMoney(addonAmount)} 
                  onChange={e => {
                    const raw = parseMoney(e.target.value);
                    if (/^\d*$/.test(raw)) setAddonAmount(raw);
                  }} 
                  className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-indigo-500 font-mono text-right w-full"
                />
                <button 
                  type="button" 
                  onClick={handleAddWorkOrder}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] uppercase tracking-wider py-2 rounded-lg cursor-pointer transition-all"
                >
                  Confirm and Log Addition
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Category Tab selectors */}
      <div className="flex border-b border-slate-800/80 gap-3">
        {(['payments', 'contra', 'return', 'quotations'] as const).map((tab) => {
          const tabLabel = 
            tab === 'payments' ? 'Payment Records' : 
            tab === 'contra' ? 'Purchase (Contra)' : 
            tab === 'return' ? 'Return Material' : 'Quotations';
          
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setEditingTxId(null);
                setFilterSubconId('All');
              }}
              className={`pb-2.5 px-4 font-bold text-xs uppercase tracking-wider transition-all select-none border-b-2 hover:text-white cursor-pointer ${
                isActive 
                  ? 'border-indigo-500 text-white bg-indigo-950/20' 
                  : 'border-transparent text-slate-500'
              }`}
            >
              {tabLabel}
            </button>
          );
        })}
      </div>

      {/* 5. Active Tab Contents Rendering */}
      {activeTab !== 'quotations' ? (
        <div className="bg-[#111c2a]/40 border border-slate-800/80 p-6 rounded-2xl shadow-lg flex flex-col gap-6">
          <div className="flex justify-between items-center border-b border-slate-800/50 pb-3 flex-wrap gap-2">
            <h4 className="text-xs font-black text-slate-200 uppercase tracking-widest">
              ADD NEW RECORD (မှတ်တမ်းအသစ်သွင်းရန်)
            </h4>
            
            {/* Real Scanning trigger hidden/visible inline */}
            <div className="flex items-center gap-2">
              <input 
                type="file" 
                ref={fileInputRefForScan} 
                onChange={handleScanReceiptFile} 
                accept="image/*,application/pdf" 
                className="hidden" 
              />
              <button 
                type="button"
                onClick={() => fileInputRefForScan.current?.click()}
                disabled={isScanning}
                className="border border-emerald-500/30 text-emerald-400 bg-emerald-950/15 hover:bg-emerald-950/30 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all select-none"
              >
                <Upload size={13} />
                {isScanning ? "RECEIPT SCANNING..." : "SCAN PAYMENT (မြန်မာ)"}
              </button>
            </div>
          </div>

          <form onSubmit={handleSaveTxSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">ရက်စွဲ (Date)</label>
                <div className="relative">
                  <input 
                    type="date" 
                    required 
                    value={txDate} 
                    onChange={e => setTxDate(e.target.value)} 
                    className="bg-slate-950 border border-slate-850 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-indigo-500 w-full h-11" 
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">
                  {activeTab === 'contra' ? 'Deduction Type' : activeTab === 'return' ? 'Inventory Action' : 'Payment Type ရွေးပါ'}
                </label>
                {activeTab === 'payments' ? (
                  <select 
                    value={txType} 
                    onChange={e => setTxType(e.target.value)} 
                    className="bg-slate-950 border border-slate-850 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-indigo-500 cursor-pointer h-11"
                  >
                    <option value="1st Payment">1st Payment</option>
                    <option value="2nd Payment">2nd Payment</option>
                    <option value="3rd Payment">3rd Payment</option>
                    <option value="4th Payment">4th Payment</option>
                    <option value="5th Payment">5th Payment</option>
                    <option value="6th Payment">6th Payment</option>
                    <option value="7th Payment">7th Payment</option>
                    <option value="Final Payment">Final Payment</option>
                    <option value="Custom Pips...">ကောက်နှုတ်ရေးသားရန်...</option>
                  </select>
                ) : (
                  <input 
                    type="text" 
                    placeholder="ဥပမာ - Contra deduction / Material Refund" 
                    value={txType}
                    onChange={e => setTxType(e.target.value)}
                    className="bg-slate-950 border border-slate-855 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-indigo-500 h-11"
                  />
                )}
              </div>

              {txType === 'Custom Pips...' && activeTab === 'payments' && (
                <div className="flex flex-col gap-1 animate-in fade-in duration-200">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Custom Payout Description</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="အကြောင်းအရာ ရေးသားရန်..." 
                    value={customPaymentType} 
                    onChange={e => setCustomPaymentType(e.target.value)} 
                    className="bg-slate-950 border border-slate-850 rounded-xl px-4 py-3 text-white text-xs outline-none" 
                  />
                </div>
              )}

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">ဆပ်ကွန် အမည် * (Subcontractor)</label>
                <select 
                  required 
                  value={selectedSubconId} 
                  onChange={e => {
                    const scId = e.target.value;
                    setSelectedSubconId(scId);
                    const subRef = currentSubcontractors.find(s => s.id === scId);
                    if (subRef) setTxJobType(subRef.position || '');
                  }} 
                  className="bg-slate-950 border border-slate-850 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-indigo-500 cursor-pointer h-11"
                >
                  <option value="">အမည်ရွေးပါ *</option>
                  {currentSubcontractors.map(sc => (
                    <option key={sc.id} value={sc.id}>{sc.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">အလုပ်အမျိုးအစား (Trade/Job Class)</label>
                <input 
                  placeholder="ကဏ္ဍ (ဥပမာ - ceiling, electrical)..." 
                  value={txJobType}
                  onChange={e => setTxJobType(e.target.value)}
                  className="bg-slate-950 border border-slate-850 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-indigo-500 h-11"
                />
              </div>

            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="flex flex-col gap-1 md:col-span-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">ပမာဏ * (Amount Ks)</label>
                <input 
                  placeholder="0.00 Ks" 
                  required 
                  value={formatMoney(txAmount)} 
                  onChange={e => {
                    const raw = parseMoney(e.target.value);
                    if (/^\d*$/.test(raw)) setTxAmount(raw);
                  }} 
                  className="bg-slate-950 border border-slate-850 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-indigo-500 font-mono text-right h-11"
                />
              </div>

              <div className="flex flex-col gap-1 md:col-span-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase">မှတ်ချက် (Remark - မထည့်လည်းရသည်)</label>
                <input 
                  placeholder="အပိုဆောင်း အကြောင်းကြားချက်..." 
                  value={txRemark} 
                  onChange={e => setTxRemark(e.target.value)} 
                  className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-indigo-500 h-11" 
                />
              </div>

              <div className="flex items-end">
                <button 
                  type="submit" 
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs py-3 rounded-xl uppercase tracking-wider transition-all select-none active:scale-95 cursor-pointer shadow-lg h-11"
                >
                  {editingTxId ? 'UPDATE RECORD' : 'SAVE'}
                </button>
              </div>
            </div>
          </form>

          {/* Table & Filtering */}
          <div className="border-t border-slate-800/60 pt-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-4">
              
              <div className="flex gap-2 w-full md:w-auto flex-wrap">
                <select 
                  value={filterSubconId} 
                  onChange={e => setFilterSubconId(e.target.value)} 
                  className="bg-slate-950 border border-slate-850 px-4 py-2.5 rounded-xl text-white text-xs outline-none font-sans cursor-pointer"
                >
                  <option value="All">All Subconsultants (အားလုံး)</option>
                  {currentSubcontractors.map(sc => (
                    <option key={sc.id} value={sc.id}>{sc.name}</option>
                  ))}
                </select>

                <input 
                  placeholder="ကောက်နုတ်ချက် ရှာဖွေပါ..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="bg-slate-950 border border-slate-850 px-4 py-2.5 rounded-xl text-white text-xs outline-none font-sans w-52"
                />
              </div>

              {/* Data Export / Import Buttons */}
              <div className="flex items-center gap-2">
                <input 
                  type="file" 
                  ref={fileImportRef} 
                  onChange={handleImportCsv} 
                  accept=".xlsx, .xls, .csv" 
                  className="hidden" 
                />
                <button 
                  onClick={() => fileImportRef.current?.click()}
                  className="bg-slate-950 border border-slate-850 hover:border-slate-700 text-slate-400 hover:text-white px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer select-none"
                >
                  <Download size={12} />
                  Import
                </button>
                <button 
                  onClick={handleExportCsv}
                  className="bg-slate-950 border border-slate-850 hover:border-slate-700 text-slate-400 hover:text-white px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer select-none"
                >
                  <Upload size={12} />
                  Export
                </button>
              </div>
            </div>

            {/* Main Records Table */}
            <div className="bg-slate-950/40 rounded-2xl border border-slate-850 overflow-x-auto overflow-y-auto max-h-[500px]">
              <table className="w-full text-left border-collapse font-sans">
                <thead>
                  <tr className="bg-slate-950 text-[10px] uppercase font-black tracking-wider text-slate-400">
                    <th className="sticky top-0 bg-slate-950 z-20 border-b border-slate-850 px-5 py-3 w-12 text-center">No.</th>
                    <th className="sticky top-0 bg-slate-950 z-20 border-b border-slate-850 px-5 py-3 w-28">Date</th>
                    <th className="sticky top-0 bg-slate-950 z-20 border-b border-slate-850 px-5 py-3">Details</th>
                    <th className="sticky top-0 bg-slate-950 z-20 border-b border-slate-850 px-5 py-3 text-right">Amount (MMK)</th>
                    <th className="sticky top-0 bg-slate-950 z-20 border-b border-slate-850 px-5 py-3 text-center">Action</th>
                    <th className="sticky top-0 bg-slate-950 z-20 border-b border-slate-850 px-5 py-3">Remark</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-10 text-slate-500 italic text-xs">
                        {activeTab === 'payments' ? 'ငွေပေးချေမှု မှတ်တမ်းများမရှိသေးပါ။' : 'စာရင်းမှတ်တမ်းများ မရှိသေးပါ။'}
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((t, idx) => (
                      <tr key={t.id} className="hover:bg-slate-900/20 text-xs">
                        <td className="px-5 py-4 text-center font-mono text-slate-500">{filteredTransactions.length - idx}</td>
                        <td className="px-5 py-4 text-slate-400 font-mono italic">{t.date}</td>
                        <td className="px-5 py-4">
                          <div>
                            <span className="font-bold text-slate-200 block text-sm">{t.particular}</span>
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{t.job_type || 'Subcontractor'}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-right text-white font-mono text-sm font-semibold">
                          {Number(t.amount || 0).toLocaleString()}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex justify-center gap-1.5">
                            <button 
                              onClick={() => startEditTx(t)} 
                              className="p-1.5 bg-slate-950 border border-slate-850 rounded-lg hover:border-indigo-500/50 text-slate-400 hover:text-indigo-400 cursor-pointer"
                            >
                              <Pencil size={12} />
                            </button>
                            <button 
                              onClick={() => handleDeleteTx(t.id)} 
                              className="p-1.5 bg-slate-950 border border-slate-850 rounded-lg hover:border-rose-500/50 text-slate-400 hover:text-rose-500 cursor-pointer"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-slate-400 max-w-[200px] truncate" title={t.remark}>
                          {t.remark || '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* 6. Dynamic Financial Total Balance Summaries */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 border-t border-slate-800/40 pt-6 font-sans">
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center bg-slate-950/20 py-2.5 px-4 rounded-xl border border-slate-900 hover:border-slate-800">
                  <span className="text-slate-400 font-bold">မူရင်းစာချုပ်တန်ဖိုး (Base Contract):</span>
                  <span className="font-mono text-sm text-slate-200 font-black">{stats.baseContract.toLocaleString()} MMK</span>
                </div>
                <div className="flex justify-between items-center bg-slate-950/20 py-2.5 px-4 rounded-xl border border-slate-900 hover:border-slate-800">
                  <span className="text-slate-400 font-bold text-purple-400">ထပ်တိုးလုပ်ငန်းများ (Additional Works):</span>
                  <span className="font-mono text-sm text-purple-400 font-black font-semibold">+{stats.additionalWorks.toLocaleString()} MMK</span>
                </div>
                <div className="flex justify-between items-center bg-slate-950/20 py-2.5 px-4 rounded-xl border border-indigo-950/20 bg-indigo-950/5">
                  <span className="text-indigo-400 font-black">စုစုပေါင်းကျသင့်ငွေ (TOTAL CONTRACT):</span>
                  <span className="font-mono text-base text-indigo-400 font-black tracking-tight">{stats.totalContract.toLocaleString()} MMK</span>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center bg-slate-950/20 py-2.5 px-4 rounded-xl border border-slate-900 hover:border-slate-800">
                  <span className="text-emerald-400 font-bold">ပေးချေပြီးငွေ (Total Paid):</span>
                  <span className="font-mono text-sm text-emerald-400 font-black font-bold">-{stats.totalPaid.toLocaleString()} MMK</span>
                </div>
                <div className="flex justify-between items-center bg-slate-950/20 py-2.5 px-4 rounded-xl border-dashed border border-slate-800">
                  <span className="text-slate-400 font-semibold font-sans">ပေးချေရန်ကျန်ငွေ (Remaining Balance):</span>
                  <span className="font-mono text-sm text-amber-500 font-black">
                    {stats.remaining > 0 ? `${stats.remaining.toLocaleString()} MMK` : '0 MMK (Settled)'}
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>
      ) : (
        /* Quotation Spreadsheet and Tender management view */
        <div className="bg-[#111c2a]/40 border border-slate-800/80 p-6 rounded-2xl shadow-lg space-y-6">
          <div className="border-b border-slate-800/50 pb-3 flex justify-between items-center flex-wrap gap-2">
            <div>
              <h4 className="text-xs font-black text-slate-200 uppercase tracking-widest">
                Subconsultant Bid Quotations Worksheet (ဆပ်ကွန်စျေးနှုန်းစာရင်းသွင်းရန်)
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">မူရင်းစျေးနှုန်းစာရင်း တွက်ချက်ခွဲခြမ်းမှုများ ရေးသွင်းနိုင်သည်။</p>
            </div>
            
            <div className="flex items-center gap-2">
              <select 
                value={selectedQuoSubId} 
                onChange={e => loadQuotationHandler(e.target.value)} 
                className="bg-slate-950 border border-slate-800 px-4 py-2 rounded-xl text-white text-xs outline-none cursor-pointer"
              >
                <option value="">ဆပ်ကွန် ရွေးပါ *</option>
                {currentSubcontractors.map(sc => (
                  <option key={sc.id} value={sc.id}>{sc.name}</option>
                ))}
              </select>
            </div>
          </div>

          {selectedQuoSubconDetails ? (
            <div className="space-y-4">
              {/* Input row */}
              <div className="bg-slate-950/50 border border-slate-850 p-4 rounded-xl grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
                <div className="flex flex-col gap-1 md:col-span-1">
                  <label className="text-[9px] font-bold text-slate-500 uppercase">အမျိုးအစား (Work Type)</label>
                  <input 
                    placeholder="ဥပမာ- Core, Wall..." 
                    value={newQuoWorkType} 
                    onChange={e => setNewQuoWorkType(e.target.value)} 
                    className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-indigo-500 w-full"
                  />
                </div>
                <div className="flex flex-col gap-1 md:col-span-2">
                  <label className="text-[9px] font-bold text-slate-500 uppercase">လုပ်ငန်းအကြောင်းအရာ * (Description)</label>
                  <input 
                    placeholder="လုပ်ငန်းအကြောင်းအရာ..." 
                    value={newQuoDesc} 
                    onChange={e => setNewQuoDesc(e.target.value)} 
                    className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-indigo-500 w-full"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-bold text-slate-500 uppercase">အရေအတွက် * (Qty)</label>
                  <input 
                    type="number" 
                    placeholder="1" 
                    value={newQuoQty} 
                    onChange={e => setNewQuoQty(e.target.value)} 
                    className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-indigo-500 w-full text-right"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-bold text-slate-500 uppercase">ယူနစ်နှုန်း * (Unit Rate)</label>
                  <input 
                    placeholder="0.00 Ks" 
                    value={formatMoney(newQuoPrice)} 
                    onChange={e => {
                      const raw = parseMoney(e.target.value);
                      if (/^\d*$/.test(raw)) setNewQuoPrice(raw);
                    }} 
                    className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-indigo-500 w-full text-right font-mono"
                  />
                </div>
                <div className="flex gap-2">
                  <div className="flex flex-col gap-1 flex-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase">Discount (Ks)</label>
                    <input 
                      placeholder="0" 
                      value={formatMoney(newQuoDiscount)} 
                      onChange={e => {
                        const raw = parseMoney(e.target.value);
                        if (/^\d*$/.test(raw)) setNewQuoDiscount(raw);
                      }} 
                      className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white outline-none w-full text-right font-mono"
                    />
                  </div>
                  <button 
                    type="button" 
                    onClick={handleAddQuoItem}
                    className="bg-indigo-600 hover:bg-indigo-500 p-2.5 rounded-lg text-white transition-all cursor-pointer self-end"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>

              {/* Quotation spreadsheet representation */}
              <div className="bg-slate-950/40 rounded-2xl border border-slate-850 overflow-x-auto overflow-y-auto max-h-[500px]">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-950 text-[10px] uppercase font-black tracking-wider text-slate-400">
                      <th className="sticky top-0 bg-slate-950 z-20 border-b border-slate-850 px-5 py-3 w-12 text-center">No.</th>
                      <th className="sticky top-0 bg-slate-950 z-20 border-b border-slate-850 px-5 py-3 w-28">Type</th>
                      <th className="sticky top-0 bg-slate-950 z-20 border-b border-slate-850 px-5 py-3">Item details</th>
                      <th className="sticky top-0 bg-slate-950 z-20 border-b border-slate-850 px-5 py-3 text-right">Qty</th>
                      <th className="sticky top-0 bg-slate-950 z-20 border-b border-slate-850 px-5 py-3 text-right">Rate</th>
                      <th className="sticky top-0 bg-slate-950 z-20 border-b border-slate-850 px-5 py-3 text-right">Discount</th>
                      <th className="sticky top-0 bg-slate-950 z-20 border-b border-slate-850 px-5 py-3 text-right">Amount (Ks)</th>
                      <th className="sticky top-0 bg-slate-950 z-20 border-b border-slate-850 px-5 py-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    {quoItems.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center py-10 text-slate-500 italic">
                          No quotation bid spreadsheet scopes uploaded for this subcontractor.
                        </td>
                      </tr>
                    ) : (
                      quoItems.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-900/10">
                          <td className="px-5 py-4 text-center text-slate-500 font-mono">{idx + 1}</td>
                          <td className="px-5 py-4 font-bold text-indigo-400">{item.work_type}</td>
                          <td className="px-5 py-4 text-slate-200 font-medium">{item.item}</td>
                          <td className="px-5 py-4 text-right font-mono text-slate-300">{item.qty}</td>
                          <td className="px-5 py-4 text-right font-mono text-slate-300">{Number(item.unit_price || 0).toLocaleString()}</td>
                          <td className="px-5 py-4 text-right font-mono text-rose-400">-{Number(item.discount || 0).toLocaleString()}</td>
                          <td className="px-5 py-4 text-right font-mono text-white font-black">{Number(item.amount || 0).toLocaleString()}</td>
                          <td className="px-5 py-4 text-center">
                            <button 
                              onClick={() => handleDeleteQuoItem(item.id)} 
                              className="p-1 text-slate-500 hover:text-rose-500 rounded cursor-pointer transition-all"
                            >
                              <Trash2 size={12} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {quoItems.length > 0 && (
                    <tfoot>
                      <tr className="bg-slate-950/80 font-black text-rose-50 border-t border-slate-800 font-sans">
                        <td colSpan={6} className="px-5 py-4 text-right text-slate-400 uppercase text-[10px] tracking-wider">Total Quotation sum:</td>
                        <td className="px-5 py-4 text-right font-mono text-indigo-400 text-sm font-black">{totalQuotationValue.toLocaleString()} MMK</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-slate-950/20 rounded-2xl p-8 border border-dashed border-slate-800 text-center text-slate-500 italic text-xs">
              ဘက်ဂျက်အသေးစိတ် တွက်ချက်လိုသော ဆပ်ကွန်အား select တွင် ရွေးချယ်ပေးပါ။
            </div>
          )}
        </div>
      )}


      {/* 7. AI REPORT MODAL */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b1322] border border-indigo-500/30 max-w-2xl w-full rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
            <div className="bg-slate-950 px-6 py-4 border-b border-slate-850 flex justify-between items-center">
              <h3 className="font-sans font-black text-white text-xs tracking-widest uppercase flex items-center gap-1.5">
                <Sparkles size={14} className="text-purple-400 animate-pulse" />
                AI Ledger Inspection Report (ဆပ်ကွန် အလှည့်စစ်ဆေးမှု သုံးသပ်ချက်)
              </h3>
              <button 
                onClick={() => setShowAiModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-all"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto custom-scrollbar font-sans text-xs leading-relaxed space-y-4 text-slate-300">
              {isAnalyzing ? (
                <div className="flex flex-col items-center justify-center py-16 space-y-3">
                  <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-slate-400 animate-pulse font-bold text-center">Gemini 3.5 AI analyzed files & logs...</p>
                </div>
              ) : (
                <div className="markdown-body whitespace-pre-wrap font-sans">
                  {aiReport}
                </div>
              )}
            </div>

            <div className="bg-slate-950/80 px-6 py-4 border-t border-slate-850 flex justify-end">
              <button 
                onClick={() => setShowAiModal(false)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-2 rounded-xl text-xs uppercase cursor-pointer tracking-wider"
              >
                ပိတ်မည် (Close)
              </button>
            </div>
          </div>
        </div>
      )}

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
  );
};
