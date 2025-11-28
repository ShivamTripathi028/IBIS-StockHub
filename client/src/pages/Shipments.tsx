import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Loader2, Package, Calendar, Trash2 } from "lucide-react";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { shipmentsApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface Shipment {
  id: string;
  name: string;
  createdAt: string;
  status: string;
}

const Shipments = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newShipmentName, setNewShipmentName] = useState("");
  const [creating, setCreating] = useState(false);

  // Delete Modal State
  const [shipmentToDelete, setShipmentToDelete] = useState<string | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  useEffect(() => {
    fetchShipments();
  }, []);

  const fetchShipments = async () => {
    try {
      const response = await shipmentsApi.getAll();
      setShipments(response.data);
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to fetch shipments",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShipmentName.trim()) return;

    setCreating(true);
    try {
      const response = await shipmentsApi.create({ name: newShipmentName });
      const newShipmentId = response.data.id;
      
      toast({
        title: "Success",
        description: "New shipment created",
      });
      
      setIsCreateOpen(false);
      setNewShipmentName("");
      navigate(`/shipments/${newShipmentId}`);
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to create shipment",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const initiateDelete = (e: React.MouseEvent, id: string, status: string) => {
    e.stopPropagation(); // Prevent row click navigation

    if (status !== "PLANNING") {
      toast({
        title: "Cannot Delete",
        description: "Only shipments in PLANNING stage can be deleted.",
        variant: "destructive",
      });
      return;
    }

    setShipmentToDelete(id);
    setIsDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!shipmentToDelete) return;

    try {
      await shipmentsApi.delete(shipmentToDelete);
      toast({
        title: "Deleted",
        description: "Shipment deleted successfully",
      });
      // Refresh list locally
      setShipments(shipments.filter(s => s.id !== shipmentToDelete));
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to delete shipment",
        variant: "destructive",
      });
    } finally {
      setIsDeleteOpen(false);
      setShipmentToDelete(null);
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case "planning":
        return "secondary";
      case "ordered":
        return "default";
      case "received":
        return "outline";
      default:
        return "secondary";
    }
  };

  return (
    <div className="min-h-screen bg-muted/10">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Purchase Planning</h1>
            <p className="text-muted-foreground mt-1">
              Manage bulk shipments and supplier orders
            </p>
          </div>
          
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
                <Button className="shadow-sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Create New Shipment
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create New Shipment</DialogTitle>
                    <DialogDescription>
                        Give your new shipment a name to identify it (e.g., "Nov Restock").
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateShipment}>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name">Shipment Name</Label>
                            <Input 
                                id="name" 
                                value={newShipmentName} 
                                onChange={(e) => setNewShipmentName(e.target.value)} 
                                placeholder="e.g. Q4 Inventory Restock" 
                                autoFocus
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={creating || !newShipmentName.trim()}>
                            {creating ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                "Create Shipment"
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="border-none shadow-md">
          <CardHeader className="border-b bg-card rounded-t-lg py-4">
             <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-muted-foreground" />
                <span className="font-semibold">Shipments List</span>
             </div>
          </CardHeader>
          
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : shipments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
                <Package className="h-16 w-16 mb-4 opacity-10" />
                <p>No shipments yet. Create your first shipment to get started.</p>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="pl-6 w-[40%]">Shipment Name</TableHead>
                    <TableHead>Creation Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[100px] text-right pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shipments.map((shipment) => (
                    <TableRow
                      key={shipment.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors group"
                      onClick={() => navigate(`/shipments/${shipment.id}`)}
                    >
                      <TableCell className="font-medium pl-6">{shipment.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 opacity-70" />
                            {new Date(shipment.createdAt).toLocaleDateString(undefined, {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                            })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(shipment.status)} className="capitalize">
                          {shipment.status.toLowerCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        {shipment.status === "PLANNING" && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => initiateDelete(e, shipment.id, shipment.status)}
                                title="Delete Shipment"
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Delete Confirmation Modal */}
        <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the shipment plan 
                and all associated customer requests.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </div>
    </div>
  );
};

export default Shipments;