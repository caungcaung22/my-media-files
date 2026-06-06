/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Pencil, Trash2, Users, Briefcase, Plus } from 'lucide-react';
import { Employee } from '../types';

interface DirectoryProps {
  siteEngineers: Employee[];
  officeStaff: Employee[];
  subconNames: Employee[];
  currentProjectId: string | null;
  onSave: (collection: string, id: string | null, data: any) => Promise<string>;
  onDelete: (collection: string, id: string) => Promise<void>;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export const EmployeeDirectoryView: React.FC<DirectoryProps> = ({
  siteEngineers,
  officeStaff,
  subconNames,
  currentProjectId,
  onSave,
  onDelete,
  showToast
}) => {
  // Registration and edit state
  const [category, setCategory] = useState<'site_engineers' | 'office_staff' | 'custom'>('site_engineers');
  const [customCategoryNameInput, setCustomCategoryNameInput] = useState('');
  const [name, setName] = useState('');
  const [position, setPosition] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [originalCollection, setOriginalCollection] = useState<'site_engineers' | 'office_staff' | null>(null);
  const [localConfirm, setLocalConfirm] = useState<{
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
  } | null>(null);

  // Merge and attach originalCollection helper
  const allEmployees = useMemo(() => {
    const siteEngList = siteEngineers.map(e => ({ ...e, originalCollection: 'site_engineers' as const }));
    const officeStaffList = officeStaff.map(e => ({ ...e, originalCollection: 'office_staff' as const }));
    return [...siteEngList, ...officeStaffList];
  }, [siteEngineers, officeStaff]);

  // Group employees dynamically
  const groupedEmployees = useMemo(() => {
    const groups: { [key: string]: typeof allEmployees } = {
      'SITE ENGINEERS': [],
      'OFFICE STAFF': []
    };

    allEmployees.forEach(e => {
      const isCustom = (e as any).isCustomCategory;
      const customName = (e as any).customCategoryName;

      if (isCustom && customName) {
        const groupKey = String(customName).trim();
        const groupKeyUpper = groupKey.toUpperCase();
        
        const matchingKey = Object.keys(groups).find(k => k.toUpperCase() === groupKeyUpper);
        if (matchingKey) {
          groups[matchingKey].push(e);
        } else {
          groups[groupKey] = [e];
        }
      } else if (e.originalCollection === 'site_engineers') {
        groups['SITE ENGINEERS'].push(e);
      } else {
        groups['OFFICE STAFF'].push(e);
      }
    });

    return groups;
  }, [allEmployees]);

  const sortedGroupKeys = useMemo(() => {
    const keys = Object.keys(groupedEmployees);
    // Move main categories to the front helper
    const mainKeys = ['SITE ENGINEERS', 'OFFICE STAFF'];
    const customKeys = keys.filter(k => k !== 'SITE ENGINEERS' && k !== 'OFFICE STAFF');
    return [...mainKeys, ...customKeys];
  }, [groupedEmployees]);

  // Handle register / update submit
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast("ကျေးဇူးပြု၍ ဝန်ထမ်းအမည် ဖြည့်သွင်းပါ", "error");
      return;
    }

    if (category === 'custom' && !customCategoryNameInput.trim()) {
      showToast("ကျေးဇူးပြု၍ Default Group / Custom Category အမည် ဖြည့်သွင်းပါ", "error");
      return;
    }

    const payload: any = {
      name: name.trim(),
      position: position.trim() || 'N/A',
      projectId: currentProjectId || 'global',
      isCustomCategory: category === 'custom',
      customCategoryName: category === 'custom' ? customCategoryNameInput.trim() : ''
    };

    // Determine target collection (custom goes to office_staff under the hood)
    const saveCollection: 'site_engineers' | 'office_staff' = category === 'custom' ? 'office_staff' : category;

    try {
      if (editingId && originalCollection && originalCollection !== saveCollection) {
        // Category collection type changed, delete old and create new to avoid duplication
        await onDelete(originalCollection, editingId);
        await onSave(saveCollection, null, payload);
      } else {
        await onSave(saveCollection, editingId, payload);
      }

      setName('');
      setPosition('');
      setCategory('site_engineers');
      setCustomCategoryNameInput('');
      setEditingId(null);
      setOriginalCollection(null);
      showToast(editingId ? "ဝန်ထမ်းအချက်အလက်ကို ပြင်ဆင်ပြီးပါပြီ" : "ဝန်ထမ်းအသစ် မှတ်ပုံတင်ခြင်း အောင်မြင်ပါသည်", "success");
    } catch (err) {
      showToast("လုပ်ဆောင်ချက် မအောင်မြင်ပါ။", "error");
    }
  };

  const handleEdit = (emp: any, cat: 'site_engineers' | 'office_staff') => {
    setEditingId(emp.id);
    setOriginalCollection(cat);
    setName(emp.name);
    setPosition(emp.position || '');
    if (emp.isCustomCategory) {
      setCategory('custom');
      setCustomCategoryNameInput(emp.customCategoryName || '');
    } else {
      setCategory(cat);
      setCustomCategoryNameInput('');
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setOriginalCollection(null);
    setCategory('site_engineers');
    setCustomCategoryNameInput('');
    setName('');
    setPosition('');
  };

  const handleDelete = async (empId: string, cat: 'site_engineers' | 'office_staff') => {
    setLocalConfirm({
      title: "ဝန်ထမ်းဖျက်သိမ်းရန် အတည်ပြုခြင်း",
      message: "ဤဝန်ထမ်းကို ဖျက်ရန် သေချာပါသလား?",
      onConfirm: async () => {
        try {
          await onDelete(cat, empId);
          showToast("ဝန်ထမ်းကို စာရင်းမှ ဖျက်သိမ်းပြီးပါပြီ", "success");
        } catch (err) {
          showToast("ဖျက်သိမ်းရန် အဆင်မပြေဖြစ်သွားပါသည်", "error");
        }
      }
    });
  };

  return (
    <div className="space-y-6">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <h2 className="text-xl font-black text-white uppercase tracking-tight">Employee Directory</h2>
          <p className="text-xs text-slate-500 mt-1 font-sans">
            Global View • Staff Directory
          </p>
        </div>
      </div>

      {/* Employee Registration Form Container Card */}
      <div className="bg-[#111c2a]/40 border border-slate-800/80 p-5 rounded-2xl shadow-xl">
        <h4 className="text-xs font-black text-slate-450 uppercase tracking-widest flex items-center gap-2 mb-4">
          <Briefcase size={14} className="text-indigo-400" />
          Employee Registration
        </h4>

        <form onSubmit={handleRegister} className="flex flex-col md:flex-row gap-4 items-center">
          {/* Dropdown Choice */}
          <div className="w-full md:w-48 flex gap-2">
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value as any);
                if (e.target.value !== 'custom') {
                  setCustomCategoryNameInput('');
                }
              }}
              className="bg-slate-950 border border-slate-800/80 rounded-xl px-4 py-2 text-white text-xs outline-none focus:border-indigo-500 w-full font-sans cursor-pointer h-10 select-none"
            >
              <option value="site_engineers">Site Engineer</option>
              <option value="office_staff">Office Staff</option>
              <option value="custom">Custom (ရေးသားမည်)</option>
            </select>
          </div>

          {/* Custom Category Input (shown ONLY when category is 'custom') */}
          {category === 'custom' && (
            <div className="w-full md:w-52">
              <input
                type="text"
                placeholder="Custom Category (Ex. Guard)..."
                required
                value={customCategoryNameInput}
                onChange={(e) => setCustomCategoryNameInput(e.target.value)}
                className="bg-slate-950 border border-indigo-500/50 rounded-xl px-4 py-2 text-white text-xs outline-none focus:border-indigo-500 w-full font-sans h-10 placeholder-slate-500"
              />
            </div>
          )}

          {/* Name input */}
          <div className="w-full md:flex-1">
            <input
              type="text"
              placeholder="ဝန်ထမ်းအမည်..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-slate-950 border border-slate-800/80 rounded-xl px-4 py-2 text-white text-xs outline-none focus:border-indigo-500 w-full font-sans h-10 placeholder-slate-500"
            />
          </div>

          {/* Position input */}
          <div className="w-full md:flex-1">
            <input
              type="text"
              placeholder="ရာထူး (Position)"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              className="bg-slate-950 border border-slate-800/80 rounded-xl px-4 py-2 text-white text-xs outline-none focus:border-indigo-500 w-full font-sans h-10 placeholder-slate-500"
            />
          </div>

          <div className="flex gap-2 w-full md:w-auto self-end md:self-auto justify-end">
            {editingId && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs h-10 px-5 rounded-xl transition-all font-sans whitespace-nowrap cursor-pointer active:scale-95"
              >
                Cancel
              </button>
            )}

            <button
              type="submit"
              className="bg-gradient-to-r from-blue-700 to-indigo-600 hover:from-blue-600 hover:to-indigo-500 text-white font-bold text-xs font-sans h-10 px-8 rounded-xl transition-all shadow-lg shadow-indigo-500/10 active:scale-95 whitespace-nowrap cursor-pointer min-w-[100px]"
            >
              {editingId ? "Update" : "Register"}
            </button>
          </div>
        </form>
      </div>

      {/* Grid of All categories dynamically grouped */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {sortedGroupKeys.map((groupKey) => {
          const list = groupedEmployees[groupKey] || [];
          
          // Only show custom grouping columns if they actually contain elements to maintain visual structure
          const isMainCategory = groupKey === 'SITE ENGINEERS' || groupKey === 'OFFICE STAFF';
          if (!isMainCategory && list.length === 0) return null;

          return (
            <div 
              key={groupKey} 
              className="bg-[#111c2a]/40 border border-slate-800/80 p-5 rounded-2xl shadow-lg flex flex-col space-y-4"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-slate-200 uppercase tracking-widest flex items-center gap-2">
                  <Briefcase size={14} className={
                    groupKey === 'SITE ENGINEERS' ? 'text-amber-500' :
                    groupKey === 'OFFICE STAFF' ? 'text-emerald-500' :
                    'text-indigo-400'
                  } />
                  {groupKey}
                </h4>
                <span className="bg-slate-950 border border-slate-800/85 px-3 py-1 rounded-full text-[10px] font-bold text-slate-400 font-mono tracking-tight shadow-inner">
                  {list.length}
                </span>
              </div>

              <div className="flex flex-col gap-3 max-h-[500px] overflow-y-auto pr-1">
                {list.length === 0 ? (
                  <div className="bg-slate-950/20 border border-slate-800/40 p-5 rounded-xl text-center text-slate-500 text-xs italic">
                    Registered {groupKey.toLowerCase()} directory is empty.
                  </div>
                ) : (
                  list.map((emp) => (
                    <div 
                      key={emp.id} 
                      className="bg-slate-955/65 border border-slate-800/80 hover:border-slate-700/80 px-5 py-4 rounded-xl flex items-center justify-between transition-all shadow-sm"
                    >
                      <div className="flex flex-col min-w-0 pr-4">
                        <span className="font-bold text-slate-200 text-sm truncate font-sans tracking-wide">
                          {emp.name}
                        </span>
                        <span className="text-[10px] text-slate-500 font-bold mt-0.5 uppercase font-mono tracking-wider">
                          {emp.position || 'N/A'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => handleEdit(emp, emp.originalCollection)}
                          className="p-1.5 bg-slate-950 border border-slate-800 rounded-lg hover:border-indigo-500/50 text-slate-400 hover:text-indigo-400 transition-all cursor-pointer shadow-sm active:scale-90"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={() => handleDelete(emp.id, emp.originalCollection)}
                          className="p-1.5 bg-slate-950 border border-slate-800 rounded-lg hover:border-rose-500/50 text-slate-400 hover:text-rose-500 transition-all cursor-pointer shadow-sm active:scale-90"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
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
  );
};
