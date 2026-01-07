from pydantic import BaseModel

class DashboardStats(BaseModel):
    total_skus: int
    total_units: int
    low_stock_count: int
    pending_shipments: int
    # [CHANGED] Replaced generic 'active_orders' with specific metrics
    orders_ready: int    # Actionable (Ready to Ship)
    orders_waiting: int  # Blocked (Awaiting Stock)
    
class LowStockItem(BaseModel):
    id: str
    name: str
    sku: str
    quantity: int