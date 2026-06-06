/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Trash2, Pencil, Calendar, ArrowUpRight, ArrowDownLeft, Sparkles, Loader2, Image, Briefcase, Plus, X, Upload, Download } from 'lucide-react';
import { Transaction, Employee, Project } from '../types';
import { saveDocument } from '../lib/db';

interface OfficeUtilitiesProps {
  officeStaff: Employee[];
  siteEngineers: Employee[];
  transactions: Transaction[];
  currentProjectId: string | null;
  availableProjects: Project[];
  activeProject: any;
  onSave: (collection: string, id: string | null, data: any) => Promise<string>;
  onDelete: (collection: string, id: string) => Promise<void>;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export const OfficeUtilitiesManagerView: React.FC<OfficeUtilitiesProps> = ({
  officeStaff,
  siteEngineers,
  transactions,
  currentProjectId,
  availableProjects,
  activeProject,
  onSave,
  onDelete,
  showToast
}) => {
  // Local state for adding/editing transaction
  const [editingId, setEditingId] = useState<string | null>(null);
  const [localConfirm, setLocalConfirm] = useState<{
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
  } | null>(null);
  
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [type, setType] = useState<'သုံးငွေ (Spent)' | 'ထုတ်ငွေ (Issued)'>('သုံးငွေ (Spent)');
  const [staffName, setStaffName] = useState('');
  const [itemName, setItemName] = useState('');
  const [qty, setQty] = useState('1');
  const [unitPrice, setUnitPrice] = useState('');
  const [beforeDiscount, setBeforeDiscount] = useState('');
  const [afterDiscount, setAfterDiscount] = useState('');
  const [remark, setRemark] = useState('');

  // Filtering / Search States
  const [selectedNameFilter, setSelectedNameFilter] = useState('All');
  const [isScanning, setIsScanning] = useState(false);
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [tempBudget, setTempBudget] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Combine site engineers and office staff names to include all employees
  const allStaffNames = useMemo(() => {
    const names = new Set<string>();
    officeStaff.forEach(x => { if (x.name) names.add(x.name.trim()); });
    siteEngineers.forEach(x => { if (x.name) names.add(x.name.trim()); });
    return Array.from(names).sort();
  }, [officeStaff, siteEngineers]);

  // Set default staff member on render or staff load
  useEffect(() => {
    if (!staffName && allStaffNames.length > 0) {
      setStaffName('');
    }
  }, [allStaffNames]);

  // Filter transactions that belong to 'Office' or 'Office & Utilities' and current Project
  const officeTransactions = useMemo(() => {
    return transactions.filter(t => 
      (t.category === 'Office' || t.category === 'Office & Utilities') && 
      (!currentProjectId || t.projectId === currentProjectId)
    );
  }, [transactions, currentProjectId]);

  // Filter transactions by selected employee name
  const filteredTransactions = useMemo(() => {
    let list = [...officeTransactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    if (selectedNameFilter !== 'All') {
      list = list.filter(t => t.name === selectedNameFilter);
    }
    return list;
  }, [officeTransactions, selectedNameFilter]);

  // Handle active project local budget state
  useEffect(() => {
    if (activeProject) {
      setTempBudget(String(activeProject.officeBudget || 0));
    } else {
      setTempBudget('0');
    }
  }, [activeProject]);

  // Budget calculations based on transactions
  const totals = useMemo(() => {
    let totalSpent = 0;
    let totalIssued = 0;

    officeTransactions.forEach(t => {
      const amt = Math.abs(Number(t.amount) || 0);
      if (t.flow_type === 'IN') {
        totalIssued += amt;
      } else {
        totalSpent += amt;
      }
    });

    return {
      totalSpent,
      totalIssued,
      balance: totalIssued - totalSpent
    };
  }, [officeTransactions]);

  // Handling Save of Project Office Budget
  const handleSaveBudget = async () => {
    if (!currentProjectId || currentProjectId === 'global') {
      showToast("ကျေးဇူးပြု၍ စတင်ရန် Project တစ်ခုရွေးချယ်ပါ", "error");
      setIsEditingBudget(false);
      return;
    }
    try {
      const budgetNum = Number(tempBudget.replace(/[^0-9]/g, '')) || 0;
      await onSave('projects', currentProjectId, { officeBudget: budgetNum });
      setIsEditingBudget(false);
      showToast("Office budget updated successfully!", "success");
    } catch (err) {
      showToast("Could not update office budget", "error");
    }
  };

  // Safe Burmese formatting helper
  const formatMyanmarMoney = (num: number) => {
    return String(num).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  // Helper auto-calculations
  const handleQtyChange = (val: string) => {
    setQty(val);
    const qValue = Number(val) || 0;
    const afterDiscountUnit = Number(beforeDiscount) || Number(unitPrice) || 0;
    const calc = qValue * afterDiscountUnit;
    setAfterDiscount(String(calc));
  };

  const handleUnitPriceChange = (val: string) => {
    setUnitPrice(val);
    setBeforeDiscount(val);
    const qValue = Number(qty) || 0;
    const afterDiscountUnit = Number(val) || 0;
    const calc = qValue * afterDiscountUnit;
    setAfterDiscount(String(calc));
  };

  const handleAfterDiscountUnitChange = (val: string) => {
    setBeforeDiscount(val);
    const qValue = Number(qty) || 0;
    const afterDiscountUnit = Number(val) || 0;
    const calc = qValue * afterDiscountUnit;
    setAfterDiscount(String(calc));
  };

  // Populate fields when editing
  const handleStartEdit = (t: Transaction) => {
    setEditingId(t.id);
    setDate(t.date || new Date().toISOString().split('T')[0]);
    setType(t.flow_type === 'IN' ? 'ထုတ်ငွေ (Issued)' : 'သုံးငွေ (Spent)');
    setStaffName(t.name || '');
    setItemName(t.particular || t.item || '');
    setQty(t.qty ? String(t.qty) : '1');
    setUnitPrice(t.unit_price ? String(t.unit_price) : '');
    setBeforeDiscount(t.amount ? String(Math.abs(Number(t.amount))) : '');
    setAfterDiscount(t.amount ? String(Math.abs(Number(t.amount))) : '');
    setRemark(t.remark || '');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setDate(new Date().toISOString().split('T')[0]);
    setType('သုံးငွေ (Spent)');
    setStaffName('');
    setItemName('');
    setQty('1');
    setUnitPrice('');
    setBeforeDiscount('');
    setAfterDiscount('');
    setRemark('');
  };

  // Save/Update handles
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffName || staffName === 'အမည်ရွေးပါ *') {
      showToast("ကျေးဇူးပြု၍ ဝန်ထမ်းအမည် ရွေးချယ်ပေးပါ *", "error");
      return;
    }
    if (!itemName) {
      showToast("ကျေးဇူးပြု၍ ပစ္စည်းအမည် ဖြည့်စွက်ပါ *", "error");
      return;
    }
    if (!afterDiscount) {
      showToast("ကျေးဇူးပြု၍ ကျသင့်ငွေ ဖြည့်စွက်ပါ *", "error");
      return;
    }

    const flowType = type === 'ထုတ်ငွေ (Issued)' ? 'IN' : 'OUT';
    const amountVal = Number(afterDiscount) || 0;
    // Spent transactions in the ledger table and stats should be shown as negative, Issued as positive
    const finalAmount = flowType === 'IN' ? amountVal : -amountVal;

    const payload = {
      date,
      particular: itemName,
      item: itemName,
      entry_type: type,
      name: staffName,
      qty: Number(qty) || 1,
      unit_price: Number(unitPrice) || 0,
      original_amount: Number(beforeDiscount) || Number(afterDiscount) || 0,
      amount: finalAmount,
      remark: remark || '-',
      projectId: currentProjectId || 'global',
      category: 'Office & Utilities',
      flow_type: flowType,
      timestamp: new Date().toISOString()
    };

    try {
      await onSave('transactions', editingId, payload);
      
      // Auto save material price to dynamic catalog if it's an expense
      if (flowType === 'OUT') {
        try {
          await saveDocument('data_collections', null, {
            type: 'material_price',
            name: itemName,
            price: Number(unitPrice) || Number(afterDiscount) || 0,
            remark: remark || 'Auto recorded from Office & Utilities tab',
            date: date,
            projectId: currentProjectId || 'global',
            timestamp: new Date().toISOString()
          });
          window.dispatchEvent(new Event('intfin_update_data_collections'));
        } catch (e) {
          console.error("Auto catalog listing error:", e);
        }
      }

      handleCancelEdit();
      showToast(editingId ? "မူရင်းဒေတာကို ပြင်ဆင်ပြီးပါပြီ" : "သုံးစွဲစရိတ် စာရင်းသွင်းပြီးပါပြီ", "success");
    } catch (err) {
      showToast("သိမ်းဆည်းရာတွင် အဆင်မပြေဖြစ်သွားပါသည်", "error");
    }
  };

  // OCR optical voucher scan logic
  const handleVoucherScan = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    showToast("Voucher ကို AI ဖြင့် စတင်ဖတ်ရှုနေပါသည်...", "success");

    const reader = new FileReader();
    reader.onload = async (event) => {
      const bData = (event.target?.result as string).split(',')[1];
      try {
        const prompt = `Extract receipt information from this voucher:
        1. Item/Service Description (particular)
        2. Total Amount (amount)
        Format as JSON strictly: {"particular": "Stationery / Office utilities etc", "amount": 15000}. No markdown formatting.`;

        const response = await fetch("/api/gemini/scan-doc", {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileData: bData, mimeType: file.type || "image/jpeg", prompt })
        });

        if (!response.ok) throw new Error("Voucher scanner API failed");
        const resObj = await response.json();
        const extracted = JSON.parse(resObj.text?.replace(/```json/gi, '').replace(/```/g, '').trim() || '{}');

        if (extracted.particular) setItemName(extracted.particular);
        if (extracted.amount) {
          setAfterDiscount(String(extracted.amount));
          setBeforeDiscount(String(extracted.amount));
        }
        showToast("Voucher စကင်န်ဖတ်ခြင်း အောင်မြင်ပါသည်။", "success");
      } catch (err) {
        console.error(err);
        showToast("Voucher ကိုဖတ်ရန် အဆင်မပြေပါ။ Manual ဖြည့်သွင်းပေးပါ", "error");
      } finally {
        setIsScanning(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Helper mapping values from Excel sheets dynamically
  const getRowVal = (row: any, candidates: string[]): any => {
    const keys = Object.keys(row);
    for (const k of keys) {
      const clean = k.trim().toLowerCase();
      for (const cand of candidates) {
        if (clean === cand.toLowerCase() || clean.includes(cand.toLowerCase()) || cand.toLowerCase().includes(clean)) {
          return row[k];
        }
      }
    }
    return undefined;
  };

  // Excel Import Handler
  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const XLSX = (window as any).XLSX;
    if (!XLSX) {
      showToast("Library loading... Please try again", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const dataBytes = evt.target?.result;
        const workbook = XLSX.read(dataBytes, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const parsedRows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

        if (!parsedRows || parsedRows.length === 0) {
          showToast("Excel sheet တွင် အချက်အလက်မရှိပါ", "error");
          return;
        }

        let count = 0;
        for (const row of parsedRows) {
          const rawDate = getRowVal(row, ["date", "ရက်စွဲ"]);
          let finalDate = String(rawDate || '').trim();
          if (!finalDate) {
            finalDate = new Date().toISOString().split('T')[0];
          } else if (!isNaN(Number(finalDate)) && Number(finalDate) > 30000 && Number(finalDate) < 60000) {
            const excelEpoch = new Date(Date.UTC(1899, 11, 30));
            excelEpoch.setUTCDate(excelEpoch.getUTCDate() + Number(finalDate));
            finalDate = excelEpoch.toISOString().split('T')[0];
          }

          // Combined staff options
          const rawStaff = getRowVal(row, ["name", "staff", "person", "employee", "အမည်", "လူ"]);
          const finalStaffName = String(rawStaff || '').trim() || allStaffNames[0] || 'Unknown';

          const rawItem = getRowVal(row, ["particular", "item", "description", "ပစ္စည်းအမည်", "အကြောင်းအရာ"]);
          const finalItem = String(rawItem || '').trim() || 'General Utilities';

          const rawQty = getRowVal(row, ["qty", "quantity", "အရေအတွက်"]);
          const finalQty = Number(rawQty) || 1;

          const rawPrice = getRowVal(row, ["unit_price", "price", "တစ်ခုချင်း"]);
          const finalPrice = Number(rawPrice) || 0;

          const rawAmt = getRowVal(row, ["amount", "dis", "after", "ကျသင့်ငွေ", "တန်ဖိုး"]);
          const finalAmtRaw = Number(String(rawAmt || '').replace(/[^0-9.-]/g, '')) || (finalQty * finalPrice) || 0;

          const rawType = getRowVal(row, ["type", "flow", "category type", "entry_type", "အမျိုးအစား"]);
          const typeStr = String(rawType || '').toLowerCase().trim();
          let finalFlowType: 'IN' | 'OUT' = 'OUT';
          let finalEntryType: 'ထုတ်ငွေ (Issued)' | 'သုံးငွေ (Spent)' = 'သုံးငွေ (Spent)';

          if (typeStr.includes('issued') || typeStr.includes('allotment') || typeStr.includes('ထုတ်ငွေ') || finalAmtRaw > 0) {
            finalFlowType = 'IN';
            finalEntryType = 'ထုတ်ငွေ (Issued)';
          }

          const finalAmountValue = finalFlowType === 'IN' ? Math.abs(finalAmtRaw) : -Math.abs(finalAmtRaw);
          const rawRemark = getRowVal(row, ["remark", "မှတ်ချက်"]);
          const finalRemarkText = String(rawRemark || '').trim() === '-' ? '' : String(rawRemark || '').trim();

          const payload = {
            date: finalDate,
            particular: finalItem,
            item: finalItem,
            entry_type: finalEntryType,
            name: finalStaffName,
            qty: finalQty,
            unit_price: finalPrice,
            original_amount: Math.abs(finalAmtRaw),
            amount: finalAmountValue,
            remark: finalRemarkText || '-',
            projectId: currentProjectId || 'global',
            category: 'Office & Utilities',
            flow_type: finalFlowType,
            timestamp: new Date().toISOString()
          };

          await onSave('transactions', null, payload);
          count++;
        }

        showToast(`Excel မှ အချက်အလက် (${count}) ခုအား ထည့်သွင်းပြီးပါပြီ။`, "success");
      } catch (err) {
        console.error(err);
        showToast("Excel ဖတ်ရာတွင် အမှားအယွင်း ရှိပါသည်", "error");
      }
    };
    reader.readAsBinaryString(file);
  };

  // Export to Excel Handler
  const handleExportExcel = () => {
    if (filteredTransactions.length === 0) {
      showToast("ထုတ်ယူရန် Ledger Data မရှိသေးပါ", "error");
      return;
    }

    const XLSX = (window as any).XLSX;
    const wb = XLSX.utils.book_new();

    const headers = [
      "No.", "Date", "Staff / Employee", "Particular / Item Name", "Qty", "Unit Price (MMK)", "Amount (MMK)", "Type", "Remark"
    ];

    const rows = filteredTransactions.map((t, index) => [
      filteredTransactions.length - index,
      t.date,
      t.name,
      t.particular || t.item || '-',
      t.qty || 1,
      t.unit_price || 0,
      t.amount,
      t.flow_type === 'IN' ? 'ထုတ်ငွေ (Issued)' : 'သုံးငွေ (Spent)',
      t.remark || '-'
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    XLSX.utils.book_append_sheet(wb, ws, "Office & Utilities");
    XLSX.writeFile(wb, `Office_Utilities_${activeProject?.projectName || 'Global'}.xlsx`);
    showToast("Excel file exported successfully!", "success");
  };

  return (
    <div className="space-y-6">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <h2 className="text-xl font-black text-white uppercase tracking-tight">Office &amp; Utilities</h2>
          <p className="text-xs text-slate-500 mt-1 font-sans">
            Track office staff expense claims, utility payouts, petty cash, and project budget updates
          </p>
        </div>
      </div>

      {/* Budget Allocation Display Board */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl md:col-span-2 flex flex-col justify-between">
          <div className="flex justify-between items-center w-full">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest font-sans">
              ALLOCATED OFFICE BUDGET (MMK)
            </span>
            {currentProjectId && currentProjectId !== 'global' && (
              <button 
                onClick={() => {
                  if (isEditingBudget) {
                    handleSaveBudget();
                  } else {
                    setIsEditingBudget(true);
                  }
                }}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-bold transition-all"
              >
                {isEditingBudget ? 'SAVE' : 'EDIT'}
              </button>
            )}
          </div>
          <div className="mt-3">
            {isEditingBudget ? (
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={tempBudget} 
                  onChange={e => setTempBudget(e.target.value.replace(/[^0-9]/g, ''))} 
                  className="bg-slate-950 border border-indigo-500/50 rounded-xl px-4 py-2 text-white font-mono text-xl font-bold max-w-xs outline-none"
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveBudget(); }}
                  autoFocus
                />
                <button onClick={handleSaveBudget} className="bg-indigo-600 px-4 py-2 rounded-xl text-white font-bold text-xs">OK</button>
              </div>
            ) : (
              <span className="text-3xl font-bold text-white font-mono leading-none">
                {formatMyanmarMoney(Number(tempBudget) || 0)} <span className="text-sm font-normal text-slate-400">Ks</span>
              </span>
            )}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col justify-between">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest font-sans">
            TOTAL SPENT
          </span>
          <div className="mt-3 flex justify-between items-end">
            <span className="text-3xl font-bold text-rose-400 font-mono leading-none">
              -{formatMyanmarMoney(totals.totalSpent)} <span className="text-sm font-normal text-slate-400">Ks</span>
            </span>
            <span className="text-xs text-slate-500 font-mono">
              {officeTransactions.filter(t => t.flow_type === 'OUT').length} records
            </span>
          </div>
        </div>
      </div>

      {/* primary input form panel */}
      <div className="bg-slate-900 border border-slate-800 p-5 md:p-6 rounded-2xl shadow-xl">
        <div className="flex justify-between items-center mb-5">
          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Briefcase size={14} className="text-indigo-400" />
            {editingId ? 'EDIT RECORD (အချက်အလက်ကို ပြင်ဆင်ရန်)' : 'ADD NEW RECORD'}
          </h4>
          
          <div className="flex items-center gap-2">
            <input type="file" ref={fileInputRef} accept="image/*" onChange={handleVoucherScan} className="hidden" />
            <button 
              type="button" 
              onClick={() => fileInputRef.current?.click()} 
              disabled={isScanning}
              className="bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-bold text-[10px] uppercase tracking-wider px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-lg shadow-indigo-500/20 active:scale-95 transition-all"
            >
              {isScanning ? (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  SCANNING...
                </>
              ) : (
                <>
                  <Sparkles size={11} className="text-amber-300" />
                  SCAN VOUCHER
                </>
              )}
            </button>
          </div>
        </div>

        <form onSubmit={handleFormSubmit} className="space-y-4 font-sans">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Date Picker */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">DATE</label>
              <input 
                type="date" 
                required 
                value={date} 
                onChange={e => setDate(e.target.value)} 
                className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-indigo-500 w-full font-mono cursor-pointer" 
              />
            </div>

            {/* Type selector */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">TYPE</label>
              <select 
                value={type} 
                onChange={e => setType(e.target.value as any)} 
                className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-indigo-500 w-full font-sans cursor-pointer"
              >
                <option value="သုံးငွေ (Spent)">သုံးငွေ (Spent)</option>
                <option value="ထုတ်ငွေ (Issued)">ထုတ်ငွေ (Issued)</option>
              </select>
            </div>

            {/* Employee dropdown lists ALL staff unified */}
            <div className="flex flex-col gap-1 md:col-span-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase">STAFF NAME *</label>
              <select 
                required
                value={staffName} 
                onChange={e => setStaffName(e.target.value)} 
                className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-indigo-500 w-full font-sans cursor-pointer"
              >
                <option value="">အမည်ရွေးပါ *</option>
                {allStaffNames.map(nameStr => (
                  <option key={nameStr} value={nameStr}>{nameStr}</option>
                ))}
              </select>
            </div>

            {/* Item description */}
            <div className="flex flex-col gap-1 md:col-span-4">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Item Name (ပစ္စည်းအမည်)*</label>
              <input 
                placeholder="Ex. 9 Inch Plastic Folders, Blueprint sheets, Coffee..." 
                type="text" 
                required 
                value={itemName} 
                onChange={e => setItemName(e.target.value)} 
                className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-indigo-500 w-full font-sans" 
              />
            </div>

            {/* Quantities & Pricing metrics */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">အရေအတွက် (Qty)</label>
              <input 
                placeholder="Ex. 1" 
                type="number" 
                required 
                value={qty} 
                onChange={e => handleQtyChange(e.target.value)} 
                className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-indigo-500 w-full font-mono text-right" 
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">တစ်ခုချင်းတန်ဖိုး (Unit Price)</label>
              <input 
                placeholder="Ex. 12000" 
                type="number" 
                value={unitPrice} 
                onChange={e => handleUnitPriceChange(e.target.value)} 
                className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-indigo-500 w-full font-mono text-right" 
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">ဝယ်ယူသည့်ဈေး (After Discount)</label>
              <input 
                placeholder="Ex. 10000" 
                type="number"
                value={beforeDiscount} 
                onChange={e => handleAfterDiscountUnitChange(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-indigo-500 w-full font-mono text-right" 
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase font-sans">ကျသင့်ငွေ (Total MMK)*</label>
              <input 
                placeholder="Ex. 12000" 
                type="number" 
                required 
                value={afterDiscount} 
                onChange={e => setAfterDiscount(e.target.value)} 
                className="bg-slate-950 border border-slate-500/30 text-emerald-400 font-bold rounded-xl px-4 py-2.5 text-sm outline-none focus:border-indigo-500 w-full font-mono text-right" 
              />
            </div>

            {/* Remarks */}
            <div className="flex flex-col gap-1 md:col-span-4">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Remark (မှတ်ချက် - မထည့်လည်းရသည်)</label>
              <input 
                placeholder="Ex. Stationery for client proposal file, urgent purchase..." 
                type="text" 
                value={remark} 
                onChange={e => setRemark(e.target.value)} 
                className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-indigo-500 w-full font-sans" 
              />
            </div>
          </div>

          <p className="text-[10px] text-slate-500 font-sans italic pt-1">
            * ဤသုံးစွဲစရိတ်ရှိ ပစ္စည်းအမည်နှင့် စျေးနှုန်းအား Data Collection (Material Prices) တွင် အလိုအလျောက် မှတ်သားသိမ်းဆည်းပေးမည်။
          </p>

          <div className="flex justify-end gap-2 pt-2">
            {editingId && (
              <button 
                type="button" 
                onClick={handleCancelEdit} 
                className="bg-slate-850 hover:bg-slate-800 text-slate-400 px-6 py-2.5 rounded-xl font-bold text-xs uppercase"
              >
                Cancel
              </button>
            )}
            <button 
              type="submit" 
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-10 py-3 rounded-xl uppercase tracking-wider text-xs shadow-lg shadow-emerald-500/10 transition-all font-sans"
            >
              SAVE
            </button>
          </div>
        </form>
      </div>

      {/* Filter and Table Panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-4 bg-slate-950/40 border-b border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-3">
          {/* Filtering field */}
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest font-sans">NAME:</span>
            <select 
              value={selectedNameFilter} 
              onChange={e => setSelectedNameFilter(e.target.value)} 
              className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-xs outline-none focus:border-indigo-500 font-sans cursor-pointer min-w-[200px]"
            >
              <option value="All">All</option>
              {allStaffNames.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <label className="bg-slate-950 hover:bg-slate-850 text-slate-300 font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 border border-slate-800 cursor-pointer transition-all">
              <Upload size={13} className="text-emerald-400" />
              Import
              <input type="file" accept=".xlsx,.xls,.csv" onChange={handleImportExcel} className="hidden" />
            </label>

            <button 
              onClick={handleExportExcel}
              className="bg-slate-950 hover:bg-slate-850 text-slate-300 font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 border border-slate-800 transition-all"
            >
              <Download size={13} className="text-indigo-400" />
              Export
            </button>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="overflow-x-auto overflow-y-auto max-h-[500px]">
          <table className="w-full text-left font-sans">
            <thead className="bg-slate-950 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800">
              <tr>
                <th className="sticky top-0 bg-slate-950 z-20 px-5 py-3.5 w-14">NO.</th>
                <th className="sticky top-0 bg-slate-950 z-20 px-5 py-3.5 w-28">DATE</th>
                <th className="sticky top-0 bg-slate-950 z-20 px-5 py-3.5">ITEM / DETAILS</th>
                <th className="sticky top-0 bg-slate-950 z-20 px-5 py-3.5 text-right w-44">AMOUNT & PRICE</th>
                <th className="sticky top-0 bg-slate-950 z-20 px-5 py-3.5 text-center w-28">ACTION</th>
                <th className="sticky top-0 bg-slate-950 z-20 px-5 py-3.5">REMARK</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-500 italic text-xs">
                    မှတ်တမ်းတင်ထားသော Office & Utilities စာရင်းများ မရှိသေးပါ။
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((t, idx) => {
                  const isSpent = t.flow_type !== 'IN';
                  const absAmt = Math.abs(Number(t.amount) || 0);

                  return (
                    <tr key={t.id} className="hover:bg-slate-850/20 text-xs text-slate-300">
                      <td className="px-5 py-4 text-slate-500 font-mono">
                        {filteredTransactions.length - idx}
                      </td>
                      <td className="px-5 py-4 font-mono white-space-nowrap">
                        {t.date}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-200 text-sm">
                            {t.particular || t.item}
                          </span>
                          <span className="text-[10px] text-indigo-400 font-bold mt-0.5">
                            {t.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex flex-col items-end">
                          <span className={`font-mono font-bold text-sm ${isSpent ? 'text-rose-450' : 'text-emerald-400'}`}>
                            {isSpent ? '-' : ''}{formatMyanmarMoney(absAmt)} <span className="text-[10px] text-slate-500 font-normal">Ks</span>
                          </span>
                          <span className="text-[9px] text-slate-500 font-bold mt-0.5 uppercase">
                            {isSpent ? 'သုံးငွေ' : 'ထုတ်ငွေ'}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <div className="flex justify-center gap-1.5">
                          <button 
                            onClick={() => handleStartEdit(t)} 
                            className="p-1.5 bg-slate-950 border border-slate-800 rounded-lg hover:border-indigo-500 text-slate-400 hover:text-indigo-400 transition-all"
                          >
                            <Pencil size={12} />
                          </button>
                          <button 
                            onClick={() => {
                              setLocalConfirm({
                                title: "ဒေတာဖျက်သိမ်းရန် အတည်ပြုခြင်း",
                                message: "ဤဒေတာကို ဖျက်ရန် သေချာပါသလား?",
                                onConfirm: async () => {
                                  await onDelete('transactions', t.id);
                                  showToast("ဒေတာကို ဖျက်ဆီးလိုက်ပါပြီ", "success");
                                }
                              });
                            }} 
                            className="p-1.5 bg-slate-950 border border-slate-800 rounded-lg hover:border-rose-500 text-slate-400 hover:text-rose-500 transition-all"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-slate-450 italic overflow-hidden text-ellipsis max-w-xs">
                        {t.remark || '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Aggregate sum board matches structural footer screenshots */}
        <div className="bg-slate-950/80 border-t border-slate-800/80 px-6 py-5 flex flex-col items-center justify-center gap-3 font-sans w-full">
          <div className="flex items-center gap-3 text-xs w-full max-w-lg justify-between">
            <span className="text-slate-400 font-bold uppercase tracking-wider">
              စုစုပေါင်း ထုတ်ငွေ (TOTAL ISSUED) :
            </span>
            <span className="text-indigo-400 font-mono font-black text-sm">
              {formatMyanmarMoney(totals.totalIssued)} Ks
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs w-full max-w-lg justify-between">
            <span className="text-slate-400 font-bold uppercase tracking-wider">
              စုစုပေါင်း သုံးငွေ (TOTAL SPENT) :
            </span>
            <span className="text-rose-400 font-mono font-black text-sm">
              -{formatMyanmarMoney(totals.totalSpent)} Ks
            </span>
          </div>

          <div className="h-px bg-slate-800/80 w-full max-w-lg my-1"></div>

          <div className="flex items-center gap-3 w-full max-w-lg justify-between text-xs font-bold">
            <span className="text-amber-400 uppercase tracking-widest">
              လက်ကျန်ငွေ (BALANCE) :
            </span>
            <span className="text-amber-400 font-mono font-black text-base">
              {formatMyanmarMoney(totals.balance)} Ks
            </span>
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
