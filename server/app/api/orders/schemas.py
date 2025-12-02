from pydantic import BaseModel, ConfigDict, Field
from prisma.enums import OrderStatus, OrderSource
from datetime import datetime

# --- Schemas for Creating Orders ---

class OrderLineItemCreate(BaseModel):
    product_id: str
    quantity: int

class OrderCreate(BaseModel):
    customer_name: str
    source: OrderSource
    line_items: list[OrderLineItemCreate]


# --- Schemas for Displaying Orders ---

class ProductInfo(BaseModel):
    name: str
    sku: str

class OrderLineItem(BaseModel):
    quantity: int
    product: ProductInfo
    model_config = ConfigDict(from_attributes=True)

class Order(BaseModel):
    id: str
    customer_name: str = Field(alias='customerName')
    source: OrderSource
    status: OrderStatus
    products: list[OrderLineItem] = Field(alias='lineItems', default=[]) 
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)