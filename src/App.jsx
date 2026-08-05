import React, { useState, useEffect } from 'react';
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot, 
  deleteDoc, 
  doc 
} from 'firebase/firestore';
import { db } from './firebase';

const auth = getAuth();

export default function App() {
  const [user, setUser] = useState(null);
  const [isRegister, setIsRegister] = useState(false);
  
  // State Form Login/Register
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // State Pembukuan Forex
  const [trades, setTrades] = useState([]);
  const [pair, setPair] = useState('EURUSD');
  const [type, setType] = useState('BUY');
  const [lot, setLot] = useState('');
  const [pnl, setPnl] = useState('');
  const [notes, setNotes] = useState('');

  // Cek Status Login User
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // Ambil Data Jurnal Forex dari Database secara Realtime
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'forex_trades'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tradeData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTrades(tradeData);
    });
    return () => unsubscribe();
  }, [user]);

  // Fungsi Login & Register
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

  // Fungsi Tambah Transaksi Forex
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
      date: new Date().toISOString().split('T')[0]
    });

    setLot('');
    setPnl('');
    setNotes('');
  };

  // Fungsi Hapus Data Transaksi
  const handleDelete = async (id) => {
    await deleteDoc(doc(db, 'forex_trades', id));
  };

  // Hitung Total Profit/Loss & Win Rate
  const totalPnl = trades.reduce((acc, item) => acc + item.pnl, 0);
  const totalWin = trades.filter(t => t.pnl > 0).length;
  const totalLoss = trades.filter(t => t.pnl < 0).length;
  const winRate = trades.length ? ((totalWin / trades.length) * 100).toFixed(1) : 0;

  // --- TAMPILAN 1: HALAMAN LOGIN / REGISTER ---
  if (!user) {
    return (
      <div style={styles.authContainer}>
        <div style={styles.authCard}>
          <h2 style={styles.brandTitle}>⚡ STARFX JOURNAL</h2>
          <p style={styles.subTitle}>{isRegister ? 'Buat Akun Baru' : 'Silakan Login'}</p>
          
          {authError && <div style={styles.errorBox}>{authError}</div>}

          <form onSubmit={handleAuth} style={styles.form}>
            <input 
              type="email" 
              placeholder="Email" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              required 
              style={styles.input}
            />
            <input 
              type="password" 
              placeholder="Password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              required 
              style={styles.input}
            />
            <button type="submit" style={styles.btnPrimary}>
              {isRegister ? 'Daftar' : 'Login'}
            </button>
          </form>

          <p style={styles.switchAuth}>
            {isRegister ? 'Sudah punya akun?' : 'Belum punya akun?'} {' '}
            <span onClick={() => setIsRegister(!isRegister)} style={styles.link}>
              {isRegister ? 'Login' : 'Register'}
            </span>
          </p>
        </div>
      </div>
    );
  }

  // --- TAMPILAN 2: DASHBOARD UTAMA (PEMBUKUAN & GRAFIK) ---
  return (
    <div style={styles.dashboard}>
      {/* ATAS: NAVBAR */}
      <header style={styles.nav}>
        <h3>⚡ STARFX <span style={{fontWeight: 300, fontSize: '14px'}}>| Forex Journal Dashboard</span></h3>
        <div style={{display: 'flex', alignItems: 'center', gap: '15px'}}>
          <span style={{fontSize: '14px', color: '#aaa'}}>{user.email}</span>
          <button onClick={() => signOut(auth)} style={styles.btnDanger}>Logout</button>
        </div>
      </header>

      <div style={styles.content}>
        {/* KOTAK STATISTIK (PROFIT/LOSS & WIN RATE) */}
        <div style={styles.statsGrid}>
          <div style={styles.card}>
            <span style={styles.cardTitle}>Total PnL (Profit/Loss)</span>
            <h2 style={{color: totalPnl >= 0 ? '#10B981' : '#EF4444', margin: '5px 0'}}>
              ${totalPnl.toFixed(2)}
            </h2>
          </div>
          <div style={styles.card}>
            <span style={styles.cardTitle}>Win Rate</span>
            <h2 style={{color: '#3B82F6', margin: '5px 0'}}>{winRate}%</h2>
          </div>
          <div style={styles.card}>
            <span style={styles.cardTitle}>Win / Loss Ratio</span>
            <h2 style={{margin: '5px 0', fontSize: '20px'}}>
              <span style={{color: '#10B981'}}>{totalWin}W</span> : <span style={{color: '#EF4444'}}>{totalLoss}L</span>
            </h2>
          </div>
        </div>

        {/* GRAFIK SEDERHANA */}
        <div style={{...styles.card, marginBottom: '20px'}}>
          <h4 style={{marginBottom: '15px'}}>📊 Grafik Pergerakan PnL</h4>
          <div style={styles.chartBarWrapper}>
            {trades.length === 0 && <p style={{color: '#666', fontSize: '13px'}}>Belum ada data transaksi untuk ditampilkan grafiknya.</p>}
            {trades.map((t, idx) => {
              const height = Math.min(Math.abs(t.pnl) * 2, 100);
              return (
                <div key={idx} style={styles.barCol} title={`$${t.pnl}`}>
                  <div 
                    style={{
                      height: `${height || 5}px`,
                      width: '14px',
                      backgroundColor: t.pnl >= 0 ? '#10B981' : '#EF4444',
                      borderRadius: '3px'
                    }} 
                  />
                  <span style={{fontSize: '10px', color: '#888', marginTop: '6px'}}>{t.pair}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* BAGIAN BAWAH: FORM INPUT & TABEL RIWAYAT */}
        <div style={styles.mainGrid}>
          {/* FORM INPUT TRANSAKSI */}
          <div style={styles.card}>
            <h4>Catat Transaksi Forex</h4>
            <form onSubmit={handleAddTrade} style={{display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '15px'}}>
              <label style={styles.label}>Pair Mata Uang:</label>
              <select value={pair} onChange={e => setPair(e.target.value)} style={styles.input}>
                <option>EURUSD</option>
                <option>GBPUSD</option>
                <option>XAUUSD (Gold)</option>
                <option>USDJPY</option>
                <option>BTCUSD</option>
              </select>

              <label style={styles.label}>Jenis Posisi:</label>
              <select value={type} onChange={e => setType(e.target.value)} style={styles.input}>
                <option>BUY</option>
                <option>SELL</option>
              </select>

              <label style={styles.label}>Lot Size:</label>
              <input type="number" step="0.01" placeholder="Contoh: 0.10" value={lot} onChange={e => setLot(e.target.value)} required style={styles.input} />

              <label style={styles.label}>Profit / Loss ($):</label>
              <input type="number" step="0.01" placeholder="Contoh: 50 atau -20" value={pnl} onChange={e => setPnl(e.target.value)} required style={styles.input} />

              <label style={styles.label}>Catatan (Opsional):</label>
              <input type="text" placeholder="Alasan entry..." value={notes} onChange={e => setNotes(e.target.value)} style={styles.input} />

              <button type="submit" style={{...styles.btnPrimary, marginTop: '10px'}}>Simpan Transaksi</button>
            </form>
          </div>

          {/* TABEL RIWAYAT */}
          <div style={styles.card}>
            <h4>Riwayat Pembukuan Harian</h4>
            <div style={{overflowX: 'auto', marginTop: '15px'}}>
              <table style={styles.table}>
                <thead>
                  <tr style={{borderBottom: '1px solid #333', textAlign: 'left'}}>
                    <th style={styles.th}>Tanggal</th>
                    <th style={styles.th}>Pair</th>
                    <th style={styles.th}>Type</th>
                    <th style={styles.th}>Lot</th>
                    <th style={styles.th}>PnL</th>
                    <th style={styles.th}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.map((item) => (
                    <tr key={item.id} style={{borderBottom: '1px solid #222'}}>
                      <td style={styles.td}>{item.date}</td>
                      <td style={styles.td}><b>{item.pair}</b></td>
                      <td style={{...styles.td, color: item.type === 'BUY' ? '#3B82F6' : '#F59E0B'}}>{item.type}</td>
                      <td style={styles.td}>{item.lot}</td>
                      <td style={{...styles.td, color: item.pnl >= 0 ? '#10B981' : '#EF4444', fontWeight: 'bold'}}>
                        {item.pnl >= 0 ? `+$${item.pnl}` : `-$${Math.abs(item.pnl)}`}
                      </td>
                      <td style={styles.td}>
                        <button onClick={() => handleDelete(item.id)} style={{...styles.btnDanger, padding: '2px 6px', fontSize: '11px'}}>Hapus</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- DESAIN TAMPILAN (CSS KODE) ---
const styles = {
  authContainer: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#0f172a', fontFamily: 'sans-serif' },
  authCard: { width: '100%', maxWidth: '380px', padding: '30px', backgroundColor: '#1e293b', borderRadius: '12px', color: '#fff', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', textAlign: 'center' },
  brandTitle: { color: '#38bdf8', letterSpacing: '1px', marginBottom: '5px' },
  subTitle: { color: '#94a3b8', fontSize: '14px', marginBottom: '20px' },
  form: { display: 'flex', flexDirection: 'column', gap: '10px', textAlign: 'left' },
  input: { padding: '10px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#fff', outline: 'none', width: '100%' },
  label: { fontSize: '12px', color: '#94a3b8', marginTop: '5px' },
  btnPrimary: { padding: '12px', borderRadius: '6px', border: 'none', backgroundColor: '#0284c7', color: '#fff', fontWeight: 'bold', cursor: 'pointer', width: '100%' },
  btnDanger: { padding: '6px 12px', borderRadius: '4px', border: 'none', backgroundColor: '#ef4444', color: '#fff', cursor: 'pointer' },
  switchAuth: { marginTop: '20px', fontSize: '13px', color: '#94a3b8', textAlign: 'center' },
  link: { color: '#38bdf8', cursor: 'pointer', fontWeight: 'bold' },
  errorBox: { backgroundColor: '#7f1d1d', color: '#fca5a5', padding: '8px', borderRadius: '4px', fontSize: '12px', marginBottom: '10px' },
  
  dashboard: { minHeight: '100vh', backgroundColor: '#090d16', color: '#f8fafc', fontFamily: 'sans-serif' },
  nav: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 30px', backgroundColor: '#0f172a', borderBottom: '1px solid #1e293b' },
  content: { padding: '30px', maxWidth: '1200px', margin: '0 auto' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px', marginBottom: '20px' },
  card: { backgroundColor: '#0f172a', padding: '20px', borderRadius: '8px', border: '1px solid #1e293b' },
  cardTitle: { fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase' },
  mainGrid: { display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '14px' },
  th: { padding: '8px', color: '#64748b' },
  td: { padding: '10px 8px' },
  chartBarWrapper: { display: 'flex', alignItems: 'flex-end', gap: '12px', height: '120px', overflowX: 'auto', paddingTop: '10px' },
  barCol: { display: 'flex', flexDirection: 'column', alignItems: 'center' }
};