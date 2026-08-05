import React, { useState, useEffect, useMemo } from 'react';
import { 
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, collection, addDoc, query, where, onSnapshot, deleteDoc, doc 
} from 'firebase/firestore';
import { db } from './firebase';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine 
} from 'recharts';

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
  const [searchTerm, setSearchTerm] = useState('');

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

    await addDoc(collection(db, 'forex_trades'), {
      userId: user.uid,
      pair,
      type,
      lot: parseFloat(lot),
      pnl: parseFloat(pnl),
      notes,
      date: new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }),
      timestamp: new Date().getTime()
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

  const totalPnl = trades.reduce((acc, item) => acc + item.pnl, 0);
  const totalWin = trades.filter(t => t.pnl > 0).length;
  const totalLoss = trades.filter(t => t.pnl < 0).length;
  const winRate = trades.length ? ((totalWin / trades.length) * 100).toFixed(1) : 0;

  const chartData = useMemo(() => {
    let runningBalance = 0;
    return trades.map((t, index) => {
      runningBalance += t.pnl;
      return {
        tradeCount: `Trade ${index + 1}`,
        balance: runningBalance,
        pair: t.pair,
        pnl: t.pnl
      };
    });
  }, [trades]);

  const filteredTrades = trades.filter(t => 
    t.pair.toLowerCase().includes(searchTerm.toLowerCase()) || 
    t.notes.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!user) {
    return (
      <div style={styles.authContainer}>
        <div style={styles.authCard}>
          <h2 style={styles.brandTitle}>⚡ STARFX JOURNAL</h2>
          <p style={styles.subTitle}>{isRegister ? 'Buat Akun Baru' : 'Masuk ke Dashboard'}</p>
          
          {authError && <div style={styles.errorBox}>{authError}</div>}

          <form onSubmit={handleAuth} style={styles.form}>
            <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required style={styles.input} />
            <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required style={styles.input} />
            <button type="submit" style={styles.btnPrimary}>{isRegister ? 'Daftar' : 'Login'}</button>
          </form>

          <p style={styles.switchAuth}>
            {isRegister ? 'Sudah punya akun?' : 'Belum punya akun?'} {' '}
            <span onClick={() => setIsRegister(!isRegister)} style={styles.link}>{isRegister ? 'Login' : 'Register'}</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.dashboard}>
      <header style={styles.nav}>
        <h3 style={{margin: 0, color: '#38bdf8', letterSpacing: '1px'}}>⚡ STARFX <span style={{fontWeight: 300, fontSize: '14px', color: '#94a3b8'}}>| Professional Journal</span></h3>
        <div style={{display: 'flex', alignItems: 'center', gap: '15px'}}>
          <span style={{fontSize: '13px', color: '#94a3b8'}}>{user.email}</span>
          <button onClick={() => signOut(auth)} style={styles.btnDanger}>Logout</button>
        </div>
      </header>

      <div style={styles.content}>
        <div style={styles.statsGrid}>
          <div style={styles.card}>
            <span style={styles.cardTitle}>Net Profit / Loss</span>
            <h2 style={{color: totalPnl >= 0 ? '#10B981' : '#EF4444', margin: '5px 0', fontSize: '28px'}}>
              {totalPnl >= 0 ? '+' : '-'}${Math.abs(totalPnl).toFixed(2)}
            </h2>
          </div>
          <div style={styles.card}>
            <span style={styles.cardTitle}>Win Rate Akurasi</span>
            <h2 style={{color: '#38bdf8', margin: '5px 0', fontSize: '28px'}}>{winRate}%</h2>
          </div>
          <div style={styles.card}>
            <span style={styles.cardTitle}>Rasio Win / Loss</span>
            <h2 style={{margin: '5px 0', fontSize: '24px'}}>
              <span style={{color: '#10B981'}}>{totalWin}W</span> <span style={{color: '#64748b', fontSize: '18px'}}>vs</span> <span style={{color: '#EF4444'}}>{totalLoss}L</span>
            </h2>
          </div>
        </div>

        <div style={{...styles.card, marginBottom: '20px', height: '350px'}}>
          <h4 style={{marginBottom: '20px', color: '#f8fafc', fontWeight: '500'}}>📈 Grafik Pertumbuhan Akun (PnL Kumulatif)</h4>
          {trades.length === 0 ? (
             <p style={{color: '#64748b', fontSize: '14px', textAlign: 'center', marginTop: '80px'}}>Belum ada data untuk ditampilkan grafiknya.</p>
          ) : (
            <ResponsiveContainer width="100%" height="85%">
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="tradeCount" stroke="#64748b" fontSize={12} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                <Tooltip contentStyle={{backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff'}} itemStyle={{color: '#38bdf8'}} />
                <ReferenceLine y={0} stroke="#334155" />
                <Line type="monotone" dataKey="balance" name="Total Saldo PnL" stroke="#38bdf8" strokeWidth={3} dot={{ r: 4, fill: '#0f172a', stroke: '#38bdf8', strokeWidth: 2 }} activeDot={{ r: 6, fill: '#38bdf8' }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div style={styles.mainGrid}>
          <div style={styles.card}>
            <h4 style={{marginBottom: '15px', color: '#f8fafc', fontWeight: '500'}}>✍️ Catat Transaksi Baru</h4>
            <form onSubmit={handleAddTrade} style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
              <label style={styles.label}>Pair / Asset:</label>
              <select value={pair} onChange={e => setPair(e.target.value)} style={styles.input}>
                <optgroup label="Majors">
                  <option>EURUSD</option><option>GBPUSD</option><option>USDJPY</option>
                  <option>USDCAD</option><option>USDCHF</option><option>AUDUSD</option><option>NZDUSD</option>
                </optgroup>
                <optgroup label="Minors & Crosses">
                  <option>EURGBP</option><option>EURJPY</option><option>GBPJPY</option><option>AUDJPY</option>
                </optgroup>
                <optgroup label="Commodities">
                  <option>XAUUSD (Gold)</option><option>XAGUSD (Silver)</option><option>WTI (Oil)</option>
                </optgroup>
                <optgroup label="Crypto & Indices">
                  <option>BTCUSD</option><option>ETHUSD</option><option>US30</option><option>NAS100</option>
                </optgroup>
              </select>

              <label style={styles.label}>Jenis Posisi:</label>
              <select value={type} onChange={e => setType(e.target.value)} style={styles.input}>
                <option>BUY</option>
                <option>SELL</option>
              </select>

              <div style={{display: 'flex', gap: '10px'}}>
                <div style={{flex: 1}}>
                  <label style={styles.label}>Lot Size:</label>
                  <input type="number" step="0.01" placeholder="Misal: 0.10" value={lot} onChange={e => setLot(e.target.value)} required style={styles.input} />
                </div>
                <div style={{flex: 1}}>
                  <label style={styles.label}>Profit / Loss ($):</label>
                  <input type="number" step="0.01" placeholder="Misal: 50 atau -20" value={pnl} onChange={e => setPnl(e.target.value)} required style={styles.input} />
                </div>
              </div>

              <label style={styles.label}>Catatan (Setup / Alasan):</label>
              <input type="text" placeholder="Tulis strategi atau kesalahan disini..." value={notes} onChange={e => setNotes(e.target.value)} style={styles.input} />

              <button type="submit" style={{...styles.btnPrimary, marginTop: '10px'}}>+ Simpan Transaksi</button>
            </form>
          </div>

          <div style={{...styles.card, display: 'flex', flexDirection: 'column'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px'}}>
              <h4 style={{color: '#f8fafc', fontWeight: '500', margin: 0}}>📋 Riwayat Perdagangan</h4>
              <input type="text" placeholder="🔍 Cari Pair / Catatan..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{...styles.input, width: '200px', padding: '6px 12px', fontSize: '13px'}} />
            </div>

            <div style={{overflowX: 'auto'}}>
              <table style={styles.table}>
                <thead>
                  <tr style={{borderBottom: '1px solid #1e293b', textAlign: 'left', backgroundColor: '#0f172a'}}>
                    <th style={styles.th}>Tanggal</th>
                    <th style={styles.th}>Asset</th>
                    <th style={styles.th}>Aksi</th>
                    <th style={styles.th}>Lot</th>
                    <th style={styles.th}>Catatan</th>
                    <th style={styles.th}>Hasil (PnL)</th>
                    <th style={styles.th}></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTrades.length === 0 ? (
                    <tr><td colSpan="7" style={{padding: '20px', textAlign: 'center', color: '#64748b'}}>Data tidak ditemukan...</td></tr>
                  ) : (
                    [...filteredTrades].reverse().map((item) => (
                      <tr key={item.id} style={styles.trHover}>
                        <td style={styles.td}>{item.date}</td>
                        <td style={styles.td}><span style={styles.badge}>{item.pair}</span></td>
                        <td style={{...styles.td, color: item.type === 'BUY' ? '#38bdf8' : '#f59e0b', fontWeight: 'bold'}}>{item.type}</td>
                        <td style={styles.td}>{item.lot}</td>
                        <td style={{...styles.td, color: '#94a3b8', fontSize: '12px', maxWidth: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}} title={item.notes}>
                          {item.notes || '-'}
                        </td>
                        <td style={{...styles.td, color: item.pnl >= 0 ? '#10B981' : '#EF4444', fontWeight: 'bold'}}>
                          {item.pnl >= 0 ? `+$${item.pnl}` : `-$${Math.abs(item.pnl)}`}
                        </td>
                        <td style={styles.td}>
                          <button onClick={() => handleDelete(item.id)} style={styles.btnDelete}>🗑️</button>
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
  authContainer: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#020617', fontFamily: "'Inter', sans-serif" },
  authCard: { width: '100%', maxWidth: '380px', padding: '35px', backgroundColor: '#0f172a', borderRadius: '16px', border: '1px solid #1e293b', color: '#f8fafc', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', textAlign: 'center' },
  brandTitle: { color: '#38bdf8', letterSpacing: '1px', marginBottom: '5px', fontWeight: 'bold' },
  subTitle: { color: '#64748b', fontSize: '14px', marginBottom: '25px' },
  form: { display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left' },
  input: { padding: '12px', borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#020617', color: '#f8fafc', outline: 'none', width: '100%', boxSizing: 'border-box' },
  label: { fontSize: '12px', color: '#94a3b8', marginTop: '2px', fontWeight: '500' },
  btnPrimary: { padding: '12px', borderRadius: '8px', border: 'none', backgroundColor: '#0ea5e9', color: '#fff', fontWeight: 'bold', cursor: 'pointer', width: '100%', transition: '0.3s' },
  btnDanger: { padding: '6px 14px', borderRadius: '6px', border: '1px solid #ef4444', backgroundColor: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: '12px', fontWeight: '500' },
  btnDelete: { background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', opacity: 0.7 },
  switchAuth: { marginTop: '20px', fontSize: '13px', color: '#64748b', textAlign: 'center' },
  link: { color: '#38bdf8', cursor: 'pointer', fontWeight: '600' },
  errorBox: { backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid #ef4444', padding: '10px', borderRadius: '6px', fontSize: '12px', marginBottom: '15px' },
  
  dashboard: { minHeight: '100vh', backgroundColor: '#020617', color: '#f8fafc', fontFamily: "'Inter', sans-serif" },
  nav: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 40px', backgroundColor: '#0f172a', borderBottom: '1px solid #1e293b' },
  content: { padding: '30px 40px', maxWidth: '1400px', margin: '0 auto' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '20px' },
  card: { backgroundColor: '#0f172a', padding: '25px', borderRadius: '12px', border: '1px solid #1e293b', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' },
  cardTitle: { fontSize: '13px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' },
  mainGrid: { display: 'grid', gridTemplateColumns: '1fr 2.5fr', gap: '20px' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  th: { padding: '12px 10px', color: '#64748b', fontWeight: '500', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.5px' },
  td: { padding: '12px 10px', borderBottom: '1px solid #1e293b' },
  trHover: { transition: 'background-color 0.2s' },
  badge: { backgroundColor: '#1e293b', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', color: '#f8fafc', border: '1px solid #334155' }
};