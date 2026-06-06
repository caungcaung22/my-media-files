/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Download, Trash2, Pencil, Sparkles, Loader2, Calendar, FileText, Plus, X, ArrowUpRight, ArrowDownLeft, Image, Upload } from 'lucide-react';
import { Transaction, Employee, Project } from '../types';
import { saveDocument, bulkSaveDocuments, bulkDeleteDocuments } from '../lib/db';

interface TransactionManagerProps {
  transactions: Transaction[];
  entities: Employee[];
  availableProjects: Project[];
  currentProject: string | null;
  onSave: (data: any) => void;
  onDelete: (id: string) => void;
  editingItem: any;
  setEditingItem: (item: any) => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export const TransactionManager: React.FC<TransactionManagerProps> = ({
  transactions,
  entities,
  availableProjects,
  currentProject,
  onSave,
  onDelete,
  editingItem,
  setEditingItem,
  showToast
}) => {
  // Form state fields to precisely match screenshot flow
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0]);
  const [entryType, setEntryType] = useState<'Stock In' | 'Stock Out'>('Stock In');
  const [purchaseSource, setPurchaseSource] = useState<'External Shop' | 'Office Stock'>('External Shop');
  const [buyer, setBuyer] = useState('');
  const [receiver, setReceiver] = useState('');
  const [itemName, setItemName] = useState('');
  const [qty, setQty] = useState('1');
  const [unitPrice, setUnitPrice] = useState('');
  const [beforeDiscount, setBeforeDiscount] = useState('');
  const [afterDiscount, setAfterDiscount] = useState('');
  const [transportCharges, setTransportCharges] = useState('');
  const [additionalCharges, setAdditionalCharges] = useState('');
  const [status, setStatus] = useState('Received');
  const [remark, setRemark] = useState('');

  // General management state
  const [search, setSearch] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisReport, setAnalysisReport] = useState<string | null>(null);
  const [localConfirm, setLocalConfirm] = useState<{
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileImportRef = useRef<HTMLInputElement>(null);

  // Dynamic lists of buyers and receivers
  const buyerOptions = useMemo(() => {
    const list = new Set<string>();
    // Add default names from screenshot
    list.add("Naung Naung Tun");
    list.add("Yamin Theigi");
    list.add("Daw Su Su Hlaing");
    entities.forEach(e => {
      if (e.name) list.add(e.name);
    });
    return Array.from(list);
  }, [entities]);

  const receiverOptions = useMemo(() => {
    const list = new Set<string>();
    // Add default names from screenshot
    list.add("Yamin Theigi");
    list.add("Naung Naung Tun");
    list.add("Daw Su Su Hlaing");
    entities.forEach(e => {
      if (e.name) list.add(e.name);
    });
    return Array.from(list);
  }, [entities]);

  // Initial form values and updates when editingItem shifts
  useEffect(() => {
    if (editingItem) {
      setTxDate(editingItem.date || new Date().toISOString().split('T')[0]);
      setEntryType((editingItem.entry_type as 'Stock In' | 'Stock Out') || 'Stock In');
      setPurchaseSource((editingItem.purchase_source as 'External Shop' | 'Office Stock') || 'External Shop');
      setBuyer(editingItem.name || '');
      setReceiver(editingItem.receiver || '');
      setItemName(editingItem.particular || editingItem.item || '');
      setQty(editingItem.qty !== undefined ? String(editingItem.qty) : '1');
      setUnitPrice(editingItem.unit_price !== undefined ? String(editingItem.unit_price) : '');
      setBeforeDiscount(editingItem.original_amount !== undefined ? String(editingItem.original_amount) : '');
      setAfterDiscount(editingItem.amount !== undefined ? String(editingItem.amount) : '');
      setTransportCharges(editingItem.transport_charges !== undefined ? String(editingItem.transport_charges) : '');
      setAdditionalCharges(editingItem.additional_charges !== undefined ? String(editingItem.additional_charges) : '');
      setStatus(editingItem.status || 'Received');
      setRemark(editingItem.remark || '');
    } else {
      setTxDate(new Date().toISOString().split('T')[0]);
      setEntryType('Stock In');
      setPurchaseSource('External Shop');
      setBuyer(buyerOptions[0] || 'Naung Naung Tun');
      setReceiver(receiverOptions[1] || 'Yamin Theigi');
      setItemName('');
      setQty('1');
      setUnitPrice('');
      setBeforeDiscount('');
      setAfterDiscount('');
      setTransportCharges('');
      setAdditionalCharges('');
      setStatus('Received');
      setRemark('');
    }
  }, [editingItem, buyerOptions, receiverOptions]);

  // Helper to compute overall inventory stock of any item
  const getCurrentStock = (name: string): number => {
    const cleanName = name.trim().toLowerCase();
    if (!cleanName) return 0;
    
    let stock = 0;
    transactions.forEach(t => {
      // Ignore current editing item so its value is not counted against ourselves
      if (editingItem && t.id === editingItem.id) return;
      
      const tName = (t.particular || t.item || '').trim().toLowerCase();
      if (tName === cleanName) {
        const q = Number(t.qty) || 0;
        if (t.entry_type === 'Stock Out') {
          stock -= q;
        } else {
          stock += q;
        }
      }
    });
    return stock;
  };

  // Get current stock based on typed item
  const currentStock = useMemo(() => {
    return getCurrentStock(itemName);
  }, [itemName, transactions, editingItem]);

  // List of unique item names for autocompletion
  const existingItemNames = useMemo(() => {
    const names = new Set<string>();
    transactions.forEach(t => {
      const name = (t.particular || t.item || '').trim();
      if (name) names.add(name);
    });
    return Array.from(names).sort();
  }, [transactions]);

  // Helper auto-calcs on quantity or unit price edits
  const handleQtyChange = (val: string) => {
    setQty(val);
    const q = Number(val) || 0;
    const p = Number(unitPrice) || 0;
    const total = q * p;
    setBeforeDiscount(String(total));
    setAfterDiscount(String(total));
  };

  const handleUnitPriceChange = (val: string) => {
    setUnitPrice(val);
    const q = Number(qty) || 0;
    const p = Number(val) || 0;
    const total = q * p;
    setBeforeDiscount(String(total));
    setAfterDiscount(String(total));
  };

  // OCR Document Scanner logic
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    showToast("Voucher ကို AI ဖြင့် စတင်ဖတ်ရှုနေပါသည်...", "success");

    const reader = new FileReader();
    reader.onload = async (event) => {
      const bData = (event.target?.result as string).split(',')[1];
      
      try {
          const prompt = `Quickly extract details from this voucher image:
          1. Store Name / Particular description
          2. Total Amount (raw number without currency symbols)
          3. Voucher Number (if visible)
          Format output strictly as a clean JSON object: {"particular": "Description or store", "amount": 25000, "voucher_no": "V123"}. Do not return codeblocks.`;

          const response = await fetch("/api/gemini/scan-doc", {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ fileData: bData, mimeType: file.type || "image/jpeg", prompt })
          });

          if (!response.ok) throw new Error("API failed");
          const result = await response.json();
          const cleanText = result.text?.replace(/```json/gi, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(cleanText);

          setItemName(parsed.particular || itemName);
          setAfterDiscount(parsed.amount ? String(parsed.amount) : afterDiscount);
          showToast("Voucher စကင်န်ဖတ်ခြင်း အောင်မြင်ပါသည်။", "success");
      } catch (err) {
          console.error(err);
          showToast("AI Voucher Extraction တွင် အမှားအယွင်းရှိပါသည်", "error");
      } finally {
          setIsScanning(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // AI Insights call
  const handleAnalyzeLedger = async () => {
    if (transactions.length === 0) return showToast("Analyze လုပ်ရန် အရောင်းအဝယ် စာရင်းမရှိသေးပါ။", "error");
    setIsAnalyzing(true);
    setAnalysisReport(null);
    showToast("စာရင်းများကို AI (Gemini) အသုံးပြု၍ သုံးသပ်နေပါသည်...", "success");

    try {
        const response = await fetch('/api/gemini/analyze-ledger', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transactions })
        });
        if (!response.ok) throw new Error("Ledger API failed");
        const res = await response.json();
        setAnalysisReport(res.text || "သုံးသပ်ချက်မရရှိပါ။");
    } catch (err) {
        console.error(err);
        showToast("Analysis ပြုလုပ်နေစဉ် အမှားအယွင်း ရှိခဲ့သည်", "error");
    } finally {
        setIsAnalyzing(false);
    }
  };

  // Saving Transaction function
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName || !qty) {
      showToast("ကျေးဇူးပြု၍ လိုအပ်သောအချက်အလက်များ ဖြည့်စွက်ပါ *", "error");
      return;
    }

    const qtyNum = Number(qty) || 0;
    if (qtyNum <= 0) {
      showToast("ကျေးဇူးပြု၍ တရားဝင်သည့် အရေအတွက် ဖြည့်သွင်းပါ *", "error");
      return;
    }

    if (entryType === 'Stock Out') {
      const stockAvailable = getCurrentStock(itemName);
      if (stockAvailable < qtyNum) {
        showToast(`ထုတ်ယူမည့် အရေအတွက်သည် လက်ကျန်ထက် ကျော်လွန်နေပါသည် (လက်ရှိတွင် ${stockAvailable} သာ ကျန်ရှိပါသည်)`, "error");
        return;
      }
    } else {
      // Stock In requires price details
      if (!afterDiscount) {
        showToast("ကျေးဇူးပြု၍ ကျသင့်ငွေဖြည့်သွင်းပါ *", "error");
        return;
      }
    }

    const payload = {
      date: txDate,
      particular: itemName,
      item: itemName,
      entry_type: entryType,
      purchase_source: purchaseSource,
      name: buyer || buyerOptions[0] || 'Naung Naung Tun',
      receiver: receiver || receiverOptions[0] || 'Yamin Theigi',
      qty: qtyNum,
      unit_price: entryType === 'Stock Out' ? 0 : (Number(unitPrice) || 0),
      original_amount: entryType === 'Stock Out' ? 0 : (Number(beforeDiscount) || 0),
      amount: entryType === 'Stock Out' ? 0 : (Number(afterDiscount) || 0), 
      transport_charges: Number(transportCharges) || 0,
      additional_charges: Number(additionalCharges) || 0,
      status: entryType === 'Stock Out' ? 'Used' : status,
      remark: remark,
      projectId: currentProject || 'global',
      category: 'Material Purchase',
      flow_type: 'OUT' // Spent cash
    };

    onSave(payload);

    // Auto save to data_collections (material_price) as designated in the interface disclaimer
    if (entryType === 'Stock In' && purchaseSource === 'External Shop') {
      try {
        await saveDocument('data_collections', null, {
          type: 'material_price',
          name: itemName,
          price: Number(unitPrice) || 0,
          remark: remark || 'Auto recorded from Purchase Ledger',
          date: txDate,
          projectId: currentProject || 'global',
          timestamp: new Date().toISOString()
        });
        window.dispatchEvent(new Event('intfin_update_data_collections'));
      } catch (err) {
        console.error("Auto collection save error:", err);
      }
    }

    // Reset Form
    setEditingItem(null);
    setItemName('');
    setQty('1');
    setUnitPrice('');
    setBeforeDiscount('');
    setAfterDiscount('');
    setTransportCharges('');
    setAdditionalCharges('');
    setRemark('');
    showToast("ဝယ်ယူမှု စာရင်းမှတ်တမ်းကို စနစ်ထဲသို့ ထည့်သွင်းသိမ်းဆည်းလိုက်ပါပြီ။", "success");
  };

  // Filter & search options
  const filteredTransactions = useMemo(() => {
    let list = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (search) {
       const lower = search.toLowerCase();
       list = list.filter(t => 
          (t.particular || '').toLowerCase().includes(lower) || 
          (t.item || '').toLowerCase().includes(lower) || 
          (t.name || '').toLowerCase().includes(lower) || 
          (t.receiver || '').toLowerCase().includes(lower) ||
          (t.remark || '').toLowerCase().includes(lower)
       );
    }
    return list;
  }, [transactions, search]);

  // Aggregate project statistics
  const stats = useMemo(() => {
    let totalIn = 0;
    let totalOut = 0;
    filteredTransactions.forEach(t => {
       if (t.entry_type !== 'Stock Out') {
          const amt = Number(t.amount) || 0;
          totalOut += amt;
       }
       // Add transport charges and additional charges for any transaction as they represent cash outlays
       totalOut += (Number(t.transport_charges) || 0) + (Number(t.additional_charges) || 0);
    });
    return { totalIn, totalOut, balance: totalIn - totalOut };
  }, [filteredTransactions]);

  // Project running balances map calculated ascending chronologically per item
  const computedBalances = useMemo(() => {
    const balances: { [txId: string]: number } = {};
    const itemsMap: { [itemName: string]: any[] } = {};
    
    // Sort chronological oldest-first to properly tally cumulative balance
    const sortedAll = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    sortedAll.forEach(tx => {
      const itemName = (tx.particular || tx.item || '').trim().toLowerCase();
      if (!itemName) return;
      if (!itemsMap[itemName]) {
        itemsMap[itemName] = [];
      }
      itemsMap[itemName].push(tx);
    });
    
    Object.keys(itemsMap).forEach(itemName => {
      let runningVal = 0;
      itemsMap[itemName].forEach(tx => {
        const q = Number(tx.qty) || 0;
        const isOut = tx.entry_type === 'Stock Out';
        if (isOut) {
          runningVal -= q;
        } else {
          runningVal += q;
        }
        balances[tx.id] = runningVal;
      });
    });
    
    return balances;
  }, [transactions]);

  const getProjectName = (projId: string) => {
    if (projId === 'global') return 'Office / General (ရုံး)';
    const found = availableProjects.find(p => p.id === projId);
    return found ? found.projectName : projId;
  };

  const exportToExcel = () => {
    if (filteredTransactions.length === 0) return showToast("ထုတ်ယူရန် Ledger Data မရှိသဖြင့် Excel ထုတ်၍မရပါ", "error");
    const XLSX = (window as any).XLSX;
    const wb = XLSX.utils.book_new();
    const headers = [
       "No.", "Date", "Item Name", "Qty", "Entry Type", "Source", "Unit Price", "Before Discount", "After Discount (Paid)", "Buyer", "Receiver", "Status", "Shop/Remark"
    ];
    const rows = filteredTransactions.map((t, idx) => [
       filteredTransactions.length - idx, 
       t.date, 
       t.particular || t.item || '-', 
       t.qty || 1, 
       t.entry_type || 'Stock In',
       t.purchase_source || 'External Shop',
       t.unit_price || 0,
       t.original_amount || 0,
       t.amount || 0,
       t.name || '-',
       t.receiver || '-',
       t.status || 'Received',
       t.remark || ''
    ]);
    
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    XLSX.utils.book_append_sheet(wb, ws, "Purchase Ledger");
    XLSX.writeFile(wb, `PurchaseLedger_${currentProject || 'Global'}.xlsx`);
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const parseExcelDate = (val: any): string => {
      if (!val) return new Date().toISOString().split('T')[0];
      if (typeof val === 'number') {
        const d = new Date(Math.round((val - 25569) * 86400 * 1000));
        const yyyy = d.getUTCFullYear();
        const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(d.getUTCDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      }
      const str = String(val).trim();
      if (str.match(/^\d{4}-\d{2}-\d{2}/)) {
        return str.substring(0, 10);
      }
      try {
        const d = new Date(str);
        if (!isNaN(d.getTime())) {
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const dd = String(d.getDate()).padStart(2, '0');
          return `${yyyy}-${mm}-${dd}`;
        }
      } catch (err) {}
      return str;
    };

    const getMatchingProjectId = (projectStr: string) => {
      if (!projectStr) return currentProject || 'global';
      const clean = projectStr.trim().toLowerCase().replace(/_/g, ' ');
      const found = availableProjects.find(p => 
        p.projectName.trim().toLowerCase().replace(/_/g, ' ') === clean ||
        p.id.trim().toLowerCase() === projectStr.trim().toLowerCase()
      );
      return found ? found.id : (currentProject || 'global');
    };

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

        const transactionsToSave: any[] = [];
        const headerRow = rows[0].map((h: any) => String(h || '').trim().toLowerCase());

        const getIdx = (candidates: string[], defaultIdx: number): number => {
          let found = headerRow.findIndex((h: string) => 
            candidates.some(c => h === c.toLowerCase())
          );
          if (found !== -1) return found;

          found = headerRow.findIndex((h: string) => 
            candidates.some(c => h.includes(c.toLowerCase()))
          );
          return found !== -1 ? found : defaultIdx;
        };

        const dateIdx = getIdx(["date", "နေ့စွဲ"], -1);
        const projectIdx = getIdx(["project", "လုပ်ငန်း"], -1);
        const typeIdx = getIdx(["entry type", "type", "အမျိုးအစား"], -1);
        const personIdx = getIdx(["buyer", "person", "ဝယ်ယူသူ"], -1);
        const receiverIdx = getIdx(["receiver", "လက်ခံသူ"], -1);
        const purchaseForIdx = getIdx(["purchase for", "source", "နေရာ"], -1);
        const itemIdx = getIdx(["item name", "item", "particular", "ပစ္စည်း"], -1);
        const inQtyIdx = getIdx(["in qty", "ဝင်ဦးရေ"], -1);
        const outQtyIdx = getIdx(["out qty", "ထွက်ဦးရေ"], -1);
        const qtyIdx = getIdx(["qty", "ဦးရေ", "အရေအတွက်"], -1);
        const unitPriceIdx = getIdx(["unit price", "နှုန်း"], -1);
        const originalAmtIdx = getIdx(["original amt", "original amount", "before discount"], -1);
        const amountIdx = getIdx(["total amount", "after discount", "total amt", "amount"], -1);
        const statusIdx = getIdx(["status", "အခြေအနေ"], -1);
        const remarkIdx = getIdx(["remark", "shop/remark", "မှတ်ချက်"], -1);

        for (let i = 1; i < rows.length; i++) {
          const cols = rows[i];
          if (!cols || cols.length < 1) continue;

          // 1. Date
          let dateVal = new Date().toISOString().split('T')[0];
          if (dateIdx !== -1 && cols[dateIdx] !== undefined) {
            dateVal = parseExcelDate(cols[dateIdx]);
          }

          // 2. Project Mapping
          let rowProjId = currentProject || 'global';
          if (projectIdx !== -1 && cols[projectIdx] !== undefined) {
            rowProjId = getMatchingProjectId(String(cols[projectIdx]));
          }

          // 3. Entry Type Mapping
          let entryTypeVal = 'Stock In';
          if (typeIdx !== -1 && cols[typeIdx] !== undefined) {
             const typeStr = String(cols[typeIdx]).trim().toLowerCase();
             if (typeStr.includes('out') || typeStr.includes('သုံးစွဲမှု')) {
               entryTypeVal = 'Stock Out';
             } else {
               entryTypeVal = 'Stock In';
             }
          }

          // 4. Item Name / Particular
          let itemNameVal = '';
          if (itemIdx !== -1 && cols[itemIdx] !== undefined) {
            itemNameVal = String(cols[itemIdx]).trim();
          }
          if (!itemNameVal) continue; // Skip rows without item name

          // 5. Quantity Mapping
          let qtyVal = 1;
          if (entryTypeVal === 'Stock Out' && outQtyIdx !== -1 && cols[outQtyIdx] !== undefined) {
            qtyVal = Number(String(cols[outQtyIdx]).replace(/,/g, '')) || 0;
          } else if (inQtyIdx !== -1 && cols[inQtyIdx] !== undefined) {
            qtyVal = Number(String(cols[inQtyIdx]).replace(/,/g, '')) || 0;
          } else if (qtyIdx !== -1 && cols[qtyIdx] !== undefined) {
            qtyVal = Number(String(cols[qtyIdx]).replace(/,/g, '')) || 0;
          }
          if (qtyVal === 0) qtyVal = 1;

          // 6. Source / Purchase For Mapping
          let purchaseSourceVal = 'External Shop';
          if (purchaseForIdx !== -1 && cols[purchaseForIdx] !== undefined) {
            const pf = String(cols[purchaseForIdx]).trim().toLowerCase();
            if (pf.includes('office') || pf.includes('ရုံး')) {
              purchaseSourceVal = 'Office Stock';
            }
          }

          // 7. Unit Price
          let unitPriceVal = 0;
          if (unitPriceIdx !== -1 && cols[unitPriceIdx] !== undefined) {
            unitPriceVal = Number(String(cols[unitPriceIdx]).replace(/,/g, '')) || 0;
          }

          // 8. Original Amount (Before Discount / Original Amt)
          let originalAmtVal = 0;
          if (originalAmtIdx !== -1 && cols[originalAmtIdx] !== undefined) {
            originalAmtVal = Number(String(cols[originalAmtIdx]).replace(/,/g, '')) || 0;
          } else {
            originalAmtVal = qtyVal * unitPriceVal;
          }

          // 9. Total Amount (After Discount / Total Amount)
          let amtVal = 0;
          if (amountIdx !== -1 && cols[amountIdx] !== undefined) {
            amtVal = Number(String(cols[amountIdx]).replace(/,/g, '')) || 0;
          } else {
            amtVal = qtyVal * unitPriceVal;
          }

          // 10. Buyer (Person)
          let nameVal = 'Naung Naung Tun';
          if (personIdx !== -1 && cols[personIdx] !== undefined) {
            nameVal = String(cols[personIdx]).trim() || 'Naung Naung Tun';
          }

          // 11. Receiver
          let receiverVal = 'Yamin Theigi';
          if (receiverIdx !== -1 && cols[receiverIdx] !== undefined) {
            receiverVal = String(cols[receiverIdx]).trim() || 'Yamin Theigi';
          }

          // 12. Status
          let statusVal = 'Received';
          if (statusIdx !== -1 && cols[statusIdx] !== undefined) {
            statusVal = String(cols[statusIdx]).trim() || 'Received';
          } else if (entryTypeVal === 'Stock Out') {
            statusVal = 'Used';
          }

          // 13. Remark / Shop
          let remarkVal = '';
          if (remarkIdx !== -1 && cols[remarkIdx] !== undefined) {
            remarkVal = String(cols[remarkIdx]).trim() || '';
          }

          transactionsToSave.push({
            date: dateVal,
            particular: itemNameVal,
            item: itemNameVal,
            qty: qtyVal,
            entry_type: entryTypeVal,
            purchase_source: purchaseSourceVal,
            unit_price: unitPriceVal,
            original_amount: originalAmtVal,
            amount: amtVal,
            name: nameVal,
            receiver: receiverVal,
            status: statusVal,
            remark: remarkVal,
            projectId: rowProjId,
            category: 'Material Purchase',
            flow_type: 'OUT',
            timestamp: new Date().toISOString()
          });
        }

        if (transactionsToSave.length > 0) {
          await bulkSaveDocuments('transactions', transactionsToSave);
          showToast(`ဝယ်ယူမှု စာရင်း ${transactionsToSave.length} ခုကို အောင်မြင်စွာ ထည့်သွင်းပြီးပါပြီ။`, "success");
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
    const list = filteredTransactions;
    if (list.length === 0) return;

    setLocalConfirm({
      title: "စာရင်းအားလုံးဖျက်ရန် သေချာပါသလား?",
      message: `လက်ရှိ Purchase Ledger စာရင်းအားလုံး (${list.length} ခု) ကို ဖျက်ရန် သေချာပါသလား?\n\nဤလုပ်ဆောင်ချက်သည် ပြန်ပြင်၍မရနိုင်ပါ။`,
      onConfirm: async () => {
        showToast("စာရင်းအားလုံးကို ဖျက်ဆီးနေပါသည်...", "success");
        try {
          await bulkDeleteDocuments('transactions', list.map(t => t.id));
          showToast("စာရင်းအားလုံး ဖျက်ဆီးပြီးပါပြီ။", "success");
        } catch (err) {
          console.error("Bulk delete failure", err);
          showToast("ဖျက်သိမ်းခြင်း မအောင်မြင်ပါ။", "error");
        }
      }
    });
  };

  return (
    <div className="space-y-6">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <h2 className="text-xl font-black text-white uppercase tracking-tight">Purchase Ledger</h2>
          <p className="text-xs text-slate-500 mt-1 font-sans">
            Detailed procurement stock registers, purchases logs, discount audits, and AI spending reports
          </p>
        </div>
      </div>

      {/* Dynamic Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
         <div className="bg-gradient-to-br from-emerald-950/20 to-slate-900 border border-emerald-500/20 p-5 rounded-2xl md:rounded-3xl shadow-lg flex items-center gap-4">
            <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400"><ArrowUpRight size={20}/></div>
            <div>
               <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Total Sourcing Stock In</p>
               <h4 className="text-xl font-bold text-emerald-400 mt-0.5">
                  {filteredTransactions.filter(t => t.entry_type !== 'Stock Out').length} Items
               </h4>
            </div>
         </div>

         <div className="bg-gradient-to-br from-rose-950/20 to-slate-900 border border-rose-500/20 p-5 rounded-2xl md:rounded-3xl shadow-lg flex items-center gap-4">
            <div className="p-3 bg-rose-500/10 rounded-xl text-rose-400"><ArrowDownLeft size={20}/></div>
            <div>
               <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Total Consumed Stock Out</p>
               <h4 className="text-xl font-bold text-rose-400 mt-0.5">
                  {filteredTransactions.filter(t => t.entry_type === 'Stock Out').length} Items
               </h4>
            </div>
         </div>

         <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl md:rounded-3xl shadow-lg flex items-center gap-4">
            <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400">
               <Sparkles size={20}/>
            </div>
            <div>
               <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Total Active Purchases value</p>
               <h4 className="text-xl font-bold text-indigo-300 mt-0.5">{stats.totalOut.toLocaleString()} Ks</h4>
            </div>
         </div>
      </div>

      {/* Primary Input Panel */}
      <div className="bg-slate-900 border border-slate-800 p-5 md:p-8 rounded-2xl md:rounded-3xl shadow-xl relative overflow-hidden">
        
        {/* Panel Header */}
        <div className="flex justify-between items-center mb-6">
          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">
            {editingItem ? 'EDIT RECORD (ပြင်ဆင်ရန်)' : 'ADD NEW RECORD'}
          </h4>
          
          <div className="flex items-center gap-2">
             <input type="file" ref={fileInputRef} accept="image/*" onChange={handleImageUpload} className="hidden" />
             <button 
               type="button" 
               onClick={() => fileInputRef.current?.click()} 
               className="border border-emerald-500/50 hover:bg-emerald-500/10 text-emerald-400 px-4 py-2 rounded-full text-xs font-bold transition-all inline-flex items-center gap-1.5 select-none hover:scale-105"
             >
                <Sparkles size={13} className="text-emerald-400 animate-pulse" /> SCAN VOUCHER
             </button>
             {editingItem && (
               <button 
                 type="button" 
                 onClick={() => setEditingItem(null)} 
                 className="text-xs font-bold text-rose-500 hover:underline px-3 py-1.5 border border-rose-500/20 rounded-full bg-rose-500/5"
               >
                  Cancel Edit
               </button>
             )}
          </div>
        </div>

        {isScanning && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center text-emerald-400 font-sans">
             <Loader2 size={32} className="animate-spin mb-3 text-emerald-400" />
             <p className="font-bold text-sm tracking-widest uppercase">Extracting Invoice Details via Gemini AI...</p>
          </div>
        )}

        {/* Input Form matching exact screenshot workflow */}
        <form onSubmit={handleSubmit} className="space-y-4">
           {/* Date picker */}
           <div className="flex flex-col gap-1 w-full max-w-xs">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Date</label>
              <div className="relative">
                 <input 
                   type="date" 
                   required 
                   value={txDate} 
                   onChange={e => setTxDate(e.target.value)} 
                   className="bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-3 text-white text-xs outline-none w-full font-medium" 
                 />
              </div>
           </div>

           {/* Stock in/out custom toggler bar */}
           <div className="bg-slate-950/90 border border-slate-800/80 rounded-xl p-3.5 flex gap-8 items-center w-full shadow-inner">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input 
                  type="radio" 
                  name="entryType" 
                  checked={entryType === 'Stock In'} 
                  onChange={() => setEntryType('Stock In')} 
                  className="hidden" 
                />
                <span className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                  entryType === 'Stock In' ? 'border-emerald-500 bg-emerald-500' : 'border-slate-600 bg-transparent'
                }`}>
                  {entryType === 'Stock In' && <span className="w-1.5 h-1.5 bg-white rounded-full"></span>}
                </span>
                <span className={`text-xs font-bold ${entryType === 'Stock In' ? 'text-emerald-400' : 'text-slate-350'}`}>
                  ဝယ်ယူသယ်ယူခြင်း (Stock In)
                </span>
              </label>
              
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input 
                  type="radio" 
                  name="entryType" 
                  checked={entryType === 'Stock Out'} 
                  onChange={() => setEntryType('Stock Out')} 
                  className="hidden" 
                />
                <span className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                  entryType === 'Stock Out' ? 'border-rose-500 bg-rose-500' : 'border-slate-600 bg-transparent'
                }`}>
                  {entryType === 'Stock Out' && <span className="w-1.5 h-1.5 bg-white rounded-full"></span>}
                </span>
                <span className={`text-xs font-bold ${entryType === 'Stock Out' ? 'text-rose-400' : 'text-slate-350'}`}>
                  သိုလှောင်သုံးစွဲခြင်း (Stock Out)
                </span>
              </label>
           </div>

           {/* Source selection */}
           <div className="flex gap-6 items-center text-xs text-slate-400 border-b border-slate-800/40 pb-3 font-sans">
              <span className="font-semibold text-slate-500">ဝယ်ယူမည့်ရင်းမြစ် (SOURCE):</span>
              
              <label className="flex items-center gap-1.5 cursor-pointer select-none text-slate-300 font-bold hover:text-white">
                <input 
                  type="radio" 
                  name="purchaseSource" 
                  checked={purchaseSource === 'External Shop'} 
                  onChange={() => setPurchaseSource('External Shop')} 
                  className="rounded-full bg-slate-950 border-slate-700 text-indigo-500 focus:ring-0 checked:bg-indigo-500 cursor-pointer" 
                />
                <span>ပြင်ပဆိုင် (External Shop)</span>
              </label>
              
              <label className="flex items-center gap-1.5 cursor-pointer select-none text-slate-300 font-bold hover:text-white">
                <input 
                  type="radio" 
                  name="purchaseSource" 
                  checked={purchaseSource === 'Office Stock'} 
                  onChange={() => setPurchaseSource('Office Stock')} 
                  className="rounded-full bg-slate-950 border-slate-700 text-indigo-500 focus:ring-0 checked:bg-indigo-500 cursor-pointer" 
                />
                <span>ရုံးလက်ကျန် (Office Stock)</span>
              </label>
           </div>

            {/* Stock Balance Indicator Panel */}
            {itemName.trim() !== '' && (
              <div className="p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-sans transition-all duration-200 mt-2 bg-emerald-950/20 border-emerald-500/20">
                <div className="flex items-center gap-2">
                  <span className="text-base">{currentStock > 0 ? '📦' : '⚠️'}</span>
                  <div>
                    <p className="text-xs font-bold text-slate-200">
                      ပစ္စည်းအမည်: <span className="text-yellow-400 font-sans text-xs font-black">"{itemName}"</span>
                    </p>
                    {entryType === 'Stock Out' && (
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {currentStock > 0 
                          ? '* သိုလှောင်သုံးစွဲရန် လက်ကျန်စတော့ထက် မကျော်လွန်စေရပါ။ (Cannot consume exceed available stock)' 
                          : '* ဤပစ္စည်းသည် စတော့မရှိသဖြင့် သိုလှောင်သုံးစွဲရန် မဖြစ်နိုင်ပါ။ (Out of stock)'}
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">လက်ရှိ စတော့လက်ကျန် (STOCK BALANCE):</span>
                  <span className={`px-2.5 py-1 rounded text-xs font-black tracking-wide border ${
                    currentStock > 0 
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 animate-pulse' 
                      : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                  }`}>
                    {currentStock} {currentStock > 0 ? 'Available' : 'Out of Stock'}
                  </span>
                </div>
              </div>
            )}

           {/* Grid fields */}
           <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-2">
               <div className="flex flex-col gap-1">
                 <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">ဝယ်ယူသူ (Buyer) *</label>
                 <select 
                   value={buyer} 
                   onChange={e => setBuyer(e.target.value)} 
                   className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-xs outline-none cursor-pointer focus:border-indigo-500 transition-all font-bold"
                 >
                   {buyerOptions.map(name => <option key={`b-${name}`} value={name}>{name}</option>)}
                 </select>
               </div>

               <div className="flex flex-col gap-1">
                 <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">လက်ခံသူ (Receiver) *</label>
                 <select 
                   value={receiver} 
                   onChange={e => setReceiver(e.target.value)} 
                   className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-xs outline-none cursor-pointer focus:border-indigo-500 transition-all font-bold"
                 >
                   {receiverOptions.map(name => <option key={`r-${name}`} value={name}>{name}</option>)}
                 </select>
               </div>

               <div className="flex flex-col gap-1">
                 <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Item Name (ပစ္စည်းအမည်)*</label>
                 <input 
                   type="text" 
                   required 
                   placeholder="ဥပမာ။ Dextone glue" 
                   value={itemName} 
                   onChange={e => setItemName(e.target.value)} 
                   list="itemNameOptions"
                   className="bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-3 text-white text-xs outline-none transition-all font-bold" 
                 />
                 <datalist id="itemNameOptions">
                   {existingItemNames.map(name => <option key={`opt-${name}`} value={name} />)}
                 </datalist>
                 {itemName.trim() !== '' && (
                    <span className={`text-[9px] font-bold mt-1 px-1.5 py-0.5 rounded border w-max block ${
                      currentStock > 0 
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/15' 
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/15'
                    }`}>
                      Available: {currentStock}
                    </span>
                 )}
               </div>

               <div className="flex flex-col gap-1">
                 <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">အရေအတွက် (Qty)</label>
                 <input 
                   type="text" 
                   placeholder="ဥပမာ။ 1" 
                   value={qty} 
                   onChange={e => handleQtyChange(e.target.value)} 
                   className="bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-3 text-white text-xs outline-none transition-all font-bold text-center" 
                 />
                 {entryType === 'Stock Out' && itemName.trim() !== '' && (
                   <span className="text-[9px] text-rose-400 font-extrabold mt-1 block">
                     * Max Limit: {currentStock}
                   </span>
                 )}
               </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">တစ်ယူနစ်တန်ဖိုး (Unit Price)</label>
                <input 
                  type="text" 
                  placeholder="ဥပမာ။ 13,500" 
                  value={unitPrice} 
                  onChange={e => handleUnitPriceChange(e.target.value)} 
                  className="bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-3 text-emerald-400 font-bold text-xs outline-none transition-all font-mono text-right pr-4" 
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">မူရင်းတန်ဖိုး (Before Discount)</label>
                <input 
                  type="text" 
                  placeholder="0" 
                  value={beforeDiscount} 
                  onChange={e => setBeforeDiscount(e.target.value)} 
                  className="bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-3 text-slate-400 font-mono text-xs outline-none transition-all text-right pr-4" 
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">ကျသင့်ငွေ (After Discount)*</label>
                <input 
                  type="text" 
                  required 
                  placeholder="0" 
                  value={afterDiscount} 
                  onChange={e => setAfterDiscount(e.target.value)} 
                  className="bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-3 text-yellow-400 font-bold font-mono text-xs outline-none transition-all text-right pr-4" 
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">သယ်ယူစရိတ် (Transport Charges)</label>
                <input 
                  type="text" 
                  placeholder="0" 
                  value={transportCharges} 
                  onChange={e => setTransportCharges(e.target.value)} 
                  className="bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-3 text-cyan-400 font-bold font-mono text-xs outline-none transition-all text-right pr-4" 
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">အထွေထွေအပိုစရိတ် (Additional Charges)</label>
                <input 
                  type="text" 
                  placeholder="0" 
                  value={additionalCharges} 
                  onChange={e => setAdditionalCharges(e.target.value)} 
                  className="bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-3 text-violet-400 font-bold font-mono text-xs outline-none transition-all text-right pr-4" 
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Pending (ရောက်ရန်ကျန်)</label>
                <select 
                  value={status} 
                  onChange={e => setStatus(e.target.value)} 
                  className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-xs outline-none cursor-pointer focus:border-indigo-500 transition-all font-bold"
                >
                  <option value="Received">Received (ရောက်ရှိပြီး)</option>
                  <option value="Pending">Pending (ရောက်ရန်ကျန်)</option>
                </select>
              </div>

              <div className="sm:col-span-2 md:col-span-4 flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Shop Name (ဆိုင်အမည်) / Remark</label>
                <input 
                  type="text" 
                  placeholder="ဥပမာ။ Ko Nay Myo" 
                  value={remark} 
                  onChange={e => setRemark(e.target.value)} 
                  className="bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-3 text-white text-xs outline-none transition-all font-bold" 
                />
              </div>
           </div>

           {/* Auto-save helper disclaimer */}
           <div className="bg-indigo-950/20 text-indigo-300 border border-indigo-500/10 px-4 py-2.5 rounded-xl text-[10px] font-bold flex items-center gap-1.5 font-sans mt-1">
              <span>⚙️</span>
              <span>ဝယ်ယူသော ပစ္စည်းနှင့် ဈေးနှုန်းအား Data Collection (Material Prices) တွင် အလိုအလျောက် မှတ်သားသိမ်းဆည်းပေးမည်။</span>
           </div>

           {/* Centered Green Save Pill Button */}
           <div className="flex justify-center pt-3">
              <button 
                type="submit" 
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold px-16 py-3 rounded-xl text-xs shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:scale-[1.02] active:scale-95 transition-all uppercase tracking-wider leading-none"
              >
                 SAVE
              </button>
           </div>
        </form>
      </div>

      {analysisReport && (
         <div className="bg-indigo-950/20 border border-indigo-500/30 p-5 rounded-2xl md:rounded-3xl relative animate-in fade-in duration-200">
            <button onClick={() => setAnalysisReport(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={16}/></button>
            <div className="flex items-center gap-2 mb-3">
               <Sparkles className="text-indigo-400" size={18} />
               <h4 className="font-bold text-sm text-indigo-300 uppercase tracking-wide">AI Financial Analysis Summary & Insights</h4>
            </div>
            <div className="text-slate-300 text-sm whitespace-pre-wrap leading-relaxed">
               {analysisReport}
            </div>
         </div>
      )}

      {/* Ledger Table Container */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl shadow-2xl overflow-hidden flex flex-col">
         {/* Table Toolbars */}
         <div className="p-4 bg-slate-950/50 border-b border-slate-800 flex items-center justify-between gap-4 flex-wrap">
            <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-2">LEDGER TRANSACTIONS RECORD</h5>
            
            <div className="relative flex-1 max-w-sm">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={15} />
               <input placeholder="പစ္စည်းအမည်၊ ဝယ်သူ သို့မဟုတ် အခြားရှာဖွေရန်..." value={search} onChange={e => setSearch(e.target.value)} className="w-full bg-slate-900 border border-slate-700/80 focus:border-indigo-500 rounded-xl pl-9 pr-4 py-2 text-xs text-white" />
            </div>

            <div className="flex gap-2 items-center flex-wrap">
               <button onClick={handleAnalyzeLedger} disabled={isAnalyzing} className="bg-indigo-600 hover:bg-indigo-500 border border-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 select-none">
                  {isAnalyzing ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Analysis
               </button>
               <input 
                 type="file" 
                 ref={fileImportRef} 
                 onChange={handleImportExcel} 
                 accept=".xlsx, .xls, .csv" 
                 className="hidden" 
               />
               <button 
                 onClick={() => fileImportRef.current?.click()}
                 className="bg-[#121f2f]/60 hover:bg-[#1b2f47] border border-blue-900/30 text-[#3ba2f8] px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 select-none"
               >
                 <Upload size={13} /> Import
               </button>
               <button onClick={exportToExcel} className="bg-slate-800 hover:bg-slate-700 text-emerald-400 hover:text-white border border-slate-700 px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 select-none">
                  <Download size={13}/> Export
               </button>
               {filteredTransactions.length > 0 && (
                 <button 
                   onClick={handleDeleteAll}
                   className="bg-rose-950/40 hover:bg-rose-900 border border-rose-800/80 text-rose-400 hover:text-rose-200 px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 select-none"
                   title="စာရင်းအားလုံးဖျက်မည်"
                 >
                   <Trash2 size={13} /> Delete All ({filteredTransactions.length})
                 </button>
               )}
            </div>
         </div>

         {/* Ledger Table */}
         <div className="overflow-x-auto overflow-y-auto max-h-[60vh] custom-scrollbar relative">
            <table className="w-full text-left whitespace-nowrap min-w-[1020px]">
               <thead className="bg-[#0b0f19] text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800">
                  <tr>
                     <th className="sticky top-0 bg-[#0b0f19] z-20 px-4 py-4 w-12 text-center">NO.</th>
                     <th className="sticky top-0 bg-[#0b0f19] z-20 px-4 py-4 w-28">DATE</th>
                     <th className="sticky top-0 bg-[#0b0f19] z-20 px-4 py-4">ITEM / DETAILS</th>
                     <th className="sticky top-0 bg-[#0b0f19] z-20 px-4 py-4">QTY & BALANCE</th>
                     <th className="sticky top-0 bg-[#0b0f19] z-20 px-4 py-4">AMOUNT & PRICE</th>
                     <th className="sticky top-0 bg-[#0b0f19] z-20 px-4 py-4">PERSON & STATUS</th>
                     <th className="sticky top-0 bg-[#0b0f19] z-20 px-4 py-4 text-center w-24">ACTION</th>
                     <th className="sticky top-0 bg-[#0b0f19] z-20 px-4 py-4">SHOP / REMARK</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-800/40">
                  {filteredTransactions.length === 0 ? (
                     <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-600 italic text-sm">No purchase ledger transactions recorded.</td></tr>
                  ) : filteredTransactions.map((tx, idx) => {
                      const qtyVal = Number(tx.qty) || 1;
                      const isOut = tx.entry_type === 'Stock Out';
                      const runningBal = computedBalances[tx.id] !== undefined ? computedBalances[tx.id] : qtyVal;
                      const absoluteNo = transactions.findIndex(t => t.id === tx.id) + 1;
                      const transVal = Number(tx.transport_charges) || 0;
                      const addVal = Number(tx.additional_charges) || 0;
                      const hasCharges = transVal > 0 || addVal > 0;
                      
                      return (
                         <tr key={tx.id} className="hover:bg-slate-800/20 transition-all font-sans text-xs">
                            {/* NO. */}
                            <td className="px-4 py-4 text-center text-slate-500 font-mono font-bold">
                               {absoluteNo}
                            </td>
                            
                            {/* DATE */}
                            <td className="px-4 py-4 text-slate-400 font-mono">
                               <span className="inline-flex items-center gap-1.5">
                                  <Calendar size={12} className="text-slate-500 shrink-0" />
                                  <span>{tx.date}</span>
                               </span>
                            </td>
                            
                            {/* ITEM / DETAILS */}
                            <td className="px-4 py-4">
                               <div className="flex flex-col gap-1">
                                  <span className="font-bold text-slate-100 text-sm">{tx.particular || tx.item || '-'}</span>
                                  <span className="text-[9px] font-bold text-orange-400 bg-orange-400/5 border border-orange-500/15 px-1.5 py-0.5 rounded uppercase tracking-wider w-max">
                                     PROJECT: {getProjectName(tx.projectId)}
                                  </span>
                               </div>
                            </td>
                            
                            {/* QTY & BALANCE */}
                            <td className="px-4 py-4">
                               <div className="flex flex-col gap-1.5 items-start">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wide ${
                                     isOut 
                                       ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                                       : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  }`}>
                                     {isOut ? `-${qtyVal} (${tx.status || 'Used'})` : `+${qtyVal} (In)`}
                                  </span>
                                  <span className="bg-blue-500/10 text-blue-400 border border-blue-500/15 px-2 py-0.5 rounded text-[10px] font-extrabold">
                                     Bal: {runningBal}
                                  </span>
                                </div>
                            </td>
                            
                            {/* AMOUNT & PRICE */}
                            <td className="px-4 py-4">
                               <div className="flex flex-col gap-1">
                                  {isOut ? (
                                     <>
                                        {hasCharges ? (
                                           <span className="font-bold text-slate-500 text-[11px]">No item price (Stock Out)</span>
                                        ) : (
                                           <span className="font-bold text-slate-500 text-sm">-</span>
                                        )}
                                     </>
                                  ) : (
                                     <div className="flex flex-col gap-0.5">
                                        <span className="font-bold text-slate-200 text-sm">
                                           {Number(tx.amount || 0).toLocaleString()}
                                        </span>
                                        <span className="text-[10px] text-slate-500 font-mono">
                                           @ {Number(tx.unit_price || 0).toLocaleString()}
                                        </span>
                                     </div>
                                  )}

                                  {hasCharges && (
                                     <div className="flex flex-col gap-0.5 border-t border-slate-800/60 pt-1 mt-1 text-[9px]">
                                        {transVal > 0 && (
                                           <span className="text-cyan-400 font-medium">
                                              🚚 Trans: +{transVal.toLocaleString()}
                                           </span>
                                        )}
                                        {addVal > 0 && (
                                           <span className="text-violet-400 font-medium">
                                              ➕ Extra: +{addVal.toLocaleString()}
                                           </span>
                                        )}
                                        <span className="text-yellow-400 font-black font-mono">
                                           Total Spent: {((isOut ? 0 : Number(tx.amount || 0)) + transVal + addVal).toLocaleString()}
                                        </span>
                                     </div>
                                  )}
                               </div>
                            </td>
                            
                            {/* PERSON & STATUS */}
                            <td className="px-4 py-4">
                               <div className="flex flex-col gap-1.5">
                                  <div>
                                     <p className="font-bold text-slate-200 text-xs">{tx.name || '-'}</p>
                                     {tx.receiver && tx.receiver !== '-' && (
                                        <p className="text-[10px] text-slate-500 font-semibold">Rcv: {tx.receiver}</p>
                                     )}
                                  </div>
                                  <span className={`w-max px-2 py-0.5 rounded text-[9px] font-black tracking-wider uppercase border ${
                                     isOut 
                                       ? 'bg-slate-950/45 text-slate-300 border-slate-700/40'
                                       : tx.status === 'Pending' 
                                         ? 'bg-amber-950/45 text-amber-400 border border-amber-500/15'
                                         : 'bg-emerald-950/45 text-emerald-400 border border-emerald-500/15'
                                  }`}>
                                     {isOut ? 'USED / OUT' : tx.status === 'Pending' ? 'PENDING' : 'RECEIVED'}
                                  </span>
                               </div>
                            </td>
                            
                            {/* ACTION */}
                            <td className="px-4 py-4 text-center">
                               <div className="inline-flex gap-1.5">
                                  <button onClick={() => setEditingItem(tx)} className="p-1.5 text-slate-400 hover:text-indigo-400 bg-slate-800/40 rounded-lg border border-slate-700/35 transition-all"><Pencil size={11}/></button>
                                  <button onClick={() => onDelete(tx.id)} className="p-1.5 text-slate-400 hover:text-rose-500 bg-slate-800/40 rounded-lg border border-slate-700/35 transition-all"><Trash2 size={11}/></button>
                               </div>
                            </td>
                            
                            {/* SHOP / REMARK */}
                            <td className="px-4 py-4 text-slate-300 font-medium">
                               {tx.remark || '-'}
                            </td>
                         </tr>
                      );
                  })}
               </tbody>
            </table>
         </div>

         {/* Total Summary Row styled exactly like screenshot */}
         <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-center items-center gap-1 text-xs md:text-sm text-emerald-400 font-bold select-none">
            <span>စုစုပေါင်း ဝယ်ယူမှု (TOTAL AMOUNT) :</span>
            <span className="font-mono text-base font-black text-emerald-400 ml-1">
               {stats.totalOut.toLocaleString()}
            </span>
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
  );
};
