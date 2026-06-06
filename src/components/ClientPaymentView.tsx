/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Coins, Trash2, Calendar, Clipboard, CheckSquare, Plus, X, Upload, Download, Info } from 'lucide-react';
import { Transaction, AdditionalWork } from '../types';
import { bulkDeleteDocuments, bulkSaveDocuments } from '../lib/db';

interface ClientPaymentProps {
  transactions: Transaction[];
  currentProjectId: string | null;
  activeProject?: any;
  onUpdateActiveProjectField?: (field: string, value: any) => Promise<void>;
  onSavePayment: (data: any) => void;
  onDeletePayment: (id: string) => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export const ClientPaymentView: React.FC<ClientPaymentProps> = ({
  transactions,
  currentProjectId,
  activeProject,
  onUpdateActiveProjectField,
  onSavePayment,
  onDeletePayment,
  showToast
}) => {
  // If no project is selected
  if (!currentProjectId || !activeProject) {
    return (
      <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl text-center">
        <Coins size={48} className="text-indigo-400 mx-auto mb-4 opacity-50" />
        <h3 className="text-white font-bold text-lg">No Active Project Selected</h3>
        <p className="text-slate-400 italic text-sm mt-1 max-w-md mx-auto">
          Please load or select an active project from the top directory dropdown to manage client payments.
        </p>
      </div>
    );
  }

  // --- CLIENT DETAILS BINDING STATES ---
  const [clientName, setClientName] = useState(activeProject.clientName || '');
  const [clientPhone, setClientPhone] = useState(activeProject.clientPhone || '');
  const [address, setAddress] = useState(activeProject.address || '');
  const [contractDate, setContractDate] = useState(activeProject.contractDate || '');
  const [budget, setBudget] = useState(String(activeProject.budget || '0'));

  // Sync state if activeProject ID or fields change
  useEffect(() => {
    setClientName(activeProject.clientName || '');
    setClientPhone(activeProject.clientPhone || '');
    setAddress(activeProject.address || '');
    setContractDate(activeProject.contractDate || '');
    setBudget(String(activeProject.budget || '0'));
  }, [
    activeProject.id,
    activeProject.clientName,
    activeProject.clientPhone,
    activeProject.address,
    activeProject.contractDate,
    activeProject.budget
  ]);

  const handleFieldBlur = (field: string, value: any) => {
    if (onUpdateActiveProjectField) {
      onUpdateActiveProjectField(field, value);
    }
  };

  // --- ADDITIONAL WORKS & VARIATIONS STATES ---
  const [addWorkDate, setAddWorkDate] = useState(new Date().toISOString().split('T')[0]);
  const [addWorkName, setAddWorkName] = useState('');
  const [addWorkAmount, setAddWorkAmount] = useState('');

  const handleAddAdditionalWork = async () => {
    if (!addWorkName || !addWorkAmount) return;
    
    const amountVal = Number(addWorkAmount.replace(/,/g, '')) || 0;
    const newWork: AdditionalWork = {
      id: 'addon_' + Date.now().toString(36),
      date: addWorkDate,
      name: addWorkName,
      amount: amountVal
    };

    const currentAddons = Array.isArray(activeProject.additionalWorks) ? activeProject.additionalWorks : [];
    const updatedAddons = [...currentAddons, newWork];

    if (onUpdateActiveProjectField) {
      await onUpdateActiveProjectField('additionalWorks', updatedAddons);
      showToast("ထပ်တိုးလုပ်ငန်း (Variation Work) ကို စာရင်းသွင်းပြီးပါပြီ။", "success");
      setAddWorkName('');
      setAddWorkAmount('');
    }
  };

  const handleRemoveAdditionalWork = async (addonId: string) => {
    if (!onUpdateActiveProjectField) return;
    setLocalConfirm({
      title: "ထပ်တိုးလုပ်ငန်း ဖျက်မည်",
      message: "ဤထပ်တိုးလုပ်ငန်းစရိတ်စုတ်ချက်ကို ဖျက်ဆီးရန် သေချာပါသလား?",
      onConfirm: async () => {
        const currentAddons = Array.isArray(activeProject.additionalWorks) ? activeProject.additionalWorks : [];
        const updatedAddons = currentAddons.filter((w: any) => w.id !== addonId);
        await onUpdateActiveProjectField('additionalWorks', updatedAddons);
        showToast("ထပ်တိုးလုပ်ငန်းစာရင်းကို ဖျက်သိမ်းပြီးပါပြီ။");
      }
    });
  };

  // --- RECORD TRANSACTION STATE ---
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0]);
  const [txStatus, setTxStatus] = useState('1st Payment');
  const [isCustomStatus, setIsCustomStatus] = useState(false);
  const [customStatusText, setCustomStatusText] = useState('');
  const [txParticular, setTxParticular] = useState('');
  const [isCustomParticular, setIsCustomParticular] = useState(false);
  const [customParticularText, setCustomParticularText] = useState('');
  const [txAmount, setTxAmount] = useState('');
  const [txRemark, setTxRemark] = useState('');

  // Auto set first choice for particular
  useEffect(() => {
    if (!txParticular) {
      setTxParticular("Main Contract");
    }
  }, []);

  const particularOptions = useMemo(() => {
    const list = [
      "Main Contract",
      "Additional Payment 1",
      "Additional Payment 2",
      "Additional Payment 3",
      "Additional Payment 4"
    ];
    if (Array.isArray(activeProject.additionalWorks)) {
      activeProject.additionalWorks.forEach((w: any) => {
        list.push(`Additional Work - ${w.name}`);
      });
    }
    list.push("Custom (ကိုယ်တိုင်ရေးသားမည်...)");
    return list;
  }, [activeProject.additionalWorks]);

  // Handle transaction save
  const handleRecordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalParticular = isCustomParticular ? customParticularText : txParticular;
    if (!finalParticular) {
      showToast("Description အား ရွေးချယ် သို့မဟုတ် ဖြည့်သွင်းပေးပါ။", "error");
      return;
    }
    const cleanAmount = Number(txAmount.replace(/,/g, '')) || 0;
    if (cleanAmount <= 0) {
      showToast("Amount (ငွေပမာဏ) အား မှန်ကန်စွာ ဖြည့်စွက်ပါ။", "error");
      return;
    }

    const finalStatus = isCustomStatus ? customStatusText : txStatus;

    onSavePayment({
      date: txDate,
      particular: finalParticular,
      amount: cleanAmount,
      status: finalStatus,
      category: 'Client Billing',
      flow_type: 'IN',
      remark: txRemark,
      projectId: currentProjectId
    });

    setTxAmount('');
    setTxRemark('');
    if (isCustomParticular) {
      setCustomParticularText('');
      setIsCustomParticular(false);
      setTxParticular("Main Contract");
    }
    if (isCustomStatus) {
      setCustomStatusText('');
      setIsCustomStatus(false);
      setTxStatus("1st Payment");
    }
    showToast("အတောင်းခံ/အလှူငွေ မှတ်တမ်းကို သိမ်းဆည်းလိုက်ပါပြီ။", "success");
  };

  // --- TRANSACTIONS METRICS & FILTER ---
  const clientPayments = useMemo(() => {
    return transactions
      .filter(t => t.projectId === currentProjectId && t.flow_type === 'IN' && t.category === 'Client Billing')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, currentProjectId]);

  const [nameFilter, setNameFilter] = useState('All');
  const [localConfirm, setLocalConfirm] = useState<{
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
  } | null>(null);

  const filteredClientPayments = useMemo(() => {
    if (nameFilter === 'All') return clientPayments;
    return clientPayments.filter(p => p.particular === nameFilter || p.status === nameFilter);
  }, [clientPayments, nameFilter]);

  const uniqueFilterChoices = useMemo(() => {
    const list = new Set<string>();
    clientPayments.forEach(p => {
      if (p.particular) list.add(p.particular);
      if (p.status) list.add(p.status);
    });
    return Array.from(list);
  }, [clientPayments]);

  const formatMoney = (val: any) => {
    if (!val) return '0';
    return Number(String(val).replace(/,/g, '')).toLocaleString();
  };

  // Metric Calculations
  const mainContractValue = Number(budget.replace(/,/g, '')) || 0;
  
  const additionalWorksValue = useMemo(() => {
    const worksList = Array.isArray(activeProject.additionalWorks) ? activeProject.additionalWorks : [];
    return worksList.reduce((sum: number, w: any) => sum + Number(w.amount || 0), 0);
  }, [activeProject.additionalWorks]);

  const totalReceivable = mainContractValue + additionalWorksValue;

  const totalCollected = useMemo(() => {
    // Treat as collected if status is Paid or no status is specified
    return clientPayments
      .filter(p => !p.status || p.status === 'Paid')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  }, [clientPayments]);

  const remainingBalance = totalReceivable - totalCollected;

  // --- IMPORT & EXPORT UTILITIES ---
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getRowVal = (row: any, candidateKeys: string[]): any => {
    if (!row || typeof row !== 'object') return undefined;
    const rowKeys = Object.keys(row);
    for (const key of rowKeys) {
      const kClean = key.trim().toLowerCase();
      for (const cand of candidateKeys) {
        if (kClean === cand.toLowerCase() || kClean.includes(cand.toLowerCase()) || cand.toLowerCase().includes(kClean)) {
          return row[key];
        }
      }
    }
    return undefined;
  };

  const handleExport = () => {
    if (clientPayments.length === 0) {
      showToast("ထုတ်ယူရန် Data မရှိသေးပါ", "error");
      return;
    }

    const XLSX = (window as any).XLSX;
    if (!XLSX) {
      showToast("Excel exporter is currently offline.", "error");
      return;
    }

    const headers = [
      "No.", "Date", "Particular / Details", "Amount (MMK)", "Status", "Remark"
    ];

    const rows = clientPayments.map((p, index) => [
      index + 1,
      p.date,
      p.particular,
      p.amount,
      p.status || 'Paid',
      p.remark || '-'
    ]);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    XLSX.utils.book_append_sheet(wb, ws, "Client Payments");
    XLSX.writeFile(wb, `ClientPayments_${activeProject.projectName.replace(/\s+/g, '_')}.xlsx`);
    showToast("သင့် Client Payment records များကို Excel (.xlsx) ဖိုင်အဖြစ် အောင်မြင်စွာ ဒေါင်းလုဒ်ဆွဲလိုက်ပါပြီ။", "success");
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.endsWith('.json')) {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const parsed = JSON.parse(evt.target?.result as string);
          const listToImport = parsed.clientPayments || parsed;
          if (Array.isArray(listToImport)) {
            for (const item of listToImport) {
              await onSavePayment({
                date: item.date || new Date().toISOString().split('T')[0],
                particular: item.particular || 'Imported Payment',
                amount: Number(item.amount) || 0,
                status: item.status || 'Paid',
                remark: item.remark || '',
                category: 'Client Billing',
                flow_type: 'IN',
                projectId: currentProjectId
              });
            }
            showToast("အောင်မြင်စွာ ဖိုင်တွဲထည့်သွင်းပြီးပါပြီ။", "success");
          } else {
            showToast("ဖိုင်ပုံစံစနစ် မမှန်ကန်ပါ။ CSV သို့မဟုတ် JSON list ဖြစ်ရပါမည်။", "error");
          }
        } catch (err) {
          showToast("ဖိုင်ဖတ်ရာတွင် အမှားအယွင်းရှိပါသည်။", "error");
        }
      };
      reader.readAsText(file);
    } else {
      // Excel or CSV
      const XLSX = (window as any).XLSX;
      if (!XLSX) {
        showToast("Excel/CSV parser is currently offline.", "error");
        return;
      }
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const data = new Uint8Array(evt.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const parsedRows: any[] = XLSX.utils.sheet_to_json(sheet);

          if (!parsedRows || parsedRows.length === 0) {
            showToast("ဝင်လာသောဖိုင်တွင် ဒေတာမရှိပါ။", "error");
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

            const rawPart = getRowVal(row, ["particular", "detail", "details", "အကြောင်းအရာ"]);
            const finalPart = String(rawPart || '').trim() || 'Imported Payment';

            const rawAmt = getRowVal(row, ["amount", "price", "ကျသင့်ငွေ", "တန်ဖိုး"]);
            const finalAmt = Number(String(rawAmt || '').replace(/[^0-9.-]/g, '')) || 0;

            const rawStatus = getRowVal(row, ["status", "state", "အခြေအနေ"]);
            const finalStatus = String(rawStatus || '').trim() || 'Paid';

            const rawRemark = getRowVal(row, ["remark", "note", "မှတ်ချက်"]);
            const finalRemarkText = String(rawRemark || '').trim() === '-' ? '' : String(rawRemark || '').trim();

            await onSavePayment({
              date: finalDate,
              particular: finalPart,
              amount: finalAmt,
              status: finalStatus,
              remark: finalRemarkText,
              category: 'Client Billing',
              flow_type: 'IN',
              projectId: currentProjectId
            });
            count++;
          }
          showToast(`အောင်မြင်စွာ ဖိုင်တွဲမှ အချက်အလက် (${count}) ခု ထည့်သွင်းပြီးပါပြီ။`, "success");
        } catch (err) {
          console.error(err);
          showToast("ဖိုင်ဖတ်ရာတွင် အမှားအယွင်းရှိပါသည်။", "error");
        }
      };
      reader.readAsArrayBuffer(file);
    }
    e.target.value = ''; // Clear input
  };

  const handleDeleteAll = () => {
    const list = filteredClientPayments;
    if (list.length === 0) return;

    setLocalConfirm({
      title: "စာရင်းအားလုံးဖျက်ရန် သေချာပါသလား?",
      message: `လက်ရှိ Client Payments စာရင်းအားလုံး (${list.length} ခု) ကို ဖျက်ရန် သေချာပါသလား?\n\nဤလုပ်ဆောင်ချက်သည် ပြန်ပြင်၍မရနိုင်ပါ။`,
      onConfirm: async () => {
        showToast("စာရင်းအားလုံးကို ဖျက်ဆီးနေပါသည်...", "success");
        try {
          await bulkDeleteDocuments('transactions', list.map(p => p.id));
          showToast("စာရင်းအားလုံး ဖျက်ဆီးပြီးပါပြီ။", "success");
        } catch (err) {
          console.error(err);
          showToast("ဖျက်သိမ်းခြင်း မအောင်မြင်ပါ။", "error");
        }
      }
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <h2 className="text-xl font-black text-white uppercase tracking-tight">Client Payment</h2>
          <p className="text-xs text-slate-500 mt-1 font-sans">
            Tracking customer payment receipts, contract updates, and additional billing schedules
          </p>
        </div>
      </div>

      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleImportFileChange} 
        accept=".xlsx, .xls, .csv, .json" 
        className="hidden" 
      />

      {/* BLOCK 1: CLIENT DETAILS & ADDITIONAL WORKS */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-6">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <Coins className="text-yellow-400" size={18} />
          <h3 className="font-bold text-white text-sm uppercase tracking-wider">Client Details (အပ်နှံသူ အချက်အလက်များ)</h3>
        </div>

        {/* 4-columns grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Client Name *</label>
            <input 
              type="text"
              placeholder="Client Name"
              value={clientName}
              onChange={e => setClientName(e.target.value)}
              onBlur={() => handleFieldBlur('clientName', clientName)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm outline-none w-full focus:border-indigo-500 transition-all font-medium"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Client Phone No</label>
            <input 
              type="text"
              placeholder="09xxxxxxxxx"
              value={clientPhone}
              onChange={e => setClientPhone(e.target.value)}
              onBlur={() => handleFieldBlur('clientPhone', clientPhone)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm outline-none w-full focus:border-indigo-500 transition-all font-mono"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Project Address</label>
            <input 
              type="text"
              placeholder="Address"
              value={address}
              onChange={e => setAddress(e.target.value)}
              onBlur={() => handleFieldBlur('address', address)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm outline-none w-full focus:border-indigo-500 transition-all font-medium"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Contract Date</label>
            <input 
              type="date"
              value={contractDate}
              onChange={e => setContractDate(e.target.value)}
              onBlur={() => handleFieldBlur('contractDate', contractDate)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm outline-none w-full focus:border-indigo-500 transition-all font-mono"
            />
          </div>
        </div>

        {/* Full width main contract display / numeric input */}
        <div className="flex flex-col gap-1 bg-[#05070c] border border-slate-800 rounded-2xl p-4">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">MAIN CONTRACT VALUE (MMK)</label>
          <input 
            type="text"
            value={formatMoney(budget)}
            onChange={e => {
              const cleaned = e.target.value.replace(/,/g, '');
              if (/^\d*$/.test(cleaned)) setBudget(cleaned);
            }}
            onBlur={() => handleFieldBlur('budget', Number(budget.replace(/,/g, '')) || 0)}
            className="w-full bg-transparent border-none text-center font-black text-2xl text-white outline-none py-1 font-mono tracking-wide"
          />
        </div>

        {/* ADDITIONAL WORKS SUBSECTION */}
        <div className="border-t border-slate-800 pt-4">
          <p className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider mb-3">+ Additional Works / Charges (ထပ်တိုးလုပ်ငန်းများနှင့် စရိတ်များ)</p>
          
          {/* List of current additional works */}
          {(!activeProject.additionalWorks || activeProject.additionalWorks.length === 0) ? (
            <p className="text-slate-500 text-xs italic mb-4">No additional works added yet.</p>
          ) : (
            <div className="space-y-2 mb-4">
              {activeProject.additionalWorks.map((w: any) => (
                <div key={w.id} className="flex items-center justify-between bg-slate-950 border border-slate-850 p-3 rounded-xl">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-slate-500 font-mono font-bold">{w.date}</span>
                    <span className="text-xs font-bold text-white font-sans">{w.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-emerald-400 font-mono text-xs">+{Number(w.amount).toLocaleString()} MMK</span>
                    <button 
                      onClick={() => handleRemoveAdditionalWork(w.id)} 
                      className="text-slate-500 hover:text-rose-500 p-1 hover:bg-slate-800 rounded transition-all cursor-pointer"
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Form to append project variation works */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input 
              type="date"
              value={addWorkDate}
              onChange={e => setAddWorkDate(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white text-xs outline-none w-full font-mono"
            />
            <input 
              type="text"
              placeholder="Work Name (e.g. Extra Ceiling...)"
              value={addWorkName}
              onChange={e => setAddWorkName(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white text-xs outline-none w-full font-sans"
            />
            <input 
              type="text"
              placeholder="Amount (MMK)"
              value={formatMoney(addWorkAmount)}
              onChange={e => {
                const cleaned = e.target.value.replace(/,/g, '');
                if (/^\d*$/.test(cleaned)) setAddWorkAmount(cleaned);
              }}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-indigo-400 font-bold text-xs outline-none w-full font-mono text-right"
            />
            <button 
              onClick={handleAddAdditionalWork}
              className="w-full bg-[#18112d] hover:bg-[#251b46] border border-indigo-500/20 hover:border-indigo-500/50 text-indigo-300 font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-md shadow-black"
            >
              <Plus size={12} />
              Add Work
            </button>
          </div>
        </div>
      </div>

      {/* BLOCK 2: ADD NEW RECORD CARD */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
        <h4 className="text-xs font-bold text-slate-400 mb-4 uppercase tracking-wider border-b border-slate-800 pb-2">ADD NEW RECORD</h4>
        <form onSubmit={handleRecordSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Date</label>
            <input 
              type="date"
              value={txDate}
              onChange={e => setTxDate(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm outline-none w-full font-mono"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Select Payment Status</label>
            <select
              value={txStatus}
              onChange={e => {
                const val = e.target.value;
                if (val === "Custom") {
                  setIsCustomStatus(true);
                  setTxStatus("Custom");
                } else {
                  setIsCustomStatus(false);
                  setTxStatus(val);
                }
              }}
              className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm outline-none w-full font-medium cursor-pointer"
            >
              <option value="1st Payment">1st Payment</option>
              <option value="2nd Payment">2nd Payment</option>
              <option value="3rd Payment">3rd Payment</option>
              <option value="4th Payment">4th Payment</option>
              <option value="5th Payment">5th Payment</option>
              <option value="Final Payment">Final Payment</option>
              <option value="Additional Payment">Additional Payment</option>
              <option value="Custom">Custom (ခေါင်းစဉ်အသစ် ကိုယ်တိုင်ရေးရန်)</option>
            </select>
          </div>

          <div className="flex flex-col gap-1 md:col-span-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Description / For which Work?*</label>
            <select
              value={isCustomParticular ? "Custom (ကိုယ်တိုင်ရေးသားမည်...)" : txParticular}
              onChange={e => {
                const val = e.target.value;
                if (val === "Custom (ကိုယ်တိုင်ရေးသားမည်...)") {
                  setIsCustomParticular(true);
                } else {
                  setIsCustomParticular(false);
                  setTxParticular(val);
                }
              }}
              className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm outline-none w-full font-medium cursor-pointer"
            >
              {particularOptions.map((opt, i) => (
                <option key={i} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          {/* Conditional custom status text input */}
          {isCustomStatus && (
            <div className="flex flex-col gap-1 md:col-span-4 animate-in slide-in-from-top-2 duration-200">
              <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Custom Payment Status Title *</label>
              <input 
                placeholder="Enter custom payment stage status (e.g. Booking Deposit)..."
                required
                value={customStatusText}
                onChange={e => setCustomStatusText(e.target.value)}
                className="bg-slate-950 border border-indigo-500/30 rounded-xl px-4 py-3 text-white text-sm outline-none w-full"
              />
            </div>
          )}

          {/* Conditional text input if custom selected */}
          {isCustomParticular && (
            <div className="flex flex-col gap-1 md:col-span-4 animate-in slide-in-from-top-2 duration-200">
              <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Custom Work / Bill Title *</label>
              <input 
                placeholder="Enter custom work or bill description..."
                required
                value={customParticularText}
                onChange={e => setCustomParticularText(e.target.value)}
                className="bg-slate-950 border border-indigo-500/30 rounded-xl px-4 py-3 text-white text-sm outline-none w-full"
              />
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Amount (MMK)*</label>
            <input 
              placeholder="Ex. 15,000,000"
              required
              value={formatMoney(txAmount)}
              onChange={e => {
                const cleaned = e.target.value.replace(/,/g, '');
                if (/^\d*$/.test(cleaned)) setTxAmount(cleaned);
              }}
              className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-indigo-400 font-bold text-sm outline-none w-full font-mono text-right"
            />
          </div>

          <div className="flex flex-col gap-1 md:col-span-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Remark (Optional)</label>
            <input 
              placeholder="Optional Note - မည်သည့်ရည်ရွယ်ချက်"
              value={txRemark}
              onChange={e => setTxRemark(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm outline-none w-full"
            />
          </div>

          <div className="flex flex-col justify-end">
            <button 
              type="submit" 
              className="w-full bg-emerald-600 hover:bg-emerald-500 hover:scale-[1.01] active:scale-[0.99] text-white font-bold py-3.5 rounded-xl uppercase tracking-wider text-xs shadow-lg shadow-emerald-600/10 cursor-pointer transition-all duration-200"
            >
              SAVE
            </button>
          </div>
        </form>
      </div>

      {/* BLOCK 3: CLIENT PAYMENT RECORDS */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-3 gap-3">
          <div>
            <h4 className="font-bold text-white text-xs uppercase tracking-widest font-sans">CLIENT PAYMENT RECORDS</h4>
            <p className="text-[11px] text-slate-500 mt-1 uppercase font-mono">{filteredClientPayments.length} transactions match filters</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button 
              onClick={handleImportClick}
              className="px-3.5 py-1.5 bg-slate-950 hover:bg-slate-900 text-slate-300 font-bold border border-slate-800 hover:border-slate-700/80 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
            >
              <Upload size={13} className="text-indigo-400" />
              Import
            </button>
            <button 
              onClick={handleExport}
              className="px-3.5 py-1.5 bg-slate-950 hover:bg-slate-900 text-slate-300 font-bold border border-slate-800 hover:border-slate-700/80 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
            >
              <Download size={13} className="text-indigo-400" />
              Export
            </button>
            {filteredClientPayments.length > 0 && (
              <button 
                onClick={handleDeleteAll}
                className="px-3.5 py-1.5 bg-rose-950/40 hover:bg-rose-900 text-rose-450 border border-rose-800/80 hover:border-rose-700/80 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                title="ဒီဇယားမှ စံချိန်အားလုံးဖျက်ပစ်မည်"
              >
                <Trash2 size={13} className="text-rose-400" />
                Delete All ({filteredClientPayments.length})
              </button>
            )}
          </div>
        </div>

        {/* Filter bar exactly as requested */}
        <div className="flex items-center gap-3 bg-[#0d121f] p-3 rounded-xl border border-slate-850">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest font-mono select-none">NAME:</span>
          <select
            value={nameFilter}
            onChange={e => setNameFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-white text-xs outline-none font-bold"
          >
            <option value="All">All Particulars / Statuses</option>
            <option value="Paid">Status: Paid (ငွေရပြီးသား)</option>
            <option value="Invoiced">Status: Invoiced (တောင်းခံထားသူများ)</option>
            {uniqueFilterChoices.filter(x => x !== 'Paid' && x !== 'Invoiced').map((choice, i) => (
              <option key={i} value={choice}>{choice}</option>
            ))}
          </select>
        </div>

        {/* Interactive Responsive Table */}
        <div className="overflow-x-auto overflow-y-auto max-h-[500px] border border-slate-850 rounded-xl bg-slate-950/20 custom-scrollbar">
          <table className="w-full text-left whitespace-nowrap">
            <thead className="bg-[#05070c] text-[10px] font-black text-slate-450 uppercase tracking-widest border-b border-slate-800">
              <tr>
                <th className="sticky top-0 bg-[#05070c] z-10 px-5 py-3.5 text-slate-500">NO.</th>
                <th className="sticky top-0 bg-[#05070c] z-10 px-5 py-3.5 text-slate-400">DATE</th>
                <th className="sticky top-0 bg-[#05070c] z-10 px-5 py-3.5 text-slate-400">DETAILS</th>
                <th className="sticky top-0 bg-[#05070c] z-10 px-5 py-3.5 text-right text-slate-400">AMOUNT (MMK)</th>
                <th className="sticky top-0 bg-[#05070c] z-10 px-5 py-3.5 text-center text-slate-400">ACTION</th>
                <th className="sticky top-0 bg-[#05070c] z-10 px-5 py-3.5 text-slate-400">REMARK</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850">
              {filteredClientPayments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-500 italic text-xs">
                    No client payment records match specified parameters.
                  </td>
                </tr>
              ) : (
                filteredClientPayments.map((p, idx) => (
                  <tr key={p.id} className="hover:bg-slate-900/40 transition-all font-sans">
                    <td className="px-5 py-3 text-slate-550 font-mono text-xs">{idx + 1}</td>
                    <td className="px-5 py-3 text-slate-350 font-mono text-xs">{p.date}</td>
                    <td className="px-5 py-3">
                      <div className="flex flex-col gap-1">
                        <span className="font-bold text-slate-100 text-xs">{p.particular}</span>
                        <div>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black tracking-wider uppercase border ${
                            p.status === 'Invoiced' 
                              ? 'bg-amber-950/45 text-amber-400 border-amber-500/15'
                              : p.status === 'Paid'
                              ? 'bg-emerald-950/45 text-emerald-400 border-emerald-500/15'
                              : 'bg-indigo-950/45 text-indigo-400 border-indigo-500/15'
                          }`}>
                            {p.status || 'Paid'}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className={`font-mono font-black text-xs ${p.status === 'Invoiced' ? 'text-indigo-400' : 'text-emerald-400'}`}>
                        {p.status === 'Invoiced' ? '' : '+'}{Number(p.amount).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <button 
                        onClick={() => {
                          setLocalConfirm({
                            title: "ငွေပေးချေမှုစာရင်းအား ပျယ်ဖျက်မည်",
                            message: "ဤအပ်နှံသူငွေပေးချေမှုစာရင်းအား ပျယ်ဖျက်ရန် သေချာပါသလား?",
                            onConfirm: () => onDeletePayment(p.id)
                          });
                        }} 
                        className="p-1.5 text-slate-500 hover:text-rose-500 hover:bg-rose-550/10 rounded-lg cursor-pointer transition-all"
                        title="Delete record"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                    <td className="px-5 py-3 text-slate-420 text-xs max-w-xs truncate">{p.remark || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* METRICS SUMMARY PANEL MATCHING THE SCREENSHOT GRID */}
        <div className="bg-[#05070c] border border-slate-800 rounded-xl p-5 space-y-3 block mx-auto max-w-3xl">
          <div className="grid grid-cols-2 gap-4 text-xs font-bold">
            <span className="text-slate-400 font-medium text-right uppercase tracking-wider">Main Contract Value:</span>
            <span className="text-slate-200 font-mono text-left">{mainContractValue.toLocaleString()} MMK</span>

            <span className="text-indigo-400 font-bold text-right uppercase tracking-wider">TOTAL RECEIVABLE AMOUNT:</span>
            <span className="text-indigo-300 font-mono font-black text-left">{totalReceivable.toLocaleString()} MMK</span>

            <span className="text-emerald-400 font-bold text-right uppercase tracking-wider">TOTAL COLLECTED AMOUNT:</span>
            <span className="text-emerald-400 font-mono font-black text-left">{totalCollected.toLocaleString()} MMK</span>

            <span className="text-rose-450 font-black text-right uppercase tracking-wider border-t border-slate-850 pt-2.5">REMAINING BALANCE:</span>
            <span className="text-yellow-400 font-mono font-black text-sm text-left border-t border-slate-850 pt-2.5">{remainingBalance.toLocaleString()} MMK</span>
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
