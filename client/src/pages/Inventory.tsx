import { useState, useEffect, useCallback } from "react";
import { Search, Loader2, Inbox, SearchX, ExternalLink, ArrowUpDown, ArrowUp, ArrowDown, Trash2, Eye, EyeOff, Plus } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
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
import { inventoryApi, productsApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { AxiosError } from "axios";

interface InventoryItem {
  sku: string;
  name: string;
  quantityInStock: number;
}

type SortOrder = 'asc' | 'desc' | null;

const Inventory = () => {
  const { toast } = useToast();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>(null);

  const [isClearOpen, setIsClearOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  // -- Create Product State --
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newSku, setNewSku] = useState("");
  const [newName, setNewName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Fetch Inventory (Search Aware)
  const fetchInventory = useCallback(async (query: string = "") => {
    setLoading(true);
    try {
      const response = await inventoryApi.getAll(query);
      setInventory(response.data);
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
  }, [toast]);

  // Debounced Search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchInventory(searchQuery);
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery, fetchInventory]);

  const handleClearStock = async () => {
    setIsClearing(true);
    try {
      await inventoryApi.clearStock();
      toast({
        title: "Inventory Cleared",
        description: "All product quantities have been reset to 0.",
      });
      fetchInventory();
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to clear inventory.",
        variant: "destructive",
      });
    } finally {
      setIsClearing(false);
      setIsClearOpen(false);
    }
  };

  // -- Handle Create Product --
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSku.trim() || !newName.trim()) return;

    setIsCreating(true);
    try {
      await productsApi.create({ name: newName, sku: newSku });
      toast({ title: "Success", description: "Product created successfully." });
      
      setIsCreateOpen(false);
      setNewName("");
      setNewSku("");
      
      // Auto-search for the new item so the user sees it immediately
      setSearchQuery(newSku);
      fetchInventory(newSku);
    } catch (error: unknown) {
        let msg = "Failed to create product";
        if (error instanceof AxiosError && error.response?.data?.detail) {
            msg = error.response.data.detail;
        }
        toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
        setIsCreating(false);
    }
  };

  const toggleSort = () => {
    if (sortOrder === null) setSortOrder('asc');
    else if (sortOrder === 'asc') setSortOrder('desc');
    else setSortOrder(null);
  };

  const getSortIcon = () => {
    if (sortOrder === 'asc') return <ArrowUp className="h-4 w-4" />;
    if (sortOrder === 'desc') return <ArrowDown className="h-4 w-4" />;
    return <ArrowUpDown className="h-4 w-4" />;
  };

  // Client-side sorting for the current result set
  const sortedInventory = [...inventory].sort((a, b) => {
    if (!sortOrder) return 0;
    return sortOrder === 'asc' 
      ? a.quantityInStock - b.quantityInStock 
      : b.quantityInStock - a.quantityInStock;
  });

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
            <div className="mb-6 flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
              <div className="relative w-full max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder="Search catalog by SKU or Name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12 py-6 rounded-xl text-base shadow-sm"
                />
              </div>
              
              <div className="flex gap-2 items-center">
                {/* [NEW] Create Product Dialog */}
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogTrigger asChild>
                        <Button className="h-14 px-6 rounded-xl shadow-sm gap-2">
                            <Plus className="h-4 w-4" />
                            <span className="hidden md:inline">New Product</span>
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add New Product</DialogTitle>
                            <DialogDescription>
                                Add a new SKU to the catalog. It will start with 0 stock.
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleCreateProduct} className="space-y-4 py-2">
                            <div className="space-y-2">
                                <Label htmlFor="sku">SKU</Label>
                                <Input 
                                    id="sku" 
                                    value={newSku} 
                                    onChange={(e) => setNewSku(e.target.value)} 
                                    // [CHANGED] Updated Placeholder
                                    placeholder="e.g. 920287 or B12453" 
                                    autoFocus
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="name">Product Name</Label>
                                <Input 
                                    id="name" 
                                    value={newName} 
                                    onChange={(e) => setNewName(e.target.value)} 
                                    placeholder="e.g. WisBlock Dual IO Base Board"
                                />
                            </div>
                            <DialogFooter>
                                <Button type="submit" disabled={isCreating}>
                                    {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Create Product
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>

                <Button 
                    variant="destructive" 
                    onClick={() => setIsClearOpen(true)}
                    className="h-14 px-6 rounded-xl shadow-sm gap-2"
                >
                    <Trash2 className="h-4 w-4" />
                    <span className="hidden md:inline">Clear Stock</span>
                </Button>

                <Button 
                    variant="outline" 
                    onClick={toggleSort}
                    className="h-14 px-6 rounded-xl border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground gap-2 min-w-[140px]"
                >
                    {getSortIcon()}
                    <span>Sort</span>
                </Button>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-24">
                <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
              </div>
            ) : sortedInventory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                {searchQuery ? (
                  <SearchX className="h-20 w-20 text-muted-foreground/40" />
                ) : (
                  <Inbox className="h-20 w-20 text-muted-foreground/40" />
                )}
                <h2 className="mt-5 text-2xl font-semibold">
                  {searchQuery ? "No Results Found" : "No Active Stock"}
                </h2>
                <p className="mt-2 text-muted-foreground text-base max-w-md">
                  {searchQuery
                    ? `No products match "${searchQuery}".`
                    : "You have no items in stock. Search above to find any item in the full catalog."}
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
                    {sortedInventory.map((item) => (
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
                              item.quantityInStock === 0 
                                ? "text-muted-foreground opacity-50"
                                : item.quantityInStock < 10
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

        {/* Clear Stock Confirmation Modal */}
        <AlertDialog open={isClearOpen} onOpenChange={setIsClearOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-destructive">Reset Entire Inventory?</AlertDialogTitle>
              <AlertDialogDescription>
                This will set the stock quantity of <strong>ALL products</strong> to 0. 
                This action is for development testing and cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleClearStock} 
                className="bg-destructive hover:bg-destructive/90"
                disabled={isClearing}
              >
                {isClearing ? "Resetting..." : "Confirm Reset"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </div>
    </div>
  );
};

export default Inventory;