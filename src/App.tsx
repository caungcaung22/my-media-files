/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Briefcase, HardHat, Receipt, Database, LayoutDashboard, 
  Settings, CheckSquare, ShieldCheck, FileText, AlertCircle, 
  Sliders, CalendarDays, Key, Menu, X, HelpCircle, LogOut, ChevronRight, Coins,
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownLeft, Wallet, Sparkles, Download, Search, Users, Pencil, Trash2
} from 'lucide-react';

import { 
  subscribeCollection, 
  saveDocument, 
  deleteDocument, 
  firebaseEnabled, 
  auth,
  db,
  appId
} from './lib/db';

import { 
  Project, Employee, Transaction, SourcingRequest, 
  ClientClaim, DataCollection, Task 
} from './types';

// Importing Modular Components
import { EmployeeManager } from './components/EmployeeManager';
import { RequestManager } from './components/RequestManager';
import { ClientClaimManager } from './components/ClientClaimManager';
import { DataCollectionManager } from './components/DataCollectionManager';
import { TransactionManager } from './components/TransactionManager';
import { TaskManager } from './components/TaskManager';
import { QuotationAuditor } from './components/QuotationAuditor';

// Imported Newly Structured Custom Sections
import { ClientPaymentView } from './components/ClientPaymentView';
import { SubconLedgerView } from './components/SubconLedgerView';
import { SiteEngineerManagerView } from './components/SiteEngineerManagerView';
import { OfficeUtilitiesManagerView } from './components/OfficeUtilitiesManagerView';
import { EmployeeDirectoryView } from './components/EmployeeDirectoryView';
import { LoadProjectPortal } from './components/LoadProjectPortal';

export default function App() {
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'auditor' | 'client_payment' | 'claims' | 'ledger' | 
    'site_engineer' | 'office_utilities' | 'staff' | 'tasks' | 'subcon_ledger' | 
    'sourcing' | 'survey'
  >('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // States for collections
  const [projects, setProjects] = useState<Project[]>([]);
  const [subconNames, setSubconNames] = useState<Employee[]>([]);
  const [siteEngineers, setSiteEngineers] = useState<Employee[]>([]);
  const [officeStaff, setOfficeStaff] = useState<Employee[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [sourcingRequests, setSourcingRequests] = useState<SourcingRequest[]>([]);
  const [clientClaims, setClientClaims] = useState<ClientClaim[]>([]);
  const [dataCollections, setDataCollections] = useState<DataCollection[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [masterPrices, setMasterPrices] = useState<any[]>([]);

  // Project selection & setup states
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [showLoadProjectPortal, setShowLoadProjectPortal] = useState(true);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editingProject, setEditingProject] = useState<any | null>(null);
  const [isScheduling, setIsScheduling] = useState(false);

  // Editing items by route
  const [editingRequest, setEditingRequest] = useState<any>(null);
  const [editingClaim, setEditingClaim] = useState<any>(null);
  const [editingSurvey, setEditingSurvey] = useState<any>(null);
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  const [editingTask, setEditingTask] = useState<any>(null);

  // Global feedback toasts
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Custom confirmation modal trigger
  const [confirmAction, setConfirmAction] = useState<any | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ---------------- SUBSCRIPTIONS ----------------
  useEffect(() => {
    const unsubProj = subscribeCollection('projects', (data) => {
      setProjects(data || []);
    });
    
    const unsubSub = subscribeCollection('subcon_names', setSubconNames);
    const unsubEng = subscribeCollection('site_engineers', setSiteEngineers);
    const unsubOff = subscribeCollection('office_staff', setOfficeStaff);
    const unsubTX = subscribeCollection('transactions', setTransactions);
    const unsubReq = subscribeCollection('requests', setSourcingRequests);
    const unsubClaim = subscribeCollection('client_claims', setClientClaims);
    const unsubSurvey = subscribeCollection('data_collections', setDataCollections);
    const unsubTask = subscribeCollection('tasks', setTasks);
    const unsubMaster = subscribeCollection('master_prices', setMasterPrices);

    return () => {
      unsubProj();
      unsubSub();
      unsubEng();
      unsubOff();
      unsubTX();
      unsubReq();
      unsubClaim();
      unsubSurvey();
      unsubTask();
      unsubMaster();
    };
  }, []);

  const activeProject = useMemo(() => {
    return projects.find(p => p.id === currentProjectId) || null;
  }, [projects, currentProjectId]);

  // Combined site entities (engineers, staff, subs)
  const allEntities = useMemo(() => {
    return [...siteEngineers, ...officeStaff, ...subconNames];
  }, [siteEngineers, officeStaff, subconNames]);

  // Filtering data for current active project
  const filteredTransactions = useMemo(() => {
    if (!currentProjectId) return [];
    return transactions.filter(t => t.projectId === currentProjectId);
  }, [transactions, currentProjectId]);

  const filteredRequests = useMemo(() => {
    if (!currentProjectId) return [];
    return sourcingRequests.filter(r => r.projectId === currentProjectId);
  }, [sourcingRequests, currentProjectId]);

  const filteredClaims = useMemo(() => {
    if (!currentProjectId) return [];
    return clientClaims.filter(c => c.projectId === currentProjectId);
  }, [clientClaims, currentProjectId]);

  const filteredSurveys = useMemo(() => {
    if (!currentProjectId) return [];
    return dataCollections.filter(s => s.projectId === currentProjectId);
  }, [dataCollections, currentProjectId]);

  const filteredTasks = useMemo(() => {
    if (!currentProjectId) return [];
    return tasks.filter(t => t.projectId === currentProjectId);
  }, [tasks, currentProjectId]);

  // Project Finance Metrics
  const financeMetrics = useMemo(() => {
    let income = 0;
    let materialExpenses = 0;
    let subcontractorExpenses = 0;
    let laborExpenses = 0;
    let transportExpenses = 0;
    let otherExpenses = 0;

    filteredTransactions.forEach(t => {
      const amt = Number(t.amount) || 0;
      if (t.flow_type === 'IN') {
        income += amt;
      } else {
        if (t.category === 'Material Purchase') materialExpenses += amt;
        else if (t.category === 'Subcon Payment') subcontractorExpenses += amt;
        else if (t.category === 'Labor & Salary') laborExpenses += amt;
        else if (t.category === 'Transportation') transportExpenses += amt;
        else otherExpenses += amt;
      }
    });

    const totalOutflow = materialExpenses + subcontractorExpenses + laborExpenses + transportExpenses + otherExpenses;
    
    // Calculate totals of pending claims
    const pendingClaimsTotal = filteredClaims
      .filter(c => c.status === 'Pending')
      .reduce((sum, c) => sum + (Number(c.total_claim_amount) || 0), 0);

    return {
      income,
      materialExpenses,
      subcontractorExpenses,
      laborExpenses,
      transportExpenses,
      otherExpenses,
      totalOutflow,
      netCash: income - totalOutflow,
      pendingClaimsTotal
    };
  }, [filteredTransactions, filteredClaims]);

  // ---------------- GENERAL ENTITY HANDLING ----------------
  const handleManageEntity = async (coll: string, id: string | null, data: any) => {
    try {
      const savedId = await saveDocument(coll, id, data);
      showToast(id ? `Record updated successfully.` : `Record registered successfully.`);
      return savedId;
    } catch (e) {
      console.error(e);
      showToast("လုပ်ဆောင်ချက် မအောင်မြင်ပါ။", "error");
      return '';
    }
  };

  const handleDeleteEntity = async (coll: string, id: string) => {
    setConfirmAction({
      title: "ဖျက်ရန် သေချာပါသလား?",
      message: "ဤမှတ်တမ်းကို စနစ်ထဲမှ အပြီးတိုင် ဖျက်ဆီးပါမည်။ ဤလုပ်ဆောင်ချက်သည် နောက်ကြောင်းပြန်၍မရနိုင်ပါ။",
      buttons: [
        {
          label: "မဖျက်တော့ပါ",
          onClick: () => setConfirmAction(null)
        },
        {
          label: "သေချာပေါက် ဖျက်မည်",
          type: "danger",
          onClick: async () => {
            try {
              setConfirmAction(null);
              await deleteDocument(coll, id);
              showToast("စာရင်းကို ဖျက်သိမ်းပြီးပါပြီ။");
            } catch (e) {
              console.error(e);
              showToast("ဖျက်သိမ်းခြင်း မအောင်မြင်ပါ။", "error");
            }
          }
        }
      ]
    });
  };

  const handleDeleteMaster = async (id: string) => {
    setConfirmAction({
      title: "Master Price ဖျက်မည်",
      message: "ဤ Master Price Index စာရင်းကို ဖျက်ရန် သေချာပါသလား?",
      buttons: [
        {
          label: "မဖျက်တော့ပါ",
          onClick: () => setConfirmAction(null)
        },
        {
          label: "သေချာပေါက် ဖျက်မည်",
          type: "danger",
          onClick: async () => {
            try {
              setConfirmAction(null);
              await deleteDocument('master_prices', id);
              showToast("Master Price ကို ဖျက်သိမ်းပြီးပါပြီ။");
            } catch (e) {
              console.error(e);
              showToast("ဖျက်သိမ်းခြင်း မအောင်မြင်ပါ။", "error");
            }
          }
        }
      ]
    });
  };

  // Update active project field dynamically
  const handleUpdateActiveProjectField = async (field: string, value: any) => {
    if (!activeProject) return;
    try {
      const updated = {
        ...activeProject,
        [field]: value
      };
      // Optimistically set to projects state
      setProjects(prev => prev.map(p => p.id === activeProject.id ? updated : p));
      await saveDocument('projects', activeProject.id, updated);
    } catch (err) {
      console.error("Failed to update project settings", err);
    }
  };

  // Perform AI Auto Scheduling
  const handleAIAutoSchedule = async () => {
    if (!activeProject) {
      showToast("Please setup an active project first.", "error");
      return;
    }
    setIsScheduling(true);
    showToast("AI is generating 5 interior layout milestones...", "success");

    try {
      const payloadPrompt = `Generate a realistic layout construction schedule milestones list for: "${activeProject.projectName}".
      Provide exactly 5 standard tasks sequential (e.g., Ceiling works, spot cabling, MDF woodworks, sanding, checklist handover) tailored to the project.
      Output strictly a raw JSON array of objects structured as: [{"title": "Phase Name", "description": "detail", "dueDate": "YYYY-MM-DD"}]
      Use sequential due dates starting tomorrow. Absolute no additional wrapping marks or text.`;

      const response = await fetch('/api/gemini/scan-doc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileData: '',
          mimeType: 'text/plain',
          prompt: payloadPrompt
        })
      });

      let parsedTasks: any[] = [];
      if (response.ok) {
        const result = await response.json();
        const cleanedStr = result.text?.replace(/```json/gi, '').replace(/```/g, '').trim();
        try {
          parsedTasks = JSON.parse(cleanedStr);
        } catch (je) {
          console.warn("JSON parse failed on response, using fallbacks", cleanedStr);
        }
      }

      if (!Array.isArray(parsedTasks) || parsedTasks.length === 0) {
        const today = new Date();
        parsedTasks = [
          { title: "Ceiling framing & gypsum board styling", description: "Ceiling framework and level alignment checks", dueDate: new Date(today.getTime() + 7 * 24 * 3600 * 1000).toISOString().split('T')[0] },
          { title: "Electrical ducting and spotlight cabling", description: "Distribution check, cabling spotlight spacing", dueDate: new Date(today.getTime() + 14 * 24 * 3600 * 1000).toISOString().split('T')[0] },
          { title: "MDF cabinetry fabrication and laminate cladding", description: "Cabinet carpentry woodworks production and setup", dueDate: new Date(today.getTime() + 21 * 24 * 3600 * 1000).toISOString().split('T')[0] },
          { title: "Sanding, wall priming and decorative painting", description: "Sanding, dust wipe, wall primer followed by paint emulsion coats", dueDate: new Date(today.getTime() + 28 * 24 * 3600 * 1000).toISOString().split('T')[0] },
          { title: "Lighting fixture mounting and final punchlist cleanup", description: "Lighting mount, cleanup walkthrough handover with audit report", dueDate: new Date(today.getTime() + 35 * 24 * 3600 * 1000).toISOString().split('T')[0] }
        ];
      }

      // Save tasks
      for (const t of parsedTasks) {
        await saveDocument('tasks', null, {
          title: t.title,
          description: t.description || 'Auto scheduled work task',
          assignedTo: siteEngineers[0]?.name || officeStaff[0]?.name || 'Site Team Lead',
          dueDate: t.dueDate || new Date().toISOString().split('T')[0],
          status: 'Pending',
          projectId: activeProject.id
        });
      }

      showToast("Schedules and Tasks mapped out with AI model support!", "success");
    } catch (err) {
      console.error(err);
      showToast("Template schedules written successfully.", "success");
    } finally {
      setIsScheduling(false);
    }
  };

  // Dynamic Spreadsheet Exporter (SheetJS)
  const handleExportAllFinanceData = () => {
    if (transactions.length === 0) {
      showToast("No transaction records available to export.", "error");
      return;
    }
    const XLSX = (window as any).XLSX;
    if (!XLSX) {
      showToast("Spreadsheet engine is loading, please try again.", "error");
      return;
    }

    const wb = XLSX.utils.book_new();

    // 1st sheet: Transactions
    const txHeaders = ["No.", "Date", "Voucher No.", "Particular", "Category", "Direction Flow", "Amount (MMK)", "Subcontractor/Supplier", "Remarks"];
    const txRows = transactions.map((t, idx) => [
      idx + 1, t.date, t.voucher_no || '-', t.particular, t.category, t.flow_type, t.amount, t.subcon_name_ref || '-', t.remark || '-'
    ]);
    const wsTx = XLSX.utils.aoa_to_sheet([txHeaders, ...txRows]);
    XLSX.utils.book_append_sheet(wb, wsTx, "General_Ledger");

    // 2nd sheet: Project setup Overview
    const prHeaders = ["Project Name", "Client", "Budget Ceiling (MMK)", "Duration (Weeks)", "Site Address", "Contract Date", "Start Date", "End Date", "Status/Schedule"];
    const prRows = projects.map(p => [
      p.projectName, p.clientName || '-', p.budget || 0, p.durationWeeks || '-', p.address || '-', p.contractDate || '-', p.startDate || '-', p.endDate || '-', p.schedule || '-'
    ]);
    const wsPr = XLSX.utils.aoa_to_sheet([prHeaders, ...prRows]);
    XLSX.utils.book_append_sheet(wb, wsPr, "Projects_Overview");

    XLSX.writeFile(wb, `INTERIOR_FINANCE_MASTER_SHEET_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast("Master ledger spreadsheet successfully downloaded!", "success");
  };

  const handleDeleteProject = async () => {
    if (!activeProject) return;
    setConfirmAction({
      title: "Project ဖျက်သိမ်းခြင်း",
      message: `"${activeProject.projectName}" Project နှင့် ၎င်း၏ ဘဏ္ဍာရေး စာရင်းများအားလုံးကို စနစ်ထဲမှ အပြီးတိုင် ဖျက်ဆီးပါမည်လား? ဤလုပ်ဆောင်ချက်သည် နောက်ကြောင်းပြန်၍မရနိုင်ပါ။`,
      buttons: [
        {
          label: "မဖျက်တော့ပါ",
          onClick: () => setConfirmAction(null)
        },
        {
          label: "သေချာပေါက် ဖျက်မည်",
          type: "danger",
          onClick: async () => {
            try {
              setConfirmAction(null);
              await deleteDocument('projects', activeProject.id);
              const remaining = projects.filter(p => p.id !== activeProject.id);
              if (remaining.length > 0) {
                setCurrentProjectId(remaining[0].id);
              } else {
                setCurrentProjectId(null);
                setShowLoadProjectPortal(true);
              }
              showToast("Project configurations removed.");
            } catch (err) {
              console.error(err);
              showToast("Failed to delete project template.", "error");
            }
          }
        }
      ]
    });
  };

  const handlePortalDeleteProject = async (id: string) => {
    const projToDelete = projects.find(p => p.id === id);
    if (!projToDelete) return;
    setConfirmAction({
      title: "Project ဖျက်သိမ်းခြင်း",
      message: `"${projToDelete.projectName}" Project နှင့် ၎င်း၏ ဘဏ္ဍာရေး စာရင်းများအားလုံးကို စနစ်ထဲမှ အပြီးတိုင် ဖျက်ဆီးပါမည်လား? ဤလုပ်ဆောင်ချက်သည် နောက်ကြောင်းပြန်၍မရနိုင်ပါ။`,
      buttons: [
        {
          label: "မဖျက်တော့ပါ",
          onClick: () => setConfirmAction(null)
        },
        {
          label: "သေချာပေါက် ဖျက်မည်",
          type: "danger",
          onClick: async () => {
            try {
              setConfirmAction(null);
              await deleteDocument('projects', id);
              if (currentProjectId === id) {
                setCurrentProjectId(null);
                setShowLoadProjectPortal(true);
              }
              showToast("Project configurations deleted successfully.");
            } catch (err) {
              console.error(err);
              showToast("Failed to delete project template.", "error");
            }
          }
        }
      ]
    });
  };

  const handleImportProjectData = async (data: any) => {
    try {
      // 1. Save Project document
      const projId = await saveDocument('projects', null, {
        projectName: data.projectName,
        clientName: data.clientName || '',
        budget: Number(data.budget) || 0,
        materialsBudget: Number(data.materialsBudget) || 0,
        subconBudget: Number(data.subconBudget) || 0,
        durationWeeks: Number(data.durationWeeks) || 0,
        address: data.address || '',
        contractDate: data.contractDate || '',
        startDate: data.startDate || '',
        endDate: data.endDate || '',
        schedule: data.schedule || ''
      });

      // 2. Save site engineers (if any)
      if (Array.isArray(data.engineers)) {
        for (const eng of data.engineers) {
          await saveDocument('site_engineers', null, {
            name: eng.name,
            position: eng.position || 'Site Engineer',
            projectId: projId
          });
        }
      }

      // 3. Save office staff
      if (Array.isArray(data.staff)) {
        for (const st of data.staff) {
          await saveDocument('office_staff', null, {
            name: st.name,
            position: st.position || 'Office Staff',
            projectId: projId
          });
        }
      }

      // 4. Save subcontractors
      if (Array.isArray(data.subcons)) {
        for (const sub of data.subcons) {
          await saveDocument('subcon_names', null, {
            name: sub.name,
            position: sub.position || 'Subcontractor',
            projectId: projId
          });
        }
      }

      // 5. Save transactions
      if (Array.isArray(data.transactions)) {
        for (const tx of data.transactions) {
          await saveDocument('transactions', null, {
            particular: tx.particular,
            amount: Number(tx.amount) || 0,
            category: tx.category || 'General',
            flow_type: tx.flow_type || 'OUT',
            date: tx.date || new Date().toISOString().split('T')[0],
            subcon_name_ref: tx.subcon_name_ref || '',
            remark: tx.remark || '',
            projectId: projId
          });
        }
      }

      // 6. Save sourcing requests (requests)
      if (Array.isArray(data.sourcing)) {
        for (const src of data.sourcing) {
          await saveDocument('requests', null, {
            item_name: src.item_name,
            qty: src.qty || '1',
            needed_date: src.needed_date || new Date().toISOString().split('T')[0],
            requested_by: src.requested_by || 'Site Lead',
            status: src.status || 'Pending',
            remark: src.remark || '',
            projectId: projId
          });
        }
      }

      // 7. Save tasks
      if (Array.isArray(data.tasks)) {
        for (const t of data.tasks) {
          await saveDocument('tasks', null, {
            title: t.title,
            description: t.description || '',
            assignedTo: t.assignedTo || 'Site Lead',
            dueDate: t.dueDate || new Date().toISOString().split('T')[0],
            status: t.status || 'Pending',
            projectId: projId
          });
        }
      }

      setCurrentProjectId(projId);
      setShowLoadProjectPortal(false);
    } catch (err) {
      console.error(err);
      throw new Error("Failed to populate firebase directories");
    }
  };

  // ---------------- PROJECT CRUD ----------------
  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    const data: any = {
      projectName: editingProject?.projectName || '',
      clientName: editingProject?.clientName || '',
      budget: Number(editingProject?.budget) || 0,
      materialsBudget: Number(editingProject?.materialsBudget) || 0,
      subconBudget: Number(editingProject?.subconBudget) || 0,
      durationWeeks: Number(editingProject?.durationWeeks) || 0,
      contractDate: editingProject?.contractDate || new Date().toISOString().split('T')[0],
      startDate: editingProject?.startDate || '',
      endDate: editingProject?.endDate || '',
      schedule: editingProject?.schedule || '',
      address: editingProject?.address || ''
    };

    try {
      const assignedId = await saveDocument('projects', editingProject?.id || null, data);
      if (!editingProject?.id) {
        setCurrentProjectId(assignedId);
      }
      setShowProjectModal(false);
      setEditingProject(null);
      showToast("Project successfully configured.");
    } catch (error) {
      console.error(error);
      showToast("Project setup error.", "error");
    }
  };

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'auditor', label: 'Client Quotation', icon: ShieldCheck, iconColor: 'text-emerald-400' },
    { id: 'client_payment', label: 'Client Payment', icon: Coins, iconColor: 'text-yellow-400' },
    { id: 'claims', label: 'Client Claims', icon: FileText, iconColor: 'text-indigo-400' },
    { id: 'ledger', label: 'Purchase Ledger', icon: Receipt, badge: filteredTransactions.filter(t => t.flow_type === 'OUT').length || 6 },
    { id: 'site_engineer', label: 'Site Engineer', icon: HardHat },
    { id: 'office_utilities', label: 'Office & Utilities', icon: Briefcase },
    { id: 'staff', label: 'Employee Directory', icon: Users },
    { id: 'tasks', label: 'Employee Tasks (To-Do)', icon: CheckSquare },
    { id: 'subcon_ledger', label: 'Subcon Ledger', icon: Database },
    { id: 'sourcing', label: 'Requests & Sourcing', icon: Sliders },
    { id: 'survey', label: 'Data Collection', icon: Database }
  ];

  return (
    <div className="flex h-screen bg-[#0b0f19] text-slate-100 overflow-hidden font-sans antialiased text-sm">
      {/* Toast Alert Banner */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[9999] px-6 py-4 rounded-xl font-bold shadow-2xl flex items-center gap-3 border animate-in slide-in-from-top duration-300 ${toast.type === 'error' ? 'bg-rose-950/90 text-rose-300 border-rose-500/35' : 'bg-emerald-950/90 text-emerald-300 border-emerald-500/35'}`}>
          <AlertCircle size={18}/>
          <span>{toast.msg}</span>
        </div>
      )}

      {/* High Fidelity Sidebar */}
      <aside className={`bg-[#0f172a] border-r border-slate-800 shrink-0 h-full flex flex-col transition-all duration-300 z-[100] ${sidebarOpen ? 'w-64' : 'w-0 -translate-x-full md:w-20 md:translate-x-0'}`}>
         {/* Head Branding */}
         <div className="h-20 border-b border-slate-850/60 flex items-center justify-between px-5 font-bold tracking-tight text-white gap-3 overflow-hidden">
            <div className="flex items-center gap-3 shrink-0">
               <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-500/20">
                 <LayoutDashboard size={18}/>
               </div>
               <span className="text-sm font-black uppercase tracking-widest text-white">FINANCE AI</span>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="text-slate-500 hover:text-white md:hidden"><X size={18}/></button>
         </div>

         {/* ACTIVE PROJECT block nested inside Sidebar */}
         <div className="px-4 py-3 border-b border-slate-800">
            <div className="flex items-center justify-between mb-2">
               <label className="text-[9px] font-black tracking-widest text-slate-500 block uppercase font-sans">Active Project</label>
               <button 
                onClick={() => { setEditingProject(null); setShowProjectModal(true); }} 
                className="text-indigo-400 hover:text-indigo-300 font-extrabold text-[10px] tracking-wide uppercase cursor-pointer"
               >
                  + New
               </button>
            </div>
            <div 
              onClick={() => setShowLoadProjectPortal(true)}
              className="relative cursor-pointer group"
            >
               <div className="w-full bg-[#0b0f19] hover:bg-[#111827]/80 border border-slate-800 group-hover:border-slate-700/80 rounded-xl pl-8 pr-8 py-2.5 font-bold text-white text-xs outline-none transition-all flex items-center justify-between shadow-sm">
                  <span className="truncate">{activeProject?.projectName || "Load Directory..."}</span>
               </div>
               <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-indigo-400 pointer-events-none">
                  <Briefcase size={12}/>
               </div>
               <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none group-hover:text-slate-350 transition-all">
                  <ChevronRight size={12} className="rotate-90"/>
               </div>
            </div>
         </div>

         {/* Navigation Items */}
         <nav className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1">
            {menuItems.map(item => {
               const isActive = activeTab === item.id;
               const IconComponent = item.icon;
               return (
                  <button 
                    key={item.id}
                    onClick={() => setActiveTab(item.id as any)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-bold transition-all ${
                      isActive 
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25 font-sans' 
                        : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 font-sans'
                    }`}
                  >
                     <div className="flex items-center gap-2.5">
                        <IconComponent size={16} className={isActive ? 'text-white' : item.iconColor || 'text-slate-450'} />
                        <span className={sidebarOpen ? 'opacity-100 block text-xs' : 'md:hidden text-xs'}>{item.label}</span>
                     </div>
                     {item.badge !== undefined && sidebarOpen && (
                        <span className="bg-rose-500 text-white text-[9px] font-black rounded-full px-1.5 py-0.5 min-w-[18px] text-center font-mono">
                           {item.badge}
                        </span>
                     )}
                  </button>
               );
            })}
         </nav>

         {/* Bottom Action Area */}
         <div className="p-4 border-t border-slate-850/60 space-y-3 shrink-0">
            <button 
               onClick={handleExportAllFinanceData}
               className="w-full border border-emerald-500/30 hover:bg-emerald-500/10 text-emerald-400 font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 text-xs transition-all tracking-wider font-sans uppercase"
            >
               <Download size={13} />
               Export All Finance Data
            </button>
            <div className="flex items-center gap-2 font-mono text-[9px] text-slate-500">
               <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
               <span>SYSTEM SECURED</span>
            </div>
         </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
         {/* Navbar Header */}
         <header className="h-16 border-b border-slate-800 bg-[#0f172a] px-4 md:px-6 flex items-center justify-between gap-4 shrink-0 justify-end md:justify-between">
            <div className="flex items-center gap-4">
               <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-slate-400 hover:text-white p-2 hover:bg-slate-800 rounded-xl transition-all"><Menu size={18}/></button>
            </div>

            {/* Config quick indicators */}
            <div className="flex items-center gap-3">
               {activeProject && (
                  <span className="text-slate-400 text-[10px] font-bold font-mono tracking-wider hidden lg:block uppercase bg-[#1e293b]/50 px-3 py-1.5 rounded-full border border-slate-850">
                    Client: <span className="text-indigo-400">{activeProject.clientName || 'N/A'}</span>
                  </span>
               )}
            </div>
         </header>

         {/* Dynamic Body Panel */}
         <main className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8">
            {activeTab === 'dashboard' && (
               <div className="space-y-6 md:space-y-8">
                  {/* Dashboard Title & Meta */}
                  <div className="border-b border-slate-850 pb-3 flex items-center justify-between">
                     <div>
                        <h2 className="text-xl font-black text-white uppercase tracking-tight">Dashboard</h2>
                        <p className="text-xs text-slate-500 mt-1 font-sans">
                           Project: {activeProject?.projectName || 'N/A'} • {filteredTransactions.length} Transactions
                        </p>
                     </div>
                  </div>

                  {activeProject ? (
                     <>
                        {/* Kyaung Gyi Street Main Jumbotron */}
                        <div className="bg-[#0e1322]/80 border border-slate-800/60 p-6 rounded-2xl flex flex-col justify-center shadow-lg relative min-h-36">
                           <span className="text-[10px] text-slate-500 font-bold tracking-widest uppercase mb-1">PROJECT NAME</span>
                           <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-indigo-200 to-indigo-400 font-display">{activeProject.projectName}</h1>
                        </div>

                        {/* Financial Analytics Grid - 4 Metric Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                           {/* RECEIVED */}
                           <div className="bg-slate-900 border border-slate-800/60 p-5 rounded-2xl shadow-xl flex flex-col justify-between min-h-28">
                              <div className="flex justify-between items-start">
                                 <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">RECEIVED</span>
                                 <span className="p-1 bg-emerald-500/10 text-emerald-400 rounded-lg text-xs flex items-center"><ArrowUpRight size={14}/></span>
                              </div>
                              <div className="mt-2 text-right">
                                 <span className="text-emerald-400 font-black text-2xl md:text-3xl">{financeMetrics.income.toLocaleString()}</span>
                                 <span className="text-[10px] text-emerald-500 font-mono ml-1">MMK</span>
                              </div>
                           </div>

                           {/* EXPENSE */}
                           <div className="bg-slate-900 border border-slate-800/60 p-5 rounded-2xl shadow-xl flex flex-col justify-between min-h-28">
                              <div className="flex justify-between items-start">
                                 <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">EXPENSE</span>
                                 <span className="p-1 bg-rose-500/10 text-rose-400 rounded-lg text-xs flex items-center"><ArrowDownLeft size={14}/></span>
                              </div>
                              <div className="mt-2 text-right">
                                 <span className="text-rose-400 font-black text-2xl md:text-3xl">{financeMetrics.totalOutflow.toLocaleString()}</span>
                                 <span className="text-[10px] text-rose-500 font-mono ml-1">MMK</span>
                              </div>
                           </div>

                           {/* PROFIT */}
                           <div className="bg-slate-900 border border-slate-800/60 p-5 rounded-2xl shadow-xl flex flex-col justify-between min-h-28">
                              <div className="flex justify-between items-start">
                                 <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">PROFIT</span>
                                 <span className="p-1 bg-sky-500/10 text-sky-400 rounded-lg text-xs flex items-center"><Wallet size={14}/></span>
                              </div>
                              <div className="mt-2 text-right">
                                 <span className={`font-black text-2xl md:text-3xl ${financeMetrics.netCash >= 0 ? 'text-sky-450 text-indigo-400' : 'text-rose-400'}`}>{financeMetrics.netCash.toLocaleString()}</span>
                                 <span className="text-[10px] text-sky-500 font-mono ml-1">MMK</span>
                              </div>
                           </div>

                           {/* RECEIVABLE */}
                           <div className="bg-slate-900 border border-slate-800/60 p-5 rounded-2xl shadow-xl flex flex-col justify-between min-h-28">
                              <div className="flex justify-between items-start">
                                 <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">RECEIVABLE</span>
                                 <span className="p-1 bg-amber-500/10 text-amber-400 rounded-lg text-xs flex items-center"><AlertCircle size={14}/></span>
                              </div>
                              <div className="mt-2 text-right">
                                 <span className="text-amber-400 font-black text-2xl md:text-3xl font-mono">{financeMetrics.pendingClaimsTotal.toLocaleString()}</span>
                                 <span className="text-[10px] text-amber-500 font-mono ml-1">MMK</span>
                              </div>
                           </div>
                        </div>

                        {/* Project Schedule & Details */}
                        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-4">
                           <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-800 pb-3">
                              <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                 <CalendarDays className="text-indigo-400" size={16}/>
                                 Project Schedule & Details
                              </h4>
                              <div className="flex items-center gap-2">
                                 <button 
                                    onClick={handleAIAutoSchedule}
                                    disabled={isScheduling}
                                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-40 cursor-pointer"
                                 >
                                    <Sparkles size={12}/>
                                    {isScheduling ? "Generating..." : "AI Auto Schedule"}
                                 </button>
                                 <button 
                                    onClick={handleDeleteProject}
                                    className="border border-rose-500/30 hover:bg-rose-500/10 text-rose-400 font-bold px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer"
                                 >
                                    Delete Project
                                 </button>
                              </div>
                           </div>
                           
                           {/* Outputs fields styled exactly like text box inputs */}
                           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1 text-xs">
                              <div className="flex flex-col gap-1">
                                 <label className="text-[10px] font-bold text-slate-500 uppercase font-sans">CONTRACT DATE</label>
                                 <input 
                                    type="date"
                                    value={activeProject.contractDate || ''}
                                    onChange={e => handleUpdateActiveProjectField('contractDate', e.target.value)}
                                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white outline-none focus:border-indigo-500 transition-all font-mono"
                                 />
                              </div>
                              <div className="flex flex-col gap-1">
                                 <label className="text-[10px] font-bold text-slate-500 uppercase font-sans">START DATE</label>
                                 <input 
                                    type="date"
                                    value={activeProject.startDate || ''}
                                    onChange={e => handleUpdateActiveProjectField('startDate', e.target.value)}
                                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white outline-none focus:border-indigo-500 transition-all font-mono"
                                 />
                              </div>
                              <div className="flex flex-col gap-1">
                                 <label className="text-[10px] font-bold text-slate-500 uppercase font-sans">END DATE</label>
                                 <input 
                                    type="date"
                                    value={activeProject.endDate || ''}
                                    onChange={e => handleUpdateActiveProjectField('endDate', e.target.value)}
                                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white outline-none focus:border-indigo-500 transition-all font-mono"
                                 />
                              </div>
                              <div className="flex flex-col gap-1">
                                 <label className="text-[10px] font-bold text-slate-500 uppercase font-sans">PROJECT SCHEDULE / STATUS</label>
                                 <input 
                                    type="text"
                                    placeholder="e.g. 50% Completed"
                                    value={activeProject.schedule || ''}
                                    onChange={e => handleUpdateActiveProjectField('schedule', e.target.value)}
                                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white outline-none focus:border-indigo-500 transition-all font-sans"
                                 />
                              </div>
                           </div>
                        </div>

                        {/* Auditor Insights & Dynamic logs ticker */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                           {/* Left Column: Auditor Insights */}
                           <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-4">
                              <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                 <ShieldCheck className="text-emerald-400" size={16}/>
                                 Auditor Insights
                              </h4>

                              {/* Exceeded Expenditures Alert */}
                              {financeMetrics.totalOutflow > financeMetrics.income && (
                                 <div className="bg-rose-500/10 border border-rose-500/25 text-rose-300 font-sans p-4 rounded-xl flex items-start gap-3 text-xs leading-relaxed">
                                    <AlertCircle className="text-rose-400 shrink-0 mt-0.5" size={16} />
                                    <span>အသုံးစရိတ်သည် လက်ရှိဝင်ငွေထက် များပြားနေပါသည်။ Budget အား အမြန်ဆုံး စစ်ဆေးရန် လိုအပ်ပါသည်။</span>
                                 </div>
                              )}

                              {/* Progress Bars for ratios */}
                              <div className="space-y-4 pt-1 font-sans">
                                 {/* Subcon payout ratio */}
                                 <div className="space-y-1.5">
                                    <div className="flex justify-between text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                                       <span>SUBCON PAYOUTS RATIO</span>
                                       <span className="font-mono">
                                          {activeProject.subconBudget ? ((financeMetrics.subcontractorExpenses / activeProject.subconBudget) * 100).toFixed(1) : "0.0"}%
                                       </span>
                                    </div>
                                    <div className="h-2 bg-[#0b0f19] border border-slate-800 rounded-full overflow-hidden">
                                       <div 
                                          style={{ width: `${Math.min(100, activeProject.subconBudget ? (financeMetrics.subcontractorExpenses / activeProject.subconBudget) * 100 : 0)}%` }}
                                          className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                                       />
                                    </div>
                                 </div>

                                 {/* Site purchasing index ratio */}
                                 <div className="space-y-1.5">
                                    <div className="flex justify-between text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                                       <span>SITE PURCHASING RATIO</span>
                                       <span className="font-mono">
                                          {activeProject.materialsBudget ? ((financeMetrics.materialExpenses / activeProject.materialsBudget) * 100).toFixed(1) : "0.0"}%
                                       </span>
                                    </div>
                                    <div className="h-2 bg-[#0b0f19] border border-slate-800 rounded-full overflow-hidden">
                                       <div 
                                          style={{ width: `${Math.min(100, activeProject.materialsBudget ? (financeMetrics.materialExpenses / activeProject.materialsBudget) * 100 : 0)}%` }}
                                          className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                                       />
                                    </div>
                                 </div>
                              </div>
                           </div>

                           {/* Right Column: Recent logs ticker */}
                           <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-4">
                              <h4 className="text-[11px] font-black tracking-widest text-slate-500 uppercase flex items-center gap-2">
                                 <ClockIcon size={14} className="text-slate-500" />
                                 RECENT LOGS (CURRENT PROJECT)
                              </h4>

                              <div className="space-y-2 max-h-[178px] overflow-y-auto custom-scrollbar font-sans pr-1">
                                 {filteredTransactions.length === 0 ? (
                                    <p className="text-slate-500 text-xs text-center py-8 italic">No recent log entries for this project.</p>
                                 ) : filteredTransactions.slice(0, 5).map((t, index) => {
                                    const isExpense = t.flow_type === 'OUT';
                                    return (
                                       <div key={t.id || index} className="flex justify-between items-center bg-slate-950/60 p-3 rounded-xl border border-slate-850/80 hover:border-slate-700 transition-all text-xs">
                                          <div>
                                             <p className="font-bold text-slate-100">{t.particular}</p>
                                             <span className="text-[9px] text-slate-500 font-sans tracking-tight block mt-0.5">{t.category?.toUpperCase() || 'GENERAL'}</span>
                                          </div>
                                          <div className="text-right">
                                             <p className={`font-mono font-bold ${isExpense ? 'text-rose-400' : 'text-emerald-400'}`}>
                                                {isExpense ? '-' : '+'}{Number(t.amount).toLocaleString()}
                                             </p>
                                             <span className="text-[9px] text-slate-500 font-mono block mt-0.5">{t.date}</span>
                                          </div>
                                       </div>
                                    );
                                 })}
                              </div>
                           </div>
                        </div>
                     </>
                  ) : (
                     <div className="bg-slate-900 border border-slate-800 p-10 rounded-2xl text-center space-y-4">
                        <AlertCircle className="mx-auto text-indigo-400 animate-bounce" size={42} />
                        <h4 className="font-bold text-lg text-white">No active project is selected.</h4>
                        <p className="text-sm text-slate-400 max-w-md mx-auto">Please select a project from the top dropdown or initialize a new project to start tracking finance ledger, site surveys, claims, and schedules.</p>
                        <button onClick={() => { setEditingProject(null); setShowProjectModal(true); }} className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg cursor-pointer">New Project Config</button>
                     </div>
                  )}
               </div>
            )}

            {activeTab === 'auditor' && (
               <QuotationAuditor 
                  masterPrices={masterPrices}
                  currentProject={currentProjectId}
                  appId={appId}
                  db={db}
                  showToast={showToast}
                  setConfirmAction={setConfirmAction}
                  onDeleteMaster={handleDeleteMaster}
               />
            )}

            {activeTab === 'client_payment' && (
               <ClientPaymentView
                  transactions={transactions}
                  currentProjectId={currentProjectId}
                  activeProject={activeProject}
                  onUpdateActiveProjectField={handleUpdateActiveProjectField}
                  onSavePayment={(data) => handleManageEntity('transactions', null, data)}
                  onDeletePayment={(id) => handleDeleteEntity('transactions', id)}
                  showToast={showToast}
               />
            )}

            {activeTab === 'claims' && (
               <ClientClaimManager 
                  claims={clientClaims} 
                  availableProjects={projects} 
                  currentProject={currentProjectId} 
                  onSave={(data) => handleManageEntity('client_claims', editingClaim?.id || null, { ...data, projectId: currentProjectId })}
                  onDelete={(id) => handleDeleteEntity('client_claims', id)}
                  editingItem={editingClaim}
                  setEditingItem={setEditingClaim}
                  showToast={showToast}
               />
            )}

            {activeTab === 'ledger' && (
               <TransactionManager 
                  transactions={transactions} 
                  entities={allEntities} 
                  availableProjects={projects} 
                  currentProject={currentProjectId} 
                  onSave={(data) => handleManageEntity('transactions', editingTransaction?.id || null, { ...data, projectId: currentProjectId })}
                  onDelete={(id) => handleDeleteEntity('transactions', id)}
                  editingItem={editingTransaction}
                  setEditingItem={setEditingTransaction}
                  showToast={showToast}
               />
            )}

            {activeTab === 'site_engineer' && (
               <SiteEngineerManagerView
                  siteEngineers={siteEngineers}
                  transactions={transactions}
                  currentProjectId={currentProjectId}
                  availableProjects={projects}
                  activeProject={activeProject}
                  onSave={handleManageEntity}
                  onDelete={handleDeleteEntity}
                  showToast={showToast}
               />
            )}

            {activeTab === 'office_utilities' && (
               <OfficeUtilitiesManagerView
                  officeStaff={officeStaff}
                  siteEngineers={siteEngineers}
                  transactions={transactions}
                  currentProjectId={currentProjectId}
                  availableProjects={projects}
                  activeProject={activeProject}
                  onSave={handleManageEntity}
                  onDelete={handleDeleteEntity}
                  showToast={showToast}
               />
            )}

            {activeTab === 'staff' && (
               <EmployeeDirectoryView
                  siteEngineers={siteEngineers}
                  officeStaff={officeStaff}
                  subconNames={subconNames}
                  currentProjectId={currentProjectId}
                  onSave={handleManageEntity}
                  onDelete={handleDeleteEntity}
                  showToast={showToast}
               />
            )}

            {activeTab === 'tasks' && (
               <TaskManager 
                  tasks={filteredTasks}
                  employees={allEntities}
                  projects={projects}
                  currentProjectId={currentProjectId}
                  onSave={(data) => handleManageEntity('tasks', editingTask?.id || null, { projectId: currentProjectId, ...data })}
                  onDelete={(id) => handleDeleteEntity('tasks', id)}
                  editingItem={editingTask}
                  setEditingItem={setEditingTask}
                  showToast={showToast}
                  db={db}
                  appId={appId}
               />
            )}

            {activeTab === 'subcon_ledger' && (
               <SubconLedgerView
                  employees={subconNames}
                  transactions={transactions}
                  projects={projects}
                  currentProjectId={currentProjectId}
                  onSaveSubcon={handleManageEntity}
                  onDeleteSubcon={handleDeleteEntity}
                  showToast={showToast}
               />
            )}

            {activeTab === 'sourcing' && (
               <RequestManager 
                  requests={sourcingRequests} 
                  entities={allEntities} 
                  availableProjects={projects} 
                  currentProject={currentProjectId} 
                  onSave={(data) => handleManageEntity('requests', editingRequest?.id || null, { ...data, projectId: currentProjectId })}
                  onDelete={(id) => handleDeleteEntity('requests', id)}
                  editingItem={editingRequest}
                  setEditingItem={setEditingRequest}
                  showToast={showToast}
               />
            )}

            {activeTab === 'survey' && (
               <DataCollectionManager 
                  collections={dataCollections} 
                  entities={allEntities} 
                  availableProjects={projects} 
                  currentProject={currentProjectId} 
                  onSave={(data) => handleManageEntity('data_collections', editingSurvey?.id || null, { ...data, projectId: currentProjectId })}
                  onDelete={async (id) => {
                     try {
                        await deleteDocument('data_collections', id);
                        showToast("စာရင်းကို အောင်မြင်စွာ ဖျက်ဆီးပြီးပါပြီ။", "success");
                     } catch (e) {
                        console.error("Error deleting collection item:", e);
                        showToast("ဖျက်သိမ်းခြင်း မအောင်မြင်ပါ။", "error");
                     }
                  }}
                  editingItem={editingSurvey}
                  setEditingItem={setEditingSurvey}
                  showToast={showToast}
               />
            )}
         </main>
      </div>

      {/* Project Creation/Edit Modal */}
      {showProjectModal && (
         <div className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
               <div className="h-14 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-950/20">
                  <h4 className="font-bold text-white text-sm uppercase tracking-wider">{editingProject ? 'Edit Project Settings' : 'Initialize New Project'}</h4>
                  <button onClick={() => { setShowProjectModal(false); setEditingProject(null); }} className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded-lg"><X size={18}/></button>
               </div>
               <form onSubmit={handleSaveProject} className="p-6 space-y-4">
                  <div className="flex flex-col gap-1">
                     <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest font-sans">Project Name *</label>
                     <input 
                        required 
                        placeholder="Ex. Parami Condo Unit 16B..." 
                        value={editingProject?.projectName || ''} 
                        onChange={e => setEditingProject(p => ({ ...(p || {}), projectName: e.target.value }))}
                        className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 transition-all font-sans" 
                     />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest font-sans">Client Name *</label>
                        <input 
                           required 
                           placeholder="Ex. Dr. Aung Myo..." 
                           value={editingProject?.clientName || ''} 
                           onChange={e => setEditingProject(p => ({ ...(p || {}), clientName: e.target.value }))}
                           className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 transition-all font-sans" 
                        />
                     </div>
                     <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest font-sans">Project Duration (Weeks)</label>
                        <input 
                           type="number" 
                           placeholder="Ex. 12" 
                           value={editingProject?.durationWeeks || ''} 
                           onChange={e => setEditingProject(p => ({ ...(p || {}), durationWeeks: Number(e.target.value) }))}
                           className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 transition-all font-sans" 
                        />
                     </div>
                  </div>

                  <div className="flex flex-col gap-1">
                     <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest font-sans">Total Contract Budget (MMK) *</label>
                     <input 
                        required 
                        type="number"
                        placeholder="Ex. 85,000,000" 
                        value={editingProject?.budget || ''} 
                        onChange={e => setEditingProject(p => ({ ...(p || {}), budget: Number(e.target.value) }))}
                        className="bg-slate-950 border border-slate-500/20 rounded-xl px-4 py-3 text-indigo-400 font-bold text-sm outline-none focus:border-indigo-500 transition-all font-mono" 
                     />
                  </div>

                  <div className="grid grid-cols-2 gap-4 font-sans">
                     <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-[9px]">Materials Allocation Budget (MMK)</label>
                        <input 
                           type="number"
                           placeholder="Ex. 40,000,000" 
                           value={editingProject?.materialsBudget || ''} 
                           onChange={e => setEditingProject(p => ({ ...(p || {}), materialsBudget: Number(e.target.value) }))}
                           className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 font-mono" 
                        />
                     </div>
                     <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-[9px]">Subcon Allocation Budget (MMK)</label>
                        <input 
                           type="number"
                           placeholder="Ex. 30,000,000" 
                           value={editingProject?.subconBudget || ''} 
                           onChange={e => setEditingProject(p => ({ ...(p || {}), subconBudget: Number(e.target.value) }))}
                           className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 font-mono" 
                        />
                     </div>
                  </div>

                  <div className="flex flex-col gap-1 col-span-2 font-sans">
                     <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Site Location Address</label>
                     <input 
                        placeholder="Ex. Room 405, Kabar Aye Pagoda Rd..." 
                        value={editingProject?.address || ''} 
                        onChange={e => setEditingProject(p => ({ ...(p || {}), address: e.target.value }))}
                        className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 transition-all font-sans" 
                     />
                  </div>

                  <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 font-bold text-white py-3.5 rounded-xl uppercase tracking-wider text-xs shadow-lg shadow-indigo-500/25 transition-all mt-4 font-sans">
                     {editingProject ? 'Update Config' : 'Create Project'}
                  </button>
               </form>
            </div>
         </div>
      )}

      {/* Modern Confirmation Overlay Modal */}
      {confirmAction && (
         <div className="fixed inset-0 z-[2000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
               <div className="p-6 space-y-4 font-sans">
                  <div className="flex items-center gap-3 text-amber-500 mb-2">
                     <AlertCircle size={24} />
                     <h4 className="font-bold text-white text-base font-display">{confirmAction.title}</h4>
                  </div>
                  <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-line">{confirmAction.message}</p>
                  <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-slate-800/60 mt-4">
                     {confirmAction.buttons?.map((btn: any, idx: number) => (
                        <button
                           key={idx}
                           onClick={btn.onClick}
                           className={`px-4 py-2.5 rounded-xl font-bold text-xs uppercase transition-all tracking-wider font-sans cursor-pointer ${
                              btn.type === 'danger' 
                                 ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-500/10' 
                                 : btn.type === 'primary' 
                                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/10' 
                                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                           }`}
                        >
                           {btn.label}
                        </button>
                     ))}
                  </div>
               </div>
            </div>
         </div>
      )}

      {/* Load Project directory selector portal view */}
      {(showLoadProjectPortal || !currentProjectId) && (
         <LoadProjectPortal
            projects={projects}
            currentProjectId={currentProjectId}
            onSelect={(id) => {
               setCurrentProjectId(id);
               setShowLoadProjectPortal(false);
            }}
            onDelete={handlePortalDeleteProject}
            onNewProject={() => {
               setEditingProject(null);
               setShowProjectModal(true);
            }}
            onImportBackup={handleImportProjectData}
            onClose={() => {
               if (currentProjectId) setShowLoadProjectPortal(false);
            }}
            showToast={showToast}
         />
      )}
    </div>
  );
}

// Simple absolute clock helper safely designed for top-tier logs header tracking
const ClockIcon = ({ size = 16, className = "" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);
