import React, { useState, useEffect, useMemo } from 'react';
import { 
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, collection, addDoc, query, where, onSnapshot, deleteDoc, doc, setDoc, getDoc 
} from 'firebase/firestore';
import { db } from './firebase'; 
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Area, AreaChart 
} from 'recharts';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const auth = getAuth();

export default function App() {
  const [user, setUser] = useState(null);
  const [isRegister, setIsRegister] = useState(false);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [currency, setCurrency] = useState('USD'); 

  const [trades, setTrades] = useState([]);
  const [pair, setPair] = useState('EURUSD');
  const [type, setType] = useState('BUY');
  const [lot, setLot] = useState('');
  const [pnl, setPnl] = useState('');
  const [notes, setNotes] = useState('');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('Semua'); 
  const [filterValue, setFilterValue] = useState(''); 

  const [chartPeriod, setChartPeriod] = useState('Semua'); 

  const formatMoney = (val) => {
    if (currency === 'IDR') {
      return 'Rp' + Math.abs(val).toLocaleString('id-ID');
    }
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
    if (!lot || !pnl) return;

    const dateObj = new Date();
    const monthYear = dateObj.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });

    await addDoc(collection(db, 'forex_trades'), {
      userId: user.uid,
      pair,
      type,
      lot: parseFloat(lot),
      pnl: parseFloat(pnl),
      notes,
      date: dateObj.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }),
      monthYear: monthYear,
      timestamp: dateObj.getTime()
    });

    setLot('');
    setPnl('');
    setNotes('');
  };

  const handleDelete = async (id) => {
    if(window.confirm("Yakin ingin menghapus jurnal ini?")) {
      await deleteDoc(doc(db, 'forex_trades', id));
    }
  };

  const filteredTrades = trades.filter(t => {
    const matchSearch = t.pair.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        (t.notes && t.notes.toLowerCase().includes(searchTerm.toLowerCase()));
    
    let matchTime = true;
    if (filterType !== 'Semua' && filterValue) {
      const d = new Date(t.timestamp);
      if (filterType === 'Hari') {
        const tDate = d.toLocaleDateString('en-CA');
        matchTime = (tDate === filterValue);
      } else if (filterType === 'Bulan') {
        const tMonth = d.toLocaleDateString('en-CA').slice(0, 7);
        matchTime = (tMonth === filterValue);
      } else if (filterType === 'Tahun') {
        matchTime = (d.getFullYear().toString() === filterValue);
      } else if (filterType === 'Minggu') {
        const targetD = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        targetD.setUTCDate(targetD.getUTCDate() + 4 - (targetD.getUTCDay()||7));
        const yearStart = new Date(Date.UTC(targetD.getUTCFullYear(),0,1));
        const weekNo = Math.ceil(( ( (targetD - yearStart) / 86400000) + 1)/7);
        const weekStr = targetD.getUTCFullYear() + "-W" + (weekNo < 10 ? '0'+weekNo : weekNo);
        matchTime = (weekStr === filterValue);
      }
    }
    return matchSearch && matchTime;
  });

  const chartTrades = useMemo(() => {
    if (chartPeriod === 'Semua') return filteredTrades;
    const now = new Date().getTime();
    const periods = {
      '1 Minggu': 7 * 24 * 60 * 60 * 1000,
      '1 Bulan': 30 * 24 * 60 * 60 * 1000,
      '1 Tahun': 365 * 24 * 60 * 60 * 1000,
      '3 Tahun': 3 * 365 * 24 * 60 * 60 * 1000,
    };
    const limit = now - periods[chartPeriod];
    return filteredTrades.filter(t => t.timestamp >= limit);
  }, [filteredTrades, chartPeriod]);

  const totalPnl = filteredTrades.reduce((acc, item) => acc + item.pnl, 0);
  const totalWin = filteredTrades.filter(t => t.pnl > 0).length;
  const totalLoss = filteredTrades.filter(t => t.pnl < 0).length;
  const winRate = filteredTrades.length ? ((totalWin / filteredTrades.length) * 100).toFixed(1) : 0;

  const chartData = useMemo(() => {
    let runningBalance = 0;
    return chartTrades.map((t, index) => {
      runningBalance += parseFloat(t.pnl);
      // Membulatkan desimal agar rapi dan menghilangkan error angka panjang
      const roundedBalance = Math.round(runningBalance * 100) / 100;
      return {
        tradeCount: `T${index + 1}`,
        balance: roundedBalance,
        pair: t.pair,
        pnl: t.pnl
      };
    });
  }, [chartTrades]);

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.setTextColor(41, 128, 185);
    doc.text('STARFX - Laporan Jurnal Perdagangan', 14, 22);
    
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Periode Filter: ${filterType === 'Semua' ? 'Keseluruhan Waktu' : filterValue}`, 14, 30);
    doc.text(`Email Trader: ${user.email}`, 14, 36);
    doc.text(`Tanggal Cetak: ${new Date().toLocaleDateString('id-ID')}`, 14, 42);

    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text(`Ringkasan Kinerja:`, 14, 52);
    doc.setFontSize(10);
    doc.text(`Total Transaksi: ${filteredTrades.length} Trades`, 14, 58);
    doc.text(`Win Rate: ${winRate}% (${totalWin} Win / ${totalLoss} Loss)`, 14, 64);
    
    const pnlText = `Net Profit/Loss: ${totalPnl >= 0 ? '+' : '-'}${formatMoney(totalPnl)}`;
    doc.setTextColor(totalPnl >= 0 ? 39 : 231, totalPnl >= 0 ? 174 : 76, totalPnl >= 0 ? 96 : 60);
    doc.text(pnlText, 14, 70);

    const tableColumn = ["Tanggal", "Asset", "Aksi", "Lot", `PnL (${currency})`, "Catatan"];
    const tableRows = [];

    [...filteredTrades].reverse().forEach(trade => {
      const pnlDisplay = trade.pnl >= 0 ? `+${formatMoney(trade.pnl)}` : `-${formatMoney(trade.pnl)}`;
      const tradeData = [trade.date, trade.pair, trade.type, trade.lot, pnlDisplay, trade.notes || '-'];
      tableRows.push(tradeData);
    });

    doc.autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 78,
      theme: 'striped',
      headStyles: { fillColor: [41, 128, 185] },
      styles: { fontSize: 9 },
    });

    doc.save(`STARFX_Report.pdf`);
  };

  if (!user) {
    return (
      <div style={styles.authContainer}>
        <div style={styles.authCard}>
          <div style={styles.glowCircle}></div>
          <h2 style={styles.brandTitle}>⚡ STARFX <span style={{color: '#fff'}}>JOURNAL</span></h2>
          <p style={styles.subTitle}>{isRegister ? 'Mulai perjalanan disiplinmu' : 'Masuk ke Ruang Kerjamu'}</p>
          
          {authError && <div style={styles.errorBox}>{authError}</div>}

          <form onSubmit={handleAuth} style={styles.form}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Email Address</label>
              <input type="email" placeholder="trade@starfx.com" value={email} onChange={e => setEmail(e.target.value)} required style={styles.input} />
            </div>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Password</label>
              <input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required style={styles.input} />
            </div>
            
            {isRegister && (
              <div style={styles.inputGroup}>
                <label style={styles.label}>Mata Uang Akun</label>
                <select value={currency} onChange={e => setCurrency(e.target.value)} style={styles.input}>
                  <option value="USD">Dolar Amerika (USD $)</option>
                  <option value="IDR">Rupiah Indonesia (IDR Rp)</option>
                </select>
              </div>
            )}

            <button type="submit" style={styles.btnPrimary}>{isRegister ? 'Daftar Sekarang' : 'Login Dashboard'}</button>
          </form>

          <p style={styles.switchAuth}>
            {isRegister ? 'Sudah menjadi member?' : 'Trader baru?'} {' '}
            <span onClick={() => setIsRegister(!isRegister)} style={styles.link}>{isRegister ? 'Login disini' : 'Buat Akun'}</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.dashboard}>
      <header style={styles.nav}>
        <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
          <div style={{background: 'linear-gradient(135deg, #0ea5e9, #8b5cf6)', padding: '6px', borderRadius: '8px'}}>
             <h3 style={{margin: 0, color: '#fff', fontSize: '18px'}}>⚡</h3>
          </div>
          <h3 style={{margin: 0, color: '#f8fafc', letterSpacing: '1px'}}>STARFX <span style={{fontWeight: 300, fontSize: '14px', color: '#94a3b8'}}>Pro Journal</span></h3>
        </div>
        <div style={{display: 'flex', alignItems: 'center', gap: '20px'}}>
          <span style={{fontSize: '13px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '8px'}}>
             <span style={{width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981'}}></span>
             {user.email} | {currency}
          </span>
          <button onClick={() => signOut(auth)} style={styles.btnDanger}>Logout</button>
        </div>
      </header>

      <div style={styles.content}>
        
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', flexWrap: 'wrap', gap: '15px'}}>
           <h2 style={{margin: 0, fontWeight: '600', fontSize: '24px'}}>Ikhtisar Kinerja</h2>
           <div style={{display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap'}}>
              
              <select value={filterType} onChange={(e) => {setFilterType(e.target.value); setFilterValue('');}} style={styles.selectOutline}>
                <option value="Semua">Semua Waktu</option>
                <option value="Hari">Harian</option>
                <option value="Minggu">Mingguan</option>
                <option value="Bulan">Bulanan</option>
                <option value="Tahun">Tahunan</option>
              </select>

              {filterType === 'Hari' && <input type="date" value={filterValue} onChange={e => setFilterValue(e.target.value)} style={styles.selectOutline} />}
              {filterType === 'Minggu' && <input type="week" value={filterValue} onChange={e => setFilterValue(e.target.value)} style={styles.selectOutline} />}
              {filterType === 'Bulan' && <input type="month" value={filterValue} onChange={e => setFilterValue(e.target.value)} style={styles.selectOutline} />}
              {filterType === 'Tahun' && <input type="number" placeholder="Tahun (Contoh: 2026)" value={filterValue} onChange={e => setFilterValue(e.target.value)} style={{...styles.selectOutline, width: '130px'}} />}

              <button onClick={exportToPDF} style={styles.btnExport}>
                📄 Unduh Laporan PDF
              </button>
           </div>
        </div>

        <div style={styles.statsGrid}>
          <div style={styles.card}>
            <div style={styles.cardIconBox}><span style={{fontSize: '20px'}}>💰</span></div>
            <span style={styles.cardTitle}>Net Profit / Loss</span>
            <h2 style={{color: totalPnl >= 0 ? '#34d399' : '#fb7185', margin: '10px 0 5px 0', fontSize: '32px', fontWeight: '700'}}>
              {totalPnl >= 0 ? '+' : '-'}{formatMoney(totalPnl)}
            </h2>
            <span style={{fontSize: '12px', color: '#64748b'}}>Dari {filteredTrades.length} total transaksi</span>
          </div>
          <div style={styles.card}>
             <div style={{...styles.cardIconBox, background: 'rgba(14, 165, 233, 0.1)'}}><span style={{fontSize: '20px'}}>🎯</span></div>
            <span style={styles.cardTitle}>Win Rate Akurasi</span>
            <h2 style={{color: '#38bdf8', margin: '10px 0 5px 0', fontSize: '32px', fontWeight: '700'}}>{winRate}%</h2>
            <span style={{fontSize: '12px', color: '#64748b'}}>Persentase kemenangan</span>
          </div>
          <div style={styles.card}>
            <div style={{...styles.cardIconBox, background: 'rgba(139, 92, 246, 0.1)'}}><span style={{fontSize: '20px'}}>⚖️</span></div>
            <span style={styles.cardTitle}>Rasio Win / Loss</span>
            <div style={{display: 'flex', alignItems: 'center', gap: '10px', margin: '10px 0 5px 0'}}>
                <h2 style={{margin: 0, fontSize: '28px', color: '#34d399'}}>{totalWin}W</h2>
                <span style={{color: '#475569', fontSize: '20px'}}>/</span>
                <h2 style={{margin: 0, fontSize: '28px', color: '#fb7185'}}>{totalLoss}L</h2>
            </div>
            <span style={{fontSize: '12px', color: '#64748b'}}>Frekuensi hasil trading</span>
          </div>
        </div>

        <div style={{...styles.card, marginBottom: '25px', height: '420px', padding: '30px'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap'}}>
             <h4 style={{color: '#f8fafc', fontWeight: '600', margin: 0, fontSize: '16px'}}>📈 Pertumbuhan Akun</h4>
             
             <div style={{display: 'flex', gap: '5px', background: '#020617', padding: '5px', borderRadius: '8px'}}>
                {['1 Minggu', '1 Bulan', '1 Tahun', '3 Tahun', 'Semua'].map(p => (
                   <button 
                      key={p} 
                      onClick={() => setChartPeriod(p)} 
                      style={{...styles.chartBtn, background: chartPeriod === p ? '#38bdf8' : 'transparent', color: chartPeriod === p ? '#020617' : '#94a3b8'}}
                   >
                      {p}
                   </button>
                ))}
             </div>
          </div>
          
          {chartTrades.length === 0 ? (
             <div style={{height: '80%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column'}}>
                <span style={{fontSize: '40px', opacity: 0.5}}>📊</span>
                <p style={{color: '#64748b', fontSize: '14px', marginTop: '15px'}}>Belum ada data untuk periode grafik ini.</p>
             </div>
          ) : (
            <ResponsiveContainer width="100%" height="80%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: currency === 'IDR' ? 10 : -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="tradeCount" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => formatMoney(value)} />
                <Tooltip 
                   formatter={(value) => [(value >= 0 ? '+' : '-') + formatMoney(value), "Total Saldo"]}
                   contentStyle={{backgroundColor: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(5px)', border: '1px solid #334155', borderRadius: '12px', color: '#fff', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)'}} 
                   itemStyle={{color: '#38bdf8', fontWeight: 'bold'}} 
                />
                <ReferenceLine y={0} stroke="#475569" strokeDasharray="3 3" />
                <Area type="monotone" dataKey="balance" name="Total Saldo" stroke="#38bdf8" strokeWidth={3} fillOpacity={1} fill="url(#colorBalance)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div style={styles.mainGrid}>
          {/* Input Form Card */}
          <div style={{...styles.card, height: 'fit-content', flex: '1 1 300px'}}>
            <div style={{display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px'}}>
               <span style={{background: '#1e293b', padding: '8px', borderRadius: '8px', fontSize: '16px'}}>✍️</span>
               <h4 style={{color: '#f8fafc', fontWeight: '600', margin: 0}}>Input Jurnal</h4>
            </div>
            
            <form onSubmit={handleAddTrade} style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Pair / Asset</label>
                <select value={pair} onChange={e => setPair(e.target.value)} style={styles.input}>
                  <optgroup label="Majors">
                    <option>EURUSD</option><option>GBPUSD</option><option>USDJPY</option>
                    <option>USDCAD</option><option>USDCHF</option><option>AUDUSD</option><option>NZDUSD</option>
                  </optgroup>
                  <optgroup label="Minors & Crosses">
                    <option>EURGBP</option><option>EURJPY</option><option>GBPJPY</option><option>AUDJPY</option>
                  </optgroup>
                  <optgroup label="Commodities">
                    <option>XAUUSD</option><option>XAGUSD</option><option>WTI (Oil)</option>
                  </optgroup>
                  <optgroup label="Crypto & Indices">
                    <option>BTCUSD</option><option>ETHUSD</option><option>US30</option><option>NAS100</option>
                  </optgroup>
                </select>
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Jenis Posisi</label>
                <div style={{display: 'flex', gap: '10px', width: '100%'}}>
                  <button type="button" onClick={() => setType('BUY')} style={{...styles.toggleBtn, background: type === 'BUY' ? 'rgba(56, 189, 248, 0.1)' : 'transparent', color: type === 'BUY' ? '#38bdf8' : '#64748b', borderColor: type === 'BUY' ? '#38bdf8' : '#334155'}}>
                    📈 BUY
                  </button>
                  <button type="button" onClick={() => setType('SELL')} style={{...styles.toggleBtn, background: type === 'SELL' ? 'rgba(251, 113, 133, 0.1)' : 'transparent', color: type === 'SELL' ? '#fb7185' : '#64748b', borderColor: type === 'SELL' ? '#fb7185' : '#334155'}}>
                    📉 SELL
                  </button>
                </div>
              </div>

              <div style={{display: 'flex', gap: '12px'}}>
                <div style={{flex: 1, ...styles.inputGroup}}>
                  <label style={styles.label}>Lot Size</label>
                  <input type="number" step="0.01" placeholder="0.10" value={lot} onChange={e => setLot(e.target.value)} required style={styles.input} />
                </div>
                <div style={{flex: 1, ...styles.inputGroup}}>
                  <label style={styles.label}>Hasil PnL ({currency})</label>
                  <input type="number" step="0.01" placeholder={currency === 'IDR' ? "500000" : "50.00"} value={pnl} onChange={e => setPnl(e.target.value)} required style={{...styles.input, color: pnl > 0 ? '#34d399' : pnl < 0 ? '#fb7185' : '#f8fafc'}} />
                </div>
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Catatan (Opsional)</label>
                <textarea rows="2" placeholder="Tulis alasan masuk posisi, setup, atau kesalahan..." value={notes} onChange={e => setNotes(e.target.value)} style={{...styles.input, resize: 'none'}} />
              </div>

              <button type="submit" style={styles.btnGradient}>Simpan Transaksi</button>
            </form>
          </div>

          {/* Table Card with Scroll */}
          <div style={{...styles.card, display: 'flex', flexDirection: 'column', flex: '2 1 500px'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
              <h4 style={{color: '#f8fafc', fontWeight: '600', margin: 0}}>📋 Riwayat Trading</h4>
              <div style={{position: 'relative'}}>
                <span style={{position: 'absolute', left: '12px', top: '9px', fontSize: '12px', color: '#64748b'}}>🔍</span>
                <input type="text" placeholder="Cari Pair / Catatan..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{...styles.input, width: '220px', padding: '8px 12px 8px 32px', fontSize: '13px', background: '#020617'}} />
              </div>
            </div>

            {/* Area Tabel dengan Scrollbar Dalam */}
            <div style={{overflowX: 'auto', overflowY: 'auto', maxHeight: '450px', borderRadius: '8px', border: '1px solid #1e293b'}}>
              <table style={styles.table}>
                <thead>
                  <tr style={{textAlign: 'left'}}>
                    <th style={{...styles.th, position: 'sticky', top: 0, backgroundColor: '#020617', zIndex: 1}}>Waktu</th>
                    <th style={{...styles.th, position: 'sticky', top: 0, backgroundColor: '#020617', zIndex: 1}}>Asset</th>
                    <th style={{...styles.th, position: 'sticky', top: 0, backgroundColor: '#020617', zIndex: 1}}>Posisi</th>
                    <th style={{...styles.th, position: 'sticky', top: 0, backgroundColor: '#020617', zIndex: 1}}>Lot</th>
                    <th style={{...styles.th, position: 'sticky', top: 0, backgroundColor: '#020617', zIndex: 1}}>PnL</th>
                    <th style={{...styles.th, position: 'sticky', top: 0, backgroundColor: '#020617', zIndex: 1}}>Catatan</th>
                    <th style={{...styles.th, position: 'sticky', top: 0, backgroundColor: '#020617', zIndex: 1}}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTrades.length === 0 ? (
                    <tr><td colSpan="7" style={{padding: '30px', textAlign: 'center', color: '#64748b'}}>Tidak ada data transaksi yang ditemukan.</td></tr>
                  ) : (
                    [...filteredTrades].reverse().map((item) => (
                      <tr key={item.id} style={styles.trHover}>
                        <td style={styles.td}>
                          <div style={{display: 'flex', flexDirection: 'column'}}>
                             <span style={{color: '#e2e8f0'}}>{item.date}</span>
                          </div>
                        </td>
                        <td style={styles.td}><span style={styles.badge}>{item.pair}</span></td>
                        <td style={styles.td}>
                           <span style={{
                              padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold',
                              background: item.type === 'BUY' ? 'rgba(56, 189, 248, 0.1)' : 'rgba(251, 113, 133, 0.1)',
                              color: item.type === 'BUY' ? '#38bdf8' : '#fb7185'
                           }}>
                             {item.type}
                           </span>
                        </td>
                        <td style={styles.td}>{item.lot}</td>
                        <td style={{...styles.td, color: item.pnl >= 0 ? '#34d399' : '#fb7185', fontWeight: 'bold'}}>
                          {item.pnl >= 0 ? '+' : '-'}{formatMoney(item.pnl)}
                        </td>
                        <td style={{...styles.td, color: '#94a3b8', maxWidth: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                          {item.notes || '-'}
                        </td>
                        <td style={styles.td}>
                           <button onClick={() => handleDelete(item.id)} style={{background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '14px', opacity: 0.7}}>
                             🗑️
                           </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  authContainer: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#0f172a' },
  authCard: { background: '#1e293b', padding: '40px', borderRadius: '16px', width: '350px', textAlign: 'center', position: 'relative', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' },
  glowCircle: { position: 'absolute', top: '-50px', right: '-50px', width: '100px', height: '100px', background: '#38bdf8', filter: 'blur(60px)', borderRadius: '50%' },
  brandTitle: { color: '#38bdf8', margin: '0 0 5px 0', fontSize: '24px' },
  subTitle: { color: '#94a3b8', fontSize: '14px', marginBottom: '25px' },
  errorBox: { background: 'rgba(251, 113, 133, 0.1)', color: '#fb7185', padding: '10px', borderRadius: '8px', marginBottom: '15px', fontSize: '13px' },
  form: { display: 'flex', flexDirection: 'column', gap: '15px' },
  inputGroup: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '5px' },
  label: { color: '#94a3b8', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' },
  input: { width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #334155', background: '#0f172a', color: '#f8fafc', boxSizing: 'border-box' },
  btnPrimary: { background: '#38bdf8', color: '#0f172a', padding: '12px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' },
  switchAuth: { color: '#64748b', fontSize: '13px', marginTop: '20px' },
  link: { color: '#38bdf8', cursor: 'pointer', fontWeight: 'bold' },
  dashboard: { minHeight: '100vh', backgroundColor: '#0f172a', color: '#f8fafc', padding: '20px', boxSizing: 'border-box', fontFamily: 'system-ui, -apple-system, sans-serif' },
  nav: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1e293b', padding: '15px 25px', borderRadius: '16px', marginBottom: '25px' },
  btnDanger: { background: 'rgba(251, 113, 133, 0.1)', color: '#fb7185', border: '1px solid #fb7185', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' },
  content: { maxWidth: '1200px', margin: '0 auto' },
  selectOutline: { background: '#1e293b', color: '#f8fafc', border: '1px solid #334155', padding: '8px 12px', borderRadius: '8px', outline: 'none', fontSize: '14px' },
  btnExport: { background: '#10b981', color: '#fff', border: 'none', padding: '10px 15px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '25px' },
  card: { background: '#1e293b', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' },
  cardIconBox: { background: 'rgba(250, 204, 21, 0.1)', width: '40px', height: '40px', borderRadius: '10px', display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '15px' },
  cardTitle: { color: '#94a3b8', fontSize: '13px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px' },
  mainGrid: { display: 'flex', flexWrap: 'wrap', gap: '20px' }, // Diubah agar responsif di HP
  toggleBtn: { flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid', cursor: 'pointer', fontWeight: 'bold' },
  btnGradient: { background: 'linear-gradient(135deg, #38bdf8, #8b5cf6)', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', marginTop: '10px' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '12px 15px', color: '#94a3b8', fontSize: '12px', fontWeight: '600', borderBottom: '1px solid #1e293b' },
  td: { padding: '15px', borderBottom: '1px solid #1e293b', fontSize: '13px' },
  trHover: { transition: 'background 0.2s' },
  badge: { background: '#334155', padding: '4px 8px', borderRadius: '6px', fontSize: '12px', color: '#e2e8f0' },
  chartBtn: { border: 'none', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s' }
};
