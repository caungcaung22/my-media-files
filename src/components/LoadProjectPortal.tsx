/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React, { useState, useRef } from 'react';
import { 
  Folder, FolderOpen, Trash2, X, RotateCw, Plus, CloudUpload, 
  ChevronRight, Sparkles, Building, Briefcase, FileJson, Check 
} from 'lucide-react';
import { Project } from '../types';

interface LoadProjectPortalProps {
  projects: Project[];
  currentProjectId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNewProject: () => void;
  onImportBackup: (data: any) => Promise<void>;
  onClose: () => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export const LoadProjectPortal: React.FC<LoadProjectPortalProps> = ({
  projects,
  currentProjectId,
  onSelect,
  onDelete,
  onNewProject,
  onImportBackup,
  onClose,
  showToast
}) => {
  const [showImportOptions, setShowImportOptions] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // High Fidelity Pre-made Demo Data presets to quickly seed beautiful graphs & tables
  const demoPresets = [
    {
      id: "demo-star-city",
      projectName: "Estella, Star City",
      clientName: "U Kyaw Swar (Star City)",
      budget: 120500000,
      materialsBudget: 60000000,
      subconBudget: 45000000,
      durationWeeks: 16,
      address: "Building-G, Star City, Thanlyin, Yangon",
      contractDate: "2026-05-10",
      startDate: "2026-05-15",
      endDate: "2026-09-15",
      schedule: "45% Completed (Gypsum & Carpentry in progress)",
      engineers: [
        { name: "Ko Win Naing (Site Lead)", position: "Senior Project Engineer" },
        { name: "Maung Maung Oo", position: "Junior Civil Inspector" }
      ],
      staff: [
        { name: "Daw Su Su Hlaing", position: "Project Accountant" }
      ],
      subcons: [
        { name: "Aung Interior Group", position: "Ceiling & Carpentry Contractor" },
        { name: "Mandalay Woodworks", position: "Timber & Crafting Specialist" }
      ],
      transactions: [
        { particular: "Initial Project Advance Received", amount: 55000000, category: "Client Payment", flow_type: "IN", date: "2026-05-12", remark: "First milestone payment 40% cleared" },
        { particular: "Purchase of Premium Gypsum Boards", amount: 4500000, category: "Material Purchase", flow_type: "OUT", date: "2026-05-18", remark: "Purchased from Sein Wood Industry" },
        { particular: "Advanced payout to Aung Interior", amount: 15000000, category: "Subcon Payment", flow_type: "OUT", date: "2026-05-20", subcon_name_ref: "Aung Interior Group", remark: "Ceiling work mobilisation advance" },
        { particular: "LED Spotlight Fixtures procurement", amount: 1850000, category: "Material Purchase", flow_type: "OUT", date: "2026-05-25", remark: "Purchased warm white spotlights (24 units)" },
        { particular: "Site supervisor diesel allowance", amount: 250000, category: "Transportation", flow_type: "OUT", date: "2026-05-28", remark: "Weekly backup diesel for site generator" },
        { particular: "Office stationery & progress reports blueprinting", amount: 180000, category: "Labor & Salary", flow_type: "OUT", date: "2026-06-01", remark: "Document binders & color printing" },
        { particular: "Phase 1 Completion Certificate Claim Payment", amount: 30000000, category: "Client Payment", flow_type: "IN", date: "2026-06-03", remark: "Second installment verified by client inspection" }
      ],
      sourcing: [
        { item_name: "MDF Laminate Sheets (Teak finish)", qty: "40 sheets", needed_date: "2026-06-15", requested_by: "Ko Win Naing (Site Lead)", status: "Ordered", remark: "Urgent ceiling cladding" },
        { item_name: "Premium LED Track Lights", qty: "24 units", needed_date: "2026-06-18", requested_by: "Ko Win Naing (Site Lead)", status: "Pending", remark: "Accent lights for lounge" }
      ],
      tasks: [
        { title: "Ceiling framing & gypsum board styling", description: "Ceiling framework layout, steel framing brackets alignment.", status: "Completed", dueDate: "2026-05-25" },
        { title: "Electrical spotlight loop cabling checks", description: "Wire conduit lay and routing spot coordinates checking", status: "Pending", dueDate: "2026-06-12" },
        { title: "Laminate cladding alignment walkthrough", description: "Ensure MDF backplates are parallel before cladding", status: "Pending", dueDate: "2026-06-25" }
      ]
    },
    {
      id: "demo-kabarkyaw-tower",
      projectName: "Kabarkyaw_Office_Tower",
      clientName: "Kabarkyaw Corporate Group",
      budget: 280000000,
      materialsBudget: 140000000,
      subconBudget: 90000000,
      durationWeeks: 24,
      address: "Kabar Aye Pagoda Rd, Bahan, Yangon",
      contractDate: "2026-04-01",
      startDate: "2026-04-10",
      endDate: "2026-09-30",
      schedule: "15% Completed (Electrical wiring & core brickwork framing)",
      engineers: [
        { name: "Ko Lin Aung (Lead)", position: "MEP Project Manager" }
      ],
      staff: [
        { name: "Ma Pyone", position: "Procurement Officer" }
      ],
      subcons: [
        { name: "Thiri Shwe Wah Co.", position: "Main Glazing & Aluminum Works" }
      ],
      transactions: [
        { particular: "Signing Retainer & Mobilization Draft", amount: 110000000, category: "Client Payment", flow_type: "IN", date: "2026-04-05", remark: "Bank transfer received" },
        { particular: "Bahan site steel scaffolding rental", amount: 12000000, category: "Other", flow_type: "OUT", date: "2026-04-14", remark: "Paid upfront for 3 months rental" },
        { particular: "Aluminum mullion profiles procurement", amount: 35000000, category: "Material Purchase", flow_type: "OUT", date: "2026-04-20", remark: "High-grade tempered alloy columns" }
      ],
      sourcing: [
        { item_name: "Clear Temper Glazing 12mm", qty: "65 sheets", needed_date: "2026-07-01", requested_by: "Ko Lin Aung (Lead)", status: "Pending", remark: "Curtain wall structural panes" }
      ],
      tasks: [
        { title: "Anchor bolt levels & profile brackets setup", description: "Mullion structural alignment check on Level 4-6", status: "Pending", dueDate: "2026-06-30" }
      ]
    },
    {
      id: "demo-kyaung-gyi",
      projectName: "Kyaung Gyi Street",
      clientName: "Ko Phyo & Sabei Shop Owner",
      budget: 45000000,
      materialsBudget: 20000000,
      subconBudget: 15000000,
      durationWeeks: 8,
      address: "Kyaung Gyi St, Sanchaung, Yangon",
      contractDate: "2026-05-24",
      startDate: "2026-06-01",
      endDate: "2026-07-31",
      schedule: "Just Started (Initial site clearing & logistics setup)",
      engineers: [
        { name: "Ko Aung Thu", position: "Interior designer & Coordinator" }
      ],
      staff: [],
      subcons: [],
      transactions: [
        { particular: "Initial Startup Payment Received", amount: 18000000, category: "Client Payment", flow_type: "IN", date: "2026-05-28", remark: "Cash on delivery" },
        { particular: "Demolition & partition removals scrap cost", amount: 1500000, category: "Labor & Salary", flow_type: "OUT", date: "2026-06-02", remark: "Daily wage workers clearing" }
      ],
      sourcing: [],
      tasks: [
        { title: "Wall prep, moisture sealing & priming", description: "Prepare historical brickwork for modern cladding panels", status: "Pending", dueDate: "2026-06-15" }
      ]
    },
    {
      id: "demo-ohn-pin",
      projectName: "Ohn_Pin_Street",
      clientName: "Daw Hla Hla",
      budget: 95000000,
      materialsBudget: 45000000,
      subconBudget: 35000000,
      durationWeeks: 12,
      address: "Ohn Pin St, Ahlone, Yangon",
      contractDate: "2026-05-15",
      startDate: "2026-05-20",
      endDate: "2026-08-15",
      schedule: "30% Completed (Partition and electrical ducting installed)",
      engineers: [
        { name: "Ko Htay Win", position: "Site Civil Supervisor" }
      ],
      staff: [],
      subcons: [
        { name: "Yadana Electric Co.", position: "Wiring & Power Panels" }
      ],
      transactions: [
        { particular: "First Advance Installment Payment", amount: 38000000, category: "Client Payment", flow_type: "IN", date: "2026-05-16", remark: "Received" },
        { particular: "PVC conduits, switchboxes & wire bundles", amount: 6200000, category: "Material Purchase", flow_type: "OUT", date: "2026-05-22", remark: "Purchased from Sule electrical depot" },
        { particular: "Wiring labor mobilization advance to Yadana", amount: 5000000, category: "Subcon Payment", flow_type: "OUT", date: "2026-05-25", subcon_name_ref: "Yadana Electric Co.", remark: "Advance payment" }
      ],
      sourcing: [],
      tasks: [
        { title: "Primary Conduit cabling & wire pull checks", description: "Circuit isolation test inside bedroom panels", status: "Completed", dueDate: "2026-05-30" }
      ]
    }
  ];

  // Manual File Upload handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = evt.target?.result as string;
        const parsed = JSON.parse(text);
        if (!parsed.projectName) {
          throw new Error("Missing 'projectName' field in root object.");
        }
        setIsImporting(true);
        await onImportBackup(parsed);
        showToast("JSON Backup data loaded successfully into database!", 'success');
        setShowImportOptions(false);
      } catch (err: any) {
        showToast("Invalid JSON Backup File structure: " + err.message, 'error');
      } finally {
        setIsImporting(false);
      }
    };
    reader.readAsText(file);
  };

  // Pre-configured Demo Seeding handler
  const handleLoadDemoPreset = async (preset: typeof demoPresets[0]) => {
    setIsImporting(true);
    showToast(`Initializing project & seeding high-fidelity database for "${preset.projectName}"...`, 'success');
    
    try {
      await onImportBackup(preset);
      showToast(`Successfully seeded complete database for "${preset.projectName}"!`, 'success');
      setShowImportOptions(false);
    } catch (err: any) {
      showToast("Seeding failed: " + err.message, 'error');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[999] bg-[#05070c]/90 backdrop-blur-md flex items-center justify-center p-4">
      {/* Centered Premium Selector Card */}
      <div className="bg-[#0f172a] border border-[#1e293b] rounded-3xl w-full max-w-[500px] shadow-2xl overflow-hidden relative border-t-2 border-t-indigo-500/80">
        
        {/* Header Block */}
        <div className="h-16 border-b border-slate-800/80 flex items-center justify-between px-6 bg-slate-950/20">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl">
              <FolderOpen size={18} />
            </div>
            <h3 className="font-extrabold text-white text-base uppercase tracking-wider font-display">Load Project</h3>
          </div>
          {currentProjectId && (
            <button 
              onClick={onClose} 
              className="text-slate-500 hover:text-white p-1.5 hover:bg-slate-800/60 rounded-xl transition-all cursor-pointer"
            >
              <X size={18}/>
            </button>
          )}
        </div>

        {/* Portal Options & Action toggle container */}
        <div className="p-6 space-y-5">
          {!showImportOptions ? (
            <>
              {/* SELECT FOLDER header */}
              <div className="flex items-center justify-between text-[10px] font-black tracking-widest text-slate-500 uppercase font-sans">
                <span>SELECT FOLDER</span>
                <button 
                  onClick={() => showToast("Folder lists updated in real-time.", "success")} 
                  className="text-slate-500 hover:text-slate-300 transition-all cursor-pointer"
                  title="Refresh Projects"
                >
                  <RotateCw size={11} className="animate-spin-slow" />
                </button>
              </div>

              {/* Projects List scrollbox */}
              <div className="space-y-2.5 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                {projects.length === 0 ? (
                  <div className="py-12 border border-dashed border-slate-800 rounded-2xl flex flex-col items-center justify-center text-slate-550 text-xs italic gap-2 text-center px-4">
                    <Folder size={32} className="text-slate-650 opacity-40 mb-1" />
                    <p className="not-italic font-bold text-slate-400 text-sm">No construction projects created yet</p>
                    <p className="text-[11px] text-slate-500 max-w-[280px]">Initialize a blank directory or tap 'Finance Data သွင်းမည်' to clone template datasets instantly.</p>
                  </div>
                ) : (
                  projects.map(p => {
                    const isActive = p.id === currentProjectId;
                    return (
                      <div 
                        key={p.id}
                        className={`group border rounded-2xl p-4 flex items-center justify-between gap-4 transition-all hover:bg-slate-800/30 ${
                          isActive 
                            ? 'bg-slate-800/25 border-indigo-500/50 shadow-md shadow-indigo-500/5' 
                            : 'bg-slate-950/20 border-slate-800/80 hover:border-slate-700/80'
                        }`}
                      >
                        {/* Direct load clickable row */}
                        <div 
                          className="flex items-center gap-3.5 flex-1 cursor-pointer"
                          onClick={() => onSelect(p.id)}
                        >
                          <div className={`p-2.5 rounded-xl transition-all ${
                            isActive ? 'bg-indigo-600/20 text-indigo-400' : 'bg-slate-900 text-slate-450 group-hover:bg-slate-850 group-hover:text-indigo-400'
                          }`}>
                            <Folder size={17} className={isActive ? 'fill-indigo-500/20' : ''} />
                          </div>
                          <div className="space-y-0.5">
                            <p className="font-extrabold text-slate-200 text-[13px] group-hover:text-white transition-all leading-snug">{p.projectName}</p>
                            {p.clientName && (
                              <p className="text-[10px] text-slate-500 tracking-wide font-sans">{p.clientName}</p>
                            )}
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={(e) => { e.stopPropagation(); onDelete(p.id); }}
                            className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all cursor-pointer opacity-70 group-hover:opacity-100"
                            title="Delete this directory"
                          >
                            <Trash2 size={14} />
                          </button>
                          <button 
                            onClick={() => onSelect(p.id)}
                            className="p-2 text-slate-500 hover:text-white hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
                            title="Load Project"
                          >
                            <ChevronRight size={15} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Action Buttons styled like the template */}
              <div className="grid grid-cols-2 gap-3 pt-3">
                <button 
                  onClick={onNewProject}
                  className="bg-[#1e1e38]/40 hover:bg-indigo-600 border border-indigo-600/35 hover:border-indigo-500 text-slate-100 hover:text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 text-xs transition-all tracking-wide cursor-pointer font-sans"
                >
                  <Plus size={14} />
                  Project အသစ်ဖန်တီးမည်
                </button>

                <button 
                  onClick={() => setShowImportOptions(true)}
                  className="bg-[#13222e]/40 hover:bg-sky-600/90 border border-[#1d4ed8]/35 hover:border-[#38bdf8] text-slate-100 hover:text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 text-xs transition-all tracking-wide cursor-pointer font-sans"
                >
                  <CloudUpload size={14} className="text-sky-400" />
                  Finance Data သွင်းမည်
                </button>
              </div>
            </>
          ) : (
            // Import view options panel
            <div className="space-y-5 animate-in slide-in-from-bottom-3 duration-200">
              <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase flex items-center gap-1.5">
                  <CloudUpload size={13} className="text-indigo-400" />
                  Import & Setup Options
                </span>
                <button 
                  onClick={() => setShowImportOptions(false)}
                  className="text-slate-400 hover:text-white text-xs font-bold font-sans flex items-center gap-0.5"
                >
                  Go Back
                </button>
              </div>

              {/* Upload custom JSON file card */}
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border border-dashed border-slate-800 hover:border-indigo-500/50 bg-slate-950/20 hover:bg-slate-950/40 p-5 rounded-2xl text-center space-y-2 cursor-pointer transition-all flex flex-col items-center justify-center"
              >
                <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-full">
                  <FileJson size={20} />
                </div>
                <p className="font-bold text-slate-200 text-xs">Upload JSON Database Backup</p>
                <p className="text-[10px] text-slate-500 max-w-[280px] font-sans">Select a .json project dump file generated from your workspace backup.</p>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  accept=".json" 
                  className="hidden" 
                />
              </div>

              {/* Division line */}
              <div className="relative text-center">
                <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t border-slate-800/80"></span>
                <span className="relative bg-[#0f172a] px-3 font-mono text-[9px] text-slate-650 uppercase font-bold tracking-widest">OR CLONE THE PREMIUM DEMO DATA</span>
              </div>

              {/* Seeding Presets Cards Grid (styled elegant to showcase real Burma interior data) */}
              <div className="space-y-2 max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
                {demoPresets.map(preset => (
                  <div 
                    key={preset.id}
                    onClick={() => !isImporting && handleLoadDemoPreset(preset)}
                    className="group border border-slate-800/80 hover:border-indigo-500/40 bg-slate-950/30 p-3.5 rounded-2xl flex items-center justify-between gap-3 cursor-pointer transition-all hover:bg-indigo-950/10"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-[#172554]/60 text-indigo-400 border border-indigo-700/25 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-all">
                        <Building size={14} />
                      </div>
                      <div className="space-y-0.5">
                        <p className="font-extrabold text-slate-200 text-xs leading-none group-hover:text-white transition-all">{preset.projectName}</p>
                        <p className="text-[10px] text-slate-500 leading-none">{preset.clientName}</p>
                        <span className="text-[9px] text-indigo-400 font-mono tracking-tight block mt-1 font-bold">
                          Budget: {(preset.budget / 1000000).toFixed(1)}M MMK • {preset.durationWeeks} Weeks
                        </span>
                      </div>
                    </div>
                    <div className="p-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-500 group-hover:text-emerald-400">
                      <Sparkles size={12} className="animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>

              {isImporting && (
                <div className="text-center font-mono text-[10px] text-indigo-400 animate-pulse py-1">
                  ⏳ POPULATING FIRESTORE DOCUMENT DIRECTORIES...
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
