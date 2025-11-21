import { useState, useEffect } from "react";
import { Search, Loader2 } from "lucide-react";
import Navigation from "@/components/Navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { inventoryApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface InventoryItem {
  product_sku: string;
  product_name: string;
  quantity: number;
}

const Inventory = () => {
  const { toast } = useToast();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [filteredInventory, setFilteredInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchInventory();
  }, []);

  useEffect(() => {
    if (searchQuery) {
      const filtered = inventory.filter(
        (item) =>
          item.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.product_sku.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredInventory(filtered);
    } else {
      setFilteredInventory(inventory);
    }
  }, [searchQuery, inventory]);

  const fetchInventory = async () => {
    try {
      const response = await inventoryApi.getAll();
      setInventory(response.data);
      setFilteredInventory(response.data);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch inventory",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">Inventory</CardTitle>
            <CardDescription className="mt-2">
              Real-time view of all products in stock
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <div className="mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by product name or SKU..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredInventory.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery ? "No products found matching your search" : "No products in inventory"}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product SKU</TableHead>
                    <TableHead>Product Name</TableHead>
                    <TableHead className="text-right">Quantity in Stock</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInventory.map((item) => (
                    <TableRow key={item.product_sku}>
                      <TableCell className="font-mono">{item.product_sku}</TableCell>
                      <TableCell className="font-medium">{item.product_name}</TableCell>
                      <TableCell className="text-right">
                        <span className={item.quantity < 10 ? "text-destructive font-semibold" : ""}>
                          {item.quantity}
                        </span>
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

export default Inventory;
