import { NavLink } from "@/components/NavLink";
import { Package, ShoppingCart, Warehouse } from "lucide-react";

const Navigation = () => {
  return (
    <nav className="border-b border-border bg-card">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <Warehouse className="h-6 w-6 text-primary" />
            <span className="text-xl font-semibold text-foreground">Inventory Manager</span>
          </div>
          
          <div className="flex gap-1">
            <NavLink
              to="/shipments"
              className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
              activeClassName="bg-accent text-accent-foreground"
            >
              <Package className="h-4 w-4" />
              Shipment Planning
            </NavLink>
            
            <NavLink
              to="/orders"
              className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
              activeClassName="bg-accent text-accent-foreground"
            >
              <ShoppingCart className="h-4 w-4" />
              Sales Hub
            </NavLink>
            
            <NavLink
              to="/inventory"
              className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
              activeClassName="bg-accent text-accent-foreground"
            >
              <Warehouse className="h-4 w-4" />
              Inventory
            </NavLink>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
