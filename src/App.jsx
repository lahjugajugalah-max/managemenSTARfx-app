import React, { useState, useEffect, useMemo } from 'react';
import { 
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, collection, addDoc, query, where, onSnapshot, deleteDoc, doc, setDoc, getDoc 
} from 'firebase/firestore';
import { db } from './firebase'; 
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Area, AreaChart, PieChart, Pie, Cell, Legend, BarChart, Bar 
} from 'recharts';
import { FiDollarSign, FiTrendingUp, FiTrendingDown, FiPieChart, FiSettings, FiPlusCircle, FiList, FiTrash2, FiClock, FiSearch, FiBriefcase, FiXCircle, FiCheckCircle } from 'react-icons/fi';
import { RiExchangeLine } from 'react-icons/ri';
import { AiOutlineBarChart } from 'react-icons/ai';

const auth = getAuth();

// Ikon Petir Kustom STARFX
const CustomBoltIcon = ({ size = 24, color = "#FFD700" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12.9 2L5.8 13H11L9.1 22L18.2 9H13L12.9 2Z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export default function App() {
  const [user, setUser] = useState(null);
  const [isRegister, setIsRegister] = useState(false);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [currency, setCurrency] = useState('USD'); 

  // Tab Navigasi Bawah
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // State untuk expand card history
  const [expandedTrade, setExpandedTrade] = useState(null);

  // State Transaksi
  const [trades, setTrades] = useState([]);
  
  // Field Form Tambah Trade LENGKAP
  const [pair, setPair] = useState('XAUUSD');
  const [date, setDate] = useState(new Date().toISOString().substring(0, 10)); // Format YYYY-MM-DD
  const [time, setTime] = useState(new Date().toTimeString().substring(0, 5)); // Format HH:MM
  const [type, setType] = useState('BUY');
  const [lot, setLot] = useState('');
  const [entryPrice, setEntryPrice] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [exitPrice, setExitPrice] = useState('');
  const [pnl, setPnl] = useState('');
  const [commission, setCommission] = useState('');
  const [swap, setSwap] = useState('');
  const [broker, setBroker] = useState('');
  const [strategy, setStrategy] = useState('Scalping'); 
  const [notes, setNotes] = useState('');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('Semua'); 
  const [filterValue, setFilterValue] = useState(''); 

  // Asumsi Modal Awal Keras dipindah ke sini agar tidak terjadi ReferenceError saat render grafik
  const Modal_Awal_Asumsi = 1250; 

  const formatMoney = (val) => {
    if (currency === 'IDR') return 'Rp' + Math.abs(val).toLocaleString('id-ID');
    return '$' + Math.abs(val).toFixed(2);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const docRef = doc(db, 'users', currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().currency) {
          setCurrency(docSnap.data().currency);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'forex_trades'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tradeData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      tradeData.sort((a, b) => a.timestamp - b.timestamp);
      setTrades(tradeData);
    });
    return () => unsubscribe();
  }, [user]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      if (isRegister) {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, 'users', userCred.user.uid), { currency: currency });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setAuthError(err.message.replace('Firebase: ', ''));
    }
  };

  const handleAddTrade = async (e) => {
    e.preventDefault();
    if (!lot || !pnl || !entryPrice || !exitPrice || !date || !time) {
      alert("Field wajib (Lot, PnL, Entry Price, Exit Price, Tanggal, Waktu) harus diisi!");
      return;
    }
    
    try {
      const dateObj = new Date(`${date}T${time}`);
      await addDoc(collection(db, 'forex_trades'), {
        userId: user.uid,
        pair, type, lot: parseFloat(lot), 
        entryPrice: parseFloat(entryPrice),
        stopLoss: stopLoss ? parseFloat(stopLoss) : null,
        takeProfit: takeProfit ? parseFloat(takeProfit) : null,
        exitPrice: parseFloat(exitPrice),
        pnl: parseFloat(pnl), 
        commission: commission ? parseFloat(commission) : null,
        swap: swap ? parseFloat(swap) : null,
        broker: broker || null,
        notes, strategy,
        date: dateObj.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }),
        timestamp: dateObj.getTime()
      });
      
      // Reset Form
      setLot(''); setEntryPrice(''); setStopLoss(''); setTakeProfit(''); setExitPrice(''); setPnl(''); setCommission(''); setSwap(''); setBroker(''); setNotes('');
      alert('Transaksi berhasil disimpan!');
      setActiveTab('transaksi'); // Pindah ke history agar terlihat datanya
    } catch (error) {
      alert("Gagal menyimpan data, periksa koneksi internet/Firebase: " + error.message);
    }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation(); // Mencegah card terbuka saat tombol hapus ditekan
    if(window.confirm("Yakin ingin menghapus jurnal ini?")) {
      try {
        await deleteDoc(doc(db, 'forex_trades', id));
      } catch (error) {
        alert("Gagal menghapus: " + error.message);
      }
    }
  };

  // Fungsi Export Data (Menghidupkan tombol fitur Export)
  const handleExport = () => {
    if (trades.length === 0) {
      alert("Belum ada data untuk di-export.");
      return;
    }
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Tanggal,Pair,Tipe,Lot,Entry,Exit,PnL,Strategy,Notes\n";
    trades.forEach(t => {
      let row = `${t.date},${t.pair},${t.type},${t.lot},${t.entryPrice},${t.exitPrice},${t.pnl},${t.strategy || ''},${t.notes || ''}`;
      csvContent += row + "\n";
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "Jurnal_STARFX.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredTrades = trades.filter(t => {
    return t.pair.toLowerCase().includes(searchTerm.toLowerCase()) || 
           (t.notes && t.notes.toLowerCase().includes(searchTerm.toLowerCase()));
  });

  const chartTrades = useMemo(() => filteredTrades, [filteredTrades]);
  
  // PERHITUNGAN DASHBOARD & STATS (DINAMIS)
  const totalPnl = filteredTrades.reduce((acc, item) => acc + item.pnl, 0);
  const totalWinTrades = filteredTrades.filter(t => t.pnl > 0);
  const totalLossTrades = filteredTrades.filter(t => t.pnl < 0);
  const totalWinPnl = totalWinTrades.reduce((acc, item) => acc + item.pnl, 0);
  const totalLossPnl = Math.abs(totalLossTrades.reduce((acc, item) => acc + item.pnl, 0));
  const winRate = filteredTrades.length ? ((totalWinTrades.length / filteredTrades.length) * 100).toFixed(1) : 0;
  
  const profitFactor = totalLossPnl > 0 ? (totalWinPnl / totalLossPnl).toFixed(2) : totalWinPnl.toFixed(2);
  const avgWin = totalWinTrades.length > 0 ? (totalWinPnl / totalWinTrades.length).toFixed(2) : 0;
  const avgLoss = totalLossTrades.length > 0 ? (totalLossPnl / totalLossTrades.length).toFixed(2) : 0;

  // Max Drawdown (Perhitungan Dasar: % Penurunan dari Equity Puncak)
  const maxDrawdown = useMemo(() => {
    let maxDrawdownPercentage = 0;
    let peakEquity = Modal_Awal_Asumsi; 
    let runningEquity = Modal_Awal_Asumsi;
    for (let trade of chartTrades) {
      runningEquity += trade.pnl;
      if (runningEquity > peakEquity) peakEquity = runningEquity;
      let drawdown = peakEquity - runningEquity;
      let drawdownPercentage = peakEquity > 0 ? (drawdown / peakEquity) * 100 : 0;
      if (drawdownPercentage > maxDrawdownPercentage) maxDrawdownPercentage = drawdownPercentage;
    }
    return peakEquity === Modal_Awal_Asumsi && chartTrades.length === 0 ? 0 : maxDrawdownPercentage.toFixed(2);
  }, [chartTrades]);

  // Winning & Losing Streak
  const streaks = useMemo(() => {
    let winStreak = 0;
    let lossStreak = 0;
    let maxWinStreak = 0;
    let maxLossStreak = 0;
    for (let trade of chartTrades) {
      if (trade.pnl > 0) {
        winStreak++;
        lossStreak = 0;
        if (winStreak > maxWinStreak) maxWinStreak = winStreak;
      } else if (trade.pnl < 0) {
        lossStreak++;
        winStreak = 0;
        if (lossStreak > maxLossStreak) maxLossStreak = lossStreak;
      } else { // Breakeven
        winStreak = 0;
        lossStreak = 0;
      }
    }
    return { maxWinStreak, maxLossStreak };
  }, [chartTrades]);

  const chartData = useMemo(() => {
    let runningBalance = Modal_Awal_Asumsi; 
    return chartTrades.map((t, index) => {
      runningBalance += parseFloat(t.pnl);
      return { tradeCount: `T${index + 1}`, balance: Math.round(runningBalance * 100) / 100 };
    });
  }, [chartTrades]);

  // Data Grafik BUY vs SELL
  const buySellData = useMemo(() => [
    { name: 'BUY', value: chartTrades.filter(t => t.type === 'BUY').length },
    { name: 'SELL', value: chartTrades.filter(t => t.type === 'SELL').length },
  ], [chartTrades]);

  // Data Grafik Pair Performance
  const pairPerformanceData = useMemo(() => {
    const pairGroups = chartTrades.reduce((acc, trade) => {
      if (!acc[trade.pair]) acc[trade.pair] = 0;
      acc[trade.pair] += trade.pnl;
      return acc;
    }, {});
    return Object.keys(pairGroups).map(pair => ({ name: pair, pnl: pairGroups[pair] }));
  }, [chartTrades]);

  if (!user) {
    return (
      <div style={styles.authContainer}>
        <div style={styles.authCard}>
          <div style={{display: 'flex', justifyContent: 'center', marginBottom: '10px'}}><CustomBoltIcon size={40} /></div>
          <h2 style={styles.brandTitle}>STARFX</h2>
          <p style={styles.subTitle}>{isRegister ? 'Daftar Akun Baru' : 'Login ke Dashboard'}</p>
          {authError && <div style={styles.errorBox}>{authError}</div>}
          <form onSubmit={handleAuth} style={styles.form}>
            <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required style={styles.input} />
            <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required style={styles.input} />
            {isRegister && (
              <select value={currency} onChange={e => setCurrency(e.target.value)} style={styles.input}>
                <option value="USD">Dolar (USD)</option>
                <option value="IDR">Rupiah (IDR)</option>
              </select>
            )}
            <button type="submit" style={styles.btnPrimary}>{isRegister ? 'Daftar' : 'Login'}</button>
          </form>
          <p style={styles.switchAuth} onClick={() => setIsRegister(!isRegister)}>
            {isRegister ? 'Sudah punya akun? Login' : 'Belum punya akun? Daftar'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.appContainer}>
      {/* HEADER */}
      <header style={styles.header}>
        <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
          <CustomBoltIcon size={28} />
          <div>
            <h3 style={{margin: 0, fontSize: '18px', color: '#fff'}}>STARFX</h3>
            <span style={{fontSize: '12px', color: '#9ca3af'}}>{user.email.split('@')[0]}</span>
          </div>
        </div>
        <div style={{display: 'flex', gap: '10px', alignItems: 'center'}}>
           <div style={styles.balanceBadge}>{formatMoney(totalPnl)}</div>
           <div style={styles.profileBtn}><CustomUserIcon /></div>
        </div>
      </header>

      {/* KONTEN UTAMA */}
      <div style={styles.mainContent}>
        
        {/* TAMPILAN DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div>
            {/* Quick Actions */}
            <div style={styles.quickActions}>
               <button style={styles.actionBtn} onClick={() => setActiveTab('tambah')}><FiPlusCircle /> Tambah</button>
               <button style={styles.actionBtn} onClick={handleExport}><FiList /> Export</button>
               <button style={styles.actionBtn} onClick={() => setActiveTab('transaksi')}><FiSearch /> Filter</button>
            </div>

            {/* 4 Cards Grid */}
            <div style={styles.statsGrid}>
              <div style={styles.card}>
                <div style={styles.cardHeader}><CustomMoneyIcon color="#10B981" /> <span style={styles.cardLabel}>💰 Total Profit/Loss</span></div>
                <h3 style={{color: totalPnl >= 0 ? '#10B981' : '#EF4444', margin: '5px 0'}}>{totalPnl >= 0 ? '+' : '-'}{formatMoney(totalPnl)}</h3>
              </div>
              <div style={styles.card}>
                <div style={styles.cardHeader}><CustomWinRateIcon color="#3B82F6" /> <span style={styles.cardLabel}>📈 Win Rate</span></div>
                <h3 style={{color: '#3B82F6', margin: '5px 0'}}>{winRate}%</h3>
              </div>
              <div style={styles.card}>
                <div style={styles.cardHeader}><RiExchangeLine color="#F59E0B" size={16} /> <span style={styles.cardLabel}>⚖️ Profit Factor</span></div>
                <h3 style={{color: '#F59E0B', margin: '5px 0'}}>{profitFactor}</h3>
              </div>
              <div style={styles.card}>
                <div style={styles.cardHeader}><AiOutlineBarChart color="#fff" size={16} /> <span style={styles.cardLabel}>📊 Total Trade</span></div>
                <h3 style={{color: '#fff', margin: '5px 0'}}>{filteredTrades.length}</h3>
              </div>
            </div>

            {/* Equity Curve */}
            <div style={{...styles.card, height: '300px', marginTop: '15px'}}>
               <div style={styles.cardHeader}><FiTrendingDown color="#9ca3af" /> <span style={styles.cardLabel}>📉 Equity Curve</span></div>
               {chartTrades.length === 0 ? <p style={{textAlign: 'center', color: '#6b7280', marginTop: '50px'}}>Belum ada data</p> : (
                 <ResponsiveContainer width="100%" height="90%">
                   <AreaChart data={chartData}>
                     <defs>
                       <linearGradient id="colorBal" x1="0" y1="0" x2="0" y2="1">
                         <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.5}/>
                         <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                       </linearGradient>
                     </defs>
                     <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                     <XAxis dataKey="tradeCount" hide />
                     <YAxis stroke="#9ca3af" fontSize={11} width={40} domain={['dataMin - Modal_Awal_Asumsi/10', 'dataMax + Modal_Awal_Asumsi/10']} tickFormatter={(val) => currency==='IDR'?(val/1000)+'k':val} />
                     <Tooltip contentStyle={{backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff'}}/>
                     <ReferenceLine y={Modal_Awal_Asumsi} stroke="#4B5563" />
                     <Area type="monotone" dataKey="balance" stroke="#3B82F6" strokeWidth={3} fill="url(#colorBal)" />
                   </AreaChart>
                 </ResponsiveContainer>
               )}
            </div>
          </div>
        )}

        {/* TAMPILAN TAMBAH TRANSAKSI (Form SUPER LENGKAP) */}
        {activeTab === 'tambah' && (
          <div style={styles.card}>
             <h3 style={{marginTop: 0}}>➕ Input Transaksi Baru</h3>
             <form onSubmit={handleAddTrade} style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
               <select value={pair} onChange={e => setPair(e.target.value)} style={styles.input}>
                  <option>XAUUSD</option><option>EURUSD</option><option>GBPUSD</option>
                  <option>BTCUSD</option><option>US30</option>
               </select>
               <select value={strategy} onChange={e => setStrategy(e.target.value)} style={styles.input}>
                  <option>Scalping</option><option>Swing Trade</option><option>News Trading</option>
                  <option>SMC / ICT</option><option>Support & Resistance</option>
               </select>
               <div style={{display: 'flex', gap: '10px'}}>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{...styles.input, flex: 1}} required />
                  <input type="time" value={time} onChange={e => setTime(e.target.value)} style={{...styles.input, flex: 1}} required />
               </div>
               <div style={{display: 'flex', gap: '10px'}}>
                  <button type="button" onClick={() => setType('BUY')} style={{...styles.typeBtn, background: type === 'BUY' ? '#3B82F6' : '#1f2937'}}><FiTrendingUp/> BUY</button>
                  <button type="button" onClick={() => setType('SELL')} style={{...styles.typeBtn, background: type === 'SELL' ? '#EF4444' : '#1f2937'}}><FiTrendingDown/> SELL</button>
               </div>
               <div style={{display: 'flex', gap: '10px'}}>
                  <input type="number" step="0.01" placeholder="Lot (cth: 0.10)" value={lot} onChange={e => setLot(e.target.value)} style={{...styles.input, flex: 1}} required />
                  <input type="number" step="0.01" placeholder={`PnL (${currency})`} value={pnl} onChange={e => setPnl(e.target.value)} style={{...styles.input, flex: 1}} required />
               </div>
               <div style={{display: 'flex', gap: '10px'}}>
                  <input type="number" step="0.0001" placeholder="Entry Price" value={entryPrice} onChange={e => setEntryPrice(e.target.value)} style={{...styles.input, flex: 1}} required />
                  <input type="number" step="0.0001" placeholder="Stop Loss" value={stopLoss} onChange={e => setStopLoss(e.target.value)} style={{...styles.input, flex: 1}} />
                  <input type="number" step="0.0001" placeholder="Take Profit" value={takeProfit} onChange={e => setTakeProfit(e.target.value)} style={{...styles.input, flex: 1}} />
               </div>
               <div style={{display: 'flex', gap: '10px'}}>
                  <input type="number" step="0.0001" placeholder="Exit Price" value={exitPrice} onChange={e => setExitPrice(e.target.value)} style={{...styles.input, flex: 1}} required />
                  <input type="number" step="0.01" placeholder="Commission" value={commission} onChange={e => setCommission(e.target.value)} style={{...styles.input, flex: 1}} />
                  <input type="number" step="0.01" placeholder="Swap" value={swap} onChange={e => setSwap(e.target.value)} style={{...styles.input, flex: 1}} />
               </div>
               <input type="text" placeholder="Broker" value={broker} onChange={e => setBroker(e.target.value)} style={styles.input} />
               <textarea rows="2" placeholder="Catatan trading..." value={notes} onChange={e => setNotes(e.target.value)} style={styles.input} />
               <button type="submit" style={styles.btnPrimary}>Simpan Jurnal</button>
             </form>
          </div>
        )}

        {/* TAMPILAN TRANSAKSI (List Cards dengan Fungsi Expand) */}
        {activeTab === 'transaksi' && (
          <div>
            <input type="text" placeholder="🔍 Cari pair atau catatan..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{...styles.input, marginBottom: '15px'}} />
            <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
               {[...filteredTrades].reverse().map(item => (
                 <div 
                   key={item.id} 
                   style={styles.tradeCard} 
                   onClick={() => setExpandedTrade(expandedTrade === item.id ? null : item.id)} // FUNGSI KLIK
                 >
                    <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '8px'}}>
                       <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                         <h4 style={{margin: 0, color: '#fff'}}>{item.pair}</h4>
                         <span style={{fontSize: '11px', padding: '2px 6px', borderRadius: '4px', display: 'flex', alignItems:'center', gap:'3px', background: item.type === 'BUY' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(239, 68, 68, 0.2)', color: item.type === 'BUY' ? '#3B82F6' : '#EF4444'}}>
                           {item.type === 'BUY' ? <FiTrendingUp size={12} /> : <FiTrendingDown size={12} />} {item.type}
                         </span>
                       </div>
                       <h4 style={{margin: 0, color: item.pnl >= 0 ? '#10B981' : '#EF4444'}}>{item.pnl >= 0 ? '+' : '-'}{formatMoney(item.pnl)}</h4>
                    </div>
                    <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#9ca3af', marginBottom: '8px'}}>
                       <span>Entry: {item.entryPrice.toFixed(2)}</span>
                       <span>Exit: {item.exitPrice.toFixed(2)}</span>
                       <span>{item.date}</span>
                    </div>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                       <span style={{fontSize: '11px', background: '#374151', padding: '2px 6px', borderRadius: '4px'}}>{item.strategy || 'Tanpa Tag'}</span>
                       <button onClick={(e) => handleDelete(e, item.id)} style={{background: 'none', border: 'none', color: '#6b7280', fontSize: '16px', cursor: 'pointer', padding: 0}}><CustomDeleteIcon size={18} /></button>
                    </div>

                    {/* DETAIL EXPAND KETIKA DIKLIK */}
                    {expandedTrade === item.id && (
                      <div style={{marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed #4B5563', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', color: '#d1d5db'}}>
                        <div style={{display:'flex', justifyContent:'space-between'}}><span>Lot: <strong style={{color:'#fff'}}>{item.lot}</strong></span> <span>Broker: <strong style={{color:'#fff'}}>{item.broker || '-'}</strong></span></div>
                        <div style={{display:'flex', justifyContent:'space-between'}}><span>Stop Loss: <strong style={{color:'#fff'}}>{item.stopLoss || '-'}</strong></span> <span>Take Profit: <strong style={{color:'#fff'}}>{item.takeProfit || '-'}</strong></span></div>
                        <div style={{display:'flex', justifyContent:'space-between'}}><span>Komisi: <strong style={{color:'#fff'}}>{item.commission || '-'}</strong></span> <span>Swap: <strong style={{color:'#fff'}}>{item.swap || '-'}</strong></span></div>
                        {item.notes && <div style={{marginTop: '4px', fontStyle: 'italic', color: '#9ca3af'}}>Catatan: {item.notes}</div>}
                      </div>
                    )}
                 </div>
               ))}
               {filteredTrades.length === 0 && <p style={{textAlign: 'center', color: '#6b7280'}}>Tidak ada transaksi</p>}
            </div>
          </div>
        )}

        {/* TAMPILAN STATISTIK (HIDUP & DINAMIS - FASE 2) */}
        {activeTab === 'statistik' && (
           <div style={{color: '#9ca3af'}}>
              <div style={styles.cardHeader}><AiOutlineBarChart size={30} /> <h3 style={{marginTop: 0, color: '#fff'}}>Statistik Lanjutan</h3></div>
              
              {/* Ringkasan Stats */}
              <div style={styles.statsGrid}>
                <div style={styles.statsValueCard}>
                   <div style={styles.statsValueLabel}>Average Win</div>
                   <div style={{...styles.statsValue, color: '#10B981'}}>{formatMoney(avgWin)}</div>
                </div>
                <div style={styles.statsValueCard}>
                   <div style={styles.statsValueLabel}>Average Loss</div>
                   <div style={{...styles.statsValue, color: '#EF4444'}}>{formatMoney(avgLoss)}</div>
                </div>
                <div style={styles.statsValueCard}>
                   <div style={styles.statsValueLabel}>Winning Streak</div>
                   <div style={{...styles.statsValue, color: '#F59E0B'}}>{streaks.maxWinStreak} trades</div>
                </div>
                <div style={styles.statsValueCard}>
                   <div style={styles.statsValueLabel}>Losing Streak</div>
                   <div style={{...styles.statsValue, color: '#6b7280'}}>{streaks.maxLossStreak} trades</div>
                </div>
              </div>
              <div style={styles.statsValueCardSingle}>
                 <div style={styles.statsValueLabelSingle}>Max Drawdown</div>
                 <div style={{...styles.statsValueSingle, color: '#EF4444'}}>{maxDrawdown}%</div>
              </div>

              {/* Grafik BUY vs SELL */}
              <div style={{...styles.card, height: '250px', marginTop: '15px'}}>
                 <div style={styles.cardHeader}><FiPieChart/> <span style={styles.cardLabel}>📉 BUY vs SELL Performance</span></div>
                 {chartTrades.length === 0 ? <p style={{textAlign: 'center', color: '#6b7280', marginTop: '50px'}}>Belum ada data</p> : (
                    <ResponsiveContainer width="100%" height="90%">
                       <PieChart>
                         <Pie data={buySellData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} fill="#8884d8" paddingAngle={5} dataKey="value" labelLine={false} label>
                             <Cell fill="#3B82F6" stroke="#1f2937" strokeWidth={2} /> {/* BUY */}
                             <Cell fill="#EF4444" stroke="#1f2937" strokeWidth={2} /> {/* SELL */}
                         </Pie>
                         <Legend iconType="circle" wrapperStyle={{fontSize: '12px'}}/>
                         <Tooltip contentStyle={{backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff'}}/>
                       </PieChart>
                    </ResponsiveContainer>
                 )}
              </div>

              {/* Grafik Pair Performance */}
              <div style={{...styles.card, height: '250px', marginTop: '15px'}}>
                 <div style={styles.cardHeader}><FiDollarSign/> <span style={styles.cardLabel}>📉 Pair PnL Performance</span></div>
                 {chartTrades.length === 0 ? <p style={{textAlign: 'center', color: '#6b7280', marginTop: '50px'}}>Belum ada data</p> : (
                    <ResponsiveContainer width="100%" height="90%">
                       <BarChart data={pairPerformanceData} layout="vertical">
                         <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                         <XAxis type="number" stroke="#9ca3af" fontSize={11} tickFormatter={(val) => currency==='IDR'?(val/1000)+'k':val} />
                         <YAxis dataKey="name" type="category" stroke="#9ca3af" fontSize={11} width={50}/>
                         <Tooltip contentStyle={{backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff'}}/>
                         <ReferenceLine x={0} stroke="#4B5563" />
                         <Bar dataKey="pnl" fill="#3B82F6" radius={[0, 4, 4, 0]}>
                           {pairPerformanceData.map((entry, index) => (
                             <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? '#10B981' : '#EF4444'} />
                           ))}
                         </Bar>
                       </BarChart>
                    </ResponsiveContainer>
                 )}
              </div>

           </div>
        )}

        {/* TAMPILAN PORTOFOLIO (Segera Hadir) */}
        {activeTab === 'portofolio' && (
           <div style={{textAlign: 'center', color: '#9ca3af', marginTop: '50px'}}>
              <FiBriefcase size={40} />
              <h3>Multi Akun Broker</h3>
              <p>Fitur untuk melacak Headway, IC Markets, dan Exness akan segera hadir.</p>
           </div>
        )}

        {/* TAMPILAN SETTING */}
        {activeTab === 'setting' && (
           <div style={styles.card}>
              <div style={{...styles.cardHeader, marginBottom:'20px'}}><FiSettings size={30} /> <h3 style={{marginTop: 0, color: '#fff'}}>Pengaturan</h3></div>
              <div style={styles.settingItem}>
                 <span>Mata Uang Jurnal</span>
                 <span style={{color: '#3B82F6'}}>{currency}</span>
              </div>
              <div style={styles.settingItem}>
                 <span>Backup Cloud Firebase</span>
                 <span style={{display:'flex', alignItems:'center', gap:'5px', color: '#10B981'}}><FiCheckCircle /> Aktif</span>
              </div>
              <button onClick={() => signOut(auth)} style={{...styles.btnPrimary, background: '#EF4444', marginTop: '20px'}}>Logout Akun</button>
           </div>
        )}

      </div>

      {/* BOTTOM NAVIGATION (Custom Icons buatan sendiri, No Emoji) */}
      <nav style={styles.bottomNav}>
         {[
           { id: 'dashboard', icon: <CustomHomeIcon size={20} />, label: 'Home' },
           { id: 'transaksi', icon: <CustomHistoryIcon size={20} />, label: 'Histori' },
           { id: 'statistik', icon: <CustomStatsIcon size={20} />, label: 'Stats' },
           { id: 'portofolio', icon: <CustomPortfolioIcon size={20} />, label: 'Akun' },
           { id: 'setting', icon: <CustomSettingIcon size={20} />, label: 'Setting' },
         ].map(tab => (
           <div 
             key={tab.id} 
             onClick={() => setActiveTab(tab.id)} 
             style={{...styles.navItem, color: activeTab === tab.id ? '#3B82F6' : '#6b7280'}}
           >
             <span style={{filter: activeTab === tab.id ? 'none' : 'grayscale(100%)'}}>{tab.icon}</span>
             <span style={{fontSize: '10px'}}>{tab.label}</span>
           </div>
         ))}
      </nav>
    </div>
  );
}

// ===========================================
// KUSTOM IKON UI BUATAN SENDIRI (SVG) NO EMOJI!
// ===========================================
const CustomMoneyIcon = ({ size = 16, color = "#fff" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2Z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M12 6V18" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M15 9H11.5C10.6716 9 10 9.67157 10 10.5C10 11.3284 10.6716 12 11.5 12H12.5C13.3284 12 14 12.6716 14 13.5C14 14.3284 13.3284 15 12.5 15H9" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const CustomWinRateIcon = ({ size = 16, color = "#fff" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22 11.08V12C21.9988 14.1564 21.3005 16.2547 20.0093 17.9818C18.7182 19.709 16.9033 20.9725 14.8354 21.5839C12.7674 22.1953 10.5573 22.1219 8.53447 21.3746C6.51168 20.6273 4.78311 19.2467 3.60494 17.4371C2.42677 15.6274 1.86384 13.4839 1.99821 11.3332C2.13258 9.18252 2.95681 7.14147 4.34612 5.51368C5.73543 3.8859 7.61483 2.75953 9.70273 2.29373C11.7906 1.82793 13.9723 2.04781 15.92 2.92" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M22 4L12 14.01L9 11.01" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const CustomDeleteIcon = ({ size = 16, color = "#6b7280" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 6H21" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const CustomHomeIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 9.5L12 3L21 9.5V20C21 20.5304 20.7893 21.0391 20.4142 21.4142C20.0391 21.7893 19.5304 22 19 22H5C4.46957 22 3.96086 21.7893 3.58579 21.4142C3.21071 21.0391 3 20.5304 3 20V9.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M9 22V12H15V22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const CustomHistoryIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 8V12L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M3.05 11C3.44553 7.82428 5.16109 4.95909 7.78426 3.09015C10.4074 1.2212 13.6277 0.567086 16.6669 1.2842C19.7061 2.00132 22.2038 4.00403 23.5593 6.81155C24.9148 9.61907 24.9667 12.8906 23.7025 15.8368C22.4382 18.783 19.988 21.049 16.9429 22.0837C13.8978 23.1184 10.609 22.7937 7.80004 21.187C4.99103 19.5804 3.01358 16.8839 2.34 13.75M3.05 11L7.5 13M3.05 11L1.5 15.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const CustomStatsIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M18 20V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M12 20V4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M6 20V14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const CustomPortfolioIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 7H4C2.89543 7 2 7.89543 2 9V19C2 20.1046 2.89543 21 4 21H20C21.1046 21 22 20.1046 22 19V9C22 7.89543 21.1046 7 20 7Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M16 21V5C16 4.46957 15.7893 3.96086 15.4142 3.58579C15.0391 3.21071 14.5304 3 14 3H10C9.46957 3 8.96086 3.21071 8.58579 3.58579C8.21071 3.96086 8 4.46957 8 5V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const CustomSettingIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const CustomUserIcon = ({ size = 20, color = "#fff" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M12 11C14.2091 11 16 9.20914 16 7C16 4.79086 14.2091 3 12 3C9.79086 3 8 4.79086 8 7C8 9.20914 9.79086 11 12 11Z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// ===========================================
// STYLE OBJECTS (MODIFIED PROFESSIONAL)
// ===========================================
const styles = {
  authContainer: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#111827' },
  authCard: { background: '#1f2937', padding: '30px', borderRadius: '12px', width: '90%', maxWidth: '350px', textAlign: 'center' },
  brandTitle: { color: '#FFD700', margin: '0 0 5px 0', fontSize: '32px', fontWeight: 'bold' },
  subTitle: { color: '#9ca3af', fontSize: '14px', marginBottom: '20px' },
  form: { display: 'flex', flexDirection: 'column', gap: '15px' },
  input: { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #374151', background: '#111827', color: '#fff', boxSizing: 'border-box', outline: 'none', fontSize: '14px' },
  btnPrimary: { background: '#3B82F6', color: '#fff', padding: '12px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer', width: '100%' },
  switchAuth: { color: '#6b7280', fontSize: '13px', marginTop: '20px', cursor: 'pointer' },
  errorBox: { background: 'rgba(239, 68, 68, 0.2)', color: '#EF4444', padding: '10px', borderRadius: '8px', fontSize: '12px', marginBottom: '15px' },
  
  appContainer: { backgroundColor: '#111827', color: '#f3f4f6', minHeight: '100vh', fontFamily: 'system-ui, sans-serif', paddingBottom: '70px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 20px', background: '#1f2937', position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #374151' },
  balanceBadge: { background: 'rgba(16, 185, 129, 0.2)', color: '#10B981', padding: '5px 12px', borderRadius: '20px', fontSize: '14px', fontWeight: 'bold', display:'flex', alignItems:'center', gap:'5px' },
  profileBtn: { background: '#374151', width: '35px', height: '35px', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer' },
  
  mainContent: { padding: '15px', maxWidth: '600px', margin: '0 auto' },
  quickActions: { display: 'flex', gap: '10px', overflowX: 'auto', marginBottom: '15px' },
  actionBtn: { background: '#1f2937', color: '#f3f4f6', border: '1px solid #374151', padding: '8px 15px', borderRadius: '20px', whiteSpace: 'nowrap', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '5px' },
  
  statsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom:'15px' },
  card: { background: '#1f2937', borderRadius: '12px', padding: '15px', border: '1px solid #374151' },
  cardHeader: { display:'flex', alignItems:'center', gap:'8px', marginBottom:'8px' },
  cardLabel: { fontSize: '12px', color: '#9ca3af' },
  
  typeBtn: { flex: 1, padding: '12px', borderRadius: '8px', border: 'none', color: '#fff', fontWeight: 'bold', display:'flex', alignItems:'center', justifyContent:'center', gap:'5px' },
  
  tradeCard: { background: '#1f2937', borderRadius: '10px', padding: '15px', border: '1px solid #374151', borderLeft: '4px solid #3B82F6', transition:'background 0.2s', cursor: 'pointer', ':hover': {background: '#2d3748'} },
  settingItem: { display: 'flex', justifyContent: 'space-between', padding: '15px 0', borderBottom: '1px solid #374151', fontSize: '14px' },
  
  bottomNav: { position: 'fixed', bottom: 0, left: 0, right: 0, background: '#1f2937', display: 'flex', justifyContent: 'space-around', padding: '10px 0', borderTop: '1px solid #374151', zIndex: 10, paddingBottom: 'env(safe-area-inset-bottom)' },
  navItem: { display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', transition: 'color 0.2s' },

  // Stats CSS
  statsValueCard: { background: '#1f2937', borderRadius: '10px', padding: '10px', border: '1px solid #374151', textAlign:'center' },
  statsValueLabel: { fontSize: '11px', color: '#9ca3af', marginBottom:'3px' },
  statsValue: { fontSize: '16px', fontWeight:'bold', color:'#fff' },
  statsValueCardSingle: { background: '#1f2937', borderRadius: '10px', padding: '15px', border: '1px solid #374151', textAlign:'center', marginTop:'10px' },
  statsValueLabelSingle: { fontSize: '12px', color: '#9ca3af', marginBottom:'5px' },
  statsValueSingle: { fontSize: '20px', fontWeight:'bold', color:'#fff' },
};
