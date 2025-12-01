import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  Loader2, 
  FileText, 
  Package, 
  CheckCircle, 
  ArrowLeft, 
  User, 
  Box, 
  Layers, 
  Plus, 
  Trash2, 
  Pencil,
  Search,
  X,
  Download
} from "lucide-react";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { shipmentsApi, productsApi, InvoiceData } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { AxiosError } from "axios";

// -- Interfaces --

interface RequestItem {
  id: string;
  customerName: string | null;
  quantity: number;
  product: {
    name: string;
  };
}

interface ShipmentDetail {
  id: string;
  name: string;
  status: string;
  requests: RequestItem[];
}

interface ProductSuggestion {
  id: string;
  name: string;
  sku: string;
}

interface BatchRow {
  id: number;
  product: ProductSuggestion | null;
  searchQuery: string;
  quantity: string;
}

const ShipmentDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // -- Main Data State --
  const [shipment, setShipment] = useState<ShipmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  
  // -- Batch Form State --
  const [customerName, setCustomerName] = useState("");
  const [rows, setRows] = useState<BatchRow[]>([
    { id: 1, product: null, searchQuery: "", quantity: "" }
  ]);
  const [submitting, setSubmitting] = useState(false);

  // -- Manifest Filter State --
  const [manifestQuery, setManifestQuery] = useState("");

  // -- Autocomplete State --
  const [activeRowId, setActiveRowId] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<ProductSuggestion[]>([]);

  // -- Edit/Delete Modal States --
  const [editingRequest, setEditingRequest] = useState<RequestItem | null>(null);
  const [editQuantity, setEditQuantity] = useState("");
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [requestToDelete, setRequestToDelete] = useState<string | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // -- Invoice Modal State --
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);

  // -- Fetch Data --
  const fetchShipmentDetail = useCallback(async () => {
    try {
      const response = await shipmentsApi.getById(id!);
      setShipment(response.data);
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to fetch shipment details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    if (id) fetchShipmentDetail();
  }, [id, fetchShipmentDetail]);

  // -- Search Logic (Product Search) --
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

  // -- Form Handlers --
  const handleRowChange = (rowId: number, field: keyof BatchRow, value: string) => {
    setRows(prev => prev.map(row => {
      if (row.id !== rowId) return row;
      if (field === "searchQuery") return { ...row, searchQuery: value, product: null };
      return { ...row, [field]: value };
    }));
    if (field === "searchQuery") setActiveRowId(rowId);
  };

  const handleProductSelect = (rowId: number, product: ProductSuggestion) => {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validRows = rows.filter(r => r.product && r.quantity && parseInt(r.quantity) > 0);
    
    if (validRows.length === 0) {
      toast({ title: "Validation Error", description: "Add at least one product.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        customer_name: customerName.trim() || null,
        items: validRows.map(r => ({ product_id: r.product!.id, quantity: parseInt(r.quantity) }))
      };
      await shipmentsApi.addBatchRequests(id!, payload);
      toast({ title: "Success", description: `Added ${validRows.length} items` });
      setCustomerName("");
      setRows([{ id: 1, product: null, searchQuery: "", quantity: "" }]);
      fetchShipmentDetail();
    } catch (error: unknown) {
        let errorMessage = "Failed to add items";
        if (error instanceof AxiosError && error.response?.data?.detail) errorMessage = error.response.data.detail;
        toast({ title: "Error", description: errorMessage, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  // -- Actions --
  const handleStatusUpdate = async (status: string) => {
    try {
      await shipmentsApi.updateStatus(id!, status);
      toast({ title: "Success", description: `Shipment marked as ${status}` });
      fetchShipmentDetail();
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
    }
  };

  const initiateDeleteRequest = (requestId: string) => {
    setRequestToDelete(requestId);
    setIsDeleteOpen(true);
  };

  const confirmDeleteRequest = async () => {
    if (!requestToDelete) return;
    try {
      await shipmentsApi.deleteRequest(requestToDelete);
      toast({ title: "Removed", description: "Item removed from shipment" });
      fetchShipmentDetail();
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to remove item", variant: "destructive" });
    } finally {
      setIsDeleteOpen(false);
      setRequestToDelete(null);
    }
  };

  const openEditModal = (request: RequestItem) => {
    setEditingRequest(request);
    setEditQuantity(request.quantity.toString());
    setIsEditOpen(true);
  };

  const handleUpdateQuantity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRequest || !editQuantity) return;
    try {
      await shipmentsApi.updateRequest(editingRequest.id, parseInt(editQuantity));
      toast({ title: "Updated", description: "Quantity updated successfully" });
      setIsEditOpen(false);
      fetchShipmentDetail();
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to update quantity", variant: "destructive" });
    }
  };

  // -- Invoice Handlers --
  const handlePreviewInvoice = async () => {
    setInvoiceLoading(true);
    setIsInvoiceOpen(true);
    try {
      const response = await shipmentsApi.getInvoicePreview(id!);
      setInvoiceData(response.data);
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to generate invoice preview", variant: "destructive" });
      setIsInvoiceOpen(false);
    } finally {
      setInvoiceLoading(false);
    }
  };

  const handleDownloadInvoice = async () => {
    try {
      const response = await shipmentsApi.downloadInvoice(id!);
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Invoice_${shipment?.name}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast({ title: "Success", description: "Invoice downloaded successfully" });
      setIsInvoiceOpen(false);
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to download invoice", variant: "destructive" });
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case "planning": return "secondary";
      case "ordered": return "default";
      case "received": return "outline";
      default: return "secondary";
    }
  };

  // -- Filtering Logic --
  const filteredRequests = shipment?.requests.filter(request => {
    if (!manifestQuery) return true;
    const searchLower = manifestQuery.toLowerCase();
    const customer = request.customerName?.toLowerCase() || "general stock";
    const product = request.product.name.toLowerCase();
    return customer.includes(searchLower) || product.includes(searchLower);
  }) || [];

  // -- Render --

  if (loading) return (
    <div className="min-h-screen bg-muted/10 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );

  if (!shipment) return (
    <div className="min-h-screen bg-muted/10 p-8 text-center">
        <p className="text-muted-foreground">Shipment not found</p>
        <Button variant="link" onClick={() => navigate("/shipments")}>Back</Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-muted/10">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-6">
            <Button variant="ghost" className="pl-0 mb-4 hover:bg-transparent hover:text-primary" onClick={() => navigate("/shipments")}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Shipments
            </Button>
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">{shipment.name}</h1>
                    <div className="flex items-center gap-2 mt-2">
                        <Badge variant={getStatusVariant(shipment.status)} className="capitalize px-3 py-1">
                            {shipment.status.toLowerCase()}
                        </Badge>
                    </div>
                </div>
            
                <div className="flex gap-2">
                    <Button variant="outline" onClick={handlePreviewInvoice}>
                        <FileText className="mr-2 h-4 w-4" /> Supplier Invoice
                    </Button>
                    
                    {shipment.status === "PLANNING" && (
                    <Button onClick={() => handleStatusUpdate("ORDERED")}>
                        <Package className="mr-2 h-4 w-4" /> Mark as Ordered
                    </Button>
                    )}
                    
                    {shipment.status === "ORDERED" && (
                    <Button onClick={() => handleStatusUpdate("RECEIVED")} className="bg-green-600 hover:bg-green-700">
                        <CheckCircle className="mr-2 h-4 w-4" /> Mark as Received
                    </Button>
                    )}
                </div>
            </div>
        </div>

        <div className="grid gap-6">
          {/* Add Items Card */}
          {shipment.status === "PLANNING" && (
            <Card className="border-none shadow-md overflow-visible">
                <CardHeader className="bg-card rounded-t-lg border-b">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Box className="h-5 w-5 text-primary" />
                        Add Items to Shipment
                    </CardTitle>
                    <CardDescription>Add multiple products for a single customer or stock replenishment.</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="max-w-md">
                            <Label htmlFor="customerName">Customer Name (Optional)</Label>
                            <div className="relative mt-1.5">
                                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="customerName"
                                    value={customerName}
                                    onChange={(e) => setCustomerName(e.target.value)}
                                    placeholder="Leave empty for general stock"
                                    className="pl-10"
                                />
                            </div>
                        </div>

                        <div className="space-y-3">
                            <Label>Products</Label>
                            {rows.map((row, index) => (
                                <div key={row.id} className="flex gap-3 items-start">
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
                                        {activeRowId === row.id && suggestions.length > 0 && (
                                            <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-60 overflow-auto">
                                                {suggestions.map((p) => (
                                                    <div
                                                        key={p.id}
                                                        className="px-4 py-2 hover:bg-accent cursor-pointer text-sm flex justify-between"
                                                        onMouseDown={() => handleProductSelect(row.id, p)}
                                                    >
                                                        <span>{p.name}</span>
                                                        <span className="text-xs text-muted-foreground bg-muted px-1 rounded">{p.sku}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="w-32 relative">
                                        <Layers className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            type="number"
                                            min="1"
                                            value={row.quantity}
                                            onChange={(e) => handleRowChange(row.id, "quantity", e.target.value)}
                                            placeholder="Qty"
                                            className="pl-9"
                                        />
                                    </div>

                                    <Button 
                                        type="button" 
                                        variant="ghost" 
                                        size="icon" 
                                        className="text-muted-foreground hover:text-destructive"
                                        onClick={() => removeRow(row.id)}
                                        disabled={rows.length === 1 && index === 0 && !row.product && !row.quantity}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>

                        <div className="flex items-center gap-4">
                            <Button type="button" variant="outline" onClick={addRow} className="gap-2">
                                <Plus className="h-4 w-4" /> Add Another Product
                            </Button>
                            <Button type="submit" disabled={submitting} className="ml-auto min-w-[140px]">
                                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add to Shipment"}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
          )}

          {/* Manifest Table */}
          <Card className="border-none shadow-md">
            <CardHeader className="bg-card rounded-t-lg border-b py-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Layers className="h-5 w-5 text-muted-foreground" />
                        Shipment Manifest
                    </CardTitle>
                    
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Filter by customer or product..." 
                            className="pl-9 h-9 bg-background"
                            value={manifestQuery}
                            onChange={(e) => setManifestQuery(e.target.value)}
                        />
                        {manifestQuery && (
                            <button 
                                onClick={() => setManifestQuery("")}
                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0">
              {shipment.requests.length === 0 ? (
                <div className="text-center py-16">
                    <div className="bg-muted/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Package className="h-8 w-8 text-muted-foreground/50" />
                    </div>
                    <h3 className="text-lg font-medium">Empty Shipment</h3>
                    <p className="text-muted-foreground mt-1">Start adding items above.</p>
                </div>
              ) : filteredRequests.length === 0 ? (
                <div className="text-center py-12">
                    <p className="text-muted-foreground">No matching items found in this shipment.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="pl-6">Product</TableHead>
                      <TableHead>Allocation</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      {shipment.status === "PLANNING" && (
                        <TableHead className="w-[100px] text-right pr-6">Actions</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRequests.map((request) => (
                      <TableRow key={request.id} className="hover:bg-muted/30 group">
                        <TableCell className="pl-6 font-medium">{request.product.name}</TableCell>
                        <TableCell>
                            {request.customerName ? (
                                <div className="flex items-center gap-2">
                                    <User className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-foreground font-medium">{request.customerName}</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <Box className="h-4 w-4" />
                                    <span>General Stock</span>
                                </div>
                            )}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold">{request.quantity}</TableCell>
                        
                        {shipment.status === "PLANNING" && (
                            <TableCell className="text-right pr-6">
                                <div className="flex justify-end gap-1">
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-muted"
                                        onClick={() => openEditModal(request)}
                                        title="Edit Quantity"
                                    >
                                        <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                        onClick={() => initiateDeleteRequest(request.id)}
                                        title="Remove Item"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Edit Quantity Modal */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Update Quantity</DialogTitle>
                    <DialogDescription>
                        Modify the quantity for {editingRequest?.product.name}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleUpdateQuantity}>
                    <div className="py-4">
                        <Label htmlFor="edit-qty">Quantity</Label>
                        <Input 
                            id="edit-qty"
                            type="number" 
                            min="1"
                            value={editQuantity} 
                            onChange={(e) => setEditQuantity(e.target.value)}
                            className="mt-2"
                            autoFocus
                        />
                    </div>
                    <DialogFooter>
                        <Button type="submit">Update</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>

        {/* Delete Confirmation Modal */}
        <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Item?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to remove this item from the shipment?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDeleteRequest} className="bg-destructive hover:bg-destructive/90">
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Invoice Preview Modal */}
        <Dialog open={isInvoiceOpen} onOpenChange={setIsInvoiceOpen}>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Supplier Invoice Preview</DialogTitle>
                    <DialogDescription>
                        Consolidated list of items by SKU.
                    </DialogDescription>
                </DialogHeader>
                
                {invoiceLoading ? (
                    <div className="py-12 flex justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : invoiceData ? (
                    <div className="space-y-4">
                        <div className="border rounded-md max-h-[400px] overflow-auto">
                            <Table>
                                <TableHeader className="bg-muted/50">
                                    <TableRow>
                                        <TableHead className="w-[150px]">SKU</TableHead>
                                        <TableHead>Product Name</TableHead>
                                        <TableHead className="text-right">Total Quantity</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {invoiceData.items.map((item) => (
                                        <TableRow key={item.sku}>
                                            <TableCell className="font-mono text-sm">{item.sku}</TableCell>
                                            <TableCell>{item.product_name}</TableCell>
                                            <TableCell className="text-right font-bold">{item.total_quantity}</TableCell>
                                        </TableRow>
                                    ))}
                                    <TableRow className="bg-muted/20 font-bold">
                                        <TableCell colSpan={2} className="text-right">Total Items:</TableCell>
                                        <TableCell className="text-right">{invoiceData.total_items}</TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsInvoiceOpen(false)}>Cancel</Button>
                            <Button onClick={handleDownloadInvoice}>
                                <Download className="mr-2 h-4 w-4" /> Download Excel
                            </Button>
                        </DialogFooter>
                    </div>
                ) : null}
            </DialogContent>
        </Dialog>

      </div>
    </div>
  );
};

export default ShipmentDetail;