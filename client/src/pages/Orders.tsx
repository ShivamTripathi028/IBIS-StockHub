import { useState, useEffect } from "react";
import { Plus, Loader2, CheckCircle, XCircle, Pencil, Pause } from "lucide-react";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ordersApi, productsApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface Order {
  id: string;
  customer_name: string;
  source: string;
  products: any[];
  status: string;
}

const Orders = () => {
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [orderSource, setOrderSource] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [quantity, setQuantity] = useState("");
  const [productSuggestions, setProductSuggestions] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, [activeTab]);

  useEffect(() => {
    const delaySearch = setTimeout(() => {
      if (productSearch) searchProducts();
    }, 300);
    return () => clearTimeout(delaySearch);
  }, [productSearch]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const status = activeTab === "all" ? undefined : activeTab;
      const response = await ordersApi.getAll(status);
      setOrders(response.data);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch orders",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const searchProducts = async () => {
    try {
      const response = await productsApi.search(productSearch);
      setProductSuggestions(response.data);
    } catch (error) {
      console.error("Failed to search products");
    }
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !orderSource || !selectedProduct || !quantity) {
      toast({
        title: "Error",
        description: "Please fill all fields",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      await ordersApi.create({
        customer_name: customerName,
        source: orderSource,
        product_id: selectedProduct.id,
        quantity: parseInt(quantity),
      });
      
      toast({
        title: "Success",
        description: "Order created successfully",
      });
      
      setIsCreateModalOpen(false);
      resetForm();
      fetchOrders();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create order",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteOrder = async (orderId: string) => {
    try {
      await ordersApi.complete(orderId);
      toast({
        title: "Success",
        description: "Order marked as completed",
      });
      fetchOrders();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to complete order",
        variant: "destructive",
      });
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    try {
      await ordersApi.cancel(orderId);
      toast({
        title: "Success",
        description: "Order cancelled",
      });
      fetchOrders();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to cancel order",
        variant: "destructive",
      });
    }
  };

  const handlePutOnHold = async (orderId: string) => {
    try {
      await ordersApi.hold(orderId);
      toast({
        title: "Success",
        description: "Order put on hold",
      });
      fetchOrders();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to put order on hold",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setCustomerName("");
    setOrderSource("");
    setProductSearch("");
    setSelectedProduct(null);
    setQuantity("");
  };

  const getStatusVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case "awaiting stock":
        return "secondary";
      case "ready to ship":
        return "default";
      case "completed":
        return "outline";
      case "cancelled":
        return "destructive";
      case "on-hold":
        return "secondary";
      default:
        return "secondary";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-3xl">Sales Hub</CardTitle>
                <CardDescription className="mt-2">
                  Manage all customer orders and track fulfillment
                </CardDescription>
              </div>
              <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Create New Order
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Order</DialogTitle>
                    <DialogDescription>
                      Add a new local or Amazon order
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateOrder} className="grid gap-4">
                    <div>
                      <Label htmlFor="customerName">Customer Name</Label>
                      <Input
                        id="customerName"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Enter customer name"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="orderSource">Order Source</Label>
                      <Select value={orderSource} onValueChange={setOrderSource}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select source" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Local">Local</SelectItem>
                          <SelectItem value="Amazon">Amazon</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="relative">
                      <Label htmlFor="productSearch">Product</Label>
                      <Input
                        id="productSearch"
                        value={productSearch}
                        onChange={(e) => {
                          setProductSearch(e.target.value);
                          setSelectedProduct(null);
                        }}
                        placeholder="Search for product"
                      />
                      {productSuggestions.length > 0 && !selectedProduct && (
                        <div className="absolute z-10 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-auto">
                          {productSuggestions.map((product) => (
                            <div
                              key={product.id}
                              className="px-4 py-2 hover:bg-accent cursor-pointer"
                              onClick={() => {
                                setSelectedProduct(product);
                                setProductSearch(product.name);
                                setProductSuggestions([]);
                              }}
                            >
                              {product.name} - {product.sku}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <div>
                      <Label htmlFor="quantity">Quantity</Label>
                      <Input
                        id="quantity"
                        type="number"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        placeholder="Enter quantity"
                        min="1"
                      />
                    </div>
                    
                    <Button type="submit" disabled={submitting}>
                      {submitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        "Create Order"
                      )}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="awaiting stock">Awaiting Stock</TabsTrigger>
                <TabsTrigger value="ready to ship">Ready to Ship</TabsTrigger>
                <TabsTrigger value="on-hold">On-Hold</TabsTrigger>
                <TabsTrigger value="completed">Completed</TabsTrigger>
                <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
              </TabsList>
            </Tabs>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No orders found
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Customer Name</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Products</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-mono text-sm">{order.id}</TableCell>
                      <TableCell>{order.customer_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{order.source}</Badge>
                      </TableCell>
                      <TableCell>
                        {order.products.map((p: any, i: number) => (
                          <div key={i} className="text-sm">
                            {p.name} (x{p.quantity})
                          </div>
                        ))}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(order.status)}>
                          {order.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {order.status !== "Completed" && order.status !== "Cancelled" && order.status !== "On-Hold" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleCompleteOrder(order.id)}
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handlePutOnHold(order.id)}
                              >
                                <Pause className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleCancelOrder(order.id)}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Orders;
