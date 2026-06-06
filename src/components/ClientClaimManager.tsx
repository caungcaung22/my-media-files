/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Download, Trash2, Pencil, CalendarDays, Loader2, Plus, Scan, X, Receipt, Upload } from 'lucide-react';
import { ClientClaim, Project, ClientClaimItem } from '../types';
import { bulkDeleteDocuments, bulkSaveDocuments } from '../lib/db';

interface ClientClaimManagerProps {
  claims: ClientClaim[];
  availableProjects: Project[];
  currentProject: string | null;
  onSave: (data: any) => void;
  onDelete: (id: string) => void;
  editingItem: any;
  setEditingItem: (item: any) => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export const ClientClaimManager: React.FC<ClientClaimManagerProps> = ({
  claims,
  availableProjects,
  currentProject,
  onSave,
  onDelete,
  editingItem,
  setEditingItem,
  showToast
}) => {
  const defaultForm = {
    date: new Date().toISOString().split('T')[0],
    transport_charges: '',
    service_fee: '',
    status: 'Pending',
    remark: '',
    target_project_id: currentProject || ''
  };
  const [formData, setFormData] = useState(defaultForm);
  const [items, setItems] = useState<any[]>([{ id: Date.now().toString(), name: '', qty: '', price: '', total: '' }]);
  const [search, setSearch] = useState('');
  const [localConfirm, setLocalConfirm] = useState<{
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
  } | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const scanInputRef = useRef<HTMLInputElement>(null);
  const fileImportRef = useRef<HTMLInputElement>(null);

  const formatMoney = (val: any) => {
    if (val === null || val === undefined || val === '') return '';
    const parts = String(val).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join('.');
  };

  const parseMoney = (val: any) => {
    return String(val).replace(/,/g, '');
  };

  useEffect(() => {
    if (editingItem) {
      setFormData({
        date: editingItem.date || new Date().toISOString().split('T')[0],
        transport_charges: editingItem.transport_charges !== undefined ? String(editingItem.transport_charges) : '',
        service_fee: editingItem.service_fee !== undefined ? String(editingItem.service_fee) : '',
        status: editingItem.status || 'Pending',
        remark: editingItem.remark || '',
        target_project_id: editingItem.projectId || currentProject || ''
      });
      setItems(editingItem.items && editingItem.items.length > 0 ? editingItem.items.map((i: any) => ({ ...i, id: i.id || Date.now().toString() + Math.random() })) : [{ id: Date.now().toString(), name: '', qty: '', price: '', total: '' }]);
    } else {
      setFormData({ ...defaultForm, target_project_id: currentProject || '' });
      setItems([{ id: Date.now().toString(), name: '', qty: '', price: '', total: '' }]);
    }
  }, [editingItem, currentProject]);

  const handleItemChange = (idx: number, field: string, val: string) => {
    const newItems = [...items];
    if (field === 'price') {
      const raw = parseMoney(val);
      if (/^\d*\.?\d*$/.test(raw)) {
        newItems[idx].price = raw;
        const q = Number(newItems[idx].qty) || 0;
        const p = Number(raw) || 0;
        newItems[idx].total = q && p ? String(q * p) : newItems[idx].total;
      }
    } else if (field === 'qty') {
      newItems[idx].qty = val;
      const q = Number(val) || 0;
      const p = Number(newItems[idx].price) || 0;
      newItems[idx].total = q && p ? String(q * p) : newItems[idx].total;
    } else if (field === 'total') {
      const raw = parseMoney(val);
      if (/^\d*\.?\d*$/.test(raw)) newItems[idx].total = raw;
    } else {
      newItems[idx][field] = val;
    }
    setItems(newItems);
  };

  const addItem = () => setItems([...items, { id: Date.now().toString(), name: '', qty: '', price: '', total: '' }]);
  const removeItem = (id: string) => setItems(items.filter(i => i.id !== id));

  const handleScanReceipt = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsScanning(true);
      showToast("Voucher / Invoice ကို AI ဖြင့် ဖတ်ရှုနေပါသည်...", "success");

      try {
          let promptText = `Extract receipt/voucher details line-by-line from the provided file. Return ONLY a valid JSON ARRAY of objects. 
          Format strictly like this: [{"name": "Item Name", "qty": 5, "price": 1000, "total": 5000}]. 
          "qty" (quantity), "price" (unit price), and "total" MUST be valid numbers. 
          Extract transport charges or service fees as well if they exist as line items. Exclude all other text.`;

          const base64Data = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve((reader.result as string).split(',')[1]);
              reader.onerror = reject;
              reader.readAsDataURL(file);
          });
          
          // Call Server Proxy Endpoint
          const responseResponse = await fetch("/api/gemini/scan-doc", {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  fileData: base64Data,
                  mimeType: file.type || "image/jpeg",
                  prompt: promptText
              })
          });

          if (!responseResponse.ok) {
             throw new Error("Server API call failed");
          }

          const scanResult = await responseResponse.json();
          const text = scanResult.text;

          if (text) {
              let parsedArray: any[] = [];
              try {
                  let cleanText = text.replace(/```json/gi, '').replace(/```/g, '').trim();
                  let parsedData = JSON.parse(cleanText);
                  
                  if (Array.isArray(parsedData)) {
                      parsedArray = parsedData;
                  } else if (parsedData.items && Array.isArray(parsedData.items)) {
                      parsedArray = parsedData.items;
                  } else if (typeof parsedData === 'object') {
                      parsedArray = [parsedData];
                  }
              } catch (e) {
                  console.warn("Direct JSON Parse failed, trying regex fallback");
                  const arrayMatch = text.match(/\[[\s\S]*\]/);
                  if (arrayMatch) {
                      try { parsedArray = JSON.parse(arrayMatch[0]); } catch(err) {}
                  } else {
                      const objMatch = text.match(/\{[\s\S]*\}/);
                      if (objMatch) {
                          try { parsedArray = [JSON.parse(objMatch[0])]; } catch(err) {}
                      }
                  }
              }

              if (parsedArray && parsedArray.length > 0) {
                  const validItems = parsedArray.filter(i => i.name && (i.total || (i.qty && i.price))).map((i, idx) => ({
                      id: Date.now().toString() + idx,
                      name: String(i.name || ''),
                      qty: i.qty ? String(i.qty).replace(/[^0-9.]/g, '') : '',
                      price: i.price ? String(i.price).replace(/[^0-9.]/g, '') : '',
                      total: i.total ? String(i.total).replace(/[^0-9.]/g, '') : (i.qty && i.price ? String(Number(i.qty) * Number(i.price)) : '')
                  }));

                  if (validItems.length > 0) {
                      setItems(prev => {
                          const hasEmptyFirst = prev.length === 1 && !prev[0].name;
                          if (hasEmptyFirst) return validItems;
                          return [...prev, ...validItems];
                      });
                      showToast(`ပစ္စည်းအမျိုးအစား (${validItems.length}) ခုကို တွေ့ရှိပါသည်။`, "success");
                  } else {
                      showToast("Voucher ထဲမှ မှန်ကန်သော Data ရှာမတွေ့ပါ။", "error");
                  }
              } else {
                  console.error("Parsed output invalid:", text);
                  showToast("JSON format မမှန်ကန်ပါ။", "error");
              }
          } else {
              showToast("Data ခွဲခြမ်းစိတ်ဖြာ၍ မရပါ။ (API မှ Data မပေးပါ)", "error");
          }
      } catch (err) {
          console.error(err);
          showToast("AI Scan ဖတ်ရာတွင် အမှားအယွင်းရှိပါသည်", "error");
      } finally {
          setIsScanning(false);
          if (scanInputRef.current) scanInputRef.current.value = '';
      }
  };

  const materialTotal = items.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
  const grandTotal = materialTotal + (Number(formData.transport_charges) || 0) + (Number(formData.service_fee) || 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = items.filter(i => i.name.trim() !== '');
    if (validItems.length === 0) return showToast("Material အမည် အနည်းဆုံးတစ်ခု ထည့်သွင်းပါ", "error");
    
    const payload = {
      ...formData,
      transport_charges: Number(formData.transport_charges) || 0,
      service_fee: Number(formData.service_fee) || 0,
      items: validItems.map(i => ({
        name: i.name,
        qty: Number(i.qty) || 0,
        price: Number(i.price) || 0,
        total: Number(i.total) || 0
      })),
      total_claim_amount: grandTotal
    };

    onSave(payload);
  };

  const filteredClaims = useMemo(() => {
    let sorted = [...claims].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    if (search) {
      const lower = search.toLowerCase();
      sorted = sorted.filter(c => 
        (c.remark || '').toLowerCase().includes(lower) || 
        c.items.some(i => i.name.toLowerCase().includes(lower))
      );
    }
    return sorted;
  }, [claims, search]);

  const exportToExcel = () => {
    if (filteredClaims.length === 0) return showToast("ထုတ်ယူရန် Claim Data မရှိသဖြင့် Excel ထုတ်၍မရပါ", "error");
    const XLSX = (window as any).XLSX;
    const wb = XLSX.utils.book_new();
    const headers = [
       "No.", "Date", "Items/Details List", "Materials Cost", "Transport Charges", "Service Fee", "Total Claim Amount (MMK)", "Status", "Remark"
    ];
    const rows = filteredClaims.map((c, idx) => {
      const itemsListStr = (c.items || []).map(i => `${i.name} (Qty:${i.qty} x ${i.price})`).join('; ');
      const matCost = (c.items || []).reduce((sum, i) => sum + (Number(i.total) || 0), 0);
      return [
        filteredClaims.length - idx,
        c.date,
        itemsListStr,
        matCost,
        c.transport_charges || 0,
        c.service_fee || 0,
        c.total_claim_amount || 0,
        c.status || 'Pending',
        c.remark || ''
      ];
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    XLSX.utils.book_append_sheet(wb, ws, "Client Claims");
    XLSX.writeFile(wb, `ClientClaims_${currentProject || 'Global'}.xlsx`);
    showToast("Claims record ကို Excel ရေးသွင်းပြီးပါပြီ။", "success");
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
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
          showToast("ဝင်လာသောဖိုင်တွင် ဒေတာမရှိပါ။", "error");
          return;
        }

        showToast("ဆာဗာသို့ ဒေတာများကို ပို့ဆောင်နေပါသည်...", "success");

        const claimsToSave: any[] = [];
        for (let i = 1; i < rows.length; i++) {
          const cols = rows[i];
          if (!cols || cols.length < 1) continue;

          const dateVal = cols[1] ? String(cols[1]).trim() : new Date().toISOString().split('T')[0];
          
          const itemsStr = cols[2] ? String(cols[2]).trim() : '';
          const itemsToCreate: any[] = [];
          if (itemsStr) {
            const splitItems = itemsStr.split(';');
            splitItems.forEach((itStr, idx_i) => {
              const cleaned = itStr.trim();
              if (!cleaned) return;
              let name = cleaned;
              let qty = 1;
              let price = 0;
              const qtyMatch = cleaned.match(/(.+?)\s*\(Qty:\s*([\d.]+)\s*x\s*([\d.]+)\)/i);
              if (qtyMatch) {
                name = qtyMatch[1].trim();
                qty = Number(qtyMatch[2]) || 1;
                price = Number(qtyMatch[3]) || 0;
              }
              itemsToCreate.push({
                name,
                qty,
                price,
                total: qty * price
              });
            });
          }

          if (itemsToCreate.length === 0) {
            itemsToCreate.push({
              name: cols[2] ? String(cols[2]).trim() : 'Reimbursement Item',
              qty: 1,
              price: cols[3] !== undefined ? Number(cols[3]) : 0,
              total: cols[3] !== undefined ? Number(cols[3]) : 0
            });
          }

          const transCharges = cols[4] !== undefined ? Number(cols[4]) : 0;
          const srvFee = cols[5] !== undefined ? Number(cols[5]) : 0;
          const totalClaimsAmt = cols[6] !== undefined ? Number(cols[6]) : 0;
          const statusVal = cols[7] ? String(cols[7]).trim() : 'Pending';
          const remarkVal = cols[8] ? String(cols[8]).trim() : '';

          claimsToSave.push({
            date: dateVal,
            items: itemsToCreate,
            transport_charges: transCharges,
            service_fee: srvFee,
            total_claim_amount: totalClaimsAmt || (itemsToCreate.reduce((sum, item) => sum + (Number(item.total) || 0), 0) + transCharges + srvFee),
            status: statusVal,
            remark: remarkVal,
            projectId: currentProject || 'global',
            timestamp: new Date().toISOString()
          });
        }

        if (claimsToSave.length > 0) {
          await bulkSaveDocuments('claims', claimsToSave);
          showToast(`တောင်းခံမှုမှတ်တမ်း ${claimsToSave.length} ခုကို အောင်မြင်စွာ ဖိုင်သွင်းပြီးပါပြီ။`, "success");
        } else {
          showToast("ထည့်သွင်းရန် အချက်အလက် မတွေ့ရှိပါ", "error");
        }
      } catch (err) {
        console.error("Import error:", err);
        showToast("ဖိုင်ဖတ်ရှုမှု အမှားအယွင်းရှိပါသည်။", "error");
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleDeleteAll = () => {
    const list = filteredClaims;
    if (list.length === 0) return;

    setLocalConfirm({
      title: "စာရင်းအားလုံးဖျက်ရန် သေချာပါသလား?",
      message: `လက်ရှိ Client Claims စာရင်းအားလုံး (${list.length} ခု) ကို ဖျက်ရန် သေချာပါသလား?\n\nဤလုပ်ဆောင်ချက်သည် ပြန်ပြင်၍မရနိုင်ပါ။`,
      onConfirm: async () => {
        showToast("စာရင်းအားလုံးကို ဖျက်ဆီးနေပါသည်...", "success");
        try {
          await bulkDeleteDocuments('claims', list.map(c => c.id));
          showToast("စာရင်းအားလုံး ဖျက်ဆီးပြီးပါပြီ။", "success");
        } catch (err) {
          console.error("Bulk delete claims failure", err);
          showToast("ဖျက်သိမ်းခြင်း မအောင်မြင်ပါ။", "error");
        }
      }
    });
  };

  return (
    <div className="space-y-6 md:space-y-8">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <h2 className="text-xl font-black text-white uppercase tracking-tight">Client Claims</h2>
          <p className="text-xs text-slate-500 mt-1 font-sans">
            Submit material reimbursement requests, site expense claims, and additional billing files
          </p>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 p-5 md:p-8 rounded-2xl md:rounded-3xl shadow-xl relative overflow-hidden">
        <div className="flex justify-between items-center mb-4 md:mb-6 border-b border-slate-800 pb-3 md:pb-4">
           <h4 className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
             <Receipt size={16} className="text-emerald-400"/>
             {editingItem ? 'Edit Claim (ပြင်ဆင်ရန်)' : 'New Material Claim (အသစ်တောင်းခံရန်)'}
           </h4>
           <div className="flex items-center gap-3">
               {editingItem && <button type="button" onClick={() => setEditingItem(null)} className="text-[10px] font-black text-rose-500 uppercase hover:underline">Cancel Edit</button>}
               {!editingItem && (
                   <>
                       <input type="file" accept="image/*, .pdf, .xlsx, .xls, .csv" ref={scanInputRef} onChange={handleScanReceipt} className="hidden" />
                       <button type="button" onClick={() => scanInputRef.current?.click()} disabled={isScanning} className="text-[10px] font-black text-emerald-400 uppercase tracking-widest bg-emerald-900/30 hover:bg-emerald-900/50 px-4 py-2 rounded-xl transition-all flex items-center gap-2 border border-emerald-500/20">
                           {isScanning ? <Loader2 size={14} className="animate-spin" /> : <Scan size={14} />} 
                           Scan Receipt
                       </button>
                   </>
               )}
           </div>
        </div>

        {isScanning && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center text-emerald-400">
             <Scan size={32} className="animate-pulse mb-3" />
             <p className="font-bold text-sm tracking-widest uppercase">Scanning Document...</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6 relative z-0">
           <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
               <div className="flex flex-col gap-1">
                 <label className="text-[10px] font-bold text-slate-500 uppercase">Date *</label>
                 <input type="date" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm outline-none" />
               </div>
               <div className="flex flex-col gap-1">
                 <label className="text-[10px] font-bold text-slate-500 uppercase">Project *</label>
                 <select required value={formData.target_project_id} onChange={e => setFormData({...formData, target_project_id: e.target.value})} className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm outline-none">
                    <option value="">Project ရွေးပါ *</option>
                    {availableProjects.map(p => <option key={p.id} value={p.id}>{p.projectName}</option>)}
                 </select>
               </div>
               <div className="flex flex-col gap-1">
                 <label className="text-[10px] font-bold text-slate-500 uppercase">Status *</label>
                 <select required value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className={`bg-slate-950 border rounded-xl px-4 py-3 text-sm outline-none font-bold ${formData.status === 'Pending' ? 'text-amber-400 border-amber-500/30' : 'text-emerald-400 border-emerald-500/30'}`}>
                    <option value="Pending">Pending (တောင်းခံဆဲ)</option>
                    <option value="Claimed">Claimed (ရရှိပြီး)</option>
                 </select>
               </div>
           </div>

           <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 shadow-inner">
               <div className="flex justify-between items-center mb-4">
                  <h5 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Materials / Items List</h5>
               </div>
               
               <div className="overflow-x-auto w-full custom-scrollbar mb-4">
                  <table className="w-full text-left whitespace-nowrap min-w-[700px]">
                     <thead className="text-[10px] text-slate-500 uppercase tracking-widest border-b border-slate-800/50">
                        <tr>
                           <th className="pb-3 px-2 w-10 text-center">No.</th>
                           <th className="pb-3 px-2 min-w-[200px]">Material Name / Item *</th>
                           <th className="pb-3 px-2 w-24 text-right">Qty</th>
                           <th className="pb-3 px-2 w-32 text-right">Unit Price</th>
                           <th className="pb-3 px-2 w-36 text-right">Total (MMK) *</th>
                           <th className="pb-3 px-2 w-12 text-center"></th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-800/50">
                        {items.map((item, idx) => (
                            <tr key={item.id} className="hover:bg-slate-900/50 transition-all">
                               <td className="py-3 px-2 text-center text-slate-600 font-bold text-xs">{idx + 1}.</td>
                               <td className="py-3 px-2">
                                 <input placeholder="Material Name / Item" required value={item.name} onChange={e => handleItemChange(idx, 'name', e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-indigo-500" />
                               </td>
                               <td className="py-3 px-2">
                                 <input type="number" placeholder="Qty" value={item.qty} onChange={e => handleItemChange(idx, 'qty', e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm outline-none text-right focus:border-indigo-500" />
                               </td>
                               <td className="py-3 px-2">
                                 <input placeholder="Unit Price" value={formatMoney(item.price)} onChange={e => handleItemChange(idx, 'price', e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm outline-none text-right focus:border-indigo-500" />
                               </td>
                               <td className="py-3 px-2">
                                 <input placeholder="Total (MMK)" required value={formatMoney(item.total)} onChange={e => handleItemChange(idx, 'total', e.target.value)} className="w-full bg-slate-900 border border-indigo-500/30 rounded-lg px-3 py-2 text-indigo-400 font-bold text-sm outline-none text-right focus:border-indigo-500" />
                               </td>
                               <td className="py-3 px-2 text-center">
                                 <button type="button" onClick={() => removeItem(item.id)} disabled={items.length === 1} className="p-2 text-rose-400 hover:bg-rose-500/20 rounded-lg transition-all disabled:opacity-30"><X size={16}/></button>
                               </td>
                            </tr>
                        ))}
                     </tbody>
                  </table>
               </div>

               <button type="button" onClick={addItem} className="text-xs font-bold text-indigo-400 hover:text-white flex items-center justify-center gap-1 bg-indigo-500/10 hover:bg-indigo-500/30 px-4 py-2.5 rounded-xl transition-all border border-indigo-500/20">
                  <Plus size={14}/> Add New Material
               </button>
           </div>

           <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
               <div className="space-y-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Transport Charges (ကားခ/ပို့ဆောင်ခ) - <span className="text-indigo-400 normal-case">Optional</span></label>
                    <input placeholder="Amount (MMK) - မဖြည့်လည်းရသည်" value={formatMoney(formData.transport_charges)} onChange={e => {
                         const raw = parseMoney(e.target.value);
                         if (/^\d*\.?\d*$/.test(raw)) setFormData({...formData, transport_charges: raw});
                    }} className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm outline-none font-mono focus:border-indigo-500" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Service Fee (ဝန်ဆောင်ခ) - <span className="text-indigo-400 normal-case">Optional</span></label>
                    <input placeholder="Amount (MMK) - မဖြည့်လည်းရသည်" value={formatMoney(formData.service_fee)} onChange={e => {
                         const raw = parseMoney(e.target.value);
                         if (/^\d*\.?\d*$/.test(raw)) setFormData({...formData, service_fee: raw});
                    }} className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm outline-none font-mono focus:border-indigo-500" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Remark (မှတ်ချက်) - <span className="text-indigo-400 normal-case">Optional</span></label>
                    <input placeholder="Optional Note - မဖြည့်လည်းရသည်" value={formData.remark} onChange={e => setFormData({...formData, remark: e.target.value})} className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-indigo-500" />
                  </div>
               </div>

               <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-emerald-500/30 rounded-2xl p-6 shadow-xl flex flex-col justify-center">
                  <div className="space-y-3 mb-4 border-b border-slate-800 pb-4 text-sm font-mono text-slate-400">
                     <div className="flex justify-between">
                        <span>Materials Total:</span>
                        <span>{materialTotal.toLocaleString()}</span>
                     </div>
                     <div className="flex justify-between">
                        <span>Transport Charges:</span>
                        <span>{Number(formData.transport_charges || 0).toLocaleString()}</span>
                     </div>
                     <div className="flex justify-between">
                        <span>Service Fee:</span>
                        <span>{Number(formData.service_fee || 0).toLocaleString()}</span>
                     </div>
                  </div>
                  <div className="flex justify-between items-end">
                      <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Total Claim Amount:</span>
                      <span className="text-3xl font-black text-emerald-400">{grandTotal.toLocaleString()} <span className="text-sm font-normal text-slate-500">MMK</span></span>
                  </div>
               </div>
           </div>
           
           <button type="submit" className={`w-full md:w-auto px-10 rounded-xl font-black text-white shadow-lg py-4 mt-2 text-sm ${editingItem ? 'bg-indigo-600' : 'bg-emerald-600'}`}>
              {editingItem ? 'UPDATE CLAIM' : 'SUBMIT CLAIM'}
           </button>
        </form>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl shadow-2xl overflow-hidden w-full flex flex-col">
        <div className="p-4 bg-slate-950/50 border-b border-slate-800 flex items-center justify-between gap-4 flex-wrap">
           <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
              <input 
                type="text" placeholder="Search claims..." value={search} onChange={e => setSearch(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 focus:border-indigo-500 rounded-xl pl-10 pr-4 py-2 text-sm text-white outline-none transition-all"
              />
           </div>

           <div className="flex gap-2 items-center flex-wrap">
              <input 
                type="file" 
                ref={fileImportRef} 
                onChange={handleImportExcel} 
                accept=".xlsx, .xls, .csv" 
                className="hidden" 
              />
              <button 
                onClick={() => fileImportRef.current?.click()}
                className="bg-[#121f2f]/60 hover:bg-[#1b2f47] border border-blue-900/30 text-[#3ba2f8] px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 select-none cursor-pointer"
              >
                <Upload size={13} /> Import
              </button>
              <button onClick={exportToExcel} className="bg-slate-800 hover:bg-slate-700 text-emerald-400 hover:text-white border border-slate-700 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 select-none cursor-pointer">
                 <Download size={13}/> Export
              </button>
              {filteredClaims.length > 0 && (
                <button 
                  onClick={handleDeleteAll}
                  className="bg-rose-950/40 hover:bg-rose-900 border border-rose-800/80 text-rose-400 hover:text-rose-200 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 select-none cursor-pointer"
                  title="တောင်းခံမှုမှတ်တမ်းအားလုံးဖျက်မည်"
                >
                  <Trash2 size={13} /> Delete All ({filteredClaims.length})
                </button>
              )}
           </div>
        </div>

        <div className="overflow-x-auto overflow-y-auto w-full custom-scrollbar max-h-[600px] relative">
          <table className="w-full text-left whitespace-nowrap min-w-[900px]">
            <thead className="bg-slate-950/90 backdrop-blur-md text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800 sticky top-0 z-10">
               <tr>
                  <th className="px-4 md:px-6 py-4 w-10 text-center">No.</th>
                  <th className="px-4 md:px-6 py-4">Date</th>
                  <th className="px-4 md:px-6 py-4">Materials / Items</th>
                  <th className="px-4 md:px-6 py-4 text-right">Materials Cost</th>
                  <th className="px-4 md:px-6 py-4 text-right">Charges/Fees</th>
                  <th className="px-4 md:px-6 py-4 text-right text-emerald-400">Total Claim</th>
                  <th className="px-4 md:px-6 py-4 text-center">Status</th>
                  <th className="px-4 md:px-6 py-4 text-center">Action</th>
               </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
               {filteredClaims.length === 0 ? (
                 <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-600 italic text-sm">No claims found.</td></tr>
               ) : filteredClaims.map((item, index) => (
                 <tr key={item.id} className={`transition-all ${item.status === 'Pending' ? 'bg-amber-900/10 border-l-4 border-amber-500 hover:bg-amber-900/20' : 'hover:bg-slate-800/30 border-l-4 border-transparent'}`}>
                    <td className="px-4 md:px-6 py-3 md:py-4 text-center text-slate-500 font-mono text-[11px]">{index + 1}</td>
                    <td className="px-4 md:px-6 py-3 md:py-4 text-slate-400 font-mono text-[11px]">{item.date}</td>
                    
                    <td className="px-4 md:px-6 py-3 md:py-4">
                       <p className="font-bold text-slate-200 text-sm truncate max-w-[250px]">{item.items?.map(i => i.name).join(', ')}</p>
                       <p className="text-[10px] text-slate-500 mt-0.5">{item.items?.length || 0} Item{(item.items?.length || 0) > 1 ? 's' : ''}</p>
                       {item.remark && <p className="text-[10px] text-indigo-400 mt-1 italic">Note: {item.remark}</p>}
                    </td>

                    <td className="px-4 md:px-6 py-3 md:py-4 text-right text-slate-300 font-mono text-xs">
                       {item.items?.reduce((sum, i) => sum + (Number(i.total) || 0), 0).toLocaleString()}
                    </td>
                    
                    <td className="px-4 md:px-6 py-3 md:py-4 text-right">
                       <div className="flex flex-col items-end text-[10px] text-slate-400 font-mono">
                          <span>Tr: {Number(item.transport_charges || 0).toLocaleString()}</span>
                          <span>Sv: {Number(item.service_fee || 0).toLocaleString()}</span>
                       </div>
                    </td>
                    
                    <td className="px-4 md:px-6 py-3 md:py-4 text-right font-black text-emerald-400 text-sm">
                       {Number(item.total_claim_amount).toLocaleString()}
                    </td>
                    
                    <td className="px-4 md:px-6 py-3 md:py-4 text-center">
                       <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${item.status === 'Pending' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.3)]' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'}`}>
                          {item.status}
                       </span>
                    </td>
                    
                    <td className="px-4 md:px-6 py-3 md:py-4 text-center">
                       <div className="flex justify-center gap-1">
                         <button onClick={() => setEditingItem(item)} className="p-2 text-slate-500 hover:text-indigo-400 bg-slate-800/50 rounded-lg"><Pencil size={14}/></button>
                         <button onClick={() => onDelete(item.id)} className="p-2 text-slate-500 hover:text-rose-500 bg-slate-800/50 rounded-lg"><Trash2 size={14}/></button>
                       </div>
                    </td>
                 </tr>
               ))}
            </tbody>
            <tfoot className="bg-slate-950 text-slate-300 font-bold border-t border-slate-800 text-xs md:text-sm sticky bottom-0 z-10 shadow-lg">
              <tr className="bg-slate-900 border-t-2 border-slate-800">
                <td colSpan={5} className="px-4 md:px-6 py-3 md:py-4 text-right text-emerald-400 uppercase tracking-widest text-sm">စုစုပေါင်း တောင်းခံငွေ (Total Claims) :</td>
                <td className="px-4 md:px-6 py-3 md:py-4 text-right text-emerald-400 font-black text-base md:text-lg">{filteredClaims.reduce((sum, c) => sum + (Number(c.total_claim_amount) || 0), 0).toLocaleString()}</td>
                <td colSpan={2} className="bg-slate-900"></td>
              </tr>
            </tfoot>
          </table>
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
