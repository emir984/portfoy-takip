import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  LayoutDashboard, 
  Wallet, 
  ArrowRightLeft, 
  PieChart as PieChartIcon, 
  Settings, 
  Search,
  Menu,
  X,
  Plus,
  Trash2,
  Edit2,
  Download,
  Upload,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Sparkles,
  Loader,
  DollarSign,
  Save,
  PiggyBank,
  ArrowDownToLine,
  ArrowUpFromLine
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';

// --- Sabitler & Yardımcılar ---

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

// Sayı formatlama (Virgülden sonra 2 basamak)
const formatNumber = (num) => {
  if (num === undefined || num === null) return '0';
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(num);
};

// --- Ana Uygulama ---

export default function App() {
  // --- State Yönetimi ---
  
  // 1. İşlemler (LocalStorage'dan oku)
  const [transactions, setTransactions] = useState(() => {
    try {
      const saved = localStorage.getItem('portfolio_transactions_v2');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Veri okuma hatası, sıfırlanıyor:", e);
      return [];
    }
  });

  // 2. Kurlar (Manuel Yönetim)
  const [rates, setRates] = useState(() => {
    try {
      const saved = localStorage.getItem('portfolio_rates');
      return saved ? JSON.parse(saved) : { USD: 32.50, EUR: 35.20, GBP: 41.10, TRY: 1 };
    } catch (e) {
      return { USD: 32.50, EUR: 35.20, GBP: 41.10, TRY: 1 };
    }
  });

  // 3. Manuel Varlık Fiyatları (Güncel Fiyatlar)
  const [manualPrices, setManualPrices] = useState(() => {
    try {
      const saved = localStorage.getItem('portfolio_prices');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  // UI State'leri
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 768);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modallar
  const [modalMode, setModalMode] = useState('add'); // 'add' veya 'edit'
  const [editingId, setEditingId] = useState(null);
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);

  // AI & Form State
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    type: 'buy',
    assetType: 'stock',
    symbol: '',
    amount: '',
    price: '',
    currency: 'TRY',
    date: new Date().toISOString().split('T')[0],
    note: ''
  });

  // Fiyat güncelleme formu için geçici state
  const [priceUpdateData, setPriceUpdateData] = useState({});

  const fileInputRef = useRef(null);

  // --- Persistence (Kaydetme) ---
  useEffect(() => {
    localStorage.setItem('portfolio_transactions_v2', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('portfolio_rates', JSON.stringify(rates));
  }, [rates]);

  useEffect(() => {
    localStorage.setItem('portfolio_prices', JSON.stringify(manualPrices));
  }, [manualPrices]);


  // --- ÇEKİRDEK HESAPLAMA MOTORU ---
  const calculatedData = useMemo(() => {
    const holdings = {};
    let totalRealizedProfitTRY = 0;
    
    // Nakit Akışı Değişkenleri
    let totalInvestedMoneyTRY = 0; // Toplam Yatırılan (Alışlar)
    let totalWithdrawnMoneyTRY = 0; // Toplam Çekilen (Satışlar)

    // İşlemleri tarihe göre sırala (Eskiden yeniye)
    const sortedTx = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));

    sortedTx.forEach(tx => {
      const sym = tx.symbol.toUpperCase();
      const txAmount = parseFloat(tx.amount);
      const txPrice = parseFloat(tx.price);
      
      // İşlem anındaki kur değil, güncel kur listesinden hesaplıyoruz
      const rate = rates[tx.currency || 'TRY'] || 1;
      const txTotalValueTRY = txAmount * txPrice * rate;

      // Nakit Akışı Hesabı
      if (tx.type === 'buy') {
        totalInvestedMoneyTRY += txTotalValueTRY;
      } else if (tx.type === 'sell') {
        totalWithdrawnMoneyTRY += txTotalValueTRY;
      }
      
      // Varlık Bazlı Hesaplama (Maliyet & Stok)
      if (!holdings[sym]) {
        holdings[sym] = {
          symbol: sym,
          assetType: tx.assetType,
          currency: tx.currency || 'TRY',
          amount: 0,
          totalCost: 0,
          avgCost: 0,
          realizedPL: 0,
        };
      }

      const h = holdings[sym];

      if (tx.type === 'buy') {
        h.totalCost += txAmount * txPrice;
        h.amount += txAmount;
        if (h.amount > 0) h.avgCost = h.totalCost / h.amount;

      } else if (tx.type === 'sell') {
        // Satıştan gelen kârı hesapla
        const costOfSoldTokens = txAmount * h.avgCost;
        const saleValue = txAmount * txPrice;
        const profit = saleValue - costOfSoldTokens;

        h.realizedPL += profit;
        h.amount -= txAmount;
        h.totalCost -= costOfSoldTokens;

        // Stok bittiyse maliyeti sıfırla
        if (h.amount <= 0) {
          h.amount = 0;
          h.totalCost = 0;
          h.avgCost = 0;
        }
      }
    });

    let portfolioTotalValueTRY = 0;
    let portfolioTotalUnrealizedPL_TRY = 0;
    
    // Tüm varlıkları (stokta olan + geçmişte işlem gören) listele
    const activeHoldings = Object.values(holdings).map(h => {
      // Fiyat Belirleme Önceliği:
      // 1. Manuel girilen fiyat
      // 2. En son işlem fiyatı
      // 3. Ortalama maliyet
      
      const manualPrice = manualPrices[h.symbol];
      const lastTx = sortedTx.filter(t => t.symbol.toUpperCase() === h.symbol).pop();
      
      let currentPrice;
      if (manualPrice !== undefined && manualPrice !== "") {
         currentPrice = parseFloat(manualPrice);
      } else {
         currentPrice = lastTx ? parseFloat(lastTx.price) : h.avgCost;
      }
      
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

      return {
        ...h,
        currentPrice,
        currentValue,
        unrealizedPL,
        unrealizedPLPercent,
        currentValueTRY,
        unrealizedPL_TRY,
        realizedPL_TRY
      };
    }).filter(h => h.amount > 0 || h.realizedPL !== 0);

    const currentHoldings = activeHoldings.filter(h => h.amount > 0);
    
    // Net Katkı Hesabı (Yatırılan - Çekilen)
    const netContributionTRY = totalInvestedMoneyTRY - totalWithdrawnMoneyTRY;

    return {
      holdings: currentHoldings,
      allHistory: activeHoldings,
      totalValueTRY: portfolioTotalValueTRY,
      totalUnrealizedPL_TRY: portfolioTotalUnrealizedPL_TRY,
      totalRealizedPL_TRY: totalRealizedProfitTRY,
      totalPL_TRY: portfolioTotalUnrealizedPL_TRY + totalRealizedProfitTRY,
      totalInvestedMoneyTRY,
      totalWithdrawnMoneyTRY,
      netContributionTRY
    };

  }, [transactions, rates, manualPrices]);


  // --- Handler Fonksiyonları ---

  const handleOpenAddModal = () => {
    resetForm();
    setIsTxModalOpen(true);
  };

  const handleOpenPriceModal = () => {
    const initialData = {};
    calculatedData.holdings.forEach(h => {
       initialData[h.symbol] = h.currentPrice;
    });
    setPriceUpdateData(initialData);
    setIsPriceModalOpen(true);
  };

  const handleSavePrices = () => {
    setManualPrices(prev => ({...prev, ...priceUpdateData}));
    setIsPriceModalOpen(false);
  };

  const handleSaveTransaction = (e) => {
    e.preventDefault();
    const amount = parseFloat(formData.amount);
    const price = parseFloat(formData.price);

    if (amount <= 0 || price < 0) {
      alert("Lütfen geçerli pozitif değerler giriniz.");
      return;
    }

    if (formData.type === 'sell') {
      const sym = formData.symbol.toUpperCase();
      const currentStock = transactions.reduce((acc, t) => {
         if (t.symbol.toUpperCase() === sym) {
           return t.type === 'buy' ? acc + parseFloat(t.amount) : acc - parseFloat(t.amount);
         }
         return acc;
      }, 0);
      
      if (modalMode === 'add' && amount > currentStock) {
        alert(`Hata: Satılmak istenen miktar (${amount}) eldeki stoktan (${currentStock}) fazla!`);
        return;
      }
    }

    const newTx = {
      ...formData,
      id: modalMode === 'edit' ? editingId : Date.now(),
      amount: amount,
      price: price,
      symbol: formData.symbol.toUpperCase()
    };

    if (modalMode === 'edit') {
      setTransactions(transactions.map(t => t.id === editingId ? newTx : t));
    } else {
      setTransactions([...transactions, newTx]);
    }

    setIsTxModalOpen(false);
    resetForm();
  };

  const handleDeleteTransaction = (id) => {
    if (window.confirm("Bu işlemi silmek istediğine emin misin?")) {
      setTransactions(transactions.filter(t => t.id !== id));
    }
  };

  const handleEditClick = (tx) => {
    setModalMode('edit');
    setEditingId(tx.id);
    setFormData({
      type: tx.type,
      assetType: tx.assetType,
      symbol: tx.symbol,
      amount: tx.amount,
      price: tx.price,
      currency: tx.currency || 'TRY',
      date: tx.date,
      note: tx.note || ''
    });
    setIsTxModalOpen(true);
  };

  const resetForm = () => {
    setFormData({
      type: 'buy',
      assetType: 'stock',
      symbol: '',
      amount: '',
      price: '',
      currency: 'TRY',
      date: new Date().toISOString().split('T')[0],
      note: ''
    });
    setModalMode('add');
    setEditingId(null);
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(transactions, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = `portfoy_yedek_${new Date().toISOString().split('T')[0]}.json`;
    link.href = url;
    link.click();
  };

  const handleImport = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target.result);
        if (Array.isArray(imported)) {
          if(window.confirm("Mevcut veriler silinip yedek yüklenecek. Emin misin?")) {
             setTransactions(imported);
             alert("Yedek başarıyla yüklendi!");
          }
        } else {
          alert("Hatalı dosya formatı.");
        }
      } catch (err) {
        alert("Dosya okunamadı JSON bozuk olabilir.");
      }
    };
    reader.readAsText(file);
    event.target.value = null;
  };

  const handleResetPortfolio = () => {
    if (window.confirm("DİKKAT! Tüm portföy verilerin kalıcı olarak silinecek. Emin misin?")) {
      setTransactions([]);
      setManualPrices({});
      alert("Portföy sıfırlandı.");
    }
  };

  // --- Gemini AI ---
  const handleAiAnalysis = async () => {
    setIsAiModalOpen(true);
    if (aiAnalysis) return;

    setIsAiLoading(true);
    const apiKey = "AIzaSyCwn_Qqqc4A2txstWvPgND68qGkxofgjBE"; // API KEY BURAYA
    
    const summary = {
       totalValue: calculatedData.totalValueTRY.toFixed(0) + " TL",
       totalInvested: calculatedData.totalInvestedMoneyTRY.toFixed(0) + " TL",
       netContribution: calculatedData.netContributionTRY.toFixed(0) + " TL",
       totalProfit: calculatedData.totalPL_TRY.toFixed(0) + " TL",
       holdings: calculatedData.holdings.slice(0, 10).map(h => ({ 
          s: h.symbol, v: h.currentValueTRY.toFixed(0), p: h.unrealizedPLPercent.toFixed(1) + "%" 
       }))
    };

    const prompt = `
      Sen bir finans asistanısın. Aşağıdaki portföy verisine (JSON) bak.
      Data: ${JSON.stringify(summary)}
      Görev:
      1. Genel durumu özetle (Yatırılan vs Portföy Değeri).
      2. En kârlı/zararlı pozisyonu belirt.
      3. Çeşitlendirme önerisi ver.
      4. Cevabı Türkçe, samimi ve kısa tut. Emoji kullan.
    `;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        }
      );
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "Bağlantı hatası.";
      setAiAnalysis(text);
    } catch (error) {
      setAiAnalysis("AI servisine ulaşılamadı. API anahtarını kontrol et.");
    } finally {
      setIsAiLoading(false);
    }
  };


  // --- Arayüz Render ---

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex text-slate-800 dark:text-slate-200 font-sans transition-colors duration-200">
      
      {/* Sidebar */}
      <aside className={`fixed md:sticky top-0 h-screen w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 z-40 transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
          <div className="flex items-center gap-2 font-bold text-xl text-blue-600">
            <LayoutDashboard />
            <span>PortföyPro</span>
          </div>
          <button className="md:hidden" onClick={() => setIsSidebarOpen(false)}><X size={20} /></button>
        </div>
        
        <nav className="p-4 space-y-2">
          <button onClick={() => { setActiveTab('dashboard'); if(window.innerWidth < 768) setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'dashboard' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600' : 'hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
            <PieChartIcon size={20} /> Genel Bakış
          </button>
          <button onClick={() => { setActiveTab('holdings'); if(window.innerWidth < 768) setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'holdings' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600' : 'hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
            <Wallet size={20} /> Varlıklarım
          </button>
          <button onClick={() => { setActiveTab('transactions'); if(window.innerWidth < 768) setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'transactions' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600' : 'hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
            <ArrowRightLeft size={20} /> İşlem Geçmişi
          </button>
        </nav>

        <div className="absolute bottom-0 w-full p-4 border-t border-slate-100 dark:border-slate-700">
          <button onClick={() => setIsSettingsOpen(true)} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400">
            <Settings size={20} /> Ayarlar & Yedek
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-4 sticky top-0 z-30 flex justify-between items-center shadow-sm">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 hover:bg-slate-100 rounded-lg"><Menu size={20} /></button>
            <h1 className="text-xl font-bold capitalize hidden sm:block">{activeTab === 'dashboard' ? 'Dashboard' : activeTab === 'holdings' ? 'Varlık Listesi' : 'İşlem Geçmişi'}</h1>
          </div>

          <div className="flex items-center gap-3">
             <div className="hidden lg:flex items-center gap-4 text-xs font-mono bg-slate-100 dark:bg-slate-900 px-3 py-1.5 rounded-md text-slate-500 mr-2">
                <span>USD: <span className="text-slate-900 dark:text-white font-bold">{rates.USD}</span></span>
                <span>EUR: <span className="text-slate-900 dark:text-white font-bold">{rates.EUR}</span></span>
             </div>

             {/* Fiyat Güncelle Butonu */}
             <button onClick={handleOpenPriceModal} className="hidden md:flex items-center gap-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 px-3 py-2 rounded-lg text-sm font-medium transition-all">
                <RefreshCw size={16} /> <span className="hidden lg:inline">Fiyatları Güncelle</span>
             </button>

             <button onClick={handleAiAnalysis} className="hidden md:flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white px-3 py-2 rounded-lg text-sm font-medium shadow transition-all">
                <Sparkles size={16} /> AI Yorumu
             </button>
             
             <button onClick={handleOpenAddModal} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-lg shadow-blue-600/20 transition-all active:scale-95">
                <Plus size={18} /> <span className="hidden sm:inline">İşlem Ekle</span>
             </button>
          </div>
        </header>

        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
          
          {/* DASHBOARD */}
          {activeTab === 'dashboard' && (
            <>
              {/* YENİ KART: Nakit Akışı & Yatırım Dengesi (Akıllı Versiyon) */}
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-800 dark:to-slate-900 p-6 rounded-2xl text-white shadow-lg mb-6 relative overflow-hidden">
                 <div className="absolute top-0 right-0 p-8 opacity-10"><PiggyBank size={120}/></div>
                 <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-8">
                    
                    {/* Toplam Yatırılan */}
                    <div className="flex items-center gap-4">
                       <div className="p-3 bg-white/10 rounded-xl"><ArrowDownToLine size={24} className="text-blue-300"/></div>
                       <div>
                          <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Toplam Yatırılan</p>
                          <p className="text-2xl font-bold tracking-tight">{formatNumber(calculatedData.totalInvestedMoneyTRY)} TL</p>
                       </div>
                    </div>

                    {/* Toplam Çekilen */}
                    <div className="flex items-center gap-4">
                       <div className="p-3 bg-white/10 rounded-xl"><ArrowUpFromLine size={24} className="text-purple-300"/></div>
                       <div>
                          <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Toplam Çekilen</p>
                          <p className="text-2xl font-bold tracking-tight">{formatNumber(calculatedData.totalWithdrawnMoneyTRY)} TL</p>
                       </div>
                    </div>

                    {/* Net Durum (Akıllı Gösterge) */}
                    <div className={`flex items-center gap-4 border-l border-white/10 pl-8 ${calculatedData.netContributionTRY <= 0 ? 'text-emerald-400' : 'text-white'}`}>
                       <div>
                          {calculatedData.netContributionTRY > 0 ? (
                              <>
                                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Net Maliyet (İçerdeki)</p>
                                <p className="text-3xl font-bold tracking-tight text-white">{formatNumber(calculatedData.netContributionTRY)} TL</p>
                                <p className="text-xs text-slate-400 mt-1">Cebinden çıkan net para</p>
                              </>
                          ) : (
                              <>
                                <p className="text-emerald-400/80 text-xs font-bold uppercase tracking-wider">Net Nakit (Cepte)</p>
                                <p className="text-3xl font-bold tracking-tight">+{formatNumber(Math.abs(calculatedData.netContributionTRY))} TL</p>
                                <p className="text-xs text-emerald-400/70 mt-1">Ana para çıktı, kâr cebe girdi! 🎉</p>
                              </>
                          )}
                       </div>
                    </div>

                 </div>
              </div>

              {/* Standart Özet Kartlar */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <div className="text-slate-500 text-sm font-medium mb-1">Toplam Portföy Değeri</div>
                    <div className="text-3xl font-bold text-slate-900 dark:text-white">
                      {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(calculatedData.totalValueTRY)}
                    </div>
                 </div>

                 <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border-l-4 border-l-blue-500 shadow-sm">
                    <div className="text-slate-500 text-sm font-medium mb-1">Gerçekleşmemiş Kâr</div>
                    <div className={`text-xl font-bold ${calculatedData.totalUnrealizedPL_TRY >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-500'}`}>
                      {calculatedData.totalUnrealizedPL_TRY >= 0 ? '+' : ''}{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(calculatedData.totalUnrealizedPL_TRY)}
                    </div>
                 </div>

                 <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border-l-4 border-l-emerald-500 shadow-sm">
                    <div className="text-slate-500 text-sm font-medium mb-1">Gerçekleşen Kâr</div>
                    <div className={`text-xl font-bold ${calculatedData.totalRealizedPL_TRY >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                       {calculatedData.totalRealizedPL_TRY >= 0 ? '+' : ''}{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(calculatedData.totalRealizedPL_TRY)}
                    </div>
                 </div>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
                {/* Pasta Grafik */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm min-h-[350px] flex flex-col">
                  <h3 className="font-bold text-lg mb-4">Varlık Dağılımı</h3>
                  {calculatedData.holdings.length > 0 ? (
                    <div className="flex-1">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={calculatedData.holdings}
                            dataKey="currentValueTRY"
                            nameKey="symbol"
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                          >
                            {calculatedData.holdings.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <RechartsTooltip formatter={(val) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(val)} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-slate-400 italic">Veri yok.</div>
                  )}
                </div>

                {/* En Değerli Varlıklar Tablosu */}
                <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col">
                   <h3 className="font-bold text-lg mb-4">Portföy Liderleri</h3>
                   <div className="overflow-x-auto">
                     <table className="w-full text-sm text-left">
                       <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-700/50">
                         <tr>
                           <th className="px-4 py-3">Varlık</th>
                           <th className="px-4 py-3 text-right">Adet</th>
                           <th className="px-4 py-3 text-right">Ort. Maliyet</th>
                           <th className="px-4 py-3 text-right">Güncel Değer (TL)</th>
                           <th className="px-4 py-3 text-right">Kâr/Zarar %</th>
                         </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                         {calculatedData.holdings
                           .sort((a,b) => b.currentValueTRY - a.currentValueTRY)
                           .slice(0, 5) // İlk 5
                           .map((h, i) => (
                           <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                             <td className="px-4 py-3 font-semibold">{h.symbol}</td>
                             <td className="px-4 py-3 text-right">{formatNumber(h.amount)}</td>
                             <td className="px-4 py-3 text-right text-slate-500">{h.avgCost.toFixed(2)} {h.currency}</td>
                             <td className="px-4 py-3 text-right font-bold text-slate-800 dark:text-slate-200">
                               {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(h.currentValueTRY)}
                             </td>
                             <td className={`px-4 py-3 text-right font-bold ${h.unrealizedPLPercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                               %{h.unrealizedPLPercent.toFixed(2)}
                             </td>
                           </tr>
                         ))}
                         {calculatedData.holdings.length === 0 && (
                            <tr><td colSpan="5" className="p-4 text-center text-slate-400">Gösterilecek varlık yok.</td></tr>
                         )}
                       </tbody>
                     </table>
                   </div>
                </div>
              </div>
            </>
          )}

          {/* HOLDINGS LISTESI */}
          {activeTab === 'holdings' && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row justify-between items-center gap-4">
                 <h2 className="font-bold text-lg">Varlıklarım</h2>
                 <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                      type="text" 
                      placeholder="Sembol Ara..." 
                      className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border-none focus:ring-2 focus:ring-blue-500 text-sm"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                 </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-700/50">
                    <tr>
                      <th className="px-4 py-3">Sembol</th>
                      <th className="px-4 py-3 text-right">Eldeki Adet</th>
                      <th className="px-4 py-3 text-right">Ort. Maliyet</th>
                      <th className="px-4 py-3 text-right">Güncel Fiyat (Elle Gir)</th>
                      <th className="px-4 py-3 text-right">Değer (TL)</th>
                      <th className="px-4 py-3 text-right">Açık K/Z</th>
                      <th className="px-4 py-3 text-right">Kesinleşen K/Z</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {calculatedData.allHistory
                      .filter(h => h.symbol.includes(searchTerm.toUpperCase()))
                      .map((h, i) => (
                      <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="px-4 py-3 font-bold flex items-center gap-2">
                           <span className="w-2 h-2 rounded-full bg-blue-500"></span> {h.symbol}
                           <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 font-normal">{h.currency}</span>
                        </td>
                        <td className="px-4 py-3 text-right font-medium">{formatNumber(h.amount)}</td>
                        <td className="px-4 py-3 text-right text-slate-500">{formatNumber(h.avgCost)}</td>
                        <td className="px-4 py-3 text-right font-bold text-blue-600 dark:text-blue-400 cursor-pointer hover:underline" onClick={handleOpenPriceModal}>
                           {formatNumber(h.currentPrice)}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">
                          {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(h.currentValueTRY)}
                        </td>
                        <td className={`px-4 py-3 text-right ${h.unrealizedPL >= 0 ? 'text-blue-500' : 'text-red-500'}`}>
                           {h.unrealizedPLPercent.toFixed(2)}% <br/>
                           <span className="text-xs opacity-75">{formatNumber(h.unrealizedPL)} {h.currency}</span>
                        </td>
                        <td className={`px-4 py-3 text-right font-bold ${h.realizedPL_TRY >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                           {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(h.realizedPL_TRY)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TRANSACTIONS LISTESI */}
          {activeTab === 'transactions' && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
               <div className="p-4 border-b border-slate-100 dark:border-slate-700">
                 <h2 className="font-bold text-lg">İşlem Geçmişi</h2>
               </div>
               <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-700/50">
                    <tr>
                      <th className="px-4 py-3">Tarih</th>
                      <th className="px-4 py-3">Tür</th>
                      <th className="px-4 py-3">Varlık</th>
                      <th className="px-4 py-3 text-right">Adet</th>
                      <th className="px-4 py-3 text-right">Fiyat</th>
                      <th className="px-4 py-3 text-right">Tutar</th>
                      <th className="px-4 py-3 text-center">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {[...transactions].sort((a,b) => new Date(b.date) - new Date(a.date)).map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 group">
                        <td className="px-4 py-3 text-slate-500">{t.date}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${t.type === 'buy' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                            {t.type === 'buy' ? 'Alış' : 'Satış'}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold">{t.symbol} <span className="text-xs text-slate-400 font-normal ml-1">({t.currency || 'TRY'})</span></td>
                        <td className="px-4 py-3 text-right">{formatNumber(t.amount)}</td>
                        <td className="px-4 py-3 text-right">{formatNumber(t.price)}</td>
                        <td className="px-4 py-3 text-right font-medium text-slate-700 dark:text-slate-300">
                          {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: t.currency || 'TRY' }).format(t.amount * t.price)}
                        </td>
                        <td className="px-4 py-3 text-center">
                           <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                             <button onClick={() => handleEditClick(t)} className="p-1.5 hover:bg-blue-100 text-blue-600 rounded"><Edit2 size={16}/></button>
                             <button onClick={() => handleDeleteTransaction(t.id)} className="p-1.5 hover:bg-red-100 text-red-600 rounded"><Trash2 size={16}/></button>
                           </div>
                        </td>
                      </tr>
                    ))}
                    {transactions.length === 0 && (
                      <tr><td colSpan="7" className="p-8 text-center text-slate-400">Henüz işlem yok.</td></tr>
                    )}
                  </tbody>
                </table>
               </div>
            </div>
          )}

        </div>
      </main>

      {/* --- MODALLAR --- */}

      {/* 4. FİYAT GÜNCELLEME MODALI */}
      {isPriceModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[999] p-4">
           <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
             <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                <h2 className="font-bold text-lg flex items-center gap-2"><RefreshCw size={20}/> Güncel Fiyatları Gir</h2>
                <button onClick={() => setIsPriceModalOpen(false)}><X /></button>
             </div>
             <div className="p-6 max-h-[60vh] overflow-y-auto">
                <p className="text-sm text-slate-500 mb-4">Elindeki varlıkların anlık piyasa fiyatlarını buradan güncelleyebilirsin. (Para birimi kendi birimindedir)</p>
                <div className="space-y-3">
                   {calculatedData.holdings.map(h => (
                      <div key={h.symbol} className="flex items-center gap-4">
                         <div className="w-20 font-bold">{h.symbol}</div>
                         <div className="text-xs text-slate-400 w-12">{h.currency}</div>
                         <input 
                           type="number" 
                           step="any"
                           placeholder="Güncel Fiyat"
                           className="flex-1 p-2 rounded border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700"
                           value={priceUpdateData[h.symbol] || ''}
                           onChange={(e) => setPriceUpdateData({...priceUpdateData, [h.symbol]: e.target.value})}
                         />
                      </div>
                   ))}
                   {calculatedData.holdings.length === 0 && <div className="text-center text-slate-400 py-4">Güncellenecek varlık yok.</div>}
                </div>
             </div>
             <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-end">
                <button onClick={handleSavePrices} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold">Kaydet & Hesapla</button>
             </div>
           </div>
        </div>
      )}

      {/* 1. İşlem Ekle/Düzenle */}
      {isTxModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[999] p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
              <h2 className="font-bold text-lg">{modalMode === 'add' ? 'Yeni İşlem Ekle' : 'İşlemi Düzenle'}</h2>
              <button onClick={() => setIsTxModalOpen(false)}><X className="text-slate-400 hover:text-slate-600" /></button>
            </div>
            <form onSubmit={handleSaveTransaction} className="p-6 space-y-4">
               <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-700/50 rounded-lg">
                  <button type="button" onClick={() => setFormData({...formData, type: 'buy'})} className={`py-2 rounded-md text-sm font-semibold transition-all ${formData.type === 'buy' ? 'bg-white dark:bg-slate-600 shadow text-green-600' : 'text-slate-500'}`}>ALIŞ (Yatırım)</button>
                  <button type="button" onClick={() => setFormData({...formData, type: 'sell'})} className={`py-2 rounded-md text-sm font-semibold transition-all ${formData.type === 'sell' ? 'bg-white dark:bg-slate-600 shadow text-red-600' : 'text-slate-500'}`}>SATIŞ (Çekim)</button>
               </div>

               <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Varlık Türü</label>
                   <select 
                      className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-transparent"
                      value={formData.assetType}
                      onChange={(e) => {
                         const type = ASSET_TYPES.find(t => t.id === e.target.value);
                         setFormData({...formData, assetType: e.target.value, currency: type ? type.defaultCurrency : 'TRY' });
                      }}
                   >
                     {ASSET_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                   </select>
                 </div>
                 <div>
                   <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Para Birimi</label>
                   <select 
                      className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-transparent"
                      value={formData.currency}
                      onChange={(e) => setFormData({...formData, currency: e.target.value})}
                   >
                     {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                   </select>
                 </div>
               </div>

               <div>
                 <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Sembol / İsim</label>
                 <input required className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-transparent uppercase font-bold tracking-wide" placeholder="Örn: ASELS, AAPL, BTC..." value={formData.symbol} onChange={(e) => setFormData({...formData, symbol: e.target.value})}/>
               </div>

               <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Adet</label>
                   <input required type="number" step="any" min="0" className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-transparent" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})}/>
                 </div>
                 <div>
                   <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Birim Fiyat</label>
                   <input required type="number" step="any" min="0" className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-transparent" value={formData.price} onChange={(e) => setFormData({...formData, price: e.target.value})}/>
                 </div>
               </div>

               <div>
                 <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Tarih</label>
                 <input type="date" required className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-transparent" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})}/>
               </div>

               <button type="submit" className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-transform active:scale-95">
                 {modalMode === 'add' ? 'İşlemi Ekle' : 'Değişiklikleri Kaydet'}
               </button>
            </form>
          </div>
        </div>
      )}

      {/* 2. Ayarlar & Yedek */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[999] p-4">
           <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
             <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                <h2 className="font-bold text-lg flex items-center gap-2"><Settings size={20}/> Ayarlar</h2>
                <button onClick={() => setIsSettingsOpen(false)}><X /></button>
             </div>
             <div className="p-6 space-y-8">
                <div>
                   <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2"><DollarSign size={16}/> Kur Sabitleri</h3>
                   <div className="grid grid-cols-3 gap-3">
                      {['USD', 'EUR', 'GBP'].map(c => (
                        <div key={c}>
                           <label className="text-xs text-slate-500 block mb-1">{c}/TRY</label>
                           <input type="number" step="0.01" className="w-full p-2 rounded border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-sm font-mono" value={rates[c]} onChange={(e) => setRates({...rates, [c]: parseFloat(e.target.value) || 0})}/>
                        </div>
                      ))}
                   </div>
                   <p className="text-xs text-slate-400 mt-2">Dövizli işlemlerin TL karşılığı bu kurlardan hesaplanır.</p>
                </div>
                <hr className="border-slate-100 dark:border-slate-700"/>
                <div>
                   <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2"><Save size={16}/> Yedekleme</h3>
                   <div className="flex gap-3">
                      <button onClick={handleExport} className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700"><Download size={16}/> İndir</button>
                      <button onClick={() => fileInputRef.current?.click()} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 border border-blue-200 dark:border-blue-800 rounded-lg text-sm font-medium hover:bg-blue-100"><Upload size={16}/> Yükle</button>
                      <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleImport} />
                   </div>
                </div>
                <hr className="border-slate-100 dark:border-slate-700"/>
                <div>
                   <h3 className="text-sm font-bold text-red-600 mb-3 flex items-center gap-2"><AlertTriangle size={16}/> Tehlikeli Bölge</h3>
                   <button onClick={handleResetPortfolio} className="w-full py-3 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg text-sm font-bold transition-colors">TÜM PORTFÖYÜ SIFIRLA</button>
                </div>
             </div>
           </div>
        </div>
      )}

      {/* 3. AI Asistan */}
      {isAiModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[999] p-4">
           <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-xl shadow-2xl border border-indigo-100 dark:border-indigo-900">
              <div className="p-4 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-t-2xl flex justify-between items-center text-white">
                 <h2 className="font-bold flex items-center gap-2"><Sparkles size={20}/> AI Asistan</h2>
                 <button onClick={() => setIsAiModalOpen(false)} className="hover:bg-white/20 p-1 rounded"><X/></button>
              </div>
              <div className="p-6 min-h-[200px] max-h-[60vh] overflow-y-auto">
                 {isAiLoading ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-500">
                       <Loader className="animate-spin text-indigo-500" size={32} />
                       <p>Portföyün inceleniyor...</p>
                    </div>
                 ) : (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                       <div className="whitespace-pre-wrap leading-relaxed">{aiAnalysis}</div>
                    </div>
                 )}
              </div>
              <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 rounded-b-2xl flex justify-end">
                 <button onClick={() => setIsAiModalOpen(false)} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 rounded-lg text-sm font-medium">Kapat</button>
              </div>
           </div>
        </div>
      )}

    </div>
  );
}