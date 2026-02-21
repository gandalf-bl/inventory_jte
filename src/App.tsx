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
  Database,
  Edit2,
  Trash2,
  MapPin,
  Camera,
  RefreshCw,
  Layers
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Material, Category, Transaction, DashboardStats, Location } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'inventory' | 'data-masuk' | 'locations' | 'categories'>('dashboard');
  const [materials, setMaterials] = useState<Material[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;

    const enableCamera = async () => {
      if (isCameraActive && videoRef.current) {
        setIsCameraLoading(true);
        try {
          stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' } 
          });
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            // Wait for video to be ready
            videoRef.current.onloadedmetadata = () => {
              setIsCameraLoading(false);
            };
            if (videoRef.current.readyState >= 1) {
              setIsCameraLoading(false);
            }
          }
        } catch (err) {
          console.error("Error accessing camera:", err);
          alert("Tidak dapat mengakses kamera. Pastikan izin kamera telah diberikan.");
          setIsCameraActive(false);
          setIsCameraLoading(false);
        }
      }
    };

    enableCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isCameraActive]);

  const [newMaterial, setNewMaterial] = useState({
    name: '',
    category_id: 1,
    unit: '',
    min_stock: 5,
    location: '',
    image: ''
  });
  const [newLocationName, setNewLocationName] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const [alertConfig, setAlertConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
  });

  const showAlert = (title: string, message: string) => {
    setAlertConfig({ isOpen: true, title, message });
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmConfig({ isOpen: true, title, message, onConfirm });
  };
  
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [mRes, cRes, sRes, lRes] = await Promise.all([
        fetch('/api/materials'),
        fetch('/api/categories'),
        fetch('/api/stats'),
        fetch('/api/locations')
      ]);
      setMaterials(await mRes.json());
      setCategories(await cRes.json());
      setStats(await sRes.json());
      setLocations(await lRes.json());
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

  const handleAddMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingMaterial ? `/api/materials/${editingMaterial.id}` : '/api/materials';
      const method = editingMaterial ? 'PUT' : 'POST';
      
      const payload = { ...newMaterial, image: capturedImage || newMaterial.image };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        setIsAddModalOpen(false);
        setEditingMaterial(null);
        setShowSuggestions(false);
        setCapturedImage(null);
        setNewMaterial({ name: '', category_id: 1, unit: '', min_stock: 5, location: '', image: '' });
        fetchData();
      } else {
        const errorData = await response.json();
        alert(`Gagal menyimpan: ${errorData.error || response.statusText}`);
      }
    } catch (error) {
      console.error("Error saving material:", error);
      alert("Terjadi kesalahan koneksi saat menyimpan data.");
    }
  };

  const startCamera = () => {
    setIsCameraActive(true);
  };

  const stopCamera = () => {
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      if (video.readyState < 2) {
        alert("Kamera belum siap, silakan tunggu sebentar.");
        return;
      }
      
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        setCapturedImage(dataUrl);
        stopCamera();
      }
    }
  };

  const handleDeleteMaterial = async (id: number) => {
    console.log("handleDeleteMaterial called with ID:", id);
    if (!window.confirm('Apakah Anda yakin ingin menghapus bahan ini? Semua riwayat transaksi terkait juga akan dihapus.')) return;
    try {
      const response = await fetch(`/api/materials/${id}`, {
        method: 'DELETE'
      });
      console.log("Delete material response status:", response.status);
      if (response.ok) {
        fetchData();
      } else {
        const err = await response.json();
        console.error("Delete material error:", err);
        alert(err.error || 'Gagal menghapus bahan');
      }
    } catch (error) {
      console.error("Error deleting material:", error);
      alert("Terjadi kesalahan koneksi saat menghapus bahan.");
    }
  };

  const openEditModal = (material: Material) => {
    setEditingMaterial(material);
    setShowSuggestions(false);
    setCapturedImage(material.image || null);
    setNewMaterial({
      name: material.name,
      category_id: material.category_id,
      unit: material.unit,
      min_stock: material.min_stock,
      location: material.location,
      image: material.image || ''
    });
    setIsAddModalOpen(true);
  };

  const openAddModal = () => {
    setEditingMaterial(null);
    setShowSuggestions(false);
    setCapturedImage(null);
    setNewMaterial({ name: '', category_id: 1, unit: '', min_stock: 5, location: '', image: '' });
    setIsAddModalOpen(true);
  };

  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingLocation ? `/api/locations/${editingLocation.id}` : '/api/locations';
      const method = editingLocation ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newLocationName })
      });
      if (response.ok) {
        setIsLocationModalOpen(false);
        setEditingLocation(null);
        setNewLocationName('');
        fetchData();
      }
    } catch (error) {
      console.error("Error saving location:", error);
    }
  };

  const handleDeleteLocation = async (id: number) => {
    console.log("handleDeleteLocation called with ID:", id);
    if (!window.confirm('Apakah Anda yakin ingin menghapus lokasi ini?')) return;
    try {
      const response = await fetch(`/api/locations/${id}`, {
        method: 'DELETE'
      });
      console.log("Delete location response status:", response.status);
      if (response.ok) {
        fetchData();
      } else {
        const err = await response.json();
        console.error("Delete location error:", err);
        if (err.details) {
          alert(`${err.error}\n\n${err.details}`);
        } else {
          alert(err.error || 'Gagal menghapus lokasi');
        }
      }
    } catch (error) {
      console.error("Error deleting location:", error);
      alert("Terjadi kesalahan koneksi saat menghapus lokasi.");
    }
  };

  const openLocationEditModal = (loc: Location) => {
    setEditingLocation(loc);
    setNewLocationName(loc.name);
    setIsLocationModalOpen(true);
  };

  const openLocationAddModal = () => {
    setEditingLocation(null);
    setNewLocationName('');
    setIsLocationModalOpen(true);
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingCategory ? `/api/categories/${editingCategory.id}` : '/api/categories';
      const method = editingCategory ? 'PUT' : 'POST';
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCategoryName })
      });
      if (response.ok) {
        setIsCategoryModalOpen(false);
        setEditingCategory(null);
        setNewCategoryName('');
        fetchData();
      } else {
        const err = await response.json();
        alert(err.error || 'Gagal menyimpan kategori');
      }
    } catch (error) {
      console.error("Error saving category:", error);
      alert("Terjadi kesalahan koneksi saat menyimpan kategori.");
    }
  };

  const handleDeleteCategory = async (id: number) => {
    console.log("handleDeleteCategory called with ID:", id);
    if (!window.confirm('Hapus kategori ini?')) return;
    try {
      const response = await fetch(`/api/categories/${id}`, {
        method: 'DELETE'
      });
      console.log("Delete category response status:", response.status);
      if (response.ok) {
        fetchData();
      } else {
        const err = await response.json();
        console.error("Delete category error:", err);
        if (err.details) {
          alert(`${err.error}\n\n${err.details}`);
        } else {
          alert(err.error || 'Gagal menghapus kategori');
        }
      }
    } catch (error) {
      console.error("Error deleting category:", error);
      alert("Terjadi kesalahan koneksi saat menghapus kategori.");
    }
  };

  const openCategoryEditModal = (cat: Category) => {
    setEditingCategory(cat);
    setNewCategoryName(cat.name);
    setIsCategoryModalOpen(true);
  };

  const openCategoryAddModal = () => {
    setEditingCategory(null);
    setNewCategoryName('');
    setIsCategoryModalOpen(true);
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
          <NavItem 
            icon={<MapPin size={20} />} 
            label="Lokasi" 
            active={activeTab === 'locations'} 
            collapsed={!isSidebarOpen}
            onClick={() => setActiveTab('locations')}
          />
          <NavItem 
            icon={<Layers size={20} />} 
            label="Kategori" 
            active={activeTab === 'categories'} 
            collapsed={!isSidebarOpen}
            onClick={() => setActiveTab('categories')}
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
                          <div className="flex items-center gap-3">
                            {m.image ? (
                              <img src={m.image} alt={m.name} className="w-10 h-10 rounded-lg object-cover border border-amber-200" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center text-amber-400">
                                <Package size={20} />
                              </div>
                            )}
                            <div>
                              <p className="text-sm font-medium">{m.name}</p>
                              <p className="text-[10px] text-amber-600">Sisa: {m.stock} {m.unit}</p>
                            </div>
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
                  <button 
                    onClick={openAddModal}
                    className="bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-slate-800 transition-colors"
                  >
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
                            <div className="flex items-center gap-3">
                              {m.image ? (
                                <img src={m.image} alt={m.name} className="w-10 h-10 rounded-lg object-cover border border-slate-200" referrerPolicy="no-referrer" />
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
                                  <Package size={20} />
                                </div>
                              )}
                              <div>
                                <p className="text-sm font-medium">{m.name}</p>
                                <p className="text-[10px] text-slate-400">{m.unit}</p>
                              </div>
                            </div>
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
                              <div className="w-px h-4 bg-slate-200 self-center mx-1" />
                              <button 
                                onClick={() => openEditModal(m)}
                                className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                                title="Edit Bahan"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button 
                                onClick={() => handleDeleteMaterial(m.id)}
                                className="p-1.5 hover:bg-rose-50 text-rose-600 rounded-lg transition-colors"
                                title="Hapus Bahan"
                              >
                                <Trash2 size={16} />
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
            {activeTab === 'locations' && (
              <motion.div 
                key="locations"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden"
              >
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="font-bold">Daftar Lokasi Penyimpanan</h3>
                  <button 
                    onClick={openLocationAddModal}
                    className="bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-slate-800 transition-colors"
                  >
                    <Plus size={16} /> Tambah Lokasi
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">Nama Lokasi</th>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {locations.map((loc) => (
                        <tr key={loc.id} className="hover:bg-slate-50 transition-colors group">
                          <td className="px-6 py-4 text-sm font-medium">{loc.name}</td>
                          <td className="px-6 py-4">
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => openLocationEditModal(loc)}
                                className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                                title="Edit Lokasi"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button 
                                onClick={() => handleDeleteLocation(loc.id)}
                                className="p-1.5 hover:bg-rose-50 text-rose-600 rounded-lg transition-colors"
                                title="Hapus Lokasi"
                              >
                                <Trash2 size={16} />
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
            {activeTab === 'categories' && (
              <motion.div 
                key="categories"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden"
              >
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="font-bold">Daftar Kategori Bahan</h3>
                  <button 
                    onClick={openCategoryAddModal}
                    className="bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-slate-800 transition-colors"
                  >
                    <Plus size={16} /> Tambah Kategori
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">Nama Kategori</th>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {categories.map((cat) => (
                        <tr key={cat.id} className="hover:bg-slate-50 transition-colors group">
                          <td className="px-6 py-4 text-sm font-medium">{cat.name}</td>
                          <td className="px-6 py-4">
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => openCategoryEditModal(cat)}
                                className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                                title="Edit Kategori"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button 
                                onClick={() => handleDeleteCategory(cat.id)}
                                className="p-1.5 hover:bg-rose-50 text-rose-600 rounded-lg transition-colors"
                                title="Hapus Kategori"
                              >
                                <Trash2 size={16} />
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
          </AnimatePresence>
        </div>
      </main>

      {/* Add Material Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsAddModalOpen(false);
                setShowSuggestions(false);
              }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h3 className="font-bold text-lg">{editingMaterial ? 'Edit Bahan' : 'Tambah Bahan Baru'}</h3>
                <button 
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setShowSuggestions(false);
                    stopCamera();
                  }} 
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleAddMaterial} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                {/* Photo Capture Section */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Foto Barang</label>
                  <div className="relative aspect-video bg-slate-100 rounded-2xl overflow-hidden border-2 border-dashed border-slate-200 flex flex-col items-center justify-center group">
                    {isCameraActive ? (
                      <>
                        <video 
                          ref={videoRef} 
                          autoPlay 
                          muted
                          playsInline 
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                        {isCameraLoading && (
                          <div className="absolute inset-0 bg-slate-100 flex flex-col items-center justify-center gap-3">
                            <RefreshCw size={32} className="text-emerald-500 animate-spin" />
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Menyiapkan Kamera...</p>
                          </div>
                        )}
                        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                          <button 
                            type="button"
                            onClick={capturePhoto}
                            className="bg-emerald-500 text-white p-3 rounded-full shadow-lg hover:bg-emerald-600 transition-all"
                          >
                            <Camera size={24} />
                          </button>
                          <button 
                            type="button"
                            onClick={stopCamera}
                            className="bg-white text-slate-600 p-3 rounded-full shadow-lg hover:bg-slate-100 transition-all"
                          >
                            <X size={24} />
                          </button>
                        </div>
                      </>
                    ) : capturedImage ? (
                      <>
                        <img src={capturedImage} alt="Preview" className="absolute inset-0 w-full h-full object-cover" referrerPolicy="no-referrer" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                          <button 
                            type="button"
                            onClick={startCamera}
                            className="bg-white text-slate-900 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2"
                          >
                            <RefreshCw size={16} /> Ambil Ulang
                          </button>
                          <button 
                            type="button"
                            onClick={() => setCapturedImage(null)}
                            className="bg-rose-500 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2"
                          >
                            <Trash2 size={16} /> Hapus
                          </button>
                        </div>
                      </>
                    ) : (
                      <button 
                        type="button"
                        onClick={startCamera}
                        className="flex flex-col items-center gap-2 text-slate-400 hover:text-emerald-500 transition-colors"
                      >
                        <Camera size={48} />
                        <span className="text-xs font-bold uppercase tracking-wider">Ambil Foto</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="relative">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Nama Bahan</label>
                  <input 
                    required
                    type="text" 
                    autoComplete="off"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    value={newMaterial.name}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewMaterial({...newMaterial, name: val});
                      setShowSuggestions(val.length > 0);
                    }}
                    onFocus={() => {
                      if (newMaterial.name.length > 0) setShowSuggestions(true);
                    }}
                    onBlur={() => {
                      // Small delay to allow clicking a suggestion
                      setTimeout(() => setShowSuggestions(false), 200);
                    }}
                  />
                  
                  <AnimatePresence>
                    {showSuggestions && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute z-10 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto"
                      >
                        {materials
                          .filter(m => m.name.toLowerCase().includes(newMaterial.name.toLowerCase()))
                          .map((m, idx) => (
                            <button
                              key={idx}
                              type="button"
                              className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-none"
                              onClick={() => {
                                setNewMaterial({...newMaterial, name: m.name});
                                setShowSuggestions(false);
                              }}
                            >
                              <span className="font-medium">{m.name}</span>
                              <span className="ml-2 text-[10px] text-slate-400 uppercase tracking-wider">{m.category_name}</span>
                            </button>
                          ))}
                        {materials.filter(m => m.name.toLowerCase().includes(newMaterial.name.toLowerCase())).length === 0 && (
                          <div className="px-4 py-3 text-xs text-slate-400 italic">
                            Bahan baru (belum ada di database)
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Kategori</label>
                    <select 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      value={newMaterial.category_id}
                      onChange={(e) => setNewMaterial({...newMaterial, category_id: parseInt(e.target.value)})}
                    >
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Satuan</label>
                    <input 
                      required
                      type="text" 
                      placeholder="Pcs, Set, Unit..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      value={newMaterial.unit}
                      onChange={(e) => setNewMaterial({...newMaterial, unit: e.target.value})}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Stok Minimal</label>
                    <input 
                      required
                      type="number" 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      value={newMaterial.min_stock}
                      onChange={(e) => setNewMaterial({...newMaterial, min_stock: parseInt(e.target.value)})}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Lokasi</label>
                    <select 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      value={newMaterial.location}
                      onChange={(e) => setNewMaterial({...newMaterial, location: e.target.value})}
                    >
                      <option value="">Pilih Lokasi</option>
                      {locations.map(loc => (
                        <option key={loc.id} value={loc.name}>{loc.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="pt-4">
                  <button 
                    type="submit"
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-2xl shadow-lg shadow-emerald-500/20 transition-all"
                  >
                    {editingMaterial ? 'Update Bahan' : 'Simpan Bahan'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add/Edit Location Modal */}
      <AnimatePresence>
        {isLocationModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsLocationModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h3 className="font-bold text-lg">{editingLocation ? 'Edit Lokasi' : 'Tambah Lokasi Baru'}</h3>
                <button onClick={() => setIsLocationModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleSaveLocation} className="p-6 space-y-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Nama Lokasi</label>
                  <input 
                    required
                    type="text" 
                    placeholder="Contoh: Rak D1, Lemari C..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    value={newLocationName}
                    onChange={(e) => setNewLocationName(e.target.value)}
                  />
                </div>
                <div className="pt-4">
                  <button 
                    type="submit"
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-2xl shadow-lg shadow-emerald-500/20 transition-all"
                  >
                    {editingLocation ? 'Update Lokasi' : 'Simpan Lokasi'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add/Edit Category Modal */}
      <AnimatePresence>
        {isCategoryModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCategoryModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h3 className="font-bold text-lg">{editingCategory ? 'Edit Kategori' : 'Tambah Kategori Baru'}</h3>
                <button onClick={() => setIsCategoryModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleAddCategory} className="p-6 space-y-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Nama Kategori</label>
                  <input 
                    required
                    type="text" 
                    placeholder="Contoh: Komponen, Alat, Kabel..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                  />
                </div>
                <div className="pt-4">
                  <button 
                    type="submit"
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-2xl shadow-lg shadow-emerald-500/20 transition-all"
                  >
                    {editingCategory ? 'Update Kategori' : 'Simpan Kategori'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
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
