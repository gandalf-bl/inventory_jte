export interface Category {
  id: number;
  name: string;
}

export interface Location {
  id: number;
  name: string;
}

export interface Material {
  id: number;
  name: string;
  category_id: number;
  category_name?: string;
  unit: string;
  stock: number;
  min_stock: number;
  location: string;
  image?: string;
}

export interface Transaction {
  id: number;
  material_id: number;
  material_name?: string;
  type: 'IN' | 'OUT';
  quantity: number;
  date: string;
  notes: string;
}

export interface DashboardStats {
  totalMaterials: number;
  lowStock: number;
  recentTransactions: Transaction[];
}
