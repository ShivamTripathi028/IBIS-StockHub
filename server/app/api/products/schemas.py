from pydantic import BaseModel, ConfigDict

class ProductBase(BaseModel):
    sku: str
    name: str
    quantityInStock: int = 0

class ProductCreate(ProductBase):
    pass

class Product(ProductBase):
    id: str
    model_config = ConfigDict(from_attributes=True)