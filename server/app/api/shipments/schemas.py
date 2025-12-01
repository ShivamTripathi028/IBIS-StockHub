from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime
from prisma.enums import ShipmentStatus

class ShipmentCreate(BaseModel):
    name: str

class ShipmentRequestCreate(BaseModel):
    customer_name: str | None = None
    product_id: str
    quantity: int

class ShipmentRequestBatchItem(BaseModel):
    product_id: str
    quantity: int

class ShipmentRequestBatchCreate(BaseModel):
    customer_name: str | None = None
    items: list[ShipmentRequestBatchItem]

class ShipmentRequestUpdate(BaseModel):
    quantity: int

class ShipmentRequest(BaseModel):
    id: str
    customer_name: str | None = Field(alias='customerName')
    quantity: int
    
    class ProductInfo(BaseModel):
        name: str
    product: ProductInfo
    model_config = ConfigDict(from_attributes=True, arbitrary_types_allowed=True)

class ShipmentDetail(BaseModel):
    id: str
    name: str
    status: ShipmentStatus
    requests: list[ShipmentRequest]
    model_config = ConfigDict(from_attributes=True, arbitrary_types_allowed=True)

class ShipmentStatusUpdate(BaseModel):
    status: ShipmentStatus

class ShipmentListItem(BaseModel):
    id: str
    name: str
    status: ShipmentStatus
    creation_date: datetime = Field(..., alias='createdAt')
    model_config = ConfigDict(from_attributes=True, arbitrary_types_allowed=True)

class InvoiceItem(BaseModel):
    sku: str
    product_name: str
    total_quantity: int

class InvoiceData(BaseModel):
    shipment_name: str
    items: list[InvoiceItem]
    total_items: int