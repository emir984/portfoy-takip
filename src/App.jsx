import React, { useState, useEffect, useMemo, useRef } from 'react';
// --- FIREBASE BAĞLANTILARI ---
import { db } from './firebase'; 
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, setDoc } from 'firebase/firestore';

import { 
  LayoutDashboard, Wallet, ArrowRightLeft, PieChart as PieChartIcon, Settings, Search, Menu, X, Plus, Trash2, Edit2, Download, Upload, RefreshCw, TrendingUp, TrendingDown, AlertTriangle, Sparkles, Loader, DollarSign, Save, PiggyBank, ArrowDownToLine, ArrowUpFromLine, Lock, LogOut, KeyRound, ShieldCheck, Cloud, Wifi, WifiOff, Globe
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
  const [isRatesLoading, setIsRatesLoading] = useState(false); // Kur çekme durumu

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

  // CANLI KUR ÇEKME (YENİ ÖZELLİK)
  const fetchLiveRates = async () => {
    setIsRatesLoading(true);
    try {
      const usdReq = await fetch('https://api.frankfurter.app/latest?from=USD&to=TRY');
      const usdRes = await usdReq.json();
      const eurReq = await fetch('https://api.frankfurter.app/latest?from=EUR&to=TRY');
      const eurRes = await eurReq.json();
      const gbpReq = await fetch('https://api.frankfurter.app/latest?from=GBP&to=TRY');
      const gbpRes = await gbpReq.json();

      const newRates = {
        USD: usdRes.rates.TRY,
        EUR: eurRes.rates.TRY,
        GBP: gbpRes.rates.TRY,
        TRY: 1
      };

      await setDoc(doc(db, "settings", "rates"), newRates);
      alert("Kurlar başarıyla güncellendi! \nUSD: " + newRates.USD + "\nEUR: " + newRates.EUR);
    } catch (error) {
      console.error("Kur hatası:", error);
      alert("Kurlar çekilemedi. İnternet bağlantınızı kontrol edin.");
    } finally {
      setIsRatesLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!cloudPin) {
      if (pinInput.length < 4) { alert("Güvenlik için en az 4 hane girin."); return; }
      try {
        await setDoc(doc(db, "settings", "security"), { pin: pinInput });
        setIsAuthenticated(true);