/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Search, Trash2, Pencil, MapPin, Scan, Loader2, Database, Send, Paperclip,
  Sparkles, Upload, Download, CheckCircle2, AlertCircle, X, GitMerge, Store, Briefcase
} from 'lucide-react';
import { DataCollection, Employee, Project } from '../types';
import { bulkDeleteDocuments } from '../lib/db';

interface DataCollectionManagerProps {
  collections: DataCollection[];
  entities: Employee[];
  availableProjects: Project[];
  currentProject: string | null;
  onSave: (data: any) => void;
  onDelete: (id: string) => void;
  editingItem: any;
  setEditingItem: (item: any) => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export const DataCollectionManager: React.FC<DataCollectionManagerProps> = ({
  collections,
  entities,
  availableProjects,
  currentProject,
  onSave,
  onDelete,
  editingItem,
  setEditingItem,
  showToast
}) => {
  // Types defined by type: 'subcon_price' | 'material_price' | 'shop' | 'office_material'
  const [activeSubTab, setActiveSubTab] = useState<'subcon_price' | 'material_price' | 'shop' | 'office_material'>('subcon_price');
  const [officeIoType, setOfficeIoType] = useState<'in' | 'out'>('in');
  const [qtyInput, setQtyInput] = useState('');
  
  // Search query
  const [search, setSearch] = useState('');

  // AI Scanner and merge modal states
  const [isScanning, setIsScanning] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeSuggestions, setMergeSuggestions] = useState<any[]>([]);

  // Custom confirmation modal state replacing window.confirm
  const [localConfirm, setLocalConfirm] = useState<{
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
  } | null>(null);

  // Input file references
  const fileInputRefForScan = useRef<HTMLInputElement>(null);
  const fileImportRef = useRef<HTMLInputElement>(null);

  // Layout form data structure matching types.ts
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    unit: '',
    remark: '',
    phone: '',
    address: '',
    stockIn: '',
    stockOut: '',
    issuedBy: '',
    receivedBy: '',
    date: new Date().toISOString().split('T')[0]
  });

  // Numeric keyboard formatter
  const formatMoney = (val: any) => {
    if (val === undefined || val === null || val === '') return '';
    const clean = String(val).replace(/,/g, '');
    return Number(clean).toLocaleString('en-US');
  };

  const parseMoney = (val: any) => {
    return String(val).replace(/,/g, '');
  };

  // Reset form when subtab changes
  useEffect(() => {
    resetForm();
    setEditingItem(null);
  }, [activeSubTab]);

  // Sync edit mode
  useEffect(() => {
    if (editingItem) {
      const editType = editingItem.type || 'subcon_price';
      setActiveSubTab(editType);
      if (editType === 'office_material') {
        const isIn = (editingItem.stockIn || 0) > 0 || (editingItem.stockOut || 0) === 0;
        setOfficeIoType(isIn ? 'in' : 'out');
        const qtyVal = String(isIn ? (editingItem.stockIn || '') : (editingItem.stockOut || ''));
        setQtyInput(qtyVal);
      }
      setFormData({
        name: editingItem.name || '',
        price: editingItem.price !== undefined ? String(editingItem.price) : '',
        unit: editingItem.unit || '',
        remark: editingItem.remark || '',
        phone: editingItem.phone || '',
        address: editingItem.address || '',
        stockIn: editingItem.stockIn !== undefined ? String(editingItem.stockIn) : '',
        stockOut: editingItem.stockOut !== undefined ? String(editingItem.stockOut) : '',
        issuedBy: editingItem.issuedBy || '',
        receivedBy: editingItem.receivedBy || '',
        date: editingItem.date || new Date().toISOString().split('T')[0]
      });
    } else {
      resetForm();
    }
  }, [editingItem]);

  const resetForm = () => {
    setQtyInput('');
    setFormData({
      name: '',
      price: '',
      unit: '',
      remark: '',
      phone: '',
      address: '',
      stockIn: '',
      stockOut: '',
      issuedBy: '',
      receivedBy: '',
      date: new Date().toISOString().split('T')[0]
    });
  };

  // Save submit form
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      showToast("ကျေးဇူးပြု၍ အမည် ဖြည့်သွင်းပေးပါရန်", "error");
      return;
    }

    const priceNum = (activeSubTab === 'subcon_price' || activeSubTab === 'material_price') 
      ? (Number(parseMoney(formData.price)) || 0) 
      : 0;

    let stockInNum = 0;
    let stockOutNum = 0;

    if (activeSubTab === 'office_material') {
      const qtyNum = Number(parseMoney(qtyInput)) || 0;
      stockInNum = officeIoType === 'in' ? qtyNum : 0;
      stockOutNum = officeIoType === 'out' ? qtyNum : 0;
    }

    const payload = {
      type: activeSubTab,
      name: formData.name.trim(),
      price: priceNum,
      unit: formData.unit.trim(),
      remark: formData.remark.trim(),
      phone: activeSubTab === 'shop' ? formData.phone.trim() : '',
      address: activeSubTab === 'shop' ? formData.address.trim() : '',
      stockIn: stockInNum,
      stockOut: stockOutNum,
      issuedBy: activeSubTab === 'office_material' ? (formData.issuedBy || '').trim() : '',
      receivedBy: activeSubTab === 'office_material' ? (formData.receivedBy || '').trim() : '',
      date: formData.date,
      projectId: currentProject || 'global'
    };

    onSave(payload);
    resetForm();
    setEditingItem(null);
  };

  // Main collections filtered by active tab type across global space
  const filteredCollections = useMemo(() => {
    return collections.filter(c => {
      // old survey fallback -> default as subcon_price
      const type = c.type || 'subcon_price';
      return type === activeSubTab;
    });
  }, [collections, activeSubTab]);

  // Search filter
  const searchedCollections = useMemo(() => {
    const getSortableValue = (item: any) => {
      const val = item.timestamp || item.updatedAt || item.date || '';
      if (val && typeof val === 'object' && val.seconds !== undefined) {
        return new Date(val.seconds * 1000).toISOString();
      }
      if (typeof val === 'string') return val;
      if (val instanceof Date) return val.toISOString();
      return String(val || '');
    };

    let sorted = [...filteredCollections].sort((a, b) => {
      const valA = getSortableValue(a);
      const valB = getSortableValue(b);
      return valB.localeCompare(valA);
    });

    if (search) {
      const lower = search.toLowerCase();
      sorted = sorted.filter(c => 
        (c.name || '').toLowerCase().includes(lower) ||
        (c.remark || '').toLowerCase().includes(lower) ||
        (c.phone || '').toLowerCase().includes(lower) ||
        (c.address || '').toLowerCase().includes(lower) ||
        (c.unit || '').toLowerCase().includes(lower)
      );
    }
    return sorted;
  }, [filteredCollections, search]);

  // SCAN DATA auto-extract
  const handleScanDataFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    showToast("Gemini AI OCR ဖြင့် ဓာတ်ပုံ အချက်အလက်များကို ခွဲခြမ်းစိတ်ဖြာနေပါသည်...", "success");

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => {
          const raw = reader.result as string;
          resolve(raw.split(',')[1]);
        };
        reader.readAsDataURL(file);
      });

      const base64Data = await base64Promise;

      const triggerOCR = await fetch('/api/gemini/scan-doc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileData: base64Data,
          mimeType: file.type || "image/jpeg",
          prompt: `You are scanning a document / image to extract information for database catalog tab: "${activeSubTab}".
If active tab is "subcon_price" or "material_price":
Extract standard item details: Name of item/service, Unit price, Unit of measurement, and Remark.
If active tab is "shop":
Extract: Shop/Supplier Name, Phone Number, Address, and brief products catalog.
If active tab is "office_material":
Extract: Item Name, Stock quantity, Unit count.

Return ONLY a valid JSON object matching this schema. Do not enclose in backticks or Markdown.
Schema:
{
  "name": "Extracted item or shop name",
  "price": 15000,
  "unit": "sqft / pcs / box",
  "remark": "Short extracted note",
  "phone": "extracted phone",
  "address": "extracted location",
  "stockIn": 10
}`
        })
      });

      const parsedText = await triggerOCR.json();
      let extracted: any = {};
      try {
        const cleanJsonText = parsedText.text.replace(/```json/gi, '').replace(/```/g, '').trim();
        extracted = JSON.parse(cleanJsonText);
      } catch {
        extracted = {};
      }

      if (extracted.name) {
        setFormData({
          name: extracted.name || '',
          price: extracted.price ? String(extracted.price) : '',
          unit: extracted.unit || '',
          remark: extracted.remark || 'Scanned data',
          phone: extracted.phone || '',
          address: extracted.address || '',
          stockIn: extracted.stockIn ? String(extracted.stockIn) : '',
          stockOut: '',
          date: new Date().toISOString().split('T')[0]
        });
        showToast("Gemini ဖြင့် ဒေတာများ အောင်မြင်စွာဖတ်ယူပြီးပါပြီ။", "success");
      } else {
        showToast("အချက်အလက်များကို ကောင်းစွာမဖတ်ရှုနိုင်ပါ။ ကျေးဇူးပြု၍ ကိုယ်တိုင်ဖြည့်စွက်ပါ", "error");
      }
    } catch {
      showToast("Scan ဖတ်ယူမှု အဆင်မပြေပါ။", "error");
    } finally {
      setIsScanning(false);
      if (fileInputRefForScan.current) fileInputRefForScan.current.value = '';
    }
  };

  // Pure JS Deduplication & Duplicates Merge suggestions
  const handleMergeSuggestions = () => {
    setShowMergeModal(true);
    
    // Find duplicate groups immediately using pure programming logic:
    // 1. Normalization: lowercase, remove all white spaces, hyphens, and underscores.
    // 2. Grouping: match normalized names exactly.
    // 3. Choice: present groups with count > 1.
    const groups: { [key: string]: any[] } = {};
    filteredCollections.forEach(it => {
      const norm = (it.name || '').toLowerCase().replace(/[\s\-_]/g, '');
      if (!norm) return;
      if (!groups[norm]) {
        groups[norm] = [];
      }
      groups[norm].push(it);
    });

    const suggestions = Object.keys(groups)
      .filter(key => groups[key].length > 1)
      .map(key => ({
        normalizedName: key,
        items: groups[key]
      }));

    setMergeSuggestions(suggestions);
    if (suggestions.length === 0) {
      showToast("ဆင်တူနေသော စာရင်းများ မရှိပါ။ ဒေတာသန့်ရှင်းစင်ကြယ်ပါသည်", "success");
    } else {
      showToast("ဆင်တူနေသော စာရင်းများကို ရှာဖွေတွေ့ရှိပါသည်။", "success");
    }
  };

  // Keep one item and delete other duplicates in that group
  const handleKeepAndDeduplicate = async (groupIndex: number, keepItem: any, allItemsInGroup: any[]) => {
    setLocalConfirm({
      title: "ပေါင်းစည်း၍ ဆင်တူများဖျက်ရန် သေချာပါသလား?",
      message: `"${keepItem.name}" ကိုသာ ချန်လှပ်ပြီး ကျန်ဆင်တူနေသော စာရင်းများ (${allItemsInGroup.length - 1} ခု) ကို ဖျက်ရန် သေချာပါသလား?`,
      onConfirm: async () => {
        showToast("ဒေတာပေါင်းစည်းပြီး ဆင်တူများကို ဖျက်နေပါသည်...", "success");
        try {
          const idsToDelete = allItemsInGroup
            .filter(item => item.id !== keepItem.id)
            .map(item => item.id);
          
          await bulkDeleteDocuments('data_collections', idsToDelete);
          showToast("ဆင်တူနေသော ဒေတာများကို ပေါင်းစည်းပြီး ဖျက်ဆီးပြီးပါပြီ။", "success");
          
          // Re-calculate suggestions in real-time
          setMergeSuggestions(prev => {
            const updated = prev.map((g, idx) => {
              if (idx === groupIndex) {
                return {
                  ...g,
                  items: [keepItem] // only the kept one is left
                };
              }
              return g;
            }).filter(g => g.items.length > 1); // remove group if it no longer has duplicates
            return updated;
          });
        } catch (err) {
          console.error("Deduplication error:", err);
          showToast("ပေါင်းစည်းခြင်း မအောင်မြင်ပါ။", "error");
        }
      }
    });
  };

  // Bulk CSV / XLSX Import
  const handleImportCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
          showToast("ဝင်လာသောဖိုင်တွင် ဒေတာအလုံအလောက်မရှိပါ။", "error");
          return;
        }

        showToast("ဒေတာများကို ကူးယူထည့်သွင်းနေပါသည်...", "success");

        for (let i = 1; i < rows.length; i++) {
          const cols = rows[i];
          if (!cols || cols.length < 1) continue;
          
          let name = "";
          let price = 0;
          let unit = "";
          let remark = "";
          let phone = "";
          let address = "";
          let stockIn = 0;
          let stockOut = 0;
          let issuedBy = "";
          let receivedBy = "";
          let importDate = new Date().toISOString().split('T')[0];

          if (activeSubTab === 'shop') {
            name = String(cols[0] || '').trim();
            if (!name) continue;
            phone = String(cols[1] || '').trim();
            address = String(cols[2] || '').trim();
            remark = String(cols[3] || '').trim();
          } else if (activeSubTab === 'office_material') {
            // Excel Columns for Office Material:
            // Column A (0): Date
            // Column B (1): Item Name
            // Column C (2): Type ("Stock In" / "Stock Out")
            // Column D (3): Qty
            // Column E (4): Depositor (Giver)
            // Column F (5): Receiver
            // Column G (6): Remark
            const rawDate = String(cols[0] || '').trim();
            if (rawDate) {
              importDate = rawDate;
            }
            name = String(cols[1] || '').trim();
            if (!name) continue;

            const typeRaw = String(cols[2] || '').trim().toLowerCase();
            const qty = Number(String(cols[3] || '').replace(/,/g, '')) || 0;

            if (typeRaw.includes('out') || typeRaw.includes('ထုတ်')) {
              stockOut = qty;
            } else {
              stockIn = qty;
            }

            issuedBy = String(cols[4] || '').trim();
            receivedBy = String(cols[5] || '').trim();
            remark = String(cols[6] || '').trim();
          } else {
            name = String(cols[0] || '').trim();
            if (!name) continue;

            // Smarter price and unit extraction
            const priceStrRaw = String(cols[1] || '');
            // Strip out thousands separator commas: e.g. "1,460,000" or "-1,460,000" -> "-1460000"
            const cleanedPriceStr = priceStrRaw.replace(/,/g, '').trim();

            // Match negative or positive integer/decimal number: e.g. -1460000 or 8500
            const numberMatch = cleanedPriceStr.match(/(-?\d+(?:\.\d+)?)/);
            price = numberMatch ? Number(numberMatch[1]) : 0;

            // Smart unit extraction
            unit = String(cols[2] || '').trim();
            if (!unit && numberMatch) {
              const restStr = cleanedPriceStr.replace(numberMatch[1], '').trim();
              if (restStr) {
                unit = restStr;
              }
            }

            remark = String(cols[3] || '').trim();
            phone = String(cols[4] || '').trim();
            address = String(cols[5] || '').trim();
            stockIn = cols[6] ? (Number(String(cols[6]).replace(/,/g, '')) || 0) : 0;
            stockOut = cols[7] ? (Number(String(cols[7]).replace(/,/g, '')) || 0) : 0;
          }

          await onSave({
            type: activeSubTab,
            name,
            price,
            unit,
            remark,
            phone,
            address,
            stockIn,
            stockOut,
            issuedBy,
            receivedBy,
            date: importDate,
            projectId: currentProject || 'global'
          });
        }
        showToast("ဖိုင်တွဲထည့်သွင်းခြင်း အောင်မြင်ပါသည်။", "success");
      } catch (err) {
        console.error("Import error:", err);
        showToast("ဖိုင်ဖတ်ရှုမှု အမှားအယွင်းရှိပါသည်။", "error");
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  // Bulk Delete active sub tab records
  const handleDeleteAll = () => {
    const count = filteredCollections.length;
    if (count === 0) return;

    const label = getTabLabel(activeSubTab);

    setLocalConfirm({
      title: "စာရင်းအားလုံးဖျက်ရန် သေချာပါသလား?",
      message: `လက်ရှိ "${label}" tab ထဲရှိ စာရင်းအားလုံး (${count} ခု) ကို ဖျက်ရန် သေချာပါသလား?\n\nဤလုပ်ဆောင်ချက်သည် စာရင်းအားလုံးဆီသို့ အကျိုးသက်ရောက်ပြီး ပြန်ဖျက်၍မရနိုင်ပါ။`,
      onConfirm: async () => {
        showToast("စာရင်းအားလုံးကို ဖျက်ဆီးနေပါသည်...", "success");
        try {
          await bulkDeleteDocuments('data_collections', filteredCollections.map(c => c.id));
          showToast("စာရင်းအားလုံးကို အောင်မြင်စွာ ဖျက်ဆီးပြီးပါပြီ။", "success");
        } catch (err) {
          console.error("Bulk delete error:", err);
          showToast("ဖျက်သိမ်းခြင်း မအောင်မြင်ပါ။", "error");
        }
      }
    });
  };

  // Excel Export utility (.xlsx only)
  const handleExportCsv = () => {
    if (searchedCollections.length === 0) {
      showToast("ဒေတာအစုအဝေးမရှိသေးပါ", "error");
      return;
    }

    const XLSX = (window as any).XLSX;
    if (!XLSX) {
      showToast("Excel exporter is currently offline.", "error");
      return;
    }

    let headers: string[] = [];
    let rows: any[] = [];

    if (activeSubTab === 'subcon_price' || activeSubTab === 'material_price') {
      headers = ["Item Name", "Price Rate", "Unit", "Remark"];
      rows = searchedCollections.map(c => [c.name, c.price || 0, c.unit || '', c.remark || '']);
    } else if (activeSubTab === 'shop') {
      headers = ["Shop Name", "Phone", "Address", "Note/Items"];
      rows = searchedCollections.map(c => [c.name, c.phone || '', c.address || '', c.remark || '']);
    } else if (activeSubTab === 'office_material') {
      // Mapped columns for office materials export
      headers = ["Date", "Item Name", "Type", "Qty", "Giver/Depositor", "Receiver", "Remark"];
      rows = searchedCollections.map(c => {
        const isStockIn = (c.stockIn || 0) > 0 || (c.stockOut || 0) === 0;
        const typeStr = isStockIn ? "Stock In" : "Stock Out";
        const qtyVal = isStockIn ? (c.stockIn || 0) : (c.stockOut || 0);
        return [
          c.date || '',
          c.name,
          typeStr,
          qtyVal,
          c.issuedBy || '',
          c.receivedBy || '',
          c.remark || ''
        ];
      });
    } else {
      headers = ["Item Name", "Stock In", "Stock Out", "Unit", "Remark"];
      rows = searchedCollections.map(c => [c.name, c.stockIn || 0, c.stockOut || 0, c.unit || '', c.remark || '']);
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    XLSX.utils.book_append_sheet(wb, ws, `${activeSubTab.toUpperCase()}`);
    XLSX.writeFile(wb, `DataCollection_${activeSubTab}_Export.xlsx`);
    showToast("Excel (.xlsx) ဖိုင်အဖြစ် အောင်မြင်စွာ ထုတ်ယူပြီးပါပြီ။", "success");
  };

  const getTabLabel = (tabType: string) => {
    switch (tabType) {
      case 'subcon_price': return 'Subcon Prices';
      case 'material_price': return 'Material Prices';
      case 'shop': return 'Shop Directory';
      case 'office_material': return 'Office Materials';
      default: return 'Data';
    }
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Header Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <h2 className="text-xl font-black text-white uppercase tracking-tight">Data Collection</h2>
          <p className="text-xs text-slate-500 mt-1 font-sans">
            Global View • Prices &amp; Directories
          </p>
        </div>
      </div>

      {/* 2. Top Large Navigation Pills */}
      <div className="bg-[#111c2a]/40 border border-slate-800 p-2 rounded-2xl flex flex-wrap gap-1.5 shadow-md">
        {(['subcon_price', 'material_price', 'shop', 'office_material'] as const).map(tab => {
          const isActive = activeSubTab === tab;
          return (
            <button
              key={tab}
              onClick={() => {
                setActiveSubTab(tab);
                setEditingItem(null);
                resetForm();
              }}
              className={`flex-1 min-w-[130px] font-black text-xs uppercase tracking-wider py-3.5 px-4 rounded-xl text-center select-none cursor-pointer transition-all duration-200 ${
                isActive 
                  ? 'bg-indigo-600 border border-indigo-500/30 text-white shadow-lg shadow-indigo-600/20' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/20 border border-transparent'
              }`}
            >
              {getTabLabel(tab)}
            </button>
          );
        })}
      </div>

      {/* 3. ADD NEW FORM Container */}
      <div className="bg-[#111c2a]/40 border border-slate-800/80 p-6 rounded-2xl shadow-lg relative overflow-hidden">
        
        {/* Loading Overlay */}
        {isScanning && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-30 flex flex-col items-center justify-center text-indigo-400">
            <Loader2 size={36} className="animate-spin mb-3 text-emerald-400" />
            <p className="font-extrabold text-xs tracking-widest uppercase text-slate-300">Evaluating receipts with Gemini AI...</p>
          </div>
        )}

        <div className="flex items-center justify-between border-b border-slate-800/50 pb-3 mb-4 flex-wrap gap-2">
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {editingItem ? 'EDIT REGISTER (ပြင်ဆင်ရန်)' : `ADD NEW ${getTabLabel(activeSubTab).toUpperCase()}`}
          </h4>

          {/* SCAN DATA button */}
          <div className="flex items-center gap-2">
            <input 
              type="file" 
              ref={fileInputRefForScan} 
              onChange={handleScanDataFile} 
              accept="image/*,application/pdf" 
              className="hidden" 
            />
            <button 
              type="button" 
              onClick={() => fileInputRefForScan.current?.click()}
              className="border border-emerald-500/30 text-emerald-400 bg-emerald-950/15 hover:bg-emerald-950/35 px-4.5 py-2.5 rounded-xl text-[10px] font-sans font-black uppercase tracking-widest flex items-center gap-1.5 transition-all select-none active:scale-95 cursor-pointer"
            >
              <Scan size={14} className="text-emerald-400" />
              Scan Data
            </button>
            {editingItem && (
              <button 
                type="button" 
                onClick={() => {
                  setEditingItem(null);
                  resetForm();
                }} 
                className="text-xs text-rose-500 font-bold hover:underline py-1 px-2 hover:bg-rose-950/20 rounded-lg"
              >
                Cancel
              </button>
            )}
          </div>
        </div>

        {/* Dynamic Inputs Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {(activeSubTab === 'subcon_price' || activeSubTab === 'material_price') && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="flex flex-col gap-1 md:col-span-2">
                  <input 
                    type="text"
                    required
                    placeholder="Item Name (အမည်)*"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="bg-slate-950/80 border border-slate-850 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-indigo-500 h-11 w-full placeholder-slate-500"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <input 
                    type="text"
                    required
                    placeholder="Price Rate (Unit Price)*"
                    value={formatMoney(formData.price)}
                    onChange={e => {
                      const raw = parseMoney(e.target.value);
                      if (/^\d*$/.test(raw)) setFormData({ ...formData, price: raw });
                    }}
                    className="bg-slate-950/80 border border-slate-850 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-indigo-500 font-mono text-right h-11 w-full placeholder-slate-500"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <input 
                    type="text"
                    placeholder="Unit (e.g. sqft, pcs)"
                    value={formData.unit}
                    onChange={e => setFormData({ ...formData, unit: e.target.value })}
                    className="bg-slate-950/80 border border-slate-850 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-indigo-500 h-11 w-full placeholder-slate-500"
                  />
                </div>
              </div>

              {/* Row 2 Fields */}
              <div className="flex flex-col md:flex-row gap-3 items-end">
                <div className="flex-1 w-full">
                  <input 
                    type="text"
                    placeholder="Remark (မှတ်ချက် - မထည့်လည်းရသည်)"
                    value={formData.remark}
                    onChange={e => setFormData({ ...formData, remark: e.target.value })}
                    className="bg-slate-950/80 border border-slate-850 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-indigo-500 h-11 w-full placeholder-slate-500"
                  />
                </div>
                
                <button 
                  type="submit"
                  className="w-full md:w-36 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs h-11 rounded-xl uppercase tracking-widest cursor-pointer transition-all flex items-center justify-center select-none shadow-md shadow-emerald-950/30"
                >
                  Save
                </button>
              </div>
            </>
          )}

          {activeSubTab === 'shop' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex flex-col gap-1">
                  <input 
                    type="text"
                    required
                    placeholder="Shop/Supplier Name (အမည်)*"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="bg-slate-950/80 border border-slate-850 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-indigo-500 h-11 w-full placeholder-slate-500"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <input 
                    type="text"
                    placeholder="Phone Number (ဖုန်းနံပါတ်)"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className="bg-slate-950/80 border border-slate-850 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-indigo-500 h-11 w-full placeholder-slate-500"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <input 
                    type="text"
                    placeholder="Address/Location (လိပ်စာ)"
                    value={formData.address}
                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                    className="bg-slate-950/80 border border-slate-850 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-indigo-500 h-11 w-full placeholder-slate-500"
                  />
                </div>
              </div>

              {/* Row 2 Fields */}
              <div className="flex flex-col md:flex-row gap-3 items-end">
                <div className="flex-1 w-full">
                  <input 
                    type="text"
                    placeholder="Remark (မှတ်ချက် - မထည့်လည်းရသည်)"
                    value={formData.remark}
                    onChange={e => setFormData({ ...formData, remark: e.target.value })}
                    className="bg-slate-950/80 border border-slate-850 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-indigo-500 h-11 w-full placeholder-slate-500"
                  />
                </div>
                
                <button 
                  type="submit"
                  className="w-full md:w-36 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs h-11 rounded-xl uppercase tracking-widest cursor-pointer transition-all flex items-center justify-center select-none shadow-md shadow-emerald-950/30"
                >
                  Save
                </button>
              </div>
            </>
          )}

          {activeSubTab === 'office_material' && (
            <div className="space-y-4">
              {/* Row 1: IO Radios */}
              <div className="bg-slate-950/80 border border-slate-850 rounded-xl px-4 py-3 flex items-center gap-6 h-11 w-full md:w-max">
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-emerald-400">
                  <input 
                    type="radio" 
                    name="officeIoType" 
                    checked={officeIoType === 'in'} 
                    onChange={() => setOfficeIoType('in')} 
                    className="w-3.5 h-3.5 accent-emerald-500 cursor-pointer"
                  />
                  မပစ္စည်းသွင်းမည် (Stock In)
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-rose-400">
                  <input 
                    type="radio" 
                    name="officeIoType" 
                    checked={officeIoType === 'out'} 
                    onChange={() => setOfficeIoType('out')} 
                    className="w-3.5 h-3.5 accent-rose-500 cursor-pointer"
                  />
                  ပစ္စည်းထုတ်မည် (Stock Out)
                </label>
              </div>

              {/* Row 2: Date, Item Name, Quantity */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="flex flex-col gap-1 md:col-span-3">
                  <input 
                    type="date"
                    required
                    value={formData.date}
                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                    className="bg-slate-950/80 border border-slate-850 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-indigo-500 h-11 w-full placeholder-slate-500 font-mono"
                  />
                </div>
                <div className="flex flex-col gap-1 md:col-span-6">
                  <input 
                    type="text"
                    required
                    placeholder="Item Name (အမည်)*"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="bg-slate-950/80 border border-slate-850 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-indigo-500 h-11 w-full placeholder-slate-500"
                  />
                </div>
                <div className="flex flex-col gap-1 md:col-span-3">
                  <input 
                    type="text"
                    required
                    placeholder="အရေအတွက် (Qty)*"
                    value={formatMoney(qtyInput)}
                    onChange={e => {
                      const raw = parseMoney(e.target.value);
                      if (/^\d*$/.test(raw)) setQtyInput(raw);
                    }}
                    className="bg-slate-950/80 border border-slate-850 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-indigo-500 font-mono text-right h-11 w-full placeholder-slate-500"
                  />
                </div>
              </div>

              {/* Row 3: Depositor (Giver), Receiver */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <input 
                    type="text"
                    required
                    placeholder="အပ်နှံသူ (Depositor)*"
                    value={formData.issuedBy}
                    onChange={e => setFormData({ ...formData, issuedBy: e.target.value })}
                    className="bg-slate-950/80 border border-slate-850 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-indigo-500 h-11 w-full placeholder-slate-500"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <input 
                    type="text"
                    required
                    placeholder="လက်ခံသူ (Receiver)*"
                    value={formData.receivedBy}
                    onChange={e => setFormData({ ...formData, receivedBy: e.target.value })}
                    className="bg-slate-950/80 border border-slate-850 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-indigo-500 h-11 w-full placeholder-slate-500"
                  />
                </div>
              </div>

              {/* Row 4: Remark */}
              <div className="flex flex-col gap-1">
                <input 
                  type="text"
                  placeholder="Remark (မှတ်ချက် - မထည့်လည်းရသည်)"
                  value={formData.remark}
                  onChange={e => setFormData({ ...formData, remark: e.target.value })}
                  className="bg-slate-950/80 border border-slate-850 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-indigo-500 h-11 w-full placeholder-slate-500"
                />
              </div>

              {/* Row 5: Save Block */}
              <div className="flex justify-start">
                <button 
                  type="submit"
                  className="w-full md:w-48 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs h-11 rounded-xl uppercase tracking-widest cursor-pointer transition-all flex items-center justify-center select-none shadow-md shadow-emerald-950/30"
                >
                  SAVE
                </button>
              </div>
            </div>
          )}

        </form>
      </div>

      {/* 4. Controls / Search & Actions bar */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={15}/>
          <input 
            placeholder="Search by name, note..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-[#111c2a]/40 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-200 outline-none focus:border-indigo-500"
          />
        </div>

        {/* Action Group */}
        <div className="flex items-center gap-2.5 w-full md:w-auto flex-wrap justify-end">
          
          <button 
            type="button" 
            onClick={handleMergeSuggestions}
            className="bg-indigo-950/40 hover:bg-indigo-900 border border-indigo-550/30 text-indigo-300 font-sans font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all select-none active:scale-95 cursor-pointer"
          >
            <GitMerge size={13} className="text-indigo-400" />
            Merge Data
          </button>

          <input 
            type="file" 
            ref={fileImportRef} 
            onChange={handleImportCsv} 
            accept=".xlsx, .xls, .csv" 
            className="hidden" 
          />
          <button 
            type="button" 
            onClick={() => fileImportRef.current?.click()}
            className="bg-[#121f2f]/60 hover:bg-[#1b2f47] border border-blue-900/30 text-[#3ba2f8] font-sans font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all select-none active:scale-95 cursor-pointer"
          >
            <Upload size={13} />
            Bulk Import
          </button>

          <button 
            type="button" 
            onClick={handleExportCsv}
            className="bg-emerald-950/20 hover:bg-emerald-950/40 border border-emerald-900/30 text-emerald-400 font-sans font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all select-none active:scale-95 cursor-pointer"
          >
            <Download size={13} />
            Export
          </button>

          {filteredCollections.length > 0 && (
            <button 
              type="button" 
              onClick={handleDeleteAll}
              className="bg-rose-950/40 hover:bg-rose-900 border border-rose-800/80 text-rose-400 hover:text-rose-200 font-sans font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all select-none active:scale-95 cursor-pointer"
              title="လက်ရှိ tab မှ စာရင်းအားလုံး ဖျက်သွင်းရန်"
            >
              <Trash2 size={13} className="text-rose-400" />
              စာရင်းအားလုံးဖျက်မည် ({filteredCollections.length})
            </button>
          )}

        </div>
      </div>

      {/* 5. Main Content Records Table */}
      <div className="bg-slate-950/40 border border-slate-850 rounded-2xl overflow-x-auto overflow-y-auto max-h-[650px] shadow-lg custom-scrollbar">
        {activeSubTab === 'subcon_price' || activeSubTab === 'material_price' ? (
          <table className="w-full text-left border-collapse font-sans">
            <thead>
              <tr className="bg-slate-950 text-[10px] uppercase font-black tracking-wider text-slate-500">
                <th className="sticky top-0 bg-slate-950 z-20 border-b border-slate-850 px-5 py-3 w-12 text-center font-sans">NO.</th>
                <th className="sticky top-0 bg-slate-950 z-20 border-b border-slate-850 px-5 py-3 font-sans">ITEM NAME</th>
                <th className="sticky top-0 bg-slate-950 z-20 border-b border-slate-850 px-5 py-3 text-right font-sans">PRICE RATE (UNIT PRICE)</th>
                <th className="sticky top-0 bg-slate-950 z-20 border-b border-slate-850 px-5 py-3 text-center w-24 font-sans">ACTION</th>
                <th className="sticky top-0 bg-slate-950 z-20 border-b border-slate-850 px-5 py-3 text-left font-sans">REMARK</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {searchedCollections.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-500 italic text-xs font-sans">
                    မှတ်တမ်းတင်ထားသော စာရင်းများမရှိသေးပါ။
                  </td>
                </tr>
              ) : (
                searchedCollections.map((c, idx) => (
                  <tr key={c.id} className="hover:bg-slate-900/10 text-xs">
                    <td className="px-5 py-4 text-center font-mono text-slate-400">{idx + 1}</td>
                    <td className="px-5 py-4 font-bold text-slate-200 text-sm">{c.name}</td>
                    <td className="px-5 py-4 text-right font-mono text-[#3cd69b] font-bold text-sm">
                      {c.price !== undefined ? c.price.toLocaleString('en-US') : '0'} / - {c.unit && <span className="text-[10px] text-slate-500 uppercase font-sans font-light">({c.unit})</span>}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button 
                          onClick={() => setEditingItem(c)} 
                          className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-indigo-500 text-slate-400 hover:text-white rounded-lg transition-all cursor-pointer"
                        >
                          <Pencil size={12}/>
                        </button>
                        <button 
                          onClick={() => {
                            setLocalConfirm({
                              title: "ဖျက်ရန် သေချာပါသလား?",
                              message: `"${c.name}" စာရင်းကို အပြီးတိုင် ဖျက်ရန် သေချာပါသလား?`,
                              onConfirm: () => onDelete(c.id)
                            });
                          }} 
                          className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-rose-500 text-slate-400 hover:text-rose-500 rounded-lg transition-all cursor-pointer"
                        >
                          <Trash2 size={12}/>
                        </button>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-400 text-xs text-left font-sans select-all">{c.remark || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : activeSubTab === 'shop' ? (
          <table className="w-full text-left border-collapse font-sans">
            <thead>
              <tr className="bg-slate-950 text-[10px] uppercase font-black tracking-wider text-slate-500">
                <th className="sticky top-0 bg-slate-950 z-20 border-b border-slate-850 px-5 py-3 w-12 text-center font-sans">NO.</th>
                <th className="sticky top-0 bg-slate-950 z-20 border-b border-slate-850 px-5 py-3 font-sans">SHOP NAME</th>
                <th className="sticky top-0 bg-slate-950 z-20 border-b border-slate-850 px-5 py-3 font-sans">CONTACT DETAILS</th>
                <th className="sticky top-0 bg-slate-950 z-20 border-b border-slate-850 px-5 py-3 text-center w-24 font-sans">ACTION</th>
                <th className="sticky top-0 bg-slate-950 z-20 border-b border-slate-850 px-5 py-3 text-left font-sans">REMARK</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {searchedCollections.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-500 italic text-xs font-sans">
                    မှတ်တမ်းတင်ထားသော စာရင်းများမရှိသေးပါ။
                  </td>
                </tr>
              ) : (
                searchedCollections.map((c, idx) => (
                  <tr key={c.id} className="hover:bg-slate-900/10 text-xs">
                    <td className="px-5 py-4 text-center font-mono text-slate-400">{idx + 1}</td>
                    <td className="px-5 py-4 font-bold text-slate-200 text-sm select-all">
                      <div className="flex items-center gap-2">
                        <Store size={14} className="text-indigo-400 flex-shrink-0" />
                        {c.name}
                      </div>
                    </td>
                    <td className="px-5 py-4 space-y-1 select-all font-sans">
                      {c.phone && <p className="text-slate-300 font-mono text-xs font-bold">📞 {c.phone}</p>}
                      {c.address && <p className="text-slate-400 italic text-[11px]">📍 {c.address}</p>}
                      {!c.phone && !c.address && <p className="text-slate-500 italic font-sans">-</p>}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button 
                          onClick={() => setEditingItem(c)} 
                          className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-indigo-500 text-slate-400 hover:text-white rounded-lg transition-all cursor-pointer"
                        >
                          <Pencil size={12}/>
                        </button>
                        <button 
                          onClick={() => {
                            setLocalConfirm({
                              title: "ဖျက်ရန် သေချာပါသလား?",
                              message: `"${c.name}" စာရင်းကို အပြီးတိုင် ဖျက်ရန် သေချာပါသလား?`,
                              onConfirm: () => onDelete(c.id)
                            });
                          }} 
                          className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-rose-500 text-slate-400 hover:text-rose-500 rounded-lg transition-all cursor-pointer"
                        >
                          <Trash2 size={12}/>
                        </button>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-400 text-xs text-left font-sans select-all">{c.remark || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : activeSubTab === 'office_material' ? (
          <table className="w-full text-left border-collapse font-sans min-w-[1000px]">
            <thead>
              <tr className="bg-slate-950 text-[10px] uppercase font-black tracking-wider text-slate-500">
                <th className="sticky top-0 bg-slate-950 z-20 border-b border-slate-850 px-4 py-3 w-12 text-center font-sans">NO.</th>
                <th className="sticky top-0 bg-slate-950 z-20 border-b border-slate-850 px-4 py-3 font-sans">DATE</th>
                <th className="sticky top-0 bg-slate-950 z-20 border-b border-slate-850 px-4 py-3 font-sans">ITEM NAME</th>
                <th className="sticky top-0 bg-slate-950 z-20 border-b border-slate-850 px-4 py-3 text-center font-sans">TYPE</th>
                <th className="sticky top-0 bg-slate-950 z-20 border-b border-slate-850 px-4 py-3 text-center font-sans">QTY</th>
                <th className="sticky top-0 bg-slate-950 z-20 border-b border-slate-850 px-4 py-3 text-center font-sans text-indigo-400">BALANCE</th>
                <th className="sticky top-0 bg-slate-950 z-20 border-b border-slate-850 px-4 py-3 font-sans">PROJECT</th>
                <th className="sticky top-0 bg-slate-950 z-20 border-b border-slate-850 px-4 py-3 font-sans">GIVER</th>
                <th className="sticky top-0 bg-slate-950 z-20 border-b border-slate-850 px-4 py-3 font-sans">RECEIVER</th>
                <th className="sticky top-0 bg-slate-950 z-20 border-b border-slate-850 px-4 py-3 text-center w-24 font-sans border-l border-slate-850">ACTION</th>
                <th className="sticky top-0 bg-slate-950 z-20 border-b border-slate-850 px-4 py-3 text-left font-sans">REMARK</th>
              </tr>
            </thead>
              <tbody className="divide-y divide-slate-800/40">
                {searchedCollections.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="text-center py-12 text-slate-500 italic text-xs font-sans">
                      မှတ်တမ်းတင်ထားသော စာရင်းများမရှိသေးပါ။
                    </td>
                  </tr>
                ) : (
                  searchedCollections.map((c, idx) => {
                    const isStockIn = (c.stockIn || 0) > 0 || (c.stockOut || 0) === 0;
                    const qtyVal = isStockIn ? (c.stockIn || 0) : (c.stockOut || 0);
                    
                    // Calculate overall balance cumulative for this exact Item Name up to now
                    const itemCollections = collections.filter(item => 
                      item.type === 'office_material' && 
                      item.name?.trim().toLowerCase() === c.name?.trim().toLowerCase()
                    );
                    const totalIn = itemCollections.reduce((sum, item) => sum + (Number(item.stockIn) || 0), 0);
                    const totalOut = itemCollections.reduce((sum, item) => sum + (Number(item.stockOut) || 0), 0);
                    const balanceVal = totalIn - totalOut;

                    const pName = availableProjects.find(p => p.id === c.projectId)?.name || c.projectId || '-';

                    return (
                      <tr key={c.id} className="hover:bg-slate-900/10 text-xs">
                        <td className="px-4 py-4 text-center font-mono text-slate-400">{idx + 1}</td>
                        <td className="px-4 py-4 text-slate-300 font-mono select-all">{c.date || '-'}</td>
                        <td className="px-4 py-4 font-bold text-slate-200 text-sm select-all">{c.name}</td>
                        <td className="px-4 py-4 text-center">
                          {isStockIn ? (
                            <span className="inline-block bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-extrabold text-[9px] px-2 py-0.5 rounded-full select-none uppercase">STOCK IN</span>
                          ) : (
                            <span className="inline-block bg-rose-500/10 border border-rose-500/20 text-rose-400 font-extrabold text-[9px] px-2 py-0.5 rounded-full select-none uppercase">STOCK OUT</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-center font-mono font-bold text-sm">
                          {isStockIn ? (
                            <span className="text-emerald-400">+{Number(qtyVal).toLocaleString()}</span>
                          ) : (
                            <span className="text-rose-400">-{Number(qtyVal).toLocaleString()}</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-center font-mono font-black text-sm text-indigo-400 select-all">
                          {balanceVal.toLocaleString()}
                        </td>
                        <td className="px-4 py-4 text-slate-400 capitalize">{pName === 'global' ? '-' : pName}</td>
                        <td className="px-4 py-4 text-slate-300 select-all">{c.issuedBy || '-'}</td>
                        <td className="px-4 py-4 text-slate-300 select-all">{c.receivedBy || '-'}</td>
                        <td className="px-4 py-4 text-center border-l border-slate-850">
                          <div className="flex items-center justify-center gap-1.5">
                            <button 
                              onClick={() => setEditingItem(c)} 
                              className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-indigo-500 text-slate-400 hover:text-white rounded-lg transition-all cursor-pointer"
                            >
                              <Pencil size={12}/>
                            </button>
                            <button 
                              onClick={() => {
                                setLocalConfirm({
                                  title: "ဖျက်ရန် သေချာပါသလား?",
                                  message: `"${c.name}" စာရင်းကို အပြီးတိုင် ဖျက်ရန် သေချာပါသလား?`,
                                  onConfirm: () => onDelete(c.id)
                                });
                              }} 
                              className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-rose-500 text-slate-400 hover:text-rose-500 rounded-lg transition-all cursor-pointer"
                            >
                              <Trash2 size={12}/>
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-[#3ba2f8] text-xs font-semibold select-all">{c.remark || '-'}</span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
        ) : (
          <table className="w-full text-left border-collapse font-sans">
            <thead>
              <tr className="bg-slate-950 text-[10px] uppercase font-black tracking-wider text-slate-500">
                <th className="sticky top-0 bg-slate-950 z-20 border-b border-slate-850 px-5 py-3 w-12 text-center font-sans">NO.</th>
                <th className="sticky top-0 bg-slate-950 z-20 border-b border-slate-850 px-5 py-3 font-sans">ITEM NAME</th>
                <th className="sticky top-0 bg-slate-950 z-20 border-b border-slate-850 px-5 py-3 text-right font-sans">STOCK LEVEL STATUS</th>
                <th className="sticky top-0 bg-slate-950 z-20 border-b border-slate-850 px-5 py-3 text-center w-24 font-sans">ACTION</th>
                <th className="sticky top-0 bg-slate-950 z-20 border-b border-slate-850 px-5 py-3 text-left font-sans">REMARK</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {searchedCollections.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-500 italic text-xs font-sans">
                    မှတ်တမ်းတင်ထားသော စာရင်းများမရှိသေးပါ။
                  </td>
                </tr>
              ) : (
                searchedCollections.map((c, idx) => {
                  const balanceVal = (Number(c.stockIn) || 0) - (Number(c.stockOut) || 0);
                  return (
                    <tr key={c.id} className="hover:bg-slate-900/10 text-xs">
                      <td className="px-5 py-4 text-center font-mono text-slate-400">{idx + 1}</td>
                      <td className="px-5 py-4 font-bold text-slate-200 text-sm">
                        <div className="flex items-center gap-2">
                          <Briefcase size={14} className="text-yellow-400 flex-shrink-0" />
                          {c.name}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right space-y-1">
                        <div className="flex justify-end gap-3 font-mono text-[11px]">
                          <span className="text-emerald-400 font-bold">In: {Number(c.stockIn || 0).toLocaleString()}</span>
                          <span className="text-rose-400 font-bold">Out: {Number(c.stockOut || 0).toLocaleString()}</span>
                        </div>
                        <p className="font-extrabold text-[#3cd69b] text-sm font-mono text-right">
                          Balance: {balanceVal.toLocaleString()} <span className="text-[10px] font-sans font-light text-slate-500">({c.unit || 'units'})</span>
                        </p>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button 
                            onClick={() => setEditingItem(c)} 
                            className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-indigo-500 text-slate-400 hover:text-white rounded-lg transition-all cursor-pointer"
                          >
                            <Pencil size={12}/>
                          </button>
                          <button 
                            onClick={() => {
                              setLocalConfirm({
                                title: "ဖျက်ရန် သေချာပါသလား?",
                                message: `"${c.name}" စာရင်းကို အပြီးတိုင် ဖျက်ရန် သေချာပါသလား?`,
                                onConfirm: () => onDelete(c.id)
                              });
                            }} 
                            className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-rose-500 text-slate-400 hover:text-rose-500 rounded-lg transition-all cursor-pointer"
                          >
                            <Trash2 size={12}/>
                          </button>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-slate-400 text-xs text-left font-sans select-all">{c.remark || '-'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* 6. Pure JS Merge / Deduplication Overlay Modal */}
      {showMergeModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0b1322] border border-slate-800 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-[#111c2a]/60">
              <div className="flex items-center gap-2">
                <GitMerge size={16} className="text-indigo-400" />
                <h3 className="text-sm font-black text-white uppercase tracking-wider">Data Clean-up &amp; Merging Panel (ဒေတာတိုက်စစ်ခြင်းနှင့် ပေါင်းစည်းခြင်း)</h3>
              </div>
              <button 
                onClick={() => setShowMergeModal(false)}
                className="text-slate-400 hover:text-white p-1.5 hover:bg-slate-800 rounded-xl"
              >
                <X size={18} />
              </button>
            </div>

            {/* List suggests */}
            <div className="p-6 max-h-[60vh] overflow-y-auto space-y-5 custom-scrollbar">
              <div className="bg-slate-900/60 border border-slate-800/80 p-4 rounded-xl text-xs space-y-2 leading-relaxed text-slate-300">
                <p className="font-bold text-white">⚙️ JavaScript Programming Logic ဖြင့် အောက်ပါအတိုင်း အလိုအလျောက် တိုက်စစ်ထားပါသည် -</p>
                <ul className="list-disc list-inside space-y-1 text-slate-400 pl-1">
                  <li><span className="text-slate-200">စာသားများပုံစံညှိခြင်း (Normalization)</span>: ဒေတာအမည်များကို စာလုံးအသေး (lowercase) ပြောင်းကာ ကွက်လပ်များ၊ တုံးတို (-) နှင့် မျဉ်းအောက်တား (_) များအားလုံးကို ဖယ်ရှားတိုက်စစ်ပါသည်။</li>
                  <li><span className="text-slate-200">တိုက်စစ်ခြင်းနှင့် အုပ်စုဖွဲ့ခြင်း (Grouping)</span>: အတိအကျ တူညီနေသောအမည်များကို အုပ်စုတစ်ခုတည်းအဖြစ် စုစည်းထားပါသည်။</li>
                  <li><span className="text-slate-200">ရွေးချယ်ခွင့်ပေးခြင်း (User Action)</span>: အုပ်စုတစ်ခုစီတွင် မည်သည့်ဒေတာကို ချန်ထားပြီး မည်သည့်ဒေတာများကို ဖျက်မည်ကို ကိုယ်တိုင်ရွေးချယ်နိုင်ပါသည်။</li>
                </ul>
              </div>

              {mergeSuggestions.length === 0 ? (
                <div className="text-center py-12 space-y-2">
                  <CheckCircle2 size={36} className="text-emerald-400 mx-auto animate-pulse" />
                  <p className="text-sm text-slate-300 font-bold">ဆင်တူနေသော Duplicate အချက်အလက်များ မတွေ့ပါ။</p>
                  <p className="text-xs text-slate-500">ဒေတာများအားလုံး သန့်ရှင်းစင်ကြယ်နေပါသည်</p>
                </div>
              ) : (
                <div className="space-y-5">
                  <p className="text-xs text-indigo-400 font-bold mb-2">
                    ဆင်တူနေသော ဒေတာအုပ်စု ({mergeSuggestions.length}) ခု တွေ့ရှိရပါသည်-
                  </p>
                  
                  {mergeSuggestions.map((group, groupIdx) => (
                    <div key={groupIdx} className="bg-slate-950/80 p-5 rounded-2xl border border-slate-800/80 space-y-4">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] bg-slate-800 text-slate-300 font-bold px-2.5 py-1 rounded-lg">Group {groupIdx + 1}</span>
                          <span className="text-xs text-slate-400">Normalized Name:</span>
                          <code className="text-xs font-mono font-bold bg-[#111c2a] px-2 py-0.5 rounded text-[#3ba2f8]">{group.normalizedName}</code>
                        </div>
                        <span className="text-xs text-rose-400 font-bold">{group.items.length} Duplicates Found</span>
                      </div>

                      <div className="space-y-2.5">
                        {group.items.map((item: any) => (
                          <div key={item.id} className="bg-slate-900/40 border border-slate-800/60 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-700/60 transition-all">
                            <div className="space-y-1 text-left min-w-0 flex-1">
                              <p className="text-xs font-bold text-slate-200 truncate">{item.name}</p>
                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400 font-sans">
                                {item.price !== undefined && item.price !== 0 && (
                                  <span>နှုန်းထား: <strong className="text-emerald-400 font-mono">{Number(item.price).toLocaleString()}</strong> MMK {item.unit ? `(${item.unit})` : ''}</span>
                                )}
                                {item.stockIn !== undefined && item.stockIn !== 0 && (
                                  <span>သွင်းကုန်: <strong className="text-emerald-400 font-mono">{Number(item.stockIn).toLocaleString()}</strong></span>
                                )}
                                {item.stockOut !== undefined && item.stockOut !== 0 && (
                                  <span>ထုတ်ကုန်: <strong className="text-rose-400 font-mono">{Number(item.stockOut).toLocaleString()}</strong></span>
                                )}
                                {item.remark && <span className="text-slate-500 italic truncate max-w-xs">မှတ်ချက်: {item.remark}</span>}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <button 
                                onClick={() => handleKeepAndDeduplicate(groupIdx, item, group.items)}
                                className="px-3 py-1.5 bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-500/20 text-emerald-400 hover:text-emerald-300 font-bold text-[10px] rounded-lg uppercase tracking-wider transition-all select-none cursor-pointer"
                                title="ဤဒေတာတစ်ခုတည်းကိုသာ ချန်လှပ်ထားပြီး အခြားဆင်တူများကို ဖျက်မည်"
                              >
                                Keep this &amp; Clean Others
                              </button>
                              <button 
                                onClick={() => {
                                  setLocalConfirm({
                                    title: "ဖျက်ရန် သေချာပါသလား?",
                                    message: `"${item.name}" ကိုသာ ဖျက်ရန် သေချာပါသလား?`,
                                    onConfirm: async () => {
                                      await onDelete(item.id);
                                      showToast("ဒေတာကို ဖျက်ပြီးပါပြီ။", "success");
                                      setMergeSuggestions(prev => {
                                        const updated = prev.map((g, idx) => {
                                          if (idx === groupIdx) {
                                            return {
                                              ...g,
                                              items: g.items.filter((it: any) => it.id !== item.id)
                                            };
                                          }
                                          return g;
                                        }).filter(g => g.items.length > 1);
                                        return updated;
                                      });
                                    }
                                  });
                                }}
                                className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-rose-500 text-slate-400 hover:text-rose-400 rounded-lg transition-all cursor-pointer"
                                title="ဤတစ်ခုတည်းကိုသာ ဖျက်မည်"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-slate-800 flex justify-end bg-[#111c2a]/30">
              <button 
                onClick={() => setShowMergeModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-705 text-slate-300 text-xs rounded-xl font-bold uppercase cursor-pointer"
              >
                Close
              </button>
            </div>
            
          </div>
        </div>
      )}

      {/* Robust custom confirmation modally replacing window.confirm */}
      {localConfirm && (
        <div className="fixed inset-0 z-[3000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 space-y-4 font-sans text-left">
              <div className="flex items-center gap-3 text-rose-500 mb-2">
                <AlertCircle size={24} />
                <h4 className="font-bold text-white text-base font-display">{localConfirm.title}</h4>
              </div>
              <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-line font-sans">{localConfirm.message}</p>
              <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-slate-800/60 mt-4">
                <button
                  type="button"
                  onClick={() => setLocalConfirm(null)}
                  className="px-4 py-2.5 rounded-xl font-bold text-xs uppercase transition-all tracking-wider font-sans bg-slate-800 hover:bg-slate-705 text-slate-300 cursor-pointer"
                >
                  မဖျက်တော့ပါ
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await localConfirm.onConfirm();
                    setLocalConfirm(null);
                  }}
                  className="px-4 py-2.5 rounded-xl font-bold text-xs uppercase transition-all tracking-wider font-sans bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-500/10 cursor-pointer animate-none"
                >
                  သေချာပါသည်
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
