from pydantic import BaseModel, ConfigDict, field_validator

class ProductBase(BaseModel):
    sku: str
    name: str
    quantityInStock: int = 0

class ProductCreate(ProductBase):
    @field_validator('sku')
    def sku_must_be_valid_format(cls, v):
        # 1. Clean whitespace
        v = str(v).strip()
        
        # 2. Check Length (5, 6, or 7 characters)
        if not (5 <= len(v) <= 7):
            raise ValueError('SKU must be 5, 6, or 7 characters long')
            
        # 3. Check Content (Letters and Numbers only, no special chars)
        if not v.isalnum():
            raise ValueError('SKU must be alphanumeric (letters and numbers only)')
            
        # 4. Standardize to Uppercase (e.g., b12345 -> B12345)
        return v.upper()

class Product(ProductBase):
    id: str
    model_config = ConfigDict(from_attributes=True)