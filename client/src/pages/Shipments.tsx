import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Loader2 } from "lucide-react";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { shipmentsApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface Shipment {
  id: string;
  name: string;
  creation_date: string;
  status: string;
}

const Shipments = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchShipments();
  }, []);

  const fetchShipments = async () => {
    try {
      const response = await shipmentsApi.getAll();
      setShipments(response.data);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch shipments",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateShipment = async () => {
    setCreating(true);
    try {
      const response = await shipmentsApi.create();
      const newShipmentId = response.data.id;
      toast({
        title: "Success",
        description: "New shipment created",
      });
      navigate(`/shipments/${newShipmentId}`);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create shipment",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
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
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-3xl">Purchase Planning</CardTitle>
                <CardDescription className="mt-2">
                  Manage bulk shipments and supplier orders
                </CardDescription>
              </div>
              <Button onClick={handleCreateShipment} disabled={creating}>
                {creating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Create New Shipment
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : shipments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No shipments yet. Create your first shipment to get started.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Shipment Name</TableHead>
                    <TableHead>Creation Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shipments.map((shipment) => (
                    <TableRow
                      key={shipment.id}
                      className="cursor-pointer hover:bg-accent"
                      onClick={() => navigate(`/shipments/${shipment.id}`)}
                    >
                      <TableCell className="font-medium">{shipment.name}</TableCell>
                      <TableCell>
                        {new Date(shipment.creation_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(shipment.status)}>
                          {shipment.status}
                        </Badge>
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

export default Shipments;
