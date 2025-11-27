import React, { useState, useEffect, useMemo, useRef } from 'react';
// --- FIREBASE BAĞLANTILARI ---
import { db } from './firebase'; 
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, setDoc } from 'firebase/firestore';

import { 
  LayoutDashboard, Wallet, ArrowRightLeft, PieChart as PieChartIcon, Settings, Search, Menu, X, Plus, Trash2, Edit2, Download, Upload, RefreshCw, TrendingUp, TrendingDown, AlertTriangle, Sparkles, Loader, DollarSign, Save, PiggyBank, ArrowDownToLine, ArrowUpFromLine, Lock, LogOut, KeyRound, ShieldCheck, Cloud, Wifi, WifiOff
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';

// --- Sabitler ---
const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6366F1'];

const ASSET_TYPES = [
  { id: 'stock', label: 'Hisse Senedi (BIST)', defaultCurrency: 'TRY' },
  { id: 'stock_us', label: 'Yabancı Hisse', defaultCurrency: 'USD' },
  { id: 'crypto', label: 'Kripto Para', defaultCurrency: 'USD' },
  { id: 'gold', label: 'Altın / Gümüş', defaultCurrency: 'TRY' },
  { id: 'forex', label: 'Döviz', defaultCurrency: 'TRY' },
  { id: 'fund', label: 'Yatırım Fonu', defaultCurrency: 'TRY' },
  { id: 'cash', label: 'Nakit', defaultCurrency: 'TRY' },
];

const CURRENCIES = ['TRY', 'USD', 'EUR', 'GBP'];

const formatNumber = (num) => {
  if (num === undefined || num === null) return '0';
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(num);
};

// --- ANA UYGULAMA ---

export default function App() {
  // --- AUTH & SYSTEM STATE ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [cloudPin, setCloudPin] = useState(null); // Buluttaki şifre
  const [loading, setLoading] = useState(true);   // Veri yükleniyor mu?
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // --- DATA STATE (Buluttan Gelecek) ---
  const [transactions, setTransactions] = useState([]);
  const [rates, setRates] = useState({ USD: 32.50, EUR: 35.20, GBP: 41.10, TRY: 1 });
  const [manualPrices, setManualPrices] = useState({});

  // --- UI STATE ---
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 768);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modallar
  const [modalMode, setModalMode] = useState('add');
  const [editingId, setEditingId] = useState(null);
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);

  // Form & AI
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [formData, setFormData] = useState({
    type: 'buy', assetType: 'stock', symbol: '', amount: '', price: '', currency: 'TRY', date: new Date().toISOString().split('T')[0], note: ''
  });
  const [priceUpdateData, setPriceUpdateData] = useState({});
  const [newPinData, setNewPinData] = useState("");

  const fileInputRef = useRef(null);

  // --- FIREBASE LISTENERS (GERÇEK ZAMANLI VERİ AKIŞI) ---
  useEffect(() => {
    // İnternet durumunu izle
    window.addEventListener('online', () => setIsOnline(true));
    window.addEventListener('offline', () => setIsOnline(false));

    // 1. İşlemleri Dinle
    const q = query(collection(db, "transactions"), orderBy("date", "desc"));
    const unsubTx = onSnapshot(q, (snapshot) => {
      const txData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTransactions(txData);
    });

    // 2. Ayarları (Kurlar, Fiyatlar, PIN) Dinle
    const unsubRates = onSnapshot(doc(db, "settings", "rates"), (doc) => {
       if (doc.exists()) setRates(doc.data());
    });
    const unsubPrices = onSnapshot(doc(db, "settings", "prices"), (doc) => {
       if (doc.exists()) setManualPrices(doc.data());
    });
    const unsubSecurity = onSnapshot(doc(db, "settings", "security"), (doc) => {
       if (doc.exists()) {
         setCloudPin(doc.data().pin);
       } else {
         setCloudPin(null); // Hiç şifre belirlenmemiş
       }
       setLoading(false); // İlk veriler geldi, yükleme bitti
    });

    return () => {
      window.removeEventListener('online', () => setIsOnline(true));
      window.removeEventListener('offline', () => setIsOnline(false));
      unsubTx(); unsubRates(); unsubPrices(); unsubSecurity();
    };
  }, []);


  // --- HESAPLAMA MOTORU ---
  const calculatedData = useMemo(() => {
    const holdings = {};
    let totalRealizedProfitTRY = 0;
    let totalInvestedMoneyTRY = 0;
    let totalWithdrawnMoneyTRY = 0;

    const sortedTx = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));

    sortedTx.forEach(tx => {
      const sym = tx.symbol.toUpperCase();
      const txAmount = parseFloat(tx.amount);
      const txPrice = parseFloat(tx.price);
      const rate = rates[tx.currency || 'TRY'] || 1;
      const txTotalValueTRY = txAmount * txPrice * rate;

      if (tx.type === 'buy') totalInvestedMoneyTRY += txTotalValueTRY;
      else if (tx.type === 'sell') totalWithdrawnMoneyTRY += txTotalValueTRY;
      
      if (!holdings[sym]) {
        holdings[sym] = { symbol: sym, assetType: tx.assetType, currency: tx.currency || 'TRY', amount: 0, totalCost: 0, avgCost: 0, realizedPL: 0 };
      }
      const h = holdings[sym];

      if (tx.type === 'buy') {
        h.totalCost += txAmount * txPrice;
        h.amount += txAmount;
        if (h.amount > 0) h.avgCost = h.totalCost / h.amount;
      } else if (tx.type === 'sell') {
        const costOfSoldTokens = txAmount * h.avgCost;
        const profit = (txAmount * txPrice) - costOfSoldTokens;
        h.realizedPL += profit;
        h.amount -= txAmount;
        h.totalCost -= costOfSoldTokens;
        if (h.amount <= 0) { h.amount = 0; h.totalCost = 0; h.avgCost = 0; }
      }
    });

    let portfolioTotalValueTRY = 0;
    let portfolioTotalUnrealizedPL_TRY = 0;
    
    const activeHoldings = Object.values(holdings).map(h => {
      const manualPrice = manualPrices[h.symbol];
      const lastTx = sortedTx.filter(t => t.symbol.toUpperCase() === h.symbol).pop();
      let currentPrice = (manualPrice !== undefined && manualPrice !== "") ? parseFloat(manualPrice) : (lastTx ? parseFloat(lastTx.price) : h.avgCost);
      
      const currentValue = h.amount * currentPrice;
      const unrealizedPL = currentValue - h.totalCost;
      const unrealizedPLPercent = h.totalCost > 0 ? (unrealizedPL / h.totalCost) * 100 : 0;
      const rate = rates[h.currency] || 1;
      const currentValueTRY = currentValue * rate;
      const unrealizedPL_TRY = unrealizedPL * rate;
      const realizedPL_TRY = h.realizedPL * rate;

      if (h.amount > 0) {
        portfolioTotalValueTRY += currentValueTRY;
        portfolioTotalUnrealizedPL_TRY += unrealizedPL_TRY;
      }
      totalRealizedProfitTRY += realizedPL_TRY;

      return { ...h, currentPrice, currentValue, unrealizedPL, unrealizedPLPercent, currentValueTRY, unrealizedPL_TRY, realizedPL_TRY };
    }).filter(h => h.amount > 0 || h.realizedPL !== 0);

    const currentHoldings = activeHoldings.filter(h => h.amount > 0);
    const netContributionTRY = totalInvestedMoneyTRY - totalWithdrawnMoneyTRY;

    return {
      holdings: currentHoldings, allHistory: activeHoldings,
      totalValueTRY: portfolioTotalValueTRY, totalUnrealizedPL_TRY: portfolioTotalUnrealizedPL_TRY,
      totalRealizedPL_TRY: totalRealizedProfitTRY, totalPL_TRY: portfolioTotalUnrealizedPL_TRY + totalRealizedProfitTRY,
      totalInvestedMoneyTRY, totalWithdrawnMoneyTRY, netContributionTRY
    };
  }, [transactions, rates, manualPrices]);


  // --- HANDLERS (Firebase Entegreli) ---

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!cloudPin) {
      if (pinInput.length < 4) { alert("Güvenlik için en az 4 hane girin."); return; }
      try {
        await setDoc(doc(db, "settings", "security"), { pin: pinInput });
        setIsAuthenticated(true);
      } catch (err) { alert("Şifre kaydedilemedi: " + err.message); }
    } else {
      if (pinInput === cloudPin) setIsAuthenticated(true);
      else { alert("Hatalı PIN!"); setPinInput(""); }
    }
  };

  const handleChangePin = async () => {
    if (newPinData.length < 4) { alert("En az 4 hane olmalı."); return; }
    try {
      await setDoc(doc(db, "settings", "security"), { pin: newPinData });
      setNewPinData("");
      alert("PIN güncellendi!");
    } catch (err) { alert("Güncelleme hatası."); }
  };

  const handleLogout = () => { setIsAuthenticated(false); setPinInput(""); };

  const handleSaveTransaction = async (e) => {
    e.preventDefault();
    const amount = parseFloat(formData.amount);
    const price = parseFloat(formData.price);
    if (amount <= 0 || price < 0) { alert("Geçersiz değerler."); return; }
    
    if (formData.type === 'sell') {
      const sym = formData.symbol.toUpperCase();
      const currentStock = transactions.reduce((acc, t) => {
         if (t.symbol.toUpperCase() === sym) return t.type === 'buy' ? acc + parseFloat(t.amount) : acc - parseFloat(t.amount);
         return acc;
      }, 0);
      if (modalMode === 'add' && amount > currentStock) { alert(`Yetersiz stok! Elde: ${currentStock}`); return; }
    }

    const txPayload = { ...formData, amount, price, symbol: formData.symbol.toUpperCase() };

    try {
      if (modalMode === 'edit' && editingId) {
        await updateDoc(doc(db, "transactions", editingId), txPayload);
      } else {
        await addDoc(collection(db, "transactions"), txPayload);
      }
      setIsTxModalOpen(false); resetForm();
    } catch (err) { alert("Kayıt başarısız: " + err.message); }
  };

  const handleDeleteTransaction = async (id) => {
    if (window.confirm("Silmek istediğine emin misin?")) {
      await deleteDoc(doc(db, "transactions", id));
    }
  };

  const handleSavePrices = async () => {
    const newPrices = {...manualPrices, ...priceUpdateData};
    setIsPriceModalOpen(false);
    try {
      await setDoc(doc(db, "settings", "prices"), newPrices);
    } catch(err) { console.error("Fiyat kaydı hatası", err); }
  };

  const handleRateChange = async (curr, val) => {
     const newRates = {...rates, [curr]: parseFloat(val) || 0};
     await setDoc(doc(db, "settings", "rates"), newRates);
  };

  const handleResetPortfolio = async () => {
    if (window.confirm("TÜM VERİLER SİLİNECEK! Emin misin?")) {
       transactions.forEach(async t => await deleteDoc(doc(db, "transactions", t.id)));
       await setDoc(doc(db, "settings", "prices"), {});
       alert("Portföy sıfırlandı.");
    }
  };

  const handleOpenAddModal = () => { resetForm(); setIsTxModalOpen(true); };
  const handleOpenPriceModal = () => {
    const initialData = {};
    calculatedData.holdings.forEach(h => { initialData[h.symbol] = h.currentPrice; });
    setPriceUpdateData(initialData);
    setIsPriceModalOpen(true);
  };
  const handleEditClick = (tx) => { setModalMode('edit'); setEditingId(tx.id); setFormData(tx); setIsTxModalOpen(true); };
  const resetForm = () => { setFormData({ type: 'buy', assetType: 'stock', symbol: '', amount: '', price: '', currency: 'TRY', date: new Date().toISOString().split('T')[0], note: '' }); setModalMode('add'); setEditingId(null); };
  
  const handleAiAnalysis = async () => {
    setIsAiModalOpen(true); if (aiAnalysis) return;
    setIsAiLoading(true);
    const apiKey = ""; // API KEY BURAYA
    const summary = { totalValue: formatNumber(calculatedData.totalValueTRY), totalProfit: formatNumber(calculatedData.totalPL_TRY), holdings: calculatedData.holdings.slice(0, 10).map(h => ({ s: h.symbol, v: h.currentValueTRY, p: h.unrealizedPLPercent })) };
    const prompt = `Finans asistanısın. Portföy verisi: ${JSON.stringify(summary)}. 1. Durumu özetle. 2. Riskli/Kârlı pozisyonu söyle. 3. Öneri ver. Türkçe, kısa, samimi.`;
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
      const data = await response.json(); setAiAnalysis(data.candidates?.[0]?.content?.parts?.[0]?.text || "Hata.");
    } catch (error) { setAiAnalysis("Bağlantı hatası."); } finally { setIsAiLoading(false); }
  };

  // --- RENDER ---
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white">
         <Loader className="animate-spin text-blue-500 mb-4" size={48} />
         <h2 className="text-xl font-bold">Buluta Bağlanılıyor...</h2>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-2xl w-full max-w-md text-center animate-in fade-in zoom-in-95 duration-300 relative overflow-hidden">
           <div className={`absolute top-0 left-0 w-full h-1 ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}></div>
           <div className="flex justify-center mb-6"><div className="bg-blue-100 p-4 rounded-full text-blue-600"><Lock size={48} /></div></div>
           <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">{cloudPin ? "Hoş Geldiniz" : "Bulut Kurulumu"}</h1>
           <p className="text-slate-500 mb-6">{cloudPin ? "Bulut verilerinize erişmek için PIN girin." : "Tüm cihazlarınızda geçerli olacak bir PIN belirleyin."}</p>
           <form onSubmit={handleLogin} className="space-y-4">
              <input type="password" inputMode="numeric" autoFocus placeholder={cloudPin ? "****" : "Yeni PIN Belirleyin"} className="w-full text-center text-3xl tracking-[0.5em] font-bold p-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 focus:ring-4 focus:ring-blue-500 outline-none transition-all" value={pinInput} onChange={(e) => setPinInput(e.target.value)} />
              <button type="submit" className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-lg shadow-lg transition-transform active:scale-95 disabled:opacity-50" disabled={!isOnline}>{isOnline ? (cloudPin ? "Giriş Yap" : "Şifreyi Kaydet") : "İnternet Yok"}</button>
           </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex text-slate-800 dark:text-slate-200 font-sans transition-colors duration-200">
      <aside className={`fixed md:sticky top-0 h-screen w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 z-40 transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center"><div className="flex items-center gap-2 font-bold text-xl text-blue-600"><Cloud size={24} /> <span>BulutPortföy</span></div><button className="md:hidden" onClick={() => setIsSidebarOpen(false)}><X size={20} /></button></div>
        <nav className="p-4 space-y-2">
          <button onClick={() => { setActiveTab('dashboard'); if(window.innerWidth < 768) setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'dashboard' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600' : 'hover:bg-slate-100 dark:hover:bg-slate-700'}`}><PieChartIcon size={20} /> Genel Bakış</button>
          <button onClick={() => { setActiveTab('holdings'); if(window.innerWidth < 768) setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'holdings' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600' : 'hover:bg-slate-100 dark:hover:bg-slate-700'}`}><Wallet size={20} /> Varlıklarım</button>
          <button onClick={() => { setActiveTab('transactions'); if(window.innerWidth < 768) setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'transactions' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600' : 'hover:bg-slate-100 dark:hover:bg-slate-700'}`}><ArrowRightLeft size={20} /> İşlem Geçmişi</button>
        </nav>
        <div className="absolute bottom-0 w-full p-4 border-t border-slate-100 dark:border-slate-700 space-y-2">
          <div className="flex items-center gap-2 px-4 py-2 text-xs text-slate-400">{isOnline ? <Wifi size={12} className="text-green-500"/> : <WifiOff size={12} className="text-red-500"/>} {isOnline ? "Buluta Bağlı" : "Bağlantı Yok"}</div>
          <button onClick={() => setIsSettingsOpen(true)} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400"><Settings size={20} /> Ayarlar</button>
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-sm font-bold"><LogOut size={20} /> Çıkış</button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-4 sticky top-0 z-30 flex justify-between items-center shadow-sm">
          <div className="flex items-center gap-4"><button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 hover:bg-slate-100 rounded-lg"><Menu size={20} /></button><h1 className="text-xl font-bold capitalize hidden sm:block">{activeTab === 'dashboard' ? 'Dashboard' : activeTab === 'holdings' ? 'Varlık Listesi' : 'İşlem Geçmişi'}</h1></div>
          <div className="flex items-center gap-3">
             <div className="hidden lg:flex items-center gap-4 text-xs font-mono bg-slate-100 dark:bg-slate-900 px-3 py-1.5 rounded-md text-slate-500 mr-2"><span>USD: <span className="text-slate-900 dark:text-white font-bold">{rates.USD}</span></span><span>EUR: <span className="text-slate-900 dark:text-white font-bold">{rates.EUR}</span></span></div>
             <button onClick={handleOpenPriceModal} className="hidden md:flex items-center gap-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 px-3 py-2 rounded-lg text-sm font-medium"><RefreshCw size={16} /> <span className="hidden lg:inline">Fiyatlar</span></button>
             <button onClick={handleAiAnalysis} className="hidden md:flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-3 py-2 rounded-lg text-sm font-medium shadow"><Sparkles size={16} /> AI</button>
             <button onClick={handleOpenAddModal} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-lg"><Plus size={18} /> <span className="hidden sm:inline">İşlem Ekle</span></button>
          </div>
        </header>

        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
          {activeTab === 'dashboard' && (
            <>
              {/* Nakit Akışı & Yatırım Dengesi (Akıllı Kart) */}
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-800 dark:to-slate-900 p-6 rounded-2xl text-white shadow-lg mb-6 relative overflow-hidden">
                 <div className="absolute top-0 right-0 p-8 opacity-10"><PiggyBank size={120}/></div>
                 <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="flex items-center gap-4"><div className="p-3 bg-white/10 rounded-xl"><ArrowDownToLine size={24} className="text-blue-300"/></div><div><p className="text-slate-400 text-xs font-bold uppercase">Toplam Yatırılan</p><p className="text-2xl font-bold">{formatNumber(calculatedData.totalInvestedMoneyTRY)} TL</p></div></div>
                    <div className="flex items-center gap-4"><div className="p-3 bg-white/10 rounded-xl"><ArrowUpFromLine size={24} className="text-purple-300"/></div><div><p className="text-slate-400 text-xs font-bold uppercase">Toplam Çekilen</p><p className="text-2xl font-bold">{formatNumber(calculatedData.totalWithdrawnMoneyTRY)} TL</p></div></div>
                    <div className={`flex items-center gap-4 border-l border-white/10 pl-8 ${calculatedData.netContributionTRY <= 0 ? 'text-emerald-400' : 'text-white'}`}>
                       <div>
                          {calculatedData.netContributionTRY > 0 ? (
                              <><p className="text-slate-400 text-xs font-bold uppercase">Net Maliyet (İçerdeki)</p><p className="text-3xl font-bold text-white">{formatNumber(calculatedData.netContributionTRY)} TL</p><p className="text-xs text-slate-400 mt-1">Cebinden çıkan net para</p></>
                          ) : (
                              <><p className="text-emerald-400/90 text-xs font-bold uppercase">Net Nakit (Cepte)</p><p className="text-3xl font-bold">+{formatNumber(Math.abs(calculatedData.netContributionTRY))} TL</p><p className="text-xs text-emerald-400/80 mt-1">Ana para çıktı, kâr cebe girdi! 🎉</p></>
                          )}
                       </div>
                    </div>
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm"><div className="text-slate-500 text-sm font-medium mb-1">Toplam Portföy Değeri</div><div className="text-3xl font-bold text-slate-900 dark:text-white">{formatNumber(calculatedData.totalValueTRY)} TL</div></div>
                 <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border-l-4 border-l-blue-500 shadow-sm"><div className="text-slate-500 text-sm font-medium mb-1">Gerçekleşmemiş Kâr</div><div className={`text-xl font-bold ${calculatedData.totalUnrealizedPL_TRY >= 0 ? 'text-blue-600' : 'text-red-500'}`}>{calculatedData.totalUnrealizedPL_TRY >= 0 ? '+' : ''}{formatNumber(calculatedData.totalUnrealizedPL_TRY)} TL</div></div>
                 <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border-l-4 border-l-emerald-500 shadow-sm"><div className="text-slate-500 text-sm font-medium mb-1">Gerçekleşen Kâr</div><div className={`text-xl font-bold ${calculatedData.totalRealizedPL_TRY >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{calculatedData.totalRealizedPL_TRY >= 0 ? '+' : ''}{formatNumber(calculatedData.totalRealizedPL_TRY)} TL</div></div>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm min-h-[350px] flex flex-col"><h3 className="font-bold text-lg mb-4">Varlık Dağılımı</h3>{calculatedData.holdings.length > 0 ? (<div className="flex-1"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={calculatedData.holdings} dataKey="currentValueTRY" nameKey="symbol" cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5}>{calculatedData.holdings.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}</Pie><Legend /></PieChart></ResponsiveContainer></div>) : <div className="flex-1 flex items-center justify-center text-slate-400">Veri yok.</div>}</div>
                <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col"><h3 className="font-bold text-lg mb-4">Portföy Liderleri</h3><div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-700/50"><tr><th className="px-4 py-3">Varlık</th><th className="px-4 py-3 text-right">Adet</th><th className="px-4 py-3 text-right">Değer (TL)</th><th className="px-4 py-3 text-right">Kâr/Zarar %</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-700">{calculatedData.holdings.sort((a,b) => b.currentValueTRY - a.currentValueTRY).slice(0, 5).map((h, i) => (<tr key={i}><td className="px-4 py-3 font-semibold">{h.symbol}</td><td className="px-4 py-3 text-right">{formatNumber(h.amount)}</td><td className="px-4 py-3 text-right font-bold">{formatNumber(h.currentValueTRY)}</td><td className={`px-4 py-3 text-right font-bold ${h.unrealizedPLPercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>%{h.unrealizedPLPercent.toFixed(2)}</td></tr>))}</tbody></table></div></div>
              </div>
            </>
          )}

          {activeTab === 'holdings' && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row justify-between items-center gap-4"><h2 className="font-bold text-lg">Varlıklarım</h2><div className="relative w-full sm:w-64"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input type="text" placeholder="Sembol Ara..." className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border-none focus:ring-2 focus:ring-blue-500 text-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div></div>
              <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-700/50"><tr><th className="px-4 py-3">Sembol</th><th className="px-4 py-3 text-right">Adet</th><th className="px-4 py-3 text-right">Ort. Maliyet</th><th className="px-4 py-3 text-right">Güncel</th><th className="px-4 py-3 text-right">Değer (TL)</th><th className="px-4 py-3 text-right">Açık K/Z</th><th className="px-4 py-3 text-right">Kesinleşen K/Z</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-700">{calculatedData.allHistory.filter(h => h.symbol.includes(searchTerm.toUpperCase())).map((h, i) => (<tr key={i}><td className="px-4 py-3 font-bold flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-500"></span> {h.symbol} <span className="text-[10px] px-1 bg-slate-100 rounded">{h.currency}</span></td><td className="px-4 py-3 text-right font-medium">{formatNumber(h.amount)}</td><td className="px-4 py-3 text-right text-slate-500">{formatNumber(h.avgCost)}</td><td className="px-4 py-3 text-right font-bold text-blue-600 cursor-pointer" onClick={handleOpenPriceModal}>{formatNumber(h.currentPrice)}</td><td className="px-4 py-3 text-right font-bold">{formatNumber(h.currentValueTRY)}</td><td className={`px-4 py-3 text-right ${h.unrealizedPL >= 0 ? 'text-blue-500' : 'text-red-500'}`}>{h.unrealizedPLPercent.toFixed(2)}%</td><td className={`px-4 py-3 text-right font-bold ${h.realizedPL_TRY >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{formatNumber(h.realizedPL_TRY)}</td></tr>))}</tbody></table></div>
            </div>
          )}

          {activeTab === 'transactions' && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
               <div className="p-4 border-b border-slate-100 dark:border-slate-700"><h2 className="font-bold text-lg">İşlem Geçmişi</h2></div>
               <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-700/50"><tr><th className="px-4 py-3">Tarih</th><th className="px-4 py-3">Tür</th><th className="px-4 py-3">Varlık</th><th className="px-4 py-3 text-right">Adet</th><th className="px-4 py-3 text-right">Fiyat</th><th className="px-4 py-3 text-right">Tutar</th><th className="px-4 py-3 text-center">İşlem</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-700">{transactions.map((t) => (<tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 group"><td className="px-4 py-3 text-slate-500">{t.date}</td><td className="px-4 py-3"><span className={`px-2 py-1 rounded text-xs font-bold ${t.type === 'buy' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{t.type === 'buy' ? 'Alış' : 'Satış'}</span></td><td className="px-4 py-3 font-semibold">{t.symbol}</td><td className="px-4 py-3 text-right">{formatNumber(t.amount)}</td><td className="px-4 py-3 text-right">{formatNumber(t.price)}</td><td className="px-4 py-3 text-right font-medium">{formatNumber(t.amount * t.price)}</td><td className="px-4 py-3 text-center"><div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100"><button onClick={() => handleEditClick(t)} className="p-1 hover:bg-blue-100 text-blue-600 rounded"><Edit2 size={16}/></button><button onClick={() => handleDeleteTransaction(t.id)} className="p-1 hover:bg-red-100 text-red-600 rounded"><Trash2 size={16}/></button></div></td></tr>))}</tbody></table></div>
            </div>
          )}
        </div>
      </main>

      {/* --- MODALLAR --- */}
      {isPriceModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[999] p-4">
           <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95"><div className="p-4 border-b flex justify-between items-center"><h2 className="font-bold flex items-center gap-2"><RefreshCw size={20}/> Güncel Fiyatlar</h2><button onClick={() => setIsPriceModalOpen(false)}><X /></button></div><div className="p-6 max-h-[60vh] overflow-y-auto space-y-3">{calculatedData.holdings.map(h => (<div key={h.symbol} className="flex items-center gap-4"><div className="w-20 font-bold">{h.symbol}</div><input type="number" step="any" className="flex-1 p-2 rounded border dark:bg-slate-700" value={priceUpdateData[h.symbol] || ''} onChange={(e) => setPriceUpdateData({...priceUpdateData, [h.symbol]: e.target.value})} /></div>))}</div><div className="p-4 bg-slate-50 dark:bg-slate-900/50 flex justify-end"><button onClick={handleSavePrices} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold">Kaydet</button></div></div>
        </div>
      )}

      {isTxModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[999] p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 border-b flex justify-between items-center"><h2 className="font-bold text-lg">İşlem</h2><button onClick={() => setIsTxModalOpen(false)}><X /></button></div>
            <form onSubmit={handleSaveTransaction} className="p-6 space-y-4">
               <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-lg"><button type="button" onClick={() => setFormData({...formData, type: 'buy'})} className={`py-2 rounded ${formData.type === 'buy' ? 'bg-white shadow text-green-600' : 'text-slate-500'}`}>ALIŞ</button><button type="button" onClick={() => setFormData({...formData, type: 'sell'})} className={`py-2 rounded ${formData.type === 'sell' ? 'bg-white shadow text-red-600' : 'text-slate-500'}`}>SATIŞ</button></div>
               <div className="grid grid-cols-2 gap-4"><div><label className="text-xs font-bold text-slate-500 block mb-1">Tür</label><select className="w-full p-2 border rounded dark:bg-slate-700" value={formData.assetType} onChange={e => { const t = ASSET_TYPES.find(x => x.id === e.target.value); setFormData({...formData, assetType: e.target.value, currency: t ? t.defaultCurrency : 'TRY'}); }}>{ASSET_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</select></div><div><label className="text-xs font-bold text-slate-500 block mb-1">Para Birimi</label><select className="w-full p-2 border rounded dark:bg-slate-700" value={formData.currency} onChange={e => setFormData({...formData, currency: e.target.value})}>{CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div></div>
               <div><label className="text-xs font-bold text-slate-500 block mb-1">Sembol</label><input required className="w-full p-2 border rounded uppercase font-bold tracking-wide dark:bg-slate-700" value={formData.symbol} onChange={e => setFormData({...formData, symbol: e.target.value})} /></div>
               <div className="grid grid-cols-2 gap-4"><div><label className="text-xs font-bold text-slate-500 block mb-1">Adet</label><input required type="number" step="any" className="w-full p-2 border rounded dark:bg-slate-700" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} /></div><div><label className="text-xs font-bold text-slate-500 block mb-1">Fiyat</label><input required type="number" step="any" className="w-full p-2 border rounded dark:bg-slate-700" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} /></div></div>
               <div><label className="text-xs font-bold text-slate-500 block mb-1">Tarih</label><input type="date" required className="w-full p-2 border rounded dark:bg-slate-700" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} /></div>
               <button type="submit" className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold">Kaydet</button>
            </form>
          </div>
        </div>
      )}

      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[999] p-4">
           <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
             <div className="p-4 border-b flex justify-between items-center"><h2 className="font-bold flex gap-2"><Settings /> Ayarlar</h2><button onClick={() => setIsSettingsOpen(false)}><X /></button></div>
             <div className="p-6 space-y-6">
                <div><h3 className="text-sm font-bold mb-2 flex gap-2"><DollarSign size={16}/> Kurlar (Bulut)</h3><div className="grid grid-cols-3 gap-2">{['USD', 'EUR', 'GBP'].map(c => (<div key={c}><label className="text-xs text-slate-500">{c}</label><input type="number" step="0.01" className="w-full p-1 border rounded text-sm dark:bg-slate-700" value={rates[c]} onChange={e => handleRateChange(c, e.target.value)} /></div>))}</div></div>
                <hr className="dark:border-slate-700"/>
                <div>
                   <h3 className="text-sm font-bold mb-2 flex gap-2"><KeyRound size={16}/> Şifre Değiştir</h3>
                   <div className="flex gap-2">
                      <input type="password" placeholder="Yeni PIN" className="flex-1 p-2 border rounded text-sm dark:bg-slate-700" value={newPinData} onChange={e => setNewPinData(e.target.value)} />
                      <button onClick={handleChangePin} className="px-4 py-2 bg-slate-800 text-white rounded text-sm">Güncelle</button>
                   </div>
                </div>
                <hr className="dark:border-slate-700"/>
                <div><h3 className="text-sm font-bold text-red-600 mb-2 flex gap-2"><AlertTriangle size={16}/> Sıfırla</h3><button onClick={handleResetPortfolio} className="w-full py-2 bg-red-50 text-red-600 border border-red-200 rounded text-sm font-bold">HER ŞEYİ SİL</button></div>
             </div>
           </div>
        </div>
      )}

      {isAiModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[999] p-4">
           <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-xl shadow-2xl"><div className="p-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-t-2xl flex justify-between"><h2 className="font-bold flex gap-2"><Sparkles /> AI</h2><button onClick={() => setIsAiModalOpen(false)}><X /></button></div><div className="p-6 min-h-[200px] max-h-[60vh] overflow-y-auto">{isAiLoading ? <div className="text-center text-slate-500"><Loader className="animate-spin inline mr-2"/> Analiz ediliyor...</div> : <div className="whitespace-pre-wrap text-sm">{aiAnalysis}</div>}</div></div>
        </div>
      )}
    </div>
  );
}