/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { Trash2, Pencil, Briefcase, Download, Upload } from 'lucide-react';
import { Employee } from '../types';
import { bulkDeleteDocuments, bulkSaveDocuments } from '../lib/db';

interface OfficeStaffProps {
  officeStaff: Employee[];
  onSave: (collection: string, id: string | null, data: any) => Promise<string>;
  onDelete: (collection: string, id: string) => Promise<void>;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export const OfficeStaffManagerView: React.FC<OfficeStaffProps> = ({
  officeStaff,
  onSave,
  onDelete,
  showToast
}) => {
  const [name, setName] = useState('');
  const [position, setPosition] = useState('');
  const [phone, setPhone] = useState('');
  const [salary, setSalary] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [localConfirm, setLocalConfirm] = useState<{
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
  } | null>(null);

  const fileImportRef = useRef<HTMLInputElement>(null);

  const exportToExcel = () => {
    if (officeStaff.length === 0) return showToast("ထုတ်ယူရန် Staff Data မရှိသဖြင့် Excel ထုတ်၍မရပါ", "error");
    const XLSX = (window as any).XLSX;
    if (!XLSX) {
      return showToast("Excel parser is currently offline.", "error");
    }
    const wb = XLSX.utils.book_new();
    const headers = [
       "No.", "Name", "Position", "Contact Phone No.", "Salary (Ks)"
    ];
    const rows = officeStaff.map((staff, idx) => [
      idx + 1,
      staff.name,
      staff.position || 'Office Staff',
      staff.phone || '',
      staff.salary || 0
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    XLSX.utils.book_append_sheet(wb, ws, "Office Staff & Payroll");
    XLSX.writeFile(wb, `OfficeStaff_Payroll.xlsx`);
    showToast("Office staff records ကို Excel ထုတ်ယူပြီးပါပြီ။", "success");
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

        const staffToSave: any[] = [];
        for (let i = 1; i < rows.length; i++) {
          const cols = rows[i];
          if (!cols || cols.length < 1) continue;

          const staffNameVal = cols[1] ? String(cols[1]).trim() : '';
          if (!staffNameVal) continue;

          const positionVal = cols[2] ? String(cols[2]).trim() : 'Office Staff';
          const phoneVal = cols[3] !== undefined ? String(cols[3]).trim() : '';
          const salaryVal = cols[4] !== undefined ? (Number(String(cols[4]).replace(/,/g, '')) || 0) : 0;

          staffToSave.push({
            name: staffNameVal,
            position: positionVal,
            phone: phoneVal,
            salary: salaryVal,
            projectId: 'global'
          });
        }

        if (staffToSave.length > 0) {
          await bulkSaveDocuments('office_staff', staffToSave);
          showToast(`ဝန်ထမ်းသစ် ${staffToSave.length} ဦးအား အောင်မြင်စွာ ဖိုင်သွင်းပြီးပါပြီ။`, "success");
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
    if (officeStaff.length === 0) return;

    setLocalConfirm({
      title: "စာရင်းအားလုံးဖျက်ရန် သေချာပါသလား?",
      message: `လက်ရှိ ဝန်ထမ်းစာရင်းအားလုံး (${officeStaff.length} ဦး) ကို ဖျက်ရန် သေချာပါသလား?\n\nဤလုပ်ဆောင်ချက်သည် ပြန်ပြင်၍မရနိုင်ပါ။`,
      onConfirm: async () => {
        showToast("စာရင်းအားလုံးကို ဖျက်ဆီးနေပါသည်...", "success");
        try {
          await bulkDeleteDocuments('office_staff', officeStaff.map(o => o.id));
          showToast("စာရင်းအားလုံး ဖျက်ဆီးပြီးပါပြီ။", "success");
        } catch (err) {
          console.error("Bulk delete staff failure", err);
          showToast("ဖျက်သိမ်းခြင်း မအောင်မြင်ပါ။", "error");
        }
      }
    });
  };

  const formatMoney = (val: any) => {
    if (!val) return '';
    return String(val).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  const parseMoney = (val: any) => {
    return String(val).replace(/,/g, '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    const payload = {
      name,
      position: position || 'Office Staff',
      phone,
      salary: Number(parseMoney(salary)) || 0,
      projectId: 'global'
    };

    await onSave('office_staff', editingId, payload);
    setName('');
    setPosition('');
    setPhone('');
    setSalary('');
    setEditingId(null);
    showToast(editingId ? "Office Staff updated!" : "Office Staff registered!", "success");
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
        <h4 className="text-sm font-bold text-white mb-4 uppercase tracking-wider border-b border-slate-800 pb-2 flex items-center gap-2">
          <Briefcase size={16} className="text-indigo-400" />
          {editingId ? 'Edit Staff Profile' : 'Register Office Staff & Payroll'}
        </h4>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="flex flex-col gap-1 md:col-span-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Staff Name *</label>
            <input placeholder="Ex. Daw Phyu Phyu..." required value={name} onChange={e => setName(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 w-full font-sans" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Position / Role</label>
            <input placeholder="Ex. Finance Officer, HR Manager..." value={position} onChange={e => setPosition(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 w-full font-sans" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Monthly Salary (Ks)</label>
            <input placeholder="Ex. 600,000" value={formatMoney(salary)} onChange={e => {
              const raw = parseMoney(e.target.value);
              if (/^\d*$/.test(raw)) setSalary(raw);
            }} className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 text-right font-mono w-full" />
          </div>
          <div className="flex flex-col gap-1 md:col-span-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase font-sans">Contact Phone No.</label>
            <input placeholder="Ex. 09-xxxxxxx" value={phone} onChange={e => setPhone(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 w-full font-sans" />
          </div>
          <div className="md:col-span-2 flex justify-end gap-2 items-end">
            {editingId && (
              <button 
                type="button" 
                onClick={() => { setEditingId(null); setName(''); setPosition(''); setPhone(''); setSalary(''); }} 
                className="bg-slate-800 text-slate-400 hover:text-white px-5 py-2.5 rounded-xl font-bold text-xs uppercase"
              >
                Cancel
              </button>
            )}
            <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-8 py-3.5 rounded-xl uppercase tracking-wider text-xs shadow-lg transition-all w-full md:w-auto font-sans">
              {editingId ? 'Update Staff Profile' : 'Save Staff Profile'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-4 bg-slate-950/50 border-b border-slate-800 flex justify-between items-center gap-4 flex-wrap">
          <div>
            <h4 className="font-bold text-white text-xs uppercase tracking-widest leading-none mb-1">Office Admin Team & Payroll</h4>
            <span className="text-[10px] text-slate-500 font-bold uppercase">Staff count: {officeStaff.length}</span>
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
             {officeStaff.length > 0 && (
               <button 
                 onClick={handleDeleteAll}
                 className="bg-rose-950/40 hover:bg-rose-900 border border-rose-800/80 text-rose-400 hover:text-rose-200 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 select-none cursor-pointer"
                 title="ဝန်ထမ်းစာရင်းအားလုံးဖျက်မည်"
               >
                 <Trash2 size={13} /> Delete All ({officeStaff.length})
               </button>
             )}
          </div>
        </div>
        <div className="overflow-x-auto overflow-y-auto max-h-[500px]">
          <table className="w-full text-left font-sans">
            <thead className="bg-slate-950 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800">
              <tr>
                <th className="sticky top-0 bg-slate-950 z-20 px-5 py-3.5 w-16">No.</th>
                <th className="sticky top-0 bg-slate-950 z-20 px-5 py-3.5">Name</th>
                <th className="sticky top-0 bg-slate-950 z-20 px-5 py-3.5">Position</th>
                <th className="sticky top-0 bg-slate-950 z-20 px-5 py-3.5 text-right">Office Salary</th>
                <th className="sticky top-0 bg-slate-950 z-20 px-5 py-3.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {officeStaff.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-500 italic text-sm">No registered office staff profiles found.</td></tr>
              ) : officeStaff.map((staff, idx) => (
                <tr key={staff.id} className="hover:bg-slate-800/20 text-xs">
                  <td className="px-5 py-3.5 text-slate-500 font-mono">{idx + 1}</td>
                  <td className="px-5 py-3.5 font-bold text-white text-sm">{staff.name}</td>
                  <td className="px-5 py-3.5 text-emerald-400 font-bold uppercase">{staff.position || 'Staff'}</td>
                  <td className="px-5 py-3.5 text-right text-slate-300 font-mono font-bold text-sm">{staff.salary ? `${Number(staff.salary).toLocaleString()} Ks` : '-'}</td>
                  <td className="px-5 py-3.5 text-center w-36">
                    <div className="flex justify-center gap-2 items-center">
                      <button 
                        onClick={() => { setEditingId(staff.id); setName(staff.name); setPosition(staff.position || ''); setPhone(staff.phone || ''); setSalary(staff.salary ? String(staff.salary) : ''); }} 
                        className="p-1.5 text-slate-400 hover:text-indigo-400 bg-slate-800 rounded-lg transition-all"
                      >
                        <Pencil size={12}/>
                      </button>
                      <button 
                        onClick={() => onDelete('office_staff', staff.id)} 
                        className="p-1.5 text-slate-400 hover:text-rose-500 bg-slate-800 rounded-lg transition-all"
                      >
                        <Trash2 size={12}/>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
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
