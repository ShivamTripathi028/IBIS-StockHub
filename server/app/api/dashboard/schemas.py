from pydantic import BaseModel

class DashboardStats(BaseModel):
    total_skus: int
    total_units: int
    low_stock_count: int
    pending_shipments: int
    active_orders: int
    
class LowStockItem(BaseModel):
    id: str
    name: str
    sku: str
    quantity: int