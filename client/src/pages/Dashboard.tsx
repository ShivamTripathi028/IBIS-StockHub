import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Box, 
  Package, 
  ShoppingCart, 
  AlertTriangle, 
  ArrowRight,
  LayoutDashboard,
  Layers,
  LucideIcon,
  CheckCircle,
  Inbox
} from "lucide-react";
import Navigation from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { dashboardApi } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";

interface DashboardStats {
  total_skus: number;
  total_units: number;
  low_stock_count: number;
  pending_shipments: number;
  active_orders: number;
}

interface LowStockItem {
  id: string;
  name: string;
  sku: string;
  quantity: number;
}

interface StatCardProps {
  title: string;
  value: string | number | undefined;
  icon: LucideIcon;
  description: string;
  onClick: () => void;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, lowStockRes] = await Promise.all([
          dashboardApi.getStats(),
          dashboardApi.getLowStock()
        ]);
        setStats(statsRes.data);
        setLowStockItems(lowStockRes.data);
      } catch (error) {
        console.error("Failed to load dashboard data", error);
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const StatCard = ({ title, value, icon: Icon, description, onClick }: StatCardProps) => (
    <Card 
        className={`shadow-sm hover:shadow-md transition-shadow cursor-pointer`}
        onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
            <Skeleton className="h-8 w-16" />
        ) : (
            <div className="text-2xl font-bold">{value ?? 0}</div>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          {description}
        </p>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-muted/10">
      <Navigation />
      
      <div className="container mx-auto px-4 py-5 max-w-6xl">
        <div className="mb-7">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <LayoutDashboard className="h-8 w-8 text-primary/80" />
            Overview
          </h1>
          <p className="text-muted-foreground mt-1">
            Welcome back. Here's what's happening with your inventory today.
          </p>
        </div>

        {/* KPI Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <StatCard 
            title="Total Inventory" 
            value={stats?.total_units.toLocaleString()} 
            icon={Box}
            description={`${stats?.total_skus ?? 0} Unique SKUs`}
            onClick={() => navigate('/inventory')}
          />
          <StatCard 
            title="Active Orders" 
            value={stats?.active_orders} 
            icon={ShoppingCart}
            description="Awaiting stock or shipping"
            onClick={() => navigate('/orders')}
          />
          <StatCard 
            title="Pending Shipments" 
            value={stats?.pending_shipments} 
            icon={Package}
            description="In planning or ordered"
            onClick={() => navigate('/shipments')}
          />
          <StatCard 
            title="Low Stock Alerts" 
            value={stats?.low_stock_count} 
            icon={AlertTriangle}
            description="Items that might run out soon"
            onClick={() => navigate('/inventory')}
          />
        </div>

        {/* Main Content Section */}
        <div className="grid gap-4 md:grid-cols-7">
            
            {/* Low Stock Table */}
            <Card className="md:col-span-4 border-none shadow-md">
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <span>Low Stock Items</span>
                        <Button variant="ghost" size="sm" onClick={() => navigate('/inventory')} className="text-xs">
                            View All <ArrowRight className="ml-1 h-3 w-3" />
                        </Button>
                    </CardTitle>
                    <CardDescription>
                        Products that need urgent restocking.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="space-y-2">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                    ) : error ? (
                        <div className="text-center py-8 text-muted-foreground text-destructive">
                            Failed to load data.
                        </div>
                    ) : stats?.total_skus === 0 ? (
                        /* Case 1: No Products in DB */
                        <div className="text-center py-8 text-muted-foreground">
                            <Inbox className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                            <p>No products in database.</p>
                            <p className="text-xs mt-1">Seed database to get started.</p>
                        </div>
                    ) : stats?.total_units === 0 ? (
                        /* Case 2: DB has products, but 0 stock (NEW) */
                        <div className="text-center py-8 text-muted-foreground">
                            <Inbox className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                            <p>Inventory is empty.</p>
                            <p className="text-xs mt-1">Receive shipments to start tracking stock.</p>
                        </div>
                    ) : lowStockItems.length === 0 ? (
                        /* Case 3: Stock exists, and none is low */
                        <div className="text-center py-8 text-muted-foreground">
                            <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500/50" />
                            <p>Stock levels look healthy!</p>
                        </div>
                    ) : (
                        /* Case 4: Low stock items exist */
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Product</TableHead>
                                    <TableHead className="text-right">Qty</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {lowStockItems.map((item) => (
                                    <TableRow key={item.id}>
                                        <TableCell>
                                            <div className="font-medium text-sm truncate max-w-[250px]" title={item.name}>
                                                {item.name}
                                            </div>
                                            <div className="text-xs text-muted-foreground font-mono">
                                                {item.sku}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right font-bold text-destructive">
                                            {item.quantity}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="md:col-span-3 border-none shadow-md h-fit">
                <CardHeader>
                    <CardTitle>Quick Actions</CardTitle>
                    <CardDescription>Common tasks to manage flow.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                    <Button 
                        variant="outline" 
                        className="h-auto py-4 justify-start px-4 hover:bg-accent hover:text-accent-foreground group"
                        onClick={() => navigate('/shipments')}
                    >
                        <Package className="mr-4 h-5 w-5 text-muted-foreground group-hover:text-foreground" />
                        <div className="text-left">
                            <div className="font-semibold">Create Shipment</div>
                            <div className="text-xs text-muted-foreground">Plan new stock arrival</div>
                        </div>
                    </Button>

                    <Button 
                        variant="outline" 
                        className="h-auto py-4 justify-start px-4 hover:bg-accent hover:text-accent-foreground group"
                        onClick={() => navigate('/orders')}
                    >
                        <ShoppingCart className="mr-4 h-5 w-5 text-muted-foreground group-hover:text-foreground" />
                        <div className="text-left">
                            <div className="font-semibold">Create Sales Order</div>
                            <div className="text-xs text-muted-foreground">Record local or Amazon sale</div>
                        </div>
                    </Button>

                    <Button 
                        variant="outline" 
                        className="h-auto py-4 justify-start px-4 hover:bg-accent hover:text-accent-foreground group"
                        onClick={() => navigate('/inventory')}
                    >
                        <Layers className="mr-4 h-5 w-5 text-muted-foreground group-hover:text-foreground" />
                        <div className="text-left">
                            <div className="font-semibold">Check Inventory</div>
                            <div className="text-xs text-muted-foreground">Search and audit stock</div>
                        </div>
                    </Button>
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;