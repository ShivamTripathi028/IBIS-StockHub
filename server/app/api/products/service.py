from prisma import Prisma
from .schemas import ProductCreate

async def get_all(db: Prisma):
    """Returns all products from the database."""
    return await db.product.find_many()

async def create(db: Prisma, product_data: ProductCreate):
    """Creates a new product in the database."""
    return await db.product.create(data=product_data.model_dump())

async def get_by_sku(db: Prisma, sku: str):
    """Finds a product by its unique SKU."""
    return await db.product.find_unique(where={'sku': sku})