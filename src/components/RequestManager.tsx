/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Download, Trash2, Pencil, AlertCircle, ImageIcon, X, Upload } from 'lucide-react';
import { SourcingRequest, Employee, Project } from '../types';
import { bulkDeleteDocuments, bulkSaveDocuments } from '../lib/db';

interface RequestManagerProps {
  requests: SourcingRequest[];
  entities: Employee[];
  availableProjects: Project[];
  currentProject: string | null;
  onSave: (data: any) => void;
  onDelete: (id: string) => void;
  editingItem: any;
  setEditingItem: (item: any) => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export const RequestManager: React.FC<RequestManagerProps> = ({
  requests,
  entities,
  availableProjects,
  currentProject,
  onSave,
  onDelete,
  editingItem,
  setEditingItem,
  showToast
}) => {
  const defaultForm = {
    item_name: '', qty: '', needed_date: new Date().toISOString().split('T')[0], deadline_date: '', requested_by: '', target_project_id: currentProject || '', status: 'Pending', remark: '', image_url: ''
  };
  const [formData, setFormData] = useState(defaultForm);
  const [search, setSearch] = useState('');
  const [localConfirm, setLocalConfirm] = useState<{
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
  } | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const fileImportRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingItem) {
      setFormData({
        item_name: editingItem.item_name || '',
        qty: editingItem.qty || '',
        needed_date: editingItem.needed_date || new Date().toISOString().split('T')[0],
        deadline_date: editingItem.deadline_date || '',
        requested_by: editingItem.requested_by || '',
        target_project_id: editingItem.projectId || currentProject || '',
        status: editingItem.status || 'Pending',
        remark: editingItem.remark || '',
        image_url: editingItem.image_url || ''
      });
    } else {
      setFormData({ ...defaultForm, target_project_id: currentProject || '' });
    }
  }, [editingItem, currentProject]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        let scaleSize = 1;
        if (img.width > MAX_WIDTH) {
            scaleSize = MAX_WIDTH / img.width;
        }
        canvas.width = img.width * scaleSize;
        canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        const base64Str = canvas.toDataURL('image/jpeg', 0.7);
        setFormData({ ...formData, image_url: base64Str });
      };
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.item_name) return;
    onSave(formData);
    setFormData({ ...defaultForm, target_project_id: currentProject || '' });
  };

  const filteredRequests = useMemo(() => {
    let sorted = [...requests].sort((a, b) => {
       if (a.status === 'Pending' && b.status !== 'Pending') return -1;
       if (a.status !== 'Pending' && b.status === 'Pending') return 1;
       const dateA = a.deadline_date || a.needed_date;
       const dateB = b.deadline_date || b.needed_date;
       return new Date(dateA).getTime() - new Date(dateB).getTime();
    });

    if (search) {
       const lower = search.toLowerCase();
       sorted = sorted.filter(r => 
          (r.item_name || '').toLowerCase().includes(lower) || 
          (r.requested_by || '').toLowerCase().includes(lower) || 
          (r.remark || '').toLowerCase().includes(lower)
       );
    }
    return sorted;
  }, [requests, search]);

  const exportData = async () => {
    if (filteredRequests.length === 0) return showToast("Export လုပ်ရန် Data မရှိပါ", "error");
    const XLSX = (window as any).XLSX;
    const wb = XLSX.utils.book_new();
    const data = filteredRequests.map(r => ({
        "Requested Date": r.needed_date || '-',
        "Deadline Date": r.deadline_date || '-',
        "Item Name / Request": r.item_name || '-',
        "Qty": r.qty || '-',
        "Project": availableProjects.find(p => p.id === r.projectId)?.projectName || r.projectId || 'Global',
        "Requested By": r.requested_by || '-',
        "Status": r.status || 'Pending',
        "Remark": r.remark || '',
        "Image Attached": r.image_url ? 'Yes' : 'No'
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Sourcing Requests");
    XLSX.writeFile(wb, `Requests_${currentProject || 'Global'}.xlsx`);
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

        const requestsToSave: any[] = [];
        for (let i = 1; i < rows.length; i++) {
          const cols = rows[i];
          if (!cols || cols.length < 1) continue;

          // Expected Order: "No.", "Date", "Deadline", "Item/Request", "Qty", "Requested By", "Status", "Remark"
          const dateVal = cols[1] ? String(cols[1]).trim() : new Date().toISOString().split('T')[0];
          const deadlineVal = cols[2] ? String(cols[2]).trim() : '';
          const itemNameVal = cols[3] ? String(cols[3]).trim() : '';
          if (!itemNameVal) continue;

          const qtyVal = cols[4] !== undefined ? String(cols[4]).trim() : '';
          const requestedByVal = cols[5] ? String(cols[5]).trim() : 'Sourcing';
          const statusVal = cols[6] ? String(cols[6]).trim() : 'Pending';
          const remarkVal = cols[7] ? String(cols[7]).trim() : '';

          requestsToSave.push({
            needed_date: dateVal,
            deadline_date: deadlineVal,
            item_name: itemNameVal,
            qty: qtyVal,
            requested_by: requestedByVal,
            status: statusVal,
            remark: remarkVal,
            projectId: currentProject || 'global',
            timestamp: new Date().toISOString()
          });
        }

        if (requestsToSave.length > 0) {
          await bulkSaveDocuments('requests', requestsToSave);
          showToast(`တောင်းဆိုမှု စာရင်း ${requestsToSave.length} ခုကို အောင်မြင်စွာ ဖိုင်သွင်းပြီးပါပြီ။`, "success");
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
    const list = filteredRequests;
    if (list.length === 0) return;

    setLocalConfirm({
      title: "စာရင်းအားလုံးဖျက်ရန် သေချာပါသလား?",
      message: `လက်ရှိ Requests စာရင်းအားလုံး (${list.length} ခု) ကို ဖျက်ရန် သေချာပါသလား?\n\nဤလုပ်ဆောင်ချက်သည် ပြန်ပြင်၍မရနိုင်ပါ။`,
      onConfirm: async () => {
        showToast("စာရင်းအားလုံးကို ဖျက်ဆီးနေပါသည်...", "success");
        try {
          await bulkDeleteDocuments('requests', list.map(r => r.id));
          showToast("စာရင်းအားလုံး ဖျက်ဆီးပြီးပါပြီ။", "success");
        } catch (err) {
          console.error("Bulk delete requests failure", err);
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
          <h2 className="text-xl font-black text-white uppercase tracking-tight">Requests &amp; Sourcing</h2>
          <p className="text-xs text-slate-500 mt-1 font-sans">
            File procurement demands, track delivery status of materials on site, and organize sourcing workflows
          </p>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 p-5 md:p-8 rounded-2xl md:rounded-3xl shadow-xl relative overflow-hidden">
        <div className="flex justify-between items-center mb-4 md:mb-6 border-b border-slate-800 pb-3 md:pb-4">
           <h4 className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-widest">{editingItem ? 'Edit Request (ပြင်ဆင်ရန်)' : 'New Sourcing Request (အသစ်တောင်းဆိုရန်)'}</h4>
           {editingItem && <button type="button" onClick={() => setEditingItem(null)} className="text-[10px] font-black text-rose-500 uppercase hover:underline">Cancel Edit</button>}
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 relative z-0">
           <div className="flex flex-col gap-1">
             <label className="text-[10px] font-bold text-slate-500 uppercase">Requested Date</label>
             <input type="date" required value={formData.needed_date} onChange={e => setFormData({...formData, needed_date: e.target.value})} className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm outline-none" title="Requested Date" />
           </div>

           <div className="flex flex-col gap-1">
             <label className="text-[10px] font-bold text-rose-400 uppercase">Deadline Date</label>
             <input type="date" value={formData.deadline_date} onChange={e => setFormData({...formData, deadline_date: e.target.value})} className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-rose-300 font-bold text-sm outline-none focus:border-rose-500" title="Deadline Date" />
           </div>
           
           <div className="flex flex-col gap-1 sm:col-span-2">
             <label className="text-[10px] font-bold text-slate-500 uppercase">Item / Shop Name *</label>
             <input placeholder="လိုအပ်သောပစ္စည်း/ဆိုင် (Item/Shop)*" required value={formData.item_name} onChange={e => setFormData({...formData, item_name: e.target.value})} className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm outline-none" />
           </div>

           <div className="flex flex-col gap-1">
             <label className="text-[10px] font-bold text-slate-500 uppercase">Quantity</label>
             <input placeholder="အရေအတွက် (Qty)" value={formData.qty} onChange={e => setFormData({...formData, qty: e.target.value})} className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm outline-none" />
           </div>
           
           <div className="flex flex-col gap-1">
             <label className="text-[10px] font-bold text-slate-500 uppercase">Project *</label>
             <select required value={formData.target_project_id} onChange={e => setFormData({...formData, target_project_id: e.target.value})} className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm outline-none">
                <option value="">Project ရွေးပါ *</option>
                <option value="global">Global (ရုံးသုံး/အထွေထွေ)</option>
                {availableProjects.map(p => <option key={p.id} value={p.id}>{p.projectName}</option>)}
             </select>
           </div>

           <div className="flex flex-col gap-1">
             <label className="text-[10px] font-bold text-slate-500 uppercase">Requested By *</label>
             <datalist id="request-entities">
                {entities.map(en => <option key={`req-ent-${en.id}`} value={en.name} />)}
             </datalist>
             <input list="request-entities" placeholder="တောင်းဆိုသူ (Requested By)*" required value={formData.requested_by} onChange={e => setFormData({...formData, requested_by: e.target.value})} className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm outline-none" />
           </div>

           <div className="flex flex-col gap-1">
             <label className="text-[10px] font-bold text-slate-500 uppercase">Status *</label>
             <select required value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className={`bg-slate-950 border rounded-xl px-4 py-3 text-sm outline-none font-bold ${formData.status === 'Pending' ? 'text-amber-400 border-amber-500/30' : 'text-emerald-400 border-emerald-500/30'}`}>
                <option value="Pending">Pending (ရှာဖွေဆဲ)</option>
                <option value="Completed">Completed (ရရှိပြီး)</option>
             </select>
           </div>

           <div className="flex flex-col gap-1 sm:col-span-2">
             <label className="text-[10px] font-bold text-slate-500 uppercase">Image Attachment</label>
             <div className="flex items-center gap-2">
               <input type="file" id="req-image" accept="image/*" onChange={handleImageUpload} className="hidden" />
               <button type="button" onClick={() => document.getElementById('req-image')?.click()} className="flex-1 bg-slate-800 border border-slate-700 hover:border-indigo-500 text-slate-300 px-4 py-3 rounded-xl text-sm transition-all flex items-center justify-center gap-2">
                  <ImageIcon size={16}/> {formData.image_url ? 'Change Image' : 'Attach Image (ပုံထည့်ရန်)'}
               </button>
               {formData.image_url && (
                  <div className="relative w-12 h-11 rounded-lg overflow-hidden border border-slate-700 shrink-0 cursor-pointer group" onClick={() => setPreviewImage(formData.image_url || null)}>
                     <img src={formData.image_url} alt="Preview" className="w-full h-full object-cover group-hover:opacity-60 transition-opacity" />
                     <button type="button" onClick={(e) => { e.stopPropagation(); setFormData({...formData, image_url: ''}); }} className="absolute top-0 right-0 bg-rose-500 text-white rounded-bl-lg p-0.5 z-10"><X size={12}/></button>
                  </div>
               )}
             </div>
           </div>

           <div className="flex flex-col gap-1 sm:col-span-2">
             <label className="text-[10px] font-bold text-slate-500 uppercase">Remark (Optional)</label>
             <input placeholder="Remark (မှတ်ချက်)" value={formData.remark} onChange={e => setFormData({...formData, remark: e.target.value})} className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm outline-none" />
           </div>
           
           <button type="submit" className={`sm:col-span-2 md:col-span-4 rounded-xl font-black text-white shadow-lg py-3 mt-2 text-sm ${editingItem ? 'bg-indigo-600' : 'bg-emerald-600'}`}>
              {editingItem ? 'UPDATE REQUEST' : 'SUBMIT REQUEST'}
           </button>
        </form>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl shadow-2xl overflow-hidden w-full flex flex-col">
        <div className="p-4 bg-slate-950/50 border-b border-slate-800 flex items-center justify-between gap-4 flex-wrap">
           <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
              <input 
                type="text" placeholder="Search requests..." value={search} onChange={e => setSearch(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 focus:border-indigo-500 rounded-xl pl-10 pr-4 py-2 text-sm text-white outline-none transition-all"
              />
           </div>
           <div className="flex items-center gap-2 flex-wrap">
               <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest hidden sm:block mr-2">Total: {filteredRequests.length}</span>
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
               <button onClick={exportData} className="bg-slate-800 hover:bg-slate-700 text-emerald-400 hover:text-white border border-slate-700 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 select-none cursor-pointer">
                 <Download size={13}/> Export
               </button>
               {filteredRequests.length > 0 && (
                 <button 
                   onClick={handleDeleteAll}
                   className="bg-rose-950/40 hover:bg-rose-900 border border-rose-800/80 text-rose-400 hover:text-rose-200 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 select-none cursor-pointer"
                   title="စာရင်းအားလုံးဖျက်မည်"
                 >
                   <Trash2 size={13} /> Delete All ({filteredRequests.length})
                 </button>
               )}
           </div>
        </div>

        <div className="overflow-x-auto overflow-y-auto w-full custom-scrollbar max-h-[60vh] relative">
          <table className="w-full text-left whitespace-nowrap min-w-[900px]">
            <thead className="bg-slate-950/90 backdrop-blur-md text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800 sticky top-0 z-10">
               <tr>
                  <th className="px-4 md:px-6 py-4 w-10 text-center">No.</th>
                  <th className="px-4 md:px-6 py-4">Req Date</th>
                  <th className="px-4 md:px-6 py-4">Deadline</th>
                  <th className="px-4 md:px-6 py-4 text-center">Image</th>
                  <th className="px-4 md:px-6 py-4">Item/Request</th>
                  <th className="px-4 md:px-6 py-4">Project</th>
                  <th className="px-4 md:px-6 py-4">Requested By</th>
                  <th className="px-4 md:px-6 py-4 text-center">Status</th>
                  <th className="px-4 md:px-6 py-4 text-center">Action</th>
               </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
               {filteredRequests.length === 0 ? (
                 <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-600 italic text-sm">No requests found.</td></tr>
               ) : filteredRequests.map((item, index) => (
                 <tr key={item.id} className={`transition-all ${item.status === 'Pending' ? 'bg-amber-900/10 border-l-4 border-amber-500 hover:bg-amber-900/20' : 'hover:bg-slate-800/30 border-l-4 border-transparent'}`}>
                    <td className="px-4 md:px-6 py-3 md:py-4 text-center text-slate-500 font-mono text-[11px]">{index + 1}</td>
                    <td className="px-4 md:px-6 py-3 md:py-4 text-slate-400 font-mono text-[11px]">{item.needed_date}</td>
                    
                    <td className={`px-4 md:px-6 py-3 md:py-4 font-mono text-[11px] ${item.status === 'Pending' ? 'text-rose-400 font-black' : 'text-slate-500'}`}>
                       {item.deadline_date || '-'}
                       {item.status === 'Pending' && item.deadline_date && <AlertCircle size={12} className="inline ml-1.5 mb-0.5 animate-pulse"/>}
                    </td>

                    <td className="px-4 md:px-6 py-3 md:py-4 text-center">
                       {item.image_url ? (
                          <div className="inline-block w-10 h-10 rounded border border-slate-700 overflow-hidden cursor-pointer hover:opacity-80 transition-opacity relative group" onClick={() => setPreviewImage(item.image_url || null)}>
                             <img src={item.image_url} alt="Item" className="w-full h-full object-cover" />
                             <div className="absolute inset-0 bg-black/40 hidden group-hover:flex items-center justify-center"><Search size={14} className="text-white"/></div>
                          </div>
                       ) : <span className="text-slate-600">-</span>}
                    </td>

                    <td className="px-4 md:px-6 py-3 md:py-4">
                       <p className="font-bold text-slate-200 text-sm">{item.item_name}</p>
                       <div className="flex gap-2 items-center mt-1">
                          {item.qty && <span className="text-[10px] text-slate-400">Qty: <span className="text-indigo-300 font-bold">{item.qty}</span></span>}
                          {item.remark && <span className="text-[10px] text-slate-500 bg-slate-950 px-2 py-0.5 rounded truncate max-w-[120px]">{item.remark}</span>}
                       </div>
                    </td>
                    
                    <td className="px-4 md:px-6 py-3 md:py-4">
                       <span className="bg-slate-800 px-2 py-1 rounded text-[10px] text-slate-300">
                          {availableProjects.find(p => p.id === item.projectId)?.projectName || item.projectId || 'Global'}
                       </span>
                    </td>
                    
                    <td className="px-4 md:px-6 py-3 md:py-4 text-slate-300 text-sm font-medium">{item.requested_by}</td>
                    
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
          </table>
        </div>
      </div>

      {previewImage && (
         <div className="fixed inset-0 z-[500] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in" onClick={() => setPreviewImage(null)}>
            <div className="relative max-w-3xl max-h-[85vh] overflow-hidden rounded-2xl border border-slate-800">
               <button onClick={() => setPreviewImage(null)} className="absolute top-4 right-4 p-2 bg-slate-900/80 text-white rounded-full hover:bg-slate-800 transition-all shadow"><X size={20}/></button>
               <img src={previewImage} alt="Large Sourcing" className="max-w-full max-h-[80vh] object-contain" />
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
