import { useState, useEffect, useCallback, Fragment } from "react";
import { 
  Plus, 
  Loader2, 
  CheckCircle, 
  XCircle, 
  Pause, 
  Play,
  ShoppingCart, 
  Search, 
  Package, 
  User, 
  Layers, 
  Trash2, 
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Box,
  PackageCheck
} from "lucide-react";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ordersApi, productsApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { AxiosError } from "axios";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog";

// -- Interfaces --

interface ProductInfo {
  id: string;
  name: string;
  sku: string;
  quantityInStock: number;
}

interface OrderLineItem {
  id: string;
  quantity: number;
  product: {
    name: string;
    sku: string;
  };
}

interface Order {
  id: string;
  customerName: string; 
  source: string;
  status: string;
  lineItems: OrderLineItem[]; 
  createdAt: string;
}

interface OrderRow {
  id: number;
  product: ProductInfo | null;
  searchQuery: string;
  quantity: string;
}

const Orders = () => {
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  
  // -- Expanded Rows State --
  const [expandedOrderIds, setExpandedOrderIds] = useState<Set<string>>(new Set());

  // -- Create Modal State --
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [orderSource, setOrderSource] = useState<string>("Local");
  const [rows, setRows] = useState<OrderRow[]>([
    { id: 1, product: null, searchQuery: "", quantity: "" }
  ]);
  const [submitting, setSubmitting] = useState(false);

  // -- Autocomplete State --
  const [activeRowId, setActiveRowId] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<ProductInfo[]>([]);

  // -- Cancel Confirmation State --
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const status = activeTab === "all" ? undefined : activeTab;
      const response = await ordersApi.getAll(status);
      setOrders(response.data);
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to fetch orders",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [activeTab, toast]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // -- Toggle Row Logic --
  const toggleOrder = (orderId: string) => {
    const newExpanded = new Set(expandedOrderIds);
    if (newExpanded.has(orderId)) {
      newExpanded.delete(orderId);
    } else {
      newExpanded.add(orderId);
    }
    setExpandedOrderIds(newExpanded);
  };

  // -- Product Search Logic --
  const searchProducts = useCallback(async (query: string) => {
    if (!query) {
      setSuggestions([]);
      return;
    }
    try {
      const response = await productsApi.search(query);
      setSuggestions(response.data);
    } catch (error) {
      console.error("Failed to search products", error);
    }
  }, []);

  useEffect(() => {
    if (activeRowId === null) return;
    const activeRow = rows.find(r => r.id === activeRowId);
    if (!activeRow || activeRow.product) return;

    const delaySearch = setTimeout(() => {
      searchProducts(activeRow.searchQuery);
    }, 300);

    return () => clearTimeout(delaySearch);
  }, [rows, activeRowId, searchProducts]);

  // -- Row Handlers --
  const handleRowChange = (rowId: number, field: keyof OrderRow, value: string) => {
    setRows(prev => prev.map(row => {
      if (row.id !== rowId) return row;
      if (field === "searchQuery") {
        return { ...row, searchQuery: value, product: null };
      }
      return { ...row, [field]: value };
    }));
    if (field === "searchQuery") setActiveRowId(rowId);
  };

  const handleProductSelect = (rowId: number, product: ProductInfo) => {
    const isDuplicate = rows.some(row => row.id !== rowId && row.product?.id === product.id);
    if (isDuplicate) {
      toast({ title: "Duplicate Product", description: "Product already in list.", variant: "destructive" });
      return;
    }
    setRows(prev => prev.map(row => row.id === rowId ? { ...row, product, searchQuery: product.name } : row));
    setSuggestions([]);
    setActiveRowId(null);
  };

  const addRow = () => {
    const newId = Math.max(...rows.map(r => r.id), 0) + 1;
    setRows([...rows, { id: newId, product: null, searchQuery: "", quantity: "" }]);
  };

  const removeRow = (rowId: number) => {
    if (rows.length === 1) {
       setRows([{ id: 1, product: null, searchQuery: "", quantity: "" }]);
       return;
    }
    setRows(rows.filter(r => r.id !== rowId));
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
        toast({ title: "Missing Information", description: "Customer Name is required.", variant: "destructive" });
        return;
    }
    const validRows = rows.filter(r => r.product && r.quantity && parseInt(r.quantity) > 0);
    if (validRows.length === 0) {
      toast({ title: "Validation Error", description: "Add at least one valid product.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        customer_name: customerName,
        source: orderSource as 'Local' | 'Amazon',
        line_items: validRows.map(r => ({
          product_id: r.product!.id,
          quantity: parseInt(r.quantity),
        })),
      };

      await ordersApi.create(payload);
      toast({ title: "Success", description: "Order created successfully" });
      setIsCreateOpen(false);
      setCustomerName("");
      setOrderSource("Local");
      setRows([{ id: 1, product: null, searchQuery: "", quantity: "" }]);
      fetchOrders();
    } catch (error: unknown) {
        let errorMessage = "Failed to create order";
        if (error instanceof AxiosError && error.response?.data?.detail) {
            errorMessage = error.response.data.detail;
        }
        toast({ title: "Error", description: errorMessage, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  // -- Order Actions --
  const handleCompleteOrder = async (e: React.MouseEvent, orderId: string) => {
    e.stopPropagation();
    try {
      await ordersApi.complete(orderId);
      toast({ title: "Success", description: "Order marked as completed" });
      fetchOrders();
    } catch (error) {
      toast({ title: "Error", description: "Failed to complete order (Check stock levels)", variant: "destructive" });
    }
  };

  const initiateCancelOrder = (e: React.MouseEvent, orderId: string) => {
    e.stopPropagation();
    setOrderToCancel(orderId);
    setIsCancelOpen(true);
  };

  const confirmCancelOrder = async () => {
    if (!orderToCancel) return;
    try {
      await ordersApi.cancel(orderToCancel);
      toast({ title: "Success", description: "Order cancelled successfully." });
      fetchOrders();
    } catch (error) {
      toast({ title: "Error", description: "Failed to cancel order", variant: "destructive" });
    } finally {
      setIsCancelOpen(false);
      setOrderToCancel(null);
    }
  };

  const handlePutOnHold = async (e: React.MouseEvent, orderId: string) => {
    e.stopPropagation();
    try {
      await ordersApi.hold(orderId);
      toast({ title: "On Hold", description: "Order paused and stock released" });
      fetchOrders();
    } catch (error) {
      toast({ title: "Error", description: "Failed to put order on hold", variant: "destructive" });
    }
  };

  const handleResumeOrder = async (e: React.MouseEvent, orderId: string) => {
    e.stopPropagation();
    try {
      await ordersApi.resume(orderId);
      toast({ title: "Resumed", description: "Order active and stock reserved" });
      fetchOrders();
    } catch (error: unknown) {
        let errorMessage = "Failed to resume order";
        if (error instanceof AxiosError && error.response?.data?.detail) {
            errorMessage = error.response.data.detail;
        }
        toast({ title: "Error", description: errorMessage, variant: "destructive" });
    }
  };

  // Allocate Stock Handler
  const handleAllocateOrder = async (e: React.MouseEvent, orderId: string) => {
    e.stopPropagation();
    try {
      await ordersApi.allocate(orderId);
      toast({ title: "Allocated", description: "Stock reserved. Order is ready to ship." });
      fetchOrders();
    } catch (error: unknown) { // [FIXED] Changed 'any' to 'unknown' and added type check
      let msg = "Failed to allocate stock";
      if (error instanceof AxiosError && error.response?.data?.detail) {
        msg = error.response.data.detail;
      }
      toast({ title: "Allocation Failed", description: msg, variant: "destructive" });
    }
  };

  const getStatusBadge = (status: string) => {
    const s = status.toUpperCase();
    if (s === "READY_TO_SHIP") return <Badge className="bg-green-600 hover:bg-green-700">Ready to Ship</Badge>;
    if (s === "AWAITING_STOCK") return <Badge variant="secondary" className="text-orange-700 bg-orange-100 hover:bg-orange-200">Awaiting Stock</Badge>;
    if (s === "COMPLETED") return <Badge variant="outline" className="text-muted-foreground border-muted-foreground/30">Completed</Badge>;
    if (s === "ON_HOLD") return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200">On Hold</Badge>;
    if (s === "CANCELLED") return <Badge variant="destructive">Cancelled</Badge>;
    return <Badge variant="secondary">{status}</Badge>;
  };

  return (
    <div className="min-h-screen bg-muted/10">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Sales Hub</h1>
                <p className="text-muted-foreground mt-1">
                    Manage customer orders and fulfillment
                </p>
            </div>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogTrigger asChild>
                    <Button className="shadow-sm">
                        <Plus className="mr-2 h-4 w-4" /> Create New Order
                    </Button>
                </DialogTrigger>
                
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Create Sales Order</DialogTitle>
                        <DialogDescription>Record a new local or Amazon sale.</DialogDescription>
                    </DialogHeader>
                    
                    <form onSubmit={handleCreateOrder} className="flex flex-col gap-6 py-4 px-1">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Customer Name</Label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input 
                                        value={customerName} 
                                        onChange={(e) => setCustomerName(e.target.value)} 
                                        placeholder="e.g. John Doe"
                                        className="pl-9"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Source</Label>
                                <Select value={orderSource} onValueChange={setOrderSource}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Local">Local</SelectItem>
                                        <SelectItem value="Amazon">Amazon</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="flex flex-col space-y-3">
                            <Label>Order Items</Label>
                            <div className="space-y-3">
                                {rows.map((row) => {
                                    const stock = row.product?.quantityInStock || 0;
                                    const reqQty = parseInt(row.quantity) || 0;
                                    const isLowStock = row.product && reqQty > stock;

                                    return (
                                        <div key={row.id} className="flex gap-3 items-start p-1 relative">
                                            {/* Search */}
                                            <div className="flex-1 relative">
                                                <div className="relative">
                                                    <Package className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                    <Input
                                                        value={row.searchQuery}
                                                        onChange={(e) => handleRowChange(row.id, "searchQuery", e.target.value)}
                                                        onFocus={() => setActiveRowId(row.id)}
                                                        placeholder="Search product..."
                                                        className="pl-10"
                                                        autoComplete="off"
                                                    />
                                                </div>
                                                {/* Dropdown */}
                                                {activeRowId === row.id && suggestions.length > 0 && (
                                                    <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-60 overflow-auto">
                                                        {suggestions.map((p) => (
                                                            <div
                                                                key={p.id}
                                                                className="px-4 py-2 hover:bg-accent cursor-pointer text-sm flex justify-between items-center group"
                                                                onMouseDown={() => handleProductSelect(row.id, p)}
                                                            >
                                                                <span>{p.name}</span>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-xs text-muted-foreground bg-muted px-1.5 rounded">{p.sku}</span>
                                                                    <span className={cn(
                                                                        "text-xs font-medium px-1.5 rounded",
                                                                        p.quantityInStock > 0 ? "text-green-600 bg-green-50" : "text-destructive bg-red-50"
                                                                    )}>
                                                                        {p.quantityInStock} left
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                {isLowStock && (
                                                    <div className="absolute top-full left-0 mt-1 flex items-center gap-1 text-xs text-orange-600">
                                                        <AlertCircle className="h-3 w-3" />
                                                        <span>Insufficient stock ({stock} available). Order will be delayed.</span>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="w-24 relative">
                                                <Layers className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    type="number"
                                                    min="1"
                                                    value={row.quantity}
                                                    onChange={(e) => handleRowChange(row.id, "quantity", e.target.value)}
                                                    placeholder="Qty"
                                                    className={cn("pl-9", isLowStock && "border-orange-300 focus-visible:ring-orange-300")}
                                                />
                                            </div>

                                            <Button 
                                                type="button" 
                                                variant="ghost" 
                                                size="icon"
                                                onClick={() => removeRow(row.id)}
                                                disabled={rows.length === 1 && !row.product && !row.quantity}
                                                className="text-muted-foreground hover:text-destructive"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="flex justify-between pt-2 border-t mt-4">
                            <Button type="button" variant="outline" onClick={addRow} className="gap-2">
                                <Plus className="h-4 w-4" /> Add Line Item
                            </Button>
                            <Button type="submit" disabled={submitting}>
                                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                Create Order
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
        
        {/* Filters */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
            <TabsList>
            <TabsTrigger value="all">All Orders</TabsTrigger>
            <TabsTrigger value="AWAITING_STOCK">Awaiting Stock</TabsTrigger>
            <TabsTrigger value="READY_TO_SHIP">Ready to Ship</TabsTrigger>
            <TabsTrigger value="ON_HOLD">On Hold</TabsTrigger>
            <TabsTrigger value="COMPLETED">Completed</TabsTrigger>
            </TabsList>
        </Tabs>

        {/* Orders Table */}
        <Card className="border-none shadow-md">
          <CardHeader className="bg-card rounded-t-lg border-b py-4">
             <div className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-muted-foreground" />
                <span className="font-semibold">Order History</span>
             </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : orders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                <ShoppingCart className="h-16 w-16 mb-4 opacity-10" />
                <p>No orders found matching the selected filter.</p>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="w-[50px]"></TableHead>
                    <TableHead className="pl-0 w-[40%]">Customer</TableHead>
                    <TableHead className="w-[15%]">Total Items</TableHead>
                    <TableHead className="w-[20%]">Status</TableHead>
                    <TableHead className="text-right pr-6 w-[20%]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => {
                    const isExpanded = expandedOrderIds.has(order.id);
                    const totalItems = order.lineItems?.reduce((sum, item) => sum + item.quantity, 0) || 0;

                    return (
                        <Fragment key={order.id}>
                            <TableRow 
                                className={cn("cursor-pointer transition-colors hover:bg-muted/30", isExpanded && "bg-muted/30")} 
                                onClick={() => toggleOrder(order.id)}
                            >
                                <TableCell className="text-muted-foreground">
                                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                </TableCell>
                                <TableCell className="pl-0 font-medium">
                                    {order.customerName}
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                    {totalItems} units
                                </TableCell>
                                <TableCell>
                                    {getStatusBadge(order.status)}
                                </TableCell>
                                <TableCell className="text-right pr-6">
                                    <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                                        {/* Awaiting Stock: Allocate + Cancel */}
                                        {order.status === "AWAITING_STOCK" && (
                                            <>
                                                <Button 
                                                    size="icon" 
                                                    variant="ghost" 
                                                    onClick={(e) => handleAllocateOrder(e, order.id)} 
                                                    title="Try Allocate Stock"
                                                    className="hover:bg-blue-50 text-blue-600"
                                                >
                                                    <PackageCheck className="h-4 w-4" />
                                                </Button>
                                                <Button size="icon" variant="ghost" onClick={(e) => initiateCancelOrder(e, order.id)} title="Cancel">
                                                    <XCircle className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </>
                                        )}

                                        {/* Ready to Ship: Complete, Hold, Cancel */}
                                        {order.status === "READY_TO_SHIP" && (
                                            <>
                                                <Button size="icon" variant="ghost" onClick={(e) => handleCompleteOrder(e, order.id)} title="Complete">
                                                    <CheckCircle className="h-4 w-4 text-green-600" />
                                                </Button>
                                                <Button size="icon" variant="ghost" onClick={(e) => handlePutOnHold(e, order.id)} title="Hold">
                                                    <Pause className="h-4 w-4 text-orange-500" />
                                                </Button>
                                                <Button size="icon" variant="ghost" onClick={(e) => initiateCancelOrder(e, order.id)} title="Cancel">
                                                    <XCircle className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </>
                                        )}

                                        {/* On Hold: Resume, Cancel */}
                                        {order.status === "ON_HOLD" && (
                                            <>
                                                <Button size="icon" variant="ghost" onClick={(e) => handleResumeOrder(e, order.id)} title="Resume">
                                                    <Play className="h-4 w-4 text-blue-600" />
                                                </Button>
                                                <Button size="icon" variant="ghost" onClick={(e) => initiateCancelOrder(e, order.id)} title="Cancel">
                                                    <XCircle className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                            
                            {isExpanded && (
                                <TableRow className="bg-muted/10 hover:bg-muted/10 border-b border-muted/50">
                                    <TableCell colSpan={5} className="p-0">
                                        <div className="px-12 py-4 bg-muted/10">
                                            <div className="rounded-md border bg-background overflow-hidden shadow-sm">
                                                <div className="grid grid-cols-[100px_1fr_80px] gap-4 p-2 bg-muted/30 text-xs font-medium text-muted-foreground border-b">
                                                    <span>SKU</span>
                                                    <span>Product Name</span>
                                                    <span className="text-right">Quantity</span>
                                                </div>
                                                {order.lineItems && order.lineItems.length > 0 ? (
                                                    order.lineItems.map((item, index) => (
                                                        <div key={index} className="grid grid-cols-[100px_1fr_80px] gap-4 p-3 border-b last:border-0 items-center hover:bg-muted/10 transition-colors">
                                                            <span className="text-xs font-mono text-muted-foreground">{item.product.sku}</span>
                                                            <span className="text-sm font-medium">{item.product.name}</span>
                                                            <span className="text-right font-mono font-semibold">{item.quantity}</span>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="p-4 text-center text-sm text-muted-foreground">No items in this order.</div>
                                                )}
                                            </div>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Cancel Confirmation Modal */}
        <AlertDialog open={isCancelOpen} onOpenChange={setIsCancelOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel Order?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to cancel this order?
                <br />
                The order request by the customer will be deleted permanently.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep Order</AlertDialogCancel>
              <AlertDialogAction onClick={confirmCancelOrder} className="bg-destructive hover:bg-destructive/90">
                Confirm Cancel
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </div>
    </div>
  );
};

export default Orders;