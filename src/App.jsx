import React, { useState, useEffect, useMemo } from 'react';
import { 
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, collection, addDoc, query, where, onSnapshot, deleteDoc, doc, setDoc, getDoc 
} from 'firebase/firestore';
import { db } from './firebase'; 
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Area, AreaChart 
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

  // Tab Navigasi Bawah
  const [activeTab, setActiveTab] = useState('dashboard');

  // State Transaksi
  const [trades, setTrades] = useState([]);
  const [pair, setPair] = useState('XAUUSD');
  const [type, setType] = useState('BUY');
  const [lot, setLot] = useState('');
  const [pnl, setPnl] = useState('');
  const [strategy, setStrategy] = useState('Scalping'); // Fitur Baru
  const [notes, setNotes] = useState('');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('Semua'); 
  const [filterValue, setFilterValue] = useState(''); 

  const [chartPeriod, setChartPeriod] = useState('Semua'); 

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
    if (!lot || !pnl) return;
    const dateObj = new Date();
    await addDoc(collection(db, 'forex_trades'), {
      userId: user.uid,
      pair, type, lot: parseFloat(lot), pnl: parseFloat(pnl), notes, strategy,
      date: dateObj.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }),
      timestamp: dateObj.getTime()
    });
    setLot(''); setPnl(''); setNotes('');
    alert('Transaksi berhasil disimpan!');
  };

  const handleDelete = async (id) => {
    if(window.confirm("Yakin ingin menghapus jurnal ini?")) await deleteDoc(doc(db, 'forex_trades', id));
  };

  const filteredTrades = trades.filter(t => {
    return t.pair.toLowerCase().includes(searchTerm.toLowerCase()) || 
           (t.notes && t.notes.toLowerCase().includes(searchTerm.toLowerCase()));
  });

  const chartTrades = useMemo(() => filteredTrades, [filteredTrades]);
  const totalPnl = filteredTrades.reduce((acc, item) => acc + item.pnl, 0);
  const totalWin = filteredTrades.filter(t => t.pnl > 0).length;
  const totalLoss = filteredTrades.filter(t => t.pnl < 0).length;
  const winRate = filteredTrades.length ? ((totalWin / filteredTrades.length) * 100).toFixed(1) : 0;
  const rrRatio = totalLoss > 0 ? (totalWin / totalLoss).toFixed(2) : totalWin;

  const chartData = useMemo(() => {
    let runningBalance = 0;
    return chartTrades.map((t, index) => {
      runningBalance += parseFloat(t.pnl);
      return { tradeCount: `T${index + 1}`, balance: Math.round(runningBalance * 100) / 100 };
    });
  }, [chartTrades]);

  if (!user) {
    return (
      <div style={styles.authContainer}>
        <div style={styles.authCard}>
          <h2 style={styles.brandTitle}>⚡ STARFX</h2>
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
          <span style={{fontSize: '24px'}}>⚡</span>
          <div>
            <h3 style={{margin: 0, fontSize: '18px', color: '#fff'}}>STARFX</h3>
            <span style={{fontSize: '12px', color: '#9ca3af'}}>{user.email.split('@')[0]}</span>
          </div>
        </div>
        <div style={{display: 'flex', gap: '10px', alignItems: 'center'}}>
           <div style={styles.balanceBadge}>{formatMoney(totalPnl)}</div>
           <div style={styles.profileBtn}>👤</div>
        </div>
      </header>

      {/* KONTEN UTAMA */}
      <div style={styles.mainContent}>
        
        {/* TAMPILAN DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div>
            {/* Quick Actions */}
            <div style={styles.quickActions}>
               <button style={styles.actionBtn} onClick={() => setActiveTab('tambah')}>➕ Tambah</button>
               <button style={styles.actionBtn}>📄 Export</button>
               <button style={styles.actionBtn}>🔍 Filter</button>
            </div>

            {/* 4 Cards Grid */}
            <div style={styles.statsGrid}>
              <div style={styles.card}>
                <span style={styles.cardLabel}>💰 Total Profit/Loss</span>
                <h3 style={{color: totalPnl >= 0 ? '#10B981' : '#EF4444', margin: '5px 0'}}>{totalPnl >= 0 ? '+' : '-'}{formatMoney(totalPnl)}</h3>
              </div>
              <div style={styles.card}>
                <span style={styles.cardLabel}>📈 Win Rate</span>
                <h3 style={{color: '#3B82F6', margin: '5px 0'}}>{winRate}%</h3>
              </div>
              <div style={styles.card}>
                <span style={styles.cardLabel}>⚖️ Risk Reward</span>
                <h3 style={{color: '#F59E0B', margin: '5px 0'}}>1 : {rrRatio}</h3>
              </div>
              <div style={styles.card}>
                <span style={styles.cardLabel}>📊 Total Trade</span>
                <h3 style={{color: '#fff', margin: '5px 0'}}>{filteredTrades.length}</h3>
              </div>
            </div>

            {/* Equity Curve */}
            <div style={{...styles.card, height: '300px', marginTop: '15px'}}>
               <span style={styles.cardLabel}>📉 Equity Curve</span>
               {chartTrades.length === 0 ? <p style={{textAlign: 'center', color: '#6b7280'}}>Belum ada data</p> : (
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
                     <YAxis stroke="#9ca3af" fontSize={11} width={40} tickFormatter={(val) => currency==='IDR'?(val/1000)+'k':val} />
                     <Tooltip contentStyle={{backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff'}}/>
                     <ReferenceLine y={0} stroke="#4B5563" />
                     <Area type="monotone" dataKey="balance" stroke="#3B82F6" strokeWidth={3} fill="url(#colorBal)" />
                   </AreaChart>
                 </ResponsiveContainer>
               )}
            </div>
          </div>
        )}

        {/* TAMPILAN TAMBAH TRANSAKSI (Dipindah dari Dashboard agar lega) */}
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
                  <button type="button" onClick={() => setType('BUY')} style={{...styles.typeBtn, background: type === 'BUY' ? '#3B82F6' : '#1f2937'}}>BUY</button>
                  <button type="button" onClick={() => setType('SELL')} style={{...styles.typeBtn, background: type === 'SELL' ? '#EF4444' : '#1f2937'}}>SELL</button>
               </div>
               <div style={{display: 'flex', gap: '10px'}}>
                  <input type="number" step="0.01" placeholder="Lot (cth: 0.10)" value={lot} onChange={e => setLot(e.target.value)} style={{...styles.input, flex: 1}} required />
                  <input type="number" step="0.01" placeholder={`PnL (${currency})`} value={pnl} onChange={e => setPnl(e.target.value)} style={{...styles.input, flex: 1}} required />
               </div>
               <textarea rows="2" placeholder="Catatan trading..." value={notes} onChange={e => setNotes(e.target.value)} style={styles.input} />
               <button type="submit" style={styles.btnPrimary}>Simpan</button>
             </form>
          </div>
        )}

        {/* TAMPILAN TRANSAKSI (Berupa List Cards) */}
        {activeTab === 'transaksi' && (
          <div>
            <input type="text" placeholder="🔍 Cari pair atau catatan..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{...styles.input, marginBottom: '15px'}} />
            <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
               {[...filteredTrades].reverse().map(item => (
                 <div key={item.id} style={styles.tradeCard}>
                    <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '8px'}}>
                       <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                         <h4 style={{margin: 0, color: '#fff'}}>{item.pair}</h4>
                         <span style={{fontSize: '11px', padding: '2px 6px', borderRadius: '4px', background: item.type === 'BUY' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(239, 68, 68, 0.2)', color: item.type === 'BUY' ? '#3B82F6' : '#EF4444'}}>
                           {item.type}
                         </span>
                       </div>
                       <h4 style={{margin: 0, color: item.pnl >= 0 ? '#10B981' : '#EF4444'}}>{item.pnl >= 0 ? '+' : '-'}{formatMoney(item.pnl)}</h4>
                    </div>
                    <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#9ca3af', marginBottom: '8px'}}>
                       <span>Lot: {item.lot}</span>
                       <span>{item.date}</span>
                    </div>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                       <span style={{fontSize: '11px', background: '#374151', padding: '2px 6px', borderRadius: '4px'}}>{item.strategy || 'Tanpa Tag'}</span>
                       <button onClick={() => handleDelete(item.id)} style={{background: 'none', border: 'none', color: '#6b7280', fontSize: '14px', cursor: 'pointer'}}>🗑️</button>
                    </div>
                 </div>
               ))}
            </div>
          </div>
        )}

        {/* TAMPILAN STATISTIK (SEGERA HADIR) */}
        {activeTab === 'statistik' && (
           <div style={{textAlign: 'center', color: '#9ca3af', marginTop: '50px'}}>
              <span style={{fontSize: '40px'}}>📊</span>
              <h3>Statistik Lanjutan</h3>
              <p>Fitur Profit Factor, Max Drawdown, dan Target Bulanan sedang dalam tahap pengembangan.</p>
           </div>
        )}

        {/* TAMPILAN PORTOFOLIO (SEGERA HADIR) */}
        {activeTab === 'portofolio' && (
           <div style={{textAlign: 'center', color: '#9ca3af', marginTop: '50px'}}>
              <span style={{fontSize: '40px'}}>💼</span>
              <h3>Multi Akun Broker</h3>
              <p>Fitur untuk melacak Headway, IC Markets, dan Exness akan segera hadir.</p>
           </div>
        )}

        {/* TAMPILAN SETTING */}
        {activeTab === 'setting' && (
           <div style={styles.card}>
              <h3 style={{marginTop: 0, marginBottom: '20px'}}>⚙️ Pengaturan</h3>
              <div style={styles.settingItem}>
                 <span>Mata Uang</span>
                 <span style={{color: '#3B82F6'}}>{currency}</span>
              </div>
              <div style={styles.settingItem}>
                 <span>Backup Cloud Firebase</span>
                 <span style={{color: '#10B981'}}>Aktif ✅</span>
              </div>
              <button onClick={() => signOut(auth)} style={{...styles.btnPrimary, background: '#EF4444', marginTop: '20px'}}>Logout Akun</button>
           </div>
        )}

      </div>

      {/* BOTTOM NAVIGATION */}
      <nav style={styles.bottomNav}>
         {[
           { id: 'dashboard', icon: '🏠', label: 'Home' },
           { id: 'transaksi', icon: '📒', label: 'Histori' },
           { id: 'statistik', icon: '📊', label: 'Stats' },
           { id: 'portofolio', icon: '💼', label: 'Akun' },
           { id: 'setting', icon: '⚙️', label: 'Setting' },
         ].map(tab => (
           <div 
             key={tab.id} 
             onClick={() => setActiveTab(tab.id)} 
             style={{...styles.navItem, color: activeTab === tab.id ? '#3B82F6' : '#6b7280'}}
           >
             <span style={{fontSize: '20px', marginBottom: '2px', filter: activeTab === tab.id ? 'none' : 'grayscale(100%)'}}>{tab.icon}</span>
             <span style={{fontSize: '10px'}}>{tab.label}</span>
           </div>
         ))}
      </nav>
    </div>
  );
}

const styles = {
  authContainer: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#111827' },
  authCard: { background: '#1f2937', padding: '30px', borderRadius: '12px', width: '90%', maxWidth: '350px', textAlign: 'center' },
  brandTitle: { color: '#3B82F6', margin: '0 0 5px 0', fontSize: '28px' },
  subTitle: { color: '#9ca3af', fontSize: '14px', marginBottom: '20px' },
  form: { display: 'flex', flexDirection: 'column', gap: '15px' },
  input: { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #374151', background: '#111827', color: '#fff', boxSizing: 'border-box', outline: 'none' },
  btnPrimary: { background: '#3B82F6', color: '#fff', padding: '12px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer', width: '100%' },
  switchAuth: { color: '#6b7280', fontSize: '13px', marginTop: '20px', cursor: 'pointer' },
  
  appContainer: { backgroundColor: '#111827', color: '#f3f4f6', minHeight: '100vh', fontFamily: 'system-ui, sans-serif', paddingBottom: '70px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 20px', background: '#1f2937', position: 'sticky', top: 0, zIndex: 10 },
  balanceBadge: { background: 'rgba(16, 185, 129, 0.2)', color: '#10B981', padding: '5px 10px', borderRadius: '20px', fontSize: '14px', fontWeight: 'bold' },
  profileBtn: { background: '#374151', width: '35px', height: '35px', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer' },
  
  mainContent: { padding: '15px', maxWidth: '600px', margin: '0 auto' },
  quickActions: { display: 'flex', gap: '10px', overflowX: 'auto', marginBottom: '15px' },
  actionBtn: { background: '#1f2937', color: '#f3f4f6', border: '1px solid #374151', padding: '8px 15px', borderRadius: '20px', whiteSpace: 'nowrap', cursor: 'pointer', fontSize: '13px' },
  
  statsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' },
  card: { background: '#1f2937', borderRadius: '12px', padding: '15px', border: '1px solid #374151' },
  cardLabel: { fontSize: '12px', color: '#9ca3af' },
  
  typeBtn: { flex: 1, padding: '12px', borderRadius: '8px', border: 'none', color: '#fff', fontWeight: 'bold' },
  
  tradeCard: { background: '#1f2937', borderRadius: '10px', padding: '15px', border: '1px solid #374151', borderLeft: '4px solid #3B82F6' },
  settingItem: { display: 'flex', justifyContent: 'space-between', padding: '15px 0', borderBottom: '1px solid #374151', fontSize: '14px' },
  
  bottomNav: { position: 'fixed', bottom: 0, left: 0, right: 0, background: '#1f2937', display: 'flex', justifyContent: 'space-around', padding: '10px 0', borderTop: '1px solid #374151', zIndex: 10, paddingBottom: 'env(safe-area-inset-bottom)' },
  navItem: { display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', transition: 'color 0.2s' }
};
