import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Loader2, FileText, Package, CheckCircle } from "lucide-react";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { shipmentsApi, productsApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface ShipmentDetail {
  id: string;
  name: string;
  status: string;
  requests: any[];
}

const ShipmentDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [shipment, setShipment] = useState<ShipmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [customerName, setCustomerName] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [quantity, setQuantity] = useState("");
  const [productSuggestions, setProductSuggestions] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (id) fetchShipmentDetail();
  }, [id]);

  useEffect(() => {
    const delaySearch = setTimeout(() => {
      if (productSearch) searchProducts();
    }, 300);
    return () => clearTimeout(delaySearch);
  }, [productSearch]);

  const fetchShipmentDetail = async () => {
    try {
      const response = await shipmentsApi.getById(id!);
      setShipment(response.data);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch shipment details",
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

  const handleAddRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !selectedProduct || !quantity) {
      toast({
        title: "Error",
        description: "Please fill all fields",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      await shipmentsApi.addRequest(id!, {
        customer_name: customerName,
        product_id: selectedProduct.id,
        quantity: parseInt(quantity),
      });
      
      toast({
        title: "Success",
        description: "Customer request added",
      });
      
      setCustomerName("");
      setProductSearch("");
      setSelectedProduct(null);
      setQuantity("");
      fetchShipmentDetail();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add request",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusUpdate = async (status: string) => {
    try {
      await shipmentsApi.updateStatus(id!, status);
      toast({
        title: "Success",
        description: `Shipment marked as ${status}`,
      });
      fetchShipmentDetail();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update status",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!shipment) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-8 text-center">
          <p className="text-muted-foreground">Shipment not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{shipment.name}</h1>
            <Badge className="mt-2" variant="outline">{shipment.status}</Badge>
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => toast({ title: "Invoice", description: "Feature coming soon" })}>
              <FileText className="mr-2 h-4 w-4" />
              Generate Supplier Invoice
            </Button>
            {shipment.status === "Planning" && (
              <Button onClick={() => handleStatusUpdate("Ordered")}>
                <Package className="mr-2 h-4 w-4" />
                Mark as Ordered
              </Button>
            )}
            {shipment.status === "Ordered" && (
              <Button onClick={() => handleStatusUpdate("Received")}>
                <CheckCircle className="mr-2 h-4 w-4" />
                Mark as Received
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Add Customer Request</CardTitle>
              <CardDescription>
                Add a new pre-order request to this shipment
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddRequest} className="grid gap-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="customerName">Customer Name</Label>
                    <Input
                      id="customerName"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Enter customer name"
                    />
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
                </div>
                
                <Button type="submit" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    "Add Request"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Customer Requests</CardTitle>
              <CardDescription>
                All pre-orders included in this shipment
              </CardDescription>
            </CardHeader>
            <CardContent>
              {shipment.requests.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No requests yet. Add your first customer request above.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer Name</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Quantity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shipment.requests.map((request, index) => (
                      <TableRow key={index}>
                        <TableCell>{request.customer_name}</TableCell>
                        <TableCell>{request.product_name}</TableCell>
                        <TableCell>{request.quantity}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ShipmentDetail;
