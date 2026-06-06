/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Briefcase, HardHat, Pencil, Trash2 } from 'lucide-react';
import { Employee } from '../types';

interface EmployeeManagerProps {
  siteEngineers: Employee[];
  officeStaff: Employee[];
  onManageEntity: (collectionName: string, id: string | null, data: any) => void;
  onRequestDeleteEntity: (collectionName: string, id: string) => void;
}

export const EmployeeManager: React.FC<EmployeeManagerProps> = ({
  siteEngineers,
  officeStaff,
  onManageEntity,
  onRequestDeleteEntity
}) => {
  const [regName, setRegName] = useState('');
  const [regPosition, setRegPosition] = useState('');
  const [regType, setRegType] = useState('site_engineers'); 
  const [editingEntity, setEditingEntity] = useState<Employee | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName) return;
    const data = { name: regName, position: regPosition };
    onManageEntity(regType, editingEntity?.id || null, data);
    setRegName(''); 
    setRegPosition(''); 
    setEditingEntity(null);
  };

  const startEdit = (entity: Employee, type: string) => {
    setEditingEntity(entity);
    setRegName(entity.name);
    setRegPosition(entity.position || '');
    setRegType(type);
  };

  return (
    <div className="space-y-6 md:space-y-8">
       <div className="bg-slate-900 border border-slate-800 p-5 md:p-8 rounded-2xl md:rounded-3xl shadow-xl">
         <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2"><Briefcase className="text-indigo-400"/> Employee Registration</h3>
         <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-4">
            <select 
              value={regType} 
              onChange={e => setRegType(e.target.value)} 
              disabled={!!editingEntity} 
              className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-indigo-500"
            >
               <option value="site_engineers">Site Engineer</option>
               <option value="office_staff">Office Staff</option>
            </select>
            <input 
              required 
              placeholder="ဝန်ထမ်းအမည်..." 
              value={regName} 
              onChange={e => setRegName(e.target.value)} 
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-indigo-500" 
            />
            <input 
              placeholder="ရာထူး (Position)" 
              value={regPosition} 
              onChange={e => setRegPosition(e.target.value)} 
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-indigo-500" 
            />
            <div className="flex gap-2">
              <button 
                type="submit" 
                className="flex-1 md:flex-none bg-indigo-600 px-8 py-3 rounded-xl font-bold text-white shadow-lg shadow-indigo-500/30 hover:bg-indigo-500 transition-all"
              >
                {editingEntity ? 'Update' : 'Register'}
              </button>
              {editingEntity && (
                <button 
                  type="button" 
                  onClick={() => { setEditingEntity(null); setRegName(''); setRegPosition(''); }} 
                  className="px-6 py-3 rounded-xl bg-slate-800 text-rose-400 font-bold hover:bg-slate-700 transition-all"
                >
                  Cancel
                </button>
              )}
            </div>
         </form>
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl shadow-xl overflow-hidden flex flex-col">
             <div className="p-4 md:p-5 bg-slate-950/50 border-b border-slate-800 flex items-center gap-3">
                <HardHat className="text-amber-500" size={20}/>
                <h4 className="font-bold text-white uppercase tracking-widest text-sm">Site Engineers</h4>
                <span className="ml-auto bg-slate-800 text-slate-300 px-3 py-1 rounded-lg text-xs font-bold">{siteEngineers.length}</span>
             </div>
             <div className="p-4 md:p-5 space-y-3 max-h-[50vh] overflow-y-auto custom-scrollbar">
                {siteEngineers.length === 0 ? <p className="text-center text-slate-600 italic text-sm py-4">No records.</p> : siteEngineers.map(emp => (
                   <div key={emp.id} className="flex items-center justify-between bg-slate-950 border border-slate-800 p-3 md:p-4 rounded-xl hover:border-indigo-500/50 transition-all">
                      <div>
                         <p className="font-bold text-slate-200 text-sm">{emp.name}</p>
                         <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest">{emp.position || 'N/A'}</p>
                      </div>
                      <div className="flex gap-2">
                         <button onClick={() => startEdit(emp, 'site_engineers')} className="p-2 bg-slate-800 hover:bg-indigo-500 hover:text-white text-slate-400 rounded-lg transition-all"><Pencil size={14}/></button>
                         <button onClick={() => onRequestDeleteEntity('site_engineers', emp.id)} className="p-2 bg-slate-800 hover:bg-rose-500 hover:text-white text-slate-400 rounded-lg transition-all"><Trash2 size={14}/></button>
                      </div>
                   </div>
                ))}
             </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl shadow-xl overflow-hidden flex flex-col">
             <div className="p-4 md:p-5 bg-slate-950/50 border-b border-slate-800 flex items-center gap-3">
                <Briefcase className="text-emerald-500" size={20}/>
                <h4 className="font-bold text-white uppercase tracking-widest text-sm">Office Staff</h4>
                <span className="ml-auto bg-slate-800 text-slate-300 px-3 py-1 rounded-lg text-xs font-bold">{officeStaff.length}</span>
             </div>
             <div className="p-4 md:p-5 space-y-3 max-h-[50vh] overflow-y-auto custom-scrollbar">
                {officeStaff.length === 0 ? <p className="text-center text-slate-600 italic text-sm py-4">No records.</p> : officeStaff.map(emp => (
                   <div key={emp.id} className="flex items-center justify-between bg-slate-950 border border-slate-800 p-3 md:p-4 rounded-xl hover:border-emerald-500/50 transition-all">
                      <div>
                         <p className="font-bold text-slate-200 text-sm">{emp.name}</p>
                         <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest">{emp.position || 'N/A'}</p>
                      </div>
                      <div className="flex gap-2">
                         <button onClick={() => startEdit(emp, 'office_staff')} className="p-2 bg-slate-800 hover:bg-emerald-500 hover:text-white text-slate-400 rounded-lg transition-all"><Pencil size={14}/></button>
                         <button onClick={() => onRequestDeleteEntity('office_staff', emp.id)} className="p-2 bg-slate-800 hover:bg-rose-500 hover:text-white text-slate-400 rounded-lg transition-all"><Trash2 size={14}/></button>
                      </div>
                   </div>
                ))}
             </div>
          </div>
       </div>
    </div>
  );
};
