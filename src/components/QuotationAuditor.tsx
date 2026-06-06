/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Plus, Download, AlertCircle, X, Sparkles, Pencil, Loader2, ListTodo, ClipboardList,
  ChevronLeft, ChevronRight, Search, FileText, Check, Scan, Trash2, Volume2, GitMerge
} from 'lucide-react';
import { DataCollection, Employee } from '../types';
import { doc, collection, writeBatch, deleteDoc, updateDoc } from 'firebase/firestore';

interface QuotationAuditorProps {
  masterPrices: any[];
  currentProject: string | null;
  appId: string;
  db: any;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  setConfirmAction: (action: any) => void;
  onDeleteMaster: (id: string) => void;
}

export const QuotationAuditor: React.FC<QuotationAuditorProps> = ({
  masterPrices,
  currentProject,
  appId,
  db,
  showToast,
  setConfirmAction,
  onDeleteMaster
}) => {
  const [activeSection, setActiveSection] = useState<'master' | 'audit'>('master'); 

  const masterInputRef = useRef<HTMLInputElement>(null);
  const masterScanRef = useRef<HTMLInputElement>(null);
  
  const quoInputRef = useRef<HTMLInputElement>(null);
  const quoScanRef = useRef<HTMLInputElement>(null);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedQuo, setParsedQuo] = useState<any[]>([]);
  const [discrepancies, setDiscrepancies] = useState<any[]>([]);
  const [calcErrors, setCalcErrors] = useState<any[]>([]);
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchMaster, setSearchMaster] = useState('');
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [editingMaster, setEditingMaster] = useState<any | null>(null);

  // TTS State
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // State for Editable Scanned Quotation
  const [scannedQuo, setScannedQuo] = useState<any[] | null>(null);
  const [editingScannedIdx, setEditingScannedIdx] = useState<number | null>(null);
  const [editScannedForm, setEditScannedForm] = useState({ description: '', area: '', price: '', total: '' });

  const getBaseWorkType = (desc: string) => {
    if (!desc) return '';
    let text = String(desc).trim();
    const splitters = [' @', '@', ' for ', ' in ', '(', '[', ' - '];
    let base = text;
    for (const splitter of splitters) {
      const idx = base.toLowerCase().indexOf(splitter.toLowerCase());
      if (idx !== -1) {
        base = base.substring(0, idx);
      }
    }
    return base.trim();
  };

  const formatMoney = (val: any) => {
    if (val === null || val === undefined || val === '') return '';
    const parts = String(val).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join('.');
  };

  const parseMoney = (val: any) => {
    return String(val).replace(/,/g, '');
  };

  const loadXLSX = () => {
    return new Promise<any>((resolve) => {
      if ((window as any).XLSX) return resolve((window as any).XLSX);
      const script = document.createElement('script');
      script.src = "https://cdn.sheetjs.com/xlsx-0.20.0/package/dist/xlsx.full.min.js";
      script.onload = () => resolve((window as any).XLSX);
      document.head.appendChild(script);
    });
  };

  const handleClearAllMaster = () => {
    if (masterPrices.length === 0) return showToast("ဖျက်သိမ်းရန် Data မရှိပါ", "error");
    
    setConfirmAction({
       title: "Master Price များအားလုံး ဖျက်သိမ်းမည်",
       message: `လက်ရှိ Master Price List ထဲတွင်ရှိသော Data (${masterPrices.length}) ခုလုံးကို အပြီးတိုင် ဖျက်ပစ်မည်မှာ သေချာပါသလား?\n\n(ဤလုပ်ဆောင်ချက်ကို ပြန်လည်ရယူ၍ မရနိုင်ပါ)`,
       buttons: [
         { label: "မလုပ်ပါ (Cancel)", onClick: () => setConfirmAction(null) },
         { label: "အကုန်ဖျက်မည် (Clear All)", type: "danger", onClick: async () => {
             setConfirmAction(null);
             setIsProcessing(true);
             showToast("ဖျက်သိမ်းနေပါသည်...", "success");
             try {
                let batch = writeBatch(db);
                let count = 0;
                for (const item of masterPrices) {
                   batch.delete(doc(db, 'artifacts', appId, 'public', 'data', 'master_prices', item.id));
                   count++;
                   if (count >= 400) {
                      await batch.commit();
                      batch = writeBatch(db);
                      count = 0;
                   }
                }
                if (count > 0) await batch.commit();
                showToast("Master Price များအားလုံးကို အောင်မြင်စွာ ဖျက်သိမ်းပြီးပါပြီ", "success");
             } catch (e) {
                console.error(e);
                showToast("ဖျက်သိမ်းရာတွင် အမှားအယွင်းရှိပါသည်", "error");
             } finally {
                setIsProcessing(false);
             }
         }}
       ]
    });
  };

  const handleMasterUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentProject) return;
    setIsProcessing(true);
    showToast("Master Price List ဖတ်ရှုနေပါသည်...", "success");

    try {
      const fileData = await file.arrayBuffer();
      const XLSX = await loadXLSX(); 
      const wb = XLSX.read(fileData, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

      let headerRowIdx = rows.findIndex(r => r && r.some(c => typeof c === 'string' && (c.toLowerCase().includes('description') || c.toLowerCase().includes('item'))));
      if (headerRowIdx === -1) headerRowIdx = 0;

      const headers = rows[headerRowIdx].map(h => typeof h === 'string' ? h.toLowerCase().trim() : '');
      const descIdx = headers.findIndex(h => h.includes('description') || h === 'item');
      const priceIdx = headers.findIndex(h => h.includes('price') || h.includes('rate') || h.includes('unitprice'));

      if (descIdx === -1 || priceIdx === -1) throw new Error("Format မမှန်ကန်ပါ။ Description နှင့် Price ကော်လံများ လိုအပ်ပါသည်။");

      let batch = writeBatch(db);
      let count = 0;

      for (let i = headerRowIdx + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || !row[descIdx]) continue;
        const desc = String(row[descIdx]).trim();
        const price = Number(row[priceIdx]) || 0;
        if (price > 0) {
          const docRef = doc(collection(db, 'artifacts', appId, 'public', 'data', 'master_prices'));
          batch.set(docRef, { description: desc, price: price, projectId: 'global' });
          count++;
        }
      }
      
      await batch.commit();
      showToast(`Master Items (${count}) ခု သိမ်းဆည်းပြီးပါပြီ!`, "success");
    } catch (err: any) {
      showToast(err.message || "Master File ဖတ်၍မရပါ", "error");
    } finally {
      setIsProcessing(false);
      e.target.value = '';
    }
  };

  const handleScanMaster = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    showToast("Master Price ပုံ/ဖိုင်ကို AI ဖြင့် ဖတ်ရှုနေပါသည်...", "success");

    try {
        let promptText = `Extract master price list for construction/interior items from the file. Return ONLY a valid JSON ARRAY of objects. Format strictly like this: [{"description": "Item Name", "price": 15000}]. 
        CRITICAL: The "price" MUST be the UNIT PRICE (Rate), NOT the total amount. If the document has Area/Qty and Total Amount, compute Unit Price = Total / Area. Exclude all other text or markdown.`;

        let bodyPayload: any = {
            prompt: promptText
        };

        if (file.name.match(/\.(xlsx|xls|csv)$/i)) {
            const fileData = await file.arrayBuffer();
            const XLSX = await loadXLSX();
            const wb = XLSX.read(fileData, { type: 'array' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(ws);
            bodyPayload.sheetSnippet = JSON.stringify(rows.slice(0, 100));
        } else {
            const base64Data = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve((reader.result as string).split(',')[1]);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
            bodyPayload.fileData = base64Data;
            bodyPayload.mimeType = file.type || "image/jpeg";
        }

        // Call Server Proxy
        const responseResponse = await fetch("/api/gemini/scan-doc", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bodyPayload)
        });
        
        if (!responseResponse.ok) {
           throw new Error("Server API call failed");
        }

        const scanResult = await responseResponse.json();
        const text = scanResult.text;

        if (text) {
            let parsedArray = [];
            const arrayMatch = text.match(/\[[\s\S]*\]/);
            if (arrayMatch) {
                parsedArray = JSON.parse(arrayMatch[0]);
            } else if (text.match(/\{[\s\S]*\}/)) {
                parsedArray = [JSON.parse(text.match(/\{[\s\S]*\}/)[0])];
            }

            if (parsedArray.length > 0) {
                let batch = writeBatch(db);
                let batchCount = 0;
                
                for (const item of parsedArray) {
                    if (item.description && item.price) {
                        const newRef = doc(collection(db, 'artifacts', appId, 'public', 'data', 'master_prices'));
                        batch.set(newRef, { 
                            description: item.description, 
                            price: Number(item.price) || 0, 
                            projectId: 'global' 
                        });
                        batchCount++;
                    }
                }

                if (batchCount > 0) {
                    await batch.commit();
                    showToast(`Master Items (${batchCount}) ခုကို ထည့်သွင်းပြီးပါပြီ။`, "success");
                } else {
                    showToast("ဖိုင်ထဲမှ Data ရှာမတွေ့ပါ။", "error");
                }
            } else {
                showToast("JSON format မမှန်ကန်ပါ။", "error");
            }
        } else {
             showToast("Data ခွဲခြမ်းစိတ်ဖြာ၍ မရပါ။", "error");
        }
    } catch (err) {
        console.error(err);
        showToast("AI Scan လုပ်ရာတွင် အမှားအယွင်းရှိပါသည်", "error");
    } finally {
        setIsProcessing(false);
        if (masterScanRef.current) masterScanRef.current.value = '';
    }
  };

  const exportMasterPrices = async () => {
    if(masterPrices.length === 0) return showToast("Export ထုတ်ရန် Master Price Data မရှိပါ", "error");
    const XLSX = await loadXLSX(); 
    const wb = XLSX.utils.book_new();
    const data = masterPrices.map((m, index) => ({
      "No": index + 1,
      "Description": m.description,
      "Price Rate (Unit Price)": m.price
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Master Prices");
    XLSX.writeFile(wb, `Global_Master_Prices.xlsx`);
  };

  const filteredMaster = useMemo(() => {
      if(!searchMaster) return masterPrices;
      const lower = searchMaster.toLowerCase();
      return masterPrices.filter(m => m.description.toLowerCase().includes(lower));
  }, [masterPrices, searchMaster]);

  const handleQuotationUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsProcessing(true);
    showToast("Quotation ကို ဖတ်ရှုနေပါသည်...", "success");

    try {
      const fileData = await file.arrayBuffer();
      const XLSX = await loadXLSX(); 
      const wb = XLSX.read(fileData, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames.includes("Client Quotation") ? "Client Quotation" : wb.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

      let headerRowIdx = rows.findIndex(r => r && r.some(c => typeof c === 'string' && (c.toLowerCase().includes('description') || c.toLowerCase().includes('item'))));
      if (headerRowIdx === -1) headerRowIdx = 0;

      const headers = rows[headerRowIdx].map(h => typeof h === 'string' ? h.toLowerCase().trim() : '');
      const colIdx = {
        desc: headers.findIndex(h => h.includes('description') || h === 'item'),
        area: headers.findIndex(h => h === 'area' || h === 'qty'),
        price: headers.findIndex(h => h.includes('price') || h.includes('sqft') || h.includes('unitprice')),
        total: headers.findIndex(h => h === 'total amt' || h === 'total amount')
      };

      let extractedQuo: any[] = [];
      let runningSum = 0;

      for (let i = headerRowIdx + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || !row[colIdx.desc]) continue;
        
        const desc = String(row[colIdx.desc]).trim();
        const descLower = desc.toLowerCase();
        
        // Skip only exact 'total amount'
        if (descLower === 'total amount' || descLower === 'total') continue;

        const isNetBalance = descLower.includes('net balance') || descLower.includes('net amount') || descLower.includes('after discount') || descLower.includes('discount');

        const area = Number(row[colIdx.area]) || 0;
        const price = Number(row[colIdx.price]) || 0;
        const rawTotal = row[colIdx.total];
        let total = rawTotal !== undefined && rawTotal !== '' && rawTotal !== null ? Number(String(rawTotal).replace(/,/g,'')) : (area * price);

        if (isNetBalance) {
            const finalVal = total > 0 ? total : (price > 0 ? price : 0);
            if (total < 0) {
               extractedQuo.push({ description: desc, area: 1, price: total, total: total });
               runningSum += total;
            } else if (finalVal > 0 && finalVal < runningSum) {
               const discountAmt = runningSum - finalVal;
               extractedQuo.push({ description: "Discount / Net Balance Adjustment", area: 1, price: -discountAmt, total: -discountAmt });
            }
            continue;
        }

        if (desc && (price > 0 || total !== 0)) {
           extractedQuo.push({ description: desc, area, price, total });
           runningSum += total;
        }
      }

      setIsProcessing(false);
      
      if (extractedQuo.length > 0) {
          setScannedQuo(extractedQuo);
          setParsedQuo([]);
          setDiscrepancies([]);
          setCalcErrors([]);
          setAiReport(null);
          showToast("Quotation ဖတ်ရှုပြီးပါပြီ။ အချက်အလက်များစစ်ဆေး၍ Run Audit ကို နှိပ်ပါ။", "success");
      } else {
          showToast("Quotation Data ရှာမတွေ့ပါ။", "error");
      }

    } catch (err) {
      console.error(err);
      showToast("Quotation ဖတ်ရှုရာတွင် အမှားအယွင်းရှိပါသည်", "error");
      setIsProcessing(false);
    } finally {
      e.target.value = '';
    }
  };

  const handleScanQuotation = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessing(true);
    showToast("Quotation ပုံကို AI ဖြင့် ဖတ်ရှုနေပါသည်...", "success");

    try {
      const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(file);
      });

      const promptText = `Extract quotation details from the provided file/image. Return ONLY a valid JSON ARRAY of objects. Format strictly like this: [{"description": "Item Name", "area": 100, "price": 1500, "total": 150000}]. 
      
      CRITICAL RULES:
      1. Extract every item line.
      2. VERY IMPORTANT: If the document has a "Total Amount" (e.g., 52,660,000) and a final "Net Balance" / "Net Amount" / "After Discount" (e.g., 51,200,000), you MUST calculate the difference (e.g., 1,460,000).
      3. You MUST add this difference as a separate row at the end with negative values!
      Example: {"description": "Overall Discount / Net Balance Adjustment", "area": 1, "price": -1460000, "total": -1460000}.
      The sum of all "total" fields in your array MUST EXACTLY MATCH the document's final Net Balance.
      
      "area" (quantity/sqft), "price" (unit price), and "total" MUST be numbers exactly as written on the document. Do not auto-correct math errors. Exclude all other text or markdown.`;

      // Call Server Proxy
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
          let parsedArray = [];
          const arrayMatch = text.match(/\[[\s\S]*\]/);
          if (arrayMatch) parsedArray = JSON.parse(arrayMatch[0]);

          if (parsedArray.length > 0) {
              setScannedQuo(parsedArray);
              setParsedQuo([]);
              setDiscrepancies([]);
              setCalcErrors([]);
              setAiReport(null);
              showToast("Quotation ဖတ်ရှုပြီးပါပြီ။ အချက်အလက်များစစ်ဆေး၍ Run Audit ကို နှိပ်ပါ။", "success");
          } else {
              showToast("Quotation Data ရှာမတွေ့ပါ။", "error");
          }
      } else {
          showToast("Data ခွဲခြမ်းစိတ်ဖြာ၍ မရပါ။", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("AI Scan လုပ်ရာတွင် အမှားအယွင်းရှိပါသည်", "error");
    } finally {
      setIsProcessing(false);
      if (quoScanRef.current) quoScanRef.current.value = '';
    }
  };

  const handleEditScannedStart = (idx: number, item: any) => {
      setEditingScannedIdx(idx);
      setEditScannedForm({
          description: item.description || '',
          area: item.area || '',
          price: item.price || '',
          total: item.total || ''
      });
  };

  const handleEditScannedSave = (idx: number) => {
      if (!scannedQuo) return;
      const updated = [...scannedQuo];
      updated[idx] = {
          description: editScannedForm.description,
          area: Number(editScannedForm.area) || 0,
          price: Number(editScannedForm.price) || 0,
          total: Number(editScannedForm.total) || 0
      };
      setScannedQuo(updated);
      setEditingScannedIdx(null);
  };

  const handleDeleteScanned = (idx: number) => {
      if (!scannedQuo) return;
      const updated = scannedQuo.filter((_, i) => i !== idx);
      setScannedQuo(updated.length > 0 ? updated : null);
  };

  const handleAddScannedRow = () => {
      const newIdx = scannedQuo ? scannedQuo.length : 0;
      const newRow = { description: 'New Item', area: 1, price: 0, total: 0 };
      setScannedQuo(scannedQuo ? [...scannedQuo, newRow] : [newRow]);
      handleEditScannedStart(newIdx, newRow);
  };

  const processParsedQuotation = (extractedQuo: any[]) => {
    const mathErrors = extractedQuo.filter(q => q.area > 0 && q.price > 0 && Math.abs((q.area * q.price) - q.total) > 2);

    const uniqueBaseItemsMap = new Map();
    extractedQuo.forEach(q => {
        const baseType = getBaseWorkType(q.description);
        if (baseType && !uniqueBaseItemsMap.has(baseType.toLowerCase())) {
            uniqueBaseItemsMap.set(baseType.toLowerCase(), {
                ...q,
                baseType: baseType 
            });
        }
    });
    const uniqueBaseItems = Array.from(uniqueBaseItemsMap.values());

    if (masterPrices.length === 0) {
        setConfirmAction({
            title: "Master Price List တည်ဆောက်ခြင်း",
            message: "စနစ်ထဲတွင် Master Price List မရှိသေးပါ။ ဤ Quotation မှ လုပ်ငန်းအမျိုးအစားများကို Master စာရင်းအဖြစ် အလိုအလျောက် စုစည်းမှတ်သားမည်လား?",
            buttons: [
                { label: "မမှတ်သားပါ", onClick: () => { setConfirmAction(null); finalizeQuotationAudit(extractedQuo, [], false, [], mathErrors); } },
                { label: "မှတ်သားမည်", type: "primary", onClick: () => { setConfirmAction(null); finalizeQuotationAudit(extractedQuo, [], true, uniqueBaseItems, mathErrors); } }
            ]
        });
    } else {
        const newBaseTypesMap = new Map();
        const foundDiscrepancies: any[] = [];

        extractedQuo.forEach(quoItem => {
            const quoBaseType = getBaseWorkType(quoItem.description);
            const quoBaseTypeLower = quoBaseType.toLowerCase();

            let masterMatch = masterPrices.find(m => m.description.toLowerCase() === quoItem.description.toLowerCase());
            if (!masterMatch) {
               masterMatch = masterPrices.find(m => getBaseWorkType(m.description).toLowerCase() === quoBaseTypeLower);
            }

            if (!masterMatch) {
                if (!newBaseTypesMap.has(quoBaseTypeLower)) {
                    newBaseTypesMap.set(quoBaseTypeLower, { description: quoBaseType, price: quoItem.price });
                }
            } else if (masterMatch.price !== quoItem.price) {
                const dup = foundDiscrepancies.find(d => d.description === quoItem.description && d.quoPrice === quoItem.price);
                if (!dup) {
                    foundDiscrepancies.push({
                        description: quoItem.description,
                        baseTypeMatched: masterMatch.description,
                        masterPrice: masterMatch.price,
                        quoPrice: quoItem.price,
                        masterDocId: masterMatch.id
                    });
                }
            }
        });

        const newItems = Array.from(newBaseTypesMap.values());

        if (newItems.length > 0) {
            setConfirmAction({
                title: "Master Price List ထပ်တိုးခြင်း",
                message: `Quotation တွင် Master List ထဲ၌မပါဝင်သော လုပ်ငန်းအမျိုးအစားအသစ် (${newItems.length}) ခု ပါဝင်နေပါသည်။ ၎င်းတို့ကို Master စာရင်းသို့ အလိုအလျောက် ပေါင်းထည့်မည်လား?`,
                buttons: [
                    { label: "မထပ်တိုးပါ", onClick: () => { setConfirmAction(null); finalizeQuotationAudit(extractedQuo, foundDiscrepancies, false, [], mathErrors); } },
                    { label: "ထပ်တိုးမည်", type: "primary", onClick: () => { setConfirmAction(null); finalizeQuotationAudit(extractedQuo, foundDiscrepancies, true, newItems, mathErrors); } }
                ]
            });
        } else {
            finalizeQuotationAudit(extractedQuo, foundDiscrepancies, false, [], mathErrors);
        }
    }
  };

  const finalizeQuotationAudit = async (extractedQuo: any[], discrepanciesList: any[], shouldSaveMaster: boolean, itemsToSave: any[], mathErrors: any[]) => {
    setParsedQuo(extractedQuo);
    setDiscrepancies(discrepanciesList);
    setCalcErrors(mathErrors);

    if (shouldSaveMaster && itemsToSave.length > 0) {
        setIsProcessing(true);
        try {
            let batch = writeBatch(db);
            let count = 0;
            for (const item of itemsToSave) {
                const saveDesc = item.baseType ? item.baseType : getBaseWorkType(item.description);
                const docRef = doc(collection(db, 'artifacts', appId, 'public', 'data', 'master_prices'));
                batch.set(docRef, { description: saveDesc, price: item.price, projectId: 'global' });
                count++;
                if (count >= 400) {
                    await batch.commit();
                    batch = writeBatch(db);
                    count = 0;
                }
            }
            if (count > 0) await batch.commit();
            showToast(`Master Items အသစ် (${itemsToSave.length}) ခုကို မှတ်သားပြီးပါပြီ!`, "success");
        } catch (err) {
            console.error("Master Price Save Error", err);
            showToast("Master Price များ သိမ်းဆည်းရာတွင် အမှားရှိပါသည်", "error");
        }
    }

    generateQuotationAIReport(extractedQuo, discrepanciesList, mathErrors);
  };

  const generateQuotationAIReport = async (extractedQuo: any[], discrepanciesList: any[], mathErrors: any[]) => {
    setIsProcessing(true);
    showToast("AI ဖြင့် အသေးစိတ် စစ်ဆေးနေပါသည်...", "success");

    try {
      // Call Server Proxy Endpoint
      const response = await fetch("/api/gemini/audit-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extractedQuo, discrepancies: discrepanciesList, mathErrors })
      });

      if (!response.ok) {
         throw new Error("Server audit report API failed");
      }

      const reportResult = await response.json();
      setAiReport(reportResult.text || "AI Report မရရှိပါ။");
      showToast("စစ်ဆေးမှု ပြီးဆုံးပါပြီ။");
    } catch (e) {
      console.error(e);
      showToast("AI စစ်ဆေးမှု မအောင်မြင်ပါ", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const pcmToWav = (pcmData: ArrayBuffer, sampleRate = 24000) => {
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
    const blockAlign = numChannels * (bitsPerSample / 8);
    const dataSize = pcmData.byteLength;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);

    new Uint8Array(buffer, 44).set(new Uint8Array(pcmData));

    const blob = new Blob([buffer], { type: 'audio/wav' });
    return URL.createObjectURL(blob);
  };

  const handleReadAloud = async () => {
    if (isSpeaking) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setIsSpeaking(false);
      return;
    }

    if (!aiReport) return;

    setIsSpeaking(true);
    showToast("အသံဖိုင် ပြင်ဆင်နေပါသည်...", "success");
    try {
      // Call Server Proxy Endpoint
      const response = await fetch("/api/gemini/tts", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ text: aiReport })
      });

      if (!response.ok) {
         throw new Error("Server TTS API failed");
      }

      const result = await response.json();
      const base64Audio = result.audio;
      
      if (base64Audio) {
        const binaryStr = window.atob(base64Audio);
        const buffer = new ArrayBuffer(binaryStr.length);
        const view = new Uint8Array(buffer);
        for (let i = 0; i < binaryStr.length; i++) {
            view[i] = binaryStr.charCodeAt(i);
        }
        
        const audioUrl = pcmToWav(buffer, 24000);
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        audio.onended = () => setIsSpeaking(false);
        audio.play();
      } else {
        throw new Error("No audio payload returned");
      }
    } catch (err) {
      console.error(err);
      showToast("အသံထွက်ဖတ်၍မရပါ", "error");
      setIsSpeaking(false);
    }
  };

  const handleUpdateMasterPrice = async (docId: string, newPrice: number, index: number) => {
    if (!docId) return;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'master_prices', docId), { price: newPrice });
      showToast("Master Price Update လုပ်ပြီးပါပြီ", "success");
      setDiscrepancies(prev => prev.filter((_, i) => i !== index));
    } catch (e) {
      showToast("Update မအောင်မြင်ပါ", "error");
    }
  };

  const handleSaveMasterEdit = async (updatedItem: any) => {
    if (!updatedItem.description || updatedItem.price === '') return showToast("အချက်အလက်ပြည့်စုံစွာထည့်ပါ", "error");
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'master_prices', updatedItem.id), { 
          description: updatedItem.description, 
          price: Number(updatedItem.price) 
      });
      showToast("Master Price ပြင်ဆင်ပြီးပါပြီ", "success");
      setEditingMaster(null);
    } catch (e) {
      console.error(e);
      showToast("ပြင်ဆင်၍မရပါ", "error");
    }
  };

  const filteredDiscrepancies = useMemo(() => {
    if (!searchTerm) return discrepancies;
    const lower = searchTerm.toLowerCase();
    return discrepancies.filter(d => 
       d.description.toLowerCase().includes(lower) || 
       d.baseTypeMatched.toLowerCase().includes(lower)
    );
  }, [discrepancies, searchTerm]);

  return (
    <div className="space-y-6 md:space-y-8">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <h2 className="text-xl font-black text-white uppercase tracking-tight">Client Quotation</h2>
          <p className="text-xs text-slate-500 mt-1 font-sans">
            AI Automated Quotation Auditor &amp; Master Price Directory
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 md:gap-3 bg-slate-900 p-2 md:p-3 rounded-2xl md:rounded-3xl border border-slate-800">
          <button 
             onClick={() => setActiveSection('master')}
             className={`flex-1 min-w-[150px] py-2 md:py-3 px-4 rounded-xl md:rounded-2xl text-xs sm:text-sm font-bold transition-all ${activeSection === 'master' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800'}`}
          >
             Master Price List
          </button>
          <button 
             onClick={() => setActiveSection('audit')}
             className={`flex-1 min-w-[150px] py-2 md:py-3 px-4 rounded-xl md:rounded-2xl text-xs sm:text-sm font-bold transition-all ${activeSection === 'audit' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800'}`}
          >
             Quotation Audit
          </button>
      </div>

      {activeSection === 'master' && (
         <div className="space-y-6 animate-in slide-in-from-bottom-2">
            <div className="bg-slate-900 border border-slate-800 p-6 md:p-8 rounded-3xl shadow-xl flex flex-col sm:flex-row gap-6 items-start sm:items-center justify-between">
                <div>
                   <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2"><ClipboardList className="text-indigo-400"/> Master Price List</h3>
                   <p className="text-xs text-slate-400">ကုမ္ပဏီ၏ စံသတ်မှတ်ထားသော စျေးနှုန်းများကို ဤနေရာတွင် စီမံပါ။</p>
                </div>
                <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                   <input type="file" accept=".xlsx, .xls, .csv" ref={masterInputRef} onChange={handleMasterUpload} className="hidden" />
                   <input type="file" accept="image/*, .pdf" ref={masterScanRef} onChange={handleScanMaster} className="hidden" />
                   
                   <button onClick={() => masterInputRef.current?.click()} disabled={isProcessing} className="flex-1 sm:flex-none bg-slate-800 hover:bg-slate-700 text-indigo-400 hover:text-white border border-slate-700 font-bold py-2.5 px-4 rounded-xl transition-all text-xs flex justify-center items-center gap-2">
                     {isProcessing ? <Loader2 size={14} className="animate-spin"/> : <Download size={14}/>} Bulk Import
                   </button>
                   <button onClick={() => masterScanRef.current?.click()} disabled={isProcessing} className="flex-1 sm:flex-none bg-slate-800 hover:bg-slate-700 text-emerald-400 hover:text-white border border-slate-700 font-bold py-2.5 px-4 rounded-xl transition-all text-xs flex justify-center items-center gap-2">
                     {isProcessing ? <Loader2 size={14} className="animate-spin"/> : <Scan size={14}/>} Scan Data
                   </button>
                   <button onClick={exportMasterPrices} disabled={masterPrices.length === 0} className="flex-1 sm:flex-none bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 font-bold py-2.5 px-4 rounded-xl transition-all text-xs flex justify-center items-center gap-2 disabled:opacity-50">
                     <Download size={14}/> Export
                   </button>
                </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-xl overflow-hidden w-full flex flex-col">
               <div className="p-4 bg-slate-950/50 border-b border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="relative w-full sm:max-w-sm flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                    <input 
                      type="text" placeholder="Search Master Prices..." value={searchMaster} onChange={e => setSearchMaster(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 focus:border-indigo-500 rounded-xl pl-10 pr-4 py-2 text-sm text-white outline-none transition-all"
                    />
                  </div>
                  <div className="flex items-center gap-2 md:gap-4 w-full sm:w-auto">
                      <button onClick={handleClearAllMaster} disabled={isProcessing || masterPrices.length === 0} className="flex-1 sm:flex-none bg-rose-900/20 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/30 font-bold py-2.5 px-4 rounded-xl transition-all text-xs flex justify-center items-center gap-2 disabled:opacity-50" title="Clear All Data">
                         <Trash2 size={14}/> Clear All
                      </button>
                      <button onClick={() => setIsMergeModalOpen(true)} className="flex-1 sm:flex-none bg-indigo-900/30 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 font-bold py-2.5 px-4 rounded-xl transition-all text-xs flex justify-center items-center gap-2">
                         <GitMerge size={14}/> Merge Data
                      </button>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest hidden lg:block">Total: {filteredMaster.length} Items</span>
                  </div>
               </div>
               <div className="overflow-x-auto overflow-y-auto w-full max-h-[60vh] custom-scrollbar relative">
                  <table className="w-full text-left whitespace-nowrap min-w-[500px]">
                    <thead className="bg-slate-950/90 backdrop-blur-md text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800 sticky top-0 z-10">
                      <tr>
                        <th className="px-6 py-4 w-12 text-center">No.</th>
                        <th className="px-6 py-4">Item Description</th>
                        <th className="px-6 py-4 text-right">Price Rate (Unit Price)</th>
                        <th className="px-6 py-4 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {filteredMaster.length === 0 ? (
                         <tr><td colSpan={4} className="px-6 py-10 text-center text-slate-500 italic text-sm">No master prices found.</td></tr>
                      ) : filteredMaster.map((m, index) => (
                         editingMaster?.id === m.id ? (
                            <tr key={m.id} className="hover:bg-slate-800/30 transition-all bg-indigo-900/20">
                              <td className="px-6 py-3 text-center text-slate-500 font-mono text-xs">{index + 1}</td>
                              <td className="px-6 py-3">
                                  <input 
                                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-indigo-500" 
                                      value={editingMaster.description} 
                                      onChange={e => setEditingMaster({...editingMaster, description: e.target.value})} 
                                  />
                              </td>
                              <td className="px-6 py-3">
                                  <input 
                                      type="text" 
                                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-indigo-500 text-right font-mono" 
                                      value={formatMoney(editingMaster.price)} 
                                      onChange={e => {
                                          const raw = parseMoney(e.target.value);
                                          if (/^\d*\.?\d*$/.test(raw)) setEditingMaster({...editingMaster, price: raw});
                                      }} 
                                  />
                              </td>
                              <td className="px-6 py-3 text-center">
                                  <div className="flex justify-center gap-2">
                                      <button onClick={() => handleSaveMasterEdit(editingMaster)} className="p-2 text-emerald-400 hover:bg-emerald-500/20 rounded-xl transition-all"><Check size={14}/></button>
                                      <button onClick={() => setEditingMaster(null)} className="p-2 text-rose-400 hover:bg-rose-500/20 rounded-xl transition-all"><X size={14}/></button>
                                  </div>
                              </td>
                            </tr>
                         ) : (
                            <tr key={m.id} className="hover:bg-slate-800/30 transition-all">
                              <td className="px-6 py-4 text-center text-slate-500 font-mono text-xs">{index + 1}</td>
                              <td className="px-6 py-4 font-bold text-slate-200 text-sm">{m.description}</td>
                              <td className="px-6 py-4 text-right font-mono text-emerald-400 text-sm">{Number(m.price).toLocaleString()}</td>
                              <td className="px-6 py-4 text-center">
                                <div className="flex justify-center gap-2">
                                    <button onClick={() => setEditingMaster(m)} className="p-2 text-slate-500 hover:text-indigo-400 bg-slate-800/50 rounded-xl transition-all"><Pencil size={14}/></button>
                                    <button onClick={() => onDeleteMaster(m.id)} className="p-2 text-slate-500 hover:text-rose-500 bg-slate-800/50 rounded-xl transition-all"><Trash2 size={14}/></button>
                                </div>
                              </td>
                            </tr>
                         )
                      ))}
                    </tbody>
                  </table>
               </div>
            </div>
         </div>
      )}

      {activeSection === 'audit' && (
         <div className="space-y-6 animate-in slide-in-from-bottom-2">
            <div className="bg-slate-900 border border-emerald-500/30 p-6 md:p-8 rounded-3xl shadow-xl shadow-emerald-900/10 flex flex-col sm:flex-row gap-6 items-start sm:items-center justify-between relative overflow-hidden">
               <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none"></div>
               <div className="relative z-10">
                   <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2"><FileText className="text-emerald-400"/> Quotation Audit</h3>
                   <p className="text-xs text-slate-400">စစ်ဆေးလိုသော Quotation ဖိုင် (သို့) ပုံကို တင်ပါ။</p>
               </div>
               <div className="flex w-full sm:w-auto gap-3 relative z-10">
                   <input type="file" accept=".xlsx, .xls" ref={quoInputRef} onChange={handleQuotationUpload} className="hidden" />
                   <input type="file" accept="image/*, .pdf" ref={quoScanRef} onChange={handleScanQuotation} className="hidden" />
                   
                   <button onClick={() => quoInputRef.current?.click()} disabled={isProcessing} className="flex-1 sm:flex-none bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg shadow-indigo-500/30 text-sm flex justify-center items-center gap-2 disabled:opacity-50">
                     {isProcessing ? <Loader2 size={16} className="animate-spin"/> : <FileText size={16}/>} Excel Audit
                   </button>
                   
                   <button onClick={() => quoScanRef.current?.click()} disabled={isProcessing} className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg shadow-emerald-500/30 text-sm flex justify-center items-center gap-2 disabled:opacity-50">
                     {isProcessing ? <Loader2 size={16} className="animate-spin"/> : <Scan size={16}/>} Scan Image
                   </button>
               </div>
            </div>

            {scannedQuo && (
              <div className="bg-slate-900 border border-indigo-500/30 rounded-3xl shadow-xl overflow-hidden w-full flex flex-col mb-6 animate-in fade-in">
                 <div className="p-4 md:p-5 bg-indigo-500/10 border-b border-indigo-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                     <div className="flex items-center gap-3">
                        <ListTodo className="text-indigo-400" size={20}/>
                        <div>
                            <h3 className="text-sm font-bold text-indigo-300 uppercase tracking-widest">Scanned Quotation Items ({scannedQuo.length})</h3>
                            <p className="text-[10px] text-slate-400 mt-1">လိုအပ်ပါက စစ်ဆေးမှု (Audit) မလုပ်ခင် အချက်အလက်များကို ကြိုတင်ပြင်ဆင်နိုင်ပါသည်။</p>
                        </div>
                     </div>
                     <div className="flex items-center gap-2 w-full sm:w-auto">
                         <button onClick={handleAddScannedRow} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2">
                             <Plus size={14}/> Add Row
                         </button>
                         <button onClick={() => processParsedQuotation(scannedQuo)} className="flex-1 sm:flex-none bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-lg transition-all flex items-center justify-center gap-2">
                             <Sparkles size={14}/> Run Audit
                         </button>
                     </div>
                 </div>
                 <div className="overflow-x-auto w-full custom-scrollbar max-h-[50vh]">
                    <table className="w-full text-left whitespace-nowrap min-w-[700px]">
                       <thead className="bg-slate-950/90 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800 sticky top-0 z-10">
                          <tr>
                             <th className="px-4 py-4 w-10 text-center">No.</th>
                             <th className="px-4 py-4">Description</th>
                             <th className="px-4 py-4 text-right">Qty/Area</th>
                             <th className="px-4 py-4 text-right">Unit Price</th>
                             <th className="px-4 py-4 text-right">Total Amount</th>
                             <th className="px-4 py-4 text-center">Actions</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-800/50">
                          {scannedQuo.map((item, idx) => (
                              editingScannedIdx === idx ? (
                                  <tr key={idx} className="bg-indigo-900/20">
                                      <td className="px-4 py-3 text-center text-slate-500 font-mono text-xs">{idx + 1}</td>
                                      <td className="px-4 py-3"><input value={editScannedForm.description} onChange={e=>setEditScannedForm({...editScannedForm, description: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-indigo-500" placeholder="Item Name"/></td>
                                      <td className="px-4 py-3"><input type="number" value={editScannedForm.area} onChange={e=>setEditScannedForm({...editScannedForm, area: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none text-right focus:border-indigo-500" placeholder="Area/Qty" /></td>
                                      <td className="px-4 py-3"><input type="number" value={editScannedForm.price} onChange={e=>setEditScannedForm({...editScannedForm, price: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none text-right focus:border-indigo-500" placeholder="Unit Price" /></td>
                                      <td className="px-4 py-3"><input type="number" value={editScannedForm.total} onChange={e=>setEditScannedForm({...editScannedForm, total: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-emerald-400 font-bold outline-none text-right focus:border-indigo-500" placeholder="Total" /></td>
                                      <td className="px-4 py-3 text-center">
                                          <div className="flex justify-center gap-1">
                                              <button onClick={() => handleEditScannedSave(idx)} className="p-1.5 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white rounded-lg transition-all"><Check size={14}/></button>
                                              <button onClick={() => setEditingScannedIdx(null)} className="p-1.5 bg-slate-800 text-rose-400 hover:bg-rose-500 hover:text-white rounded-lg transition-all"><X size={14}/></button>
                                          </div>
                                      </td>
                                  </tr>
                              ) : (
                                  <tr key={idx} className="hover:bg-slate-800/30 transition-all">
                                      <td className="px-4 py-3 text-center text-slate-500 font-mono text-xs">{idx + 1}</td>
                                      <td className="px-4 py-3 font-bold text-slate-200 text-xs">{item.description}</td>
                                      <td className="px-4 py-3 text-right text-slate-400 text-xs font-mono">{item.area}</td>
                                      <td className="px-4 py-3 text-right text-slate-400 text-xs font-mono">{item.price}</td>
                                      <td className={`px-4 py-3 text-right text-xs font-mono font-bold ${item.total < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>{item.total}</td>
                                      <td className="px-4 py-3 text-center">
                                          <div className="flex justify-center gap-1">
                                              <button onClick={() => handleEditScannedStart(idx, item)} className="p-1.5 text-slate-500 hover:text-indigo-400 hover:bg-slate-800 rounded-lg transition-all"><Pencil size={14}/></button>
                                              <button onClick={() => handleDeleteScanned(idx)} className="p-1.5 text-slate-500 hover:text-rose-500 hover:bg-slate-800 rounded-lg transition-all"><Trash2 size={14}/></button>
                                          </div>
                                      </td>
                                  </tr>
                              )
                          ))}
                       </tbody>
                       <tfoot className="bg-slate-900/90 backdrop-blur-sm sticky bottom-0 border-t border-slate-800">
                           <tr>
                               <td colSpan={4} className="px-4 py-4 text-right font-bold text-slate-400 uppercase tracking-widest text-[10px]">Net Total:</td>
                               <td className="px-4 py-4 text-right font-black text-emerald-400 text-sm">
                                   {scannedQuo.reduce((acc, curr) => acc + (Number(curr.total) || 0), 0).toLocaleString()}
                               </td>
                               <td></td>
                           </tr>
                       </tfoot>
                    </table>
                 </div>
              </div>
            )}

            {calcErrors.length > 0 && (
              <div className="bg-slate-900 border border-amber-500/30 rounded-3xl shadow-2xl overflow-hidden w-full flex flex-col mb-6 animate-in slide-in-from-bottom-4">
                <div className="p-4 md:p-5 bg-amber-500/10 border-b border-amber-500/20 flex items-center gap-3">
                   <AlertCircle className="text-amber-400" size={20}/>
                   <h3 className="text-sm font-bold text-amber-300 uppercase tracking-widest">တွက်ချက်မှု မှားယွင်းနေသော အရာများ ({calcErrors.length})</h3>
                </div>
                <div className="overflow-x-auto w-full custom-scrollbar relative">
                  <table className="w-full text-left whitespace-nowrap min-w-[700px]">
                    <thead className="bg-slate-950/90 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800">
                      <tr>
                        <th className="px-6 py-4 w-10 text-center">No.</th>
                        <th className="px-6 py-4">Item Description</th>
                        <th className="px-6 py-4 text-right">Qty / Area</th>
                        <th className="px-6 py-4 text-right">Unit Price</th>
                        <th className="px-6 py-4 text-right text-emerald-400">Expected Total</th>
                        <th className="px-6 py-4 text-right text-rose-400">Written Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {calcErrors.map((err, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/30 transition-all">
                          <td className="px-6 py-4 text-center text-slate-500 font-mono text-xs">{idx + 1}</td>
                          <td className="px-6 py-4 font-bold text-slate-200 text-xs">{err.description}</td>
                          <td className="px-6 py-4 text-right text-slate-400 text-xs font-mono">{Number(err.area).toLocaleString()}</td>
                          <td className="px-6 py-4 text-right text-slate-400 text-xs font-mono">{Number(err.price).toLocaleString()}</td>
                          <td className="px-6 py-4 text-right font-mono text-emerald-400 text-xs">{Number(err.area * err.price).toLocaleString()}</td>
                          <td className="px-6 py-4 text-right font-black text-rose-400 text-xs">{Number(err.total).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {discrepancies.length > 0 && (
              <div className="bg-slate-900 border border-rose-500/30 rounded-3xl shadow-2xl overflow-hidden w-full flex flex-col">
                <div className="p-4 md:p-5 bg-rose-500/10 border-b border-rose-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                   <div className="flex items-center gap-3">
                       <AlertCircle className="text-rose-400" size={20}/>
                       <h3 className="text-sm font-bold text-rose-300 uppercase tracking-widest">ကွာဟချက်များ ({filteredDiscrepancies.length})</h3>
                   </div>
                   <div className="relative w-full sm:w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                      <input 
                        type="text" placeholder="Search discrepancy..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-rose-500 rounded-xl pl-10 pr-4 py-2 text-sm text-white outline-none transition-all"
                      />
                   </div>
                </div>
                <div className="overflow-x-auto overflow-y-auto w-full max-h-[60vh] custom-scrollbar relative border-t border-slate-800">
                  <table className="w-full text-left whitespace-nowrap min-w-[700px]">
                    <thead className="bg-slate-950/90 backdrop-blur-md text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800 sticky top-0 z-10">
                      <tr>
                        <th className="px-6 py-4 w-10 text-center">No.</th>
                        <th className="px-6 py-4">Quotation Item (စစ်ဆေးသည့်အမည်)</th>
                        <th className="px-6 py-4 text-slate-400">Matched Base Work (တိုက်စစ်သည့်အမည်)</th>
                        <th className="px-6 py-4 text-right">Master Price Rate</th>
                        <th className="px-6 py-4 text-right text-rose-400">Quotation Price</th>
                        <th className="px-6 py-4 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {filteredDiscrepancies.length === 0 ? (
                        <tr><td colSpan={6} className="px-6 py-10 text-center text-slate-500 italic text-sm">ရှာဖွေမှုရလဒ် မတွေ့ရှိပါ။</td></tr>
                      ) : filteredDiscrepancies.map((d, index) => (
                        <tr key={index} className="hover:bg-slate-800/30 transition-all">
                          <td className="px-6 py-4 text-center text-slate-500 font-mono text-xs">{index + 1}</td>
                          <td className="px-6 py-4 font-bold text-slate-200 text-xs md:text-sm">{d.description}</td>
                          <td className="px-6 py-4 text-slate-400 text-xs italic">{d.baseTypeMatched}</td>
                          <td className="px-6 py-4 text-right text-slate-400 font-mono text-sm">{Number(d.masterPrice).toLocaleString()}</td>
                          <td className="px-6 py-4 text-right font-black text-rose-400 text-sm">{Number(d.quoPrice).toLocaleString()}</td>
                          <td className="px-6 py-4 text-center">
                            <button 
                               onClick={() => handleUpdateMasterPrice(d.masterDocId, d.quoPrice, index)} 
                               className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/40 border border-emerald-500/30 text-emerald-400 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all"
                            >
                               Update Master Price
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {aiReport && (
               <div className="bg-slate-900 border border-indigo-500/30 rounded-3xl p-6 md:p-8 shadow-2xl animate-in slide-in-from-bottom-4">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
                     <h3 className="text-lg font-black text-white flex items-center gap-3"><Sparkles className="text-indigo-400" /> AI Audit Report</h3>
                     <button 
                        onClick={handleReadAloud} 
                        className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${isSpeaking ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500 hover:text-white'}`}
                     >
                         <Volume2 size={16} />
                         {isSpeaking ? 'Stop Reading' : 'Read Aloud (အသံဖြင့်နားထောင်မည်)'}
                     </button>
                  </div>
                  <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 text-slate-300 text-sm whitespace-pre-line leading-relaxed">
                     {aiReport}
                  </div>
               </div>
            )}
         </div>
      )}
    </div>
  );
};
