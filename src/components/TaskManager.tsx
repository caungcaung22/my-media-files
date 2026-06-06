/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  ClipboardList, Plus, Trash2, Pencil, Search, CheckCircle2, AlertCircle, Clock, Check, X
} from 'lucide-react';
import { Task, Employee } from '../types';

interface TaskManagerProps {
  tasks: Task[];
  employees: Employee[];
  projects: any[];
  currentProjectId: string | null;
  onSave: (data: any) => void;
  onDelete: (id: string) => void;
  editingItem: any;
  setEditingItem: (item: any) => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  db: any;
  appId: string;
}

export const TaskManager: React.FC<TaskManagerProps> = ({
  tasks,
  employees,
  projects,
  currentProjectId,
  onSave,
  onDelete,
  editingItem,
  setEditingItem,
  showToast
}) => {
  const defaultForm = {
    title: '',
    description: '',
    assignedTo: '',
    dueDate: new Date().toISOString().split('T')[0],
    status: 'Pending' as const,
    projectId: currentProjectId || ''
  };

  const [formData, setFormData] = useState(defaultForm);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (editingItem && editingItem.dueDate) {
      setFormData({
        title: editingItem.title || '',
        description: editingItem.description || '',
        assignedTo: editingItem.assignedTo || '',
        dueDate: editingItem.dueDate,
        status: editingItem.status || 'Pending',
        projectId: editingItem.projectId || currentProjectId || ''
      });
    } else {
      setFormData({
        title: '',
        description: '',
        assignedTo: '',
        dueDate: new Date().toISOString().split('T')[0],
        status: 'Pending' as const,
        projectId: currentProjectId || ''
      });
    }
  }, [editingItem, currentProjectId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title) return;
    onSave(formData);
    setFormData({
      title: '',
      description: '',
      assignedTo: '',
      dueDate: new Date().toISOString().split('T')[0],
      status: 'Pending' as const,
      projectId: currentProjectId || ''
    });
  };

  const toggleStatus = (task: Task) => {
    const updatedStatus = task.status === 'Pending' ? 'Completed' : 'Pending';
    onSave({
      ...task,
      status: updatedStatus
    });
    showToast(`Task marked as ${updatedStatus}`, "success");
  };

  const filteredTasks = tasks.filter(t => {
    const projName = projects.find(p => p.id === t.projectId)?.projectName || '';
    const matchesSearch = (t.title || '').toLowerCase().includes(search.toLowerCase()) || 
                          (t.description || '').toLowerCase().includes(search.toLowerCase()) ||
                          (t.assignedTo || '').toLowerCase().includes(search.toLowerCase()) ||
                          projName.toLowerCase().includes(search.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="space-y-6 md:space-y-8">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <h2 className="text-xl font-black text-white uppercase tracking-tight">Employee Tasks (To-Do)</h2>
          <p className="text-xs text-slate-500 mt-1 font-sans">
            Oversee, assign, and track employee responsibilities, checklists, and deadline statuses
          </p>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 p-5 md:p-8 rounded-2xl md:rounded-3xl shadow-xl">
        <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4">
          <h4 className="text-xs md:text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <ClipboardList className="text-indigo-400" size={16}/>
            {editingItem ? 'Edit Employee Task (ပြင်ဆင်ရန်)' : 'New Employee Task (လုပ်ငန်းအသစ် တာဝန်ပေးရန်)'}
          </h4>
          {editingItem && (
            <button 
              type="button" 
              onClick={() => setEditingItem(null)} 
              className="text-[10px] font-black text-rose-500 uppercase hover:underline"
            >
              Cancel Edit
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="flex flex-col gap-1 md:col-span-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Task Title / Subject *</label>
            <input 
              placeholder="တာဝန်လုပ်ငန်းစဉ်ခေါင်းစဉ်..." 
              required 
              value={formData.title} 
              onChange={e => setFormData({...formData, title: e.target.value})} 
              className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-indigo-500" 
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Assign To *</label>
            <select 
              required 
              value={formData.assignedTo} 
              onChange={e => setFormData({...formData, assignedTo: e.target.value})} 
              className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-indigo-500"
            >
              <option value="">တာဝန်ယူမည့်သူ ရွေးပါ *</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.name}>{emp.name} {emp.position ? `(${emp.position})` : ''}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Due Date *</label>
            <input 
              type="date" 
              required 
              value={formData.dueDate} 
              onChange={e => setFormData({...formData, dueDate: e.target.value})} 
              className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-indigo-500" 
            />
          </div>

          <div className="flex flex-col gap-1 md:col-span-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase font-sans">Project (ပရောဂျက်) *</label>
            <select 
              required 
              value={formData.projectId} 
              onChange={e => setFormData({...formData, projectId: e.target.value})} 
              className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="">ပရောဂျက် ရွေးပါ *</option>
              {projects.map(proj => (
                <option key={proj.id} value={proj.id}>{proj.projectName}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1 md:col-span-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Detail Description / Requirements</label>
            <input 
              placeholder="အသေးစိတ် ညွှန်ကြားချက် သို့မဟုတ် မှတ်ချက်..." 
              value={formData.description} 
              onChange={e => setFormData({...formData, description: e.target.value})} 
              className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-indigo-500" 
            />
          </div>

          <div className="flex flex-col gap-1 md:col-span-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Action</label>
            <button 
              type="submit" 
              className={`rounded-xl font-black text-white shadow-lg py-3 text-sm cursor-pointer whitespace-nowrap active:scale-95 transition-all w-full text-center ${editingItem ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}
            >
              {editingItem ? 'UPDATE TASK' : 'ASSIGN TASK'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl shadow-2xl overflow-hidden">
        <div className="p-4 bg-slate-950/50 border-b border-slate-800 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input 
              type="text" 
              placeholder="Search tasks..." 
              value={search} 
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 focus:border-indigo-500 rounded-xl pl-10 pr-4 py-2 text-sm text-white outline-none transition-all"
            />
          </div>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest hidden sm:block">Total: {filteredTasks.length}</span>
        </div>

        <div className="overflow-x-auto overflow-y-auto max-h-[500px]">
          <table className="w-full text-left whitespace-nowrap">
            <thead className="bg-slate-950 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800">
              <tr>
                <th className="sticky top-0 bg-slate-950 z-20 px-4 py-4 w-10 text-center">Done?</th>
                <th className="sticky top-0 bg-slate-950 z-20 px-4 py-4">Task Details</th>
                <th className="sticky top-0 bg-slate-950 z-20 px-4 py-4">Project</th>
                <th className="sticky top-0 bg-slate-950 z-20 px-4 py-4">Assigned To</th>
                <th className="sticky top-0 bg-slate-950 z-20 px-4 py-4">Due Date</th>
                <th className="sticky top-0 bg-slate-950 z-20 px-4 py-4 text-center">Status</th>
                <th className="sticky top-0 bg-slate-950 z-20 px-4 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500 italic text-sm">
                    No task guidelines found.
                  </td>
                </tr>
              ) : (
                filteredTasks.map((t, index) => (
                  <tr 
                    key={t.id || index} 
                    className={`transition-all hover:bg-slate-800/30 ${t.status === 'Completed' ? 'opacity-60 bg-emerald-950/5' : ''}`}
                  >
                    <td className="px-4 py-4 text-center">
                      <button 
                        onClick={() => toggleStatus(t)}
                        className={`p-1.5 rounded-full transition-all border ${t.status === 'Completed' ? 'bg-emerald-500 border-emerald-400 text-slate-950' : 'bg-slate-950 border-slate-700 text-transparent hover:text-slate-500'}`}
                      >
                        <Check size={14} className="stroke-[3]" />
                      </button>
                    </td>
                    <td className="px-4 py-4 max-w-xs md:max-w-md">
                      <p className={`font-bold text-sm ${t.status === 'Completed' ? 'line-through text-slate-400' : 'text-slate-200'}`}>
                        {t.title}
                      </p>
                      {t.description && (
                        <p className="text-xs text-slate-500 mt-1 truncate" title={t.description}>
                          {t.description}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-4 text-indigo-400 text-xs font-semibold font-mono">
                      {projects.find(p => p.id === t.projectId)?.projectName || 'N/A'}
                    </td>
                    <td className="px-4 py-4 text-slate-300 text-sm font-semibold">{t.assignedTo}</td>
                    <td className="px-4 py-4 text-slate-400 font-mono text-xs">{t.dueDate}</td>
                    <td className="px-4 py-4 text-center">
                      <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${t.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse'}`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="flex justify-center gap-1">
                        <button 
                          onClick={() => setEditingItem(t)} 
                          className="p-1.5 text-slate-500 hover:text-indigo-400 bg-slate-800/50 rounded-lg cursor-pointer"
                        >
                          <Pencil size={14}/>
                        </button>
                        <button 
                          onClick={() => onDelete(t.id)} 
                          className="p-1.5 text-slate-500 hover:text-rose-500 bg-slate-800/50 rounded-lg cursor-pointer"
                        >
                          <Trash2 size={14}/>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
