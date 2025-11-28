import { useState, useEffect } from "react";
import { Search, Loader2, Inbox, SearchX, ExternalLink } from "lucide-react";
import Navigation from "@/components/Navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { inventoryApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface InventoryItem {
  sku: string;
  name: string;
  quantityInStock: number;
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
          item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.sku.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredInventory(filtered);
    } else {
      setFilteredInventory(inventory);
    }
  }, [searchQuery, inventory]);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const response = await inventoryApi.getAll();
      setInventory(response.data);
      setFilteredInventory(response.data);
    } catch (error) {
      console.error("Failed to fetch inventory:", error);
      toast({
        title: "Error",
        description: "Failed to fetch inventory.",
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
        <Card className="shadow-xl border-0 rounded-2xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-4xl font-bold tracking-tight">Inventory Dashboard</CardTitle>
            <CardDescription className="text-base mt-1 text-muted-foreground">
              Monitor real-time stock availability
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="mb-6 flex items-center justify-between">
              <div className="relative w-full max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder="Search products by name or SKU..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12 py-6 rounded-xl text-base shadow-sm"
                />
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-24">
                <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
              </div>
            ) : filteredInventory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                {searchQuery ? (
                  <SearchX className="h-20 w-20 text-muted-foreground/40" />
                ) : (
                  <Inbox className="h-20 w-20 text-muted-foreground/40" />
                )}
                <h2 className="mt-5 text-2xl font-semibold">
                  {searchQuery ? "No Results Found" : "Inventory Empty"}
                </h2>
                <p className="mt-2 text-muted-foreground text-base max-w-md">
                  {searchQuery
                    ? `No products match "${searchQuery}" in the current stock.`
                    : "There are currently no items with positive stock levels."}
                </p>
              </div>
            ) : (
              <div className="rounded-xl border overflow-hidden shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="font-semibold text-base py-4">SKU</TableHead>
                      <TableHead className="font-semibold text-base">Product Name</TableHead>
                      <TableHead className="font-semibold text-base text-right pr-6">
                        Quantity
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInventory.map((item) => (
                      <TableRow key={item.sku} className="hover:bg-muted/20 transition">
                        <TableCell className="font-mono text-primary font-medium">
                          <a
                            href={`https://store.rakwireless.com/pages/search-results-page?q=${item.sku}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 hover:underline"
                          >
                            {item.sku}
                            <ExternalLink className="h-3 w-3 opacity-60" />
                          </a>
                        </TableCell>
                        <TableCell className="font-medium text-base">{item.name}</TableCell>
                        <TableCell className="text-right pr-6 text-base">
                          <span
                            className={
                              item.quantityInStock < 10
                                ? "text-destructive font-semibold"
                                : "font-semibold"
                            }
                          >
                            {item.quantityInStock}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Inventory;