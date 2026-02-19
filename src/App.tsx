/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Plus, 
  Search, 
  AlertTriangle,
  History,
  Menu,
  X,
  ChevronRight,
  Database
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Material, Category, Transaction, DashboardStats } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'inventory' | 'data-masuk'>('dashboard');
  const [materials, setMaterials] = useState<Material[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [mRes, cRes, sRes] = await Promise.all([
        fetch('/api/materials'),
        fetch('/api/categories'),
        fetch('/api/stats')
      ]);
      setMaterials(await mRes.json());
      setCategories(await cRes.json());
      setStats(await sRes.json());
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  const handleTransaction = async (materialId: number, type: 'IN' | 'OUT', quantity: number, notes: string) => {
    try {
      await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ material_id: materialId, type, quantity, notes })
      });
      fetchData();
    } catch (error) {
      console.error("Error processing transaction:", error);
    }
  };

  const filteredMaterials = materials.filter(m => 
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.category_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#F5F5F5] flex font-sans text-slate-900">
      {/* Sidebar */}
      <aside className={`bg-slate-900 text-white transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-20'} flex flex-col`}>
        <div className="p-6 flex items-center gap-3 border-b border-slate-800">
          <div className="bg-emerald-500 p-2 rounded-lg">
            <Database size={20} className="text-white" />
          </div>
          {isSidebarOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h1 className="font-bold text-sm tracking-tight leading-none">POLNES</h1>
              <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest">Teknik Elektro</p>
            </motion.div>
          )}
        </div>

        <nav className="flex-1 py-6 px-3 space-y-2">
          <NavItem 
            icon={<LayoutDashboard size={20} />} 
            label="Dashboard" 
            active={activeTab === 'dashboard'} 
            collapsed={!isSidebarOpen}
            onClick={() => setActiveTab('dashboard')}
          />
          <NavItem 
            icon={<Package size={20} />} 
            label="Inventaris" 
            active={activeTab === 'inventory'} 
            collapsed={!isSidebarOpen}
            onClick={() => setActiveTab('inventory')}
          />
          <NavItem 
            icon={<History size={20} />} 
            label="Data Masuk" 
            active={activeTab === 'data-masuk'} 
            collapsed={!isSidebarOpen}
            onClick={() => setActiveTab('data-masuk')}
          />
        </nav>

        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-4 hover:bg-slate-800 flex justify-center text-slate-400"
        >
          {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-8">
          <h2 className="text-lg font-semibold capitalize">{activeTab.replace('-', ' ')}</h2>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="Cari bahan..."
                className="pl-10 pr-4 py-2 bg-slate-100 border-none rounded-full text-sm w-64 focus:ring-2 focus:ring-emerald-500 transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <StatCard 
                    title="Total Bahan" 
                    value={stats?.totalMaterials || 0} 
                    icon={<Package className="text-blue-500" />} 
                  />
                  <StatCard 
                    title="Stok Menipis" 
                    value={stats?.lowStock || 0} 
                    icon={<AlertTriangle className="text-amber-500" />}
                    alert={Number(stats?.lowStock) > 0}
                  />
                  <StatCard 
                    title="Transaksi Hari Ini" 
                    value={stats?.recentTransactions.length || 0} 
                    icon={<History className="text-emerald-500" />} 
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-6">Transaksi Terakhir</h3>
                    <div className="space-y-4">
                      {stats?.recentTransactions.map((t) => (
                        <div key={t.id} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl transition-colors">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${t.type === 'IN' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                              {t.type === 'IN' ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                            </div>
                            <div>
                              <p className="text-sm font-medium">{t.material_name}</p>
                              <p className="text-[10px] text-slate-400">{new Date(t.date).toLocaleString()}</p>
                            </div>
                          </div>
                          <p className={`text-sm font-bold ${t.type === 'IN' ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {t.type === 'IN' ? '+' : '-'}{t.quantity}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-6">Bahan Stok Rendah</h3>
                    <div className="space-y-4">
                      {materials.filter(m => m.stock <= m.min_stock).slice(0, 5).map((m) => (
                        <div key={m.id} className="flex items-center justify-between p-3 bg-amber-50 rounded-xl border border-amber-100">
                          <div>
                            <p className="text-sm font-medium">{m.name}</p>
                            <p className="text-[10px] text-amber-600">Sisa: {m.stock} {m.unit}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] text-slate-400 uppercase">Min: {m.min_stock}</p>
                            <div className="w-24 h-1.5 bg-amber-200 rounded-full mt-1">
                              <div 
                                className="h-full bg-amber-500 rounded-full" 
                                style={{ width: `${Math.min((m.stock / m.min_stock) * 100, 100)}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'inventory' && (
              <motion.div 
                key="inventory"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden"
              >
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="font-bold">Daftar Bahan Praktik</h3>
                  <button className="bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-slate-800 transition-colors">
                    <Plus size={16} /> Tambah Bahan
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">Nama Bahan</th>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">Kategori</th>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">Stok</th>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">Lokasi</th>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredMaterials.map((m) => (
                        <tr key={m.id} className="hover:bg-slate-50 transition-colors group">
                          <td className="px-6 py-4">
                            <p className="text-sm font-medium">{m.name}</p>
                            <p className="text-[10px] text-slate-400">{m.unit}</p>
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-2 py-1 bg-slate-100 rounded-md text-[10px] font-medium text-slate-600">
                              {m.category_name}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-bold ${m.stock <= m.min_stock ? 'text-amber-600' : 'text-slate-900'}`}>
                                {m.stock}
                              </span>
                              {m.stock <= m.min_stock && <AlertTriangle size={12} className="text-amber-500" />}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-500">{m.location || '-'}</td>
                          <td className="px-6 py-4">
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => handleTransaction(m.id, 'IN', 1, 'Restock manual')}
                                className="p-1.5 hover:bg-emerald-50 text-emerald-600 rounded-lg transition-colors"
                                title="Tambah Stok"
                              >
                                <ArrowDownLeft size={16} />
                              </button>
                              <button 
                                onClick={() => handleTransaction(m.id, 'OUT', 1, 'Pengambilan manual')}
                                className="p-1.5 hover:bg-rose-50 text-rose-600 rounded-lg transition-colors"
                                title="Kurangi Stok"
                              >
                                <ArrowUpRight size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}
            {activeTab === 'data-masuk' && (
              <motion.div 
                key="data-masuk"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden"
              >
                <div className="p-6 border-b border-slate-100">
                  <h3 className="font-bold">Riwayat Data Masuk & Keluar</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">Bahan</th>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">Tipe</th>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">Jumlah</th>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">Tanggal</th>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">Catatan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {stats?.recentTransactions.map((t) => (
                        <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 text-sm font-medium">{t.material_name}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                              t.type === 'IN' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'
                            }`}>
                              {t.type === 'IN' ? 'Masuk' : 'Keluar'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm font-bold">{t.quantity}</td>
                          <td className="px-6 py-4 text-sm text-slate-500">{new Date(t.date).toLocaleString()}</td>
                          <td className="px-6 py-4 text-sm text-slate-400 italic">{t.notes || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

function NavItem({ icon, label, active, collapsed, onClick }: { 
  icon: React.ReactNode, 
  label: string, 
  active?: boolean, 
  collapsed?: boolean,
  onClick: () => void 
}) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all ${
        active 
          ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' 
          : 'text-slate-400 hover:bg-slate-800 hover:text-white'
      }`}
    >
      <div className="shrink-0">{icon}</div>
      {!collapsed && <span className="text-sm font-medium">{label}</span>}
    </button>
  );
}

function StatCard({ title, value, icon, alert }: { title: string, value: string | number, icon: React.ReactNode, alert?: boolean }) {
  return (
    <div className={`bg-white p-6 rounded-2xl shadow-sm border ${alert ? 'border-amber-200 bg-amber-50/30' : 'border-slate-200'}`}>
      <div className="flex justify-between items-start mb-4">
        <div className="p-2 bg-slate-50 rounded-xl">
          {icon}
        </div>
        {alert && (
          <span className="px-2 py-1 bg-amber-100 text-amber-600 text-[10px] font-bold rounded-full uppercase tracking-wider">
            Perhatian
          </span>
        )}
      </div>
      <p className="text-3xl font-bold tracking-tight">{value}</p>
      <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mt-1">{title}</p>
    </div>
  );
}
