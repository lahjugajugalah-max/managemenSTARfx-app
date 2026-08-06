import React, { useState, useEffect, useMemo } from 'react';
import { 
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, collection, addDoc, query, where, onSnapshot, deleteDoc, doc 
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

  const [trades, setTrades] = useState([]);
  const [pair, setPair] = useState('EURUSD');
  const [type, setType] = useState('BUY');
  const [lot, setLot] = useState('');
  const [pnl, setPnl] = useState('');
  const [notes, setNotes] = useState('');
  
  // Fitur Filter & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMonth, setFilterMonth] = useState('Semua Bulan');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
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
        await createUserWithEmailAndPassword(auth, email, password);
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

    // Menghasilkan string bulan/tahun untuk filter (contoh: "Okt 2023")
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

  // Mendapatkan daftar bulan unik untuk dropdown filter
  const uniqueMonths = ['Semua Bulan', ...new Set(trades.map(t => t.monthYear).filter(Boolean))];

  // Logika Filtering (Search + Bulan)
  const filteredTrades = trades.filter(t => {
    const matchSearch = t.pair.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        (t.notes && t.notes.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchMonth = filterMonth === 'Semua Bulan' || t.monthYear === filterMonth;
    return matchSearch && matchMonth;
  });

  // Kalkulasi Statistik berdasarkan data yang di-filter (Bukan semua data)
  const totalPnl = filteredTrades.reduce((acc, item) => acc + item.pnl, 0);
  const totalWin = filteredTrades.filter(t => t.pnl > 0).length;
  const totalLoss = filteredTrades.filter(t => t.pnl < 0).length;
  const winRate = filteredTrades.length ? ((totalWin / filteredTrades.length) * 100).toFixed(1) : 0;

  const chartData = useMemo(() => {
    let runningBalance = 0;
    return filteredTrades.map((t, index) => {
      runningBalance += t.pnl;
      return {
        tradeCount: `T${index + 1}`,
        balance: runningBalance,
        pair: t.pair,
        pnl: t.pnl
      };
    });
  }, [filteredTrades]);

  // Fitur EXPORT PDF
  const exportToPDF = () => {
    const doc = new jsPDF();
    
    // Header PDF
    doc.setFontSize(20);
    doc.setTextColor(41, 128, 185); // Warna Biru Profesional
    doc.text('STARFX - Laporan Jurnal Perdagangan', 14, 22);
    
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Periode: ${filterMonth}`, 14, 30);
    doc.text(`Email Trader: ${user.email}`, 14, 36);
    doc.text(`Tanggal Cetak: ${new Date().toLocaleDateString('id-ID')}`, 14, 42);

    // Ringkasan Statistik
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text(`Ringkasan Kinerja:`, 14, 52);
    doc.setFontSize(10);
    doc.text(`Total Transaksi: ${filteredTrades.length} Trades`, 14, 58);
    doc.text(`Win Rate: ${winRate}% (${totalWin} Win / ${totalLoss} Loss)`, 14, 64);
    
    const pnlText = `Net Profit/Loss: ${totalPnl >= 0 ? '+' : '-'}$${Math.abs(totalPnl).toFixed(2)}`;
    doc.setTextColor(totalPnl >= 0 ? 39 : 231, totalPnl >= 0 ? 174 : 76, totalPnl >= 0 ? 96 : 60); // Hijau atau Merah
    doc.text(pnlText, 14, 70);

    // Tabel Data Transaksi
    const tableColumn = ["Tanggal", "Asset", "Aksi", "Lot", "PnL ($)", "Catatan"];
    const tableRows = [];

    [...filteredTrades].reverse().forEach(trade => {
      const tradeData = [
        trade.date,
        trade.pair,
        trade.type,
        trade.lot,
        trade.pnl >= 0 ? `+${trade.pnl}` : trade.pnl,
        trade.notes || '-'
      ];
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

    doc.save(`STARFX_Report_${filterMonth.replace(' ', '_')}.pdf`);
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
             {user.email}
          </span>
          <button onClick={() => signOut(auth)} style={styles.btnDanger}>Logout</button>
        </div>
      </header>

      <div style={styles.content}>
        
        {/* Header Control Panel */}
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', flexWrap: 'wrap', gap: '15px'}}>
           <h2 style={{margin: 0, fontWeight: '600', fontSize: '24px'}}>Ikhtisar Kinerja</h2>
           <div style={{display: 'flex', gap: '15px'}}>
              <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} style={styles.selectOutline}>
                {uniqueMonths.map((m, i) => <option key={i} value={m}>{m}</option>)}
              </select>
              <button onClick={exportToPDF} style={styles.btnExport}>
                📄 Unduh Laporan PDF
              </button>
           </div>
        </div>

        {/* Stats Section */}
        <div style={styles.statsGrid}>
          <div style={styles.card}>
            <div style={styles.cardIconBox}><span style={{fontSize: '20px'}}>💰</span></div>
            <span style={styles.cardTitle}>Net Profit / Loss</span>
            <h2 style={{color: totalPnl >= 0 ? '#34d399' : '#fb7185', margin: '10px 0 5px 0', fontSize: '32px', fontWeight: '700'}}>
              {totalPnl >= 0 ? '+' : '-'}${Math.abs(totalPnl).toFixed(2)}
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

        {/* Chart Section */}
        <div style={{...styles.card, marginBottom: '25px', height: '380px', padding: '30px'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
             <h4 style={{color: '#f8fafc', fontWeight: '600', margin: 0, fontSize: '16px'}}>📈 Pertumbuhan Akun (Kumulatif)</h4>
             <span style={{fontSize: '12px', color: '#64748b', background: '#1e293b', padding: '4px 10px', borderRadius: '20px'}}>Periode: {filterMonth}</span>
          </div>
          
          {filteredTrades.length === 0 ? (
             <div style={{height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column'}}>
                <span style={{fontSize: '40px', opacity: 0.5}}>📊</span>
                <p style={{color: '#64748b', fontSize: '14px', marginTop: '15px'}}>Belum ada data untuk periode ini.</p>
             </div>
          ) : (
            <ResponsiveContainer width="100%" height="85%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="tradeCount" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                <Tooltip 
                   contentStyle={{backgroundColor: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(5px)', border: '1px solid #334155', borderRadius: '12px', color: '#fff', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)'}} 
                   itemStyle={{color: '#38bdf8', fontWeight: 'bold'}} 
                />
                <ReferenceLine y={0} stroke="#475569" strokeDasharray="3 3" />
                <Area type="monotone" dataKey="balance" name="Total Saldo" stroke="#38bdf8" strokeWidth={3} fillOpacity={1} fill="url(#colorBalance)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Input & Table Section */}
        <div style={styles.mainGrid}>
          {/* Input Form */}
          <div style={{...styles.card, height: 'fit-content'}}>
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
                <div style={{display: 'flex', gap: '10px'}}>
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
                  <label style={styles.label}>Hasil PnL ($)</label>
                  <input type="number" step="0.01" placeholder="50 / -20" value={pnl} onChange={e => setPnl(e.target.value)} required style={{...styles.input, color: pnl > 0 ? '#34d399' : pnl < 0 ? '#fb7185' : '#f8fafc'}} />
                </div>
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Catatan (Opsional)</label>
                <textarea rows="2" placeholder="Tulis alasan masuk posisi, setup, atau kesalahan..." value={notes} onChange={e => setNotes(e.target.value)} style={{...styles.input, resize: 'none'}} />
              </div>

              <button type="submit" style={styles.btnGradient}>Simpan Transaksi</button>
            </form>
          </div>

          {/* Table */}
          <div style={{...styles.card, display: 'flex', flexDirection: 'column'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
              <h4 style={{color: '#f8fafc', fontWeight: '600', margin: 0}}>📋 Riwayat Trading</h4>
              <div style={{position: 'relative'}}>
                <span style={{position: 'absolute', left: '12px', top: '9px', fontSize: '12px', color: '#64748b'}}>🔍</span>
                <input type="text" placeholder="Cari Pair / Catatan..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{...styles.input, width: '220px', padding: '8px 12px 8px 32px', fontSize: '13px', background: '#020617'}} />
              </div>
            </div>

            <div style={{overflowX: 'auto', borderRadius: '8px', border: '1px solid #1e293b'}}>
              <table style={styles.table}>
                <thead>
                  <tr style={{backgroundColor: '#020617', textAlign: 'left'}}>
                    <th style={styles.th}>Waktu</th>
                    <th style={styles.th}>Asset</th>
                    <th style={styles.th}>Posisi</th>
                    <th style={styles.th}>Lot</th>
                    <th style={styles.th}>PnL</th>
                    <th style={styles.th}>Catatan</th>
                    <th style={styles.th}></th>
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
                           }}>{item.type}</span>
                        </td>
                        <td style={styles.td}>{item.lot}</td>
                        <td style={{...styles.td, color: item.pnl >= 0 ? '#34d399' : '#fb7185', fontWeight: '600'}}>
                          {item.pnl >= 0 ? `+$${item.pnl}` : `-$${Math.abs(item.pnl)}`}
                        </td>
                        <td style={{...styles.td, color: '#94a3b8', fontSize: '12px', maxWidth: '140px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}} title={item.notes}>
                          {item.notes || '-'}
                        </td>
                        <td style={styles.td}>
                          <button onClick={() => handleDelete(item.id)} style={styles.btnDelete} title="Hapus">🗑️</button>
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

// --- PENGATURAN GAYA / STYLES (Professional Dark Glassmorphism) ---
const styles = {
  // Auth Styles
  authContainer: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#0f172a', backgroundImage: 'radial-gradient(circle at top right, #1e1b4b, #0f172a)', fontFamily: "'Inter', sans-serif" },
  authCard: { position: 'relative', width: '100%', maxWidth: '400px', padding: '40px', backgroundColor: 'rgba(30, 41, 59, 0.7)', backdropFilter: 'blur(16px)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)', color: '#f8fafc', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', textAlign: 'center', overflow: 'hidden' },
  glowCircle: { position: 'absolute', top: '-50px', right: '-50px', width: '150px', height: '150px', background: '#38bdf8', filter: 'blur(80px)', opacity: 0.3, zIndex: -1 },
  brandTitle: { color: '#38bdf8', letterSpacing: '2px', marginBottom: '8px', fontWeight: '800', fontSize: '26px' },
  subTitle: { color: '#94a3b8', fontSize: '14px', marginBottom: '30px' },
  form: { display: 'flex', flexDirection: 'column', gap: '18px', textAlign: 'left' },
  
  // Forms & Inputs
  inputGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '12px', color: '#94a3b8', fontWeight: '600', letterSpacing: '0.5px', textTransform: 'uppercase' },
  input: { padding: '12px 14px', borderRadius: '10px', border: '1px solid #334155', backgroundColor: 'rgba(15, 23, 42, 0.6)', color: '#f8fafc', outline: 'none', width: '100%', boxSizing: 'border-box', fontSize: '14px', transition: 'border 0.3s' },
  selectOutline: { padding: '8px 14px', borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#1e293b', color: '#f8fafc', outline: 'none', cursor: 'pointer', fontSize: '13px' },
  toggleBtn: { flex: 1, padding: '10px', borderRadius: '10px', border: '1px solid', cursor: 'pointer', fontWeight: '600', transition: '0.2s', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '5px' },
  
  // Buttons
  btnPrimary: { padding: '14px', borderRadius: '10px', border: 'none', backgroundColor: '#0ea5e9', color: '#fff', fontWeight: '600', fontSize: '15px', cursor: 'pointer', width: '100%', transition: 'background 0.3s', boxShadow: '0 4px 14px 0 rgba(14, 165, 233, 0.39)' },
  btnGradient: { padding: '14px', borderRadius: '10px', border: 'none', background: 'linear-gradient(to right, #0ea5e9, #8b5cf6)', color: '#fff', fontWeight: '600', fontSize: '14px', cursor: 'pointer', width: '100%', transition: 'opacity 0.3s', marginTop: '10px', boxShadow: '0 4px 15px rgba(139, 92, 246, 0.4)' },
  btnExport: { padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#34d399', color: '#064e3b', fontWeight: '600', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 10px rgba(52, 211, 153, 0.2)' },
  btnDanger: { padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#fca5a5', cursor: 'pointer', fontSize: '12px', fontWeight: '600', transition: '0.2s' },
  btnDelete: { background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', opacity: 0.6, transition: '0.2s' },
  
  // Misc
  switchAuth: { marginTop: '25px', fontSize: '13px', color: '#94a3b8', textAlign: 'center' },
  link: { color: '#38bdf8', cursor: 'pointer', fontWeight: '600', textDecoration: 'underline' },
  errorBox: { backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.3)', padding: '12px', borderRadius: '8px', fontSize: '13px', marginBottom: '20px' },
  
  // Dashboard Layout
  dashboard: { minHeight: '100vh', backgroundColor: '#0f172a', color: '#f8fafc', fontFamily: "'Inter', sans-serif" },
  nav: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 40px', backgroundColor: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(10px)', borderBottom: '1px solid #1e293b', position: 'sticky', top: 0, zIndex: 10 },
  content: { padding: '40px', maxWidth: '1300px', margin: '0 auto' },
  
  // Cards & Grid
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '25px' },
  card: { backgroundColor: '#1e293b', padding: '25px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)', position: 'relative', overflow: 'hidden' },
  cardIconBox: { position: 'absolute', top: '25px', right: '25px', width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(52, 211, 153, 0.1)', display: 'flex', justifyContent: 'center', alignItems: 'center' },
  cardTitle: { fontSize: '13px', color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' },
  mainGrid: { display: 'grid', gridTemplateColumns: '1fr 2.2fr', gap: '25px', alignItems: 'start' },
  
  // Table
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  th: { padding: '15px 12px', color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.5px', borderBottom: '1px solid #1e293b' },
  td: { padding: '15px 12px', borderBottom: '1px solid #1e293b' },
  trHover: { transition: 'background-color 0.2s', cursor: 'default' },
  badge: { backgroundColor: '#334155', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', color: '#f8fafc', fontWeight: '500' }
};
