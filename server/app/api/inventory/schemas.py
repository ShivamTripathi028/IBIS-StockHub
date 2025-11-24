from pydantic import BaseModel, ConfigDict, Field

# This schema defines the structure for a single inventory item in the API response.
class InventoryItem(BaseModel):
    # The frontend page expects these specific field names.
    # We use aliases to map them from our Prisma 'Product' model.
    product_sku: str = Field(..., alias='sku')
    product_name: str = Field(..., alias='name')
    quantity: int = Field(..., alias='quantityInStock')

    # This config allows Pydantic to read data from the Prisma model object.
    model_config = ConfigDict(from_attributes=True)