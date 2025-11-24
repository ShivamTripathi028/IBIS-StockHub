from pydantic import BaseModel, ConfigDict
from prisma.enums import OrderStatus, OrderSource

# --- Schemas for Creating Orders ---

class OrderLineItemCreate(BaseModel):
    """A single line item in a new order request."""
    product_id: str
    quantity: int

class OrderCreate(BaseModel):
    """The complete payload for creating a new order."""
    customer_name: str
    source: OrderSource
    # An order can contain multiple products
    line_items: list[OrderLineItemCreate]


# --- Schemas for Displaying Orders ---

class ProductInfo(BaseModel):
    """Basic product info for displaying in an order."""
    name: str

class OrderLineItem(BaseModel):
    """A single line item in a response."""
    quantity: int
    product: ProductInfo
    model_config = ConfigDict(from_attributes=True)

class Order(BaseModel):
    """The full order details for the API response."""
    id: str
    customer_name: str
    source: OrderSource
    status: OrderStatus
    products: list[OrderLineItem] = [] # The frontend expects a 'products' field
    model_config = ConfigDict(from_attributes=True)